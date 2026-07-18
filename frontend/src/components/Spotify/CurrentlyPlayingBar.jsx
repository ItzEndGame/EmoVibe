import React, { useEffect, useRef, useState } from 'react';
import './CurrentlyPlayingBar.css';
import { usePlayer } from '../../context/PlayerContext';
import { musicAPI } from '../../services/api';
import AddToPlaylistModal from '../Playlists/AddToPlaylistModal';

/**
 * Bottom "Currently Playing" bar.
 *
 * Premium + Spotify-connected users: real playback via the Web Playback
 * SDK (shared connection, held in PlayerContext) — accurate
 * position/duration, working custom transport controls
 * (prev/play/pause/next), draggable scrubber, all driven by real
 * player_state_changed telemetry.
 *
 * Everyone else: NOT every track has a preview_url (Spotify doesn't
 * generate one for every song, and that pool has been shrinking), so
 * relying on the <audio> preview tag left the bar broken/disabled for
 * a meaningful chunk of tracks even though the card's embed iframe
 * played them just fine. Instead, this renders a compact Spotify embed
 * iframe in the bar itself — same reliable playback source the cards
 * already use. Spotify's embed is a cross-origin black box (no
 * postMessage API for play state), so our own scrubber/transport
 * buttons would be fake controls duplicating the embed's real ones —
 * instead we just let the embed be the UI for this path, and only show
 * our custom transport bar where we have genuine control (Premium/SDK).
 *
 * Like + Add-to-Playlist are self-contained here (not passed in as props).
 * It fetches the liked-songs list once on mount to know the current
 * track's liked state and DB row id (needed for unlikeSong, which
 * requires the DB id — see MainApp.jsx's fix for why the Spotify track
 * id alone isn't enough).
 */
const CurrentlyPlayingBar = ({ track, onNext, onPrevious }) => {
  const {
    isReady,
    isPremium,
    playbackState,
    playTrack,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
  } = usePlayer().spotify;

  const lastLoadedTrackId = useRef(null);
  const usingSdk = isPremium && isReady && track?.spotify_uri;

  const [likedMap, setLikedMap] = useState({}); // spotify_track_id -> DB row id
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);

  // The SDK's player_state_changed event only fires on play/pause/seek/
  // track-change — NOT on a steady per-second cadence — so reading
  // playbackState.position directly leaves the displayed time frozen
  // between events, then jumping when one finally arrives. Instead, we
  // snapshot {position, timestamp} from each real event, then advance a
  // local displayPosition every second based on elapsed wall-clock time,
  // re-syncing to the real value whenever a fresh event actually lands.
  const [displayPosition, setDisplayPosition] = useState(0);
  const positionAnchorRef = useRef({ position: 0, timestamp: Date.now(), paused: true });

  useEffect(() => {
    if (!playbackState) return;
    positionAnchorRef.current = {
      position: playbackState.position ?? 0,
      timestamp: Date.now(),
      paused: !!playbackState.paused,
    };
    setDisplayPosition(playbackState.position ?? 0);
  }, [playbackState]);

  useEffect(() => {
    if (!usingSdk) return;

    const tick = () => {
      const anchor = positionAnchorRef.current;
      if (anchor.paused) return;
      const elapsed = Date.now() - anchor.timestamp;
      const duration = playbackState?.duration ?? Infinity;
      setDisplayPosition(Math.min(anchor.position + elapsed, duration));
    };

    const intervalId = setInterval(tick, 250);
    return () => clearInterval(intervalId);
  }, [usingSdk, playbackState?.duration]);

  useEffect(() => {
    musicAPI.getLikedSongs()
      .then((res) => {
        const map = {};
        (res.liked_songs || []).forEach((song) => {
          if (song.spotify_track_id) map[song.spotify_track_id] = song.id;
        });
        setLikedMap(map);
      })
      .catch((err) => console.error('CurrentlyPlayingBar: failed to load liked songs:', err));
  }, []);

  const isLiked = !!track && likedMap[track.id] != null;

  const handleToggleLike = async () => {
    if (!track) return;
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
      console.error('CurrentlyPlayingBar: like/unlike failed:', err);
    }
  };

  useEffect(() => {
    if (usingSdk && track?.id !== lastLoadedTrackId.current) {
      lastLoadedTrackId.current = track.id;
      playTrack(track.spotify_uri);
    }
  }, [usingSdk, track, playTrack]);

  if (!track) return null;

  const handleNext = () => {
    if (usingSdk) {
      nextTrack();
    } else if (onNext) {
      onNext();
    }
  };

  const handlePrevious = () => {
    if (usingSdk) {
      previousTrack();
    } else if (onPrevious) {
      onPrevious();
    }
  };

  const formatTime = (ms) => {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const displayTrack = usingSdk
    ? {
        title: playbackState?.track_window?.current_track?.name || track.title,
        artist:
          playbackState?.track_window?.current_track?.artists
            ?.map((a) => a.name)
            .join(', ') || track.artist,
        albumArt:
          playbackState?.track_window?.current_track?.album?.images?.[0]?.url ||
          track.album_art,
      }
    : {
        title: track.title,
        artist: track.artist,
        albumArt: track.album_art,
      };

  return (
    <>
    <div
      className="db-player-bar"
      style={{
        padding: usingSdk ? '12px 24px' : '8px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
      }}
    >
      {/* ===== Premium / SDK path: full custom transport bar ===== */}
      {usingSdk && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px', flex: '0 0 auto' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                backgroundColor: '#181818',
                backgroundImage: displayTrack.albumArt ? `url(${displayTrack.albumArt})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                flexShrink: 0,
              }}
            />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                {displayTrack.title}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                {displayTrack.artist}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button onClick={handlePrevious} style={transportButtonStyle(true)} title="Previous">⏮</button>
              <button
                onClick={togglePlay}
                style={{ ...transportButtonStyle(true), width: '36px', height: '36px', borderRadius: '50%', background: '#1ED760', color: '#000', fontSize: '1rem' }}
                title={playbackState?.paused ? 'Play' : 'Pause'}
              >
                {playbackState?.paused ? '▶' : '⏸'}
              </button>
              <button onClick={handleNext} style={transportButtonStyle(true)} title="Next">⏭</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem', minWidth: '32px', textAlign: 'right' }}>
                {formatTime(displayPosition)}
              </span>
              <input
                type="range"
                min={0}
                max={playbackState?.duration || 1}
                value={Math.min(displayPosition, playbackState?.duration || 1)}
                onChange={(e) => {
                  const newPosition = Number(e.target.value);
                  // Re-anchor immediately so the tick interval continues
                  // counting up from where the user just dragged to,
                  // instead of snapping back to the pre-seek position
                  // until the next real player_state_changed event.
                  positionAnchorRef.current = {
                    position: newPosition,
                    timestamp: Date.now(),
                    paused: !!playbackState?.paused,
                  };
                  setDisplayPosition(newPosition);
                  seek(newPosition);
                }}
                style={{ flex: 1, accentColor: '#1ED760', cursor: 'pointer' }}
              />
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem', minWidth: '32px' }}>
                {formatTime(playbackState?.duration ?? 0)}
              </span>
            </div>
          </div>

          <div style={{ flex: '0 0 auto', minWidth: '120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '14px' }}>
            <button onClick={handleToggleLike} title={isLiked ? 'Unlike' : 'Like'} style={likeButtonStyle}>
              {isLiked ? '❤️' : '🤍'}
            </button>
            <button onClick={() => setShowAddToPlaylist(true)} title="Add to playlist" style={likeButtonStyle}>
              +
            </button>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>🟢 Full playback</span>
          </div>
        </>
      )}

      {/* ===== Non-Premium path: compact Spotify embed, same reliable
           source the cards already use, regardless of preview_url
           availability ===== */}
      {!usingSdk && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '160px', flex: '0 0 auto' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '6px',
                backgroundColor: '#181818',
                backgroundImage: track.album_art ? `url(${track.album_art})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                flexShrink: 0,
              }}
            />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: 'white', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                {track.title}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                {track.artist}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, maxWidth: '640px', margin: '0 auto' }}>
            <iframe
              key={track.id}
              src={`https://open.spotify.com/embed/track/${track.id}?utm_source=generator&autoplay=1&theme=0`}
              width="100%"
              height="80"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              title={`bottom-bar-${track.id}`}
              style={{ borderRadius: '8px', display: 'block' }}
            />
          </div>

          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={handleToggleLike} title={isLiked ? 'Unlike' : 'Like'} style={likeButtonStyle}>
              {isLiked ? '❤️' : '🤍'}
            </button>
            <button onClick={() => setShowAddToPlaylist(true)} title="Add to playlist" style={likeButtonStyle}>
              +
            </button>
            {onPrevious && (
              <button onClick={handlePrevious} style={transportButtonStyle(true)} title="Previous">⏮</button>
            )}
            {onNext && (
              <button onClick={handleNext} style={transportButtonStyle(true)} title="Next">⏭</button>
            )}
          </div>
        </>
      )}
    </div>

    <AddToPlaylistModal
      isOpen={showAddToPlaylist}
      song={track}
      onClose={() => setShowAddToPlaylist(false)}
    />
    </>
  );
};

const transportButtonStyle = (enabled) => ({
  background: 'transparent',
  border: 'none',
  color: enabled ? 'white' : 'rgba(255,255,255,0.25)',
  fontSize: '1.1rem',
  cursor: enabled ? 'pointer' : 'not-allowed',
  padding: '4px',
});

const likeButtonStyle = {
  background: 'transparent',
  border: 'none',
  color: 'white',
  fontSize: '1.2rem',
  lineHeight: 1,
  cursor: 'pointer',
  padding: '4px',
};

export default CurrentlyPlayingBar;