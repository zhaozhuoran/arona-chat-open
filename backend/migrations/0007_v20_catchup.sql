-- Catch up to V20 schema

-- V3: usage_records extra tokens
ALTER TABLE usage_records ADD COLUMN prompt_cached_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_records ADD COLUMN prompt_cache_write_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_records ADD COLUMN prompt_audio_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_records ADD COLUMN prompt_video_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_records ADD COLUMN completion_reasoning_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_records ADD COLUMN completion_image_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_records ADD COLUMN completion_audio_tokens INTEGER NOT NULL DEFAULT 0;

-- V4: attachments status, user_id, conversation_id
ALTER TABLE attachments ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE attachments ADD COLUMN user_id TEXT;
ALTER TABLE attachments ADD COLUMN conversation_id TEXT;

-- V5: user_profile.send_shortcut
ALTER TABLE user_profile ADD COLUMN send_shortcut TEXT NOT NULL DEFAULT 'ctrl_enter';

-- V6: idx_message_attachments_message_id
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);

-- V7: messages.reasoning_summary
ALTER TABLE messages ADD COLUMN reasoning_summary TEXT;

-- V8: sessions archived/pinned
ALTER TABLE sessions ADD COLUMN archived_at INTEGER;
ALTER TABLE sessions ADD COLUMN pinned_at INTEGER;

-- V9: library_files (Ensuring it is created if not already by 0003)
CREATE TABLE IF NOT EXISTS library_files (
  id TEXT PRIMARY KEY,
  file_name TEXT,
  mime_type TEXT,
  size INTEGER,
  r2_url TEXT,
  r2_object_key TEXT,
  cached_get_url TEXT,
  cached_get_url_expires_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  user_id TEXT,
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_library_files_user_created_at ON library_files(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_files_status_user ON library_files(status, user_id);

-- V10: conversation_library_enabled (Ensuring it is added if not by 0004)
-- ALTER TABLE user_profile ADD COLUMN conversation_library_enabled INTEGER NOT NULL DEFAULT 1; -- Already in 0004

-- V11: workspaces (Ensuring it is handled correctly)
-- Table workspaces created in 0005.
-- sessions.workspace_id added in 0005.
INSERT OR IGNORE INTO workspaces (id, name, archived_at, created_at, updated_at) VALUES ('default', 'Default Workspace', NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
UPDATE sessions SET workspace_id = 'default' WHERE workspace_id IS NULL;
INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('active_workspace_id', 'default', strftime('%s', 'now') * 1000);

-- V12: chat_stream_jobs
CREATE TABLE IF NOT EXISTS chat_stream_jobs (
  session_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_message_id TEXT NOT NULL,
  cursor INTEGER,
  state TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_chat_stream_jobs_user_state_updated ON chat_stream_jobs(user_id, state, updated_at DESC);

-- V13: usage aggregation (Already in 0006)

-- V16: ai_providers and ai_models
CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  api_key_encrypted TEXT,
  is_built_in INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  name TEXT NOT NULL,
  input_usd_per_million REAL NOT NULL DEFAULT 0,
  output_usd_per_million REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (provider_id) REFERENCES ai_providers(id)
);
CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider_id);

-- V17: user_profile.theme
ALTER TABLE user_profile ADD COLUMN theme TEXT DEFAULT 'standard';

-- V18: profiles, request_logs, user_id backfill, app_settings PK
ALTER TABLE sessions ADD COLUMN user_id TEXT;
ALTER TABLE workspaces ADD COLUMN user_id TEXT;
ALTER TABLE usage_records ADD COLUMN user_id TEXT;
ALTER TABLE app_settings ADD COLUMN user_id TEXT;

-- app_settings PK change
CREATE TABLE IF NOT EXISTS app_settings_new (
  key TEXT,
  value TEXT NOT NULL,
  user_id TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (key, user_id)
);
INSERT OR IGNORE INTO app_settings_new (key, value, user_id, updated_at)
SELECT key, value, COALESCE(user_id, 'single-user'), updated_at FROM app_settings;
DROP TABLE IF EXISTS app_settings;
ALTER TABLE app_settings_new RENAME TO app_settings;

CREATE TABLE IF NOT EXISTS request_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_key TEXT,
  avatar_url_cache TEXT,
  avatar_url_cache_expires_at INTEGER,
  dynamic_background INTEGER NOT NULL DEFAULT 1,
  theme TEXT DEFAULT 'standard',
  send_shortcut TEXT NOT NULL DEFAULT 'ctrl_enter',
  conversation_library_enabled INTEGER NOT NULL DEFAULT 1,
  is_admin INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_prompt_tokens INTEGER NOT NULL DEFAULT 0,
  total_completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  usage_by_model_json TEXT
);

-- Migrate existing single-user profile
INSERT OR IGNORE INTO profiles (
  user_id, username, avatar_key, avatar_url_cache, avatar_url_cache_expires_at,
  dynamic_background, theme, send_shortcut, conversation_library_enabled,
  is_admin, updated_at, total_requests, total_prompt_tokens, total_completion_tokens,
  total_tokens, total_cost_usd, usage_by_model_json
)
SELECT
  'single-user', username, avatar_key, avatar_url_cache, avatar_url_cache_expires_at,
  dynamic_background, COALESCE(theme, 'standard'), send_shortcut, conversation_library_enabled,
  1, updated_at, total_requests, total_prompt_tokens, total_completion_tokens,
  total_tokens, total_cost_usd, usage_by_model_json
FROM user_profile WHERE id = 1;

-- Backfill user_id
UPDATE sessions SET user_id = 'single-user' WHERE user_id IS NULL;
UPDATE workspaces SET user_id = 'single-user' WHERE user_id IS NULL;
UPDATE usage_records SET user_id = 'single-user' WHERE user_id IS NULL;
UPDATE attachments SET user_id = 'single-user' WHERE user_id IS NULL;
UPDATE library_files SET user_id = 'single-user' WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_request_logs_user_date ON request_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_date ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_attachments_user_id_status ON attachments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id_created ON sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_user_id ON usage_records(user_id);

-- V19: arona_bubble_style
ALTER TABLE profiles ADD COLUMN arona_bubble_style TEXT DEFAULT 'none';

-- V20: handled by app_settings PK change above

-- Initialize/Update schema_meta to version 20
CREATE TABLE IF NOT EXISTS schema_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT OR REPLACE INTO schema_meta (id, version, updated_at) VALUES (1, 20, strftime('%s', 'now') * 1000);
