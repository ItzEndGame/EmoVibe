import { useRef, useCallback, useEffect } from 'react';
import { musicAPI } from '../../services/api';

/**
 * Lightweight estimated listening tracker for users without Premium/SDK
 * access. Since the Spotify embed iframe and the 30-second preview
 * <audio> tag give us no real playback telemetry, this estimates
 * "listening time" as: how long has this specific track's card stayed
 * the active/focused one, while the browser tab is visible.
 *
 * This is explicitly an estimate (is_estimated=true) — it can't tell if
 * the user actually pressed play inside the embed, paused it, or just
 * left the card open while doing something else. It's a best-effort
 * proxy, not a measurement, and is logged as such.
 *
 * Usage: call startTracking(trackId) when a card becomes "active"
 * (e.g. its embed/audio is loaded or play is clicked), and
 * stopTracking() when it's no longer the active one (track changed,
 * component unmounted, user navigated away).
 */
export function useListeningHeartbeat() {
  const activeRef = useRef(null); // { trackId, startedAt, accumulatedMs }
  const hiddenAtRef = useRef(null);

  const flush = useCallback(() => {
    const active = activeRef.current;
    if (!active) return;

    let totalMs = active.accumulatedMs;
    if (active.startedAt) {
      totalMs += Date.now() - active.startedAt;
    }

    const seconds = Math.round(totalMs / 1000);
    if (seconds >= 3) {
      musicAPI.logListeningSession(active.trackId, seconds, true).catch((err) => {
        console.error('Failed to log estimated listening session:', err);
      });
    }
  }, []);

  const startTracking = useCallback((trackId) => {
    if (activeRef.current?.trackId === trackId) return; // already tracking this one

    flush(); // close out whatever was being tracked before
    activeRef.current = { trackId, startedAt: Date.now(), accumulatedMs: 0 };
  }, [flush]);

  const stopTracking = useCallback(() => {
    flush();
    activeRef.current = null;
  }, [flush]);

  // Pause the clock while the tab isn't visible, so background tabs
  // don't silently rack up fake listening time.
  useEffect(() => {
    const handleVisibility = () => {
      const active = activeRef.current;
      if (!active) return;

      if (document.hidden) {
        if (active.startedAt) {
          active.accumulatedMs += Date.now() - active.startedAt;
          active.startedAt = null;
        }
        hiddenAtRef.current = Date.now();
      } else {
        active.startedAt = Date.now();
        hiddenAtRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // Flush on unload so a closed tab still logs partial progress
    const handleUnload = () => flush();
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      flush();
    };
  }, [flush]);

  return { startTracking, stopTracking };
}