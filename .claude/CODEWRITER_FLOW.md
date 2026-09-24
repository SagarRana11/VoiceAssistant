# CodeWriter — How It Works (Plain-Language Flow)

CodeWriter is an **autonomous coding agent**. You give it a task in plain English
("add input validation to the login route") and a repo path. It then reads,
searches, edits, tests, and commits code on its own by talking to an LLM in a
loop. This doc explains the moving parts in simple terms and grows as each build
stage lands.

Lives in: `backend/CodeWriter/`. Runs via `tsx` (dev). Typecheck: `npm run build:codewriter`.

---

## The big idea

> **Data flows inward, effects flow outward.**

- **Inward (context):** the repo scanner + prompt builder gather facts and feed
  them *into* a small, dumb agent loop.
- **Outward (effects):** the loop's decisions flow *out* through a guarded tool
  registry to the real world (filesystem, git).
- The loop stays tiny and vendor-neutral. All the messy bits — LLM vendor quirks,
  path safety, history trimming — live at the **edges**, not in the loop.

Think of it like a restaurant: the loop is the **waiter** (just relays orders),
the tools are the **kitchen** (only place food is actually made), and the
registry is the **order checker** (rejects invalid orders before they reach the
kitchen).

---

## Layers (dependency order — inner first)

```
types/        ← shared contracts (no logic)
  ↑
tools/        ← the ONLY code that touches files & git
  ↑
search/       ← ripgrep / TS-index / embeddings  (Stage 3)
  ↑
ai/           ← LLM adapters + client + prompt builder  (Stage 4)
  ↑
repository/ + memory/   ← scan repo, remember conversation  (Stage 5)
  ↑
orchestrator/ ← the agent loop + workflow  (Stages 6-7)
  ↑
queue / db / api / server   ← wiring & HTTP  (Stage 8)
```

Each layer only knows about the ones below it.

---

## What each piece does

### 1. `types/` — the contracts *(DONE)*
Just TypeScript interfaces, no behavior. The shared vocabulary everything else
speaks:
- `Message` — one chat turn (`system` / `user` / `assistant` / `tool`).
- `Tool` / `ToolResult` / `ToolContext` — what a tool is and what it can touch.
- `ToolCall` / `LLMResponse` — what the LLM asks for and returns.
- `Session` — live memory of one task run.
- `Task` / `TaskStep` — the job and its recorded steps.
- `RepoContext` / `StackInfo` — facts about the target repo.

Two interfaces (`Session`, `ToolRegistry`) are declared here on purpose so the
inner layers depend on *ideas*, not concrete classes (easier to test/swap).

### 2. `tools/` — the hands *(DONE)*
The only layer allowed to touch the filesystem or git. Everything the agent
"does" happens here, and every path is safety-checked first.

- **`safeResolve.ts`** — the security gate. Turns a path the LLM gave us into a
  real path *inside* the repo, and refuses anything that tries to escape
  (absolute paths, `../../etc`, or sneaky symlinks pointing outside).
- **`registry.ts`** — the order checker. Before any tool runs, it validates the
  arguments against that tool's schema. Bad args or an unknown tool come back as
  a polite failure message (not a crash) so the LLM can fix its mistake and
  retry. Also lists tool schemas for the LLM and marks which tools are read-only.
- **`readFile.ts`** — read a file, optionally just a line range. *(read-only)*
- **`writeFile.ts`** — create/overwrite a file. Returns a **diff** (just what
  changed), not the whole file, and records the edit in the session so it's never
  forgotten during history trimming. *(mutating)*
- **`runCommand.ts`** — run a safe, allowlisted command (npm, tsc, jest…). Has a
  timeout and stops if the task is cancelled. A failing test is *not* treated as
  an error — the agent needs to see the failure to fix it. *(mutating)*
- **`searchCode.ts`** — search the repo. It's a thin dispatcher; the real search
  engine is plugged in later (Stage 3). *(read-only)*
- **`git.ts`** — status / diff / branch / commit. **Never pushes**, so it can
  never rewrite or publish history. *(mutating)*
- **`exec.ts`** — shared helper that spawns a child process with a timeout and
  respects the cancel signal (used by runCommand and git).

> **Read-only vs mutating matters:** the agent loop (Stage 6) runs read-only
> tools *in parallel* (safe) but mutating tools *one at a time in order* (so two
> edits can't clobber each other).

### 3. `search/` — finding things *(DONE)*
Three ways for the agent to find code:
- **`ripgrep.ts`** — fast text/regex search via `rg --json`. If `rg` isn't
  installed it automatically falls back to a pure-Node file walk that returns the
  exact same result shape (callers can't tell the difference). Fills the
  `SearchFn` slot the `search_code` tool needs.
- **`tsIndexer.ts`** — "where is this defined / used?" using the TypeScript
  LanguageService (understands types & imports, not just text). Re-reads a file
  after the agent edits it (version bump).
- **`embedding.ts`** — meaning-based search: chop files into overlapping chunks,
  turn them into vectors, find the closest to a query. The vector store is behind
  an interface (in-memory stub for now) and the embedder is injected (keyless
  hash stand-in by default), so a real store/model drops in later.

### 4. `ai/` — talking to the LLM *(TODO — Stage 4)*
Adapters that translate our neutral `Message` format to/from each vendor
(Claude, OpenAI), a client that picks the provider by model name and retries on
errors, and a prompt builder that keeps the conversation from growing forever
(trims stale middle bits but never loses the task or the list of edits made).

### 5. `repository/` + `memory/` *(TODO — Stage 5)*
Scan the repo into a tree + detect the stack (so we know the test command).
Remember the conversation, edits, and token usage for one run.

### 6-7. `orchestrator/` — the brain *(TODO — Stages 6-7)*
The core loop: ask LLM → run the tools it requested → feed results back → repeat
until done. The workflow wraps it with: make a plan, run tests to verify, retry
on failure (up to 3 times), and commit only when tests pass.

### 8. queue / db / api / server *(TODO — Stage 8)*
A queue runs tasks in the background, a database stores tasks + sessions, and
HTTP routes let you create a task, watch its steps live (SSE), and cancel it.
Mounted alongside the existing `/api/code` chat at `/api/code/tasks`.

---

## Build progress

| Stage | Layer | Status |
|-------|-------|--------|
| 0 | build plumbing (tsconfig, scripts, env) | ✅ done |
| 1 | `types/` contracts | ✅ done |
| 2 | `tools/` (safeResolve, registry, 5 tools, exec) | ✅ done |
| 3 | `search/` (ripgrep+fallback, tsIndexer, embedding) | ✅ done |
| 4 | `ai/` | ⬜ next |
| 5 | scanner + session | ⬜ |
| 6 | taskRunner (core loop) | ⬜ |
| 7 | workflow | ⬜ |
| 8 | queue / db / api / server | ⬜ |
| 9 | tests | ⬜ |

*This doc is updated after each stage.*
