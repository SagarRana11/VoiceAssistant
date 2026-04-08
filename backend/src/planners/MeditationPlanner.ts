import { PlannerEngine, SendChunk, SendAction } from './PlannerEngine';
import { retrieveMeditationDocs } from '../rag/retriever';
import { openaiChat } from '../services/openaiService';
import MeditationPlan from '../models/MeditationPlan';

function classifyLevel(stressLevel?: number, sleepHours?: number, hasExperience?: boolean): 'beginner' | 'moderate' | 'advanced' {
  if (hasExperience) {
    if ((stressLevel ?? 0) >= 4 || (sleepHours ?? 8) < 5) return 'moderate';
    return 'advanced';
  }
  return 'beginner';
}

export class MeditationPlanner extends PlannerEngine {
  async collectData(): Promise<Record<string, unknown>> {
    return this.ctx.profile;
  }

  async retrieveKnowledge(): Promise<string[]> {
    const p = this.ctx.profile;
    return retrieveMeditationDocs(
      p.stressLevel    as number | undefined,
      p.sleepHours     as number | undefined,
      p.activityLevel  as string | undefined,
      Boolean(p.meditationExperience),
      5
    );
  }

  async generatePlan(knowledge: string[]): Promise<unknown> {
    const p = this.ctx.profile;
    const level = classifyLevel(
      p.stressLevel   as number | undefined,
      p.sleepHours    as number | undefined,
      Boolean(p.meditationExperience)
    );

    const systemPrompt = `You are a certified mindfulness coach and meditation teacher.
Generate a personalized meditation plan for the user.
You MUST return ONLY valid JSON — no markdown fences, no text outside the JSON object.
The JSON must exactly match this TypeScript shape:
{
  level: "beginner" | "moderate" | "advanced";
  planDuration: "weekly";
  sessionDuration: number;  // minutes per session
  weeklyStructure: Array<{
    day: string;
    sessionType: string;
    duration: number;
    isRestDay: boolean;
    focus: string;
  }>;
  breathingExercises: string[];   // 2-4 specific techniques
  meditationType: string[];       // 2-4 types used in plan
  stepByStepGuide: Array<{
    step: number;
    title: string;
    instruction: string;
    duration: string;
  }>;
  environmentTips: string[];      // 3-5 practical tips
  progressionAdvice: string;      // How to advance over 4 weeks
  calmingMusicSuggestion: string[]; // 3-4 specific music/sound suggestions
  planSummary: string;            // One voice-friendly sentence
}`;

    const stressLabel = p.stressLevel
      ? ['very low', 'low', 'moderate', 'high', 'very high'][(p.stressLevel as number) - 1] ?? 'moderate'
      : 'unknown';

    const userMessage = `Create a 4-week meditation plan for this person:

PROFILE:
- Stress Level: ${stressLabel} (${p.stressLevel ?? 'unknown'}/5)
- Sleep Hours per Night: ${p.sleepHours ?? 'unknown'}
- Activity Level: ${p.activityLevel ?? 'moderate'}
- Meditation Experience: ${p.meditationExperience ? 'Yes — ' + p.meditationExperience : 'No prior experience'}
- Preferred Session Duration: ${p.preferredMeditationDuration ?? 10} minutes
- Preferred Time: ${p.meditationPreferredTime ?? 'morning'}
- Classified Level: ${level}

MEDITATION KNOWLEDGE BASE:
${knowledge.join('\n\n---\n\n')}

REQUIREMENTS:
- Session duration must match their preference (${p.preferredMeditationDuration ?? 10} minutes)
- For beginner: focus on breathing and mindfulness only
- For moderate: mix mindfulness, body scan, and visualization
- For advanced: include loving-kindness, open monitoring, extended sessions
- Include 7 days (mix practice days and 1 light rest/reflection day)
- stepByStepGuide should be the core session guide (4-6 steps)
- planSummary must be 1 sentence, voice-friendly, warm and encouraging`;

    const raw = await openaiChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      { maxTokens: 2000, temperature: 0.6 }
    );

    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    try {
      return JSON.parse(cleaned);
    } catch {
      console.error('[MeditationPlanner] JSON parse failed. Raw:', raw.slice(0, 300));
      // Fallback stub
      return {
        level,
        planDuration: 'weekly',
        sessionDuration: p.preferredMeditationDuration ?? 10,
        weeklyStructure: [],
        breathingExercises: ['Box breathing (4-4-4-4)', 'Deep belly breathing'],
        meditationType: ['Mindfulness', 'Breathing meditation'],
        stepByStepGuide: [
          { step: 1, title: 'Settle', instruction: 'Sit comfortably, close eyes, take 3 deep breaths.', duration: '2 min' },
          { step: 2, title: 'Breathe', instruction: 'Focus on natural breath at the nostrils.', duration: '6 min' },
          { step: 3, title: 'Close', instruction: 'Gently open eyes, notice how you feel.', duration: '2 min' },
        ],
        environmentTips: ['Quiet space', 'Comfortable seating', 'Dim lighting'],
        progressionAdvice: 'Add 2 minutes each week to build your practice.',
        calmingMusicSuggestion: ['432 Hz nature sounds', 'Tibetan singing bowls'],
        planSummary: 'Your personalised meditation plan is ready — start with 10 minutes each morning.',
      };
    }
  }

  async storePlan(plan: unknown): Promise<string> {
    const saved = await MeditationPlan.create({
      userId: this.ctx.userId,
      profileSnapshot: this.ctx.profile,
      ...(plan as object),
    });
    return saved._id.toString();
  }

  /** Overrides base generate() to use meditation-specific messaging */
  async generate(sendChunk: SendChunk, sendAction: SendAction): Promise<void> {
    sendChunk('Retrieving mindfulness and meditation knowledge... ');
    const knowledge = await this.retrieveKnowledge();

    sendChunk('Crafting your personalised meditation plan... ');
    const plan = await this.generatePlan(knowledge);

    const planId = await this.storePlan(plan);
    sendAction('MEDITATION_PLAN_GENERATED', { planId, plan });

    const typedPlan = plan as { planSummary?: string };
    sendChunk(typedPlan.planSummary ?? 'Your meditation plan is ready!');
    sendChunk(' Would you like me to guide you through your first session right now?');
  }
}
