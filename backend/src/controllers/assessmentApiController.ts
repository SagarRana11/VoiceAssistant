/**
 * assessmentApiController.ts
 * HTTP controllers for Well-Being Assessment endpoints
 *
 * POST /api/assessment/score-domain  — Score one domain's answers via AI
 * POST /api/assessment/report        — Generate final consolidated report + save
 * GET  /api/assessment/reports       — List user's past assessments
 * GET  /api/assessment/reports/:id   — Get specific assessment
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  PHYSICAL_QUESTIONS,
  buildPhysicalScoringPrompt,
  computePhysicalResult,
  PhysicalScore,
} from '../assessment/physicalEngine';
import {
  MENTAL_QUESTIONS,
  buildMentalScoringPrompt,
  computeMentalResult,
  MentalScore,
} from '../assessment/mentalEngine';
import {
  EMOTIONAL_QUESTIONS,
  buildEmotionalScoringPrompt,
  computeEmotionalResult,
  EmotionalScore,
} from '../assessment/emotionalEngine';
import {
  buildFinalReportPrompt,
  buildMockFinalReport,
  deriveOverallCategory,
  FinalReport,
} from '../assessment/reportGenerator';
import { WellBeingAssessment } from '../models/WellBeingAssessment';

// ─── Types ───────────────────────────────────────────────────────────────────

type DomainId = 'physical' | 'mental' | 'emotional';

// ─── OpenAI Helper ───────────────────────────────────────────────────────────

async function callOpenAIJSON<T>(prompt: string, fallback: T): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[Assessment] No OPENAI_API_KEY — returning fallback scoring');
    return fallback;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,      // Low temperature for consistent scoring
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a clinical assessment scorer. Respond only with valid JSON as instructed.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`OpenAI ${res.status}: ${(err as { error?: { message?: string } }).error?.message ?? 'unknown'}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('Empty OpenAI response');

    return JSON.parse(content) as T;
  } catch (err) {
    console.error('[Assessment] OpenAI call failed:', err);
    return fallback;
  }
}

// ─── Fallback scorers (keyword-based, used when no API key) ──────────────────

function fallbackPhysicalScores() {
  const rawScores: Record<string, number> = {};
  PHYSICAL_QUESTIONS.forEach((q) => { rawScores[q.id] = 1; });
  return { rawScores, keyFactors: ['Assessment scored without AI'], interpretation: 'AI scoring unavailable — scores are estimated.' };
}

function fallbackMentalScores() {
  const rawScores: Record<string, number> = {};
  MENTAL_QUESTIONS.forEach((q) => { rawScores[q.id] = 0; });
  return { rawScores, riskFlag: false, keySymptoms: ['Assessment scored without AI'], interpretation: 'AI scoring unavailable.' };
}

function fallbackEmotionalScores() {
  const rawScores: Record<string, number> = {};
  EMOTIONAL_QUESTIONS.forEach((q) => { rawScores[q.id] = 1; });
  return { rawScores, keyFactors: ['Assessment scored without AI'], interpretation: 'AI scoring unavailable.' };
}

// ─── Controller: Score Domain ─────────────────────────────────────────────────

export async function scoreDomain(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { domain, answers } = req.body as {
      domain: DomainId;
      answers: Record<string, string>;
    };

    if (!domain || !answers || typeof answers !== 'object') {
      res.status(400).json({ success: false, message: 'domain and answers are required' });
      return;
    }

    let result: PhysicalScore | MentalScore | EmotionalScore;

    if (domain === 'physical') {
      const prompt = buildPhysicalScoringPrompt(answers);
      const fallback = fallbackPhysicalScores();
      const aiResult = await callOpenAIJSON<{
        rawScores: Record<string, number>;
        keyFactors: string[];
        interpretation: string;
      }>(prompt, fallback);

      result = computePhysicalResult(
        aiResult.rawScores,
        aiResult.keyFactors ?? [],
        aiResult.interpretation ?? ''
      );
    } else if (domain === 'mental') {
      const prompt = buildMentalScoringPrompt(answers);
      const fallback = fallbackMentalScores();
      const aiResult = await callOpenAIJSON<{
        rawScores: Record<string, number>;
        riskFlag: boolean;
        keySymptoms: string[];
        interpretation: string;
      }>(prompt, fallback);

      result = computeMentalResult(
        aiResult.rawScores,
        aiResult.keySymptoms ?? [],
        aiResult.interpretation ?? '',
        aiResult.riskFlag ?? false
      );
    } else if (domain === 'emotional') {
      const prompt = buildEmotionalScoringPrompt(answers);
      const fallback = fallbackEmotionalScores();
      const aiResult = await callOpenAIJSON<{
        rawScores: Record<string, number>;
        keyFactors: string[];
        interpretation: string;
      }>(prompt, fallback);

      result = computeEmotionalResult(
        aiResult.rawScores,
        aiResult.keyFactors ?? [],
        aiResult.interpretation ?? ''
      );
    } else {
      res.status(400).json({ success: false, message: `Unknown domain: ${domain}` });
      return;
    }

    res.json({ success: true, domain, result });
  } catch (err) {
    next(err);
  }
}

// ─── Controller: Generate Final Report ───────────────────────────────────────

export async function generateReport(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { sessionId, physicalResult, mentalResult, emotionalResult } = req.body as {
      sessionId?: string;
      physicalResult: PhysicalScore;
      mentalResult: MentalScore;
      emotionalResult: EmotionalScore;
    };

    if (!physicalResult || !mentalResult || !emotionalResult) {
      res.status(400).json({ success: false, message: 'All three domain results are required' });
      return;
    }

    const overallCategory = deriveOverallCategory(physicalResult, mentalResult, emotionalResult);

    // If risk flag set, skip AI report to avoid delays in safety situations
    let fullReport: FinalReport;

    if (mentalResult.riskFlag) {
      fullReport = buildMockFinalReport(physicalResult, mentalResult, emotionalResult, overallCategory);
    } else {
      const prompt = buildFinalReportPrompt(physicalResult, mentalResult, emotionalResult);
      const mockFallback = buildMockFinalReport(physicalResult, mentalResult, emotionalResult, overallCategory);

      const aiResult = await callOpenAIJSON<Omit<FinalReport, 'overallCategory' | 'generatedAt'>>(
        prompt,
        mockFallback
      );

      fullReport = {
        overallCategory,
        overallSummary:           aiResult.overallSummary ?? mockFallback.overallSummary,
        strengthAreas:            aiResult.strengthAreas ?? mockFallback.strengthAreas,
        concernAreas:             aiResult.concernAreas ?? mockFallback.concernAreas,
        behaviouralSuggestions:   aiResult.behaviouralSuggestions ?? mockFallback.behaviouralSuggestions,
        lifestyleRecommendations: aiResult.lifestyleRecommendations ?? mockFallback.lifestyleRecommendations,
        seekProfessionalHelp:     aiResult.seekProfessionalHelp ?? mockFallback.seekProfessionalHelp,
        generatedAt:              new Date().toISOString(),
      };
    }

    // Persist to MongoDB
    const assessment = await WellBeingAssessment.create({
      userId,
      sessionId,
      physicalResult,
      mentalResult,
      emotionalResult,
      overallCategory,
      fullReport,
    });

    res.status(201).json({
      success: true,
      assessmentId: assessment._id,
      overallCategory,
      fullReport,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Controller: List Reports ─────────────────────────────────────────────────

export async function listReports(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const reports = await WellBeingAssessment
      .find({ userId })
      .select('_id overallCategory fullReport.overallSummary createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, reports });
  } catch (err) {
    next(err);
  }
}

// ─── Controller: Get Single Report ───────────────────────────────────────────

export async function getReport(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const report = await WellBeingAssessment
      .findOne({ _id: req.params.id, userId })
      .lean();

    if (!report) {
      res.status(404).json({ success: false, message: 'Assessment not found' });
      return;
    }

    res.json({ success: true, report });
  } catch (err) {
    next(err);
  }
}
