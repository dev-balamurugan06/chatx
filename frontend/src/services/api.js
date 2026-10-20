import axios from "axios";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    return Promise.reject(error);
  }
);

export const getChats = async () => (await api.get("/chats")).data.chats;
export const createChat = async (title = "New Chat") => (await api.post("/chats", { title })).data;
export const updateChat = async (id, changes) => (await api.patch(`/chats/${id}`, changes)).data;
export const removeChat = async (id) => api.delete(`/chats/${id}`);

export const sendMessageStream = async (chatId, message, files, onToken, signal) => {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("message", message);
  files.forEach((file) => form.append("files", file));

  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
    signal,
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    throw new Error(result.error || "Could not send this message.");
  }

  if (!response.body) throw new Error("Streaming is not available in this browser.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";

  const readEvents = (frame) => {
    for (const line of frame.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const event = JSON.parse(line.slice(6));
      if (event.type === "token") {
        reply += event.content;
        onToken(reply);
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    frames.forEach(readEvents);
    if (done) break;
  }

  if (buffer.trim()) readEvents(buffer);
  return { reply };
};

export default api;
