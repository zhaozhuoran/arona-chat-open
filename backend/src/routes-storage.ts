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
  sanitizeMimeType,
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
  listSessionMessages,
  checkAttachmentLimits
} from "./backend-utils";
import { getSingleFileSizeLimitBytes } from "./resource-limits";
import { type MessageAttachmentType } from "@arona-chat/shared";


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
