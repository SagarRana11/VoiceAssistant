# CodeWriter — Progress Log (resume anchor)

Update this at the end of every stage. The **NEXT ACTION** line is where any
future session resumes.

---

## ▶ NEXT ACTION

Build **Stage 4 — `ai/`**: `provider.interface.ts` (LLMProvider: chat/stream),
`claude.ts` (system field + tool_use/tool_result blocks, raw fetch), `openai.ts`
(tool_calls + role:tool, raw fetch), `client.ts` (select by model prefix, retry/
backoff on 429/500, aggregate usage), `promptBuilder.ts` (buildSystem,
buildTaskMessages, compactHistory — keep system+task+last N verbatim, summarize
stale middle tool outputs, never lose file-edit state). Follow the ritual; write
`lld/stage4-ai.md`.

---

## Stage status

| Stage | Layer | Status | LLD doc |
|-------|-------|--------|---------|
| 0 | build plumbing (tsconfig, scripts, env) | ✅ done | — |
| 1 | `types/index.ts` (contracts) | ✅ done | ⬜ to write |
| 2 | `tools/` (safeResolve, registry, 5 tools, exec) | ✅ done | — (skipped per calibration) |
| 3 | `search/` (ripgrep, tsIndexer, embedding) | ✅ done | `lld/stage3-search.md` |
| 4 | `ai/` (providers, client, promptBuilder) | ⬜ | — |
| 5 | scanner + session | ⬜ | — |
| 6 | `taskRunner` (core loop) | ⬜ | — |
| 7 | `workflow` | ⬜ | — |
| 8 | queue / db / api / server | ⬜ | — |
| 9 | tests | ⬜ | — |

Legend: ✅ done · ⬜ pending · 🚧 in progress

---

## What's built so far (files)

- `CodeWriter/tsconfig.codewriter.json` — standalone typecheck config (noEmit).
- `package.json` — `build:codewriter`, `test:codewriter` scripts.
- `.env.example` — `ANTHROPIC_API_KEY`, `CODEWRITER_MODEL`, `CODEWRITER_MAX_ITERS`.
- `CodeWriter/types/index.ts` — all shared contracts.
- `CodeWriter/tools/` — `safeResolve.ts`, `registry.ts`, `exec.ts`,
  `readFile.ts`, `writeFile.ts`, `runCommand.ts`, `searchCode.ts`, `git.ts`.
- `CodeWriter/search/` — `ripgrep.ts` (SearchFn + node fallback), `tsIndexer.ts`
  (LanguageService def/refs), `embedding.ts` (VectorStore iface + InMemory stub +
  EmbeddingIndex + hashEmbed).

Verification state: `npm run build:codewriter` → **clean**; Stage 3 runtime
smoke-tested (embedding ranking + ripgrep/fallback search).

---

## Decisions log (append-only)

- 2026-07-12 — Reframed effort as **learning-first** (HLD+LLD deep understanding),
  code is the vehicle. Set up `.claude/codewriter/` learning hub + per-stage
  ritual + resume protocol.
- Earlier locked decisions live in `SYSTEM_CONTEXT.md → Locked decisions`.

---

## Resolved calibration (2026-07-12)

- LLD-doc depth = **block-level why**.
- LLD docs written **from Stage 3 onward**; Stages 0–2 not retro-filled (covered
  by SYSTEM_CONTEXT glossary + overview docs).
- Cadence = **one stage per checkpoint** (design → build → LLD doc → verify → pause).

## Open questions

1. Per-iteration DB checkpointing vs snapshot-at-end (revisit at Stage 8).

---

## Session handoff notes

- Flow docs in `.claude/` root: FLOW, HLD (section 1 diagram expanded),
  SAMPLE_EXECUTION_FLOW.
- Build pauses after each stage for user review (learning checkpoints).
