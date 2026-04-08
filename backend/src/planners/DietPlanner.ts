import { PlannerEngine, SendChunk, SendAction } from './PlannerEngine';
import { retrieveDietDocs } from '../rag/retriever';
import { openaiChat } from '../services/openaiService';
import DietPlan from '../models/DietPlan';

// ─── Internal metric calculations ─────────────────────────────────────────────

function calculateBMI(weight?: number, height?: number): number | null {
  if (!weight || !height) return null;
  const hM = height / 100;
  return parseFloat((weight / (hM * hM)).toFixed(1));
}

/**
 * Mifflin-St Jeor BMR + activity multiplier + goal adjustment.
 * Returns TDEE-adjusted calorie target.
 */
function calculateCalorieTarget(
  weight?: number,
  height?: number,
  age?: number,
  gender?: string,
  activityLevel?: string,
  fitnessGoal?: string
): number {
  if (!weight || !height || !age) return 2000; // safe fallback

  // Mifflin-St Jeor BMR
  const isMale = gender === 'male';
  const bmr = isMale
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const multipliers: Record<string, number> = {
    sedentary:  1.2,
    light:      1.375,
    moderate:   1.55,
    active:     1.725,
    very_active: 1.9,
  };
  const tdee = bmr * (multipliers[activityLevel ?? 'moderate'] ?? 1.55);

  const goalAdjustments: Record<string, number> = {
    weight_loss:    -400,
    muscle_gain:    +250,
    endurance:      +100,
    flexibility:      0,
    general_fitness:  0,
  };
  const adjustment = goalAdjustments[fitnessGoal ?? 'general_fitness'] ?? 0;

  return Math.round(tdee + adjustment);
}

/** Macro split percentages by fitness goal. Returns grams. */
function calculateMacros(calories: number, fitnessGoal?: string, weight?: number) {
  type MacroRatio = { protein: number; carbs: number; fat: number };
  const splits: Record<string, MacroRatio> = {
    weight_loss:    { protein: 0.35, carbs: 0.35, fat: 0.30 },
    muscle_gain:    { protein: 0.30, carbs: 0.45, fat: 0.25 },
    endurance:      { protein: 0.20, carbs: 0.55, fat: 0.25 },
    general_fitness:{ protein: 0.25, carbs: 0.45, fat: 0.30 },
    flexibility:    { protein: 0.25, carbs: 0.45, fat: 0.30 },
  };
  const split = splits[fitnessGoal ?? 'general_fitness'] ?? splits.general_fitness;

  const proteinG = Math.round((calories * split.protein) / 4);
  const carbsG   = Math.round((calories * split.carbs)   / 4);
  const fatG     = Math.round((calories * split.fat)     / 9);

  return {
    proteinG,
    carbsG,
    fatG,
    proteinPct: Math.round(split.protein * 100),
    carbsPct:   Math.round(split.carbs   * 100),
    fatPct:     Math.round(split.fat     * 100),
  };
}

// ─── DietPlanner ──────────────────────────────────────────────────────────────

export class DietPlanner extends PlannerEngine {
  async collectData(): Promise<Record<string, unknown>> {
    return this.ctx.profile;
  }

  async retrieveKnowledge(): Promise<string[]> {
    const p = this.ctx.profile;
    return retrieveDietDocs(
      p.fitnessGoal      as string | undefined,
      p.dietPreference   as string | undefined,
      p.diseases         as string[] | undefined,
      p.allergies        as string[] | undefined,
      5
    );
  }

  async generatePlan(knowledge: string[]): Promise<unknown> {
    const p = this.ctx.profile;

    // Internal derived metrics
    const bmi            = calculateBMI(p.weight as number, p.height as number);
    const calorieTarget  = calculateCalorieTarget(
      p.weight       as number | undefined,
      p.height       as number | undefined,
      p.age          as number | undefined,
      p.gender       as string | undefined,
      p.activityLevel as string | undefined,
      p.fitnessGoal  as string | undefined,
    );
    const macros = calculateMacros(calorieTarget, p.fitnessGoal as string, p.weight as number);

    const allergiesText  = Array.isArray(p.allergies) && p.allergies.length > 0
      ? (p.allergies as string[]).join(', ') : 'none';
    const diseasesText   = Array.isArray(p.diseases)  && p.diseases.length  > 0
      ? (p.diseases  as string[]).join(', ') : 'none';

    const planDuration = (p.planDuration as string) || 'weekly';

    const systemPrompt = `You are a certified clinical nutritionist and registered dietitian.
Generate a safe, practical, personalized ${planDuration} diet plan.
You MUST return ONLY valid JSON — no markdown code fences, no explanation text outside the JSON object.
The JSON must exactly match this TypeScript shape:
{
  planDuration: "daily" | "weekly" | "monthly";
  calorieTarget: number;
  bmi: number;
  macroSplit: {
    proteinG: number; carbsG: number; fatG: number;
    proteinPct: number; carbsPct: number; fatPct: number;
  };
  mealStructure: string;           // e.g., "3 meals + 2 snacks"
  breakfastOptions: string[];      // 4-6 options
  lunchOptions: string[];          // 4-6 options
  dinnerOptions: string[];         // 4-6 options
  snackOptions: string[];          // 4-5 options
  hydrationAdvice: string;
  restrictionNotes: string[];      // Medical/allergy restrictions (2-4 notes)
  substitutionSuggestions: string[]; // 3-5 smart swaps
  planSummary: string;             // One voice-friendly sentence
}`;

    const userMessage = `Create a ${planDuration} diet plan for this person:

PROFILE:
- Age: ${p.age ?? 'unknown'}, Gender: ${p.gender ?? 'unknown'}
- Height: ${p.height ?? 'unknown'}cm, Weight: ${p.weight ?? 'unknown'}kg
- BMI: ${bmi ?? 'unknown'}
- Activity Level: ${p.activityLevel ?? 'moderate'}
- Fitness Goal: ${p.fitnessGoal ?? 'general_fitness'}
- Diet Preference: ${p.dietPreference ?? 'omnivore'}
- Allergies: ${allergiesText}
- Medical Conditions: ${diseasesText}

PRE-CALCULATED TARGETS (use these exact values):
- Daily Calorie Target: ${calorieTarget} kcal
- Protein: ${macros.proteinG}g (${macros.proteinPct}%)
- Carbohydrates: ${macros.carbsG}g (${macros.carbsPct}%)
- Fat: ${macros.fatG}g (${macros.fatPct}%)

NUTRITION KNOWLEDGE BASE:
${knowledge.join('\n\n---\n\n')}

REQUIREMENTS:
- Respect diet preference (${p.dietPreference ?? 'omnivore'}) strictly — no meat if vegetarian/vegan
- Respect all allergies: ${allergiesText}
- Address medical conditions: ${diseasesText}
- Meal options should be practical, tasty, and culturally appropriate
- Include variety — no single food repeated more than once across options
- planSummary must be 1 sentence, voice-friendly, personalized to their goal
- Use exact pre-calculated calorie and macro values in the output`;

    const raw = await openaiChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      { maxTokens: 2500, temperature: 0.65 }
    );

    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    try {
      const parsed = JSON.parse(cleaned);
      // Ensure our calculated values are used (guard against LLM hallucinating them)
      return { ...parsed, calorieTarget, bmi: bmi ?? 0, macroSplit: macros };
    } catch {
      console.error('[DietPlanner] JSON parse failed. Raw:', raw.slice(0, 300));
      return {
        planDuration,
        calorieTarget,
        bmi: bmi ?? 0,
        macroSplit: macros,
        mealStructure: '3 meals + 2 snacks',
        breakfastOptions: ['Oats with fruits and nuts', 'Eggs with whole grain toast'],
        lunchOptions: ['Brown rice with dal and vegetables', 'Grilled chicken salad'],
        dinnerOptions: ['Lentil soup with chapati', 'Stir-fried tofu with vegetables'],
        snackOptions: ['Greek yogurt', 'Handful of mixed nuts'],
        hydrationAdvice: `Drink ${Math.round((p.weight as number ?? 70) * 0.035)} litres of water daily.`,
        restrictionNotes: [],
        substitutionSuggestions: ['Replace white rice with brown rice for more fibre'],
        planSummary: 'Your personalised diet plan targeting your goal is ready!',
      };
    }
  }

  async storePlan(plan: unknown): Promise<string> {
    const saved = await DietPlan.create({
      userId: this.ctx.userId,
      profileSnapshot: this.ctx.profile,
      ...(plan as object),
    });
    return saved._id.toString();
  }

  /** Overrides base generate() to use diet-specific messaging */
  async generate(sendChunk: SendChunk, sendAction: SendAction): Promise<void> {
    sendChunk('Retrieving nutrition science knowledge... ');
    const knowledge = await this.retrieveKnowledge();

    sendChunk('Calculating your calorie and macro targets... ');
    const plan = await this.generatePlan(knowledge);

    const planId = await this.storePlan(plan);
    sendAction('DIET_PLAN_GENERATED', { planId, plan });

    const typedPlan = plan as { planSummary?: string };
    sendChunk(typedPlan.planSummary ?? 'Your diet plan is ready!');
    sendChunk(' Would you like me to explain any part of it in detail?');
  }
}
