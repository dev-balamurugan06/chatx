import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Message({ msg }) {
  const isUser = msg.sender === "user";
  const [copied, setCopied] = useState(false);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(msg.text || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className={`message-row ${isUser ? "message-user" : "message-assistant"}`}>
      <div className="message-content">
        {msg.attachments?.length > 0 && (
          <div className="message-attachments">
            {msg.attachments.map((file, index) => (
              <div className="message-attachment" key={`${file.filename}-${index}`}>
                <span className="attachment-file-icon" aria-hidden="true">▤</span>
                <span className="attachment-file-details">
                  <strong>{file.filename}</strong>
                  <small>{formatFileSize(file.byte_size)}</small>
                </span>
              </div>
            ))}
          </div>
        )}

        {msg.thinking ? (
          <div className="thinking-indicator" role="status" aria-label="Assistant is thinking">
            <span /><span /><span />
          </div>
        ) : (
          <div className={`message-bubble ${isUser ? "message-bubble-user" : "message-bubble-assistant"}`}>
            {isUser ? (
              <p className="user-message-text">{msg.text}</p>
            ) : (
              <div className="markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children, ...props }) => (
                      <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>
                    ),
                  }}
                >
                  {msg.text || ""}
                </ReactMarkdown>
                {msg.streaming && <span className="streaming-cursor" aria-label="Response streaming" />}
              </div>
            )}
          </div>
        )}

        {!isUser && msg.text && !msg.streaming && (
          <button className="copy-message-button" type="button" onClick={copyMessage} aria-label={copied ? "Message copied" : "Copy message"}>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="6.5" y="6.5" width="10" height="11" rx="2" /><path d="M13.5 6.5V4.75A1.75 1.75 0 0 0 11.75 3h-7A1.75 1.75 0 0 0 3 4.75v7A1.75 1.75 0 0 0 4.75 13.5H6.5" /></svg>
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    </article>
  );
}
