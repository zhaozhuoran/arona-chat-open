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
