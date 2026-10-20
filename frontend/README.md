# 🤖 Advanced AI Chat System

A full stack AI-powered chat application developed as a **PG Final Year Project**.

---

## 📌 Project Overview
The Advanced AI Chat System is a web-based application that allows users to
register, log in, and interact with an AI chatbot in real time.  
The system provides a modern ChatGPT-style interface with secure authentication
and advanced chat management features.

---

## 🎯 Objectives
- To design and develop a secure AI-based chat system
- To implement user authentication using modern web technologies
- To integrate AI response logic with real-time interaction
- To provide a clean, responsive, and user-friendly UI

---

## 🚀 Features
- User Signup & Login
- Secure password hashing
- AI chatbot with typing animation
- Create new chats
- Rename, Pin, Archive & Delete chats
- Search chat history
- Logout functionality
- Responsive dark-mode UI

---

## 🛠️ Technology Stack

### Frontend
- React (Vite)
- JavaScript
- Axios
- HTML & CSS

### Backend
- Python (Flask)
- Flask-CORS
- MySQL
- Werkzeug Security

---

## 🧩 System Architecture
Frontend (React) → Axios API → Flask Backend → MySQL Database → AI Response Engine

---

## 🗄️ Database Design
**Database Name:** `ai_chat_system`

### Users Table
| Field | Type | Description |
|-----|------|-------------|
| id | INT | Primary Key |
| username | VARCHAR | User name |
| email | VARCHAR | Unique email |
| password | VARCHAR | Hashed password |

---

## ⚙️ Installation & Execution

### Backend Setup
cd backend
pip install -r requirements.txt
python app.py

## Server runs at:
http://127.0.0.1:5000

## Frontend Setup:
cd frontend
npm install
npm run dev

## Frontend runs at:
http://localhost:5173

## 🧪 Testing :
* Unit Testing: API endpoints
* Integration Testing: Frontend–Backend communication
* Functional Testing: Login, Signup, Chat features
* User Acceptance Testing: UI and usability

## 📸 Screenshots :
All application screenshots are available in the Screenshots/ folder and
included in the project report.

## 👨‍💻 Developed By
Balamurugan,MCA.