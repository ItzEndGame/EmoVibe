import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, setAuthToken, setUser } from '../../services/api';

/**
 * Catches redirects from Google OAuth.
 * Backend redirects here with access_token + refresh_token as query params.
 * We store them, fetch the user profile, then go to /app.
 */
const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const errorCode = params.get('error');

      if (errorCode) {
        navigate(`/login?error=${encodeURIComponent(errorCode)}`);
        return;
      }

      window.history.replaceState({}, document.title, window.location.pathname);

      try {
        const result = await authAPI.validateToken();
        if (result.success && result.user) {
          // Only mark the session as valid AFTER it's actually confirmed —
          // marking it first caused the api.js interceptor to treat a
          // failed validation as an "expired session" instead of a fresh
          // OAuth login that never authenticated.
          setAuthToken('session');
          setUser(result.user);
          navigate('/app', { replace: true });
          return;
        }
        navigate('/login?error=google_session_failed');
      } catch (err) {
        console.error('Failed to fetch user after OAuth:', err);
        navigate('/login?error=google_session_failed');
      }
    };

    run();
  }, [navigate]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: 'white',
      fontSize: '1.2rem'
    }}>
      Signing you in...
    </div>
  );
};

export default AuthCallback;