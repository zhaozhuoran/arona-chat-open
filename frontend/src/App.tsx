import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useShallow } from "zustand/react/shallow";
import type { FormEvent, UIEvent } from "react";
import type { CSSProperties } from "react";
import { FolderOpen, Menu, MessageSquarePlus, MoreHorizontal, Pin, Settings2, X } from "lucide-react";
import { BootLoader } from "./components/BootLoader";
import { ToastStack } from "./components/ToastStack";

const BottomDock = lazy(() => import("./components/BottomDock").then(m => ({ default: m.BottomDock })));
const ChatInputArea = lazy(() => import("./components/ChatInputArea").then(m => ({ default: m.ChatInputArea })));
const ChatSession = lazy(() => import("./components/ChatSession").then(m => ({ default: m.ChatSession })));
import { SESSION_TITLE_MAX_LENGTH } from "./constants/session";

const AttachmentLibraryPanel = lazy(() => import("./components/AttachmentLibraryPanel").then(m => ({ default: m.AttachmentLibraryPanel })));
const AuthPanel = lazy(() => import("./components/AuthPanel").then(m => ({ default: m.AuthPanel })));
const LibraryPanel = lazy(() => import("./components/LibraryPanel").then(m => ({ default: m.LibraryPanel })));
const SettingsPanel = lazy(() => import("./components/SettingsPanel").then(m => ({ default: m.SettingsPanel })));
import { useAuth } from "@clerk/clerk-react";
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

const IS_CLERK_AVAILABLE = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

function App() {
  const [bootComplete, setBootComplete] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia("(min-width: 1080px)").matches);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionInfoOpen, setSessionInfoOpen] = useState(false);
  const [topbarVisible, setTopbarVisible] = useState(true);
  const lastScrollY = useRef(0);
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
  const modelSelectorRef = useRef<HTMLDivElement>(null);

  const clerk = IS_CLERK_AVAILABLE ? useAuth() : null;
  const getToken = clerk?.getToken;
  const signOut = clerk?.signOut;
  const clerkIsLoaded = clerk?.isLoaded;
  const clerkIsSignedIn = clerk?.isSignedIn;

  const lastAuthInitializedRef = useRef<{
    isLoaded: boolean;
    isSignedIn: boolean;
  } | null>(null);

  const {
    theme,
    authReady,
    authLoading,
    authenticated,
    accessDenied,
    accessDeniedMessage,
    setAccessDenied,
    previewMode,
    backendBuildHash,
    backendBuildTime,
    instanceId,
    schemaVersion,
    sessions,
    sessionsHasMore,
    sessionsLoadingMore,
    sessionId,
    profile,
    usage,
    dailyUsage,
    dailyUsageDate,
    userLimits,
    sessionUsage,
    messages,
    sendingMessage,
    streamingMessage,
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
    aiProviders,
    aiProvidersLoading,
    aiModels,
    aiModelsLoading,
    encryptionKeyReady,
    isAdmin,
    canManageAi,
    limitsEnabled,
    adminUsers,
    adminUsersLoading,
    initialize,
    loginWithPassword,
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
    refreshAiProviders,
    createAiProvider,
    updateAiProvider,
    deleteAiProvider,
    refreshAiModels,
    createAiModel,
    updateAiModel,
    deleteAiModel,
    fetchUpstreamModels,
    refreshAdminUsers,
    updateUserPermissions,
    updateUserBudget,
    dismissToast,
    pushToast,
  } = useStore(useShallow((state) => ({
    theme: state.profile?.theme || "ethereal-light",
    authReady: state.authReady,
    authLoading: state.authLoading,
    authenticated: state.authenticated,
    accessDenied: state.accessDenied,
    accessDeniedMessage: state.accessDeniedMessage,
    setAccessDenied: state.setAccessDenied,
    previewMode: state.previewMode,
    backendBuildHash: state.backendBuildHash,
    backendBuildTime: state.backendBuildTime,
    instanceId: state.instanceId,
    schemaVersion: state.schemaVersion,
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
    userLimits: state.userLimits,
    sessionUsage: state.sessionUsage,
    messages: state.messages,
    sendingMessage: state.sendingMessage,
    streamingMessage: state.streamingMessage,
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
    aiProviders: state.aiProviders,
    aiProvidersLoading: state.aiProvidersLoading,
    aiModels: state.aiModels,
    aiModelsLoading: state.aiModelsLoading,
    encryptionKeyReady: state.encryptionKeyReady,
    isAdmin: state.isAdmin,
    canManageAi: state.canManageAi,
    limitsEnabled: state.limitsEnabled,
    adminUsers: state.adminUsers,
    adminUsersLoading: state.adminUsersLoading,
    toasts: state.toasts,
    initialize: state.initialize,
    loginWithPassword: state.loginWithPassword,
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
    refreshAiProviders: state.refreshAiProviders,
    createAiProvider: state.createAiProvider,
    updateAiProvider: state.updateAiProvider,
    deleteAiProvider: state.deleteAiProvider,
    refreshAiModels: state.refreshAiModels,
    createAiModel: state.createAiModel,
    updateAiModel: state.updateAiModel,
    deleteAiModel: state.deleteAiModel,
    fetchUpstreamModels: state.fetchUpstreamModels,
    refreshAdminUsers: state.refreshAdminUsers,
    updateUserPermissions: state.updateUserPermissions,
    updateUserBudget: state.updateUserBudget,
    dismissToast: state.dismissToast,
    pushToast: state.pushToast,
  })));

  useEffect(() => {
    if (IS_CLERK_AVAILABLE && clerkIsLoaded !== undefined) {
      if (!clerkIsLoaded) {
        return;
      }
      const currentIsSignedIn = Boolean(clerkIsSignedIn);
      const prev = lastAuthInitializedRef.current;
      if (prev && prev.isLoaded && prev.isSignedIn === currentIsSignedIn) {
        return;
      }
      lastAuthInitializedRef.current = { isLoaded: true, isSignedIn: currentIsSignedIn };
      void initialize(getToken);
    } else {
      if (lastAuthInitializedRef.current) {
        return;
      }
      lastAuthInitializedRef.current = { isLoaded: true, isSignedIn: false };
      void initialize(undefined);
    }
  }, [initialize, getToken, clerkIsLoaded, clerkIsSignedIn]);

  useEffect(() => {
    useStore.setState({ clerkGetToken: getToken ?? null });
  }, [getToken]);

  useEffect(() => {
    if (authReady) {
      setLoadError(null);
      return;
    }
    const timer = setTimeout(() => {
      if (!authReady) {
        if (IS_CLERK_AVAILABLE && !clerkIsLoaded) {
          setLoadError("Authentication Service (Clerk) is taking too long to load. This could be due to network connectivity issues or ad-blockers blocking Clerk CDN.");
        } else {
          setLoadError("SCHALE Terminal initialization is taking longer than expected. Please check your network connection or try refreshing the page.");
        }
      }
    }, 12000); // 12 seconds timeout

    return () => clearTimeout(timer);
  }, [authReady, clerkIsLoaded]);

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
    void Promise.all([
      refreshProfile(),
      refreshUsage(),
      refreshModels(),
      refreshWorkspaces(true),
      refreshAiProviders(),
      refreshAiModels()
    ]);
  }, [settingsOpen, authenticated, refreshProfile, refreshUsage, refreshModels, refreshWorkspaces, refreshAiProviders, refreshAiModels]);

  useEffect(() => {
    if (!bootComplete || !authenticated || hasPlayedEntryAnimation.current) {
      return;
    }
    hasPlayedEntryAnimation.current = true;
    setTransitionState("curtain");
    const resetTimer = window.setTimeout(() => setTransitionState("idle"), 1200);
    transitionTimers.current.push(resetTimer);
  }, [bootComplete, authenticated]);

  const displayedModelId = useMemo(() => {
    const matched = models.find((m) => m.id === selectedModel);
    return matched?.model_id || selectedModel;
  }, [models, selectedModel]);
  const [displayedModel, setDisplayedModel] = useState(displayedModelId);
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
      setDisplayedModel(displayedModelId);
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
  }, [displayedModelId, sessionUsage]);

  const visibleMessageCount = messages.filter((item) => item.role !== "system").length;
  const hasConversationStarted = visibleMessageCount > 0 || sendingMessage || streamingMessage.length > 0;

  useEffect(() => {
    setChatScrollY(0);
  }, [sessionId]);

  useEffect(() => {
    document.body.classList.remove("theme-standard", "theme-ethereal-light");
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  const fadeStart = 40;
  const fadeEnd = 80;
  const fadeRange = fadeEnd - fadeStart;
  const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
  const topbarCollapse = hasConversationStarted ? clamp01(chatScrollY / fadeEnd) : 0;
  const topbarHidden = topbarCollapse >= TOPBAR_INTERACTION_HIDE_THRESHOLD;
  const mainStyle: MainStyle = {
    "--ba-topbar-collapse": theme === "ethereal-light" ? 0 : topbarCollapse,
  };
  const topbarStyle = {
    pointerEvents: (theme !== "ethereal-light" && topbarHidden) ? "none" : "auto",
    visibility: (theme !== "ethereal-light" && topbarHidden) ? "hidden" : "visible",
  } as CSSProperties;

  const topbarTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (theme !== "ethereal-light") {
      if (topbarTimerRef.current !== null) {
        window.clearTimeout(topbarTimerRef.current);
        topbarTimerRef.current = null;
      }
      return;
    }

    if (topbarTimerRef.current !== null) {
      window.clearTimeout(topbarTimerRef.current);
      topbarTimerRef.current = null;
    }

    if (chatScrollY <= 20) {
      setTopbarVisible(true);
    } else if (chatScrollY < lastScrollY.current - 10) {
      setTopbarVisible(true);
    } else if (chatScrollY > lastScrollY.current) {
      // Scrolling down: hide instantly, but auto-reveal 1000ms after scrolling stops
      setTopbarVisible(false);
      topbarTimerRef.current = window.setTimeout(() => {
        setTopbarVisible(true);
        topbarTimerRef.current = null;
      }, 1000);
    } else {
      // Just in case we are scrolling down but not exceeding the threshold yet, setup the same debounce
      topbarTimerRef.current = window.setTimeout(() => {
        setTopbarVisible(true);
        topbarTimerRef.current = null;
      }, 1000);
    }

    lastScrollY.current = chatScrollY;

    return () => {
      if (topbarTimerRef.current !== null) {
        window.clearTimeout(topbarTimerRef.current);
        topbarTimerRef.current = null;
      }
    };
  }, [chatScrollY, theme]);

  useEffect(() => {
    if (!sessionInfoOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
        setSessionInfoOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sessionInfoOpen]);

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
    if (loadError) {
      return (
        <div className="ba-app is-static-bg">
          <div className="ba-stage-bg" />
          <div className="ba-stage-overlay" />
          <div className="ba-auth-screen z-[50]" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
            <div className="ba-auth-card" style={{ maxWidth: "450px", padding: "2rem", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <img src="/ba/arona-logo.jpg" alt="Arona" className="ba-auth-avatar" style={{ marginBottom: "1.5rem" }} />
              <h1 style={{ color: "#ef4444", fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>Initialization Timeout</h1>
              <p className="ba-auth-denied-message" style={{ fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "1.5rem" }}>
                {loadError}
              </p>
              <div style={{ display: "flex", gap: "1rem" }}>
                <button
                  type="button"
                  className="ba-auth-button primary"
                  onClick={() => window.location.reload()}
                >
                  <span>Refresh Page</span>
                </button>
                {isPreviewAvailable() && (
                  <button
                    type="button"
                    className="ba-auth-button"
                    style={{ backgroundColor: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.1)", color: "#333" }}
                    onClick={() => {
                      useStore.setState({ authReady: true, authenticated: true, previewMode: true });
                      sessionStorage.setItem("arona-chat.preview-mode", "1");
                      window.location.reload();
                    }}
                  >
                    <span>Preview Mode</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="ba-app is-static-bg">
        <div className="ba-stage-bg" />
        <div className="ba-stage-overlay" />
        <BootLoader onComplete={handleBootComplete} />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="ba-app is-static-bg">
        <div className="ba-stage-bg" />
        <div className="ba-stage-overlay" />
        <div className="ba-auth-screen">
          <div className="ba-auth-card">
            <img src="/ba/arona-logo.jpg" alt="Arona" className="ba-auth-avatar" />
            <h1>Access Denied</h1>
            <p className="ba-auth-denied-message">
              {accessDeniedMessage || "Your email is not on the authorized admin list."}
            </p>
            <button
              type="button"
              className="ba-auth-button primary"
              onClick={async () => {
                try {
                   if (signOut) await signOut();
                } catch {}
                setAccessDenied(false);
              }}
            >
              <span>Try Again</span>
            </button>
          </div>
        </div>
        <ToastStack toasts={toasts} dismissToast={dismissToast} />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="ba-app is-static-bg">
        <div className="ba-stage-bg" />
        <div className="ba-stage-overlay" />
        <Suspense fallback={<BootLoader onComplete={() => {}} />}>
          <AuthPanel loading={authLoading} onPasswordLogin={handlePasswordLogin} previewAvailable={isPreviewAvailable()} />
        </Suspense>
        <ToastStack toasts={toasts} dismissToast={dismissToast} />
      </div>
    );
  }

  const renderSidebar = () => {
    const isEthereal = theme === "ethereal-light";
    return (
      <aside className={`ba-sidebar ${sidebarOpen ? "is-open" : ""} ${isEthereal ? "ethereal" : ""}`}>
        <header className="ba-sidebar-header">
          <div className="ba-sidebar-profile">
            <img src={profile?.avatar_url || "/ba/arona-logo.jpg"} alt="Avatar" />
            <div>
              <p>{isEthereal ? "Arona Chat" : (profile?.username || "Sensei")}</p>
              <span>{isEthereal ? (profile?.username || "Sensei") : "SCHALE TERMINAL"}</span>
            </div>
          </div>
<button type="button" className="ba-ghost-btn flex items-center justify-center" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
              <X size={18} />
            </button>
        </header>

        <div className="ba-sidebar-actions">
          <button type="button" className="ba-primary-btn" onClick={triggerNewSession}>
            <MessageSquarePlus size={16} />
            <span>New Chat</span>
          </button>
          {!isEthereal && (
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
          )}
          {!isEthereal && (
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
          )}
          {!isEthereal && (
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
          )}
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

        {isEthereal && (
          <footer className="ba-sidebar-footer mt-auto flex flex-col gap-1 border-t border-[var(--arona-border-soft)] pt-3">
            <button
              type="button"
              className="ba-secondary-btn !justify-start"
              onClick={() => {
                setAttachmentLibraryOpen(false);
                setLibraryOpen(false);
                setSettingsOpen(true);
              }}
            >
              <Settings2 size={16} />
              <span>Settings</span>
            </button>
          </footer>
        )}
      </aside>
    );
  };

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

      {renderSidebar()}

      <main className={`ba-main ${theme === "ethereal-light" ? "ethereal" : ""}`} style={mainStyle}>
        {theme === "ethereal-light" ? (
          <>
            <button
              type="button"
              className="ba-menu-btn-circular fixed top-6 left-6 z-[26]"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <button
              type="button"
              className="ba-menu-btn-circular fixed top-6 left-[72px] z-[26]"
              onClick={triggerNewSession}
              aria-label="New chat"
              title="New chat"
            >
              <MessageSquarePlus size={20} />
            </button>
          </>
        ) : (
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
        )}

        <Suspense fallback={<div className="ba-chat-shell-loading" />}>
          <section className={`ba-chat-shell ${sidebarOpen ? "is-sidebar-open" : ""}`}>
            {theme === "ethereal-light" && (
              <div className={`ba-topbar-floating-container absolute top-6 left-0 right-0 z-[25] flex justify-center transition-all duration-300 ${(topbarVisible || sessionInfoOpen) ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"}`}>
                <div className="relative" ref={modelSelectorRef}>
                  <div
                    className="ba-topbar-model-selector-button flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--arona-border-soft)] bg-white/80 backdrop-blur-md text-[0.9rem] font-semibold text-[var(--arona-text-p)] cursor-pointer transition-all hover:bg-white hover:shadow-md"
                    onClick={() => setSessionInfoOpen(!sessionInfoOpen)}
                  >
                    {displayedModel}
                    <MoreHorizontal size={14} className="opacity-50" />
                  </div>

                  {sessionInfoOpen && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 bg-white/95 backdrop-blur-xl border border-[var(--arona-border-soft)] rounded-2xl shadow-xl p-4 z-[210] animate-ba-model-enter origin-top">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col">
                          <span className="text-[0.7rem] font-bold text-[var(--arona-text-t)] uppercase tracking-wider">Model</span>
                          <span className="text-sm font-semibold text-[var(--arona-text-p)] truncate">{displayedModel}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[0.7rem] font-bold text-[var(--arona-text-t)] uppercase tracking-wider">Tokens</span>
                          <span className="text-sm font-semibold text-[var(--arona-text-p)]">{tokenCount.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[0.7rem] font-bold text-[var(--arona-text-t)] uppercase tracking-wider">Cost</span>
                          <span className="text-sm font-semibold text-[var(--arona-text-p)]">{topCostText}</span>
                        </div>
                        <hr className="border-[var(--arona-border-soft)] my-1" />
                        <button
                          type="button"
                          className="w-full py-2 px-3 text-xs font-bold text-center rounded-lg bg-[var(--arona-bg)] text-[var(--arona-text-s)] hover:bg-[var(--arona-border-soft)] transition-colors"
                          onClick={() => {
                            setSessionInfoOpen(false);
                            setSettingsOpen(true);
                          }}
                        >
                          Open Full Settings
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <ChatSession onScrollYChange={setChatScrollY} />
            <ChatInputArea />
          </section>

          {theme !== "ethereal-light" && (
            <BottomDock
              onToggleSidebar={() => setSidebarOpen((current) => !current)}
              onNewSession={triggerNewSession}
              onToggleSettings={() => {
                setAttachmentLibraryOpen(false);
                setLibraryOpen(false);
                setSettingsOpen((current) => !current);
              }}
              onLogout={async () => {
                try {
                  if (signOut) {
                    await signOut();
                  }
                } catch (error) {
                  console.error("Clerk sign out failed:", error);
                } finally {
                  logout();
                }
              }}
              showUsageInfo={hasConversationStarted}
              usageOpacity={bottomInfoOpacity}
              usageSimpleText={bottomUsageSimpleText}
              usageDetailText={bottomUsageDetailText}
              usageCurrencyText={bottomCostText}
            />
          )}
        </Suspense>
      </main>

      <button
        type="button"
        className={`ba-sidebar-mask ${sidebarOpen ? "is-visible" : ""}`}
        aria-label="Close backdrop"
        onClick={() => {
          setSidebarOpen(false);
        }}
      />

      <Suspense fallback={null}>
        {settingsOpen && (
          <SettingsPanel
            open={settingsOpen}
            profile={profile}
            usage={usage}
            dailyUsage={dailyUsage}
            dailyUsageDate={dailyUsageDate}
            userLimits={userLimits}
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
            instanceId={instanceId}
            schemaVersion={schemaVersion}
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
            aiProviders={aiProviders}
            aiProvidersLoading={aiProvidersLoading}
            aiModels={aiModels}
            aiModelsLoading={aiModelsLoading}
            encryptionKeyReady={encryptionKeyReady}
            isAdmin={isAdmin}
            canManageAi={canManageAi}
            limitsEnabled={limitsEnabled}
            adminUsers={adminUsers}
            adminUsersLoading={adminUsersLoading}
            onRefreshAdminUsers={refreshAdminUsers}
            onUpdateUserPermissions={updateUserPermissions}
            onUpdateUserBudget={updateUserBudget}
            onCreateAiProvider={createAiProvider}
            onUpdateAiProvider={updateAiProvider}
            onDeleteAiProvider={deleteAiProvider}
            onCreateAiModel={createAiModel}
            onUpdateAiModel={updateAiModel}
            onDeleteAiModel={deleteAiModel}
            onFetchUpstreamModels={fetchUpstreamModels}
            onOpenAttachments={() => {
              setSettingsOpen(false);
              setLibraryOpen(false);
              setAttachmentLibraryOpen(true);
              void refreshAttachmentLibrary();
            }}
            onOpenLibrary={() => {
              setSettingsOpen(false);
              setAttachmentLibraryOpen(false);
              setLibraryOpen(true);
              void refreshLibrary();
            }}
            onLogout={async () => {
              try {
                if (signOut) {
                  await signOut();
                }
              } catch (error) {
                console.error("Clerk sign out failed:", error);
              } finally {
                logout();
              }
            }}
          />
        )}
        {attachmentLibraryOpen && (
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
        )}
        {libraryOpen && (
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
        )}
      </Suspense>

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
