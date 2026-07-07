# 🎵 EmoVibe

EmoVibe is an AI-powered music recommendation platform that recommends songs based on a user's emotions. It combines facial emotion detection, Spotify integration, and personalized playlists to create a unique music listening experience.

## Features

* 🎭 Emotion-based music recommendations
* 🎵 Spotify integration
* 🔐 JWT Authentication
* 🔑 Google OAuth Login
* 📂 Playlist management
* ❤️ Like/Favorite songs
* 📧 Email OTP verification
* 👤 User profiles
* ⚡ Fast React frontend
* 🐍 Flask REST API backend
* 🐘 PostgreSQL database

---

## Tech Stack

### Frontend

* React
* JavaScript
* CSS
* Axios

### Backend

* Flask
* Flask-JWT-Extended
* SQLAlchemy
* PostgreSQL
* Spotify Web API
* Google OAuth

---

## Project Structure

```
EmoVibe/
│
├── frontend/
│
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── .env
│   └── ...
│
├── .gitignore
└── README.md
```

---

## Installation

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd EmoVibe
```

---

### 2. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create a virtual environment:

**Windows**

```bash
python -m venv venv
```

Activate it:

**Command Prompt**

```bash
venv\Scripts\activate
```

**PowerShell**

```powershell
venv\Scripts\Activate.ps1
```

Install the required packages:

```bash
pip install -r requirements.txt
```

---

### 3. Configure Environment Variables

Create a file named `.env` inside the `backend` folder.

Use the following template:

```env
SECRET_KEY=your_secret_key
JWT_SECRET_KEY=your_jwt_secret

FLASK_ENV=development
FLASK_APP=app.py

DATABASE_URL=your_postgresql_database_url

JWT_ACCESS_TOKEN_EXPIRES=3600

HOST=127.0.0.1
PORT=5000

SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5000/api/auth/spotify/callback

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:5000/api/auth/google/callback

SMTP_EMAIL=your_email@gmail.com
SMTP_APP_PASSWORD=your_app_password
```

---

### 4. Start the Backend

```bash
python app.py
```

The backend runs on:

```
http://127.0.0.1:5000
```

---

### 5. Frontend Setup

Open another terminal.

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the React development server:

```bash
npm start
```

The frontend runs on:

```
http://localhost:3000
```
___

## Frontend Environment Variables

Create a `.env` file inside the `frontend` directory and add the following:

```env
REACT_APP_API_URL=http://127.0.0.1:5000/api
```

If you deploy the backend, update `REACT_APP_API_URL` to point to your deployed backend URL.

Example:

```env
REACT_APP_API_URL=https://your-backend-domain.com/api
```


---

## Environment Variables

The backend requires the following services:

* PostgreSQL Database
* Spotify Developer Application
* Google Cloud OAuth Credentials
* SMTP Email Account (App Password)

---

## API

The backend exposes REST APIs for:

* Authentication
* Google Login
* Spotify Login
* User Management
* Song Recommendations
* Playlists
* Liked Songs

---


## License

This project is intended for educational and personal use.
