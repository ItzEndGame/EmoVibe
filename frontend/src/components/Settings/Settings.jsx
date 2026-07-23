import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Settings.css';
import { getUser, logout, spotifyConnectAPI, preferencesAPI, userAPI } from '../../services/api';

// Matches Config.EMOTION_GENRE_MAP keys exactly (preferences.py validates
// default_emotion against this same set) — includes 'excited', which isn't
// a camera-detected emotion but is a valid manual/default choice.
const EMOTIONS = [
  { value: 'happy', label: '😊 Happy' },
  { value: 'sad', label: '😢 Sad' },
  { value: 'angry', label: '😠 Angry' },
  { value: 'neutral', label: '😐 Neutral' },
  { value: 'surprise', label: '😲 Surprise' },
  { value: 'fear', label: '😰 Fear' },
  { value: 'disgust', label: '🤢 Disgust' },
  { value: 'excited', label: '🤩 Excited' },
];

// Matches Config.LANGUAGE_MARKET_MAP keys exactly (preferences.py validates
// language against this same set).
const LANGUAGES = [
  { value: 'english', label: '🇺🇸 English' },
  { value: 'hindi', label: '🇮🇳 Hindi' },
  { value: 'punjabi', label: '🇵🇦 Punjabi' },
  { value: 'tamil', label: '🇮🇳 Tamil' },
  { value: 'malayalam', label: '🇮🇳 Malayalam' },
  { value: 'spanish', label: '🇪🇸 Spanish' },
  { value: 'french', label: '🇫🇷 French' },
  { value: 'korean', label: '🇰🇷 Korean' },
  { value: 'japanese', label: '🇯🇵 Japanese' },
  { value: 'german', label: '🇩🇪 German' },
  { value: 'italian', label: '🇮🇹 Italian' },
  { value: 'portuguese', label: '🇧🇷 Portuguese' },
];

const Settings = () => {
  const navigate = useNavigate();
  const user = getUser();

  /* ---------------------------- Spotify connection ---------------------------- */
  const [spotifyStatus, setSpotifyStatus] = useState(null); // null = loading
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const loadSpotifyStatus = () => {
    spotifyConnectAPI.getStatus()
      .then(setSpotifyStatus)
      .catch(() => setSpotifyStatus({ connected: false }));
  };

  useEffect(() => {
    loadSpotifyStatus();
  }, []);

  const handleDisconnectSpotify = async () => {
    setDisconnecting(true);
    try {
      await spotifyConnectAPI.disconnect();
      showToast('Spotify disconnected');
      setConfirmDisconnect(false);
      loadSpotifyStatus();
    } catch (err) {
      console.error('Failed to disconnect Spotify:', err);
      showToast("Couldn't disconnect Spotify — please try again.", 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  /* ---------------------------- Music preferences ----------------------------
     Confirmed against preferences.py: GET/PUT /api/preferences works with
     { default_emotion, explicit_content, autoplay, language, theme }.
     theme is deliberately not exposed here — the backend supports 'light',
     but no light theme actually exists in this app, so a toggle for it
     would just be a fake setting. */
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [defaultEmotion, setDefaultEmotion] = useState('happy');
  const [language, setLanguage] = useState('english');
  const [autoplay, setAutoplay] = useState(false);
  const [explicitContent, setExplicitContent] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsUnavailable, setPrefsUnavailable] = useState(false);

  useEffect(() => {
    preferencesAPI.get()
      .then((res) => {
        const p = res.preferences || {};
        if (p.default_emotion) setDefaultEmotion(p.default_emotion);
        if (p.language) setLanguage(p.language);
        if (typeof p.autoplay === 'boolean') setAutoplay(p.autoplay);
        if (typeof p.explicit_content === 'boolean') setExplicitContent(p.explicit_content);
      })
      .catch((err) => {
        console.warn('Preferences fetch failed — defaults will still work, just won\'t persist:', err);
        setPrefsUnavailable(true);
      })
      .finally(() => setPrefsLoading(false));
  }, []);

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      await preferencesAPI.update({
        default_emotion: defaultEmotion,
        language,
        autoplay,
        explicit_content: explicitContent,
      });
      showToast('Preferences saved');
    } catch (err) {
      console.error('Failed to save preferences:', err);
      showToast("Couldn't save preferences right now.", 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  /* ---------------------------- Danger zone ---------------------------- */
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await userAPI.deleteAccount();
      logout(); // clears tokens and redirects to /login
    } catch (err) {
      console.error('Failed to delete account:', err);
      showToast("Couldn't delete your account — please try again.", 'error');
      setDeleting(false);
    }
  };

  /* ---------------------------- Toast ---------------------------- */
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <>
      {toast && (
        <div className={`set-toast ${toast.type === 'error' ? 'set-toast-error' : ''}`}>
          {toast.message}
        </div>
      )}

      <header className="set-header">
        <h1>Settings</h1>
        <p>Manage your account, connections, and preferences.</p>
      </header>

      <div className="set-sections">
        {/* ===== Account ===== */}
        <section className="set-card">
          <h2>Account</h2>
          <div className="set-account-row">
            <div className="set-account-avatar">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="set-account-name">{user?.name || 'User'}</p>
              <p className="set-account-email">{user?.email || 'email@example.com'}</p>
            </div>
            <button className="set-btn-secondary" onClick={() => navigate('/profile')}>
              Edit Profile
            </button>
          </div>
        </section>

        {/* ===== Spotify Connection ===== */}
        <section className="set-card">
          <h2>Spotify Connection</h2>

          {spotifyStatus === null ? (
            <p className="set-muted">Checking connection…</p>
          ) : spotifyStatus.connected ? (
            <div className="set-spotify-row">
              <div className="set-spotify-status">
                <span className="set-status-dot set-status-connected" />
                <div>
                  <p className="set-spotify-title">Connected</p>
                  <p className="set-muted">
                    {spotifyStatus.is_premium ? 'Spotify Premium — full playback enabled' : 'Spotify Free — 30-second previews only'}
                  </p>
                </div>
              </div>

              {!confirmDisconnect ? (
                <button className="set-btn-danger-outline" onClick={() => setConfirmDisconnect(true)}>
                  Disconnect
                </button>
              ) : (
                <div className="set-confirm-inline">
                  <span>Disconnect Spotify?</span>
                  <button className="set-btn-secondary" onClick={() => setConfirmDisconnect(false)} disabled={disconnecting}>
                    Cancel
                  </button>
                  <button className="set-btn-danger" onClick={handleDisconnectSpotify} disabled={disconnecting}>
                    {disconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="set-spotify-row">
              <div className="set-spotify-status">
                <span className="set-status-dot set-status-disconnected" />
                <div>
                  <p className="set-spotify-title">Not connected</p>
                  <p className="set-muted">Connect your Spotify account for full-song playback.</p>
                </div>
              </div>
              <button className="set-btn-primary" onClick={() => spotifyConnectAPI.connect()}>
                🎧 Connect Spotify
              </button>
            </div>
          )}
        </section>

        {/* ===== Music Preferences ===== */}
        <section className="set-card">
          <h2>Music Preferences</h2>
          <p className="set-muted" style={{ marginBottom: '18px' }}>
            Used as defaults across the app — the language dropdown in your recommendations, and what mood/settings to fall back on.
          </p>

          {prefsUnavailable && (
            <div className="set-inline-note">
              Couldn't load your saved preferences — changes below will still work this session, but may not persist.
            </div>
          )}

          <div className="set-form-row">
            <label>Default mood</label>
            <select
              value={defaultEmotion}
              onChange={(e) => setDefaultEmotion(e.target.value)}
              disabled={prefsLoading}
            >
              {EMOTIONS.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>

          <div className="set-form-row">
            <label>Default language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={prefsLoading}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="set-form-row">
            <label>Autoplay first recommendation</label>
            <label className="set-switch">
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(e) => setAutoplay(e.target.checked)}
                disabled={prefsLoading}
              />
              <span className="set-switch-track" />
            </label>
          </div>

          <div className="set-form-row">
            <label>Allow explicit content</label>
            <label className="set-switch">
              <input
                type="checkbox"
                checked={explicitContent}
                onChange={(e) => setExplicitContent(e.target.checked)}
                disabled={prefsLoading}
              />
              <span className="set-switch-track" />
            </label>
          </div>

          <button className="set-btn-primary" onClick={handleSavePrefs} disabled={savingPrefs || prefsLoading}>
            {savingPrefs ? 'Saving…' : 'Save Preferences'}
          </button>
        </section>

        {/* ===== Session ===== */}
        <section className="set-card">
          <h2>Session</h2>
          <p className="set-muted" style={{ marginBottom: '16px' }}>
            Sign out of EmoVibe on this device.
          </p>
          <button className="set-btn-secondary" onClick={logout}>
            Log Out
          </button>
        </section>

        {/* ===== Danger Zone ===== */}
        <section className="set-card set-card-danger">
          <h2>Danger Zone</h2>
          <p className="set-muted" style={{ marginBottom: '16px' }}>
            Permanently delete your account and all associated data — detections, liked songs, and playlists. This cannot be undone.
          </p>

          {!confirmDelete ? (
            <button className="set-btn-danger-outline" onClick={() => setConfirmDelete(true)}>
              Delete Account
            </button>
          ) : (
            <div className="set-delete-confirm">
              <p>Type <strong>DELETE</strong> to confirm. This is permanent.</p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                disabled={deleting}
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  className="set-btn-secondary"
                  onClick={() => { setConfirmDelete(false); setDeleteConfirmText(''); }}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="set-btn-danger"
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmText !== 'DELETE'}
                >
                  {deleting ? 'Deleting…' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default Settings;