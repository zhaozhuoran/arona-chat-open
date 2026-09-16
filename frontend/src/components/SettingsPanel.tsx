import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { SYSTEM_PROMPT_TIMEZONE_OPTIONS, type AiProvider, type AiModel, type ChatGenerationSettings, type LogLevel, type ModelOption, type ReasoningEffort, type ServiceTier, type UsageSummary, type UserProfile, type Workspace, type UserLimitsStatus } from "@arona-chat/shared";
import type { AdminUser } from "../store/useStore";
import { BarChart2, Bot, UserRound, X, Settings2, ShieldCheck, ShieldAlert, Plus, Trash2, Edit2, Search, Palette, FolderOpen, LogOut } from "lucide-react";
import { BUILD_HASH, BUILD_TIME, ACCOUNT_OR_PROFILE_URL } from "../config";

type SettingsTab = "profile" | "appearance" | "model" | "usage" | "providers" | "users" | "advanced";

type ProfileUpdatePayload = {
  username?: string;
  avatar_key?: string | null;
  dynamic_background?: boolean;
  theme?: "standard" | "ethereal-light" | "ethereal-dark";
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
const buildHash = BUILD_HASH;
const buildTimeRaw = BUILD_TIME;
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
  const [textFileExtractionMode, setTextFileExtractionMode] = useState<"xml" | "url">(chatSettings.text_file_extraction_mode || "xml");
  const [imageCompressionEnabled, setImageCompressionEnabled] = useState(chatSettings.image_compression_enabled ?? true);
  const [imageMaxDimension, setImageMaxDimension] = useState(String(chatSettings.image_max_dimension ?? 2048));
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
    setTextFileExtractionMode(chatSettings.text_file_extraction_mode || "xml");
    setImageCompressionEnabled(chatSettings.image_compression_enabled ?? true);
    setImageMaxDimension(String(chatSettings.image_max_dimension ?? 2048));
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

  // Handle escape key to close provider editing modal
  useEffect(() => {
    if (!editingProviderId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProviderId(null);
        setProviderForm({ name: "", endpoint: "", api_key: "" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingProviderId]);

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
      <section className="ba-panel-modal ba-settings-panel relative" role="dialog" aria-modal="true" aria-label="Settings" onClick={(event) => event.stopPropagation()}>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="theme-standard">
                    <button
                      type="button"
                      className={`theme-preview-card standard rounded-xl p-3 bg-[#edf5ff] cursor-pointer text-center transition-all duration-200 border-2 w-full ${profile?.theme === "standard" ? "border-[var(--ba-primary)] is-active" : "border-transparent"}`}
                      onClick={() => void onSaveProfile({ theme: "standard" })}
                    >
                      <div className="theme-preview-visual h-20 bg-[url('/ba/shitim/Event_Main_Stage_Bg.png')] bg-center bg-cover rounded-md mb-2 flex flex-col justify-end p-1 relative overflow-hidden">
                        <div className="absolute inset-0 bg-white/20" />
                        <div className="relative h-3 bg-white/80 rounded-sm mb-1" />
                        <div className="relative w-3/5 h-3 bg-[#8edfff] rounded-sm self-end" />
                      </div>
                      <span className="text-[0.85rem] font-bold text-[var(--ba-text)]">Blue Archive</span>
                      <p className="text-[0.7rem] text-[var(--ba-muted)] mt-0.5">Standard Theme</p>
                    </button>
                  </div>
                  <div className="theme-ethereal-light">
                    <button
                      type="button"
                      className={`theme-preview-card ethereal-light rounded-xl p-3 bg-[var(--arona-bg)] cursor-pointer text-center transition-all duration-200 border-2 w-full ${profile?.theme === "ethereal-light" || (!profile?.theme && profile?.theme !== "ethereal-dark" && profile?.theme !== "standard") ? "border-[var(--arona-accent-primary)] is-active" : "border-transparent"}`}
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
                  <div className="theme-ethereal-dark">
                    <button
                      type="button"
                      className={`theme-preview-card ethereal-dark rounded-xl p-3 bg-[var(--arona-bg)] cursor-pointer text-center transition-all duration-200 border-2 w-full ${profile?.theme === "ethereal-dark" ? "border-[var(--arona-accent-primary)] is-active shadow-[0_0_12px_rgba(255,67,200,0.25)]" : "border-transparent"}`}
                      onClick={() => void onSaveProfile({ theme: "ethereal-dark" })}
                    >
                      <div className="theme-preview-visual h-20 bg-gradient-to-br from-[var(--arona-bg)] to-[var(--arona-surface)] rounded-md mb-2 border border-[var(--arona-border-soft)] flex flex-col justify-end p-1">
                        <div className="h-3 bg-[var(--arona-surface)] border border-[var(--arona-border-soft)] rounded-sm mb-1" />
                        <div className="w-[70%] h-3 bg-[var(--arona-surface)] border border-[var(--arona-border-soft)] rounded-full self-center shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
                      </div>
                      <span className="text-[0.85rem] font-bold text-[var(--arona-text-p)]">Ethereal Dark</span>
                      <p className="text-[0.7rem] text-[var(--arona-text-s)] mt-0.5">Atmospheric Night</p>
                    </button>
                  </div>
                </div>
              </div>

              {(profile?.theme === "ethereal-light" || profile?.theme === "ethereal-dark") && (
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
                  {ACCOUNT_OR_PROFILE_URL && (
                    <a
                      href={ACCOUNT_OR_PROFILE_URL}
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
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  onBlur={() => {
                    const trimmed = username.trim();
                    setUsername(trimmed);
                    if (trimmed !== (profile?.username ?? "")) {
                      void onSaveProfile({ username: trimmed });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  maxLength={40}
                />
              </label>

              <label className="ba-settings-field">
                <span>Keyboard send shortcut</span>
                <select
                  value={sendShortcut}
                  onChange={(event) => {
                    const val = event.target.value as "ctrl_enter" | "enter";
                    setSendShortcut(val);
                    void onSaveProfile({ send_shortcut: val });
                  }}
                >
                  <option value="ctrl_enter">Ctrl/⌘ + Enter to send</option>
                  <option value="enter">Enter to send</option>
                </select>
              </label>

              <label className="ba-toggle-field">
                <input
                  type="checkbox"
                  checked={conversationLibraryEnabled}
                  onChange={(event) => {
                    const val = event.target.checked;
                    setConversationLibraryEnabled(val);
                    void onSaveProfile({ conversation_library_enabled: val });
                  }}
                />
                <span>Enable Library in conversation</span>
              </label>

              <hr className="ba-settings-divider" />

              <label className="ba-settings-field">
                <span>System Prompt Timezone</span>
                <select
                  value={timezoneOption}
                  onChange={(event) => {
                    const val = event.target.value;
                    setTimezoneOption(val);
                    void onSetSystemPromptTimezone(val);
                  }}
                >
                  {SYSTEM_PROMPT_TIMEZONE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <hr className="ba-settings-divider" />

              <label className="ba-toggle-field">
                <input
                  type="checkbox"
                  checked={showArchivedOption}
                  onChange={(event) => {
                    const val = event.target.checked;
                    setShowArchivedOption(val);
                    void onSetShowArchivedSessions(val);
                  }}
                />
                <span>Show archived conversations</span>
              </label>

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


          {activeTab === "users" && isAdmin && (
            <article className="ba-settings-card">
              <h3>
                <ShieldAlert size={16} />
                User Management
              </h3>
              <p className="text-[0.8rem] text-[var(--arona-text-s,#666)] mb-3">
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
                            <div className="text-[0.7rem] text-[var(--arona-text-t,#888)]">
                              {u.is_admin ? "Admin (superuser)" : (u.email || u.user_id)}
                            </div>
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
                              className="w-20 px-1 py-0.5 text-center text-xs bg-[var(--arona-surface,white)] text-[var(--arona-text-p,black)] border border-[var(--arona-border-soft,rgba(0,0,0,0.2))] rounded focus:outline-none focus:ring-1 focus:ring-pink-400"
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
                              <span className="text-[0.7rem] text-[var(--arona-text-t,#888)]"> ({u.total_self_added_requests} from self-added)</span>
                            ) : null}
                          </td>
                          <td>
                            ${u.total_cost_usd.toFixed(4)}
                            {u.total_self_added_cost_usd > 0 ? (
                              <span className="text-[0.7rem] text-[var(--arona-text-t,#888)]"> (${u.total_self_added_cost_usd.toFixed(4)} from self-added)</span>
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
            <>
              {/* Card 1: AI Providers */}
              <article className="ba-settings-card">
                <h3>
                  <ShieldCheck size={16} />
                  AI Providers
                </h3>

                {!encryptionKeyReady && (
                  <div className="ba-alert is-warning mb-4 flex gap-2 items-start p-3 rounded bg-amber-500/10 border border-amber-500/30">
                    <ShieldAlert size={16} className="text-warning shrink-0 mt-0.5" />
                    <div className="text-[0.85rem]">
                      <strong>Security Alert:</strong> Master encryption key is not set in backend.
                      You cannot add new providers or update existing API keys until <code>AUTH_TOKEN_SECRET</code> is configured.
                    </div>
                  </div>
                )}

                <div className="ba-provider-list flex flex-col gap-2.5 mb-5">
                  {aiProviders.length === 0 ? (
                    <p className="ba-muted-text text-[0.85rem] py-2">No providers configured yet.</p>
                  ) : (
                    aiProviders.map((p) => {
                      const isOwner = p.owner_id === instanceId;
                      const canEdit = canManageAi || (isOwner && !p.is_built_in);
                      const isGlobal = p.visibility === "global" || p.is_built_in;
                      return (
                        <div key={p.id} className="ba-passkey-item p-3 rounded-lg border border-[var(--arona-border-soft,rgba(0,0,0,0.08))] bg-[var(--arona-surface,rgba(0,0,0,0.02))]">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong className="text-[0.9rem] font-semibold">{p.name}</strong>
                              {p.is_built_in && (
                                <span className="text-[0.68rem] font-medium px-1.5 py-[2px] bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">
                                  Built-in
                                </span>
                              )}
                              {!p.is_built_in && (
                                <span className={`text-[0.68rem] font-medium px-1.5 py-[2px] rounded-full ${
                                  isGlobal
                                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                }`}>
                                  {isGlobal ? "Shared" : (isOwner ? "Private (you)" : (p.owner_email || "Private"))}
                                </span>
                              )}
                            </div>
                            <div className="text-[0.75rem] text-[var(--arona-text-s,#666)] truncate mt-0.5 font-mono">{p.endpoint}</div>
                            <div className="text-[0.72rem] font-mono text-[var(--arona-text-t,#888)] mt-0.5">{p.api_key_masked}</div>
                          </div>
                          {!p.is_built_in && canEdit && (
                            <div className="ba-passkey-item-actions flex items-center gap-1">
                              {canManageAi && (
                                <button
                                  type="button"
                                  className="text-xs px-2 py-1 rounded bg-[var(--arona-surface,rgba(0,0,0,0.05))] hover:bg-[var(--arona-border-soft,rgba(0,0,0,0.1))] transition-colors"
                                  title={isGlobal ? "Make private" : "Make shared to all users"}
                                  onClick={() => void onUpdateAiProvider(p.id, { visibility: isGlobal ? "private" : "global" })}
                                >
                                  {isGlobal ? "Private" : "Share"}
                                </button>
                              )}
                              <button
                                type="button"
                                className="p-1.5 rounded hover:bg-[var(--arona-surface,rgba(0,0,0,0.05))] text-[var(--arona-text-s,#666)] transition-colors"
                                title="Edit Provider"
                                aria-label={`Edit provider ${p.name}`}
                                onClick={() => {
                                  setProviderId(p.id);
                                  setProviderForm({ name: p.name, endpoint: p.endpoint, api_key: "", visibility: p.visibility || "private" });
                                }}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 rounded hover:bg-red-500/10 text-red-500 transition-colors"
                                title="Delete Provider"
                                aria-label={`Delete provider ${p.name}`}
                                onClick={() => {
                                  if (window.confirm(`Delete provider "${p.name}"? Models using this provider must be deleted first.`)) {
                                    void onDeleteAiProvider(p.id);
                                  }
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Inline Form to Add New Provider */}
                <div className="ba-settings-group border border-[var(--arona-border-soft,rgba(0,0,0,0.1))] p-3.5 rounded-lg bg-[var(--arona-surface,rgba(0,0,0,0.01))]">
                  <h4 className="text-[0.85rem] font-semibold mb-2.5">Add Provider</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                    <label className="ba-settings-field !m-0">
                      <span>Name</span>
                      <input
                        value={providerForm.name}
                        onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                        placeholder="e.g. OpenRouter / DeepSeek"
                      />
                    </label>
                    <label className="ba-settings-field !m-0">
                      <span>Endpoint URL</span>
                      <input
                        value={providerForm.endpoint}
                        onChange={(e) => setProviderForm({ ...providerForm, endpoint: e.target.value })}
                        placeholder="https://api.openai.com/v1/chat/completions"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    <label className="ba-settings-field !m-0">
                      <span>API Key</span>
                      <input
                        type="password"
                        value={providerForm.api_key}
                        onChange={(e) => setProviderForm({ ...providerForm, api_key: e.target.value })}
                        placeholder="sk-..."
                      />
                    </label>
                    {canManageAi && (
                      <label className="ba-settings-field !m-0">
                        <span>Visibility</span>
                        <select
                          value={providerForm.visibility || "private"}
                          onChange={(e) => setProviderForm({ ...providerForm, visibility: e.target.value })}
                        >
                          <option value="private">Private (only you)</option>
                          <option value="global">Shared (all users)</option>
                        </select>
                      </label>
                    )}
                  </div>
                  <button
                    type="button"
                    className="ba-settings-action w-full !m-0"
                    disabled={!encryptionKeyReady || loading || !providerForm.name.trim() || !providerForm.endpoint.trim() || !providerForm.api_key.trim()}
                    onClick={async () => {
                      await onCreateAiProvider({
                        name: providerForm.name.trim(),
                        endpoint: providerForm.endpoint.trim(),
                        api_key: providerForm.api_key.trim(),
                        visibility: providerForm.visibility || "private"
                      });
                      setProviderForm({ name: "", endpoint: "", api_key: "" });
                    }}
                  >
                    Add Provider
                  </button>
                </div>
              </article>

              {/* Card 2: AI Models */}
              <article className="ba-settings-card">
                <h3>
                  <Bot size={16} />
                  Custom AI Models
                </h3>

                <div className="ba-usage-table ba-providers-models-table max-h-[220px] overflow-y-auto mb-4 border border-[var(--arona-border-soft,rgba(0,0,0,0.08))] rounded-lg">
                  <table className="text-[0.85rem]">
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Name / ID</th>
                        <th>Pricing ($/1M In/Out)</th>
                        <th>Status / Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiModels.length === 0 ? (
                        <tr><td colSpan={4} className="ba-usage-empty py-4 text-center text-[var(--arona-text-s,#888)]">No custom models added yet.</td></tr>
                      ) : (
                        aiModels.map((m) => (
                          <tr key={m.id} className={m.is_active ? "opacity-100" : "opacity-50"}>
                            <td className="font-medium">{m.provider_name}</td>
                            <td>
                              <strong className="block text-[0.85rem]">{m.name}</strong>
                              <div className="text-[0.7rem] text-[var(--arona-text-t,#888)] font-mono">{m.model_id}</div>
                            </td>
                            <td className="font-mono text-[0.8rem]">${m.input_usd_per_million} / ${m.output_usd_per_million}</td>
                            <td>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                    m.is_active
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                      : "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20"
                                  }`}
                                  onClick={() => {
                                    void onUpdateAiModel(m.id, { is_active: !m.is_active });
                                  }}
                                >
                                  {m.is_active ? "Active" : "Disabled"}
                                </button>
                                <button
                                  type="button"
                                  className="p-1 rounded hover:bg-red-500/10 text-red-500 transition-colors"
                                  title="Delete Model"
                                  aria-label={`Delete model ${m.name}`}
                                  onClick={() => {
                                    if (window.confirm(`Delete model "${m.name}"?`)) void onDeleteAiModel(m.id);
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="ba-settings-group border border-[var(--arona-border-soft,rgba(0,0,0,0.1))] p-3.5 rounded-lg bg-[var(--arona-surface,rgba(0,0,0,0.01))]">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-[0.85rem] font-semibold m-0">Add Model</h4>
                    <div className="flex p-0.5 bg-[var(--arona-surface,rgba(0,0,0,0.05))] rounded-lg border border-[var(--arona-border-soft,rgba(0,0,0,0.08))]" role="tablist" aria-label="Model add mode">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={!isQuickAdd}
                        className={`px-3 py-1 text-[0.72rem] font-bold rounded-md transition-all ${!isQuickAdd ? 'bg-[var(--arona-bg,white)] shadow-sm text-[var(--ba-primary)]' : 'text-[var(--arona-text-s,#666)] hover:bg-[var(--arona-surface,rgba(0,0,0,0.05))]'}`}
                        onClick={() => setIsQuickAdd(false)}
                      >
                        Manual
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={isQuickAdd}
                        className={`px-3 py-1 text-[0.72rem] font-bold rounded-md transition-all ${isQuickAdd ? 'bg-[var(--arona-bg,white)] shadow-sm text-[var(--ba-primary)]' : 'text-[var(--arona-text-s,#666)] hover:bg-[var(--arona-surface,rgba(0,0,0,0.05))]'}`}
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
                    <div className="ba-quick-add-ui space-y-2">
                      <div className="ba-search-input relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--arona-text-s,#888)]" />
                        <input
                          className="w-full pl-8 py-1.5 text-[0.8rem] bg-[var(--arona-bg,white)] border border-[var(--arona-border-soft,rgba(0,0,0,0.1))] rounded-md"
                          placeholder="Search upstream models..."
                          value={modelSearch}
                          onChange={(e) => setUpstreamSearch(e.target.value)}
                        />
                      </div>
                      <div className="ba-upstream-list max-h-[160px] overflow-y-auto border border-[var(--arona-border-soft,rgba(0,0,0,0.1))] rounded-md divide-y divide-[var(--arona-border-soft,rgba(0,0,0,0.05))]">
                        {upstreamModels.filter(m => {
                          const search = modelSearch.toLowerCase();
                          const mid = (m.id || "").toLowerCase();
                          const mname = (m.name || "").toLowerCase();
                          return !modelSearch || mid.includes(search) || mname.includes(search);
                        }).map(m => (
                          <div
                            key={m.id}
                            className="ba-upstream-item p-2 hover:bg-[var(--arona-surface,rgba(0,0,0,0.05))] cursor-pointer flex justify-between items-center text-[0.82rem] transition-colors"
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
                            <span className="truncate pr-2 font-medium">{m.name} <small className="text-[var(--arona-text-s,#888)] font-mono ml-1">{m.id}</small></span>
                            <Plus size={14} className="shrink-0 text-[var(--ba-primary)]" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr,1.5fr] gap-2">
                        <label className="ba-settings-field !m-0">
                          <span>Provider</span>
                          <select value={modelForm.provider_id} onChange={(e) => setModelForm({ ...modelForm, provider_id: e.target.value })}>
                            <option value="">Select Provider</option>
                            {aiProviders
                              .filter((p) => p.is_built_in ? false : (canManageAi || p.owner_id === instanceId))
                              .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </label>
                        <label className="ba-settings-field !m-0">
                          <span>Model ID</span>
                          <input value={modelForm.model_id} onChange={(e) => setModelForm({ ...modelForm, model_id: e.target.value })} placeholder="openai/gpt-4o" />
                        </label>
                      </div>
                      <label className="ba-settings-field !m-0">
                        <span>Display Name</span>
                        <input value={modelForm.name} onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })} placeholder="GPT-4o" />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="ba-settings-field !m-0">
                          <span>Input $/1M</span>
                          <input type="number" step="0.01" value={modelForm.input} onChange={(e) => setModelForm({ ...modelForm, input: e.target.value })} />
                        </label>
                        <label className="ba-settings-field !m-0">
                          <span>Output $/1M</span>
                          <input type="number" step="0.01" value={modelForm.output} onChange={(e) => setModelForm({ ...modelForm, output: e.target.value })} />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="ba-settings-action w-full mt-2 !mb-0"
                        disabled={loading || !modelForm.provider_id || !modelForm.model_id.trim() || !modelForm.name.trim()}
                        onClick={async () => {
                          await onCreateAiModel({
                            provider_id: modelForm.provider_id,
                            model_id: modelForm.model_id.trim(),
                            name: modelForm.name.trim(),
                            input_usd_per_million: Number(modelForm.input),
                            output_usd_per_million: Number(modelForm.output)
                          });
                          setModelForm({ ...modelForm, model_id: "", name: "", input: "0", output: "0" });
                        }}
                      >
                        Add Model
                      </button>
                    </div>
                  )}
                </div>
              </article>
            </>
          )}

          {activeTab === "model" && (
            <article className="ba-settings-card">
              <h3>
                <Bot size={16} />
                Model & Chat
              </h3>

              <label className="ba-settings-field">
                <span>Model</span>
                <select
                  value={model}
                  onChange={(event) => {
                    const val = event.target.value;
                    setModel(val);
                    void onSetModel(val);
                  }}
                >
                  {sortedModels.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="ba-settings-field">
                <span>Title Model</span>
                <select
                  value={titleModelOption}
                  onChange={(event) => {
                    const val = event.target.value;
                    setTitleModelOption(val);
                    void onSetTitleModel(val);
                  }}
                >
                  {titleModelOptions.map((item) => (
                    <option key={`title-${item.id}`} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <hr className="ba-settings-divider" />

              <label className="ba-settings-field">
                <span>Service Tier</span>
                <select
                  value={serviceTier}
                  onChange={(event) => {
                    const val = event.target.value as ServiceTier;
                    setServiceTier(val);
                    void onSaveChatSettings({ service_tier: val });
                  }}
                >
                  <option value="default">default (1.0x)</option>
                  <option value="flex">flex (0.5x)</option>
                  <option value="priority">priority (2.5x)</option>
                </select>
                <small>OpenRouter Service Tier. Flex is cheaper but slower/less reliable; Priority is faster but more expensive.</small>
              </label>

              <label className="ba-settings-field">
                <span>Reasoning Effort</span>
                <select
                  value={reasoningEffort}
                  onChange={(event) => {
                    const val = event.target.value as ReasoningEffort;
                    setReasoningEffort(val);
                    void onSaveChatSettings({ reasoning_effort: val });
                  }}
                >
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
                  onBlur={() => {
                    const val = Number(maxOutputTokens);
                    if (Number.isFinite(val) && val > 0 && val !== chatSettings.max_output_tokens) {
                      void onSaveChatSettings({ max_output_tokens: val });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                />
              </label>

              <label className="ba-toggle-field">
                <input
                  type="checkbox"
                  checked={dailyBudgetEnabled}
                  disabled={!isAdmin}
                  onChange={(event) => {
                    const val = event.target.checked;
                    setDailyBudgetEnabled(val);
                    void onSaveChatSettings({ daily_budget_enabled: val });
                  }}
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
                  onBlur={() => {
                    const val = Number(dailyBudgetUsd);
                    if (Number.isFinite(val) && val >= 0.01 && val !== chatSettings.daily_budget_usd) {
                      void onSaveChatSettings({ daily_budget_usd: val });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
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
                  onBlur={() => {
                    const trimmed = temporaryDailyBudgetUsd.trim();
                    const val = trimmed ? Number(trimmed) : null;
                    if (val === null || (Number.isFinite(val) && val >= 0.01)) {
                      if (val !== chatSettings.temporary_daily_budget_usd) {
                        void onSaveChatSettings({ temporary_daily_budget_usd: val });
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                />
                <small>Optional. Overrides Daily Budget for today only and clears after the next UTC day starts.</small>
              </label>

              <label className="ba-toggle-field">
                <input
                  type="checkbox"
                  checked={webSearchEnabled}
                  onChange={(event) => {
                    const val = event.target.checked;
                    setWebSearchEnabled(val);
                    void onSaveChatSettings({ web_search_enabled: val });
                  }}
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
                  onBlur={() => {
                    const val = Number(webSearchMaxResults);
                    if (Number.isFinite(val) && val >= 1 && val <= 25 && val !== chatSettings.web_search_max_results) {
                      void onSaveChatSettings({ web_search_max_results: val });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                />
              </label>

              <hr className="ba-settings-divider" />

              <label className="ba-settings-field">
                <span>Backend Log Level</span>
                <select
                  value={logLevelOption}
                  onChange={(event) => {
                    const val = event.target.value as LogLevel;
                    setLogLevelOption(val);
                    void onSetLogLevel(val);
                  }}
                >
                  <option value="INFO">INFO</option>
                  <option value="TRACE">TRACE</option>
                </select>
              </label>
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
                <div className="ba-daily-usage-overview mt-4 pt-4 border-t border-dashed border-[var(--arona-border-soft,rgba(0,0,0,0.1))]">
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
                  <div className="text-[0.75rem] text-[var(--arona-text-s,#666)] flex justify-between items-center bg-[var(--arona-surface,rgba(0,0,0,0.03))] px-2 py-1.5 rounded border border-[var(--arona-border-soft,rgba(0,0,0,0.1))]">
                    <span>Single File Max Upload Limit</span>
                    <strong className="font-semibold text-[var(--arona-text-p,black)]">{userLimits.max_single_file_mb} MB</strong>
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
                <h4>Image Compression & Resizing</h4>
                <label className="ba-toggle-field mt-3">
                  <input
                    type="checkbox"
                    checked={imageCompressionEnabled}
                    onChange={(event) => {
                      const val = event.target.checked;
                      setImageCompressionEnabled(val);
                      void onSaveChatSettings({ image_compression_enabled: val });
                    }}
                  />
                  <span>Auto-resize High-Resolution Images</span>
                </label>
                <small className="text-[var(--arona-text-s)] block mt-1 mb-3">
                  Automatically scale down uploaded high-resolution images to control Vision model token usage and avoid excessive API costs.
                </small>

                {imageCompressionEnabled && (
                  <label className="ba-settings-field mt-3">
                    <span>Maximum Image Dimension (Longest Side)</span>
                    <select
                      value={imageMaxDimension}
                      onChange={(event) => {
                        const val = Number(event.target.value);
                        setImageMaxDimension(String(val));
                        void onSaveChatSettings({ image_max_dimension: val });
                      }}
                    >
                      <option value="1024">1024px (Ultra Compact)</option>
                      <option value="1536">1536px (Compact)</option>
                      <option value="2048">2048px (Recommended / Default)</option>
                      <option value="4096">4096px (High Detail)</option>
                    </select>
                    <small className="text-[var(--arona-text-s)] block mt-1">
                      Images exceeding this width or height will be scaled down proportionally before upload. Images below this limit are left uncompressed.
                    </small>
                  </label>
                )}
              </div>

              <hr className="ba-settings-divider" />

              <div className="ba-settings-section mb-6">
                <h4>Text File Attachment Handling</h4>
                <label className="ba-settings-field">
                  <span>API Request Text File Attachment Mode</span>
                  <select
                    value={textFileExtractionMode}
                    onChange={(event) => {
                      const val = event.target.value as "xml" | "url";
                      setTextFileExtractionMode(val);
                      void onSaveChatSettings({ text_file_extraction_mode: val });
                    }}
                  >
                    <option value="xml">Extract Content with XML Tags (Default)</option>
                    <option value="url">Keep as Download URL</option>
                  </select>
                  <small className="text-[var(--arona-text-s)] block mt-1">
                    Choose whether plain text and markdown attachments are directly extracted and wrapped in XML Tags in the request prompt or fall back to download URLs.
                  </small>
                </label>
              </div>

              <hr className="ba-settings-divider" />

              <div className="ba-settings-section mb-6">
                <h4>Attachment Mode</h4>
                <label className="ba-settings-field">
                  <span>API Request Attachment Mode</span>
                  <select
                    value={attachmentMode}
                    onChange={(event) => {
                      const val = event.target.value as "url" | "base64";
                      setAttachmentMode(val);
                      void onSaveChatSettings({ attachment_mode: val });
                    }}
                  >
                    <option value="url">Standard URL Mode (Default)</option>
                    <option value="base64">Direct Base64 Mode</option>
                  </select>
                  <small className="text-[var(--arona-text-s)] block mt-1">
                    Choose whether file attachments are directly Base64-encoded into the request payload or passed as standard downloadable URLs.
                  </small>
                </label>
              </div>

              <hr className="ba-settings-divider" />

              <div className="ba-settings-section mb-6">
                <h4>Max Output Tokens Control</h4>
                <label className="ba-toggle-field mt-3">
                  <input
                    type="checkbox"
                    checked={disableMaxOutputTokens}
                    onChange={(event) => {
                      const val = event.target.checked;
                      setDisableMaxOutputTokens(val);
                      void onSaveChatSettings({ disable_max_output_tokens: val });
                    }}
                  />
                  <span>Disable Max Output Tokens Parameter</span>
                </label>
                <small className="text-[var(--arona-text-s)] block mt-1">
                  Enabling this prevents sending the <code>max_tokens</code> or <code>max_output_tokens</code> parameters to the upstream provider, resolving errors with models or gateways that enforce strict constraints.
                </small>
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

        {/* Edit Provider Modal Overlay - Rendered at panel level to prevent stacking context clipping */}
        {editingProviderId && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Edit AI Provider"
            onClick={() => {
              setProviderId(null);
              setProviderForm({ name: "", endpoint: "", api_key: "" });
            }}
          >
            <div
              className="bg-[var(--arona-bg,#fff)] border border-[var(--arona-border-soft,rgba(0,0,0,0.1))] rounded-xl p-5 w-full max-w-md shadow-2xl space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-2 border-b border-[var(--arona-border-soft,rgba(0,0,0,0.08))]">
                <h4 className="text-[0.95rem] font-bold m-0">Edit Provider</h4>
                <button
                  type="button"
                  className="text-[var(--arona-text-s,#888)] hover:text-[var(--arona-text-p,black)] p-1 rounded"
                  aria-label="Close edit provider modal"
                  onClick={() => {
                    setProviderId(null);
                    setProviderForm({ name: "", endpoint: "", api_key: "" });
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <label className="ba-settings-field">
                <span>Name</span>
                <input
                  value={providerForm.name}
                  onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                  placeholder="Provider Name"
                />
              </label>

              <label className="ba-settings-field">
                <span>Endpoint URL</span>
                <input
                  value={providerForm.endpoint}
                  onChange={(e) => setProviderForm({ ...providerForm, endpoint: e.target.value })}
                  placeholder="https://api.openai.com/v1/chat/completions"
                />
              </label>

              <label className="ba-settings-field">
                <span>API Key <small className="text-[var(--arona-text-s,#888)]">(leave empty to keep current)</small></span>
                <input
                  type="password"
                  value={providerForm.api_key}
                  onChange={(e) => setProviderForm({ ...providerForm, api_key: e.target.value })}
                  placeholder="sk-..."
                />
              </label>

              {canManageAi && (
                <label className="ba-settings-field">
                  <span>Visibility</span>
                  <select
                    value={providerForm.visibility || "private"}
                    onChange={(e) => setProviderForm({ ...providerForm, visibility: e.target.value })}
                  >
                    <option value="private">Private (only you)</option>
                    <option value="global">Shared (all users)</option>
                  </select>
                </label>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className="ba-settings-action flex-1 !m-0"
                  disabled={!encryptionKeyReady || loading || !providerForm.name.trim() || !providerForm.endpoint.trim()}
                  onClick={async () => {
                    const updatePayload: { name?: string; endpoint?: string; api_key?: string; visibility?: string } = {
                      name: providerForm.name.trim(),
                      endpoint: providerForm.endpoint.trim(),
                      visibility: providerForm.visibility || "private",
                    };
                    if (providerForm.api_key.trim()) {
                      updatePayload.api_key = providerForm.api_key.trim();
                    }
                    await onUpdateAiProvider(editingProviderId, updatePayload);
                    setProviderId(null);
                    setProviderForm({ name: "", endpoint: "", api_key: "" });
                  }}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  className="ba-settings-action is-secondary !m-0 px-4"
                  onClick={() => {
                    setProviderId(null);
                    setProviderForm({ name: "", endpoint: "", api_key: "" });
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="ba-settings-footer">
          <span>Frontend: {buildHash} · {buildTime}</span>
          <span>Backend: {backendBuildHash?.trim() || "unknown"} · {formatBuildTime(backendBuildTime?.trim() || "")}</span>
        </footer>
      </section>
    </div>
  );
};
