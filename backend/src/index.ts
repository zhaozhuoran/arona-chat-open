import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
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

type AppVariables = {
  requestId: string;
  requestStartedAt: number;
  logLevel?: LogLevel;
};

const readBackendBuildInfo = (env: Env): { backend_build_hash: string; backend_build_time: string } => ({
  backend_build_hash: env.BACKEND_BUILD_HASH?.trim() || GENERATED_BACKEND_BUILD_HASH || DEFAULT_BUILD_HASH,
  backend_build_time: env.BACKEND_BUILD_TIME?.trim() || GENERATED_BACKEND_BUILD_TIME || DEFAULT_BUILD_TIME,
});

type AppConfig = {
  Bindings: Env;
  Variables: AppVariables;
};

const app = new Hono<AppConfig>();

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SIGNED_URL_FALLBACK_EXPIRES_SECONDS = 24 * 60 * 60;
const SIGNED_URL_REFRESH_BUFFER_MS = 30 * 1000;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const DEFAULT_PASSKEY_RP_NAME = "Arona Chat";
const MAX_SESSION_TITLE_LENGTH = 60;
const LATEST_SCHEMA_VERSION = 12;
const EMPTY_MODEL_TEXT_FALLBACK = " ";
const API_FILES_PREFIX_RE = /^\/api\/files\/+/;
const AUTHENTICATED_FILE_PROXY_PATH_RE = /\/api\/files\/(?!public(?:\?|$))/;
const MODEL_FILE_URL_TTL_SECONDS = 10 * 60;
const USER_FILE_URL_TTL_SECONDS = 60 * 60;
const AI_FILE_URL_TTL_SECONDS = 5 * 60;
const MAX_MULTIMODAL_AUDIO_BYTES = 8 * 1024 * 1024;
const DEFAULT_LOG_LEVEL: LogLevel = "INFO";
const TRACE_LOG_MAX_CHARS = 12000;
const LOG_LEVEL_CACHE_TTL_MS = 5000;
const DEFAULT_SYSTEM_PROMPT_TIMEZONE = "UTC";
const DEFAULT_BUILD_HASH = "unknown";
const DEFAULT_BUILD_TIME = "";
const DEFAULT_SYSTEM_PROMPT_SETTING = `


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



[Language & Style]
- Respond primarily in natural, fluent English, or in the user's language if they are not an English speaker, while keeping "Arona" and "Sensei" in English.
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
- This rule applies in all contexts, including Chinese responses, explanations, examples, titles, and roleplay.
- Any output that changes "Arona" into another form is considered incorrect behavior.
- "Sensei" MUST also remain unchanged in English at all times.

`;



const DEFAULT_MODEL_DEFS: Array<{ id: string; name: string }> = [
  { id: "google/gemini-3.5-flash", name: "Google: Gemini 3.5 Flash" },
  { id: "google/gemini-3-flash-preview", name: "Google: Gemini 3 Flash Preview" },
  { id: "openai/gpt-5-mini", name: "OpenAI: GPT-5 Mini" },
  { id: "google/gemini-3.1-pro-preview", name: "Google: Gemini 3.1 Pro Preview" },
  { id: "openai/gpt-5.5", name: "OpenAI: GPT-5.5" },
  { id: "openai/gpt-5.5-pro", name: "OpenAI: GPT-5.5 Pro" },
  { id: "anthropic/claude-sonnet-4.6", name: "Anthropic: Claude Sonnet 4.6" },
  { id: "anthropic/claude-opus-4.7", name: "Anthropic: Claude Opus 4.7" },
];

/*
  { id: "minimax/minimax-m2-her", name: "MiniMax: MiniMax M2-her" },
  { id: "xiaomi/mimo-v2-pro", name: "Xiaomi: Mimo V2 Pro" },
  { id: "qwen/qwen3-32b", name: "Qwen: Qwen3 32B" },
*/

const DEFAULT_PRICING: Record<string, { input_usd_per_million: number; output_usd_per_million: number }> = {
  "google/gemini-3.5-flash": { input_usd_per_million: 1.50, output_usd_per_million: 9.00 },
  "google/gemini-3-flash-preview": { input_usd_per_million: 0.50, output_usd_per_million: 3.00 },
  "openai/gpt-5-mini": { input_usd_per_million: 0.25, output_usd_per_million: 2.00 },
  "xiaomi/mimo-v2-pro": { input_usd_per_million: 1.00, output_usd_per_million: 3.00 },
  "qwen/qwen3-32b": { input_usd_per_million: 0.08, output_usd_per_million: 0.24 },
  "minimax/minimax-m2-her": { input_usd_per_million: 0.30, output_usd_per_million: 1.20 },
  "google/gemini-3.1-pro-preview": { input_usd_per_million: 2.00, output_usd_per_million: 12.00 },
  "openai/gpt-5.5": { input_usd_per_million: 5.00, output_usd_per_million: 30.00 },
  "openai/gpt-5.5-pro": { input_usd_per_million: 30.00, output_usd_per_million: 180.00 },
  "anthropic/claude-sonnet-4.6": { input_usd_per_million: 3.00, output_usd_per_million: 15.00 },
  "anthropic/claude-opus-4.7": { input_usd_per_million: 5.00, output_usd_per_million: 25.00 },
};

type AppContext = Context<AppConfig>;

type AuthTokenPayload = {
  sub: "single-user";
  method: "password" | "passkey";
  iat: number;
  exp: number;
};

type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh" ;

type ChatSettings = {
  reasoning_effort: ReasoningEffort;
  max_output_tokens: number;
  daily_budget_usd: number;
  web_search_enabled: boolean;
  web_search_max_results: number;
};

type AttachmentRow = {
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

type LibraryFileRow = {
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

type AttachmentSource = "attachments" | "library_files";

type ProfileRow = {
  username: string;
  avatar_key: string | null;
  avatar_url_cache: string | null;
  avatar_url_cache_expires_at: number | null;
  dynamic_background: number;
  send_shortcut: string | null;
  conversation_library_enabled: number;
  updated_at: number;
};

type PasskeyRow = {
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

type UsageSummaryRow = {
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
};

type UsageByModelRow = {
  model: string;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
};

type OpenRouterUsage = {
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

type TitleGenerationResult = {
  title: string | null;
  usage: OpenRouterUsage | null;
  model: string;
};

type OpenRouterContentPart = {
  type: "text";
  text: string;
};

type OpenRouterImagePart = {
  type: "image_url";
  image_url: {
    url: string;
  };
};

type OpenRouterFilePart = {
  type: "file";
  file: {
    filename: string;
    file_data: string;
  };
};

type OpenRouterInputAudioPart = {
  type: "input_audio";
  input_audio: {
    data: string;
    format: "wav" | "mp3";
  };
};

type ChatAttachmentPayload = {
  id: string;
  file_name: string;
  mime_type: string;
  size: number;
  url: string;
  type: MessageAttachmentType;
};

type OpenRouterMessage = {
  role: "user" | "assistant" | "system";
  content: string | Array<OpenRouterContentPart | OpenRouterImagePart | OpenRouterFilePart | OpenRouterInputAudioPart>;
};

type ResponsesInputTextPart = {
  type: "input_text";
  text: string;
};

type ResponsesInputImagePart = {
  type: "input_image";
  image_url: string;
};

type ResponsesInputFilePart = {
  type: "input_file";
  filename: string;
  file_data: string;
};

type ResponsesInputAudioPart = {
  type: "input_audio";
  input_audio: {
    data: string;
    format: "wav" | "mp3";
  };
};

type ResponsesInputContentPart = ResponsesInputTextPart | ResponsesInputImagePart | ResponsesInputFilePart | ResponsesInputAudioPart;

type SessionMessageRow = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null;
  reasoning_summary: string | null;
  created_at: number;
};

type SessionMessage = SessionMessageRow & {
  attachments: ChatAttachmentPayload[];
};

type WorkspaceRow = {
  id: string;
  name: string;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
};

type AttachmentModelMeta = {
  id: string;
  file_name: string | null;
  mime_type: string | null;
  r2_url: string;
  r2_object_key: string | null;
  source: AttachmentSource;
};

type MessageAttachmentJoinRow = {
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

type ChatStreamJobState = "queued" | "running" | "completed" | "failed" | "cancelled";

type ChatStreamSubmitPayload = {
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

type ChatStreamStoredJob = {
  job_id: string;
  state: ChatStreamJobState;
  client_request_id: string | null;
  payload: Pick<ChatStreamSubmitPayload, "session_id" | "user_id" | "user_message_id" | "new_session">;
  cursor: number | null;
  created_at: number;
  updated_at: number;
  error: string | null;
};

type ChatStreamRecoveryRow = {
  session_id: string;
  job_id: string;
  state: ChatStreamJobState;
  cursor: number | null;
  user_message_id: string;
  created_at: number;
  updated_at: number;
  error: string | null;
};

type ChatStreamEventType =
  | "user_message"
  | "job_started"
  | "content_delta"
  | "reasoning_delta"
  | "job_completed"
  | "job_failed";

type ChatStreamEvent = {
  sequence: number;
  job_id: string;
  type: ChatStreamEventType;
  payload: Record<string, unknown>;
  created_at: number;
};

let schemaReady = false;
let schemaReadyPromise: Promise<void> | null = null;
let logLevelCache: { value: LogLevel; expiresAt: number } | null = null;

const hasColumn = async (db: D1Database, tableName: string, columnName: string): Promise<boolean> => {
  const safeTableName = tableName.replace(/"/g, "\"\"");
  const { results } = await db.prepare(`PRAGMA table_info("${safeTableName}")`).all<{ name: string }>();
  return (results ?? []).some((column) => column.name === columnName);
};

const addColumnIfMissing = async (
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

const applySchemaV1 = async (db: D1Database): Promise<void> => {
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

const applySchemaV2 = async (db: D1Database): Promise<void> => {
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

const applySchemaV3 = async (db: D1Database): Promise<void> => {
  await addColumnIfMissing(db, "usage_records", "prompt_cached_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "usage_records", "prompt_cache_write_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "usage_records", "prompt_audio_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "usage_records", "prompt_video_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "usage_records", "completion_reasoning_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "usage_records", "completion_image_tokens", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "usage_records", "completion_audio_tokens", "INTEGER NOT NULL DEFAULT 0");
};

const applySchemaV4 = async (db: D1Database): Promise<void> => {
  await addColumnIfMissing(db, "attachments", "status", "TEXT NOT NULL DEFAULT 'active'");
  await addColumnIfMissing(db, "attachments", "user_id", "TEXT");
  await addColumnIfMissing(db, "attachments", "conversation_id", "TEXT");
};

const applySchemaV5 = async (db: D1Database): Promise<void> => {
  await addColumnIfMissing(db, "user_profile", "send_shortcut", "TEXT NOT NULL DEFAULT 'ctrl_enter'");
};

const applySchemaV6 = async (db: D1Database): Promise<void> => {
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id)").run();
};

const applySchemaV7 = async (db: D1Database): Promise<void> => {
  await addColumnIfMissing(db, "messages", "reasoning_summary", "TEXT");
};

const applySchemaV8 = async (db: D1Database): Promise<void> => {
  await addColumnIfMissing(db, "sessions", "archived_at", "INTEGER");
  await addColumnIfMissing(db, "sessions", "pinned_at", "INTEGER");
};

const applySchemaV9 = async (db: D1Database): Promise<void> => {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS library_files (id TEXT PRIMARY KEY, file_name TEXT, mime_type TEXT, size INTEGER, r2_url TEXT, r2_object_key TEXT, cached_get_url TEXT, cached_get_url_expires_at INTEGER, status TEXT NOT NULL DEFAULT 'active', user_id TEXT, created_at INTEGER)",
    )
    .run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_library_files_user_created_at ON library_files(user_id, created_at DESC)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_library_files_status_user ON library_files(status, user_id)").run();
};

const applySchemaV10 = async (db: D1Database): Promise<void> => {
  await addColumnIfMissing(db, "user_profile", "conversation_library_enabled", "INTEGER NOT NULL DEFAULT 1");
};

const applySchemaV11 = async (db: D1Database): Promise<void> => {
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

const applySchemaV12 = async (db: D1Database): Promise<void> => {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS chat_stream_jobs (session_id TEXT PRIMARY KEY, job_id TEXT NOT NULL, user_id TEXT NOT NULL, user_message_id TEXT NOT NULL, cursor INTEGER, state TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, error TEXT)",
    )
    .run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_chat_stream_jobs_user_state_updated ON chat_stream_jobs(user_id, state, updated_at DESC)").run();
};

const ensureDatabaseReady = async (db: D1Database): Promise<void> => {
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

type SerializedError = {
  name?: string;
  message: string;
  stack?: string;
};

const serializeError = (error: unknown): SerializedError => {
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

const buildRequestLogPayload = (c: AppContext): Record<string, unknown> => ({
  request_id: c.get("requestId") ?? "unknown",
  method: c.req.method,
  path: new URL(c.req.url).pathname,
});

const logInfo = (event: string, payload: Record<string, unknown>): void => {
  console.log(`[INFO] ${event}`, payload);
};

const logTrace = (event: string, payload: Record<string, unknown>): void => {
  console.log(`[TRACE] ${event}`, payload);
};

const logError = (event: string, payload: Record<string, unknown>, error?: unknown): void => {
  if (error === undefined) {
    console.error(`[ERROR] ${event}`, payload);
    return;
  }
  console.error(`[ERROR] ${event}`, {
    ...payload,
    error: serializeError(error),
  });
};

const normalizeLogLevel = (value: string | null | undefined): LogLevel => {
  if (!value) {
    return DEFAULT_LOG_LEVEL;
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === "TRACE") {
    return "TRACE";
  }
  return "INFO";
};

const formatTraceText = (text: string): string =>
  text.length <= TRACE_LOG_MAX_CHARS
    ? text
    : `${text.slice(0, TRACE_LOG_MAX_CHARS)}...<truncated ${text.length - TRACE_LOG_MAX_CHARS} chars>`;

const isJsonLikeContentType = (contentType: string): boolean => {
  const normalized = contentType.toLowerCase();
  return normalized.includes("application/json") || normalized.includes("+json");
};

const isTextLikeContentType = (contentType: string): boolean => {
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

const isEventStreamContentType = (contentType: string): boolean => contentType.toLowerCase().includes("text/event-stream");

const parseTraceBody = (rawText: string, contentType: string): unknown => {
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

const readTraceRequestBody = async (request: Request): Promise<unknown> => {
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
  return parseTraceBody(rawText, contentType);
};

const readTraceResponseBody = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (!isTextLikeContentType(contentType)) {
    return {
      type: "non-text",
      content_type: contentType || "unknown",
      content_length: Number(response.headers.get("content-length") ?? 0) || null,
    };
  }
  const rawText = await response.clone().text();
  return parseTraceBody(rawText, contentType);
};

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const toPlainUint8Array = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => {
  const plain: Uint8Array<ArrayBuffer> = new Uint8Array(bytes.byteLength);
  plain.set(bytes);
  return plain;
};

const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const getAuthSecret = (env: Env): string => {
  return env.AUTH_TOKEN_SECRET || env.AI_API_KEY;
};

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

const signJwt = async (value: string, secret: string): Promise<string> => {
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

const issueAuthToken = async (env: Env, method: AuthTokenPayload["method"]): Promise<string> => {
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

const verifyAuthToken = async (env: Env, token: string): Promise<AuthTokenPayload | null> => {
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

const requireAuth = async (c: AppContext): Promise<AuthTokenPayload | Response> => {
  const authorization = c.req.header("Authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return c.json({ error: "Authentication required." }, 401);
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    return c.json({ error: "Authentication required." }, 401);
  }

  const payload = await verifyAuthToken(c.env, token);
  if (!payload) {
    return c.json({ error: "Invalid or expired token." }, 401);
  }

  return payload;
};

const sanitizeFileName = (value: string): string => {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized.length > 0 ? sanitized.slice(0, 128) : "file";
};

const sanitizePathSegment = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "unknown";
  }
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);
};

const normalizeConversationId = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed || !/^[a-zA-Z0-9._-]{1,128}$/.test(trimmed)) {
    throw new Error(
      "conversationId must contain only letters, numbers, dots, underscores, or hyphens (1-128 chars).",
    );
  }
  return trimmed;
};

const normalizeSendShortcut = (value: string | null | undefined): "ctrl_enter" | "enter" => {
  if (value === "enter") {
    return "enter";
  }
  return "ctrl_enter";
};

const normalizeMimeType = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase();

const isAvatarMimeTypeAllowed = (mimeType: string): boolean => /^image\/[a-z0-9.+-]+$/i.test(mimeType);

const readContentLength = (c: AppContext): number | null => {
  const header = c.req.header("content-length")?.trim();
  if (!header) {
    return null;
  }
  const parsed = Number(header);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const normalizeEndpoint = (value: string): string => value.replace(/\/+$/g, "");

const parseObjectKeyFromUrl = (url: string, endpoint: string): string | null => {
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

const buildObjectUrl = (endpoint: string, objectKey: string): string => {
  const encodedKey = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${normalizeEndpoint(endpoint)}/${encodedKey}`;
};

const buildSignedFileProxyPath = async (
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

const toAbsoluteUrl = (c: AppContext, value: string): string => {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return new URL(value, c.req.url).toString();
};

const isAuthenticatedFileProxyUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value, "http://localhost");
    return AUTHENTICATED_FILE_PROXY_PATH_RE.test(parsed.pathname) || parsed.pathname === "/p";
  } catch {
    return AUTHENTICATED_FILE_PROXY_PATH_RE.test(value) || value.startsWith("/p?");
  }
};

const verifyModelFileUrlSignature = async (
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

const isAllowedR2ObjectKey = (objectKey: string): boolean =>
  objectKey.length > 0 &&
  !objectKey.includes("..") &&
  (objectKey.startsWith("avatars/") || objectKey.startsWith("attachments/") || objectKey.startsWith("library/"));

const isOwnedObjectKey = async (db: D1Database, objectKey: string, userId: string): Promise<boolean> => {
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

const inferAudioFormat = (mimeType: string | null): "wav" | "mp3" | null => {
  const normalized = normalizeMimeType(mimeType);
  if (normalized === "audio/wav" || normalized === "audio/x-wav" || normalized === "audio/wave") {
    return "wav";
  }
  if (normalized === "audio/mpeg" || normalized === "audio/mp3") {
    return "mp3";
  }
  return null;
};

const toBase64 = (bytes: Uint8Array): string => {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const slice = bytes.subarray(index, index + chunkSize);
    chunks.push(String.fromCharCode(...slice));
  }
  return btoa(chunks.join(""));
};

const buildPublicUrl = (env: Env, objectKey: string): string | null => {
  return null;
};

const createAwsClient = (env: Env): AwsClient => {
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

const getR2Endpoint = (env: Env): string => {
  if (!env.R2_ENDPOINT) {
    throw new Error("R2 endpoint is not configured.");
  }
  return normalizeEndpoint(env.R2_ENDPOINT);
};

const createGetUrl = async (
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

const resolveDirectAccessUrl = async (
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

const UPLOADING_STALE_TTL_MS = 24 * 60 * 60 * 1000;
const UPLOADING_STALE_CLEANUP_BATCH = 50;

const cleanupStaleUploadingAttachments = async (db: D1Database, env: Env): Promise<void> => {
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

const cleanupStaleUploadingLibraryFiles = async (db: D1Database, env: Env): Promise<void> => {
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

const saveChallenge = async (db: D1Database, id: string, challenge: string): Promise<void> => {
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO auth_challenges (id, challenge, created_at, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET challenge = excluded.challenge, created_at = excluded.created_at, expires_at = excluded.expires_at",
    )
    .bind(id, challenge, now, now + CHALLENGE_TTL_MS)
    .run();
};

const consumeChallenge = async (db: D1Database, id: string): Promise<string | null> => {
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

const parseTransports = (raw: string | null): AuthenticatorTransportFuture[] | undefined => {
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

const listPasskeys = async (db: D1Database): Promise<PasskeyRow[]> => {
  const { results } = await db
    .prepare(
      "SELECT credential_id, public_key, counter, transports, device_type, backed_up, nickname, created_at, last_used_at FROM auth_passkeys ORDER BY created_at DESC",
    )
    .all<PasskeyRow>();
  return results ?? [];
};

const toPasskeyInfo = (row: PasskeyRow): PasskeyInfo => ({
  id: row.credential_id,
  nickname: row.nickname,
  device_type: row.device_type,
  backed_up: Boolean(row.backed_up),
  transports: parseTransports(row.transports) ?? [],
  created_at: Number(row.created_at),
  last_used_at: row.last_used_at ? Number(row.last_used_at) : null,
});

const ensureProfile = async (db: D1Database): Promise<void> => {
  await db
    .prepare("INSERT OR IGNORE INTO user_profile (id, username, dynamic_background, send_shortcut, updated_at) VALUES (1, ?, 1, 'ctrl_enter', ?)")
    .bind("Sensei", Date.now())
    .run();
};

const readProfile = async (c: AppContext): Promise<UserProfile> => {
  const db = c.env.D1_DB;
  await ensureProfile(db);
  const row = await db
    .prepare(
      "SELECT username, avatar_key, avatar_url_cache, avatar_url_cache_expires_at, dynamic_background, send_shortcut, conversation_library_enabled, updated_at FROM user_profile WHERE id = 1",
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

  return {
    username: row.username,
    avatar_key: avatarKey,
    avatar_url: avatarUrl,
    dynamic_background: Number(row.dynamic_background) === 1,
    send_shortcut: normalizeSendShortcut(row.send_shortcut),
    conversation_library_enabled: Number(row.conversation_library_enabled ?? 1) === 1,
    updated_at: Number(row.updated_at),
  };
};

const getAppSetting = async (db: D1Database, key: string): Promise<string | null> => {
  const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").bind(key).first<{ value: string }>();
  if (!row?.value) {
    return null;
  }
  const trimmed = row.value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const setAppSetting = async (db: D1Database, key: string, value: string): Promise<void> => {
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(key, value, now)
    .run();
};

const getLogLevel = async (db: D1Database): Promise<LogLevel> => {
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

const setLogLevel = async (db: D1Database, logLevel: LogLevel): Promise<void> => {
  await setAppSetting(db, "log_level", logLevel);
  logLevelCache = null;
};

const getSelectedModel = async (db: D1Database): Promise<string> => {
  const value = await getAppSetting(db, "selected_model");
  return value ?? DEFAULT_MODEL;
};

const setSelectedModel = async (db: D1Database, model: string): Promise<void> => {
  await setAppSetting(db, "selected_model", model);
};

const getTitleModel = async (db: D1Database): Promise<string> => {
  const value = await getAppSetting(db, "title_model");
  if (value) {
    return value;
  }
  return getSelectedModel(db);
};

const setTitleModel = async (db: D1Database, model: string): Promise<void> => {
  await setAppSetting(db, "title_model", model);
};

const normalizeReasoningEffort = (value: string | null | undefined): ReasoningEffort => {
  if (value === "minimal" || value === "low" || value === "medium" || value === "high" || value === "xhigh") {
    return value;
  }
  return "medium";
};

const normalizeMaxOutputTokens = (value: string | null | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 9000;
  }
  return Math.min(64000, Math.max(1, Math.round(parsed)));
};

const normalizeDailyBudgetUsd = (value: string | null | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.min(1000000, Math.max(0.01, Number(parsed.toFixed(4))));
};

const normalizeWebSearchEnabled = (value: string | null | undefined): boolean => {
  if (!value) {
    return false;
  }
  return value === "1" || value.toLowerCase() === "true";
};

const normalizeWebSearchMaxResults = (value: string | null | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 5;
  }
  return Math.min(25, Math.max(1, Math.round(parsed)));
};

const getChatSettings = async (db: D1Database): Promise<ChatSettings> => {
  const [reasoningEffort, maxOutputTokens, dailyBudgetUsd, webSearchEnabled, webSearchMaxResults] = await Promise.all([
    getAppSetting(db, "reasoning_effort"),
    getAppSetting(db, "max_output_tokens"),
    getAppSetting(db, "daily_budget_usd"),
    getAppSetting(db, "web_search_enabled"),
    getAppSetting(db, "web_search_max_results"),
  ]);
  return {
    reasoning_effort: normalizeReasoningEffort(reasoningEffort),
    max_output_tokens: normalizeMaxOutputTokens(maxOutputTokens),
    daily_budget_usd: normalizeDailyBudgetUsd(dailyBudgetUsd),
    web_search_enabled: normalizeWebSearchEnabled(webSearchEnabled),
    web_search_max_results: normalizeWebSearchMaxResults(webSearchMaxResults),
  };
};

const normalizeSessionTitle = (value: string): string => {
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/^["'“”‘’\s]+/, "")
    .replace(/["'“”‘’\s]+$/, "")
    .trim();
  return cleaned.slice(0, MAX_SESSION_TITLE_LENGTH);
};

const extractModelMessageContent = (value: unknown): string => {
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
const extractResponseCompletedText = (response: Record<string, unknown> | null): string => {
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

const buildAssistantContentEventPayload = (content: string): string =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

const resolveAttachmentType = (mimeType: string): MessageAttachmentType => {
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

const buildOpenRouterMessageContent = async (
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

const toResponsesInputContent = (
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

const isChatCompletionsEndpoint = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.pathname.endsWith("/chat/completions");
  } catch {
    const pathWithoutQuery = value.split("?")[0]?.split("#")[0] ?? value;
    return pathWithoutQuery.endsWith("/chat/completions");
  }
};

const generateSessionTitle = async (
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

type TitleGenerationContext = {
  env: Env;
  requestUrl: string;
  requestId: string;
  logLevel: LogLevel;
};

const buildTitleRequestLogPayload = (context: TitleGenerationContext): Record<string, unknown> => {
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

const generateSessionTitleWithContext = async (
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

const getSystemPromptSetting = async (db: D1Database, env: Env): Promise<string> => {
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

const normalizeSystemPromptTimezone = (value: string | null | undefined): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_SYSTEM_PROMPT_TIMEZONE;
  }
  const matched = SYSTEM_PROMPT_TIMEZONE_OPTIONS.find((item) => item.value === trimmed);
  return matched?.value ?? DEFAULT_SYSTEM_PROMPT_TIMEZONE;
};

const getSystemPromptTimezone = async (db: D1Database): Promise<string> => {
  const value = await getAppSetting(db, "system_prompt_timezone");
  return normalizeSystemPromptTimezone(value);
};

const getShowArchivedSessions = async (db: D1Database): Promise<boolean> => {
  const value = await getAppSetting(db, "show_archived_sessions");
  return value === "1";
};

const listWorkspaces = async (db: D1Database, includeArchived: boolean): Promise<WorkspaceRow[]> => {
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

const resolveDefaultWorkspaceId = async (db: D1Database): Promise<string> => {
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

const getActiveWorkspaceId = async (db: D1Database): Promise<string> => {
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

const formatSystemPromptDateTime = (timeZone: string): { value: string; resolvedTimeZone: string } => {
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

const buildInjectedSystemPrompt = async (db: D1Database, env: Env): Promise<string> => {
  const setting = await getSystemPromptSetting(db, env);
  const timeZone = await getSystemPromptTimezone(db);
  const formattedDateTime = formatSystemPromptDateTime(timeZone);
  const timezoneLabel =
    SYSTEM_PROMPT_TIMEZONE_OPTIONS.find((item) => item.value === formattedDateTime.resolvedTimeZone)?.label ??
    formattedDateTime.resolvedTimeZone;
  const currentDateTime = formattedDateTime.value;
  return `${setting}\nCurrent date and time (${timezoneLabel}): ${currentDateTime}\nUse this information only when relevant. Do not mention it unnecessarily.`;
};

const normalizePasskeyRpName = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Passkey RP Name is required.");
  }
  if (trimmed.length > 80) {
    throw new Error("Passkey RP Name must be <= 80 characters.");
  }
  return trimmed;
};

const normalizePasskeyRpId = (value: string): string => {
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

const normalizePasskeyOrigin = (value: string): string => {
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

const getPasskeyConfig = async (c: AppContext): Promise<PasskeyConfig> => {
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

const parsePricingConfig = (env: Env): Record<string, { input_usd_per_million: number; output_usd_per_million: number }> => {
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

const resolvePricing = (
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

const calculateCostUsd = (
  model: string,
  usage: OpenRouterUsage | null,
  pricingTable: Record<string, { input_usd_per_million: number; output_usd_per_million: number }>,
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

  const promptTokens = Number(usage.prompt_tokens ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? 0);
  const usd =
    (promptTokens / 1_000_000) * pricing.input_usd_per_million +
    (completionTokens / 1_000_000) * pricing.output_usd_per_million;
  return Number(usd.toFixed(8));
};

const hasUsageMetrics = (usage: OpenRouterUsage): boolean =>
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

const toFiniteNumber = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const parseOpenRouterUsage = (value: unknown): OpenRouterUsage | null => {
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

const insertUsageRecord = async (
  db: D1Database,
  sessionId: string,
  model: string,
  usage: OpenRouterUsage | null,
  pricingTable: Record<string, { input_usd_per_million: number; output_usd_per_million: number }>,
): Promise<void> => {
  if (!usage || !hasUsageMetrics(usage)) {
    return;
  }
  const costUsd = calculateCostUsd(model, usage, pricingTable);
  await db
    .prepare("INSERT INTO usage_records (id, session_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(
      crypto.randomUUID(),
      sessionId,
      model,
      toFiniteNumber(usage.prompt_tokens),
      toFiniteNumber(usage.completion_tokens),
      toFiniteNumber(usage.total_tokens),
      costUsd,
      Date.now(),
    )
    .run();
};

const buildModelOptions = (
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

const resolveAttachmentObjectKey = async (c: AppContext, attachment: AttachmentModelMeta): Promise<string | null> => {
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

const resolveModelReadableAttachmentUrl = async (c: AppContext, attachment: AttachmentModelMeta): Promise<string | null> => {
  const objectKey = await resolveAttachmentObjectKey(c, attachment);
  if (!objectKey) {
    return null;
  }
  return toAbsoluteUrl(c, await buildSignedFileProxyPath(c, objectKey, AI_FILE_URL_TTL_SECONDS));
};

const resolveStoredFileAccessUrl = async (
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

const resolveAttachmentAccessUrl = async (c: AppContext, attachment: AttachmentRow): Promise<string> =>
  resolveStoredFileAccessUrl(c, attachment, "attachments");

const resolveLibraryAccessUrl = async (c: AppContext, attachment: LibraryFileRow): Promise<string> =>
  resolveStoredFileAccessUrl(c, attachment, "library_files");

const toChatAttachmentPayload = async (c: AppContext, attachment: MessageAttachmentJoinRow): Promise<ChatAttachmentPayload | null> => {
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

const getMessageAttachmentsMap = async (
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

const listSessionMessages = async (c: AppContext, sessionId: string, userId: string): Promise<SessionMessage[]> => {
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

app.post("/api/auth/password-login", async (c) => {
  const body = await c.req.json<{ password?: string }>();
  const password = body.password?.trim();

  if (!c.env.AUTH_PASSWORD) {
    logError("auth.password_login_misconfigured", buildRequestLogPayload(c));
    return c.json({ error: "AUTH_PASSWORD is not configured on server." }, 500);
  }
  if (!password || !timingSafeEqual(password, c.env.AUTH_PASSWORD)) {
    logInfo("auth.password_login_rejected", buildRequestLogPayload(c));
    return c.json({ error: "Invalid password." }, 401);
  }

  const token = await issueAuthToken(c.env, "password");
  logInfo("auth.password_login_succeeded", buildRequestLogPayload(c));
  return c.json({ token });
});

app.post("/api/auth/passkeys/auth-options", async (c) => {
  const passkeys = await listPasskeys(c.env.D1_DB);
  if (passkeys.length === 0) {
    return c.json({ error: "No passkey is registered yet." }, 400);
  }
  const passkeyConfig = await getPasskeyConfig(c);

  const options = await generateAuthenticationOptions({
    rpID: passkeyConfig.rp_id,
    userVerification: "preferred",
    allowCredentials: passkeys.map((passkey) => ({
      id: passkey.credential_id as Base64URLString,
      transports: parseTransports(passkey.transports),
    })),
  });

  await saveChallenge(c.env.D1_DB, "passkey-auth", options.challenge);
  return c.json({ options });
});

app.post("/api/auth/passkeys/auth-verify", async (c) => {
  const body = await c.req.json<{ response?: AuthenticationResponseJSON }>();
  if (!body.response) {
    return c.json({ error: "Passkey response is required." }, 400);
  }

  const challenge = await consumeChallenge(c.env.D1_DB, "passkey-auth");
  if (!challenge) {
    return c.json({ error: "Passkey challenge expired, please retry." }, 400);
  }

  const passkey = await c.env.D1_DB
    .prepare(
      "SELECT credential_id, public_key, counter, transports, device_type, backed_up, nickname, created_at, last_used_at FROM auth_passkeys WHERE credential_id = ?",
    )
    .bind(body.response.id)
    .first<PasskeyRow>();

  if (!passkey) {
    return c.json({ error: "Passkey not found." }, 404);
  }

  const credential: WebAuthnCredential = {
    id: passkey.credential_id as Base64URLString,
    publicKey: fromBase64Url(passkey.public_key),
    counter: Number(passkey.counter),
    transports: parseTransports(passkey.transports),
  };
  const passkeyConfig = await getPasskeyConfig(c);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: passkeyConfig.origin,
      expectedRPID: passkeyConfig.rp_id,
      credential,
      requireUserVerification: true,
    });
  } catch (error) {
    logError("auth.passkey_verify_failed", buildRequestLogPayload(c), error);
    const message = error instanceof Error ? error.message : "Passkey verification failed.";
    return c.json({ error: message }, 400);
  }

  if (!verification.verified) {
    return c.json({ error: "Passkey verification failed." }, 400);
  }

  await c.env.D1_DB
    .prepare("UPDATE auth_passkeys SET counter = ?, last_used_at = ? WHERE credential_id = ?")
    .bind(verification.authenticationInfo.newCounter, Date.now(), passkey.credential_id)
    .run();

  const token = await issueAuthToken(c.env, "passkey");
  logInfo("auth.passkey_login_succeeded", buildRequestLogPayload(c));
  return c.json({ token });
});

app.post("/api/auth/passkeys/register-options", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const db = c.env.D1_DB;
  const profile = await readProfile(c);
  const passkeys = await listPasskeys(db);
  const passkeyConfig = await getPasskeyConfig(c);

  const options = await generateRegistrationOptions({
    rpName: passkeyConfig.rp_name,
    rpID: passkeyConfig.rp_id,
    userName: profile.username || "Sensei",
    userDisplayName: profile.username || "Sensei",
    userID: toPlainUint8Array(encoder.encode("arona-single-user")),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials: passkeys.map((passkey) => ({
      id: passkey.credential_id as Base64URLString,
      transports: parseTransports(passkey.transports),
    })),
  });

  await saveChallenge(db, "passkey-register", options.challenge);
  return c.json({ options });
});

app.post("/api/auth/passkeys/register-verify", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{ response?: RegistrationResponseJSON; nickname?: string }>();
  if (!body.response) {
    return c.json({ error: "Passkey response is required." }, 400);
  }

  const challenge = await consumeChallenge(c.env.D1_DB, "passkey-register");
  if (!challenge) {
    return c.json({ error: "Passkey challenge expired, please retry." }, 400);
  }
  const passkeyConfig = await getPasskeyConfig(c);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: passkeyConfig.origin,
      expectedRPID: passkeyConfig.rp_id,
      requireUserVerification: true,
    });
  } catch (error) {
    logError("auth.passkey_register_verify_failed", buildRequestLogPayload(c), error);
    const message = error instanceof Error ? error.message : "Passkey registration failed.";
    return c.json({ error: message }, 400);
  }

  if (!verification.verified || !verification.registrationInfo) {
    return c.json({ error: "Passkey registration failed." }, 400);
  }

  const credential = verification.registrationInfo.credential;
  const nickname = body.nickname?.trim() || null;
  const now = Date.now();
  await c.env.D1_DB
    .prepare(
      "INSERT INTO auth_passkeys (credential_id, public_key, counter, transports, device_type, backed_up, nickname, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(credential_id) DO UPDATE SET public_key = excluded.public_key, counter = excluded.counter, transports = excluded.transports, device_type = excluded.device_type, backed_up = excluded.backed_up, nickname = excluded.nickname",
    )
    .bind(
      credential.id,
      toBase64Url(credential.publicKey),
      credential.counter,
      credential.transports ? JSON.stringify(credential.transports) : null,
      verification.registrationInfo.credentialDeviceType,
      verification.registrationInfo.credentialBackedUp ? 1 : 0,
      nickname,
      now,
    )
    .run();

  logInfo("auth.passkey_register_succeeded", buildRequestLogPayload(c));
  return c.json({ success: true });
});

app.get("/api/auth/passkeys", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const passkeys = await listPasskeys(c.env.D1_DB);
  return c.json({ passkeys: passkeys.map(toPasskeyInfo) });
});

app.delete("/api/auth/passkeys/:id", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const credentialId = c.req.param("id");
  if (!credentialId) {
    return c.json({ error: "Credential id is required." }, 400);
  }
  await c.env.D1_DB.prepare("DELETE FROM auth_passkeys WHERE credential_id = ?").bind(credentialId).run();
  return c.json({ success: true });
});

app.get("/api/auth/me", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const db = c.env.D1_DB;
  const profile = await readProfile(c);
  const [selectedModel, titleModel, chatSettings, logLevel, systemPromptTimezone, showArchivedSessions, activeWorkspaceId] = await Promise.all([
    getSelectedModel(db),
    getTitleModel(db),
    getChatSettings(db),
    getLogLevel(db),
    getSystemPromptTimezone(db),
    getShowArchivedSessions(db),
    getActiveWorkspaceId(db),
  ]);
  const passkeyCountRow = await db.prepare("SELECT COUNT(*) as count FROM auth_passkeys").first<{ count: number }>();

  return c.json({
    authenticated: true,
    method: auth.method,
    profile,
    selected_model: selectedModel,
    title_model: titleModel,
    chat_settings: chatSettings,
    log_level: logLevel,
    system_prompt_timezone: systemPromptTimezone,
    show_archived_sessions: showArchivedSessions,
    active_workspace_id: activeWorkspaceId,
    passkey_count: Number(passkeyCountRow?.count ?? 0),
    ...readBackendBuildInfo(c.env),
  });
});

app.get("/api/models", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const pricingTable = parsePricingConfig(c.env);
  const [selectedModel, titleModel, chatSettings, logLevel, systemPromptTimezone, showArchivedSessions, activeWorkspaceId] = await Promise.all([
    getSelectedModel(c.env.D1_DB),
    getTitleModel(c.env.D1_DB),
    getChatSettings(c.env.D1_DB),
    getLogLevel(c.env.D1_DB),
    getSystemPromptTimezone(c.env.D1_DB),
    getShowArchivedSessions(c.env.D1_DB),
    getActiveWorkspaceId(c.env.D1_DB),
  ]);
  return c.json({
    selected_model: selectedModel,
    title_model: titleModel,
    chat_settings: chatSettings,
    log_level: logLevel,
    system_prompt_timezone: systemPromptTimezone,
    show_archived_sessions: showArchivedSessions,
    active_workspace_id: activeWorkspaceId,
    models: buildModelOptions(pricingTable, selectedModel, titleModel),
    ...readBackendBuildInfo(c.env),
  });
});

app.put("/api/settings/model", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{ model?: string }>();
  const model = body.model?.trim();
  if (!model) {
    return c.json({ error: "Model is required." }, 400);
  }

  await setSelectedModel(c.env.D1_DB, model);
  return c.json({ selected_model: model });
});

app.put("/api/settings/title-model", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{ model?: string }>();
  const model = body.model?.trim();
  if (!model) {
    return c.json({ error: "Model is required." }, 400);
  }

  await setTitleModel(c.env.D1_DB, model);
  return c.json({ title_model: model });
});

app.put("/api/settings/chat", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<Partial<ChatSettings>>();
  const current = await getChatSettings(c.env.D1_DB);
  const next: ChatSettings = {
    reasoning_effort: normalizeReasoningEffort(body.reasoning_effort ?? current.reasoning_effort),
    max_output_tokens: normalizeMaxOutputTokens(
      body.max_output_tokens === undefined ? String(current.max_output_tokens) : String(body.max_output_tokens),
    ),
    web_search_enabled:
      body.web_search_enabled === undefined ? current.web_search_enabled : Boolean(body.web_search_enabled),
    daily_budget_usd: normalizeDailyBudgetUsd(body.daily_budget_usd === undefined ? String(current.daily_budget_usd) : String(body.daily_budget_usd)),
    web_search_max_results: normalizeWebSearchMaxResults(
      body.web_search_max_results === undefined ? String(current.web_search_max_results) : String(body.web_search_max_results),
    ),
  };

  await Promise.all([
    setAppSetting(c.env.D1_DB, "reasoning_effort", next.reasoning_effort),
    setAppSetting(c.env.D1_DB, "max_output_tokens", String(next.max_output_tokens)),
    setAppSetting(c.env.D1_DB, "daily_budget_usd", String(next.daily_budget_usd)),
    setAppSetting(c.env.D1_DB, "web_search_enabled", next.web_search_enabled ? "1" : "0"),
    setAppSetting(c.env.D1_DB, "web_search_max_results", String(next.web_search_max_results)),
  ]);

  return c.json({ chat_settings: next });
});

app.put("/api/settings/log-level", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{ log_level?: string }>();
  const rawLogLevel = body.log_level?.trim();
  if (!rawLogLevel) {
    return c.json({ error: "log_level is required." }, 400);
  }
  const normalized = rawLogLevel.toUpperCase();
  if (normalized !== "INFO" && normalized !== "TRACE") {
    return c.json({ error: "log_level must be INFO or TRACE." }, 400);
  }
  const nextLogLevel = normalized as LogLevel;
  await setLogLevel(c.env.D1_DB, nextLogLevel);
  return c.json({ log_level: nextLogLevel });
});

app.put("/api/settings/system-prompt-timezone", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{ timezone?: string }>();
  const timezone = body.timezone?.trim();
  if (!timezone) {
    return c.json({ error: "timezone is required." }, 400);
  }
  if (!SYSTEM_PROMPT_TIMEZONE_OPTIONS.some((item) => item.value === timezone)) {
    return c.json({ error: "Unsupported timezone." }, 400);
  }
  await setAppSetting(c.env.D1_DB, "system_prompt_timezone", timezone);
  return c.json({ system_prompt_timezone: timezone });
});

app.put("/api/settings/show-archived-sessions", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{ show_archived_sessions?: boolean }>();
  const showArchivedSessions = Boolean(body.show_archived_sessions);
  await setAppSetting(c.env.D1_DB, "show_archived_sessions", showArchivedSessions ? "1" : "0");
  return c.json({ show_archived_sessions: showArchivedSessions });
});

app.get("/api/profile", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const profile = await readProfile(c);
  return c.json({ profile });
});

app.put("/api/profile", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{
    username?: string;
    avatar_key?: string | null;
    dynamic_background?: boolean;
    send_shortcut?: "ctrl_enter" | "enter";
    conversation_library_enabled?: boolean;
  }>();

  const currentProfile = await readProfile(c);
  const username = body.username === undefined ? currentProfile.username : body.username.trim();
  if (!username || username.length > 40) {
    return c.json({ error: "Username must be 1-40 characters." }, 400);
  }

  const nextAvatarKey = body.avatar_key === undefined ? currentProfile.avatar_key : body.avatar_key;
  const nextDynamicBackground =
    body.dynamic_background === undefined ? currentProfile.dynamic_background : Boolean(body.dynamic_background);
  const nextSendShortcut = body.send_shortcut === undefined ? currentProfile.send_shortcut : normalizeSendShortcut(body.send_shortcut);
  const nextConversationLibraryEnabled =
    body.conversation_library_enabled === undefined
      ? currentProfile.conversation_library_enabled
      : Boolean(body.conversation_library_enabled);

  await c.env.D1_DB
    .prepare(
      "UPDATE user_profile SET username = ?, avatar_key = ?, avatar_url_cache = NULL, avatar_url_cache_expires_at = NULL, dynamic_background = ?, send_shortcut = ?, conversation_library_enabled = ?, updated_at = ? WHERE id = 1",
    )
    .bind(
      username,
      nextAvatarKey,
      nextDynamicBackground ? 1 : 0,
      nextSendShortcut,
      nextConversationLibraryEnabled ? 1 : 0,
      Date.now(),
    )
    .run();

  const updatedProfile = await readProfile(c);
  return c.json({ profile: updatedProfile });
});

app.post("/api/profile/avatar/presign", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{ fileName?: string; mimeType?: string }>();
  const fileName = body.fileName?.trim();
  const mimeType = normalizeMimeType(body.mimeType);

  if (!fileName || !mimeType) {
    return c.json({ error: "fileName and mimeType are required." }, 400);
  }
  if (!isAvatarMimeTypeAllowed(mimeType)) {
    return c.json({ error: "Avatar mimeType must be an image/* type." }, 400);
  }

  const objectKey = `avatars/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
  const uploadUrl = toAbsoluteUrl(
    c,
    `/api/profile/avatar/upload?objectKey=${encodeURIComponent(objectKey)}&mimeType=${encodeURIComponent(mimeType)}`,
  );
  const directAccess = await resolveDirectAccessUrl(c, objectKey, USER_FILE_URL_TTL_SECONDS);
  return c.json({
    upload_url: uploadUrl,
    object_key: objectKey,
    public_url: directAccess.url,
  });
});

app.put("/api/profile/avatar/upload", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const objectKey = c.req.query("objectKey")?.trim();
  const mimeType = normalizeMimeType(
    c.req.query("mimeType")?.trim() || c.req.header("content-type")?.trim() || "application/octet-stream",
  );
  if (!objectKey || !objectKey.startsWith("avatars/")) {
    return c.json({ error: "Valid avatar objectKey is required." }, 400);
  }
  if (!isAvatarMimeTypeAllowed(mimeType)) {
    return c.json({ error: "Avatar mimeType must be an image/* type." }, 400);
  }
  const contentLength = readContentLength(c);
  if (contentLength === null || contentLength <= 0 || contentLength > MAX_AVATAR_BYTES) {
    return c.json({ error: `Avatar size must be between 1 and ${MAX_AVATAR_BYTES} bytes.` }, 400);
  }

  await c.env.R2_BUCKET.put(objectKey, c.req.raw.body, {
    httpMetadata: { contentType: mimeType },
  });

  return c.json({ success: true, object_key: objectKey });
});

app.get("/api/files/public", async (c) => {
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

  const object = await c.env.R2_BUCKET.get(objectKey);
  if (!object?.body) {
    return c.json({ error: "File not found." }, 404);
  }

  const headers = new Headers();
  if (object.httpMetadata?.contentType) {
    headers.set("Content-Type", object.httpMetadata.contentType);
  }
  headers.set("Cache-Control", "private, max-age=600");
  return new Response(object.body, { headers });
});

app.get("/api/files/*", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const rawPath = c.req.path.replace(API_FILES_PREFIX_RE, "");
  if (!rawPath) {
    return c.json({ error: "Object key is required." }, 400);
  }

  let objectKey: string;
  try {
    objectKey = rawPath
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return c.json({ error: "Invalid object key encoding." }, 400);
  }
  if (!isAllowedR2ObjectKey(objectKey)) {
    return c.json({ error: "Invalid object key." }, 400);
  }
  const ownedByUser = await isOwnedObjectKey(c.env.D1_DB, objectKey, auth.sub);
  if (!ownedByUser) {
    return c.json({ error: "Forbidden object key." }, 403);
  }

  const object = await c.env.R2_BUCKET.get(objectKey);
  if (!object?.body) {
    return c.json({ error: "File not found." }, 404);
  }

  const headers = new Headers();
  if (object.httpMetadata?.contentType) {
    headers.set("Content-Type", object.httpMetadata.contentType);
  }
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(object.body, { headers });
});

app.get("/api/workspaces", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  const includeArchivedRaw = c.req.query("include_archived")?.trim().toLowerCase();
  const includeArchived = includeArchivedRaw === "1" || includeArchivedRaw === "true";
  const db = c.env.D1_DB;
  const [workspaces, activeWorkspaceId] = await Promise.all([
    listWorkspaces(db, includeArchived),
    getActiveWorkspaceId(db),
  ]);
  return c.json({ workspaces, active_workspace_id: activeWorkspaceId });
});

app.post("/api/workspaces", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  const body = await c.req.json<{ name?: string }>();
  const name = normalizeSessionTitle(body.name ?? "");
  if (!name) {
    return c.json({ error: "Workspace name is required." }, 400);
  }
  const now = Date.now();
  const workspaceId = crypto.randomUUID();
  await c.env.D1_DB
    .prepare("INSERT INTO workspaces (id, name, archived_at, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)")
    .bind(workspaceId, name, now, now)
    .run();
  return c.json({ workspace: { id: workspaceId, name, archived_at: null, created_at: now, updated_at: now } });
});

app.put("/api/workspaces/:id", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  const workspaceId = c.req.param("id")?.trim();
  if (!workspaceId) {
    return c.json({ error: "Workspace id is required." }, 400);
  }
  const body = await c.req.json<{ name?: string }>();
  const name = normalizeSessionTitle(body.name ?? "");
  if (!name) {
    return c.json({ error: "Workspace name is required." }, 400);
  }
  const now = Date.now();
  const result = await c.env.D1_DB
    .prepare("UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?")
    .bind(name, now, workspaceId)
    .run();
  if (!result.success || Number(result.meta.changes ?? 0) === 0) {
    return c.json({ error: "Workspace not found." }, 404);
  }
  return c.json({ success: true, id: workspaceId, name, updated_at: now });
});

app.put("/api/workspaces/:id/archive", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  const workspaceId = c.req.param("id")?.trim();
  if (!workspaceId) {
    return c.json({ error: "Workspace id is required." }, 400);
  }
  const body = await c.req.json<{ archived?: boolean }>();
  const archived = body.archived !== false;
  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB);
  if (archived && workspaceId === activeWorkspaceId) {
    return c.json({ error: "Cannot archive active workspace. Please switch workspace first." }, 400);
  }
  const now = Date.now();
  const result = await c.env.D1_DB
    .prepare("UPDATE workspaces SET archived_at = ?, updated_at = ? WHERE id = ?")
    .bind(archived ? now : null, now, workspaceId)
    .run();
  if (!result.success || Number(result.meta.changes ?? 0) === 0) {
    return c.json({ error: "Workspace not found." }, 404);
  }
  return c.json({ success: true, archived });
});

app.put("/api/workspaces/:id/activate", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  const workspaceId = c.req.param("id")?.trim();
  if (!workspaceId) {
    return c.json({ error: "Workspace id is required." }, 400);
  }
  const workspace = await c.env.D1_DB
    .prepare("SELECT id, archived_at FROM workspaces WHERE id = ? LIMIT 1")
    .bind(workspaceId)
    .first<{ id: string; archived_at: number | null }>();
  if (!workspace?.id) {
    return c.json({ error: "Workspace not found." }, 404);
  }
  if (workspace.archived_at) {
    return c.json({ error: "Archived workspace cannot be activated. Please enable it first." }, 400);
  }
  await setAppSetting(c.env.D1_DB, "active_workspace_id", workspace.id);
  return c.json({ success: true, active_workspace_id: workspace.id });
});

app.get("/api/sessions", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const includeArchivedRaw = c.req.query("include_archived")?.trim().toLowerCase();
  const includeArchived = includeArchivedRaw === "1" || includeArchivedRaw === "true";
  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB);
  const query = includeArchived
    ? `SELECT id, title, created_at, archived_at, pinned_at
       FROM sessions
       WHERE workspace_id = ?
       ORDER BY CASE WHEN pinned_at IS NULL THEN 1 ELSE 0 END ASC, pinned_at DESC, created_at DESC`
    : `SELECT id, title, created_at, archived_at, pinned_at
       FROM sessions
       WHERE workspace_id = ? AND archived_at IS NULL
       ORDER BY CASE WHEN pinned_at IS NULL THEN 1 ELSE 0 END ASC, pinned_at DESC, created_at DESC`;
  const { results } = await c.env.D1_DB
    .prepare(query)
    .bind(activeWorkspaceId)
    .all<{ id: string; title: string; created_at: number; archived_at: number | null; pinned_at: number | null }>();
  return c.json({ sessions: results ?? [] });
});

app.put("/api/sessions/:id/title", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const sessionId = c.req.param("id")?.trim();
  if (!sessionId) {
    return c.json({ error: "Session id is required." }, 400);
  }

  const body = await c.req.json<{ title?: string }>();
  const title = normalizeSessionTitle(body.title ?? "");
  if (!title) {
    return c.json({ error: "Title is required." }, 400);
  }

  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB);
  const existingSession = await c.env.D1_DB
    .prepare("SELECT id FROM sessions WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(sessionId, activeWorkspaceId)
    .first<{ id: string }>();
  if (!existingSession) {
    return c.json({ error: "Session not found." }, 404);
  }

  const result = await c.env.D1_DB
    .prepare("UPDATE sessions SET title = ? WHERE id = ? AND workspace_id = ?")
    .bind(title, sessionId, activeWorkspaceId)
    .run();
  if (!result.success) {
    throw new Error("Failed to update session title.");
  }

  return c.json({ success: true, title });
});

app.post("/api/sessions/:id/title/auto", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const sessionId = c.req.param("id")?.trim();
  if (!sessionId) {
    return c.json({ error: "Session id is required." }, 400);
  }

  const db = c.env.D1_DB;
  const PricingTable = parsePricingConfig(c.env);
  const activeWorkspaceId = await getActiveWorkspaceId(db);
  const existingSession = await db
    .prepare("SELECT id FROM sessions WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(sessionId, activeWorkspaceId)
    .first<{ id: string }>();
  if (!existingSession?.id) {
    return c.json({ error: "Session not found." }, 404);
  }

  const history = await listSessionMessages(c, sessionId, auth.sub);
  const userTranscript = history
    .filter((item) => item.role === "user")
    .map((item) => item.content.trim())
    .filter((content) => content.length > 0)
    .join("\n\n");
  const assistantTranscript = history
    .filter((item) => item.role === "assistant")
    .map((item) => item.content.trim())
    .filter((content) => content.length > 0)
    .join("\n\n");

  if (!userTranscript || !assistantTranscript) {
    return c.json({ error: "Not enough conversation content to generate a title." }, 400);
  }

  const titleResult = await generateSessionTitle(c, db, userTranscript, assistantTranscript);
  await insertUsageRecord(db, sessionId, titleResult.model, titleResult.usage, PricingTable);
  if (!titleResult.title) {
    return c.json({ error: "Failed to generate title." }, 502);
  }

  const result = await db
    .prepare("UPDATE sessions SET title = ? WHERE id = ? AND workspace_id = ?")
    .bind(titleResult.title, sessionId, activeWorkspaceId)
    .run();
  if (!result.success) {
    throw new Error("Failed to update session title.");
  }

  return c.json({ success: true, title: titleResult.title });
});

app.put("/api/sessions/:id/archive", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const sessionId = c.req.param("id")?.trim();
  if (!sessionId) {
    return c.json({ error: "Session id is required." }, 400);
  }
  const body = await c.req.json<{ archived?: boolean }>();
  const archived = body.archived !== false;
  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB);
  const result = await c.env.D1_DB
    .prepare("UPDATE sessions SET archived_at = ? WHERE id = ? AND workspace_id = ?")
    .bind(archived ? Date.now() : null, sessionId, activeWorkspaceId)
    .run();
  if (!result.success) {
    throw new Error("Failed to update session archive state.");
  }
  if (!result.meta.changes) {
    return c.json({ error: "Session not found." }, 404);
  }
  return c.json({ success: true, archived });
});

app.put("/api/sessions/:id/pin", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const sessionId = c.req.param("id")?.trim();
  if (!sessionId) {
    return c.json({ error: "Session id is required." }, 400);
  }
  const body = await c.req.json<{ pinned?: boolean }>();
  const pinned = body.pinned !== false;
  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB);
  const result = await c.env.D1_DB
    .prepare("UPDATE sessions SET pinned_at = ? WHERE id = ? AND workspace_id = ?")
    .bind(pinned ? Date.now() : null, sessionId, activeWorkspaceId)
    .run();
  if (!result.success) {
    throw new Error("Failed to update session pin state.");
  }
  if (!result.meta.changes) {
    return c.json({ error: "Session not found." }, 404);
  }
  return c.json({ success: true, pinned });
});

app.get("/api/sessions/:id/messages", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const sessionId = c.req.param("id")?.trim();
  if (!sessionId) {
    return c.json({ error: "Session id is required." }, 400);
  }
  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB);
  const existingSession = await c.env.D1_DB
    .prepare("SELECT id FROM sessions WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(sessionId, activeWorkspaceId)
    .first<{ id: string }>();
  if (!existingSession?.id) {
    return c.json({ error: "Session not found in active workspace." }, 404);
  }
  const messages = await listSessionMessages(c, sessionId, auth.sub);
  return c.json({ messages });
});

const upsertChatStreamJobRecord = async (db: D1Database, job: ChatStreamStoredJob): Promise<void> => {
  const result = await db
    .prepare(
      "INSERT INTO chat_stream_jobs (session_id, job_id, user_id, user_message_id, cursor, state, created_at, updated_at, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET job_id = excluded.job_id, user_id = excluded.user_id, user_message_id = excluded.user_message_id, cursor = excluded.cursor, state = excluded.state, created_at = excluded.created_at, updated_at = excluded.updated_at, error = excluded.error",
    )
    .bind(
      job.payload.session_id,
      job.job_id,
      job.payload.user_id,
      job.payload.user_message_id,
      job.cursor,
      job.state,
      job.created_at,
      job.updated_at,
      job.error,
    )
    .run();
  if (!result.success) {
    throw new Error("Failed to persist chat stream recovery state.");
  }
};

const fetchActiveChatStreamJob = async (db: D1Database, sessionId: string, userId: string): Promise<ChatStreamRecoveryRow | null> => {
  const row = await db
    .prepare(
      "SELECT session_id, job_id, state, cursor, user_message_id, created_at, updated_at, error FROM chat_stream_jobs WHERE session_id = ? AND user_id = ? AND state IN ('queued', 'running') ORDER BY updated_at DESC LIMIT 1",
    )
    .bind(sessionId, userId)
    .first<ChatStreamRecoveryRow>();
  return row ?? null;
};

app.post("/api/chat/stream", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{
    session_id?: string;
    message?: string;
    attachments?: Array<{
      id?: string;
    }>;
    new_session?: boolean;
    model?: string;
    regenerate_user_message_id?: string;
    request_source?: string;
    max_output_tokens_override?: number;
    client_request_id?: string;
  }>();

  const sessionId = body.session_id?.trim();
  let message = body.message?.trim() ?? "";
  const regenerateUserMessageId = body.regenerate_user_message_id?.trim() ?? "";
  const requestSource = body.request_source?.trim() === "regenerate_message" ? "regenerate_message" : "send_message";
  const requestedAttachmentIds = Array.from(
    new Set(
      (body.attachments ?? [])
        .map((item) => item?.id?.trim() ?? "")
        .filter((id) => id.length > 0),
    ),
  );
  const newSession = Boolean(body.new_session);
  const clientRequestId = body.client_request_id?.trim() ?? "";
  if (!sessionId || (!regenerateUserMessageId && message.length === 0 && requestedAttachmentIds.length === 0)) {
    return c.json({ error: "session_id is required, and at least one of message or attachments must be provided." }, 400);
  }

  const db = c.env.D1_DB;
  const activeWorkspaceId = await getActiveWorkspaceId(db);
  const logLevel = c.get("logLevel") ?? DEFAULT_LOG_LEVEL;
  let existingSession = await db
    .prepare("SELECT id FROM sessions WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(sessionId, activeWorkspaceId)
    .first<{ id: string }>();
  if (!existingSession?.id && (newSession || requestSource === "regenerate_message")) {
    const sessionTitle = "New Chat";
    const insertSessionResult = await db
      .prepare("INSERT OR IGNORE INTO sessions (id, title, created_at, workspace_id) VALUES (?, ?, ?, ?)")
      .bind(sessionId, sessionTitle, Date.now(), activeWorkspaceId)
      .run();
    if (!insertSessionResult.success) {
      throw new Error("Failed to ensure session.");
    }
    if (logLevel === "TRACE" && !insertSessionResult.meta.changes) {
      logTrace("chat.session_ensure_skipped_existing", {
        ...buildRequestLogPayload(c),
        session_id: sessionId,
        workspace_id: activeWorkspaceId,
      });
    }
    existingSession = await db
      .prepare("SELECT id FROM sessions WHERE id = ? AND workspace_id = ? LIMIT 1")
      .bind(sessionId, activeWorkspaceId)
      .first<{ id: string }>();
    if (!existingSession?.id) {
      return c.json({ error: "Session id conflicts with another workspace." }, 409);
    }
  } else if (!existingSession?.id) {
    return c.json({ error: "Session not found in active workspace." }, 404);
  }

  let userMessageId: string;
  let effectiveRegenerateUserMessageId = regenerateUserMessageId;
  let shouldInsertUserMessage = !effectiveRegenerateUserMessageId;
  if (effectiveRegenerateUserMessageId) {
    const existingUserMessage = await db
      .prepare("SELECT id, content FROM messages WHERE id = ? AND session_id = ? AND role = 'user'")
      .bind(effectiveRegenerateUserMessageId, sessionId)
      .first<{ id: string; content: string | null }>();
    if (!existingUserMessage) {
      const hasContentForNewUserMessage =
        requestSource === "regenerate_message" && (message.length > 0 || requestedAttachmentIds.length > 0);
      if (!hasContentForNewUserMessage) {
        return c.json({ error: "regenerate_user_message_id is invalid for this session." }, 400);
      }
      shouldInsertUserMessage = true;
      effectiveRegenerateUserMessageId = "";
      userMessageId = crypto.randomUUID();
    } else {
      userMessageId = existingUserMessage.id;
      if (message.length === 0) {
        message = existingUserMessage.content?.trim() ?? "";
      }
    }
  } else {
    userMessageId = crypto.randomUUID();
  }

  const selectedModel = body.model?.trim() || (await getSelectedModel(db));
  const chatSettings = await getChatSettings(db);
  const maxOverride = normalizeMaxOutputTokens(String(body.max_output_tokens_override ?? chatSettings.max_output_tokens));
  logInfo("chat.stream_requested", {
    ...buildRequestLogPayload(c),
    session_id: sessionId,
    new_session: newSession,
    model: selectedModel,
    reasoning_effort: chatSettings.reasoning_effort,
    max_output_tokens: maxOverride,
    web_search_enabled: chatSettings.web_search_enabled,
    web_search_max_results: chatSettings.web_search_max_results,
    message_length: message.length,
    attachment_count: requestedAttachmentIds.length,
    request_source: requestSource,
    regenerate_user_message_id: regenerateUserMessageId || null,
  });

  let selectedAttachments: Array<(AttachmentRow & { source: "attachments" }) | (LibraryFileRow & { source: "library_files" })> = [];
  if (requestedAttachmentIds.length > 0) {
    const placeholders = requestedAttachmentIds.map(() => "?").join(", ");
    const attachmentResult = await db
      .prepare(
        `SELECT id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at
         FROM attachments
         WHERE id IN (${placeholders}) AND status = 'active' AND user_id = ?`,
      )
      .bind(...requestedAttachmentIds, auth.sub)
      .all<AttachmentRow>();
    const attachmentRows = (attachmentResult.results ?? []).map((row) => ({ ...row, source: "attachments" as const }));

    const missingIds = requestedAttachmentIds.filter((id) => !attachmentRows.some((row) => row.id === id));
    let libraryRows: Array<LibraryFileRow & { source: "library_files" }> = [];
    if (missingIds.length > 0) {
      const libraryPlaceholders = missingIds.map(() => "?").join(", ");
      const libraryResult = await db
        .prepare(
          `SELECT id, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, created_at
           FROM library_files
           WHERE id IN (${libraryPlaceholders}) AND status = 'active' AND user_id = ?`,
        )
        .bind(...missingIds, auth.sub)
        .all<LibraryFileRow>();
      libraryRows = (libraryResult.results ?? []).map((row) => ({ ...row, source: "library_files" as const }));
    }

    const rows = [...attachmentRows, ...libraryRows];
    if (rows.length !== requestedAttachmentIds.length) {
      return c.json({ error: "One or more attachments are invalid." }, 400);
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const attachmentId of requestedAttachmentIds) {
      const attachment = byId.get(attachmentId);
      if (!attachment) {
        return c.json({ error: "One or more attachments are invalid." }, 400);
      }
    }
    selectedAttachments = requestedAttachmentIds.map((id) => byId.get(id)).filter((row): row is typeof rows[number] => Boolean(row));
  }

  if (shouldInsertUserMessage) {
    await db
      .prepare("INSERT INTO messages (id, session_id, role, content, model, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(userMessageId, sessionId, "user", message, null, Date.now())
      .run();
  }

  if (selectedAttachments.length > 0) {
    for (const attachment of selectedAttachments) {
      if (attachment.source === "attachments") {
        const attachmentConversationId = attachment.conversation_id?.trim() ?? "";
        if (attachmentConversationId !== sessionId) {
        // Re-bind same-user attachments to current session so hash-deduplicated files can be reused across conversations.
          await db
            .prepare("UPDATE attachments SET conversation_id = ? WHERE id = ? AND user_id = ?")
            .bind(sessionId, attachment.id, auth.sub)
            .run();
        }
      }
      await db.prepare("INSERT OR IGNORE INTO message_attachments (message_id, attachment_id) VALUES (?, ?)").bind(userMessageId, attachment.id).run();
    }
  }

  const history = await listSessionMessages(c, sessionId, auth.sub);
  let historyItems = (history ?? []).filter((item) => item.role !== "system");
  if (effectiveRegenerateUserMessageId) {
    const regenerateIndex = historyItems.findIndex((item) => item.id === userMessageId && item.role === "user");
    if (regenerateIndex < 0) {
      logError("chat.regenerate_history_context_missing", {
        ...buildRequestLogPayload(c),
        session_id: sessionId,
        user_message_id: userMessageId,
      });
      return c.json({ error: "Regenerate history context became inconsistent. Please retry." }, 409);
    }
    historyItems = historyItems.slice(0, regenerateIndex + 1);
  }
  const attachmentIds = Array.from(
    new Set(
      historyItems.flatMap((item) => (item.attachments ?? []).map((attachment) => attachment.id).filter((id) => id.length > 0)),
    ),
  );

  const attachmentMetaById = new Map<string, AttachmentModelMeta>();
  if (attachmentIds.length > 0) {
    const placeholders = attachmentIds.map(() => "?").join(", ");
    const attachmentMetaBinds = [...attachmentIds, auth.sub, ...attachmentIds, auth.sub];
    const { results } = await db
      .prepare(
        `SELECT id, file_name, mime_type, r2_url, r2_object_key, 'attachments' AS source
         FROM attachments
         WHERE id IN (${placeholders}) AND status = 'active' AND user_id = ?
         UNION ALL
         SELECT id, file_name, mime_type, r2_url, r2_object_key, 'library_files' AS source
         FROM library_files
         WHERE id IN (${placeholders}) AND status = 'active' AND user_id = ?`,
      )
      .bind(...attachmentMetaBinds)
      .all<AttachmentModelMeta>();
    for (const item of results ?? []) {
      attachmentMetaById.set(item.id, item);
    }
  }

  const openRouterMessages: OpenRouterMessage[] = await Promise.all(
    historyItems.map(async (item) => ({
      role: item.role,
      content: await buildOpenRouterMessageContent(c, item.role, item.content, item.attachments, attachmentMetaById),
    })),
  );

  openRouterMessages.unshift({
    role: "system",
    content: await buildInjectedSystemPrompt(db, c.env),
  });

  const hasPdfAttachment = historyItems.some((item) =>
    item.attachments.some((attachment) => normalizeMimeType(attachment.mime_type) === "application/pdf"),
  );

  const apiEndpoint = c.env.API_ENDPOINT || "https://openrouter.ai/api/v1/responses";
  const useChatCompletionsApi = isChatCompletionsEndpoint(apiEndpoint);
  const responseInput = openRouterMessages.map((item) => ({
    type: "message" as const,
    role: item.role,
    content: toResponsesInputContent(item.content),
  }));
  const plugins: Array<Record<string, unknown>> = [];
  const tools = chatSettings.web_search_enabled ? getAvailableTools() : [];

  if (hasPdfAttachment) {
    plugins.push({
      id: "file-parser",
      pdf: { engine: "mistral-ocr" },
    });
  }
  
  const upstreamRequestBody = useChatCompletionsApi
    ? {
        model: selectedModel,
        messages: openRouterMessages,
        stream: true,
        max_tokens: maxOverride,
        reasoning: { effort: chatSettings.reasoning_effort },
        ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
        ...(plugins.length > 0 ? { plugins } : {}),
      }
    : {
        model: selectedModel,
        input: responseInput,
        stream: true,
        max_output_tokens: maxOverride,
        reasoning: { effort: chatSettings.reasoning_effort },
        ...(plugins.length > 0 ? { plugins } : {}),
      };
  if (logLevel === "TRACE") {
    logTrace("chat.upstream_request", {
      ...buildRequestLogPayload(c),
      session_id: sessionId,
      model: selectedModel,
      endpoint: apiEndpoint,
      body: upstreamRequestBody,
    });
  }

  const durableObjectId = c.env.CHAT_SESSION_DO.idFromName(sessionId);
  const stub = c.env.CHAT_SESSION_DO.get(durableObjectId);
  const submitResponse = await stub.fetch("https://chat-session.internal/jobs/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      user_id: auth.sub,
      user_message_id: userMessageId,
      user_message: message,
      new_session: newSession,
      client_request_id: clientRequestId || null,
      open_router_messages: openRouterMessages,
      upstream_request_body: upstreamRequestBody,
      selected_model: selectedModel,
      chat_settings: chatSettings,
      use_chat_completions_api: useChatCompletionsApi,
      api_endpoint: apiEndpoint,
      request_url: c.req.url,
    }),
  });
  if (!submitResponse.ok) {
    const reason = await submitResponse.text();
    logError("chat.stream_submit_failed", {
      ...buildRequestLogPayload(c),
      session_id: sessionId,
      reason: reason.slice(0, 500),
    });
    return new Response(JSON.stringify({ error: reason || "Failed to submit stream job." }), {
      status: submitResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const submitPayload = await submitResponse.json<Record<string, unknown>>();
  return c.json({
    session_id: sessionId,
    user_message_id: userMessageId,
    ...(submitPayload ?? {}),
  });
});

app.get("/api/chat/stream/events", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const sessionId = c.req.query("session_id")?.trim();
  const jobId = c.req.query("job_id")?.trim();
  const cursor = c.req.query("cursor")?.trim() ?? "";
  if (!sessionId || !jobId) {
    return c.json({ error: "session_id and job_id are required." }, 400);
  }

  const durableObjectId = c.env.CHAT_SESSION_DO.idFromName(sessionId);
  const stub = c.env.CHAT_SESSION_DO.get(durableObjectId);
  return stub.fetch(`https://chat-session.internal/jobs/events?job_id=${encodeURIComponent(jobId)}&cursor=${encodeURIComponent(cursor)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: auth.sub,
      request_url: c.req.url,
    }),
  });
});

app.get("/api/chat/stream/recovery", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const sessionId = c.req.query("session_id")?.trim();
  if (!sessionId) {
    return c.json({ error: "session_id is required." }, 400);
  }

  const db = c.env.D1_DB;
  const activeWorkspaceId = await getActiveWorkspaceId(db);
  const existingSession = await db
    .prepare("SELECT id FROM sessions WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(sessionId, activeWorkspaceId)
    .first<{ id: string }>();
  if (!existingSession?.id) {
    return c.json({ error: "Session not found in active workspace." }, 404);
  }

  const recovery = await fetchActiveChatStreamJob(db, sessionId, auth.sub);
  if (!recovery) {
    return c.json({ recovery: null }, 404);
  }

  return c.json({
    recovery: {
      session_id: recovery.session_id,
      job_id: recovery.job_id,
      cursor: recovery.cursor !== null ? String(recovery.cursor) : "",
      user_message_id: recovery.user_message_id,
      state: recovery.state,
      created_at: recovery.created_at,
      updated_at: recovery.updated_at,
    },
  });
});

app.get("/api/stats/usage", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const db = c.env.D1_DB;
  const sessionId = c.req.query("session_id")?.trim();
  const dateUtc = c.req.query("date_utc")?.trim();
  const hasDateFilter = Boolean(dateUtc);
  if (hasDateFilter && !/^\d{4}-\d{2}-\d{2}$/.test(dateUtc as string)) {
    return c.json({ error: "date_utc must be YYYY-MM-DD." }, 400);
  }
  const hasSessionFilter = Boolean(sessionId);
  if (hasSessionFilter) {
    const activeWorkspaceId = await getActiveWorkspaceId(db);
    const existingSession = await db
      .prepare("SELECT id FROM sessions WHERE id = ? AND workspace_id = ? LIMIT 1")
      .bind(sessionId as string, activeWorkspaceId)
      .first<{ id: string }>();
    if (!existingSession?.id) {
      return c.json({ error: "Session not found in active workspace." }, 404);
    }
  }
  const whereClauses: string[] = [];
  const whereBindings: Array<string | number> = [];
  if (hasSessionFilter) {
    whereClauses.push("session_id = ?");
    whereBindings.push(sessionId as string);
  }
  if (hasDateFilter) {
    const startMs = Date.parse(`${dateUtc as string}T00:00:00.000Z`);
    const endMs = startMs + 24 * 60 * 60 * 1000;
    whereClauses.push("created_at >= ? AND created_at < ?");
    whereBindings.push(startMs, endMs);
  }
  const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : "";

  const totalStatement = db.prepare(
    `SELECT COUNT(*) as requests, COALESCE(SUM(prompt_tokens), 0) as prompt_tokens, COALESCE(SUM(completion_tokens), 0) as completion_tokens, COALESCE(SUM(total_tokens), 0) as total_tokens, COALESCE(SUM(cost_usd), 0) as total_cost_usd FROM usage_records${whereSql}`,
  );
  const totalRow = whereBindings.length > 0
    ? await totalStatement.bind(...whereBindings).first<UsageSummaryRow>()
    : await totalStatement.first<UsageSummaryRow>();

  const byModelStatement = db.prepare(
    `SELECT model, COUNT(*) as requests, COALESCE(SUM(prompt_tokens), 0) as prompt_tokens, COALESCE(SUM(completion_tokens), 0) as completion_tokens, COALESCE(SUM(total_tokens), 0) as total_tokens, COALESCE(SUM(cost_usd), 0) as cost_usd FROM usage_records${whereSql} GROUP BY model ORDER BY cost_usd DESC, total_tokens DESC`,
  );
  const byModelResult = whereBindings.length > 0
    ? await byModelStatement.bind(...whereBindings).all<UsageByModelRow>()
    : await byModelStatement.all<UsageByModelRow>();

  const summary: UsageSummary = {
    total_requests: Number(totalRow?.requests ?? 0),
    total_prompt_tokens: Number(totalRow?.prompt_tokens ?? 0),
    total_completion_tokens: Number(totalRow?.completion_tokens ?? 0),
    total_tokens: Number(totalRow?.total_tokens ?? 0),
    total_cost_usd: Number(Number(totalRow?.total_cost_usd ?? 0).toFixed(8)),
    by_model: (byModelResult.results ?? []).map((item) => ({
      model: item.model,
      requests: Number(item.requests ?? 0),
      prompt_tokens: Number(item.prompt_tokens ?? 0),
      completion_tokens: Number(item.completion_tokens ?? 0),
      total_tokens: Number(item.total_tokens ?? 0),
      cost_usd: Number(Number(item.cost_usd ?? 0).toFixed(8)),
    })),
  };

  return c.json({ summary });
});

app.get("/api/attachments/check", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const hash = c.req.query("hash");
  if (!hash) {
    return c.json({ error: "hash is required." }, 400);
  }

  const attachment = await c.env.D1_DB
    .prepare(
      "SELECT id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at FROM attachments WHERE file_hash = ? AND status = 'active' AND user_id = ?",
    )
    .bind(hash, auth.sub)
    .first<AttachmentRow>();

  if (!attachment) {
    return c.json({ exists: false });
  }

  const accessUrl = await resolveAttachmentAccessUrl(c, attachment);
  return c.json({
    exists: true,
    data: {
      id: attachment.id,
      file_hash: attachment.file_hash,
      file_name: attachment.file_name,
      mime_type: attachment.mime_type,
      size: Number(attachment.size),
      r2_url: attachment.r2_url,
      r2_object_key: attachment.r2_object_key,
      access_url: accessUrl,
      created_at: Number(attachment.created_at),
    },
  });
});

app.get("/api/attachments/presign", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const fileName = c.req.query("fileName")?.trim();
  const mimeType = normalizeMimeType(c.req.query("mimeType")?.trim());
  const conversationIdRaw = c.req.query("conversationId")?.trim() || c.req.query("conversation_id")?.trim() || "draft";
  let conversationId: string;
  try {
    conversationId = normalizeConversationId(conversationIdRaw);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid conversationId." }, 400);
  }
  if (!fileName || !mimeType || !conversationId) {
    return c.json({ error: "fileName, mimeType and conversationId are required." }, 400);
  }

  await cleanupStaleUploadingAttachments(c.env.D1_DB, c.env);

  const attachmentId = crypto.randomUUID();
  const objectKey = `attachments/${sanitizePathSegment(auth.sub)}/${sanitizePathSegment(conversationId)}/${attachmentId}_${sanitizeFileName(fileName)}`;
  const endpoint = getR2Endpoint(c.env);
  const r2Url = buildObjectUrl(endpoint, objectKey);
  const uploadUrl = toAbsoluteUrl(c, `/api/attachments/${attachmentId}/upload`);

  await c.env.D1_DB
    .prepare(
      "INSERT INTO attachments (id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at) VALUES (?, NULL, ?, ?, NULL, ?, ?, NULL, NULL, 'uploading', ?, ?, ?)",
    )
    .bind(attachmentId, fileName, mimeType, r2Url, objectKey, auth.sub, conversationId, Date.now())
    .run();

  c.header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  c.header("Pragma", "no-cache");
  const directAccess = await resolveDirectAccessUrl(c, objectKey, USER_FILE_URL_TTL_SECONDS);
  return c.json({
    id: attachmentId,
    upload_url: uploadUrl,
    objectKey,
    publicUrl: directAccess.url,
  });
});

app.put("/api/attachments/:id/upload", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const attachmentId = c.req.param("id");
  const attachment = await c.env.D1_DB
    .prepare(
      "SELECT id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at FROM attachments WHERE id = ? AND user_id = ?",
    )
    .bind(attachmentId, auth.sub)
    .first<AttachmentRow>();

  if (!attachment || !attachment.r2_object_key) {
    return c.json({ error: "Attachment upload task not found." }, 404);
  }
  if (attachment.status !== "uploading") {
    return c.json({ error: "Attachment is not in uploading state." }, 400);
  }

  const contentLength = readContentLength(c);
  if (contentLength === null || contentLength <= 0 || contentLength > MAX_ATTACHMENT_BYTES) {
    return c.json({ error: `Attachment size must be between 1 and ${MAX_ATTACHMENT_BYTES} bytes.` }, 400);
  }

  const contentType = attachment.mime_type || c.req.header("content-type")?.trim() || "application/octet-stream";
  await c.env.R2_BUCKET.put(attachment.r2_object_key, c.req.raw.body, {
    httpMetadata: { contentType },
  });

  const size = Number(c.req.header("content-length")) || 0;
  await c.env.D1_DB
    .prepare("UPDATE attachments SET size = ?, status = 'temp' WHERE id = ?")
    .bind(size, attachment.id)
    .run();

  return c.json({ success: true, id: attachment.id });
});

app.post("/api/attachments", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{
    id?: string;
    file_hash?: string;
    file_name?: string;
    mime_type?: string;
    size?: number;
    r2_url?: string;
    object_key?: string;
    conversation_id?: string;
  }>();

  const attachmentId = body.id?.trim();
  const fileHash = body.file_hash?.trim();
  const fileName = body.file_name?.trim();
  const mimeType = body.mime_type?.trim();
  const size = Number(body.size ?? 0);
  if (!fileHash || !fileName || !mimeType || !Number.isFinite(size) || size <= 0) {
    return c.json({ error: "file_hash, file_name, mime_type and positive size are required." }, 400);
  }
  if (size > MAX_ATTACHMENT_BYTES) {
    return c.json({ error: `Attachment size must be <= ${MAX_ATTACHMENT_BYTES} bytes.` }, 400);
  }
  if (!attachmentId) {
    return c.json({ error: "id is required to finalize attachment upload." }, 400);
  }

  const existing = await c.env.D1_DB
    .prepare(
      "SELECT id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at FROM attachments WHERE file_hash = ? AND status = 'active' AND user_id = ?",
    )
    .bind(fileHash, auth.sub)
    .first<AttachmentRow>();
  if (existing) {
    const existingAccessUrl = await resolveAttachmentAccessUrl(c, existing);
    if (attachmentId) {
      const duplicateUpload = await c.env.D1_DB
        .prepare("SELECT r2_object_key FROM attachments WHERE id = ? AND user_id = ?")
        .bind(attachmentId, auth.sub)
        .first<{ r2_object_key: string | null }>();
      let duplicateObjectDeleted = true;
      if (duplicateUpload?.r2_object_key) {
        try {
          await c.env.R2_BUCKET.delete(duplicateUpload.r2_object_key);
        } catch (error) {
          duplicateObjectDeleted = false;
          console.error("Failed to delete duplicate uploaded attachment object", error);
        }
      }
      if (duplicateObjectDeleted) {
        await c.env.D1_DB
          .prepare(
            "UPDATE attachments SET status = 'temp', r2_object_key = NULL, cached_get_url = NULL, cached_get_url_expires_at = NULL WHERE id = ? AND user_id = ?",
          )
          .bind(attachmentId, auth.sub)
          .run();
      } else {
        await c.env.D1_DB.prepare("UPDATE attachments SET status = 'temp' WHERE id = ? AND user_id = ?").bind(attachmentId, auth.sub).run();
      }
    }
    return c.json({
      success: true,
      id: existing.id,
      access_url: existingAccessUrl,
      r2_object_key: existing.r2_object_key,
    });
  }

  const existingAnyOwner = await c.env.D1_DB
    .prepare("SELECT user_id FROM attachments WHERE file_hash = ? AND status = 'active'")
    .bind(fileHash)
    .first<{ user_id: string | null }>();
  if (existingAnyOwner?.user_id && existingAnyOwner.user_id !== auth.sub) {
    return c.json({ error: "Attachment hash conflict across users." }, 409);
  }

  const pending = await c.env.D1_DB
    .prepare(
      "SELECT id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at FROM attachments WHERE id = ? AND user_id = ?",
    )
    .bind(attachmentId, auth.sub)
    .first<AttachmentRow>();
  if (!pending || (pending.status !== "temp" && pending.status !== "uploading")) {
    return c.json({ error: "Attachment upload task is not ready for finalize." }, 400);
  }
  if (pending.mime_type && normalizeMimeType(pending.mime_type) !== normalizeMimeType(mimeType)) {
    return c.json({ error: "Attachment mime_type mismatch with uploaded content." }, 400);
  }
  if (!pending.r2_object_key || !pending.r2_object_key.startsWith("attachments/")) {
    return c.json({ error: "Attachment object key is invalid." }, 400);
  }

  let uploadedSize = Number(pending.size ?? 0);
  if (pending.status === "uploading") {
    const uploadedObject = await c.env.R2_BUCKET.head(pending.r2_object_key);
    if (!uploadedObject) {
      return c.json({ error: "Attachment object is not ready yet." }, 400);
    }
    uploadedSize = Number(uploadedObject.size ?? 0);
  }
  if (!Number.isFinite(uploadedSize) || uploadedSize <= 0 || uploadedSize !== size) {
    return c.json({ error: "Attachment size mismatch with uploaded content." }, 400);
  }

  const endpoint = getR2Endpoint(c.env);
  const objectKey = pending.r2_object_key;
  const providedObjectKey = body.object_key?.trim();
  if (providedObjectKey && providedObjectKey !== objectKey) {
    return c.json({ error: "object_key mismatch with upload task." }, 400);
  }
  if (body.r2_url) {
    const parsedObjectKey = parseObjectKeyFromUrl(body.r2_url, endpoint);
    if (!parsedObjectKey || parsedObjectKey !== objectKey) {
      return c.json({ error: "r2_url mismatch with upload task." }, 400);
    }
  }

  const directAccess = await resolveDirectAccessUrl(c, objectKey);
  const id = attachmentId;
  const r2Url = buildObjectUrl(endpoint, objectKey);
  if (!pending.conversation_id) {
    return c.json({ error: "Attachment conversation_id is missing." }, 400);
  }
  const conversationId = pending.conversation_id;
  if (body.conversation_id !== undefined) {
    if (typeof body.conversation_id !== "string") {
      return c.json({ error: "conversation_id must be a string." }, 400);
    }
    const providedConversationRaw = body.conversation_id.trim();
    if (!providedConversationRaw) {
      return c.json({ error: "conversation_id cannot be empty." }, 400);
    }
    let providedConversationId: string;
    try {
      providedConversationId = normalizeConversationId(providedConversationRaw);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Invalid conversation_id." }, 400);
    }
    if (providedConversationId !== conversationId) {
      return c.json({ error: "conversation_id mismatch with upload task." }, 400);
    }
  }

  await c.env.D1_DB
    .prepare(
      "UPDATE attachments SET file_hash = ?, file_name = ?, mime_type = ?, size = ?, r2_url = ?, r2_object_key = ?, cached_get_url = ?, cached_get_url_expires_at = ?, status = 'active', conversation_id = ? WHERE id = ? AND user_id = ?",
    )
    .bind(fileHash, fileName, mimeType, uploadedSize, r2Url, objectKey, directAccess.url, directAccess.expires_at, conversationId, attachmentId, auth.sub)
    .run();

  return c.json({
    success: true,
    id,
    access_url: directAccess.url,
    r2_object_key: objectKey,
  });
});

app.get("/api/attachments", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const limitRaw = Number(c.req.query("limit"));
  const defaultLimit = 50;
  const maxLimit = 100;
  const limit = Number.isFinite(limitRaw) ? Math.min(maxLimit, Math.max(1, Math.floor(limitRaw))) : defaultLimit;
  const cursorRaw = c.req.query("cursor")?.trim();

  let cursorCreatedAt: number | null = null;
  let cursorId: string | null = null;
  if (cursorRaw) {
    const separatorIndex = cursorRaw.indexOf(":");
    if (separatorIndex < 0) {
      return c.json({ error: "Invalid cursor format." }, 400);
    }
    const createdAtPart = cursorRaw.slice(0, separatorIndex);
    const idRaw = cursorRaw.slice(separatorIndex + 1);
    if (!createdAtPart || !idRaw) {
      return c.json({ error: "Invalid cursor format." }, 400);
    }
    if (!/^\d+$/.test(createdAtPart)) {
      return c.json({ error: "Invalid cursor format." }, 400);
    }
    const createdAtRaw = Number(createdAtPart);
    if (!Number.isFinite(createdAtRaw) || createdAtRaw <= 0) {
      return c.json({ error: "Invalid cursor format." }, 400);
    }
    cursorCreatedAt = createdAtRaw;
    cursorId = idRaw;
  }

  const query =
    cursorCreatedAt !== null && cursorId !== null
      ? c.env.D1_DB
          .prepare(
            "SELECT id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at FROM attachments WHERE status = 'active' AND user_id = ? AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT ?",
          )
          .bind(auth.sub, cursorCreatedAt, cursorCreatedAt, cursorId, limit)
      : c.env.D1_DB
          .prepare(
            "SELECT id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at FROM attachments WHERE status = 'active' AND user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
          )
          .bind(auth.sub, limit);
  const { results } = await query.all<AttachmentRow>();

  const items = await Promise.all(
    (results ?? []).map(async (attachment) => {
      const accessUrl = await resolveAttachmentAccessUrl(c, attachment);
      return {
        id: attachment.id,
        file_name: attachment.file_name,
        mime_type: attachment.mime_type,
        size: Number(attachment.size ?? 0),
        access_url: accessUrl,
        created_at: Number(attachment.created_at ?? 0),
        type: resolveAttachmentType(normalizeMimeType(attachment.mime_type ?? "application/octet-stream")),
      };
    }),
  );

  const nextCursor =
    items.length === limit && items.length > 0
      ? `${items[items.length - 1].created_at}:${items[items.length - 1].id}`
      : null;

  return c.json({
    attachments: items,
    pagination: {
      limit,
      next_cursor: nextCursor,
    },
  });
});

app.get("/api/library", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const limitRaw = Number(c.req.query("limit"));
  const defaultLimit = 50;
  const maxLimit = 100;
  const limit = Number.isFinite(limitRaw) ? Math.min(maxLimit, Math.max(1, Math.floor(limitRaw))) : defaultLimit;
  const cursorRaw = c.req.query("cursor")?.trim();

  let cursorCreatedAt: number | null = null;
  let cursorId: string | null = null;
  if (cursorRaw) {
    const separatorIndex = cursorRaw.indexOf(":");
    if (separatorIndex < 0) {
      return c.json({ error: "Invalid cursor format." }, 400);
    }
    const createdAtPart = cursorRaw.slice(0, separatorIndex);
    const idRaw = cursorRaw.slice(separatorIndex + 1);
    if (!createdAtPart || !idRaw) {
      return c.json({ error: "Invalid cursor format." }, 400);
    }
    if (!/^\d+$/.test(createdAtPart)) {
      return c.json({ error: "Invalid cursor format." }, 400);
    }
    const createdAtRaw = Number(createdAtPart);
    if (!Number.isFinite(createdAtRaw) || createdAtRaw <= 0) {
      return c.json({ error: "Invalid cursor format." }, 400);
    }
    cursorCreatedAt = createdAtRaw;
    cursorId = idRaw;
  }

  const query =
    cursorCreatedAt !== null && cursorId !== null
      ? c.env.D1_DB
          .prepare(
            "SELECT id, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, created_at FROM library_files WHERE status = 'active' AND user_id = ? AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT ?",
          )
          .bind(auth.sub, cursorCreatedAt, cursorCreatedAt, cursorId, limit)
      : c.env.D1_DB
          .prepare(
            "SELECT id, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, created_at FROM library_files WHERE status = 'active' AND user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
          )
          .bind(auth.sub, limit);
  const { results } = await query.all<LibraryFileRow>();

  const files = await Promise.all(
    (results ?? []).map(async (file) => {
      const accessUrl = await resolveLibraryAccessUrl(c, file);
      return {
        id: file.id,
        file_name: file.file_name,
        mime_type: file.mime_type,
        size: Number(file.size ?? 0),
        access_url: accessUrl,
        created_at: Number(file.created_at ?? 0),
        type: resolveAttachmentType(normalizeMimeType(file.mime_type ?? "application/octet-stream")),
      };
    }),
  );

  const nextCursor =
    files.length === limit && files.length > 0
      ? `${files[files.length - 1].created_at}:${files[files.length - 1].id}`
      : null;

  return c.json({
    files,
    pagination: {
      limit,
      next_cursor: nextCursor,
    },
  });
});

app.get("/api/library/presign", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const fileName = c.req.query("fileName")?.trim();
  const mimeType = normalizeMimeType(c.req.query("mimeType")?.trim());
  if (!fileName || !mimeType) {
    return c.json({ error: "fileName and mimeType are required." }, 400);
  }

  await cleanupStaleUploadingLibraryFiles(c.env.D1_DB, c.env);

  const fileId = crypto.randomUUID();
  const objectKey = `library/${sanitizePathSegment(auth.sub)}/${fileId}_${sanitizeFileName(fileName)}`;
  const endpoint = getR2Endpoint(c.env);
  const r2Url = buildObjectUrl(endpoint, objectKey);
  const uploadUrl = toAbsoluteUrl(c, `/api/library/${fileId}/upload`);

  await c.env.D1_DB
    .prepare(
      "INSERT INTO library_files (id, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, created_at) VALUES (?, ?, ?, NULL, ?, ?, NULL, NULL, 'uploading', ?, ?)",
    )
    .bind(fileId, fileName, mimeType, r2Url, objectKey, auth.sub, Date.now())
    .run();

  c.header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  c.header("Pragma", "no-cache");
  const directAccess = await resolveDirectAccessUrl(c, objectKey, USER_FILE_URL_TTL_SECONDS);
  return c.json({
    id: fileId,
    upload_url: uploadUrl,
    objectKey,
    publicUrl: directAccess.url,
  });
});

app.put("/api/library/:id/upload", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const fileId = c.req.param("id");
  const file = await c.env.D1_DB
    .prepare(
      "SELECT id, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, created_at FROM library_files WHERE id = ? AND user_id = ?",
    )
    .bind(fileId, auth.sub)
    .first<LibraryFileRow>();

  if (!file || !file.r2_object_key) {
    return c.json({ error: "Library upload task not found." }, 404);
  }
  if (file.status !== "uploading") {
    return c.json({ error: "Library file is not in uploading state." }, 400);
  }

  const contentLength = readContentLength(c);
  if (contentLength === null || contentLength <= 0 || contentLength > MAX_ATTACHMENT_BYTES) {
    return c.json({ error: `Library file size must be between 1 and ${MAX_ATTACHMENT_BYTES} bytes.` }, 400);
  }

  const contentType = file.mime_type || c.req.header("content-type")?.trim() || "application/octet-stream";
  await c.env.R2_BUCKET.put(file.r2_object_key, c.req.raw.body, {
    httpMetadata: { contentType },
  });

  await c.env.D1_DB
    .prepare("UPDATE library_files SET size = ?, status = 'temp' WHERE id = ?")
    .bind(contentLength, file.id)
    .run();

  return c.json({ success: true, id: file.id });
});

app.post("/api/library", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{
    id?: string;
    file_name?: string;
    mime_type?: string;
    size?: number;
    r2_url?: string;
    object_key?: string;
  }>();

  const fileId = body.id?.trim();
  const fileName = body.file_name?.trim();
  const mimeType = body.mime_type?.trim();
  const size = Number(body.size ?? 0);
  if (!fileName || !mimeType || !Number.isFinite(size) || size <= 0) {
    return c.json({ error: "file_name, mime_type and positive size are required." }, 400);
  }
  if (size > MAX_ATTACHMENT_BYTES) {
    return c.json({ error: `Library file size must be <= ${MAX_ATTACHMENT_BYTES} bytes.` }, 400);
  }
  if (!fileId) {
    return c.json({ error: "id is required to finalize library upload." }, 400);
  }

  const pending = await c.env.D1_DB
    .prepare(
      "SELECT id, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, created_at FROM library_files WHERE id = ? AND user_id = ?",
    )
    .bind(fileId, auth.sub)
    .first<LibraryFileRow>();
  if (!pending || (pending.status !== "temp" && pending.status !== "uploading")) {
    return c.json({ error: "Library upload task is not ready for finalize." }, 400);
  }
  if (pending.mime_type && normalizeMimeType(pending.mime_type) !== normalizeMimeType(mimeType)) {
    return c.json({ error: "Library file mime_type mismatch with uploaded content." }, 400);
  }
  if (!pending.r2_object_key || !pending.r2_object_key.startsWith("library/")) {
    return c.json({ error: "Library object key is invalid." }, 400);
  }

  let uploadedSize = Number(pending.size ?? 0);
  if (pending.status === "uploading") {
    const uploadedObject = await c.env.R2_BUCKET.head(pending.r2_object_key);
    if (!uploadedObject) {
      return c.json({ error: "Library file object is not ready yet." }, 400);
    }
    uploadedSize = Number(uploadedObject.size ?? 0);
  }
  if (!Number.isFinite(uploadedSize) || uploadedSize <= 0 || uploadedSize !== size) {
    return c.json({ error: "Library file size mismatch with uploaded content." }, 400);
  }

  const endpoint = getR2Endpoint(c.env);
  const objectKey = pending.r2_object_key;
  const providedObjectKey = body.object_key?.trim();
  if (providedObjectKey && providedObjectKey !== objectKey) {
    return c.json({ error: "object_key mismatch with upload task." }, 400);
  }
  if (body.r2_url) {
    const parsedObjectKey = parseObjectKeyFromUrl(body.r2_url, endpoint);
    if (!parsedObjectKey || parsedObjectKey !== objectKey) {
      return c.json({ error: "r2_url mismatch with upload task." }, 400);
    }
  }

  const directAccess = await resolveDirectAccessUrl(c, objectKey);
  const r2Url = buildObjectUrl(endpoint, objectKey);

  await c.env.D1_DB
    .prepare(
      "UPDATE library_files SET file_name = ?, mime_type = ?, size = ?, r2_url = ?, r2_object_key = ?, cached_get_url = ?, cached_get_url_expires_at = ?, status = 'active' WHERE id = ? AND user_id = ?",
    )
    .bind(fileName, mimeType, uploadedSize, r2Url, objectKey, directAccess.url, directAccess.expires_at, fileId, auth.sub)
    .run();

  return c.json({
    success: true,
    id: fileId,
    access_url: directAccess.url,
    r2_object_key: objectKey,
  });
});

app.delete("/api/attachments/:id", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const attachmentId = c.req.param("id");
  const attachment = await c.env.D1_DB
    .prepare(
      "SELECT id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at FROM attachments WHERE id = ? AND status = 'active' AND user_id = ?",
    )
    .bind(attachmentId, auth.sub)
    .first<AttachmentRow>();
  if (!attachment) {
    return c.json({ error: "Attachment not found." }, 404);
  }

  if (attachment.r2_object_key) {
    try {
      await c.env.R2_BUCKET.delete(attachment.r2_object_key);
    } catch (error) {
      console.error("Failed to delete attachment object", {
        attachment_id: attachment.id,
        object_key: attachment.r2_object_key,
        error,
      });
      return c.json({ error: "Failed to delete attachment file from storage." }, 500);
    }
  }

  await c.env.D1_DB
    .prepare(
      "UPDATE attachments SET status = 'deleted', r2_object_key = NULL, cached_get_url = NULL, cached_get_url_expires_at = NULL WHERE id = ? AND user_id = ?",
    )
    .bind(attachment.id, auth.sub)
    .run();

  return c.json({ success: true });
});

app.delete("/api/library/:id", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const fileId = c.req.param("id");
  const file = await c.env.D1_DB
    .prepare(
      "SELECT id, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, created_at FROM library_files WHERE id = ? AND status = 'active' AND user_id = ?",
    )
    .bind(fileId, auth.sub)
    .first<LibraryFileRow>();
  if (!file) {
    return c.json({ error: "Library file not found." }, 404);
  }

  if (file.r2_object_key) {
    try {
      await c.env.R2_BUCKET.delete(file.r2_object_key);
    } catch (error) {
      console.error("Failed to delete library object", {
        file_id: file.id,
        object_key: file.r2_object_key,
        error,
      });
      return c.json({ error: "Failed to delete library file from storage." }, 500);
    }
  }

  await c.env.D1_DB
    .prepare(
      "UPDATE library_files SET status = 'deleted', r2_object_key = NULL, cached_get_url = NULL, cached_get_url_expires_at = NULL WHERE id = ? AND user_id = ?",
    )
    .bind(file.id, auth.sub)
    .run();

  return c.json({ success: true });
});

app.get("/api/attachments/:id/url", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const attachmentId = c.req.param("id");
  const attachment = await c.env.D1_DB
    .prepare(
      "SELECT id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at FROM attachments WHERE id = ? AND status = 'active' AND user_id = ?",
    )
    .bind(attachmentId, auth.sub)
    .first<AttachmentRow>();

  if (!attachment) {
    return c.json({ error: "Attachment not found." }, 404);
  }

  const accessUrl = await resolveAttachmentAccessUrl(c, attachment);
  return c.json({ access_url: accessUrl });
});

const CHAT_STREAM_META_KEY = "stream:meta";
const CHAT_STREAM_JOB_KEY_PREFIX = "stream:job:";
const CHAT_STREAM_RETENTION_MAX_EVENTS = 3000;
const CHAT_STREAM_RETENTION_MAX_TERMINAL_JOBS = 128;
const CHAT_STREAM_KEEPALIVE_INTERVAL_MS = 15_000;
const CHAT_STREAM_POLL_INTERVAL_MS = 1_000;

type ChatStreamMeta = {
  next_sequence: number;
  first_sequence: number;
};

type LiveSubscriber = {
  id: string;
  job_id: string;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  pending: Promise<void>;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class ChatSessionDurableObject {
  private readonly state: DurableObjectState;
  private readonly env: Env;
  private readonly encoder = new TextEncoder();
  private readonly subscribers = new Map<string, LiveSubscriber>();
  private jobs = new Map<string, ChatStreamStoredJob>();
  private readonly runtimePayloads = new Map<string, ChatStreamSubmitPayload>();
  private nextSequence = 1;
  private firstSequence = 1;
  private processing = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.state.blockConcurrencyWhile(async () => {
      await this.loadState();
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/jobs/submit") {
      return this.handleSubmit(request);
    }
    if (request.method === "POST" && url.pathname === "/jobs/events") {
      return this.handleEvents(request, url);
    }
    return new Response("Not found", { status: 404 });
  }

  private async loadState(): Promise<void> {
    const [meta, jobs] = await Promise.all([
      this.state.storage.get<ChatStreamMeta>(CHAT_STREAM_META_KEY),
      this.state.storage.list<ChatStreamStoredJob>({ prefix: CHAT_STREAM_JOB_KEY_PREFIX }),
    ]);
    if (meta) {
      this.nextSequence = Number(meta.next_sequence ?? 1);
      this.firstSequence = Number(meta.first_sequence ?? 1);
    }
    this.jobs = new Map(
      [...jobs.values()]
        .filter((job): job is ChatStreamStoredJob => Boolean(job?.job_id))
        .map((job) => [job.job_id, job]),
    );
  }

  private toJobStorageKey(jobId: string): string {
    return `${CHAT_STREAM_JOB_KEY_PREFIX}${jobId}`;
  }

  private async persistJob(job: ChatStreamStoredJob): Promise<void> {
    await this.state.storage.put(this.toJobStorageKey(job.job_id), job);
  }

  private async pruneTerminalJobs(): Promise<void> {
    const terminalJobs = [...this.jobs.values()]
      .filter((job) => this.isTerminalState(job.state))
      .sort((a, b) => b.updated_at - a.updated_at);
    const staleJobs = terminalJobs.slice(CHAT_STREAM_RETENTION_MAX_TERMINAL_JOBS);
    for (const job of staleJobs) {
      this.jobs.delete(job.job_id);
      this.runtimePayloads.delete(job.job_id);
      await this.state.storage.delete(this.toJobStorageKey(job.job_id));
    }
  }

  private toEventStorageKey(sequence: number): string {
    return `stream:event:${String(sequence).padStart(16, "0")}`;
  }

  private fromEventStorageKey(key: string): number {
    const raw = key.slice("stream:event:".length);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private isTerminalState(state: ChatStreamJobState): boolean {
    return state === "completed" || state === "failed" || state === "cancelled";
  }

  private async appendEvent(jobId: string, type: ChatStreamEventType, payload: Record<string, unknown>): Promise<ChatStreamEvent> {
    const event: ChatStreamEvent = {
      sequence: this.nextSequence,
      job_id: jobId,
      type,
      payload,
      created_at: Date.now(),
    };
    this.nextSequence += 1;
    const keysToDelete: string[] = [];
    while (this.nextSequence - this.firstSequence > CHAT_STREAM_RETENTION_MAX_EVENTS) {
      keysToDelete.push(this.toEventStorageKey(this.firstSequence));
      this.firstSequence += 1;
    }
    await this.state.storage.transaction(async (tx) => {
      await tx.put(this.toEventStorageKey(event.sequence), event);
      for (const key of keysToDelete) {
        await tx.delete(key);
      }
      await tx.put(CHAT_STREAM_META_KEY, {
        next_sequence: this.nextSequence,
        first_sequence: this.firstSequence,
      } satisfies ChatStreamMeta);
    });
    this.broadcastEvent(event);
    return event;
  }

  private formatSseEvent(event: ChatStreamEvent): string {
    const payload: Record<string, unknown> = {
      sequence: event.sequence,
      cursor: String(event.sequence),
      job_id: event.job_id,
      type: event.type,
      payload: event.payload,
    };
    if (event.type === "user_message" && typeof event.payload.user_message_id === "string") {
      payload.user_message_id = event.payload.user_message_id;
    }
    if (event.type === "content_delta" && typeof event.payload.content_delta === "string") {
      const contentDelta = event.payload.content_delta;
      payload.choices = [{ delta: { content: contentDelta } }];
    }
    if (event.type === "reasoning_delta" && typeof event.payload.reasoning_delta === "string") {
      payload.reasoning_delta = event.payload.reasoning_delta;
    }
    if (event.type === "job_failed" && typeof event.payload.error === "string") {
      payload.error = event.payload.error;
    }
    return `id: ${event.sequence}\ndata: ${JSON.stringify(payload)}\n\n`;
  }

  private queueWrite(subscriber: LiveSubscriber, chunk: string): void {
    subscriber.pending = subscriber.pending
      .then(() => subscriber.writer.write(this.encoder.encode(chunk)))
      .catch(() => {
        this.subscribers.delete(subscriber.id);
      });
  }

  private broadcastEvent(event: ChatStreamEvent): void {
    const chunk = this.formatSseEvent(event);
    for (const subscriber of this.subscribers.values()) {
      if (subscriber.job_id !== event.job_id) {
        continue;
      }
      this.queueWrite(subscriber, chunk);
    }
  }

  private async closeSubscribersForJob(jobId: string): Promise<void> {
    const targets = [...this.subscribers.values()].filter((subscriber) => subscriber.job_id === jobId);
    for (const subscriber of targets) {
      this.subscribers.delete(subscriber.id);
      try {
        await subscriber.pending;
      } catch {
        // ignore write failures while closing
      }
      try {
        await subscriber.writer.close();
      } catch {
        // ignore close failures
      }
    }
  }

  private async readEventsAfter(cursor: number, jobId: string): Promise<ChatStreamEvent[]> {
    const normalizedCursor = Number.isFinite(cursor) && cursor > 0 ? Math.floor(cursor) : 0;
    const startSequence = Math.max(normalizedCursor + 1, this.firstSequence);
    const events: ChatStreamEvent[] = [];
    const listLimit = 512;
    let startKey = this.toEventStorageKey(startSequence);
    while (true) {
      const listed = await this.state.storage.list<ChatStreamEvent>({
        start: startKey,
        end: "stream:event:\uffff",
        limit: listLimit,
      });
      if (listed.size === 0) {
        break;
      }
      let lastKey = "";
      for (const [key, value] of listed) {
        lastKey = key;
        const sequence = this.fromEventStorageKey(key);
        if (!value || sequence <= normalizedCursor) {
          continue;
        }
        if (value.job_id !== jobId) {
          continue;
        }
        events.push(value);
      }
      if (listed.size < listLimit || !lastKey) {
        break;
      }
      startKey = `${lastKey}\0`;
    }
    events.sort((a, b) => a.sequence - b.sequence);
    return events;
  }

  private async handleSubmit(request: Request): Promise<Response> {
    const payload = await request.json() as ChatStreamSubmitPayload;
    if (!payload?.session_id || !payload?.user_id || !payload?.user_message_id || !Array.isArray(payload?.open_router_messages)) {
      return new Response(JSON.stringify({ error: "Invalid submit payload." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (payload.client_request_id) {
      for (const existing of this.jobs.values()) {
        if (existing.client_request_id === payload.client_request_id && existing.payload.user_id === payload.user_id) {
          try {
            await upsertChatStreamJobRecord(this.env.D1_DB, existing);
          } catch (error) {
            logError("chat.do.recovery_state_persist_failed", {
              session_id: payload.session_id,
              job_id: existing.job_id,
            }, error);
          }
          logInfo("chat.do.submit_deduplicated", {
            session_id: payload.session_id,
            job_id: existing.job_id,
            state: existing.state,
          });
          return new Response(JSON.stringify({
            job_id: existing.job_id,
            state: existing.state,
          }), { headers: { "Content-Type": "application/json" } });
        }
      }
    }

    const jobId = crypto.randomUUID();
    const now = Date.now();
    const job: ChatStreamStoredJob = {
      job_id: jobId,
      state: "queued",
      client_request_id: payload.client_request_id,
      payload: {
        session_id: payload.session_id,
        user_id: payload.user_id,
        user_message_id: payload.user_message_id,
        new_session: payload.new_session,
      },
      cursor: null,
      created_at: now,
      updated_at: now,
      error: null,
    };
    this.jobs.set(jobId, job);
    this.runtimePayloads.set(jobId, payload);
    await this.persistJob(job);
    const userMessageEvent = await this.appendEvent(jobId, "user_message", { user_message_id: payload.user_message_id });
    job.cursor = userMessageEvent.sequence;
    job.updated_at = Date.now();
    this.jobs.set(jobId, job);
    await this.persistJob(job);
    try {
      await upsertChatStreamJobRecord(this.env.D1_DB, job);
    } catch (error) {
      logError("chat.do.recovery_state_persist_failed", {
        session_id: payload.session_id,
        job_id: jobId,
      }, error);
    }
    logInfo("chat.do.submit_accepted", {
      session_id: payload.session_id,
      job_id: jobId,
      user_id: payload.user_id,
      user_message_id: payload.user_message_id,
      cursor: userMessageEvent.sequence,
    });

    if (!this.processing) {
      this.state.waitUntil(this.processQueue());
    }

    return new Response(JSON.stringify({
      job_id: jobId,
      state: job.state,
      cursor: String(userMessageEvent.sequence),
    }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleEvents(request: Request, url: URL): Promise<Response> {
    const jobId = url.searchParams.get("job_id")?.trim() ?? "";
    const cursorRaw = url.searchParams.get("cursor")?.trim() ?? "";
    const cursor = Number(cursorRaw);
    const body = await request.json() as { user_id?: string };
    const userId = body.user_id?.trim() ?? "";
    if (!jobId || !userId) {
      return new Response(JSON.stringify({ error: "job_id and user_id are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const job = this.jobs.get(jobId);
    if (!job || job.payload.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Job not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const replayEvents = await this.readEventsAfter(cursor, jobId);
    logTrace("chat.do.events_connected", {
      job_id: jobId,
      user_id: userId,
      cursor,
      replay_count: replayEvents.length,
      state: job.state,
    });
   let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
   let closed = false;
   let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
   const clearKeepAliveTimer = (): void => {
     if (keepAliveTimer !== null) {
       clearInterval(keepAliveTimer);
       keepAliveTimer = null;
     }
   };
   const enqueueChunk = (chunk: string): void => {
     if (closed || !streamController) {
       return;
     }
     streamController.enqueue(this.encoder.encode(chunk));
   };
   const closeStream = (): void => {
     if (closed) {
       return;
     }
     closed = true;
     clearKeepAliveTimer();
     try {
       streamController?.close();
     } catch {
       // ignore close failures
     }
   };
   const readable = new ReadableStream<Uint8Array>({
     start(controller) {
       streamController = controller;
       controller.enqueue(new TextEncoder().encode(": connected\n\n"));
     },
     cancel() {
       closed = true;
       clearKeepAliveTimer();
       streamController = null;
     },
   });
   const response = new Response(readable, {
     headers: {
       "Content-Type": "text/event-stream; charset=utf-8",
       "Cache-Control": "no-cache, no-transform",
       Connection: "keep-alive",
       "X-Accel-Buffering": "no",
     },
   });

   keepAliveTimer = setInterval(() => {
     try {
       enqueueChunk(": keep-alive\n\n");
     } catch {
       clearKeepAliveTimer();
     }
   }, CHAT_STREAM_KEEPALIVE_INTERVAL_MS);

   let streamCursor = Number.isFinite(cursor) && cursor > 0 ? Math.floor(cursor) : 0;
   for (const event of replayEvents) {
     enqueueChunk(this.formatSseEvent(event));
     streamCursor = event.sequence;
   }

   if (this.isTerminalState(job.state)) {
     closeStream();
     return response;
   }

   const pumpEvents = async (): Promise<void> => {
     try {
       while (true) {
         const nextEvents = await this.readEventsAfter(streamCursor, jobId);
         if (nextEvents.length > 0) {
           for (const event of nextEvents) {
             enqueueChunk(this.formatSseEvent(event));
             streamCursor = event.sequence;
             if (event.type === "job_completed" || event.type === "job_failed") {
               return;
             }
           }
           continue;
         }

         const currentJob = this.jobs.get(jobId);
         if (!currentJob || this.isTerminalState(currentJob.state)) {
           break;
         }

         await sleep(CHAT_STREAM_POLL_INTERVAL_MS);
       }
     } catch (error) {
       logError(
         "chat.do.events_pump_failed",
         {
           job_id: jobId,
           user_id: userId,
         },
         error,
       );
     } finally {
       closeStream();
     }
   };

   this.state.waitUntil(pumpEvents());
   return response;
  }

  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;
    try {
      while (true) {
        const queued = [...this.jobs.values()]
          .filter((item) => item.state === "queued")
          .sort((a, b) => a.created_at - b.created_at)[0];
        if (!queued) {
          break;
        }
        queued.state = "running";
        queued.updated_at = Date.now();
        this.jobs.set(queued.job_id, queued);
        await this.persistJob(queued);
        try {
          await upsertChatStreamJobRecord(this.env.D1_DB, queued);
        } catch (error) {
          logError("chat.do.recovery_state_persist_failed", {
            session_id: queued.payload.session_id,
            job_id: queued.job_id,
            state: queued.state,
          }, error);
        }
        await this.appendEvent(queued.job_id, "job_started", { state: "running" });
        logInfo("chat.do.job_started", {
          session_id: queued.payload.session_id,
          job_id: queued.job_id,
          user_id: queued.payload.user_id,
        });
        try {
          const runtimePayload = this.runtimePayloads.get(queued.job_id);
          if (!runtimePayload) {
            throw new Error("Streaming payload expired. Please retry.");
          }
          await this.runJob(queued, runtimePayload);
          queued.state = "completed";
          queued.updated_at = Date.now();
          this.jobs.set(queued.job_id, queued);
          await this.persistJob(queued);
          try {
            await upsertChatStreamJobRecord(this.env.D1_DB, queued);
          } catch (error) {
            logError("chat.do.recovery_state_persist_failed", {
              session_id: queued.payload.session_id,
              job_id: queued.job_id,
              state: queued.state,
            }, error);
          }
          await this.appendEvent(queued.job_id, "job_completed", { state: "completed" });
          logInfo("chat.do.job_completed", {
            session_id: queued.payload.session_id,
            job_id: queued.job_id,
          });
          await this.closeSubscribersForJob(queued.job_id);
          this.runtimePayloads.delete(queued.job_id);
          await this.pruneTerminalJobs();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Internal error";
          const upstreamError = error instanceof Error ? (error as Error & {
            upstream_status?: number;
            upstream_status_text?: string;
            upstream_reason?: string;
            upstream_endpoint?: string;
            upstream_model?: string;
            upstream_iteration?: number;
          }) : null;
          queued.state = "failed";
          queued.error = errorMessage;
          queued.updated_at = Date.now();
          this.jobs.set(queued.job_id, queued);
          await this.persistJob(queued);
          try {
            await upsertChatStreamJobRecord(this.env.D1_DB, queued);
          } catch (persistError) {
            logError("chat.do.recovery_state_persist_failed", {
              session_id: queued.payload.session_id,
              job_id: queued.job_id,
              state: queued.state,
            }, persistError);
          }
          await this.appendEvent(queued.job_id, "job_failed", { error: errorMessage });
          logError("chat.do.job_failed", {
            session_id: queued.payload.session_id,
            job_id: queued.job_id,
            user_id: queued.payload.user_id,
            user_message_id: queued.payload.user_message_id,
            error: errorMessage,
            ...(upstreamError?.upstream_status !== undefined ? {
              failure_stage: "upstream_request",
              upstream_status: upstreamError.upstream_status,
              upstream_status_text: upstreamError.upstream_status_text ?? null,
              upstream_reason: upstreamError.upstream_reason ?? null,
              upstream_endpoint: upstreamError.upstream_endpoint ?? null,
              upstream_model: upstreamError.upstream_model ?? null,
              upstream_iteration: upstreamError.upstream_iteration ?? null,
            } : {}),
          });
          await this.closeSubscribersForJob(queued.job_id);
          this.runtimePayloads.delete(queued.job_id);
          await this.pruneTerminalJobs();
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async runJob(job: ChatStreamStoredJob, payload: ChatStreamSubmitPayload): Promise<void> {
    const db = this.env.D1_DB;
    const pricingTable = parsePricingConfig(this.env);
    let currentMessages = [...payload.open_router_messages];
    let iteration = 0;
    const maxIterations = 5;
    let finalUsage: OpenRouterUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost: 0 };
    let finalResponseModel = payload.selected_model;
    let lastFullResponse = "";
    let lastReasoningSummary = "";

    try {
      logTrace("chat.do.run.begin", {
        session_id: payload.session_id,
        job_id: job.job_id,
        model: payload.selected_model,
      });
      while (iteration < maxIterations) {
        iteration += 1;
        let fullResponse = "";
        let reasoningSummary = "";
        let responseModel = payload.selected_model;
        let usage: OpenRouterUsage | null = null;
        let streamBuffer = "";
        const toolCalls: any[] = [];

        const currentUpstreamRequestBody = payload.use_chat_completions_api
          ? {
              ...payload.upstream_request_body,
              messages: currentMessages,
            }
          : {
              ...payload.upstream_request_body,
              input: currentMessages.map((item) => ({
                type: "message" as const,
                role: item.role,
                content: toResponsesInputContent(item.content),
              })),
            };

        const upstream = await fetch(payload.api_endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.env.AI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(currentUpstreamRequestBody),
        });
        if (!upstream.ok) {
          const reason = await upstream.text();
          const upstreamReason = formatTraceText(reason.trim()) || "Upstream request failed.";
          logError("chat.do.upstream_request_failed", {
            session_id: payload.session_id,
            job_id: job.job_id,
            user_id: payload.user_id,
            user_message_id: payload.user_message_id,
            iteration,
            model: payload.selected_model,
            endpoint: payload.api_endpoint,
            upstream_status: upstream.status,
            upstream_status_text: upstream.statusText,
            upstream_reason: upstreamReason.slice(0, 500),
            request_url: payload.request_url,
          });
          const upstreamError = new Error(`Upstream error (${upstream.status}): ${upstreamReason}`);
          (upstreamError as Error & {
            upstream_status?: number;
            upstream_status_text?: string;
            upstream_reason?: string;
            upstream_endpoint?: string;
            upstream_model?: string;
            upstream_iteration?: number;
          }).upstream_status = upstream.status;
          (upstreamError as Error & {
            upstream_status?: number;
            upstream_status_text?: string;
            upstream_reason?: string;
            upstream_endpoint?: string;
            upstream_model?: string;
            upstream_iteration?: number;
          }).upstream_status_text = upstream.statusText;
          (upstreamError as Error & {
            upstream_status?: number;
            upstream_status_text?: string;
            upstream_reason?: string;
            upstream_endpoint?: string;
            upstream_model?: string;
            upstream_iteration?: number;
          }).upstream_reason = upstreamReason.slice(0, 500);
          (upstreamError as Error & {
            upstream_status?: number;
            upstream_status_text?: string;
            upstream_reason?: string;
            upstream_endpoint?: string;
            upstream_model?: string;
            upstream_iteration?: number;
          }).upstream_endpoint = payload.api_endpoint;
          (upstreamError as Error & {
            upstream_status?: number;
            upstream_status_text?: string;
            upstream_reason?: string;
            upstream_endpoint?: string;
            upstream_model?: string;
            upstream_iteration?: number;
          }).upstream_model = payload.selected_model;
          (upstreamError as Error & {
            upstream_status?: number;
            upstream_status_text?: string;
            upstream_reason?: string;
            upstream_endpoint?: string;
            upstream_model?: string;
            upstream_iteration?: number;
          }).upstream_iteration = iteration;
          throw upstreamError;
        }
        logTrace("chat.do.run.upstream_connected", {
          session_id: payload.session_id,
          job_id: job.job_id,
          iteration,
          endpoint: payload.api_endpoint,
        });
        const upstreamReader = upstream.body?.getReader();
        if (!upstreamReader) {
          throw new Error("Upstream stream is empty.");
        }
        try {
          while (true) {
            const { done, value } = await upstreamReader.read();
            if (done) {
              break;
            }
            streamBuffer += decoder.decode(value, { stream: true });
            let lineBreakIndex = streamBuffer.indexOf("\n");
            while (lineBreakIndex >= 0) {
              const line = streamBuffer.slice(0, lineBreakIndex).trim();
              streamBuffer = streamBuffer.slice(lineBreakIndex + 1);
              if (!line.startsWith("data:")) {
                lineBreakIndex = streamBuffer.indexOf("\n");
                continue;
              }
              const payloadText = line.slice(5).trim();
              if (payloadText === "[DONE]") {
                lineBreakIndex = streamBuffer.indexOf("\n");
                continue;
              }
              let parsed: any;
              try {
                parsed = JSON.parse(payloadText);
              } catch {
                lineBreakIndex = streamBuffer.indexOf("\n");
                continue;
              }
              if (parsed && typeof parsed === "object") {
                if (parsed.error) {
                  throw new Error(typeof parsed.error === "string" ? parsed.error : parsed.error.message || "Unknown error");
                }
                if (parsed.model) {
                  responseModel = parsed.model;
                }
                const choices = parsed.choices;
                if (Array.isArray(choices) && choices.length > 0) {
                  const delta = choices[0].delta;
                  if (delta) {
                    if (delta.content) {
                      const deltaText = typeof delta.content === "string" ? delta.content : extractModelMessageContent(delta.content);
                      if (deltaText) {
                        fullResponse += deltaText;
                        await this.appendEvent(job.job_id, "content_delta", { content_delta: deltaText });
                      }
                    }
                    if (delta.reasoning) {
                      reasoningSummary += delta.reasoning;
                      await this.appendEvent(job.job_id, "reasoning_delta", { reasoning_delta: delta.reasoning });
                    }
                    if (delta.tool_calls) {
                      for (const tc of delta.tool_calls) {
                        if (!toolCalls[tc.index]) {
                          toolCalls[tc.index] = { id: tc.id, type: tc.type, function: { name: "", arguments: "" } };
                        }
                        if (tc.id) {
                          toolCalls[tc.index].id = tc.id;
                        }
                        if (tc.function?.name) {
                          toolCalls[tc.index].function.name += tc.function.name;
                        }
                        if (tc.function?.arguments) {
                          toolCalls[tc.index].function.arguments += tc.function.arguments;
                        }
                      }
                    }
                  }
                }
                usage = parseOpenRouterUsage(parsed.usage);
              }
              lineBreakIndex = streamBuffer.indexOf("\n");
            }
          }
        } finally {
          upstreamReader.releaseLock();
        }

        if (usage) {
          finalUsage.prompt_tokens = toFiniteNumber(finalUsage.prompt_tokens) + toFiniteNumber(usage.prompt_tokens);
          finalUsage.completion_tokens = toFiniteNumber(finalUsage.completion_tokens) + toFiniteNumber(usage.completion_tokens);
          finalUsage.total_tokens = toFiniteNumber(finalUsage.total_tokens) + toFiniteNumber(usage.total_tokens);
          finalUsage.cost = toFiniteNumber(finalUsage.cost) + toFiniteNumber(usage.cost);
        }
        finalResponseModel = responseModel;
        lastFullResponse = fullResponse;
        lastReasoningSummary = reasoningSummary;

        if (toolCalls.length > 0) {
          const activeToolCalls = toolCalls.filter((tc) => tc.function.name);
          currentMessages.push({
            role: "assistant",
            content: fullResponse || "",
            tool_calls: activeToolCalls,
          } as any);
          for (const tc of activeToolCalls) {
            const toolName = tc.function.name;
            const toolArgsRaw = tc.function.arguments || "{}";
            let toolArgs: any = {};
            try {
              toolArgs = JSON.parse(toolArgsRaw);
            } catch {
              toolArgs = {};
            }
            const handler = TOOLS[toolName];
            let result: string;
            if (handler) {
              const searchTip = toolName === "web_search"
                ? `\n> **Arona is searching:** \`${toolArgs.query}\`...\n`
                : `\n> **Arona is using tool:** \`${toolName}\`...\n`;
              await this.appendEvent(job.job_id, "content_delta", { content_delta: searchTip });
              result = await handler.execute(toolArgs, this.env, { defaultCount: payload.chat_settings.web_search_max_results });
            } else {
              result = `Error: Tool "${toolName}" not found.`;
            }
            currentMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result,
            } as any);
          }
          continue;
        }
        break;
      }

      if (lastFullResponse.trim().length > 0) {
        const assistantMessageId = crypto.randomUUID();
        await db
          .prepare("INSERT INTO messages (id, session_id, role, content, model, reasoning_summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(assistantMessageId, payload.session_id, "assistant", lastFullResponse, finalResponseModel, lastReasoningSummary.trim() || null, Date.now())
          .run();
        if (payload.new_session) {
          const titleResult = await generateSessionTitleWithContext(
            {
              env: this.env,
              requestUrl: payload.request_url,
              requestId: "durable-object",
              logLevel: DEFAULT_LOG_LEVEL,
            },
            db,
            payload.user_message,
            lastFullResponse,
          );
          await insertUsageRecord(db, payload.session_id, titleResult.model, titleResult.usage, pricingTable);
          if (titleResult.title) {
            await db.prepare("UPDATE sessions SET title = ? WHERE id = ?").bind(titleResult.title, payload.session_id).run();
          }
        }
      }
      await insertUsageRecord(db, payload.session_id, finalResponseModel, finalUsage, pricingTable);
      logInfo("chat.do.run.persisted_assistant", {
        session_id: payload.session_id,
        job_id: job.job_id,
        model: finalResponseModel,
        output_chars: lastFullResponse.length,
        total_tokens: finalUsage.total_tokens,
      });
    } catch (error) {
      const usedTokens = toFiniteNumber(finalUsage.total_tokens);
      const usedCost = toFiniteNumber(finalUsage.cost);
      if (usedTokens > 0 || usedCost > 0) {
        await insertUsageRecord(db, payload.session_id, finalResponseModel, finalUsage, pricingTable);
      }
      throw error;
    }
  }
}

export default app;
