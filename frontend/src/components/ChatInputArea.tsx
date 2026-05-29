import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, DragEvent, FormEvent, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { FileText, FolderOpen, LoaderCircle, Paperclip, RefreshCw, Send, X } from "lucide-react";
import { useStore } from "../store/useStore";
import type { ComposerAttachment } from "../store/useStore";

const clampProgress = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));
const resolveLocalAttachmentType = (mimeType: string): ComposerAttachment["type"] => {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "file";
};

export const ChatInputArea = () => {
  const [input, setInput] = useState("");
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { sendingMessage, sendMessage, uploadAttachment, pushToast, sendShortcut, conversationLibraryEnabled, libraryItems, libraryLoading, refreshLibrary } =
    useStore((state) => ({
      sendingMessage: state.sendingMessage,
      sendMessage: state.sendMessage,
      uploadAttachment: state.uploadAttachment,
      pushToast: state.pushToast,
      sendShortcut: state.profile?.send_shortcut ?? "ctrl_enter",
      conversationLibraryEnabled: state.profile?.conversation_library_enabled ?? true,
      libraryItems: state.libraryItems,
      libraryLoading: state.libraryLoading,
      refreshLibrary: state.refreshLibrary,
    }));

  const hasUploadingAttachment = composerAttachments.some((item) => item.status === "uploading");
  const readyAttachments = composerAttachments.filter((item) => item.status === "ready");

  const upsertAttachment = (localId: string, patch: Partial<ComposerAttachment>) => {
    setComposerAttachments((current) =>
      current.map((item) => (item.local_id === localId ? { ...item, ...patch } : item)),
    );
  };

  const removeAttachment = (localId: string) => {
    setComposerAttachments((current) => current.filter((item) => item.local_id !== localId));
  };

  const insertLibraryAttachment = (attachment: ComposerAttachment) => {
    setComposerAttachments((current) => {
      if (current.some((item) => item.id === attachment.id && item.status !== "error")) {
        return current;
      }
      return [...current, attachment];
    });
  };

  const sendCurrentMessage = async () => {
    const text = input;
    const attachments = readyAttachments.map(({ id, file_name, mime_type, size, url, type }) => ({
      id,
      file_name,
      mime_type,
      size,
      url,
      type,
    }));
    if ((text.trim().length === 0 && attachments.length === 0) || sendingMessage || hasUploadingAttachment) {
      return;
    }
    setInput("");
    setComposerAttachments([]);
    try {
      await sendMessage(text, attachments);
    } catch {
      // store already exposes failure toast
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await sendCurrentMessage();
  };

  const openLibraryPicker = async () => {
    try {
      await refreshLibrary();
      setLibraryPickerOpen(true);
      setAttachmentMenuOpen(false);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Failed to load library.", "error");
    }
  };

  const insertAttachment = async (file: File) => {
    if (!file) {
      return;
    }
    const localId = crypto.randomUUID();
    const mimeType = file.type || "application/octet-stream";
    setComposerAttachments((current) => [
      ...current,
      {
        local_id: localId,
        id: localId,
        file_name: file.name,
        mime_type: mimeType,
        size: file.size,
        url: "",
        type: resolveLocalAttachmentType(mimeType),
        status: "uploading",
        progress: 0,
      },
    ]);
    try {
      const uploaded = await uploadAttachment(file, (percent) => upsertAttachment(localId, { progress: percent }));
      upsertAttachment(localId, {
        ...uploaded,
        status: "ready",
        progress: 100,
      });
      pushToast("Attachment uploaded.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Attachment upload failed.";
      upsertAttachment(localId, {
        status: "error",
        progress: 0,
        error: message,
      });
      pushToast(message, "error");
    }
  };

  const insertAttachmentList = async (files: File[]) => {
    const uploadable = files.filter((file) => file.size > 0);
    if (uploadable.length === 0) {
      return;
    }
    await Promise.all(uploadable.map((file) => insertAttachment(file)));
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }
    await insertAttachmentList(files);
    event.target.value = "";
  };

  const handleDrop = async (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) {
      return;
    }
    await insertAttachmentList(files);
  };

  const handleDragOver = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLFormElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragOver(false);
    }
  };

  const handlePaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files ?? []);
    if (files.length === 0) {
      return;
    }
    event.preventDefault();
    await insertAttachmentList(files);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const sendByCtrlEnter = sendShortcut === "ctrl_enter";
    const shouldSend = sendByCtrlEnter
      ? event.key === "Enter" && (event.ctrlKey || event.metaKey)
      : event.key === "Enter" && !event.shiftKey;
    if (shouldSend) {
      event.preventDefault();
      void sendCurrentMessage();
    }
  };

  useEffect(() => {
    if (!conversationLibraryEnabled) {
      setAttachmentMenuOpen(false);
      setLibraryPickerOpen(false);
    }
  }, [conversationLibraryEnabled]);

  useEffect(() => {
    const handleInsertQuote = (event: Event) => {
      const customEvent = event as CustomEvent<{ text?: string }>;
      const text = customEvent.detail?.text?.trim();
      if (!text) {
        return;
      }
      setInput((current) => (current.trim().length > 0 ? `${current}\n\n${text}\n` : `${text}\n`));
    };
    window.addEventListener("ba:insert-quote", handleInsertQuote as EventListener);
    return () => {
      window.removeEventListener("ba:insert-quote", handleInsertQuote as EventListener);
    };
  }, []);

  return (
    <div className="ba-composer-shell">
      {composerAttachments.length > 0 && (
        <div className="ba-composer-attachments" aria-live="polite">
          {composerAttachments.map((attachment) => (
            <div key={attachment.local_id} className={`ba-attachment-card is-${attachment.status}`}>
              {attachment.type === "image" && attachment.url ? (
                <img src={attachment.url} alt={attachment.file_name} className="ba-attachment-thumb ba-sdr-image" />
              ) : (
                <div className="ba-attachment-thumb ba-attachment-thumb-file">
                  <FileText size={16} />
                </div>
              )}
              <div className="ba-attachment-meta">
                <div className="ba-attachment-name" title={attachment.file_name}>
                  {attachment.file_name}
                </div>
                <div className="ba-attachment-status">
                  {attachment.status === "uploading" && (attachment.progress >= 100 ? "Processing..." : `Uploading ${clampProgress(attachment.progress)}%`)}
                  {attachment.status === "ready" && "Ready"}
                  {attachment.status === "error" && (attachment.error || "Upload failed")}
                </div>
              </div>
              <button
                type="button"
                className="ba-attachment-remove"
                onClick={() => removeAttachment(attachment.local_id)}
                aria-label={`Remove attachment ${attachment.file_name}`}
                disabled={sendingMessage}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        className={`ba-composer ${isDragOver ? "is-drag-over" : ""}`}
        onSubmit={handleSubmit}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <button
          type="button"
          className="ba-icon-button"
          onClick={() => {
            if (!conversationLibraryEnabled) {
              fileRef.current?.click();
              return;
            }
            setAttachmentMenuOpen((current) => !current);
          }}
          aria-label={conversationLibraryEnabled ? "Attachment actions" : "Upload attachment"}
          disabled={sendingMessage}
        >
          <Paperclip size={18} />
        </button>

        <input ref={fileRef} type="file" className="ba-hidden-file-input" onChange={handleFileChange} multiple />

        <textarea
          className="ba-composer-input"
          placeholder="Message Arona..."
          rows={1}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={sendingMessage}
        />

        <button
          type="submit"
          className="ba-send-button"
          disabled={sendingMessage || hasUploadingAttachment || (!input.trim() && readyAttachments.length === 0)}
          aria-label={sendingMessage ? "Sending" : "Send"}
        >
          {sendingMessage ? <LoaderCircle size={18} className="ba-spinner-inline" /> : <Send size={18} />}
        </button>
      </form>
      {conversationLibraryEnabled && attachmentMenuOpen ? (
        <div className="ba-composer-attachment-menu">
          <button
            type="button"
            onClick={() => {
              setAttachmentMenuOpen(false);
              fileRef.current?.click();
            }}
            aria-label="Upload attachment to message"
            disabled={sendingMessage}
          >
            <Paperclip size={14} />
            <span>Upload attachment</span>
          </button>
          <button type="button" onClick={() => void openLibraryPicker()} aria-label="Reference files from library" disabled={sendingMessage}>
            <FolderOpen size={14} />
            <span>From Library</span>
          </button>
        </div>
      ) : null}
      {libraryPickerOpen
        ? createPortal(
            <div className="ba-modal-backdrop ba-panel-backdrop" role="presentation" onClick={() => setLibraryPickerOpen(false)}>
              <section
                className="ba-panel-modal ba-library-picker"
                role="dialog"
                aria-modal="true"
                aria-label="Select from library"
                onClick={(event) => event.stopPropagation()}
              >
                <header className="ba-attachment-library-header">
                  <div>
                    <p>Library</p>
                    <span>Select files to reference in this message</span>
                  </div>
                  <div className="ba-attachment-library-header-actions">
                    <button type="button" onClick={() => void refreshLibrary()} aria-label="Refresh library" disabled={libraryLoading}>
                      <RefreshCw size={16} />
                    </button>
                    <button type="button" onClick={() => setLibraryPickerOpen(false)} aria-label="Close library picker">
                      <X size={18} />
                    </button>
                  </div>
                </header>
                <div className="ba-attachment-library-list">
                  {libraryItems.length === 0 && (
                    <p className="ba-muted-text">{libraryLoading ? "Loading library..." : "No files in Library yet."}</p>
                  )}
                  {libraryItems.map((item) => {
                    const alreadyAdded = composerAttachments.some((attachment) => attachment.id === item.id && attachment.status !== "error");
                    return (
                      <div key={item.id} className="ba-attachment-library-item">
                        <div className="ba-attachment-library-item-meta">
                          <p title={item.file_name}>{item.file_name}</p>
                          <span>{item.mime_type}</span>
                        </div>
                        <div className="ba-attachment-library-item-actions">
                          <button
                            type="button"
                            disabled={alreadyAdded}
                            aria-label={`Add ${item.file_name} to message`}
                            onClick={() => {
                              insertLibraryAttachment({
                                ...item,
                                local_id: crypto.randomUUID(),
                                status: "ready",
                                progress: 100,
                              });
                            }}
                          >
                            <span>{alreadyAdded ? "Added" : "Add"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
      <p className="ba-composer-hint">
        {sendShortcut === "ctrl_enter" ? "Enter for newline, Ctrl/⌘ + Enter to send." : "Enter to send, Shift + Enter for newline."}
      </p>
    </div>
  );
};
