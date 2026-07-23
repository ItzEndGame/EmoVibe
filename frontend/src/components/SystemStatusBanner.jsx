import React, { useState, useEffect, useRef } from 'react';

const getApiRoot = () => {
  const configured = process.env.REACT_APP_API_URL;
  if (configured) {
    return configured.replace(/\/api\/?$/, '');
  }

  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://127.0.0.1:5000';
  }

  return '';
};

const API_ROOT = getApiRoot();
const CHECK_INTERVAL_MS = 60000; // re-check every 60s while the issue persists

/**
 * Shows a dismissible top banner when the backend reports the database
 * (Supabase) is unreachable. Polls GET {API_ROOT}/health, which already
 * runs a real `SELECT 1` against the DB (see app.py) and reports
 * services.database as 'healthy' or 'unavailable'.
 *
 * Mount this once near the root of the app (e.g. in App.jsx, above your
 * routes) so it's visible regardless of which page the user is on.
 */
const SystemStatusBanner = () => {
  const [dbDown, setDbDown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);
  const intervalRef = useRef(null);

  const checkHealth = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${API_ROOT}/health`);
      const data = await res.json();
      const dbStatus = data?.services?.database;
      const isDown = dbStatus !== 'healthy';
      setDbDown(isDown);
      if (!isDown) setDismissed(false); // clear any prior dismissal once it recovers
    } catch (err) {
      // Network failure reaching the backend at all — treat the same as
      // "can't confirm things are working", so still warn the user.
      setDbDown(true);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    intervalRef.current = setInterval(checkHealth, CHECK_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, []);

  if (!dbDown || dismissed) return null;

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        background: 'rgba(239, 68, 68, 0.14)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        borderRadius: '10px',
        padding: '12px 18px',
        margin: '0 0 16px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>
          We're having trouble reaching our database right now, so some data may not load correctly.
          This is usually temporary — please try again in a few minutes.{' '}
          <a
            href="https://status.supabase.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#fff', textDecoration: 'underline' }}
          >
            Check Supabase status
          </a>
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button
          onClick={checkHealth}
          disabled={checking}
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '16px',
            padding: '6px 14px',
            fontSize: '0.85rem',
            cursor: checking ? 'not-allowed' : 'pointer',
          }}
        >
          {checking ? 'Checking...' : 'Check again'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '1.2rem',
            cursor: 'pointer',
            padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default SystemStatusBanner;