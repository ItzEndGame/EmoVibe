import React, { useState, useEffect } from 'react';
import { playlistsAPI, spotifyConnectAPI } from '../../services/api';
import './Playlists.css';
import ImportSpotifyPlaylistModal from './ImportSpotifyPlaylistModal';
import { usePlayer } from '../../context/PlayerContext';

const CreatePlaylistModal = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Playlist name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await playlistsAPI.create(name, description || null);
      if (result.success) {
        onSuccess();
        setName('');
        setDescription('');
      } else {
        setError(result.message || 'Failed to create playlist');
      }
    } catch (err) {
      setError('Error creating playlist. Please try again.');
      console.error('Create playlist error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="pl-modal-overlay" onClick={onClose}>
      <div className="pl-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Playlist</h2>
        <form onSubmit={handleSubmit}>
          <div className="pl-form-group">
            <label>Playlist Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Chill Mix"
              disabled={loading}
            />
          </div>

          <div className="pl-form-group">
            <label>Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows="3"
              disabled={loading}
            />
          </div>

          {error && <div className="pl-error-message">{error}</div>}

          <div className="pl-modal-actions">
            <button type="button" onClick={onClose} className="pl-btn-cancel" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="pl-btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Playlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditPlaylistModal = ({ isOpen, playlist, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (playlist && isOpen) {
      setName(playlist.name || '');
      setDescription(playlist.description || '');
      setError('');
    }
  }, [playlist, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Playlist name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const updates = {};
      if (name !== playlist.name) updates.name = name;
      if (description !== playlist.description) updates.description = description;

      if (Object.keys(updates).length === 0) {
        onClose();
        return;
      }

      const result = await playlistsAPI.update(playlist.id, updates);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.message || 'Failed to update playlist');
      }
    } catch (err) {
      setError('Error updating playlist. Please try again.');
      console.error('Update playlist error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !playlist) return null;

  return (
    <div className="pl-modal-overlay" onClick={onClose}>
      <div className="pl-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit Playlist</h2>
        <form onSubmit={handleSubmit}>
          <div className="pl-form-group">
            <label>Playlist Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="pl-form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
              disabled={loading}
            />
          </div>

          {error && <div className="pl-error-message">{error}</div>}

          <div className="pl-modal-actions">
            <button type="button" onClick={onClose} className="pl-btn-cancel" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="pl-btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PlaylistCard = ({ playlist, onEdit, onDelete, onViewSongs }) => {
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const result = await playlistsAPI.delete(playlist.id);
      if (result.success) {
        onDelete(playlist.id);
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="pl-card">
      <div className="pl-card-header">
        <div className="pl-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <circle cx="3" cy="6" r="1.5" fill="currentColor" />
            <circle cx="3" cy="12" r="1.5" fill="currentColor" />
            <circle cx="3" cy="18" r="1.5" fill="currentColor" />
          </svg>
        </div>
        <div className="pl-card-menu">
          <button
            className="pl-menu-btn"
            onClick={() => onEdit(playlist)}
            title="Edit"
          >
            ✏️
          </button>
          <button
            className="pl-menu-btn delete"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="pl-card-body">
        <h3>{playlist.name}</h3>
        {playlist.description && <p className="pl-description">{playlist.description}</p>}
        <div className="pl-meta">
          <span className="pl-song-count">{playlist.song_count || 0} songs</span>
        </div>
      </div>

      <button className="pl-card-action" onClick={() => onViewSongs(playlist)}>
        View Songs →
      </button>

      {showDeleteConfirm && (
        <div className="pl-confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="pl-confirm" onClick={(e) => e.stopPropagation()}>
            <p>Delete this playlist? This action cannot be undone.</p>
            <div className="pl-confirm-actions">
              <button
                className="pl-btn-cancel"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                className="pl-btn-danger"
                onClick={handleDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PlaylistDetail = ({ playlist, onBack, onRemoveSong }) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentTrack, playTrack, setCurrentTrack } = usePlayer(); // shared with AppShell so playback survives navigating away

  useEffect(() => {
    loadPlaylistSongs();
  }, [playlist]);

  const loadPlaylistSongs = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await playlistsAPI.getById(playlist.id);
      if (result.success) {
        setSongs(result.songs || []);
      } else {
        setError(result.message || 'Failed to load playlist songs');
      }
    } catch (err) {
      setError('Error loading playlist songs');
      console.error('Load playlist error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (song) => {
    if (!song.spotify_track_id) return;
    const toPlayerTrack = (s) => ({
      id: s.spotify_track_id,
      title: s.song_title,
      artist: s.artist,
      album_art: s.album_art_url,
      spotify_uri: `spotify:track:${s.spotify_track_id}`,
    });
    const queue = songs.filter((s) => s.spotify_track_id).map(toPlayerTrack);
    const index = queue.findIndex((t) => t.id === song.spotify_track_id);
    playTrack(toPlayerTrack(song), queue, index);
  };

  const handleRemoveSong = async (spotifyTrackId) => {
    try {
      const result = await playlistsAPI.removeSong(playlist.id, spotifyTrackId);
      if (result.success) {
        setSongs(songs.filter((s) => s.spotify_track_id !== spotifyTrackId));
        // Don't leave the player pointed at a song that's no longer in the list
        setCurrentTrack((prev) => (prev?.id === spotifyTrackId ? null : prev));
        onRemoveSong?.();
      }
    } catch (err) {
      console.error('Remove song error:', err);
    }
  };

  return (
    <div className="pl-detail">
      <div className="pl-detail-header">
        <button className="pl-back-btn" onClick={onBack}>
          ← Back
        </button>
        <h2>{playlist.name}</h2>
      </div>

      {loading && <div className="pl-loading">Loading songs...</div>}
      {error && <div className="pl-error-message">{error}</div>}

      {!loading && songs.length === 0 && (
        <div className="pl-empty-state">
          <p>No songs in this playlist yet.</p>
          <p className="pl-empty-hint">Add songs from recommendations or liked songs!</p>
        </div>
      )}

      {!loading && songs.length > 0 && (
        <div className="pl-songs-list">
          {songs.map((song, index) => {
            const isPlaying = !!song.spotify_track_id && currentTrack?.id === song.spotify_track_id;
            return (
              <div
                key={song.id || index}
                className={`pl-song-item ${isPlaying ? 'pl-song-item-playing' : ''}`}
                onClick={() => handlePlay(song)}
                style={{ cursor: song.spotify_track_id ? 'pointer' : 'default' }}
                title={song.spotify_track_id ? (isPlaying ? 'Playing' : 'Play') : "Can't play — missing Spotify link"}
              >
                <div className="pl-song-info">
                  <div className="pl-song-number">{isPlaying ? '▶' : index + 1}</div>
                  <div className="pl-song-details">
                    {song.album_art_url && (
                      <img src={song.album_art_url} alt={song.song_title} className="pl-song-art" />
                    )}
                    <div>
                      <div className="pl-song-title">{song.song_title}</div>
                      <div className="pl-song-artist">{song.artist}</div>
                    </div>
                  </div>
                </div>
                <button
                  className="pl-remove-btn"
                  onClick={(e) => { e.stopPropagation(); handleRemoveSong(song.spotify_track_id); }}
                  title="Remove from playlist"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

const Playlists = () => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [viewingPlaylistDetail, setViewingPlaylistDetail] = useState(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    loadPlaylists();
    // Import from Spotify only makes sense once Spotify is actually
    // connected — check status so the button doesn't show up for
    // everyone by default.
    spotifyConnectAPI.getStatus()
      .then((res) => setSpotifyConnected(!!res.connected))
      .catch(() => setSpotifyConnected(false));
  }, []);

  const loadPlaylists = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await playlistsAPI.getAll();
      if (result.success) {
        setPlaylists(result.playlists || []);
      } else {
        setError(result.message || 'Failed to load playlists');
      }
    } catch (err) {
      setError('Error loading playlists');
      console.error('Load playlists error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    loadPlaylists();
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedPlaylist(null);
    loadPlaylists();
  };

  const handleDeletePlaylist = (playlistId) => {
    setPlaylists(playlists.filter((p) => p.id !== playlistId));
  };

  const handleEditClick = (playlist) => {
    setSelectedPlaylist(playlist);
    setShowEditModal(true);
  };

  const handleViewSongs = (playlist) => {
    setViewingPlaylistDetail(playlist);
  };

  if (viewingPlaylistDetail) {
    return (
      <div className="pl-container">
        <PlaylistDetail
          playlist={viewingPlaylistDetail}
          onBack={() => setViewingPlaylistDetail(null)}
          onRemoveSong={loadPlaylists}
        />
      </div>
    );
  }

  return (
    <div className="pl-container">
      <div className="pl-header">
        <h1>Your Playlists</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          {spotifyConnected && (
            <button className="pl-btn-cancel" onClick={() => setShowImportModal(true)}>
              🎧 Import from Spotify
            </button>
          )}
          <button className="pl-btn-primary" onClick={() => setShowCreateModal(true)}>
            + New Playlist
          </button>
        </div>
      </div>

      {error && <div className="pl-error-message">{error}</div>}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="pl-loading">Loading playlists...</div>
        </div>
      )}

      {!loading && playlists.length === 0 && (
        <div className="pl-empty-state">
          <p>No playlists yet.</p>
          <p className="pl-empty-hint">
            {spotifyConnected
              ? 'Create your first playlist, or import one straight from Spotify.'
              : 'Create your first playlist to organize your favorite songs!'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
            <button className="pl-btn-primary" onClick={() => setShowCreateModal(true)}>
              Create Playlist
            </button>
            {spotifyConnected && (
              <button className="pl-btn-cancel" onClick={() => setShowImportModal(true)}>
                🎧 Import from Spotify
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && playlists.length > 0 && (
        <div className="pl-grid">
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              onEdit={handleEditClick}
              onDelete={handleDeletePlaylist}
              onViewSongs={handleViewSongs}
            />
          ))}
        </div>
      )}

      <CreatePlaylistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      <EditPlaylistModal
        isOpen={showEditModal}
        playlist={selectedPlaylist}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPlaylist(null);
        }}
        onSuccess={handleEditSuccess}
      />

      <ImportSpotifyPlaylistModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={loadPlaylists}
      />
    </div>
  );
};

export default Playlists;