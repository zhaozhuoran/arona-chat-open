import {
  AppVariables,
  readBackendBuildInfo,
  AppConfig,
  app,
  encoder,
  decoder,
  TOKEN_TTL_SECONDS,
  CHALLENGE_TTL_MS,
  SIGNED_URL_FALLBACK_EXPIRES_SECONDS,
  SIGNED_URL_REFRESH_BUFFER_MS,
  MAX_AVATAR_BYTES,
  MAX_ATTACHMENT_BYTES,
  DEFAULT_MODEL,
  DEFAULT_PASSKEY_RP_NAME,
  MAX_SESSION_TITLE_LENGTH,
  LATEST_SCHEMA_VERSION,
  EMPTY_MODEL_TEXT_FALLBACK,
  API_FILES_PREFIX_RE,
  AUTHENTICATED_FILE_PROXY_PATH_RE,
  MODEL_FILE_URL_TTL_SECONDS,
  USER_FILE_URL_TTL_SECONDS,
  AI_FILE_URL_TTL_SECONDS,
  MAX_MULTIMODAL_AUDIO_BYTES,
  DEFAULT_LOG_LEVEL,
  TRACE_LOG_MAX_CHARS,
  LOG_LEVEL_CACHE_TTL_MS,
  DEFAULT_SYSTEM_PROMPT_TIMEZONE,
  DEFAULT_BUILD_HASH,
  DEFAULT_BUILD_TIME,
  DEFAULT_SYSTEM_PROMPT_SETTING,
  DEFAULT_MODEL_DEFS,
  DEFAULT_PRICING,
  AppContext,
  AuthTokenPayload,
  ReasoningEffort,
  ChatSettings,
  AttachmentRow,
  LibraryFileRow,
  AttachmentSource,
  ProfileRow,
  PasskeyRow,
  UsageSummaryRow,
  UsageByModelRow,
  OpenRouterUsage,
  TitleGenerationResult,
  OpenRouterContentPart,
  OpenRouterImagePart,
  OpenRouterFilePart,
  OpenRouterInputAudioPart,
  ChatAttachmentPayload,
  OpenRouterMessage,
  ResponsesInputTextPart,
  ResponsesInputImagePart,
  ResponsesInputFilePart,
  ResponsesInputAudioPart,
  ResponsesInputContentPart,
  SessionMessageRow,
  SessionMessage,
  WorkspaceRow,
  AttachmentModelMeta,
  MessageAttachmentJoinRow,
  ChatStreamJobState,
  ChatStreamSubmitPayload,
  ChatStreamStoredJob,
  ChatStreamRecoveryRow,
  ChatStreamEventType,
  ChatStreamEvent,
  schemaReady,
  schemaReadyPromise,
  logLevelCache,
  hasColumn,
  addColumnIfMissing,
  applySchemaV1,
  applySchemaV2,
  applySchemaV3,
  applySchemaV4,
  applySchemaV5,
  applySchemaV6,
  applySchemaV7,
  applySchemaV8,
  applySchemaV9,
  applySchemaV10,
  applySchemaV11,
  applySchemaV12,
  applySchemaV13,
  applySchemaV14,
  applySchemaV15,
  ensureDatabaseReady,
  SerializedError,
  serializeError,
  buildRequestLogPayload,
  logInfo,
  logTrace,
  logError,
  normalizeLogLevel,
  formatTraceText,
  isJsonLikeContentType,
  isTextLikeContentType,
  isEventStreamContentType,
  parseTraceBody,
  readTraceRequestBody,
  readTraceResponseBody,
  toBase64Url,
  toPlainUint8Array,
  fromBase64Url,
  getAuthSecret,
  timingSafeEqual,
  signJwt,
  issueAuthToken,
  verifyAuthToken,
  requireAuth,
  sanitizeFileName,
  sanitizePathSegment,
  normalizeConversationId,
  normalizeSendShortcut,
  normalizeMimeType,
  isAvatarMimeTypeAllowed,
  readContentLength,
  normalizeEndpoint,
  parseObjectKeyFromUrl,
  buildObjectUrl,
  buildSignedFileProxyPath,
  toAbsoluteUrl,
  isAuthenticatedFileProxyUrl,
  verifyModelFileUrlSignature,
  isAllowedR2ObjectKey,
  isOwnedObjectKey,
  inferAudioFormat,
  toBase64,
  buildPublicUrl,
  createAwsClient,
  getR2Endpoint,
  createGetUrl,
  resolveDirectAccessUrl,
  UPLOADING_STALE_TTL_MS,
  UPLOADING_STALE_CLEANUP_BATCH,
  cleanupStaleUploadingAttachments,
  cleanupStaleUploadingLibraryFiles,
  saveChallenge,
  consumeChallenge,
  parseTransports,
  listPasskeys,
  toPasskeyInfo,
  ensureProfile,
  readProfile,
  getAppSetting,
  setAppSetting,
  getLogLevel,
  setLogLevel,
  getSelectedModel,
  setSelectedModel,
  getTitleModel,
  setTitleModel,
  normalizeReasoningEffort,
  normalizeMaxOutputTokens,
  normalizeDailyBudgetUsd,
  normalizeWebSearchEnabled,
  normalizeWebSearchMaxResults,
  getChatSettings,
  normalizeSessionTitle,
  extractModelMessageContent,
  extractResponseCompletedText,
  buildAssistantContentEventPayload,
  resolveAttachmentType,
  buildOpenRouterMessageContent,
  toResponsesInputContent,
  isChatCompletionsEndpoint,
  generateSessionTitle,
  TitleGenerationContext,
  buildTitleRequestLogPayload,
  generateSessionTitleWithContext,
  getSystemPromptSetting,
  normalizeSystemPromptTimezone,
  getSystemPromptTimezone,
  getShowArchivedSessions,
  listWorkspaces,
  resolveDefaultWorkspaceId,
  getActiveWorkspaceId,
  formatSystemPromptDateTime,
  buildInjectedSystemPrompt,
  normalizePasskeyRpName,
  normalizePasskeyRpId,
  normalizePasskeyOrigin,
  getPasskeyConfig,
  parsePricingConfig,
  resolvePricing,
  calculateCostUsd,
  hasUsageMetrics,
  toFiniteNumber,
  parseOpenRouterUsage,
  insertUsageRecord,
  buildModelOptions,
  resolveAttachmentObjectKey,
  resolveModelReadableAttachmentUrl,
  resolveStoredFileAccessUrl,
  resolveAttachmentAccessUrl,
  resolveLibraryAccessUrl,
  toChatAttachmentPayload,
  getMessageAttachmentsMap,
  listSessionMessages
} from "./backend-utils";
import { type MessageAttachmentType } from "@arona-chat/shared";

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

  const uploadedObject = await c.env.R2_BUCKET.head(pending.r2_object_key);
  if (!uploadedObject) {
    return c.json({ error: "Attachment object is not ready yet." }, 400);
  }
  const uploadedSize = Number(uploadedObject.size ?? 0);
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

  const uploadedObject = await c.env.R2_BUCKET.head(pending.r2_object_key);
  if (!uploadedObject) {
    return c.json({ error: "Library file object is not ready yet." }, 400);
  }
  const uploadedSize = Number(uploadedObject.size ?? 0);
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
