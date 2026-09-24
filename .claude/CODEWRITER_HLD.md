# CodeWriter — High-Level Design (HLD)

Companion to `CODEWRITER_FLOW.md` (plain-language). This doc is the **design
view**: components, contracts, the tool-call lifecycle, and how a task flows
end-to-end. ASCII diagrams, no code.

---

## 1. System context

Read top-to-bottom = request path (inward). Each arrow is labeled with the
**data** that crosses it. Boxes on the far right/left are the **edges** where all
vendor detail and side effects are quarantined.

```
 ┌─────────────┐
 │ HTTP client │  frontend · curl · CI
 │             │
 └──────┬──────┘
        │  POST {prompt, repoPath, model?}      GET status · GET /stream (SSE) · POST /cancel
        ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ api/task.routes.ts        HTTP surface only — no business logic            │
 │  • create → persist Task(queued) → enqueue                                 │
 │  • status → read from DB          • stream → live TaskSteps over SSE       │
 │  • cancel → flip this task's AbortController                               │
 └──────┬───────────────────────────────────────────────────────▲───────────┘
        │  Task (queued)                          TaskStep events │ (live)
        ▼                                                         │
 ┌──────────────────────────────────────────────────────────────┴───────────┐
 │ taskQueue                 background worker, ONE task at a time            │
 │  holds an AbortController per task (cancel signal source)                  │
 └──────┬─────────────────────────────────────────────────────────────────── ┘
        │  run(task, signal)
        ▼
 ┌────────────────────────────────────────────────────────────────────────── ┐
 │ orchestrator/workflow     the "manager" — owns the outer plan              │
 │  scan repo → (plan) → run loop → run tests → repair ≤3 → commit → persist  │
 └──────┬──────────────────────────────────────────────────────────▲──────── ┘
        │  RepoContext + Message[]                    final Session │ snapshot
        ▼                                                           │
 ┌──────────────────────────────────────────────────────────────── ┴──────── ┐
 │ orchestrator/taskRunner   ★ THE LOOP — small, provider-agnostic ★          │
 │  speaks only two neutral languages (never vendor/tool specifics):          │
 └───┬───────────────────────────────────────────────────────────────┬────── ┘
     │                                                                 │
     │  ▲ Message[]           (to AI side)          ToolCall[]  ▼      │
     │  │ LLMResponse                               ToolResult  │      │
     ▼  │                                                       ▼      │
 ┌───────────────────────────────┐              ┌────────────────────────────┐
 │ ai/client  ── EDGE ──          │              │ tools/registry ── EDGE ──  │
 │  picks provider by model name  │              │  validate args vs schema   │
 │  retry/backoff on 429/500      │              │  then dispatch to a Tool   │
 │  aggregates token usage        │              │  (unknown/bad → ok:false)  │
 │        │              │        │              └─────────────┬──────────────┘
 │        ▼              ▼        │                            │ execute(args, ctx)
 │  ai/claude.ts   ai/openai.ts  │                            ▼
 │  (tool_use/     (tool_calls/  │        ┌───────────────────────────────────┐
 │   tool_result)   role:tool)   │        │ read_file  search_code  write_file │
 └───────┬───────────────────────┘        │ run_command  git    (safeResolve)  │
         │ HTTPS                           └──────────────┬────────────────────┘
         ▼                                                ▼
   Anthropic / OpenAI API              filesystem · git · shell · search/ engine
```

**Legend:** `★` = the only vendor-neutral core. `── EDGE ──` = where messy
reality (vendor shapes, validation, side effects) is contained. Up-arrows carry
results/events back toward the client.

**Rule of the loop:** `taskRunner` knows nothing about *which* LLM vendor is used
or *how* a tool validates its args. It only speaks two neutral languages:
`Message`/`LLMResponse` (to the AI side) and `ToolCall`/`ToolResult` (to the tool
side). Swapping Claude↔OpenAI, or adding a tool, never touches the loop.

**Two directions of flow:**
- **Inward (context, top→bottom):** client request → queued task → repo facts +
  messages → the loop.
- **Outward (effects, loop→edges):** the loop's decisions → validated tools →
  filesystem/git; and → AI client → vendor API. Results and live `TaskStep`
  events travel back up (right-side up-arrows) to the SSE stream.

---

## 2. Component responsibilities

| Component | Owns | Must NOT |
|-----------|------|----------|
| `types/` | shared contracts | contain logic |
| `tools/` | ALL fs/git/shell effects; path safety; arg validation | make LLM calls |
| `search/` | how to find code (ripgrep / TS API / embeddings) | edit files |
| `ai/` | vendor adapters, retry/backoff, prompt building, compaction | touch fs/git |
| `repository/` | scan repo → `RepoContext` (+ test command) | mutate the repo |
| `memory/` | session state (messages, edits, usage) survives compaction | know HTTP |
| `orchestrator/taskRunner` | the loop; parallel/serial tool exec; record steps | validate args, run tests, know vendors |
| `orchestrator/workflow` | plan, verify via tests, repair ≤3, commit on green | know HTTP |
| `taskQueue` | schedule runs on a worker | business logic |
| `database/` | persist tasks + sessions | business logic |
| `api/` | HTTP surface, SSE stream, cancel | business logic |
| `server.ts` | wiring only (build graph of objects) | business logic |

---

## 3. Anatomy of a Tool

Every tool is the same shape (`Tool` interface in `types/`):

```
Tool {
  name         unique id the LLM calls (e.g. "write_file")
  description  natural-language, shown to the LLM so it knows when to use it
  schema       JSON schema of its arguments (used for validation + LLM tool defs)
  readonly     true  → no side effects → safe to run in parallel
               false → mutates fs/git → must run serially, in order
  execute(args, ctx) → ToolResult
}
```

`ctx` (`ToolContext`) is the tool's *entire* allowed reach into the world:

```
ToolContext {
  repoRoot   absolute path; every user path is resolved under it (safeResolve)
  signal     AbortSignal; long ops (commands) die when the task is cancelled
  session    to record edits (survives history compaction)
  registry   in case a tool needs sibling tools
}
```

`ToolResult` is always returned (even on failure) — errors are *data*, not
exceptions, so the loop can hand them back to the LLM:

```
ToolResult { ok, output (text for the LLM), data? (structured), error? }
```

### The current toolset

```
read_only  ──▶ read_file      read a file / line range
               search_code    find text/regex (backend injected in Stage 3)

mutating   ──▶ write_file     create/overwrite → returns a DIFF, records edit
               run_command    allowlisted shell (npm/tsc/jest…), timeout, signal
               git            status/diff/branch/commit — never pushes
```

---

## 4. The tool-call lifecycle (single call)

```
 ① LLM decides            assistant message returns ToolCall{ id, name, args }
        │
        ▼
 ② taskRunner routes      registry.execute(name, args, ctx)
        │                 (runner does NOT inspect args — stays generic)
        ▼
 ③ registry guards        • unknown tool?         → ToolResult.ok=false
        │                 • args vs schema?        → ToolResult.ok=false
        │                   (missing/typed/enum)     (LLM sees error, retries)
        ▼
 ④ tool executes          execute(args, ctx)
        │                 • paths → safeResolve(repoRoot)  ⟵ escape-proof
        │                 • effects happen HERE and nowhere else
        │                 • respects ctx.signal + timeouts
        ▼
 ⑤ result recorded        session.recordStep(...)  + (if edit) recordEdit(...)
        │
        ▼
 ⑥ fed back to LLM        tool-role Message { toolCallId: id, content: output }
                          → next loop iteration
```

**Why validate in the registry, not the loop or the tool?**
One choke point. The loop stays vendor/tool-agnostic; each tool trusts its args
are already valid. Invalid input becomes a normal "try again" signal to the LLM
instead of crashing the task.

---

## 5. Parallel vs serial execution (one loop iteration, many calls)

An assistant turn can request several tool calls at once. The runner splits them:

```
toolCalls = [ read_file A, search_code B, write_file C, run_command D ]

        read-only group           mutating group
        ┌───────────────┐         ┌──────────────────────────┐
        │ A ║ B  (parallel        │ C → D   (serial, in the
        │   ║     Promise.all)    │          order requested)
        └───────────────┘         └──────────────────────────┘
         run first, together       then run one after another
```

- **Read-only in parallel:** no side effects → order doesn't matter → faster.
- **Mutating serial in order:** two writes (or write+build) could otherwise race
  or clobber each other; order the LLM chose is preserved.

---

## 6. End-to-end task flow

```
POST /api/code/tasks {prompt, repoPath, model?}
        │
        ▼  create Task(status=queued), persist, enqueue
   taskQueue worker picks it up  →  status=running
        │
        ▼  workflow.run(task)
   ┌──────────────────────────────────────────────────────────────┐
   │ 0. scanner.buildContext(repoPath)  → tree + stack + testCmd    │
   │ 1. (optional) planning pass         → high-level plan          │
   │ 2. taskRunner loop:                                            │
   │      repeat up to maxIters:                                    │
   │        a. compactHistory (never lose task + edits)             │
   │        b. one LLM call                                         │
   │        c. stopReason=end / no tools → done                     │
   │        d. else execute tools (parallel/serial) → feed back     │
   │        e. check abort signal                                   │
   │ 3. run testCmd to verify                                       │
   │ 4. tests fail? feed output back as user msg, re-run loop       │
   │      (bounded to 3 repair attempts)                            │
   │ 5. tests pass? git commit                                      │
   │ 6. persist session snapshot                                    │
   └──────────────────────────────────────────────────────────────┘
        │
        ▼  status = succeeded | failed | cancelled ; commitSha?
   SSE stream emitted live steps the whole time; cancel flips the AbortSignal
```

---

## 7. Cross-cutting concerns & where they live (the "edges")

| Concern | Lives at | Why there |
|---------|----------|-----------|
| Path safety | `tools/safeResolve` | single gate before any fs access |
| Arg validation | `tools/registry` | one choke point; loop stays generic |
| Vendor quirks (Claude vs OpenAI shapes) | `ai/claude.ts`, `ai/openai.ts` | loop speaks one neutral format |
| Retry / backoff (429/500) | `ai/client` | transport concern, not loop logic |
| History size control | `ai/promptBuilder.compactHistory` | keep context bounded; never drop edits |
| Cancellation | `AbortSignal` in `ToolContext` + loop check | cooperative, reaches child processes |
| Persistence | `memory/session.snapshot` + `database/` | separate state from behavior |

---

## 8. Key design decisions (the "why")

1. **Thin loop, fat edges.** Swapping LLM vendors or adding a tool never touches
   the loop. Testable with a fake provider + scripted tool calls.
2. **Errors as data (`ToolResult`).** The agent self-corrects from validation and
   command failures instead of the task dying.
3. **Effects only through the registry.** Nothing else in the system opens a file
   or runs git — makes safety auditable in one place.
4. **Edits tracked separately from chat.** History gets trimmed to fit context,
   but the record of *what changed* is never lost.
5. **No push, allowlisted commands, escape-proof paths.** Blast radius is capped
   to "local commits inside the given repo" by construction.
6. **Verify-then-commit with bounded repair.** Commits only happen on green; the
   repair loop can't spin forever (max 3).

---

*Living document — kept in sync with `CODEWRITER_FLOW.md` as stages land.*
