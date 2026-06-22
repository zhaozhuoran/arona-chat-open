import { useEffect, useMemo, useRef, useState, memo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { ComponentType, MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { FileText, MoreHorizontal } from "lucide-react";
import type { Message, MessageAttachment } from "@arona-chat/shared";
import { useStore } from "../store/useStore";

const ARONA_AVATAR_SRC = "/ba/arona-logo.jpg";

const Markdown = ReactMarkdown as unknown as ComponentType<{
  children: string;
  remarkPlugins?: unknown[];
  rehypePlugins?: unknown[];
}>;

const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeKatex];

const normalizeMessageMarkdown = (content: string): string =>
  content
    .replace(/\\\(([\s\S]*?)\\\)/g, "$$$1$")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, group: string) => `$$${group}$$`);

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
};

const UserMessageRow = memo(({ message, username }: UserMessageRowProps) => {
  const messageTime = formatMessageTime(message.created_at);
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
          <Markdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
            {normalizeMessageMarkdown(message.content)}
          </Markdown>
        </div>
      </div>
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
  }: AssistantMessageRowProps) => {
    const message = group.messages[selectedIndex];
    const messageTime = formatMessageTime(message.created_at);
    const canSwitchVersion = group.messages.length > 1;

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
            <Markdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
              {normalizeMessageMarkdown(message.content)}
            </Markdown>
          </div>
          <div className="ba-message-actions">
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
                      disabled={selectedIndex >= group.messages.length - 1}
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
        </div>
      </div>
    );
  },
);

export const ChatSession = ({ onScrollYChange }: ChatSessionProps) => {
  const {
    sessionId,
    messages,
    streamingMessage,
    streamingReasoning,
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
    sessionId: state.sessionId,
    messages: state.messages,
    streamingMessage: state.streamingMessage,
    streamingReasoning: state.streamingReasoning,
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

  const bottomRef = useRef<HTMLDivElement>(null);
  const chatlogRef = useRef<HTMLDivElement>(null);
  const lastReportedScrollRef = useRef<number>(-1);
  const scrollRafRef = useRef<number | null>(null);
  const pendingScrollRef = useRef<number>(0);
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
  const hasStreamingAssistant = (streamingMessage.length > 0 || streamingReasoning.length > 0 || Boolean(activeStreamFailure)) && !lastMessageIsAssistant;
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

  useEffect(() => {
    const sessionChanged = sessionId !== lastSessionIdRef.current;
    lastSessionIdRef.current = sessionId;

    const countChanged = lastVisibleCountRef.current === null || visibleMessages.length !== lastVisibleCountRef.current;
    lastVisibleCountRef.current = visibleMessages.length;

    if (sessionChanged) {
      isAtBottomRef.current = true;
    }

    if (sessionChanged || countChanged) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const isStreaming = streamingMessage.length > 0 || streamingReasoning.length > 0;
    if (isStreaming && isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [sessionId, visibleMessages.length, streamingMessage, streamingReasoning]);

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

  return (
    <div
      ref={chatlogRef}
      className="ba-chatlog"
      onScroll={(event) => {
        const scrollElement = event.currentTarget;
        pendingScrollRef.current = scrollElement.scrollTop;
        isAtBottomRef.current = scrollElement.scrollHeight - scrollElement.clientHeight - scrollElement.scrollTop <= 24;
        if (scrollRafRef.current !== null) {
          return;
        }
        scrollRafRef.current = window.requestAnimationFrame(() => {
          scrollRafRef.current = null;
          const scrollTop = pendingScrollRef.current;
          if (scrollTop !== lastReportedScrollRef.current) {
            lastReportedScrollRef.current = scrollTop;
            onScrollYChange?.(scrollTop);
          }
        });
      }}
    >
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
              <Markdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
                {normalizeMessageMarkdown(streamFailureBody)}
              </Markdown>
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
          <div className="ba-message is-assistant">
            <div className="ba-message-head">
              <div className="ba-message-label">Arona</div>
            </div>
            {streamingReasoning && (
              <details className="ba-message-reasoning" open>
                <summary>Deep Thinking</summary>
                <pre>{streamingReasoning}</pre>
              </details>
            )}
            {streamingMessage && (
              <div className="ba-markdown">
                <Markdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
                  {normalizeMessageMarkdown(`${streamingMessage} ▌`)}
                </Markdown>
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} className="ba-chatlog-bottom" />
    </div>
  );
};
