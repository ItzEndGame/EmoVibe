import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { musicAPI } from "../../services/api";

/**
 * Beat Reflex Challenge
 *
 * Track source: real liked songs (from the backend, which have actual
 * Spotify track IDs) plus whatever tracks were passed in from the most
 * recent recommendation session (via location.state from MainApp). The
 * old hardcoded 3-track list is gone.
 *
 * "Tempo sync": Spotify deprecated the audio-features endpoint for new
 * apps (confirmed via a 403 when querying it directly), so there's no
 * real BPM data available. Instead, spawn rate is driven by the user's
 * current/dominant emotion as an honest proxy for pace — fast emotions
 * (angry, excited, happy) get a quicker, denser beat rate; slow emotions
 * (sad, fear) get a slower one. This isn't synced to the actual audio
 * waveform, just paced to match the emotional energy of the session.
 *
 * Autoplay: the embed URL includes autoplay=1, and is only mounted once
 * "Start Game" is clicked, so pressing Start actually starts the music
 * at the same moment the beats start spawning, instead of being two
 * separate, disconnected actions.
 */

// Base spawn pacing per emotion — interval in ms between spawn attempts,
// and the probability each tick that a beat actually spawns. Lower
// interval + higher chance = faster, denser, harder. These are tuned
// for touch input; mouse gets adjusted via INPUT_MODE_MODIFIERS below.
const EMOTION_PACING = {
  happy:    { interval: 650, chance: 0.85 },
  excited:  { interval: 550, chance: 0.9 },
  angry:    { interval: 500, chance: 0.9 },
  surprise: { interval: 600, chance: 0.85 },
  neutral:  { interval: 800, chance: 0.75 },
  sad:      { interval: 1100, chance: 0.6 },
  fear:     { interval: 1000, chance: 0.6 },
  disgust:  { interval: 750, chance: 0.7 },
};

const DEFAULT_PACING = EMOTION_PACING.neutral;

// Mouse users need to physically move the cursor to each beat before
// clicking — touch users tap directly where the beat appears. That
// travel time eats into the beat's lifetime, making the same settings
// meaningfully harder on mouse. These modifiers compensate: mouse gets
// a longer beat lifetime (more time to travel + click) and a slightly
// lower spawn density (less overlapping targets to travel between).
const INPUT_MODE_MODIFIERS = {
  touch: { lifetimeMs: 1000, intervalMultiplier: 1, chanceMultiplier: 1 },
  mouse: { lifetimeMs: 1450, intervalMultiplier: 1.2, chanceMultiplier: 0.85 },
};

const GAME_DURATION_MS = 30000;

// Auto-detect whether the primary pointer is touch (coarse) or mouse/
// trackpad (fine). Not perfect — a touchscreen laptop with a mouse
// plugged in may misreport — which is exactly why a manual override
// toggle exists alongside this.
const detectInputMode = () => {
  if (typeof window === "undefined" || !window.matchMedia) return "mouse";
  return window.matchMedia("(pointer: coarse)").matches ? "touch" : "mouse";
};

const MusicReflexGame = ({ tracks = [], currentEmotion = "neutral" }) => {
  const [score, setScore] = useState(0);
  const [activeBeats, setActiveBeats] = useState([]);
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [availableTracks, setAvailableTracks] = useState(tracks);
  const [loadingTracks, setLoadingTracks] = useState(tracks.length === 0);
  const [inputMode, setInputMode] = useState(detectInputMode); // 'touch' | 'mouse', manually overridable

  const beatIntervalRef = useRef(null);
  const endTimerRef = useRef(null);

  const basePacing = EMOTION_PACING[currentEmotion?.toLowerCase()] || DEFAULT_PACING;
  const modifier = INPUT_MODE_MODIFIERS[inputMode] || INPUT_MODE_MODIFIERS.mouse;

  // Combine the emotion's base pacing with the input-mode modifier to get
  // the actual values used during play.
  const pacing = {
    interval: Math.round(basePacing.interval * modifier.intervalMultiplier),
    chance: Math.min(basePacing.chance * modifier.chanceMultiplier, 1),
    lifetimeMs: modifier.lifetimeMs,
  };

  // If no tracks were passed in (e.g. user navigated to /games directly,
  // not from a just-finished recommendation session), fall back to
  // fetching the user's liked songs from the backend.
  useEffect(() => {
    if (tracks.length > 0) {
      setAvailableTracks(tracks);
      setLoadingTracks(false);
      return;
    }

    const loadLikedSongs = async () => {
      try {
        const response = await musicAPI.getLikedSongs(20);
        if (response.success && response.liked_songs?.length > 0) {
          const mapped = response.liked_songs
            .filter((s) => s.spotify_track_id)
            .map((s) => ({
              id: s.spotify_track_id,
              title: s.song_title,
              artist: s.artist,
            }));
          setAvailableTracks(mapped);
        }
      } catch (err) {
        console.error("Failed to load liked songs for game:", err);
      } finally {
        setLoadingTracks(false);
      }
    };

    loadLikedSongs();
  }, [tracks]);

  useEffect(() => {
    return () => {
      if (beatIntervalRef.current) clearInterval(beatIntervalRef.current);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
    };
  }, []);

  const startGame = (track) => {
    if (!track) return;

    setScore(0);
    setGameOver(false);
    setActiveBeats([]);
    setCurrentTrack(track);
    setGameActive(true);

    beatIntervalRef.current = setInterval(() => {
      if (Math.random() < pacing.chance) createBeat();
    }, pacing.interval);

    endTimerRef.current = setTimeout(() => {
      clearInterval(beatIntervalRef.current);
      endGame();
    }, GAME_DURATION_MS);
  };

  const createBeat = () => {
    const newBeat = {
      id: Date.now() + Math.random(),
      x: Math.random() * 80 + 10,
      y: Math.random() * 70 + 10,
    };
    setActiveBeats((prev) => [...prev, newBeat]);
    setTimeout(() => {
      setActiveBeats((prev) => prev.filter((b) => b.id !== newBeat.id));
    }, pacing.lifetimeMs);
  };

  const tapBeat = (id) => {
    setActiveBeats((prev) => prev.filter((b) => b.id !== id));
    setScore((s) => s + 10);
  };

  const endGame = () => {
    setGameActive(false);
    setGameOver(true);
    setActiveBeats([]);
  };

  // ===== Track selection screen (shown before the game starts) =====
  if (!gameActive && !gameOver && !currentTrack) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px",
          color: "white",
          minHeight: "85vh",
          background: "linear-gradient(135deg, rgba(40,40,90,0.6), rgba(70,40,100,0.6))",
          borderRadius: "20px",
        }}
      >
        <h2 style={{ fontSize: "2rem", marginBottom: "10px" }}>🎵 Beat Reflex Challenge</h2>
        <p style={{ opacity: 0.8, marginBottom: '16px' }}>
          Pace: <strong>{currentEmotion}</strong> energy — pick a track to play against
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '30px' }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>Playing with:</span>
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.08)', borderRadius: '20px', padding: '4px' }}>
            <button
              onClick={() => setInputMode('touch')}
              style={{
                padding: '6px 16px',
                borderRadius: '16px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: inputMode === 'touch' ? 'var(--accent-gradient)' : 'transparent',
                color: 'white',
              }}
            >
              👆 Touch
            </button>
            <button
              onClick={() => setInputMode('mouse')}
              style={{
                padding: '6px 16px',
                borderRadius: '16px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: inputMode === 'mouse' ? 'var(--accent-gradient)' : 'transparent',
                color: 'white',
              }}
            >
              🖱️ Mouse
            </button>
          </div>
        </div>

        {loadingTracks ? (
          <p>Loading your tracks...</p>
        ) : availableTracks.length === 0 ? (
          <div>
            <p>No tracks available yet.</p>
            <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>
              Detect an emotion and like a few songs first, then come back here.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "14px",
              justifyContent: "center",
              maxWidth: "700px",
              margin: "0 auto",
            }}
          >
            {availableTracks.slice(0, 12).map((track) => (
              <button
                key={track.id}
                onClick={() => startGame(track)}
                style={{
                  padding: "14px 18px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "14px",
                  color: "white",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "210px",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {track.title}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {track.artist}
                </div>
              </button>
            ))}

            <button
              onClick={() => startGame(availableTracks[Math.floor(Math.random() * availableTracks.length)])}
              style={{
                padding: "14px 18px",
                background: "var(--accent-gradient)",
                border: "none",
                borderRadius: "14px",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
                width: "210px",
              }}
            >
              🎲 Surprise Me
            </button>
          </div>
        )}
      </div>
    );
  }

  // ===== Active game / game over screen =====
  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px",
        color: "white",
        minHeight: "85vh",
        background: "linear-gradient(135deg, rgba(40,40,90,0.6), rgba(70,40,100,0.6))",
        borderRadius: "20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <h2 style={{ fontSize: "2rem", marginBottom: "20px" }}>🎵 Beat Reflex Challenge</h2>

      {currentTrack && (
        <div style={{ margin: "20px 0" }}>
          <iframe
            key={currentTrack.id}
            src={`https://open.spotify.com/embed/track/${currentTrack.id}?utm_source=generator&autoplay=1`}
            width="100%"
            height="100"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            style={{ borderRadius: "12px", marginBottom: "10px" }}
          ></iframe>
          <h3 style={{ fontSize: '1rem', opacity: 0.85 }}>{currentTrack.title} — {currentTrack.artist}</h3>
        </div>
      )}

      {gameActive && (
        <>
          <p style={{ fontSize: "1.3rem" }}>
            Score: {score}
            <span style={{ fontSize: '0.8rem', opacity: 0.6, marginLeft: '12px' }}>
              {inputMode === 'touch' ? '👆 Touch mode' : '🖱️ Mouse mode'}
            </span>
          </p>

          <div
            style={{
              position: "relative",
              width: "100%",
              height: "400px",
              marginTop: "20px",
              borderRadius: "15px",
              background: "rgba(255,255,255,0.05)",
              overflow: "hidden",
            }}
          >
            {activeBeats.map((beat) => (
              <motion.div
                key={beat.id}
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.3, 0], opacity: [1, 0.7, 0] }}
                transition={{ duration: 1 }}
                onClick={() => tapBeat(beat.id)}
                style={{
                  position: "absolute",
                  left: `${beat.x}%`,
                  top: `${beat.y}%`,
                  width: "50px",
                  height: "50px",
                  background: "radial-gradient(circle at center, #ff6b95, #a855f7)",
                  borderRadius: "50%",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </>
      )}

      {gameOver && (
        <div style={{ marginTop: "20px" }}>
          <h3 style={{ fontSize: "1.5rem" }}>🎯 Final Score: {score}</h3>
          <p>
            {score > 150
              ? "🔥 Excellent reflexes!"
              : score > 80
              ? "🎶 Nice rhythm!"
              : "😅 You missed a few beats, try again!"}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
            <button
              onClick={() => startGame(currentTrack)}
              style={{
                padding: "12px 25px",
                background: "var(--accent-gradient)",
                border: "none",
                borderRadius: "12px",
                color: "white",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              🔁 Play Again
            </button>
            <button
              onClick={() => {
                setCurrentTrack(null);
                setGameOver(false);
              }}
              style={{
                padding: "12px 25px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "12px",
                color: "white",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              🎵 Choose Different Song
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MusicReflexGame;