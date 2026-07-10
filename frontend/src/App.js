import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthCallback from './components/Auth/AuthCallback';
import AppShell from './components/Layout/AppShell';
import Dashboard from './components/Dashboard/Dashboard';
import MainApp from './components/EmotionDetection/MainApp';
import History from './components/History/History';
import LikedSongs from './components/LikedSongs/LikedSongs';
import Playlists from './components/Playlists/Playlists';
import Settings from './components/Settings/Settings';
import ProfilePage from './components/Profile/ProfilePage';
import MusicGames from "./pages/MusicGames";
import LandingPage from './components/LandingPage/LandingPage';
import { isAuthenticated } from './services/api';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Public Route Component (redirect if already logged in)
const PublicRoute = ({ children }) => {
  if (isAuthenticated()) {
    return <Navigate to="/app" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing Page - Always accessible */}
        <Route path="/" element={<LandingPage />} />

        {/*
          Login / Register both render LandingPage — its built-in auth panel
          opens automatically on the right tab based on the URL (see the
          useLocation effect in LandingPage.jsx). Still wrapped in
          PublicRoute so an already-logged-in user gets bounced to /app.
        */}
        <Route
          path="/register"
          element={
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          }
        />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          }
        />

        {/* OAuth callback - catches redirect from Google, stores tokens, then goes to /app */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* App shell — persistent sidebar, shared by Dashboard and the
            emotion-detection flow so moving between them doesn't feel
            like leaving the app. */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          {/* Dashboard - main landing page after login */}
          <Route path="/app" element={<Dashboard />} />

          {/* Emotion Detection - triggered from Dashboard with detection method */}
          <Route path="/app/detect" element={<MainApp />} />

          {/* History - full detection history, replaces the earlier /profile stopgap */}
          <Route path="/app/history" element={<History />} />

          {/* Liked Songs - replaces the earlier /profile stopgap */}
          <Route path="/app/liked" element={<LikedSongs />} />

          {/* Playlists - replaces the earlier /profile stopgap */}
          <Route path="/app/playlists" element={<Playlists />} />

          {/* Settings - replaces the earlier /profile stopgap */}
          <Route path="/app/settings" element={<Settings />} />
        </Route>

        {/* Music Games */}
        <Route 
          path="/games" 
          element={
            <ProtectedRoute>
              <MusicGames />
            </ProtectedRoute>
          }
        />

        {/* User Profile */}
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } 
        />

        {/* 404 Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;