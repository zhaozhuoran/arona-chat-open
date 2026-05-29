import { useRef, useState } from "react";
import { Download, ExternalLink, LoaderCircle, RefreshCw, Trash2, Upload, X } from "lucide-react";
import type { LibraryItem } from "../store/useStore";

type LibraryPanelProps = {
  open: boolean;
  loading: boolean;
  items: LibraryItem[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onUploadFiles: (files: File[]) => Promise<void>;
  onDeleteItem: (attachmentId: string) => Promise<void>;
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

export const LibraryPanel = ({
  open,
  loading,
  items,
  onClose,
  onRefresh,
  onUploadFiles,
  onDeleteItem,
}: LibraryPanelProps) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) {
    return null;
  }

  return (
    <div className="ba-modal-backdrop ba-panel-backdrop" role="presentation" onClick={onClose}>
      <section className="ba-panel-modal ba-library-panel" role="dialog" aria-modal="true" aria-label="Library" onClick={(event) => event.stopPropagation()}>
        <header className="ba-attachment-library-header">
          <div>
            <p>Library</p>
            <span>Upload files once, then reference them in any conversation</span>
          </div>
          <div className="ba-attachment-library-header-actions">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Upload files to library"
              disabled={uploading}
            >
              {uploading ? <LoaderCircle size={16} className="ba-spinner-inline" /> : <Upload size={16} />}
            </button>
            <button type="button" onClick={() => void onRefresh()} aria-label="Refresh library" disabled={loading}>
              <RefreshCw size={16} />
            </button>
            <button type="button" onClick={onClose} aria-label="Close library">
              <X size={18} />
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            className="ba-hidden-file-input"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []).filter((file) => file.size > 0);
              event.currentTarget.value = "";
              if (files.length === 0) {
                return;
              }
              setUploading(true);
              void onUploadFiles(files).finally(() => setUploading(false));
            }}
          />
        </header>

        <div className="ba-attachment-library-list">
          {items.length === 0 && <p className="ba-muted-text">{loading ? "Loading library..." : "No files in Library yet."}</p>}
          {items.map((item) => {
            const deleting = busyId === item.id;
            return (
              <div key={item.id} className="ba-attachment-library-item">
                <div className="ba-attachment-library-item-meta">
                  <p title={item.file_name}>{item.file_name}</p>
                  <span>{formatTime(item.created_at)}</span>
                  <span>
                    {item.mime_type} · {formatSize(item.size)}
                  </span>
                </div>
                <div className="ba-attachment-library-item-actions">
                  <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Preview ${item.file_name}`}>
                    <ExternalLink size={14} />
                    <span>Preview</span>
                  </a>
                  <a href={item.url} download={item.file_name} aria-label={`Download ${item.file_name}`}>
                    <Download size={14} />
                    <span>Download</span>
                  </a>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      const confirmed = window.confirm("Delete this file from Library?");
                      if (!confirmed) {
                        return;
                      }
                      setBusyId(item.id);
                      void onDeleteItem(item.id).finally(() => {
                        setBusyId((current) => (current === item.id ? null : current));
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
