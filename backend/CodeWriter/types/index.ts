/**
 * CodeWriter shared contracts.
 *
 * Pure types only — no logic, no imports of implementation. This is the inward
 * core every other layer depends on. Interfaces for Session and ToolRegistry
 * live here (not in their implementing modules) so that inner layers — tools,
 * the runner — depend on abstractions, not concretions (dependency inversion).
 */

// ─── JSON Schema (subset used to describe tool arguments to the LLM) ──────────
// Deliberately minimal: enough for the hand-rolled registry validator and for
// serialization into each provider's tool-definition shape. Not a full JSON
// Schema implementation.
export type JSONSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object';

export interface JSONSchemaProp {
  type: JSONSchemaType;
  description?: string;
  enum?: ReadonlyArray<string | number>;
  items?: JSONSchemaProp; // for type: 'array'
  properties?: Record<string, JSONSchemaProp>; // for type: 'object'
  default?: unknown;
}

export interface JSONSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProp>;
  required?: string[];
}

// ─── Messages (provider-agnostic conversation format) ────────────────────────
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  role: MessageRole;
  /** Free-text content. Empty string is valid for an assistant turn that only calls tools. */
  content: string;
  /** Present on assistant turns that request tool execution. */
  toolCalls?: ToolCall[];
  /** Present on `tool` role turns — links this result back to the assistant's ToolCall. */
  toolCallId?: string;
  /** Optional tool name on `tool` role turns (some providers require it). */
  name?: string;
}

export interface ToolCall {
  /** Provider-issued id; echoed back on the matching tool-result message. */
  id: string;
  name: string;
  args: Record<string, unknown>;
}

// ─── LLM response ────────────────────────────────────────────────────────────
export type StopReason = 'end' | 'tool_use' | 'length' | 'error';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
  usage: TokenUsage;
  stopReason: StopReason;
}

// ─── Tools ───────────────────────────────────────────────────────────────────
export interface ToolResult {
  ok: boolean;
  /** Text fed back to the LLM as the tool-result message content. */
  output: string;
  /** Optional structured payload for callers/tests; never sent verbatim to the LLM. */
  data?: unknown;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  schema: JSONSchema;
  /** true = no side effects (safe to run in parallel). false = mutates fs/git (run serially). */
  readonly: boolean;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

/** LLM-facing tool descriptor produced by the registry. */
export interface ToolSchema {
  name: string;
  description: string;
  schema: JSONSchema;
}

/**
 * Everything a tool is allowed to touch. Tools reach the filesystem/git only
 * through their own execute() using repoRoot; nothing else in the system does.
 */
export interface ToolContext {
  repoRoot: string;
  signal: AbortSignal;
  session: Session;
  registry: ToolRegistry;
}

export interface ToolRegistry {
  register(tool: Tool): void;
  has(name: string): boolean;
  /** Schemas advertised to the LLM. */
  schemas(): ToolSchema[];
  /** Validates args against the tool's schema before executing; rejects on mismatch. */
  execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult>;
  /** Whether a named tool is read-only — the runner uses this to parallelize. */
  isReadonly(name: string): boolean;
}

// ─── Session ─────────────────────────────────────────────────────────────────
export interface FileEdit {
  path: string;
  diff: string;
  timestamp: number;
}

export interface SessionSnapshot {
  id: string;
  messages: Message[];
  fileEdits: Record<string, FileEdit>;
  usage: TokenUsage;
  steps: TaskStep[];
}

/**
 * Live conversation + effect state for one task run. fileEdits is kept as a map
 * separate from messages so it survives history compaction — the record of what
 * was changed must never be dropped even when stale tool outputs are summarized.
 */
export interface Session {
  readonly id: string;
  messages: Message[];
  readonly fileEdits: Readonly<Record<string, FileEdit>>;
  readonly usage: Readonly<TokenUsage>;
  readonly steps: ReadonlyArray<TaskStep>;
  addMessage(message: Message): void;
  recordEdit(path: string, diff: string): void;
  recordStep(step: TaskStep): void;
  addUsage(usage: TokenUsage): void;
  snapshot(): SessionSnapshot;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────
export type TaskStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type TaskStepType =
  | 'plan'
  | 'compact'
  | 'llm'
  | 'tool'
  | 'test'
  | 'commit';

export interface TaskStep {
  index: number;
  type: TaskStepType;
  summary: string;
  toolName?: string;
  toolCall?: ToolCall;
  result?: ToolResult;
  timestamp: number;
}

export interface Task {
  id: string;
  prompt: string;
  repoPath: string;
  model?: string;
  status: TaskStatus;
  steps: TaskStep[];
  error?: string;
  commitSha?: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Repository context ──────────────────────────────────────────────────────
export interface FileNode {
  path: string; // relative to repo root
  type: 'file' | 'dir';
  size?: number;
  children?: FileNode[];
}

export interface StackInfo {
  language: string;
  packageManager?: string;
  /** Command the workflow runs to verify changes (e.g. "npm test"). */
  testCmd?: string;
  frameworks: string[];
  hasTypeScript: boolean;
}

export interface RepoContext {
  root: string;
  tree: FileNode[];
  stack: StackInfo;
  fileCount: number;
}
