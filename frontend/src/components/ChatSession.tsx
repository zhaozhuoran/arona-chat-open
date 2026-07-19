import { useEffect, useMemo, useRef, useState, memo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import type { MouseEvent, PointerEvent } from "react";
import { FileText, MoreHorizontal } from "lucide-react";
import type { Message, MessageAttachment } from "@arona-chat/shared";
import { useStore } from "../store/useStore";
import { LazyMarkdown } from "./LazyMarkdown";

const ARONA_AVATAR_SRC = "/ba/arona-logo.jpg";

export const truncateIncompleteMathBlocks = (text: string): string => {
  // Check for display math blocks $$
  const doubleDollarMatches = [...text.matchAll(/(?<!\\)\$\$/g)];
  if (doubleDollarMatches.length % 2 !== 0) {
    const lastIdx = doubleDollarMatches[doubleDollarMatches.length - 1].index;
    if (typeof lastIdx === "number") {
      text = text.slice(0, lastIdx);
    }
  }

  return text;
};

export const normalizeMessageMarkdown = (content: string): string => {
  let normalized = content
    .replace(/\\\(([\s\S]*?)\\\)/g, "$$$1$")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, group: string) => `$$${group}$$`);

  // Preprocess display math blocks to strip leading indentation (which otherwise parses as code blocks)
  const lines = normalized.split("\n");
  let insideMath = false;
  const processedLines = lines.map((line) => {
    const trimmed = line.trim();

    // Check if the line is a display math delimiter (ignoring blockquote markers)
    // Examples: "$$", "> $$", ">  $$", "   $$"
    const isDelimiter = /^(?:>\s*)*\$\$\s*$/.test(trimmed);

    if (isDelimiter) {
      insideMath = !insideMath;
      // Strip indentation for the delimiter line
      const blockquoteMatch = line.match(/^(\s*>\s*)+/);
      if (blockquoteMatch) {
        const prefix = blockquoteMatch[0];
        const normalizedPrefix = prefix.replace(/^\s+/, "");
        return normalizedPrefix + "$$";
      }
      return "$$";
    }

    if (insideMath) {
      // We are inside a display math block. Strip leading spaces/indentation.
      const blockquoteMatch = line.match(/^(\s*>\s*)+/);
      if (blockquoteMatch) {
        const prefix = blockquoteMatch[0];
        const normalizedPrefix = prefix.replace(/^\s+/, "");
        const contentAfterPrefix = line.slice(prefix.length).trim();
        return normalizedPrefix + contentAfterPrefix;
      }
      return trimmed;
    }

    return line;
  });
  normalized = processedLines.join("\n");

  // Ensure display math blocks ($$...$$) with weird whitespace are normalized for remark-math
  normalized = normalized.replace(/(?<!\\)\$\$(\s+)([\s\S]*?)(\s+)(?<!\\)\$\$/g, (match, _s1, formula, _s2) => {
    // If the matched display block contains a blockquote character, do not strip/trim it to avoid mangling blockquotes.
    if (match.includes(">")) {
      return match;
    }
    return `$$\n${formula.trim()}\n$$`;
  });

  return normalized;
};

const formatMessageTime = (value: number | null | undefined): string | null => {
  if (!Number.isFinite(value)) {
    return null;
  }
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const now = new Date();
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  if (sameDay) {
    return `${hh}:${mm}`;
  }
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${hh}:${mm}:${ss}`;
};

const MessageAttachments = ({ attachments }: { attachments: MessageAttachment[] }) => {
  if (attachments.length === 0) {
    return null;
  }
  return (
    <div className="ba-message-attachments">
      {attachments.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className={`ba-message-attachment is-${attachment.type}`}
          title={attachment.file_name}
        >
          {attachment.type === "image" ? (
            <img src={attachment.url} alt={attachment.file_name} className="ba-message-attachment-image ba-sdr-image" />
          ) : (
            <span className="ba-message-attachment-icon">
              <FileText size={16} />
            </span>
          )}
          <span className="ba-message-attachment-name">{attachment.file_name}</span>
        </a>
      ))}
    </div>
  );
};

type ChatSessionProps = {
  onScrollYChange?: (scrollY: number) => void;
};

type AssistantGroup = {
  groupKey: string;
  messages: Message[];
};

type RenderItem =
  | { kind: "user"; message: Message }
  | { kind: "assistant-group"; group: AssistantGroup };

type QuoteSelection = {
  messageId: string;
  text: string;
};

const buildRenderItems = (messages: Message[]): RenderItem[] => {
  const items: RenderItem[] = [];
  let currentGroup: AssistantGroup | null = null;
  let lastUserId: string | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      currentGroup = null;
      lastUserId = message.id;
      items.push({ kind: "user", message });
      continue;
    }
    if (message.role !== "assistant") {
      continue;
    }

    const groupKey = lastUserId ? `assistant-group-${lastUserId}` : `assistant-group-orphan-${message.id}`;
    if (!currentGroup || currentGroup.groupKey !== groupKey) {
      currentGroup = { groupKey, messages: [] };
      items.push({ kind: "assistant-group", group: currentGroup });
    }
    currentGroup.messages.push(message);
  }

  return items;
};

const buildQuoteMarkdown = (text: string): string =>
  text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");

const clampVersionIndex = (rawIndex: number | undefined, maxIndex: number): number => {
  if (!Number.isFinite(rawIndex)) {
    return maxIndex;
  }
  return Math.min(Math.max(Number(rawIndex), 0), maxIndex);
};

const isSelectionWithinTarget = (selection: Selection, target: HTMLElement): boolean => {
  const { anchorNode, focusNode } = selection;
  return Boolean(anchorNode && focusNode && target.contains(anchorNode) && target.contains(focusNode));
};

type UserMessageRowProps = {
  message: Message;
  username: string;
  avatarUrl?: string | null;
  theme: string;
};

const UserMessageRow = memo(({ message, username, avatarUrl, theme }: UserMessageRowProps) => {
  const messageTime = formatMessageTime(message.created_at);
  const isEthereal = theme === "ethereal-light";
  const userFallback = "/ba/shitim/Tran_Shitim_Icon.png";

  if (isEthereal) {
    return (
      <div className="ba-message-row is-user">
        <div className="ba-message is-user">
          {message.reasoning_summary && (
            <details className="ba-message-reasoning">
              <summary>Deep Thinking</summary>
              <pre>{message.reasoning_summary}</pre>
            </details>
          )}
          <MessageAttachments attachments={message.attachments ?? []} />
          <div className="ba-markdown">
            <LazyMarkdown content={normalizeMessageMarkdown(message.content)} />
          </div>
          {messageTime && (
            <div className="ba-message-actions">
              <div className="ba-message-time">{messageTime}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ba-message-row is-user">
      <div className="ba-message is-user">
        <div className="ba-message-head">
          <div className="ba-message-label">{username}</div>
          {messageTime && <div className="ba-message-time">{messageTime}</div>}
        </div>
        {message.reasoning_summary && (
          <details className="ba-message-reasoning">
            <summary>Deep Thinking</summary>
            <pre>{message.reasoning_summary}</pre>
          </details>
        )}
        <MessageAttachments attachments={message.attachments ?? []} />
        <div className="ba-markdown">
          <LazyMarkdown content={normalizeMessageMarkdown(message.content)} />
        </div>
      </div>
      <img src={avatarUrl || userFallback} alt="Sensei" className="ba-message-avatar" />
    </div>
  );
});

type AssistantMessageRowProps = {
  group: AssistantGroup;
  selectedIndex: number;
  menuOpen: boolean;
  canRegenerate: boolean;
  isQuoteSelected: boolean;
  onRegenerate: (groupKey: string, count: number) => void;
  onSetMenuOpen: (groupKey: string | null) => void;
  onSetSelectedIndex: (groupKey: string, index: number) => void;
  onCaptureSelection: (event: MouseEvent<HTMLDivElement>, messageId: string) => void;
  onApplyQuoteSelection: () => void;
  onCopyText: (content: string) => void;
  theme: string;
};

const AssistantMessageRow = memo(
  ({
    group,
    selectedIndex,
    menuOpen,
    canRegenerate,
    isQuoteSelected,
    onRegenerate,
    onSetMenuOpen,
    onSetSelectedIndex,
    onCaptureSelection,
    onApplyQuoteSelection,
    onCopyText,
    theme,
  }: AssistantMessageRowProps) => {
    const message = group.messages[selectedIndex];
    const messageTime = formatMessageTime(message.created_at);
    const canSwitchVersion = group.messages.length > 1;
    const isEthereal = theme === "ethereal-light";
    const profile = useStore((state) => state.profile);
    const aronaBubbleStyle = profile?.arona_bubble_style || "none";

    // Ethereal specific state
    const longPressTimerRef = useRef<number | null>(null);
    const jellyTimerRef = useRef<number | null>(null);
    const closeTimerRef = useRef<number | null>(null);
    const [isJelly, setIsJelly] = useState(false);
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
    const [isMenuHiding, setIsMenuHiding] = useState(false);

    const closeEtherealMenu = useCallback(() => {
      setIsMenuHiding(true);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(() => {
        setMenuPos(null);
        setIsMenuHiding(false);
        closeTimerRef.current = null;
      }, 150);
    }, [setIsMenuHiding, setMenuPos]);

    const handleLongPress = useCallback((x: number, y: number) => {
      setIsJelly(true);
      if (jellyTimerRef.current) window.clearTimeout(jellyTimerRef.current);
      jellyTimerRef.current = window.setTimeout(() => {
        setIsJelly(false);
        jellyTimerRef.current = null;
      }, 600);

      // Calculate menu position to keep it within screen
      const menuWidth = 240;
      const menuHeight = 40;
      let targetX = x - menuWidth / 2;
      let targetY = y - menuHeight - 10;

      targetX = Math.max(10, Math.min(window.innerWidth - menuWidth - 10, targetX));
      targetY = Math.max(10, targetY);

      setMenuPos({ x: targetX, y: targetY });
    }, []);

    const onPointerDown = (e: PointerEvent) => {
      if (!isEthereal) return;
      if (e.button !== 0 && e.button !== undefined) return; // Only left click or touch

      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = window.setTimeout(() => {
        handleLongPress(e.clientX, e.clientY);
        longPressTimerRef.current = null;
      }, 500);
    };

    const onPointerUp = () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    useEffect(() => {
      return () => {
        if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
        if (jellyTimerRef.current) window.clearTimeout(jellyTimerRef.current);
        if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      };
    }, []);

    const onContextMenu = (e: MouseEvent) => {
      if (!isEthereal) return;
      e.preventDefault();
      handleLongPress(e.clientX, e.clientY);
    };

    const renderActions = () => (
      <div className="ba-message-actions">
        {isEthereal && messageTime && <div className="ba-message-time">{messageTime}</div>}
        {isQuoteSelected ? (
          <button type="button" className="ba-message-action-secondary" onClick={onApplyQuoteSelection}>
            Quote Selection
          </button>
        ) : null}
        {canSwitchVersion ? (
          <span
            className="ba-message-version-indicator"
            aria-label={`Current version ${selectedIndex + 1} of ${group.messages.length} available versions`}
            title={`Version ${selectedIndex + 1} of ${group.messages.length}`}
          >
            Version {selectedIndex + 1}/{group.messages.length}
          </span>
        ) : null}
        <button
          type="button"
          className="ba-message-action-trigger"
          aria-label="Message actions"
          aria-expanded={menuOpen}
          aria-controls={`message-menu-${group.groupKey}`}
          onClick={() => onSetMenuOpen(menuOpen ? null : group.groupKey)}
        >
          <MoreHorizontal size={16} />
        </button>
        {menuOpen ? (
          <div id={`message-menu-${group.groupKey}`} className="ba-message-menu">
            <button type="button" onClick={() => onCopyText(message.content)}>
              Copy Text
            </button>
            {canRegenerate ? (
              <button type="button" onClick={() => onRegenerate(group.groupKey, group.messages.length)}>
                Regenerate Message
              </button>
            ) : null}
                {canSwitchVersion ? (
                  <>
                    <button
                      type="button"
                      disabled={selectedIndex <= 0}
                      onClick={() => {
                        onSetMenuOpen(null);
                        onSetSelectedIndex(group.groupKey, Math.max(0, selectedIndex - 1));
                      }}
                    >
                      Previous Version
                    </button>
                    <button
                      type="button"
                      disabled={selectedIndex >= group.messages.length - 1}
                      onClick={() => {
                        onSetMenuOpen(null);
                        onSetSelectedIndex(group.groupKey, Math.min(group.messages.length - 1, selectedIndex + 1));
                      }}
                    >
                      Next Version
                    </button>
                    <button
                      type="button"
                      disabled={selectedIndex < group.messages.length - 1}
                      onClick={() => {
                        onSetMenuOpen(null);
                        onSetSelectedIndex(group.groupKey, group.messages.length - 1);
                      }}
                    >
                      Latest Version
                    </button>
                  </>
                ) : null}
          </div>
        ) : null}
      </div>
    );

    if (isEthereal) {
      return (
        <div
          className="ba-message-row is-assistant"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onContextMenu={onContextMenu}
        >
          <img className="ba-message-avatar" src={ARONA_AVATAR_SRC} alt="Arona" />
          <div className={`ba-message is-assistant ${menuPos ? "is-interacting" : ""} ${isJelly ? "ba-message-jelly" : ""} bubble-style-${aronaBubbleStyle}`}>
            <div className="ba-message-head">
              <div className="ba-message-label">Arona</div>
            </div>
            {message.reasoning_summary && (
              <details className="ba-message-reasoning">
                <summary>Thought Process</summary>
                <pre>{message.reasoning_summary}</pre>
              </details>
            )}
            <MessageAttachments attachments={message.attachments ?? []} />
            <div className="ba-markdown" onMouseUp={(event) => onCaptureSelection(event, message.id)}>
              <LazyMarkdown content={normalizeMessageMarkdown(message.content)} />
            </div>
            {messageTime && (
              <div className="ba-message-actions">
                <div className="ba-message-time">{messageTime}</div>
              </div>
            )}
          </div>
          {menuPos && createPortal(
            <>
              <div
                className="fixed inset-0 z-[999]"
                onClick={closeEtherealMenu}
                onContextMenu={(e) => { e.preventDefault(); closeEtherealMenu(); }}
              />
              <div
                className={`ba-floating-menu ${isMenuHiding ? "is-hiding" : ""}`}
                style={{ left: menuPos.x, top: menuPos.y }}
              >
                <button className="ba-floating-menu-item" onClick={() => { onCopyText(message.content); closeEtherealMenu(); }}>
                  Copy
                </button>
                {canRegenerate && (
                  <button className="ba-floating-menu-item" onClick={() => { onRegenerate(group.groupKey, group.messages.length); closeEtherealMenu(); }}>
                    Regenerate
                  </button>
                )}
                {canSwitchVersion && (
                  <>
                    <button
                      className="ba-floating-menu-item"
                      disabled={selectedIndex <= 0}
                      onClick={() => { onSetSelectedIndex(group.groupKey, selectedIndex - 1); closeEtherealMenu(); }}
                    >
                      Prev
                    </button>
                    <button
                      className="ba-floating-menu-item"
                      disabled={selectedIndex >= group.messages.length - 1}
                      onClick={() => { onSetSelectedIndex(group.groupKey, selectedIndex + 1); closeEtherealMenu(); }}
                    >
                      Next
                    </button>
                  </>
                )}
              </div>
            </>,
            document.body
          )}
        </div>
      );
    }

    return (
      <div className="ba-message-row is-assistant">
        <img className="ba-message-avatar" src={ARONA_AVATAR_SRC} alt="Arona" />
        <div className="ba-message is-assistant">
          <div className="ba-message-head">
            <div className="ba-message-label">Arona</div>
            {messageTime && <div className="ba-message-time">{messageTime}</div>}
          </div>
          {message.reasoning_summary && (
            <details className="ba-message-reasoning">
              <summary>Deep Thinking</summary>
              <pre>{message.reasoning_summary}</pre>
            </details>
          )}
          <MessageAttachments attachments={message.attachments ?? []} />
          <div className="ba-markdown" onMouseUp={(event) => onCaptureSelection(event, message.id)}>
            <LazyMarkdown content={normalizeMessageMarkdown(message.content)} />
          </div>
          {renderActions()}
        </div>
      </div>
    );
  },
);

const ThinkingShimmer = () => {
  const [text, setText] = useState("Thinking...");
  const texts = ["Thinking...", "Analyzing...", "Processing...", "Reflecting..."];
  const indexRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % texts.length;
      setText(texts[indexRef.current]);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return <div className="thinking-title-shimmer">{text}</div>;
};

const useDripText = (content: string) => {
  const [displayed, setDisplayed] = useState("");
  const queueRef = useRef<string[]>([]);
  const timerRef = useRef<number | null>(null);
  const fullContentRef = useRef("");

  useEffect(() => {
    if (!content) {
      setDisplayed("");
      queueRef.current = [];
      fullContentRef.current = "";
      return;
    }
    if (content.length < fullContentRef.current.length || !content.startsWith(fullContentRef.current.slice(0, 10))) {
      setDisplayed("");
      queueRef.current = content.split("");
    } else {
      const added = content.slice(fullContentRef.current.length);
      if (added) queueRef.current.push(...added.split(""));
    }
    fullContentRef.current = content;
  }, [content]);

  useEffect(() => {
    const processQueue = () => {
      if (queueRef.current.length > 0) {
        let batchSize = 1;
        if (queueRef.current.length > 120) batchSize = 6;
        else if (queueRef.current.length > 60) batchSize = 3;
        const nextChars = queueRef.current.splice(0, batchSize).join("");
        setDisplayed(prev => prev + nextChars);
      }
      timerRef.current = window.setTimeout(processQueue, 25);
    };
    processQueue();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return displayed;
};

const DripMarkdown = memo(({ content }: { content: string }) => {
  const displayed = useDripText(content);
  const displayText = useMemo(() => truncateIncompleteMathBlocks(displayed), [displayed]);
  return <LazyMarkdown content={normalizeMessageMarkdown(displayText)} />;
});

const useBufferedChunks = (content: string, isActive: boolean, minThreshold = 400) => {
  const [chunks, setChunks] = useState<string[]>([]);
  const bufferRef = useRef<string>("");
  const fullContentRef = useRef<string>("");
  const isActiveRef = useRef(isActive);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    if (!content) {
      setChunks([]);
      bufferRef.current = "";
      fullContentRef.current = "";
      return;
    }
    if (content.length < fullContentRef.current.length || !content.startsWith(fullContentRef.current.slice(0, 10))) {
      setChunks([]);
      bufferRef.current = content;
    } else {
      const added = content.slice(fullContentRef.current.length);
      if (added) bufferRef.current += added;
    }
    fullContentRef.current = content;
  }, [content]);

  const tick = useCallback(() => {
    if (bufferRef.current.length === 0) {
      if (isActiveRef.current) {
        timerRef.current = window.setTimeout(tick, 100);
      } else {
        timerRef.current = null;
      }
      return;
    }

    const bLen = bufferRef.current.length;
    let chunkSize = 150; // Batch size (~50 tokens)
    let delay = 150;

    if (bLen > 1000) { chunkSize = 400; delay = 80; }
    else if (bLen > 400) { chunkSize = 200; delay = 120; }

    const nextChunk = bufferRef.current.slice(0, chunkSize);
    bufferRef.current = bufferRef.current.slice(chunkSize);
    setChunks(prev => [...prev, nextChunk]);
    timerRef.current = window.setTimeout(tick, delay);
  }, []);

  useEffect(() => {
    if (isActive && !timerRef.current) {
        const checkStart = () => {
            if (bufferRef.current.length >= minThreshold || !isActiveRef.current) {
                tick();
            } else {
                timerRef.current = window.setTimeout(checkStart, 50);
            }
        };
        checkStart();
    }
  }, [isActive, tick, minThreshold]);

  useEffect(() => {
    if (!isActive && bufferRef.current.length > 0 && !timerRef.current) {
        tick();
    }
  }, [isActive, tick]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return chunks;
};

const BufferedMarkdown = memo(({ content, isActive }: { content: string; isActive: boolean }) => {
  const chunks = useBufferedChunks(content, isActive);
  const fullText = useMemo(() => chunks.join(""), [chunks]);

  const displayText = useMemo(() => {
    if (!isActive) return fullText;
    return truncateIncompleteMathBlocks(fullText);
  }, [fullText, isActive]);

  return (
    <div className="ba-buffered-reveal">
      <LazyMarkdown content={normalizeMessageMarkdown(displayText)} />
    </div>
  );
});

const BufferedText = memo(({ content, isActive }: { content: string; isActive: boolean }) => {
  const chunks = useBufferedChunks(content, isActive, 0);
  return (
    <>
      {chunks.map((chunk, i) => (
        <span key={i} className="ba-fade-up inline-block whitespace-pre-wrap">{chunk}</span>
      ))}
    </>
  );
});

const DripText = memo(({ content }: { content: string }) => {
  const displayed = useDripText(content);
  return <>{displayed}</>;
});

export const ChatSession = ({ onScrollYChange }: ChatSessionProps) => {
  const {
    theme,
    sessionId,
    messages,
    streamingMessage,
    streamingReasoning,
    streamingThinkingTopic,
    streamRecovery,
    streamFailure,
    loadingMessages,
    sendingMessage,
    profile,
    regenerateLastMessage,
    reconnectStream,
    waitForStreamCompletion,
    pushToast,
  } = useStore(useShallow((state) => ({
    theme: state.profile?.theme || "ethereal-light",
    sessionId: state.sessionId,
    messages: state.messages,
    streamingMessage: state.streamingMessage,
    streamingReasoning: state.streamingReasoning,
    streamingThinkingTopic: state.streamingThinkingTopic,
    streamRecovery: state.streamRecovery,
    streamFailure: state.streamFailure,
    loadingMessages: state.loadingMessages,
    sendingMessage: state.sendingMessage,
    profile: state.profile,
    regenerateLastMessage: state.regenerateLastMessage,
    reconnectStream: state.reconnectStream,
    waitForStreamCompletion: state.waitForStreamCompletion,
    pushToast: state.pushToast,
  })));

  const aronaBubbleStyle = profile?.arona_bubble_style || "none";
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatlogRef = useRef<HTMLDivElement>(null);
  const lastReportedScrollRef = useRef<number>(-1);
  const scrollRafRef = useRef<number | null>(null);
  const pendingScrollRef = useRef<number>(0);
  const scrollThreshold = 80;
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const [menuOpenForGroupKey, setMenuOpenForGroupKey] = useState<string | null>(null);
  const [selectedAssistantIndexByGroup, setSelectedAssistantIndexByGroup] = useState<Record<string, number>>({});
  const [quoteSelection, setQuoteSelection] = useState<QuoteSelection | null>(null);
  const visibleMessages = useMemo(() => messages.filter((item) => item.role !== "system"), [messages]);
  const renderItems = useMemo(() => buildRenderItems(visibleMessages), [visibleMessages]);
  const isAtBottomRef = useRef(true);
  const lastVisibleCountRef = useRef<number | null>(null);
  const lastSessionIdRef = useRef<typeof sessionId | null>(null);
  const lastVisibleMessage = visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1] : null;
  const lastMessageIsAssistant = lastVisibleMessage?.role === "assistant";
  const activeStreamFailure = streamFailure?.session_id === sessionId ? streamFailure : null;
  const hasStreamingAssistant = (streamingMessage.length > 0 || streamingReasoning.length > 0 || streamingThinkingTopic.length > 0 || Boolean(activeStreamFailure)) && !lastMessageIsAssistant;
  const streamFailureBody = activeStreamFailure
    ? (activeStreamFailure.content.trim() || activeStreamFailure.error)
    : "";
  const hasRegenerateInProgress = loadingMessages || sendingMessage || hasStreamingAssistant;
  const activeRecovery = streamRecovery?.session_id === sessionId ? streamRecovery : null;
  const showCenteredRegenerate = !activeRecovery && !hasRegenerateInProgress && !activeStreamFailure && lastVisibleMessage?.role === "user";
  const lastRenderItem = renderItems.length > 0 ? renderItems[renderItems.length - 1] : null;
  const latestAssistantGroupKey =
    lastRenderItem && lastRenderItem.kind === "assistant-group" && lastVisibleMessage?.role === "assistant"
      ? lastRenderItem.group.groupKey
      : null;
  const canReconnectSse = Boolean(activeRecovery?.job_id) && activeRecovery?.mode === "disconnected";
  const canWaitForCompletion = Boolean(activeRecovery) && activeRecovery.mode === "disconnected";
  const recoveryTitle =
    activeRecovery?.mode === "waiting"
      ? "Waiting for completion"
      : activeRecovery?.job_id
        ? "Connection interrupted"
        : "Backend may still be generating";
  const recoveryDescription =
    activeRecovery?.last_error
    || (activeRecovery?.job_id
      ? "The reply is still being generated. You can reconnect to the live stream or keep waiting."
      : activeRecovery?.mode === "waiting"
        ? "Checking the server for the latest reply."
        : "The reply may still be generating in the background. You can keep waiting.");

  const lastScrollHeightRef = useRef<number>(0);

  const lastTopicRef = useRef("");
  const topicKeyRef = useRef(0);
  const [topicKey, setTopicKey] = useState("none");

  useEffect(() => {
    if (!streamingThinkingTopic) {
      lastTopicRef.current = "";
      setTopicKey("none");
      return;
    }
    if (
      !lastTopicRef.current ||
      !streamingThinkingTopic.startsWith(lastTopicRef.current) ||
      streamingThinkingTopic.length < lastTopicRef.current.length
    ) {
      topicKeyRef.current += 1;
    }
    lastTopicRef.current = streamingThinkingTopic;
    setTopicKey(`topic-${topicKeyRef.current}`);
  }, [streamingThinkingTopic]);

  useEffect(() => {
    const sessionChanged = sessionId !== lastSessionIdRef.current;
    lastSessionIdRef.current = sessionId;

    const countChanged = lastVisibleCountRef.current === null || visibleMessages.length !== lastVisibleCountRef.current;
    lastVisibleCountRef.current = visibleMessages.length;

    if (sessionChanged) {
      isAtBottomRef.current = true;
    }

    if (sessionChanged || countChanged) {
      setIsUserScrolledUp(false);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const isStreaming = streamingMessage.length > 0 || streamingReasoning.length > 0 || streamingThinkingTopic.length > 0;
    const currentScrollHeight = chatlogRef.current?.scrollHeight || 0;
    const heightChanged = currentScrollHeight !== lastScrollHeightRef.current;
    lastScrollHeightRef.current = currentScrollHeight;

    if ((isStreaming || heightChanged) && !isUserScrolledUp) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [sessionId, visibleMessages.length, streamingMessage, streamingReasoning, streamingThinkingTopic, isUserScrolledUp]);

  useEffect(() => {
    if (!chatlogRef.current) return;
    const contentEl = chatlogRef.current.querySelector(".ba-chatlog-content");
    if (!contentEl) return;

    const observer = new ResizeObserver(() => {
      if (!isUserScrolledUp) {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
      }
    });

    observer.observe(contentEl);
    return () => observer.disconnect();
  }, [isUserScrolledUp]);

  useEffect(
    () => () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    setMenuOpenForGroupKey(null);
  }, [visibleMessages.length]);

  useEffect(() => {
    if (quoteSelection && !visibleMessages.some((message) => message.id === quoteSelection.messageId)) {
      setQuoteSelection(null);
    }
  }, [quoteSelection, visibleMessages]);

  const handleRegenerateClick = (groupKey?: string, currentVersionCount?: number) => {
    setMenuOpenForGroupKey(null);
    if (groupKey && Number.isFinite(currentVersionCount)) {
      setSelectedAssistantIndexByGroup((current) => ({
        ...current,
        [groupKey]: Number(currentVersionCount),
      }));
    }
    void regenerateLastMessage().catch((error) => {
      console.error("Failed to regenerate message", error);
    });
  };

  const handleReconnectClick = () => {
    void reconnectStream().catch((error) => {
      console.error("Failed to reconnect stream", error);
    });
  };

  const handleWaitClick = () => {
    void waitForStreamCompletion().catch((error) => {
      console.error("Failed to wait for stream completion", error);
    });
  };

  const handleRetryClick = () => {
    void regenerateLastMessage().catch((error) => {
      console.error("Failed to retry message", error);
    });
  };

  const captureAssistantSelection = (event: MouseEvent<HTMLDivElement>, messageId: string) => {
    const selection = window.getSelection();
    if (!selection) {
      setQuoteSelection(null);
      return;
    }
    const selectedText = selection.toString().trim();
    if (!selectedText) {
      setQuoteSelection((current) => (current?.messageId === messageId ? null : current));
      return;
    }
    if (!isSelectionWithinTarget(selection, event.currentTarget)) {
      return;
    }
    setQuoteSelection({ messageId, text: selectedText });
  };

  const applyQuoteSelection = () => {
    if (!quoteSelection) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent("ba:insert-quote", {
        detail: { text: buildQuoteMarkdown(quoteSelection.text) },
      }),
    );
    setQuoteSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const scrollToBottom = () => {
    setIsUserScrolledUp(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const scrollElement = event.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = scrollElement;
    pendingScrollRef.current = scrollTop;

    // Use ResizeObserver-like logic indirectly or rely on SSE updates
    // But for "Thinking" block expansion specifically:
    const distanceFromBottom = scrollHeight - clientHeight - scrollTop;
    const isAtBottom = distanceFromBottom <= scrollThreshold;
    isAtBottomRef.current = isAtBottom;

    if (isAtBottom) {
       setIsUserScrolledUp(false);
    } else {
       setIsUserScrolledUp(true);
    }

    if (scrollRafRef.current !== null) {
      return;
    }
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const st = pendingScrollRef.current;
      if (st !== lastReportedScrollRef.current) {
        lastReportedScrollRef.current = st;
        onScrollYChange?.(st);
      }
    });
  };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {theme === "ethereal-light" && (
        <>
          <div className="ba-chat-fade-top" />
          <div className="ba-chat-fade-bottom" />
        </>
      )}
      <div
        ref={chatlogRef}
        className="ba-chatlog"
        onScroll={handleScroll}
      >
        <div className="ba-chatlog-content">
      {visibleMessages.length === 0 && !loadingMessages && (
        <div className="ba-chatlog-empty">
          <p className="ba-chatlog-empty-title">Sensei, welcome back.</p>
          <p className="ba-chatlog-empty-subtitle">Start a new conversation or pick one from the sidebar.</p>
        </div>
      )}

      {loadingMessages && (
        <div className="ba-chatlog-loading">
          <div className="ba-spinner" />
        </div>
      )}

      {renderItems.map((item) => {
        if (item.kind === "user") {
          return (
            <UserMessageRow
              key={item.message.id}
              message={item.message}
              username={profile?.username || "You"}
              avatarUrl={profile?.avatar_url}
              theme={theme}
            />
          );
        }

        const { group } = item;
        const selectedIndexRaw = selectedAssistantIndexByGroup[group.groupKey];
        const selectedIndex = clampVersionIndex(selectedIndexRaw, group.messages.length - 1);
        const message = group.messages[selectedIndex];

        return (
          <AssistantMessageRow
            key={group.groupKey}
            group={group}
            selectedIndex={selectedIndex}
            menuOpen={menuOpenForGroupKey === group.groupKey}
            canRegenerate={!hasRegenerateInProgress && latestAssistantGroupKey === group.groupKey}
            isQuoteSelected={quoteSelection?.messageId === message.id}
            onRegenerate={handleRegenerateClick}
            onSetMenuOpen={setMenuOpenForGroupKey}
            onSetSelectedIndex={(key, index) =>
              setSelectedAssistantIndexByGroup((current) => ({ ...current, [key]: index }))
            }
            onCaptureSelection={captureAssistantSelection}
            onApplyQuoteSelection={applyQuoteSelection}
            onCopyText={(content) => {
              try {
                void navigator.clipboard
                  .writeText(content)
                  .then(() => {
                    setMenuOpenForGroupKey(null);
                    pushToast("Copied!", "success");
                  })
                  .catch(() => {
                    pushToast("Failed to copy text.", "error");
                  });
              } catch {
                pushToast("Failed to copy text.", "error");
              }
            }}
            theme={theme}
          />
        );
      })}

      {activeStreamFailure && (
        <div className="ba-message-row is-assistant">
          <img className="ba-message-avatar" src={ARONA_AVATAR_SRC} alt="Arona" />
          <div className="ba-message is-assistant is-error">
            <div className="ba-message-head">
              <div className="ba-message-label">Arona</div>
              {formatMessageTime(activeStreamFailure.created_at) && (
                <div className="ba-message-time">{formatMessageTime(activeStreamFailure.created_at)}</div>
              )}
            </div>
            {activeStreamFailure.reasoning && (
              <details className="ba-message-reasoning" open>
                <summary>Deep Thinking</summary>
                <pre>{activeStreamFailure.reasoning}</pre>
              </details>
            )}
            <div className="ba-markdown">
              <LazyMarkdown content={normalizeMessageMarkdown(streamFailureBody)} />
            </div>
            <div className="ba-message-failure-note">
              This reply was not saved.
            </div>
            <div className="ba-message-actions">
              <button type="button" className="ba-message-action-secondary" onClick={handleRetryClick}>
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {showCenteredRegenerate && (
        <div className="ba-chatlog-regenerate-wrap">
          <button type="button" className="ba-chatlog-regenerate-btn" onClick={() => handleRegenerateClick()}>
            Regenerate Message
          </button>
        </div>
      )}

      {activeRecovery && (
        <div className="ba-stream-recovery" role="status" aria-live="polite">
          <div className="ba-stream-recovery-text">
            <strong>{recoveryTitle}</strong>
            <span>{recoveryDescription}</span>
          </div>
          <div className="ba-stream-recovery-actions">
            {canReconnectSse ? (
              <button type="button" onClick={handleReconnectClick} disabled={activeRecovery.mode !== "disconnected"}>
                Reconnect live stream
              </button>
            ) : null}
            {canWaitForCompletion ? (
              <button type="button" onClick={handleWaitClick} disabled={activeRecovery.mode !== "disconnected"}>
                Keep waiting
              </button>
            ) : null}
          </div>
        </div>
      )}

      {hasStreamingAssistant && !activeStreamFailure && (
        <div className="ba-message-row is-assistant">
          <img className="ba-message-avatar" src={ARONA_AVATAR_SRC} alt="Arona" />
          <div className={`ba-message is-assistant ${theme === "ethereal-light" ? `bubble-style-${aronaBubbleStyle}` : ""}`}>
            <div className="ba-message-head">
              <div className="ba-message-label">Arona</div>
            </div>
            {theme === "ethereal-light" ? (
              (streamingThinkingTopic && !streamingMessage) ? (
                <div key={topicKey} className="ba-thinking-topic is-streaming">
                  {profile?.ethereal_streaming_style === "buffered" ? (
                    <BufferedText content={streamingThinkingTopic} isActive={true} />
                  ) : (
                    <DripText content={streamingThinkingTopic} />
                  )}
                </div>
              ) : null
            ) : (
              streamingReasoning && (
                <details className="ba-message-reasoning" open>
                  <summary>Deep Thinking</summary>
                  <pre>{streamingReasoning}</pre>
                </details>
              )
            )}
            {streamingMessage && (
              <div className="ba-markdown is-streaming">
                {theme === "ethereal-light" ? (
                  profile?.ethereal_streaming_style === "buffered" ? (
                    <BufferedMarkdown content={streamingMessage} isActive={true} />
                  ) : (
                    <DripMarkdown content={streamingMessage} />
                  )
                ) : (
                  <LazyMarkdown content={normalizeMessageMarkdown(`${streamingMessage} ▌`)} />
                )}
              </div>
            )}
            {!streamingMessage && !streamingThinkingTopic && theme === "ethereal-light" && (
               <div className="flex items-center gap-2 mb-2">
                 <span className="ba-thinking-orb" aria-hidden="true">
                   <svg viewBox="0 0 40 40"><defs>
                     <filter id="ethereal-blob">
                       <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3">
                         <animate attributeName="baseFrequency" dur="14s" values="0.02;0.035;0.02" repeatCount="indefinite"/>
                       </feTurbulence>
                       <feDisplacementMap in="SourceGraphic" scale="6"/>
                     </filter>
                     <radialGradient id="ethereal-glow">
                       <stop offset="0%" stopColor="#77DEFF"/>
                       <stop offset="100%" stopColor="#F0F9FF"/>
                     </radialGradient>
                   </defs>
                     <path transform="translate(0, 4)" filter="url(#ethereal-blob)" fill="url(#ethereal-glow)"
                       d="M20 4c8 0 16 4 16 12s-6 12-14 12-16-4-16-12 6-12 14-12z"/>
                   </svg>
                 </span>
                 <div className="ba-thinking-topic" style={{ marginBottom: 0 }}>
                    <ThinkingShimmer />
                 </div>
               </div>
            )}
          </div>
        </div>
      )}

          <div ref={bottomRef} className="ba-chatlog-bottom" />
        </div>
      </div>
      {theme === "ethereal-light" && hasStreamingAssistant && isUserScrolledUp && (
        <div className="ba-scroll-to-bottom-wrap">
          <button type="button" className="ba-scroll-to-bottom-btn" onClick={scrollToBottom}>
            <span className="ba-scroll-to-bottom-icon">⬇</span>
            New Messages
          </button>
        </div>
      )}
    </div>
  );
};
