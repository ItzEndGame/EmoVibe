import { useState, useEffect, useRef, useCallback } from 'react';
import { spotifyConnectAPI, musicAPI } from '../../services/api';

/**
 * Loads the Spotify Web Playback SDK and manages a player instance,
 * logging real listening sessions as the user actually plays tracks.
 *
 * Only works for Spotify Premium accounts — Spotify's SDK rejects
 * playback for Free accounts (a Spotify-side restriction, not something
 * we can work around). Free/non-connected users should fall back to the
 * embed iframe or 30-second preview elsewhere in the app; this hook
 * simply reports isPremium=false and does nothing further in that case.
 *
 * Session logging: every time a track changes or playback stops, the
 * elapsed real playback time for the *previous* track is sent to
 * /api/music/listening-session with is_estimated=false, since this is
 * genuine SDK telemetry, not a guess.
 *
 * This hook is now instantiated exactly once, inside PlayerContext, so
 * that the SDK connection (and the currently-playing track) survives
 * navigating around the app instead of disconnecting/reconnecting on
 * every route change. One side effect: the Premium/connected status
 * check below only naturally runs once, on first mount — there's no
 * more "navigate away and back" to accidentally retry it. So the check
 * is exposed as refreshStatus(), meant to be called explicitly whenever
 * something *actually* changed (e.g. right after the user connects
 * Spotify in SpotifyConnectBanner), rather than relying on remounts.
 */
export function useSpotifyPlayer() {
  const [isReady, setIsReady] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [playbackState, setPlaybackState] = useState(null); // raw SDK state, for UI (progress bar etc.)

  const playerRef = useRef(null);
  const currentTrackRef = useRef(null);       // { id, startedAt, accumulatedMs, lastKnownPosition }
  const lastTickRef = useRef(null);
  const cancelledRef = useRef(false);
  const connectingRef = useRef(false); // guards against creating a second SDK Player instance

  const flushSession = useCallback((trackInfo) => {
    if (!trackInfo || !trackInfo.id) return;
    const seconds = Math.round(trackInfo.accumulatedMs / 1000);
    if (seconds < 3) return; // not worth logging a near-instant skip

    musicAPI.logListeningSession(trackInfo.id, seconds, false).catch((err) => {
      console.error('Failed to log SDK listening session:', err);
    });
  }, []);

  const connectPlayer = useCallback(() => {
    // Already have a live player (or one mid-setup) — nothing to do.
    // Without this guard, calling refreshStatus() again after the SDK
    // already connected would spin up a second competing Player instance.
    if (connectingRef.current || playerRef.current) return;
    connectingRef.current = true;

    if (!document.getElementById('spotify-player-sdk')) {
      const script = document.createElement('script');
      script.id = 'spotify-player-sdk';
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);
    }

    const setupPlayer = () => {
      if (cancelledRef.current) return;

      const player = new window.Spotify.Player({
        name: 'EmoVibe Player',
        getOAuthToken: async (callback) => {
          try {
            const tokenResult = await spotifyConnectAPI.getPlaybackToken();
            callback(tokenResult.access_token);
          } catch (err) {
            console.error('Failed to get Spotify playback token:', err);
          }
        },
        volume: 0.7,
      });

      player.addListener('ready', ({ device_id }) => {
        setDeviceId(device_id);
        setIsReady(true);
      });

      player.addListener('not_ready', () => {
        setIsReady(false);
      });

      player.addListener('initialization_error', ({ message }) => {
        console.error('Spotify player init error:', message);
      });

      player.addListener('authentication_error', ({ message }) => {
        console.error('Spotify player auth error:', message);
      });

      // This is the core telemetry event — fires on play, pause, seek,
      // track change, roughly every second during playback.
      player.addListener('player_state_changed', (state) => {
        if (!state) return;
        setPlaybackState(state);

        const trackId = state.track_window?.current_track?.id;
        const now = Date.now();

        if (!currentTrackRef.current || currentTrackRef.current.id !== trackId) {
          // Track changed — flush the previous track's accumulated time first
          flushSession(currentTrackRef.current);
          currentTrackRef.current = { id: trackId, accumulatedMs: 0 };
          lastTickRef.current = state.paused ? null : now;
        } else if (!state.paused && lastTickRef.current) {
          // Still the same track, playing — accumulate elapsed time
          currentTrackRef.current.accumulatedMs += now - lastTickRef.current;
          lastTickRef.current = now;
        } else if (state.paused) {
          // Paused — stop the running clock, but keep accumulated time
          if (lastTickRef.current) {
            currentTrackRef.current.accumulatedMs += now - lastTickRef.current;
          }
          lastTickRef.current = null;
        } else if (!state.paused && !lastTickRef.current) {
          // Resumed from pause
          lastTickRef.current = now;
        }
      });

      player.connect();
      playerRef.current = player;
    };

    // If the SDK script was already loaded and ready by an earlier call
    // (e.g. this is a refreshStatus() retry, not the first attempt),
    // window.onSpotifyWebPlaybackSDKReady already fired once and won't
    // fire again — set the player up directly in that case.
    if (window.Spotify) {
      setupPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = setupPlayer;
    }
  }, [flushSession]);

  // Checks Spotify connect status, and connects the SDK player if the
  // account is connected + Premium. Safe to call more than once — safe
  // to call before the previous call finished, too.
  const checkStatus = useCallback(async () => {
    let statusResult;
    try {
      statusResult = await spotifyConnectAPI.getStatus();
    } catch {
      return; // Not connected / not logged in
    }

    if (cancelledRef.current) return;
    setIsPremium(!!statusResult?.is_premium);

    if (!statusResult.connected || !statusResult.is_premium) {
      return; // Free accounts can't use the Web Playback SDK at all
    }

    connectPlayer();
  }, [connectPlayer]);

  useEffect(() => {
    cancelledRef.current = false;
    checkStatus();

    return () => {
      cancelledRef.current = true;
      // Flush whatever was accumulated when the component unmounts
      // (e.g. user navigates away mid-song).
      flushSession(currentTrackRef.current);
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playTrack = useCallback(async (spotifyTrackUri) => {
    if (!deviceId) return false;

    try {
      const tokenResult = await spotifyConnectAPI.getPlaybackToken();
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokenResult.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: [spotifyTrackUri] }),
      });
      return true;
    } catch (err) {
      console.error('Failed to start playback:', err);
      return false;
    }
  }, [deviceId]);

  const togglePlay = useCallback(() => {
    playerRef.current?.togglePlay();
  }, []);

  const nextTrack = useCallback(() => {
    playerRef.current?.nextTrack();
  }, []);

  const previousTrack = useCallback(() => {
    playerRef.current?.previousTrack();
  }, []);

  const seek = useCallback((positionMs) => {
    playerRef.current?.seek(positionMs);
  }, []);

  return {
    isReady,
    isPremium,
    playbackState,
    playTrack,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    player: playerRef.current,
    refreshStatus: checkStatus, // call after e.g. connecting Spotify, since this hook no longer remounts on navigation to retry on its own
  };
}