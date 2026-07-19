import {
  app,
  requireAuth,
  type AppContext,
  MAX_AVATAR_BYTES,
  MAX_ATTACHMENT_BYTES,
  UPLOAD_SESSION_TTL_MS,
  USER_FILE_URL_TTL_SECONDS,
  sanitizePathSegment,
  sanitizeFileName,
  normalizeMimeType,
  isAvatarMimeTypeAllowed,
  readContentLength,
  toAbsoluteUrl,
  normalizeConversationId,
  resolveDirectAccessUrl,
  buildObjectUrl,
  getR2Endpoint,
} from "./backend-utils";
import { getSingleFileSizeLimitBytes, reserveUploadQuota } from "./resource-limits";

type UploadSessionRow = {
  id: string;
  user_id: string;
  intended_type: "attachment" | "library" | "avatar";
  object_key: string;
  status: string;
  size_reserved: number;
  size_actual: number | null;
  conversation_id: string | null;
  file_name: string | null;
  mime_type: string | null;
};

/**
 * Step 1 — open an upload session. Pre-occupies quota (freeing expired sessions
 * first, then auto-deleting oldest confirmed files to make room) and returns a
 * short-lived upload URL. The session + R2 object expire after 5 minutes if not
 * confirmed.
 */
app.post("/api/upload-sessions", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;

  const body = await c.req.json<{
    intended_type?: string;
    file_name?: string;
    mime_type?: string;
    size?: number;
    conversation_id?: string;
  }>();

  const intendedType = body.intended_type;
  if (intendedType !== "attachment" && intendedType !== "library" && intendedType !== "avatar") {
    return c.json({ error: "intended_type must be 'attachment', 'library' or 'avatar'." }, 400);
  }

  const fileName = body.file_name?.trim();
  if (!fileName) {
    return c.json({ error: "file_name is required." }, 400);
  }
  const mimeType = normalizeMimeType(body.mime_type);
  if (!mimeType) {
    return c.json({ error: "mime_type is required." }, 400);
  }
  if (intendedType === "avatar" && !isAvatarMimeTypeAllowed(mimeType)) {
    return c.json({ error: "Avatar mimeType must be an image/* type." }, 400);
  }

  let conversationId: string | null = null;
  if (intendedType === "attachment") {
    const raw = body.conversation_id?.trim() || "draft";
    try {
      conversationId = normalizeConversationId(raw);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Invalid conversation_id." }, 400);
    }
  }

  const size = Number(body.size ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    return c.json({ error: "size must be a positive number of bytes." }, 400);
  }
  const isBypassed = auth.isAdmin || auth.sub === "single-user";
  const singleCap = intendedType === "avatar" ? MAX_AVATAR_BYTES : isBypassed ? MAX_ATTACHMENT_BYTES : getSingleFileSizeLimitBytes(c.env);
  if (size > singleCap) {
    return c.json({ error: `File size must be <= ${Math.round(singleCap / (1024 * 1024))}MB.` }, 400);
  }

  const reserve = await reserveUploadQuota(c, auth.sub, auth.isAdmin, intendedType, size, conversationId ?? undefined);
  if (!reserve.allowed) {
    return c.json({ error: reserve.error }, 429);
  }

  const safeName = sanitizeFileName(fileName);
  let objectKey: string;
  if (intendedType === "avatar") {
    objectKey = `avatars/${sanitizePathSegment(auth.sub)}/${crypto.randomUUID()}-${safeName}`;
  } else if (intendedType === "library") {
    objectKey = `library/${sanitizePathSegment(auth.sub)}/${crypto.randomUUID()}_${safeName}`;
  } else {
    objectKey = `attachments/${sanitizePathSegment(auth.sub)}/${sanitizePathSegment(conversationId ?? "draft")}/${crypto.randomUUID()}_${safeName}`;
  }

  const now = Date.now();
  const sessionId = crypto.randomUUID();
  const expiresAt = now + UPLOAD_SESSION_TTL_MS;
  await c.env.D1_DB
    .prepare(
      "INSERT INTO upload_sessions (id, user_id, intended_type, object_key, status, size_reserved, conversation_id, file_name, mime_type, created_at, expires_at, updated_at) VALUES (?, ?, ?, ?, 'reserved', ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(sessionId, auth.sub, intendedType, objectKey, size, conversationId, fileName, mimeType, now, expiresAt, now)
    .run();

  const uploadUrl = toAbsoluteUrl(c, `/api/upload-sessions/${sessionId}/upload`);
  return c.json({ session_id: sessionId, object_key: objectKey, upload_url: uploadUrl, expires_at: expiresAt });
});

/**
 * Step 2 — upload the bytes. The real object size comes from R2 (never the
 * client Content-Length), and may not exceed the reserved amount.
 */
app.put("/api/upload-sessions/:id/upload", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;

  const sessionId = c.req.param("id");
  const session = await c.env.D1_DB
    .prepare("SELECT id, user_id, intended_type, object_key, status, size_reserved, mime_type FROM upload_sessions WHERE id = ? AND user_id = ?")
    .bind(sessionId, auth.sub)
    .first<UploadSessionRow>();
  if (!session) {
    return c.json({ error: "Upload session not found." }, 404);
  }
  if (session.status !== "reserved") {
    return c.json({ error: "Session is not in the reserved state." }, 400);
  }

  const singleCap = session.intended_type === "avatar" ? MAX_AVATAR_BYTES : auth.isAdmin || auth.sub === "single-user" ? MAX_ATTACHMENT_BYTES : getSingleFileSizeLimitBytes(c.env);
  const contentLength = readContentLength(c);
  if (contentLength === null || contentLength <= 0 || contentLength > singleCap) {
    return c.json({ error: `File size must be between 1 and ${Math.round(singleCap / (1024 * 1024))}MB.` }, 400);
  }
  if (contentLength > session.size_reserved) {
    return c.json({ error: "Uploaded size exceeds the reserved quota for this session." }, 400);
  }

  const contentType = session.mime_type || c.req.header("content-type")?.trim() || "application/octet-stream";
  const putResult = await c.env.R2_BUCKET.put(session.object_key, c.req.raw.body, {
    httpMetadata: { contentType },
  });
  const actualSize = Number(putResult?.size ?? 0);
  if (actualSize <= 0 || actualSize > singleCap) {
    await c.env.R2_BUCKET.delete(session.object_key).catch(() => {});
    return c.json({ error: `File size must be <= ${Math.round(singleCap / (1024 * 1024))}MB.` }, 400);
  }

  await c.env.D1_DB
    .prepare("UPDATE upload_sessions SET status = 'uploaded', size_actual = ?, updated_at = ? WHERE id = ?")
    .bind(actualSize, Date.now(), sessionId)
    .run();
  return c.json({ success: true, id: sessionId, size: actualSize });
});

/**
 * Step 3 — confirm the file and persist it. Validates the stored object, then
 * writes the final row (attachment / library) or sets the avatar key (deleting
 * the previous avatar object). Invalid data deletes the R2 object.
 */
app.post("/api/upload-sessions/:id/confirm", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;

  const sessionId = c.req.param("id");
  const session = await c.env.D1_DB
    .prepare("SELECT * FROM upload_sessions WHERE id = ? AND user_id = ?")
    .bind(sessionId, auth.sub)
    .first<UploadSessionRow>();
  if (!session) {
    return c.json({ error: "Upload session not found." }, 404);
  }
  if (session.status === "confirmed") {
    return c.json({ error: "Session already confirmed." }, 400);
  }
  if (session.status !== "reserved" && session.status !== "uploaded") {
    return c.json({ error: "Session is not ready to confirm." }, 400);
  }

  const head = await c.env.R2_BUCKET.head(session.object_key);
  const actualSize = Number(head?.size ?? 0);
  if (actualSize <= 0) {
    await c.env.R2_BUCKET.delete(session.object_key).catch(() => {});
    await c.env.D1_DB.prepare("UPDATE upload_sessions SET status = 'abandoned', object_key = NULL, updated_at = ? WHERE id = ?").bind(Date.now(), sessionId).run();
    return c.json({ error: "Uploaded file is missing or empty." }, 400);
  }

  const now = Date.now();
  const endpoint = getR2Endpoint(c.env);
  const r2Url = buildObjectUrl(endpoint, session.object_key);
  const direct = await resolveDirectAccessUrl(c, session.object_key, USER_FILE_URL_TTL_SECONDS);

  let resultId: string;
  if (session.intended_type === "avatar") {
    const profile = await c.env.D1_DB
      .prepare("SELECT avatar_key FROM profiles WHERE user_id = ?")
      .bind(auth.sub)
      .first<{ avatar_key: string | null }>();
    if (profile?.avatar_key && profile.avatar_key !== session.object_key) {
      await c.env.R2_BUCKET.delete(profile.avatar_key).catch(() => {});
    }
    await c.env.D1_DB
      .prepare("UPDATE profiles SET avatar_key = ?, updated_at = ? WHERE user_id = ?")
      .bind(session.object_key, now, auth.sub)
      .run();
    resultId = session.object_key;
  } else if (session.intended_type === "library") {
    resultId = crypto.randomUUID();
    await c.env.D1_DB
      .prepare(
        "INSERT INTO library_files (id, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)",
      )
      .bind(resultId, session.file_name, session.mime_type, actualSize, r2Url, session.object_key, direct.url, direct.expires_at, auth.sub, now)
      .run();
  } else {
    resultId = crypto.randomUUID();
    const conversationId = session.conversation_id ?? "draft";
    await c.env.D1_DB
      .prepare(
        "INSERT INTO attachments (id, file_hash, file_name, mime_type, size, r2_url, r2_object_key, cached_get_url, cached_get_url_expires_at, status, user_id, conversation_id, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)",
      )
      .bind(resultId, session.file_name, session.mime_type, actualSize, r2Url, session.object_key, direct.url, direct.expires_at, auth.sub, conversationId, now)
      .run();
  }

  await c.env.D1_DB
    .prepare("UPDATE upload_sessions SET status = 'confirmed', size_actual = ?, updated_at = ? WHERE id = ?")
    .bind(actualSize, now, sessionId)
    .run();

  return c.json({ success: true, id: resultId, object_key: session.object_key, access_url: direct.url, type: session.intended_type });
});

/**
 * Abandon an upload session and delete its (possibly partial) R2 object.
 */
app.post("/api/upload-sessions/:id/cancel", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;

  const sessionId = c.req.param("id");
  const session = await c.env.D1_DB
    .prepare("SELECT id, object_key, status FROM upload_sessions WHERE id = ? AND user_id = ?")
    .bind(sessionId, auth.sub)
    .first<{ id: string; object_key: string; status: string }>();
  if (!session) {
    return c.json({ error: "Upload session not found." }, 404);
  }
  if (session.status !== "confirmed" && session.status !== "deleted") {
    await c.env.R2_BUCKET.delete(session.object_key).catch(() => {});
  }
  await c.env.D1_DB
    .prepare("UPDATE upload_sessions SET status = 'abandoned', object_key = NULL, updated_at = ? WHERE id = ?")
    .bind(Date.now(), sessionId)
    .run();
  return c.json({ success: true });
});

export default app;
