# Advanced AI Chat System — Upgraded

Full-stack AI chat application with React/Vite, Flask, MySQL, JWT authentication and persistent chat history.

## Implemented in this upgrade

- JWT-based login authentication
- Secure database/OpenAI configuration through `.env`
- Persistent chats and messages in MySQL
- New chat, rename, pin, archive, search and delete
- User-specific chat access control
- Password length validation and API error messages
- Offline knowledge-base fallback when no OpenAI key is configured

## Setup

### 1. Create the database

```bash
mysql -u root -p < database/schema.sql
```

### 2. Configure the backend

```bash
cd "Advance Ai Chat System"
cd backend
python -m venv venv
# Windows: venv\\Scripts\\activate
# Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
 venv\Scripts\activate       # Windows
# cp .env.example .env       # Linux/macOS
```

Edit `.env` and set `DB_PASSWORD` and a long random `JWT_SECRET`. `OPENAI_API_KEY` may remain empty to use offline mode.

Run the backend:

```bash
python app.py
```

Backend: `http://127.0.0.1:5000`

### 3. Run the frontend in another terminal

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## Notes

- Start the backend from the `backend` folder so the environment and project paths are correct.
- Never commit `.env` or an OpenAI API key.
- Existing users from the previous version remain compatible after running the new schema; the new `chats` and `messages` tables are added automatically by the SQL script.
