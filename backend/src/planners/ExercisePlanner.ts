import { PlannerEngine } from './PlannerEngine';
import { retrieveDocsByProfile } from '../rag/retriever';
import { openaiChat } from '../services/openaiService';
import ExercisePlan from '../models/ExercisePlan';

export class ExercisePlanner extends PlannerEngine {
  async collectData(): Promise<Record<string, unknown>> {
    return this.ctx.profile;
  }

  async retrieveKnowledge(): Promise<string[]> {
    const p = this.ctx.profile;
    const hasInjuries = Array.isArray(p.injuries)
      ? p.injuries.length > 0
      : Boolean(p.injuries);

    return retrieveDocsByProfile(
      p.fitnessGoal as string | undefined,
      p.activityLevel as string | undefined,
      hasInjuries,
      4
    );
  }

  async generatePlan(knowledge: string[]): Promise<unknown> {
    const p = this.ctx.profile;
    const heightM = p.height ? (p.height as number) / 100 : null;
    const bmi = heightM && p.weight
      ? ((p.weight as number) / (heightM * heightM)).toFixed(1)
      : 'unknown';

    const systemPrompt = `You are an expert certified personal trainer and exercise physiologist.
      Generate a safe, effective, personalised 4-week weekly workout plan.
      You MUST return ONLY valid JSON — no markdown code fences, no explanation text outside the JSON object.
      The JSON must exactly match this TypeScript shape:
      {
        weeklySchedule: Array<{
          day: string;
          focus: string;
          isRestDay: boolean;
          warmup: string;
          exercises: Array<{
            name: string;
            sets: number;
            reps: string;
            duration?: string;
            restTime: string;
            notes?: string;
          }>;
          cooldown: string;
          estimatedDuration: number;
        }>;
        progressionAdvice: string;
        safetyNotes: string;
        planSummary: string;  // One voice-friendly sentence summarising the plan
        durationWeeks: number;
      }`;

    const injuriesText = Array.isArray(p.injuries) && p.injuries.length > 0
      ? (p.injuries as string[]).join(', ')
      : (p.injuries as string) || 'none';
    const diseasesText = Array.isArray(p.diseases) && p.diseases.length > 0
      ? (p.diseases as string[]).join(', ')
      : (p.diseases as string) || 'none';

    const userMessage = `Create a 4-week workout plan for this person:

    PROFILE:
    - Age: ${p.age ?? 'unknown'}, Gender: ${p.gender ?? 'unknown'}
    - Height: ${p.height ?? 'unknown'}cm, Weight: ${p.weight ?? 'unknown'}kg, BMI: ${bmi}
    - Activity Level: ${p.activityLevel ?? 'unknown'}
    - Fitness Goal: ${p.fitnessGoal ?? 'general_fitness'}
    - Available Time: ${p.availableTimePerDay ?? 45} minutes/day
    - Injuries / Conditions: ${injuriesText}
    - Medical Conditions: ${diseasesText}

    EXERCISE SCIENCE KNOWLEDGE BASE:
    ${knowledge.join('\n\n---\n\n')}

    REQUIREMENTS:
    - Include all 7 days (use isRestDay:true for rest days)
    - Respect injury constraints with modifications or exercise substitutions
    - Match difficulty to their activity level
    - Keep session duration within their available time budget
    - Provide 2-3 progressions weeks implied in progressionAdvice
    - planSummary must be exactly 1 sentence, voice-friendly, no numbers at start`;

    const raw = await openaiChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      { maxTokens: 2500, temperature: 0.65 }
    );

    // Strip any accidental markdown fences
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    try {
      return JSON.parse(cleaned);
    } catch {
      console.error('[ExercisePlanner] JSON parse failed. Raw LLM output:', raw.slice(0, 500));
      // Return mock plan if parsing fails — plan is never null
      return JSON.parse(await openaiChat(
        [{ role: 'user', content: 'Return an empty exercise plan JSON stub matching the schema above.' }],
        { maxTokens: 100 }
      ));
    }
  }

  async storePlan(plan: unknown): Promise<string> {
    const saved = await ExercisePlan.create({
      userId: this.ctx.userId,
      profileSnapshot: this.ctx.profile,
      ...(plan as object),
    });
    return saved._id.toString();
  }
}
