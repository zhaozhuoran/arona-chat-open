import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { SYSTEM_PROMPT_TIMEZONE_OPTIONS, type ChatGenerationSettings, type LogLevel, type ModelOption, type ReasoningEffort, type ServiceTier, type UsageSummary, type UserProfile, type Workspace } from "@arona-chat/shared";
import { BarChart2, Bot, UserRound, X, Settings2 } from "lucide-react";

type SettingsTab = "profile" | "model" | "usage" | "advanced";

type ProfileUpdatePayload = {
  username?: string;
  avatar_key?: string | null;
  dynamic_background?: boolean;
  send_shortcut?: "ctrl_enter" | "enter";
  conversation_library_enabled?: boolean;
};

type SettingsPanelProps = {
  open: boolean;
  backendBuildHash: string;
  backendBuildTime: string;
  profile: UserProfile | null;
  usage: UsageSummary | null;
  dailyUsage: UsageSummary | null;
  dailyUsageDate: string | null;
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
  profile,
  usage,
  dailyUsage,
  dailyUsageDate,
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
  const [webSearchEnabled, setWebSearchEnabled] = useState(chatSettings.web_search_enabled);
  const [webSearchMaxResults, setWebSearchMaxResults] = useState(String(chatSettings.web_search_max_results));
  const [logLevelOption, setLogLevelOption] = useState<LogLevel>(logLevel);
  const [timezoneOption, setTimezoneOption] = useState(systemPromptTimezone);
  const [showArchivedOption, setShowArchivedOption] = useState(showArchivedSessions);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
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
    setWebSearchEnabled(chatSettings.web_search_enabled);
    setWebSearchMaxResults(String(chatSettings.web_search_max_results));
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
    { id: "model", label: "Model & Chat", icon: <Bot size={15} /> },
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
              {activeTab === "profile" && "Profile, timezone and workspaces"}
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
                  {import.meta.env.VITE_CLERK_USER_PROFILE_URL && (
                    <a
                      href={import.meta.env.VITE_CLERK_USER_PROFILE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ba-settings-action-link"
                    >
                      Go to Account Settings
                    </a>
                  )}
                </div>
              </div>

              <label className="ba-settings-field">
                <span>Username</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={40} />
              </label>

              <label className="ba-toggle-field">
                <input
                  type="checkbox"
                  checked={dynamicBackground}
                  onChange={(event) => setDynamicBackground(event.target.checked)}
                />
                <span>Dynamic background</span>
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
                  void onSaveProfile({
                    username: username.trim(),
                    dynamic_background: dynamicBackground,
                    send_shortcut: sendShortcut,
                    conversation_library_enabled: conversationLibraryEnabled,
                  })
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
                onClick={() => void onSetSystemPromptTimezone(timezoneOption)}
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
                onClick={() => void onSetShowArchivedSessions(showArchivedOption)}
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

              <button type="button" className="ba-settings-action" onClick={() => void onSetModel(model)} disabled={loading}>
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
                onClick={() => void onSetTitleModel(titleModelOption)}
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

              <label className="ba-settings-field">
                <span>Daily Budget (USD)</span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={dailyBudgetUsd}
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
                  void onSaveChatSettings({
                    service_tier: serviceTier,
                    reasoning_effort: reasoningEffort,
                    max_output_tokens: Number(maxOutputTokens),
                    daily_budget_usd: Number(dailyBudgetUsd),
                    temporary_daily_budget_usd: temporaryDailyBudgetUsd.trim() ? Number(temporaryDailyBudgetUsd) : null,
                    web_search_enabled: webSearchEnabled,
                    web_search_max_results: Number(webSearchMaxResults),
                  })
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

              <button type="button" className="ba-settings-action" disabled={loading} onClick={() => void onSetLogLevel(logLevelOption)}>
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
              </div>

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
                <h4>Usage Statistics Maintenance</h4>
                <p className="ba-muted-text" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
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
                <p className="ba-muted-text" style={{ fontSize: "0.85rem" }}>
                  <strong>Instance ID:</strong> 1 (Single-user mode)<br />
                  <strong>Schema Version:</strong> {profile?.updated_at ? "v13+" : "unknown"}
                </p>
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
