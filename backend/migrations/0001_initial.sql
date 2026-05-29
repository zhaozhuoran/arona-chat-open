CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT, created_at INTEGER);
CREATE TABLE messages (id TEXT PRIMARY KEY, session_id TEXT, role TEXT, content TEXT, created_at INTEGER);
CREATE TABLE attachments (id TEXT PRIMARY KEY, file_hash TEXT UNIQUE, file_name TEXT, mime_type TEXT, size INTEGER, r2_url TEXT, created_at INTEGER);
CREATE TABLE message_attachments (message_id TEXT, attachment_id TEXT, PRIMARY KEY (message_id, attachment_id));

CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_attachments_hash ON attachments(file_hash);
