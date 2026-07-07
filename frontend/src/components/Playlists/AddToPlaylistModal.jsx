import React, { useState, useEffect } from 'react';
import { playlistsAPI, preferencesAPI } from '../../services/api';
import './AddToPlaylistModal.css';

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CreateIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const AddToPlaylistModal = ({ 
  isOpen, 
  onClose, 
  song, 
  onSuccess 
}) => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingTo, setAddingTo] = useState(null);
  const [favoritePlaylistId, setFavoritePlaylistId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Load user's playlists and favorite playlist preference
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [playlistsRes, prefsRes] = await Promise.all([
          playlistsAPI.getAll(),
          preferencesAPI.get().catch(() => ({ favorite_playlist_id: null })),
        ]);

        const playlists = playlistsRes.playlists || [];
        setPlaylists(playlists);
        setFavoritePlaylistId(prefsRes.favorite_playlist_id);
      } catch (err) {
        console.error('Failed to load playlists:', err);
        setError('Could not load your playlists. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  // Add song to a playlist
  const handleAddToPlaylist = async (playlistId) => {
    if (!song) return;

    setAddingTo(playlistId);
    setError('');
    setSuccessMessage('');

    try {
      const trackData = {
        id: song.id || song.spotify_track_id,
        title: song.title || song.song_title,
        artist: song.artist,
        album_art: song.album_art || song.albumArt,
        preview_url: song.preview_url || song.spotify_preview_url,
      };

      await playlistsAPI.addSong(playlistId, trackData);
      setSuccessMessage(`Added to playlist!`);
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess(playlistId);
      }

      // Close modal after 1.5s
      setTimeout(() => {
        onClose();
        setSuccessMessage('');
      }, 1500);
    } catch (err) {
      console.error('Failed to add song to playlist:', err);
      if (err.response?.status === 409) {
        setError('This song is already in that playlist.');
      } else {
        setError('Could not add song to playlist. Please try again.');
      }
    } finally {
      setAddingTo(null);
    }
  };

  // Create a new playlist and add song to it
  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) {
      setError('Please enter a playlist name.');
      return;
    }

    setCreatingPlaylist(true);
    setError('');

    try {
      const createRes = await playlistsAPI.create(newPlaylistName);
      const newPlaylistId = createRes.playlist?.id;

      if (!newPlaylistId) {
        throw new Error('Failed to create playlist');
      }

      // Add song to the newly created playlist
      const trackData = {
        id: song.id || song.spotify_track_id,
        title: song.title || song.song_title,
        artist: song.artist,
        album_art: song.album_art || song.albumArt,
        preview_url: song.preview_url || song.spotify_preview_url,
      };

      await playlistsAPI.addSong(newPlaylistId, trackData);
      setSuccessMessage(`Created "${newPlaylistName}" and added song!`);

      if (onSuccess) {
        onSuccess(newPlaylistId);
      }

      // Refresh playlists list
      const playlistsRes = await playlistsAPI.getAll();
      setPlaylists(playlistsRes.playlists || []);
      setShowCreateForm(false);
      setNewPlaylistName('');

      // Close modal after 1.5s
      setTimeout(() => {
        onClose();
        setSuccessMessage('');
      }, 1500);
    } catch (err) {
      console.error('Failed to create playlist or add song:', err);
      setError('Could not create playlist. Please try again.');
    } finally {
      setCreatingPlaylist(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="atp-backdrop" onClick={onClose} />

      {/* Modal */}
      <div className="atp-modal">
        <div className="atp-modal-header">
          <h3>Add to Playlist</h3>
          <button className="atp-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="atp-modal-content">
          {/* Song info */}
          {song && (
            <div className="atp-song-info">
              {song.album_art || song.albumArt ? (
                <img 
                  src={song.album_art || song.albumArt} 
                  alt={song.title || song.song_title}
                  className="atp-song-image"
                />
              ) : (
                <div className="atp-song-image atp-song-image-empty">🎵</div>
              )}
              <div className="atp-song-details">
                <p className="atp-song-title">{song.title || song.song_title}</p>
                <p className="atp-song-artist">{song.artist}</p>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && <div className="atp-error">{error}</div>}

          {/* Success message */}
          {successMessage && <div className="atp-success">{successMessage}</div>}

          {/* Loading state */}
          {loading ? (
            <div className="atp-loading">
              <div className="atp-spinner" />
              <p>Loading playlists...</p>
            </div>
          ) : (
            <>
              {/* Playlists list */}
              {!showCreateForm && (
                <>
                  {playlists.length === 0 ? (
                    <div className="atp-empty-state">
                      <p>No playlists yet.</p>
                      <p className="atp-empty-text">Create one to get started.</p>
                    </div>
                  ) : (
                    <div className="atp-playlist-list">
                      {playlists.map((playlist) => {
                        const isFavorite = playlist.id === favoritePlaylistId;
                        const isAdding = addingTo === playlist.id;

                        return (
                          <button
                            key={playlist.id}
                            className="atp-playlist-item"
                            onClick={() => handleAddToPlaylist(playlist.id)}
                            disabled={isAdding}
                            title={`Add to ${playlist.name}`}
                          >
                            <div className="atp-playlist-info">
                              <p className="atp-playlist-name">
                                {playlist.name}
                                {isFavorite && <span className="atp-favorite-badge">★</span>}
                              </p>
                              <p className="atp-playlist-count">
                                {playlist.song_count || 0} song{playlist.song_count !== 1 ? 's' : ''}
                              </p>
                            </div>
                            {isAdding ? (
                              <div className="atp-spinner-mini" />
                            ) : (
                              <CheckIcon />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Create new playlist button */}
                  <button 
                    className="atp-create-btn"
                    onClick={() => setShowCreateForm(true)}
                  >
                    <CreateIcon />
                    Create New Playlist
                  </button>
                </>
              )}

              {/* Create playlist form */}
              {showCreateForm && (
                <div className="atp-create-form">
                  <input
                    type="text"
                    className="atp-input"
                    placeholder="Playlist name..."
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateAndAdd();
                      } else if (e.key === 'Escape') {
                        setShowCreateForm(false);
                        setNewPlaylistName('');
                      }
                    }}
                    autoFocus
                    disabled={creatingPlaylist}
                  />
                  <div className="atp-form-buttons">
                    <button
                      className="atp-btn-secondary"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewPlaylistName('');
                      }}
                      disabled={creatingPlaylist}
                    >
                      Cancel
                    </button>
                    <button
                      className="atp-btn-primary"
                      onClick={handleCreateAndAdd}
                      disabled={creatingPlaylist || !newPlaylistName.trim()}
                    >
                      {creatingPlaylist ? 'Creating...' : 'Create & Add'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default AddToPlaylistModal;