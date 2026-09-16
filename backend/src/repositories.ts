import type { D1Database, D1Result } from "@cloudflare/workers-types";

export interface Session {
  id: string;
  title: string;
  created_at: number;
  workspace_id: string;
  user_id: string;
  archived_at?: number | null;
  pinned_at?: number | null;
}

export interface Message {
  id: string;
  session_id: string;
  role: string;
  content: string | null;
  model?: string | null;
  reasoning_summary?: string | null;
  created_at: number;
}

export interface Attachment {
  id: string;
  file_hash: string | null;
  file_name: string;
  mime_type: string;
  size: number;
  r2_url: string;
  r2_object_key: string | null;
  cached_get_url: string | null;
  cached_get_url_expires_at: number | null;
  status: string;
  user_id: string;
  conversation_id: string | null;
  created_at: number;
}

export interface LibraryFile {
  id: string;
  file_name: string;
  mime_type: string;
  size: number;
  r2_url: string;
  r2_object_key: string | null;
  cached_get_url: string | null;
  cached_get_url_expires_at: number | null;
  status: string;
  user_id: string;
  created_at: number;
}

export interface UploadSession {
  id: string;
  user_id: string;
  intended_type: string;
  object_key: string | null;
  status: string;
  size_reserved: number;
  size_actual?: number | null;
  mime_type?: string | null;
  file_name?: string | null;
  conversation_id?: string | null;
  created_at: number;
  expires_at: number;
  updated_at: number;
}

export interface Workspace {
  id: string;
  name: string;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
  user_id: string;
}

export interface Provider {
  id: string;
  name: string;
  endpoint: string;
  api_key_masked: string;
  is_built_in: number;
  owner_id: string | null;
  owner_email: string | null;
  visibility: string;
  created_at: number;
  updated_at: number;
}

export interface Model {
  id: string;
  provider_id: string;
  model_id: string;
  name: string;
  input_usd_per_million: number;
  output_usd_per_million: number;
  is_active: number;
  created_at: number;
  updated_at: number;
}

export class SessionRepository {
  constructor(private db: D1Database) {}

  async findSessionById(id: string, workspaceId: string): Promise<Session | null> {
    return this.db
      .prepare("SELECT id, title, created_at, workspace_id, user_id, archived_at, pinned_at FROM sessions WHERE id = ? AND workspace_id = ? LIMIT 1")
      .bind(id, workspaceId)
      .first<Session>();
  }

  async createSession(id: string, title: string, createdAt: number, workspaceId: string, userId: string): Promise<D1Result<unknown>> {
    return this.db
      .prepare("INSERT OR IGNORE INTO sessions (id, title, created_at, workspace_id, user_id) VALUES (?, ?, ?, ?, ?)")
      .bind(id, title, createdAt, workspaceId, userId)
      .run();
  }

  async updateSessionTitle(title: string, id: string, workspaceId: string, userId: string): Promise<void> {
    await this.db
      .prepare("UPDATE sessions SET title = ? WHERE id = ? AND workspace_id = ? AND user_id = ?")
      .bind(title, id, workspaceId, userId)
      .run();
  }

  async setSessionArchived(archivedAt: number | null, id: string, workspaceId: string, userId: string): Promise<void> {
    await this.db
      .prepare("UPDATE sessions SET archived_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ?")
      .bind(archivedAt, id, workspaceId, userId)
      .run();
  }

  async setSessionPinned(pinnedAt: number | null, id: string, workspaceId: string, userId: string): Promise<void> {
    await this.db
      .prepare("UPDATE sessions SET pinned_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ?")
      .bind(pinnedAt, id, workspaceId, userId)
      .run();
  }
}

export class MessageRepository {
  constructor(private db: D1Database) {}

  async findUserMessage(id: string, sessionId: string): Promise<Message | null> {
    return this.db
      .prepare("SELECT id, session_id, role, content, created_at FROM messages WHERE id = ? AND session_id = ? AND role = 'user'")
      .bind(id, sessionId)
      .first<Message>();
  }

  async createMessage(id: string, sessionId: string, role: string, content: string, model: string | null, createdAt: number): Promise<void> {
    await this.db
      .prepare("INSERT INTO messages (id, session_id, role, content, model, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, sessionId, role, content, model, createdAt)
      .run();
  }
}

export class AttachmentRepository {
  constructor(private db: D1Database) {}

  async findAttachmentById(id: string, userId: string): Promise<Attachment | null> {
    return this.db
      .prepare("SELECT id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at FROM attachments WHERE id = ? AND status = 'active' AND user_id = ?")
      .bind(id, userId)
      .first<Attachment>();
  }

  async listAttachments(userId: string, limit: number, cursor?: { createdAt: number; id: string }): Promise<Attachment[]> {
    if (cursor) {
      return (await this.db
        .prepare("SELECT id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at FROM attachments WHERE status = 'active' AND user_id = ? AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT ?")
        .bind(userId, cursor.createdAt, cursor.createdAt, cursor.id, limit)
        .all<Attachment>()).results;
    }
    return (await this.db
      .prepare("SELECT id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at FROM attachments WHERE status = 'active' AND user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
      .bind(userId, limit)
      .all<Attachment>()).results;
  }

  async deleteAttachment(id: string, userId: string): Promise<void> {
    await this.db
      .prepare("UPDATE attachments SET status = 'deleted', r2_object_key = NULL, cached_get_url = NULL, cached_get_url_expires_at = NULL WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .run();
  }

  async updateAttachmentConversationId(conversationId: string, id: string, userId: string): Promise<void> {
    await this.db
      .prepare("UPDATE attachments SET conversation_id = ? WHERE id = ? AND user_id = ?")
      .bind(conversationId, id, userId)
      .run();
  }

  async linkMessageAttachment(messageId: string, attachmentId: string): Promise<void> {
    await this.db
      .prepare("INSERT OR IGNORE INTO message_attachments (message_id, attachment_id) VALUES (?, ?)")
      .bind(messageId, attachmentId)
      .run();
  }

  async createAttachment(id: string, fileName: string, mimeType: string, size: number, r2Url: string, r2ObjectKey: string, cachedUrl: string | null, cachedUrlExpires: number | null, userId: string, conversationId: string | null, createdAt: number): Promise<void> {
    await this.db
      .prepare("INSERT INTO attachments (id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)")
      .bind(id, fileName, mimeType, size, r2Url, r2ObjectKey, cachedUrl, cachedUrlExpires, userId, conversationId, createdAt)
      .run();
  }
}

export class LibraryRepository {
  constructor(private db: D1Database) {}

  async findLibraryFileById(id: string, userId: string): Promise<LibraryFile | null> {
    return this.db
      .prepare("SELECT id, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, created_at FROM library_files WHERE id = ? AND status = 'active' AND user_id = ?")
      .bind(id, userId)
      .first<LibraryFile>();
  }

  async listLibraryFiles(userId: string, limit: number, cursor?: { createdAt: number; id: string }): Promise<LibraryFile[]> {
    if (cursor) {
      return (await this.db
        .prepare("SELECT id, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, created_at FROM library_files WHERE status = 'active' AND user_id = ? AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT ?")
        .bind(userId, cursor.createdAt, cursor.createdAt, cursor.id, limit)
        .all<LibraryFile>()).results;
    }
    return (await this.db
      .prepare("SELECT id, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, created_at FROM library_files WHERE status = 'active' AND user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
      .bind(userId, limit)
      .all<LibraryFile>()).results;
  }

  async deleteLibraryFile(id: string, userId: string): Promise<void> {
    await this.db
      .prepare("UPDATE library_files SET status = 'deleted', r2_object_key = NULL, cached_get_url = NULL, cached_get_url_expires_at = NULL WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .run();
  }

  async createLibraryFile(id: string, fileName: string, mimeType: string, size: number, r2Url: string, r2ObjectKey: string, cachedUrl: string | null, cachedUrlExpires: number | null, userId: string, createdAt: number): Promise<void> {
    await this.db
      .prepare("INSERT INTO library_files (id, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)")
      .bind(id, fileName, mimeType, size, r2Url, r2ObjectKey, cachedUrl, cachedUrlExpires, userId, createdAt)
      .run();
  }
}

export class UploadRepository {
  constructor(private db: D1Database) {}

  async createUploadSession(id: string, userId: string, intendedType: string, objectKey: string, sizeReserved: number, conversationId: string | null, fileName: string, mimeType: string, createdAt: number, expiresAt: number): Promise<void> {
    await this.db
      .prepare("INSERT INTO upload_sessions (id, user_id, intended_type, object_key, status, size_reserved, conversation_id, file_name, mime_type, created_at, expires_at, updated_at) VALUES (?, ?, ?, ?, 'reserved', ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, userId, intendedType, objectKey, sizeReserved, conversationId, fileName, mimeType, createdAt, expiresAt, createdAt)
      .run();
  }

  async findUploadSession(id: string, userId: string): Promise<UploadSession | null> {
    return this.db
      .prepare("SELECT id, user_id, intended_type, object_key, status, size_reserved, size_actual, mime_type, file_name, conversation_id, created_at, expires_at, updated_at FROM upload_sessions WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .first<UploadSession>();
  }

  async updateUploadSessionUploaded(sizeActual: number, id: string): Promise<void> {
    await this.db
      .prepare("UPDATE upload_sessions SET status = 'uploaded', size_actual = ?, updated_at = ? WHERE id = ?")
      .bind(sizeActual, Date.now(), id)
      .run();
  }

  async updateUploadSessionConfirmed(sizeActual: number, id: string): Promise<void> {
    await this.db
      .prepare("UPDATE upload_sessions SET status = 'confirmed', size_actual = ?, updated_at = ? WHERE id = ?")
      .bind(sizeActual, Date.now(), id)
      .run();
  }

  async abandonUploadSession(id: string): Promise<void> {
    await this.db
      .prepare("UPDATE upload_sessions SET status = 'abandoned', object_key = NULL, updated_at = ? WHERE id = ?")
      .bind(Date.now(), id)
      .run();
  }
}

export class WorkspaceRepository {
  constructor(private db: D1Database) {}

  async createWorkspace(id: string, name: string, createdAt: number, userId: string): Promise<void> {
    await this.db
      .prepare("INSERT INTO workspaces (id, name, archived_at, created_at, updated_at, user_id) VALUES (?, ?, NULL, ?, ?, ?)")
      .bind(id, name, createdAt, createdAt, userId)
      .run();
  }

  async updateWorkspaceName(name: string, id: string, userId: string): Promise<void> {
    await this.db
      .prepare("UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(name, Date.now(), id, userId)
      .run();
  }

  async setWorkspaceArchived(archivedAt: number | null, id: string, userId: string): Promise<void> {
    await this.db
      .prepare("UPDATE workspaces SET archived_at = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(archivedAt, Date.now(), id, userId)
      .run();
  }

  async findWorkspaceById(id: string, userId: string): Promise<Workspace | null> {
    return this.db
      .prepare("SELECT id, name, archived_at, created_at, updated_at, user_id FROM workspaces WHERE id = ? AND user_id = ? LIMIT 1")
      .bind(id, userId)
      .first<Workspace>();
  }
}

export class ProfileRepository {
  constructor(private db: D1Database) {}

  async getProfileThemeAndStyle(userId: string): Promise<{ theme: string | null; ethereal_streaming_style: string | null } | null> {
    return this.db
      .prepare("SELECT theme, ethereal_streaming_style FROM profiles WHERE user_id = ?")
      .bind(userId)
      .first<{ theme: string | null; ethereal_streaming_style: string | null }>();
  }

  async getProfileAvatarKey(userId: string): Promise<{ avatar_key: string | null } | null> {
    return this.db
      .prepare("SELECT avatar_key FROM profiles WHERE user_id = ?")
      .bind(userId)
      .first<{ avatar_key: string | null }>();
  }

  async updateProfileAvatarKey(avatarKey: string | null, userId: string): Promise<void> {
    await this.db
      .prepare("UPDATE profiles SET avatar_key = ?, updated_at = ? WHERE user_id = ?")
      .bind(avatarKey, Date.now(), userId)
      .run();
  }

  async findProfileUser(userId: string): Promise<{ user_id: string; is_admin: number } | null> {
    return this.db
      .prepare("SELECT user_id, is_admin FROM profiles WHERE user_id = ?")
      .bind(userId)
      .first<{ user_id: string; is_admin: number }>();
  }

  async findProfileBasic(userId: string): Promise<{ user_id: string } | null> {
    return this.db
      .prepare("SELECT user_id FROM profiles WHERE user_id = ?")
      .bind(userId)
      .first<{ user_id: string }>();
  }
}

export class ProviderRepository {
  constructor(private db: D1Database) {}

  async listProviders(showAll: boolean, userId: string): Promise<Provider[]> {
    const query = showAll
      ? "SELECT id, name, endpoint, api_key_masked, is_built_in, owner_id, owner_email, visibility, created_at, updated_at FROM ai_providers ORDER BY is_built_in DESC, name ASC"
      : "SELECT id, name, endpoint, api_key_masked, is_built_in, owner_id, owner_email, visibility, created_at, updated_at FROM ai_providers WHERE is_built_in = 1 OR visibility = 'global' OR owner_id = ? ORDER BY is_built_in DESC, name ASC";
    const stmt = showAll ? this.db.prepare(query) : this.db.prepare(query).bind(userId);
    return (await stmt.all<Provider>()).results;
  }

  async createProvider(id: string, name: string, endpoint: string, keyEncrypted: string, keyMasked: string, ownerId: string, ownerEmail: string | null, visibility: string): Promise<void> {
    await this.db
      .prepare("INSERT INTO ai_providers (id, name, endpoint, api_key_encrypted, api_key_masked, is_built_in, owner_id, owner_email, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)")
      .bind(id, name, endpoint, keyEncrypted, keyMasked, ownerId, ownerEmail, visibility, Date.now(), Date.now())
      .run();
  }

  async findProviderInfo(id: string): Promise<{ is_built_in: number; owner_id: string | null; visibility: string } | null> {
    return this.db
      .prepare("SELECT is_built_in, owner_id, visibility FROM ai_providers WHERE id = ?")
      .bind(id)
      .first<{ is_built_in: number; owner_id: string | null; visibility: string }>();
  }

  async countProviderModels(providerId: string): Promise<number> {
    const row = await this.db
      .prepare("SELECT COUNT(*) as count FROM ai_models WHERE provider_id = ?")
      .bind(providerId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  async deleteProvider(id: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM ai_providers WHERE id = ?")
      .bind(id)
      .run();
  }
}

export class ModelRepository {
  constructor(private db: D1Database) {}

  async listModels(showAll: boolean, userId: string): Promise<Model[]> {
    const query = showAll
      ? "SELECT m.*, p.name as provider_name, p.owner_id, p.owner_email, p.visibility, p.is_built_in as provider_is_built_in FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id ORDER BY p.name ASC, m.name ASC"
      : "SELECT m.*, p.name as provider_name, p.owner_id, p.owner_email, p.visibility, p.is_built_in as provider_is_built_in FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id WHERE p.is_built_in = 1 OR p.visibility = 'global' OR p.owner_id = ? ORDER BY p.name ASC, m.name ASC";
    const stmt = showAll ? this.db.prepare(query) : this.db.prepare(query).bind(userId);
    return (await stmt.all<Model>()).results;
  }

  async createModel(id: string, providerId: string, modelId: string, name: string, inputUsd: number, outputUsd: number): Promise<void> {
    await this.db
      .prepare("INSERT INTO ai_models (id, provider_id, model_id, name, input_usd_per_million, output_usd_per_million, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)")
      .bind(id, providerId, modelId, name, inputUsd, outputUsd, Date.now(), Date.now())
      .run();
  }

  async findModelProviderAndOwner(id: string): Promise<{ id: string; owner_id: string | null; is_built_in: number } | null> {
    return this.db
      .prepare("SELECT m.id, p.owner_id, p.is_built_in FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id WHERE m.id = ?")
      .bind(id)
      .first<{ id: string; owner_id: string | null; is_built_in: number }>();
  }

  async deleteModel(id: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM ai_models WHERE id = ?")
      .bind(id)
      .run();
  }
}
