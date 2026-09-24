# CodeWriter Learning Hub — Index

**Purpose:** learn how an autonomous coding agent ("Code Writer") is built, at
both **HLD** (architecture) and **LLD** (code) level. Building the code is the
vehicle; understanding it is the goal.

This folder is the durable memory of the project. It survives across sessions,
context resets, and long gaps. Start every session here.

---

## 📍 Resume protocol (do this at the start of every session)

1. Read **`SYSTEM_CONTEXT.md`** — the mission, principles, locked decisions,
   conventions, file map, glossary. (The "system prompt" for this project.)
2. Read **`PROGRESS.md`** — jump to **NEXT ACTION** and **Open questions**.
3. Skim the latest **`lld/stageN-*.md`** — the deep-dive for the last layer built.
4. Continue from NEXT ACTION.

That's it — 3 files rebuild full state.

---

## 🗂 Document map

| Doc | What it is | When to read |
|-----|-----------|--------------|
| `00_INDEX.md` | this file — map + resume protocol | first, always |
| `SYSTEM_CONTEXT.md` | project charter: mission, principles, decisions, conventions, file structure, glossary | first session + when a decision changes |
| `PROGRESS.md` | living log: stage status, decisions, NEXT ACTION, open questions | every session |
| `lld/stageN-*.md` | per-stage deep dive — HLD role + LLD code walkthrough (the learning artifacts) | when studying/building a stage |
| `../CODEWRITER_FLOW.md` | plain-language flow overview | intro / refresher |
| `../CODEWRITER_HLD.md` | design view: diagrams, tool lifecycle, sequences | architecture study |
| `../SAMPLE_EXECUTION_FLOW.md` | one prompt traced end-to-end | see it all work together |

---

## 🧭 The learning ritual (every stage)

1. **Goals + HLD role** — where the layer sits; contracts in/out.
2. **LLD design first** — data structures, algorithm, edge cases, rejected
   alternatives + why. *(most learning happens here)*
3. **Build** — annotated code.
4. **LLD walkthrough** — write `lld/stageN-*.md`, block-by-block "why".
5. **Verify** — `npm run build:codewriter` (typecheck) / `npm run test:codewriter`.
6. **Checkpoint** — update PROGRESS + FLOW table; optional git commit; recap Q&A.

---

## 🏗 Build stages (dependency order)

0. build plumbing · 1. `types/` · 2. `tools/` · 3. `search/` · 4. `ai/` ·
5. scanner + session · 6. `taskRunner` (loop) · 7. `workflow` ·
8. queue/db/api/server · 9. tests

See `PROGRESS.md` for live status.
