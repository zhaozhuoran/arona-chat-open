import type { StateCreator } from "zustand";
import {
  type Store,
  type Session,
  type Message,
  type StreamRecoveryState,
  type StreamFailureState,
  type StreamSubmitResponse,
  type MessageAttachment,
  type StreamRecoveryLookupResponse,
  ZERO_SESSION_USAGE,
  STREAM_INFLIGHT_MAX_AGE_MS,
  ensureToken,
  requestJson,
  fetchSessionMessages,
  loadInflightStream,
  isRecentUserMessage,
  consumeChatStream,
  extractLastThinkingTopic,
  normalizeCursorSequence,
  persistInflightStream,
  buildStreamFailureState,
  resolveRecoveryUserMessageCreatedAt,
  buildDisconnectedRecoveryState,
  fetchStreamRecovery,
  waitForAssistantMessage,
  calcBudgetStatus,
  resolveMaxOutputTokensOverride,
  warnBudget,
  replaceMessageId,
  getErrorMessage,
  PREVIEW_RESPONSE_TEXTS,
  PREVIEW_STREAM_CHUNK_DELAY_MS,
  previewSessionMessages,
} from "../useStore";
import { SESSION_TITLE_MAX_LENGTH } from "../../constants/session";

export interface ChatSliceState {
  sessions: Session[];
  sessionsHasMore: boolean;
  sessionsLoadingMore: boolean;
  sessionId: string | null;
  messages: Message[];
  loadingMessages: boolean;
  sendingMessage: boolean;
  streamingMessage: string;
  streamingReasoning: string;
  streamingThinkingTopic: string;
  streamRecovery: StreamRecoveryState | null;
  streamFailure: StreamFailureState | null;
}

export interface ChatSliceActions {
  refreshSessions: () => Promise<void>;
  loadMoreSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  clearSession: () => void;
  sendMessage: (content: string, attachments?: MessageAttachment[]) => Promise<void>;
  regenerateLastMessage: () => Promise<void>;
  reconnectStream: () => Promise<void>;
  waitForStreamCompletion: () => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  autoGenerateSessionTitle: (sessionId: string) => Promise<void>;
  archiveSession: (sessionId: string, archived?: boolean) => Promise<void>;
  pinSession: (sessionId: string, pinned?: boolean) => Promise<void>;
}

export type ChatSlice = ChatSliceState & ChatSliceActions;

export const createChatSlice: StateCreator<Store, [], [], ChatSlice> = (set, get) => ({
  sessions: [],
  sessionsHasMore: false,
  sessionsLoadingMore: false,
  sessionId: null,
  messages: [],
  loadingMessages: false,
  sendingMessage: false,
  streamingMessage: "",
  streamingReasoning: "",
  streamingThinkingTopic: "",
  streamRecovery: null,
  streamFailure: null,

  refreshSessions: async () => {
    if (get().previewMode) {
      return;
    }
    const token = ensureToken(get().token);
    const includeArchived = get().showArchivedSessions ? "1" : "0";
    const data = await requestJson<{ sessions: Session[]; has_more: boolean }>(
      `/api/sessions?include_archived=${includeArchived}&limit=50&offset=0`,
      {
        method: "GET",
        token,
      },
    );
    set({ sessions: data.sessions || [], sessionsHasMore: Boolean(data.has_more) });
  },

  loadMoreSessions: async () => {
    if (get().previewMode || !get().sessionsHasMore || get().sessionsLoadingMore) {
      return;
    }
    set({ sessionsLoadingMore: true });
    try {
      const token = ensureToken(get().token);
      const includeArchived = get().showArchivedSessions ? "1" : "0";
      const offset = get().sessions.length;
      const data = await requestJson<{ sessions: Session[]; has_more: boolean }>(
        `/api/sessions?include_archived=${includeArchived}&limit=50&offset=${offset}`,
        {
          method: "GET",
          token,
        },
      );
      set((state) => ({
        sessions: [...state.sessions, ...(data.sessions || [])],
        sessionsHasMore: Boolean(data.has_more),
      }));
    } finally {
      set({ sessionsLoadingMore: false });
    }
  },

  selectSession: async (sessionId) => {
    if (get().previewMode) {
      const messages = previewSessionMessages.get(sessionId) ?? [];
      set({
        sessionId,
        messages,
        loadingMessages: false,
        streamingMessage: "",
        streamingReasoning: "",
        streamingThinkingTopic: "",
        sessionUsage: ZERO_SESSION_USAGE,
        streamRecovery: null,
        streamFailure: null,
      });
      return;
    }
    const token = ensureToken(get().token);
    const isSameSession = get().sessionId === sessionId;
    set({
      sessionId,
      loadingMessages: true,
      streamingMessage: isSameSession ? get().streamingMessage : "",
      streamingReasoning: isSameSession ? get().streamingReasoning : "",
      streamRecovery: null,
      streamFailure: null,
    });
    try {
      const currentMessages = await fetchSessionMessages(token, sessionId);
      set({ messages: currentMessages });
      try {
        await get().refreshUsage();
        await get().refreshSessionUsage(sessionId);
      } catch {
        set({ sessionUsage: ZERO_SESSION_USAGE });
      }
      const inflight = loadInflightStream(sessionId);
      const latestVisibleMessage = [...currentMessages].reverse().find((message) => message.role !== "system");
      const recentUserMessage = isRecentUserMessage(latestVisibleMessage)
        && Date.now() - Number(latestVisibleMessage.created_at) <= STREAM_INFLIGHT_MAX_AGE_MS
        ? latestVisibleMessage
        : null;

      if (inflight && inflight.job_id) {
        const currentContent = get().streamingMessage;
        const currentReasoning = get().streamingReasoning;
        set({ sendingMessage: true, streamFailure: null });
        try {
          const resumeCursor = normalizeCursorSequence(inflight.cursor);
          const cursorToUse = (currentContent || currentReasoning) ? resumeCursor.cursor : "";
          const streamResult = await consumeChatStream(
            get().token,
            sessionId,
            inflight.job_id,
            cursorToUse,
            get().logLevel,
            (nextContent) => {
              if (get().sessionId === sessionId) set({ streamingMessage: nextContent });
            },
            (nextReasoning) => {
              if (get().sessionId === sessionId) set({ streamingReasoning: nextReasoning, streamingThinkingTopic: extractLastThinkingTopic(nextReasoning) });
            },
            currentContent,
            currentReasoning,
          );
          const persistedUserMessageId = streamResult.userMessageId ?? inflight.user_message_id;
          if (streamResult.failure) {
            persistInflightStream(sessionId, null);
            set({
              messages: currentMessages,
              streamingMessage: streamResult.content,
              streamingReasoning: streamResult.reasoning,
              streamRecovery: null,
              streamFailure: buildStreamFailureState(
                sessionId,
                inflight.job_id,
                persistedUserMessageId,
                resolveRecoveryUserMessageCreatedAt(currentMessages, persistedUserMessageId),
                streamResult.failure,
                streamResult.content,
                streamResult.reasoning,
              ),
            });
            await get().refreshSessions();
            await get().refreshUsage();
            await get().refreshSessionUsage(sessionId);
            return;
          }
          if (streamResult.warning) {
            const latestCursor = normalizeCursorSequence(streamResult.cursor).cursor;
            persistInflightStream(sessionId, {
              session_id: sessionId,
              job_id: inflight.job_id,
              cursor: latestCursor,
              user_message_id: persistedUserMessageId,
              created_at: Date.now(),
            });
            set({
              streamRecovery: {
                session_id: sessionId,
                job_id: inflight.job_id,
                cursor: latestCursor,
                user_message_id: persistedUserMessageId,
                user_message_created_at: resolveRecoveryUserMessageCreatedAt(get().messages, persistedUserMessageId),
                new_session: false,
                created_at: Date.now(),
                mode: "disconnected",
                last_error: "SSE disconnected. You can reconnect to Durable Object or wait for completion.",
              },
            });
          } else {
            persistInflightStream(sessionId, null);
            const refreshedMessages = await fetchSessionMessages(ensureToken(get().token), sessionId);
            set({
              messages: refreshedMessages,
              streamingMessage: "",
              streamingReasoning: "",
              streamRecovery: null,
            });
            await get().refreshSessions();
            await get().refreshUsage();
            await get().refreshSessionUsage(sessionId);
          }
        } catch (resumeError) {
          persistInflightStream(sessionId, {
            session_id: sessionId,
            job_id: inflight.job_id,
            cursor: normalizeCursorSequence(inflight.cursor).cursor,
            user_message_id: inflight.user_message_id,
            created_at: Date.now(),
          });
          set({
            streamRecovery: {
              session_id: sessionId,
              job_id: inflight.job_id,
              cursor: normalizeCursorSequence(inflight.cursor).cursor,
              user_message_id: inflight.user_message_id,
              user_message_created_at: resolveRecoveryUserMessageCreatedAt(get().messages, inflight.user_message_id),
              new_session: false,
              created_at: Date.now(),
              mode: "disconnected",
              last_error: `Failed to recover streaming session: ${getErrorMessage(resumeError)}`,
            },
            streamingMessage: "",
            streamingReasoning: "",
          });
          get().pushToast(`Failed to recover streaming session: ${getErrorMessage(resumeError)}`, "error");
        } finally {
          set({ sendingMessage: false });
        }
      } else if (inflight || recentUserMessage) {
        let recoveryRecord: StreamRecoveryLookupResponse | null = null;
        for (let attempt = 0; attempt < 6; attempt += 1) {
          recoveryRecord = await fetchStreamRecovery(token, sessionId);
          if (recoveryRecord) {
            break;
          }
          if (attempt < 5) {
            await new Promise((resolve) => { window.setTimeout(resolve, 500); });
          }
        }

        if (recoveryRecord && (recoveryRecord.state === "queued" || recoveryRecord.state === "running")) {
          const resolvedCursor = normalizeCursorSequence(recoveryRecord.cursor).cursor;
          persistInflightStream(sessionId, {
            session_id: sessionId,
            job_id: recoveryRecord.job_id,
            cursor: resolvedCursor,
            user_message_id: recoveryRecord.user_message_id,
            created_at: Date.now(),
          });
          set({
            streamRecovery: buildDisconnectedRecoveryState(
              sessionId,
              recoveryRecord.job_id,
              resolvedCursor,
              recoveryRecord.user_message_id,
              resolveRecoveryUserMessageCreatedAt(currentMessages, recoveryRecord.user_message_id),
              "SSE disconnected. You can reconnect to Durable Object or wait for completion.",
            ),
            streamFailure: null,
          });
          return;
        }

        const recoveryUserMessageId = inflight?.user_message_id ?? recentUserMessage?.id ?? null;
        const hasRecoveryJob = Boolean(inflight?.job_id);
        const recoveryCreatedAt = resolveRecoveryUserMessageCreatedAt(currentMessages, recoveryUserMessageId)
          ?? (inflight ? Number(inflight.created_at) : null)
          ?? (recentUserMessage ? Number(recentUserMessage.created_at) : null);
        if (hasRecoveryJob && recoveryUserMessageId) {
          set({
            streamRecovery: buildDisconnectedRecoveryState(
              sessionId,
              inflight?.job_id ?? null,
              normalizeCursorSequence(inflight?.cursor ?? "").cursor,
              recoveryUserMessageId,
              Number.isFinite(recoveryCreatedAt) ? recoveryCreatedAt : null,
              inflight?.job_id
                ? "SSE disconnected. You can reconnect to Durable Object or wait for completion."
                : "The backend may still be generating. You can wait for completion.",
            ),
            streamFailure: null,
          });
        }
      }
    } catch (error) {
      get().pushToast(getErrorMessage(error), "error");
      throw error;
    } finally {
      set({ loadingMessages: false });
    }
  },

  clearSession: () => {
    warnBudget(get());
    set({
      sessionId: null,
      messages: [],
      streamingMessage: "",
      streamingReasoning: "",
      loadingMessages: false,
      sessionUsage: ZERO_SESSION_USAGE,
      streamRecovery: null,
      streamFailure: null,
    });
  },

  sendMessage: async (content, attachments = []) => {
    const trimmedContent = content.trim();
    if ((trimmedContent.length === 0 && attachments.length === 0) || get().sendingMessage) {
      return;
    }

    if (get().previewMode) {
      let currentSessionId = get().sessionId;
      let newSession = false;
      if (!currentSessionId) {
        currentSessionId = crypto.randomUUID();
        newSession = true;
        set({ sessionId: currentSessionId, sessionUsage: ZERO_SESSION_USAGE });
      }
      const userMessage: Message = {
        id: crypto.randomUUID(),
        session_id: currentSessionId,
        role: "user",
        content: trimmedContent,
        attachments,
        created_at: Date.now(),
        model: null,
      };
      set((state) => ({
        sendingMessage: true,
        streamingMessage: "",
        streamingReasoning: "",
        streamingThinkingTopic: "",
        streamFailure: null,
        streamRecovery: null,
        messages: [...state.messages, userMessage]
      }));
      try {
        const responseText = PREVIEW_RESPONSE_TEXTS[Math.floor(Math.random() * PREVIEW_RESPONSE_TEXTS.length)];
        let streamed = "";
        const chunkSize = 4;
        for (let i = 0; i < responseText.length; i += chunkSize) {
          await new Promise<void>((resolve) => { window.setTimeout(resolve, PREVIEW_STREAM_CHUNK_DELAY_MS); });
          streamed += responseText.slice(i, i + chunkSize);
          set({ streamingMessage: streamed });
        }
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          session_id: currentSessionId,
          role: "assistant",
          content: streamed,
          attachments: [],
          created_at: Date.now(),
          model: get().selectedModel,
          reasoning_summary: null,
        };
        set((state) => ({
          messages: [...state.messages, assistantMessage],
          streamingMessage: "",
          streamingReasoning: "",
          sessionUsage: { total_tokens: state.sessionUsage.total_tokens + 50, total_cost_usd: state.sessionUsage.total_cost_usd + 0.0001 },
        }));
        const finalMessages = get().messages.filter((m) => m.session_id === currentSessionId);
        previewSessionMessages.set(currentSessionId, finalMessages);
        if (newSession) {
          const newSessionItem: Session = { id: currentSessionId, title: trimmedContent.slice(0, 40) || "New Chat", created_at: Date.now(), archived_at: null, pinned_at: null };
          set((state) => ({ sessions: [newSessionItem, ...state.sessions] }));
        }
      } finally {
        set({ sendingMessage: false });
      }
      return;
    }

    const token = ensureToken(get().token);
    let sessionId = get().sessionId;
    let newSession = false;

    if (!sessionId) {
      sessionId = crypto.randomUUID();
      newSession = true;
      set({ sessionId, sessionUsage: ZERO_SESSION_USAGE });
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      role: "user",
      content: trimmedContent,
      attachments,
      created_at: Date.now(),
      model: null,
    };

    set((state) => ({
      sendingMessage: true,
      streamingMessage: "",
      streamingReasoning: "",
      streamingThinkingTopic: "",
      streamRecovery: null,
      messages: [...state.messages, userMessage],
    }));

    try {
      const budgetStatus = calcBudgetStatus(
        get().dailyUsage,
        get().chatSettings,
        get().models,
        get().selectedModel,
      );
      const dynamicMax = resolveMaxOutputTokensOverride(get().chatSettings, budgetStatus);
      if (budgetStatus.available_output_tokens !== null && budgetStatus.available_output_tokens < 4000) {
        const ok = window.confirm(`当前可用输出约 ${(budgetStatus.available_output_tokens ?? 0)} tokens，继续可能被阻断。是否继续？`);
        if (!ok) {
          throw new Error("已取消发送：预算剩余不足。");
        }
      }
      persistInflightStream(sessionId, {
        session_id: sessionId,
        job_id: null,
        cursor: "",
        user_message_id: userMessage.id,
        created_at: Date.now(),
      });
      const submit = await requestJson<StreamSubmitResponse>("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        token,
        body: JSON.stringify({
          session_id: sessionId,
          message: trimmedContent,
          attachments,
          new_session: newSession,
          request_source: "send_message",
          model: get().selectedModel,
          max_output_tokens_override: dynamicMax,
          client_request_id: userMessage.id,
        }),
      });
      const jobId = submit.job_id;
      const normalizedSubmitCursor = normalizeCursorSequence(submit.cursor ?? "");
      const streamCursor = normalizedSubmitCursor.cursor;
      const serverUserMessageId = submit.user_message_id?.trim() || null;
      persistInflightStream(sessionId, {
        session_id: sessionId,
        job_id: jobId,
        cursor: streamCursor,
        user_message_id: serverUserMessageId,
        created_at: Date.now(),
      });
      const streamResult = await consumeChatStream(
        get().token,
        sessionId,
        jobId,
        streamCursor,
        get().logLevel,
        (nextContent) => {
          if (get().sessionId === sessionId) set({ streamingMessage: nextContent });
        },
        (nextReasoning) => {
          if (get().sessionId === sessionId) set({ streamingReasoning: nextReasoning, streamingThinkingTopic: extractLastThinkingTopic(nextReasoning) });
        },
        get().streamingMessage,
        get().streamingReasoning,
      );
      persistInflightStream(sessionId, null);
      const persistedUserMessageId = streamResult.userMessageId ?? serverUserMessageId ?? userMessage.id;

      if (streamResult.failure) {
        set((state) => ({
          messages: replaceMessageId(state.messages, userMessage.id, persistedUserMessageId),
          streamingMessage: streamResult.content,
          streamingReasoning: streamResult.reasoning,
          streamFailure: buildStreamFailureState(
            sessionId,
            jobId,
            persistedUserMessageId,
            Number.isFinite(Number(userMessage.created_at)) ? Number(userMessage.created_at) : null,
            streamResult.failure,
            streamResult.content,
            streamResult.reasoning,
          ),
        }));
        if (newSession) {
          await get().refreshSessions();
        }
        await get().refreshUsage();
        await get().refreshSessionUsage(sessionId);
        return;
      }

      let assistantMessage: Message;
      if (streamResult.warning) {
        const recoveredAssistant = await waitForAssistantMessage(token, sessionId, userMessage.created_at, get().logLevel);
        assistantMessage = {
          ...recoveredAssistant,
          attachments: recoveredAssistant.attachments ?? [],
        };
      } else {
        assistantMessage = {
          id: crypto.randomUUID(),
          session_id: sessionId,
          role: "assistant",
          content: streamResult.content,
          created_at: Date.now(),
          model: get().selectedModel,
          reasoning_summary: streamResult.reasoning.trim() || null,
        };
      }

      set((state) => ({
        messages: [
          ...replaceMessageId(state.messages, userMessage.id, persistedUserMessageId),
          assistantMessage,
        ],
        streamingMessage: "",
        streamingReasoning: "",
        streamingThinkingTopic: "",
        streamFailure: null,
        sendingMessage: false,
      }));

      if (newSession) {
        await get().refreshSessions();
      }
      await get().refreshUsage();
      await get().refreshSessionUsage(sessionId);

      warnBudget(get());
      if (streamResult.warning) {
        get().pushToast(streamResult.warning, "info");
      }
    } catch (error) {
      persistInflightStream(sessionId, null);
      get().pushToast(getErrorMessage(error), "error");
      set({ streamingMessage: "", streamingReasoning: "", streamingThinkingTopic: "", streamFailure: null, streamRecovery: null, sendingMessage: false });
      throw error;
    }
  },

  regenerateLastMessage: async () => {
    if (get().sendingMessage) {
      return;
    }

    const messages = get().messages;
    let lastVisibleIndex = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role !== "system") {
        lastVisibleIndex = index;
        break;
      }
    }
    if (lastVisibleIndex < 0) {
      return;
    }

    const lastVisibleMessage = messages[lastVisibleIndex];
    let sourceUserMessage: Message | null = null;

    if (lastVisibleMessage.role === "assistant") {
      for (let index = lastVisibleIndex - 1; index >= 0; index -= 1) {
        if (messages[index].role === "user") {
          sourceUserMessage = messages[index];
          break;
        }
      }
      if (!sourceUserMessage) {
        return;
      }
    } else if (lastVisibleMessage.role === "user") {
      sourceUserMessage = lastVisibleMessage;
    }

    if (!sourceUserMessage) {
      return;
    }

    const trimmedContent = sourceUserMessage.content.trim();
    const attachments = sourceUserMessage.attachments ?? [];
    if (trimmedContent.length === 0 && attachments.length === 0) {
      return;
    }

    const filteredMessages = messages.slice(0, lastVisibleMessage.role === "assistant" ? lastVisibleIndex : lastVisibleIndex + 1);

    set({
      sendingMessage: true,
      streamingMessage: "",
      streamingReasoning: "",
      streamingThinkingTopic: "",
      streamFailure: null,
      streamRecovery: null,
      messages: filteredMessages,
    });

    if (get().previewMode) {
      const sessionId = sourceUserMessage.session_id || get().sessionId;
      if (!sessionId) {
        set({ sendingMessage: false });
        return;
      }
      try {
        const responseText = PREVIEW_RESPONSE_TEXTS[Math.floor(Math.random() * PREVIEW_RESPONSE_TEXTS.length)];
        let streamed = "";
        const chunkSize = 4;
        for (let i = 0; i < responseText.length; i += chunkSize) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, PREVIEW_STREAM_CHUNK_DELAY_MS);
          });
          streamed += responseText.slice(i, i + chunkSize);
          set({ streamingMessage: streamed });
        }
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          session_id: sessionId,
          role: "assistant",
          content: streamed,
          attachments: [],
          created_at: Date.now(),
          model: get().selectedModel,
          reasoning_summary: null,
        };
        set((state) => ({
          messages: [...state.messages, assistantMessage],
          streamingMessage: "",
          streamingReasoning: "",
          streamingThinkingTopic: "",
          sessionUsage: { total_tokens: state.sessionUsage.total_tokens + 50, total_cost_usd: state.sessionUsage.total_cost_usd + 0.0001 },
        }));
        const finalMessages = get().messages.filter((message) => message.session_id === sessionId);
        previewSessionMessages.set(sessionId, finalMessages);
      } finally {
        set({ sendingMessage: false });
      }
      return;
    }

    const sessionId = sourceUserMessage.session_id || get().sessionId;
    if (!sessionId) {
      set({ sendingMessage: false });
      return;
    }

    try {
      const token = ensureToken(get().token);
      const budgetStatus = calcBudgetStatus(
        get().dailyUsage,
        get().chatSettings,
        get().models,
        get().selectedModel,
      );
      if (budgetStatus.available_output_tokens !== null && budgetStatus.available_output_tokens < 4000) {
        const ok = window.confirm(`当前可用输出约 ${(budgetStatus.available_output_tokens ?? 0)} tokens，继续可能被阻断。是否继续？`);
        if (!ok) {
          throw new Error("已取消发送：预算剩余不足。");
        }
      }
      persistInflightStream(sessionId, {
        session_id: sessionId,
        job_id: null,
        cursor: "",
        user_message_id: sourceUserMessage.id,
        created_at: Date.now(),
      });
      const submit = await requestJson<{ job_id: string; cursor?: string; user_message_id?: string }>("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        token,
        body: JSON.stringify({
          session_id: sessionId,
          message: trimmedContent,
          attachments,
          new_session: false,
          request_source: "regenerate_message",
          model: get().selectedModel,
          regenerate_user_message_id: sourceUserMessage.id,
          max_output_tokens_override: resolveMaxOutputTokensOverride(
            get().chatSettings,
            budgetStatus,
          ),
          client_request_id: sourceUserMessage.id,
        }),
      });
      const normalizedSubmitCursor = normalizeCursorSequence(submit.cursor ?? "");
      persistInflightStream(sessionId, {
        session_id: sessionId,
        job_id: submit.job_id,
        cursor: normalizedSubmitCursor.cursor,
        user_message_id: submit.user_message_id?.trim() || null,
        created_at: Date.now(),
      });
      const streamResult = await consumeChatStream(
        get().token,
        sessionId,
        submit.job_id,
        normalizedSubmitCursor.cursor,
        get().logLevel,
        (nextContent) => {
          if (get().sessionId === sessionId) set({ streamingMessage: nextContent });
        },
        (nextReasoning) => {
          if (get().sessionId === sessionId) set({ streamingReasoning: nextReasoning, streamingThinkingTopic: extractLastThinkingTopic(nextReasoning) });
        },
        get().streamingMessage,
        get().streamingReasoning,
      );
      persistInflightStream(sessionId, null);
      const persistedUserMessageId = streamResult.userMessageId ?? submit.user_message_id ?? sourceUserMessage.id;

      if (streamResult.failure) {
        set((state) => ({
          messages: replaceMessageId(state.messages, sourceUserMessage.id, persistedUserMessageId),
          streamingMessage: streamResult.content,
          streamingReasoning: streamResult.reasoning,
          streamFailure: buildStreamFailureState(
            sessionId,
            submit.job_id,
            persistedUserMessageId,
            sourceUserMessage.created_at,
            streamResult.failure,
            streamResult.content,
            streamResult.reasoning,
          ),
        }));
        await get().refreshUsage();
        await get().refreshSessionUsage(sessionId);

        return;
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        role: "assistant",
        content: streamResult.content,
        attachments: [],
        created_at: Date.now(),
        model: get().selectedModel,
        reasoning_summary: streamResult.reasoning.trim() || null,
      };

      set((state) => {
        const nextMessages = replaceMessageId(state.messages, sourceUserMessage!.id, persistedUserMessageId);
        return {
          messages: [
            ...nextMessages,
            assistantMessage,
          ],
          streamingMessage: "",
          streamingReasoning: "",
          streamingThinkingTopic: "",
          streamFailure: null,
        };
      });

      await get().refreshUsage();
      await get().refreshSessionUsage(sessionId);
      if (streamResult.warning) {
        get().pushToast(streamResult.warning, "info");
      }
    } catch (error) {
      persistInflightStream(sessionId, null);
      get().pushToast(`Failed to regenerate message: ${getErrorMessage(error)}`, "error");
      set({ streamingMessage: "", streamingReasoning: "", streamingThinkingTopic: "", streamFailure: null, streamRecovery: null });
      throw error;
    } finally {
      set({ sendingMessage: false });
    }
  },

  reconnectStream: async () => {
    if (get().previewMode) {
      return;
    }
    const recovery = get().streamRecovery;
    const currentSessionId = get().sessionId;
    if (!recovery || recovery.mode !== "disconnected" || !currentSessionId || recovery.session_id !== currentSessionId || !recovery.job_id) {
      return;
    }
    const currentContent = get().streamingMessage;
    const currentReasoning = get().streamingReasoning;
    set({
      sendingMessage: true,
      streamRecovery: { ...recovery, mode: "reconnecting", last_error: null },
      streamFailure: null,
    });
    try {
      const resumeCursor = normalizeCursorSequence(recovery.cursor);
      const cursorToUse = (currentContent || currentReasoning) ? resumeCursor.cursor : "";
      const streamResult = await consumeChatStream(
        get().token,
        recovery.session_id,
        recovery.job_id,
        cursorToUse,
        get().logLevel,
        (nextContent) => {
          if (get().sessionId === recovery.session_id) set({ streamingMessage: nextContent });
        },
        (nextReasoning) => {
          if (get().sessionId === recovery.session_id) set({ streamingReasoning: nextReasoning, streamingThinkingTopic: extractLastThinkingTopic(nextReasoning) });
        },
        currentContent,
        currentReasoning,
      );
      const persistedUserMessageId = streamResult.userMessageId ?? recovery.user_message_id;
      if (streamResult.failure) {
        persistInflightStream(recovery.session_id, null);
        set({
          messages: get().messages,
          streamingMessage: streamResult.content,
          streamingReasoning: streamResult.reasoning,
          streamRecovery: null,
          streamFailure: buildStreamFailureState(
            recovery.session_id,
            recovery.job_id,
            persistedUserMessageId,
            recovery.user_message_created_at ?? resolveRecoveryUserMessageCreatedAt(get().messages, persistedUserMessageId),
            streamResult.failure,
            streamResult.content,
            streamResult.reasoning,
          ),
        });
        await get().refreshSessions();
        await get().refreshSessionUsage(recovery.session_id);
        return;
      }
      if (streamResult.warning) {
        const latestCursor = normalizeCursorSequence(streamResult.cursor).cursor;
        persistInflightStream(recovery.session_id, {
          session_id: recovery.session_id,
          job_id: recovery.job_id,
          cursor: latestCursor,
          user_message_id: persistedUserMessageId,
          created_at: Date.now(),
        });
        set((state) => ({
          streamRecovery: state.streamRecovery
            ? {
                ...state.streamRecovery,
                cursor: latestCursor,
                user_message_id: persistedUserMessageId,
                mode: "disconnected",
                last_error: "SSE disconnected again. You can reconnect or wait for completion.",
                created_at: Date.now(),
              }
            : null,
        }));
        return;
      }
      persistInflightStream(recovery.session_id, null);
      const refreshedMessages = await fetchSessionMessages(ensureToken(get().token), recovery.session_id);
      set({
        messages: refreshedMessages,
        streamingMessage: "",
        streamingReasoning: "",
        streamingThinkingTopic: "",
        streamRecovery: null,
        streamFailure: null,
      });
      await get().refreshSessions();
      await get().refreshSessionUsage(recovery.session_id);
    } catch (error) {
      set((state) => ({
        streamRecovery: state.streamRecovery
          ? {
              ...state.streamRecovery,
              mode: "disconnected",
              last_error: `Failed to reconnect: ${getErrorMessage(error)}`,
              created_at: Date.now(),
            }
          : null,
      }));
      get().pushToast(`Failed to reconnect stream: ${getErrorMessage(error)}`, "error");
    } finally {
      set({ sendingMessage: false });
    }
  },

  waitForStreamCompletion: async () => {
    if (get().previewMode) {
      return;
    }
    const recovery = get().streamRecovery;
    const currentSessionId = get().sessionId;
    if (!recovery || recovery.mode !== "disconnected" || !currentSessionId || recovery.session_id !== currentSessionId) {
      return;
    }
    set({
      sendingMessage: true,
      streamRecovery: { ...recovery, mode: "waiting", last_error: null },
      streamingMessage: "",
      streamingReasoning: "",
      streamingThinkingTopic: "",
      streamFailure: null,
    });
    try {
      const token = ensureToken(get().token);
      const userMessageCreatedAt =
        recovery.user_message_created_at
        ?? resolveRecoveryUserMessageCreatedAt(get().messages, recovery.user_message_id)
        ?? Date.now();
      await waitForAssistantMessage(token, recovery.session_id, userMessageCreatedAt, get().logLevel);
      persistInflightStream(recovery.session_id, null);
      const refreshedMessages = await fetchSessionMessages(token, recovery.session_id);
      set({
        messages: refreshedMessages,
        streamingMessage: "",
        streamingReasoning: "",
        streamingThinkingTopic: "",
        streamFailure: null,
        streamRecovery: null,
      });
      await get().refreshSessions();
      await get().refreshSessionUsage(recovery.session_id);
    } catch (error) {
      set((state) => ({
        streamRecovery: state.streamRecovery
          ? {
              ...state.streamRecovery,
              mode: "disconnected",
              last_error: getErrorMessage(error),
              created_at: Date.now(),
            }
          : null,
      }));
      throw error;
    } finally {
      set({ sendingMessage: false });
    }
  },

  renameSession: async (sessionId, title) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      throw new Error("Title is required.");
    }
    if (get().previewMode) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, title: normalizedTitle } : s)),
      }));
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ success: boolean; title: string }>(`/api/sessions/${encodeURIComponent(sessionId)}/title`, {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: normalizedTitle }),
    });
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, title: data.title || normalizedTitle } : s)),
    }));
  },

  autoGenerateSessionTitle: async (sessionId) => {
    if (!sessionId.trim()) {
      throw new Error("Session id is required.");
    }
    if (get().previewMode) {
      const transcript = get().messages
        .filter((message) => message.session_id === sessionId && (message.role === "user" || message.role === "assistant"))
        .map((message) => message.content.trim())
        .filter((content) => content.length > 0)
        .join("\n\n");
      const title = transcript ? transcript.slice(0, SESSION_TITLE_MAX_LENGTH) : "New Chat";
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, title } : s)),
      }));
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ success: boolean; title: string }>(`/api/sessions/${encodeURIComponent(sessionId)}/title/auto`, {
      method: "POST",
      token,
    });
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, title: data.title || s.title } : s)),
    }));
    if (get().sessionId === sessionId) {
      await get().refreshUsage();
      await get().refreshSessionUsage(sessionId);
    }
  },

  archiveSession: async (sessionId, archived = true) => {
    if (get().previewMode) {
      const showArchived = get().showArchivedSessions;
      set((state) => ({
        sessions: state.sessions
          .map((s) => (s.id === sessionId ? { ...s, archived_at: archived ? Date.now() : null } : s))
          .filter((s) => showArchived || !s.archived_at),
      }));
      if (archived && !showArchived && get().sessionId === sessionId) {
        get().clearSession();
      }
      return;
    }
    const token = ensureToken(get().token);
    await requestJson<{ success: boolean }>(`/api/sessions/${encodeURIComponent(sessionId)}/archive`, {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    if (archived && !get().showArchivedSessions && get().sessionId === sessionId) {
      get().clearSession();
    }
    await get().refreshSessions();
  },

  pinSession: async (sessionId, pinned = true) => {
    if (get().previewMode) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, pinned_at: pinned ? Date.now() : null } : s)),
      }));
      return;
    }
    const token = ensureToken(get().token);
    await requestJson<{ success: boolean }>(`/api/sessions/${encodeURIComponent(sessionId)}/pin`, {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });
    await get().refreshSessions();
  },
});
