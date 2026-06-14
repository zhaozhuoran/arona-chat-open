import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, UIEvent } from "react";
import type { CSSProperties } from "react";
import { FolderOpen, Menu, MessageSquarePlus, MoreHorizontal, Pin, Settings2, X } from "lucide-react";
import { AttachmentLibraryPanel } from "./components/AttachmentLibraryPanel";
import { AuthPanel } from "./components/AuthPanel";
import { BootLoader } from "./components/BootLoader";
import { BottomDock } from "./components/BottomDock";
import { ChatInputArea } from "./components/ChatInputArea";
import { ChatSession } from "./components/ChatSession";
import { LibraryPanel } from "./components/LibraryPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ToastStack } from "./components/ToastStack";
import { SESSION_TITLE_MAX_LENGTH } from "./constants/session";
import { useStore, isPreviewAvailable } from "./store/useStore";

type TransitionState = "idle" | "curtain";
type MainStyle = CSSProperties & {
  "--ba-topbar-collapse": number;
};
type ChatRoute = { kind: "new" } | { kind: "session"; sessionId: string };
const formatTopbarCurrency = (value: number): string =>
  `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 })}`;
const formatBottomCurrency = (value: number): string =>
  `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TOPBAR_INTERACTION_HIDE_THRESHOLD = 0.98;
const CHAT_NEW_PATH = "/chat/new";
const SESSION_LIST_ITEM_HEIGHT = 42;
const SESSION_LIST_ITEM_GAP = 8;
const SESSION_LIST_ITEM_STRIDE = SESSION_LIST_ITEM_HEIGHT + SESSION_LIST_ITEM_GAP;
const SESSION_LIST_OVERSCAN = 6;

const parseChatRoute = (pathname: string): ChatRoute | null => {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === CHAT_NEW_PATH) {
    return { kind: "new" };
  }
  const match = /^\/chat\/([^/]+)$/.exec(normalized);
  if (!match) {
    return null;
  }
  try {
    const sessionId = decodeURIComponent(match[1]).trim();
    if (!sessionId || sessionId.toLowerCase() === "new") {
      return { kind: "new" };
    }
    return { kind: "session", sessionId };
  } catch {
    return null;
  }
};

function App() {
  const [bootComplete, setBootComplete] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia("(min-width: 1080px)").matches);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [attachmentLibraryOpen, setAttachmentLibraryOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [renameSessionTarget, setRenameSessionTarget] = useState<{ id: string; title: string } | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState("");
  const [transitionState, setTransitionState] = useState<TransitionState>("idle");
  const [chatScrollY, setChatScrollY] = useState(0);
  const [sessionListMetrics, setSessionListMetrics] = useState({ height: 0, scrollTop: 0 });
  const sessionListRef = useRef<HTMLDivElement | null>(null);
  const sessionListScrollTopRef = useRef(0);
  const sessionListScrollFrameRef = useRef<number | null>(null);
  const hasPlayedEntryAnimation = useRef(false);
  const transitionTimers = useRef<number[]>([]);
  const usageUpdateTimerRef = useRef<number | null>(null);
  const lastUsageUpdateAtRef = useRef(0);
  const routeSyncReadyRef = useRef(false);

  const {
    authReady,
    authLoading,
    authenticated,
    previewMode,
    backendBuildHash,
    backendBuildTime,
    sessions,
    sessionsHasMore,
    sessionsLoadingMore,
    sessionId,
    profile,
    usage,
    dailyUsage,
    dailyUsageDate,
    sessionUsage,
    messages,
    sendingMessage,
    streamingMessage,
    passkeys,
    models,
    selectedModel,
    titleModel,
    chatSettings,
    logLevel,
    systemPromptTimezone,
    showArchivedSessions,
    workspaces,
    activeWorkspaceId,
    attachmentLibrary,
    attachmentLibraryLoading,
    libraryItems,
    libraryLoading,
    toasts,
    initialize,
    loginWithPassword,
    loginWithPasskey,
    loginWithPreviewPassword,
    logout,
    loadMoreSessions,
    selectSession,
    clearSession,
    refreshProfile,
    updateProfile,
    uploadAvatar,
    refreshUsage,
    syncUsageAggregate,
    refreshModels,
    setSelectedModel,
    setTitleModel,
    setChatSettings,
    setLogLevel,
    setSystemPromptTimezone,
    setShowArchivedSessions,
    refreshWorkspaces,
    createWorkspace,
    renameWorkspace,
    archiveWorkspace,
    activateWorkspace,
    renameSession,
    autoGenerateSessionTitle,
    archiveSession,
    pinSession,
    refreshAttachmentLibrary,
    deleteAttachment,
    refreshLibrary,
    uploadLibraryFile,
    deleteLibraryItem,
    refreshPasskeys,
    registerPasskey,
    removePasskey,
    dismissToast,
    pushToast,
  } = useStore((state) => ({
    authReady: state.authReady,
    authLoading: state.authLoading,
    authenticated: state.authenticated,
    previewMode: state.previewMode,
    backendBuildHash: state.backendBuildHash,
    backendBuildTime: state.backendBuildTime,
    sessions: state.sessions,
    sessionsHasMore: state.sessionsHasMore,
    sessionsLoadingMore: state.sessionsLoadingMore,
    loadMoreSessions: state.loadMoreSessions,
    syncUsageAggregate: state.syncUsageAggregate,
    sessionId: state.sessionId,
    profile: state.profile,
    usage: state.usage,
    dailyUsage: state.dailyUsage,
    dailyUsageDate: state.dailyUsageDate,
    sessionUsage: state.sessionUsage,
    messages: state.messages,
    sendingMessage: state.sendingMessage,
    streamingMessage: state.streamingMessage,
    passkeys: state.passkeys,
    models: state.models,
    selectedModel: state.selectedModel,
    titleModel: state.titleModel,
    chatSettings: state.chatSettings,
    logLevel: state.logLevel,
    systemPromptTimezone: state.systemPromptTimezone,
    showArchivedSessions: state.showArchivedSessions,
    workspaces: state.workspaces,
    activeWorkspaceId: state.activeWorkspaceId,
    attachmentLibrary: state.attachmentLibrary,
    attachmentLibraryLoading: state.attachmentLibraryLoading,
    libraryItems: state.libraryItems,
    libraryLoading: state.libraryLoading,
    toasts: state.toasts,
    initialize: state.initialize,
    loginWithPassword: state.loginWithPassword,
    loginWithPasskey: state.loginWithPasskey,
    loginWithPreviewPassword: state.loginWithPreviewPassword,
    logout: state.logout,
    selectSession: state.selectSession,
    clearSession: state.clearSession,
    refreshProfile: state.refreshProfile,
    updateProfile: state.updateProfile,
    uploadAvatar: state.uploadAvatar,
    refreshUsage: state.refreshUsage,
    refreshModels: state.refreshModels,
    setSelectedModel: state.setSelectedModel,
    setTitleModel: state.setTitleModel,
    setChatSettings: state.setChatSettings,
    setLogLevel: state.setLogLevel,
    setSystemPromptTimezone: state.setSystemPromptTimezone,
    setShowArchivedSessions: state.setShowArchivedSessions,
    refreshWorkspaces: state.refreshWorkspaces,
    createWorkspace: state.createWorkspace,
    renameWorkspace: state.renameWorkspace,
    archiveWorkspace: state.archiveWorkspace,
    activateWorkspace: state.activateWorkspace,
    renameSession: state.renameSession,
    autoGenerateSessionTitle: state.autoGenerateSessionTitle,
    archiveSession: state.archiveSession,
    pinSession: state.pinSession,
    refreshAttachmentLibrary: state.refreshAttachmentLibrary,
    deleteAttachment: state.deleteAttachment,
    refreshLibrary: state.refreshLibrary,
    uploadLibraryFile: state.uploadLibraryFile,
    deleteLibraryItem: state.deleteLibraryItem,
    refreshPasskeys: state.refreshPasskeys,
    registerPasskey: state.registerPasskey,
    removePasskey: state.removePasskey,
    dismissToast: state.dismissToast,
    pushToast: state.pushToast,
  }));

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const sessionList = sessionListRef.current;
    if (!sessionList) {
      return;
    }

    const updateHeight = () => {
      setSessionListMetrics((current) => ({
        ...current,
        height: sessionList.clientHeight,
        scrollTop: sessionList.scrollTop,
      }));
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(sessionList);

    return () => {
      resizeObserver.disconnect();
    };
  }, [authenticated, sidebarOpen]);

  useEffect(() => {
    return () => {
      if (sessionListScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(sessionListScrollFrameRef.current);
      }
    };
  }, []);

  const handleSessionListScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    sessionListScrollTopRef.current = event.currentTarget.scrollTop;
    if (sessionListScrollFrameRef.current !== null) {
      return;
    }

    sessionListScrollFrameRef.current = window.requestAnimationFrame(() => {
      sessionListScrollFrameRef.current = null;
      const nextScrollTop = sessionListScrollTopRef.current;
      setSessionListMetrics((current) => (
        current.scrollTop === nextScrollTop ? current : { ...current, scrollTop: nextScrollTop }
      ));
    });
  }, []);

  const virtualSessionList = useMemo(() => {
    const totalHeight = sessions.length === 0
      ? 0
      : sessions.length * SESSION_LIST_ITEM_STRIDE - SESSION_LIST_ITEM_GAP;
    const viewportHeight = sessionListMetrics.height || SESSION_LIST_ITEM_STRIDE * 12;
    const startIndex = Math.max(0, Math.floor(sessionListMetrics.scrollTop / SESSION_LIST_ITEM_STRIDE) - SESSION_LIST_OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / SESSION_LIST_ITEM_STRIDE) + SESSION_LIST_OVERSCAN * 2;
    const endIndex = Math.min(sessions.length, startIndex + visibleCount);

    return {
      items: sessions.slice(startIndex, endIndex),
      offsetY: startIndex * SESSION_LIST_ITEM_STRIDE,
      totalHeight,
    };
  }, [sessionListMetrics.height, sessionListMetrics.scrollTop, sessions]);

  const handlePasswordLogin = useCallback(
    async (password: string) => {
      const previewPassword = import.meta.env.VITE_PREVIEW_PASSWORD?.trim();
      if (previewPassword && password.trim() === previewPassword) {
        loginWithPreviewPassword();
        return;
      }
      try {
        await loginWithPassword(password);
      } catch {
        // store already exposes notification
      }
    },
    [loginWithPassword, loginWithPreviewPassword],
  );

  const handlePasskeyLogin = useCallback(async () => {
    try {
      await loginWithPasskey();
    } catch {
      // store already exposes notification
    }
  }, [loginWithPasskey]);

  const syncRouteToState = useCallback(async () => {
    const route = parseChatRoute(window.location.pathname);
    if (!route || route.kind === "new") {
      clearSession();
      if (window.location.pathname !== CHAT_NEW_PATH) {
        window.history.replaceState(null, "", CHAT_NEW_PATH);
      }
      return;
    }
    try {
      await selectSession(route.sessionId);
    } catch {
      clearSession();
      window.history.replaceState(null, "", CHAT_NEW_PATH);
    }
  }, [clearSession, selectSession]);

  useEffect(() => {
    if (!authReady || authenticated) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const autologin = params.get("autologin");
    const password = params.get("password");
    if (autologin === "1" && password) {
      void handlePasswordLogin(password);
      params.delete("autologin");
      params.delete("password");
      const nextSearch = params.toString();
      const nextPath = window.location.pathname + (nextSearch ? `?${nextSearch}` : "");
      window.history.replaceState(null, "", nextPath);
    }
  }, [authReady, authenticated, handlePasswordLogin]);

  useEffect(() => {
    if (!authReady || !authenticated) {
      routeSyncReadyRef.current = false;
      return;
    }
    if (routeSyncReadyRef.current) {
      return;
    }
    void syncRouteToState().finally(() => {
      routeSyncReadyRef.current = true;
    });
  }, [authReady, authenticated, syncRouteToState]);

  useEffect(() => {
    if (!authReady || !authenticated || !routeSyncReadyRef.current) {
      return;
    }
    const onPopState = () => {
      void syncRouteToState();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [authReady, authenticated, syncRouteToState]);

  useEffect(() => {
    if (!authReady || !authenticated || !routeSyncReadyRef.current) {
      return;
    }
    const targetPath = sessionId ? `/chat/${encodeURIComponent(sessionId)}` : CHAT_NEW_PATH;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
    }
  }, [authReady, authenticated, sessionId]);

  useEffect(
    () => () => {
      transitionTimers.current.forEach((id) => window.clearTimeout(id));
      transitionTimers.current = [];
    },
    [],
  );

  useEffect(() => {
    if (!settingsOpen || !authenticated) {
      return;
    }
    void Promise.all([refreshProfile(), refreshUsage(), refreshModels(), refreshPasskeys(), refreshWorkspaces(true)]);
  }, [settingsOpen, authenticated, refreshProfile, refreshUsage, refreshModels, refreshPasskeys, refreshWorkspaces]);

  useEffect(() => {
    if (!bootComplete || !authenticated || hasPlayedEntryAnimation.current) {
      return;
    }
    hasPlayedEntryAnimation.current = true;
    setTransitionState("curtain");
    const resetTimer = window.setTimeout(() => setTransitionState("idle"), 1200);
    transitionTimers.current.push(resetTimer);
  }, [bootComplete, authenticated]);

  const [displayedModel, setDisplayedModel] = useState(selectedModel);
  const [displayedSessionUsage, setDisplayedSessionUsage] = useState(sessionUsage);

  useEffect(
    () => () => {
      if (usageUpdateTimerRef.current !== null) {
        window.clearTimeout(usageUpdateTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const applyUpdate = () => {
      setDisplayedModel(selectedModel);
      setDisplayedSessionUsage(sessionUsage);
      lastUsageUpdateAtRef.current = Date.now();
      usageUpdateTimerRef.current = null;
    };

    const now = Date.now();
    const elapsed = now - lastUsageUpdateAtRef.current;
    const minInterval = 500;

    if (lastUsageUpdateAtRef.current === 0 || elapsed >= minInterval) {
      if (usageUpdateTimerRef.current !== null) {
        window.clearTimeout(usageUpdateTimerRef.current);
        usageUpdateTimerRef.current = null;
      }
      applyUpdate();
      return;
    }

    if (usageUpdateTimerRef.current !== null) {
      window.clearTimeout(usageUpdateTimerRef.current);
    }
    usageUpdateTimerRef.current = window.setTimeout(applyUpdate, minInterval - elapsed);
  }, [selectedModel, sessionUsage]);

  const visibleMessageCount = messages.filter((item) => item.role !== "system").length;
  const hasConversationStarted = visibleMessageCount > 0 || sendingMessage || streamingMessage.length > 0;

  useEffect(() => {
    setChatScrollY(0);
  }, [sessionId]);

  const fadeStart = 40;
  const fadeEnd = 80;
  const fadeRange = fadeEnd - fadeStart;
  const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
  const topbarCollapse = hasConversationStarted ? clamp01(chatScrollY / fadeEnd) : 0;
  const topbarHidden = topbarCollapse >= TOPBAR_INTERACTION_HIDE_THRESHOLD;
  const mainStyle: MainStyle = {
    "--ba-topbar-collapse": topbarCollapse,
  };
  const topbarStyle = {
    pointerEvents: topbarHidden ? "none" : "auto",
    visibility: topbarHidden ? "hidden" : "visible",
  } as CSSProperties;
  const topInfoOpacity = hasConversationStarted ? clamp01((fadeEnd - chatScrollY) / fadeRange) : 0;
  const bottomInfoOpacity = hasConversationStarted ? clamp01((chatScrollY - fadeEnd) / fadeRange) : 0;

  const tokenCount = Math.max(0, Number(displayedSessionUsage.total_tokens || 0));
  const topCostText = formatTopbarCurrency(displayedSessionUsage.total_cost_usd);
  const bottomCostText = formatBottomCurrency(displayedSessionUsage.total_cost_usd);
  const bottomUsageSimpleText = `TOKENS ${tokenCount}`;
  const bottomUsageDetailText = `TOKENS ${tokenCount} · ${bottomCostText}`;

  const triggerNewSession = () => {
    clearSession();
    setMenuSessionId(null);
    if (window.matchMedia("(max-width: 1079px)").matches) {
      setSidebarOpen(false);
    }
  };

  const closeRenameDialog = () => {
    setRenameSessionTarget(null);
    setRenameTitleInput("");
  };

  const handleRenameSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!renameSessionTarget) {
      return;
    }
    const nextTitle = renameTitleInput.trim();
    const currentTitle = renameSessionTarget.title.trim();
    if (!nextTitle) {
      pushToast("Title cannot be empty.", "error");
      return;
    }
    if (nextTitle === currentTitle) {
      closeRenameDialog();
      return;
    }
    try {
      await renameSession(renameSessionTarget.id, nextTitle);
      pushToast("Conversation renamed.", "success");
      closeRenameDialog();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Failed to rename conversation.", "error");
    }
  };


  const handleBootComplete = useCallback(() => {
    setBootComplete(true);
  }, []);

  if (!bootComplete || !authReady) {
    return <BootLoader onComplete={handleBootComplete} />;
  }

  if (!authenticated) {
    return (
      <div className="ba-app is-static-bg">
        <div className="ba-stage-bg" />
        <div className="ba-stage-overlay" />
        <AuthPanel loading={authLoading} onPasswordLogin={handlePasswordLogin} onPasskeyLogin={handlePasskeyLogin} previewAvailable={isPreviewAvailable()} />
        <ToastStack toasts={toasts} dismissToast={dismissToast} />
      </div>
    );
  }

  return (
    <div className={`ba-app ${profile?.dynamic_background ? "is-dynamic-bg" : "is-static-bg"}`}>
      {previewMode && (
        <div className="ba-preview-banner" role="status" aria-live="polite">
          ⚠ PREVIEW BUILD — Example data only · Changes are not persisted · No backend connection
        </div>
      )}
      <div className="ba-stage-bg" />
      <div className="ba-stage-overlay" />
      <div className="ba-stage-grid" />

      <aside className={`ba-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <header className="ba-sidebar-header">
          <div className="ba-sidebar-profile">
            <img src={profile?.avatar_url || "/ba/arona-logo.jpg"} alt="Avatar" />
            <div>
              <p>{profile?.username || "Sensei"}</p>
              <span>SCHALE TERMINAL</span>
            </div>
          </div>
          <button type="button" className="ba-ghost-btn" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </header>

        <div className="ba-sidebar-actions">
          <button type="button" className="ba-primary-btn" onClick={triggerNewSession}>
            <MessageSquarePlus size={16} />
            <span>New Chat</span>
          </button>
          <button
            type="button"
            className="ba-secondary-btn"
            onClick={() => {
                setAttachmentLibraryOpen(false);
                setLibraryOpen(false);
                setSettingsOpen(true);
              }}
          >
            <Settings2 size={16} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            className="ba-secondary-btn"
            onClick={() => {
              setSettingsOpen(false);
              setLibraryOpen(false);
              setAttachmentLibraryOpen(true);
              void (async () => {
                try {
                  await refreshAttachmentLibrary();
                } catch (error) {
                  pushToast(error instanceof Error ? error.message : "Failed to refresh attachment library.", "error");
                }
              })();
            }}
          >
            <FolderOpen size={16} />
            <span>Attachments</span>
          </button>
          <button
            type="button"
            className="ba-secondary-btn"
            onClick={() => {
              setSettingsOpen(false);
              setAttachmentLibraryOpen(false);
              setLibraryOpen(true);
              void (async () => {
                try {
                  await refreshLibrary();
                } catch (error) {
                  pushToast(error instanceof Error ? error.message : "Failed to refresh library.", "error");
                }
              })();
            }}
          >
            <FolderOpen size={16} />
            <span>Library</span>
          </button>
        </div>

        <div ref={sessionListRef} className="ba-session-list" onScroll={handleSessionListScroll}>
          {sessions.length > 0 ? (
            <>
              <div className="ba-session-list-spacer" style={{ height: virtualSessionList.totalHeight }}>
                <div className="ba-session-list-window" style={{ transform: `translateY(${virtualSessionList.offsetY}px)` }}>
                  {virtualSessionList.items.map((session) => (
                    <div key={session.id} className={`ba-session-item ${session.id === sessionId ? "is-active" : ""}`}>
                      <button
                        type="button"
                        className="ba-session-item-main"
                        onClick={() => {
                          setMenuSessionId(null);
                          void selectSession(session.id);
                          if (window.matchMedia("(max-width: 1079px)").matches) {
                            setSidebarOpen(false);
                          }
                        }}
                      >
                        <p>{session.title || "Untitled session"}</p>
                        {session.pinned_at ? <Pin size={12} className="ba-session-pin" aria-hidden="true" /> : null}
                      </button>
                      <button
                        type="button"
                        className="ba-session-menu-trigger"
                        aria-label="Session actions"
                        aria-expanded={menuSessionId === session.id}
                        aria-controls={`session-menu-${session.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuSessionId((current) => (current === session.id ? null : session.id));
                        }}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {menuSessionId === session.id ? (
                        <div
                          id={`session-menu-${session.id}`}
                          aria-label={`Actions for ${session.title || "Untitled session"}`}
                          className="ba-session-menu"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setMenuSessionId(null);
                              void autoGenerateSessionTitle(session.id).catch((error) => {
                                pushToast(error instanceof Error ? error.message : "Failed to auto-generate title.", "error");
                              });
                            }}
                          >
                            Auto-generate title
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuSessionId(null);
                              const currentTitle = (session.title || "").trim();
                              setRenameSessionTarget({ id: session.id, title: currentTitle });
                              setRenameTitleInput(currentTitle || "New conversation");
                            }}
                          >
                            Rename conversation
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuSessionId(null);
                              void pinSession(session.id, !session.pinned_at);
                            }}
                          >
                            {session.pinned_at ? "Unpin conversation" : "Pin conversation"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuSessionId(null);
                              void archiveSession(session.id, !session.archived_at);
                            }}
                          >
                            {session.archived_at ? "Unarchive conversation" : "Archive conversation"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              {sessionsHasMore && (
                <button
                  type="button"
                  className="ba-session-list-more"
                  disabled={sessionsLoadingMore}
                  onClick={() => void loadMoreSessions()}
                >
                  {sessionsLoadingMore ? "Loading..." : "Load More"}
                </button>
              )}
            </>
          ) : (
            <button type="button" className="ba-session-item is-empty" onClick={triggerNewSession}>
              <p>Create your first chat</p>
            </button>
          )}
        </div>
      </aside>

      <main className="ba-main" style={mainStyle}>
        <header className="ba-topbar" style={topbarStyle}>
          <button type="button" className="ba-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            <Menu size={20} />
          </button>
          <div className="ba-topbar-title">
            <img src="/ba/arona-logo.jpg" alt="Arona" />
            <div>
              <p>Arona</p>
              <span>SCHALE TERMINAL</span>
            </div>
          </div>
          {hasConversationStarted ? (
            <div
              className="ba-topbar-info"
              style={{ opacity: topInfoOpacity, pointerEvents: topInfoOpacity > 0 ? "auto" : "none" }}
            >
              <span>{displayedModel}</span>
              <span>{tokenCount} tokens</span>
              <strong>{topCostText}</strong>
            </div>
          ) : null}
        </header>

        <section className="ba-chat-shell">
          <ChatSession onScrollYChange={setChatScrollY} />
          <ChatInputArea />
        </section>

        <BottomDock
          onToggleSidebar={() => setSidebarOpen((current) => !current)}
          onNewSession={triggerNewSession}
          onToggleSettings={() => {
            setAttachmentLibraryOpen(false);
            setLibraryOpen(false);
            setSettingsOpen((current) => !current);
          }}
          onLogout={logout}
          showUsageInfo={hasConversationStarted}
          usageOpacity={bottomInfoOpacity}
          usageSimpleText={bottomUsageSimpleText}
          usageDetailText={bottomUsageDetailText}
          usageCurrencyText={bottomCostText}
        />
      </main>

      <button
        type="button"
        className={`ba-sidebar-mask ${sidebarOpen ? "is-visible" : ""}`}
        aria-label="Close sidebar backdrop"
        onClick={() => setSidebarOpen(false)}
      />

      <SettingsPanel
        open={settingsOpen}
        profile={profile}
        usage={usage}
        dailyUsage={dailyUsage}
        dailyUsageDate={dailyUsageDate}
        passkeys={passkeys}
        models={models}
        selectedModel={selectedModel}
        titleModel={titleModel}
        chatSettings={chatSettings}
        logLevel={logLevel}
        systemPromptTimezone={systemPromptTimezone}
        showArchivedSessions={showArchivedSessions}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        loading={authLoading}
        backendBuildHash={backendBuildHash}
        backendBuildTime={backendBuildTime}
        onClose={() => setSettingsOpen(false)}
        onSaveProfile={async (payload) => {
          try {
            await updateProfile(payload);
            pushToast("Profile saved.", "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to save profile.", "error");
          }
        }}
        onUploadAvatar={async (file) => {
          try {
            await uploadAvatar(file);
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to upload avatar.", "error");
          }
        }}
        onSetModel={async (model) => {
          try {
            await setSelectedModel(model);
            pushToast("Model updated.", "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to update model.", "error");
          }
        }}
        onSetTitleModel={async (model) => {
          try {
            await setTitleModel(model);
            pushToast("Title model updated.", "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to update title model.", "error");
          }
        }}
        onSaveChatSettings={async (payload) => {
          try {
            await setChatSettings(payload);
            pushToast("Generation settings updated.", "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to update generation settings.", "error");
          }
        }}
        onSetLogLevel={async (level) => {
          try {
            await setLogLevel(level);
            pushToast("Log level updated.", "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to update log level.", "error");
          }
        }}
        onSetSystemPromptTimezone={async (timezone) => {
          try {
            await setSystemPromptTimezone(timezone);
            pushToast("System prompt timezone updated.", "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to update timezone.", "error");
          }
        }}
        onSetShowArchivedSessions={async (show) => {
          try {
            await setShowArchivedSessions(show);
            pushToast("Conversation visibility updated.", "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to update conversation visibility.", "error");
          }
        }}
        onCreateWorkspace={async (name) => {
          try {
            await createWorkspace(name);
            pushToast("Workspace created.", "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to create workspace.", "error");
          }
        }}
        onRenameWorkspace={async (workspaceId, name) => {
          try {
            await renameWorkspace(workspaceId, name);
            pushToast("Workspace renamed.", "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to rename workspace.", "error");
          }
        }}
        onArchiveWorkspace={async (workspaceId, archived) => {
          try {
            await archiveWorkspace(workspaceId, archived);
            pushToast(archived ? "Workspace archived." : "Workspace enabled.", "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to update workspace status.", "error");
          }
        }}
        onActivateWorkspace={async (workspaceId) => {
          try {
            await activateWorkspace(workspaceId);
            pushToast("Workspace activated.", "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to activate workspace.", "error");
          }
        }}
        onSyncUsage={syncUsageAggregate}
        onRegisterPasskey={async (nickname) => {

          try {
            await registerPasskey(nickname);
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to register passkey.", "error");
          }
        }}
        onRemovePasskey={async (credentialId) => {
          try {
            await removePasskey(credentialId);
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to remove passkey.", "error");
          }
        }}
      />
      <AttachmentLibraryPanel
        open={attachmentLibraryOpen}
        loading={attachmentLibraryLoading}
        attachments={attachmentLibrary}
        onClose={() => setAttachmentLibraryOpen(false)}
        onRefresh={async () => {
          try {
            await refreshAttachmentLibrary();
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to refresh attachment library.", "error");
          }
        }}
        onDeleteAttachment={async (attachmentId) => {
          try {
            await deleteAttachment(attachmentId);
            pushToast("Attachment deleted.", "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to delete attachment.", "error");
          }
        }}
      />
      <LibraryPanel
        open={libraryOpen}
        loading={libraryLoading}
        items={libraryItems}
        onClose={() => setLibraryOpen(false)}
        onRefresh={async () => {
          try {
            await refreshLibrary();
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to refresh library.", "error");
          }
        }}
        onUploadFiles={async (files) => {
          try {
            await Promise.all(files.map((file) => uploadLibraryFile(file)));
            await refreshLibrary();
            pushToast("Files uploaded to Library.", "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to upload files.", "error");
          }
        }}
        onDeleteItem={async (attachmentId) => {
          try {
            await deleteLibraryItem(attachmentId);
            pushToast("Library file deleted.", "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Failed to delete library file.", "error");
          }
        }}
      />

      {renameSessionTarget ? (
        <div className="ba-modal-backdrop" role="presentation" onClick={closeRenameDialog}>
          <form
            className="ba-rename-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Rename conversation"
            onSubmit={(event) => void handleRenameSubmit(event)}
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Rename conversation</h3>
            <label htmlFor="ba-rename-conversation-input" className="ba-rename-modal-label">
              Conversation title
            </label>
            <input
              id="ba-rename-conversation-input"
              type="text"
              value={renameTitleInput}
              onChange={(event) => setRenameTitleInput(event.target.value)}
              maxLength={SESSION_TITLE_MAX_LENGTH}
              autoFocus
            />
            <div className="ba-rename-modal-actions">
              <button type="button" className="is-secondary" onClick={closeRenameDialog}>
                Cancel
              </button>
              <button type="submit">Save</button>
            </div>
          </form>
        </div>
      ) : null}

      {transitionState === "curtain" && (
        <div className="ba-transition ba-transition-curtain">
          <img src="/ba/shitim/Tran_Shitim_Icon.png" alt="Transition icon" />
        </div>
      )}

      <ToastStack toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
}

export default App;
