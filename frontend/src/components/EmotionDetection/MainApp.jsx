import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { emotionAPI, musicAPI, preferencesAPI } from '../../services/api';
import SpotifyConnectBanner from '../Spotify/SpotifyConnectBanner';
import { useListeningHeartbeat } from '../Spotify/useListeningHeartbeat';
import CurrentlyPlayingBar from '../Spotify/CurrentlyPlayingBar';
import WebcamCapture from './WebcamCapture';
import AddToPlaylistModal from '../Playlists/AddToPlaylistModal';
import { moodTracker } from '../../utils/moodTracker';
import { motion } from "framer-motion";
import { getDummyRecommendations } from './dummyRecommendations';



const MainApp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { startTracking, stopTracking } = useListeningHeartbeat();
  const fileInputRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState(null); // track object, or null when modal closed
  const [isFallbackData, setIsFallbackData] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  const [language, setLanguage] = useState('english');
  const [error, setError] = useState('');
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [likedSongs, setLikedSongs] = useState({});
  const [likedSongIds, setLikedSongIds] = useState({}); // spotify_track_id -> DB row id (needed for unlikeSong)
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [currentTrack, setCurrentTrack] = useState(null); // drives the bottom CurrentlyPlayingBar
  const [sortMode, setSortMode] = useState('popularity'); // 'relevance' | 'popularity'

  // Stagger how many track cards (and their Spotify iframes) are actually
  // mounted at once. Mounting 8 cross-origin iframes in the same React
  // commit can block the main thread long enough that Chrome shows a
  // brief black/blank repaint of the whole page. Ramping visibleCount up
  // a few cards at a time spreads that cost across several frames instead.
  // Populate liked-song state from the actual backend list on mount —
  // without this, `likedSongs` only ever reflected likes/unlikes made
  // during the current session, so hearts for songs liked earlier (or from
  // the Liked Songs page) would incorrectly show as unliked. This also
  // captures each song's real DB row id, which unlikeSong requires
  // (Spotify track id alone isn't enough — see likedSongIds above).
  useEffect(() => {
    musicAPI.getLikedSongs()
      .then((res) => {
        const raw = res.liked_songs || [];
        const idMap = {};
        const boolMap = {};
        raw.forEach((song) => {
          if (song.spotify_track_id) {
            idMap[song.spotify_track_id] = song.id;
            boolMap[song.spotify_track_id] = true;
          }
        });
        setLikedSongIds(idMap);
        setLikedSongs(boolMap);
      })
      .catch((err) => console.error('Failed to load liked songs for heart state:', err));
  }, []);

  useEffect(() => {
    if (visibleCount >= recommendations.length) return;

    const timer = setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 2, recommendations.length));
    }, 120);

    return () => clearTimeout(timer);
  }, [visibleCount, recommendations.length]);

  // Autoplay preference: start the first recommendation automatically once
  // a fresh batch loads, but only if nothing is already playing — this
  // naturally fires once per detection (currentTrack is null right after
  // a mood is selected) and won't re-trigger on "Load More" appends, since
  // currentTrack is no longer null by then.
  useEffect(() => {
    if (autoplay && !currentTrack && recommendations.length > 0) {
      const first = recommendations[0];
      startTracking(first.id);
      setCurrentTrack({ ...first, spotify_uri: `spotify:track:${first.id}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendations, autoplay]);

  const emotions = [
    { name: 'happy', emoji: '😊', label: 'Happy' },
    { name: 'sad', emoji: '😢', label: 'Sad' },
    { name: 'angry', emoji: '😠', label: 'Angry' },
    { name: 'neutral', emoji: '😐', label: 'Neutral' },
    { name: 'surprise', emoji: '😲', label: 'Surprise' },
    { name: 'fear', emoji: '😰', label: 'Fear' },
    { name: 'disgust', emoji: '🤢', label: 'Disgust' }
  ];

  const emotionEmojis = {
    happy: '😊', sad: '😢', angry: '😠', neutral: '😐',
    surprise: '😲', fear: '😰', disgust: '🤢'
  };

  const emotionQuotes = {
  happy: "Happiness is contagious spread it everywhere you go!",
  sad: "Even the darkest night will end and the sun will rise.",
  angry: "Anger doesn’t solve anything, but calm thinking does.",
  neutral: "Every moment is a fresh beginning stay balanced.",
  surprise: "Life is full of surprises embrace them with a smile!",
  fear: "Courage is not the absence of fear, but acting in spite of it.",
  disgust: "Let go of what you dislike, and focus on what brings peace."
};

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
      handleDetectEmotion(file);
    }
  };

  // Note: the router-state effect further down triggers
  // fileInputRef.current.click() directly for Dashboard-initiated
  // uploads — no manual click handler needed here.

  // Accepts an optional file directly (used right after capture/select, so
  // we're not stuck reading `selectedImage` before its setState has landed)
  // and falls back to the current state for any future manual callers.
  const handleDetectEmotion = async (fileOverride) => {
  const fileToDetect = fileOverride || selectedImage;
  if (!fileToDetect) {
    setError('Please select an image first');
    return;
  }

  setDetecting(true);
  setError('');

  try {
    const response = await emotionAPI.detectFromUpload(fileToDetect);

    if (response.success) {
      const emotion = {
        emotion: response.emotion,
        confidence: response.confidence,
        emoji: response.emoji || emotionEmojis[response.emotion.toLowerCase()]
      };
      setDetectedEmotion(emotion);
      setSelectedMood(response.emotion.toLowerCase());
      
      // ✅ TRACK THE DETECTED MOOD
      moodTracker.saveMood(response.emotion.toLowerCase());
      
      fetchMusicRecommendations(response.emotion.toLowerCase());
    } else {
      setError(response.message || 'Failed to detect emotion');
    }
  } catch (err) {
    setError(err.response?.data?.message || 'Failed to detect emotion. Please try again.');
  } finally {
    setDetecting(false);
  }
};

  

  // Update fetchMusicRecommendations to show first 8 songs
const fetchMusicRecommendations = async (emotion, lang = language) => {
  setLoadingMusic(true);
  setHasMore(true);
  setVisibleCount(0);
  stopTracking(); // a fresh fetch means whatever card was playing is no longer active
  try {
    const response = await musicAPI.getRecommendations(emotion.toLowerCase(), lang, 8, [], sortMode);

    if (response.success && response.tracks) {
      setRecommendations(response.tracks);
      setHasMore(response.has_more !== false); // default to true unless explicitly false
      setIsFallbackData(false);
    } else {
      const allSongs = getDummyRecommendations(emotion, lang); // lang use karo
      setRecommendations(allSongs.slice(0, 8));
      setHasMore(false); // dummy fallback has a fixed, small pool — no real "more"
      setIsFallbackData(true);
    }
  } catch (err) {
    console.error('Music API error:', err);
    const allSongs = getDummyRecommendations(emotion, lang); // lang use karo
    setRecommendations(allSongs.slice(0, 8));
    setHasMore(false);
    setIsFallbackData(true);
  } finally {
    setLoadingMusic(false);
  }
};

// Replaces the entire current set with a fresh batch for the same emotion.
// Excludes the currently-shown tracks so refresh doesn't just hand back
// the same songs.
const handleRefreshSongs = async () => {
  if (!selectedMood || isRefreshing) return;

  setIsRefreshing(true);
  setVisibleCount(0);
  stopTracking();
  try {
    const currentIds = recommendations.map((t) => t.id).filter(Boolean);
    const response = await musicAPI.getRecommendations(
      selectedMood.toLowerCase(),
      language,
      8,
      currentIds,
      sortMode
    );

    if (response.success && response.tracks && response.tracks.length > 0) {
      setRecommendations(response.tracks);
      setHasMore(response.has_more !== false);
      setIsFallbackData(false);
    } else {
      // Nothing new came back (pool exhausted) — fall back to a plain
      // re-fetch without exclusions so the button doesn't feel broken.
      const fallback = await musicAPI.getRecommendations(selectedMood.toLowerCase(), language, 8, [], sortMode);
      if (fallback.success && fallback.tracks) {
        setRecommendations(fallback.tracks);
        setHasMore(fallback.has_more !== false);
        setIsFallbackData(false);
      }
    }
  } catch (err) {
    console.error('Refresh error:', err);
  } finally {
    setIsRefreshing(false);
  }
};
const handleLoadMore = async () => {
  if (!selectedMood || loadingMore) return;

  setLoadingMore(true);
  try {
    const alreadyShownIds = recommendations.map((t) => t.id).filter(Boolean);
    const response = await musicAPI.getRecommendations(
      selectedMood.toLowerCase(),
      language,
      8,
      alreadyShownIds,
      sortMode
    );

    if (response.success && response.tracks && response.tracks.length > 0) {
      setRecommendations((prev) => [...prev, ...response.tracks]);
      setHasMore(response.has_more !== false);
      setIsFallbackData(false);
    } else {
      // No new tracks came back — nothing left to load
      setHasMore(false);
    }
  } catch (err) {
    console.error('Load more error:', err);
    setHasMore(false);
  } finally {
    setLoadingMore(false);
  }
};
  const handleDirectMoodSelection = (emotionName) => {
  setSelectedMood(emotionName);
  const emotion = emotions.find(e => e.name === emotionName);
  setDetectedEmotion({
    emotion: emotion.label,
    confidence: 1.0,
    emoji: emotion.emoji
  });
  
  // Track the mood
  moodTracker.saveMood(emotionName);
  
  fetchMusicRecommendations(emotionName);
};

  const [autoplay, setAutoplay] = useState(false);

  // Load saved preferences once on mount. Sequenced before the router-state
  // effect below (not a separate independent effect) so the very first
  // recommendations fetch — which can fire synchronously via
  // handleDirectMoodSelection as soon as this effect runs — already has
  // the right language instead of racing a still-in-flight preferences
  // request and using the 'english' default for just that first call.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const res = await preferencesAPI.get();
        const p = res.preferences || {};
        if (!cancelled) {
          if (p.language) setLanguage(p.language);
          if (typeof p.autoplay === 'boolean') setAutoplay(p.autoplay);
        }
      } catch (err) {
        console.warn('Could not load preferences — using defaults:', err);
      }

      if (cancelled) return;

      // ---- Router-state handling (unchanged logic, just sequenced after
      // preferences load) ----
      const navState = location.state;
      if (!navState?.method) return;

      if (navState.method === 'camera') {
        setShowWebcam(true);
      } else if (navState.method === 'upload') {
        fileInputRef.current?.click();
      } else if (navState.method === 'select' && navState.emotion) {
        handleDirectMoodSelection(navState.emotion);

        // Dashboard's "Recommended For You" cards pass a specific track along
        // with the mood — load it straight into the player (Now Playing panel
        // + bottom bar) instead of just landing on the generic mood results.
        if (navState.track?.id) {
          const t = navState.track;
          startTracking(t.id);
          setCurrentTrack({ ...t, spotify_uri: `spotify:track:${t.id}` });
        }
      }

      // Clear the state so a refresh or back-navigation doesn't replay it.
      navigate(location.pathname, { replace: true, state: {} });
    };

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // handleLanguageChange - refetch recommendations in the new language
const handleLanguageChange = (e) => {
  const newLang = e.target.value;
  setLanguage(newLang);

  if (selectedMood) {
    fetchMusicRecommendations(selectedMood, newLang);
  }
};

  // handleSortChange - refetch recommendations with the new sort mode
const handleSortChange = (e) => {
  const newSort = e.target.value;
  setSortMode(newSort);

  if (selectedMood) {
    // fetchMusicRecommendations reads sortMode via closure, which would
    // still hold the *old* value here since setSortMode hasn't applied
    // yet — so call the API directly with newSort instead of relying on
    // fetchMusicRecommendations to pick it up.
    setLoadingMusic(true);
    setHasMore(true);
    setVisibleCount(0);
    stopTracking();
    musicAPI.getRecommendations(selectedMood.toLowerCase(), language, 8, [], newSort)
      .then((response) => {
        if (response.success && response.tracks) {
          setRecommendations(response.tracks);
          setHasMore(response.has_more !== false);
          setIsFallbackData(false);
        }
      })
      .catch((err) => console.error('Sort change error:', err))
      .finally(() => setLoadingMusic(false));
  }
};

  const showToast = (message, type = 'success', action = null) => {
    setToast({ message, type, action });
    setTimeout(() => setToast(null), action ? 6000 : 3000);
  };

  // Shared so the Undo action (re-liking) can call the exact same request
  // shape the normal "like" path uses, instead of duplicating it.
  const likeTrack = async (track) => {
    // Confirmed response shape from music.py: { success, message, song_id }
    const res = await musicAPI.likeSong({
      song_title: track.title,
      artist: track.artist,
      album_art_url: track.album_art || null,
      spotify_track_id: track.id,
      spotify_preview_url: track.preview_url,
      genre: track.album,
      emotion_detected: selectedMood,
    });
    moodTracker.saveLikedSong(track, selectedMood);
    setLikedSongs(prev => ({ ...prev, [track.id]: true }));
    if (res?.song_id) {
      setLikedSongIds(prev => ({ ...prev, [track.id]: res.song_id }));
    }
  };

  const handleLikeSong = async (track) => {
    try {
      if (likedSongs[track.id]) {
        // Unlike — confirmed from music.py that /music/unlike/<int:song_id>
        // requires the DB row id (an integer), not the Spotify track id.
        // likedSongIds (populated on mount from getLikedSongs, and kept in
        // sync whenever we like something) holds that mapping.
        const dbId = likedSongIds[track.id];
        if (!dbId) {
          showToast("Couldn't find this song in your liked list — try refreshing the page.", 'error');
          return;
        }
        await musicAPI.unlikeSong(dbId);
        setLikedSongs(prev => ({ ...prev, [track.id]: false }));
        showToast(`💔 Removed "${track.title}" from liked songs`, 'success', {
          label: 'Undo',
          onClick: async () => {
            try {
              await likeTrack(track);
              showToast(`❤️ Restored "${track.title}"`, 'success');
            } catch (err) {
              console.error('Undo like failed:', err);
              showToast("Couldn't undo — please try liking it again.", 'error');
            }
          },
        });
      } else {
        // Like — album art now comes from the actual track (track.album_art),
        // which getRecommendations already returns. Previously this was
        // hardcoded to null, which is why liked songs showed no artwork.
        await likeTrack(track);
        showToast(`❤️ Added "${track.title}" to your liked songs!`, 'success');
      }
    } catch (err) {
      console.error('Error liking song:', err);
      showToast("Something went wrong — please try again.", 'error');
    }
  };

  // Steps the bottom player bar to the next/previous track within the
  // currently-shown recommendations list. Only meaningful for the
  // non-Premium preview path — Premium/SDK playback has its own
  // nextTrack/previousTrack via Spotify's queue, handled inside
  // CurrentlyPlayingBar itself.
  const handlePlayerNext = () => {
    if (!currentTrack) return;
    const idx = recommendations.findIndex((t) => t.id === currentTrack.id);
    if (idx === -1 || idx === recommendations.length - 1) return;
    const next = recommendations[idx + 1];
    setCurrentTrack({ ...next, spotify_uri: `spotify:track:${next.id}` });
    startTracking(next.id);
  };

  const handlePlayerPrevious = () => {
    if (!currentTrack) return;
    const idx = recommendations.findIndex((t) => t.id === currentTrack.id);
    if (idx <= 0) return;
    const prev = recommendations[idx - 1];
    setCurrentTrack({ ...prev, spotify_uri: `spotify:track:${prev.id}` });
    startTracking(prev.id);
  };

  return (
    <div className="me-page" style={currentTrack ? { paddingBottom: '90px' } : undefined}>

      {/* Toast banner — replaces the old alert() popups for like/unlike
          feedback. Fixed to the top so it never collides with the bottom
          CurrentlyPlayingBar. */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 20px',
            borderRadius: '999px',
            background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(143, 227, 77, 0.15)',
            border: `1px solid ${toast.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(143, 227, 77, 0.4)'}`,
            backdropFilter: 'blur(12px)',
            color: toast.type === 'error' ? '#ff8787' : '#c2f2a0',
            fontSize: '0.9rem',
            fontWeight: 600,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            maxWidth: '90vw',
          }}
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action.onClick();
                setToast(null);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: 'none',
                borderRadius: '999px',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 700,
                padding: '4px 12px',
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '1rem',
              lineHeight: 1,
              opacity: 0.7,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      <div className="container">
        <SpotifyConnectBanner />
        {error && <div className="error-message">{error}</div>}

        {/* Hidden — Dashboard's "Upload Image" card triggers this via
            router state (see the useEffect above); there's no visible
            upload button here anymore since Dashboard already has one. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Main Content - Changes based on detection state */}
        {!detectedEmotion ? (
          detecting ? (
            /* Auto-detection in progress (triggered from the Dashboard) */
            <div className="glass-card" style={{ textAlign: 'center', marginTop: '50px', padding: '60px 30px', maxWidth: '480px', margin: '50px auto 0' }}>
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Selected"
                  style={{ maxWidth: '100%', maxHeight: '260px', borderRadius: '15px', border: '2px solid var(--glass-border)', marginBottom: '25px' }}
                />
              )}
              <div>
                <span className="loading-spinner"></span>
                <span style={{ marginLeft: '12px', fontSize: '1.1rem' }}>Detecting your emotion…</span>
              </div>
            </div>
          ) : (
            /* No detection in progress and nothing detected yet — this only
               happens if someone lands on this page directly without going
               through a Dashboard card. Camera/upload live on the Dashboard;
               this is just a lightweight fallback so the page isn't a dead
               end. */
            <div className="glass-card" style={{ textAlign: 'center', marginTop: '50px', padding: '60px 30px' }}>
              <h2 style={{
                fontSize: '2rem',
                background: 'var(--accent-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '10px'
              }}>
                Select your mood
              </h2>
              <p style={{ color: 'var(--db-text-muted, rgba(255,255,255,0.66))', marginBottom: '40px' }}>
                Head back to the Dashboard for camera or photo-upload detection.
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '15px',
                maxWidth: '800px',
                margin: '0 auto'
              }}>
                {emotions.map((emotion) => (
                  <div
                    key={emotion.name}
                    onClick={() => handleDirectMoodSelection(emotion.name)}
                    style={{
                      padding: '20px',
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '15px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-5px)';
                      e.currentTarget.style.background = 'var(--primary-gradient)';
                      e.currentTarget.style.boxShadow = '0 10px 30px rgba(143, 227, 77, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.background = 'var(--glass-bg)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>{emotion.emoji}</div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{emotion.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          /* After Detection - Result Layout */
          <>
            <div style={{ marginBottom: '24px' }}>
              {/* Detected Emotion — camera/upload live on the Dashboard now,
                  so this page just shows the result and lets you clear it
                  to pick a different mood via the pills below. Kept compact
                  and horizontal so it reads as a status banner, not the
                  main event — the music list below is. */}
              <div
                className="glass-card dominant-emotion"
                style={{
                  textAlign: 'left',
                  maxWidth: '640px',
                  margin: '0 auto',
                  padding: '18px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div className="emotion-icon-large" style={{ fontSize: '2.4rem', margin: 0, filter: 'none' }}>
                  {detectedEmotion.emoji}
                </div>

                <div style={{ flex: 1, minWidth: '160px' }}>
                  <div className="emotion-name-large" style={{ fontSize: '1.2rem', margin: 0 }}>
                    {detectedEmotion.emotion}
                  </div>
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    style={{
                      margin: '4px 0 0',
                      fontStyle: 'italic',
                      fontSize: '0.85rem',
                      color: 'rgba(255,255,255,0.65)',
                      lineHeight: '1.3',
                    }}
                  >
                    “{emotionQuotes[detectedEmotion.emotion.toLowerCase()] || 'Feel your emotion and let it guide you.'}”
                  </motion.p>
                </div>

                <div className="confidence-badge" style={{ padding: '6px 14px', fontSize: '0.8rem', flexShrink: 0 }}>
                  {(detectedEmotion.confidence * 100).toFixed(1)}% Confident
                </div>

                <motion.button
                  key={`${detectedEmotion.emotion}-button`}
                  onClick={() => {
                    setDetectedEmotion(null);
                    setSelectedMood(null);
                    setImagePreview(null);
                    setSelectedImage(null);
                    setRecommendations([]);
                  }}
                  style={{
                    padding: '8px 18px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '999px',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  🧘 Clear Mood
                </motion.button>
              </div>
            </div>

            {/* Music Recommendations */}
            <div className="glass-card">
              <div style={{ marginBottom: '30px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  gap: '15px'
                }}>
                  <h3 style={{ fontSize: '2rem', margin: 0 }}>
                    🎵 Recommended Music
                  </h3>
                  
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
                    <select
                      value={language}
                      onChange={handleLanguageChange}
                      className="form-select"
                      style={{ 
                        width: 'auto', 
                        padding: '8px 10px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'white',
                        border: '1px solid var(--glass-border)'
                      }}
                    >
                      <option value="english" style={{ background: '#0a1522', color: '#f4f6f8' }}>🇺🇸 English</option>
                      <option value="punjabi" style={{ background: '#0a1522', color: '#f4f6f8' }}>🇵🇦 Punjabi</option>
                      <option value="hindi" style={{ background: '#0a1522', color: '#f4f6f8' }}>🇮🇳 Hindi</option>
                      <option value="french" style={{ background: '#0a1522', color: '#f4f6f8' }}>🇫🇷 French</option>
                      <option value="spanish" style={{ background: '#0a1522', color: '#f4f6f8' }}>🇪🇸 Spanish</option>
                      <option value="korean" style={{ background: '#0a1522', color: '#f4f6f8' }}>🇰🇷 Korean</option>
                      <option value="japanese" style={{ background: '#0a1522', color: '#f4f6f8' }}>🇯🇵 Japanese</option>
                      <option value="german" style={{ background: '#0a1522', color: '#f4f6f8' }}>🇩🇪 German</option>
                      <option value="italian" style={{ background: '#0a1522', color: '#f4f6f8' }}>🇮🇹 Italian</option>
                      <option value="portuguese" style={{ background: '#0a1522', color: '#f4f6f8' }}>🇧🇷 Portuguese</option>
                    </select>

                    <select
                      value={sortMode}
                      onChange={handleSortChange}
                      className="form-select"
                      title="Sort recommendations"
                      style={{
                        width: 'auto',
                        padding: '8px 10px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'white',
                        border: '1px solid var(--glass-border)'
                      }}
                    >
                      <option value="relevance" style={{ background: '#0a1522', color: '#f4f6f8' }}>✨ For You</option>
                      <option value="popularity" style={{ background: '#0a1522', color: '#f4f6f8' }}>🔥 Most Popular</option>
                    </select>

                    {selectedMood && (
                      <button
                        onClick={handleRefreshSongs}
                        disabled={isRefreshing}
                        className="btn"
                        title="Get a fresh set of songs for this mood"
                        style={{
                          width: 'auto',
                          padding: '6px 18px',
                          background: isRefreshing ? 'rgba(255,255,255,0.1)' : 'var(--accent-gradient)',
                          color: 'white',
                          border: '1px solid var(--glass-border)',
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: isRefreshing ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <span style={{
                          display: 'inline-block',
                          transition: 'transform 0.4s ease',
                          transform: isRefreshing ? 'rotate(360deg)' : 'rotate(0deg)',
                        }}>
                          ↻
                        </span>
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                      </button>
                    )}

                    {recommendations.length > 0 && (
                      <button
                        onClick={() => navigate('/games', {
                          state: {
                            tracks: recommendations.map((t) => ({
                              id: t.id,
                              title: t.title,
                              artist: t.artist,
                            })),
                            emotion: selectedMood || 'neutral',
                          },
                        })}
                        className="btn"
                        title="Play a rhythm game with these tracks"
                        style={{
                          width: 'auto',
                          padding: '6px 18px',
                          background: 'rgba(157, 92, 255, 0.25)',
                          color: 'white',
                          border: '1px solid var(--glass-border)',
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                        }}
                      >
                        🎮 Play Beat Reflex
                      </button>
                    )}

                  </div>
                </div>

                {/* Mood Selector */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                  gap: '10px',
                  marginBottom: '45px',
                }}>
                  {emotions.map((emotion) => (
                    <button
                      key={emotion.name}
                      onClick={() => {
  setSelectedMood(emotion.name);
  setDetectedEmotion({
    emotion: emotion.name,
    emoji: emotionEmojis[emotion.name],
    confidence: 1.0,
  });
  fetchMusicRecommendations(emotion.name);
}}

                      style={{
                        padding: '12px 6px',
                        background: selectedMood === emotion.name ? 'var(--secondary-gradient)' : 'var(--glass-bg)',
                        border: `2px solid ${selectedMood === emotion.name ? 'var(--glass-border)' : 'transparent'}`,
                        borderRadius: '14px',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: selectedMood === emotion.name ? '700' : '500',
                        fontSize: '0.78rem',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        minWidth: 0,
                        boxShadow: selectedMood === emotion.name ? '0 5px 20px rgba(157, 92, 255, 0.4)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedMood !== emotion.name) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedMood !== emotion.name) {
                          e.currentTarget.style.background = 'var(--glass-bg)';
                        }
                      }}
                    >
                      <span style={{ fontSize: '1.4rem' }}>{emotion.emoji}</span>
                      {emotion.label}
                    </button>
                  ))}
                </div>
              </div>

                     {loadingMusic ? (
  <div style={{ textAlign: 'center', padding: '40px' }}>
    <span
      className="loading-spinner"
      style={{ width: '40px', height: '40px' }}
    ></span>
    <p style={{ marginTop: '20px' }}>Loading recommendations...</p>
  </div>
) : (
  <>
    {isFallbackData && (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(255, 193, 7, 0.1)',
        border: '1px solid rgba(255, 193, 7, 0.3)',
        borderRadius: '10px',
        padding: '10px 16px',
        marginBottom: '20px',
      }}>
        <span style={{ fontSize: '1.1rem' }}>⚠️</span>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#fff' }}>
          Showing sample tracks — live recommendations are temporarily unavailable. Try refreshing in a moment.
        </p>
      </div>
    )}
    {/* Now Playing panel — large art, title/artist, like + open-in-Spotify,
        and a Play trigger. This is the single place selecting a track from
        the list below leads to; actual playback/transport controls live in
        the persistent bottom bar (CurrentlyPlayingBar) so we never mount
        two Spotify embeds for the same track at once. */}
    {recommendations.length > 0 && (() => {
      const panelTrack = currentTrack || recommendations[0];
      const isPlaying = currentTrack?.id === panelTrack.id;
      return (
        <div className="glass-card" style={{
          position: 'relative',
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          padding: '24px',
          marginBottom: '28px',
          background: 'rgba(255,255,255,0.04)',
          flexWrap: 'wrap',
        }}>
          {/* Add to Playlist — corner icon button, left of Like */}
          <button
            onClick={() => setAddToPlaylistTrack(panelTrack)}
            title="Add to playlist"
            style={{
              position: 'absolute',
              top: '16px',
              right: '64px',
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid var(--glass-border)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.2rem',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +
          </button>

          {/* Like — corner icon button */}
          <button
            onClick={() => handleLikeSong(panelTrack)}
            title={likedSongs[panelTrack.id] ? 'Unlike' : 'Like'}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: likedSongs[panelTrack.id] ? 'var(--secondary-gradient)' : 'rgba(255, 255, 255, 0.1)',
              border: likedSongs[panelTrack.id] ? 'none' : '1px solid var(--glass-border)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {likedSongs[panelTrack.id] ? '❤️' : '🤍'}
          </button>

          <div style={{
            width: '140px',
            height: '140px',
            borderRadius: '16px',
            flexShrink: 0,
            backgroundColor: '#181818',
            backgroundImage: panelTrack.album_art ? `url(${panelTrack.album_art})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          }} />
          <div style={{ flex: 1, minWidth: '220px', paddingRight: '48px' }}>
            <p style={{ fontSize: '0.8rem', color: '#1ED760', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {isPlaying ? '▶ Now Playing' : 'Up Next'}
            </p>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {panelTrack.title}
            </h3>
            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)', marginBottom: '20px' }}>
              {panelTrack.artist}
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
              {!isPlaying ? (
                <button
                  onClick={() => {
                    startTracking(panelTrack.id);
                    setCurrentTrack({ ...panelTrack, spotify_uri: `spotify:track:${panelTrack.id}` });
                  }}
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '12px 28px' }}
                >
                  ▶ Play
                </button>
              ) : (
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                  Full controls are in the player bar below ↓
                </span>
              )}
              <a
                href={`https://open.spotify.com/track/${panelTrack.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '12px 20px',
                  background: 'rgba(29, 185, 84, 0.15)',
                  border: '1px solid rgba(29, 185, 84, 0.3)',
                  borderRadius: '10px',
                  color: '#1DB954',
                  textDecoration: 'none',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                Open in Spotify
              </a>
            </div>
          </div>
        </div>
      );
    })()}

    {/* Compact track list — click any row (or the album art) to send it to
        the Now Playing panel above and the player bar below. */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {recommendations.slice(0, visibleCount).map((track, index) => {
        const isCurrent = currentTrack?.id === track.id;
        return (
          <div
            key={track.id || index}
            onClick={() => {
              startTracking(track.id);
              setCurrentTrack({ ...track, spotify_uri: `spotify:track:${track.id}` });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '10px 14px',
              borderRadius: '12px',
              background: isCurrent ? 'rgba(30, 215, 96, 0.1)' : 'var(--glass-bg)',
              border: `1px solid ${isCurrent ? 'rgba(30, 215, 96, 0.35)' : 'var(--glass-border)'}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              flexShrink: 0,
              backgroundColor: '#181818',
              backgroundImage: track.album_art ? `url(${track.album_art})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {isCurrent && <span style={{ color: '#1ED760', fontSize: '1.1rem' }}>▶</span>}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: '600', fontSize: '0.95rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {track.title}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {track.artist}
              </p>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); setAddToPlaylistTrack(track); }}
              title="Add to playlist"
              style={{ background: 'none', border: 'none', fontSize: '1.3rem', lineHeight: 1, color: 'white', cursor: 'pointer', flexShrink: 0 }}
            >
              +
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); handleLikeSong(track); }}
              title={likedSongs[track.id] ? 'Unlike' : 'Like'}
              style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', flexShrink: 0 }}
            >
              {likedSongs[track.id] ? '❤️' : '🤍'}
            </button>

            <a
              href={`https://open.spotify.com/track/${track.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open in Spotify"
              style={{
                background: 'rgba(29, 185, 84, 0.15)',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(29, 185, 84, 0.3)',
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V14M14 4H20M20 4V10M20 4L10 14"
                  stroke="#1DB954"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        );
      })}
    </div>

    {hasMore && (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="btn"
          style={{
            width: 'auto',
            padding: '10px 28px',
            background: loadingMore ? 'rgba(255,255,255,0.1)' : 'var(--accent-gradient)',
            color: 'white',
            border: '1px solid var(--glass-border)',
            fontSize: '0.95rem',
            fontWeight: 'bold',
            cursor: loadingMore ? 'not-allowed' : 'pointer',
            borderRadius: '24px',
          }}
        >
          {loadingMore ? 'Loading...' : 'Show More'}
        </button>
      </div>
    )}
  </>
)}

</div> {/* closes glass-card */}
</>
)}
</div> {/* closes main container */}

{/* ✅ Webcam Overlay */}
{showWebcam && (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.9)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <WebcamCapture
      onCapture={(file, preview) => {
        setSelectedImage(file);
        setImagePreview(preview);
        setShowWebcam(false);
        handleDetectEmotion(file);
      }}
      onClose={() => setShowWebcam(false)}
    />
  </div>
)}

<CurrentlyPlayingBar
  track={currentTrack}
  onNext={handlePlayerNext}
  onPrevious={handlePlayerPrevious}
/>

<AddToPlaylistModal
  isOpen={!!addToPlaylistTrack}
  song={addToPlaylistTrack}
  onClose={() => setAddToPlaylistTrack(null)}
  onSuccess={() => showToast(`Added "${addToPlaylistTrack?.title}" to your playlist!`)}
/>

</div>
);
};

export default MainApp;