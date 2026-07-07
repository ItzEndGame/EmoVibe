import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './History.css';
import { emotionAPI } from '../../services/api';

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);

/* Kept in sync with Dashboard.jsx / MainApp.jsx's emotion metadata. */
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

// Maps the backend's `method` values (see emotion.py's db.log_detection calls)
// to a readable label + icon.
const METHOD_META = {
  live_photo: { label: 'Live Photo', icon: '📷' },
  upload_photo: { label: 'Upload Photo', icon: '📁' },
  select_emotion: { label: 'Select Emotion', icon: '🙂' },
};
const methodMeta = (method) => METHOD_META[method] || { label: method || 'Unknown', icon: '•' };

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return {
    date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
};

const isThisMonth = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
};

const PAGE_SIZE = 20;
const MAX_LIMIT = 100; // backend caps /emotion/history at 100

const History = () => {
  const navigate = useNavigate();

  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);

  const [streak, setStreak] = useState(null);
  const [favoriteMood, setFavoriteMood] = useState(null);

  const [search, setSearch] = useState('');
  const [emotionFilter, setEmotionFilter] = useState('all');

  const loadDetections = useCallback(async (currentLimit) => {
    setLoading(true);
    setError('');
    try {
      const res = await emotionAPI.getHistory(currentLimit);
      const raw = res.detections || res.history || res.data || [];
      const normalized = raw.map((item, idx) => ({
        id: item.id ?? idx,
        emotion: (item.emotion || 'neutral').toLowerCase(),
        method: item.method || null,
        time: item.detected_at || item.timestamp || item.created_at || null,
      }));
      setDetections(normalized);
      // The backend has no real "is there more" signal beyond the cap —
      // if we got back fewer than we asked for, or hit the hard cap,
      // there's nothing more to load.
      setHasMore(normalized.length === currentLimit && currentLimit < MAX_LIMIT);
    } catch (err) {
      console.error('Failed to load detection history:', err);
      setError("Couldn't load your history right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDetections(limit);
  }, [limit, loadDetections]);

  useEffect(() => {
    emotionAPI.getStreak()
      .then((res) => setStreak(res.day_streak ?? null))
      .catch(() => setStreak(null));

    emotionAPI.getFavoriteMood()
      .then((res) => setFavoriteMood(res.favorite_mood || null))
      .catch(() => setFavoriteMood(null));
  }, []);

  const handleLoadMore = () => {
    setLimit((prev) => Math.min(prev + PAGE_SIZE, MAX_LIMIT));
  };

  const handlePlayMood = (emotion) => {
    navigate('/app/detect', { state: { method: 'select', emotion } });
  };

  const filtered = useMemo(() => {
    return detections.filter((d) => {
      if (emotionFilter !== 'all' && d.emotion !== emotionFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const meta = emotionMeta(d.emotion);
        const method = methodMeta(d.method).label.toLowerCase();
        if (!meta.label.toLowerCase().includes(q) && !method.includes(q)) return false;
      }
      return true;
    });
  }, [detections, search, emotionFilter]);

  const thisMonthCount = useMemo(
    () => detections.filter((d) => isThisMonth(d.time)).length,
    [detections]
  );

  const favMeta = favoriteMood ? emotionMeta(favoriteMood.emotion) : null;

  return (
    <>
      <header className="hist-header">
        <div className="hist-header-left">
          <h1>History</h1>
          <p>Your emotion detections over time</p>
        </div>
        <div className="hist-header-right">
          <div className="hist-search">
            <span className="hist-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="hist-filter"
            value={emotionFilter}
            onChange={(e) => setEmotionFilter(e.target.value)}
          >
            <option value="all">All emotions</option>
            {EMOTIONS.map((e) => (
              <option key={e.name} value={e.name}>{e.emoji} {e.label}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Stat cards — every number here is backed by a real endpoint.
          ("Songs Played" from the original mockup isn't, since there's no
          endpoint that tracks it per-detection, so it's swapped for
          Favorite Mood, which is real.) */}
      <div className="hist-stats">
        <div className="hist-stat-card">
          <div className="hist-stat-icon">🙂</div>
          <div>
            <p className="hist-stat-value">{loading ? '—' : detections.length}</p>
            <p className="hist-stat-label">Total Detections{detections.length >= MAX_LIMIT ? ' (100+)' : ''}</p>
          </div>
        </div>
        <div className="hist-stat-card">
          <div className="hist-stat-icon">🔥</div>
          <div>
            <p className="hist-stat-value">{streak ?? '—'}</p>
            <p className="hist-stat-label">Day Streak</p>
          </div>
        </div>
        <div className="hist-stat-card">
          <div className="hist-stat-icon">📅</div>
          <div>
            <p className="hist-stat-value">{loading ? '—' : thisMonthCount}</p>
            <p className="hist-stat-label">This Month</p>
          </div>
        </div>
        <div className="hist-stat-card">
          <div className="hist-stat-icon">{favMeta ? favMeta.emoji : '⭐'}</div>
          <div>
            <p className="hist-stat-value">{favMeta ? favMeta.label : '—'}</p>
            <p className="hist-stat-label">Favorite Mood</p>
          </div>
        </div>
      </div>

      {/* Recent History */}
      <div className="hist-table-card">
        <h3 className="hist-table-title">Recent History</h3>

        {loading ? (
          <div className="hist-list">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="hist-row">
                <div className="hist-skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                <div className="hist-skeleton hist-skeleton-line" style={{ width: '20%' }} />
                <div className="hist-skeleton hist-skeleton-line" style={{ width: '25%' }} />
                <div className="hist-skeleton hist-skeleton-line" style={{ width: '20%' }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="hist-empty-state">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="hist-empty-state">
            {detections.length === 0
              ? 'No detections yet. Head to the Dashboard to detect your first mood.'
              : 'Nothing matches that search or filter.'}
          </p>
        ) : (
          <>
            <div className="hist-list-header">
              <span>Emotion</span>
              <span>Method</span>
              <span>Date &amp; Time</span>
              <span className="hist-actions-col">Actions</span>
            </div>
            <div className="hist-list">
              {filtered.map((d) => {
                const meta = emotionMeta(d.emotion);
                const method = methodMeta(d.method);
                const dt = formatDateTime(d.time);
                return (
                  <div key={d.id} className="hist-row">
                    <div className="hist-row-emotion">
                      <span className="hist-row-avatar" style={{ background: `${meta.color}26` }}>
                        {meta.emoji}
                      </span>
                      <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                    </div>
                    <div className="hist-row-method">
                      <span>{method.icon}</span> {method.label}
                    </div>
                    <div className="hist-row-time">
                      {typeof dt === 'string' ? dt : `${dt.date} · ${dt.time}`}
                    </div>
                    <div className="hist-actions-col">
                      <button
                        className="hist-play-btn"
                        title={`Get ${meta.label.toLowerCase()} music`}
                        onClick={() => handlePlayMood(d.emotion)}
                      >
                        <PlayIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                <button className="hist-load-more-btn" onClick={handleLoadMore}>
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default History;