// playbackSync.js
// Coordinates playback across browser tabs of the same app/origin.
// Rule: when one tab starts playing, every other tab pauses itself.

const CHANNEL_NAME = 'emotune-playback-sync';
const STORAGE_KEY = 'emotune_playback_ping'; // fallback for browsers without BroadcastChannel

// Unique per tab, regenerated on every page load — used so a tab can
// recognize (and ignore) messages that originated from itself.
export const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

class PlaybackCoordinator {
  constructor() {
    this.pauseCallback = null;
    this.channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

    if (this.channel) {
      this.channel.onmessage = (event) => this._handleMessage(event.data);
    } else {
      // Fallback: the 'storage' event only fires in *other* tabs, never
      // the one that wrote the key — which is exactly the behavior we want.
      window.addEventListener('storage', (event) => {
        if (event.key !== STORAGE_KEY || !event.newValue) return;
        try {
          this._handleMessage(JSON.parse(event.newValue));
        } catch {
          // ignore malformed payloads
        }
      });
    }
  }

  _handleMessage(data) {
    if (!data || data.tabId === TAB_ID) return; // ignore our own broadcasts
    if (data.type === 'playing' && this.pauseCallback) {
      this.pauseCallback(data.trackId);
    }
  }

  _send(payload) {
    const message = { ...payload, tabId: TAB_ID, ts: Date.now() };
    if (this.channel) {
      this.channel.postMessage(message);
    } else {
      // localStorage writes always trigger the storage event in other tabs,
      // even when the value is identical, as long as it actually changes —
      // ts makes sure it always does.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
    }
  }

  /** Call this the moment your player actually starts playing audio. */
  announcePlaying(trackId) {
    this._send({ type: 'playing', trackId });
  }

  /** Register what "pause this tab's player" means for your app. */
  onOtherTabPlaying(callback) {
    this.pauseCallback = callback;
  }
}

export const playbackCoordinator = new PlaybackCoordinator();