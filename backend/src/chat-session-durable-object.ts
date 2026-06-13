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
import type { Env } from "./types";
import { TOOLS, getAvailableTools } from "./tools";

export class ChatSessionDurableObject {
  private readonly state: DurableObjectState;
  private readonly env: Env;
  private readonly encoder = new TextEncoder();
  private readonly subscribers = new Map<string, LiveSubscriber>();
  private jobs = new Map<string, ChatStreamStoredJob>();
  private readonly runtimePayloads = new Map<string, ChatStreamSubmitPayload>();
  private nextSequence = 1;
  private firstSequence = 1;
  private processing = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.state.blockConcurrencyWhile(async () => {
      await this.loadState();
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/jobs/submit") {
      return this.handleSubmit(request);
    }
    if (request.method === "POST" && url.pathname === "/jobs/events") {
      return this.handleEvents(request, url);
    }
    return new Response("Not found", { status: 404 });
  }

  private async loadState(): Promise<void> {
    const [meta, jobs] = await Promise.all([
      this.state.storage.get<ChatStreamMeta>(CHAT_STREAM_META_KEY),
      this.state.storage.list<ChatStreamStoredJob>({ prefix: CHAT_STREAM_JOB_KEY_PREFIX }),
    ]);
    if (meta) {
      this.nextSequence = Number(meta.next_sequence ?? 1);
      this.firstSequence = Number(meta.first_sequence ?? 1);
    }
    this.jobs = new Map(
      [...jobs.values()]
        .filter((job): job is ChatStreamStoredJob => Boolean(job?.job_id))
        .map((job) => [job.job_id, job]),
    );
  }

  private toJobStorageKey(jobId: string): string {
    return `${CHAT_STREAM_JOB_KEY_PREFIX}${jobId}`;
  }

  private async persistJob(job: ChatStreamStoredJob): Promise<void> {
    await this.state.storage.put(this.toJobStorageKey(job.job_id), job);
  }

  private async pruneTerminalJobs(): Promise<void> {
    const terminalJobs = [...this.jobs.values()]
      .filter((job) => this.isTerminalState(job.state))
      .sort((a, b) => b.updated_at - a.updated_at);
    const staleJobs = terminalJobs.slice(CHAT_STREAM_RETENTION_MAX_TERMINAL_JOBS);
    for (const job of staleJobs) {
      this.jobs.delete(job.job_id);
      this.runtimePayloads.delete(job.job_id);
      await this.state.storage.delete(this.toJobStorageKey(job.job_id));
    }
  }

  private toEventStorageKey(sequence: number): string {
    return `stream:event:${String(sequence).padStart(16, "0")}`;
  }

  private fromEventStorageKey(key: string): number {
    const raw = key.slice("stream:event:".length);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private isTerminalState(state: ChatStreamJobState): boolean {
    return state === "completed" || state === "failed" || state === "cancelled";
  }

  private async appendEvent(jobId: string, type: ChatStreamEventType, payload: Record<string, unknown>): Promise<ChatStreamEvent> {
    const event: ChatStreamEvent = {
      sequence: this.nextSequence,
      job_id: jobId,
      type,
      payload,
      created_at: Date.now(),
    };
    this.nextSequence += 1;
    const keysToDelete: string[] = [];
    while (this.nextSequence - this.firstSequence > CHAT_STREAM_RETENTION_MAX_EVENTS) {
      keysToDelete.push(this.toEventStorageKey(this.firstSequence));
      this.firstSequence += 1;
    }
    await this.state.storage.transaction(async (tx) => {
      await tx.put(this.toEventStorageKey(event.sequence), event);
      for (const key of keysToDelete) {
        await tx.delete(key);
      }
      await tx.put(CHAT_STREAM_META_KEY, {
        next_sequence: this.nextSequence,
        first_sequence: this.firstSequence,
      } satisfies ChatStreamMeta);
    });
    this.broadcastEvent(event);
    return event;
  }

  private formatSseEvent(event: ChatStreamEvent): string {
    const payload: Record<string, unknown> = {
      sequence: event.sequence,
      cursor: String(event.sequence),
      job_id: event.job_id,
      type: event.type,
      payload: event.payload,
    };
    if (event.type === "user_message" && typeof event.payload.user_message_id === "string") {
      payload.user_message_id = event.payload.user_message_id;
    }
    if (event.type === "content_delta" && typeof event.payload.content_delta === "string") {
      const contentDelta = event.payload.content_delta;
      payload.choices = [{ delta: { content: contentDelta } }];
    }
    if (event.type === "reasoning_delta" && typeof event.payload.reasoning_delta === "string") {
      payload.reasoning_delta = event.payload.reasoning_delta;
    }
    if (event.type === "job_failed" && typeof event.payload.error === "string") {
      payload.error = event.payload.error;
    }
    return `id: ${event.sequence}\ndata: ${JSON.stringify(payload)}\n\n`;
  }

  private queueWrite(subscriber: LiveSubscriber, chunk: string): void {
    subscriber.pending = subscriber.pending
      .then(() => subscriber.writer.write(this.encoder.encode(chunk)))
      .catch(() => {
        this.subscribers.delete(subscriber.id);
      });
  }

  private broadcastEvent(event: ChatStreamEvent): void {
    const chunk = this.formatSseEvent(event);
    for (const subscriber of this.subscribers.values()) {
      if (subscriber.job_id !== event.job_id) {
        continue;
      }
      this.queueWrite(subscriber, chunk);
    }
  }

  private async closeSubscribersForJob(jobId: string): Promise<void> {
    const targets = [...this.subscribers.values()].filter((subscriber) => subscriber.job_id === jobId);
    for (const subscriber of targets) {
      this.subscribers.delete(subscriber.id);
      try {
        await subscriber.pending;
      } catch {
        // ignore write failures while closing
      }
      try {
        await subscriber.writer.close();
      } catch {
        // ignore close failures
      }
    }
  }

  private async readEventsAfter(cursor: number, jobId: string): Promise<ChatStreamEvent[]> {
    const normalizedCursor = Number.isFinite(cursor) && cursor > 0 ? Math.floor(cursor) : 0;
    const startSequence = Math.max(normalizedCursor + 1, this.firstSequence);
    const events: ChatStreamEvent[] = [];
    const listLimit = 512;
    let startKey = this.toEventStorageKey(startSequence);
    while (true) {
      const listed = await this.state.storage.list<ChatStreamEvent>({
        start: startKey,
        end: "stream:event:\uffff",
        limit: listLimit,
      });
      if (listed.size === 0) {
        break;
      }
      let lastKey = "";
      for (const [key, value] of listed) {
        lastKey = key;
        const sequence = this.fromEventStorageKey(key);
        if (!value || sequence <= normalizedCursor) {
          continue;
        }
        if (value.job_id !== jobId) {
          continue;
        }
        events.push(value);
      }
      if (listed.size < listLimit || !lastKey) {
        break;
      }
      startKey = `${lastKey}\0`;
    }
    events.sort((a, b) => a.sequence - b.sequence);
    return events;
  }

  private async handleSubmit(request: Request): Promise<Response> {
    const payload = await request.json() as ChatStreamSubmitPayload;
    if (!payload?.session_id || !payload?.user_id || !payload?.user_message_id || !Array.isArray(payload?.open_router_messages)) {
      return new Response(JSON.stringify({ error: "Invalid submit payload." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (payload.client_request_id) {
      for (const existing of this.jobs.values()) {
        if (existing.client_request_id === payload.client_request_id && existing.payload.user_id === payload.user_id) {
          try {
            await upsertChatStreamJobRecord(this.env.D1_DB, existing);
          } catch (error) {
            logError("chat.do.recovery_state_persist_failed", {
              session_id: payload.session_id,
              job_id: existing.job_id,
            }, error);
          }
          logInfo("chat.do.submit_deduplicated", {
            session_id: payload.session_id,
            job_id: existing.job_id,
            state: existing.state,
          });
          return new Response(JSON.stringify({
            job_id: existing.job_id,
            state: existing.state,
          }), { headers: { "Content-Type": "application/json" } });
        }
      }
    }

    const jobId = crypto.randomUUID();
    const now = Date.now();
    const job: ChatStreamStoredJob = {
      job_id: jobId,
      state: "queued",
      client_request_id: payload.client_request_id,
      payload: {
        session_id: payload.session_id,
        user_id: payload.user_id,
        user_message_id: payload.user_message_id,
        new_session: payload.new_session,
      },
      cursor: null,
      created_at: now,
      updated_at: now,
      error: null,
    };
    this.jobs.set(jobId, job);
    this.runtimePayloads.set(jobId, payload);
    await this.persistJob(job);
    const userMessageEvent = await this.appendEvent(jobId, "user_message", { user_message_id: payload.user_message_id });
    job.cursor = userMessageEvent.sequence;
    job.updated_at = Date.now();
    this.jobs.set(jobId, job);
    await this.persistJob(job);
    try {
      await upsertChatStreamJobRecord(this.env.D1_DB, job);
    } catch (error) {
      logError("chat.do.recovery_state_persist_failed", {
        session_id: payload.session_id,
        job_id: jobId,
      }, error);
    }
    logInfo("chat.do.submit_accepted", {
      session_id: payload.session_id,
      job_id: jobId,
      user_id: payload.user_id,
      user_message_id: payload.user_message_id,
      cursor: userMessageEvent.sequence,
    });

    if (!this.processing) {
      this.state.waitUntil(this.processQueue());
    }

    return new Response(JSON.stringify({
      job_id: jobId,
      state: job.state,
      cursor: String(userMessageEvent.sequence),
    }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleEvents(request: Request, url: URL): Promise<Response> {
    const jobId = url.searchParams.get("job_id")?.trim() ?? "";
    const cursorRaw = url.searchParams.get("cursor")?.trim() ?? "";
    const cursor = Number(cursorRaw);
    const body = await request.json() as { user_id?: string };
    const userId = body.user_id?.trim() ?? "";
    if (!jobId || !userId) {
      return new Response(JSON.stringify({ error: "job_id and user_id are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const job = this.jobs.get(jobId);
    if (!job || job.payload.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Job not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const replayEvents = await this.readEventsAfter(cursor, jobId);
    logTrace("chat.do.events_connected", {
      job_id: jobId,
      user_id: userId,
      cursor,
      replay_count: replayEvents.length,
      state: job.state,
    });
   let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
   let closed = false;
   let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
   const clearKeepAliveTimer = (): void => {
     if (keepAliveTimer !== null) {
       clearInterval(keepAliveTimer);
       keepAliveTimer = null;
     }
   };
   const enqueueChunk = (chunk: string): void => {
     if (closed || !streamController) {
       return;
     }
     streamController.enqueue(this.encoder.encode(chunk));
   };
   const closeStream = (): void => {
     if (closed) {
       return;
     }
     closed = true;
     clearKeepAliveTimer();
     try {
       streamController?.close();
     } catch {
       // ignore close failures
     }
   };
   const readable = new ReadableStream<Uint8Array>({
     start(controller) {
       streamController = controller;
       controller.enqueue(new TextEncoder().encode(": connected\n\n"));
     },
     cancel() {
       closed = true;
       clearKeepAliveTimer();
       streamController = null;
     },
   });
   const response = new Response(readable, {
     headers: {
       "Content-Type": "text/event-stream; charset=utf-8",
       "Cache-Control": "no-cache, no-transform",
       Connection: "keep-alive",
       "X-Accel-Buffering": "no",
     },
   });

   keepAliveTimer = setInterval(() => {
     try {
       enqueueChunk(": keep-alive\n\n");
     } catch {
       clearKeepAliveTimer();
     }
   }, CHAT_STREAM_KEEPALIVE_INTERVAL_MS);

   let streamCursor = Number.isFinite(cursor) && cursor > 0 ? Math.floor(cursor) : 0;
   for (const event of replayEvents) {
     enqueueChunk(this.formatSseEvent(event));
     streamCursor = event.sequence;
   }

   if (this.isTerminalState(job.state)) {
     closeStream();
     return response;
   }

   const pumpEvents = async (): Promise<void> => {
     try {
       while (!closed) {
         const nextEvents = await this.readEventsAfter(streamCursor, jobId);
         if (nextEvents.length > 0) {
           for (const event of nextEvents) {
             enqueueChunk(this.formatSseEvent(event));
             streamCursor = event.sequence;
             if (event.type === "job_completed" || event.type === "job_failed") {
               return;
             }
           }
           continue;
         }

         const currentJob = this.jobs.get(jobId);
         if (!currentJob || this.isTerminalState(currentJob.state)) {
           break;
         }

         await sleep(CHAT_STREAM_POLL_INTERVAL_MS);
       }
     } catch (error) {
       logError(
         "chat.do.events_pump_failed",
         {
           job_id: jobId,
           user_id: userId,
         },
         error,
       );
     } finally {
       closeStream();
     }
   };

   this.state.waitUntil(pumpEvents());
   return response;
  }

  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;
    try {
      while (true) {
        const queued = [...this.jobs.values()]
          .filter((item) => item.state === "queued")
          .sort((a, b) => a.created_at - b.created_at)[0];
        if (!queued) {
          break;
        }
        queued.state = "running";
        queued.updated_at = Date.now();
        this.jobs.set(queued.job_id, queued);
        await this.persistJob(queued);
        try {
          await upsertChatStreamJobRecord(this.env.D1_DB, queued);
        } catch (error) {
          logError("chat.do.recovery_state_persist_failed", {
            session_id: queued.payload.session_id,
            job_id: queued.job_id,
            state: queued.state,
          }, error);
        }
        await this.appendEvent(queued.job_id, "job_started", { state: "running" });
        logInfo("chat.do.job_started", {
          session_id: queued.payload.session_id,
          job_id: queued.job_id,
          user_id: queued.payload.user_id,
        });
        try {
          const runtimePayload = this.runtimePayloads.get(queued.job_id);
          if (!runtimePayload) {
            throw new Error("Streaming payload expired. Please retry.");
          }
          await this.runJob(queued, runtimePayload);
          queued.state = "completed";
          queued.updated_at = Date.now();
          this.jobs.set(queued.job_id, queued);
          await this.persistJob(queued);
          try {
            await upsertChatStreamJobRecord(this.env.D1_DB, queued);
          } catch (error) {
            logError("chat.do.recovery_state_persist_failed", {
              session_id: queued.payload.session_id,
              job_id: queued.job_id,
              state: queued.state,
            }, error);
          }
          await this.appendEvent(queued.job_id, "job_completed", { state: "completed" });
          logInfo("chat.do.job_completed", {
            session_id: queued.payload.session_id,
            job_id: queued.job_id,
          });
          await this.closeSubscribersForJob(queued.job_id);
          this.runtimePayloads.delete(queued.job_id);
          await this.pruneTerminalJobs();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Internal error";
          const upstreamError = error instanceof Error ? (error as Error & {
            upstream_status?: number;
            upstream_status_text?: string;
            upstream_reason?: string;
            upstream_endpoint?: string;
            upstream_model?: string;
            upstream_iteration?: number;
          }) : null;
          queued.state = "failed";
          queued.error = errorMessage;
          queued.updated_at = Date.now();
          this.jobs.set(queued.job_id, queued);
          await this.persistJob(queued);
          try {
            await upsertChatStreamJobRecord(this.env.D1_DB, queued);
          } catch (persistError) {
            logError("chat.do.recovery_state_persist_failed", {
              session_id: queued.payload.session_id,
              job_id: queued.job_id,
              state: queued.state,
            }, persistError);
          }
          await this.appendEvent(queued.job_id, "job_failed", { error: errorMessage });
          logError("chat.do.job_failed", {
            session_id: queued.payload.session_id,
            job_id: queued.job_id,
            user_id: queued.payload.user_id,
            user_message_id: queued.payload.user_message_id,
            error: errorMessage,
            ...(upstreamError?.upstream_status !== undefined ? {
              failure_stage: "upstream_request",
              upstream_status: upstreamError.upstream_status,
              upstream_status_text: upstreamError.upstream_status_text ?? null,
              upstream_reason: upstreamError.upstream_reason ?? null,
              upstream_endpoint: upstreamError.upstream_endpoint ?? null,
              upstream_model: upstreamError.upstream_model ?? null,
              upstream_iteration: upstreamError.upstream_iteration ?? null,
            } : {}),
          });
          await this.closeSubscribersForJob(queued.job_id);
          this.runtimePayloads.delete(queued.job_id);
          await this.pruneTerminalJobs();
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async runJob(job: ChatStreamStoredJob, payload: ChatStreamSubmitPayload): Promise<void> {
    const db = this.env.D1_DB;
    const pricingTable = parsePricingConfig(this.env);
    let currentMessages = [...payload.open_router_messages];
    let iteration = 0;
    const maxIterations = 5;
    let finalUsage: OpenRouterUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost: 0 };
    let finalResponseModel = payload.selected_model;
    let lastFullResponse = "";
    let lastReasoningSummary = "";

    try {
      logTrace("chat.do.run.begin", {
        session_id: payload.session_id,
        job_id: job.job_id,
        model: payload.selected_model,
      });
      while (iteration < maxIterations) {
        iteration += 1;
        let fullResponse = "";
        let reasoningSummary = "";
        let responseModel = payload.selected_model;
        let usage: OpenRouterUsage | null = null;
        let streamBuffer = "";
        const toolCalls: any[] = [];

        const currentUpstreamRequestBody = payload.use_chat_completions_api
          ? {
              ...payload.upstream_request_body,
              messages: currentMessages,
            }
          : {
              ...payload.upstream_request_body,
              input: currentMessages.map((item) => ({
                type: "message" as const,
                role: item.role,
                content: toResponsesInputContent(item.content),
              })),
            };

        const upstream = await fetch(payload.api_endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.env.AI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(currentUpstreamRequestBody),
        });
        if (!upstream.ok) {
          const reason = await upstream.text();
          const upstreamReason = formatTraceText(reason.trim()) || "Upstream request failed.";
          logError("chat.do.upstream_request_failed", {
            session_id: payload.session_id,
            job_id: job.job_id,
            user_id: payload.user_id,
            user_message_id: payload.user_message_id,
            iteration,
            model: payload.selected_model,
            endpoint: payload.api_endpoint,
            upstream_status: upstream.status,
            upstream_status_text: upstream.statusText,
            upstream_reason: upstreamReason.slice(0, 500),
            request_url: payload.request_url,
          });
          const upstreamError = new Error(`Upstream error (${upstream.status}): ${upstreamReason}`);
          (upstreamError as Error & {
            upstream_status?: number;
            upstream_status_text?: string;
            upstream_reason?: string;
            upstream_endpoint?: string;
            upstream_model?: string;
            upstream_iteration?: number;
          }).upstream_status = upstream.status;
          (upstreamError as Error & {
            upstream_status?: number;
            upstream_status_text?: string;
            upstream_reason?: string;
            upstream_endpoint?: string;
            upstream_model?: string;
            upstream_iteration?: number;
          }).upstream_status_text = upstream.statusText;
          (upstreamError as Error & {
            upstream_status?: number;
            upstream_status_text?: string;
            upstream_reason?: string;
            upstream_endpoint?: string;
            upstream_model?: string;
            upstream_iteration?: number;
          }).upstream_reason = upstreamReason.slice(0, 500);
          (upstreamError as Error & {
            upstream_status?: number;
            upstream_status_text?: string;
            upstream_reason?: string;
            upstream_endpoint?: string;
            upstream_model?: string;
            upstream_iteration?: number;
          }).upstream_endpoint = payload.api_endpoint;
          (upstreamError as Error & {
            upstream_status?: number;
            upstream_status_text?: string;
            upstream_reason?: string;
            upstream_endpoint?: string;
            upstream_model?: string;
            upstream_iteration?: number;
          }).upstream_model = payload.selected_model;
          (upstreamError as Error & {
            upstream_status?: number;
            upstream_status_text?: string;
            upstream_reason?: string;
            upstream_endpoint?: string;
            upstream_model?: string;
            upstream_iteration?: number;
          }).upstream_iteration = iteration;
          throw upstreamError;
        }
        logTrace("chat.do.run.upstream_connected", {
          session_id: payload.session_id,
          job_id: job.job_id,
          iteration,
          endpoint: payload.api_endpoint,
        });
        const upstreamReader = upstream.body?.getReader();
        if (!upstreamReader) {
          throw new Error("Upstream stream is empty.");
        }
        try {
          while (true) {
            const { done, value } = await upstreamReader.read();
            if (done) {
              break;
            }
            streamBuffer += decoder.decode(value, { stream: true });
            let lineBreakIndex = streamBuffer.indexOf("\n");
            while (lineBreakIndex >= 0) {
              const line = streamBuffer.slice(0, lineBreakIndex).trim();
              streamBuffer = streamBuffer.slice(lineBreakIndex + 1);
              if (!line.startsWith("data:")) {
                lineBreakIndex = streamBuffer.indexOf("\n");
                continue;
              }
              const payloadText = line.slice(5).trim();
              if (payloadText === "[DONE]") {
                lineBreakIndex = streamBuffer.indexOf("\n");
                continue;
              }
              let parsed: any;
              try {
                parsed = JSON.parse(payloadText);
              } catch {
                lineBreakIndex = streamBuffer.indexOf("\n");
                continue;
              }
              if (parsed && typeof parsed === "object") {
                if (parsed.error) {
                  throw new Error(typeof parsed.error === "string" ? parsed.error : parsed.error.message || "Unknown error");
                }
                if (parsed.model) {
                  responseModel = parsed.model;
                }
                const choices = parsed.choices;
                if (Array.isArray(choices) && choices.length > 0) {
                  const delta = choices[0].delta;
                  if (delta) {
                    if (delta.content) {
                      const deltaText = typeof delta.content === "string" ? delta.content : extractModelMessageContent(delta.content);
                      if (deltaText) {
                        fullResponse += deltaText;
                        await this.appendEvent(job.job_id, "content_delta", { content_delta: deltaText });
                      }
                    }
                    if (delta.reasoning) {
                      reasoningSummary += delta.reasoning;
                      await this.appendEvent(job.job_id, "reasoning_delta", { reasoning_delta: delta.reasoning });
                    }
                    if (delta.tool_calls) {
                      for (const tc of delta.tool_calls) {
                        if (!toolCalls[tc.index]) {
                          toolCalls[tc.index] = { id: tc.id, type: tc.type, function: { name: "", arguments: "" } };
                        }
                        if (tc.id) {
                          toolCalls[tc.index].id = tc.id;
                        }
                        if (tc.function?.name) {
                          toolCalls[tc.index].function.name += tc.function.name;
                        }
                        if (tc.function?.arguments) {
                          toolCalls[tc.index].function.arguments += tc.function.arguments;
                        }
                      }
                    }
                  }
                }
                usage = parseOpenRouterUsage(parsed.usage);
              }
              lineBreakIndex = streamBuffer.indexOf("\n");
            }
          }
        } finally {
          upstreamReader.releaseLock();
        }

        if (usage) {
          finalUsage.prompt_tokens = toFiniteNumber(finalUsage.prompt_tokens) + toFiniteNumber(usage.prompt_tokens);
          finalUsage.completion_tokens = toFiniteNumber(finalUsage.completion_tokens) + toFiniteNumber(usage.completion_tokens);
          finalUsage.total_tokens = toFiniteNumber(finalUsage.total_tokens) + toFiniteNumber(usage.total_tokens);
          finalUsage.cost = toFiniteNumber(finalUsage.cost) + toFiniteNumber(usage.cost);
        }
        finalResponseModel = responseModel;
        lastFullResponse = fullResponse;
        lastReasoningSummary = reasoningSummary;

        if (toolCalls.length > 0) {
          const activeToolCalls = toolCalls.filter((tc) => tc.function.name);
          currentMessages.push({
            role: "assistant",
            content: fullResponse || "",
            tool_calls: activeToolCalls,
          } as any);
          for (const tc of activeToolCalls) {
            const toolName = tc.function.name;
            const toolArgsRaw = tc.function.arguments || "{}";
            let toolArgs: any = {};
            try {
              toolArgs = JSON.parse(toolArgsRaw);
            } catch {
              toolArgs = {};
            }
            const handler = TOOLS[toolName];
            let result: string;
            if (handler) {
              const searchTip = toolName === "web_search"
                ? `\n> **Arona is searching:** \`${toolArgs.query}\`...\n`
                : `\n> **Arona is using tool:** \`${toolName}\`...\n`;
              await this.appendEvent(job.job_id, "content_delta", { content_delta: searchTip });
              result = await handler.execute(toolArgs, this.env, { defaultCount: payload.chat_settings.web_search_max_results });
            } else {
              result = `Error: Tool "${toolName}" not found.`;
            }
            currentMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result,
            } as any);
          }
          continue;
        }
        break;
      }

      if (lastFullResponse.trim().length > 0) {
        const assistantMessageId = crypto.randomUUID();
        await db
          .prepare("INSERT INTO messages (id, session_id, role, content, model, reasoning_summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(assistantMessageId, payload.session_id, "assistant", lastFullResponse, finalResponseModel, lastReasoningSummary.trim() || null, Date.now())
          .run();
        if (payload.new_session) {
          const titleResult = await generateSessionTitleWithContext(
            {
              env: this.env,
              requestUrl: payload.request_url,
              requestId: "durable-object",
              logLevel: DEFAULT_LOG_LEVEL,
            },
            db,
            payload.user_message,
            lastFullResponse,
          );
          await insertUsageRecord(db, payload.session_id, titleResult.model, titleResult.usage, pricingTable, payload.chat_settings.service_tier);
          if (titleResult.title) {
            await db.prepare("UPDATE sessions SET title = ? WHERE id = ?").bind(titleResult.title, payload.session_id).run();
          }
        }
      }
      await insertUsageRecord(db, payload.session_id, finalResponseModel, finalUsage, pricingTable, payload.chat_settings.service_tier);
      logInfo("chat.do.run.persisted_assistant", {
        session_id: payload.session_id,
        job_id: job.job_id,
        model: finalResponseModel,
        output_chars: lastFullResponse.length,
        total_tokens: finalUsage.total_tokens,
      });
    } catch (error) {
      const usedTokens = toFiniteNumber(finalUsage.total_tokens);
      const usedCost = toFiniteNumber(finalUsage.cost);
      if (usedTokens > 0 || usedCost > 0) {
        await insertUsageRecord(db, payload.session_id, finalResponseModel, finalUsage, pricingTable, payload.chat_settings.service_tier);
      }
      throw error;
    }
  }
}

export default app;
