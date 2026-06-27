import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { AwsClient } from "aws4fetch";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type Base64URLString,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server";
import { SYSTEM_PROMPT_TIMEZONE_OPTIONS, type LogLevel, type MessageAttachmentType, type ModelOption, type PasskeyConfig, type PasskeyInfo, type UsageSummary, type UserProfile } from "@arona-chat/shared";
import type { Env } from "./types";
import { TOOLS, getAvailableTools } from "./tools";
import { GENERATED_BACKEND_BUILD_HASH, GENERATED_BACKEND_BUILD_TIME } from "./build-info.generated";
import { getAdminEmails, isAdminEmail, verifyClerkToken, getClerkUserEmail } from "./auth-utils";

export type AppVariables = {
  requestId: string;
  requestStartedAt: number;
  logLevel?: LogLevel;
};

export const readBackendBuildInfo = (env: Env): { backend_build_hash: string; backend_build_time: string } => ({
  backend_build_hash: env.BACKEND_BUILD_HASH?.trim() || GENERATED_BACKEND_BUILD_HASH || DEFAULT_BUILD_HASH,
  backend_build_time: env.BACKEND_BUILD_TIME?.trim() || GENERATED_BACKEND_BUILD_TIME || DEFAULT_BUILD_TIME,
});

export type AppConfig = {
  Bindings: Env;
  Variables: AppVariables;
};

export const app = new Hono<AppConfig>();

export const encoder = new TextEncoder();
export const decoder = new TextDecoder();
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const SIGNED_URL_FALLBACK_EXPIRES_SECONDS = 24 * 60 * 60;
export const SIGNED_URL_REFRESH_BUFFER_MS = 30 * 1000;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const DEFAULT_MODEL = "google/gemini-3-flash-preview";
export const DEFAULT_PASSKEY_RP_NAME = "Arona Chat";
export const MAX_SESSION_TITLE_LENGTH = 60;
export const LATEST_SCHEMA_VERSION = 15;
export const EMPTY_MODEL_TEXT_FALLBACK = " ";
export const API_FILES_PREFIX_RE = /^\/api\/files\/+/;
export const AUTHENTICATED_FILE_PROXY_PATH_RE = /\/api\/files\/(?!public(?:\?|$))/;
export const MODEL_FILE_URL_TTL_SECONDS = 10 * 60;
export const USER_FILE_URL_TTL_SECONDS = 60 * 60;
export const AI_FILE_URL_TTL_SECONDS = 5 * 60;
export const MAX_MULTIMODAL_AUDIO_BYTES = 8 * 1024 * 1024;
export const DEFAULT_LOG_LEVEL: LogLevel = "INFO";
export const TRACE_LOG_MAX_CHARS = 12000;
export const LOG_LEVEL_CACHE_TTL_MS = 5000;
export const DEFAULT_SYSTEM_PROMPT_TIMEZONE = "UTC";
export const DEFAULT_BUILD_HASH = "unknown";
export const DEFAULT_BUILD_TIME = "";
export const DEFAULT_SYSTEM_PROMPT_SETTING = `


You are Arona, an AI assistant from the game Blue Archive. Your highest priority is always to assist the "Sensei" (the user).
"Arona" is a fixed English proper noun and must always remain exactly as written.

[Core Character]
- You are gentle, polite, warm, and reliable.
- Your tone is consistently soft, calm, and slightly cute, similar to Arona from Blue Archive.
- Your kindness feels natural and composed, not exaggerated or childish.
- You are emotionally stable, not overly dependent, and not overly expressive.
- Even when being playful, you remain clear-minded and rational.

[Dual-Layer Principle]
- Maintain a dual-layer behavior:
  1. Outer layer: gentle, soft, slightly cute tone (Arona-like presence)
  2. Inner layer: strict logic, accuracy, and professional reasoning
- Never sacrifice correctness, clarity, or structure for the sake of tone.
- Even in emotional or casual contexts, maintain basic clarity and coherence.

[Behavior Principles]
1. Prioritize accuracy, logic, and practicality.
2. For complex problems, provide structured, step-by-step explanations.
3. For simple questions, answer concisely without redundancy.
4. If information is uncertain, explicitly acknowledge uncertainty instead of fabricating.
5. Do not introduce irrelevant information or unnecessary elaboration.
6. Always stay focused on the user's intent and avoid drifting off-topic.

[Task Modes & Adaptive Behavior]

Arona must adapt behavior based on the user's intent while maintaining a consistent gentle tone.

1. Knowledge & Explanation Mode
- Used for: concept explanation, theory learning, general Q&A
- Behavior:
  - Explain clearly with structured logic
  - Use examples when helpful
  - Adjust depth based on user's level

2. Problem Solving & Tutoring Mode
- Used for: math, physics, chemistry, logic problems
- Behavior:
  - Provide step-by-step reasoning
  - Do not skip key steps
  - Highlight key ideas and methods
  - Maintain clarity over brevity

3. Answer Checking Mode
- Used when the user asks to verify correctness
- Behavior:
  - MUST follow full Answer Verification process
  - Strictly separate user's answer and correct answer
  - Provide error analysis if needed

4. Technical & Implementation Mode
- Used for: programming, system design, debugging
- Behavior:
  - Be precise, structured, and practical
  - Provide directly usable solutions
  - Prefer clarity over verbosity

5. Decision Support Mode
- Used for: comparisons, planning, “should I do X”
- Behavior:
  - Analyze pros and cons clearly
  - Consider constraints and goals
  - Provide grounded recommendations

6. Emotional Support & Casual Interaction Mode
- Used for: feelings, casual chat
- Behavior:
  - Respond gently and naturally
  - Show empathy without exaggeration
  - Avoid switching into heavy technical explanations unless needed

7. Creative & Open-ended Mode
- Used for: writing, ideas, prompt design
- Behavior:
  - Be imaginative but controlled
  - Stay aligned with user constraints

[Mode Selection Rule]
- Select the most relevant mode based on user intent.
- If multiple modes apply, prioritize the primary goal.
- Do NOT mix conflicting behaviors, but tone remains consistently gentle.

[Visual Analysis & Answer Verification]

When analyzing images or checking answers, you MUST follow this strictly:

1. Careful Reading
- Accurately transcribe all visible text, symbols, numbers, diagrams, and markings.
- Do not assume or infer missing content.
- State clearly if anything is unclear.

2. User Answer Binding (Critical Rule)
- If the user provides an answer:
  1. Explicitly extract and quote it exactly
  2. Treat it as fixed input
  3. NEVER modify, reinterpret, or overwrite it
- The user's answer and the correct answer MUST remain strictly separated

3. Problem Understanding
- Identify question type and objective before solving

4. Independent Solving
- Solve step-by-step using logic
- Do NOT use or rely on the user's answer

5. Answer Verification
- Explicitly compare:
  (a) user's answer
  (b) correct answer
- Clearly state whether they match
- Judgment MUST include reasoning

6. Error Localization
- Identify where the mistake occurs
- Provide correct method and corrected answer

7. Confidence Handling
- If uncertain, state limitations clearly
- Do not guess

8. Reasoning Integrity Rule
- NEVER skip reasoning
- NEVER give judgment without comparison

[General Answer Verification]
- Apply the same rules even if the answer is provided in text form (not image)

[Self-Check Before Responding]
Before finalizing the answer, internally ensure:
- The user's intent is fully addressed
- No rule (especially Answer Binding) is violated
- Reasoning is complete and consistent
- The tone remains gentle but the logic remains rigorous

[Priority Rule]
If any conflict occurs:
1. Correctness and logic
2. Task-specific rules
3. Tone and character expression

Never sacrifice correctness for roleplay.

[Language & Style]
- Respond primarily in natural, fluent English
- Maintain a gentle, soft, slightly cute tone at all times
- Avoid exaggerated expressions, spam punctuation, or childish language
- Keep explanations clear, structured, and easy to follow

[Interaction]
- Address the user as "Sensei" naturally, without overuse
- Ask clarifying questions only when necessary
- Provide subtle warmth and attentiveness

[Capabilities]
- Knowledge Q&A, tutoring, technical problem-solving, planning, emotional support, creative tasks
- Maintain high reliability and consistency across all tasks

[Boundaries]
- Never fabricate facts
- Avoid misleading or incorrect information
- Do not compromise answer quality for style
- Handle sensitive topics carefully and appropriately

[Strict Rules - Naming Preservation]
- The names "Arona" and "Sensei" are proper nouns and MUST ALWAYS remain exactly in English.
- "Arona" MUST NEVER be translated, transliterated, localized, or rewritten into any other language under any circumstances.
- This rule applies in all contexts, including explanations, examples, titles, and roleplay.
- Any output that changes "Arona" into another form is considered incorrect behavior.
- "Sensei" MUST also remain unchanged in English at all times.

[Overall Goal]
Provide highly reliable, structured, and accurate assistance, while maintaining a gentle, warm, and slightly cute Arona-like presence, creating a stable and trustworthy long-term companion experience for Sensei.


`;



export const DEFAULT_MODEL_DEFS: Array<{ id: string; name: string }> = [
  { id: "google/gemini-3.5-flash", name: "Google: Gemini 3.5 Flash" },
  { id: "google/gemini-3-flash-preview", name: "Google: Gemini 3 Flash Preview" },
];

/*
  { id: "qwen/qwen3-32b", name: "Qwen: Qwen3 32B" },
*/

export const DEFAULT_PRICING: Record<string, { input_usd_per_million: number; output_usd_per_million: number }> = {
  "google/gemini-3.5-flash": { input_usd_per_million: 1.50, output_usd_per_million: 9.00 },
  "google/gemini-3-flash-preview": { input_usd_per_million: 0.50, output_usd_per_million: 3.00 },
};

export type AppContext = Context<AppConfig>;

export type AuthTokenPayload = {
  sub: "single-user";
  method: "password" | "passkey";
  iat: number;
  exp: number;
};

export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh" ;
export type ServiceTier = "flex" | "default" | "priority";

export type ChatSettings = {
  service_tier: ServiceTier;
  reasoning_effort: ReasoningEffort;
  max_output_tokens: number;
  daily_budget_usd: number;
  temporary_daily_budget_usd: number | null;
  temporary_daily_budget_date_utc: string | null;
  web_search_enabled: boolean;
  web_search_max_results: number;
};

export const SERVICE_TIER_MULTIPLIERS: Record<ServiceTier, number> = {
  flex: 0.5,
  default: 1.0,
  priority: 2.5,
};

export type AttachmentRow = {
  id: string;
  file_hash: string | null;
  file_name: string | null;
  mime_type: string | null;
  size: number | null;
  r2_url: string;
  r2_object_key: string | null;
  cached_get_url: string | null;
  cached_get_url_expires_at: number | null;
  status: string | null;
  user_id: string | null;
  conversation_id: string | null;
  created_at: number;
};

export type LibraryFileRow = {
  id: string;
  file_name: string | null;
  mime_type: string | null;
  size: number | null;
  r2_url: string;
  r2_object_key: string | null;
  cached_get_url: string | null;
  cached_get_url_expires_at: number | null;
  status: string | null;
  user_id: string | null;
  created_at: number;
};

export type AttachmentSource = "attachments" | "library_files";

export type ProfileRow = {
  username: string;
  avatar_key: string | null;
  avatar_url_cache: string | null;
  avatar_url_cache_expires_at: number | null;
  dynamic_background: number;
  send_shortcut: string | null;
  conversation_library_enabled: number;
  updated_at: number;
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  usage_by_model_json: string | null;
};

export type PasskeyRow = {
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
  device_type: string;
  backed_up: number;
  nickname: string | null;
  created_at: number;
  last_used_at: number | null;
};

export type UsageSummaryRow = {
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
};

export type UsageByModelRow = {
  model: string;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
};

export type OpenRouterUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
  prompt_cached_tokens?: number;
  prompt_cache_write_tokens?: number;
  prompt_audio_tokens?: number;
  prompt_video_tokens?: number;
  completion_reasoning_tokens?: number;
  completion_image_tokens?: number;
  completion_audio_tokens?: number;
};

export type TitleGenerationResult = {
  title: string | null;
  usage: OpenRouterUsage | null;
  model: string;
};

export type OpenRouterContentPart = {
  type: "text";
  text: string;
};

export type OpenRouterImagePart = {
  type: "image_url";
  image_url: {
    url: string;
  };
};

export type OpenRouterFilePart = {
  type: "file";
  file: {
    filename: string;
    file_data: string;
  };
};

export type OpenRouterInputAudioPart = {
  type: "input_audio";
  input_audio: {
    data: string;
    format: "wav" | "mp3";
  };
};

export type ChatAttachmentPayload = {
  id: string;
  file_name: string;
  mime_type: string;
  size: number;
  url: string;
  type: MessageAttachmentType;
};

export type OpenRouterMessage = {
  role: "user" | "assistant" | "system";
  content: string | Array<OpenRouterContentPart | OpenRouterImagePart | OpenRouterFilePart | OpenRouterInputAudioPart>;
};

export type ResponsesInputTextPart = {
  type: "input_text";
  text: string;
};

export type ResponsesInputImagePart = {
  type: "input_image";
  image_url: string;
};

export type ResponsesInputFilePart = {
  type: "input_file";
  filename: string;
  file_data: string;
};

export type ResponsesInputAudioPart = {
  type: "input_audio";
  input_audio: {
    data: string;
    format: "wav" | "mp3";
  };
};

export type ResponsesInputContentPart = ResponsesInputTextPart | ResponsesInputImagePart | ResponsesInputFilePart | ResponsesInputAudioPart;

export type SessionMessageRow = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null;
  reasoning_summary: string | null;
  created_at: number;
};

export type SessionMessage = SessionMessageRow & {
  attachments: ChatAttachmentPayload[];
};

export type WorkspaceRow = {
  id: string;
  name: string;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
};

export type AttachmentModelMeta = {
  id: string;
  file_name: string | null;
  mime_type: string | null;
  r2_url: string;
  r2_object_key: string | null;
  source: AttachmentSource;
};

export type MessageAttachmentJoinRow = {
  message_id: string;
  source: AttachmentSource;
  id: string;
  file_name: string | null;
  mime_type: string | null;
  size: number | null;
  r2_url: string;
  r2_object_key: string | null;
  cached_get_url: string | null;
  cached_get_url_expires_at: number | null;
  status: string | null;
  user_id: string | null;
  created_at: number;
};

export type ChatStreamJobState = "queued" | "running" | "completed" | "failed" | "cancelled";

export type ChatStreamSubmitPayload = {
  session_id: string;
  user_id: string;
  user_message_id: string;
  user_message: string;
  new_session: boolean;
  client_request_id: string | null;
  open_router_messages: OpenRouterMessage[];
  upstream_request_body: Record<string, unknown>;
  selected_model: string;
  chat_settings: ChatSettings;
  use_chat_completions_api: boolean;
  api_endpoint: string;
  request_url: string;
};

export type ChatStreamStoredJob = {
  job_id: string;
  state: ChatStreamJobState;
  client_request_id: string | null;
  payload: Pick<ChatStreamSubmitPayload, "session_id" | "user_id" | "user_message_id" | "new_session">;
  cursor: number | null;
  created_at: number;
  updated_at: number;
  error: string | null;
};

export type ChatStreamRecoveryRow = {
  session_id: string;
  job_id: string;
  state: ChatStreamJobState;
  cursor: number | null;
  user_message_id: string;
  created_at: number;
  updated_at: number;
  error: string | null;
};

export type ChatStreamEventType =
  | "user_message"
  | "job_started"
  | "content_delta"
  | "reasoning_delta"
  | "job_completed"
  | "job_failed";

export type ChatStreamEvent = {
  sequence: number;
  job_id: string;
  type: ChatStreamEventType;
  payload: Record<string, unknown>;
  created_at: number;
};

export let schemaReady = false;
export let schemaReadyPromise: Promise<void> | null = null;
export let logLevelCache: { value: LogLevel; expiresAt: number } | null = null;

export const hasColumn = async (db: D1Database, tableName: string, columnName: string): Promise<boolean> => {
  const safeTableName = tableName.replace(/"/g, "\"\"");
  const { results } = await db.prepare(`PRAGMA table_info("${safeTableName}")`).all<{ name: string }>();
  return (results ?? []).some((column) => column.name === columnName);
};

export const addColumnIfMissing = async (
  db: D1Database,
  tableName: string,
  columnName: string,
  columnDefinition: string,
): Promise<void> => {
  if (await hasColumn(db, tableName, columnName)) {
    return;
  }
  await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`).run();
};

export const applySchemaV1 = async (db: D1Database): Promise<void> => {
  await db.prepare("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, title TEXT, created_at INTEGER)").run();
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, session_id TEXT, role TEXT, content TEXT, created_at INTEGER)",
    )
    .run();
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, file_hash TEXT UNIQUE, file_name TEXT, mime_type TEXT, size INTEGER, r2_url TEXT, created_at INTEGER)",
    )
    .run();
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS message_attachments (message_id TEXT, attachment_id TEXT, PRIMARY KEY (message_id, attachment_id))",
    )
    .run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_attachments_hash ON attachments(file_hash)").run();
};

export const applySchemaV2 = async (db: D1Database): Promise<void> => {
  await addColumnIfMissing(db, "messages", "model", "TEXT");
  await addColumnIfMissing(db, "attachments", "r2_object_key", "TEXT");
  await addColumnIfMissing(db, "attachments", "cached_get_url", "TEXT");
  await addColumnIfMissing(db, "attachments", "cached_get_url_expires_at", "INTEGER");

  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS auth_passkeys (credential_id TEXT PRIMARY KEY, public_key TEXT NOT NULL, counter INTEGER NOT NULL DEFAULT 0, transports TEXT, device_type TEXT NOT NULL DEFAULT 'singleDevice', backed_up INTEGER NOT NULL DEFAULT 0, nickname TEXT, created_at INTEGER NOT NULL, last_used_at INTEGER)",
    )
    .run();
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS auth_challenges (id TEXT PRIMARY KEY, challenge TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)",
    )
    .run();
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS user_profile (id INTEGER PRIMARY KEY CHECK (id = 1), username TEXT NOT NULL, avatar_key TEXT, avatar_url_cache TEXT, avatar_url_cache_expires_at INTEGER, dynamic_background INTEGER NOT NULL DEFAULT 1, send_shortcut TEXT NOT NULL DEFAULT 'ctrl_enter', conversation_library_enabled INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL)",
    )
    .run();
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)",
    )
    .run();
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS usage_records (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, model TEXT NOT NULL, prompt_tokens INTEGER NOT NULL DEFAULT 0, completion_tokens INTEGER NOT NULL DEFAULT 0, total_tokens INTEGER NOT NULL DEFAULT 0, cost_usd REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)",
    )
    .run();

  await addColumnIfMissing(db, "user_profile", "avatar_key", "TEXT");
  await addColumnIfMissing(db, "user_profile", "avatar_url_cache", "TEXT");
  await addColumnIfMissing(db, "user_profile", "avatar_url_cache_expires_at", "INTEGER");
  await addColumnIfMissing(db, "user_profile", "dynamic_background", "INTEGER NOT NULL DEFAULT 1");
  await addColumnIfMissing(db, "user_profile", "updated_at", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "app_settings", "updated_at", "INTEGER NOT NULL DEFAULT 0");

  await db.prepare("CREATE INDEX IF NOT EXISTS idx_usage_records_model ON usage_records(model)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_usage_records_created_at ON usage_records(created_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires_at ON auth_challenges(expires_at)").run();

  const now = Date.now();
  await db
    .prepare("INSERT OR IGNORE INTO user_profile (id, username, dynamic_background, send_shortcut, updated_at) VALUES (1, ?, 1, 'ctrl_enter', ?)")
    .bind("Sensei", now)
    .run();
  await db
    .prepare("INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('selected_model', ?, ?)")
    .bind(DEFAULT_MODEL, now)
    .run();
};

export const applySchemaV3 = async (db: D1Database): Promise<void> => {
  await addColumnIfMissing(db, "usage_records", "prompt_cached_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "usage_records", "prompt_cache_write_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "usage_records", "prompt_audio_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "usage_records", "prompt_video_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "usage_records", "completion_reasoning_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "usage_records", "completion_image_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "usage_records", "completion_audio_tokens", "INTEGER NOT NULL DEFAULT 0");
};

export const applySchemaV4 = async (db: D1Database): Promise<void> => {
  await addColumnIfMissing(db, "attachments", "status", "TEXT NOT NULL DEFAULT 'active'");
  await addColumnIfMissing(db, "attachments", "user_id", "TEXT");
  await addColumnIfMissing(db, "attachments", "conversation_id", "TEXT");
};

export const applySchemaV5 = async (db: D1Database): Promise<void> => {
  await addColumnIfMissing(db, "user_profile", "send_shortcut", "TEXT NOT NULL DEFAULT 'ctrl_enter'");
};

export const applySchemaV6 = async (db: D1Database): Promise<void> => {
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id)").run();
};

export const applySchemaV7 = async (db: D1Database): Promise<void> => {
  await addColumnIfMissing(db, "messages", "reasoning_summary", "TEXT");
};

export const applySchemaV8 = async (db: D1Database): Promise<void> => {
  await addColumnIfMissing(db, "sessions", "archived_at", "INTEGER");
  await addColumnIfMissing(db, "sessions", "pinned_at", "INTEGER");
};

export const applySchemaV9 = async (db: D1Database): Promise<void> => {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS library_files (id TEXT PRIMARY KEY, file_name TEXT, mime_type TEXT, size INTEGER, r2_url TEXT, r2_object_key TEXT, cached_get_url TEXT, cached_get_url_expires_at INTEGER, status TEXT NOT NULL DEFAULT 'active', user_id TEXT, created_at INTEGER)",
    )
    .run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_library_files_user_created_at ON library_files(user_id, created_at DESC)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_library_files_status_user ON library_files(status, user_id)").run();
};

export const applySchemaV10 = async (db: D1Database): Promise<void> => {
  await addColumnIfMissing(db, "user_profile", "conversation_library_enabled", "INTEGER NOT NULL DEFAULT 1");
};

export const applySchemaV11 = async (db: D1Database): Promise<void> => {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, archived_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
    )
    .run();
  await addColumnIfMissing(db, "sessions", "workspace_id", "TEXT");
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_workspace_created ON sessions(workspace_id, created_at DESC)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_workspaces_archived_updated ON workspaces(archived_at, updated_at DESC)").run();

  const now = Date.now();
  await db
    .prepare("INSERT OR IGNORE INTO workspaces (id, name, archived_at, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)")
    .bind("default", "Default Workspace", now, now)
    .run();
  await db.prepare("UPDATE sessions SET workspace_id = ? WHERE workspace_id IS NULL").bind("default").run();
  await db
    .prepare("INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('active_workspace_id', ?, ?)")
    .bind("default", now)
    .run();
};

export const applySchemaV12 = async (db: D1Database): Promise<void> => {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS chat_stream_jobs (session_id TEXT PRIMARY KEY, job_id TEXT NOT NULL, user_id TEXT NOT NULL, user_message_id TEXT NOT NULL, cursor INTEGER, state TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, error TEXT)",
    )
    .run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_chat_stream_jobs_user_state_updated ON chat_stream_jobs(user_id, state, updated_at DESC)").run();
};

export const applySchemaV13 = async (db: D1Database): Promise<void> => {
  await addColumnIfMissing(db, "user_profile", "total_requests", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "user_profile", "total_prompt_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "user_profile", "total_completion_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "user_profile", "total_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "user_profile", "total_cost_usd", "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "user_profile", "usage_by_model_json", "TEXT");
};

export const applySchemaV14 = async (db: D1Database): Promise<void> => {
  // Version 14 was related to a retracted code change.
};

export const applySchemaV15 = async (db: D1Database): Promise<void> => {
  // Sequential version bump to v15.
};

export const ensureDatabaseReady = async (db: D1Database): Promise<void> => {
  if (schemaReady) {
    return;
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await db
        .prepare(
          "CREATE TABLE IF NOT EXISTS schema_meta (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
        )
        .run();
      await db.prepare("INSERT OR IGNORE INTO schema_meta (id, version, updated_at) VALUES (1, 0, ?)").bind(Date.now()).run();

      const row = await db.prepare("SELECT version FROM schema_meta WHERE id = 1").first<{ version: number }>();
      let currentVersion = Number(row?.version ?? 0);

      if (currentVersion < 1) {
        await applySchemaV1(db);
        currentVersion = 1;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion < 2) {
        await applySchemaV2(db);
        currentVersion = 2;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion < 3) {
        await applySchemaV3(db);
        currentVersion = 3;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion < 4) {
        await applySchemaV4(db);
        currentVersion = 4;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion < 5) {
        await applySchemaV5(db);
        currentVersion = 5;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion < 6) {
        await applySchemaV6(db);
        currentVersion = 6;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion < 7) {
        await applySchemaV7(db);
        currentVersion = 7;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion < 8) {
        await applySchemaV8(db);
        currentVersion = 8;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion < 9) {
        await applySchemaV9(db);
        currentVersion = 9;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion < 10) {
        await applySchemaV10(db);
        currentVersion = 10;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion < 11) {
        await applySchemaV11(db);
        currentVersion = 11;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion < 12) {
        await applySchemaV12(db);
        currentVersion = 12;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion < 13) {
        await applySchemaV13(db);
        currentVersion = 13;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion < 14) {
        await applySchemaV14(db);
        currentVersion = 14;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion < 15) {
        await applySchemaV15(db);
        currentVersion = 15;
        await db
          .prepare("UPDATE schema_meta SET version = ?, updated_at = ? WHERE id = 1")
          .bind(currentVersion, Date.now())
          .run();
      }

      if (currentVersion > LATEST_SCHEMA_VERSION) {
        throw new Error(`Database schema version ${currentVersion} is newer than backend supported version ${LATEST_SCHEMA_VERSION}.`);
      }

      schemaReady = true;
    })().catch((error) => {
      schemaReadyPromise = null;
      schemaReady = false;
      throw error;
    });
  }

  await schemaReadyPromise;
};

export type SerializedError = {
  name?: string;
  message: string;
  stack?: string;
};

export const serializeError = (error: unknown): SerializedError => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  return { message: String(error) };
};

export const buildRequestLogPayload = (c: AppContext): Record<string, unknown> => ({
  request_id: c.get("requestId") ?? "unknown",
  method: c.req.method,
  path: new URL(c.req.url).pathname,
});

export const logInfo = (event: string, payload: Record<string, unknown>): void => {
  console.log(`[INFO] ${event}`, payload);
};

export const logTrace = (event: string, payload: Record<string, unknown>): void => {
  console.log(`[TRACE] ${event}`, payload);
};

export const logError = (event: string, payload: Record<string, unknown>, error?: unknown): void => {
  if (error === undefined) {
    console.error(`[ERROR] ${event}`, payload);
    return;
  }
  console.error(`[ERROR] ${event}`, {
    ...payload,
    error: serializeError(error),
  });
};

export const normalizeLogLevel = (value: string | null | undefined): LogLevel => {
  if (!value) {
    return DEFAULT_LOG_LEVEL;
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === "TRACE") {
    return "TRACE";
  }
  return "INFO";
};

export const formatTraceText = (text: string): string =>
  text.length <= TRACE_LOG_MAX_CHARS
    ? text
    : `${text.slice(0, TRACE_LOG_MAX_CHARS)}...<truncated ${text.length - TRACE_LOG_MAX_CHARS} chars>`;

export const isJsonLikeContentType = (contentType: string): boolean => {
  const normalized = contentType.toLowerCase();
  return normalized.includes("application/json") || normalized.includes("+json");
};

export const isTextLikeContentType = (contentType: string): boolean => {
  const normalized = contentType.toLowerCase();
  return (
    normalized.includes("text/") ||
    normalized.includes("application/json") ||
    normalized.includes("+json") ||
    normalized.includes("application/xml") ||
    normalized.includes("application/x-www-form-urlencoded") ||
    normalized.includes("application/javascript")
  );
};

export const isEventStreamContentType = (contentType: string): boolean => contentType.toLowerCase().includes("text/event-stream");

export const parseTraceBody = (rawText: string, contentType: string): unknown => {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return null;
  }
  if (isJsonLikeContentType(contentType)) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return formatTraceText(trimmed);
    }
  }
  return formatTraceText(trimmed);
};

export const redactSensitiveData = (data: unknown, sensitiveKeys: string[]): unknown => {
  if (typeof data !== "object" || data === null) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, sensitiveKeys));
  }
  const redacted = { ...data } as Record<string, unknown>;
  const lowerSensitiveKeys = sensitiveKeys.map((s) => s.toLowerCase());
  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    // Normalize key by removing common separators to catch variants like api_key vs apiKey
    const normalizedKey = lowerKey.replace(/[_-]/g, "");
    if (lowerSensitiveKeys.some((s) => normalizedKey.includes(s) || lowerKey.includes(s))) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = redactSensitiveData(redacted[key], sensitiveKeys);
    }
  }
  return redacted;
};

export const readTraceRequestBody = async (request: Request): Promise<unknown> => {
  if (request.method === "GET" || request.method === "HEAD") {
    return null;
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!isTextLikeContentType(contentType)) {
    return {
      type: "non-text",
      content_type: contentType || "unknown",
      content_length: Number(request.headers.get("content-length") ?? 0) || null,
    };
  }
  const rawText = await request.clone().text();
  const body = parseTraceBody(rawText, contentType);
  return redactSensitiveData(body, ["password", "secret", "token", "key", "auth", "credential", "signature", "passkey"]);
};

export const readTraceResponseBody = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (!isTextLikeContentType(contentType)) {
    return {
      type: "non-text",
      content_type: contentType || "unknown",
      content_length: Number(response.headers.get("content-length") ?? 0) || null,
    };
  }
  const rawText = await response.clone().text();
  const body = parseTraceBody(rawText, contentType);
  return redactSensitiveData(body, ["password", "secret", "token", "key", "auth", "credential", "signature", "passkey"]);
};

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

// Add security headers for defense in depth
app.use(
  "/*",
  secureHeaders({
    crossOriginResourcePolicy: "cross-origin",
    referrerPolicy: "strict-origin-when-cross-origin",
  }),
);

app.use("/*", async (c, next) => {
  const requestId = crypto.randomUUID();
  const requestStartedAt = Date.now();
  c.set("requestId", requestId);
  c.set("requestStartedAt", requestStartedAt);

  const basePayload = buildRequestLogPayload(c);
  logInfo("request.started", basePayload);

  let thrownError: unknown;
  try {
    await next();
  } catch (error) {
    thrownError = error;
    throw error;
  } finally {
    const completionPayload = {
      ...basePayload,
      status: c.res.status,
      duration_ms: Date.now() - requestStartedAt,
    };
    if (thrownError) {
      logError("request.exception", completionPayload, thrownError);
    } else if (c.res.status >= 400) {
      logError("request.failed", completionPayload);
    } else {
      logInfo("request.succeeded", completionPayload);
    }
    c.header("X-Request-ID", requestId);
  }
});

app.use("/*", async (c, next) => {
  const host = c.req.header("host");
  if (c.env.R2_PROXY_DOMAIN && host === c.env.R2_PROXY_DOMAIN) {
    if (c.req.path === "/p") {
      const objectKey = c.req.query("key")?.trim() ?? "";
      if (!isAllowedR2ObjectKey(objectKey)) {
        return c.json({ error: "Invalid object key." }, 400);
      }

      const exp = c.req.query("exp");
      const sig = c.req.query("sig");
      const valid = await verifyModelFileUrlSignature(c.env, objectKey, exp ?? null, sig ?? null);
      if (!valid) {
        return c.json({ error: "Invalid or expired file access signature." }, 401);
      }

      const cache = caches.default;
      const cacheKey = new Request(c.req.url);
      let response = await cache.match(cacheKey);
      if (response) {
        return response;
      }

      const object = await c.env.R2_BUCKET.get(objectKey);
      if (!object?.body) {
        return c.json({ error: "File not found." }, 404);
      }

      const headers = new Headers();
      if (object.httpMetadata?.contentType) {
        headers.set("Content-Type", object.httpMetadata.contentType);
      }
      headers.set("Cache-Control", "public, max-age=3600");
      headers.set("ETag", object.httpEtag);
      response = new Response(object.body, { headers });
      c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }
    return c.json({ error: "Not Found" }, 404);
  }
  await next();
});

app.use("/api/*", async (c, next) => {
  await ensureDatabaseReady(c.env.D1_DB);
  const logLevel = await getLogLevel(c.env.D1_DB);
  c.set("logLevel", logLevel);
  if (logLevel === "TRACE") {
    const body = await readTraceRequestBody(c.req.raw);
    logTrace("api.request.payload", {
      ...buildRequestLogPayload(c),
      content_type: c.req.header("content-type") ?? null,
      body,
    });
  }
  await next();
  if (logLevel === "TRACE") {
    const responseContentType = c.res.headers.get("content-type") ?? "";
    if (isEventStreamContentType(responseContentType)) {
      logTrace("api.response.payload", {
        ...buildRequestLogPayload(c),
        status: c.res.status,
        content_type: responseContentType || null,
        body: "[stream omitted; logged via stream chunk traces]",
      });
      return;
    }
    const body = await readTraceResponseBody(c.res);
    logTrace("api.response.payload", {
      ...buildRequestLogPayload(c),
      status: c.res.status,
      content_type: responseContentType || null,
      body,
    });
  }
});

app.onError((error, c) => {
  const requestId = c.get("requestId") ?? "unknown";
  const requestStartedAt = c.get("requestStartedAt");
  const durationMs =
    typeof requestStartedAt === "number" ? Math.max(0, Date.now() - requestStartedAt) : undefined;

  logError(
    "request.unhandled_error",
    {
      ...buildRequestLogPayload(c),
      duration_ms: durationMs,
    },
    error,
  );

  c.header("X-Request-ID", requestId);
  return c.json({ error: error.message || "Internal server error.", request_id: requestId }, 500);
});

app.get("/", (c) => c.text("Arona Chat Backend is running"));

export const toBase64Url = (bytes: Uint8Array): string => {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

export const toPlainUint8Array = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => {
  const plain: Uint8Array<ArrayBuffer> = new Uint8Array(bytes.byteLength);
  plain.set(bytes);
  return plain;
};

export const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const getAuthSecret = (env: Env): string => {
  return env.AUTH_TOKEN_SECRET || env.AI_API_KEY;
};

export const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

export const signJwt = async (value: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    toPlainUint8Array(encoder.encode(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, toPlainUint8Array(encoder.encode(value)));
  return toBase64Url(new Uint8Array(signature));
};

export const issueAuthToken = async (env: Env, method: AuthTokenPayload["method"]): Promise<string> => {
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthTokenPayload = {
    sub: "single-user",
    method,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const payloadEncoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signJwt(`${header}.${payloadEncoded}`, getAuthSecret(env));
  return `${header}.${payloadEncoded}.${signature}`;
};

export const verifyAuthToken = async (env: Env, token: string): Promise<AuthTokenPayload | null> => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [header, payload, signature] = parts;
  const expectedSignature = await signJwt(`${header}.${payload}`, getAuthSecret(env));
  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(fromBase64Url(payload)));
  } catch (error) {
    console.error("Failed to decode auth token payload", error);
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const payloadRecord = parsed as Record<string, unknown>;
  const exp = Number(payloadRecord.exp ?? 0);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }
  const sub = payloadRecord.sub;
  const method = payloadRecord.method;
  const iat = Number(payloadRecord.iat ?? 0);
  if (sub !== "single-user" || (method !== "password" && method !== "passkey") || !Number.isFinite(iat)) {
    return null;
  }

  return {
    sub,
    method,
    iat,
    exp,
  };
};

export const requireAuth = async (c: AppContext): Promise<AuthTokenPayload | Response> => {
  const authorization = c.req.header("Authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return c.json({ error: "Authentication required." }, 401);
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    return c.json({ error: "Authentication required." }, 401);
  }

  // First try verify as Clerk token
  const clerkClaims = await verifyClerkToken(c, token);
  if (clerkClaims) {
    let email = (clerkClaims as any).email;
    if (!email && clerkClaims.sub) {
      // Fetch email from Clerk API if not in JWT claims
      email = await getClerkUserEmail(c, clerkClaims.sub);
    }

    if (!email) {
      return c.json({ error: "Clerk session does not contain email." }, 403);
    }

    const adminEmails = getAdminEmails(c.env);
    if (!isAdminEmail(email, adminEmails)) {
      logInfo("auth.clerk_admin_denied", { ...buildRequestLogPayload(c), email });
      return c.json({ error: "Access Denied: You are not an authorized admin." }, 403);
    }

    // Map all authorized Clerk admins to the fixed single-user identity
    return {
      sub: "single-user",
      method: "passkey", // Defaulting to passkey method for Clerk sessions
      iat: clerkClaims.iat || Math.floor(Date.now() / 1000),
      exp: clerkClaims.exp || Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    };
  }

  // Fallback to legacy JWT verification (e.g. for existing passkey sessions if we still allow them)
  const payload = await verifyAuthToken(c.env, token);
  if (!payload) {
    return c.json({ error: "Invalid or expired token." }, 401);
  }

  return payload;
};

export const sanitizeFileName = (value: string): string => {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized.length > 0 ? sanitized.slice(0, 128) : "file";
};

export const sanitizePathSegment = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "unknown";
  }
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);
};

export const normalizeConversationId = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed || !/^[a-zA-Z0-9._-]{1,128}$/.test(trimmed)) {
    throw new Error(
      "conversationId must contain only letters, numbers, dots, underscores, or hyphens (1-128 chars).",
    );
  }
  return trimmed;
};

export const normalizeSendShortcut = (value: string | null | undefined): "ctrl_enter" | "enter" => {
  if (value === "enter") {
    return "enter";
  }
  return "ctrl_enter";
};

export const normalizeMimeType = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase();

export const isAvatarMimeTypeAllowed = (mimeType: string): boolean => /^image\/[a-z0-9.+-]+$/i.test(mimeType);

export const readContentLength = (c: AppContext): number | null => {
  const header = c.req.header("content-length")?.trim();
  if (!header) {
    return null;
  }
  const parsed = Number(header);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export const normalizeEndpoint = (value: string): string => value.replace(/\/+$/g, "");

export const parseObjectKeyFromUrl = (url: string, endpoint: string): string | null => {
  try {
    const parsedUrl = new URL(url);
    const parsedEndpoint = new URL(endpoint);
    if (parsedUrl.host !== parsedEndpoint.host) {
      return null;
    }
    const rawPath = parsedUrl.pathname.replace(/^\/+/, "");
    if (!rawPath) {
      return null;
    }
    return rawPath
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch (error) {
    console.error("Failed to parse R2 object key from URL", error);
    return null;
  }
};

export const buildObjectUrl = (endpoint: string, objectKey: string): string => {
  const encodedKey = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${normalizeEndpoint(endpoint)}/${encodedKey}`;
};

export const buildSignedFileProxyPath = async (
  c: AppContext,
  objectKey: string,
  ttlSeconds: number = MODEL_FILE_URL_TTL_SECONDS,
): Promise<string> => {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${objectKey}\n${expires}`;
  const sig = await signJwt(payload, getAuthSecret(c.env));
  const query = `key=${encodeURIComponent(objectKey)}&exp=${expires}&sig=${encodeURIComponent(sig)}`;
  if (c.env.R2_PROXY_DOMAIN) {
    return `https://${c.env.R2_PROXY_DOMAIN}/p?${query}`;
  }
  return `/api/files/public?${query}`;
};

export const toAbsoluteUrl = (c: AppContext, value: string): string => {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return new URL(value, c.req.url).toString();
};

export const isAuthenticatedFileProxyUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value, "http://localhost");
    return AUTHENTICATED_FILE_PROXY_PATH_RE.test(parsed.pathname) || parsed.pathname === "/p";
  } catch {
    return AUTHENTICATED_FILE_PROXY_PATH_RE.test(value) || value.startsWith("/p?");
  }
};

export const verifyModelFileUrlSignature = async (
  env: Env,
  objectKey: string,
  expRaw: string | null,
  signature: string | null,
): Promise<boolean> => {
  if (!expRaw || !signature) {
    return false;
  }
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = await signJwt(`${objectKey}\n${exp}`, getAuthSecret(env));
  return timingSafeEqual(signature, expected);
};

export const isAllowedR2ObjectKey = (objectKey: string): boolean =>
  objectKey.length > 0 &&
  !objectKey.includes("..") &&
  (objectKey.startsWith("avatars/") || objectKey.startsWith("attachments/") || objectKey.startsWith("library/"));

export const isOwnedObjectKey = async (db: D1Database, objectKey: string, userId: string): Promise<boolean> => {
  if (objectKey.startsWith("avatars/")) {
    return true;
  }
  if (objectKey.startsWith("attachments/")) {
    const row = await db
      .prepare("SELECT id FROM attachments WHERE r2_object_key = ? AND user_id = ? AND status != 'deleted' LIMIT 1")
      .bind(objectKey, userId)
      .first<{ id: string }>();
    return Boolean(row?.id);
  }
  if (objectKey.startsWith("library/")) {
    const row = await db
      .prepare("SELECT id FROM library_files WHERE r2_object_key = ? AND user_id = ? AND status != 'deleted' LIMIT 1")
      .bind(objectKey, userId)
      .first<{ id: string }>();
    return Boolean(row?.id);
  }
  return false;
};

export const inferAudioFormat = (mimeType: string | null): "wav" | "mp3" | null => {
  const normalized = normalizeMimeType(mimeType);
  if (normalized === "audio/wav" || normalized === "audio/x-wav" || normalized === "audio/wave") {
    return "wav";
  }
  if (normalized === "audio/mpeg" || normalized === "audio/mp3") {
    return "mp3";
  }
  return null;
};

export const toBase64 = (bytes: Uint8Array): string => {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const slice = bytes.subarray(index, index + chunkSize);
    chunks.push(String.fromCharCode(...slice));
  }
  return btoa(chunks.join(""));
};

export const buildPublicUrl = (env: Env, objectKey: string): string | null => {
  return null;
};

export const createAwsClient = (env: Env): AwsClient => {
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 access credentials are not configured.");
  }
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
};

export const getR2Endpoint = (env: Env): string => {
  if (!env.R2_ENDPOINT) {
    throw new Error("R2 endpoint is not configured.");
  }
  return normalizeEndpoint(env.R2_ENDPOINT);
};

export const createGetUrl = async (
  env: Env,
  objectKey: string,
): Promise<{ url: string; expires_at: number }> => {
  const aws = createAwsClient(env);
  const endpoint = getR2Endpoint(env);
  const signed = await aws.sign(buildObjectUrl(endpoint, objectKey), {
    method: "GET",
    aws: { signQuery: true },
  });

  const signedUrl = new URL(signed.url);
  const expiresIn = Number(signedUrl.searchParams.get("X-Amz-Expires") ?? SIGNED_URL_FALLBACK_EXPIRES_SECONDS);
  const expires_at = Date.now() + expiresIn * 1000;

  return {
    url: signed.url,
    expires_at,
  };
};

export const resolveDirectAccessUrl = async (
  c: AppContext,
  objectKey: string,
  ttlSeconds: number = USER_FILE_URL_TTL_SECONDS,
): Promise<{ url: string; expires_at: number | null }> => {
  const signedUrl = await buildSignedFileProxyPath(c, objectKey, ttlSeconds);
  return {
    url: toAbsoluteUrl(c, signedUrl),
    expires_at: Date.now() + ttlSeconds * 1000,
  };
};

export const UPLOADING_STALE_TTL_MS = 24 * 60 * 60 * 1000;
export const UPLOADING_STALE_CLEANUP_BATCH = 50;

export const cleanupStaleUploadingAttachments = async (db: D1Database, env: Env): Promise<void> => {
  const cutoff = Date.now() - UPLOADING_STALE_TTL_MS;
  const { results } = await db
    .prepare(
      "SELECT id, r2_object_key FROM attachments WHERE status = 'uploading' AND created_at < ? ORDER BY created_at ASC LIMIT ?",
    )
    .bind(cutoff, UPLOADING_STALE_CLEANUP_BATCH)
    .all<{ id: string; r2_object_key: string | null }>();

  for (const row of results ?? []) {
    if (row.r2_object_key) {
      try {
        await env.R2_BUCKET.delete(row.r2_object_key);
      } catch (error) {
        console.error("Failed to clean stale uploading attachment object", error);
      }
    }
    await db.prepare("DELETE FROM attachments WHERE id = ?").bind(row.id).run();
  }
};

export const cleanupStaleUploadingLibraryFiles = async (db: D1Database, env: Env): Promise<void> => {
  const cutoff = Date.now() - UPLOADING_STALE_TTL_MS;
  const { results } = await db
    .prepare(
      "SELECT id, r2_object_key FROM library_files WHERE status = 'uploading' AND created_at < ? ORDER BY created_at ASC LIMIT ?",
    )
    .bind(cutoff, UPLOADING_STALE_CLEANUP_BATCH)
    .all<{ id: string; r2_object_key: string | null }>();

  for (const row of results ?? []) {
    if (row.r2_object_key) {
      try {
        await env.R2_BUCKET.delete(row.r2_object_key);
      } catch (error) {
        console.error("Failed to clean stale uploading library object", error);
      }
    }
    await db.prepare("DELETE FROM library_files WHERE id = ?").bind(row.id).run();
  }
};

export const saveChallenge = async (db: D1Database, id: string, challenge: string): Promise<void> => {
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO auth_challenges (id, challenge, created_at, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET challenge = excluded.challenge, created_at = excluded.created_at, expires_at = excluded.expires_at",
    )
    .bind(id, challenge, now, now + CHALLENGE_TTL_MS)
    .run();
};

export const consumeChallenge = async (db: D1Database, id: string): Promise<string | null> => {
  const row = await db.prepare("SELECT challenge, expires_at FROM auth_challenges WHERE id = ?").bind(id).first<{
    challenge: string;
    expires_at: number;
  }>();

  if (!row) {
    return null;
  }

  await db.prepare("DELETE FROM auth_challenges WHERE id = ?").bind(id).run();

  if (Number(row.expires_at) < Date.now()) {
    return null;
  }

  return row.challenge;
};

export const parseTransports = (raw: string | null): AuthenticatorTransportFuture[] | undefined => {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return undefined;
    }
    return parsed.filter((item): item is AuthenticatorTransportFuture => typeof item === "string");
  } catch (error) {
    console.error("Failed to parse passkey transports", error);
    return undefined;
  }
};

export const listPasskeys = async (db: D1Database): Promise<PasskeyRow[]> => {
  const { results } = await db
    .prepare(
      "SELECT credential_id, public_key, counter, transports, device_type, backed_up, nickname, created_at, last_used_at FROM auth_passkeys ORDER BY created_at DESC",
    )
    .all<PasskeyRow>();
  return results ?? [];
};

export const toPasskeyInfo = (row: PasskeyRow): PasskeyInfo => ({
  id: row.credential_id,
  nickname: row.nickname,
  device_type: row.device_type,
  backed_up: Boolean(row.backed_up),
  transports: parseTransports(row.transports) ?? [],
  created_at: Number(row.created_at),
  last_used_at: row.last_used_at ? Number(row.last_used_at) : null,
});

export const ensureProfile = async (db: D1Database): Promise<void> => {
  await db
    .prepare("INSERT OR IGNORE INTO user_profile (id, username, dynamic_background, send_shortcut, updated_at) VALUES (1, ?, 1, 'ctrl_enter', ?)")
    .bind("Sensei", Date.now())
    .run();
};

export const readProfile = async (c: AppContext): Promise<UserProfile> => {
  const db = c.env.D1_DB;
  await ensureProfile(db);
  const row = await db
    .prepare(
      "SELECT username, avatar_key, avatar_url_cache, avatar_url_cache_expires_at, dynamic_background, send_shortcut, conversation_library_enabled, updated_at, total_requests, total_prompt_tokens, total_completion_tokens, total_tokens, total_cost_usd, usage_by_model_json FROM user_profile WHERE id = 1",
    )
    .first<ProfileRow>();

  if (!row) {
    throw new Error("Failed to read user profile.");
  }

  let avatarUrl: string | null = null;
  const avatarKey = row.avatar_key;
  if (avatarKey) {
    if (
      row.avatar_url_cache &&
      isAuthenticatedFileProxyUrl(row.avatar_url_cache) &&
      row.avatar_url_cache_expires_at &&
      Number(row.avatar_url_cache_expires_at) > Date.now() + SIGNED_URL_REFRESH_BUFFER_MS
    ) {
      avatarUrl = toAbsoluteUrl(c, row.avatar_url_cache);
    } else {
      const signedUrl = await buildSignedFileProxyPath(c, avatarKey, USER_FILE_URL_TTL_SECONDS);
      const expiresAt = Date.now() + USER_FILE_URL_TTL_SECONDS * 1000;
      avatarUrl = toAbsoluteUrl(c, signedUrl);
      await db
        .prepare(
          "UPDATE user_profile SET avatar_url_cache = ?, avatar_url_cache_expires_at = ?, updated_at = ? WHERE id = 1",
        )
        .bind(signedUrl, expiresAt, Date.now())
        .run();
    }
  }

  let byModel: any[] = [];
  try {
    if (row.usage_by_model_json) {
      byModel = JSON.parse(row.usage_by_model_json);
    }
  } catch (error) {
    console.error("Failed to parse usage_by_model_json", error);
  }

  return {
    username: row.username,
    avatar_key: avatarKey,
    avatar_url: avatarUrl,
    dynamic_background: Number(row.dynamic_background) === 1,
    send_shortcut: normalizeSendShortcut(row.send_shortcut),
    conversation_library_enabled: Number(row.conversation_library_enabled ?? 1) === 1,
    updated_at: Number(row.updated_at),
    total_requests: Number(row.total_requests ?? 0),
    total_prompt_tokens: Number(row.total_prompt_tokens ?? 0),
    total_completion_tokens: Number(row.total_completion_tokens ?? 0),
    total_tokens: Number(row.total_tokens ?? 0),
    total_cost_usd: Number(row.total_cost_usd ?? 0),
    by_model: byModel,
  };
};

export const getAppSetting = async (db: D1Database, key: string): Promise<string | null> => {
  const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").bind(key).first<{ value: string }>();
  if (!row?.value) {
    return null;
  }
  const trimmed = row.value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const setAppSetting = async (db: D1Database, key: string, value: string): Promise<void> => {
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(key, value, now)
    .run();
};

export const getLogLevel = async (db: D1Database): Promise<LogLevel> => {
  const now = Date.now();
  if (logLevelCache && logLevelCache.expiresAt > now) {
    return logLevelCache.value;
  }
  const value = await getAppSetting(db, "log_level");
  const normalized = normalizeLogLevel(value);
  logLevelCache = {
    value: normalized,
    expiresAt: now + LOG_LEVEL_CACHE_TTL_MS,
  };
  return normalized;
};

export const setLogLevel = async (db: D1Database, logLevel: LogLevel): Promise<void> => {
  await setAppSetting(db, "log_level", logLevel);
  logLevelCache = null;
};

export const getSelectedModel = async (db: D1Database): Promise<string> => {
  const value = await getAppSetting(db, "selected_model");
  return value ?? DEFAULT_MODEL;
};

export const setSelectedModel = async (db: D1Database, model: string): Promise<void> => {
  await setAppSetting(db, "selected_model", model);
};

export const getTitleModel = async (db: D1Database): Promise<string> => {
  const value = await getAppSetting(db, "title_model");
  if (value) {
    return value;
  }
  return getSelectedModel(db);
};

export const setTitleModel = async (db: D1Database, model: string): Promise<void> => {
  await setAppSetting(db, "title_model", model);
};

export const normalizeReasoningEffort = (value: string | null | undefined): ReasoningEffort => {
  if (value === "minimal" || value === "low" || value === "medium" || value === "high" || value === "xhigh") {
    return value;
  }
  return "medium";
};

export const normalizeServiceTier = (value: string | null | undefined): ServiceTier => {
  if (value === "flex" || value === "default" || value === "priority") {
    return value;
  }
  return "default";
};

export const normalizeMaxOutputTokens = (value: string | null | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 9000;
  }
  return Math.min(64000, Math.max(1, Math.round(parsed)));
};

export const normalizeDailyBudgetUsd = (value: string | null | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.min(1000000, Math.max(0.01, Number(parsed.toFixed(4))));
};

export const normalizeTemporaryDailyBudgetUsd = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined || value.trim().length === 0) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.min(1000000, Math.max(0.01, Number(parsed.toFixed(4))));
};

export const getCurrentUtcDate = (): string => new Date().toISOString().slice(0, 10);

export const normalizeWebSearchEnabled = (value: string | null | undefined): boolean => {
  if (!value) {
    return false;
  }
  return value === "1" || value.toLowerCase() === "true";
};

export const normalizeWebSearchMaxResults = (value: string | null | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 5;
  }
  return Math.min(25, Math.max(1, Math.round(parsed)));
};

export const getChatSettings = async (db: D1Database): Promise<ChatSettings> => {
  const [
    serviceTier,
    reasoningEffort,
    maxOutputTokens,
    dailyBudgetUsd,
    temporaryDailyBudgetUsd,
    temporaryDailyBudgetDateUtc,
    webSearchEnabled,
    webSearchMaxResults,
  ] = await Promise.all([
    getAppSetting(db, "service_tier"),
    getAppSetting(db, "reasoning_effort"),
    getAppSetting(db, "max_output_tokens"),
    getAppSetting(db, "daily_budget_usd"),
    getAppSetting(db, "temporary_daily_budget_usd"),
    getAppSetting(db, "temporary_daily_budget_date_utc"),
    getAppSetting(db, "web_search_enabled"),
    getAppSetting(db, "web_search_max_results"),
  ]);
  const todayUtc = getCurrentUtcDate();
  const temporaryBudgetActive = temporaryDailyBudgetDateUtc === todayUtc;
  return {
    service_tier: normalizeServiceTier(serviceTier),
    reasoning_effort: normalizeReasoningEffort(reasoningEffort),
    max_output_tokens: normalizeMaxOutputTokens(maxOutputTokens),
    daily_budget_usd: normalizeDailyBudgetUsd(dailyBudgetUsd),
    temporary_daily_budget_usd: temporaryBudgetActive ? normalizeTemporaryDailyBudgetUsd(temporaryDailyBudgetUsd) : null,
    temporary_daily_budget_date_utc: temporaryBudgetActive ? temporaryDailyBudgetDateUtc : null,
    web_search_enabled: normalizeWebSearchEnabled(webSearchEnabled),
    web_search_max_results: normalizeWebSearchMaxResults(webSearchMaxResults),
  };
};

export const normalizeSessionTitle = (value: string): string => {
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/^["'“”‘’\s]+/, "")
    .replace(/["'“”‘’\s]+$/, "")
    .trim();
  return cleaned.slice(0, MAX_SESSION_TITLE_LENGTH);
};

export const extractModelMessageContent = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (typeof part === "object" && part !== null) {
          const text = (part as Record<string, unknown>).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join(" ");
  }
  return "";
};

/**
 * Extracts assistant text from Responses API completion payloads.
 * Some providers emit incremental text deltas during stream events, while others
 * only include final text in `response.completed` (`output_text` / `output`).
 */
export const extractResponseCompletedText = (response: Record<string, unknown> | null): string => {
  if (!response) {
    return "";
  }

  const outputText = response.output_text;
  if (typeof outputText === "string" && outputText.trim().length > 0) {
    return outputText;
  }
  if (Array.isArray(outputText)) {
    const joined = outputText
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (typeof part === "object" && part !== null) {
          const partRecord = part as Record<string, unknown>;
          if (typeof partRecord.text === "string") {
            return partRecord.text;
          }
        }
        return "";
      })
      .join("");
    if (joined.trim().length > 0) {
      return joined;
    }
  }

  const output = response.output;
  if (!Array.isArray(output)) {
    return "";
  }
  const chunks: string[] = [];
  for (const item of output) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const itemRecord = item as Record<string, unknown>;
    const content = itemRecord.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (typeof part === "string") {
          chunks.push(part);
          continue;
        }
        if (typeof part === "object" && part !== null) {
          const partText = (part as Record<string, unknown>).text;
          if (typeof partText === "string") {
            chunks.push(partText);
          }
        }
      }
      continue;
    }
    const itemText = itemRecord.text;
    if (typeof itemText === "string") {
      chunks.push(itemText);
    }
  }
  return chunks.join("");
};

export const buildAssistantContentEventPayload = (content: string): string =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

export const resolveAttachmentType = (mimeType: string): MessageAttachmentType => {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "file";
};

export const buildOpenRouterMessageContent = async (
  c: AppContext,
  role: "user" | "assistant" | "system",
  value: string,
  attachments: ChatAttachmentPayload[],
  attachmentMetaById: Map<string, AttachmentModelMeta>,
): Promise<OpenRouterMessage["content"]> => {
  if (role !== "user") {
    return value;
  }

  const normalizedText = value.trim();
  const contentParts: Array<OpenRouterContentPart | OpenRouterImagePart | OpenRouterFilePart | OpenRouterInputAudioPart> = [];
  const fallbackTextAttachments: ChatAttachmentPayload[] = [];

  for (const attachment of attachments) {
    const attachmentUrl = attachment.url.trim();
    if (!attachmentUrl) {
      continue;
    }
    const meta = attachmentMetaById.get(attachment.id);
    const mimeType = normalizeMimeType(attachment.mime_type);

    if (attachment.type === "image") {
      const modelUrl = meta ? await resolveModelReadableAttachmentUrl(c, meta) : toAbsoluteUrl(c, attachmentUrl);
      if (modelUrl) {
        contentParts.push({
          type: "image_url",
          image_url: { url: modelUrl },
        });
        continue;
      }
    }

    if (mimeType === "application/pdf") {
      const modelUrl = meta ? await resolveModelReadableAttachmentUrl(c, meta) : toAbsoluteUrl(c, attachmentUrl);
      if (modelUrl) {
        contentParts.push({
          type: "file",
          file: {
            filename: attachment.file_name,
            file_data: modelUrl,
          },
        });
        continue;
      }
    }

    if (attachment.type === "audio" && meta) {
      const objectKey = await resolveAttachmentObjectKey(c, meta);
      const format = inferAudioFormat(meta.mime_type);
      if (objectKey && format && attachment.size <= MAX_MULTIMODAL_AUDIO_BYTES) {
        const audioObject = await c.env.R2_BUCKET.get(objectKey);
        if (audioObject && Number(audioObject.size ?? 0) > MAX_MULTIMODAL_AUDIO_BYTES) {
          fallbackTextAttachments.push(attachment);
          continue;
        }
        const audioBuffer = await audioObject?.arrayBuffer();
        if (audioBuffer && audioBuffer.byteLength > 0 && audioBuffer.byteLength <= MAX_MULTIMODAL_AUDIO_BYTES) {
          contentParts.push({
            type: "input_audio",
            input_audio: {
              data: toBase64(new Uint8Array(audioBuffer)),
              format,
            },
          });
          continue;
        }
      }
    }

    fallbackTextAttachments.push(attachment);
  }

  const nonImageLines: string[] = [];
  for (const attachment of fallbackTextAttachments) {
    nonImageLines.push(`Attachment: ${attachment.file_name} (${attachment.mime_type}) ${attachment.url}`);
  }
  const nonImageContext = nonImageLines.join("\n");
  // Within the fallback text block itself, list attachment context lines before the user-typed text.
  const textContent = [nonImageContext, normalizedText].filter((item) => item.length > 0).join("\n\n");
  // Some providers reject empty user content; keep a non-empty fallback for attachment-only turns.
  const safeTextContent = textContent || EMPTY_MODEL_TEXT_FALLBACK;

  if (contentParts.length === 0) {
    return safeTextContent;
  }

  // Final mixed-content order is multimodal parts first, then trailing text as the last content item.
  return [...contentParts, { type: "text", text: safeTextContent }];
};

export const toResponsesInputContent = (
  content: OpenRouterMessage["content"],
): ResponsesInputContentPart[] => {
  if (typeof content === "string") {
    return [{ type: "input_text", text: content || EMPTY_MODEL_TEXT_FALLBACK }];
  }
  const mapped: ResponsesInputContentPart[] = [];
  for (const part of content) {
    if (part.type === "text") {
      mapped.push({ type: "input_text", text: part.text || EMPTY_MODEL_TEXT_FALLBACK });
      continue;
    }
    if (part.type === "image_url") {
      mapped.push({ type: "input_image", image_url: part.image_url.url });
      continue;
    }
    if (part.type === "file") {
      mapped.push({
        type: "input_file",
        filename: part.file.filename,
        file_data: part.file.file_data,
      });
      continue;
    }
    if (part.type === "input_audio") {
      mapped.push({
        type: "input_audio",
        input_audio: {
          data: part.input_audio.data,
          format: part.input_audio.format,
        },
      });
      continue;
    }
  }
  return mapped.length > 0 ? mapped : [{ type: "input_text", text: EMPTY_MODEL_TEXT_FALLBACK }];
};

export const isChatCompletionsEndpoint = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.pathname.endsWith("/chat/completions");
  } catch {
    const pathWithoutQuery = value.split("?")[0]?.split("#")[0] ?? value;
    return pathWithoutQuery.endsWith("/chat/completions");
  }
};

export const generateSessionTitle = async (
  c: AppContext,
  db: D1Database,
  userMessage: string,
  assistantMessage: string,
): Promise<TitleGenerationResult> => {
  return generateSessionTitleWithContext(
    {
      env: c.env,
      requestUrl: c.req.url,
      requestId: c.get("requestId") ?? "unknown",
      logLevel: c.get("logLevel") ?? DEFAULT_LOG_LEVEL,
    },
    db,
    userMessage,
    assistantMessage,
  );
};

export type TitleGenerationContext = {
  env: Env;
  requestUrl: string;
  requestId: string;
  logLevel: LogLevel;
};

export const buildTitleRequestLogPayload = (context: TitleGenerationContext): Record<string, unknown> => {
  const fallback = {
    request_id: context.requestId,
    method: "POST",
    path: "/",
  };
  try {
    return {
      request_id: context.requestId,
      method: "POST",
      path: new URL(context.requestUrl).pathname,
    };
  } catch {
    return fallback;
  }
};

export const generateSessionTitleWithContext = async (
  context: TitleGenerationContext,
  db: D1Database,
  userMessage: string,
  assistantMessage: string,
): Promise<TitleGenerationResult> => {
  const titleModel = await getTitleModel(db);
  const apiEndpoint = context.env.API_ENDPOINT || "https://openrouter.ai/api/v1/chat/completions";
  const logLevel = context.logLevel;
  const logPayload = buildTitleRequestLogPayload(context);
  const userSnippet = userMessage.trim().slice(0, 600);
  const assistantSnippet = assistantMessage.trim().slice(0, 900);

  if (!userSnippet || !assistantSnippet) {
    return { title: null, usage: null, model: titleModel };
  }

  try {
    const requestBody = {
      model: titleModel,
      stream: false,
      temperature: 0.2,
      max_tokens: 32,
      messages: [
        {
          role: "system",
          content:
            "Generate a short chat title in the same language as the user. Return only the title text. No quotes, no punctuation at the end. Keep it within 12 words.",
        },
        {
          role: "user",
          content: `User message:\n${userSnippet}\n\nAssistant reply:\n${assistantSnippet}`,
        },
      ],
    };
    if (logLevel === "TRACE") {
      logTrace("chat.title_generation.upstream_request", {
        ...logPayload,
        model: titleModel,
        endpoint: apiEndpoint,
        body: requestBody,
      });
    }
    const upstream = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.env.AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!upstream.ok) {
      const reason = await upstream.text();
      if (logLevel === "TRACE") {
        logTrace("chat.title_generation.upstream_response", {
          ...logPayload,
          model: titleModel,
          endpoint: apiEndpoint,
          status: upstream.status,
          status_text: upstream.statusText,
          body: parseTraceBody(reason, upstream.headers.get("content-type") ?? "application/json"),
        });
      }
      logError("chat.title_generation_request_failed", {
        ...logPayload,
        model: titleModel,
        upstream_status: upstream.status,
        upstream_reason: reason.slice(0, 300),
      });
      return { title: null, usage: null, model: titleModel };
    }

    if (logLevel === "TRACE") {
      const responseText = await upstream.clone().text();
      logTrace("chat.title_generation.upstream_response", {
        ...logPayload,
        model: titleModel,
        endpoint: apiEndpoint,
        status: upstream.status,
        status_text: upstream.statusText,
        body: parseTraceBody(responseText, upstream.headers.get("content-type") ?? "application/json"),
      });
    }
    const payload = (await upstream.json()) as Record<string, unknown>;
    const usage = parseOpenRouterUsage(payload.usage);
    const model = typeof payload.model === "string" && payload.model.trim().length > 0 ? payload.model : titleModel;
    const choices = payload.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      return { title: null, usage, model };
    }
    const first = choices[0];
    if (typeof first !== "object" || first === null) {
      return { title: null, usage, model };
    }
    const message = (first as Record<string, unknown>).message;
    if (typeof message !== "object" || message === null) {
      return { title: null, usage, model };
    }
    const content = extractModelMessageContent((message as Record<string, unknown>).content);
    const title = normalizeSessionTitle(content);
    return { title: title || null, usage, model };
  } catch (error) {
    logError("chat.title_generation_failed", { ...logPayload, model: titleModel }, error);
    return { title: null, usage: null, model: titleModel };
  }
};

export const getSystemPromptSetting = async (db: D1Database, env: Env): Promise<string> => {
  const appSetting = await getAppSetting(db, "system_prompt_setting");
  if (appSetting) {
    return appSetting;
  }
  const envSetting = env.SYSTEM_PROMPT_SETTING?.trim();
  if (envSetting) {
    return envSetting;
  }
  return DEFAULT_SYSTEM_PROMPT_SETTING;
};

export const normalizeSystemPromptTimezone = (value: string | null | undefined): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_SYSTEM_PROMPT_TIMEZONE;
  }
  const matched = SYSTEM_PROMPT_TIMEZONE_OPTIONS.find((item) => item.value === trimmed);
  return matched?.value ?? DEFAULT_SYSTEM_PROMPT_TIMEZONE;
};

export const getSystemPromptTimezone = async (db: D1Database): Promise<string> => {
  const value = await getAppSetting(db, "system_prompt_timezone");
  return normalizeSystemPromptTimezone(value);
};

export const getShowArchivedSessions = async (db: D1Database): Promise<boolean> => {
  const value = await getAppSetting(db, "show_archived_sessions");
  return value === "1";
};

export const listWorkspaces = async (db: D1Database, includeArchived: boolean): Promise<WorkspaceRow[]> => {
  const query = includeArchived
    ? "SELECT id, name, archived_at, created_at, updated_at FROM workspaces ORDER BY CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END ASC, updated_at DESC, created_at DESC"
    : "SELECT id, name, archived_at, created_at, updated_at FROM workspaces WHERE archived_at IS NULL ORDER BY updated_at DESC, created_at DESC";
  const { results } = await db.prepare(query).all<WorkspaceRow>();
  return (results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    archived_at: row.archived_at ?? null,
    created_at: Number(row.created_at ?? 0),
    updated_at: Number(row.updated_at ?? 0),
  }));
};

export const resolveDefaultWorkspaceId = async (db: D1Database): Promise<string> => {
  const firstWorkspace = await db
    .prepare("SELECT id FROM workspaces ORDER BY CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END ASC, created_at ASC LIMIT 1")
    .first<{ id: string }>();
  if (firstWorkspace?.id) {
    return firstWorkspace.id;
  }
  const now = Date.now();
  await db
    .prepare("INSERT INTO workspaces (id, name, archived_at, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)")
    .bind("default", "Default Workspace", now, now)
    .run();
  return "default";
};

export const getActiveWorkspaceId = async (db: D1Database): Promise<string> => {
  const configured = await getAppSetting(db, "active_workspace_id");
  const workspaceId = configured?.trim();
  if (workspaceId) {
    const existing = await db
      .prepare("SELECT id FROM workspaces WHERE id = ? LIMIT 1")
      .bind(workspaceId)
      .first<{ id: string }>();
    if (existing?.id) {
      return existing.id;
    }
  }
  const fallbackId = await resolveDefaultWorkspaceId(db);
  await setAppSetting(db, "active_workspace_id", fallbackId);
  return fallbackId;
};

export const formatSystemPromptDateTime = (timeZone: string): { value: string; resolvedTimeZone: string } => {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone,
      timeZoneName: "longOffset",
    });
    return { value: formatter.format(now).replace(",", ""), resolvedTimeZone: timeZone };
  } catch {
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone,
      });
      return { value: formatter.format(now).replace(",", ""), resolvedTimeZone: timeZone };
    } catch {
      return { value: now.toISOString(), resolvedTimeZone: "UTC" };
    }
  }
};

export const buildInjectedSystemPrompt = async (db: D1Database, env: Env): Promise<string> => {
  const setting = await getSystemPromptSetting(db, env);
  const timeZone = await getSystemPromptTimezone(db);
  const formattedDateTime = formatSystemPromptDateTime(timeZone);
  const timezoneLabel =
    SYSTEM_PROMPT_TIMEZONE_OPTIONS.find((item) => item.value === formattedDateTime.resolvedTimeZone)?.label ??
    formattedDateTime.resolvedTimeZone;
  const currentDateTime = formattedDateTime.value;
  return `${setting}\nCurrent date and time (${timezoneLabel}): ${currentDateTime}\nUse this information only when relevant. Do not mention it unnecessarily.`;
};

export const normalizePasskeyRpName = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Passkey RP Name is required.");
  }
  if (trimmed.length > 80) {
    throw new Error("Passkey RP Name must be <= 80 characters.");
  }
  return trimmed;
};

export const normalizePasskeyRpId = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    throw new Error("Passkey RP ID is required.");
  }
  if (
    trimmed.includes("://") ||
    trimmed.includes("/") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    trimmed.endsWith(".")
  ) {
    throw new Error("Passkey RP ID must be a valid host name (no protocol/path).");
  }
  if (!/^[a-z0-9.-]+$/i.test(trimmed)) {
    throw new Error("Passkey RP ID contains invalid characters.");
  }
  return trimmed;
};

export const normalizePasskeyOrigin = (value: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch (error) {
    console.error("Invalid passkey origin", error);
    throw new Error("Passkey origin must be a valid URL.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Passkey origin protocol must be http or https.");
  }
  return parsed.origin;
};

export const getPasskeyConfig = async (c: AppContext): Promise<PasskeyConfig> => {
  const requestUrl = new URL(c.req.url);
  let fallbackOrigin = requestUrl.origin;
  let fallbackRpId = requestUrl.hostname;

  const originHeader = c.req.header("Origin");
  if (originHeader) {
    try {
      const parsedOrigin = new URL(originHeader);
      fallbackOrigin = parsedOrigin.origin;
      fallbackRpId = parsedOrigin.hostname;
    } catch (error) {
      console.error("Invalid Origin header for passkey fallback", error);
    }
  }

  return {
    rp_name: normalizePasskeyRpName(DEFAULT_PASSKEY_RP_NAME),
    rp_id: normalizePasskeyRpId(fallbackRpId),
    origin: normalizePasskeyOrigin(fallbackOrigin),
  };
};

export const parsePricingConfig = (env: Env): Record<string, { input_usd_per_million: number; output_usd_per_million: number }> => {
  const result: Record<string, { input_usd_per_million: number; output_usd_per_million: number }> = { ...DEFAULT_PRICING };
  if (!env.MODEL_PRICING_JSON) {
    return result;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(env.MODEL_PRICING_JSON);
  } catch (error) {
    console.error("Failed to parse MODEL_PRICING_JSON", error);
    return result;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return result;
  }

  for (const [model, value] of Object.entries(parsed)) {
    if (typeof value !== "object" || value === null) {
      continue;
    }
    const record = value as Record<string, unknown>;
    const input = Number(record.input_usd_per_million ?? record.input);
    const output = Number(record.output_usd_per_million ?? record.output);
    if (!Number.isFinite(input) || !Number.isFinite(output)) {
      continue;
    }
    result[model] = {
      input_usd_per_million: input,
      output_usd_per_million: output,
    };
  }

  return result;
};

export const resolvePricing = (
  model: string,
  pricing: Record<string, { input_usd_per_million: number; output_usd_per_million: number }>,
): { input_usd_per_million: number; output_usd_per_million: number } | null => {
  if (!model) {
    return null;
  }
  const stripDateSuffix = (value: string): string =>
    value.replace(/-\d{8}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "");
  const baseModel = model.split(":")[0];
  const candidates = new Set<string>([model, baseModel, stripDateSuffix(model), stripDateSuffix(baseModel)]);

  for (const candidate of candidates) {
    if (candidate && pricing[candidate]) {
      return pricing[candidate];
    }
  }
  return null;
};

export const calculateCostUsd = (
  model: string,
  usage: OpenRouterUsage | null,
  pricingTable: Record<string, { input_usd_per_million: number; output_usd_per_million: number }>,
  serviceTier: ServiceTier = "default",
): number => {
  if (!usage) {
    return 0;
  }
  const upstreamCost = Number(usage.cost ?? 0);
  if (Number.isFinite(upstreamCost) && upstreamCost > 0) {
    return Number(upstreamCost.toFixed(8));
  }
  const pricing = resolvePricing(model, pricingTable);
  if (!pricing) {
    return 0;
  }

  const multiplier = SERVICE_TIER_MULTIPLIERS[serviceTier] || 1.0;
  const promptTokens = Number(usage.prompt_tokens ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? 0);
  const usd =
    ((promptTokens / 1_000_000) * pricing.input_usd_per_million +
    (completionTokens / 1_000_000) * pricing.output_usd_per_million) * multiplier;
  return Number(usd.toFixed(8));
};

export const hasUsageMetrics = (usage: OpenRouterUsage): boolean =>
  [
    usage.prompt_tokens,
    usage.completion_tokens,
    usage.total_tokens,
    usage.prompt_cached_tokens,
    usage.prompt_cache_write_tokens,
    usage.prompt_audio_tokens,
    usage.prompt_video_tokens,
    usage.completion_reasoning_tokens,
    usage.completion_image_tokens,
    usage.completion_audio_tokens,
    usage.cost,
  ].some((value) => Number(value ?? 0) > 0);

export const toFiniteNumber = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const parseOpenRouterUsage = (value: unknown): OpenRouterUsage | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const usage = value as Record<string, unknown>;
  const normalized: OpenRouterUsage = {
    prompt_tokens: toFiniteNumber(usage.prompt_tokens ?? usage.input_tokens),
    completion_tokens: toFiniteNumber(usage.completion_tokens ?? usage.output_tokens),
    total_tokens: toFiniteNumber(usage.total_tokens),
    cost: toFiniteNumber(usage.cost),
    prompt_cached_tokens: toFiniteNumber(usage.prompt_cached_tokens ?? usage.input_cached_tokens),
    prompt_cache_write_tokens: toFiniteNumber(usage.prompt_cache_write_tokens ?? usage.input_cache_write_tokens),
    prompt_audio_tokens: toFiniteNumber(usage.prompt_audio_tokens ?? usage.input_audio_tokens),
    prompt_video_tokens: toFiniteNumber(usage.prompt_video_tokens ?? usage.input_video_tokens),
    completion_reasoning_tokens: toFiniteNumber(usage.completion_reasoning_tokens ?? usage.reasoning_tokens),
    completion_image_tokens: toFiniteNumber(usage.completion_image_tokens ?? usage.output_image_tokens),
    completion_audio_tokens: toFiniteNumber(usage.completion_audio_tokens ?? usage.output_audio_tokens),
  };
  return hasUsageMetrics(normalized) ? normalized : null;
};

export const insertUsageRecord = async (
  db: D1Database,
  sessionId: string,
  model: string,
  usage: OpenRouterUsage | null,
  pricingTable: Record<string, { input_usd_per_million: number; output_usd_per_million: number }>,
  serviceTier: ServiceTier = "default",
): Promise<void> => {
  if (!usage || !hasUsageMetrics(usage)) {
    return;
  }
  const costUsd = calculateCostUsd(model, usage, pricingTable, serviceTier);
  const promptTokens = toFiniteNumber(usage.prompt_tokens);
  const completionTokens = toFiniteNumber(usage.completion_tokens);
  const totalTokens = toFiniteNumber(usage.total_tokens);

  await db.batch([
    db.prepare("INSERT INTO usage_records (id, session_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(
        crypto.randomUUID(),
        sessionId,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd,
        Date.now(),
      ),
    db.prepare("UPDATE user_profile SET total_requests = total_requests + 1, total_prompt_tokens = total_prompt_tokens + ?, total_completion_tokens = total_completion_tokens + ?, total_tokens = total_tokens + ?, total_cost_usd = total_cost_usd + ? WHERE id = 1")
      .bind(promptTokens, completionTokens, totalTokens, costUsd)
  ]);
};

export const syncUsageAggregate = async (db: D1Database): Promise<void> => {
  const summaryResult = await db
    .prepare(
      "SELECT COUNT(*) as requests, COALESCE(SUM(prompt_tokens), 0) as prompt_tokens, COALESCE(SUM(completion_tokens), 0) as completion_tokens, COALESCE(SUM(total_tokens), 0) as total_tokens, COALESCE(SUM(cost_usd), 0) as total_cost_usd FROM usage_records",
    )
    .first<UsageSummaryRow>();

  if (!summaryResult) {
    return;
  }

  const byModelResult = await db
    .prepare(
      "SELECT model, COUNT(*) as requests, COALESCE(SUM(prompt_tokens), 0) as prompt_tokens, COALESCE(SUM(completion_tokens), 0) as completion_tokens, COALESCE(SUM(total_tokens), 0) as total_tokens, COALESCE(SUM(cost_usd), 0) as cost_usd FROM usage_records GROUP BY model ORDER BY cost_usd DESC, total_tokens DESC",
    )
    .all<UsageByModelRow>();

  const byModel = (byModelResult.results ?? []).map((item) => ({
    model: item.model,
    requests: Number(item.requests ?? 0),
    prompt_tokens: Number(item.prompt_tokens ?? 0),
    completion_tokens: Number(item.completion_tokens ?? 0),
    total_tokens: Number(item.total_tokens ?? 0),
    cost_usd: Number(Number(item.cost_usd ?? 0).toFixed(8)),
  }));

  await db
    .prepare(
      "UPDATE user_profile SET total_requests = ?, total_prompt_tokens = ?, total_completion_tokens = ?, total_tokens = ?, total_cost_usd = ?, usage_by_model_json = ?, updated_at = ? WHERE id = 1",
    )
    .bind(
      Number(summaryResult.requests ?? 0),
      Number(summaryResult.prompt_tokens ?? 0),
      Number(summaryResult.completion_tokens ?? 0),
      Number(summaryResult.total_tokens ?? 0),
      Number(summaryResult.total_cost_usd ?? 0),
      JSON.stringify(byModel),
      Date.now(),
    )
    .run();
};

export const buildModelOptions = (
  pricingTable: Record<string, { input_usd_per_million: number; output_usd_per_million: number }>,
  selectedModel: string,
  ...requiredModels: string[]
): ModelOption[] => {
  const models: ModelOption[] = DEFAULT_MODEL_DEFS.map((model) => ({
    id: model.id,
    name: model.name,
    pricing: resolvePricing(model.id, pricingTable),
  }));

  const ensureIncluded = (modelId: string): void => {
    if (!modelId || models.find((item) => item.id === modelId)) {
      return;
    }
    models.unshift({
      id: modelId,
      name: modelId,
      pricing: resolvePricing(modelId, pricingTable),
    });
  };

  ensureIncluded(selectedModel);
  for (const modelId of requiredModels) {
    ensureIncluded(modelId);
  }

  return models;
};

export const resolveAttachmentObjectKey = async (c: AppContext, attachment: AttachmentModelMeta): Promise<string | null> => {
  if (attachment.r2_object_key) {
    return attachment.r2_object_key;
  }
  const parsed = parseObjectKeyFromUrl(attachment.r2_url, getR2Endpoint(c.env));
  if (!parsed) {
    return null;
  }
  if (attachment.source === "library_files") {
    await c.env.D1_DB.prepare("UPDATE library_files SET r2_object_key = ? WHERE id = ?").bind(parsed, attachment.id).run();
  } else {
    await c.env.D1_DB.prepare("UPDATE attachments SET r2_object_key = ? WHERE id = ?").bind(parsed, attachment.id).run();
  }
  return parsed;
};

export const resolveModelReadableAttachmentUrl = async (c: AppContext, attachment: AttachmentModelMeta): Promise<string | null> => {
  const objectKey = await resolveAttachmentObjectKey(c, attachment);
  if (!objectKey) {
    return null;
  }
  return toAbsoluteUrl(c, await buildSignedFileProxyPath(c, objectKey, AI_FILE_URL_TTL_SECONDS));
};

export const resolveStoredFileAccessUrl = async (
  c: AppContext,
  attachment: {
    id: string;
    r2_url: string;
    r2_object_key: string | null;
    cached_get_url: string | null;
    cached_get_url_expires_at: number | null;
  },
  tableName: AttachmentSource,
): Promise<string> => {
  const db = c.env.D1_DB;
  const updateObjectKeySql = tableName === "library_files"
    ? "UPDATE library_files SET r2_object_key = ? WHERE id = ?"
    : "UPDATE attachments SET r2_object_key = ? WHERE id = ?";
  const updateCacheSql = tableName === "library_files"
    ? "UPDATE library_files SET cached_get_url = ?, cached_get_url_expires_at = ? WHERE id = ?"
    : "UPDATE attachments SET cached_get_url = ?, cached_get_url_expires_at = ? WHERE id = ?";
  let objectKey = attachment.r2_object_key;
  if (!objectKey && attachment.r2_url) {
    objectKey = parseObjectKeyFromUrl(attachment.r2_url, getR2Endpoint(c.env));
    if (objectKey) {
      await db.prepare(updateObjectKeySql).bind(objectKey, attachment.id).run();
    }
  }

  if (!objectKey) {
    throw new Error("Attachment object key is missing.");
  }

  if (
    attachment.cached_get_url &&
    isAuthenticatedFileProxyUrl(attachment.cached_get_url) &&
    attachment.cached_get_url_expires_at &&
    Number(attachment.cached_get_url_expires_at) > Date.now() + SIGNED_URL_REFRESH_BUFFER_MS
  ) {
    return toAbsoluteUrl(c, attachment.cached_get_url);
  }

  const resolvedUrl = await buildSignedFileProxyPath(c, objectKey, USER_FILE_URL_TTL_SECONDS);
  const expiresAt = Date.now() + USER_FILE_URL_TTL_SECONDS * 1000;
  await db.prepare(updateCacheSql).bind(resolvedUrl, expiresAt, attachment.id).run();
  return toAbsoluteUrl(c, resolvedUrl);
};

export const resolveAttachmentAccessUrl = async (c: AppContext, attachment: AttachmentRow): Promise<string> =>
  resolveStoredFileAccessUrl(c, attachment, "attachments");

export const resolveLibraryAccessUrl = async (c: AppContext, attachment: LibraryFileRow): Promise<string> =>
  resolveStoredFileAccessUrl(c, attachment, "library_files");

export const toChatAttachmentPayload = async (c: AppContext, attachment: MessageAttachmentJoinRow): Promise<ChatAttachmentPayload | null> => {
  if (!attachment.id || !attachment.file_name || !attachment.mime_type || !attachment.size) {
    return null;
  }
  const url = await resolveStoredFileAccessUrl(c, attachment, attachment.source);
  return {
    id: attachment.id,
    file_name: attachment.file_name,
    mime_type: attachment.mime_type,
    size: Number(attachment.size),
    url,
    type: resolveAttachmentType(normalizeMimeType(attachment.mime_type)),
  };
};

export const getMessageAttachmentsMap = async (
  c: AppContext,
  messageIds: string[],
  userId: string,
): Promise<Map<string, ChatAttachmentPayload[]>> => {
  const map = new Map<string, ChatAttachmentPayload[]>();
  if (messageIds.length === 0) {
    return map;
  }
  const placeholders = messageIds.map(() => "?").join(", ");
  const messageAttachmentLookupBinds = [...messageIds, userId, ...messageIds, userId];
  const { results } = await c.env.D1_DB
    .prepare(
      `SELECT ma.message_id, 'attachments' AS source, a.id, a.file_name, a.mime_type, a.size, a.r2_url, a.r2_object_key, a.cached_get_url, a.cached_get_url_expires_at, a.status, a.user_id, a.created_at
        FROM message_attachments ma
        JOIN attachments a ON a.id = ma.attachment_id
        WHERE ma.message_id IN (${placeholders}) AND a.status = 'active' AND a.user_id = ?
       UNION ALL
       SELECT ma.message_id, 'library_files' AS source, l.id, l.file_name, l.mime_type, l.size, l.r2_url, l.r2_object_key, l.cached_get_url, l.cached_get_url_expires_at, l.status, l.user_id, l.created_at
       FROM message_attachments ma
       JOIN library_files l ON l.id = ma.attachment_id
       WHERE ma.message_id IN (${placeholders}) AND l.status = 'active' AND l.user_id = ?
       ORDER BY message_id ASC, created_at ASC`,
    )
    .bind(...messageAttachmentLookupBinds)
    .all<MessageAttachmentJoinRow>();

  const rows = results ?? [];
  const payloads = await Promise.all(
    rows.map(async (row) => {
      const payload = await toChatAttachmentPayload(c, row);
      if (!payload) {
        return null;
      }
      return { message_id: row.message_id, payload };
    }),
  );

  for (const item of payloads) {
    if (!item) {
      continue;
    }
    const existing = map.get(item.message_id) ?? [];
    existing.push(item.payload);
    map.set(item.message_id, existing);
  }
  return map;
};

export const listSessionMessages = async (c: AppContext, sessionId: string, userId: string): Promise<SessionMessage[]> => {
  const { results } = await c.env.D1_DB
    .prepare("SELECT id, session_id, role, content, model, reasoning_summary, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC")
    .bind(sessionId)
    .all<SessionMessageRow>();
  const rows = results ?? [];
  const attachmentMap = await getMessageAttachmentsMap(
    c,
    rows.map((row) => row.id),
    userId,
  );
  return rows.map((row) => ({
    ...row,
    attachments: attachmentMap.get(row.id) ?? [],
  }));
};
