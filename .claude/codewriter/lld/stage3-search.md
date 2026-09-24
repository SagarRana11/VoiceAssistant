# Stage 3 — `search/` · LLD Deep Dive

Block-level "why" for the three search modalities. Read alongside the code in
`backend/CodeWriter/search/`.

---

## HLD role recap

`search/` = the agent's **eyes** for finding code. Three complementary modalities:

| File | Modality | Answers | Cost |
|------|----------|---------|------|
| `ripgrep.ts` | lexical (text/regex) | "where does this string/pattern appear?" | cheap, fast |
| `tsIndexer.ts` | semantic (types) | "where is this symbol defined / used?" | medium (builds a Program) |
| `embedding.ts` | vector (meaning) | "what code is *about* this idea?" | needs embeddings |

Stage 2's `searchCode` tool holds a `SearchFn` slot; `ripgrep.ts` fills it. The
other two are capabilities the runner/tools can adopt later. **Dependency
direction:** `search/` sits above `tools/`, so it may import `tools/exec` and the
`SearchFn`/`SearchMatch` types from `tools/searchCode` (never the reverse).

---

## `ripgrep.ts` — lexical search with a fallback

### Why a fallback at all
`rg` is not guaranteed to exist as a spawnable binary (in this environment it's a
shell function shim). A search capability that hard-depends on an external binary
is fragile. So: **try rg, detect its absence, degrade to pure Node.**

### The dispatch block (`ripgrepSearch`)
```
try  runRipgrep(q, ctx)
catch err:
    if err.code === 'ENOENT'  → nodeWalkSearch(q, ctx)   // rg not installed
    else                      → rethrow                   // a real failure
```
- `ENOENT` is the specific signal "executable not found" — only *that* triggers
  the fallback. Any other error (e.g. a genuine crash) propagates, so we don't
  silently mask real bugs.

### The rg path (`runRipgrep`)
- **`--json`** makes rg emit one JSON object per line — structured, robust to
  filenames with colons/spaces (parsing plain rg output is error-prone).
- **`--fixed-strings` unless `regex`** — default to literal matching (what a user
  usually means); opt into regex explicitly. Matches the tool's `regex` flag.
- **Exit-code nuance:** rg returns **1 for "no matches"** — that's success, not
  an error. Only `code > 1` *with* stderr is a real failure. Getting this wrong
  would turn every empty search into a thrown error.
- **Parse loop:** JSON-parse each line, keep only `type === 'match'`, pull
  `path.text`, `line_number`, first submatch `start` (→ 1-indexed column),
  `lines.text` (strip trailing `\n`). Stop at `maxResults`.
- **`RgEvent` interface** models only the fields we consume — not rg's full
  schema. Enough to stay typed without over-modelling a vendor format.

### The fallback path (`nodeWalkSearch`)
- Recursive `fs.readdirSync(..., {withFileTypes:true})` walk.
- **`SKIP_DIRS`** (`.git`, `node_modules`, `dist`, …) — never descend; these are
  huge and irrelevant, and would dwarf real results.
- **`TEXT_EXT`** allowlist — only read plausible source/text files; avoids
  slurping binaries.
- **`ctx.signal.aborted` checked** at each dir and result cap — cooperative
  cancellation, so a cancelled task's search stops promptly.
- **`buildMatcher`** returns a closure: regex `.exec().index` or `indexOf`. One
  matcher built once, applied per line — keeps the hot loop tight.
- Same `SearchMatch` shape as the rg path → **callers can't tell which ran.** The
  fallback is a true drop-in.

---

## `tsIndexer.ts` — semantic definitions/references

### Why the LanguageService (not the compiler directly)
`ts.createLanguageService` gives incremental, position-based queries
(`getDefinitionAtPosition`, `getReferencesAtPosition`) — exactly go-to-def and
find-refs — without us re-implementing symbol resolution. It also caches across
queries via a `DocumentRegistry`.

### The host (`LanguageServiceHost`)
The service is I/O-agnostic; we supply a host that reads from `fs`:
- **`getScriptFileNames`** → the project's files (root set).
- **`getScriptVersion`** → a number per file from a `versions` map. **This is the
  incrementality key:** when the agent edits a file, `markChanged()` bumps its
  version, and the service knows to re-read it on the next query. Without version
  bumps, stale ASTs would be served after edits.
- **`getScriptSnapshot`** → current file text (or `undefined` if gone).
- lib/settings/fs predicates delegate to `ts.sys` and the parsed options.

### Project discovery (`loadTsConfig`)
- `ts.findConfigFile` → nearest `tsconfig.json`; `parseJsonConfigFileContent`
  expands it to concrete `fileNames` + `options` (respecting `include`/`exclude`).
- **No tsconfig?** fall back to walking all `.ts/.tsx` with sane defaults
  (`ES2020`/`CommonJS`/`allowJs`). The indexer never hard-fails on config shape.

### Query plumbing (`query`)
One private method both public lookups share:
1. Resolve `relFile` → absolute; get the `Program` and `SourceFile`.
2. **Guard rails:** no program / file not in program / bad position → return `[]`,
   never throw. Position errors are expected (LLM may pass a stale line), so
   they're data, not exceptions — consistent with the "errors as data" principle.
3. `safeOffset` converts 1-indexed `(line,col)` → the absolute offset TS wants,
   wrapped in try/catch for out-of-range.
4. `lookup` runs the actual TS call; `spanToLocation` maps each result
   `TextSpan` back to `path:line:col` + the trimmed source line.
- **`findReferences` normalizes** `ReferenceEntry[]` to the same
  `{fileName, textSpan}` shape `findDefinition` uses, so `query` handles both.

---

## `embedding.ts` — vector (meaning-based) search

### Why interfaces + a stub
Spec: "stub the vector store behind an interface for now." So the *pipeline*
(chunk → embed → query) is real, but the two vendor-heavy pieces are swappable:
- **`VectorStore`** interface (`add`/`query`/`clear`) — `InMemoryVectorStore`
  today (array + cosine); a real DB later, pipeline unchanged.
- **`EmbedFn`** injected — vendor (OpenAI/Cohere) lives at the edge; a keyless
  default (`hashEmbed`) keeps everything runnable offline.

### Chunking (`chunkFile`)
- **Sliding window** of `windowLines` with `overlapLines` overlap →
  `step = window - overlap`. Overlap means a symbol near a chunk boundary still
  appears whole in one chunk (no context lost at seams).
- Each chunk keeps its **line range** (`startLine`/`endLine`) so a hit points back
  to an exact location, not just a file.
- Verified: window 40 / overlap 8 over 100 lines → `1-40, 33-72, 65-100` (step 32).

### The index (`EmbeddingIndex`)
- **`indexFiles`** chunks everything, then embeds **all chunks in one batch**
  (`this.embed(chunks.map(text))`) — one round-trip instead of N; cheaper against
  a real API. Records get a stable `id` of `path:start-end`.
- **`search`** embeds the query once, delegates ranking to the store.

### The default embedder (`hashEmbed`)
- FNV-1a hash each token → bucket in a fixed `HASH_DIM` vector (bag-of-tokens),
  then **L2-normalize**. Deterministic and dependency-free.
- **Honest caveat (in code comment):** not semantically meaningful — it's a test
  harness stand-in, not a real model. Its job is to make the pipeline exercisable.
- Because vectors are pre-normalized, **`cosine` is just a dot product** — the
  normalization is done once at embed time, not per comparison.

---

## Verification performed

- `npm run build:codewriter` → clean (after one narrowing fix: guard
  `getProgram()` possibly `undefined`).
- Runtime smoke: embedding indexed 2 files, ranked the `login` chunk top for
  "login validation email"; chunk windows correct.
- Runtime smoke: `ripgrepSearch` found 5 `safeResolve` hits with `path:line:col`
  (via rg or the fallback — indistinguishable to the caller, as designed).

## Key takeaways (the reusable lessons)

1. **Degrade, don't depend** — external binaries get a pure-language fallback with
   an identical return shape.
2. **Errors as data** — invalid positions / no matches return `[]`, never throw.
3. **Inject the vendor, keep the pipeline** — `EmbedFn` + `VectorStore` are seams;
   the chunk→embed→query flow is stable.
4. **Model only what you consume** — `RgEvent` types just the fields used.
5. **Incrementality needs versions** — the LanguageService re-reads a file only
   when its version bumps; edits must call `markChanged`.
