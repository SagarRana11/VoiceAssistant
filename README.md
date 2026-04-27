# VoiceAI — Full-Stack Voice Assistant Platform

A production-quality full-stack voice assistant with role-based AI conversations, streaming responses, D-ID avatar, ElevenLabs TTS, health assessments, personalized planning (exercise/diet/meditation), and a hospital cardiac assistant module.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Architecture Overview](#architecture-overview)
4. [Backend — File-by-File](#backend--file-by-file)
5. [Frontend — File-by-File](#frontend--file-by-file)
6. [RAG / Knowledge Base System](#rag--knowledge-base-system)
7. [D-ID Avatar Integration](#d-id-avatar-integration)
8. [ElevenLabs TTS Integration](#elevenlabs-tts-integration)
9. [Agent System (Planner)](#agent-system-planner)
10. [Assessment System](#assessment-system)
11. [Hospital Cardiac Assistant Module](#hospital-cardiac-assistant-module)
12. [Data Models (MongoDB)](#data-models-mongodb)
13. [API Reference](#api-reference)
14. [State Machine](#state-machine)
15. [Environment Variables](#environment-variables)
16. [Setup & Running](#setup--running)

---

## Tech Stack

| Layer    | Technology                                           |
|----------|------------------------------------------------------|
| Frontend | React 18, TypeScript, Vite, Zustand, CSS Modules     |
| Backend  | Node.js, Express, TypeScript (`tsx` runner)          |
| Database | MongoDB via Mongoose                                 |
| AI       | OpenAI GPT-4o-mini (chat + embeddings)               |
| Avatar   | D-ID (WebRTC streaming lip-sync avatar)              |
| TTS      | ElevenLabs (premium) → browser Web Speech API fallback |
| STT      | Browser Web Speech API (Chrome/Edge)                 |
| Auth     | JWT (Bearer tokens, stored in `localStorage`)        |

---

## Project Structure

```
Voice Assistant/
├── backend/
│   ├── src/
│   │   ├── index.ts                  ← Express app entry point
│   │   ├── config/
│   │   │   └── database.ts           ← MongoDB connection (Mongoose)
│   │   ├── models/                   ← Mongoose schemas
│   │   │   ├── User.ts
│   │   │   ├── Conversation.ts
│   │   │   ├── UserProfile.ts
│   │   │   ├── KnowledgeEmbedding.ts
│   │   │   ├── ExercisePlan.ts
│   │   │   ├── DietPlan.ts
│   │   │   ├── MeditationPlan.ts
│   │   │   └── WellBeingAssessment.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts               ← JWT protect() middleware
│   │   │   └── errorHandler.ts       ← 404 + global error handlers
│   │   ├── routes/                   ← Express router definitions
│   │   │   ├── auth.ts               → /api/auth
│   │   │   ├── chat.ts               → /api/chat
│   │   │   ├── tts.ts                → /api/tts
│   │   │   ├── did.ts                → /api/did
│   │   │   ├── assessment.ts         → /api/assessment
│   │   │   ├── profile.ts            → /api/profile
│   │   │   ├── agent.ts              → /api/agent
│   │   │   └── plans.ts              → /api/plans
│   │   ├── controllers/              ← Business logic per route
│   │   │   ├── authController.ts
│   │   │   ├── chatController.ts
│   │   │   ├── didController.ts
│   │   │   ├── ttsController.ts
│   │   │   ├── profileController.ts
│   │   │   ├── planController.ts
│   │   │   └── assessmentApiController.ts
│   │   ├── services/
│   │   │   ├── openaiService.ts      ← Streaming + non-streaming OpenAI calls
│   │   │   └── profileService.ts     ← Profile summary for LLM context
│   │   ├── agent/
│   │   │   ├── agentController.ts    ← SSE handler — intent routing + field collection
│   │   │   ├── agentTools.ts         ← toolGetUserProfile, toolSaveProfileField
│   │   │   └── intentDetector.ts     ← Keyword-based intent classifier
│   │   ├── planners/
│   │   │   ├── PlannerEngine.ts      ← Abstract base planner (RAG + OpenAI)
│   │   │   ├── ExercisePlanner.ts    ← Generates 4-week workout plan
│   │   │   ├── DietPlanner.ts        ← Generates weekly diet plan
│   │   │   └── MeditationPlanner.ts  ← Generates meditation schedule
│   │   ├── assessment/
│   │   │   ├── emotionalEngine.ts    ← Scores emotional domain answers
│   │   │   ├── mentalEngine.ts       ← Scores mental domain answers
│   │   │   ├── physicalEngine.ts     ← Scores physical domain answers
│   │   │   └── reportGenerator.ts    ← Compiles full well-being report
│   │   ├── rag/
│   │   │   ├── vectorStore.ts        ← Exercise singleton DomainVectorStore
│   │   │   ├── domainVectorStore.ts  ← Generic vector store (cosine similarity)
│   │   │   ├── embedder.ts           ← OpenAI text-embedding-3-small wrapper
│   │   │   ├── embeddingStore.ts     ← MongoDB cache for embeddings
│   │   │   ├── retriever.ts          ← Domain-specific retrieval functions
│   │   │   ├── pdfLoader.ts          ← PDF → chunks loader
│   │   │   └── knowledgeSources/
│   │   │       ├── exerciseKnowledge.ts   ← Hardcoded exercise docs
│   │   │       ├── dietKnowledge.ts       ← Hardcoded diet docs
│   │   │       ├── meditationKnowledge.ts ← Hardcoded meditation docs
│   │   │       └── Advanced_Exercise_Planner_Framework_2026.pdf
│   │   └── constants/
│   │       └── roles.ts              ← Role IDs + system prompt text
│   ├── kb/                           ← Hospital knowledge base markdown files
│   │   ├── consent/
│   │   │   └── nstemiConsent.md
│   │   ├── discharge/
│   │   │   └── nstemi.md
│   │   ├── disease/
│   │   │   └── nstemi.md
│   │   ├── hospital/
│   │   │   └── nstemi.md
│   │   ├── medicine/
│   │   │   └── nstemi.md
│   │   └── procedure/
│   │       └── nstemiProcedure.md
│   ├── api-server.py                 ← Python FastAPI server (PDF embedding loader)
│   ├── server_requirements.txt       ← Python dependencies
│   └── .env                          ← Backend environment variables
│
└── frontend/
    ├── src/
    │   ├── main.tsx                  ← React root mount
    │   ├── App.tsx                   ← Auth gate + page router (no react-router)
    │   ├── types/
    │   │   └── index.ts              ← Shared TypeScript interfaces
    │   ├── constants/
    │   │   └── roles.ts              ← Role definitions + system prompts
    │   ├── context/
    │   │   └── AssistantContext.tsx  ← React context shared across workspace components
    │   ├── store/                    ← Zustand global state slices
    │   │   ├── useAppStore.ts        ← Auth, current role, messages, assistant state
    │   │   ├── profileStore.ts       ← User health profile
    │   │   ├── plannerStore.ts       ← Exercise plan state
    │   │   ├── meditationStore.ts    ← Meditation plan state
    │   │   ├── dietStore.ts          ← Diet plan state
    │   │   └── useLayoutStore.ts     ← Sidebar open/close state
    │   ├── pages/
    │   │   ├── LoginPage/            ← Login + register form
    │   │   ├── AssistantPage/        ← Main app shell (mounts all hooks)
    │   │   └── profile/              ← Profile view + edit form
    │   ├── components/
    │   │   ├── AppLayout/            ← Top-level layout (sidebar + main content)
    │   │   ├── Sidebar/              ← Navigation sidebar
    │   │   ├── Header/               ← Top bar with role selector
    │   │   ├── Avatar/               ← Animated SVG avatar (idle/listening/speaking)
    │   │   ├── ConversationPanel/    ← Chat transcript display
    │   │   ├── GlobalInputBar/       ← Unified text/voice input bar
    │   │   ├── MicButton/            ← Mic toggle with visual feedback
    │   │   ├── SoundWave/            ← Animated sound bars during speech
    │   │   ├── Transcript/           ← Live interim speech transcript
    │   │   ├── RoleSelector/         ← Dropdown to switch AI role
    │   │   ├── MeditationMode/       ← Ambient meditation UI overlay
    │   │   ├── Assessment/           ← Well-being assessment overlay + report
    │   │   ├── workspace/            ← Per-feature workspace panels
    │   │   │   ├── WorkspaceRouter.tsx       ← Switches active workspace
    │   │   │   ├── TalkWorkspace.tsx         ← Default voice/text chat
    │   │   │   ├── WellBeingWorkspace.tsx    ← Assessment entry point
    │   │   │   ├── ExerciseWorkspace.tsx     ← Exercise plan display
    │   │   │   ├── DietWorkspace.tsx         ← Diet plan display
    │   │   │   ├── MeditationWorkspace.tsx   ← Meditation plan display
    │   │   │   ├── ProfileWorkspace.tsx      ← Profile panel inside main area
    │   │   │   └── SettingsWorkspace.tsx     ← Settings panel
    │   │   ├── ExercisePlanView/     ← Renders exercise plan week schedule
    │   │   ├── DietPlanView/         ← Renders diet plan meals
    │   │   ├── MeditationPlanView/   ← Renders meditation sessions
    │   │   ├── PlanHistory/          ← Lists saved plans from DB
    │   │   └── ProfileFieldsForm/    ← Health profile fill-in form
    │   ├── hooks/
    │   │   ├── useConversation.ts        ← Standard role-based chat (SSE + TTS queue)
    │   │   ├── useAgentConversation.ts   ← Agent chat (plans + field collection)
    │   │   ├── useDIDStream.ts           ← D-ID WebRTC avatar connection
    │   │   ├── useSpeechRecognition.ts   ← Web Speech API wrapper
    │   │   ├── useSpeechSynthesis.ts     ← Browser TTS wrapper
    │   │   ├── useSpeechQueue.ts         ← Sentence-level TTS queue (ElevenLabs + fallback)
    │   │   └── useAssessment.ts          ← Well-being assessment state machine
    │   ├── services/
    │   │   ├── apiService.ts         ← All HTTP + SSE calls to backend
    │   │   ├── agentService.ts       ← SSE streaming for agent endpoint
    │   │   ├── elevenLabsService.ts  ← ElevenLabs TTS via backend proxy
    │   │   └── profileService.ts     ← Profile CRUD API calls
    │   ├── utils/
    │   │   ├── emotionDetector.ts    ← Detects conversation state from text
    │   │   └── humanizer.ts          ← Text post-processing utilities
    │   ├── assessment/
    │   │   ├── assessmentQuestions.ts ← All well-being question sets
    │   │   └── assessmentTypes.ts     ← Assessment TypeScript types
    │   └── styles/
    │       └── globals.css            ← Global CSS reset + design tokens
    ├── vite.config.ts                 ← Vite config (proxies /api → localhost:5001)
    └── index.html                     ← HTML entry point
```

---

## Architecture Overview

```
Browser
  │
  ├─ Web Speech API ─────────────────────────────→ useSpeechRecognition
  │                                                       │
  │                                                  transcript
  │                                                       │
  │                                                 useConversation
  │                                                 useAgentConversation
  │                                                       │
  │                                           SSE stream (fetch)
  │                                                       │
  └─ Vite proxy /api ──────────────────────→ Express backend :5001
                                                           │
                                               ┌───────────┼───────────┐
                                               │           │           │
                                           OpenAI      MongoDB      D-ID API
                                         (chat/embed)  (MongoDB     (WebRTC)
                                                        Atlas)
```

**Request flow for a voice message:**

1. User speaks → `useSpeechRecognition` captures transcript
2. `useConversation.submitText()` or `useAgentConversation.submitMessage()` is called
3. SSE request sent to `/api/chat/message` or `/api/agent/message`
4. Backend streams OpenAI response chunks via SSE
5. Frontend accumulates chunks, detects sentence boundaries
6. Each complete sentence is enqueued in `useSpeechQueue`
7. `useSpeechQueue` calls ElevenLabs (via `/api/tts`) → if unavailable, falls back to `SpeechSynthesisUtterance`
8. If D-ID is connected, entire response is sent to D-ID avatar instead of TTS queue

---

## Backend — File-by-File

### `src/index.ts`
Express app entry. Registers all route prefixes, sets up CORS (origin from `CLIENT_URL` env), JSON body parser (200kb limit), and starts MongoDB + HTTP server.

| Route prefix      | Router file          |
|-------------------|----------------------|
| `/api/auth`       | `routes/auth.ts`     |
| `/api/chat`       | `routes/chat.ts`     |
| `/api/tts`        | `routes/tts.ts`      |
| `/api/did`        | `routes/did.ts`      |
| `/api/assessment` | `routes/assessment.ts` |
| `/api/profile`    | `routes/profile.ts`  |
| `/api/agent`      | `routes/agent.ts`    |
| `/api/plans`      | `routes/plans.ts`    |

---

### `src/config/database.ts`
Connects Mongoose to MongoDB. Called once at startup from `index.ts`.

---

### `src/middleware/auth.ts`
`protect()` middleware — validates `Authorization: Bearer <jwt>` header, looks up user in MongoDB, attaches `req.user = { id, name, email }`. Used on all protected routes.

---

### `src/middleware/errorHandler.ts`
- `notFound` — catches unmatched routes, returns 404
- `errorHandler` — global Express error handler, returns 500

---

### `src/controllers/authController.ts`
- `register` — hashes password with bcrypt, saves User, returns JWT
- `login` — verifies password, returns JWT
- `getMe` — returns current user from `req.user`

---

### `src/controllers/chatController.ts`
- `createConversation` — creates a `Conversation` doc linked to user + roleId
- `getConversations` — lists user's conversations
- `getConversation` — returns single conversation with messages
- `deleteConversation` — removes conversation doc
- `sendMessage` — SSE endpoint; appends user message, streams OpenAI response, appends assistant message to conversation

---

### `src/controllers/didController.ts`
Proxies to D-ID Streams API (needs `DID_API_KEY` env):
- `createStream` — POST to D-ID to create a stream, returns WebRTC offer
- `sendSdp` — forwards SDP answer from client to D-ID
- `sendIce` — forwards ICE candidates
- `sendTalk` — sends text script to D-ID to make avatar speak
- `deleteStream` — cleans up D-ID stream

Returns HTTP 503 if `DID_API_KEY` is not set (frontend degrades gracefully to built-in avatar).

---

### `src/controllers/ttsController.ts`
Proxies TTS request to ElevenLabs API (needs `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` envs):
- Returns audio binary stream (mp3)
- Returns HTTP 503 if keys not set (frontend degrades to browser TTS)

---

### `src/controllers/profileController.ts`
CRUD for `UserProfile` — get, update fields, calculate `completeness` percentage.

---

### `src/controllers/planController.ts`
List and get saved plans (exercise, diet, meditation) from MongoDB.

---

### `src/controllers/assessmentApiController.ts`
- `scoreDomain` — runs domain-specific engine (physical/mental/emotional) on answers, returns scores
- `generateReport` — calls `reportGenerator` to compile full well-being report, saves to `WellBeingAssessment`
- `listReports` / `getReport` — fetch historical assessments

---

### `src/services/openaiService.ts`
Two functions:
- `streamOpenAI(messages)` — async generator yielding text chunks from GPT-4o-mini with `stream: true`
- `openaiChat(messages, opts)` — single-turn non-streaming call, used by planners and agent LLM extraction

Both fall back to mock responses if `OPENAI_API_KEY` is not set (dev mode).

---

### `src/services/profileService.ts`
`summarizeProfileForContext(profile)` — formats UserProfile fields into a concise string injected into every general-chat system prompt.

---

### `src/agent/intentDetector.ts`
Keyword regex classifier. Maps user message to one of:
`exercise_plan | diet_plan | meditation | view_profile | update_profile | general`

---

### `src/agent/agentTools.ts`
- `toolGetUserProfile(userId)` — fetches UserProfile from MongoDB
- `toolSaveProfileField(userId, field, value)` — upserts a single field on UserProfile
- `getMissingFields(profile, required)` — returns list of fields not yet set

---

### `src/agent/agentController.ts`
Main SSE handler for `POST /api/agent/message`. Orchestrates:
1. **Bulk field submission** — saves all form fields at once, then generates plan
2. **Confirmation replies** — user says yes/no to a profile update
3. **Mid-collection answers** — saves answered field, asks next one
4. **Fresh intent detection** — routes to exercise/diet/meditation/profile/chat handlers

Each handler streams text chunks + structured `action` events via SSE.

**SSE action events emitted:**

| Action                  | Payload                              | Frontend effect                |
|-------------------------|--------------------------------------|-------------------------------|
| `COLLECT_PROFILE_FIELD` | `{ field, intent, remainingFields }` | Shows next question            |
| `COLLECT_ALL_FIELDS`    | `{ intent, fields[] }`               | Renders bulk form              |
| `PROFILE_FIELD_SAVED`   | `{ field, value }`                   | Updates profile store          |
| `CONFIRM_PROFILE_UPDATE`| `{ field, value }`                   | Holds for user yes/no          |
| `PLAN_GENERATED`        | `{ plan, planId }`                   | Stores exercise plan           |
| `MEDITATION_PLAN_GENERATED` | `{ plan, planId }`               | Stores meditation plan         |
| `DIET_PLAN_GENERATED`   | `{ plan, planId }`                   | Stores diet plan               |
| `SHOW_PROFILE`          | `{}`                                 | Refreshes profile panel        |

---

### `src/planners/PlannerEngine.ts`
Abstract base class. Subclasses override `buildPrompt()` and call `this.run(sse.chunk, sse.action)` which:
1. Fetches RAG docs relevant to user profile
2. Builds OpenAI prompt with docs + profile
3. Calls `openaiChat()`, parses JSON response
4. Saves plan to MongoDB
5. Emits `PLAN_GENERATED` (or domain equivalent) action event

---

### `src/planners/ExercisePlanner.ts`
Extends PlannerEngine. Uses `retrieveDocsByProfile()` from retriever. Generates `weeklySchedule[]` JSON. Saves to `ExercisePlan` model.

### `src/planners/DietPlanner.ts`
Extends PlannerEngine. Uses `retrieveDietDocs()`. Generates meal plan JSON. Saves to `DietPlan`.

### `src/planners/MeditationPlanner.ts`
Extends PlannerEngine. Uses `retrieveMeditationDocs()`. Generates meditation sessions JSON. Saves to `MeditationPlan`.

---

### `src/assessment/` engines
Each engine receives domain-specific answers and returns a scored result:
- `physicalEngine.ts` — scores physical health indicators
- `mentalEngine.ts` — scores cognitive/mental indicators
- `emotionalEngine.ts` — scores emotional well-being indicators
- `reportGenerator.ts` — combines all three scores, calls OpenAI to generate narrative summary, returns structured `WellBeingAssessment` doc

---

## RAG / Knowledge Base System

### How it works

```
Markdown/PDF docs → chunked text → OpenAI embeddings → MongoDB cache
                                                           │
Query text → embed query → cosine similarity search → top-K docs
                                                           │
                                              Injected into LLM prompt
```

### Key files

| File | Purpose |
|------|---------|
| `rag/embedder.ts` | Calls `text-embedding-3-small`, caches in memory, falls back to deterministic mock embedding in dev |
| `rag/embeddingStore.ts` | Loads from `KnowledgeEmbedding` MongoDB collection or computes + saves new ones |
| `rag/domainVectorStore.ts` | Generic vector store class. Each domain (exercise, diet, meditation) gets its own instance. Exposes `similaritySearch(query, topK)` and `searchByTags(tags, topK)` |
| `rag/vectorStore.ts` | Singleton `DomainVectorStore` for the exercise domain |
| `rag/retriever.ts` | Domain-specific retrieval functions used by planners |
| `rag/pdfLoader.ts` | Loads PDFs, splits into overlapping chunks |

### Knowledge domains

| Domain | Source | Store |
|--------|--------|-------|
| Exercise | `knowledgeSources/exerciseKnowledge.ts` (hardcoded docs) + PDF | `vectorStore` singleton |
| Diet | `knowledgeSources/dietKnowledge.ts` | `dietStore` in retriever |
| Meditation | `knowledgeSources/meditationKnowledge.ts` | `meditationStore` in retriever |
| Hospital/Cardiac | `kb/` markdown files (loaded by `api-server.py`) | `hospital` namespace in `KnowledgeEmbedding` |

### Hospital KB namespace
The `backend/kb/` directory holds per-disease markdown files split by topic:

```
kb/
├── disease/      ← What is the disease (NSTEMI, STEMI, etc.)
├── consent/      ← Consent education content
├── procedure/    ← Procedure explanations
├── discharge/    ← Post-discharge care
├── medicine/     ← Medication information
└── hospital/     ← General hospital process
```

The Python `api-server.py` (FastAPI) loads these markdown files, chunks them, generates embeddings, and stores them in MongoDB under `domain: "hospital"`. The hospital chat routes query this namespace.

---

## D-ID Avatar Integration

**Flow:**
```
Frontend                            Backend                D-ID API
   │                                    │                      │
connect() ──POST /api/did/ ──────────→ createStream() ──────→ POST /streams
           ←─ { offer, ice_servers } ←──────────────────────←─
setRemoteDescription(offer)
createAnswer()
sendSdp() ──POST /api/did/:id/sdp ──→ sendSdp() ──────────→ POST /streams/:id/sdp
ICE candidates ──POST /api/did/:id/ice →                  (forwarded)
   │
ontrack → videoRef.srcObject = stream  (WebRTC video arrives)
   │
speak(text) ──POST /api/did/:id/talk ─→ sendTalk() ──────→ POST /streams/:id/talk
           ←─ avatar lip-syncs in video stream ────────────←─
```

**Key file:** `frontend/src/hooks/useDIDStream.ts`

- `connect()` — establishes WebRTC peer connection via D-ID
- `speak(text)` — sends text to D-ID, avatar lip-syncs. Returns a Promise that resolves when D-ID fires `stream/done` on the data channel
- `disconnect()` — cleans up RTCPeerConnection and calls DELETE on D-ID stream

**Fallback:** If `DID_API_KEY` is not set, backend returns 503, `isAvailable` stays `false`, and the frontend shows the built-in animated SVG avatar instead.

**Voice used for D-ID:** `en-IN-NeerjaNeural` (Microsoft Azure Neural, Indian English)

---

## ElevenLabs TTS Integration

**Flow:**
```
Frontend                     Backend                ElevenLabs
   │                              │                      │
speakWithElevenLabs(text) ──POST /api/tts ─────────→ POST /text-to-speech/:voiceId
                          ←─ audio/mpeg blob ←──────────←─
new Audio(blobURL).play()
```

**Key file:** `frontend/src/services/elevenLabsService.ts`

- Caches availability flag for session — if ElevenLabs returns 503/402/429, marks unavailable and skips all subsequent calls
- Returns `null` on failure → caller (`useSpeechQueue`) falls back to `SpeechSynthesisUtterance`

**Key file:** `frontend/src/hooks/useSpeechQueue.ts`
- Manages a FIFO queue of sentences
- Dequeues one at a time: tries ElevenLabs → falls back to browser TTS
- Supports `enqueue(sentence, conversationState)` — state influences TTS pitch/rate

---

## Agent System (Planner)

The agent handles plan generation through a multi-turn profile-collection flow.

### Backend flow

```
POST /api/agent/message
        │
  agentController.handleAgentMessage()
        │
  ┌─────┴──────┐
  │ Intent?    │
  └─────┬──────┘
        ├── exercise_plan → check missing fields → collect one at a time (voice) or all-at-once form (text)
        ├── diet_plan     → same pattern
        ├── meditation    → same pattern
        ├── view_profile  → summarize + emit SHOW_PROFILE
        ├── update_profile → LLM extracts field+value → emit CONFIRM_PROFILE_UPDATE
        └── general       → handleGeneralChat() → stream OpenAI with profile context
```

### Frontend flow

```
GlobalInputBar
      │
useAgentConversation.submitMessage()
      │
streamAgentMessage() → SSE stream
      │
  ┌───┴────────────────────────────────┐
  │ onChunk → accumulate + stream TTS  │
  │ onAction → handleAction()          │
  └───┬────────────────────────────────┘
      │
  COLLECT_PROFILE_FIELD → show inline question
  COLLECT_ALL_FIELDS    → show bulk form
  PROFILE_FIELD_SAVED   → update profileStore
  PLAN_GENERATED        → update plannerStore → WorkspaceRouter switches to plan view
```

---

## Assessment System

### Flow

```
WellBeingWorkspace
      │
useAssessment hook
      │
AssessmentOverlay (step through questions per domain)
      │
apiScoreDomain() → POST /api/assessment/score-domain
      │                      │
      │              physicalEngine / mentalEngine / emotionalEngine
      │
apiGenerateReport() → POST /api/assessment/report
      │                      │
      │              reportGenerator (calls OpenAI for narrative)
      │              saves WellBeingAssessment to MongoDB
      │
AssessmentReport (renders scores + AI narrative)
```

**Question sets:** `frontend/src/assessment/assessmentQuestions.ts` — each domain has ~10 questions.

---

## Hospital Cardiac Assistant Module

### Purpose
Separate route dedicated to cardiac patient education. Completely isolated from the main assistant — uses its own namespace, components, routes, and state.

### Backend routes (to be added at `/api/hospital/`)

| Method | Endpoint                    | Purpose                             |
|--------|-----------------------------|-------------------------------------|
| POST   | `/api/hospital/enroll`      | Register a patient session           |
| POST   | `/api/hospital/chat`        | RAG-powered cardiac chat            |
| POST   | `/api/hospital/consent`     | Consent education wizard            |
| POST   | `/api/hospital/discharge`   | Discharge education wizard          |
| POST   | `/api/hospital/followup`    | Post-discharge follow-up            |

### Knowledge base routing logic

| Query topic               | Files searched                              |
|---------------------------|---------------------------------------------|
| Disease / what happened   | `kb/disease/<diagnosis>.md`                 |
| Consent / risks / benefits| `kb/consent/<diagnosis>Consent.md` + `kb/procedure/<diagnosis>Procedure.md` |
| Recovery / discharge      | `kb/discharge/<diagnosis>.md`               |
| Medicines                 | `kb/medicine/<diagnosis>.md`                |
| Hospital process          | `kb/hospital/<diagnosis>.md`                |

Uses `domain: "hospital"` in `KnowledgeEmbedding` MongoDB collection. Top-3 chunks retrieved per query.

### Patient session flow

```
1. Enroll → /hospital/enroll (form: name, age, diagnosis, procedure, doctor)
2. Session created → /hospital/chat (home screen with module cards)
3. Consent module → /hospital/consent (8-step wizard)
4. Procedure completed → /hospital/discharge (8-step wizard)
5. Daily check-ins → /hospital/followup (day 1/3/7/30 question sets)
6. Avatar mode → /hospital/avatar (D-ID + ElevenLabs, same hooks as main app)
```

### Safety rules enforced in system prompt
- Never diagnose new conditions
- Never change or suggest stopping medications
- Emergency symptoms (chest pain, fainting, breathlessness, heavy bleeding) → immediately redirect to seek medical help

---

## Data Models (MongoDB)

### `User`
```typescript
{ name, email, passwordHash, createdAt }
```

### `Conversation`
```typescript
{ userId, roleId, roleName, messages: [{ role, content, timestamp }], createdAt }
```

### `UserProfile`
```typescript
{
  userId, name, age, gender, height, weight,
  activityLevel, fitnessGoal, dietPreference,
  allergies[], diseases[], injuries[],
  stressLevel, sleepHours, meditationExperience,
  preferredMeditationDuration, meditationPreferredTime,
  availableTimePerDay, completeness  // 0-100%
}
```

### `KnowledgeEmbedding`
```typescript
{
  docId, domain, title, category,
  content, tags[], embedding: number[],
  contentHash
}
// Unique index on { docId, domain }
```

### `ExercisePlan` / `DietPlan` / `MeditationPlan`
```typescript
{ userId, plan: { weeklySchedule[], progressionAdvice, safetyNotes, ... }, createdAt }
```

### `WellBeingAssessment`
```typescript
{
  userId, sessionId,
  physicalResult, mentalResult, emotionalResult,
  narrative,  // AI-generated summary
  createdAt
}
```

---

## API Reference

### Auth
| Method | Endpoint              | Body                      | Auth |
|--------|-----------------------|---------------------------|------|
| POST   | /api/auth/register    | name, email, password     | No   |
| POST   | /api/auth/login       | email, password           | No   |
| GET    | /api/auth/me          | —                         | Yes  |

### Chat (role-based conversations)
| Method | Endpoint                      | Body / Params                    | Auth |
|--------|-------------------------------|----------------------------------|------|
| POST   | /api/chat/conversations       | roleId, roleName                 | Yes  |
| GET    | /api/chat/conversations       | —                                | Yes  |
| GET    | /api/chat/conversations/:id   | —                                | Yes  |
| DELETE | /api/chat/conversations/:id   | —                                | Yes  |
| POST   | /api/chat/message             | conversationId, message, roleId  | Yes  |

`/api/chat/message` → SSE stream:
```
data: {"content": "text chunk"}\n\n
data: {"done": true}\n\n
data: {"error": "message"}\n\n
```

### Agent (planner + health Q&A)
| Method | Endpoint             | Body                                                              | Auth |
|--------|----------------------|-------------------------------------------------------------------|------|
| POST   | /api/agent/message   | message, conversationHistory[], pendingField?, pendingIntent?, ... | Yes  |

Response: SSE stream with `{"content"}` chunks and `{"action", "data"}` events.

### TTS
| Method | Endpoint  | Body          | Auth |
|--------|-----------|---------------|------|
| POST   | /api/tts  | { text }      | Yes  |

Returns `audio/mpeg` binary or 503 if ElevenLabs not configured.

### D-ID
| Method | Endpoint            | Body                                    | Auth |
|--------|---------------------|-----------------------------------------|------|
| POST   | /api/did/           | —                                       | Yes  |
| POST   | /api/did/:id/sdp    | { answer, session_id }                  | Yes  |
| POST   | /api/did/:id/ice    | { candidate, sdpMid, ... }              | Yes  |
| POST   | /api/did/:id/talk   | { script, config, session_id }          | Yes  |
| DELETE | /api/did/:id        | ?session_id=...                         | Yes  |

Returns 503 if `DID_API_KEY` not set.

### Profile
| Method | Endpoint          | Body              | Auth |
|--------|-------------------|-------------------|------|
| GET    | /api/profile      | —                 | Yes  |
| PATCH  | /api/profile      | { field, value }  | Yes  |

### Assessment
| Method | Endpoint                       | Body                                   | Auth |
|--------|--------------------------------|----------------------------------------|------|
| POST   | /api/assessment/score-domain   | { domain, answers }                    | Yes  |
| POST   | /api/assessment/report         | { physicalResult, mentalResult, ... }  | Yes  |
| GET    | /api/assessment/reports        | —                                      | Yes  |
| GET    | /api/assessment/reports/:id    | —                                      | Yes  |

### Plans
| Method | Endpoint               | Auth |
|--------|------------------------|------|
| GET    | /api/plans/exercise    | Yes  |
| GET    | /api/plans/exercise/:id| Yes  |
| GET    | /api/plans/diet        | Yes  |
| GET    | /api/plans/diet/:id    | Yes  |
| GET    | /api/plans/meditation  | Yes  |
| GET    | /api/plans/meditation/:id | Yes |

---

## State Machine

The assistant UI drives a global `assistantState` in `useAppStore`:

```
idle
 │
 ├─(mic press)──────────────→ listening
 │                                │
 │                         (speech ends)
 │                                │
 ├─(text submit)─────────────→ thinking
 │                                │
 │                        (stream starts)
 │                                │
 │                            speaking
 │                                │
 │                         (TTS drains)
 │                                │
 └────────────────────────────── idle
```

Each state drives:
- Avatar animation (idle breathing / mic pulse / thinking spinner / speaking bounce)
- SoundWave visibility
- MicButton disabled state
- GlobalInputBar disabled state

---

## Environment Variables

### Backend (`backend/.env`)

| Variable             | Required | Purpose                                              |
|----------------------|----------|------------------------------------------------------|
| `PORT`               | No       | Default: 5000                                        |
| `NODE_ENV`           | No       | `development` or `production`                        |
| `MONGODB_URI`        | Yes      | MongoDB connection string                            |
| `JWT_SECRET`         | Yes      | Long random string for JWT signing                   |
| `JWT_EXPIRES_IN`     | No       | Default: `7d`                                        |
| `OPENAI_API_KEY`     | No       | Leave empty → mock responses used                    |
| `CLIENT_URL`         | No       | CORS origin, default: `http://localhost:3000`        |
| `DID_API_KEY`        | No       | D-ID avatar API key — skipped if absent              |
| `ELEVENLABS_API_KEY` | No       | ElevenLabs key — falls back to browser TTS if absent |
| `ELEVENLABS_VOICE_ID`| No       | ElevenLabs voice ID to use                           |

### Frontend (`frontend/.env`)
Vite proxies `/api/*` → backend, so no API keys are needed in the frontend env.

---

## Setup & Running

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set MONGODB_URI, JWT_SECRET, and optionally OPENAI_API_KEY
npm install
npm run dev        # tsx watch src/index.ts → http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # Vite → http://localhost:3000
```

> Vite proxies `/api/*` → `http://localhost:5001` (see `vite.config.ts`).
> Note: backend runs on 5000, Vite proxy points to 5001 — update one to match the other.

### 3. Hospital KB Embedding (Python, optional)

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r server_requirements.txt
python api-server.py
# Loads kb/ markdown files → embeds → saves to MongoDB hospital namespace
```

---

## Browser Support

| Feature              | Chrome | Edge | Firefox | Safari      |
|---------------------|--------|------|---------|-------------|
| Speech Recognition  | ✅     | ✅   | ❌      | ⚠️ iOS only |
| Speech Synthesis    | ✅     | ✅   | ✅      | ✅          |
| SSE Streaming       | ✅     | ✅   | ✅      | ✅          |
| WebRTC (D-ID)       | ✅     | ✅   | ✅      | ✅          |

> Speech recognition requires Chrome or Edge. Firefox users see a typed-input fallback automatically.

---

## Roles (Existing Assistant)

| Role               | System behavior                                      |
|--------------------|------------------------------------------------------|
| Emotional Therapist| Validates feelings, reflective questions, short TTS-friendly responses |
| Health Assistant   | Symptom gathering, general wellness advice, no diagnosis |
| Career Counsellor  | Goal-oriented roadmaps, SMART goals, resume guidance |
| Fitness Coach      | Workout plans, progressive overload, habit coaching  |

Changing role resets the conversation and sends a new system prompt to OpenAI.

---

---

## Hospital Module — Implementation Details

### Files Created

**Backend (`backend/src/`):**

| File | Purpose |
|------|---------|
| `models/HospitalPatient.ts` | Patient demographics + diagnosis + procedure |
| `models/HospitalSession.ts` | Session state machine (enrolled → consent → procedure_done → discharge → followup) |
| `models/ConsentLog.ts` | Records consent acknowledgement with questions count |
| `models/DischargeLog.ts` | Tracks completed discharge education steps |
| `models/HospitalChatHistory.ts` | Chat message history per patient session |
| `models/FollowupLog.ts` | Day-based follow-up check-in entries with AI summary |
| `rag/knowledgeSources/hospitalKnowledge.ts` | Reads `kb/` markdown files from disk, creates `KnowledgeDoc[]` per category |
| `rag/hospitalRetriever.ts` | Creates hospital `DomainVectorStore`, routes queries to correct category (disease/consent/procedure/discharge/medicine/hospital) |
| `controllers/hospitalController.ts` | All 11 endpoint handlers (enroll, patients, session, chat, consent step, discharge step, followup, procedure-done, etc.) |
| `routes/hospital.ts` | Express router at `/api/hospital/*` |

`src/index.ts` updated to mount `/api/hospital` routes.

**Frontend (`frontend/src/`):**

| File | Purpose |
|------|---------|
| `store/hospitalStore.ts` | Zustand store: `patient`, `session`, setters, `clearPatient` |
| `services/hospitalService.ts` | All API calls + SSE streaming helpers for hospital endpoints |
| `pages/hospital/HospitalPage.tsx` | Entry: shows EnrollPage if no patient, HospitalHomePage if enrolled |
| `pages/hospital/HospitalLayout.tsx` | Shared hospital-grade layout (white/light-blue theme, header, breadcrumb, footer) |
| `pages/hospital/EnrollPage.tsx` | Patient enrollment form + 3 demo presets (Rajesh/STEMI, Amit/CAD, Suresh/Heart Failure) |
| `pages/hospital/HospitalHomePage.tsx` | Patient summary card + 5 module cards + procedure-done toggle |
| `pages/hospital/ConsentPage.tsx` | 8-step consent wizard with streaming AI, question input, progress bar |
| `pages/hospital/DischargePage.tsx` | 8-step discharge wizard with streaming AI, question input, progress bar |
| `pages/hospital/ChatPage.tsx` | Full chat interface with quick-question chips and streaming responses |
| `pages/hospital/FollowupPage.tsx` | Day 1/3/7/30 check-in form with Yes/No/Not Sure + AI summary |
| `pages/hospital/AvatarPage.tsx` | D-ID WebRTC avatar + ElevenLabs/browser TTS fallback + transcript |
| `pages/hospital/HospitalLayout.module.css` | Shared hospital CSS tokens and layout styles |
| `pages/hospital/WizardPage.module.css` | Shared styles for consent + discharge wizard pages |
| `pages/hospital/EnrollPage.module.css` | Enrollment form styles |
| `pages/hospital/HospitalHomePage.module.css` | Dashboard/home styles |
| `pages/hospital/ChatPage.module.css` | Chat interface styles |
| `pages/hospital/FollowupPage.module.css` | Follow-up form styles |
| `pages/hospital/AvatarPage.module.css` | Avatar + transcript panel styles |
| `pages/hospital/VoiceWizard.tsx` | Shared voice-first wizard engine used by Consent + Discharge pages |
| `pages/hospital/VoiceWizard.module.css` | VoiceWizard two-column layout styles |
| `components/Sidebar/Sidebar.hospital.module.css` | Hospital button styles in sidebar |

`types/index.ts` — `AppPage` extended with 6 hospital page values.
`App.tsx` — Routes all hospital pages.
`Sidebar.tsx` — Hospital Assistant button added (navigates to `'hospital'`).

### VoiceWizard — How It Works

Both the Consent and Discharge pages use the shared `VoiceWizard` component:

```
User opens Consent / Discharge
        │
VoiceWizard mounts → useDIDStream.connect()
        │
loadStep(0) → onLoadStep() → streamHospitalSSE() → chunks accumulate
        │
stream ends → speak(fullText)
        │
     ┌──┴───────────────────────────────┐
     │ D-ID connected?                  │
     │  YES → toSpeechChunks(text)      │   ← splits at sentence boundaries (≤260 chars)
     │         → did.speak(chunk) × N  │   ← sequential, each chunk lip-syncs
     │  NO  → ElevenLabs proxy          │   ← speakWithElevenLabs(chunk)
     │         → browser TTS fallback   │   ← SpeechSynthesisUtterance
     └──────────────────────────────────┘
        │
Patient can:
  - Ask by voice (mic button → useSpeechRecognition → onAskQuestion → speak answer)
  - Ask by text  (input → onAskQuestion → speak answer)
  - Replay       (re-speak current content)
  - Need Doctor  (asks AI: "I need to speak to a doctor")
  - Next         (loadStep(n+1) → speak)
        │
Step 7 (last step) → "Complete" → onComplete() → saves to DB + updates session stage
```

**Layout:** two-column — D-ID avatar (left) + step content + controls (right).

**Speech chunking:** long AI responses are split at sentence boundaries into ≤260-char segments before sending to D-ID, preventing cut-off at D-ID's 25-second limit.

### Hospital RAG Query → Category Routing

```
User message text
      │
classifyQueryCategory() — regex-based
      │
      ├── medicine/drug/tablet     → search kb/medicine/
      ├── discharge/recovery/home  → search kb/discharge/ + kb/medicine/
      ├── consent/risk/benefit     → search kb/consent/ + kb/procedure/
      ├── procedure/angioplasty    → search kb/procedure/
      ├── hospital/ward/team       → search kb/hospital/
      ├── what is/disease/nstemi   → search kb/disease/
      └── default                  → search all categories
```

*Last updated: April 2026*
