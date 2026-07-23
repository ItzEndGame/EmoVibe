import axios from 'axios';

const getDefaultApiBase = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5000/api';
  }

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }

  return '/api';
};

const API_BASE = process.env.REACT_APP_API_URL || getDefaultApiBase();
export const API_ROOT = API_BASE.replace(/\/api\/?$/, '');

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let refreshSubscribers = [];

const onRefreshed = () => {
  refreshSubscribers.forEach((callback) => callback());
  refreshSubscribers = [];
};

const refreshAccessToken = async () => {
  try {
    await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
    return true;
  } catch (err) {
    console.error('Token refresh failed:', err);
    return false;
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Endpoints that don't require an existing session — a 401 here means
    // "wrong credentials" / "invalid request", not "your session expired".
    // These should never trigger the refresh-and-retry flow below, or it
    // misfires as a fake "session expired" redirect on a simple wrong
    // password attempt.
    const noAuthRequiredPaths = [
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/verify-reset-code',
      '/auth/reset-password',
      '/auth/refresh',
      '/auth/google/token',
      '/auth/google/login',
      '/auth/google/callback',
    ];
    const isNoAuthEndpoint = noAuthRequiredPaths.some((path) =>
      originalRequest?.url?.includes(path)
    );

    // If access token expired (401) and we haven't already retried this request
    if (error.response?.status === 401 && !originalRequest._retry && !isNoAuthEndpoint) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Wait for the in-flight refresh to finish, then retry with the new token
        return new Promise((resolve) => {
          refreshSubscribers.push(() => {
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;

      if (newToken) {
        onRefreshed(true);
        return api(originalRequest);
      }

      // Refresh failed — session is truly dead, log out only when we are on a
      // protected route and the user actually had a session to begin with.
      console.error('❌ Session expired, logging out');
      const hadSession = !!localStorage.getItem('auth_session') || !!localStorage.getItem('user');
      const isOAuthCallbackRoute = window.location.pathname.includes('/auth/callback');
      if (hadSession && !isOAuthCallbackRoute && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        localStorage.removeItem('auth_session');
        localStorage.removeItem('user');
        window.location.href = '/login?error=session_expired';
      }
      return Promise.reject(error);
    }

    console.error('❌ API Error:', error.response?.status, error.config?.url);
    return Promise.reject(error);
  }
);

// ==================== AUTHENTICATION ====================

export const authAPI = {
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  verifyResetCode: async (email, code) => {
    const response = await api.post('/auth/verify-reset-code', { email, code });
    return response.data;
  },

  resetPassword: async (email, code, newPassword) => {
    const response = await api.post('/auth/reset-password', {
      email,
      code,
      new_password: newPassword,
    });
    return response.data;
  },

  validateToken: async () => {
    const response = await api.get('/auth/validate-token');
    return response.data;
  },

  // Redirect browser to backend, which redirects to Google
  loginWithGoogle: () => {
    window.location.href = `${API_ROOT}/api/auth/google/login`;
  },
};

// ==================== SPOTIFY CONNECT ====================

export const spotifyConnectAPI = {
  // Redirect browser to backend, which redirects to Spotify consent screen.
  // The backend reads the auth cookie directly, so the browser can navigate
  // without any JWT query string.
  connect: async () => {
    try {
      await api.post('/auth/refresh', {}, { withCredentials: true });
    } catch (err) {
      console.error('Could not refresh token before Spotify connect:', err);
    }

    window.location.href = `${API_ROOT}/api/auth/spotify/login`;
  },

  getStatus: async () => {
    const response = await api.get('/auth/spotify/status');
    return response.data;
  },

  getPlaybackToken: async () => {
    const response = await api.get('/auth/spotify/token');
    return response.data;
  },

  disconnect: async () => {
    const response = await api.delete('/auth/spotify/disconnect');
    return response.data;
  },
};

// ==================== EMOTION DETECTION ====================

export const emotionAPI = {
  detectFromUpload: async (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await axios.post(
      `${API_BASE}/emotion/detect-upload`,
      formData,
      {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  getModelInfo: async () => {
    const response = await axios.get(`${API_BASE}/emotion/model-info`);
    return response.data;
  },

  logSelection: async (emotion) => {
    const response = await api.post('/emotion/log-selection', { emotion });
    return response.data;
  },

  getHistory: async (limit = 20) => {
    const response = await api.get('/emotion/history', { params: { limit } });
    return response.data;
  },

  getFavoriteMood: async () => {
    const response = await api.get('/emotion/favorite-mood');
    return response.data;
  },

  getStreak: async () => {
    const response = await api.get('/emotion/streak');
    return response.data;
  },

  getLongestStreak: async () => {
    const response = await api.get('/emotion/longest-streak');
    return response.data;
  },

  test: async () => {
    const response = await axios.get(`${API_BASE}/emotion/test`);
    return response.data;
  },
};

// ==================== MUSIC ====================

export const musicAPI = {
  getRecommendations: async (emotion, language = 'english', limit = 6, excludeIds = [], sort = 'relevance', explicitContent = true) => {
    const params = { language, limit, sort, explicit_content: explicitContent };
    if (excludeIds.length > 0) {
      params.exclude_ids = excludeIds.join(',');
    }
    const response = await api.get(`/music/recommendations/${emotion}`, { params });
    return response.data;
  },

  likeSong: async (songData) => {
    const response = await api.post('/music/like', songData);
    return response.data;
  },

  unlikeSong: async (songId) => {
    const response = await api.delete(`/music/unlike/${songId}`);
    return response.data;
  },

  getLikedSongs: async (limit = null, emotion = null) => {
    const params = {};
    if (limit) params.limit = limit;
    if (emotion) params.emotion = emotion;

    const response = await api.get('/music/liked', { params });
    return response.data;
  },

  searchTracks: async (query, limit = 10) => {
    const response = await api.get('/music/search', {
      params: { q: query, limit },
    });
    return response.data;
  },

  getMoodPlaylists: async (emotion, language = 'english') => {
    const response = await api.get(`/music/mood-playlists/${emotion}`, {
      params: { language },
    });
    return response.data;
  },

  getMoodPlaylistDetail: async (moodPlaylistId) => {
    const response = await api.get(`/music/mood-playlists/detail/${moodPlaylistId}`);
    return response.data;
  },

  logListeningSession: async (spotifyTrackId, durationSeconds, isEstimated = true) => {
    const response = await api.post('/music/listening-session', {
      spotify_track_id: spotifyTrackId,
      duration_seconds: durationSeconds,
      is_estimated: isEstimated,
    });
    return response.data;
  },

  test: async () => {
    const response = await axios.get(`${API_BASE}/music/test`);
    return response.data;
  },
};

// ==================== PLAYLISTS (user-created) ====================

export const playlistsAPI = {
  getAll: async () => {
    const response = await api.get('/playlists');
    return response.data;
  },

  create: async (name, description = null, coverImageUrl = null) => {
    const response = await api.post('/playlists', {
      name,
      description,
      cover_image_url: coverImageUrl,
    });
    return response.data;
  },

  getById: async (playlistId) => {
    const response = await api.get(`/playlists/${playlistId}`);
    return response.data;
  },

  update: async (playlistId, updates) => {
    const response = await api.put(`/playlists/${playlistId}`, updates);
    return response.data;
  },

  delete: async (playlistId) => {
    const response = await api.delete(`/playlists/${playlistId}`);
    return response.data;
  },

  addSong: async (playlistId, track) => {
    const response = await api.post(`/playlists/${playlistId}/songs`, {
      spotify_track_id: track.id,
      song_title: track.title,
      artist: track.artist,
      album_art_url: track.album_art,
      spotify_preview_url: track.preview_url,
    });
    return response.data;
  },

  removeSong: async (playlistId, spotifyTrackId) => {
    const response = await api.delete(`/playlists/${playlistId}/songs/${spotifyTrackId}`);
    return response.data;
  },
};

// ==================== PREFERENCES ====================

export const preferencesAPI = {
  get: async () => {
    const response = await api.get('/preferences');
    return response.data;
  },

  update: async (updates) => {
    const response = await api.put('/preferences', updates);
    return response.data;
  },
};

// ==================== NOTIFICATIONS ====================

export const notificationsAPI = {
  getAll: async () => {
    const response = await api.get('/notifications');
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  markRead: async (notificationId) => {
    const response = await api.patch(`/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllRead: async () => {
    const response = await api.patch('/notifications/read-all');
    return response.data;
  },
};

// ==================== USER PROFILE ====================

export const userAPI = {
  getProfile: async () => {
    const response = await api.get('/user/profile');
    return response.data;
  },

  updateProfile: async (updates) => {
    const response = await api.put('/user/profile/edit', updates);
    return response.data;
  },

  uploadProfilePicture: async (imageFile) => {
    const formData = new FormData();
    formData.append('picture', imageFile);

    const response = await api.post('/user/profile/picture', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  removeProfilePicture: async () => {
    const response = await api.delete('/user/profile/picture');
    return response.data;
  },

  deleteAccount: async () => {
    const response = await api.delete('/user/account', {
      data: { confirm: true },
    });
    return response.data;
  },

  getStatistics: async () => {
    const response = await api.get('/user/statistics');
    return response.data;
  },

  getPreferences: async () => {
    const response = await api.get('/user/preferences');
    return response.data;
  },

  updatePreferences: async (preferences) => {
    const response = await api.put('/user/preferences', preferences);
    return response.data;
  },
};

// ==================== HELPER FUNCTIONS ====================

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('auth_session', '1');
  } else {
    localStorage.removeItem('auth_session');
  }
};

export const setUser = (user) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
};

export const getUser = () => {
  const user = localStorage.getItem('user');
  if (!user || user === 'undefined') return null;
  try {
    return JSON.parse(user);
  } catch {
    return null;
  }
};

export const isAuthenticated = () => {
  const hasSessionMarker = !!localStorage.getItem('auth_session') || !!localStorage.getItem('user');

  // The auth cookies are HttpOnly, so the browser cannot expose them to
  // JavaScript. Relying on document.cookie here makes the app think the user
  // is logged out even when the backend has already accepted the session.
  return hasSessionMarker;
};

export const logout = async () => {
  try {
    await api.post('/auth/logout', {}, { withCredentials: true });
  } catch (err) {
    console.error('Logout request failed:', err);
  }

  localStorage.removeItem('auth_session');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

export default api;