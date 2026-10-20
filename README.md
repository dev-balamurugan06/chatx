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

## Deploy to Vercel

The frontend and Flask API are separate Vercel projects because they live in separate folders. Import `dev-balamurugan06/chatx` twice:

1. **Frontend project:** set the Root Directory to `frontend`. Vercel detects Vite and uses the included `vercel.json` for SPA routes. Add `VITE_API_URL` with the deployed backend project's base URL, such as `https://chatx-api.vercel.app`, then deploy.
2. **Backend project:** set the Root Directory to `backend`. Vercel detects the Flask app in `app.py`. Add the environment variables below, then deploy.

The API requires an externally hosted MySQL database. Create the database and tables using `database/schema.sql`, then set:

| Variable | Value |
| --- | --- |
| `DB_HOST` | MySQL server hostname |
| `DB_PORT` | MySQL server port, usually `3306` |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name, usually `ai_chat_system` |
| `JWT_SECRET` | A unique, long random secret |
| `APP_ENV` | `production` |
| `OPENAI_API_KEY` | Optional; leave unset to use the offline knowledge base |
| `OPENAI_MODEL` | Optional; defaults to `gpt-4o-mini` |

Set `VITE_API_URL` to the backend deployment's base URL (without a trailing slash). Vercel rebuilds the frontend with that value, so redeploy the frontend after changing it.

## Notes

- Start the backend from the `backend` folder so the environment and project paths are correct.
- Never commit `.env` or an OpenAI API key.
- Existing users from the previous version remain compatible after running the new schema; the new `chats` and `messages` tables are added automatically by the SQL script.
