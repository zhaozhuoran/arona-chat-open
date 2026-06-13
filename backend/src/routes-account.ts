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
  normalizeServiceTier,
  normalizeMaxOutputTokens,
  normalizeDailyBudgetUsd,
  normalizeTemporaryDailyBudgetUsd,
  normalizeWebSearchEnabled,
  normalizeWebSearchMaxResults,
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
  const body = await c.req.json<{ password?: string }>();
  const password = body.password?.trim();

  if (!c.env.AUTH_PASSWORD) {
    logError("auth.password_login_misconfigured", buildRequestLogPayload(c));
    return c.json({ error: "AUTH_PASSWORD is not configured on server." }, 500);
  }
  if (!password) {
    logInfo("auth.password_login_rejected", buildRequestLogPayload(c));
    return c.json({ error: "Invalid password." }, 401);
  }

  const passwordBytes = encoder.encode(password);
  const correctBytes = encoder.encode(c.env.AUTH_PASSWORD);
  const passwordHash = await crypto.subtle.digest("SHA-256", passwordBytes);
  const correctHash = await crypto.subtle.digest("SHA-256", correctBytes);
  const passwordHashStr = btoa(String.fromCharCode(...new Uint8Array(passwordHash)));
  const correctHashStr = btoa(String.fromCharCode(...new Uint8Array(correctHash)));

  if (!timingSafeEqual(passwordHashStr, correctHashStr)) {
    logInfo("auth.password_login_rejected", buildRequestLogPayload(c));
    return c.json({ error: "Invalid password." }, 401);
  }

  const token = await issueAuthToken(c.env, "password");
  logInfo("auth.password_login_succeeded", buildRequestLogPayload(c));
  return c.json({ token });
});

app.post("/api/auth/passkeys/auth-options", async (c) => {
  const passkeys = await listPasskeys(c.env.D1_DB);
  if (passkeys.length === 0) {
    return c.json({ error: "No passkey is registered yet." }, 400);
  }
  const passkeyConfig = await getPasskeyConfig(c);

  const options = await generateAuthenticationOptions({
    rpID: passkeyConfig.rp_id,
    userVerification: "preferred",
    allowCredentials: passkeys.map((passkey) => ({
      id: passkey.credential_id as Base64URLString,
      transports: parseTransports(passkey.transports),
    })),
  });

  await saveChallenge(c.env.D1_DB, "passkey-auth", options.challenge);
  return c.json({ options });
});

app.post("/api/auth/passkeys/auth-verify", async (c) => {
  const body = await c.req.json<{ response?: AuthenticationResponseJSON }>();
  if (!body.response) {
    return c.json({ error: "Passkey response is required." }, 400);
  }

  const challenge = await consumeChallenge(c.env.D1_DB, "passkey-auth");
  if (!challenge) {
    return c.json({ error: "Passkey challenge expired, please retry." }, 400);
  }

  const passkey = await c.env.D1_DB
    .prepare(
      "SELECT credential_id, public_key, counter, transports, device_type, backed_up, nickname, created_at, last_used_at FROM auth_passkeys WHERE credential_id = ?",
    )
    .bind(body.response.id)
    .first<PasskeyRow>();

  if (!passkey) {
    return c.json({ error: "Passkey not found." }, 404);
  }

  const credential: WebAuthnCredential = {
    id: passkey.credential_id as Base64URLString,
    publicKey: fromBase64Url(passkey.public_key),
    counter: Number(passkey.counter),
    transports: parseTransports(passkey.transports),
  };
  const passkeyConfig = await getPasskeyConfig(c);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: passkeyConfig.origin,
      expectedRPID: passkeyConfig.rp_id,
      credential,
      requireUserVerification: true,
    });
  } catch (error) {
    logError("auth.passkey_verify_failed", buildRequestLogPayload(c), error);
    const message = error instanceof Error ? error.message : "Passkey verification failed.";
    return c.json({ error: message }, 400);
  }

  if (!verification.verified) {
    return c.json({ error: "Passkey verification failed." }, 400);
  }

  await c.env.D1_DB
    .prepare("UPDATE auth_passkeys SET counter = ?, last_used_at = ? WHERE credential_id = ?")
    .bind(verification.authenticationInfo.newCounter, Date.now(), passkey.credential_id)
    .run();

  const token = await issueAuthToken(c.env, "passkey");
  logInfo("auth.passkey_login_succeeded", buildRequestLogPayload(c));
  return c.json({ token });
});

app.post("/api/auth/passkeys/register-options", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const db = c.env.D1_DB;
  const profile = await readProfile(c);
  const passkeys = await listPasskeys(db);
  const passkeyConfig = await getPasskeyConfig(c);

  const options = await generateRegistrationOptions({
    rpName: passkeyConfig.rp_name,
    rpID: passkeyConfig.rp_id,
    userName: profile.username || "Sensei",
    userDisplayName: profile.username || "Sensei",
    userID: toPlainUint8Array(encoder.encode("arona-single-user")),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials: passkeys.map((passkey) => ({
      id: passkey.credential_id as Base64URLString,
      transports: parseTransports(passkey.transports),
    })),
  });

  await saveChallenge(db, "passkey-register", options.challenge);
  return c.json({ options });
});

app.post("/api/auth/passkeys/register-verify", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{ response?: RegistrationResponseJSON; nickname?: string }>();
  if (!body.response) {
    return c.json({ error: "Passkey response is required." }, 400);
  }

  const challenge = await consumeChallenge(c.env.D1_DB, "passkey-register");
  if (!challenge) {
    return c.json({ error: "Passkey challenge expired, please retry." }, 400);
  }
  const passkeyConfig = await getPasskeyConfig(c);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: passkeyConfig.origin,
      expectedRPID: passkeyConfig.rp_id,
      requireUserVerification: true,
    });
  } catch (error) {
    logError("auth.passkey_register_verify_failed", buildRequestLogPayload(c), error);
    const message = error instanceof Error ? error.message : "Passkey registration failed.";
    return c.json({ error: message }, 400);
  }

  if (!verification.verified || !verification.registrationInfo) {
    return c.json({ error: "Passkey registration failed." }, 400);
  }

  const credential = verification.registrationInfo.credential;
  const nickname = body.nickname?.trim() || null;
  const now = Date.now();
  await c.env.D1_DB
    .prepare(
      "INSERT INTO auth_passkeys (credential_id, public_key, counter, transports, device_type, backed_up, nickname, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(credential_id) DO UPDATE SET public_key = excluded.public_key, counter = excluded.counter, transports = excluded.transports, device_type = excluded.device_type, backed_up = excluded.backed_up, nickname = excluded.nickname",
    )
    .bind(
      credential.id,
      toBase64Url(credential.publicKey),
      credential.counter,
      credential.transports ? JSON.stringify(credential.transports) : null,
      verification.registrationInfo.credentialDeviceType,
      verification.registrationInfo.credentialBackedUp ? 1 : 0,
      nickname,
      now,
    )
    .run();

  logInfo("auth.passkey_register_succeeded", buildRequestLogPayload(c));
  return c.json({ success: true });
});

app.get("/api/auth/passkeys", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const passkeys = await listPasskeys(c.env.D1_DB);
  return c.json({ passkeys: passkeys.map(toPasskeyInfo) });
});

app.delete("/api/auth/passkeys/:id", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const credentialId = c.req.param("id");
  if (!credentialId) {
    return c.json({ error: "Credential id is required." }, 400);
  }
  await c.env.D1_DB.prepare("DELETE FROM auth_passkeys WHERE credential_id = ?").bind(credentialId).run();
  return c.json({ success: true });
});

app.get("/api/auth/me", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const db = c.env.D1_DB;
  const profile = await readProfile(c);
  const [selectedModel, titleModel, chatSettings, logLevel, systemPromptTimezone, showArchivedSessions, activeWorkspaceId] = await Promise.all([
    getSelectedModel(db),
    getTitleModel(db),
    getChatSettings(db),
    getLogLevel(db),
    getSystemPromptTimezone(db),
    getShowArchivedSessions(db),
    getActiveWorkspaceId(db),
  ]);
  const passkeyCountRow = await db.prepare("SELECT COUNT(*) as count FROM auth_passkeys").first<{ count: number }>();

  return c.json({
    authenticated: true,
    method: auth.method,
    profile,
    selected_model: selectedModel,
    title_model: titleModel,
    chat_settings: chatSettings,
    log_level: logLevel,
    system_prompt_timezone: systemPromptTimezone,
    show_archived_sessions: showArchivedSessions,
    active_workspace_id: activeWorkspaceId,
    passkey_count: Number(passkeyCountRow?.count ?? 0),
    ...readBackendBuildInfo(c.env),
  });
});

app.get("/api/models", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const pricingTable = parsePricingConfig(c.env);
  const [selectedModel, titleModel, chatSettings, logLevel, systemPromptTimezone, showArchivedSessions, activeWorkspaceId] = await Promise.all([
    getSelectedModel(c.env.D1_DB),
    getTitleModel(c.env.D1_DB),
    getChatSettings(c.env.D1_DB),
    getLogLevel(c.env.D1_DB),
    getSystemPromptTimezone(c.env.D1_DB),
    getShowArchivedSessions(c.env.D1_DB),
    getActiveWorkspaceId(c.env.D1_DB),
  ]);
  return c.json({
    selected_model: selectedModel,
    title_model: titleModel,
    chat_settings: chatSettings,
    log_level: logLevel,
    system_prompt_timezone: systemPromptTimezone,
    show_archived_sessions: showArchivedSessions,
    active_workspace_id: activeWorkspaceId,
    models: buildModelOptions(pricingTable, selectedModel, titleModel),
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

  await setSelectedModel(c.env.D1_DB, model);
  return c.json({ selected_model: model });
});

app.put("/api/settings/usage/sync", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }
  await syncUsageAggregate(c.env.D1_DB);
  const profile = await readProfile(c);
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

  await setTitleModel(c.env.D1_DB, model);
  return c.json({ title_model: model });
});

app.put("/api/settings/chat", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<Partial<ChatSettings>>();
  const current = await getChatSettings(c.env.D1_DB);
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
  };

  await Promise.all([
    setAppSetting(c.env.D1_DB, "service_tier", next.service_tier),
    setAppSetting(c.env.D1_DB, "reasoning_effort", next.reasoning_effort),
    setAppSetting(c.env.D1_DB, "max_output_tokens", String(next.max_output_tokens)),
    setAppSetting(c.env.D1_DB, "daily_budget_usd", String(next.daily_budget_usd)),
    setAppSetting(c.env.D1_DB, "temporary_daily_budget_usd", next.temporary_daily_budget_usd === null ? "" : String(next.temporary_daily_budget_usd)),
    setAppSetting(c.env.D1_DB, "temporary_daily_budget_date_utc", next.temporary_daily_budget_date_utc ?? ""),
    setAppSetting(c.env.D1_DB, "web_search_enabled", next.web_search_enabled ? "1" : "0"),
    setAppSetting(c.env.D1_DB, "web_search_max_results", String(next.web_search_max_results)),
  ]);

  return c.json({ chat_settings: next });
});

app.put("/api/settings/log-level", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

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

app.put("/api/settings/show-archived-sessions", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{ show_archived_sessions?: boolean }>();
  const showArchivedSessions = Boolean(body.show_archived_sessions);
  await setAppSetting(c.env.D1_DB, "show_archived_sessions", showArchivedSessions ? "1" : "0");
  return c.json({ show_archived_sessions: showArchivedSessions });
});

app.get("/api/profile", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const profile = await readProfile(c);
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
    send_shortcut?: "ctrl_enter" | "enter";
    conversation_library_enabled?: boolean;
  }>();

  const currentProfile = await readProfile(c);
  const username = body.username === undefined ? currentProfile.username : body.username.trim();
  if (!username || username.length > 40) {
    return c.json({ error: "Username must be 1-40 characters." }, 400);
  }

  const nextAvatarKey = body.avatar_key === undefined ? currentProfile.avatar_key : body.avatar_key;
  const nextDynamicBackground =
    body.dynamic_background === undefined ? currentProfile.dynamic_background : Boolean(body.dynamic_background);
  const nextSendShortcut = body.send_shortcut === undefined ? currentProfile.send_shortcut : normalizeSendShortcut(body.send_shortcut);
  const nextConversationLibraryEnabled =
    body.conversation_library_enabled === undefined
      ? currentProfile.conversation_library_enabled
      : Boolean(body.conversation_library_enabled);

  await c.env.D1_DB
    .prepare(
      "UPDATE user_profile SET username = ?, avatar_key = ?, avatar_url_cache = NULL, avatar_url_cache_expires_at = NULL, dynamic_background = ?, send_shortcut = ?, conversation_library_enabled = ?, updated_at = ? WHERE id = 1",
    )
    .bind(
      username,
      nextAvatarKey,
      nextDynamicBackground ? 1 : 0,
      nextSendShortcut,
      nextConversationLibraryEnabled ? 1 : 0,
      Date.now(),
    )
    .run();

  const updatedProfile = await readProfile(c);
  return c.json({ profile: updatedProfile });
});

app.post("/api/profile/avatar/presign", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await c.req.json<{ fileName?: string; mimeType?: string }>();
  const fileName = body.fileName?.trim();
  const mimeType = normalizeMimeType(body.mimeType);

  if (!fileName || !mimeType) {
    return c.json({ error: "fileName and mimeType are required." }, 400);
  }
  if (!isAvatarMimeTypeAllowed(mimeType)) {
    return c.json({ error: "Avatar mimeType must be an image/* type." }, 400);
  }

  const objectKey = `avatars/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
  const uploadUrl = toAbsoluteUrl(
    c,
    `/api/profile/avatar/upload?objectKey=${encodeURIComponent(objectKey)}&mimeType=${encodeURIComponent(mimeType)}`,
  );
  const directAccess = await resolveDirectAccessUrl(c, objectKey, USER_FILE_URL_TTL_SECONDS);
  return c.json({
    upload_url: uploadUrl,
    object_key: objectKey,
    public_url: directAccess.url,
  });
});

app.put("/api/profile/avatar/upload", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) {
    return auth;
  }

  const objectKey = c.req.query("objectKey")?.trim();
  const mimeType = normalizeMimeType(
    c.req.query("mimeType")?.trim() || c.req.header("content-type")?.trim() || "application/octet-stream",
  );
  if (!objectKey || !objectKey.startsWith("avatars/")) {
    return c.json({ error: "Valid avatar objectKey is required." }, 400);
  }
  if (!isAvatarMimeTypeAllowed(mimeType)) {
    return c.json({ error: "Avatar mimeType must be an image/* type." }, 400);
  }
  const contentLength = readContentLength(c);
  if (contentLength === null || contentLength <= 0 || contentLength > MAX_AVATAR_BYTES) {
    return c.json({ error: `Avatar size must be between 1 and ${MAX_AVATAR_BYTES} bytes.` }, 400);
  }

  await c.env.R2_BUCKET.put(objectKey, c.req.raw.body, {
    httpMetadata: { contentType: mimeType },
  });

  return c.json({ success: true, object_key: objectKey });
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
  if (object.httpMetadata?.contentType) {
    headers.set("Content-Type", object.httpMetadata.contentType);
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
  if (object.httpMetadata?.contentType) {
    headers.set("Content-Type", object.httpMetadata.contentType);
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
    listWorkspaces(db, includeArchived),
    getActiveWorkspaceId(db),
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
    .prepare("INSERT INTO workspaces (id, name, archived_at, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)")
    .bind(workspaceId, name, now, now)
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
    .prepare("UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?")
    .bind(name, now, workspaceId)
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
  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB);
  if (archived && workspaceId === activeWorkspaceId) {
    return c.json({ error: "Cannot archive active workspace. Please switch workspace first." }, 400);
  }
  const now = Date.now();
  const result = await c.env.D1_DB
    .prepare("UPDATE workspaces SET archived_at = ?, updated_at = ? WHERE id = ?")
    .bind(archived ? now : null, now, workspaceId)
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
    .prepare("SELECT id, archived_at FROM workspaces WHERE id = ? LIMIT 1")
    .bind(workspaceId)
    .first<{ id: string; archived_at: number | null }>();
  if (!workspace?.id) {
    return c.json({ error: "Workspace not found." }, 404);
  }
  if (workspace.archived_at) {
    return c.json({ error: "Archived workspace cannot be activated. Please enable it first." }, 400);
  }
  await setAppSetting(c.env.D1_DB, "active_workspace_id", workspace.id);
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

  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB);
  const whereSql = includeArchived
    ? "WHERE workspace_id = ?"
    : "WHERE workspace_id = ? AND archived_at IS NULL";

  const query = `SELECT id, title, created_at, archived_at, pinned_at
       FROM sessions
       ${whereSql}
       ORDER BY CASE WHEN pinned_at IS NULL THEN 1 ELSE 0 END ASC, pinned_at DESC, created_at DESC
       LIMIT ? OFFSET ?`;

  const { results } = await c.env.D1_DB
    .prepare(query)
    .bind(activeWorkspaceId, limit + 1, offset)
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

  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB);
  const existingSession = await c.env.D1_DB
    .prepare("SELECT id FROM sessions WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(sessionId, activeWorkspaceId)
    .first<{ id: string }>();
  if (!existingSession) {
    return c.json({ error: "Session not found." }, 404);
  }

  const result = await c.env.D1_DB
    .prepare("UPDATE sessions SET title = ? WHERE id = ? AND workspace_id = ?")
    .bind(title, sessionId, activeWorkspaceId)
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
  const activeWorkspaceId = await getActiveWorkspaceId(db);
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
    .map((item) => item.content.trim())
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

  const titleResult = await generateSessionTitle(c, db, userTranscript, assistantTranscript);
  await insertUsageRecord(db, sessionId, titleResult.model, titleResult.usage, PricingTable);
  if (!titleResult.title) {
    return c.json({ error: "Failed to generate title." }, 502);
  }

  const result = await db
    .prepare("UPDATE sessions SET title = ? WHERE id = ? AND workspace_id = ?")
    .bind(titleResult.title, sessionId, activeWorkspaceId)
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
  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB);
  const result = await c.env.D1_DB
    .prepare("UPDATE sessions SET archived_at = ? WHERE id = ? AND workspace_id = ?")
    .bind(archived ? Date.now() : null, sessionId, activeWorkspaceId)
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
  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB);
  const result = await c.env.D1_DB
    .prepare("UPDATE sessions SET pinned_at = ? WHERE id = ? AND workspace_id = ?")
    .bind(pinned ? Date.now() : null, sessionId, activeWorkspaceId)
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
  const activeWorkspaceId = await getActiveWorkspaceId(c.env.D1_DB);
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
