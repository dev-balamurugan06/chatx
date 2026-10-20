import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import { createChat, getApiErrorMessage, getChats, removeChat, updateChat } from "../services/api";

export default function ChatPage() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const loadChats = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const items = await getChats();
      setChats(items);
      setActiveChatId((current) => items.some((chat) => chat.id === current) ? current : items[0]?.id ?? null);
    } catch (error) {
      setPageError(getApiErrorMessage(error, "Could not load your chats. Check the server and try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const createNewChat = useCallback(async () => {
    try {
      const chat = await createChat();
      setChats((current) => [chat, ...current.filter((item) => item.id !== chat.id)]);
      setActiveChatId(chat.id);
      setShowArchived(false);
      setPageError("");
    } catch (error) {
      setPageError(getApiErrorMessage(error, "Could not create a new chat."));
    }
  }, []);

  const patchChat = async (id, changes) => {
    try {
      const updated = await updateChat(id, changes);
      setChats((current) => current.map((chat) => chat.id === id ? updated : chat));
      if (Object.hasOwn(changes, "archived")) {
        if (changes.archived) {
          const nextChat = chats.find((chat) => chat.id !== id && !chat.archived);
          if (activeChatId === id) setActiveChatId(nextChat?.id ?? null);
        } else {
          setShowArchived(false);
          setActiveChatId(id);
        }
      }
    } catch (error) {
      setPageError(getApiErrorMessage(error, "Could not update this chat."));
    }
  };

  const deleteChat = async (id) => {
    try {
      await removeChat(id);
      const remaining = chats.filter((chat) => chat.id !== id);
      setChats(remaining);
      if (activeChatId === id) setActiveChatId(remaining[0]?.id ?? null);
    } catch (error) {
      setPageError(getApiErrorMessage(error, "Could not delete this chat."));
    }
  };

  const updateMessages = (messages) => {
    const firstUserMessage = messages.find((message) => message.sender === "user")?.text || "";
    setChats((current) => current.map((chat) => chat.id === activeChatId ? {
      ...chat,
      messages,
      title: chat.title === "New Chat" && firstUserMessage ? firstUserMessage.split(/\s+/).slice(0, 4).join(" ") : chat.title,
      updated_at: new Date().toISOString(),
    } : chat));
  };

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        createNewChat();
      }
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [createNewChat]);

  const activeChat = chats.find((chat) => chat.id === activeChatId);

  return (
    <div className="app-shell">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onNewChat={createNewChat}
        onSelectChat={setActiveChatId}
        onRename={(id, title) => patchChat(id, { title })}
        onDelete={deleteChat}
        onTogglePin={(id) => patchChat(id, { pinned: !chats.find((chat) => chat.id === id)?.pinned })}
        onToggleArchive={(id) => patchChat(id, { archived: !chats.find((chat) => chat.id === id)?.archived })}
        showArchived={showArchived}
        setShowArchived={setShowArchived}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <section className="app-content">
        {pageError && (
          <div className="page-alert" role="alert">
            <span>{pageError}</span>
            <button type="button" onClick={() => setPageError("")}>Dismiss</button>
          </div>
        )}
        {loading ? (
          <div className="loading-state"><span className="loading-spinner" />Loading your chats…</div>
        ) : (
          <ChatWindow
            key={activeChatId || "empty-chat"}
            chatId={activeChatId}
            title={activeChat?.title}
            messages={activeChat?.messages || []}
            setMessages={updateMessages}
            onOpenSidebar={() => setSidebarOpen(true)}
            onCreateChat={createNewChat}
          />
        )}
      </section>
    </div>
  );
}
