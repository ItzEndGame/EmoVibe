import React, { useState, useEffect } from 'react';
import { spotifyConnectAPI, getUser } from '../../services/api';
import { usePlayer } from '../../context/PlayerContext';

/**
 * Spotify connection banner.
 * - Not connected: dismissible prompt to connect. Dismissal is scoped
 *   per-user-id (not just per-browser-session), so switching accounts
 *   in the same tab doesn't carry over another user's dismissal.
 * - Connected: a small, persistent "connected" confirmation strip
 *   (shows Premium vs Free). Auto-clears any leftover dismissal flag
 *   and is not itself dismissible since it's just a status indicator.
 */
const SpotifyConnectBanner = () => {
  const [status, setStatus] = useState(null); // null = loading
  const [dismissed, setDismissed] = useState(false);
  const [connectError, setConnectError] = useState(false);
  const [connectErrorDetail, setConnectErrorDetail] = useState('');
  const { refreshStatus: refreshSpotifySdk } = usePlayer().spotify;

  const user = getUser();
  const dismissKey = user?.id ? `spotify_banner_dismissed_${user.id}` : null;

  useEffect(() => {
    if (dismissKey) {
      setDismissed(sessionStorage.getItem(dismissKey) === 'true');
    }
  }, [dismissKey]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const result = await spotifyConnectAPI.getStatus();
        setStatus(result);
      } catch (err) {
        console.error('Failed to check Spotify status:', err);
        setStatus({ connected: false });
      }
    };
    checkStatus();
  }, []);

  // Re-check status if we just came back from the Spotify OAuth redirect.
  // The backend sends us back with ?spotify=connected on success or
  // ?spotify=error if it couldn't even start/complete the OAuth flow
  // (e.g. misconfigured Spotify app credentials or redirect URI) —
  // previously only the success case was handled, so an error here just
  // silently left a confusing "?spotify=error" in the URL with no feedback.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('spotify');

    if (outcome === 'connected') {
      spotifyConnectAPI.getStatus().then(setStatus).catch(() => {});
      // The Spotify SDK connection (in PlayerContext) only checks Premium
      // status once, on initial app load, since it no longer remounts on
      // navigation. If the account wasn't connected yet at that point,
      // it needs to be told explicitly to check again now that it is.
      refreshSpotifySdk();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (outcome) {
      // Covers 'error' plus the other failure flags this route can send
      // (missing_token, invalid_token, denied, failed, token_failed,
      // token_incomplete, profile_failed) — all are real connect failures
      // worth surfacing, not just the generic 'error' case.
      setConnectError(true);
      setConnectErrorDetail(params.get('detail') || '');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // If the user is connected, make sure no stale dismissal flag lingers
  // and ensure the banner isn't suppressed.
  useEffect(() => {
    if (status?.connected && dismissKey) {
      sessionStorage.removeItem(dismissKey);
      setDismissed(false);
    }
  }, [status, dismissKey]);

  const handleDismiss = () => {
    if (dismissKey) {
      sessionStorage.setItem(dismissKey, 'true');
    }
    setDismissed(true);
  };

  const handleConnect = () => {
    spotifyConnectAPI.connect();
  };

  if (!status) return null;

  // ===== Connected state =====
  if (status.connected) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(30, 215, 96, 0.08)',
        border: '1px solid rgba(30, 215, 96, 0.25)',
        borderRadius: '10px',
        padding: '10px 16px',
        margin: '0 0 20px 0',
      }}>
        <span style={{ fontSize: '1.1rem' }}>✅</span>
        <p style={{ margin: 0, fontSize: '0.88rem', color: '#fff' }}>
          Spotify connected
          {status.is_premium
            ? ' — Premium, full songs enabled'
            : ' — Free account, 30-second previews only'}
        </p>
      </div>
    );
  }

  // ===== Connection failed state — shown regardless of prior dismissal,
  // since this is fresh, relevant feedback the user should see. =====
  if (connectError) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        background: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        borderRadius: '12px',
        padding: '14px 18px',
        margin: '0 0 20px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.4rem' }}>⚠️</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: '#fff' }}>
              Couldn't connect Spotify
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75, color: '#fff' }}>
              {connectErrorDetail
                ? connectErrorDetail
                : "Something went wrong before we could reach Spotify. This is usually a setup issue on our end, not something wrong with your account."}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <button
            onClick={() => { setConnectError(false); setConnectErrorDetail(''); spotifyConnectAPI.connect(); }}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 18px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => { setConnectError(false); setConnectErrorDetail(''); }}
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
  }

  // ===== Not connected state =====
  if (dismissed) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      background: 'rgba(30, 215, 96, 0.12)',
      border: '1px solid rgba(30, 215, 96, 0.35)',
      borderRadius: '12px',
      padding: '14px 18px',
      margin: '0 0 20px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '1.4rem' }}>🎧</span>
        <div>
          <p style={{ margin: 0, fontWeight: 600, color: '#fff' }}>
            Connect Spotify to unlock full songs
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75, color: '#fff' }}>
            You can already preview tracks below. Connecting confirms your Premium status so the player can switch from 30-second previews to full songs.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button
          onClick={handleConnect}
          style={{
            background: '#1ED760',
            color: '#000',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 18px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Connect Spotify
        </button>
        <button
          onClick={handleDismiss}
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

export default SpotifyConnectBanner;