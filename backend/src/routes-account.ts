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
  SAFE_INLINE_MIME_TYPES,
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
  getApiCallMode,
  setApiCallMode,
  getSelectedModel,
  setSelectedModel,
  getTitleModel,
  setTitleModel,
  normalizeReasoningEffort,
  normalizeServiceTier,
  normalizeMaxOutputTokens,
  normalizeDailyBudgetUsd,
  normalizeTemporaryDailyBudgetUsd,
  DEFAULT_DAILY_BUDGET_USD,
  normalizeWebSearchEnabled,
  normalizeWebSearchMaxResults,
  normalizeAttachmentMode,
  getChatSettings,
  getCurrentUtcDate,
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
  syncUsageAggregate,
  buildModelOptions,
  invalidateGlobalModelCache,
  resolveAttachmentObjectKey,
  resolveModelReadableAttachmentUrl,
  resolveStoredFileAccessUrl,
  resolveAttachmentAccessUrl,
  resolveLibraryAccessUrl,
  toChatAttachmentPayload,
  getMessageAttachmentsMap,
  listSessionMessages,
  checkRequestLimits,
  resolveModelBuiltIn,
  recordRequestLog,
  AiProviderRow,
  AiModelRow,
  maskApiKey,
  encryptApiKey,
  isModelAllowed,
  assertSafeEndpoint,
} from "./backend-utils";
import { getClerkUserEmail } from "./auth-utils";
import { getUserLimitsStatus } from "./resource-limits";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type Base64URLString,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server";
import { SYSTEM_PROMPT_TIMEZONE_OPTIONS, type LogLevel } from "@arona-chat/shared";

app.post("/api/auth/password-login", async (c) => {
  return c.json({ error: "Password login is disabled. Please use Clerk or Passkey login." }, 403);
});

app.post("/api/auth/passkeys/auth-options", (c) => {
  return c.json({ error: "Passkey authentication has been retired." }, 410);
});

app.post("/api/auth/passkeys/auth-verify", (c) => {
  return c.json({ error: "Passkey authentication has been retired." }, 410);
});

app.post("/api/auth/passkeys/register-options", (c) => {
  return c.json({ error: "Passkey authentication has been retired." }, 410);
});

app.post("/api/auth/passkeys/register-verify", (c) => {
  return c.json({ error: "Passkey authentication has been retired." }, 410);
});

app.get("/api/auth/passkeys", (c) => {
  return c.json({ error: "Passkey authentication has been retired." }, 410);
});

app.delete("/api/auth/passkeys/:id", (c) => {
  return c.json({ error: "Passkey authentication has been retired." }, 410);
});

app.get("/api/auth/me", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const db = c.env.D1_DB;
  const profile = await readProfile(c, auth.sub, auth.isAdmin);
  const [selectedModel, titleModel, chatSettings, logLevel, systemPromptTimezone, showArchivedSessions, activeWorkspaceId, apiCallMode, limits] = await Promise.all([
    getSelectedModel(db, auth.sub),
    getTitleModel(db, auth.sub),
    getChatSettings(db, auth.sub),
    getLogLevel(db),
    getSystemPromptTimezone(db),
    getShowArchivedSessions(db, auth.sub),
    getActiveWorkspaceId(db, auth.sub),
    getApiCallMode(db),
    getUserLimitsStatus(c, auth.sub, auth.isAdmin),
  ]);
  const passkeyCountRow = await db.prepare("SELECT COUNT(*) as count FROM auth_passkeys").first<{ count: number }>();

  return c.json({
    authenticated: true,
    method: auth.method,
    is_admin: auth.isAdmin,
    can_manage_ai: auth.canManageAi,
    can_view_all_users: auth.canViewAllUsers,
    profile,
    selected_model: selectedModel,
    title_model: titleModel,
    chat_settings: chatSettings,
    log_level: logLevel,
    system_prompt_timezone: systemPromptTimezone,
    show_archived_sessions: showArchivedSessions,
    active_workspace_id: activeWorkspaceId,
    api_call_mode: apiCallMode,
    limits,
    passkey_count: Number(passkeyCountRow?.count ?? 0),
    instance_id: auth.sub,
    schema_version: LATEST_SCHEMA_VERSION,
    limits_enabled: c.env.ENABLE_USER_LIMITS === "1" || c.env.ENABLE_USER_LIMITS === "true",
    ...readBackendBuildInfo(c.env),
  });
});

app.get("/api/models", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const pricingTable = parsePricingConfig(c.env);
  const [selectedModel, titleModel, chatSettings, logLevel, systemPromptTimezone, showArchivedSessions, activeWorkspaceId, apiCallMode] = await Promise.all([
    getSelectedModel(c.env.D1_DB, auth.sub),
    getTitleModel(c.env.D1_DB, auth.sub),
    getChatSettings(c.env.D1_DB, auth.sub),
    getLogLevel(c.env.D1_DB),
    getSystemPromptTimezone(c.env.D1_DB),
    getShowArchivedSessions(c.env.D1_DB, auth.sub),
    getActiveWorkspaceId(c.env.D1_DB, auth.sub),
    getApiCallMode(c.env.D1_DB),
  ]);
  return c.json({
    selected_model: selectedModel,
    title_model: titleModel,
    chat_settings: chatSettings,
    log_level: logLevel,
    system_prompt_timezone: systemPromptTimezone,
    show_archived_sessions: showArchivedSessions,
    active_workspace_id: activeWorkspaceId,
    api_call_mode: apiCallMode,
    instance_id: auth.sub,
    schema_version: LATEST_SCHEMA_VERSION,
    models: await buildModelOptions(c, pricingTable, selectedModel, auth, titleModel),
    ...readBackendBuildInfo(c.env),
  });
});

app.put("/api/settings/model", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{ model?: string }>();
  const model = body.model?.trim();
  if (!model) {
    return c.json({ error: "Model is required." }, 400);
  }

  if (!auth.isAdmin) {
    const allowed = await isModelAllowed(c.env.D1_DB, model, auth);
    if (!allowed) {
      return c.json({ error: `Model '${model}' is not allowed or not supported.` }, 400);
    }
  }

  await setSelectedModel(c.env.D1_DB, model, auth.sub);
  return c.json({ selected_model: model });
});

app.put("/api/settings/usage/sync", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  await syncUsageAggregate(c.env.D1_DB, auth.sub);
  const profile = await readProfile(c, auth.sub, auth.isAdmin);
  return c.json({ profile });
});

app.put("/api/settings/title-model", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{ model?: string }>();
  const model = body.model?.trim();
  if (!model) {
    return c.json({ error: "Model is required." }, 400);
  }

  if (!auth.isAdmin) {
    const allowed = await isModelAllowed(c.env.D1_DB, model, auth);
    if (!allowed) {
      return c.json({ error: `Model '${model}' is not allowed or not supported.` }, 400);
    }
  }

  await setTitleModel(c.env.D1_DB, model, auth.sub);
  return c.json({ title_model: model });
});

app.put("/api/settings/chat", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<Partial<ChatSettings>>();
  const current = await getChatSettings(c.env.D1_DB, auth.sub);
  const requestedTemporaryDailyBudgetUsd =
    body.temporary_daily_budget_usd === undefined
      ? current.temporary_daily_budget_usd
      : normalizeTemporaryDailyBudgetUsd(body.temporary_daily_budget_usd === null ? null : String(body.temporary_daily_budget_usd));
  const next: ChatSettings = {
    service_tier: normalizeServiceTier(body.service_tier ?? current.service_tier),
    reasoning_effort: normalizeReasoningEffort(body.reasoning_effort ?? current.reasoning_effort),
    max_output_tokens: normalizeMaxOutputTokens(
      body.max_output_tokens === undefined ? String(current.max_output_tokens) : String(body.max_output_tokens),
    ),
    web_search_enabled:
      body.web_search_enabled === undefined ? current.web_search_enabled : Boolean(body.web_search_enabled),
    daily_budget_usd: normalizeDailyBudgetUsd(body.daily_budget_usd === undefined ? String(current.daily_budget_usd) : String(body.daily_budget_usd)),
    temporary_daily_budget_usd: requestedTemporaryDailyBudgetUsd,
    temporary_daily_budget_date_utc:
      body.temporary_daily_budget_usd === undefined
        ? current.temporary_daily_budget_date_utc
        : requestedTemporaryDailyBudgetUsd === null
          ? null
          : getCurrentUtcDate(),
    web_search_max_results: normalizeWebSearchMaxResults(
      body.web_search_max_results === undefined ? String(current.web_search_max_results) : String(body.web_search_max_results),
    ),
    attachment_mode: normalizeAttachmentMode(body.attachment_mode ?? current.attachment_mode),
    disable_max_output_tokens:
      body.disable_max_output_tokens === undefined
        ? current.disable_max_output_tokens
        : Boolean(body.disable_max_output_tokens),
    daily_budget_enabled: auth.isAdmin
      ? (body.daily_budget_enabled === undefined ? current.daily_budget_enabled : Boolean(body.daily_budget_enabled))
      : current.daily_budget_enabled,
  };

  await Promise.all([
    setAppSetting(c.env.D1_DB, "service_tier", next.service_tier, auth.sub),
    setAppSetting(c.env.D1_DB, "reasoning_effort", next.reasoning_effort, auth.sub),
    setAppSetting(c.env.D1_DB, "max_output_tokens", String(next.max_output_tokens), auth.sub),
    setAppSetting(c.env.D1_DB, "daily_budget_usd", String(next.daily_budget_usd), auth.sub),
    setAppSetting(c.env.D1_DB, "temporary_daily_budget_usd", next.temporary_daily_budget_usd === null ? "" : String(next.temporary_daily_budget_usd), auth.sub),
    setAppSetting(c.env.D1_DB, "temporary_daily_budget_date_utc", next.temporary_daily_budget_date_utc ?? "", auth.sub),
    setAppSetting(c.env.D1_DB, "web_search_enabled", next.web_search_enabled ? "1" : "0", auth.sub),
    setAppSetting(c.env.D1_DB, "web_search_max_results", String(next.web_search_max_results), auth.sub),
    setAppSetting(c.env.D1_DB, "attachment_mode", next.attachment_mode, auth.sub),
    setAppSetting(c.env.D1_DB, "disable_max_output_tokens", next.disable_max_output_tokens ? "1" : "0", auth.sub),
    setAppSetting(c.env.D1_DB, "daily_budget_enabled", next.daily_budget_enabled ? "1" : "0", auth.sub),
  ]);

  return c.json({ chat_settings: next });
});

app.put("/api/settings/log-level", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  if (!auth.isAdmin) return c.json({ error: "Admin access required." }, 403);

  const body = await c.req.json<{ log_level?: string }>();
  const rawLogLevel = body.log_level?.trim();
  if (!rawLogLevel) {
    return c.json({ error: "log_level is required." }, 400);
  }
  const normalized = rawLogLevel.toUpperCase();
  if (normalized !== "INFO" && normalized !== "TRACE") {
    return c.json({ error: "log_level must be INFO or TRACE." }, 400);
  }
  const nextLogLevel = normalized as LogLevel;
  await setLogLevel(c.env.D1_DB, nextLogLevel);
  return c.json({ log_level: nextLogLevel });
});

app.put("/api/settings/system-prompt-timezone", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  if (!auth.isAdmin) return c.json({ error: "Admin access required." }, 403);

  const body = await c.req.json<{ timezone?: string }>();
  const timezone = body.timezone?.trim();
  if (!timezone) {
    return c.json({ error: "timezone is required." }, 400);
  }
  if (!SYSTEM_PROMPT_TIMEZONE_OPTIONS.some((item) => item.value === timezone)) {
    return c.json({ error: "Unsupported timezone." }, 400);
  }
  await setAppSetting(c.env.D1_DB, "system_prompt_timezone", timezone);
  return c.json({ system_prompt_timezone: timezone });
});

app.put("/api/settings/api-call-mode", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  if (!auth.isAdmin) return c.json({ error: "Admin access required." }, 403);

  const body = await c.req.json<{ api_call_mode?: string }>();
  const mode = body.api_call_mode?.trim();
  if (mode !== "fetch") {
    return c.json({ error: "api_call_mode must be 'fetch'. SDK mode has been retired and is no longer supported." }, 400);
  }
  await setApiCallMode(c.env.D1_DB, "fetch");
  return c.json({ api_call_mode: "fetch" });
});

app.put("/api/settings/show-archived-sessions", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{ show_archived_sessions?: boolean }>();
  const showArchivedSessions = Boolean(body.show_archived_sessions);
  await setAppSetting(c.env.D1_DB, "show_archived_sessions", showArchivedSessions ? "1" : "0", auth.sub);
  return c.json({ show_archived_sessions: showArchivedSessions });
});

app.get("/api/profile", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const profile = await readProfile(c, auth.sub, auth.isAdmin);
  return c.json({ profile });
});

app.put("/api/profile", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{
    username?: string;
    avatar_key?: string | null;
    dynamic_background?: boolean;
    theme?: "standard" | "ethereal-light";
    arona_bubble_style?: "none" | "border";
    ethereal_streaming_style?: "typewriter" | "buffered";
    send_shortcut?: "ctrl_enter" | "enter";
    conversation_library_enabled?: boolean;
  }>();

  const rawRow = await c.env.D1_DB
    .prepare("SELECT theme, ethereal_streaming_style FROM profiles WHERE user_id = ?")
    .bind(auth.sub)
    .first<{ theme: string | null; ethereal_streaming_style: string | null }>();

  const currentProfile = await readProfile(c, auth.sub, auth.isAdmin);
  const username = body.username === undefined ? currentProfile.username : body.username.trim();
  if (!username || username.length > 40) {
    return c.json({ error: "Username must be 1-40 characters." }, 400);
  }

  const nextAvatarKey = body.avatar_key === undefined ? currentProfile.avatar_key : body.avatar_key;
  const nextDynamicBackground =
    body.dynamic_background === undefined ? currentProfile.dynamic_background : Boolean(body.dynamic_background);

  let nextTheme = body.theme === undefined ? (rawRow?.theme ?? null) : body.theme;
  if (nextTheme !== null && nextTheme !== "standard" && nextTheme !== "ethereal-light") {
    nextTheme = "ethereal-light";
  }

  let nextAronaBubbleStyle = body.arona_bubble_style === undefined ? (currentProfile.arona_bubble_style || "none") : body.arona_bubble_style;
  if (nextAronaBubbleStyle !== "none" && nextAronaBubbleStyle !== "border") {
    nextAronaBubbleStyle = "none";
  }

  let nextEtherealStreamingStyle = body.ethereal_streaming_style === undefined ? (rawRow?.ethereal_streaming_style ?? null) : body.ethereal_streaming_style;
  if (nextEtherealStreamingStyle !== null && nextEtherealStreamingStyle !== "typewriter" && nextEtherealStreamingStyle !== "buffered") {
    nextEtherealStreamingStyle = "typewriter";
  }
  const nextSendShortcut = body.send_shortcut === undefined ? currentProfile.send_shortcut : normalizeSendShortcut(body.send_shortcut);
  const nextConversationLibraryEnabled =
    body.conversation_library_enabled === undefined
      ? currentProfile.conversation_library_enabled
      : Boolean(body.conversation_library_enabled);

  await c.env.D1_DB
    .prepare(
      "UPDATE profiles SET username = ?, avatar_key = ?, avatar_url_cache = NULL, avatar_url_cache_expires_at = NULL, dynamic_background = ?, theme = ?, arona_bubble_style = ?, ethereal_streaming_style = ?, send_shortcut = ?, conversation_library_enabled = ?, updated_at = ? WHERE user_id = ?",
    )
    .bind(
      username,
      nextAvatarKey,
      nextDynamicBackground ? 1 : 0,
      nextTheme,
      nextAronaBubbleStyle,
      nextEtherealStreamingStyle,
      nextSendShortcut,
      nextConversationLibraryEnabled ? 1 : 0,
      Date.now(),
      auth.sub
    )
    .run();

  const updatedProfile = await readProfile(c, auth.sub, auth.isAdmin);
  return c.json({ profile: updatedProfile });
});

app.get("/api/files/public", async (c) => {
  const objectKey = c.req.query("key")?.trim() ?? "";
  if (!isAllowedR2ObjectKey(objectKey)) {
    return c.json({ error: "Invalid object key." }, 400);
  }

  const exp = c.req.query("exp");
  const sig = c.req.query("sig");
  const valid = await verifyModelFileUrlSignature(c.env, objectKey, exp ?? null, sig ?? null);
  if (!valid) {
    return c.json({ error: "Invalid or expired file access signature." }, 401);
  }

  const object = await c.env.R2_BUCKET.get(objectKey);
  if (!object?.body) {
    return c.json({ error: "File not found." }, 404);
  }

  const headers = new Headers();
  const contentType = object.httpMetadata?.contentType || "application/octet-stream";
  headers.set("Content-Type", contentType);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; sandbox");

  const lastSegment = objectKey.split("/").pop() || "file";
  const underscoreIdx = lastSegment.indexOf("_");
  const filename = underscoreIdx !== -1 ? lastSegment.slice(underscoreIdx + 1) : lastSegment;

  if (!SAFE_INLINE_MIME_TYPES.has(contentType.toLowerCase())) {
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  }
  headers.set("Cache-Control", "private, max-age=600");
  return new Response(object.body, { headers });
});

app.get("/api/files/*", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const rawPath = c.req.path.replace(API_FILES_PREFIX_RE, "");
  if (!rawPath) {
    return c.json({ error: "Object key is required." }, 400);
  }

  let objectKey: string;
  try {
    objectKey = rawPath
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return c.json({ error: "Invalid object key encoding." }, 400);
  }
  if (!isAllowedR2ObjectKey(objectKey)) {
    return c.json({ error: "Invalid object key." }, 400);
  }
  const ownedByUser = await isOwnedObjectKey(c.env.D1_DB, objectKey, auth.sub);
  if (!ownedByUser) {
    return c.json({ error: "Forbidden object key." }, 403);
  }

  const object = await c.env.R2_BUCKET.get(objectKey);
  if (!object?.body) {
    return c.json({ error: "File not found." }, 404);
  }

  const headers = new Headers();
  const contentType = object.httpMetadata?.contentType || "application/octet-stream";
  headers.set("Content-Type", contentType);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; sandbox");

  const lastSegment = objectKey.split("/").pop() || "file";
  const underscoreIdx = lastSegment.indexOf("_");
  const filename = underscoreIdx !== -1 ? lastSegment.slice(underscoreIdx + 1) : lastSegment;

  if (!SAFE_INLINE_MIME_TYPES.has(contentType.toLowerCase())) {
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  }
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(object.body, { headers });
});

app.get("/api/workspaces", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  const includeArchivedRaw = c.req.query("include_archived")?.trim().toLowerCase();
  const includeArchived = includeArchivedRaw === "1" || includeArchivedRaw === "true";
  const db = c.env.D1_DB;
  const [workspaces, activeWorkspaceId] = await Promise.all([
    listWorkspaces(db, includeArchived, auth.sub),
    getActiveWorkspaceId(db, auth.sub),
  ]);
  return c.json({ workspaces, active_workspace_id: activeWorkspaceId });
});

app.post("/api/workspaces", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  const body = await c.req.json<{ name?: string }>();
  const name = normalizeSessionTitle(body.name ?? "");
  if (!name) {
    return c.json({ error: "Workspace name is required." }, 400);
  }
  const now = Date.now();
  const workspaceId = crypto.randomUUID();
  await c.env.D1_DB
    .prepare("INSERT INTO workspaces (id, name, archived_at, created_at, updated_at, user_id) VALUES (?, ?, NULL, ?, ?, ?)")
    .bind(workspaceId, name, now, now, auth.sub)
    .run();
  return c.json({ workspace: { id: workspaceId, name, archived_at: null, created_at: now, updated_at: now } });
});

app.put("/api/workspaces/:id", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  const workspaceId = c.req.param("id")?.trim();
  if (!workspaceId) {
    return c.json({ error: "Workspace id is required." }, 400);
  }
  const body = await c.req.json<{ name?: string }>();
  const name = normalizeSessionTitle(body.name ?? "");
  if (!name) {
    return c.json({ error: "Workspace name is required." }, 400);
  }
  const now = Date.now();
  const result = await c.env.D1_DB
    .prepare("UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind(name, now, workspaceId, auth.sub)
    .run();
  if (!result.success || Number(result.meta.changes ?? 0) === 0) {
    return c.json({ error: "Workspace not found." }, 404);
  }
  return c.json({ success: true, id: workspaceId, name, updated_at: now });
});

app.put("/api/workspaces/:id/archive", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  const workspaceId = c.req.param("id")?.trim();
  if (!workspaceId) {
    return c.json({ error: "Workspace id is required." }, 400);
  }
  const body = await c.req.json<{ archived?: boolean }>();
  const archived = body.archived !== false;
  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB, auth.sub);
  if (archived && workspaceId === activeWorkspaceId) {
    return c.json({ error: "Cannot archive active workspace. Please switch workspace first." }, 400);
  }
  const now = Date.now();
  const result = await c.env.D1_DB
    .prepare("UPDATE workspaces SET archived_at = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind(archived ? now : null, now, workspaceId, auth.sub)
    .run();
  if (!result.success || Number(result.meta.changes ?? 0) === 0) {
    return c.json({ error: "Workspace not found." }, 404);
  }
  return c.json({ success: true, archived });
});

app.put("/api/workspaces/:id/activate", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  const workspaceId = c.req.param("id")?.trim();
  if (!workspaceId) {
    return c.json({ error: "Workspace id is required." }, 400);
  }
  const workspace = await c.env.D1_DB
    .prepare("SELECT id, archived_at FROM workspaces WHERE id = ? AND user_id = ? LIMIT 1")
    .bind(workspaceId, auth.sub)
    .first<{ id: string; archived_at: number | null }>();
  if (!workspace?.id) {
    return c.json({ error: "Workspace not found." }, 404);
  }
  if (workspace.archived_at) {
    return c.json({ error: "Archived workspace cannot be activated. Please enable it first." }, 400);
  }
  await setAppSetting(c.env.D1_DB, "active_workspace_id", workspace.id, auth.sub);
  return c.json({ success: true, active_workspace_id: workspace.id });
});

app.get("/api/sessions", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const includeArchivedRaw = c.req.query("include_archived")?.trim().toLowerCase();
  const includeArchived = includeArchivedRaw === "1" || includeArchivedRaw === "true";
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") || 50)));
  const offset = Math.max(0, Number(c.req.query("offset") || 0));

  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB, auth.sub);
  const whereSql = includeArchived
    ? "WHERE workspace_id = ? AND user_id = ?"
    : "WHERE workspace_id = ? AND user_id = ? AND archived_at IS NULL";

  const query = `SELECT id, title, created_at, archived_at, pinned_at
       FROM sessions
       ${whereSql}
       ORDER BY CASE WHEN pinned_at IS NULL THEN 1 ELSE 0 END ASC, pinned_at DESC, created_at DESC
       LIMIT ? OFFSET ?`;

  const { results } = await c.env.D1_DB
    .prepare(query)
    .bind(activeWorkspaceId, auth.sub, limit + 1, offset)
    .all<{ id: string; title: string; created_at: number; archived_at: number | null; pinned_at: number | null }>();

  const rows = results ?? [];
  const hasMore = rows.length > limit;
  const sessions = hasMore ? rows.slice(0, limit) : rows;

  return c.json({ sessions, has_more: hasMore });
});

app.put("/api/sessions/:id/title", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const sessionId = c.req.param("id")?.trim();
  if (!sessionId) {
    return c.json({ error: "Session id is required." }, 400);
  }

  const body = await c.req.json<{ title?: string }>();
  const title = normalizeSessionTitle(body.title ?? "");
  if (!title) {
    return c.json({ error: "Title is required." }, 400);
  }

  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB, auth.sub);
  const existingSession = await c.env.D1_DB
    .prepare("SELECT id FROM sessions WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(sessionId, activeWorkspaceId)
    .first<{ id: string }>();
  if (!existingSession) {
    return c.json({ error: "Session not found." }, 404);
  }

  const result = await c.env.D1_DB
    .prepare("UPDATE sessions SET title = ? WHERE id = ? AND workspace_id = ? AND user_id = ?")
    .bind(title, sessionId, activeWorkspaceId, auth.sub)
    .run();
  if (!result.success) {
    throw new Error("Failed to update session title.");
  }

  return c.json({ success: true, title });
});

app.post("/api/sessions/:id/title/auto", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const sessionId = c.req.param("id")?.trim();
  if (!sessionId) {
    return c.json({ error: "Session id is required." }, 400);
  }

  const db = c.env.D1_DB;
  const PricingTable = parsePricingConfig(c.env);

  const titleModel = await getTitleModel(db, auth.sub);
  const titleIsBuiltIn = await resolveModelBuiltIn(c.env, titleModel, auth);

  const limitCheck = await checkRequestLimits(c.env, auth.sub, auth.isAdmin, titleIsBuiltIn);
  if (!limitCheck.allowed) {
    await recordRequestLog(db, auth.sub, "title", "failure");
    return c.json({ error: limitCheck.error }, 429);
  }

  const activeWorkspaceId = await getActiveWorkspaceId(db, auth.sub);
  const existingSession = await db
    .prepare("SELECT id FROM sessions WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(sessionId, activeWorkspaceId)
    .first<{ id: string }>();
  if (!existingSession?.id) {
    return c.json({ error: "Session not found." }, 404);
  }

  const history = await listSessionMessages(c, sessionId, auth.sub);
  const userTranscript = history
    .filter((item) => item.role === "user")
    .map((item) => {
      let content = item.content.trim();
      if (Array.isArray(item.attachments) && item.attachments.length > 0) {
        const attachmentNames = item.attachments.map((att) => att.file_name || "unnamed file").join(", ");
        if (content) {
          content += ` [Attachments: ${attachmentNames}]`;
        } else {
          content = `[Attachments: ${attachmentNames}]`;
        }
      }
      return content;
    })
    .filter((content) => content.length > 0)
    .join("\n\n");
  const assistantTranscript = history
    .filter((item) => item.role === "assistant")
    .map((item) => item.content.trim())
    .filter((content) => content.length > 0)
    .join("\n\n");

  if (!userTranscript || !assistantTranscript) {
    return c.json({ error: "Not enough conversation content to generate a title." }, 400);
  }

  const titleResult = await generateSessionTitle(c, db, userTranscript, assistantTranscript, auth.sub);
  await insertUsageRecord(db, sessionId, titleResult.model, titleResult.usage, PricingTable, auth.sub, "default", !titleIsBuiltIn);
  if (!titleResult.title) {
    if (titleIsBuiltIn) {
      await recordRequestLog(db, auth.sub, "title", "failure");
    }
    return c.json({ error: "Failed to generate title." }, 502);
  }

  if (titleIsBuiltIn) {
    await recordRequestLog(db, auth.sub, "title", "success");
  }

  const result = await db
    .prepare("UPDATE sessions SET title = ? WHERE id = ? AND workspace_id = ? AND user_id = ?")
    .bind(titleResult.title, sessionId, activeWorkspaceId, auth.sub)
    .run();
  if (!result.success) {
    throw new Error("Failed to update session title.");
  }

  return c.json({ success: true, title: titleResult.title });
});

app.put("/api/sessions/:id/archive", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const sessionId = c.req.param("id")?.trim();
  if (!sessionId) {
    return c.json({ error: "Session id is required." }, 400);
  }
  const body = await c.req.json<{ archived?: boolean }>();
  const archived = body.archived !== false;
  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB, auth.sub);
  const result = await c.env.D1_DB
    .prepare("UPDATE sessions SET archived_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ?")
    .bind(archived ? Date.now() : null, sessionId, activeWorkspaceId, auth.sub)
    .run();
  if (!result.success) {
    throw new Error("Failed to update session archive state.");
  }
  if (!result.meta.changes) {
    return c.json({ error: "Session not found." }, 404);
  }
  return c.json({ success: true, archived });
});

app.put("/api/sessions/:id/pin", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const sessionId = c.req.param("id")?.trim();
  if (!sessionId) {
    return c.json({ error: "Session id is required." }, 400);
  }
  const body = await c.req.json<{ pinned?: boolean }>();
  const pinned = body.pinned !== false;
  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB, auth.sub);
  const result = await c.env.D1_DB
    .prepare("UPDATE sessions SET pinned_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ?")
    .bind(pinned ? Date.now() : null, sessionId, activeWorkspaceId, auth.sub)
    .run();
  if (!result.success) {
    throw new Error("Failed to update session pin state.");
  }
  if (!result.meta.changes) {
    return c.json({ error: "Session not found." }, 404);
  }
  return c.json({ success: true, pinned });
});

app.get("/api/sessions/:id/messages", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const sessionId = c.req.param("id")?.trim();
  if (!sessionId) {
    return c.json({ error: "Session id is required." }, 400);
  }
  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB, auth.sub);
  const existingSession = await c.env.D1_DB
    .prepare("SELECT id FROM sessions WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(sessionId, activeWorkspaceId)
    .first<{ id: string }>();
  if (!existingSession?.id) {
    return c.json({ error: "Session not found in active workspace." }, 404);
  }
  const messages = await listSessionMessages(c, sessionId, auth.sub);
    return c.json({ messages });
  });

  // ---------------------------------------------------------------------------
  // Admin-only user management. Non-admins can NEVER reach these regardless of
  // any other granted permission.
  // ---------------------------------------------------------------------------
  app.get("/api/admin/users", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    if (!auth.isAdmin) return c.json({ error: "Admin access required." }, 403);

    const db = c.env.D1_DB;
    const { results } = await db
      .prepare("SELECT user_id, username, email, is_admin, can_manage_ai, can_view_all_users, total_requests, total_cost_usd, total_self_added_requests, total_self_added_cost_usd, updated_at FROM profiles ORDER BY is_admin DESC, username ASC")
      .all<{ user_id: string; username: string; email: string | null; is_admin: number; can_manage_ai: number; can_view_all_users: number; total_requests: number; total_cost_usd: number; total_self_added_requests: number; total_self_added_cost_usd: number; updated_at: number }>();

    const settingsRows = await db
      .prepare("SELECT key, value, user_id FROM app_settings WHERE key IN ('daily_budget_enabled', 'daily_budget_usd')")
      .all<{ key: string; value: string; user_id: string }>();

    const users = (results ?? []).map((row) => {
      const userSettings = settingsRows.results?.filter(s => s.user_id === row.user_id) ?? [];
      const enabledSetting = userSettings.find(s => s.key === "daily_budget_enabled")?.value;
      const usdSetting = userSettings.find(s => s.key === "daily_budget_usd")?.value;

      return {
        user_id: row.user_id,
        username: row.username,
        email: row.email ?? null,
        is_admin: Boolean(row.is_admin),
        can_manage_ai: Boolean(row.can_manage_ai),
        can_view_all_users: Boolean(row.can_view_all_users),
        total_requests: Number(row.total_requests ?? 0),
        total_self_added_requests: Number(row.total_self_added_requests ?? 0),
        total_cost_usd: Number(row.total_cost_usd ?? 0),
        total_self_added_cost_usd: Number(row.total_self_added_cost_usd ?? 0),
        daily_budget_enabled: enabledSetting === undefined ? true : (enabledSetting === "1" || enabledSetting === "true"),
        daily_budget_usd: usdSetting === undefined ? DEFAULT_DAILY_BUDGET_USD : normalizeDailyBudgetUsd(usdSetting),
      };
    });

    return c.json({ users });
  });

  app.put("/api/admin/users/:id/permissions", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    if (!auth.isAdmin) return c.json({ error: "Admin access required." }, 403);

    const id = c.req.param("id");
    if (id === "single-user" || id === auth.sub) {
      return c.json({ error: "Cannot modify this user's permissions." }, 403);
    }
    const body = await c.req.json<{ can_manage_ai?: boolean; can_view_all_users?: boolean }>();
    if (typeof body.can_manage_ai !== "boolean" && typeof body.can_view_all_users !== "boolean") {
      return c.json({ error: "No permission field provided." }, 400);
    }

    const existing = await c.env.D1_DB
      .prepare("SELECT user_id, is_admin FROM profiles WHERE user_id = ?")
      .bind(id)
      .first<{ user_id: string; is_admin: number }>();
    if (!existing) return c.json({ error: "User not found." }, 404);
    if (existing.is_admin) return c.json({ error: "Cannot modify an admin's permissions." }, 403);

    const sets: string[] = [];
    const binds: any[] = [];
    if (typeof body.can_manage_ai === "boolean") {
      sets.push("can_manage_ai = ?");
      binds.push(body.can_manage_ai ? 1 : 0);
    }
    if (typeof body.can_view_all_users === "boolean") {
      sets.push("can_view_all_users = ?");
      binds.push(body.can_view_all_users ? 1 : 0);
    }
    sets.push("updated_at = ?");
    binds.push(Date.now());
    binds.push(id);

    await c.env.D1_DB
      .prepare(`UPDATE profiles SET ${sets.join(", ")} WHERE user_id = ?`)
      .bind(...binds)
      .run();

    return c.json({ success: true });
  });

  app.put("/api/admin/users/:id/budget", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    if (!auth.isAdmin) return c.json({ error: "Admin access required." }, 403);

    const id = c.req.param("id");
    let body: { daily_budget_enabled?: boolean; daily_budget_usd?: number };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body." }, 400);
    }

    const existing = await c.env.D1_DB
      .prepare("SELECT user_id FROM profiles WHERE user_id = ?")
      .bind(id)
      .first<{ user_id: string }>();
    if (!existing) return c.json({ error: "User not found." }, 404);

    if (body.daily_budget_enabled !== undefined && typeof body.daily_budget_enabled !== "boolean") {
      return c.json({ error: "daily_budget_enabled must be a boolean." }, 400);
    }

    if (body.daily_budget_usd !== undefined) {
      const budgetNum = Number(body.daily_budget_usd);
      if (!Number.isFinite(budgetNum) || budgetNum < 0.01 || budgetNum > 1000000) {
        return c.json({ error: "daily_budget_usd must be a finite number between 0.01 and 1,000,000." }, 400);
      }
    }

    const promises: Promise<void>[] = [];
    if (typeof body.daily_budget_enabled === "boolean") {
      promises.push(setAppSetting(c.env.D1_DB, "daily_budget_enabled", body.daily_budget_enabled ? "1" : "0", id));
    }
    if (body.daily_budget_usd !== undefined) {
      promises.push(setAppSetting(c.env.D1_DB, "daily_budget_usd", String(normalizeDailyBudgetUsd(String(body.daily_budget_usd))), id));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    return c.json({ success: true });
  });

  app.get("/api/settings/ai-providers", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const showAll = auth.isAdmin || auth.canManageAi;
    const query = showAll
      ? "SELECT id, name, endpoint, api_key_masked, is_built_in, owner_id, owner_email, visibility, created_at, updated_at FROM ai_providers ORDER BY is_built_in DESC, name ASC"
      : "SELECT id, name, endpoint, api_key_masked, is_built_in, owner_id, owner_email, visibility, created_at, updated_at FROM ai_providers WHERE is_built_in = 1 OR visibility = 'global' OR owner_id = ? ORDER BY is_built_in DESC, name ASC";
    const stmt = showAll ? c.env.D1_DB.prepare(query) : c.env.D1_DB.prepare(query).bind(auth.sub);
    const { results } = await stmt.all<AiProviderRow & { owner_id: string | null; owner_email: string | null; visibility: string | null; api_key_masked: string | null }>();

    const providers = (results ?? []).map((row) => {
      let apiKeyMasked = "";
      if (row.is_built_in) {
        apiKeyMasked = "Built-in Key";
      } else if (row.api_key_masked) {
        apiKeyMasked = row.api_key_masked;
      } else if (row.api_key_encrypted) {
        // Legacy provider without a stored preview; key presence is exposed, never the value.
        apiKeyMasked = "Configured";
      }

      return {
        id: row.id,
        name: row.name,
        endpoint: row.endpoint,
        api_key_masked: apiKeyMasked,
        is_built_in: Boolean(row.is_built_in),
        owner_id: row.owner_id ?? null,
        owner_email: showAll ? (row.owner_email ?? row.owner_id ?? null) : (row.owner_id === auth.sub ? (row.owner_email ?? "You") : (row.owner_id ? "Shared" : "Global")),
        visibility: row.visibility ?? (row.is_built_in ? "global" : "private"),
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    return c.json({ providers, encryption_key_ready: Boolean(getAuthSecret(c.env)) });
  });

  app.post("/api/settings/ai-providers", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    if (!getAuthSecret(c.env)) {
      return c.json({ error: "Master encryption key is not configured on the server." }, 403);
    }

    const body = await c.req.json<{ name: string; endpoint: string; api_key: string; visibility?: string }>();
    if (typeof body.name !== "string" || typeof body.endpoint !== "string" || typeof body.api_key !== "string") {
      return c.json({ error: "name, endpoint, and api_key must be strings." }, 400);
    }

    const name = body.name.trim();
    const endpoint = body.endpoint.trim();
    const apiKey = body.api_key.trim();

    if (!name || !endpoint || !apiKey) {
      return c.json({ error: "name, endpoint, and api_key are required." }, 400);
    }

    // Defensive input length boundaries to prevent Denial of Service and database bloat
    if (name.length > 100) {
      return c.json({ error: "Provider name must be <= 100 characters." }, 400);
    }
    if (endpoint.length > 2048) {
      return c.json({ error: "Provider endpoint must be <= 2048 characters." }, 400);
    }
    if (apiKey.length > 2048) {
      return c.json({ error: "API key must be <= 2048 characters." }, 400);
    }

    let validatedEndpoint: string;
    try {
      validatedEndpoint = assertSafeEndpoint(endpoint, c.env);
    } catch (err: any) {
      return c.json({ error: err.message || "Invalid provider endpoint." }, 400);
    }

    // Only managers/admins may publish a provider as globally shared.
    const makeGlobal = (auth.isAdmin || auth.canManageAi) && body.visibility === "global";
    let ownerId: string | null = auth.sub;
    let ownerEmail: string | null = null;
    if (makeGlobal) {
      ownerId = null;
    } else {
      if (c.env.CLERK_SECRET_KEY) {
        try {
          ownerEmail = await getClerkUserEmail(c, auth.sub);
        } catch {
          ownerEmail = null;
        }
      }
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    const encryptedKey = await encryptApiKey(c.env, apiKey);
    const maskedKey = maskApiKey(apiKey);

    await c.env.D1_DB
      .prepare("INSERT INTO ai_providers (id, name, endpoint, api_key_encrypted, api_key_masked, is_built_in, owner_id, owner_email, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)")
      .bind(id, name, validatedEndpoint, encryptedKey, maskedKey, ownerId, ownerEmail, makeGlobal ? "global" : "private", now, now)
      .run();
    invalidateGlobalModelCache();

    return c.json({ id, success: true });
  });

  app.put("/api/settings/ai-providers/:id", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const id = c.req.param("id");
    const body = await c.req.json<{ name?: string; endpoint?: string; api_key?: string; visibility?: string }>();

    const provider = await c.env.D1_DB
      .prepare("SELECT is_built_in, owner_id, visibility FROM ai_providers WHERE id = ?")
      .bind(id)
      .first<{ is_built_in: number; owner_id: string | null; visibility: string | null }>();

    if (!provider) return c.json({ error: "Provider not found." }, 404);
    if (provider.is_built_in) return c.json({ error: "Built-in provider cannot be modified." }, 403);

    // Ownership/permission gate: regular users may only edit their own provider.
    const isManager = auth.isAdmin || auth.canManageAi;
    if (!isManager && provider.owner_id !== auth.sub) {
      return c.json({ error: "You do not have permission to modify this provider." }, 403);
    }

    const updates: string[] = [];
    const binds: any[] = [];

    if (body.name !== undefined) {
      if (typeof body.name !== "string") {
        return c.json({ error: "Provider name must be a string." }, 400);
      }
      const name = body.name.trim();
      if (!name) {
        return c.json({ error: "Provider name cannot be empty." }, 400);
      }
      if (name.length > 100) {
        return c.json({ error: "Provider name must be <= 100 characters." }, 400);
      }
      updates.push("name = ?");
      binds.push(name);
    }
    if (body.endpoint !== undefined) {
      if (typeof body.endpoint !== "string") {
        return c.json({ error: "Provider endpoint must be a string." }, 400);
      }
      const endpoint = body.endpoint.trim();
      if (!endpoint) {
        return c.json({ error: "Provider endpoint cannot be empty." }, 400);
      }
      if (endpoint.length > 2048) {
        return c.json({ error: "Provider endpoint must be <= 2048 characters." }, 400);
      }
      let validatedEndpoint: string;
      try {
        validatedEndpoint = assertSafeEndpoint(endpoint, c.env);
      } catch (err: any) {
        return c.json({ error: err.message || "Invalid provider endpoint." }, 400);
      }
      updates.push("endpoint = ?");
      binds.push(validatedEndpoint);
    }
    if (body.api_key !== undefined) {
      if (typeof body.api_key !== "string") {
        return c.json({ error: "API key must be a string." }, 400);
      }
      const apiKey = body.api_key.trim();
      if (!apiKey) {
        return c.json({ error: "API key cannot be empty." }, 400);
      }
      if (apiKey.length > 2048) {
        return c.json({ error: "API key must be <= 2048 characters." }, 400);
      }
      if (!getAuthSecret(c.env)) {
        return c.json({ error: "Master encryption key is not configured." }, 403);
      }
      updates.push("api_key_encrypted = ?");
      binds.push(await encryptApiKey(c.env, apiKey));
      updates.push("api_key_masked = ?");
      binds.push(maskApiKey(apiKey));
    }
    // Only managers/admins may change shared visibility. Demoting to private
    // claims ownership for the acting admin so the provider is never orphaned.
    if (body.visibility && isManager && (body.visibility === "global" || body.visibility === "private")) {
      updates.push("visibility = ?");
      binds.push(body.visibility);
      if (body.visibility === "private") {
        updates.push("owner_id = ?");
        binds.push(auth.sub);
      }
    }

    if (updates.length === 0) return c.json({ error: "Nothing to update." }, 400);

    const now = Date.now();
    updates.push("updated_at = ?");
    binds.push(now);
    binds.push(id);

    await c.env.D1_DB
      .prepare(`UPDATE ai_providers SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...binds)
      .run();
    invalidateGlobalModelCache();

    return c.json({ success: true });
  });

  app.delete("/api/settings/ai-providers/:id", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const id = c.req.param("id");
    const provider = await c.env.D1_DB
      .prepare("SELECT is_built_in, owner_id FROM ai_providers WHERE id = ?")
      .bind(id)
      .first<{ is_built_in: number; owner_id: string | null }>();

    if (!provider) return c.json({ error: "Provider not found." }, 404);
    if (provider.is_built_in) return c.json({ error: "Built-in provider cannot be deleted." }, 403);

    const isManager = auth.isAdmin || auth.canManageAi;
    if (!isManager && provider.owner_id !== auth.sub) {
      return c.json({ error: "You do not have permission to delete this provider." }, 403);
    }

    // Check if there are models using this provider
    const models = await c.env.D1_DB
      .prepare("SELECT COUNT(*) as count FROM ai_models WHERE provider_id = ?")
      .bind(id)
      .first<{ count: number }>();

    if (Number(models?.count ?? 0) > 0) {
      return c.json({ error: "Cannot delete provider with active models. Delete models first." }, 400);
    }

    await c.env.D1_DB.prepare("DELETE FROM ai_providers WHERE id = ?").bind(id).run();
    invalidateGlobalModelCache();
    return c.json({ success: true });
  });

  app.get("/api/settings/ai-models", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const showAll = auth.isAdmin || auth.canManageAi;
    const query = showAll
      ? "SELECT m.*, p.name as provider_name, p.owner_id, p.owner_email, p.visibility, p.is_built_in as provider_is_built_in FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id ORDER BY p.name ASC, m.name ASC"
      : "SELECT m.*, p.name as provider_name, p.owner_id, p.owner_email, p.visibility, p.is_built_in as provider_is_built_in FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id WHERE p.is_built_in = 1 OR p.visibility = 'global' OR p.owner_id = ? ORDER BY p.name ASC, m.name ASC";
    const stmt = showAll ? c.env.D1_DB.prepare(query) : c.env.D1_DB.prepare(query).bind(auth.sub);
    const { results } = await stmt.all<AiModelRow & { provider_name: string; owner_id: string | null; owner_email: string | null; visibility: string | null; provider_is_built_in: number }>();

    return c.json({ models: results ?? [] });
  });

  app.post("/api/settings/ai-models", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const body = await c.req.json<{
      provider_id: string;
      model_id: string;
      name: string;
      input_usd_per_million?: number;
      output_usd_per_million?: number;
    }>();

    if (typeof body.provider_id !== "string" || typeof body.model_id !== "string" || typeof body.name !== "string") {
      return c.json({ error: "provider_id, model_id, and name must be strings." }, 400);
    }

    const providerId = body.provider_id.trim();
    const modelId = body.model_id.trim();
    const name = body.name.trim();

    if (!providerId || !modelId || !name) {
      return c.json({ error: "provider_id, model_id, and name are required." }, 400);
    }

    // Defensive input length boundaries to prevent Denial of Service and layout breaking
    if (providerId.length > 128) {
      return c.json({ error: "Provider ID must be <= 128 characters." }, 400);
    }
    if (modelId.length > 256) {
      return c.json({ error: "Model ID must be <= 256 characters." }, 400);
    }
    if (name.length > 100) {
      return c.json({ error: "Model name must be <= 100 characters." }, 400);
    }

    const inputUsd = body.input_usd_per_million !== undefined ? Number(body.input_usd_per_million) : 0;
    const outputUsd = body.output_usd_per_million !== undefined ? Number(body.output_usd_per_million) : 0;

    if (!Number.isFinite(inputUsd) || inputUsd < 0 || inputUsd > 100000) {
      return c.json({ error: "Invalid input pricing value. Must be a finite non-negative number <= 100,000." }, 400);
    }
    if (!Number.isFinite(outputUsd) || outputUsd < 0 || outputUsd > 100000) {
      return c.json({ error: "Invalid output pricing value. Must be a finite non-negative number <= 100,000." }, 400);
    }

    const provider = await c.env.D1_DB
      .prepare("SELECT id, owner_id, is_built_in FROM ai_providers WHERE id = ?")
      .bind(providerId)
      .first<{ id: string; owner_id: string | null; is_built_in: number }>();
    if (!provider) return c.json({ error: "Provider not found." }, 404);
    if (provider.is_built_in) return c.json({ error: "Cannot add models to the built-in provider." }, 403);

    const isManager = auth.isAdmin || auth.canManageAi;
    if (!isManager && provider.owner_id !== auth.sub) {
      return c.json({ error: "You can only add models to providers you own." }, 403);
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    await c.env.D1_DB
      .prepare("INSERT INTO ai_models (id, provider_id, model_id, name, input_usd_per_million, output_usd_per_million, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)")
      .bind(id, providerId, modelId, name, inputUsd, outputUsd, now, now)
      .run();
    invalidateGlobalModelCache();

    return c.json({ id, success: true });
  });

  app.put("/api/settings/ai-models/:id", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const id = c.req.param("id");
    const body = await c.req.json<Partial<AiModelRow>>();

    const model = await c.env.D1_DB
      .prepare("SELECT m.id, p.owner_id, p.is_built_in FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id WHERE m.id = ?")
      .bind(id)
      .first<{ id: string; owner_id: string | null; is_built_in: number }>();
    if (!model) return c.json({ error: "Model not found." }, 404);
    if (model.is_built_in) return c.json({ error: "Cannot modify models of the built-in provider." }, 403);

    const isManager = auth.isAdmin || auth.canManageAi;
    if (!isManager && model.owner_id !== auth.sub) {
      return c.json({ error: "You do not have permission to modify this model." }, 403);
    }

    const updates: string[] = [];
    const binds: any[] = [];

    if (body.name !== undefined) {
      if (typeof body.name !== "string") {
        return c.json({ error: "Model name must be a string." }, 400);
      }
      const name = body.name.trim();
      if (!name) {
        return c.json({ error: "Model name cannot be empty." }, 400);
      }
      if (name.length > 100) {
        return c.json({ error: "Model name must be <= 100 characters." }, 400);
      }
      updates.push("name = ?");
      binds.push(name);
    }
    if (body.model_id !== undefined) {
      if (typeof body.model_id !== "string") {
        return c.json({ error: "Model ID must be a string." }, 400);
      }
      const modelId = body.model_id.trim();
      if (!modelId) {
        return c.json({ error: "Model ID cannot be empty." }, 400);
      }
      if (modelId.length > 256) {
        return c.json({ error: "Model ID must be <= 256 characters." }, 400);
      }
      updates.push("model_id = ?");
      binds.push(modelId);
    }
    if (body.input_usd_per_million !== undefined) {
      const inputUsd = Number(body.input_usd_per_million);
      if (!Number.isFinite(inputUsd) || inputUsd < 0 || inputUsd > 100000) {
        return c.json({ error: "Invalid input pricing value. Must be a finite non-negative number <= 100,000." }, 400);
      }
      updates.push("input_usd_per_million = ?");
      binds.push(inputUsd);
    }
    if (body.output_usd_per_million !== undefined) {
      const outputUsd = Number(body.output_usd_per_million);
      if (!Number.isFinite(outputUsd) || outputUsd < 0 || outputUsd > 100000) {
        return c.json({ error: "Invalid output pricing value. Must be a finite non-negative number <= 100,000." }, 400);
      }
      updates.push("output_usd_per_million = ?");
      binds.push(outputUsd);
    }
    if (body.is_active !== undefined) {
      updates.push("is_active = ?");
      binds.push(body.is_active ? 1 : 0);
    }

    if (updates.length === 0) return c.json({ error: "Nothing to update." }, 400);

    const now = Date.now();
    updates.push("updated_at = ?");
    binds.push(now);
    binds.push(id);

    await c.env.D1_DB
      .prepare(`UPDATE ai_models SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...binds)
      .run();
    invalidateGlobalModelCache();

    return c.json({ success: true });
  });

  app.delete("/api/settings/ai-models/:id", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const id = c.req.param("id");
    const model = await c.env.D1_DB
      .prepare("SELECT m.id, p.owner_id, p.is_built_in FROM ai_models m JOIN ai_providers p ON m.provider_id = p.id WHERE m.id = ?")
      .bind(id)
      .first<{ id: string; owner_id: string | null; is_built_in: number }>();
    if (!model) return c.json({ error: "Model not found." }, 404);
    if (model.is_built_in) return c.json({ error: "Cannot delete models of the built-in provider." }, 403);

    const isManager = auth.isAdmin || auth.canManageAi;
    if (!isManager && model.owner_id !== auth.sub) {
      return c.json({ error: "You do not have permission to delete this model." }, 403);
    }

    await c.env.D1_DB.prepare("DELETE FROM ai_models WHERE id = ?").bind(id).run();
    invalidateGlobalModelCache();
    return c.json({ success: true });
  });

  app.get("/api/settings/ai-models/upstream", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    if (!auth.isAdmin && !auth.canManageAi) return c.json({ error: "Admin access required." }, 403);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/models");
      if (!response.ok) throw new Error("Failed to fetch from OpenRouter");
      const data = await response.json();
      return c.json(data);
    } catch (error) {
      return c.json({ error: "Failed to fetch upstream models." }, 502);
    }
  });
