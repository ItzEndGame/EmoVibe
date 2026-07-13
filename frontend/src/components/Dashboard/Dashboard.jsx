import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { emotionAPI, musicAPI,notificationsAPI, getUser } from '../../services/api';
import CurrentlyPlayingBar from '../Spotify/CurrentlyPlayingBar';
import { useListeningHeartbeat } from '../Spotify/useListeningHeartbeat';
import SpotifyConnectBanner from '../Spotify/SpotifyConnectBanner';

/* ============================== Icons ============================== */

const CameraIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="11.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="17" cy="7" r="1" fill="currentColor" />
  </svg>
);

const UploadIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v10M8 11l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 19h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const HeartIcon = ({ filled }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);

/* ===================== Emotion metadata (shared) =====================
   Kept in sync with MainApp.jsx's `emotionEmojis` and moodTracker.js's
   color map, so the same emotion always looks the same across
   Dashboard, detection flow, and the Profile analytics charts. */
const EMOTIONS = [
  { name: 'happy', label: 'Happy', emoji: '😊', color: '#8fe34d' },
  { name: 'sad', label: 'Sad', emoji: '😢', color: '#4f8dfd' },
  { name: 'angry', label: 'Angry', emoji: '😠', color: '#ff6b6b' },
  { name: 'disgust', label: 'Disgust', emoji: '🤢', color: '#a8e6cf' },
  { name: 'surprise', label: 'Surprise', emoji: '😲', color: '#ffd93d' },
  { name: 'fear', label: 'Fear', emoji: '😰', color: '#9d5cff' },
  { name: 'neutral', label: 'Neutral', emoji: '😐', color: '#a0a0a0' },
];
const emotionMeta = (name) =>
  EMOTIONS.find((e) => e.name === (name || '').toLowerCase()) || EMOTIONS[6];

/* Turns a timestamp into "10 min ago" / "Yesterday" / etc. Returns ''
   for anything it can't parse, so callers can hide the line instead of
   showing "Invalid Date". */
const timeAgo = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return date.toLocaleDateString();
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [user] = useState(() => getUser());
  const { startTracking } = useListeningHeartbeat();

  // Recent Detections (right column)
  const [recentDetections, setRecentDetections] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState('');

  // Recommended playlists (left column)
  const [playlists, setPlaylists] = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistsError, setPlaylistsError] = useState('');
  const [playlistsMood, setPlaylistsMood] = useState('happy');

  // "Jump Back In" — most recently liked song
  const [lastLiked, setLastLiked] = useState(null);
  const [lastLikedLoading, setLastLikedLoading] = useState(true);
  const [unliking, setUnliking] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null); // plays via the real CurrentlyPlayingBar, not a raw iframe

  // Streaks
  const [currentStreak, setCurrentStreak] = useState(null);
  const [longestStreak, setLongestStreak] = useState(null);
  const [streakLoading, setStreakLoading] = useState(true);

  // Notification bell badge
  const [unreadCount, setUnreadCount] = useState(0);

  /* ---------------------------- Data fetching ---------------------------- */

  const loadRecentDetections = useCallback(async () => {
    setRecentLoading(true);
    setRecentError('');
    try {
      const res = await emotionAPI.getHistory(5);
      const raw = res.history || res.detections || res.data || [];
      const normalized = raw.map((item, idx) => ({
        id: item.id ?? idx,
        emotion: (item.emotion || item.detected_emotion || 'neutral').toLowerCase(),
        confidence: item.confidence,
        time: item.timestamp || item.created_at || item.detected_at || null,
      }));
      setRecentDetections(normalized);
    } catch (err) {
      console.error('Failed to load emotion history:', err);
      setRecentError("Couldn't load your recent detections.");
    } finally {
      setRecentLoading(false);
    }
  }, []);

  const loadPlaylists = useCallback(async () => {
    setPlaylistsLoading(true);
    setPlaylistsError('');
    try {
      // Prefer the user's favorite mood so recommendations feel personal;
      // fall back to a pleasant default if that endpoint has no data yet.
      let seedMood = 'happy';
      try {
        const favRes = await emotionAPI.getFavoriteMood();
        seedMood = (favRes.favorite_mood?.emotion || seedMood).toLowerCase();
      } catch {
        // Not fatal — just use the default seed mood.
      }
      setPlaylistsMood(seedMood);

      // Uses the same recommendations endpoint MainApp's track list already
      // relies on (confirmed shape: { success, tracks, has_more }), rather
      // than the mood-playlists endpoint, whose response shape wasn't
      // actually verified anywhere and was only returning a single item.
      const res = await musicAPI.getRecommendations(seedMood, 'english', 8);
      const raw = res.tracks || [];
      const normalized = raw.map((track, idx) => ({
        id: track.id ?? idx,
        title: track.title || 'Untitled',
        artist: track.artist || 'Unknown artist',
        cover: track.album_art || null,
      }));
      setPlaylists(normalized);
    } catch (err) {
      console.error('Failed to load recommended tracks:', err);
      setPlaylistsError("Couldn't load recommendations right now.");
    } finally {
      setPlaylistsLoading(false);
    }
  }, []);

  const loadLastLiked = useCallback(async () => {
    setLastLikedLoading(true);
    try {
      const res = await musicAPI.getLikedSongs(1);
      const songs = res.liked_songs || [];
      if (songs.length > 0) {
        const s = songs[0];
        setLastLiked({
          id: s.spotify_track_id || s.id,
          dbId: s.id,
          title: s.song_title || s.title,
          artist: s.artist,
          albumArt: s.album_art_url,
          emotion: (s.emotion_detected || s.emotion || 'happy').toLowerCase(),
        });
      } else {
        setLastLiked(null);
      }
    } catch (err) {
      console.error('Failed to load liked songs:', err);
      setLastLiked(null);
    } finally {
      setLastLikedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecentDetections();
    loadPlaylists();
    loadLastLiked();

    setStreakLoading(true);
    Promise.allSettled([emotionAPI.getStreak(), emotionAPI.getLongestStreak()])
      .then(([currentRes, longestRes]) => {
        if (currentRes.status === 'fulfilled') setCurrentStreak(currentRes.value.day_streak ?? 0);
        if (longestRes.status === 'fulfilled') setLongestStreak(longestRes.value.longest_streak ?? 0);
      })
      .finally(() => setStreakLoading(false));
  }, [loadRecentDetections, loadPlaylists, loadLastLiked]);

  // Notification bell badge — load on mount, then refresh periodically and
  // whenever the tab regains focus (covers "left the tab open, streak
  // milestone happened elsewhere"), without needing a live socket.
  useEffect(() => {
    const loadUnreadCount = () => {
      notificationsAPI.getUnreadCount()
        .then((res) => setUnreadCount(res.unread_count ?? 0))
        .catch((err) => console.error('Failed to load unread notification count:', err));
    };

    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 60000); // refresh every 60s
    window.addEventListener('focus', loadUnreadCount);
  
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', loadUnreadCount);
    };
  }, []);

  /* ------------------------------ Actions ------------------------------ */

  const handleDetect = (method) => {
    navigate('/app/detect', { state: { method } });
  };

  const handleSelectEmotion = (emotion) => {
    // Log the selection immediately so it shows up in history even if the
    // user leaves the detect page without picking a track. Best-effort —
    // the detect page re-selects the mood itself either way.
    emotionAPI.logSelection(emotion.name).catch(() => {});
    navigate('/app/detect', { state: { method: 'select', emotion: emotion.name } });
  };

  const handleReplayDetection = (detection) => {
    navigate('/app/detect', { state: { method: 'select', emotion: detection.emotion } });
  };

  const handlePlayRecommended = (track) => {
    emotionAPI.logSelection(playlistsMood).catch(() => {});
    navigate('/app/detect', {
      state: {
        method: 'select',
        emotion: playlistsMood,
        track: { id: track.id, title: track.title, artist: track.artist, album_art: track.cover },
      },
    });
  };

  const handleUnlikeLastLiked = async () => {
    if (!lastLiked || unliking) return;
    setUnliking(true);
    try {
      await musicAPI.unlikeSong(lastLiked.dbId);
      setLastLiked(null);
      setCurrentTrack((prev) => (prev?.id === lastLiked.id ? null : prev));
    } catch (err) {
      console.error('Failed to unlike song:', err);
    } finally {
      setUnliking(false);
    }
  };

  const handlePlayLastLiked = () => {
    if (!lastLiked) return;
    startTracking(lastLiked.id);
    setCurrentTrack({
      id: lastLiked.id,
      title: lastLiked.title,
      artist: lastLiked.artist,
      album_art: lastLiked.albumArt,
      spotify_uri: `spotify:track:${lastLiked.id}`,
    });
  };

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div style={currentTrack ? { paddingBottom: '90px' } : undefined}>
      {/* Header */}
      <header className="db-header">
        <div className="db-header-left">
          <h1>Welcome back, {firstName} 👋</h1>
          <p>Let's find the perfect music for your mood.</p>
        </div>
        <div className="db-header-right">
          <button
            className="db-header-btn db-notification"
            title="Notifications"
            onClick={() => navigate('/app/notifications')}
          >
            🔔
            {unreadCount > 0 && (
              <span className="db-notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>
        </div>
      </header>

      <div className="db-streak-row">
        <div className="db-streak-card">
          <span className="db-streak-icon">🔥</span>
          <div>
            <p className="db-streak-value">{streakLoading ? '—' : (currentStreak ?? 0)}</p>
            <p className="db-streak-label">Current Streak</p>
          </div>
        </div>
        <div className="db-streak-card">
          <span className="db-streak-icon">🏆</span>
          <div>
            <p className="db-streak-value">{streakLoading ? '—' : (longestStreak ?? 0)}</p>
            <p className="db-streak-label">Highest Streak</p>
          </div>
        </div>
      </div>

      <SpotifyConnectBanner />

      {/* Content Grid */}
      <div className="db-content-grid">
          {/* Left Section */}
          <section className="db-left-section">
            {/* Detect Emotion */}
            <div className="db-detect">
              <h2>Detect Your Emotion</h2>
              <p>Let's find the method that works best for you</p>

              <div className="db-detect-cards">
                <div className="db-detect-card">
                  <div className="db-detect-icon">
                    <CameraIcon />
                  </div>
                  <h3>Live Photo</h3>
                  <p>Capture your emotion in real-time</p>
                  <button className="db-detect-btn" onClick={() => handleDetect('camera')}>
                    Start Camera
                  </button>
                </div>

                <div className="db-detect-card">
                  <div className="db-detect-icon">
                    <UploadIcon />
                  </div>
                  <h3>Upload Photo</h3>
                  <p>Upload a photo from your device</p>
                  <button className="db-detect-btn" onClick={() => handleDetect('upload')}>
                    Upload Image
                  </button>
                </div>
              </div>
            </div>

            {/* Emotion Selector */}
            <div className="db-emotion-select">
              <h3>Or select your emotion</h3>
              <p>Pick how you're feeling right now</p>

              <div className="db-emotions">
                {EMOTIONS.map((emotion) => (
                  <button
                    key={emotion.name}
                    className="db-emotion-btn"
                    style={{ '--emotion-color': emotion.color }}
                    onClick={() => handleSelectEmotion(emotion)}
                  >
                    <span className="db-emotion-circle" style={{ background: `${emotion.color}26`, color: emotion.color }}>
                      {emotion.emoji}
                    </span>
                    {emotion.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recommended */}
            <div className="db-recommended">
              <div className="db-recommended-header">
                <h2>Recommended For You</h2>
                <a href="/profile" onClick={(e) => { e.preventDefault(); navigate('/profile'); }}>View All</a>
              </div>
              <p>Based on your {playlistsMood} vibe</p>

              {playlistsLoading ? (
                <div className="db-playlist-grid">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="db-playlist-card db-skeleton-card">
                      <div className="db-skeleton db-playlist-image" />
                      <div className="db-skeleton db-skeleton-line" />
                    </div>
                  ))}
                </div>
              ) : playlistsError ? (
                <p className="db-empty-state">{playlistsError}</p>
              ) : playlists.length === 0 ? (
                <p className="db-empty-state">
                  No recommendations yet for this mood — detect an emotion above to get matched with music.
                </p>
              ) : (
                <div className="db-playlist-grid">
                  {playlists.map((track) => (
                    <div
                      key={track.id}
                      className="db-playlist-card"
                      onClick={() => handlePlayRecommended(track)}
                      title={`Play ${track.title}`}
                    >
                      <div className="db-playlist-image">
                        {track.cover ? (
                          <img src={track.cover} alt={track.title} />
                        ) : (
                          emotionMeta(playlistsMood).emoji
                        )}
                      </div>
                      <h3>{track.title}</h3>
                      <p>{track.artist}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Right Section */}
          <aside className="db-right-section">
            {/* Recent Detections */}
            <div className="db-recent">
              <div className="db-recent-header">
                <h3>Recent Detections</h3>
                <a href="/app/history" onClick={(e) => { e.preventDefault(); navigate('/app/history'); }}>View All</a>
              </div>

              {recentLoading ? (
                <div className="db-recent-list">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="db-recent-item">
                      <div className="db-skeleton db-recent-avatar" />
                      <div className="db-recent-info">
                        <div className="db-skeleton db-skeleton-line" style={{ width: '60%' }} />
                        <div className="db-skeleton db-skeleton-line" style={{ width: '35%', marginTop: 6 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentError ? (
                <p className="db-empty-state">{recentError}</p>
              ) : recentDetections.length === 0 ? (
                <p className="db-empty-state">
                  No detections yet. Try the camera or pick an emotion to get started.
                </p>
              ) : (
                <div className="db-recent-list">
                  {recentDetections.map((detection) => {
                    const meta = emotionMeta(detection.emotion);
                    return (
                      <div key={detection.id} className="db-recent-item" onClick={() => handleReplayDetection(detection)}>
                        <div className="db-recent-avatar" style={{ background: `${meta.color}26` }}>
                          {meta.emoji}
                        </div>
                        <div className="db-recent-info">
                          <p className="db-recent-name" style={{ color: meta.color }}>{meta.label}</p>
                          <p className="db-recent-time">{timeAgo(detection.time) || '—'}</p>
                        </div>
                        <button
                          className="db-recent-play"
                          title={`Get ${meta.label.toLowerCase()} music`}
                          onClick={(e) => { e.stopPropagation(); handleReplayDetection(detection); }}
                        >
                          <PlayIcon />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Jump Back In (most recently liked song) */}
            <div className="db-now-playing">
              <h3>Jump Back In</h3>

              {lastLikedLoading ? (
                <div className="db-player-card">
                  <div className="db-skeleton" style={{ width: 60, height: 60, borderRadius: 8 }} />
                  <div className="db-player-info">
                    <div className="db-skeleton db-skeleton-line" style={{ width: '70%' }} />
                    <div className="db-skeleton db-skeleton-line" style={{ width: '45%', marginTop: 6 }} />
                  </div>
                </div>
              ) : !lastLiked ? (
                <p className="db-empty-state">
                  Songs you like will show up here so you can get back to them fast.
                </p>
              ) : (
                <>
                  <div className={`db-player-card ${currentTrack?.id === lastLiked.id ? 'db-player-card-playing' : ''}`}>
                    <div
                      className="db-player-image"
                      style={lastLiked.albumArt ? { backgroundImage: `url(${lastLiked.albumArt})`, backgroundSize: 'cover', backgroundPosition: 'center', fontSize: 0 } : undefined}
                    >
                      {!lastLiked.albumArt && '🎵'}
                    </div>
                    <div className="db-player-info">
                      <p className="db-player-title">{lastLiked.title}</p>
                      <p className="db-player-artist">{lastLiked.artist}</p>
                    </div>
                    <button
                      className="db-player-like"
                      onClick={handleUnlikeLastLiked}
                      disabled={unliking}
                      title="Remove from liked songs"
                    >
                      <HeartIcon filled />
                    </button>
                  </div>

                  {currentTrack?.id === lastLiked.id ? (
                    <p className="db-now-playing-hint">▶ Playing in the bar below</p>
                  ) : (
                    <button className="db-play-full-btn" onClick={handlePlayLastLiked}>
                      <PlayIcon /> Play
                    </button>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>

      <CurrentlyPlayingBar track={currentTrack} />
    </div>
  );
};

export default Dashboard;