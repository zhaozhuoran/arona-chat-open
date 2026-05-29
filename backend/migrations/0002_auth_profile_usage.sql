ALTER TABLE messages ADD COLUMN model TEXT;
ALTER TABLE attachments ADD COLUMN r2_object_key TEXT;
ALTER TABLE attachments ADD COLUMN cached_get_url TEXT;
ALTER TABLE attachments ADD COLUMN cached_get_url_expires_at INTEGER;

CREATE TABLE IF NOT EXISTS auth_passkeys (
  credential_id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  device_type TEXT NOT NULL DEFAULT 'singleDevice',
  backed_up INTEGER NOT NULL DEFAULT 0,
  nickname TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL,
  avatar_key TEXT,
  avatar_url_cache TEXT,
  avatar_url_cache_expires_at INTEGER,
  dynamic_background INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_records_model ON usage_records(model);
CREATE INDEX IF NOT EXISTS idx_usage_records_created_at ON usage_records(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires_at ON auth_challenges(expires_at);

INSERT OR IGNORE INTO user_profile (id, username, dynamic_background, updated_at)
VALUES (1, 'Sensei', 1, CAST(strftime('%s', 'now') AS INTEGER) * 1000);

INSERT OR IGNORE INTO app_settings (key, value, updated_at)
VALUES ('selected_model', 'openrouter/auto', CAST(strftime('%s', 'now') AS INTEGER) * 1000);
