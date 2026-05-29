import { useState } from "react";
import { Download, ExternalLink, RefreshCw, Trash2, X } from "lucide-react";
import type { AttachmentLibraryItem } from "../store/useStore";

type AttachmentLibraryPanelProps = {
  open: boolean;
  loading: boolean;
  attachments: AttachmentLibraryItem[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
};

const formatTime = (value: number): string => {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "Unknown time";
  }
  return new Date(timestamp).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const formatSize = (size: number): string => {
  const value = Math.max(0, Number(size) || 0);
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export const AttachmentLibraryPanel = ({
  open,
  loading,
  attachments,
  onClose,
  onRefresh,
  onDeleteAttachment,
}: AttachmentLibraryPanelProps) => {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  return (
    <div className="ba-modal-backdrop ba-panel-backdrop" role="presentation" onClick={onClose}>
      <section className="ba-panel-modal ba-attachment-library-panel" role="dialog" aria-modal="true" aria-label="Attachments" onClick={(event) => event.stopPropagation()}>
        <header className="ba-attachment-library-header">
          <div>
            <p>Attachments</p>
            <span>Uploaded files used in conversations</span>
          </div>
          <div className="ba-attachment-library-header-actions">
            <button type="button" onClick={() => void onRefresh()} aria-label="Refresh attachments" disabled={loading}>
              <RefreshCw size={16} />
            </button>
            <button type="button" onClick={onClose} aria-label="Close attachments">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="ba-attachment-library-list">
          {attachments.length === 0 && <p className="ba-muted-text">{loading ? "Loading attachments..." : "No uploaded attachments yet."}</p>}
          {attachments.map((attachment) => {
            const deleting = busyId === attachment.id;
            return (
              <div key={attachment.id} className="ba-attachment-library-item">
                <div className="ba-attachment-library-item-meta">
                  <p title={attachment.file_name}>{attachment.file_name}</p>
                  <span>{formatTime(attachment.created_at)}</span>
                  <span>
                    {attachment.mime_type} · {formatSize(attachment.size)}
                  </span>
                </div>
                <div className="ba-attachment-library-item-actions">
                  <a href={attachment.url} target="_blank" rel="noreferrer" aria-label={`Preview ${attachment.file_name}`}>
                    <ExternalLink size={14} />
                    <span>Preview</span>
                  </a>
                  <a href={attachment.url} download={attachment.file_name} aria-label={`Download ${attachment.file_name}`}>
                    <Download size={14} />
                    <span>Download</span>
                  </a>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      const confirmed = window.confirm(
                        "Delete this attachment?\n\nThis will remove the file from related conversation messages, but it will not delete the conversations.",
                      );
                      if (!confirmed) {
                        return;
                      }
                      setBusyId(attachment.id);
                      void onDeleteAttachment(attachment.id).finally(() => {
                        setBusyId((current) => (current === attachment.id ? null : current));
                      });
                    }}
                  >
                    <Trash2 size={14} />
                    <span>{deleting ? "Deleting..." : "Delete"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
