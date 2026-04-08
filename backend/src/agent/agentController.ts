import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { detectIntent } from './intentDetector';
import { toolGetUserProfile, toolSaveProfileField, getMissingFields } from './agentTools';
import { summarizeProfileForContext } from '../services/profileService';
import { ExercisePlanner } from '../planners/ExercisePlanner';
import { MeditationPlanner } from '../planners/MeditationPlanner';
import { DietPlanner } from '../planners/DietPlanner';
import { streamOpenAI, openaiChat, ChatMessage } from '../services/openaiService';
import { IUserProfile } from '../models/UserProfile';

// ─── Required fields for each planner intent ──────────────────────────────────
interface FieldSpec {
  field: string;
  question: string;
  parseValue?: (answer: string) => unknown;
}

const MEDITATION_REQUIRED_FIELDS: FieldSpec[] = [
  {
    field: 'stressLevel',
    question: "On a scale of 1 to 5, how would you rate your current stress level? One is very calm and five is very stressed.",
    parseValue: v => {
      const n = parseInt(v, 10);
      return n >= 1 && n <= 5 ? n : undefined;
    },
  },
  {
    field: 'sleepHours',
    question: "How many hours of sleep are you getting each night on average?",
    parseValue: v => parseFloat(v) || undefined,
  },
  {
    field: 'meditationExperience',
    question: "Do you have any prior meditation experience? Say yes, no, or briefly describe your background.",
  },
  {
    field: 'preferredMeditationDuration',
    question: "How many minutes can you dedicate to meditation per session? For example, 5, 10, or 20 minutes.",
    parseValue: v => parseInt(v, 10) || 10,
  },
  {
    field: 'meditationPreferredTime',
    question: "When do you prefer to meditate — morning, evening, or anytime?",
  },
];

const DIET_REQUIRED_FIELDS: FieldSpec[] = [
  {
    field: 'height',
    question: "What is your height in centimetres? For example, 170.",
    parseValue: v => parseFloat(v) || undefined,
  },
  {
    field: 'weight',
    question: "And your current weight in kilograms?",
    parseValue: v => parseFloat(v) || undefined,
  },
  {
    field: 'age',
    question: "How old are you?",
    parseValue: v => parseInt(v, 10) || undefined,
  },
  {
    field: 'gender',
    question: "What is your gender — male, female, or other?",
  },
  {
    field: 'activityLevel',
    question: "How active are you — sedentary, light, moderate, active, or very active?",
  },
  {
    field: 'fitnessGoal',
    question: "What is your primary goal — weight loss, muscle gain, endurance, flexibility, or general fitness?",
  },
  {
    field: 'dietPreference',
    question: "Do you follow any specific diet — omnivore, vegetarian, vegan, keto, or paleo?",
  },
  {
    field: 'allergies',
    question: "Do you have any food allergies? Say no if none.",
    parseValue: v => {
      const lower = v.toLowerCase().trim();
      if (['no', 'none', 'nope', 'nothing', 'n/a', 'na'].includes(lower)) return [];
      return [v.trim()];
    },
  },
  {
    field: 'diseases',
    question: "Do you have any medical conditions I should know about, like diabetes or thyroid issues? Say no if none.",
    parseValue: v => {
      const lower = v.toLowerCase().trim();
      if (['no', 'none', 'nope', 'nothing', 'n/a', 'na'].includes(lower)) return [];
      return [v.trim()];
    },
  },
];

const EXERCISE_REQUIRED_FIELDS: FieldSpec[] = [
  {
    field: 'height',
    question: "What's your height in centimetres? For example, 175.",
    parseValue: v => parseFloat(v) || undefined,
  },
  {
    field: 'weight',
    question: "And your current weight in kilograms?",
    parseValue: v => parseFloat(v) || undefined,
  },
  {
    field: 'age',
    question: "How old are you?",
    parseValue: v => parseInt(v, 10) || undefined,
  },
  {
    field: 'activityLevel',
    question: "How would you describe your activity level right now — sedentary, light, moderate, active, or very active?",
  },
  {
    field: 'fitnessGoal',
    question: "What's your main fitness goal — weight loss, muscle gain, endurance, flexibility, or general fitness?",
  },
  {
    field: 'availableTimePerDay',
    question: "How many minutes a day can you realistically dedicate to exercise?",
    parseValue: v => parseInt(v, 10) || undefined,
  },
  {
    field: 'injuries',
    question: "Do you have any injuries or physical conditions I should know about? Just say no if you're all good.",
    parseValue: v => {
      const lower = v.toLowerCase().trim();
      if (['no', 'none', 'nope', 'nothing', 'n/a', 'na'].includes(lower)) return [];
      return [v.trim()];
    },
  },
];

// ─── SSE helpers ──────────────────────────────────────────────────────────────
function makeSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  return {
    chunk: (text: string) => {
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    },
    action: (action: string, data: unknown) => {
      res.write(`data: ${JSON.stringify({ action, data })}\n\n`);
    },
    done: () => {
      res.write('data: [DONE]\n\n');
      res.end();
    },
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function handleAgentMessage(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  const {
    message,
    conversationHistory = [],
    pendingField,
    pendingIntent,
    pendingRemainingFields,
    confirmField,
    confirmValue,
  } = req.body as {
    message: string;
    conversationHistory: ChatMessage[];
    pendingField?: string;
    pendingIntent?: string;
    pendingRemainingFields?: string[];
    confirmField?: string;
    confirmValue?: unknown;
  };

  const sse = makeSSE(res);

  try {
    // ── 1. Handle pending confirmation (user replied yes/no to a field update) ─
    if (confirmField && confirmValue !== undefined) {
      await handleConfirmation(
        userId, confirmField, confirmValue, message, sse
      );
      return;
    }

    // ── 2. We're mid-collection flow — save the answered field, ask next ────────
    if (pendingField && pendingIntent) {
      await handleFieldAnswer(
        userId, message, pendingField, pendingIntent,
        pendingRemainingFields ?? [], sse
      );
      return;
    }

    // ── 3. Fresh message — detect intent ─────────────────────────────────────────
    const intent = detectIntent(message);

    if (intent === 'exercise_plan') {
      await handleExercisePlanIntent(userId, sse);
    } else if (intent === 'diet_plan') {
      await handleGenericPlanIntent(userId, 'diet_plan', DIET_REQUIRED_FIELDS, sse);
    } else if (intent === 'meditation') {
      await handleGenericPlanIntent(userId, 'meditation', MEDITATION_REQUIRED_FIELDS, sse);
    } else if (intent === 'view_profile') {
      await handleViewProfile(userId, sse);
    } else if (intent === 'update_profile') {
      await handleUpdateProfileIntent(userId, message, sse);
    } else {
      // General health chat with profile context
      await handleGeneralChat(userId, message, conversationHistory, sse);
    }
  } catch (err) {
    console.error('[AgentController]', err);
    sse.chunk("I ran into a problem. Could you try again in a moment?");
  } finally {
    sse.done();
  }
}

// ─── Intent handlers ─────────────────────────────────────────────────────────

async function handleExercisePlanIntent(
  userId: string,
  sse: ReturnType<typeof makeSSE>
): Promise<void> {
  const profile = await toolGetUserProfile(userId);
  const requiredFieldNames = EXERCISE_REQUIRED_FIELDS.map(f => f.field);
  const missing = getMissingFields(profile, requiredFieldNames);

  if (missing.length === 0) {
    // All data present — generate immediately
    sse.chunk("I have everything I need. Let me build your personalised plan — ");
    const profileData = profile ? (profile.toObject() as Record<string, unknown>) : {};
    const planner = new ExercisePlanner(userId, profileData);
    await planner.generate(sse.chunk, sse.action);
  } else {
    // Start conversational collection
    const firstSpec = EXERCISE_REQUIRED_FIELDS.find(f => f.field === missing[0])!;
    const remaining = missing.slice(1);

    sse.chunk("I'd love to build your personalised workout plan! ");
    sse.chunk(firstSpec.question);
    sse.action('COLLECT_PROFILE_FIELD', {
      field: missing[0],
      intent: 'exercise_plan',
      remainingFields: remaining,
    });
  }
}

/** Returns the correct FieldSpec array for the given intent. */
function getFieldSpecs(intent: string): FieldSpec[] {
  if (intent === 'meditation') return MEDITATION_REQUIRED_FIELDS;
  if (intent === 'diet_plan')  return DIET_REQUIRED_FIELDS;
  return EXERCISE_REQUIRED_FIELDS;
}

/** Instantiates the correct planner for the given intent. */
async function buildPlanner(intent: string, userId: string) {
  const profile    = await toolGetUserProfile(userId);
  const profileData = profile ? (profile.toObject() as Record<string, unknown>) : {};
  if (intent === 'meditation') return new MeditationPlanner(userId, profileData);
  if (intent === 'diet_plan')  return new DietPlanner(userId, profileData);
  return new ExercisePlanner(userId, profileData);
}

/**
 * Generic plan intent handler — reusable for diet_plan and meditation intents.
 * Checks for missing required fields and either collects them or generates immediately.
 */
async function handleGenericPlanIntent(
  userId: string,
  intent: string,
  requiredFields: FieldSpec[],
  sse: ReturnType<typeof makeSSE>
): Promise<void> {
  const profile        = await toolGetUserProfile(userId);
  const requiredNames  = requiredFields.map(f => f.field);
  const missing        = getMissingFields(profile, requiredNames);

  if (missing.length === 0) {
    const introMap: Record<string, string> = {
      meditation: "I have everything I need. Let me create your personalised meditation plan — ",
      diet_plan:  "I have everything I need. Let me build your personalised diet plan — ",
    };
    sse.chunk(introMap[intent] ?? "Building your plan — ");
    const planner = await buildPlanner(intent, userId);
    await planner.generate(sse.chunk, sse.action);
  } else {
    const introMap: Record<string, string> = {
      meditation: "I'd love to design a personalised meditation plan for you! ",
      diet_plan:  "I'd love to create a personalised diet plan for you! ",
    };
    sse.chunk(introMap[intent] ?? "Let me build your plan! ");

    const firstSpec = requiredFields.find(f => f.field === missing[0])!;
    const remaining = missing.slice(1);
    sse.chunk(firstSpec.question);
    sse.action('COLLECT_PROFILE_FIELD', {
      field: missing[0],
      intent,
      remainingFields: remaining,
    });
  }
}

async function handleFieldAnswer(
  userId: string,
  message: string,
  field: string,
  intent: string,
  remainingFields: string[],
  sse: ReturnType<typeof makeSSE>
): Promise<void> {
  const fieldSpecs = getFieldSpecs(intent);
  const spec       = fieldSpecs.find(f => f.field === field);
  const rawValue   = message.trim();
  const value      = spec?.parseValue ? spec.parseValue(rawValue) : rawValue;

  // Save the field
  await toolSaveProfileField(userId, field, value);
  sse.action('PROFILE_FIELD_SAVED', { field, value });

  if (remainingFields.length === 0) {
    // All fields collected — generate plan
    sse.chunk("Got it! I now have everything I need. Building your plan — ");
    const planner = await buildPlanner(intent, userId);
    await planner.generate(sse.chunk, sse.action);
  } else {
    // Ask next field
    const nextField = remainingFields[0];
    const nextSpec  = fieldSpecs.find(f => f.field === nextField)!;
    sse.chunk("Got it! ");
    sse.chunk(nextSpec.question);
    sse.action('COLLECT_PROFILE_FIELD', {
      field: nextField,
      intent,
      remainingFields: remainingFields.slice(1),
    });
  }
}

async function handleConfirmation(
  userId: string,
  field: string,
  value: unknown,
  userReply: string,
  sse: ReturnType<typeof makeSSE>
): Promise<void> {
  const isYes = /\b(yes|yeah|yep|sure|correct|right|ok|okay|confirm|yup)\b/i.test(userReply);
  if (isYes) {
    await toolSaveProfileField(userId, field, value);
    sse.chunk(`Done! I've saved your ${field.replace(/([A-Z])/g, ' $1').toLowerCase()} as ${value}.`);
    sse.action('PROFILE_FIELD_SAVED', { field, value });
  } else {
    sse.chunk("No problem, I won't save that. What would you like to change it to?");
  }
}

async function handleViewProfile(userId: string, sse: ReturnType<typeof makeSSE>): Promise<void> {
  const profile = await toolGetUserProfile(userId);
  const summary = summarizeProfileForContext(profile);
  sse.chunk("Here's what I have on file for you: ");
  sse.chunk(summary.replace(/^\[|\]$/g, ''));
  if ((profile?.completeness ?? 0) < 80) {
    sse.chunk(` Your profile is ${profile?.completeness ?? 0}% complete — would you like to fill in the rest?`);
  }
  sse.action('SHOW_PROFILE', {});
}

async function handleUpdateProfileIntent(
  userId: string,
  message: string,
  sse: ReturnType<typeof makeSSE>
): Promise<void> {
  // Use LLM to extract field + value from the message
  const extractionPrompt = `Extract a health profile update from this user message.
Return ONLY valid JSON: { "field": "<field_name>", "value": <value> }
Valid fields and types:
  height (number, cm), weight (number, kg), age (number),
  gender ("male"|"female"|"other"|"prefer_not_to_say"),
  activityLevel ("sedentary"|"light"|"moderate"|"active"|"very_active"),
  fitnessGoal ("weight_loss"|"muscle_gain"|"endurance"|"flexibility"|"general_fitness"),
  dietPreference ("omnivore"|"vegetarian"|"vegan"|"keto"|"paleo"|"other"),
  sleepHours (number), stressLevel (1-5 number), availableTimePerDay (number, minutes)
Message: "${message}"
If nothing can be extracted, return: { "field": null, "value": null }`;

  const raw = await openaiChat([{ role: 'user', content: extractionPrompt }], {
    maxTokens: 100,
    temperature: 0.1,
  });

  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned) as { field: string | null; value: unknown };

    if (parsed.field && parsed.value != null) {
      const label = parsed.field.replace(/([A-Z])/g, ' $1').toLowerCase();
      sse.chunk(`Got it! Just to confirm — I'll save your ${label} as "${parsed.value}". Is that right?`);
      sse.action('CONFIRM_PROFILE_UPDATE', { field: parsed.field, value: parsed.value });
    } else {
      sse.chunk("What would you like to update in your profile? You can tell me things like your weight, height, fitness goal, or activity level.");
    }
  } catch {
    sse.chunk("What would you like to update in your profile?");
  }
}

async function handleGeneralChat(
  userId: string,
  message: string,
  history: ChatMessage[],
  sse: ReturnType<typeof makeSSE>
): Promise<void> {
  const profile = await toolGetUserProfile(userId);
  const profileSummary = summarizeProfileForContext(profile);

  const systemPrompt = `You are a warm, knowledgeable personal health assistant.
Be conversational and concise — 2-3 sentences maximum per response, suitable for voice output.
Never use markdown, bullet points, or lists in your response.
${profileSummary}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-8),
    { role: 'user', content: message },
  ];

  for await (const chunk of streamOpenAI(messages)) {
    sse.chunk(chunk);
  }
}
