import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { SYSTEM_PROMPT_TIMEZONE_OPTIONS, type AiProvider, type AiModel, type ChatGenerationSettings, type LogLevel, type ModelOption, type ReasoningEffort, type ServiceTier, type UsageSummary, type UserProfile, type Workspace, type UserLimitsStatus } from "@arona-chat/shared";
import type { AdminUser } from "../store/useStore";
import { BarChart2, Bot, UserRound, X, Settings2, ShieldCheck, ShieldAlert, Plus, Trash2, Edit2, Search, Palette, FolderOpen, LogOut } from "lucide-react";

type SettingsTab = "profile" | "appearance" | "model" | "usage" | "providers" | "users" | "advanced";

type ProfileUpdatePayload = {
  username?: string;
  avatar_key?: string | null;
  dynamic_background?: boolean;
  theme?: "standard" | "ethereal-light";
  arona_bubble_style?: "none" | "border";
  ethereal_streaming_style?: "typewriter" | "buffered";
  send_shortcut?: "ctrl_enter" | "enter";
  conversation_library_enabled?: boolean;
};

type SettingsPanelProps = {
  open: boolean;
  backendBuildHash: string;
  backendBuildTime: string;
  instanceId: string;
  schemaVersion: number;
  profile: UserProfile | null;
  usage: UsageSummary | null;
  dailyUsage: UsageSummary | null;
  dailyUsageDate: string | null;
  userLimits: UserLimitsStatus | null;
  models: ModelOption[];
  selectedModel: string;
  titleModel: string;
  chatSettings: ChatGenerationSettings;
  logLevel: LogLevel;
  systemPromptTimezone: string;
  showArchivedSessions: boolean;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  loading: boolean;
  onClose: () => void;
  onSaveProfile: (payload: ProfileUpdatePayload) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  onSetModel: (model: string) => Promise<void>;
  onSetTitleModel: (model: string) => Promise<void>;
  onSaveChatSettings: (payload: Partial<ChatGenerationSettings>) => Promise<void>;
  onSetLogLevel: (level: LogLevel) => Promise<void>;
  onSetSystemPromptTimezone: (timezone: string) => Promise<void>;
  onSetShowArchivedSessions: (show: boolean) => Promise<void>;
  onCreateWorkspace: (name: string) => Promise<void>;
  onRenameWorkspace: (workspaceId: string, name: string) => Promise<void>;
  onArchiveWorkspace: (workspaceId: string, archived?: boolean) => Promise<void>;
  onActivateWorkspace: (workspaceId: string) => Promise<void>;
  onSyncUsage: () => Promise<void>;
  aiProviders: AiProvider[];
  aiProvidersLoading: boolean;
  aiModels: AiModel[];
  aiModelsLoading: boolean;
  encryptionKeyReady: boolean;
  isAdmin: boolean;
  canManageAi: boolean;
  limitsEnabled: boolean;
  adminUsers: AdminUser[];
  adminUsersLoading: boolean;
  onCreateAiProvider: (payload: { name: string; endpoint: string; api_key: string; visibility?: string }) => Promise<void>;
  onUpdateAiProvider: (id: string, payload: { name?: string; endpoint?: string; api_key?: string; visibility?: string }) => Promise<void>;
  onDeleteAiProvider: (id: string) => Promise<void>;
  onCreateAiModel: (payload: { provider_id: string; model_id: string; name: string; input_usd_per_million?: number; output_usd_per_million?: number }) => Promise<void>;
  onUpdateAiModel: (id: string, payload: Partial<AiModel>) => Promise<void>;
  onDeleteAiModel: (id: string) => Promise<void>;
  onFetchUpstreamModels: () => Promise<{ data: { id: string; name: string; pricing?: { prompt?: number; input?: number; completion?: number; output?: number } }[] }>;
  onRefreshAdminUsers: () => Promise<void>;
  onUpdateUserPermissions: (userId: string, payload: { can_manage_ai?: boolean; can_view_all_users?: boolean }) => Promise<void>;
  onUpdateUserBudget: (userId: string, payload: { daily_budget_enabled?: boolean; daily_budget_usd?: number }) => Promise<void>;
  onOpenAttachments?: () => void;
  onOpenLibrary?: () => void;
  onLogout?: () => Promise<void>;
};

const formatUsd = (value: number): string => `$${value.toFixed(6)}`;
const getCurrentUtcDate = (): string => new Date().toISOString().slice(0, 10);
const buildHash = import.meta.env.VITE_BUILD_HASH?.trim() || "unknown";
const buildTimeRaw = import.meta.env.VITE_BUILD_TIME?.trim() || "";
const formatBuildTime = (timeRaw: string): string => {
  if (!timeRaw) {
    return "unknown";
  }
  const parsed = new Date(timeRaw);
  const timestamp = parsed.getTime();
  return Number.isFinite(timestamp) ? parsed.toLocaleString() : timeRaw;
};
const buildTime = formatBuildTime(buildTimeRaw);

export const SettingsPanel = ({
  open,
  backendBuildHash,
  backendBuildTime,
  instanceId,
  schemaVersion,
  profile,
  usage,
  dailyUsage,
  dailyUsageDate,
  userLimits,
  models,
  selectedModel,
  titleModel,
  chatSettings,
  logLevel,
  systemPromptTimezone,
  showArchivedSessions,
  workspaces,
  activeWorkspaceId,
  loading,
  onClose,
  onSaveProfile,
  onUploadAvatar,
  onSetModel,
  onSetTitleModel,
  onSaveChatSettings,
  onSetLogLevel,
  onSetSystemPromptTimezone,
  onSetShowArchivedSessions,
  onCreateWorkspace,
  onRenameWorkspace,
  onArchiveWorkspace,
  onActivateWorkspace,
  onSyncUsage,
  aiProviders,
  aiModels,
  encryptionKeyReady,
  isAdmin,
  canManageAi,
  limitsEnabled,
  adminUsers,
  adminUsersLoading,
  onCreateAiProvider,
  onUpdateAiProvider,
  onDeleteAiProvider,
  onCreateAiModel,
  onUpdateAiModel,
  onDeleteAiModel,
  onFetchUpstreamModels,
  onRefreshAdminUsers,
  onUpdateUserPermissions,
  onUpdateUserBudget,
  onOpenAttachments,
  onOpenLibrary,
  onLogout,
}: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const lastRequestRef = useRef<Record<string, {
    payload: string;
    timestamp: number;
    pending: boolean;
    failed: boolean;
  }>>({});

  const handleSaveWithDeduplication = async (
    key: string,
    currentPayload: any,
    saveFn: () => Promise<void>
  ) => {
    const now = Date.now();
    const lastRequest = lastRequestRef.current[key];
    const payloadStr = JSON.stringify(currentPayload);

    if (lastRequest) {
      const isPayloadSame = lastRequest.payload === payloadStr;
      const elapsed = now - lastRequest.timestamp;
      const isPending = lastRequest.pending;
      const isFailed = lastRequest.failed;

      if (isPayloadSame && isPending && elapsed < 5000 && !isFailed) {
        console.warn(`Duplicate click for ${key} ignored.`);
        return;
      }
    }

    lastRequestRef.current[key] = {
      payload: payloadStr,
      timestamp: now,
      pending: true,
      failed: false
    };

    try {
      await saveFn();
      if (lastRequestRef.current[key]) {
        lastRequestRef.current[key].pending = false;
        lastRequestRef.current[key].failed = false;
      }
    } catch (error) {
      if (lastRequestRef.current[key]) {
        lastRequestRef.current[key].pending = false;
        lastRequestRef.current[key].failed = true;
      }
      throw error;
    }
  };

  const [username, setUsername] = useState(profile?.username ?? "");
  const [dynamicBackground, setDynamicBackground] = useState(profile?.dynamic_background ?? true);
  const [sendShortcut, setSendShortcut] = useState<"ctrl_enter" | "enter">(profile?.send_shortcut ?? "ctrl_enter");
  const [conversationLibraryEnabled, setConversationLibraryEnabled] = useState(profile?.conversation_library_enabled ?? true);
  const [model, setModel] = useState(selectedModel);
  const [titleModelOption, setTitleModelOption] = useState(titleModel);
  const [serviceTier, setServiceTier] = useState<ServiceTier>(chatSettings.service_tier);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(chatSettings.reasoning_effort);
  const [maxOutputTokens, setMaxOutputTokens] = useState(String(chatSettings.max_output_tokens));
  const [dailyBudgetUsd, setDailyBudgetUsd] = useState(String(chatSettings.daily_budget_usd));
  const [temporaryDailyBudgetUsd, setTemporaryDailyBudgetUsd] = useState(chatSettings.temporary_daily_budget_usd === null ? "" : String(chatSettings.temporary_daily_budget_usd));
  const [dailyBudgetEnabled, setDailyBudgetEnabled] = useState(chatSettings.daily_budget_enabled ?? true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(chatSettings.web_search_enabled);
  const [webSearchMaxResults, setWebSearchMaxResults] = useState(String(chatSettings.web_search_max_results));
  const [attachmentMode, setAttachmentMode] = useState<"url" | "base64">(chatSettings.attachment_mode || "url");
  const [disableMaxOutputTokens, setDisableMaxOutputTokens] = useState(chatSettings.disable_max_output_tokens ?? false);
  const [logLevelOption, setLogLevelOption] = useState<LogLevel>(logLevel);
  const [timezoneOption, setTimezoneOption] = useState(systemPromptTimezone);
  const [showArchivedOption, setShowArchivedOption] = useState(showArchivedSessions);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  const [providerForm, setProviderForm] = useState<{ name: string; endpoint: string; api_key: string; visibility?: string }>({ name: "", endpoint: "", api_key: "" });
  const [editingProviderId, setProviderId] = useState<string | null>(null);
  const [modelForm, setModelForm] = useState({ provider_id: "", model_id: "", name: "", input: "0", output: "0" });
  const [upstreamModels, setUpstreamModels] = useState<{ id: string; name: string; pricing?: { prompt?: number; input?: number; completion?: number; output?: number } }[]>([]);
  const [modelSearch, setUpstreamSearch] = useState("");
  const [isQuickAdd, setIsQuickAdd] = useState(false);

  useEffect(() => {
    setUsername(profile?.username ?? "");
    setDynamicBackground(profile?.dynamic_background ?? true);
    setSendShortcut(profile?.send_shortcut ?? "ctrl_enter");
    setConversationLibraryEnabled(profile?.conversation_library_enabled ?? true);
  }, [profile?.username, profile?.dynamic_background, profile?.send_shortcut, profile?.conversation_library_enabled]);

  useEffect(() => {
    setModel(selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    setTitleModelOption(titleModel);
  }, [titleModel]);

  useEffect(() => {
    setServiceTier(chatSettings.service_tier);
    setReasoningEffort(chatSettings.reasoning_effort);
    setMaxOutputTokens(String(chatSettings.max_output_tokens));
    setDailyBudgetUsd(String(chatSettings.daily_budget_usd));
    setTemporaryDailyBudgetUsd(chatSettings.temporary_daily_budget_usd === null ? "" : String(chatSettings.temporary_daily_budget_usd));
    setDailyBudgetEnabled(chatSettings.daily_budget_enabled ?? true);
    setWebSearchEnabled(chatSettings.web_search_enabled);
    setWebSearchMaxResults(String(chatSettings.web_search_max_results));
    setAttachmentMode(chatSettings.attachment_mode || "url");
    setDisableMaxOutputTokens(chatSettings.disable_max_output_tokens ?? false);
  }, [chatSettings]);

  useEffect(() => {
    setLogLevelOption(logLevel);
  }, [logLevel]);

  useEffect(() => {
    setTimezoneOption(systemPromptTimezone);
  }, [systemPromptTimezone]);

  useEffect(() => {
    setShowArchivedOption(showArchivedSessions);
  }, [showArchivedSessions]);

  useEffect(() => {
    if (activeTab === "users" && isAdmin) {
      void onRefreshAdminUsers();
    }
  }, [activeTab, isAdmin, onRefreshAdminUsers]);

  const sortedModels = useMemo(() => {
    const current = models.find((item) => item.id === model);
    const rest = models.filter((item) => item.id !== model);
    return current ? [current, ...rest] : models;
  }, [models, model]);

  const titleModelOptions = useMemo(() => {
    if (sortedModels.some((item) => item.id === titleModelOption)) {
      return sortedModels;
    }
    return [
      {
        id: titleModelOption,
        name: titleModelOption,
        pricing: null,
      },
      ...sortedModels,
    ];
  }, [sortedModels, titleModelOption]);

  const usageDate = dailyUsageDate ?? getCurrentUtcDate();
  const temporaryDailyBudgetActive = chatSettings.temporary_daily_budget_usd !== null;
  const usageBudgetUsd = Number(temporaryDailyBudgetActive ? chatSettings.temporary_daily_budget_usd : (chatSettings.daily_budget_usd ?? 0));
  const usageSpentUsd = Number(dailyUsage?.total_cost_usd ?? 0);
  const usageRemainingUsd = Math.max(0, usageBudgetUsd - usageSpentUsd);
  const usageProgressRatio = usageBudgetUsd > 0 ? Math.min(1, usageSpentUsd / usageBudgetUsd) : 0;
  const usageProgressPercent = Math.min(100, Math.max(0, Number((usageProgressRatio * 100).toFixed(1))));
  const usageRows = usage?.by_model ?? [];

  if (!open) {
    return null;
  }

  const TABS: { id: SettingsTab; label: string; icon: ReactNode }[] = [
    { id: "profile", label: "Profile", icon: <UserRound size={15} /> },
    { id: "appearance", label: "Appearance", icon: <Palette size={15} /> },
    { id: "model", label: "Model & Chat", icon: <Bot size={15} /> },
    { id: "providers", label: "Providers", icon: <ShieldCheck size={15} /> },
    ...(isAdmin ? [{ id: "users" as SettingsTab, label: "Users", icon: <ShieldAlert size={15} /> }] : []),
    { id: "usage", label: "Usage", icon: <BarChart2 size={15} /> },
    { id: "advanced", label: "Advanced", icon: <Settings2 size={15} /> },
  ];

  return (
    <div className="ba-modal-backdrop ba-panel-backdrop" role="presentation" onClick={onClose}>
      <section className="ba-panel-modal ba-settings-panel" role="dialog" aria-modal="true" aria-label="Settings" onClick={(event) => event.stopPropagation()}>
        <header className="ba-settings-header">
          <div>
            <p>Settings</p>
            <span>
              {activeTab === "profile" && "Manage your profile and workspaces"}
              {activeTab === "appearance" && "Customize theme and visual effects"}
              {activeTab === "model" && "Model selection and generation settings"}
              {activeTab === "usage" && "Budget tracking and usage analytics"}
              {activeTab === "advanced" && "System maintenance and advanced tools"}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </header>

        <nav className="ba-settings-tabs" aria-label="Settings categories" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`ba-settings-tab${activeTab === tab.id ? " is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="ba-settings-content">

          {activeTab === "appearance" && (
            <article className="ba-settings-card">
              <h3>
                <Palette size={16} />
                Appearance
              </h3>

              <div className="ba-settings-group mb-6">
                <span className="ba-settings-field mb-2 block">Theme</span>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    className={`theme-preview-card standard rounded-xl p-3 bg-[#edf5ff] cursor-pointer text-center transition-all duration-200 border-2 ${profile?.theme === "standard" ? "border-[var(--ba-primary)] is-active" : "border-transparent"}`}
                    onClick={() => void onSaveProfile({ theme: "standard" })}
                  >
                    <div className="theme-preview-visual h-20 bg-[url('/ba/shitim/Event_Main_Stage_Bg.png')] bg-center bg-cover rounded-md mb-2 flex flex-col justify-end p-1 relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/20" />
                      <div className="relative h-3 bg-white/80 rounded-sm mb-1" />
                      <div className="relative w-3/5 h-3 bg-[#8edfff] rounded-sm self-end" />
                    </div>
                    <span className="text-[0.85rem] font-bold text-[var(--arona-text-p)]">Blue Archive</span>
                    <p className="text-[0.7rem] text-[var(--arona-text-s)] mt-0.5">Standard Theme</p>
                  </button>
                  <button
                    type="button"
                    className={`theme-preview-card ethereal-light rounded-xl p-3 bg-[var(--arona-bg)] cursor-pointer text-center transition-all duration-200 border-2 ${profile?.theme === "ethereal-light" || !profile?.theme ? "border-[var(--arona-accent-primary)] is-active" : "border-transparent"}`}
                    onClick={() => void onSaveProfile({ theme: "ethereal-light" })}
                  >
                    <div className="theme-preview-visual h-20 bg-gradient-to-br from-[var(--arona-bg)] to-[var(--arona-subtle)] rounded-md mb-2 border border-[var(--arona-border-soft)] flex flex-col justify-end p-1">
                      <div className="h-3 bg-white border border-[var(--arona-border-soft)] rounded-sm mb-1" />
                      <div className="w-[70%] h-3 bg-white border border-[var(--arona-border-soft)] rounded-full self-center shadow-[0_2px_4px_rgba(0,0,0,0.05)]" />
                    </div>
                    <span className="text-[0.85rem] font-bold text-[var(--arona-text-p)]">Ethereal Light</span>
                    <p className="text-[0.7rem] text-[var(--arona-text-t)] mt-0.5">Modern & Minimal</p>
                  </button>
                </div>
              </div>

              {profile?.theme === "ethereal-light" && (
                <>
                  <div className="ba-settings-field mb-6">
                    <span>Arona Message Style</span>
                    <select
                      value={profile?.arona_bubble_style || "none"}
                      onChange={(e) => onSaveProfile({ arona_bubble_style: e.target.value as "none" | "border" })}
                    >
                      <option value="none">No bubble (Clean)</option>
                      <option value="border">Visible bubble border</option>
                    </select>
                    <small className="text-[var(--arona-text-s)]">Adjust how Arona's messages appear in the Ethereal theme.</small>
                  </div>

                  <div className="ba-settings-field mb-6">
                    <span>Streaming Style</span>
                    <select
                      value={profile?.ethereal_streaming_style || "typewriter"}
                      onChange={(e) => onSaveProfile({ ethereal_streaming_style: e.target.value as "typewriter" | "buffered" })}
                    >
                      <option value="buffered">Buffered Gradient (Modern)</option>
                      <option value="typewriter">Typewriter (Classic)</option>
                    </select>
                    <small className="text-[var(--arona-text-s)]">Choose between smooth buffered display or character-by-character typewriter effect.</small>
                  </div>
                </>
              )}

              <label className="ba-toggle-field">
                <input
                  type="checkbox"
                  checked={dynamicBackground}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setDynamicBackground(next);
                    void onSaveProfile({ dynamic_background: next });
                  }}
                />
                <span>Dynamic background effects</span>
              </label>
              <small className="block text-[var(--arona-text-s)] text-[0.75rem] -mt-1 mb-4">
                Enables animated background gradients and grid patterns.
              </small>
            </article>
          )}

          {activeTab === "profile" && (
            <article className="ba-settings-card">
              <h3>
                <UserRound size={16} />
                Profile
              </h3>
              <div className="ba-profile-row">
                <img src={profile?.avatar_url || "/ba/arona-logo.jpg"} alt="avatar" />
                <div className="ba-profile-actions">
                  <label className="ba-file-upload">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void onUploadAvatar(file);
                        }
                        event.currentTarget.value = "";
                      }}
                    />
                    <span>Upload Avatar</span>
                  </label>
                  {(import.meta.env.VITE_YEARCAKES_ACCOUNT_URL || import.meta.env.VITE_CLERK_USER_PROFILE_URL) && (
                    <a
                      href={import.meta.env.VITE_YEARCAKES_ACCOUNT_URL || import.meta.env.VITE_CLERK_USER_PROFILE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ba-settings-action-link"
                    >
                      Yearcakes Account
                    </a>
                  )}
                </div>
              </div>

              <label className="ba-settings-field">
                <span>Username</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={40} />
              </label>

              <label className="ba-settings-field">
                <span>Keyboard send shortcut</span>
                <select value={sendShortcut} onChange={(event) => setSendShortcut(event.target.value as "ctrl_enter" | "enter")}>
                  <option value="ctrl_enter">Ctrl/⌘ + Enter to send</option>
                  <option value="enter">Enter to send</option>
                </select>
              </label>

              <label className="ba-toggle-field">
                <input
                  type="checkbox"
                  checked={conversationLibraryEnabled}
                  onChange={(event) => setConversationLibraryEnabled(event.target.checked)}
                />
                <span>Enable Library in conversation</span>
              </label>

              <button
                type="button"
                className="ba-settings-action"
                disabled={loading}
                onClick={() =>
                  void handleSaveWithDeduplication("profile", {
                    username: username.trim(),
                    send_shortcut: sendShortcut,
                    conversation_library_enabled: conversationLibraryEnabled,
                  }, () => onSaveProfile({
                    username: username.trim(),
                    send_shortcut: sendShortcut,
                    conversation_library_enabled: conversationLibraryEnabled,
                  }))
                }
              >
                Save Profile
              </button>

              <hr className="ba-settings-divider" />

              <label className="ba-settings-field">
                <span>System Prompt Timezone</span>
                <select value={timezoneOption} onChange={(event) => setTimezoneOption(event.target.value)}>
                  {SYSTEM_PROMPT_TIMEZONE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="ba-settings-action"
                disabled={loading}
                onClick={() => void handleSaveWithDeduplication("timezone", { timezoneOption }, () => onSetSystemPromptTimezone(timezoneOption))}
              >
                Save Timezone
              </button>

              <hr className="ba-settings-divider" />

              <label className="ba-toggle-field">
                <input
                  type="checkbox"
                  checked={showArchivedOption}
                  onChange={(event) => setShowArchivedOption(event.target.checked)}
                />
                <span>Show archived conversations</span>
              </label>

              <button
                type="button"
                className="ba-settings-action"
                disabled={loading}
                onClick={() => void handleSaveWithDeduplication("showArchived", { showArchivedOption }, () => onSetShowArchivedSessions(showArchivedOption))}
              >
                Save Conversation View
              </button>

              <hr className="ba-settings-divider" />

              <label className="ba-settings-field">
                <span>New Workspace</span>
                <input
                  value={newWorkspaceName}
                  onChange={(event) => setNewWorkspaceName(event.target.value)}
                  placeholder="e.g. Work, Study, Side Project"
                  maxLength={60}
                />
              </label>
              <button
                type="button"
                className="ba-settings-action"
                disabled={loading || newWorkspaceName.trim().length === 0}
                onClick={() => {
                  void onCreateWorkspace(newWorkspaceName.trim());
                  setNewWorkspaceName("");
                }}
              >
                Create Workspace
              </button>

              <div className="ba-passkey-list">
                {workspaces.length === 0 ? <p className="ba-muted-text">No workspaces yet.</p> : null}
                {workspaces.map((workspace) => {
                  const isActive = workspace.id === activeWorkspaceId;
                  const isArchived = Boolean(workspace.archived_at);
                  return (
                    <div key={workspace.id} className="ba-passkey-item">
                      <div>
                        <strong>{workspace.name}</strong>
                        <span>{isArchived ? "Archived" : isActive ? "Active" : "Available"}</span>
                      </div>
                      <div className="ba-passkey-item-actions">
                        {!isArchived ? (
                          <button type="button" disabled={isActive} onClick={() => void onActivateWorkspace(workspace.id)}>
                            Activate
                          </button>
                        ) : (
                          <button type="button" onClick={() => void onArchiveWorkspace(workspace.id, false)}>
                            Enable
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const nextName = window.prompt("Rename workspace", workspace.name)?.trim();
                            if (!nextName || nextName === workspace.name) {
                              return;
                            }
                            void onRenameWorkspace(workspace.id, nextName);
                          }}
                        >
                          Rename
                        </button>
                        {!isArchived ? (
                          <button type="button" disabled={isActive} onClick={() => void onArchiveWorkspace(workspace.id, true)}>
                            Archive
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          )}


          {activeTab === "providers" && (
            <article className="ba-settings-card">
              <h3>
                <ShieldCheck size={16} />
                AI Providers & Models
              </h3>

              {!encryptionKeyReady && (
                <div className="ba-alert is-warning mb-4 flex gap-2 items-start p-3 rounded bg-amber-500/10 border border-amber-500/30">
                  <ShieldAlert size={16} className="text-warning" />
                  <div className="text-[0.85rem]">
                    <strong>Security Alert:</strong> Master encryption key is not set in backend.
                    You cannot add new providers or update existing API keys until <code>AUTH_TOKEN_SECRET</code> is configured.
                </div>
              </div>
            )}
            </article>
          )}

          {activeTab === "users" && isAdmin && (
            <article className="ba-settings-card">
              <h3>
                <ShieldAlert size={16} />
                User Management
              </h3>
              <p className="text-[0.8rem] text-[#666] mb-3">
                Admins can delegate limited permissions. Only admins can manage users; no delegated role can grant or revoke admin.
              </p>
              <div className="ba-usage-table ba-providers-models-table max-h-[400px] overflow-y-auto">
                <table className="text-[0.85rem]">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Manage AI</th>
                      <th>View All Users</th>
                      <th>Budget</th>
                      <th>Limit (USD)</th>
                      <th>Requests</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.length === 0 ? (
                      <tr><td colSpan={7} className="ba-usage-empty">{adminUsersLoading ? "Loading users..." : "No users found."}</td></tr>
                    ) : (
                      adminUsers.map((u) => (
                        <tr key={u.user_id} className={u.is_admin ? "font-semibold" : ""}>
                          <td>
                            <div>{u.username}</div>
                            <div className="text-[0.7rem] text-[#888]">{u.is_admin ? "Admin (superuser)" : u.user_id}</div>
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              disabled={u.is_admin}
                              checked={u.can_manage_ai}
                              onChange={(e) => void onUpdateUserPermissions(u.user_id, { can_manage_ai: e.target.checked })}
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              disabled={u.is_admin}
                              checked={u.can_view_all_users}
                              onChange={(e) => void onUpdateUserPermissions(u.user_id, { can_view_all_users: e.target.checked })}
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={u.daily_budget_enabled ?? true}
                              onChange={(e) => void onUpdateUserBudget(u.user_id, { daily_budget_enabled: e.target.checked })}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0.01}
                              step={0.1}
                              className="w-20 px-1 py-0.5 text-center text-xs bg-white text-black border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-pink-400"
                              defaultValue={u.daily_budget_usd ?? 4}
                              onBlur={(e) => {
                                const val = Number(e.target.value);
                                if (Number.isFinite(val) && val > 0 && val !== u.daily_budget_usd) {
                                  void onUpdateUserBudget(u.user_id, { daily_budget_usd: val });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                }
                              }}
                            />
                          </td>
                          <td>
                            {u.total_requests}
                            {u.total_self_added_requests > 0 ? (
                              <span className="text-[0.7rem] text-[#888]"> ({u.total_self_added_requests} from self-added)</span>
                            ) : null}
                          </td>
                          <td>
                            ${u.total_cost_usd.toFixed(4)}
                            {u.total_self_added_cost_usd > 0 ? (
                              <span className="text-[0.7rem] text-[#888]"> (${u.total_self_added_cost_usd.toFixed(4)} from self-added)</span>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {activeTab === "providers" && (
            <article className="ba-settings-card">
              <div className="ba-settings-section">
                <h4>Providers</h4>
                <div className="ba-provider-list flex flex-col gap-3 mb-6">
                  {aiProviders.map((p) => {
                    const isOwner = p.owner_id === instanceId;
                    const canEdit = canManageAi || (isOwner && !p.is_built_in);
                    const isGlobal = p.visibility === "global" || p.is_built_in;
                    return (
                    <div key={p.id} className="ba-passkey-item p-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-[0.95rem]">{p.name}</strong>
                          {p.is_built_in && <span className="ba-tag text-[0.7rem] px-1 py-[1px] bg-black/5 rounded-[3px]">Built-in</span>}
                          {!p.is_built_in && (
                            <span className="ba-tag text-[0.7rem] px-1 py-[1px] bg-black/5 rounded-[3px]">
                              {isGlobal ? "Shared" : (isOwner ? "Private (you)" : (p.owner_email || "Private"))}
                            </span>
                          )}
                        </div>
                        <div className="text-[0.75rem] text-[#666] mt-0.5">{p.endpoint}</div>
                        <div className="text-[0.75rem] font-mono text-[#888]">{p.api_key_masked}</div>
                      </div>
                      {!p.is_built_in && canEdit && (
                        <div className="ba-passkey-item-actions">
                          {canManageAi && (
                            <button type="button" title={isGlobal ? "Make private" : "Make shared to all users"} onClick={() => void onUpdateAiProvider(p.id, { visibility: isGlobal ? "private" : "global" })}>
                              {isGlobal ? "Private" : "Share"}
                            </button>
                          )}
                          <button type="button" onClick={() => {
                            setProviderId(p.id);
                            setProviderForm({ name: p.name, endpoint: p.endpoint, api_key: "" });
                          }}>
                            <Edit2 size={13} />
                          </button>
                          <button type="button" onClick={() => {
                            if (window.confirm(`Delete provider "${p.name}"? Models using this provider must be deleted first.`)) {
                              void onDeleteAiProvider(p.id);
                            }
                          }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>

                <div className="ba-settings-group border border-black/10 p-4 rounded-lg">
                  <h5>{editingProviderId ? "Edit Provider" : "Add New Provider"}</h5>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="ba-settings-field">
                      <span>Name</span>
                      <input value={providerForm.name} onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })} placeholder="My Provider" />
                    </label>
                    <label className="ba-settings-field">
                      <span>Endpoint</span>
                      <input value={providerForm.endpoint} onChange={(e) => setProviderForm({ ...providerForm, endpoint: e.target.value })} placeholder="https://api.openai.com/v1/chat/completions" />
                    </label>
                  </div>
                  {canManageAi && (
                    <label className="ba-settings-field mt-2">
                      <span>Visibility</span>
                      <select value={providerForm.visibility || "private"} onChange={(e) => setProviderForm({ ...providerForm, visibility: e.target.value })}>
                        <option value="private">Private (only you)</option>
                        <option value="global">Shared (all users)</option>
                      </select>
                    </label>
                  )}
                  <label className="ba-settings-field">
                    <span>API Key {editingProviderId && "(leave empty to keep current)"}</span>
                    <input type="password" value={providerForm.api_key} onChange={(e) => setProviderForm({ ...providerForm, api_key: e.target.value })} placeholder="sk-..." />
                  </label>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      className="ba-settings-action !m-0 flex-1"
                      disabled={!encryptionKeyReady || loading || !providerForm.name || !providerForm.endpoint || (!editingProviderId && !providerForm.api_key)}
                      onClick={async () => {
                        if (editingProviderId) {
                          await onUpdateAiProvider(editingProviderId, providerForm);
                          setProviderId(null);
                        } else {
                          await onCreateAiProvider(providerForm);
                        }
                        setProviderForm({ name: "", endpoint: "", api_key: "" });
                      }}
                    >
                      {editingProviderId ? "Update Provider" : "Add Provider"}
                    </button>
                    {editingProviderId && (
                      <button type="button" className="ba-settings-action is-secondary !m-0" onClick={() => {
                        setProviderId(null);
                        setProviderForm({ name: "", endpoint: "", api_key: "" });
                      }}>Cancel</button>
                    )}
                  </div>
                </div>
              </div>


              <div className="ba-settings-section">
                <h4>Models</h4>
                <div className="ba-usage-table ba-providers-models-table max-h-[250px] overflow-y-auto mb-4">
                  <table className="text-[0.85rem]">
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Name / ID</th>
                        <th>Pricing (In/Out)</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiModels.length === 0 ? (
                        <tr><td colSpan={4} className="ba-usage-empty">No custom models added.</td></tr>
                      ) : (
                        aiModels.map((m) => (
                          <tr key={m.id} className={m.is_active ? "opacity-100" : "opacity-50"}>
                            <td>{m.provider_name}</td>
                            <td>
                              <strong>{m.name}</strong>
                              <div className="text-[0.7rem] text-[#888]">{m.model_id}</div>
                            </td>
                            <td>{m.input_usd_per_million}/{m.output_usd_per_million}</td>
                            <td>
                              <div className="flex gap-1">
                                <button type="button" className="ba-icon-btn" onClick={() => {
                                  void onUpdateAiModel(m.id, { is_active: !m.is_active });
                                }}>{m.is_active ? "Disable" : "Enable"}</button>
                                <button type="button" className="ba-icon-btn" onClick={() => {
                                  if (window.confirm("Delete model?")) void onDeleteAiModel(m.id);
                                }}><Trash2 size={12} /></button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="ba-settings-group border border-black/10 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="m-0">Add Model</h5>
                    <div className="flex p-0.5 bg-black/5 rounded-lg border border-black/5">
                      <button
                        type="button"
                        className={`flex-1 px-3 py-1 text-[0.75rem] font-bold rounded-md transition-all ${!isQuickAdd ? 'bg-white shadow-sm text-[var(--ba-primary)]' : 'text-[#666] hover:bg-black/5'}`}
                        onClick={() => setIsQuickAdd(false)}
                      >
                        Manual
                      </button>
                      <button
                        type="button"
                        className={`flex-1 px-3 py-1 text-[0.75rem] font-bold rounded-md transition-all ${isQuickAdd ? 'bg-white shadow-sm text-[var(--ba-primary)]' : 'text-[#666] hover:bg-black/5'}`}
                        onClick={async () => {
                          setIsQuickAdd(true);
                          if (upstreamModels.length === 0) {
                            const data = await onFetchUpstreamModels();
                            setUpstreamModels(data.data || []);
                          }
                        }}
                      >
                        Quick Add
                      </button>
                    </div>
                  </div>

                  {isQuickAdd ? (
                    <div className="ba-quick-add-ui">
                      <div className="ba-search-input relative mb-2">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#888]" />
                        <input
                          className="pl-7"
                          placeholder="Search upstream models..."
                          value={modelSearch}
                          onChange={(e) => setUpstreamSearch(e.target.value)}
                        />
                      </div>
                      <div className="ba-upstream-list max-h-[150px] overflow-y-auto border border-[#eee] rounded">
                        {upstreamModels.filter(m => {
                          const search = modelSearch.toLowerCase();
                          const mid = (m.id || "").toLowerCase();
                          const mname = (m.name || "").toLowerCase();
                          return !modelSearch || mid.includes(search) || mname.includes(search);
                        }).map(m => (
                          <div key={m.id} className="ba-upstream-item p-1 px-2 cursor-pointer flex justify-between border-b border-[#f9f9f9] text-[0.85rem]"
                            onClick={() => {
                              const inputPrice = Number(m.pricing?.prompt || m.pricing?.input || 0) * 1_000_000;
                              const outputPrice = Number(m.pricing?.completion || m.pricing?.output || 0) * 1_000_000;
                              setModelForm({
                                ...modelForm,
                                model_id: m.id,
                                name: m.name,
                                input: inputPrice.toFixed(4),
                                output: outputPrice.toFixed(4)
                              });
                              setIsQuickAdd(false);
                            }}
                          >
                            <span>{m.name} <small className="text-[#999]">{m.id}</small></span>
                            <Plus size={12} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-[1fr,1.5fr] gap-2">
                        <label className="ba-settings-field">
                          <span>Provider</span>
                          <select value={modelForm.provider_id} onChange={(e) => setModelForm({ ...modelForm, provider_id: e.target.value })}>
                            <option value="">Select Provider</option>
                            {aiProviders
                              .filter((p) => p.is_built_in ? false : (canManageAi || p.owner_id === instanceId))
                              .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </label>
                        <label className="ba-settings-field">
                          <span>Model ID</span>
                          <input value={modelForm.model_id} onChange={(e) => setModelForm({ ...modelForm, model_id: e.target.value })} placeholder="openai/gpt-4o" />
                        </label>
                      </div>
                      <label className="ba-settings-field">
                        <span>Display Name</span>
                        <input value={modelForm.name} onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })} placeholder="GPT-4o" />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="ba-settings-field">
                          <span>Input $/1M</span>
                          <input type="number" step="0.01" value={modelForm.input} onChange={(e) => setModelForm({ ...modelForm, input: e.target.value })} />
                        </label>
                        <label className="ba-settings-field">
                          <span>Output $/1M</span>
                          <input type="number" step="0.01" value={modelForm.output} onChange={(e) => setModelForm({ ...modelForm, output: e.target.value })} />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="ba-settings-action w-full mt-2"
                        disabled={loading || !modelForm.provider_id || !modelForm.model_id || !modelForm.name}
                        onClick={async () => {
                          await onCreateAiModel({
                            provider_id: modelForm.provider_id,
                            model_id: modelForm.model_id,
                            name: modelForm.name,
                            input_usd_per_million: Number(modelForm.input),
                            output_usd_per_million: Number(modelForm.output)
                          });
                          setModelForm({ ...modelForm, model_id: "", name: "", input: "0", output: "0" });
                        }}
                      >
                        Add Model
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          )}
          {activeTab === "model" && (
            <article className="ba-settings-card">
              <h3>
                <Bot size={16} />
                Model & Chat
              </h3>

              <label className="ba-settings-field">
                <span>Model</span>
                <select value={model} onChange={(event) => setModel(event.target.value)}>
                  {sortedModels.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <button type="button" className="ba-settings-action" onClick={() => void handleSaveWithDeduplication("model", { model }, () => onSetModel(model))} disabled={loading}>
                Save Model
              </button>

              <label className="ba-settings-field">
                <span>Title Model</span>
                <select value={titleModelOption} onChange={(event) => setTitleModelOption(event.target.value)}>
                  {titleModelOptions.map((item) => (
                    <option key={`title-${item.id}`} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="ba-settings-action"
                onClick={() => void handleSaveWithDeduplication("titleModel", { titleModelOption }, () => onSetTitleModel(titleModelOption))}
                disabled={loading}
              >
                Save Title Model
              </button>

              <hr className="ba-settings-divider" />

              <label className="ba-settings-field">
                <span>Service Tier</span>
                <select value={serviceTier} onChange={(event) => setServiceTier(event.target.value as ServiceTier)}>
                  <option value="default">default (1.0x)</option>
                  <option value="flex">flex (0.5x)</option>
                  <option value="priority">priority (2.5x)</option>
                </select>
                <small>OpenRouter Service Tier. Flex is cheaper but slower/less reliable; Priority is faster but more expensive.</small>
              </label>

              <label className="ba-settings-field">
                <span>Reasoning Effort</span>
                <select value={reasoningEffort} onChange={(event) => setReasoningEffort(event.target.value as ReasoningEffort)}>
                  <option value="default">default (No Field)</option>
                  <option value="minimal">minimal</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="xhigh">xhigh</option>
                </select>
              </label>

              <label className="ba-settings-field">
                <span>Max Output Tokens</span>
                <input
                  type="number"
                  min={1}
                  max={64000}
                  value={maxOutputTokens}
                  onChange={(event) => setMaxOutputTokens(event.target.value)}
                />
              </label>

              <label className="ba-toggle-field">
                <input
                  type="checkbox"
                  checked={dailyBudgetEnabled}
                  disabled={!isAdmin}
                  onChange={(event) => setDailyBudgetEnabled(event.target.checked)}
                />
                <span>Enable Daily Budget Control (Admins Only)</span>
              </label>

              <label className="ba-settings-field">
                <span>Daily Budget (USD)</span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={dailyBudgetUsd}
                  disabled={!dailyBudgetEnabled}
                  onChange={(event) => setDailyBudgetUsd(event.target.value)}
                />
              </label>
              <label className="ba-settings-field">
                <span>Temporary Daily Budget (USD)</span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={temporaryDailyBudgetUsd}
                  placeholder="Disabled"
                  disabled={!dailyBudgetEnabled}
                  onChange={(event) => setTemporaryDailyBudgetUsd(event.target.value)}
                />
                <small>Optional. Overrides Daily Budget for today only and clears after the next UTC day starts.</small>
              </label>

              <label className="ba-toggle-field">
                <input
                  type="checkbox"
                  checked={webSearchEnabled}
                  onChange={(event) => setWebSearchEnabled(event.target.checked)}
                />
                <span>Enable Web Search</span>
              </label>

              <label className="ba-settings-field">
                <span>Web Search Max Results</span>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={webSearchMaxResults}
                  onChange={(event) => setWebSearchMaxResults(event.target.value)}
                  disabled={!webSearchEnabled}
                />
              </label>

              <button
                type="button"
                className="ba-settings-action"
                disabled={loading}
                onClick={() =>
                  void handleSaveWithDeduplication("chatSettings", {
                    service_tier: serviceTier,
                    reasoning_effort: reasoningEffort,
                    max_output_tokens: Number(maxOutputTokens),
                    daily_budget_usd: Number(dailyBudgetUsd),
                    temporary_daily_budget_usd: temporaryDailyBudgetUsd.trim() ? Number(temporaryDailyBudgetUsd) : null,
                    web_search_enabled: webSearchEnabled,
                    web_search_max_results: Number(webSearchMaxResults),
                    daily_budget_enabled: dailyBudgetEnabled,
                  }, () => onSaveChatSettings({
                    service_tier: serviceTier,
                    reasoning_effort: reasoningEffort,
                    max_output_tokens: Number(maxOutputTokens),
                    daily_budget_usd: Number(dailyBudgetUsd),
                    temporary_daily_budget_usd: temporaryDailyBudgetUsd.trim() ? Number(temporaryDailyBudgetUsd) : null,
                    web_search_enabled: webSearchEnabled,
                    web_search_max_results: Number(webSearchMaxResults),
                    daily_budget_enabled: dailyBudgetEnabled,
                  }))
                }
              >
                Save Generation Settings
              </button>

              <hr className="ba-settings-divider" />

              <label className="ba-settings-field">
                <span>Backend Log Level</span>
                <select value={logLevelOption} onChange={(event) => setLogLevelOption(event.target.value as LogLevel)}>
                  <option value="INFO">INFO</option>
                  <option value="TRACE">TRACE</option>
                </select>
              </label>

              <button type="button" className="ba-settings-action" disabled={loading} onClick={() => void handleSaveWithDeduplication("logLevel", { logLevelOption }, () => onSetLogLevel(logLevelOption))}>
                Save Log Level
              </button>
            </article>
          )}

          {activeTab === "usage" && (
            <article className="ba-settings-card">
              <h3>
                <BarChart2 size={16} />
                Usage
              </h3>

              <div className="ba-daily-usage-overview">
                <div className="ba-daily-usage-head">
                  <span>Daily Usage (UTC {usageDate})</span>
                  <strong>{usageProgressPercent.toFixed(1)}%</strong>
                </div>
                <div
                  className={`ba-daily-usage-progress ${usageSpentUsd > usageBudgetUsd ? "is-over" : ""}`}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={usageProgressPercent}
                >
                  <span style={{ width: `${usageProgressPercent}%` }} />
                </div>
                <p className="ba-daily-usage-meta">
                  <span>Spent {formatUsd(usageSpentUsd)}</span>
                  <span>Budget {formatUsd(usageBudgetUsd)}</span>
                  <span>Remaining {formatUsd(usageRemainingUsd)}</span>
                </p>
                {limitsEnabled && (
                  <p className="ba-usage-limit-hint">
                    Built-in models are rate-limited per day. Add your own provider in the Providers tab to use your own API key and bypass this limit.
                  </p>
                )}
              </div>

              {userLimits && userLimits.enabled && (
                <div className="ba-daily-usage-overview mt-4 pt-4 border-t border-dashed border-[#e8f3ee]">
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 text-[var(--arona-text-s)] flex items-center gap-1.5">
                    Resource Quota Limits
                  </h4>

                  {/* Daily Requests Quota */}
                  <div className="mb-4">
                    <div className="ba-daily-usage-head mb-1 text-[0.8rem]">
                      <span>Daily API Requests</span>
                      <strong>{userLimits.current_daily_req} / {userLimits.max_daily_req} reqs</strong>
                    </div>
                    <div
                      className={`ba-daily-usage-progress ${userLimits.current_daily_req >= userLimits.max_daily_req ? "is-over" : ""}`}
                      role="progressbar"
                    >
                      <span style={{ width: `${Math.min(100, (userLimits.current_daily_req / userLimits.max_daily_req) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Storage Quota */}
                  <div className="mb-4">
                    <div className="ba-daily-usage-head mb-1 text-[0.8rem]">
                      <span>Attachment Storage Space</span>
                      <strong>{userLimits.current_storage_mb.toFixed(1)} / {userLimits.max_storage_mb} MB</strong>
                    </div>
                    <div
                      className={`ba-daily-usage-progress ${userLimits.current_storage_mb >= userLimits.max_storage_mb ? "is-over" : ""}`}
                      role="progressbar"
                    >
                      <span style={{ width: `${Math.min(100, (userLimits.current_storage_mb / userLimits.max_storage_mb) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Single File Limit */}
                  <div className="text-[0.75rem] text-[#666] flex justify-between items-center bg-[#f7faf8] px-2 py-1.5 rounded border border-[#e8f3ee]">
                    <span>Single File Max Upload Limit</span>
                    <strong className="font-semibold text-black">{userLimits.max_single_file_mb} MB</strong>
                  </div>
                </div>
              )}

              <div className="ba-usage-summary">
                <div>
                  <span>Total Requests</span>
                  <strong>{usage?.total_requests ?? 0}</strong>
                </div>
                <div>
                  <span>Total Tokens</span>
                  <strong>{usage?.total_tokens ?? 0}</strong>
                </div>
                <div>
                  <span>Total Cost</span>
                  <strong>{formatUsd(usage?.total_cost_usd ?? 0)}</strong>
                </div>
              </div>

              <div className="ba-usage-table">
                <table>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Tokens</th>
                      <th>USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageRows.length === 0 ? (
                      <tr>
                        <td className="ba-usage-empty" colSpan={3}>
                          No usage history yet.
                        </td>
                      </tr>
                    ) : (
                      usageRows.map((item) => (
                        <tr key={item.model}>
                          <td>{item.model}</td>
                          <td>{item.total_tokens}</td>
                          <td>{formatUsd(item.cost_usd)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {activeTab === "advanced" && (
            <article className="ba-settings-card">
              <h3>
                <Settings2 size={16} />
                Advanced
              </h3>


              <div className="ba-settings-section">
                <h4>Data & Actions</h4>
                <div className="flex flex-wrap gap-2 mt-3 mb-6">
                  {onOpenAttachments && (
                    <button type="button" className="ba-settings-action !m-0" onClick={onOpenAttachments}>
                      <FolderOpen size={14} />
                      Attachments
                    </button>
                  )}
                  {onOpenLibrary && (
                    <button type="button" className="ba-settings-action !m-0" onClick={onOpenLibrary}>
                      <FolderOpen size={14} />
                      Library
                    </button>
                  )}
                  {onLogout && (
                    <button type="button" className="ba-settings-action is-danger !m-0" onClick={onLogout}>
                      <LogOut size={14} />
                      Logout
                    </button>
                  )}
                </div>
              </div>

              <hr className="ba-settings-divider" />

              <div className="ba-settings-section mb-6">
                <h4>Attachment Mode</h4>
                <label className="ba-settings-field">
                  <span>API Request Attachment Mode</span>
                  <select
                    value={attachmentMode}
                    onChange={(event) => setAttachmentMode(event.target.value as "url" | "base64")}
                  >
                    <option value="url">Standard URL Mode (Default)</option>
                    <option value="base64">Direct Base64 Mode</option>
                  </select>
                  <small className="text-[var(--arona-text-s)] block mt-1">
                    Choose whether file attachments are directly Base64-encoded into the request payload or passed as standard downloadable URLs.
                  </small>
                </label>
                <button
                  type="button"
                  className="ba-settings-action"
                  disabled={loading}
                  onClick={() =>
                    void handleSaveWithDeduplication("attachmentModeSetting", { attachment_mode: attachmentMode }, () => onSaveChatSettings({
                      attachment_mode: attachmentMode,
                    }))
                  }
                >
                  Save Attachment Mode
                </button>
              </div>

              <hr className="ba-settings-divider" />

              <div className="ba-settings-section mb-6">
                <h4>Max Output Tokens Control</h4>
                <label className="ba-toggle-field mt-3">
                  <input
                    type="checkbox"
                    checked={disableMaxOutputTokens}
                    onChange={(event) => setDisableMaxOutputTokens(event.target.checked)}
                  />
                  <span>Disable Max Output Tokens Parameter</span>
                </label>
                <small className="text-[var(--arona-text-s)] block mt-1">
                  Enabling this prevents sending the <code>max_tokens</code> or <code>max_output_tokens</code> parameters to the upstream provider, resolving errors with models or gateways that enforce strict constraints.
                </small>
                <button
                  type="button"
                  className="ba-settings-action mt-3"
                  disabled={loading}
                  onClick={() =>
                    void handleSaveWithDeduplication("disableMaxOutputTokensSetting", { disable_max_output_tokens: disableMaxOutputTokens }, () => onSaveChatSettings({
                      disable_max_output_tokens: disableMaxOutputTokens,
                    }))
                  }
                >
                  Save Max Tokens Control
                </button>
              </div>

              <hr className="ba-settings-divider" />

              <div className="ba-settings-section">
                <h4>Usage Statistics Maintenance</h4>
                <p className="ba-muted-text text-[0.85rem] mb-4">
                  If your usage statistics seem incorrect or out of sync, you can force a recalculation from the database.
                  This will scan all usage records and update your profile aggregate.
                </p>
                <button
                  type="button"
                  className="ba-settings-action"
                  disabled={loading}
                  onClick={() => {
                    if (window.confirm("This will scan all your usage records to recalculate the totals. Are you sure?")) {
                      void onSyncUsage();
                    }
                  }}
                >
                  Recalculate Usage Statistics
                </button>
              </div>

              <hr className="ba-settings-divider" />

              <div className="ba-settings-section">
                <h4>System Information</h4>
                <div className="ba-muted-text text-[0.85rem] flex flex-col gap-1">
                  <p>
                    <strong>Instance ID:</strong> <code className="bg-black/5 px-1 rounded">{instanceId || "unknown"}</code>
                    {instanceId === "single-user" && <span className="ml-1 text-[0.7rem] opacity-70">(Single-user mode)</span>}
                  </p>
                  <p>
                    <strong>Schema Version:</strong> <code className="bg-black/5 px-1 rounded">v{schemaVersion || "unknown"}</code>
                  </p>
                </div>
              </div>
            </article>
          )}

        </div>
        <footer className="ba-settings-footer">
          <span>Frontend: {buildHash} · {buildTime}</span>
          <span>Backend: {backendBuildHash?.trim() || "unknown"} · {formatBuildTime(backendBuildTime?.trim() || "")}</span>
        </footer>
      </section>
    </div>
  );
};
