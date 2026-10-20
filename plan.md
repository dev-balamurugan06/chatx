# Upgrade plan

## Chosen scope

Phase 1 professional upgrade: secure environment configuration, JWT authentication, MySQL-backed chat history, and chat CRUD/search controls. The existing dark React interface is retained.

## Architecture

- `backend/auth.py`: signup/login and JWT token validation.
- `backend/app.py`: authenticated chat and chat-history CRUD endpoints.
- `backend/db.py`: environment-based MySQL connection.
- `backend/chatbot.py`: environment-based OpenAI client with offline fallback.
- `database/schema.sql`: users, chats and messages tables.
- `frontend/src/services/api.js`: Axios client with Bearer token interceptor.
- `frontend/src/pages/ChatPage.jsx`: server-backed chat state and actions.
- `frontend/src/components/ChatWindow.jsx`: chat-specific message requests.

## Design direction

- **Movement:** focused dark-mode productivity workspace.
- **Principles:** low distraction, clear hierarchy, fast feedback, recoverable destructive actions.
- **Color philosophy:** charcoal surfaces keep attention on the conversation; green represents successful actions and assistant activity.
- **Interaction:** chat actions remain in the sidebar while the main pane stays dedicated to conversation.

## Next optional phases

1. Streaming responses, markdown/code rendering and regenerate response.
2. PDF/document upload and document question answering.
3. Voice input/output and admin analytics.
