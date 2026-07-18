import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { musicAPI } from "../../services/api";
import "./MusicReflexGame.css";

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
 * Playback: uses Spotify's official iFrame API (not the old
 * `?autoplay=1` URL param, which is unreliable and usually still shows a
 * play button instead of actually starting). The embed is created as
 * soon as a track is picked — i.e. at the start of the 3-2-1 countdown —
 * so it has the full countdown window to load. Calling the controller's
 * .play() isn't proof it actually started, though, so beats and the
 * visible timer don't start immediately after that call — they wait for
 * a real `playback_update` event confirming isPaused === false. If that
 * confirmation never arrives within a few seconds (silent failure, event
 * never fires, etc.), a safety-net timeout starts the game anyway so it
 * never stalls indefinitely in a silent "waiting" state.
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

const DURATION_OPTIONS = [30, 45, 60, 100]; // seconds
const SPOTIFY_IFRAME_API_SRC = "https://open.spotify.com/embed/iframe-api/v1";

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

  // Countdown shown between picking a track and the game actually
  // starting — pendingTrack holds the chosen track while counting down,
  // countdownValue is 3 -> 2 -> 1, then null once the game starts.
  const [countdownValue, setCountdownValue] = useState(null);
  const [pendingTrack, setPendingTrack] = useState(null);
  const [apiReady, setApiReady] = useState(false);
  const [duration, setDuration] = useState(30); // seconds — chosen on the picker screen
  const [timeLeft, setTimeLeft] = useState(30);
  // If the Spotify iFrame API never responds (blocked, slow, or fails
  // silently), the embed container would otherwise stay empty forever.
  // This flips to true after a short grace period with no controller, at
  // which point we fall back to a plain <iframe> so a player is
  // guaranteed to actually show up.
  const [embedFallback, setEmbedFallback] = useState(false);
  // Bumped every time a new controller is created, purely so effects can
  // react to controllerRef's contents changing (refs themselves aren't
  // reactive).
  const [controllerVersion, setControllerVersion] = useState(0);
  // True from the moment we call play() until we get real confirmation
  // (via the controller's playback_update event) that audio is actually
  // playing — beats and the timer are gated on this being false.
  const [waitingForPlayback, setWaitingForPlayback] = useState(false);

  const beatIntervalRef = useRef(null);
  const endTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const gameTimerRef = useRef(null);
  const embedContainerRef = useRef(null);
  const iframeApiRef = useRef(null);
  const controllerRef = useRef(null);
  const fallbackTimeoutRef = useRef(null);
  const playbackStartTimeoutRef = useRef(null);
  const beatsStartedRef = useRef(false); // guards against starting beats/timer twice
  const playAttemptedRef = useRef(false); // guards against issuing play() more than once per round

  // Whichever track is "in play" right now, whether we're still counting
  // down or already in the game — used to decide when to (re)create the
  // embed controller.
  const activeTrack = pendingTrack || currentTrack;

  const basePacing = EMOTION_PACING[currentEmotion?.toLowerCase()] || DEFAULT_PACING;
  const modifier = INPUT_MODE_MODIFIERS[inputMode] || INPUT_MODE_MODIFIERS.mouse;

  // Combine the emotion's base pacing with the input-mode modifier to get
  // the actual values used during play.
  const pacing = {
    interval: Math.round(basePacing.interval * modifier.intervalMultiplier),
    chance: Math.min(basePacing.chance * modifier.chanceMultiplier, 1),
    lifetimeMs: modifier.lifetimeMs,
  };

  // If no tracks were passed in (e.g. user navigated to /app/games directly,
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

  // Load Spotify's iFrame API script once. It calls
  // window.onSpotifyIframeApiReady(IFrameAPI) when ready — we stash the
  // API object in a ref and flip apiReady so the controller-creation
  // effect below can run.
  useEffect(() => {
    if (window.__spotifyIframeApiLoading) {
      // Another instance already kicked off the script load — just wait
      // for the ready callback to fire (see below).
    } else if (!document.getElementById("spotify-iframe-api")) {
      window.__spotifyIframeApiLoading = true;
      const script = document.createElement("script");
      script.id = "spotify-iframe-api";
      script.src = SPOTIFY_IFRAME_API_SRC;
      script.async = true;
      document.body.appendChild(script);
    }

    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      iframeApiRef.current = IFrameAPI;
      setApiReady(true);
    };

    // If a previous mount already completed the ready handshake (e.g.
    // navigating away and back within the same session), the API object
    // may already be sitting in memory with no new ready event coming.
    if (iframeApiRef.current) setApiReady(true);
  }, []);

  // (Re)creates the embed controller whenever the active track changes,
  // as soon as both the API is ready and the container div is mounted.
  // The container's `key` (see JSX) is tied to the track id, so picking
  // a new track always gives us a fresh div here to embed into.
  useEffect(() => {
    if (!activeTrack || !apiReady || !iframeApiRef.current || !embedContainerRef.current) return;

    iframeApiRef.current.createController(
      embedContainerRef.current,
      { uri: `spotify:track:${activeTrack.id}`, width: "100%", height: 100 },
      (EmbedController) => {
        controllerRef.current = EmbedController;
        setControllerVersion((v) => v + 1);
      }
    );
  }, [activeTrack, apiReady]);

  // Safety net: if the iFrame API hasn't become ready within a few
  // seconds of picking a track, stop waiting on it and fall back to a
  // plain iframe embed instead — guarantees a visible player even if the
  // API script is blocked, slow, or silently fails in this environment.
  useEffect(() => {
    if (!activeTrack) return;

    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
    fallbackTimeoutRef.current = setTimeout(() => {
      if (!apiReady) {
        console.warn("Spotify iFrame API didn't become ready in time — falling back to a plain embed.");
        setEmbedFallback(true);
      }
    }, 3000);

    return () => clearTimeout(fallbackTimeoutRef.current);
  }, [activeTrack, apiReady]);

  // Listens for the controller's real playback state. This is the only
  // reliable signal that audio actually started — calling .play() is not
  // a guarantee it worked, so beats/timer are gated on this event rather
  // than firing right after the play() call.
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || typeof controller.addListener !== "function") return;

    const handlePlaybackUpdate = (e) => {
      if (e?.data?.isPaused === false) {
        beginBeatsAndTimer();
      }
    };

    controller.addListener("playback_update", handlePlaybackUpdate);
    return () => {
      if (typeof controller.removeListener === "function") {
        controller.removeListener("playback_update", handlePlaybackUpdate);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllerVersion]);

  // If startGame() ran before the controller finished loading (e.g. it
  // was still fetching when the countdown hit zero), attemptPlayback()
  // will have been a no-op back then. This retries it as soon as a
  // controller becomes available — without this, "controller not ready
  // yet" was being treated the same as "no signal available at all" and
  // the game would start immediately with no music playing.
  useEffect(() => {
    if (gameActive && waitingForPlayback) {
      attemptPlayback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllerVersion, gameActive, waitingForPlayback]);

  useEffect(() => {
    return () => {
      if (beatIntervalRef.current) clearInterval(beatIntervalRef.current);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
      if (playbackStartTimeoutRef.current) clearTimeout(playbackStartTimeoutRef.current);
    };
  }, []);

  // Ticks the countdown down once per second. When it hits 1, the *next*
  // tick starts the actual game (music + beats) instead of showing a "0" —
  // so the sequence the player sees is 3, 2, 1, then the track starts
  // playing and beats begin appearing, all in the same moment.
  useEffect(() => {
    if (countdownValue === null) return;

    countdownTimerRef.current = setTimeout(() => {
      if (countdownValue > 1) {
        setCountdownValue((v) => v - 1);
      } else {
        const track = pendingTrack;
        setCountdownValue(null);
        setPendingTrack(null);
        startGame(track);
      }
    }, 1000);

    return () => clearTimeout(countdownTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownValue]);

  const beginCountdown = (track) => {
    if (!track) return;
    setEmbedFallback(false);
    setPendingTrack(track);
    setCountdownValue(3);
  };

  const startGame = (track) => {
    if (!track) return;

    setScore(0);
    setGameOver(false);
    setActiveBeats([]);
    setCurrentTrack(track);
    setGameActive(true);
    setTimeLeft(duration);
    setWaitingForPlayback(true);
    beatsStartedRef.current = false;
    playAttemptedRef.current = false;

    if (beatIntervalRef.current) clearInterval(beatIntervalRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    if (playbackStartTimeoutRef.current) clearTimeout(playbackStartTimeoutRef.current);

    // Try right away — if the controller isn't ready yet, the retry
    // effect above (watching controllerVersion) will call this again as
    // soon as one becomes available, instead of giving up and starting
    // the game with no music.
    attemptPlayback();
  };

  // Issues the actual play command, but only once a controller exists.
  // Guarded by playAttemptedRef so it only fires once per round — safe
  // to call repeatedly (from startGame() immediately, and again from the
  // retry effect if the controller was still loading at that point).
  const attemptPlayback = () => {
    if (playAttemptedRef.current) return;
    const controller = controllerRef.current;

    if (!controller && !embedFallback) {
      // Not ready yet, and we're not in the plain-iframe fallback path
      // either — do nothing. The retry effect will call this again once
      // a controller shows up. Critically: do NOT fall through to
      // starting beats/timer just because nothing's ready yet — that
      // was the original bug.
      return;
    }

    playAttemptedRef.current = true;

    if (controller) {
      if (typeof controller.seek === "function") controller.seek(0);
      if (typeof controller.play === "function") controller.play();
      else if (typeof controller.resume === "function") controller.resume();
    }

    if (!embedFallback && controller && typeof controller.addListener === "function") {
      // Safety net: if we never get playback confirmation within a few
      // seconds (play() silently failed, event never fires, etc.), start
      // anyway so the game doesn't stall forever in "waiting" state.
      playbackStartTimeoutRef.current = setTimeout(() => {
        beginBeatsAndTimer();
      }, 4000);
    } else {
      // Plain iframe fallback, or a controller with no event support —
      // no reliable "it's playing now" signal available, so just start.
      beginBeatsAndTimer();
    }
  };

  // Actually starts beat spawning + the visible countdown timer. Called
  // either when playback_update confirms real playback, or by the
  // safety-net timeout in startGame() if that confirmation never arrives.
  const beginBeatsAndTimer = () => {
    if (beatsStartedRef.current) return; // already running — avoid double-start
    beatsStartedRef.current = true;

    setWaitingForPlayback(false);
    if (playbackStartTimeoutRef.current) {
      clearTimeout(playbackStartTimeoutRef.current);
      playbackStartTimeoutRef.current = null;
    }

    beatIntervalRef.current = setInterval(() => {
      if (Math.random() < pacing.chance) createBeat();
    }, pacing.interval);

    gameTimerRef.current = setInterval(() => {
      setTimeLeft((t) => Math.max(t - 1, 0));
    }, 1000);

    endTimerRef.current = setTimeout(() => {
      clearInterval(beatIntervalRef.current);
      endGame();
    }, duration * 1000);
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
    setWaitingForPlayback(false);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (playbackStartTimeoutRef.current) clearTimeout(playbackStartTimeoutRef.current);
    if (controllerRef.current && typeof controllerRef.current.pause === "function") {
      controllerRef.current.pause();
    }
  };

  const showPicker = !gameActive && !gameOver && !currentTrack && countdownValue === null;

  return (
    <div className="reflex-panel">
      <h2 className="reflex-title">🎵 Beat Reflex Challenge</h2>

      {/* Embed container persists across countdown -> game -> game over,
          so the controller created in it isn't torn down and recreated
          mid-flow. Only re-keyed (and thus recreated) when the track
          actually changes. */}
      {activeTrack && (
        <div className="reflex-embed-wrap">
          {embedFallback ? (
            <iframe
              key={`fallback-${activeTrack.id}`}
              title={`Spotify player — ${activeTrack.title} by ${activeTrack.artist}`}
              src={`https://open.spotify.com/embed/track/${activeTrack.id}?utm_source=generator&autoplay=1`}
              width="100%"
              height="100"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            ></iframe>
          ) : (
            <>
              <div ref={embedContainerRef} key={activeTrack.id} />
              {!apiReady && <p className="reflex-embed-loading">Loading player…</p>}
            </>
          )}
          <h3 className="reflex-track-label">
            {activeTrack.title} — {activeTrack.artist}
          </h3>
        </div>
      )}

      {countdownValue !== null && (
        <div className="reflex-countdown-number" key={countdownValue}>
          {countdownValue}
        </div>
      )}

      {showPicker && (
        <>
          <p className="reflex-subtitle">
            Pace: <strong>{currentEmotion}</strong> energy — pick a track to play against
          </p>

          <div className="reflex-mode-row">
            <span className="reflex-mode-label">Playing with:</span>
            <div className="reflex-mode-toggle">
              <button
                onClick={() => setInputMode('touch')}
                className={`reflex-mode-btn ${inputMode === 'touch' ? 'reflex-mode-btn-active' : ''}`}
              >
                👆 Touch
              </button>
              <button
                onClick={() => setInputMode('mouse')}
                className={`reflex-mode-btn ${inputMode === 'mouse' ? 'reflex-mode-btn-active' : ''}`}
              >
                🖱️ Mouse
              </button>
            </div>
          </div>

          <div className="reflex-mode-row">
            <span className="reflex-mode-label">Game length:</span>
            <div className="reflex-mode-toggle">
              {DURATION_OPTIONS.map((secs) => (
                <button
                  key={secs}
                  onClick={() => setDuration(secs)}
                  className={`reflex-mode-btn ${duration === secs ? 'reflex-mode-btn-active' : ''}`}
                >
                  {secs}s
                </button>
              ))}
            </div>
          </div>

          {loadingTracks ? (
            <p className="reflex-empty-note">Loading your tracks...</p>
          ) : availableTracks.length === 0 ? (
            <div>
              <p>No tracks available yet.</p>
              <p className="reflex-empty-note">
                Detect an emotion and like a few songs first, then come back here.
              </p>
            </div>
          ) : (
            <div className="reflex-tracks-grid">
              {availableTracks.slice(0, 12).map((track) => (
                <button
                  key={track.id}
                  onClick={() => beginCountdown(track)}
                  className="reflex-track-card"
                >
                  <div className="reflex-track-title">{track.title}</div>
                  <div className="reflex-track-artist">{track.artist}</div>
                </button>
              ))}

              <button
                onClick={() => beginCountdown(availableTracks[Math.floor(Math.random() * availableTracks.length)])}
                className="reflex-surprise-btn"
              >
                🎲 Surprise Me
              </button>
            </div>
          )}
        </>
      )}

      {gameActive && (
        <>
          <p className="reflex-score-row">
            Score: {score}
            <span className={`reflex-timer ${timeLeft <= 5 ? 'reflex-timer-low' : ''}`}>
              ⏱ {timeLeft}s
            </span>
            <span className="reflex-score-mode">
              {inputMode === 'touch' ? '👆 Touch mode' : '🖱️ Mouse mode'}
            </span>
          </p>

          <div className="reflex-board">
            {waitingForPlayback ? (
              <div className="reflex-waiting-playback">🔊 Starting music…</div>
            ) : (
              activeBeats.map((beat) => (
                <motion.div
                  key={beat.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.3, 0], opacity: [1, 0.7, 0] }}
                  transition={{ duration: 1 }}
                  onClick={() => tapBeat(beat.id)}
                  className="reflex-beat"
                  style={{ left: `${beat.x}%`, top: `${beat.y}%` }}
                />
              ))
            )}
          </div>
        </>
      )}

      {gameOver && (
        <div className="reflex-gameover">
          <h3 className="reflex-gameover-title">🎯 Final Score: {score}</h3>
          <p className="reflex-gameover-msg">
            {score > 150
              ? "🔥 Excellent reflexes!"
              : score > 80
              ? "🎶 Nice rhythm!"
              : "😅 You missed a few beats, try again!"}
          </p>
          <div className="reflex-gameover-actions">
            <button onClick={() => beginCountdown(currentTrack)} className="reflex-btn-primary">
              🔁 Play Again
            </button>
            <button
              onClick={() => {
                setCurrentTrack(null);
                setGameOver(false);
              }}
              className="reflex-btn-secondary"
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