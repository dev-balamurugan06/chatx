import { useEffect, useRef, useState } from "react";
import { sendMessageStream } from "../services/api";
import Message from "./Message";

const ALLOWED_EXTENSIONS = new Set(["csv", "docx", "json", "md", "pdf", "txt"]);
const MAX_FILE_SIZE = 6 * 1024 * 1024;
const MAX_FILES = 4;

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatWindow({ chatId, title, messages, setMessages, onOpenSidebar, onCreateChat }) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 170)}px`;
  }, [input]);

  useEffect(() => {
    setInput("");
    setFiles([]);
    setUploadError("");
  }, [chatId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const addFiles = (incoming) => {
    const current = [...files];
    const errors = [];

    for (const file of incoming) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        errors.push(`${file.name}: use PDF, DOCX, TXT, MD, CSV or JSON.`);
      } else if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: the limit is 6 MB per file.`);
      } else if (current.length >= MAX_FILES) {
        errors.push(`You can attach up to ${MAX_FILES} files per message.`);
        break;
      } else {
        current.push(file);
      }
    }

    setFiles(current);
    setUploadError(errors.join(" "));
  };

  const handleFileInput = (event) => {
    addFiles(Array.from(event.target.files || []));
    event.target.value = "";
  };

  const handleSend = async (event) => {
    event?.preventDefault();
    const text = input.trim();
    if ((!text && !files.length) || sending || !chatId) return;

    const prompt = text || "Please review and summarize the attached file(s).";
    const sentFiles = [...files];
    const userMessage = {
      sender: "user",
      text: text || prompt,
      attachments: sentFiles.map((file) => ({
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        byte_size: file.size,
      })),
    };
    const baseMessages = [...messages, userMessage];
    let currentReply = "";
    const controller = new AbortController();

    setUploadError("");
    setInput("");
    setFiles([]);
    setSending(true);
    abortRef.current = controller;
    setMessages([...baseMessages, { sender: "bot", text: "", streaming: true }]);

    try {
      const result = await sendMessageStream(
        chatId,
        prompt,
        sentFiles,
        (partial) => {
          currentReply = partial;
          setMessages([...baseMessages, { sender: "bot", text: partial, streaming: true }]);
        },
        controller.signal,
      );
      setMessages([...baseMessages, { sender: "bot", text: result.reply, streaming: false }]);
    } catch (error) {
      if (controller.signal.aborted) {
        setMessages([
          ...baseMessages,
          { sender: "bot", text: currentReply || "Response stopped.", streaming: false },
        ]);
      } else {
        setMessages([
          ...baseMessages,
          { sender: "bot", text: error.message || "Could not send this message.", streaming: false },
        ]);
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const stopResponse = () => abortRef.current?.abort();

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    if (chatId) addFiles(Array.from(event.dataTransfer.files || []));
  };

  return (
    <main
      className={`chat-main ${isDragging ? "chat-main-dragging" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      <header className="chat-header">
        <button className="mobile-menu-button" type="button" onClick={onOpenSidebar} aria-label="Open chat menu">☰</button>
        <div className="chat-header-copy">
          <strong>{title || "New chat"}</strong>
          <span>Private workspace</span>
        </div>
        <div className="status-pill"><span /> Ready</div>
      </header>

      <section className="chat-messages" aria-live="polite">
        {messages.length === 0 ? (
          <div className="empty-chat-state">
            <h1>{chatId ? "What can I help with?" : "Start a conversation"}</h1>
            <p>{chatId ? "Ask a question or attach a document to get started." : "Create a chat to start asking questions and uploading files."}</p>
            {!chatId && <button className="empty-state-button" type="button" onClick={onCreateChat}>＋ New chat</button>}
          </div>
        ) : (
          <div className="message-list">
            {messages.map((message, index) => (
              <Message key={message.id || `${chatId}-${index}`} msg={message} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </section>

      {isDragging && <div className="drop-overlay">Drop files to attach them</div>}

      <footer className="composer-area">
        {files.length > 0 && (
          <div className="selected-files" aria-label="Files attached to this message">
            {files.map((file, index) => (
              <div className="selected-file" key={`${file.name}-${index}`}>
                <span className="selected-file-icon">▤</span>
                <span className="selected-file-text"><strong>{file.name}</strong><small>{formatFileSize(file.size)}</small></span>
                <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button>
              </div>
            ))}
          </div>
        )}
        {uploadError && <p className="composer-error" role="alert">{uploadError}</p>}

        <form className="composer" onSubmit={handleSend}>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.csv,.json"
            onChange={handleFileInput}
          />
          <button
            className="attach-button"
            type="button"
            aria-label="Attach files"
            title="Attach PDF, DOCX, TXT, Markdown, CSV or JSON"
            disabled={sending || !chatId}
            onClick={() => fileInputRef.current?.click()}
          >
            ＋
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend(event);
              }
            }}
            placeholder="Message your assistant..."
            rows={1}
            aria-label="Message"
            disabled={!chatId}
          />
          {sending ? (
            <button className="stop-button" type="button" onClick={stopResponse}>Stop</button>
          ) : (
            <button className="send-button" type="submit" disabled={!chatId || (!input.trim() && !files.length)} aria-label="Send message">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 18V6M6.5 11.5 12 6l5.5 5.5" /></svg>
            </button>
          )}
        </form>
        <p className="composer-hint">
          <span><kbd>Enter</kbd> to send</span>
          <span><kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line</span>
          <span>Up to 4 files · 6 MB each</span>
        </p>
      </footer>
    </main>
  );
}
