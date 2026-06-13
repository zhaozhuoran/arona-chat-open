import { create } from "zustand";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
  ChatGenerationSettings,
  LogLevel,
  Message,
  MessageAttachment,
  MessageAttachmentType,
  ModelOption,
  PasskeyInfo,
  ReasoningEffort,
  ServiceTier,
  Session,
  UsageSummary,
  UserProfile,
  Workspace,
  DailyBudgetStatus,
} from "@arona-chat/shared";
import { SESSION_TITLE_MAX_LENGTH } from "../constants/session";

type ToastType = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
};

type AuthMethod = "password" | "passkey" | "preview" | null;

type ProfileUpdatePayload = {
  username?: string;
  avatar_key?: string | null;
  dynamic_background?: boolean;
  send_shortcut?: "ctrl_enter" | "enter";
  conversation_library_enabled?: boolean;
};

type ChatSettingsUpdatePayload = Partial<ChatGenerationSettings>;

export type ComposerAttachment = MessageAttachment & {
  status: "uploading" | "ready" | "error";
  local_id: string;
  progress: number;
  error?: string;
};

export type AttachmentLibraryItem = MessageAttachment & {
  created_at: number;
};

export type LibraryItem = AttachmentLibraryItem;

interface Store {
  authReady: boolean;
  authLoading: boolean;
  authenticated: boolean;
  authMethod: AuthMethod;
  token: string | null;
  previewMode: boolean;
  backendBuildHash: string;
  backendBuildTime: string;

  sessions: Session[];
  sessionsHasMore: boolean;
  sessionsLoadingMore: boolean;
  sessionId: string | null;
  messages: Message[];
  loadingMessages: boolean;
  sendingMessage: boolean;
  streamingMessage: string;
  streamingReasoning: string;
  streamRecovery: StreamRecoveryState | null;
  streamFailure: StreamFailureState | null;

  profile: UserProfile | null;
  usage: UsageSummary | null;
  dailyUsage: UsageSummary | null;
  dailyUsageDate: string | null;
  sessionUsage: {
    total_tokens: number;
    total_cost_usd: number;
  };
  passkeys: PasskeyInfo[];
  models: ModelOption[];
  selectedModel: string;
  titleModel: string;
  chatSettings: ChatGenerationSettings;
  logLevel: LogLevel;
  systemPromptTimezone: string;
  showArchivedSessions: boolean;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  attachmentLibrary: AttachmentLibraryItem[];
  attachmentLibraryLoading: boolean;
  libraryItems: LibraryItem[];
  libraryLoading: boolean;

  toasts: ToastItem[];
  pushToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;

  initialize: () => Promise<void>;
  loginWithPassword: (password: string) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  loginWithPreviewPassword: () => void;
  logout: () => void;

  refreshSessions: () => Promise<void>;
  loadMoreSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  clearSession: () => void;
  sendMessage: (content: string, attachments?: MessageAttachment[]) => Promise<void>;
  regenerateLastMessage: () => Promise<void>;
  reconnectStream: () => Promise<void>;
  waitForStreamCompletion: () => Promise<void>;

  refreshProfile: () => Promise<void>;
  updateProfile: (payload: ProfileUpdatePayload) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;

  refreshUsage: () => Promise<void>;
  syncUsageAggregate: () => Promise<void>;
  refreshSessionUsage: (sessionId?: string | null) => Promise<void>;
  refreshModels: () => Promise<void>;
  setSelectedModel: (model: string) => Promise<void>;
  setTitleModel: (model: string) => Promise<void>;
  setChatSettings: (payload: ChatSettingsUpdatePayload) => Promise<void>;
  setLogLevel: (level: LogLevel) => Promise<void>;
  setSystemPromptTimezone: (timezone: string) => Promise<void>;
  setShowArchivedSessions: (show: boolean) => Promise<void>;
  refreshWorkspaces: (includeArchived?: boolean) => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  renameWorkspace: (workspaceId: string, name: string) => Promise<void>;
  archiveWorkspace: (workspaceId: string, archived?: boolean) => Promise<void>;
  activateWorkspace: (workspaceId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  autoGenerateSessionTitle: (sessionId: string) => Promise<void>;
  archiveSession: (sessionId: string, archived?: boolean) => Promise<void>;
  pinSession: (sessionId: string, pinned?: boolean) => Promise<void>;

  refreshPasskeys: () => Promise<void>;
  registerPasskey: (nickname?: string) => Promise<void>;
  removePasskey: (credentialId: string) => Promise<void>;

  uploadAttachment: (file: File, onProgress?: (percent: number) => void) => Promise<MessageAttachment>;
  refreshAttachmentLibrary: () => Promise<void>;
  deleteAttachment: (attachmentId: string) => Promise<void>;
  refreshLibrary: () => Promise<void>;
  uploadLibraryFile: (file: File) => Promise<LibraryItem>;
  deleteLibraryItem: (fileId: string) => Promise<void>;
}

type RequestInitWithAuth = RequestInit & { token?: string | null };

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";
const TOKEN_STORAGE_KEY = "arona-chat.auth-token";
const PREVIEW_MODE_STORAGE_KEY = "arona-chat.preview-mode";
/** Delay per chunk when simulating streaming in preview mode, chosen to feel like a real stream. */
const PREVIEW_STREAM_CHUNK_DELAY_MS = 18;
const SDR_COMPATIBLE_IMAGE_TYPES = ["image/png", "image/webp", "image/jpeg"] as const;
const DEFAULT_MODEL = "openrouter/auto";
const ZERO_SESSION_USAGE = { total_tokens: 0, total_cost_usd: 0 };
export const SERVICE_TIER_MULTIPLIERS: Record<string, number> = {
  flex: 0.5,
  default: 1.0,
  priority: 2.5,
};
const DEFAULT_CHAT_SETTINGS: ChatGenerationSettings = {
  service_tier: "default",
  reasoning_effort: "medium",
  max_output_tokens: 9000,
  daily_budget_usd: 4,
  temporary_daily_budget_usd: null,
  temporary_daily_budget_date_utc: null,
  web_search_enabled: false,
  web_search_max_results: 5,
};
const DEFAULT_LOG_LEVEL: LogLevel = "INFO";
const DEFAULT_BACKEND_BUILD_HASH = "unknown";
const DEFAULT_BACKEND_BUILD_TIME = "";
const STREAM_INFLIGHT_PREFIX = "arona-chat.stream.inflight.";
const STREAM_INFLIGHT_MAX_AGE_MS = 10 * 60 * 1000;
const STREAM_INFLIGHT_PERSIST_MIN_INTERVAL_MS = 500;
const STREAM_INFLIGHT_PERSIST_MIN_SEQUENCE_DELTA = 24;
const STREAM_EVENT_CONNECTION_TIMEOUT_MS = 25_000;
const STREAM_EVENT_STALL_TIMEOUT_MS = 45_000;
const STREAM_EVENT_POLL_INTERVAL_MS = 1_500;
const STREAM_EVENT_POLL_MAX_AGE_MS = 120_000;

// ---------------------------------------------------------------------------
// Preview-mode helpers (frontend-only, no backend calls)
// ---------------------------------------------------------------------------

/** Returns true when this is a preview build with VITE_PREVIEW_PASSWORD embedded. */
export const isPreviewAvailable = (): boolean => Boolean(import.meta.env.VITE_PREVIEW_PASSWORD?.trim());

const PREVIEW_SESSION_ID_1 = "preview-s1";
const PREVIEW_SESSION_ID_2 = "preview-s2";

const PREVIEW_MOCK_PROFILE: UserProfile = {
  username: "Preview Sensei",
  avatar_key: null,
  avatar_url: null,
  dynamic_background: true,
  send_shortcut: "ctrl_enter",
  conversation_library_enabled: true,
  updated_at: Date.now(),
};

const buildPreviewSessions = (): Session[] => {
  const now = Date.now();
  return [
    { id: PREVIEW_SESSION_ID_1, title: "Welcome to SCHALE Terminal", created_at: now - 3_600_000, archived_at: null, pinned_at: now - 3_600_000 },
    { id: PREVIEW_SESSION_ID_2, title: "Blue Archive Lore Discussion", created_at: now - 1_800_000, archived_at: null, pinned_at: null },
  ];
};

const buildPreviewMessages = (): Record<string, Message[]> => {
  const now = Date.now();
  return {
    [PREVIEW_SESSION_ID_1]: [
      { id: "preview-m1", session_id: PREVIEW_SESSION_ID_1, role: "user", content: "Hello Arona! Can you introduce yourself?", attachments: [], created_at: now - 3_500_000, model: null },
      { id: "preview-m2", session_id: PREVIEW_SESSION_ID_1, role: "assistant", content: "Hello, Sensei! I'm Arona, your AI assistant at SCHALE Terminal. I'm here to help you with research, writing, coding, and conversation. What would you like to explore today?", attachments: [], created_at: now - 3_490_000, model: "openrouter/auto" },
      { id: "preview-m3", session_id: PREVIEW_SESSION_ID_1, role: "user", content: "What can you help me with?", attachments: [], created_at: now - 3_480_000, model: null },
      {
        id: "preview-m4", session_id: PREVIEW_SESSION_ID_1, role: "assistant",
        content: "I can assist you with a wide range of tasks:\n\n- **Research & Analysis** — Summarize documents, explain complex topics\n- **Writing & Editing** — Draft, review, or refine any content\n- **Coding** — Write, debug, or explain code in any language\n- **Conversation** — Discuss ideas, stories, or anything on your mind\n\nThis is a **preview build** of SCHALE Terminal. Feel free to explore the interface — sidebar, settings, and example conversations are all available!",
        attachments: [], created_at: now - 3_470_000, model: "openrouter/auto",
      },
    ],
    [PREVIEW_SESSION_ID_2]: [
      { id: "preview-m5", session_id: PREVIEW_SESSION_ID_2, role: "user", content: "Tell me about the Blue Archive lore.", attachments: [], created_at: now - 1_700_000, model: null },
      {
        id: "preview-m6", session_id: PREVIEW_SESSION_ID_2, role: "assistant",
        content: "**Blue Archive** is set in **Kivotos**, a vast city-state governed entirely by students. The story centers on **Schale**, a special task force that resolves crises across the city.\n\nKey factions:\n- **Trinity General School** — A religious institution known for discipline and faith\n- **Millennium Science School** — A technology-focused academy driven by innovation\n- **Gehenna Academy** — A chaotic school with a delinquent culture\n- **Abydos High School** — A remote, nearly abandoned school in the desert\n\nThe **Sensei** (the player) serves as advisor to Schale, and **Arona** is the AI system of the Schale terminal — that's me! 🎮",
        attachments: [], created_at: now - 1_690_000, model: "openrouter/auto",
        reasoning_summary: "The user asked about Blue Archive lore. I should summarize the key world-building elements concisely.",
      },
    ],
  };
};

const PREVIEW_MOCK_MODELS: ModelOption[] = [
  { id: "openrouter/auto", name: "Auto (OpenRouter)", pricing: null },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", pricing: { input_usd_per_million: 3, output_usd_per_million: 15 } },
  { id: "openai/gpt-4o", name: "GPT-4o", pricing: { input_usd_per_million: 2.5, output_usd_per_million: 10 } },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", pricing: { input_usd_per_million: 0.1, output_usd_per_million: 0.4 } },
];

const PREVIEW_MOCK_USAGE: UsageSummary = {
  total_requests: 12,
  total_prompt_tokens: 8420,
  total_completion_tokens: 4180,
  total_tokens: 12600,
  total_cost_usd: 0.0312,
  by_model: [
    { model: "openrouter/auto", requests: 8, prompt_tokens: 5200, completion_tokens: 2800, total_tokens: 8000, cost_usd: 0.0188 },
    { model: "anthropic/claude-3.5-sonnet", requests: 4, prompt_tokens: 3220, completion_tokens: 1380, total_tokens: 4600, cost_usd: 0.0124 },
  ],
};

const PREVIEW_RESPONSE_TEXTS = [
  "This is a **preview environment** — real AI responses are not available here, but you can explore the full interface.\n\nSCHALE Terminal supports Markdown, code blocks, LaTeX math, reasoning traces, and file attachments. Try navigating between sessions in the sidebar, or open Settings to see the available options!",
  "Hello, Sensei! I'm running in **preview mode**, so I can't connect to the real AI backend.\n\nIn a production deployment I would answer your questions, assist with research, writing, coding, and much more. Feel free to keep exploring — all UI components are fully functional in this preview build. 🌸",
  "**Preview build note:** Backend connectivity is disabled in this environment.\n\nYou can still browse example conversations, switch sessions, adjust settings locally, and get a feel for the overall layout and interaction patterns of SCHALE Terminal.",
];

/** In-memory map used to persist new preview-session messages across session switches. */
const previewSessionMessages = new Map<string, Message[]>();

const normalizeLogLevel = (value: unknown): LogLevel => {
  if (value === "TRACE") {
    return "TRACE";
  }
  return "INFO";
};

const traceClientLog = (logLevel: LogLevel, event: string, payload: Record<string, unknown>): void => {
  if (logLevel !== "TRACE") {
    return;
  }
  console.debug(`[TRACE][chat.stream] ${event}`, payload);
};

const normalizeReasoningEffort = (value: unknown): ReasoningEffort => {
  if (value === "minimal" || value === "low" || value === "medium" || value === "high" || value === "xhigh") {
    return value;
  }
  return "medium";
};

const normalizeTemporaryDailyBudgetUsd = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim().length === 0) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0.01, parsed) : null;
};

const isCurrentUtcDate = (value: string | null | undefined): boolean => value === getCurrentUtcDate();

const normalizeServiceTier = (value: unknown): ServiceTier => {
  if (value === "flex" || value === "default" || value === "priority") {
    return value;
  }
  return "default";
};

const normalizeChatSettings = (value: Partial<ChatGenerationSettings> | null | undefined): ChatGenerationSettings => {
  const maxOutputTokensRaw = Number(value?.max_output_tokens);
  const maxOutputTokens = Number.isFinite(maxOutputTokensRaw) ? Math.min(64000, Math.max(1, Math.round(maxOutputTokensRaw))) : 9000;
  const maxResultsRaw = Number(value?.web_search_max_results);
  const maxResults = Number.isFinite(maxResultsRaw) ? Math.min(25, Math.max(1, Math.round(maxResultsRaw))) : 5;
  const temporaryBudget = normalizeTemporaryDailyBudgetUsd(value?.temporary_daily_budget_usd);
  const temporaryDate = value?.temporary_daily_budget_date_utc ?? (temporaryBudget === null ? null : getCurrentUtcDate());
  const temporaryBudgetActive = temporaryBudget !== null && isCurrentUtcDate(temporaryDate);
  return {
    service_tier: normalizeServiceTier(value?.service_tier),
    reasoning_effort: normalizeReasoningEffort(value?.reasoning_effort),
    max_output_tokens: maxOutputTokens,
    daily_budget_usd: Number.isFinite(Number(value?.daily_budget_usd)) ? Math.max(0.01, Number(value?.daily_budget_usd)) : 4,
    temporary_daily_budget_usd: temporaryBudgetActive ? temporaryBudget : null,
    temporary_daily_budget_date_utc: temporaryBudgetActive ? temporaryDate : null,
    web_search_enabled: Boolean(value?.web_search_enabled),
    web_search_max_results: maxResults,
  };
};

const getCurrentUtcDate = (): string => new Date().toISOString().slice(0, 10);

const calcBudgetStatus = (
  usage: UsageSummary | null,
  settings: ChatGenerationSettings,
  models: ModelOption[],
  selectedModel: string,
): DailyBudgetStatus => {
  const dateUtc = getCurrentUtcDate();
  const spent = Number(usage?.total_cost_usd ?? 0);
  const temporaryBudgetActive = settings.temporary_daily_budget_usd !== null;
  const budget = Number(temporaryBudgetActive ? settings.temporary_daily_budget_usd : (settings.daily_budget_usd ?? 4));
  const remaining = Math.max(0, budget - spent);
  const model = models.find((m) => m.id === selectedModel);
  const multiplier = SERVICE_TIER_MULTIPLIERS[settings.service_tier] || 1.0;
  const outPrice = model?.pricing?.output_usd_per_million 
    ? model.pricing.output_usd_per_million * multiplier
    : null;
  const available = outPrice && outPrice > 0 ? Math.floor((remaining * 1_000_000 / outPrice) * 0.75) : null;
  return { date_utc: dateUtc, budget_usd: budget, spent_usd: spent, remaining_usd: remaining, selected_model_output_usd_per_million: outPrice, available_output_tokens: available };
};

const warnBudget = (store: Store) => {
  const status = calcBudgetStatus(
    store.dailyUsage,
    store.chatSettings,
    store.models,
    store.selectedModel,
  );
  const available = status.available_output_tokens;
  if (available !== null && available < 8000) {
    store.pushToast(`预算预警：当前模型可用输出约 ${available} tokens。`, "info");
  }
};

const resolveMaxOutputTokensOverride = (
  settings: ChatGenerationSettings,
  budgetStatus: DailyBudgetStatus,
): number => {
  const configuredMax = Math.max(1, Math.min(64000, Math.round(Number(settings.max_output_tokens) || 9000)));
  const availableMax = budgetStatus.available_output_tokens;
  if (!Number.isFinite(availableMax)) {
    return configuredMax;
  }
  return Math.max(1, Math.min(configuredMax, Math.round(availableMax)));
};

const resolveAttachmentType = (mimeType: string): MessageAttachmentType => {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "file";
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Request failed.";
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error) {
      return data.error;
    }
  } catch {
    // ignore JSON parse error and fallback to status text
  }
  return response.statusText || `HTTP ${response.status}`;
};

const requestJson = async <T>(path: string, init: RequestInitWithAuth = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as T;
};

const hashFileSha256 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const uploadFileWithRetry = async (
  url: string,
  file: File,
  mimeType: string,
  token: string | null,
  onProgress?: (percent: number) => void,
  maxRetries = 3,
): Promise<Response> => {
  let lastError: unknown;
  const isPresignedUrl = (() => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("x-amz-algorithm=") || lowerUrl.includes("x-amz-signature=") || lowerUrl.includes("sig=")) {
      return true;
    }
    try {
      const targetOrigin = new URL(url, window.location.origin).origin;
      const apiOrigin = new URL(API_URL, window.location.origin).origin;
      return targetOrigin !== apiOrigin;
    } catch {
      return false;
    }
  })();

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": mimeType,
      };

      // Do NOT send Authorization header to direct R2 presigned URLs
      if (!isPresignedUrl && token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = onProgress && !isPresignedUrl
        ? await new Promise<Response>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", url);
          Object.entries(headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable || event.total <= 0) {
              return;
            }
            onProgress(Math.max(0, Math.min(99, (event.loaded / event.total) * 100)));
          };
          xhr.onload = () => {
            resolve(new Response(xhr.responseText, {
              status: xhr.status,
              statusText: xhr.statusText,
            }));
          };
          xhr.onerror = () => reject(new Error("Upload request failed."));
          xhr.onabort = () => reject(new Error("Upload request aborted."));
          xhr.send(file);
        })
        : await fetch(url, {
          method: "PUT",
          headers,
          body: file,
        });

      if (response.ok) {
        onProgress?.(100);
        return response;
      }

      // Only retry on 5xx or network errors
      if (response.status < 500) {
        return response;
      }

      throw new Error(`Upload failed with status ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        await new Promise((resolve) => { window.setTimeout(resolve, delay); });
      }
    }
  }

  throw lastError || new Error("Upload failed after retries.");
};

const cropImageToSquare = async (file: File): Promise<File> => {
  if (!file.type.startsWith("image/")) {
    return file;
  }
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sourceX = Math.max(0, Math.floor((bitmap.width - side) / 2));
    const sourceY = Math.max(0, Math.floor((bitmap.height - side) / 2));
    const targetSize = Math.min(1024, side);

    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Cannot process avatar image.");
    }

    context.drawImage(bitmap, sourceX, sourceY, side, side, 0, 0, targetSize, targetSize);

    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, outputType === "image/png" ? undefined : 0.92);
    });
    if (!blob) {
      throw new Error("Failed to export avatar image.");
    }

    const fallbackExt = outputType === "image/png" ? "png" : "jpg";
    const nextName = file.name.replace(/\.[a-z0-9]+$/i, "") || "avatar";
    return new File([blob], `${nextName}.${fallbackExt}`, {
      type: blob.type || outputType,
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
};

const convertImageToSdrIfPossible = async (file: File): Promise<File> => {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") {
    return file;
  }
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }
    context.drawImage(bitmap, 0, 0);
    const outputType = SDR_COMPATIBLE_IMAGE_TYPES.includes(file.type as (typeof SDR_COMPATIBLE_IMAGE_TYPES)[number])
      ? file.type
      : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, outputType === "image/png" ? undefined : 0.92);
    });
    if (!blob) {
      return file;
    }
    const extByType: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const fallbackExt = extByType[outputType] ?? "jpg";
    const nextName = file.name.replace(/\.[^.]+$/, "").trim() || "image";
    return new File([blob], `${nextName}.${fallbackExt}`, {
      type: blob.type || outputType,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
};

const parseSSEPayload = (rawEvent: string): unknown => {
  const lines = rawEvent.split(/\r\n|\r|\n/);
  const dataLines: string[] = [];
  for (const line of lines) {
    if (!line.startsWith("data:")) {
      continue;
    }
    const data = line.slice(5);
    dataLines.push(data.startsWith(" ") ? data.slice(1) : data);
  }
  if (!dataLines.length) {
    return null;
  }
  const payload = dataLines.join("\n").trim();
  if (!payload) {
    return null;
  }
  return JSON.parse(payload);
};

const readNextSSEEvent = (buffer: string): { event: string; rest: string } | null => {
  const boundaryMatch = /\r?\n\r?\n/.exec(buffer);
  if (!boundaryMatch || boundaryMatch.index === undefined) {
    return null;
  }

  return {
    event: buffer.slice(0, boundaryMatch.index),
    rest: buffer.slice(boundaryMatch.index + boundaryMatch[0].length),
  };
};

type StreamSubmitResponse = {
  job_id: string;
  state: string;
  cursor?: string;
  user_message_id?: string;
};

type StreamInflightState = {
  session_id: string;
  job_id: string | null;
  cursor: string;
  user_message_id: string | null;
  created_at: number;
};

type StreamRecoveryState = {
  session_id: string;
  job_id: string | null;
  cursor: string;
  user_message_id: string | null;
  user_message_created_at: number | null;
  new_session: boolean;
  created_at: number;
  mode: "disconnected" | "reconnecting" | "waiting";
  last_error: string | null;
};

type StreamFailureState = {
  session_id: string;
  job_id: string;
  user_message_id: string | null;
  user_message_created_at: number | null;
  error: string;
  content: string;
  reasoning: string;
  created_at: number;
};

type StreamRecoveryLookupResponse = {
  session_id: string;
  job_id: string;
  cursor: string;
  user_message_id: string;
  state: "queued" | "running" | "completed" | "failed" | "cancelled";
  created_at: number;
  updated_at: number;
};

const streamInflightStorageKey = (sessionId: string): string => `${STREAM_INFLIGHT_PREFIX}${sessionId}`;

const persistInflightStream = (sessionId: string, payload: StreamInflightState | null): void => {
  const key = streamInflightStorageKey(sessionId);
  try {
    if (!payload) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore localStorage failures (quota/private mode) and keep streaming functional.
  }
};

const loadInflightStream = (sessionId: string): StreamInflightState | null => {
  const key = streamInflightStorageKey(sessionId);
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StreamInflightState;
    const createdAt = Number(parsed?.created_at ?? 0);
    if (!parsed || parsed.session_id !== sessionId || !Number.isFinite(createdAt) || createdAt <= 0) {
      localStorage.removeItem(key);
      return null;
    }
    if (Date.now() - createdAt > STREAM_INFLIGHT_MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore localStorage failures.
    }
    return null;
  }
};

const isRecentUserMessage = (message: Message | null | undefined): message is Message =>
  Boolean(message && message.role === "user" && Number.isFinite(Number(message.created_at)));

const normalizeCursorSequence = (value: string | null | undefined): { cursor: string; sequence: number } => {
  const parsed = Number((value ?? "").trim());
  const sequence = Number.isFinite(parsed) ? Math.floor(parsed) : 0;
  return {
    cursor: sequence > 0 ? String(sequence) : "",
    sequence,
  };
};

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException ? error.name === "AbortError" : error instanceof Error && error.name === "AbortError";

const waitForAssistantMessage = async (
  token: string,
  sessionId: string,
  userMessageCreatedAt: number,
  logLevel: LogLevel,
): Promise<Message> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < STREAM_EVENT_POLL_MAX_AGE_MS) {
    const data = await requestJson<{ messages: Message[] }>(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "GET",
      token,
    });
    const assistantMessages = (data.messages ?? []).filter(
      (message) => message.role === "assistant" && Number(message.created_at) >= userMessageCreatedAt,
    );
    const latestAssistant = assistantMessages.at(-1);
    if (latestAssistant) {
      traceClientLog(logLevel, "events.poll.resolved", {
        session_id: sessionId,
        elapsed_ms: Date.now() - startedAt,
      });
      return latestAssistant;
    }
    traceClientLog(logLevel, "events.poll.wait", {
      session_id: sessionId,
      elapsed_ms: Date.now() - startedAt,
    });
    await new Promise((resolve) => window.setTimeout(resolve, STREAM_EVENT_POLL_INTERVAL_MS));
  }
  throw new Error("Timed out waiting for the assistant response.");
};

const fetchSessionMessages = async (token: string, sessionId: string): Promise<Message[]> => {
  const data = await requestJson<{ messages: Message[] }>(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: "GET",
    token,
  });
  return data.messages || [];
};

const fetchStreamRecovery = async (token: string, sessionId: string): Promise<StreamRecoveryLookupResponse | null> => {
  const response = await fetch(`${API_URL}/api/chat/stream/recovery?session_id=${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = await response.json() as { recovery?: StreamRecoveryLookupResponse | null };
  return data.recovery ?? null;
};

const resolveRecoveryUserMessageCreatedAt = (
  messages: Message[],
  userMessageId: string | null | undefined,
): number | null => {
  const normalizedUserMessageId = userMessageId?.trim() || null;
  if (normalizedUserMessageId) {
    const matched = messages.find((message) => message.id === normalizedUserMessageId && message.role === "user");
    if (matched && Number.isFinite(Number(matched.created_at))) {
      return Number(matched.created_at);
    }
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user" && Number.isFinite(Number(message.created_at))) {
      return Number(message.created_at);
    }
  }
  return null;
};

const buildDisconnectedRecoveryState = (
  sessionId: string,
  jobId: string | null,
  cursor: string,
  userMessageId: string | null,
  userMessageCreatedAt: number | null,
  lastError: string,
): StreamRecoveryState => ({
  session_id: sessionId,
  job_id: jobId,
  cursor,
  user_message_id: userMessageId,
  user_message_created_at: userMessageCreatedAt,
  new_session: false,
  created_at: Date.now(),
  mode: "disconnected",
  last_error: lastError,
});

const buildStreamFailureState = (
  sessionId: string,
  jobId: string,
  userMessageId: string | null,
  userMessageCreatedAt: number | null,
  error: string,
  content: string,
  reasoning: string,
): StreamFailureState => ({
  session_id: sessionId,
  job_id: jobId,
  user_message_id: userMessageId,
  user_message_created_at: userMessageCreatedAt,
  error,
  content,
  reasoning,
  created_at: Date.now(),
});

const consumeChatStream = async (
  token: string,
  sessionId: string,
  jobId: string,
  initialCursor: string,
  logLevel: LogLevel,
  onMessageDelta: (content: string) => void,
  onReasoningDelta: (reasoning: string) => void,
): Promise<{ content: string; reasoning: string; warning: string | null; failure: string | null; userMessageId: string | null; cursor: string }> => {
  const normalizedInitialCursor = normalizeCursorSequence(initialCursor);
  let cursor = normalizedInitialCursor.cursor;
  let lastSequence = normalizedInitialCursor.sequence;
  let streamedContent = "";
  let streamedReasoning = "";
  let userMessageId: string | null = null;
  let terminal = false;
  let failure: string | null = null;
  let lastPersistedAt = 0;
  let lastPersistedSequence = lastSequence;
  let lastPersistedUserMessageId: string | null = null;

  // Buffer state for performance
  let bufferedContent = "";
  let bufferedReasoning = "";
  let needsUpdate = false;
  let updateFrame: number | null = null;

  const flushUpdates = () => {
    if (!needsUpdate) return;
    onMessageDelta(bufferedContent);
    onReasoningDelta(bufferedReasoning);
    needsUpdate = false;
    updateFrame = null;
  };

  const scheduleUpdate = (content: string, reasoning: string) => {
    bufferedContent = content;
    bufferedReasoning = reasoning;
    needsUpdate = true;
    if (updateFrame === null) {
      updateFrame = window.requestAnimationFrame(flushUpdates);
    }
  };

  while (!terminal) {
    traceClientLog(logLevel, "events.fetch.begin", { session_id: sessionId, job_id: jobId, cursor });
    const controller = new AbortController();
    let stallTimer: number | null = null;
    let connectionTimer: number | null = null;
    const resetStallTimer = () => {
      if (stallTimer !== null) {
        window.clearTimeout(stallTimer);
      }
      stallTimer = window.setTimeout(() => controller.abort(), STREAM_EVENT_STALL_TIMEOUT_MS);
    };

    try {
      resetStallTimer();
      const response = await new Promise<Response>((resolve, reject) => {
        connectionTimer = window.setTimeout(() => {
          controller.abort();
          reject(new Error("Stream connection timed out."));
        }, STREAM_EVENT_CONNECTION_TIMEOUT_MS);
        void fetch(
          `${API_URL}/api/chat/stream/events?session_id=${encodeURIComponent(sessionId)}&job_id=${encodeURIComponent(jobId)}&cursor=${encodeURIComponent(cursor)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          },
        ).then((response) => {
          if (connectionTimer !== null) {
            window.clearTimeout(connectionTimer);
            connectionTimer = null;
          }
          resolve(response);
        }).catch((error) => {
          if (connectionTimer !== null) {
            window.clearTimeout(connectionTimer);
            connectionTimer = null;
          }
          reject(error);
        });
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      if (!response.body) {
        throw new Error("Empty response stream.");
      }
      traceClientLog(logLevel, "events.fetch.connected", { session_id: sessionId, job_id: jobId, cursor, status: response.status });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = "";
      const handleRawEvent = (rawEvent: string): boolean => {
        if (!rawEvent.trim()) {
          return false;
        }
        let parsed: unknown;
        try {
          parsed = parseSSEPayload(rawEvent);
        } catch (error) {
          console.error("Failed to parse SSE event", error);
          return false;
        }
        if (!parsed || typeof parsed !== "object") {
          return false;
        }
        const payload = parsed as Record<string, unknown>;
        const sequenceCandidateRaw = Number(payload.sequence);
        const cursorCandidateRaw = Number(payload.cursor);
        const sequenceRaw = Number.isFinite(sequenceCandidateRaw)
          ? sequenceCandidateRaw
          : cursorCandidateRaw;
        const sequence = Number.isFinite(sequenceRaw) ? Math.floor(sequenceRaw) : 0;
        if (sequence > 0) {
          if (sequence <= lastSequence) {
            return false;
          }
          lastSequence = sequence;
          cursor = String(sequence);
        }

        if (typeof payload.user_message_id === "string" && payload.user_message_id.trim()) {
          userMessageId = payload.user_message_id.trim();
        }
        if (sequence > 0) {
          const now = Date.now();
          const shouldPersist = (
            now - lastPersistedAt >= STREAM_INFLIGHT_PERSIST_MIN_INTERVAL_MS
            || sequence - lastPersistedSequence >= STREAM_INFLIGHT_PERSIST_MIN_SEQUENCE_DELTA
            || userMessageId !== lastPersistedUserMessageId
          );
          if (shouldPersist) {
            persistInflightStream(sessionId, {
              session_id: sessionId,
              job_id: jobId,
              cursor,
              user_message_id: userMessageId,
              created_at: now,
            });
            lastPersistedAt = now;
            lastPersistedSequence = sequence;
            lastPersistedUserMessageId = userMessageId;
          }
        }
        const type = typeof payload.type === "string" ? payload.type : "";
        traceClientLog(logLevel, "events.message", { session_id: sessionId, job_id: jobId, sequence, type });
        const eventPayload = (typeof payload.payload === "object" && payload.payload !== null)
          ? payload.payload as Record<string, unknown>
          : {};
        if (type === "content_delta") {
          const piece = typeof eventPayload.content_delta === "string" ? eventPayload.content_delta : "";
          if (piece) {
            streamedContent += piece;
            scheduleUpdate(streamedContent, streamedReasoning);
          }
        }
        if (type === "reasoning_delta") {
          const piece = typeof eventPayload.reasoning_delta === "string" ? eventPayload.reasoning_delta : "";
          if (piece) {
            streamedReasoning += piece;
            scheduleUpdate(streamedContent, streamedReasoning);
          }
        }
        if (type === "job_failed") {
          failure = typeof eventPayload.error === "string" ? eventPayload.error : "Streaming failed.";
          terminal = true;
          return true;
        }
        if (type === "job_completed") {
          terminal = true;
          traceClientLog(logLevel, "events.terminal_completed", { session_id: sessionId, job_id: jobId, sequence });
        }
        return terminal;
      };

      while (true) {
        let readResult: ReadableStreamReadResult<Uint8Array>;
        try {
          readResult = await reader.read();
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) {
            traceClientLog(logLevel, "events.fetch.stalled", { session_id: sessionId, job_id: jobId, cursor });
            return {
              content: streamedContent,
              reasoning: streamedReasoning,
              warning: "stream stalled",
              failure: null,
              userMessageId,
              cursor,
            };
          }
          throw error;
        }
        resetStallTimer();
        const { done, value } = readResult;
        streamBuffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        let nextEvent = readNextSSEEvent(streamBuffer);
        while (nextEvent) {
          streamBuffer = nextEvent.rest;
          if (handleRawEvent(nextEvent.event)) {
            break;
          }
          nextEvent = readNextSSEEvent(streamBuffer);
        }
        if (terminal) {
          break;
        }
        if (done) {
          if (handleRawEvent(streamBuffer)) {
            break;
          }
          streamBuffer = "";
          break;
        }
      }
    } catch (error) {
      if (!controller.signal.aborted && !isAbortError(error)) {
        throw error;
      }
      return {
        content: streamedContent,
        reasoning: streamedReasoning,
        warning: "stream stalled",
        failure: null,
        userMessageId,
        cursor,
      };
    } finally {
      if (connectionTimer !== null) {
        window.clearTimeout(connectionTimer);
      }
      if (stallTimer !== null) {
        window.clearTimeout(stallTimer);
      }
    }
  }
  traceClientLog(logLevel, "events.done", { session_id: sessionId, job_id: jobId, cursor, content_length: streamedContent.length });

  return {
    content: streamedContent,
    reasoning: streamedReasoning,
    warning: null,
    failure,
    userMessageId,
    cursor,
  };
};

const ensureToken = (token: string | null): string => {
  if (!token) {
    throw new Error("Authentication required.");
  }
  return token;
};

const replaceMessageId = (messages: Message[], currentId: string, nextId: string | null): Message[] => {
  if (!nextId || nextId === currentId) {
    return messages;
  }
  const targetIndex = messages.findIndex((message) => message.id === currentId);
  if (targetIndex < 0) {
    return messages;
  }
  const nextMessages = [...messages];
  nextMessages[targetIndex] = { ...nextMessages[targetIndex], id: nextId };
  return nextMessages;
};

export const useStore = create<Store>((set, get) => ({
  authReady: false,
  authLoading: false,
  authenticated: false,
  authMethod: null,
  token: null,
  previewMode: false,
  backendBuildHash: DEFAULT_BACKEND_BUILD_HASH,
  backendBuildTime: DEFAULT_BACKEND_BUILD_TIME,

  sessions: [],
  sessionsHasMore: false,
  sessionsLoadingMore: false,
  sessionId: null,
  messages: [],
  loadingMessages: false,
  sendingMessage: false,
  streamingMessage: "",
  streamingReasoning: "",
  streamRecovery: null,
  streamFailure: null,

  profile: null,
  usage: null,
  dailyUsage: null,
  dailyUsageDate: null,
  sessionUsage: ZERO_SESSION_USAGE,
  passkeys: [],
  models: [],
  selectedModel: DEFAULT_MODEL,
  titleModel: DEFAULT_MODEL,
  chatSettings: DEFAULT_CHAT_SETTINGS,
  logLevel: DEFAULT_LOG_LEVEL,
  systemPromptTimezone: "UTC",
  showArchivedSessions: false,
  workspaces: [],
  activeWorkspaceId: null,
  attachmentLibrary: [],
  attachmentLibraryLoading: false,
  libraryItems: [],
  libraryLoading: false,

  toasts: [],
  pushToast: (message, type = "info") => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    window.setTimeout(() => {
      get().dismissToast(id);
    }, 4200);
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },

  initialize: async () => {
    set({ authLoading: true });

    // Restore preview session (sessionStorage flag set by loginWithPreviewPassword)
    if (isPreviewAvailable() && sessionStorage.getItem(PREVIEW_MODE_STORAGE_KEY) === "1") {
      const mockSessions = buildPreviewSessions();
      const mockMessages = buildPreviewMessages();
      previewSessionMessages.clear();
      for (const [id, msgs] of Object.entries(mockMessages)) {
        previewSessionMessages.set(id, msgs);
      }
      set({
        authReady: true,
        authLoading: false,
        authenticated: true,
        authMethod: "preview",
        token: null,
        previewMode: true,
        backendBuildHash: "preview",
        backendBuildTime: "",
        profile: { ...PREVIEW_MOCK_PROFILE, updated_at: Date.now() },
        sessions: mockSessions,
        models: PREVIEW_MOCK_MODELS,
        usage: PREVIEW_MOCK_USAGE,
        dailyUsage: PREVIEW_MOCK_USAGE,
        dailyUsageDate: getCurrentUtcDate(),
        selectedModel: DEFAULT_MODEL,
        titleModel: DEFAULT_MODEL,
        chatSettings: DEFAULT_CHAT_SETTINGS,
        logLevel: DEFAULT_LOG_LEVEL,
        systemPromptTimezone: "UTC",
        showArchivedSessions: false,
        workspaces: [{ id: "default", name: "Default Workspace", archived_at: null, created_at: Date.now(), updated_at: Date.now() }],
        activeWorkspaceId: "default",
        passkeys: [],
        sessionUsage: ZERO_SESSION_USAGE,
        sessionId: null,
        messages: [],
        attachmentLibrary: [],
        attachmentLibraryLoading: false,
        libraryItems: [],
        libraryLoading: false,
        streamFailure: null,
      });
      return;
    }

    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!storedToken) {
      set({
        authReady: true,
        authLoading: false,
        authenticated: false,
        token: null,
        streamFailure: null,
      });
      return;
    }

    try {
      const me = await requestJson<{
        method: AuthMethod;
        profile: UserProfile;
        selected_model: string;
        title_model: string;
        chat_settings?: Partial<ChatGenerationSettings>;
        log_level?: LogLevel;
        system_prompt_timezone?: string;
        show_archived_sessions?: boolean;
        active_workspace_id?: string;
        backend_build_hash?: string;
        backend_build_time?: string;
      }>("/api/auth/me", { method: "GET", token: storedToken });

      set({
        token: storedToken,
        authenticated: true,
        authMethod: me.method,
        backendBuildHash: typeof me.backend_build_hash === "string" && me.backend_build_hash.trim()
          ? me.backend_build_hash.trim()
          : DEFAULT_BACKEND_BUILD_HASH,
        backendBuildTime: typeof me.backend_build_time === "string" ? me.backend_build_time.trim() : DEFAULT_BACKEND_BUILD_TIME,
        profile: me.profile,
        selectedModel: me.selected_model || DEFAULT_MODEL,
        titleModel: me.title_model || me.selected_model || DEFAULT_MODEL,
        chatSettings: normalizeChatSettings(me.chat_settings),
        logLevel: normalizeLogLevel(me.log_level),
        systemPromptTimezone: typeof me.system_prompt_timezone === "string" && me.system_prompt_timezone.trim() ? me.system_prompt_timezone : "UTC",
        showArchivedSessions: Boolean(me.show_archived_sessions),
        activeWorkspaceId: typeof me.active_workspace_id === "string" && me.active_workspace_id.trim() ? me.active_workspace_id : null,
      });

      await Promise.all([
        get().refreshWorkspaces(true),
        get().refreshSessions(),
        get().refreshUsage(),
        get().refreshSessionUsage(),
        get().refreshModels(),
        get().refreshPasskeys(),
      ]);
      warnBudget(get());
    } catch (error) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      set({
        token: null,
        authenticated: false,
        authMethod: null,
        backendBuildHash: DEFAULT_BACKEND_BUILD_HASH,
        backendBuildTime: DEFAULT_BACKEND_BUILD_TIME,
        sessions: [],
        sessionId: null,
        messages: [],
        streamingReasoning: "",
        profile: null,
        usage: null,
        dailyUsage: null,
        dailyUsageDate: null,
        sessionUsage: ZERO_SESSION_USAGE,
        titleModel: DEFAULT_MODEL,
        chatSettings: DEFAULT_CHAT_SETTINGS,
        logLevel: DEFAULT_LOG_LEVEL,
        systemPromptTimezone: "UTC",
        showArchivedSessions: false,
        workspaces: [],
        activeWorkspaceId: null,
        streamFailure: null,
      });
      console.error(error);
    } finally {
      set({ authReady: true, authLoading: false });
    }
  },

  loginWithPassword: async (password) => {
    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      throw new Error("Password is required.");
    }

    set({ authLoading: true });
    try {
      const data = await requestJson<{ token: string }>("/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmedPassword }),
      });

      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      set({
        token: data.token,
        authenticated: true,
        authMethod: "password",
        streamRecovery: null,
        streamFailure: null,
      });

      await Promise.all([
        get().refreshProfile(),
        get().refreshWorkspaces(true),
        get().refreshSessions(),
        get().refreshUsage(),
        get().refreshSessionUsage(),
        get().refreshModels(),
      ]);
      void get().refreshAttachmentLibrary().catch((error) => {
        console.error("Failed to refresh attachment library after password login", error);
      });
      void get().refreshLibrary().catch((error) => {
        console.error("Failed to refresh library after password login", error);
      });
      await get().refreshPasskeys();
      get().pushToast("Logged in with password.", "success");
    } catch (error) {
      const message = getErrorMessage(error);
      get().pushToast(message, "error");
      throw new Error(message);
    } finally {
      set({ authLoading: false });
    }
  },

  loginWithPasskey: async () => {
    set({ authLoading: true });
    try {
      const begin = await requestJson<{ options: Parameters<typeof startAuthentication>[0] }>(
        "/api/auth/passkeys/auth-options",
        { method: "POST" },
      );
      const passkeyResponse = await startAuthentication(begin.options);

      const finish = await requestJson<{ token: string }>("/api/auth/passkeys/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: passkeyResponse }),
      });

      localStorage.setItem(TOKEN_STORAGE_KEY, finish.token);
      set({
        token: finish.token,
        authenticated: true,
        authMethod: "passkey",
        streamRecovery: null,
        streamFailure: null,
      });

      await Promise.all([
        get().refreshProfile(),
        get().refreshWorkspaces(true),
        get().refreshSessions(),
        get().refreshUsage(),
        get().refreshSessionUsage(),
        get().refreshModels(),
      ]);
      void get().refreshAttachmentLibrary().catch((error) => {
        console.error("Failed to refresh attachment library after passkey login", error);
      });
      void get().refreshLibrary().catch((error) => {
        console.error("Failed to refresh library after passkey login", error);
      });
      await get().refreshPasskeys();
      get().pushToast("Logged in with passkey.", "success");
    } catch (error) {
      const message = getErrorMessage(error);
      get().pushToast(message, "error");
      throw new Error(message);
    } finally {
      set({ authLoading: false });
    }
  },

  loginWithPreviewPassword: () => {
    const mockSessions = buildPreviewSessions();
    const mockMessages = buildPreviewMessages();
    previewSessionMessages.clear();
    for (const [id, msgs] of Object.entries(mockMessages)) {
      previewSessionMessages.set(id, msgs);
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.setItem(PREVIEW_MODE_STORAGE_KEY, "1");
    set({
      authenticated: true,
      authMethod: "preview",
      token: null,
      previewMode: true,
      backendBuildHash: "preview",
      backendBuildTime: "",
      profile: { ...PREVIEW_MOCK_PROFILE, updated_at: Date.now() },
      sessions: mockSessions,
      models: PREVIEW_MOCK_MODELS,
      usage: PREVIEW_MOCK_USAGE,
      dailyUsage: PREVIEW_MOCK_USAGE,
      dailyUsageDate: getCurrentUtcDate(),
      selectedModel: DEFAULT_MODEL,
      titleModel: DEFAULT_MODEL,
      chatSettings: DEFAULT_CHAT_SETTINGS,
      logLevel: DEFAULT_LOG_LEVEL,
      systemPromptTimezone: "UTC",
      showArchivedSessions: false,
      workspaces: [{ id: "default", name: "Default Workspace", archived_at: null, created_at: Date.now(), updated_at: Date.now() }],
      activeWorkspaceId: "default",
      passkeys: [],
      sessionUsage: ZERO_SESSION_USAGE,
      sessionId: null,
      messages: [],
      attachmentLibrary: [],
      attachmentLibraryLoading: false,
      libraryItems: [],
      libraryLoading: false,
      streamRecovery: null,
      streamFailure: null,
    });
    get().pushToast("Logged in (preview mode — example data only).", "info");
  },

  logout: () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(PREVIEW_MODE_STORAGE_KEY);
    previewSessionMessages.clear();
    set({
      authenticated: false,
      authMethod: null,
      token: null,
      previewMode: false,
      backendBuildHash: DEFAULT_BACKEND_BUILD_HASH,
      backendBuildTime: DEFAULT_BACKEND_BUILD_TIME,
      sessions: [],
      sessionId: null,
      messages: [],
      streamingMessage: "",
      streamingReasoning: "",
      loadingMessages: false,
      sendingMessage: false,
      profile: null,
      usage: null,
      dailyUsage: null,
      dailyUsageDate: null,
      sessionUsage: ZERO_SESSION_USAGE,
      passkeys: [],
      models: [],
      selectedModel: DEFAULT_MODEL,
      titleModel: DEFAULT_MODEL,
      chatSettings: DEFAULT_CHAT_SETTINGS,
      logLevel: DEFAULT_LOG_LEVEL,
      systemPromptTimezone: "UTC",
      showArchivedSessions: false,
      workspaces: [],
      activeWorkspaceId: null,
      attachmentLibrary: [],
      attachmentLibraryLoading: false,
      libraryItems: [],
      libraryLoading: false,
      streamRecovery: null,
      streamFailure: null,
    });
  },

  refreshSessions: async () => {
    if (get().previewMode) {
      return; // Sessions are managed locally in preview mode
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
        sessionUsage: ZERO_SESSION_USAGE,
        streamRecovery: null,
        streamFailure: null,
      });
      return;
    }
    const token = ensureToken(get().token);
    set({
      sessionId,
      loadingMessages: true,
      streamingMessage: "",
      streamingReasoning: "",
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
        const tokenForResume = ensureToken(get().token);
        set({ sendingMessage: true, streamingMessage: "", streamingReasoning: "", streamFailure: null });
        try {
          const resumeCursor = normalizeCursorSequence(inflight.cursor);
          const streamResult = await consumeChatStream(
            tokenForResume,
            sessionId,
            inflight.job_id,
            resumeCursor.cursor,
            get().logLevel,
            (nextContent) => set({ streamingMessage: nextContent }),
            (nextReasoning) => set({ streamingReasoning: nextReasoning }),
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
            const refreshedMessages = await fetchSessionMessages(tokenForResume, sessionId);
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

    // Preview mode: simulate streaming locally, no backend calls
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
      set((state) => ({ sendingMessage: true, streamingMessage: "", streamingReasoning: "", streamFailure: null, streamRecovery: null, messages: [...state.messages, userMessage] }));
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
        token,
        sessionId,
        jobId,
        streamCursor,
        get().logLevel,
        (nextContent) => set({ streamingMessage: nextContent }),
        (nextReasoning) => set({ streamingReasoning: nextReasoning }),
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
        streamFailure: null,
        sendingMessage: false, // Set sendingMessage to false atomically with messages update
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
      set({ streamingMessage: "", streamingReasoning: "", streamFailure: null, streamRecovery: null, sendingMessage: false });
      throw error;
    } finally {
      // sendingMessage is now handled in successful set or catch set
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

    set({
      sendingMessage: true,
      streamingMessage: "",
      streamingReasoning: "",
      streamFailure: null,
      streamRecovery: null,
      messages,
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
        token,
        sessionId,
        submit.job_id,
        normalizedSubmitCursor.cursor,
        get().logLevel,
        (nextContent) => set({ streamingMessage: nextContent }),
        (nextReasoning) => set({ streamingReasoning: nextReasoning }),
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

      set((state) => ({
        messages: [
          ...replaceMessageId(state.messages, sourceUserMessage.id, persistedUserMessageId),
          assistantMessage,
        ],
        streamingMessage: "",
        streamingReasoning: "",
        streamFailure: null,
      }));

      await get().refreshUsage();
      await get().refreshSessionUsage(sessionId);
      if (streamResult.warning) {
        get().pushToast(streamResult.warning, "info");
      }
    } catch (error) {
      persistInflightStream(sessionId, null);
      get().pushToast(`Failed to regenerate message: ${getErrorMessage(error)}`, "error");
      set({ streamingMessage: "", streamingReasoning: "", streamFailure: null, streamRecovery: null });
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
    const token = ensureToken(get().token);
    set({
      sendingMessage: true,
      streamRecovery: { ...recovery, mode: "reconnecting", last_error: null },
      streamingMessage: "",
      streamingReasoning: "",
      streamFailure: null,
    });
    try {
      const streamResult = await consumeChatStream(
        token,
        recovery.session_id,
        recovery.job_id,
        normalizeCursorSequence(recovery.cursor).cursor,
        get().logLevel,
        (nextContent) => set({ streamingMessage: nextContent }),
        (nextReasoning) => set({ streamingReasoning: nextReasoning }),
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
      const refreshedMessages = await fetchSessionMessages(token, recovery.session_id);
      set({
        messages: refreshedMessages,
        streamingMessage: "",
        streamingReasoning: "",
        streamRecovery: null,
        streamFailure: null,
      });
      await get().refreshSessions();
      await get().refreshSessionUsage(recovery.session_id);
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
    const token = ensureToken(get().token);
    set({
      sendingMessage: true,
      streamRecovery: { ...recovery, mode: "waiting", last_error: null },
      streamingMessage: "",
      streamingReasoning: "",
      streamFailure: null,
    });
    try {
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

  refreshProfile: async () => {
    if (get().previewMode) {
      return; // Profile already set from mock data
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ profile: UserProfile }>("/api/profile", { method: "GET", token });
    set({ profile: data.profile });
  },

  updateProfile: async (payload) => {
    if (get().previewMode) {
      set((state) => ({ profile: state.profile ? { ...state.profile, ...payload } : null }));
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ profile: UserProfile }>("/api/profile", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    set({ profile: data.profile });
  },

  uploadAvatar: async (file) => {
    if (get().previewMode) {
      get().pushToast("Avatar upload is not available in preview mode.", "error");
      throw new Error("Not available in preview mode.");
    }
    const token = ensureToken(get().token);
    const squareAvatar = await cropImageToSquare(file);
    const mimeType = squareAvatar.type || "application/octet-stream";
    const presign = await requestJson<{
      upload_url: string;
      object_key: string;
    }>("/api/profile/avatar/presign", {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: squareAvatar.name,
        mimeType,
      }),
    });

    const upload = await uploadFileWithRetry(presign.upload_url, squareAvatar, mimeType, token);
    if (!upload.ok) {
      throw new Error(`Avatar upload failed: ${upload.statusText}`);
    }

    await get().updateProfile({ avatar_key: presign.object_key });
    get().pushToast("Avatar updated.", "success");
  },

  refreshUsage: async () => {
    if (get().previewMode) {
      return; // Usage already set from mock data
    }
    const token = ensureToken(get().token);
    const dateUtc = getCurrentUtcDate();
    const [allData, dailyData] = await Promise.allSettled([
      requestJson<{ summary: UsageSummary }>("/api/stats/usage", {
        method: "GET",
        token,
      }),
      requestJson<{ summary: UsageSummary }>(`/api/stats/usage?date_utc=${encodeURIComponent(dateUtc)}`, {
        method: "GET",
        token,
      }),
    ]);
    const next: {
      usage?: UsageSummary;
      dailyUsage?: UsageSummary | null;
      dailyUsageDate?: string | null;
    } = {};

    let hasSuccess = false;
    if (allData.status === "fulfilled") {
      next.usage = allData.value.summary;
      hasSuccess = true;
    }
    if (dailyData.status === "fulfilled") {
      next.dailyUsage = dailyData.value.summary;
      next.dailyUsageDate = dateUtc;
      hasSuccess = true;
    } else {
      next.dailyUsage = null;
      next.dailyUsageDate = dateUtc;
    }

    if (hasSuccess) {
      set(next);
      return;
    }

    console.error("Failed to refresh usage summaries", {
      all_error: allData.status === "rejected" ? allData.reason : null,
      daily_error: dailyData.status === "rejected" ? dailyData.reason : null,
    });
  },

  syncUsageAggregate: async () => {
    if (get().previewMode) {
      return;
    }
    const token = ensureToken(get().token);
    try {
      const data = await requestJson<{ profile: UserProfile }>("/api/settings/usage/sync", {
        method: "PUT",
        token,
      });
      set({ profile: data.profile });
      await get().refreshUsage();
      get().pushToast("Usage statistics recalculated and synchronized.", "success");
    } catch (error) {
      get().pushToast(`Sync failed: ${getErrorMessage(error)}`, "error");
    }
  },

  refreshSessionUsage: async (sessionId) => {
    if (get().previewMode) {
      return; // Session usage is managed locally in preview mode
    }
    const activeSessionId = sessionId ?? get().sessionId;
    if (!activeSessionId) {
      set({ sessionUsage: ZERO_SESSION_USAGE });
      return;
    }

    const token = ensureToken(get().token);
    const data = await requestJson<{ summary: UsageSummary }>(
      `/api/stats/usage?session_id=${encodeURIComponent(activeSessionId)}`,
      {
        method: "GET",
        token,
      },
    );
    set({
      sessionUsage: {
        total_tokens: Number(data.summary?.total_tokens ?? 0),
        total_cost_usd: Number(data.summary?.total_cost_usd ?? 0),
      },
    });
  },

  refreshModels: async () => {
    if (get().previewMode) {
      return; // Models already set from mock data
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{
      models: ModelOption[];
      selected_model: string;
      title_model: string;
        chat_settings?: Partial<ChatGenerationSettings>;
        log_level?: LogLevel;
        system_prompt_timezone?: string;
        show_archived_sessions?: boolean;
        active_workspace_id?: string;
        backend_build_hash?: string;
        backend_build_time?: string;
      }>("/api/models", { method: "GET", token });
    set({
      models: data.models || [],
      selectedModel: data.selected_model || DEFAULT_MODEL,
      titleModel: data.title_model || data.selected_model || DEFAULT_MODEL,
      chatSettings: normalizeChatSettings(data.chat_settings),
      logLevel: normalizeLogLevel(data.log_level),
      systemPromptTimezone:
        typeof data.system_prompt_timezone === "string" && data.system_prompt_timezone.trim() ? data.system_prompt_timezone : "UTC",
      showArchivedSessions: Boolean(data.show_archived_sessions),
      activeWorkspaceId:
        typeof data.active_workspace_id === "string" && data.active_workspace_id.trim() ? data.active_workspace_id : get().activeWorkspaceId,
      backendBuildHash: typeof data.backend_build_hash === "string" && data.backend_build_hash.trim()
        ? data.backend_build_hash.trim()
        : get().backendBuildHash,
      backendBuildTime: typeof data.backend_build_time === "string" ? data.backend_build_time.trim() : get().backendBuildTime,
    });
  },

  setSelectedModel: async (model) => {
    const trimmed = model.trim();
    if (!trimmed) {
      throw new Error("Model is required.");
    }
    if (get().previewMode) {
      set({ selectedModel: trimmed });
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ selected_model: string }>("/api/settings/model", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: trimmed }),
    });
    set({ selectedModel: data.selected_model });
  },

  setTitleModel: async (model) => {
    const trimmed = model.trim();
    if (!trimmed) {
      throw new Error("Model is required.");
    }
    if (get().previewMode) {
      set({ titleModel: trimmed });
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ title_model: string }>("/api/settings/title-model", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: trimmed }),
    });
    set({ titleModel: data.title_model });
  },

  setChatSettings: async (payload) => {
    if (get().previewMode) {
      set((state) => ({ chatSettings: normalizeChatSettings({ ...state.chatSettings, ...payload }) }));
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ chat_settings: ChatGenerationSettings }>("/api/settings/chat", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    set({ chatSettings: normalizeChatSettings(data.chat_settings) });
  },

  setLogLevel: async (level) => {
    if (get().previewMode) {
      set({ logLevel: normalizeLogLevel(level) });
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ log_level: LogLevel }>("/api/settings/log-level", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log_level: level }),
    });
    set({ logLevel: normalizeLogLevel(data.log_level) });
  },

  setSystemPromptTimezone: async (timezone) => {
    const trimmed = timezone.trim();
    if (!trimmed) {
      throw new Error("Timezone is required.");
    }
    if (get().previewMode) {
      set({ systemPromptTimezone: trimmed });
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ system_prompt_timezone: string }>("/api/settings/system-prompt-timezone", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: trimmed }),
    });
    set({ systemPromptTimezone: data.system_prompt_timezone });
  },

  setShowArchivedSessions: async (show) => {
    if (get().previewMode) {
      set({ showArchivedSessions: show });
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ show_archived_sessions: boolean }>("/api/settings/show-archived-sessions", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_archived_sessions: show }),
    });
    set({ showArchivedSessions: Boolean(data.show_archived_sessions) });
    await get().refreshSessions();
  },

  refreshWorkspaces: async (includeArchived = true) => {
    if (get().previewMode) {
      return;
    }
    const token = ensureToken(get().token);
    const includeArchivedFlag = includeArchived ? "1" : "0";
    const data = await requestJson<{ workspaces: Workspace[]; active_workspace_id: string }>(
      `/api/workspaces?include_archived=${includeArchivedFlag}`,
      {
        method: "GET",
        token,
      },
    );
    set({
      workspaces: data.workspaces ?? [],
      activeWorkspaceId: data.active_workspace_id || null,
    });
  },

  createWorkspace: async (name) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new Error("Workspace name is required.");
    }
    if (get().previewMode) {
      const now = Date.now();
      const id = crypto.randomUUID();
      set((state) => ({
        workspaces: [{ id, name: normalizedName, archived_at: null, created_at: now, updated_at: now }, ...state.workspaces],
      }));
      return;
    }
    const token = ensureToken(get().token);
    await requestJson<{ workspace: Workspace }>("/api/workspaces", {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: normalizedName }),
    });
    await get().refreshWorkspaces(true);
  },

  renameWorkspace: async (workspaceId, name) => {
    const normalizedName = name.trim();
    if (!workspaceId.trim()) {
      throw new Error("Workspace id is required.");
    }
    if (!normalizedName) {
      throw new Error("Workspace name is required.");
    }
    if (get().previewMode) {
      set((state) => ({
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === workspaceId ? { ...workspace, name: normalizedName, updated_at: Date.now() } : workspace,
        ),
      }));
      return;
    }
    const token = ensureToken(get().token);
    await requestJson<{ success: boolean }>(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: normalizedName }),
    });
    await get().refreshWorkspaces(true);
  },

  archiveWorkspace: async (workspaceId, archived = true) => {
    if (!workspaceId.trim()) {
      throw new Error("Workspace id is required.");
    }
    if (get().previewMode) {
      set((state) => ({
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === workspaceId ? { ...workspace, archived_at: archived ? Date.now() : null, updated_at: Date.now() } : workspace,
        ),
      }));
      return;
    }
    const token = ensureToken(get().token);
    await requestJson<{ success: boolean }>(`/api/workspaces/${encodeURIComponent(workspaceId)}/archive`, {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    await get().refreshWorkspaces(true);
    await get().refreshSessions();
  },

  activateWorkspace: async (workspaceId) => {
    if (!workspaceId.trim()) {
      throw new Error("Workspace id is required.");
    }
    if (get().previewMode) {
      set({
        activeWorkspaceId: workspaceId,
        sessions: [],
        sessionId: null,
        messages: [],
        sessionUsage: ZERO_SESSION_USAGE,
      });
      return;
    }
    const token = ensureToken(get().token);
    await requestJson<{ success: boolean; active_workspace_id: string }>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/activate`,
      {
        method: "PUT",
        token,
      },
    );
    get().clearSession();
    await get().refreshWorkspaces(true);
    await get().refreshSessions();
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

  refreshPasskeys: async () => {
    if (get().previewMode) {
      set({ passkeys: [] });
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ passkeys: PasskeyInfo[] }>("/api/auth/passkeys", { method: "GET", token });
    set({ passkeys: data.passkeys || [] });
  },

  registerPasskey: async (nickname) => {
    if (get().previewMode) {
      throw new Error("Passkey management is not available in preview mode.");
    }
    const token = ensureToken(get().token);
    const begin = await requestJson<{ options: Parameters<typeof startRegistration>[0] }>(
      "/api/auth/passkeys/register-options",
      { method: "POST", token },
    );

    const passkeyResponse = await startRegistration(begin.options);
    await requestJson<{ success: boolean }>("/api/auth/passkeys/register-verify", {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response: passkeyResponse,
        nickname: nickname?.trim() || undefined,
      }),
    });

    await get().refreshPasskeys();
    get().pushToast("Passkey registered.", "success");
  },

  removePasskey: async (credentialId) => {
    if (get().previewMode) {
      throw new Error("Passkey management is not available in preview mode.");
    }
    const token = ensureToken(get().token);
    await requestJson<{ success: boolean }>(`/api/auth/passkeys/${encodeURIComponent(credentialId)}`, {
      method: "DELETE",
      token,
    });
    await get().refreshPasskeys();
    get().pushToast("Passkey removed.", "success");
  },

  refreshAttachmentLibrary: async () => {
    if (get().previewMode) {
      set({ attachmentLibrary: [], attachmentLibraryLoading: false });
      return;
    }
    const token = ensureToken(get().token);
    set({ attachmentLibraryLoading: true });
    try {
      const data = await requestJson<{
        attachments: Array<{
          id: string;
          file_name: string;
          mime_type: string;
          size: number;
          access_url: string;
          created_at: number;
          type?: MessageAttachmentType;
        }>;
      }>("/api/attachments", { method: "GET", token });
      const items: AttachmentLibraryItem[] = (data.attachments ?? []).map((item) => ({
        id: item.id,
        file_name: item.file_name,
        mime_type: item.mime_type,
        size: Number(item.size) || 0,
        url: item.access_url,
        type: item.type ?? resolveAttachmentType(item.mime_type || "application/octet-stream"),
        created_at: Number(item.created_at) || 0,
      }));
      set({ attachmentLibrary: items });
    } finally {
      set({ attachmentLibraryLoading: false });
    }
  },

  deleteAttachment: async (attachmentId) => {
    if (get().previewMode) {
      throw new Error("Attachment library is not available in preview mode.");
    }
    const token = ensureToken(get().token);
    await requestJson<{ success: boolean }>(`/api/attachments/${encodeURIComponent(attachmentId)}`, {
      method: "DELETE",
      token,
    });
    set((state) => ({
      attachmentLibrary: state.attachmentLibrary.filter((item) => item.id !== attachmentId),
      messages: state.messages.map((message) => ({
        ...message,
        attachments: (message.attachments ?? []).filter((attachment) => attachment.id !== attachmentId),
      })),
    }));
  },

  refreshLibrary: async () => {
    if (get().previewMode) {
      set({ libraryItems: [], libraryLoading: false });
      return;
    }
    const token = ensureToken(get().token);
    set({ libraryLoading: true });
    try {
      const pageSize = 100;
      const dedup = new Map<string, LibraryItem>();
      let cursor: string | null = null;

      while (true) {
        const params = new URLSearchParams({ limit: String(pageSize) });
        if (cursor) {
          params.set("cursor", cursor);
        }
        const data = await requestJson<{
          files: Array<{
            id: string;
            file_name: string;
            mime_type: string;
            size: number;
            access_url: string;
            created_at: number;
            type?: MessageAttachmentType;
          }>;
          pagination?: {
            next_cursor?: string | null;
          };
        }>(`/api/library?${params.toString()}`, { method: "GET", token });

        for (const item of data.files ?? []) {
          dedup.set(item.id, {
            id: item.id,
            file_name: item.file_name,
            mime_type: item.mime_type,
            size: Number(item.size) || 0,
            url: item.access_url,
            type: item.type ?? resolveAttachmentType(item.mime_type || "application/octet-stream"),
            created_at: Number(item.created_at) || 0,
          });
        }

        const nextCursor = data.pagination?.next_cursor?.trim() || null;
        if (!nextCursor || nextCursor === cursor) {
          break;
        }
        cursor = nextCursor;
      }
      const items = Array.from(dedup.values());
      set({ libraryItems: items });
    } finally {
      set({ libraryLoading: false });
    }
  },

  uploadLibraryFile: async (file) => {
    if (get().previewMode) {
      throw new Error("Library is not available in preview mode.");
    }
    const token = ensureToken(get().token);
    const processedFile = await convertImageToSdrIfPossible(file);
    const mimeType = processedFile.type || file.type || "application/octet-stream";

    const presign = await requestJson<{
      id: string;
      upload_url: string;
      objectKey: string;
    }>(
      `/api/library/presign?fileName=${encodeURIComponent(processedFile.name)}&mimeType=${encodeURIComponent(mimeType)}`,
      {
        method: "GET",
        token,
        cache: "no-store",
      },
    );

    const upload = await uploadFileWithRetry(presign.upload_url, processedFile, mimeType, token);
    if (!upload.ok) {
      throw new Error(`Library upload failed: ${await parseApiError(upload)}`);
    }

    const metadata = await requestJson<{
      id: string;
      access_url: string;
    }>("/api/library", {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: presign.id,
        file_name: processedFile.name,
        mime_type: mimeType,
        size: processedFile.size,
        object_key: presign.objectKey,
      }),
    });

    if (!metadata.access_url || !metadata.id) {
      throw new Error("Library file URL is missing.");
    }
    return {
      id: metadata.id,
      file_name: processedFile.name,
      mime_type: mimeType,
      size: processedFile.size,
      url: metadata.access_url,
      type: resolveAttachmentType(mimeType),
      created_at: Date.now(),
    };
  },

  deleteLibraryItem: async (fileId) => {
    if (get().previewMode) {
      throw new Error("Library is not available in preview mode.");
    }
    const token = ensureToken(get().token);
    await requestJson<{ success: boolean }>(`/api/library/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      token,
    });
    set((state) => ({
      libraryItems: state.libraryItems.filter((item) => item.id !== fileId),
      messages: state.messages.map((message) => ({
        ...message,
        attachments: (message.attachments ?? []).filter((attachment) => attachment.id !== fileId),
      })),
    }));
  },

  uploadAttachment: async (file, onProgress) => {
    if (get().previewMode) {
      throw new Error("File attachments are not available in preview mode.");
    }
    const token = ensureToken(get().token);
    const processedFile = await convertImageToSdrIfPossible(file);
    const mimeType = processedFile.type || file.type || "application/octet-stream";

    onProgress?.(0);
    const fileHash = await hashFileSha256(processedFile);

    const check = await requestJson<{
      exists: boolean;
      data?: {
        id: string;
        file_name: string;
        mime_type: string;
        size: number;
        access_url?: string;
      };
    }>(`/api/attachments/check?hash=${encodeURIComponent(fileHash)}`, {
      method: "GET",
      token,
    });

    if (check.exists && check.data?.access_url && check.data.id) {
      const normalizedSize = Number(check.data.size);
      onProgress?.(100);
      return {
        id: check.data.id,
        file_name: check.data.file_name || processedFile.name,
        mime_type: check.data.mime_type || mimeType,
        size: Number.isFinite(normalizedSize) && normalizedSize > 0 ? normalizedSize : processedFile.size,
        url: check.data.access_url,
        type: resolveAttachmentType(check.data.mime_type || mimeType),
      };
    }

    const presign = await requestJson<{
      id: string;
      upload_url: string;
      objectKey: string;
      publicUrl?: string;
    }>(
      `/api/attachments/presign?fileName=${encodeURIComponent(processedFile.name)}&mimeType=${encodeURIComponent(mimeType)}&conversationId=${encodeURIComponent(get().sessionId ?? "draft")}`,
      {
        method: "GET",
        token,
        cache: "no-store",
      },
    );

    const upload = await uploadFileWithRetry(presign.upload_url, processedFile, mimeType, token, onProgress);
    if (!upload.ok) {
      throw new Error(`Attachment upload failed: ${await parseApiError(upload)}`);
    }

    onProgress?.(100);
    const metadata = await requestJson<{
      id: string;
      access_url: string;
    }>("/api/attachments", {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: presign.id,
        file_hash: fileHash,
        file_name: processedFile.name,
        mime_type: mimeType,
        size: processedFile.size,
        object_key: presign.objectKey,
        conversation_id: get().sessionId ?? "draft",
      }),
    });
    if (!metadata.access_url || !metadata.id) {
      throw new Error("Attachment URL is missing.");
    }
    return {
      id: metadata.id,
      file_name: processedFile.name,
      mime_type: mimeType,
      size: processedFile.size,
      url: metadata.access_url,
      type: resolveAttachmentType(mimeType),
    };
  },
}));
