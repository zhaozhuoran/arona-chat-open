import { useState, useEffect } from "react";
import { Copy, Check, MessageSquare, AlertCircle, Loader2, ArrowLeft, FileText } from "lucide-react";
import type { SharedChatData, Message } from "@arona-chat/shared";
import { LazyMarkdown } from "./LazyMarkdown";
import { normalizeMessageMarkdown } from "../utils/normalizeMarkdown";
import { API_URL } from "../config";

const ARONA_AVATAR_SRC = "/ba/arona-logo.jpg";

export function SharedChatView({ token }: { token: string }) {
  const [data, setData] = useState<SharedChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Always force Ethereal Light theme for shared chat view
    document.body.classList.remove("theme-standard", "theme-ethereal-light", "theme-ethereal-dark");
    document.body.classList.add("theme-ethereal-light");
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        if (token === "preview-token" || token === "mock-token") {
          // Preview mock data for testing/verification
          setData({
            title: "Blue Archive Lore Discussion",
            allow_attachments: true,
            theme: "ethereal-light",
            created_at: Date.now() - 3600000,
            messages: Array.from({ length: 8 }).flatMap((_, i) => [
              {
                id: `msg-u-${i}`,
                session_id: "preview",
                role: "user",
                content: `Question ${i + 1}: Can you tell me more about academy ${i + 1} in Kivotos?`,
                created_at: Date.now() - (3500000 - i * 100000),
              },
              {
                id: `msg-a-${i}`,
                session_id: "preview",
                role: "assistant",
                content: `Academy ${i + 1} in Kivotos has unique lore and specialized student clubs. Sensei works closely with all student council leaders to maintain peace and order across the districts.\n\nKey features:\n- Unique academic curriculum\n- Specialized tactical equipment\n- Close cooperation with Schale`,
                created_at: Date.now() - (3400000 - i * 100000),
                reasoning_summary: `Detailed lore background analysis for Academy ${i + 1}.`,
              },
            ]),
          });
          return;
        }

        const res = await fetch(`${API_URL}/api/share/${encodeURIComponent(token)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as SharedChatData;
        if (active) {
          setData(json);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load shared conversation.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-[var(--arona-bg)] text-[var(--arona-text-p)]">
        <Loader2 size={32} className="animate-spin text-[var(--arona-primary)] mb-3" />
        <p className="text-sm font-semibold opacity-70">Loading shared conversation...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-[var(--arona-bg)] text-[var(--arona-text-p)] text-center">
        <div className="p-4 rounded-full bg-red-500/10 text-red-500 mb-4">
          <AlertCircle size={36} />
        </div>
        <h1 className="text-xl font-bold mb-2">Share Link Unavailable</h1>
        <p className="text-sm opacity-70 max-w-sm mb-6">
          {error || "This share link is expired, revoked, or invalid."}
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--arona-surface)] border border-[var(--arona-border-soft)] text-xs font-bold hover:bg-[var(--arona-border-soft)] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Go to Home</span>
        </a>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-y-auto bg-[var(--arona-bg)] text-[var(--arona-text-p)] selection:bg-[var(--arona-primary)]/20">
      {/* Minimal Read-only Header */}
      <header className="sticky top-0 z-30 px-4 py-3 border-b border-[var(--arona-border-soft)] bg-[var(--arona-bg)]/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[var(--arona-surface)] border border-[var(--arona-border-soft)] flex items-center justify-center shrink-0">
            <MessageSquare size={16} className="text-[var(--arona-primary)]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate leading-snug">{data.title || "Shared Chat"}</h1>
            <p className="text-[0.7rem] opacity-60 truncate">Read-only Shared Conversation</p>
          </div>
        </div>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--arona-surface)] border border-[var(--arona-border-soft)] text-xs font-semibold hover:bg-[var(--arona-border-soft)] transition-colors shrink-0"
        >
          <ArrowLeft size={13} />
          <span className="hidden sm:inline">Home</span>
        </a>
      </header>

      {/* Shared Messages Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {data.messages.length === 0 ? (
          <p className="text-center text-xs opacity-50 py-12">This conversation has no messages.</p>
        ) : (
          data.messages.map((msg) => (
            <SharedMessageRow key={msg.id} message={msg} allowAttachments={data.allow_attachments} />
          ))
        )}
      </main>

      <footer className="py-6 text-center text-[0.7rem] opacity-40 border-t border-[var(--arona-border-soft)]/40 mt-auto">
        Shared via Arona Chat
      </footer>
    </div>
  );
}

function SharedMessageRow({
  message,
  allowAttachments,
}: {
  message: Message;
  allowAttachments: boolean;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!message.content) return;
    void navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedTime = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  if (isUser) {
    return (
      <div className="ba-message-row is-user">
        <div className="ba-message is-user group relative">
          <div className="ba-message-head flex items-center justify-between gap-3 mb-1.5">
            <div className="ba-message-label">User</div>
            {formattedTime && <div className="ba-message-time">{formattedTime}</div>}
          </div>

          <div className="whitespace-pre-wrap break-words">{message.content}</div>

          {/* Attachments */}
          {allowAttachments && message.attachments && message.attachments.length > 0 && (
            <div className="ba-message-attachments mt-3">
              {message.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ba-message-attachment"
                >
                  {att.type === "image" ? (
                    <img
                      src={att.url}
                      alt={att.file_name}
                      className="ba-message-attachment-image ba-sdr-image"
                      loading="lazy"
                    />
                  ) : (
                    <div className="ba-message-attachment-icon">
                      <FileText size={20} />
                    </div>
                  )}
                  <span className="ba-message-attachment-name truncate">{att.file_name}</span>
                </a>
              ))}
            </div>
          )}

          {message.content && (
            <button
              type="button"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-[var(--arona-surface)] border border-[var(--arona-border-soft)] text-[var(--arona-text-s)] hover:text-[var(--arona-text-p)]"
              title="Copy content"
              onClick={handleCopy}
            >
              {copied ? <Check size={12} className="text-pink-500" /> : <Copy size={12} />}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ba-message-row is-assistant">
      <img className="ba-message-avatar" src={ARONA_AVATAR_SRC} alt="Arona" />

      <div className="ba-message is-assistant bubble-style-none group relative flex-1 min-w-0">
        <div className="ba-message-head flex items-center justify-between gap-3 mb-1.5">
          <div className="ba-message-label">Arona</div>
        </div>

        {/* Thinking / Reasoning process */}
        {message.reasoning_summary && (
          <details className="ba-message-reasoning mb-3">
            <summary className="select-none cursor-pointer font-semibold">
              Thought Process
            </summary>
            <pre>{message.reasoning_summary}</pre>
          </details>
        )}

        {/* Assistant Content Markdown */}
        <div className="ba-markdown break-words">
          <LazyMarkdown content={normalizeMessageMarkdown(message.content || "")} />
        </div>

        {/* Attachments */}
        {allowAttachments && message.attachments && message.attachments.length > 0 && (
          <div className="ba-message-attachments mt-3">
            {message.attachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noreferrer"
                className="ba-message-attachment"
              >
                {att.type === "image" ? (
                  <img
                    src={att.url}
                    alt={att.file_name}
                    className="ba-message-attachment-image ba-sdr-image"
                    loading="lazy"
                  />
                ) : (
                  <div className="ba-message-attachment-icon">
                    <FileText size={20} />
                  </div>
                )}
                <span className="ba-message-attachment-name truncate">{att.file_name}</span>
              </a>
            ))}
          </div>
        )}

        {/* Actions / Quick Copy button & timestamp */}
        <div className="ba-message-actions mt-2 flex items-center justify-between">
          <div className="ba-ethereal-actions">
            <button
              type="button"
              className="ba-message-action-trigger"
              aria-label="Copy message"
              title="Copy message"
              onClick={handleCopy}
            >
              {copied ? <Check size={14} className="text-pink-500" /> : <Copy size={14} />}
            </button>
          </div>
          {formattedTime && <div className="ba-message-time">{formattedTime}</div>}
        </div>
      </div>
    </div>
  );
}
