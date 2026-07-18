import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useListeningHeartbeat } from '../components/Spotify/useListeningHeartbeat';
import { useSpotifyPlayer } from '../components/Spotify/useSpotifyPlayer';

/**
 * Holds the "currently playing" track for the whole app.
 *
 * This MUST be provided above the <Outlet/> in AppShell (not inside a
 * page like Dashboard), otherwise it unmounts on every route change and
 * playback stops the moment the user navigates away from the page that
 * started it.
 *
 * The estimated-listening heartbeat (for non-Premium/no-SDK users) lives
 * here too, for the same reason — it used to be instantiated per-page, so
 * it stopped counting the moment you navigated away even though the song
 * kept playing in the bar.
 *
 * useSpotifyPlayer (the real Premium/SDK connection) lives here as well,
 * rather than inside CurrentlyPlayingBar. It used to be fine there because
 * CurrentlyPlayingBar was mounted per-page and remounted on every route
 * change — which meant its "is this account Premium + connected?" check
 * also re-ran on every navigation, accidentally retrying itself if the
 * very first check ever ran too early (e.g. right after connecting
 * Spotify). Now that the bar is mounted once at the AppShell level and
 * never remounts during navigation, that check only naturally runs once.
 * So it's exposed here as refreshStatus() for anything that needs to
 * explicitly re-trigger it — SpotifyConnectBanner calls it right after a
 * successful connect.
 */
const PlayerContext = createContext(null);

export const PlayerProvider = ({ children }) => {
  const [currentTrack, setCurrentTrackState] = useState(null);
  // Optional queue support — keeps Next/Previous working from any page,
  // not just the one that started playback.
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  const { startTracking, stopTracking } = useListeningHeartbeat();
  const spotifyPlayer = useSpotifyPlayer();

  // Every path that changes the current track funnels through here so the
  // heartbeat always starts/stops in step with what's actually playing —
  // pages no longer need to call startTracking themselves.
  const setCurrentTrack = useCallback((track) => {
    if (track?.id) {
      startTracking(track.id);
    } else {
      stopTracking();
    }
    setCurrentTrackState(track);
  }, [startTracking, stopTracking]);

  // playTrack(track) — single track, no queue context (e.g. "Jump Back In")
  // playTrack(track, list, index) — track plus its surrounding list, so
  // Next/Previous can move through it (e.g. a recommendations grid)
  const playTrack = useCallback((track, list, index) => {
    setCurrentTrack(track);
    if (list && typeof index === 'number') {
      setQueue(list);
      setQueueIndex(index);
    } else {
      setQueue([track]);
      setQueueIndex(0);
    }
  }, [setCurrentTrack]);

  const clearTrack = useCallback(() => {
    setCurrentTrack(null);
    setQueue([]);
    setQueueIndex(-1);
  }, [setCurrentTrack]);

  const nextTrack = useCallback(() => {
    setQueueIndex((prevIndex) => {
      if (prevIndex < 0 || prevIndex + 1 >= queue.length) return prevIndex;
      const newIndex = prevIndex + 1;
      setCurrentTrack(queue[newIndex]);
      return newIndex;
    });
  }, [queue, setCurrentTrack]);

  const previousTrack = useCallback(() => {
    setQueueIndex((prevIndex) => {
      if (prevIndex <= 0) return prevIndex;
      const newIndex = prevIndex - 1;
      setCurrentTrack(queue[newIndex]);
      return newIndex;
    });
  }, [queue, setCurrentTrack]);

  // Flush any partial listening time if the provider itself ever unmounts
  // (e.g. logging out, leaving the authenticated app entirely) — mirrors
  // the cleanup each page used to do individually.
  useEffect(() => {
    return () => stopTracking();
  }, [stopTracking]);

  const value = {
    currentTrack,
    setCurrentTrack, // exposed directly too, for simple call sites like Dashboard's existing handlers
    playTrack,
    clearTrack,
    nextTrack,
    previousTrack,
    stopTracking, // passthrough — lets a page flush accumulated listening time without clearing currentTrack
    hasNext: queueIndex >= 0 && queueIndex + 1 < queue.length,
    hasPrevious: queueIndex > 0,
    // Spotify Premium/SDK connection — shared single instance (see comment
    // above). CurrentlyPlayingBar reads these to decide SDK vs iframe;
    // SpotifyConnectBanner calls refreshStatus() after connecting.
    spotify: spotifyPlayer,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return ctx;
};