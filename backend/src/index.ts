import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/database';
import authRoutes       from './routes/auth';
import chatRoutes       from './routes/chat';
import ttsRoutes        from './routes/tts';
import didRoutes        from './routes/did';
import heygenRoutes     from './routes/heygen';
import assessmentRoutes from './routes/assessment';
import profileRoutes    from './routes/profile';
import agentRoutes      from './routes/agent';
import planRoutes       from './routes/plans';
import hospitalRoutes   from './routes/hospital';
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();
const PORT = parseInt(process.env.PORT ?? '5000', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '200kb' })); // Assessment payloads + plan responses
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/chat',       chatRoutes);
app.use('/api/tts',        ttsRoutes);
app.use('/api/did',        didRoutes);
app.use('/api/heygen',     heygenRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/profile',    profileRoutes);
app.use('/api/agent',      agentRoutes);
app.use('/api/plans',      planRoutes);
app.use('/api/hospital',   hospitalRoutes);

// ─── 404 + Error Handlers ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`   ENV:    ${process.env.NODE_ENV ?? 'development'}`);
    console.log(
      `   OpenAI: ${process.env.OPENAI_API_KEY ? '✅ configured' : '⚠️  not set — using mock responses'}`
    );
    console.log(`   DB:     ${process.env.MONGODB_URI}`);
    console.log(`   RAG:    Vector store will initialise on first agent request\n`);
  });
}

start();
