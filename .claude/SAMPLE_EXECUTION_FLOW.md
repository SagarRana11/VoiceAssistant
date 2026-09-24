# CodeWriter — Sample Execution Flow (worked example)

A single, concrete task traced from HTTP request to git commit, showing **every
step**: what the LLM sees, the tool calls it makes, how read-only vs mutating
calls run, how a failing test triggers repair, and where each piece of state is
recorded. Message/ToolCall JSON is illustrative (trimmed).

Companion to `CODEWRITER_HLD.md` (design) and `CODEWRITER_FLOW.md` (plain-language).

---

## The example

**Prompt:** *"Add input validation to the login route — return 400 if email or
password is missing."*
**Repo:** `/repos/demo-api` (an Express + TypeScript service with `npm test`).

```
POST /api/code/tasks
{ "prompt": "Add input validation to the login route — return 400 if email or password is missing.",
  "repoPath": "/repos/demo-api",
  "model": "claude-sonnet-5" }
```

---

## STEP 0 — Intake (api → queue → workflow)

```
api/task.routes.ts
  • builds Task { id: "t_918", status: "queued", prompt, repoPath, model }
  • saves it to the DB
  • enqueues t_918
  • responds 202  { taskId: "t_918" }        ← client can now poll or open SSE

taskQueue
  • worker is free → picks t_918
  • creates an AbortController  (this is the "cancel" handle)
  • Task.status = "running"
  • calls workflow.run(task, signal)
```

Nothing has touched the repo yet.

---

## STEP 1 — Scan the repo (repository/scanner)

The scanner gathers *facts* so the LLM starts informed (context flows inward):

```
scanner.buildContext("/repos/demo-api")  →  RepoContext {
  tree:  [ src/index.ts, src/routes/auth.ts, src/routes/user.ts,
           test/auth.test.ts, package.json, ... ]        (gitignore-aware)
  stack: { language: "TypeScript", packageManager: "npm",
           testCmd: "npm test", frameworks: ["express","jest"] }
  fileCount: 23
}
```

`testCmd` is the key output — the workflow uses it later to verify.

---

## STEP 2 — Build the first prompt (ai/promptBuilder + memory/session)

A fresh `Session` is created. The prompt builder assembles the opening messages:

```
Session t_918 { messages: [], fileEdits: {}, usage: {0,0}, steps: [] }

messages = [
  { role: "system",  content: buildSystem(RepoContext, toolSchemas) },
        // "You are a coding agent. Repo: TypeScript/Express. Tools available:
        //  read_file, search_code, write_file, run_command, git. Rules: …"
  { role: "user",    content: "Add input validation to the login route — return
                               400 if email or password is missing." }
]
```

The **tool schemas** (from `registry.schemas()`) are also passed to the AI client
so the LLM knows exactly what it can call and with what arguments.

---

## STEP 3 — Loop iteration 1 : LOCATE the code

`taskRunner` runs one LLM call. The LLM doesn't know where the login route is, so
it searches — and it can look in two ways at once (both **read-only**):

```
── LLM call ──▶ LLMResponse {
     content: "Let me find the login route.",
     stopReason: "tool_use",
     toolCalls: [
       { id: "c1", name: "search_code", args: { query: "login", glob: "**/*.ts" } },
       { id: "c2", name: "search_code", args: { query: "router.post", glob: "**/*.ts" } }
     ],
     usage: { in: 1200, out: 60 }
}
```

**Runner splits the calls by `readonly`:** both are read-only → run **in
parallel** via `Promise.all`.

```
registry.execute("search_code", {query:"login"…})   ─┐ parallel
registry.execute("search_code", {query:"router.post"})─┘

  registry: validate args vs schema ✓ → dispatch to search_code tool
  tool: dispatch to the injected search backend (ripgrep)

results:
  c1 → src/routes/auth.ts:14:  router.post("/login", async (req, res) => {
  c2 → src/routes/auth.ts:14 ; src/routes/user.ts:9
```

Both results appended as `tool`-role messages (each carries its `toolCallId`):

```
messages += [
  { role:"tool", toolCallId:"c1", content:"1 match: src/routes/auth.ts:14 …" },
  { role:"tool", toolCallId:"c2", content:"2 matches: auth.ts:14 ; user.ts:9" }
]
session.recordStep(tool, "search_code login") ; recordStep(tool, "search_code router.post")
```

Abort signal checked → not cancelled → loop continues.

---

## STEP 4 — Loop iteration 2 : READ the file

```
── LLM call ──▶ toolCalls: [
     { id:"c3", name:"read_file", args:{ path:"src/routes/auth.ts",
                                         startLine:1, endLine:40 } }
]  (read-only)

registry.execute → read_file
  tool: safeResolve("/repos/demo-api", "src/routes/auth.ts")  → OK (inside repo)
        reads lines 1–40, returns them line-numbered

messages += { role:"tool", toolCallId:"c3", content:
  "src/routes/auth.ts (lines 1-40 of 52)\n14  router.post('/login', async (req,res)=>{\n
   15    const { email, password } = req.body;\n
   16    const user = await db.users.findByEmail(email);\n ... " }
```

Now the LLM has seen the actual code.

---

## STEP 5 — Loop iteration 3 : EDIT (mutating)

The LLM writes the fix. `write_file` is **mutating**:

```
── LLM call ──▶ toolCalls: [
   { id:"c4", name:"write_file",
     args:{ path:"src/routes/auth.ts", content:"<full new file text>" } }
]

Runner: mutating → run SERIALLY (even if others were requested, they'd queue).

registry.execute → write_file
  tool: safeResolve ✓ → read old content → write new content
        compute unified DIFF (not the whole file)
        session.recordEdit("src/routes/auth.ts", diff)   ← survives compaction

result output (what the LLM sees):
  "Modified src/routes/auth.ts
   --- src/routes/auth.ts
   +++ src/routes/auth.ts
   @@
    15    const { email, password } = req.body;
   +16    if (!email || !password) {
   +17      return res.status(400).json({ error: 'email and password required' });
   +18    }
    19    const user = await db.users.findByEmail(email);"

messages += { role:"tool", toolCallId:"c4", content:"<diff above>" }
session state now: fileEdits = { "src/routes/auth.ts": {diff, ts} }
```

> If the LLM had asked to edit two files in one turn, both `write_file` calls run
> **one after another, in the order given** — never in parallel — so they can't
> race or clobber shared state.

---

## STEP 6 — Loop iteration 4 : LLM signals done

```
── LLM call ──▶ LLMResponse {
     content: "Added a 400 guard when email or password is missing.",
     stopReason: "end",          ← no tool calls
     toolCalls: []
}
```

`stopReason === "end"` (and no tool calls) → the **runner loop completes** and
hands control back to the workflow. The runner did NOT run tests — that's the
workflow's job (separation of concerns).

*(Note on compaction: if this conversation had grown large, before each LLM call
`compactHistory` would summarize/drop stale middle tool outputs — but keep the
system prompt, the original task, and the file-edit record intact. Here it stayed
small, so nothing was trimmed.)*

---

## STEP 7 — Verify with tests (workflow)

```
workflow runs the stack's testCmd via the run_command tool:
   run_command { command:"npm", args:["test"] }   (mutating; serial)
   → exec("npm", ["test"], { cwd: repoRoot, signal, timeout })

result:  exited with code 1
  FAIL test/auth.test.ts
    ✕ login rejects missing password (expected 400, got 500)
    → TypeError: Cannot read properties of undefined (reading 'trim')
```

Tests **fail**. (Non-zero exit is not a tool error — the agent *needs* to see
this.) Repair attempt counter = 1 of 3.

---

## STEP 8 — Repair loop (workflow feeds failure back)

The workflow appends the test output as a **user** message and re-runs the runner
loop — same mechanism, new information:

```
messages += { role:"user", content:
  "Tests failed. Fix the code so they pass:\n<npm test output above>" }

── runner loop resumes ──
  iter: read_file test/auth.test.ts   (understand the expectation)
  iter: write_file src/routes/auth.ts (guard also trims/handles undefined body)
  iter: stopReason:"end"
```

Workflow re-runs `npm test`:

```
result: exited with code 0
  PASS test/auth.test.ts  (3 passing)
```

Tests **pass** → exit the repair loop (used 1 of 3 attempts).

---

## STEP 9 — Commit (only on green)

```
git tool:
   git { action:"commit",
         message:"Add 400 validation for missing email/password on login" }
   → git add -A
   → git commit -m "…"
   → git rev-parse HEAD → 3f9a1c2b8e04

Never pushes. History stays local.
Task.commitSha = "3f9a1c2b8e04"
```

---

## STEP 10 — Persist & finish

```
session.snapshot() → { messages, fileEdits, usage, steps }  saved to DB
Task.status = "succeeded" ; Task.commitSha set ; updatedAt stamped
SSE stream emits final step, then closes.
```

Client polling `GET /api/code/tasks/t_918` now sees:

```
{ id:"t_918", status:"succeeded", commitSha:"3f9a1c2b8e04",
  steps:[ search, search, read, write, llm-end, test(fail),
          read, write, llm-end, test(pass), commit ] }
```

---

## What each subsystem did (recap)

| Step | Subsystem | Action |
|------|-----------|--------|
| 0 | api + queue | intake, enqueue, cancel handle |
| 1 | repository/scanner | facts: tree + stack + testCmd |
| 2 | ai/promptBuilder + memory/session | first messages + tool schemas |
| 3 | taskRunner + tools/registry + search | locate (2 reads **parallel**) |
| 4 | read_file | read the target file |
| 5 | write_file | edit → diff + recordEdit (**serial**) |
| 6 | taskRunner | detect `stopReason:end` → stop |
| 7 | workflow + run_command | run tests → fail |
| 8 | workflow → taskRunner | feed failure, repair, re-test → pass |
| 9 | git tool | commit on green (no push) |
| 10 | memory/session + database | snapshot + final status |

---

## Applying this to ANY multi-agent tool system

The same skeleton generalizes to any agent with read/write/other tools:

1. **Gather context first** — scan/RAG so the model starts informed.
2. **Advertise tools by schema** — the model calls tools by name+args; you never
   hard-code "if prompt says X do Y".
3. **One validation choke point** — check args before executing; return errors as
   data so the model retries instead of crashing.
4. **Classify tools by side effects** — read-only ⇒ parallel; mutating ⇒ serial,
   ordered. This is the single most important safety/perf rule.
5. **Keep the loop dumb** — ask → act → feed results back → repeat until "done"
   or an iteration cap. No vendor or tool specifics inside it.
6. **Verify before you trust** — run tests/checks *outside* the loop; on failure,
   feed the output back as a new message and let the loop repair (bounded).
7. **Commit/finalize only on success**, snapshot state, and stream steps so a
   human can watch and cancel.
```
context ──▶ [ loop: ask → validated tools → feed back ] ──▶ verify ──▶ commit
   ▲                         (errors return as data)            │
   └───────────────── repair (bounded) ◀───── on failure ───────┘
```

*Illustrative; message/JSON shapes are trimmed for readability.*
