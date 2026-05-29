CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

ALTER TABLE sessions
ADD COLUMN workspace_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_workspace_created
ON sessions(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspaces_archived_updated
ON workspaces(archived_at, updated_at DESC);
