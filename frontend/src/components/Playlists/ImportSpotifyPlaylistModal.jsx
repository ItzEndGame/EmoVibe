import React, { useState, useEffect } from 'react';
import { spotifyConnectAPI, playlistsAPI } from '../../services/api';
import './ImportSpotifyPlaylistModal.css';

/**
 * Lets a Spotify-connected user import one of their own Spotify playlists
 * as a local app playlist. This talks to Spotify's Web API directly from
 * the browser (same pattern useSpotifyPlayer.js already uses for playback
 * control) using the access token from spotifyConnectAPI.getPlaybackToken —
 * there's no dedicated backend "import" endpoint, so this is all client-side
 * orchestration: create a local playlist, then add each track one at a time
 * via the existing playlistsAPI.addSong.
 *
 * Capped at 200 tracks per import (2 pages of Spotify's 100-per-page max)
 * to keep this from hammering the backend with hundreds of sequential
 * addSong calls for a giant playlist.
 */

const MAX_TRACKS_TO_IMPORT = 200;
const LIKED_SONGS_ID = '__spotify_liked_songs__';

const ImportSpotifyPlaylistModal = ({ isOpen, onClose, onImported }) => {
  const [step, setStep] = useState('list'); // 'list' | 'importing' | 'done'
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [likedSongsUnavailable, setLikedSongsUnavailable] = useState(false);
  const [importingId, setImportingId] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [importedName, setImportedName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setStep('list');
    setError('');
    setLikedSongsUnavailable(false);
    loadSpotifyPlaylists();
  }, [isOpen]);

  const loadSpotifyPlaylists = async () => {
    setLoading(true);
    setError('');
    try {
      const { access_token } = await spotifyConnectAPI.getPlaybackToken();

      // Spotify's "Liked Songs" is a special library section, not a real
      // playlist — it never shows up in /v1/me/playlists, so it needs its
      // own request just to get a track count for display.
      const [playlistsRes, likedRes] = await Promise.all([
        fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
          headers: { Authorization: `Bearer ${access_token}` },
        }),
        fetch('https://api.spotify.com/v1/me/tracks?limit=1', {
          headers: { Authorization: `Bearer ${access_token}` },
        }),
      ]);

      if (!playlistsRes.ok) throw new Error(`Spotify API returned ${playlistsRes.status}`);
      const data = await playlistsRes.json();

      const items = data.items || [];
      if (likedRes.ok) {
        const likedData = await likedRes.json();
        // Pinned as a pseudo-playlist entry so it reuses the exact same
        // list UI and import flow as everything else.
        items.unshift({
          id: LIKED_SONGS_ID,
          name: 'Liked Songs',
          isLikedSongs: true,
          tracks: { total: likedData.total ?? 0 },
        });
      } else {
        // Most likely cause: the 'user-library-read' scope wasn't granted
        // when this account connected (added to SPOTIFY_SCOPES after the
        // fact) — existing connections need to reconnect for a new scope
        // to take effect, Spotify won't retroactively add it. Surface this
        // instead of just quietly not showing Liked Songs with no
        // explanation.
        console.warn(`Liked Songs fetch failed (HTTP ${likedRes.status}) — likely missing the user-library-read scope. Reconnecting Spotify may be required.`);
        setLikedSongsUnavailable(true);
      }

      setSpotifyPlaylists(items);
    } catch (err) {
      console.error('Failed to load Spotify playlists:', err);
      setError("Couldn't load your Spotify playlists. Make sure Spotify is connected and try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTracks = async (playlistId, accessToken) => {
    const tracks = [];
    let url = playlistId === LIKED_SONGS_ID
      ? 'https://api.spotify.com/v1/me/tracks?limit=50'
      : `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

    while (url && tracks.length < MAX_TRACKS_TO_IMPORT) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(`Spotify API returned ${res.status}`);
      const data = await res.json();

      // Same item shape for both endpoints: { track: {...} }
      for (const item of data.items || []) {
        const t = item.track;
        // Skip local files, removed tracks, and podcast episodes — only
        // real, addressable songs have what addSong needs.
        if (!t || !t.id || t.type !== 'track') continue;
        tracks.push({
          id: t.id,
          title: t.name,
          artist: (t.artists || []).map((a) => a.name).join(', ') || 'Unknown artist',
          album_art: t.album?.images?.[0]?.url || null,
          preview_url: t.preview_url || null,
        });
        if (tracks.length >= MAX_TRACKS_TO_IMPORT) break;
      }

      url = data.next;
    }

    return tracks;
  };

  const handleImport = async (spotifyPlaylist) => {
    setImportingId(spotifyPlaylist.id);
    setError('');
    try {
      const { access_token } = await spotifyConnectAPI.getPlaybackToken();

      const tracks = await fetchAllTracks(spotifyPlaylist.id, access_token);

      const createRes = await playlistsAPI.create(
        spotifyPlaylist.name,
        spotifyPlaylist.isLikedSongs ? 'Imported from your Spotify Liked Songs' : (spotifyPlaylist.description || null),
        spotifyPlaylist.isLikedSongs ? null : (spotifyPlaylist.images?.[0]?.url || null)
      );
      const newPlaylistId = createRes.playlist?.id;
      if (!newPlaylistId) throw new Error('Failed to create playlist');

      setStep('importing');
      setProgress({ done: 0, total: tracks.length });

      // Sequential, not Promise.all — a giant burst of concurrent requests
      // against the backend (and Spotify) is more likely to trip rate
      // limits than a steady one-at-a-time import.
      for (let i = 0; i < tracks.length; i++) {
        try {
          await playlistsAPI.addSong(newPlaylistId, tracks[i]);
        } catch (err) {
          // A single duplicate/failed track shouldn't abort the whole import.
          console.warn('Skipped a track during import:', tracks[i].title, err);
        }
        setProgress({ done: i + 1, total: tracks.length });
      }

      setImportedName(spotifyPlaylist.name);
      setStep('done');
      onImported?.();
    } catch (err) {
      console.error('Import failed:', err);
      setError("Couldn't import that playlist. Please try again.");
      setStep('list');
    } finally {
      setImportingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="pl-modal-overlay" onClick={step === 'importing' ? undefined : onClose}>
      <div className="isp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="isp-header">
          <h2>Import from Spotify</h2>
          {step !== 'importing' && (
            <button className="isp-close-btn" onClick={onClose} aria-label="Close">✕</button>
          )}
        </div>

        {step === 'list' && (
          <>
            <p className="isp-subtitle">Pick one of your Spotify playlists — or your Liked Songs — to bring it into EmoVibe.</p>

            {likedSongsUnavailable && (
              <div className="isp-scope-note">
                Liked Songs isn't available right now — this app needs an extra Spotify permission that wasn't
                granted when you connected. <strong>Disconnect and reconnect Spotify</strong> to enable it.
              </div>
            )}

            {error && <div className="pl-error-message">{error}</div>}

            {loading ? (
              <div className="pl-loading">Loading your Spotify playlists...</div>
            ) : spotifyPlaylists.length === 0 ? (
              <div className="pl-empty-state">
                <p>No playlists found on your Spotify account.</p>
              </div>
            ) : (
              <div className="isp-list">
                {spotifyPlaylists.map((sp) => (
                  <div key={sp.id} className={`isp-item ${sp.isLikedSongs ? 'isp-item-liked' : ''}`}>
                    <div
                      className="isp-item-art"
                      style={sp.images?.[0]?.url ? { backgroundImage: `url(${sp.images[0].url})` } : undefined}
                    >
                      {sp.isLikedSongs ? '❤️' : !sp.images?.[0]?.url && '🎵'}
                    </div>
                    <div className="isp-item-info">
                      <p className="isp-item-name">{sp.name}</p>
                      <p className="isp-item-count">{sp.tracks?.total ?? 0} songs</p>
                    </div>
                    <button
                      className="isp-import-btn"
                      disabled={!!importingId}
                      onClick={() => handleImport(sp)}
                    >
                      {importingId === sp.id ? 'Preparing…' : 'Import'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'importing' && (
          <div className="isp-progress">
            <div className="atp-spinner" />
            <p>Importing {progress.done} of {progress.total} songs…</p>
            <div className="isp-progress-bar">
              <div
                className="isp-progress-fill"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="isp-done">
            <p className="isp-done-title">✓ Imported "{importedName}"</p>
            <p className="isp-done-sub">
              {progress.total} song{progress.total === 1 ? '' : 's'} added to your playlists.
            </p>
            <button className="pl-btn-primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportSpotifyPlaylistModal;