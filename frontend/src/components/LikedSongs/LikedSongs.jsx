import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './LikedSongs.css';
import { musicAPI } from '../../services/api';
import CurrentlyPlayingBar from '../Spotify/CurrentlyPlayingBar';
import { useListeningHeartbeat } from '../Spotify/useListeningHeartbeat';
import AddToPlaylistModal from '../Playlists/AddToPlaylistModal';

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);

const HeartIcon = ({ filled }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/* Kept in sync with Dashboard.jsx / MainApp.jsx / History.jsx's emotion metadata. */
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

const LikedSongs = () => {
  const { startTracking, stopTracking } = useListeningHeartbeat();

  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emotionFilter, setEmotionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [unlikingId, setUnlikingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null); // plays right here, no navigation needed
  const [addToPlaylistSong, setAddToPlaylistSong] = useState(null);

  useEffect(() => {
    return () => stopTracking();
  }, [stopTracking]);

  const showToast = (message, type = 'success', action = null) => {
    setToast({ message, type, action });
    setTimeout(() => setToast(null), action ? 6000 : 3000);
  };

  // getLikedSongs supports a real `emotion` filter param on the backend,
  // so unlike History's client-only filter, this one actually re-queries.
  const loadSongs = useCallback(async (emotion) => {
    setLoading(true);
    setError('');
    try {
      const res = await musicAPI.getLikedSongs(null, emotion === 'all' ? null : emotion);
      const raw = res.liked_songs || res.songs || res.data || [];
      const normalized = raw.map((item, idx) => ({
        id: item.id ?? idx,
        spotifyId: item.spotify_track_id || item.spotify_id || null,
        title: item.song_title || item.title || 'Untitled',
        artist: item.artist || 'Unknown artist',
        albumArt: item.album_art_url || item.album_art || null,
        emotion: (item.emotion_detected || item.emotion || '').toLowerCase() || null,
        likedAt: item.created_at || item.liked_at || item.timestamp || null,
      }));
      setSongs(normalized);
    } catch (err) {
      console.error('Failed to load liked songs:', err);
      setError("Couldn't load your liked songs right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSongs(emotionFilter);
  }, [emotionFilter, loadSongs]);

  const filtered = useMemo(() => {
    if (!search.trim()) return songs;
    const q = search.trim().toLowerCase();
    return songs.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  }, [songs, search]);

  const handlePlay = (song) => {
    if (!song.spotifyId) {
      showToast("This song can't be played — missing its Spotify link.", 'error');
      return;
    }
    startTracking(song.spotifyId);
    setCurrentTrack({
      id: song.spotifyId,
      title: song.title,
      artist: song.artist,
      album_art: song.albumArt,
      spotify_uri: `spotify:track:${song.spotifyId}`,
    });
  };

  // Steps the bottom player bar to the next/previous song within the
  // currently-filtered liked-songs list — mirrors the same pattern
  // MainApp uses for its recommendations list.
  const handlePlayerNext = () => {
    if (!currentTrack) return;
    const idx = filtered.findIndex((s) => s.spotifyId === currentTrack.id);
    if (idx === -1 || idx === filtered.length - 1) return;
    const next = filtered[idx + 1];
    if (!next.spotifyId) return;
    setCurrentTrack({ id: next.spotifyId, title: next.title, artist: next.artist, album_art: next.albumArt, spotify_uri: `spotify:track:${next.spotifyId}` });
    startTracking(next.spotifyId);
  };

  const handlePlayerPrevious = () => {
    if (!currentTrack) return;
    const idx = filtered.findIndex((s) => s.spotifyId === currentTrack.id);
    if (idx <= 0) return;
    const prev = filtered[idx - 1];
    if (!prev.spotifyId) return;
    setCurrentTrack({ id: prev.spotifyId, title: prev.title, artist: prev.artist, album_art: prev.albumArt, spotify_uri: `spotify:track:${prev.spotifyId}` });
    startTracking(prev.spotifyId);
  };

  const handleUnlike = async (song) => {
    setUnlikingId(song.id);
    const removedIndex = songs.findIndex((s) => s.id === song.id);
    try {
      await musicAPI.unlikeSong(song.id);
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
      showToast(`💔 Removed "${song.title}" from liked songs`, 'success', {
        label: 'Undo',
        onClick: async () => {
          try {
            const res = await musicAPI.likeSong({
              song_title: song.title,
              artist: song.artist,
              album_art_url: song.albumArt,
              spotify_track_id: song.spotifyId,
              emotion_detected: song.emotion,
            });
            // Confirmed response shape from music.py: { success, message, song_id }
            const restored = { ...song, id: res?.song_id ?? song.id };
            setSongs((prev) => {
              const next = [...prev];
              next.splice(Math.min(removedIndex, next.length), 0, restored);
              return next;
            });
            showToast(`❤️ Restored "${song.title}"`);
          } catch (err) {
            console.error('Undo like failed:', err);
            showToast("Couldn't undo — please try liking it again from Dashboard.", 'error');
          }
        },
      });
    } catch (err) {
      console.error('Failed to unlike song:', err);
      showToast('Something went wrong — please try again.', 'error');
    } finally {
      setUnlikingId(null);
    }
  };

  return (
    <div style={currentTrack ? { paddingBottom: '90px' } : undefined}>
      {toast && (
        <div className={`liked-toast ${toast.type === 'error' ? 'liked-toast-error' : ''}`}>
          <span>{toast.message}</span>
          {toast.action && (
            <button
              className="liked-toast-action"
              onClick={() => { toast.action.onClick(); setToast(null); }}
            >
              {toast.action.label}
            </button>
          )}
          <button onClick={() => setToast(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <header className="liked-header">
        <div className="liked-header-left">
          <h1>Liked Songs</h1>
          <p>{loading ? 'Loading…' : `${songs.length} song${songs.length === 1 ? '' : 's'}`}</p>
        </div>
        <div className="liked-header-right">
          <div className="liked-search">
            <span className="liked-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search liked songs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="liked-filter"
            value={emotionFilter}
            onChange={(e) => setEmotionFilter(e.target.value)}
          >
            <option value="all">All moods</option>
            {EMOTIONS.map((e) => (
              <option key={e.name} value={e.name}>{e.emoji} {e.label}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="liked-card">
        {loading ? (
          <div className="liked-list">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="liked-row">
                <div className="liked-skeleton" style={{ width: 48, height: 48, borderRadius: 8 }} />
                <div style={{ flex: 1 }}>
                  <div className="liked-skeleton liked-skeleton-line" style={{ width: '40%' }} />
                  <div className="liked-skeleton liked-skeleton-line" style={{ width: '25%', marginTop: 6 }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="liked-empty-state">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="liked-empty-state">
            {songs.length === 0
              ? "No liked songs yet — like a track from your recommendations and it'll show up here."
              : 'Nothing matches that search.'}
          </p>
        ) : (
          <div className="liked-list">
            {filtered.map((song) => {
              const meta = emotionMeta(song.emotion);
              const isPlaying = currentTrack?.id === song.spotifyId && !!song.spotifyId;
              return (
                <div key={song.id} className={`liked-row ${isPlaying ? 'liked-row-playing' : ''}`}>
                  <div
                    className="liked-art"
                    style={song.albumArt ? { backgroundImage: `url(${song.albumArt})` } : undefined}
                  >
                    {!song.albumArt && '🎵'}
                  </div>

                  <div className="liked-info">
                    <p className="liked-title">{song.title}</p>
                    <p className="liked-artist">{song.artist}</p>
                  </div>

                  {meta && (
                    <span className="liked-mood-tag" style={{ color: meta.color, background: `${meta.color}1f` }}>
                      {meta.emoji} {meta.label}
                    </span>
                  )}

                  <button
                    className={`liked-play-btn ${isPlaying ? 'liked-play-btn-active' : ''}`}
                    title={isPlaying ? 'Playing' : 'Play'}
                    onClick={() => handlePlay(song)}
                  >
                    {isPlaying ? '▶' : <PlayIcon />}
                  </button>

                  <button
                    className="liked-add-btn"
                    title={song.spotifyId ? 'Add to playlist' : "Can't add — missing Spotify link"}
                    disabled={!song.spotifyId}
                    onClick={() => setAddToPlaylistSong(song)}
                  >
                    +
                  </button>

                  <button
                    className="liked-unlike-btn"
                    title="Remove from liked songs"
                    disabled={unlikingId === song.id}
                    onClick={() => handleUnlike(song)}
                  >
                    <HeartIcon filled />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CurrentlyPlayingBar
        track={currentTrack}
        onNext={handlePlayerNext}
        onPrevious={handlePlayerPrevious}
      />

      <AddToPlaylistModal
        isOpen={!!addToPlaylistSong}
        song={addToPlaylistSong ? {
          id: addToPlaylistSong.spotifyId,
          title: addToPlaylistSong.title,
          artist: addToPlaylistSong.artist,
          album_art: addToPlaylistSong.albumArt,
        } : null}
        onClose={() => setAddToPlaylistSong(null)}
        onSuccess={() => showToast(`Added "${addToPlaylistSong?.title}" to your playlist!`)}
      />
    </div>
  );
};

export default LikedSongs;