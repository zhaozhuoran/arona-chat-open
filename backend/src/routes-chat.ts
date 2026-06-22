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
import {
  CHAT_STREAM_JOB_KEY_PREFIX,
  CHAT_STREAM_KEEPALIVE_INTERVAL_MS,
  CHAT_STREAM_META_KEY,
  CHAT_STREAM_POLL_INTERVAL_MS,
  CHAT_STREAM_RETENTION_MAX_EVENTS,
  CHAT_STREAM_RETENTION_MAX_TERMINAL_JOBS,
  sleep,
  upsertChatStreamJobRecord,
  fetchActiveChatStreamJob,
  ChatStreamMeta,
  type LiveSubscriber,
} from "./chat-stream";
import { TOOLS, getAvailableTools } from "./tools";
import { type UsageSummary } from "@arona-chat/shared";

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

  const apiEndpoint = c.env.API_ENDPOINT || "https://openrouter.ai/api/v1/chat/completions";
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
        service_tier: chatSettings.service_tier,
        reasoning: { effort: chatSettings.reasoning_effort },
        ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
        ...(plugins.length > 0 ? { plugins } : {}),
      }
    : {
        model: selectedModel,
        input: responseInput,
        stream: true,
        max_output_tokens: maxOverride,
        service_tier: chatSettings.service_tier,
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

  // If no filters (all-time usage requested), use cached values from user_profile to save D1 read lines.
  if (whereClauses.length === 0) {
    const profile = await readProfile(c);
    const summary: UsageSummary = {
      total_requests: profile.total_requests ?? 0,
      total_prompt_tokens: profile.total_prompt_tokens ?? 0,
      total_completion_tokens: profile.total_completion_tokens ?? 0,
      total_tokens: profile.total_tokens ?? 0,
      total_cost_usd: Number((profile.total_cost_usd ?? 0).toFixed(8)),
      by_model: (profile.by_model ?? []).map((item) => ({
        ...item,
        cost_usd: Number(item.cost_usd.toFixed(8)),
      })),
    };
    return c.json({ summary });
  }

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
