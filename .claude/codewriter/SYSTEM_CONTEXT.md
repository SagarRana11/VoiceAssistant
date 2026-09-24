# CodeWriter — System Context (project charter / "system prompt")

Load this first each session. It is the stable ground truth: what we're building,
the rules, the decisions already made, and the vocabulary. Changes here are rare
and deliberate (log them in PROGRESS.md → Decisions).

---

## Mission

Build an autonomous AI coding agent in TypeScript. Input: a natural-language task
+ a repo path. Behavior: it reads, searches, edits, tests, and commits code on
its own via an **LLM tool-use loop**. Primary intent of THIS effort: **learn the
HLD and LLD of how such a system is built** — thoroughly, layer by layer.

Location: `backend/CodeWriter/` (self-contained module). Runtime: `tsx`.
Typecheck: `npm run build:codewriter`. Tests: `npm run test:codewriter`.

---

## Architecture principle (north star)

> **Data flows inward, effects flow outward.**

Context (scanner, promptBuilder) flows *into* a thin, provider-agnostic agent
loop. The loop's decisions flow *out* through a validated tool registry to the
filesystem and git. The loop stays small; all vendor quirks, path safety, and
context compaction live at the **edges**.

Corollaries:
- The loop never knows the LLM vendor or a tool's argument shape.
- Only the tool layer touches fs/git/shell.
- Errors are returned as data (`ToolResult`), not thrown — the LLM self-corrects.
- Read-only tools run in parallel; mutating tools run serially, in order.

---

## Locked decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Module location | keep `backend/CodeWriter/`, own `tsconfig.codewriter.json` | outside `src/`; root tsc won't reach it |
| Build script | `tsc --noEmit` (typecheck only) | runtime uses `tsx`; no JS artifact needed |
| Dependencies | **zero new deps, hand-rolled** | match house style (raw `fetch`, no zod, no SDKs) |
| Schema validation | hand-rolled validator in registry | no zod in repo |
| Tests | `node:test` via `tsx --test` | no jest/vitest installed |
| LLM providers | Claude default (`claude-sonnet-5`); OpenAI adapter also built | only OPENAI_API_KEY present; ANTHROPIC to be added |
| Provider select | by model-string prefix (`claude*` → Claude) | simple, in `ai/client` |
| No key behavior | mock fallback | house convention across backend |
| Existing `/api/code` chat | keep untouched; agent mounts at `/api/code/tasks` | don't break the vision chat |
| DB | Mongoose (existing) for tasks + sessions | house pattern |
| Queue | in-memory + worker | no bullmq/redis |
| Search | spawn system `rg --json` + node-walk fallback | `rg` here is only a shell shim, not spawn-able |
| Vector store | interface + in-memory stub | real store deferred per spec |

---

## Conventions (match the existing backend)

- Strict TypeScript, **no `any`**.
- Raw `fetch` to LLM HTTP APIs; mock fallback when the key is missing.
- SSE frames: `data: ${JSON.stringify(...)}\n\n`, terminate with `[DONE]`.
- Mongoose models: `interface extends Document` + `Schema` + `mongoose.model`.
- Comment the **why** on non-obvious decisions (parallel-vs-serial, compaction),
  not the what.
- Every side effect goes through the tool registry — nothing else touches fs/git.

---

## File structure (spec — build in this order)

```
CodeWriter/
  types/index.ts                     contracts only
  tools/
    Tool interface (in types)  safeResolve.ts  registry.ts
    readFile.ts writeFile.ts runCommand.ts searchCode.ts git.ts  exec.ts(helper)
  search/  ripgrep.ts  tsIndexer.ts  embedding.ts
  ai/  provider.interface.ts  claude.ts  openai.ts  client.ts  promptBuilder.ts
  repository/scanner.ts
  memory/session.ts
  orchestrator/  taskRunner.ts  workflow.ts  taskQueue.ts
  database/       (task + session repos)
  api/task.routes.ts
  server.ts       (wiring only)
  controller/task.ts   (pre-existing vision chat — leave alone)
```

---

## Glossary

- **Tool** — a named capability with a JSON schema + `execute(args, ctx)`; marked
  `readonly` or mutating.
- **ToolCall / ToolResult** — the LLM's request to run a tool / its outcome
  (errors returned as data).
- **ToolContext** — a tool's entire allowed reach: `{ repoRoot, signal, session,
  registry }`.
- **Registry** — validates args vs schema, then dispatches to the tool; the one
  validation choke point.
- **Message** — one neutral chat turn (`system|user|assistant|tool`).
- **LLMResponse** — transient return of one LLM call (`content`, `toolCalls`,
  `usage`, `stopReason`); decomposed into Messages, never stored as-is.
- **Session** — live per-run state: `messages`, `fileEdits` (survives compaction),
  `usage`, `steps`; `snapshot()` persists it.
- **RepoContext / StackInfo** — scanned facts about the repo (tree, test command).
- **compaction** — trimming old messages to fit context while keeping system +
  task + edit record.
- **Task / TaskStep** — the job + its recorded steps (streamed over SSE).
- **The loop (taskRunner)** — ask LLM → run tools → feed back → repeat; the
  vendor-neutral core.
- **Workflow** — wraps the loop: plan → verify (tests) → repair(≤3) → commit.
