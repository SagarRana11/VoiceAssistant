import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { HospitalPatient } from '../models/HospitalPatient';
import { HospitalSession } from '../models/HospitalSession';
import { ConsentLog } from '../models/ConsentLog';
import { DischargeLog } from '../models/DischargeLog';
import { HospitalChatHistory } from '../models/HospitalChatHistory';
import { FollowupLog } from '../models/FollowupLog';
import { streamOpenAI, openaiChat, ChatMessage } from '../services/openaiService';
import { retrieveHospitalDocs, classifyQueryCategory } from '../rag/hospitalRetriever';
import { rewriteQueryForRetrieval } from '../rag/queryRewriter';

// ─── SSE helper ──────────────────────────────────────────────────────────────
function makeSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  return {
    chunk: (text: string) => res.write(`data: ${JSON.stringify({ content: text })}\n\n`),
    done: () => {
      res.write('data: [DONE]\n\n');
      res.end();
    },
  };
}

// ─── Shared system prompt ─────────────────────────────────────────────────────
function hospitalSystemPrompt(patient: {
  name: string;
  diagnosis: string;
  plannedProcedure: string;
}): string {
  return `You are a warm, compassionate Cardiac Patient Education Assistant at a hospital.

Patient: ${patient.name}
Diagnosis: ${patient.diagnosis}
Planned Procedure: ${patient.plannedProcedure}

Your role:
- Explain the patient's diagnosis in simple, clear language
- Explain consent topics, procedure details, and discharge care
- Answer patient questions using the provided knowledge
- Stay calm, warm, and reassuring — never cold or robotic
- Keep answers short and conversational (2-4 sentences), suitable for voice
- Never use bullet points, markdown, or lists
- Never diagnose a new condition
- Never suggest changing or stopping medications
- If the patient reports chest pain, fainting, severe breathlessness, or heavy bleeding, immediately say: "Please seek urgent medical attention or contact your doctor immediately."
- Always remind the patient to consult their doctor for medical decisions`;
}

// ─── ENROLL ───────────────────────────────────────────────────────────────────
export async function enrollPatient(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  const {
    name,
    age,
    gender,
    preferredLanguage,
    diagnosis,
    plannedProcedure,
    doctorName,
    riskFactors,
  } = req.body;

  if (!name || !age || !diagnosis || !plannedProcedure) {
    res.status(400).json({ message: 'Name, age, diagnosis, and planned procedure are required.' });
    return;
  }

  const patient = await HospitalPatient.create({
    enrolledBy: userId,
    name,
    age,
    gender: gender ?? 'Not specified',
    preferredLanguage: preferredLanguage ?? 'English',
    diagnosis,
    plannedProcedure,
    doctorName: doctorName ?? '',
    riskFactors: riskFactors ?? '',
  });

  const session = await HospitalSession.create({
    patientId: patient._id,
    enrolledBy: userId,
    stage: 'enrolled',
  });

  res.status(201).json({ patient, session });
}

// ─── GET PATIENTS ────────────────────────────────────────────────────────────
export async function getPatients(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  const patients = await HospitalPatient.find({ enrolledBy: userId }).sort({ createdAt: -1 });
  res.json({ patients });
}

// ─── GET SESSION ─────────────────────────────────────────────────────────────
export async function getSession(req: AuthRequest, res: Response): Promise<void> {
  const { patientId } = req.params;
  const session = await HospitalSession.findOne({ patientId }).sort({ createdAt: -1 });
  if (!session) {
    res.status(404).json({ message: 'Session not found.' });
    return;
  }
  res.json({ session });
}

// ─── CHAT ────────────────────────────────────────────────────────────────────
export async function hospitalChat(req: AuthRequest, res: Response): Promise<void> {
  const {
    patientId,
    sessionId,
    message,
    history = [],
  } = req.body as {
    patientId: string;
    sessionId: string;
    message: string;
    history: { role: 'user' | 'assistant'; content: string }[];
  };

  const sse = makeSSE(res);

  try {
    const patient = await HospitalPatient.findById(patientId);
    if (!patient) {
      sse.chunk('Patient not found.');
      sse.done();
      return;
    }

    // Retrieve relevant knowledge docs
    const category = classifyQueryCategory(message);
    const retrievalQuery = await rewriteQueryForRetrieval(message, 'hospital', history);
    const docs = await retrieveHospitalDocs(retrievalQuery, category, patient.diagnosis, 3);
    const context =
      docs.length > 0 ? `\n\nRelevant medical knowledge:\n${docs.join('\n\n---\n\n')}` : '';

    const systemPrompt =
      hospitalSystemPrompt({
        name: patient.name,
        diagnosis: patient.diagnosis,
        plannedProcedure: patient.plannedProcedure,
      }) + context;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10),
      { role: 'user', content: message },
    ];

    // Stream response
    let fullResponse = '';
    for await (const chunk of streamOpenAI(messages)) {
      sse.chunk(chunk);
      fullResponse += chunk;
    }

    // Persist to chat history
    await HospitalChatHistory.findOneAndUpdate(
      { patientId, sessionId },
      {
        $push: {
          messages: {
            $each: [
              { role: 'user', content: message, timestamp: new Date() },
              { role: 'assistant', content: fullResponse, timestamp: new Date() },
            ],
          },
        },
        $setOnInsert: { patientId, sessionId },
      },
      { upsert: true },
    );
  } catch (err) {
    console.error('[HospitalChat]', err);
    sse.chunk('I ran into a problem. Please try again.');
  } finally {
    sse.done();
  }
}

// ─── CONSENT WIZARD ──────────────────────────────────────────────────────────
const CONSENT_STEPS = [
  {
    step: 0,
    topic: 'disease_explanation',
    prompt:
      'Start by warmly welcoming the patient by first name and saying something like "I\'m going to walk you through everything you need to know before your procedure, step by step." Then explain their diagnosis in very simple language, as if talking to someone with no medical background. Keep it warm and reassuring.',
  },
  {
    step: 1,
    topic: 'urgency',
    prompt:
      'Begin with a natural transition like "Now let me explain why we need to act on this quickly." Then explain why urgent treatment is needed for this patient\'s condition. Keep it calm and factual.',
  },
  {
    step: 2,
    topic: 'procedure_explanation',
    prompt:
      'Begin with a natural transition like "Now I\'m going to walk you through the procedure we have planned for you." Then explain the planned procedure in simple language — what the doctors will do, briefly.',
  },
  {
    step: 3,
    topic: 'benefits',
    prompt:
      'Begin with a natural transition like "Now let me tell you about the benefits of having this procedure done." Then explain clearly how the procedure will help the patient.',
  },
  {
    step: 4,
    topic: 'risks',
    prompt:
      'Begin with a natural transition like "I also want to be honest with you about the possible risks, so there are no surprises." Then explain the risks in an honest but calm, reassuring way. Avoid alarming language.',
  },
  {
    step: 5,
    topic: 'alternatives',
    prompt:
      'Begin with a natural transition like "Now let me briefly cover the other options available to you." Then explain the alternatives to the planned procedure, including what happens if no treatment is taken.',
  },
  {
    step: 6,
    topic: 'understanding_check',
    prompt:
      'Begin with a natural transition like "We\'re almost through everything — you\'ve done really well listening to all of this." Then gently ask the patient if they have understood and if they have any questions. Warm and encouraging tone.',
  },
  {
    step: 7,
    topic: 'acknowledgement',
    prompt:
      'Begin with a natural transition like "Thank you for going through all of this with me. Now I\'d like to ask for your acknowledgement." Then ask the patient to confirm they have understood and are giving their consent. Warm and respectful.',
  },
];

export async function consentStep(req: AuthRequest, res: Response): Promise<void> {
  const {
    patientId,
    sessionId,
    step,
    questionsAsked = 0,
  } = req.body as {
    patientId: string;
    sessionId: string;
    step: number;
    questionsAsked: number;
  };

  const sse = makeSSE(res);

  try {
    const patient = await HospitalPatient.findById(patientId);
    if (!patient) {
      sse.chunk('Patient not found.');
      sse.done();
      return;
    }

    const stepConfig = CONSENT_STEPS[step];
    if (!stepConfig) {
      sse.chunk('Invalid consent step.');
      sse.done();
      return;
    }

    const docs = await retrieveHospitalDocs(
      stepConfig.topic,
      step <= 1 ? 'disease' : step <= 3 ? 'consent' : step <= 5 ? 'procedure' : 'consent',
      patient.diagnosis,
      3,
    );
    const context = docs.length > 0 ? `\n\nRelevant knowledge:\n${docs.join('\n\n---\n\n')}` : '';

    const systemPrompt =
      hospitalSystemPrompt({
        name: patient.name,
        diagnosis: patient.diagnosis,
        plannedProcedure: patient.plannedProcedure,
      }) + context;

    const greetingRule =
      step === 0
        ? `Begin with a brief warm greeting using the patient's first name.`
        : `Do NOT start with Hi, Hello, or any greeting. Continue directly with the topic.`;

    const userPrompt = `${stepConfig.prompt}\n\n${greetingRule}\n\nPatient name: ${patient.name}. Diagnosis: ${patient.diagnosis}. Procedure: ${patient.plannedProcedure}.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    for await (const chunk of streamOpenAI(messages)) {
      sse.chunk(chunk);
    }

    // If this is the acknowledgement step, save consent log
    if (step === 7) {
      await ConsentLog.findOneAndUpdate(
        { patientId, sessionId },
        { patientId, sessionId, understood: true, questionsAsked, completedAt: new Date() },
        { upsert: true },
      );
      await HospitalSession.findByIdAndUpdate(sessionId, {
        stage: 'consent',
        consentCompleted: true,
      });
    }
  } catch (err) {
    console.error('[ConsentStep]', err);
    sse.chunk('I ran into a problem. Please try again.');
  } finally {
    sse.done();
  }
}

// ─── DISCHARGE WIZARD ────────────────────────────────────────────────────────
const DISCHARGE_STEPS = [
  {
    step: 0,
    topic: 'what_happened',
    category: 'disease',
    prompt:
      'Explain briefly what happened to the patient during their hospital stay, in simple reassuring language.',
  },
  {
    step: 1,
    topic: 'treatment_done',
    category: 'procedure',
    prompt: 'Explain what treatment was performed and that it was successful.',
  },
  {
    step: 2,
    topic: 'medicines',
    category: 'medicine',
    prompt:
      'Explain the medicines the patient will need to take at home, why each is important, and not to stop without asking the doctor.',
  },
  {
    step: 3,
    topic: 'activity',
    category: 'discharge',
    prompt:
      'Explain activity guidance: what the patient can and cannot do in the first few weeks after discharge.',
  },
  {
    step: 4,
    topic: 'diet',
    category: 'discharge',
    prompt:
      'Explain dietary guidance for a cardiac patient after discharge: what to eat, what to avoid.',
  },
  {
    step: 5,
    topic: 'warning_signs',
    category: 'discharge',
    prompt:
      'Explain the warning signs that require immediate medical attention: chest pain, breathlessness, bleeding, dizziness. Use a calm but clear tone.',
  },
  {
    step: 6,
    topic: 'followup',
    category: 'hospital',
    prompt: 'Explain the follow-up schedule: when to come back, what tests may be needed.',
  },
  {
    step: 7,
    topic: 'teachback',
    category: 'discharge',
    prompt:
      'Ask the patient to tell you back in their own words what they remember about their medicines and warning signs. Keep it gentle and encouraging.',
  },
];

export async function dischargeStep(req: AuthRequest, res: Response): Promise<void> {
  const { patientId, sessionId, step } = req.body as {
    patientId: string;
    sessionId: string;
    step: number;
  };

  const sse = makeSSE(res);

  try {
    const patient = await HospitalPatient.findById(patientId);
    if (!patient) {
      sse.chunk('Patient not found.');
      sse.done();
      return;
    }

    const stepConfig = DISCHARGE_STEPS[step];
    if (!stepConfig) {
      sse.chunk('Invalid discharge step.');
      sse.done();
      return;
    }

    const docs = await retrieveHospitalDocs(
      stepConfig.topic,
      stepConfig.category,
      patient.diagnosis,
      3,
    );
    const context = docs.length > 0 ? `\n\nRelevant knowledge:\n${docs.join('\n\n---\n\n')}` : '';

    const systemPrompt =
      hospitalSystemPrompt({
        name: patient.name,
        diagnosis: patient.diagnosis,
        plannedProcedure: patient.plannedProcedure,
      }) + context;

    const greetingRule =
      step === 0
        ? `Begin with a brief warm greeting using the patient's first name.`
        : `Do NOT start with Hi, Hello, or any greeting. Continue directly with the topic.`;

    const userPrompt = `${stepConfig.prompt}\n\n${greetingRule}\n\nPatient: ${patient.name}. Diagnosis: ${patient.diagnosis}. Procedure performed: ${patient.plannedProcedure}.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    for await (const chunk of streamOpenAI(messages)) {
      sse.chunk(chunk);
    }

    // Log completed steps
    await DischargeLog.findOneAndUpdate(
      { patientId, sessionId },
      {
        $addToSet: { completedSteps: step },
        $setOnInsert: { patientId, sessionId },
        ...(step === 7 ? { $set: { completedAt: new Date() } } : {}),
      },
      { upsert: true },
    );

    if (step === 7) {
      await HospitalSession.findByIdAndUpdate(sessionId, {
        stage: 'discharge',
        dischargeCompleted: true,
      });
    }
  } catch (err) {
    console.error('[DischargeStep]', err);
    sse.chunk('I ran into a problem. Please try again.');
  } finally {
    sse.done();
  }
}

// ─── FOLLOW-UP ───────────────────────────────────────────────────────────────
const FOLLOWUP_QUESTIONS: Record<number, string[]> = {
  1: [
    'Have you started all your medicines?',
    'Any chest pain or discomfort?',
    'Any bleeding from the wound site?',
    'Any difficulty breathing?',
  ],
  3: [
    'Have you started light walking as advised?',
    'Any dizziness or lightheadedness?',
    'How is your sleep and rest?',
  ],
  7: [
    'Your 1-week follow-up appointment is coming up. Have you scheduled it?',
    'How are you feeling overall?',
    'Any new symptoms to report?',
  ],
  30: [
    'How are you feeling after one month?',
    'Are you following your diet and activity plan?',
    'Have you quit smoking if applicable?',
    'Any concerns about your medicines?',
  ],
};

export async function followupCheck(req: AuthRequest, res: Response): Promise<void> {
  const { patientId, sessionId, day, responses } = req.body as {
    patientId: string;
    sessionId: string;
    day: number;
    responses: Record<string, string>;
  };

  const sse = makeSSE(res);

  try {
    const patient = await HospitalPatient.findById(patientId);
    if (!patient) {
      sse.chunk('Patient not found.');
      sse.done();
      return;
    }

    const questions = FOLLOWUP_QUESTIONS[day] ?? FOLLOWUP_QUESTIONS[1];
    const responseText = Object.entries(responses)
      .map(([q, a]) => `Q: ${q}\nA: ${a}`)
      .join('\n');

    const docs = await retrieveHospitalDocs(
      'recovery follow-up',
      'discharge',
      patient.diagnosis,
      2,
    );
    const context = docs.length > 0 ? `\n\nRelevant knowledge:\n${docs.join('\n\n---\n\n')}` : '';

    const systemPrompt =
      hospitalSystemPrompt({
        name: patient.name,
        diagnosis: patient.diagnosis,
        plannedProcedure: patient.plannedProcedure,
      }) + context;

    const userPrompt = `This is a Day ${day} follow-up check-in for ${patient.name}.\n\nPatient responses:\n${responseText}\n\nProvide a brief, warm summary of their progress. Encourage them, address any concerns mentioned, and remind them of important next steps.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    let aiSummary = '';
    for await (const chunk of streamOpenAI(messages)) {
      sse.chunk(chunk);
      aiSummary += chunk;
    }

    // Save followup log
    await FollowupLog.findOneAndUpdate(
      { patientId, sessionId },
      {
        $push: { entries: { day, responses, aiSummary, completedAt: new Date() } },
        $setOnInsert: { patientId, sessionId },
      },
      { upsert: true },
    );

    await HospitalSession.findByIdAndUpdate(sessionId, { stage: 'followup' });
  } catch (err) {
    console.error('[FollowupCheck]', err);
    sse.chunk('I ran into a problem. Please try again.');
  } finally {
    sse.done();
  }
}

// ─── GET FOLLOWUP QUESTIONS ───────────────────────────────────────────────────
export async function getFollowupQuestions(req: AuthRequest, res: Response): Promise<void> {
  const day = parseInt(req.params.day ?? '1', 10);
  const questions = FOLLOWUP_QUESTIONS[day] ?? FOLLOWUP_QUESTIONS[1];
  res.json({ day, questions });
}

// ─── COMPLETE CONSENT ────────────────────────────────────────────────────────
export async function completeConsent(req: AuthRequest, res: Response): Promise<void> {
  const { patientId, sessionId, questionsAsked } = req.body;

  await ConsentLog.findOneAndUpdate(
    { patientId, sessionId },
    {
      patientId,
      sessionId,
      understood: true,
      questionsAsked: questionsAsked ?? 0,
      completedAt: new Date(),
    },
    { upsert: true },
  );
  await HospitalSession.findByIdAndUpdate(sessionId, { consentCompleted: true, stage: 'consent' });

  res.json({ success: true });
}

// ─── MARK PROCEDURE DONE ─────────────────────────────────────────────────────
export async function markProcedureDone(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId } = req.body;
  await HospitalSession.findByIdAndUpdate(sessionId, { stage: 'procedure_done' });
  res.json({ success: true });
}

// ─── AI CHAT (non-streaming, for avatar mode) ─────────────────────────────────
export async function hospitalChatSync(req: AuthRequest, res: Response): Promise<void> {
  const { patientId, message } = req.body as { patientId: string; message: string };

  try {
    const patient = await HospitalPatient.findById(patientId);
    if (!patient) {
      res.status(404).json({ message: 'Patient not found.' });
      return;
    }

    const category = classifyQueryCategory(message);
    const retrievalQuery = await rewriteQueryForRetrieval(message, 'hospital');
    const docs = await retrieveHospitalDocs(retrievalQuery, category, patient.diagnosis, 3);
    const context = docs.length > 0 ? `\n\nRelevant knowledge:\n${docs.join('\n\n---\n\n')}` : '';

    const systemPrompt =
      hospitalSystemPrompt({
        name: patient.name,
        diagnosis: patient.diagnosis,
        plannedProcedure: patient.plannedProcedure,
      }) + context;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    const response = await openaiChat(messages, { maxTokens: 300, temperature: 0.7 });
    res.json({ response });
  } catch (err) {
    console.error('[HospitalChatSync]', err);
    res.status(500).json({ message: 'Failed to generate response.' });
  }
}
