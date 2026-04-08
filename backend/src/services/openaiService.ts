// ─── Types ───────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ─── Mock responses (used when OPENAI_API_KEY is not set) ───────────────────
const MOCK_RESPONSES: Record<string, string[]> = {
  therapist: [
    "I hear you, and what you're sharing sounds really significant. Can you tell me more about when these feelings tend to be strongest?",
    "That makes complete sense given everything you've described. It takes real courage to put words to something that difficult. How long have you been carrying this?",
    "It sounds like there's a lot happening beneath the surface. What feels most important for you to be understood about right now?",
    "I'm glad you felt safe sharing that. Sometimes just naming what we're feeling is the first step toward healing. What does support look like for you in moments like this?",
  ],
  health: [
    "Thank you for sharing that. To help you better, could you tell me how long you've been experiencing this, and rate the discomfort on a scale of 1 to 10?",
    "I understand your concern. While I can offer general wellness information, a qualified doctor can properly evaluate and diagnose your symptoms. Have you noticed anything that makes it better or worse?",
    "Based on what you've described, it would be wise to monitor these symptoms closely. If they persist beyond 48 hours or worsen, please see a healthcare professional. Are there other symptoms alongside this?",
    "That's good information to have. Staying hydrated and getting adequate rest supports recovery in many cases. When did you last see a doctor about something similar?",
  ],
  career: [
    "That's a goal worth pursuing with real strategy. Let's map it out — what's your current role and what does your ideal position look like in 2 to 3 years?",
    "Love that clarity of purpose. The fastest path usually combines a focused skill set with intentional networking. What's the biggest gap between where you are and where you want to be?",
    "Let's build a 90-day sprint plan. First — what are your three strongest professional skills, and which are you most excited to develop further?",
    "The market for that role is competitive but very much alive. I'd focus on one specific technical skill and one leadership signal on your resume. What projects have you shipped that you're proud of?",
  ],
  fitness: [
    "Let's GO! Before we build your plan — what's your current training frequency, available equipment, and the number one result you want in 8 weeks?",
    "Consistency at 70% effort beats perfection two days a week, every time. Do you have any injuries or physical limitations I should program around?",
    "Progressive overload is your best friend here — small, steady increases in volume or intensity every week. Are you currently tracking your workouts anywhere?",
    "That plateau is super fixable. It usually comes down to recovery, nutrition, or stimulus variety. Which of those do you think might be the weak link right now?",
  ],
};

let mockIndex = 0;

// ─── Live OpenAI streaming (async generator) ─────────────────────────────────
export async function* streamOpenAI(
  messages: ChatMessage[]
): AsyncGenerator<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    yield* streamMock(messages);
    return;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      stream: true,
      max_tokens: 500,
      temperature: 0.75,
      presence_penalty: 0.1,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content: string | undefined =
            parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // Skip malformed SSE frames
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Mock streaming (no API key) ─────────────────────────────────────────────
async function* streamMock(messages: ChatMessage[]): AsyncGenerator<string> {
  // Determine role from system prompt content
  const systemMsg = messages.find((m) => m.role === 'system')?.content ?? '';
  let roleId = 'therapist';
  if (systemMsg.includes('health') || systemMsg.includes('symptom'))
    roleId = 'health';
  else if (systemMsg.includes('career') || systemMsg.includes('professional'))
    roleId = 'career';
  else if (systemMsg.includes('fitness') || systemMsg.includes('workout'))
    roleId = 'fitness';

  const pool = MOCK_RESPONSES[roleId] ?? MOCK_RESPONSES.therapist;
  const response = pool[mockIndex % pool.length];
  mockIndex++;

  // Simulate thinking delay
  await sleep(700 + Math.random() * 500);

  // Stream word by word
  const words = response.split(' ');
  for (let i = 0; i < words.length; i++) {
    yield words[i] + (i < words.length - 1 ? ' ' : '');
    await sleep(45 + Math.random() * 65);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Non-streaming single-turn call (used by agent + planner) ────────────────
export async function openaiChat(
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // Mock: return a JSON stub so planners don't crash in dev
    await sleep(800 + Math.random() * 400);
    return JSON.stringify(MOCK_PLAN_STUB);
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      stream: false,
      max_tokens: options.maxTokens ?? 2000,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0].message.content ?? '';
}

// ─── Mock plan stub (dev mode when no OpenAI key) ────────────────────────────
const MOCK_PLAN_STUB = {
  weeklySchedule: [
    {
      day: 'Monday',
      focus: 'Full Body Strength',
      isRestDay: false,
      warmup: '5 min light jog + arm circles',
      exercises: [
        { name: 'Bodyweight Squat',  sets: 3, reps: '15',    restTime: '60 sec', notes: 'Keep chest up' },
        { name: 'Push-up',           sets: 3, reps: '10-12', restTime: '60 sec', notes: 'Modify on knees if needed' },
        { name: 'Dumbbell Row',      sets: 3, reps: '12',    restTime: '60 sec', notes: 'Keep back flat' },
        { name: 'Glute Bridge',      sets: 3, reps: '15',    restTime: '45 sec', notes: 'Squeeze at the top' },
        { name: 'Plank',             sets: 3, reps: '30 sec',restTime: '45 sec', notes: 'Keep hips level' },
      ],
      cooldown: '5 min static stretching — quads, hamstrings, chest',
      estimatedDuration: 45,
    },
    {
      day: 'Tuesday',  focus: 'Active Recovery', isRestDay: true,
      warmup: '', exercises: [], cooldown: '', estimatedDuration: 20,
    },
    {
      day: 'Wednesday',
      focus: 'Cardio + Core',
      isRestDay: false,
      warmup: '3 min walking + high knees',
      exercises: [
        { name: '20-min Brisk Walk or Jog', sets: 1, duration: '20 min', restTime: '', notes: 'Maintain conversational pace' },
        { name: 'Mountain Climbers',        sets: 3, reps: '20',          restTime: '45 sec' },
        { name: 'Dead Bug',                 sets: 3, reps: '10 each side',restTime: '45 sec' },
        { name: 'Side Plank',               sets: 2, reps: '20 sec/side', restTime: '30 sec' },
      ],
      cooldown: '5 min yoga stretches',
      estimatedDuration: 40,
    },
    {
      day: 'Thursday',  focus: 'Rest', isRestDay: true,
      warmup: '', exercises: [], cooldown: '', estimatedDuration: 0,
    },
    {
      day: 'Friday',
      focus: 'Full Body Strength',
      isRestDay: false,
      warmup: '5 min dynamic warmup',
      exercises: [
        { name: 'Reverse Lunge',     sets: 3, reps: '10 each leg', restTime: '60 sec' },
        { name: 'Dumbbell Press',    sets: 3, reps: '10-12',       restTime: '60 sec' },
        { name: 'Lat Pulldown',      sets: 3, reps: '12',          restTime: '60 sec' },
        { name: 'Romanian Deadlift', sets: 3, reps: '12',          restTime: '60 sec', notes: 'Hinge at hips, soft knees' },
        { name: 'Bicycle Crunch',    sets: 3, reps: '20',          restTime: '45 sec' },
      ],
      cooldown: '5 min stretching',
      estimatedDuration: 45,
    },
    {
      day: 'Saturday',
      focus: 'Light Activity',
      isRestDay: false,
      warmup: '',
      exercises: [
        { name: '30-min Walk or Cycle', sets: 1, duration: '30 min', restTime: '', notes: 'Easy pace, enjoy it' },
      ],
      cooldown: '',
      estimatedDuration: 30,
    },
    {
      day: 'Sunday',  focus: 'Rest', isRestDay: true,
      warmup: '', exercises: [], cooldown: '', estimatedDuration: 0,
    },
  ],
  progressionAdvice: 'Each week, try to add 1-2 reps per set or increase weight by 2.5kg. Track your workouts in a notebook or app.',
  safetyNotes: 'Stop if you feel sharp pain. Stay hydrated. Get 7-9 hours of sleep for best recovery.',
  planSummary: "Your 4-week beginner fitness plan is ready — 3 training days, 2 rest days, and 2 light activity days each week.",
  durationWeeks: 4,
};
