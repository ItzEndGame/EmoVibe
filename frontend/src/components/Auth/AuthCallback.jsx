import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';

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
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const errorCode = params.get('error');

      if (!accessToken) {
        navigate(`/login?error=${encodeURIComponent(errorCode || 'oauth_failed')}`);
        return;
      }

      localStorage.setItem('access_token', accessToken);
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }

      try {
        const result = await authAPI.validateToken();
        if (result.success) {
          localStorage.setItem('user', JSON.stringify(result.user));
        }
      } catch (err) {
        console.error('Failed to fetch user after OAuth:', err);
      }

      navigate('/app');
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