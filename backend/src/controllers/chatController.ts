import { Response } from 'express';
import Conversation from '../models/Conversation';
import { streamOpenAI, ChatMessage } from '../services/openaiService';
import { AuthRequest } from '../middleware/auth';
import { ROLES } from '../constants/roles';
import { retrieveExerciseDocs, retrieveDietDocs, retrieveMeditationDocs } from '../rag/retriever';
import { rewriteQueryForRetrieval } from '../rag/queryRewriter';
import { rerankDocs } from '../rag/reRanker';

async function getRagContext(
  roleId: string,
  message: string,
  history: ChatMessage[],
): Promise<string> {
  try {
    if (roleId === 'fitness') {
      const query = await rewriteQueryForRetrieval(message, 'fitness', history);
      const candidates = await retrieveExerciseDocs(query, 15); // fetch wide
      console.log('candidates>>>', candidates);
      const docs = await rerankDocs(query, candidates, 5); // rerank narrow
      console.log('docs>>>', docs);
      if (docs.length === 0) return '';
      return '\n\n=== RELEVANT FITNESS KNOWLEDGE ===\n' + docs.join('\n\n');
    }
    if (roleId === 'health') {
      // Rewrite computed for logging; unused until health retrievers accept a free-text query param
      await rewriteQueryForRetrieval(message, 'health', history);
      const [dietDocs, meditationDocs] = await Promise.all([
        retrieveDietDocs(undefined, undefined, undefined, undefined, 2),
        retrieveMeditationDocs(undefined, undefined, undefined, undefined, 2),
      ]);
      const all = [...dietDocs, ...meditationDocs];
      if (all.length === 0) return '';
      return '\n\n=== RELEVANT HEALTH KNOWLEDGE ===\n' + all.join('\n\n');
    }
  } catch (err) {
    console.error('[RAG] retrieval error:', err);
  }
  return '';
}

// ─── POST /api/chat/conversations ─────────────────────────────────────────────
export async function createConversation(req: AuthRequest, res: Response): Promise<void> {
  const { roleId, roleName } = req.body;

  if (!roleId || !roleName) {
    res.status(400).json({ message: 'roleId and roleName are required.' });
    return;
  }

  const validRoles = ['therapist', 'health', 'career', 'fitness'];
  if (!validRoles.includes(roleId)) {
    res.status(400).json({ message: 'Invalid roleId.' });
    return;
  }

  const conversation = await Conversation.create({
    userId: req.user!.id,
    roleId,
    roleName,
    messages: [],
  });

  res.status(201).json({ success: true, conversation });
}

// ─── GET /api/chat/conversations ──────────────────────────────────────────────
export async function getConversations(req: AuthRequest, res: Response): Promise<void> {
  const conversations = await Conversation.find({ userId: req.user!.id })
    .sort({ updatedAt: -1 })
    .select('roleId roleName createdAt updatedAt messages')
    .lean();

  // Return summary (last message, message count) not full message arrays
  const summaries = conversations.map(c => ({
    _id: c._id,
    roleId: c.roleId,
    roleName: c.roleName,
    messageCount: c.messages.length,
    lastMessage: c.messages.at(-1) ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  res.status(200).json({ success: true, conversations: summaries });
}

// ─── GET /api/chat/conversations/:id ─────────────────────────────────────────
export async function getConversation(req: AuthRequest, res: Response): Promise<void> {
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    userId: req.user!.id,
  });

  if (!conversation) {
    res.status(404).json({ message: 'Conversation not found.' });
    return;
  }

  res.status(200).json({ success: true, conversation });
}

// ─── DELETE /api/chat/conversations/:id ──────────────────────────────────────
export async function deleteConversation(req: AuthRequest, res: Response): Promise<void> {
  const result = await Conversation.findOneAndDelete({
    _id: req.params.id,
    userId: req.user!.id,
  });

  if (!result) {
    res.status(404).json({ message: 'Conversation not found.' });
    return;
  }

  res.status(200).json({ success: true, message: 'Conversation deleted.' });
}

// ─── POST /api/chat/message  (SSE streaming) ──────────────────────────────────
export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  const { conversationId, message, roleId } = req.body;

  if (!conversationId || !message || !roleId) {
    res.status(400).json({ message: 'conversationId, message, and roleId are required.' });
    return;
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    userId: req.user!.id,
  });

  if (!conversation) {
    res.status(404).json({ message: 'Conversation not found.' });
    return;
  }

  // ── Set up Server-Sent Events ──────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Save user message
    conversation.messages.push({
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    });
    await conversation.save();

    // Build OpenAI message array (system + last 8 messages for context)
    const role = ROLES[roleId as keyof typeof ROLES];
    const priorMessages = conversation.messages.slice(-4).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    const ragContext = await getRagContext(roleId, message, priorMessages);
    const systemPrompt = (role?.systemPrompt ?? ROLES.therapist.systemPrompt) + ragContext;

    const recentMessages = conversation.messages.slice(-8);
    const openAIMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // ── Stream response ──────────────────────────────────────────────────────
    let fullResponse = '';

    for await (const chunk of streamOpenAI(openAIMessages)) {
      fullResponse += chunk;
      sendEvent({ content: chunk });
    }

    // Save completed assistant response
    conversation.messages.push({
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date(),
    });
    await conversation.save();

    // Signal stream completion
    sendEvent({
      done: true,
      conversationId: conversation._id.toString(),
    });
    res.end();
  } catch (err) {
    sendEvent({ error: (err as Error).message });
    res.end();
  }
}
