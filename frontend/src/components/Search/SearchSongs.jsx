import React, { useState, useEffect, useRef, useCallback } from 'react';
import './SearchSongs.css';
import { musicAPI } from '../../services/api';
import AddToPlaylistModal from '../Playlists/AddToPlaylistModal';
import { usePlayer } from '../../context/PlayerContext';

/**
 * Confirmed against routes/music.py's /search route:
 * { success, query, tracks: [...], total }, each track:
 * { id, title, artist, album, album_art, preview_url, external_url,
 *   duration_ms, popularity }
 */

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const DEBOUNCE_MS = 350;

const formatDuration = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const SearchSongs = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const { currentTrack, playTrack } = usePlayer(); // shared with AppShell so playback survives navigating away

  const [likedMap, setLikedMap] = useState({}); // spotify_track_id -> DB row id
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState(null);
  const [toast, setToast] = useState(null);

  const debounceRef = useRef(null);
  const requestIdRef = useRef(0); // guards against out-of-order responses

  // Load liked state once, same pattern as MainApp/CurrentlyPlayingBar —
  // needed so the heart icon reflects reality and unlike has the real DB id.
  useEffect(() => {
    musicAPI.getLikedSongs()
      .then((res) => {
        const map = {};
        (res.liked_songs || []).forEach((song) => {
          if (song.spotify_track_id) map[song.spotify_track_id] = song.id;
        });
        setLikedMap(map);
      })
      .catch((err) => console.error('Search: failed to load liked songs:', err));
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const runSearch = useCallback(async (q) => {
    const thisRequestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const res = await musicAPI.searchTracks(q, 20);
      if (thisRequestId !== requestIdRef.current) return; // a newer keystroke's request already landed

      const raw = res.tracks || [];
      const normalized = raw.map((t, idx) => ({
        id: t.id ?? idx,
        title: t.title || 'Untitled',
        artist: t.artist || 'Unknown artist',
        album_art: t.album_art || null,
        preview_url: t.preview_url || null,
        duration_ms: t.duration_ms || null,
        external_url: t.external_url || null,
      }));
      setResults(normalized);
    } catch (err) {
      if (thisRequestId !== requestIdRef.current) return;
      console.error('Search failed:', err);
      setError("Couldn't search right now — please try again.");
      setResults([]);
    } finally {
      if (thisRequestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      requestIdRef.current++; // invalidate any in-flight search
      setResults([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    setHasSearched(true);
    debounceRef.current = setTimeout(() => runSearch(value.trim()), DEBOUNCE_MS);
  };

  const handlePlay = (track) => {
    const trackWithUri = { ...track, spotify_uri: `spotify:track:${track.id}` };
    const queue = results.map((t) => ({ ...t, spotify_uri: `spotify:track:${t.id}` }));
    const index = results.findIndex((t) => t.id === track.id);
    playTrack(trackWithUri, queue, index);
  };

  const handleToggleLike = async (track) => {
    const isLiked = likedMap[track.id] != null;
    try {
      if (isLiked) {
        await musicAPI.unlikeSong(likedMap[track.id]);
        setLikedMap((prev) => {
          const next = { ...prev };
          delete next[track.id];
          return next;
        });
      } else {
        const res = await musicAPI.likeSong({
          song_title: track.title,
          artist: track.artist,
          album_art_url: track.album_art || null,
          spotify_track_id: track.id,
          spotify_preview_url: track.preview_url || null,
        });
        if (res?.song_id) {
          setLikedMap((prev) => ({ ...prev, [track.id]: res.song_id }));
        }
      }
    } catch (err) {
      console.error('Like/unlike failed:', err);
      showToast('Something went wrong — please try again.', 'error');
    }
  };

  return (
    <div>
      {toast && (
        <div className={`search-toast ${toast.type === 'error' ? 'search-toast-error' : ''}`}>
          {toast.message}
        </div>
      )}

      <header className="search-header">
        <h1>Search</h1>
        <p>Find any song and play it right here.</p>
      </header>

      <div className="search-bar">
        <SearchIcon />
        <input
          type="text"
          placeholder="Search for songs, artists..."
          value={query}
          onChange={handleChange}
          autoFocus
        />
        {loading && <span className="search-spinner" />}
      </div>

      <div className="search-results">
        {!hasSearched ? (
          <p className="search-empty-state">Start typing to find a song.</p>
        ) : error ? (
          <p className="search-empty-state">{error}</p>
        ) : loading && results.length === 0 ? (
          <div className="search-list">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="search-row">
                <div className="search-skeleton" style={{ width: 48, height: 48, borderRadius: 8 }} />
                <div style={{ flex: 1 }}>
                  <div className="search-skeleton search-skeleton-line" style={{ width: '40%' }} />
                  <div className="search-skeleton search-skeleton-line" style={{ width: '25%', marginTop: 6 }} />
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="search-empty-state">No songs found for "{query}".</p>
        ) : (
          <div className="search-list">
            {results.map((track) => {
              const isPlaying = currentTrack?.id === track.id;
              const isLiked = likedMap[track.id] != null;
              return (
                <div
                  key={track.id}
                  className={`search-row ${isPlaying ? 'search-row-playing' : ''}`}
                  onClick={() => handlePlay(track)}
                >
                  <div
                    className="search-art"
                    style={track.album_art ? { backgroundImage: `url(${track.album_art})` } : undefined}
                  >
                    {!track.album_art && (isPlaying ? '▶' : '🎵')}
                  </div>

                  <div className="search-info">
                    <p className="search-title">{track.title}</p>
                    <p className="search-artist">{track.artist}</p>
                  </div>

                  {track.duration_ms && (
                    <span className="search-duration">{formatDuration(track.duration_ms)}</span>
                  )}

                  <button
                    className={`search-play-btn ${isPlaying ? 'search-play-btn-active' : ''}`}
                    title={isPlaying ? 'Playing' : 'Play'}
                    onClick={(e) => { e.stopPropagation(); handlePlay(track); }}
                  >
                    {isPlaying ? '▶' : <PlayIcon />}
                  </button>

                  <button
                    className="search-add-btn"
                    title="Add to playlist"
                    onClick={(e) => { e.stopPropagation(); setAddToPlaylistTrack(track); }}
                  >
                    +
                  </button>

                  <button
                    className="search-like-btn"
                    title={isLiked ? 'Unlike' : 'Like'}
                    onClick={(e) => { e.stopPropagation(); handleToggleLike(track); }}
                  >
                    {isLiked ? '❤️' : '🤍'}
                  </button>

                  {track.external_url && (
                    <a
                      href={track.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Open in Spotify"
                      className="search-spotify-link"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V14M14 4H20M20 4V10M20 4L10 14"
                          stroke="#1DB954"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddToPlaylistModal
        isOpen={!!addToPlaylistTrack}
        song={addToPlaylistTrack}
        onClose={() => setAddToPlaylistTrack(null)}
      />
    </div>
  );
};

export default SearchSongs;