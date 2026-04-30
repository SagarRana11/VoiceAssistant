import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CathLabPatient } from '../models/CathLabPatient';
import { CathLabSession } from '../models/CathLabSession';
import { CathLabHPRecord } from '../models/CathLabHPRecord';
import { streamOpenAI, openaiChat, ChatMessage } from '../services/openaiService';
import { getStepConfig, getNextStep, HP_STEPS, FLAG_MESSAGES } from './cathLabScript';

// ─── SSE helper ───────────────────────────────────────────────────────────────
function makeSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  return {
    chunk: (text: string) =>
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`),
    action: (action: string, data: unknown) =>
      res.write(`data: ${JSON.stringify({ action, data })}\n\n`),
    done: () => {
      res.write('data: [DONE]\n\n');
      res.end();
    },
  };
}

// ─── System prompt for Sofiya ─────────────────────────────────────────────────
function sofiyaSystemPrompt(currentStep: string, captureFields: string[], branchConditions: unknown[], hpRecord: Record<string, string>): string {
  const capturedSummary = Object.entries(hpRecord)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  return `You are Sofiya, a warm and compassionate Nurse Practitioner at the Mount Sinai Cardiac Catheterization Laboratory.

Your role is to conduct a structured pre-procedural History & Physical (H&P) interview with the patient before their cardiac catheterization procedure.

PERSONA:
- Calm, warm, confident, unhurried
- Use plain language — avoid medical jargon unless you explain it
- Always validate the patient ("Thank you for sharing that", "That's very helpful")
- Keep responses conversational and suitable for voice (no bullet points, no markdown)
- Responses should be 2-5 sentences — concise but warm

CURRENT INTERVIEW STEP: ${currentStep}
FIELDS TO CAPTURE THIS STEP: ${captureFields.join(', ')}
BRANCH CONDITIONS: ${JSON.stringify(branchConditions)}

ALREADY CAPTURED SO FAR:
${capturedSummary || '  (nothing captured yet)'}

YOUR TASK FOR THIS TURN:
1. Acknowledge the patient's response warmly and briefly (1-2 sentences)
2. If the patient's response triggers a FOLLOWUP branch condition, ask the follow-up question before moving on
3. Extract any clinical data from the patient's response
4. If the patient said they are ready to start (first message), deliver the step's opening question

RULES:
- Never diagnose, never suggest medication changes
- If the patient mentions chest pain, fainting, or severe breathlessness occurring RIGHT NOW, immediately say: "Please contact your care team or seek urgent medical attention right away."
- Keep your spoken response natural and warm — it will be read aloud by an avatar
- Do NOT use any formatting like asterisks, hyphens, or newlines in your spoken response`;
}

// ─── ENROLL ───────────────────────────────────────────────────────────────────
export async function enrollCathLabPatient(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { patientName, dob, mrn, procedureDate } = req.body;

  if (!patientName) {
    res.status(400).json({ message: 'Patient name is required.' });
    return;
  }

  const patient = await CathLabPatient.create({
    enrolledBy: userId,
    patientName,
    dob: dob ?? '',
    mrn: mrn ?? '',
    procedureDate: procedureDate ?? '',
  });

  const session = await CathLabSession.create({
    patientId: patient._id,
    enrolledBy: userId,
    currentModule: 1,
    currentStep: 'greeting',
    status: 'in_progress',
  });

  await CathLabHPRecord.create({
    sessionId: session._id,
    patientId: patient._id,
  });

  res.status(201).json({ patient, session });
}

// ─── GET SESSION ──────────────────────────────────────────────────────────────
export async function getCathLabSession(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId } = req.params;

  const session = await CathLabSession.findById(sessionId);
  if (!session) {
    res.status(404).json({ message: 'Session not found.' });
    return;
  }

  const patient = await CathLabPatient.findById(session.patientId);
  const hpRecord = await CathLabHPRecord.findOne({ sessionId });

  res.json({ session, patient, hpRecord });
}

// ─── GET PATIENTS (for this user) ─────────────────────────────────────────────
export async function getCathLabPatients(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  const patients = await CathLabPatient.find({ enrolledBy: userId }).sort({ createdAt: -1 });
  res.json({ patients });
}

// ─── CHAT (main SSE H&P interview endpoint) ───────────────────────────────────
export async function cathLabChat(req: AuthRequest, res: Response): Promise<void> {
  const {
    sessionId,
    patientMessage,
    history = [],
  } = req.body as {
    sessionId: string;
    patientMessage: string;
    history: { role: 'user' | 'assistant'; content: string }[];
  };

  const sse = makeSSE(res);

  try {
    // ── Load session + record ──────────────────────────────────────────────
    const session = await CathLabSession.findById(sessionId);
    if (!session) {
      sse.chunk('Session not found. Please restart the interview.');
      sse.done();
      return;
    }

    const patient = await CathLabPatient.findById(session.patientId);
    if (!patient) {
      sse.chunk('Patient not found.');
      sse.done();
      return;
    }

    const hpRecord = await CathLabHPRecord.findOne({ sessionId });
    if (!hpRecord) {
      sse.chunk('Health record not found.');
      sse.done();
      return;
    }

    // ── Get current step config ────────────────────────────────────────────
    const stepConfig = getStepConfig(session.currentStep);
    if (!stepConfig) {
      sse.chunk('Interview complete. Thank you for your time.');
      sse.done();
      return;
    }

    // Build serialisable snapshot of captured record (string fields only)
    const hpSnapshot: Record<string, string> = {};
    for (const key of Object.keys(hpRecord.toObject())) {
      const val = (hpRecord as unknown as Record<string, unknown>)[key];
      if (typeof val === 'string' && val.trim()) hpSnapshot[key] = val;
    }

    const systemPrompt = sofiyaSystemPrompt(
      `${stepConfig.stepLabel} (step: ${stepConfig.step})`,
      stepConfig.captureFields,
      stepConfig.branchConditions,
      hpSnapshot,
    );

    // ── Stream Sofiya's response ───────────────────────────────────────────
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-12),
      { role: 'user', content: patientMessage || 'Ready to begin.' },
    ];

    let fullResponse = '';
    for await (const chunk of streamOpenAI(messages)) {
      sse.chunk(chunk);
      fullResponse += chunk;
    }

    // ── Structured extraction (non-streaming) ─────────────────────────────
    const extractionPrompt = `Based on this patient response: "${patientMessage}"

For the interview step "${stepConfig.step}", extract the following as JSON:

{
  "capturedFields": {
    ${stepConfig.captureFields.map(f => `"${f}": "extracted value or empty string"`).join(',\n    ')}
  },
  "flags": [
    // array of { "type": "flag_id", "message": "human readable message" }
    // only include if a branch condition FLAG is triggered
    // possible flags: ${stepConfig.branchConditions
      .filter(b => b.then === 'FLAG')
      .map(b => `${b.flag} (${b.message})`)
      .join(', ') || 'none'}
  ],
  "followupNeeded": false,
  "advanceToNext": true
}

Rules:
- Set advanceToNext to false if a FOLLOWUP branch was triggered and the follow-up was not yet answered
- Only include a flag if the patient's response clearly matches the branch condition
- capturedFields values should be concise summaries of what the patient said
- Return ONLY valid JSON, no markdown`;

    let extractionResult = {
      capturedFields: {} as Record<string, string>,
      flags: [] as { type: string; message: string }[],
      advanceToNext: true,
    };

    try {
      const rawExtraction = await openaiChat(
        [
          { role: 'system', content: 'You are a clinical data extractor. Return only valid JSON.' },
          { role: 'user', content: extractionPrompt },
        ],
        { maxTokens: 600, temperature: 0.1 },
      );

      const cleaned = rawExtraction.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractionResult = JSON.parse(cleaned);
    } catch {
      // Extraction failed — still advance, just no data captured this turn
    }

    // ── Persist captured fields ────────────────────────────────────────────
    const updateFields: Record<string, string> = {};
    for (const [field, value] of Object.entries(extractionResult.capturedFields)) {
      if (value && value.trim()) {
        updateFields[field] = value.trim();
        sse.action('CAPTURE', { field, value: value.trim() });
      }
    }

    // ── Persist flags ──────────────────────────────────────────────────────
    const newFlags = extractionResult.flags ?? [];
    for (const flag of newFlags) {
      const alreadyFlagged = hpRecord.flags.some(f => f.type === flag.type);
      if (!alreadyFlagged) {
        const flagMessage = flag.message || FLAG_MESSAGES[flag.type] || flag.type;
        hpRecord.flags.push({
          type: flag.type,
          message: flagMessage,
          module: stepConfig.module,
          raisedAt: new Date(),
        });
        sse.action('FLAG', { type: flag.type, message: flagMessage });
      }
    }

    // ── Save HP record updates ─────────────────────────────────────────────
    if (Object.keys(updateFields).length > 0 || newFlags.length > 0) {
      await CathLabHPRecord.findOneAndUpdate(
        { sessionId },
        { $set: updateFields, flags: hpRecord.flags },
      );
    }

    // ── Advance step ───────────────────────────────────────────────────────
    if (extractionResult.advanceToNext !== false) {
      const nextStep = getNextStep(session.currentStep);
      if (nextStep) {
        await CathLabSession.findByIdAndUpdate(sessionId, {
          currentModule: nextStep.module,
          currentStep: nextStep.step,
        });
        sse.action('ADVANCE', {
          nextStep: nextStep.step,
          nextModule: nextStep.module,
          nextStepLabel: nextStep.stepLabel,
          nextModuleLabel: nextStep.moduleLabel,
          nextAvatarText: nextStep.avatarText,
          isEducation: nextStep.isEducation ?? false,
        });
      } else {
        // All steps complete
        await CathLabSession.findByIdAndUpdate(sessionId, { status: 'completed' });
        sse.action('COMPLETE', { message: 'H&P interview complete.' });
      }
    }
  } catch (err) {
    console.error('[CathLabChat]', err);
    sse.chunk('I ran into a problem. Please try again.');
  } finally {
    sse.done();
  }
}

// ─── GET SUMMARY ──────────────────────────────────────────────────────────────
export async function getCathLabSummary(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId } = req.params;

  const session = await CathLabSession.findById(sessionId);
  if (!session) {
    res.status(404).json({ message: 'Session not found.' });
    return;
  }

  const patient = await CathLabPatient.findById(session.patientId);
  const hpRecord = await CathLabHPRecord.findOne({ sessionId });

  res.json({ session, patient, hpRecord, steps: HP_STEPS });
}
