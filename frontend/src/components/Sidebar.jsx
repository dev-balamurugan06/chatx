import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_WIDTH_KEY = "chat-x-sidebar-width";
const SIDEBAR_COLLAPSED_KEY = "chat-x-sidebar-collapsed";

function readSidebarCollapsed() {
  if (typeof window === "undefined" || window.innerWidth <= 900) return false;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== "false";
  } catch {
    return true;
  }
}

function SidebarIcon({ name }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" };
  if (name === "panel") return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M9 4v16" /></svg>;
  if (name === "new") return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
  if (name === "chats") return <svg {...common}><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5a7.5 7.5 0 1 1 17-3Z" /></svg>;
  return <svg {...common}><path d="M4 5.5h5l2 2h9v12H4z" /><path d="M8 5.5v14M14 7.5v12" /></svg>;
}

function getMaxSidebarWidth(viewportWidth = (typeof window === "undefined" ? 1280 : window.innerWidth)) {
  const viewportLimit = viewportWidth <= 900 ? viewportWidth * 0.84 : SIDEBAR_MAX_WIDTH;
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, viewportLimit));
}

function readSidebarWidth() {
  try {
    const storedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(storedWidth) && storedWidth >= SIDEBAR_MIN_WIDTH) {
      return Math.min(getMaxSidebarWidth(), storedWidth);
    }
  } catch {
    // Use the default width when browser storage is unavailable.
  }
  return Math.min(284, getMaxSidebarWidth());
}

function getMenuPosition(button) {
  const rect = button.getBoundingClientRect();
  const menuWidth = 164;
  const menuHeight = 160;
  const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
  const top = rect.bottom + menuHeight + 8 <= window.innerHeight
    ? rect.bottom + 4
    : Math.max(8, rect.top - menuHeight - 4);
  return { top, left };
}

function readUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function chatGroup(chat) {
  const value = chat.updated_at || chat.created_at;
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Earlier";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const daysAgo = Math.floor((today - day) / 86_400_000);
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return "Previous 7 days";
  return "Earlier";
}

export default function Sidebar({
  chats,
  activeChatId,
  onNewChat,
  onSelectChat,
  onRename,
  onDelete,
  onTogglePin,
  onToggleArchive,
  showArchived,
  setShowArchived,
  mobileOpen,
  onClose,
}) {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === "undefined" ? 1280 : window.innerWidth);
  const sidebarRef = useRef(null);
  const searchInputRef = useRef(null);
  const resizingRef = useRef(false);

  useEffect(() => {
    const constrainSidebarWidth = () => {
      const width = window.innerWidth;
      setViewportWidth(width);
      const maxWidth = getMaxSidebarWidth(width);
      setSidebarWidth((width) => Math.min(width, maxWidth));
    };
    constrainSidebarWidth();
    window.addEventListener("resize", constrainSidebarWidth);
    return () => window.removeEventListener("resize", constrainSidebarWidth);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
      } catch {
        // Resizing still works for this session when browser storage is unavailable.
      }
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [sidebarWidth]);

  useEffect(() => {
    if (viewportWidth <= 900) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      // The sidebar preference still works for this session when storage is unavailable.
    }
  }, [collapsed, viewportWidth]);

  useEffect(() => {
    if (menuOpenId === null) return undefined;

    const closeMenu = () => {
      setMenuOpenId(null);
      setMenuPosition(null);
    };
    const handlePointerDown = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".chat-actions-button, .chat-actions-menu")) return;
      closeMenu();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [menuOpenId]);

  const closeChatMenu = () => {
    setMenuOpenId(null);
    setMenuPosition(null);
  };

  const openSearch = () => {
    setCollapsed(false);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const resizeSidebar = (clientX) => {
    const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
    setSidebarWidth(Math.max(SIDEBAR_MIN_WIDTH, Math.min(getMaxSidebarWidth(), clientX - sidebarLeft)));
  };

  const user = readUser();
  const email = user?.email || "";
  const username = user?.username || email.split("@")[0] || "User";
  const avatar = username.charAt(0).toUpperCase();
  const visibleChats = chats.filter((chat) => showArchived ? chat.archived : !chat.archived);
  const filtered = visibleChats.filter((chat) => chat.title.toLowerCase().includes(search.toLowerCase()));
  const pinnedChats = showArchived ? [] : filtered.filter((chat) => chat.pinned);
  const normalChats = showArchived ? filtered : filtered.filter((chat) => !chat.pinned);
  const groups = ["Today", "Yesterday", "Previous 7 days", "Earlier"];

  const beginRename = (chat) => {
    setRenameValue(chat.title);
    setRenamingId(chat.id);
    closeChatMenu();
  };

  const saveRename = (event, id) => {
    event.preventDefault();
    const title = renameValue.trim();
    if (title) onRename(id, title);
    setRenamingId(null);
  };

  const renderChat = (chat) => (
    <div
      className={`chat-list-row ${chat.id === activeChatId ? "chat-list-row-active" : ""}`}
      key={chat.id}
      onClick={() => { if (renamingId !== chat.id) { onSelectChat(chat.id); onClose?.(); } }}
    >
      {renamingId === chat.id ? (
        <form className="rename-chat-form" onSubmit={(event) => saveRename(event, chat.id)} onClick={(event) => event.stopPropagation()}>
          <input autoFocus value={renameValue} maxLength={255} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setRenamingId(null); }} />
          <button type="submit" aria-label="Save chat name">✓</button>
        </form>
      ) : (
        <>
          <span className="chat-list-title" title={chat.title}>{chat.title}</span>
          <button
            className="chat-actions-button"
            type="button"
            aria-label={`Options for ${chat.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpenId === chat.id}
            onClick={(event) => {
              event.stopPropagation();
              if (menuOpenId === chat.id) closeChatMenu();
              else {
                setMenuPosition(getMenuPosition(event.currentTarget));
                setMenuOpenId(chat.id);
              }
            }}
          >
            ···
          </button>
          {menuOpenId === chat.id && menuPosition && createPortal(
            <div
              className="chat-actions-menu"
              role="menu"
              style={{ top: menuPosition.top, left: menuPosition.left }}
              onClick={(event) => event.stopPropagation()}
            >
              {!showArchived && <button type="button" role="menuitem" onClick={() => { onTogglePin(chat.id); closeChatMenu(); }}>{chat.pinned ? "Unpin chat" : "Pin chat"}</button>}
              <button type="button" role="menuitem" onClick={() => { onToggleArchive(chat.id); closeChatMenu(); }}>{showArchived ? "Restore chat" : "Archive chat"}</button>
              <button type="button" role="menuitem" onClick={() => beginRename(chat)}>Rename</button>
              <button className="menu-danger" type="button" role="menuitem" onClick={() => { onDelete(chat.id); closeChatMenu(); }}>Delete</button>
            </div>,
            document.body,
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      {mobileOpen && <button className="sidebar-backdrop" aria-label="Close chat menu" onClick={onClose} />}
      <aside
        ref={sidebarRef}
        className={`sidebar ${collapsed && viewportWidth > 900 ? "sidebar-collapsed" : ""} ${mobileOpen ? "sidebar-mobile-open" : ""}`}
        style={{ "--sidebar-width": `${collapsed && viewportWidth > 900 ? 64 : sidebarWidth}px` }}
      >
        <div className="sidebar-brand">
          <span>Chat X</span>
          <button className="sidebar-collapse-button" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <SidebarIcon name="panel" />
          </button>
          <button className="sidebar-close-button" type="button" onClick={onClose} aria-label="Close sidebar">×</button>
        </div>

        <nav className="sidebar-rail" aria-label="Quick navigation">
          <button className="sidebar-rail-button" type="button" onClick={() => { onNewChat(); onClose?.(); }} aria-label="New chat" title="New chat"><SidebarIcon name="new" /></button>
          <button className="sidebar-rail-button" type="button" onClick={openSearch} aria-label="Search chats" title="Search chats"><SidebarIcon name="search" /></button>
          <button className="sidebar-rail-button" type="button" onClick={() => setCollapsed(false)} aria-label="Show chat history" title="Chat history"><SidebarIcon name="chats" /></button>
          <button
            className={`sidebar-rail-button ${showArchived ? "sidebar-rail-button-active" : ""}`}
            type="button"
            onClick={() => { setShowArchived(!showArchived); setCollapsed(false); }}
            aria-label={showArchived ? "Show active chats" : "Show archived chats"}
            title={showArchived ? "Active chats" : "Archive"}
          >
            <SidebarIcon name="library" />
          </button>
        </nav>

        <div className="sidebar-content">
        <button className="new-chat-button" type="button" onClick={() => { onNewChat(); onClose?.(); }}>
          <span>＋</span> New chat
        </button>

        <div className="sidebar-tools">
          <label className="chat-search">
            <span aria-hidden="true">⌕</span>
            <input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats" aria-label="Search chats" />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search">×</button>}
          </label>
          <button className={`archive-toggle ${showArchived ? "archive-toggle-active" : ""}`} type="button" onClick={() => setShowArchived(!showArchived)}>
            <span aria-hidden="true">▣</span>{showArchived ? "Archived" : "Archive"}
          </button>
        </div>

        <div className="chat-history">
          {!showArchived && pinnedChats.length > 0 && (
            <section className="chat-group">
              <h2>Pinned</h2>
              {pinnedChats.map(renderChat)}
            </section>
          )}

          {groups.map((group) => {
            const items = normalChats.filter((chat) => chatGroup(chat) === group);
            if (!items.length) return null;
            return (
              <section className="chat-group" key={group}>
                <h2>{group}</h2>
                {items.map(renderChat)}
              </section>
            );
          })}

          {filtered.length === 0 && <div className="empty-history">{search ? "No chats match your search" : showArchived ? "No archived chats" : "Your chats will appear here"}</div>}
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar">{avatar}</div>
          <div className="profile-details"><strong>{username}</strong><span>{email}</span></div>
          <button
            className="logout-button"
            type="button"
            onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); window.location.reload(); }}
          >
            Log out
          </button>
        </div>
        </div>
        <div
          className="sidebar-resize-handle"
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={getMaxSidebarWidth(viewportWidth)}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            resizingRef.current = true;
          }}
          onPointerMove={(event) => { if (resizingRef.current) resizeSidebar(event.clientX); }}
          onPointerUp={() => { resizingRef.current = false; }}
          onPointerCancel={() => { resizingRef.current = false; }}
          onLostPointerCapture={() => { resizingRef.current = false; }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            setSidebarWidth((width) => Math.max(SIDEBAR_MIN_WIDTH, Math.min(getMaxSidebarWidth(), width + (event.key === "ArrowRight" ? 16 : -16))));
          }}
        />
      </aside>
    </>
  );
}
