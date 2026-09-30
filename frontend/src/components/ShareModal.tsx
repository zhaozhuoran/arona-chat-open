import { useState, useEffect } from "react";
import { Check, Copy, ExternalLink, Globe, Loader2, Trash2, X } from "lucide-react";
import type { ChatShare, AppTheme } from "@arona-chat/shared";

interface ShareModalProps {
  sessionId: string;
  sessionTitle: string;
  userTheme?: AppTheme;
  onClose: () => void;
  listShares: (sessionId: string) => Promise<ChatShare[]>;
  createShare: (sessionId: string, payload?: { allow_attachments?: boolean; theme?: string; expires_in_seconds?: number | null }) => Promise<ChatShare>;
  updateShare: (token: string, payload: { allow_attachments?: boolean; theme?: string; expires_in_seconds?: number | null }) => Promise<void>;
  deleteShare: (token: string) => Promise<void>;
  pushToast: (message: string, type?: "success" | "error" | "info") => void;
}

const EXPIRE_OPTIONS = [
  { label: "1 Hour", value: 3600 },
  { label: "1 Day", value: 86400 },
  { label: "7 Days (Default)", value: 604800 },
  { label: "30 Days", value: 2592000 },
  { label: "Never", value: null },
];

export function ShareModal({
  sessionId,
  sessionTitle,
  onClose,
  listShares,
  createShare,
  updateShare,
  deleteShare,
  pushToast,
}: ShareModalProps) {
  const [shares, setShares] = useState<ChatShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Form options
  const [allowAttachments, setAllowAttachments] = useState(false);
  const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(604800);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        const data = await listShares(sessionId);
        if (active) {
          setShares(data);
        }
      } catch (err) {
        if (active) {
          pushToast(err instanceof Error ? err.message : "Failed to load shares", "error");
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
  }, [sessionId, listShares, pushToast]);

  const handleCreate = async () => {
    try {
      setCreating(true);
      const newShare = await createShare(sessionId, {
        allow_attachments: allowAttachments,
        theme: "ethereal-light",
        expires_in_seconds: expiresInSeconds,
      });
      setShares((prev) => [newShare, ...prev]);
      pushToast("Share link created successfully!", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Failed to create share link", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleAttachments = async (share: ChatShare) => {
    try {
      const nextAllow = !share.allow_attachments;
      await updateShare(share.token, {
        allow_attachments: nextAllow,
        theme: "ethereal-light",
      });
      setShares((prev) =>
        prev.map((s) => (s.token === share.token ? { ...s, allow_attachments: nextAllow, theme: "ethereal-light" } : s))
      );
      pushToast("Share permissions updated.", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Failed to update share", "error");
    }
  };

  const handleDelete = async (token: string) => {
    try {
      await deleteShare(token);
      setShares((prev) => prev.filter((s) => s.token !== token));
      pushToast("Share link revoked.", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Failed to revoke share link", "error");
    }
  };

  const getShareUrl = (token: string) => {
    return `${window.location.origin}/share/${token}`;
  };

  const copyToClipboard = (token: string) => {
    const url = getShareUrl(token);
    void navigator.clipboard.writeText(url);
    setCopiedToken(token);
    pushToast("Link copied to clipboard!", "success");
    setTimeout(() => {
      setCopiedToken(null);
    }, 2000);
  };

  return (
    <div className="ba-modal-backdrop ba-share-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ba-share-modal max-w-lg w-full !p-0 overflow-hidden rounded-2xl border border-[var(--arona-border-soft)] bg-[var(--arona-surface)] backdrop-blur-xl shadow-2xl animate-ba-modal-pop"
        role="dialog"
        aria-modal="true"
        aria-label="Share Conversation"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--arona-border-soft)]">
          <div className="flex items-center gap-2">
            <Globe className="text-[var(--arona-primary)]" size={20} />
            <h2 className="text-base sm:text-lg font-bold text-[var(--arona-text-p)]">Share Conversation</h2>
          </div>
          <button
            type="button"
            className="ba-ghost-btn flex items-center justify-center !p-1.5 rounded-lg text-[var(--arona-text-s)] hover:bg-[var(--arona-border-soft)]"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-4 sm:p-6 flex flex-col gap-5 overflow-y-auto max-h-[calc(85vh-65px)]">
          <div>
            <p className="text-xs font-semibold text-[var(--arona-text-s)] uppercase tracking-wider mb-1">
              Conversation
            </p>
            <p className="text-sm font-bold text-[var(--arona-text-p)] truncate">{sessionTitle || "Untitled Chat"}</p>
          </div>

          {/* Share Creation Box */}
          <div className="flex flex-col gap-4 p-3.5 sm:p-4 rounded-xl border border-[var(--arona-border-soft)] bg-[var(--arona-bg)]/60">
            <h3 className="text-sm font-bold text-[var(--arona-text-p)]">Create New Share Link</h3>

            <div>
              <label className="text-xs font-medium text-[var(--arona-text-s)] mb-1 block">Expiration</label>
              <select
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-[var(--arona-border-soft)] bg-[var(--arona-surface)] text-[var(--arona-text-p)] focus:outline-none focus:ring-2 focus:ring-[var(--arona-primary)]/20"
                value={expiresInSeconds === null ? "null" : expiresInSeconds}
                onChange={(e) =>
                  setExpiresInSeconds(e.target.value === "null" ? null : Number(e.target.value))
                }
              >
                {EXPIRE_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value === null ? "null" : opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[var(--arona-text-p)]">
                <input
                  type="checkbox"
                  className="rounded border-[var(--arona-border-soft)] text-[var(--arona-primary)] focus:ring-0"
                  checked={allowAttachments}
                  onChange={(e) => setAllowAttachments(e.target.checked)}
                />
                Allow visitors to view attachments
              </label>

              <button
                type="button"
                disabled={creating}
                className="ba-primary-btn !py-2 !px-4 !text-xs font-bold flex items-center justify-center gap-1.5 self-end sm:self-auto w-full sm:w-auto"
                onClick={handleCreate}
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                <span>Generate Link</span>
              </button>
            </div>
          </div>

          {/* Active Links List */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold text-[var(--arona-text-s)] uppercase tracking-wider">
              Active Share Links ({shares.length})
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-[var(--arona-text-s)]">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : shares.length === 0 ? (
              <p className="text-xs text-[var(--arona-text-s)] italic py-2">
                No active share links. Generate one above to share this conversation.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {shares.map((share) => {
                  const isExpired = share.expires_at && Date.now() > share.expires_at;
                  return (
                    <div
                      key={share.token}
                      className="p-3.5 rounded-xl border border-[var(--arona-border-soft)] bg-[var(--arona-bg)]/60 flex flex-col gap-2.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          readOnly
                          className="flex-1 bg-[var(--arona-surface)] px-2.5 py-1.5 rounded-md text-xs font-mono text-[var(--arona-text-p)] border border-[var(--arona-border-soft)] select-all focus:outline-none"
                          value={getShareUrl(share.token)}
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="ba-ghost-btn !p-1.5 rounded-md text-[var(--arona-text-s)] hover:text-[var(--arona-primary)] hover:bg-[var(--arona-surface)]"
                            title="Copy link"
                            onClick={() => copyToClipboard(share.token)}
                          >
                            {copiedToken === share.token ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                          </button>
                          <a
                            href={getShareUrl(share.token)}
                            target="_blank"
                            rel="noreferrer"
                            className="ba-ghost-btn !p-1.5 rounded-md text-[var(--arona-text-s)] hover:text-[var(--arona-primary)] hover:bg-[var(--arona-surface)] flex items-center justify-center"
                            title="Open in new tab"
                          >
                            <ExternalLink size={15} />
                          </a>
                          <button
                            type="button"
                            className="ba-ghost-btn !p-1.5 rounded-md text-red-500 hover:bg-red-50"
                            title="Revoke link"
                            onClick={() => handleDelete(share.token)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[0.75rem] text-[var(--arona-text-s)] pt-1 border-t border-[var(--arona-border-soft)]/50">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded text-[var(--arona-primary)] focus:ring-0"
                              checked={share.allow_attachments}
                              onChange={() => handleToggleAttachments(share)}
                            />
                            Attachments
                          </label>
                        </div>

                        <div>
                          {isExpired ? (
                            <span className="text-red-500 font-semibold">Expired</span>
                          ) : share.expires_at ? (
                            <span>Expires: {new Date(share.expires_at).toLocaleDateString()}</span>
                          ) : (
                            <span className="text-emerald-600 font-medium">Never Expires</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
