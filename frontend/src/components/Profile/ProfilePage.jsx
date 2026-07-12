import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import { userAPI, getUser, API_ROOT } from '../../services/api';

/* Kept in sync with the emotion metadata used across Dashboard/History/
   LikedSongs, so the same emotion always looks the same everywhere. */
const EMOTIONS = [
  { name: 'happy', label: 'Happy', emoji: '😊', color: '#8fe34d' },
  { name: 'sad', label: 'Sad', emoji: '😢', color: '#4f8dfd' },
  { name: 'angry', label: 'Angry', emoji: '😠', color: '#ff6b6b' },
  { name: 'disgust', label: 'Disgust', emoji: '🤢', color: '#a8e6cf' },
  { name: 'surprise', label: 'Surprise', emoji: '😲', color: '#ffd93d' },
  { name: 'fear', label: 'Fear', emoji: '😰', color: '#9d5cff' },
  { name: 'neutral', label: 'Neutral', emoji: '😐', color: '#a0a0a0' },
];
const emotionMeta = (name) => EMOTIONS.find((e) => e.name === (name || '').toLowerCase()) || null;

// emotion_breakdown keys come straight from the DB — songs liked before
// emotion detection ran, or where detection failed, have no emotion on
// record. That shows up here as an actual `null` key, which JS stringifies
// to the text "null" once it round-trips through the object — this turns
// that (and any other unrecognized key) into a readable label instead.
const emotionDisplayLabel = (name) => {
  const meta = emotionMeta(name);
  if (meta) return meta.label;
  if (!name || name === 'null' || name === 'undefined') return 'Unknown';
  return name;
};

const profilePictureUrl = (filename) => {
  if (!filename) return null;
  return `${API_ROOT}/api/user/profile/picture/${filename}`;
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(() => getUser());
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    preferred_genres: user?.preferred_genres || '',
  });

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Refresh from the server on mount — localStorage's cached user can be
  // stale (e.g. a picture or genre update from a previous session).
  useEffect(() => {
    userAPI.getProfile()
      .then((res) => {
        if (res.user) {
          setUser(res.user);
          setFormData({
            name: res.user.name || '',
            preferred_genres: res.user.preferred_genres || '',
          });
          localStorage.setItem('user', JSON.stringify(res.user));
          setPhotoLoadFailed(false);
        }
      })
      .catch((err) => console.error('Failed to refresh profile:', err));
  }, []);

  useEffect(() => {
    setStatsLoading(true);
    userAPI.getStatistics()
      .then((res) => {
        setStats(res.statistics || null);
      })
      .catch((err) => {
        console.error('Failed to load statistics:', err);
        setStatsError("Couldn't load your stats right now.");
      })
      .finally(() => setStatsLoading(false));
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await userAPI.updateProfile(formData);
      if (res.success) {
        setUser((prev) => ({ ...prev, ...res.user }));
        localStorage.setItem('user', JSON.stringify({ ...user, ...res.user }));
        setEditing(false);
        showToast('Profile updated');
      } else {
        showToast(res.message || 'Failed to update profile', 'error');
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      showToast('Failed to update profile. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const res = await userAPI.uploadProfilePicture(file);
      if (res.success) {
        setUser((prev) => {
          const next = { ...prev, profile_picture: res.profile_picture };
          localStorage.setItem('user', JSON.stringify(next));
          return next;
        });
        setPhotoLoadFailed(false);
        showToast('Profile picture updated');
      } else {
        showToast(res.message || 'Failed to upload photo', 'error');
      }
    } catch (err) {
      console.error('Failed to upload profile picture:', err);
      showToast('Failed to upload photo. Please try again.', 'error');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const avatarUrl = profilePictureUrl(user?.profile_picture);

  return (
    <>
      {toast && (
        <div className={`prof-toast ${toast.type === 'error' ? 'prof-toast-error' : ''}`}>
          {toast.message}
        </div>
      )}

      <header className="prof-header">
        <h1>My Profile</h1>
        <p>Your account, activity, and mood history at a glance.</p>
      </header>

      {/* ===== Identity card ===== */}
      <section className="prof-card prof-identity">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelect}
          style={{ display: 'none' }}
        />

        <div className="prof-avatar-wrap">
          <div className="prof-avatar" onClick={() => fileInputRef.current.click()}>
            {avatarUrl && !photoLoadFailed ? (
              <img
                src={avatarUrl}
                alt={user?.name || 'Profile'}
                onError={() => setPhotoLoadFailed(true)}
              />
            ) : (
              <span>{user?.name?.charAt(0).toUpperCase() || '👤'}</span>
            )}
            <div className="prof-avatar-overlay">{uploadingPhoto ? '…' : '📷'}</div>
          </div>
        </div>

        {editing ? (
          <div className="prof-edit-form">
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Your name"
            />
            <input
              type="text"
              name="preferred_genres"
              value={formData.preferred_genres}
              onChange={handleChange}
              placeholder="Preferred genres (comma-separated)"
            />
            <div className="prof-edit-actions">
              <button className="prof-btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
              <button className="prof-btn-primary" onClick={handleSaveProfile} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="prof-name">{user?.name || 'User'}</h2>
            <p className="prof-email">{user?.email || 'email@example.com'}</p>
            <button className="prof-btn-secondary" onClick={() => setEditing(true)}>
              ✏️ Edit Profile
            </button>
          </>
        )}
      </section>

      {/* ===== Account info ===== */}
      <section className="prof-card">
        <h3 className="prof-card-title">Account Information</h3>
        <div className="prof-info-grid">
          <div>
            <p className="prof-info-label">Account Created</p>
            <p className="prof-info-value">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
            </p>
          </div>
          <div>
            <p className="prof-info-label">Preferred Genres</p>
            <p className="prof-info-value">{user?.preferred_genres || 'Not set'}</p>
          </div>
          <div>
            <p className="prof-info-label">Member For</p>
            <p className="prof-info-value">
              {statsLoading ? '—' : stats?.account_age_days != null ? `${stats.account_age_days} days` : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* ===== Real stats, from /user/statistics ===== */}
      <section className="prof-card">
        <h3 className="prof-card-title">Your Stats</h3>

        {statsError ? (
          <p className="prof-empty-state">{statsError}</p>
        ) : (
          <div className="prof-stats-grid">
            <div className="prof-stat-card">
              <span className="prof-stat-icon">🙂</span>
              <p className="prof-stat-value">{statsLoading ? '—' : stats?.total_detections ?? 0}</p>
              <p className="prof-stat-label">Detections</p>
            </div>
            <div className="prof-stat-card">
              <span className="prof-stat-icon">🎵</span>
              <p className="prof-stat-value">{statsLoading ? '—' : stats?.total_songs_played ?? 0}</p>
              <p className="prof-stat-label">Songs Played</p>
            </div>
            <div className="prof-stat-card">
              <span className="prof-stat-icon">⏱️</span>
              <p className="prof-stat-value">{statsLoading ? '—' : stats?.time_listened?.formatted ?? '0h 0m'}</p>
              <p className="prof-stat-label">Listening Time</p>
            </div>
            <div className="prof-stat-card">
              <span className="prof-stat-icon">🔥</span>
              <p className="prof-stat-value">{statsLoading ? '—' : stats?.day_streak ?? 0}</p>
              <p className="prof-stat-label">Day Streak</p>
            </div>
            <div className="prof-stat-card">
              <span className="prof-stat-icon">
                {statsLoading ? '⭐' : emotionMeta(stats?.favorite_mood?.emotion)?.emoji || '⭐'}
              </span>
              <p className="prof-stat-value">
                {statsLoading ? '—' : emotionMeta(stats?.favorite_mood?.emotion)?.label || '—'}
              </p>
              <p className="prof-stat-label">Favorite Mood</p>
            </div>
            <div className="prof-stat-card">
              <span className="prof-stat-icon">❤️</span>
              <p className="prof-stat-value">{statsLoading ? '—' : stats?.total_liked_songs ?? 0}</p>
              <p className="prof-stat-label">Liked Songs</p>
            </div>
          </div>
        )}
      </section>

      {/* ===== Emotion distribution (real — computed from liked songs' emotion_detected) ===== */}
      {!statsLoading && stats?.emotion_breakdown && Object.keys(stats.emotion_breakdown).length > 0 && (
        <section className="prof-card">
          <h3 className="prof-card-title">Emotion Distribution</h3>
          <p className="prof-card-subtitle">Based on the moods behind your liked songs.</p>
          <div className="prof-emotion-list">
            {Object.entries(stats.emotion_breakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([emotion, count]) => {
                const meta = emotionMeta(emotion);
                const total = stats.total_liked_songs || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={emotion} className="prof-emotion-row">
                    <div className="prof-emotion-label">
                      <span>{meta?.emoji || '🎵'}</span>
                      <span>{emotionDisplayLabel(emotion)}</span>
                      <span className="prof-emotion-count">{count} song{count === 1 ? '' : 's'}</span>
                    </div>
                    <div className="prof-emotion-bar-track">
                      <div
                        className="prof-emotion-bar-fill"
                        style={{ width: `${pct}%`, background: meta?.color || '#8fe34d' }}
                      >
                        <span>{pct}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* ===== Liked Songs summary — full list lives on its own page ===== */}
      <section className="prof-card">
        <div className="prof-liked-summary">
          <div>
            <h3 className="prof-card-title" style={{ marginBottom: '4px' }}>Liked Songs</h3>
            <p className="prof-card-subtitle">
              {statsLoading ? 'Loading…' : `${stats?.total_liked_songs ?? 0} song${(stats?.total_liked_songs ?? 0) === 1 ? '' : 's'} saved`}
            </p>
          </div>
          <button className="prof-btn-primary" onClick={() => navigate('/app/liked')}>
            View Liked Songs →
          </button>
        </div>
      </section>

      {/* ===== Account management pointer — Spotify + deletion live in Settings now ===== */}
      <section className="prof-card">
        <div className="prof-liked-summary">
          <div>
            <h3 className="prof-card-title" style={{ marginBottom: '4px' }}>Account Management</h3>
            <p className="prof-card-subtitle">Spotify connection, preferences, and account deletion.</p>
          </div>
          <button className="prof-btn-secondary" onClick={() => navigate('/app/settings')}>
            Go to Settings →
          </button>
        </div>
      </section>
    </>
  );
};

export default ProfilePage;