# VoiceAI — Role-Based Conversational Voice Assistant

A production-quality full-stack voice assistant with:
- 4 AI roles (Therapist, Health, Career, Fitness)
- Real-time speech recognition (browser Web Speech API)
- Streaming AI responses (Server-Sent Events)
- Text-to-speech playback
- Animated avatar synced to assistant state
- MongoDB persistence for conversations
- JWT authentication

---

## Architecture

```
Voice Assistant/
├── backend/          Node.js + Express + TypeScript + MongoDB
│   └── src/
│       ├── config/         MongoDB connection
│       ├── models/         User, Conversation (Mongoose)
│       ├── middleware/      JWT auth, error handler
│       ├── controllers/     Auth + Chat logic
│       ├── routes/          /api/auth  /api/chat
│       └── services/        OpenAI streaming (+ mock fallback)
│
└── frontend/         React 18 + TypeScript + Vite + Zustand
    └── src/
        ├── components/      Avatar, Header, Transcript, MicButton, SoundWave, RoleSelector
        ├── pages/           LoginPage, AssistantPage
        ├── hooks/           useSpeechRecognition, useSpeechSynthesis, useConversation
        ├── store/           Zustand global store
        └── services/        apiService (HTTP + SSE client)
```

### State Machine
```
idle → listening → thinking → speaking → idle
         ↑                        |
         └────── (role change) ───┘
```

---

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set MONGODB_URI and optionally OPENAI_API_KEY
npm install
npm run dev        # starts on http://localhost:5000
```

#### .env keys

| Key             | Required | Notes                                              |
|----------------|----------|----------------------------------------------------|
| MONGODB_URI    | Yes      | `mongodb://localhost:27017/voice-assistant`        |
| JWT_SECRET     | Yes      | Any long random string                             |
| OPENAI_API_KEY | No       | Leave empty → built-in mock responses are used     |
| CLIENT_URL     | No       | Default: `http://localhost:3000`                   |

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # starts on http://localhost:3000
```

Vite proxies `/api/*` → `http://localhost:5000`, so no CORS issues in dev.

---

## API Reference

### Auth
| Method | Endpoint             | Body                        | Auth |
|--------|---------------------|-----------------------------|------|
| POST   | /api/auth/register  | name, email, password       | No   |
| POST   | /api/auth/login     | email, password             | No   |
| GET    | /api/auth/me        | —                           | Yes  |

### Chat
| Method | Endpoint                         | Body / Params                          | Auth |
|--------|----------------------------------|----------------------------------------|------|
| POST   | /api/chat/conversations          | roleId, roleName                       | Yes  |
| GET    | /api/chat/conversations          | —                                      | Yes  |
| GET    | /api/chat/conversations/:id      | —                                      | Yes  |
| DELETE | /api/chat/conversations/:id      | —                                      | Yes  |
| POST   | /api/chat/message                | conversationId, message, roleId        | Yes  |

The `/api/chat/message` endpoint returns Server-Sent Events:
```
data: {"content": "chunk of text"}\n\n
data: {"done": true, "conversationId": "..."}\n\n
data: {"error": "message"}\n\n    ← on error
```

---

## Browser Support

| Feature              | Chrome | Edge | Firefox | Safari |
|---------------------|--------|------|---------|--------|
| Speech Recognition  | ✅     | ✅   | ❌      | ⚠️ iOS |
| Speech Synthesis    | ✅     | ✅   | ✅      | ✅     |
| SSE Streaming       | ✅     | ✅   | ✅      | ✅     |

> Speech recognition requires Chrome or Edge. Firefox users can still type messages (fallback prompt appears automatically).

---

## Roles

| Role              | Icon | System behaviour                                       |
|-------------------|------|-------------------------------------------------------|
| Emotional Therapist | 🧠  | Validates feelings, asks questions, short responses   |
| Health Assistant   | 🏥  | Gathers symptoms, structured advice, no diagnosis    |
| Career Counsellor  | 💼  | Roadmap-based answers, SMART goals                   |
| Fitness Coach      | 💪  | Workout plans, habit advice, progressive overload    |

Changing role **resets the conversation** and sends a new system prompt to OpenAI.
