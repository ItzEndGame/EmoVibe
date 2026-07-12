import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api';
export const API_ROOT = API_BASE.replace(/\/api\/?$/, '');

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      const cleanToken = token.trim().replace(/^["']|["']$/g, '');
      config.headers.Authorization = `Bearer ${cleanToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let refreshSubscribers = [];

const onRefreshed = (newToken) => {
  refreshSubscribers.forEach((callback) => callback(newToken));
  refreshSubscribers = [];
};

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;

  try {
    const response = await axios.post(`${API_BASE}/auth/refresh`, {}, {
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    const newToken = response.data.access_token;
    localStorage.setItem('access_token', newToken);
    return newToken;
  } catch (err) {
    console.error('Token refresh failed:', err);
    return null;
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
          refreshSubscribers.push((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;

      if (newToken) {
        onRefreshed(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }

      // Refresh failed — session is truly dead, log out
      console.error('❌ Session expired, logging out');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login?error=session_expired';
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
  // This is a full-page navigation (not an axios call), so the request
  // interceptor's auto-refresh can't help here — we proactively refresh
  // the token first if it's close to expiring, then pass it via query param.
  connect: async () => {
    let token = localStorage.getItem('access_token');

    // Always refresh right before this redirect — cheap and avoids
    // sending a token that's seconds away from expiring.
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const refreshed = await api.post('/auth/refresh', {}, {
          headers: { Authorization: `Bearer ${refreshToken}` },
        });
        if (refreshed.data?.access_token) {
          token = refreshed.data.access_token;
          localStorage.setItem('access_token', token);
        }
      } catch (err) {
        console.error('Could not refresh token before Spotify connect:', err);
      }
    }

    window.location.href = `${API_ROOT}/api/auth/spotify/login?jwt=${encodeURIComponent(token || '')}`;
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

    const token = localStorage.getItem('access_token');

    const response = await axios.post(
      `${API_BASE}/emotion/detect-upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
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
  getRecommendations: async (emotion, language = 'english', limit = 6, excludeIds = [], sort = 'relevance') => {
    const params = { language, limit, sort };
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
    localStorage.setItem('access_token', token);
  } else {
    localStorage.removeItem('access_token');
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
  return !!localStorage.getItem('access_token');
};

export const logout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

export default api;