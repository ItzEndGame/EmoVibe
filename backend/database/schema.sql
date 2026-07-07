-- EmoTune Database Schema (PostgreSQL)

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,                         -- NULL for OAuth users
    auth_provider TEXT DEFAULT 'email',         -- 'email', 'google', 'spotify'
    provider_user_id TEXT,                      -- Google/Spotify user ID
    profile_picture TEXT DEFAULT 'default_avatar.png',
    preferred_genres TEXT,                      -- Comma-separated genre list
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Spotify OAuth Tokens Table (user-level tokens for playback)
CREATE TABLE IF NOT EXISTS spotify_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    spotify_user_id TEXT,
    is_premium BOOLEAN DEFAULT FALSE,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Liked Songs Table
CREATE TABLE IF NOT EXISTS liked_songs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    song_title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album_art_url TEXT,
    spotify_track_id TEXT,
    spotify_preview_url TEXT,
    genre TEXT,
    emotion_detected TEXT,
    liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password Reset Codes Table
CREATE TABLE IF NOT EXISTS password_reset_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reset_code TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE
);

-- Session Tokens Table (for token blacklisting)
CREATE TABLE IF NOT EXISTS session_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_jti TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE
);

-- ==================== UI REDESIGN ADDITIONS ====================

-- Emotion Detections Table
-- Logs every detection event (no photo stored, just metadata) so the
-- Dashboard's "Recent Detections", the History page, and Profile's
-- "Total Detections" / "Favorite Mood" all have real data to read from.
CREATE TABLE IF NOT EXISTS emotion_detections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emotion TEXT NOT NULL,                  -- matches model labels: happy, sad, angry, neutral, surprise, fear, disgust
    method TEXT NOT NULL,                   -- 'live_photo', 'upload_photo', 'select_emotion'
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User-Created Playlists Table
CREATE TABLE IF NOT EXISTS playlists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Songs within a user-created playlist
CREATE TABLE IF NOT EXISTS playlist_songs (
    id SERIAL PRIMARY KEY,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    spotify_track_id TEXT NOT NULL,
    song_title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album_art_url TEXT,
    spotify_preview_url TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(playlist_id, spotify_track_id)   -- no duplicate song within the same playlist
);

-- System-Generated Mood Playlists (cached snapshots)
-- Generated from EMOTION_GENRE_MAP via the same Spotify search used for
-- recommendations, then snapshotted here so "Peaceful Piano" shows the
-- same songs each time it's opened instead of re-randomizing on every
-- visit. Regenerated periodically (e.g. via a refreshed_at staleness
-- check) rather than on every single read.
CREATE TABLE IF NOT EXISTS mood_playlists (
    id SERIAL PRIMARY KEY,
    emotion TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'english',
    name TEXT NOT NULL,                     -- e.g. "Peaceful Piano", "Lo-Fi Chill"
    description TEXT,
    cover_image_url TEXT,
    refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(emotion, language, name)
);

-- Songs within a system-generated mood playlist
CREATE TABLE IF NOT EXISTS mood_playlist_songs (
    id SERIAL PRIMARY KEY,
    mood_playlist_id INTEGER NOT NULL REFERENCES mood_playlists(id) ON DELETE CASCADE,
    spotify_track_id TEXT NOT NULL,
    song_title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album_art_url TEXT,
    spotify_preview_url TEXT,
    position INTEGER DEFAULT 0,             -- preserves track order within the playlist
    UNIQUE(mood_playlist_id, spotify_track_id)
);

-- Listening Sessions Table
-- Powers "Time Listened", "Songs Played", and "Day Streak".
-- is_estimated = TRUE for heartbeat/visibility-based guesses (Free users,
-- no real playback telemetry available from the Spotify embed).
-- is_estimated = FALSE for real Web Playback SDK events (Premium-connected
-- users only — that's the only path with genuine playback telemetry).
CREATE TABLE IF NOT EXISTS listening_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spotify_track_id TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    is_estimated BOOLEAN NOT NULL DEFAULT TRUE,
    session_date DATE DEFAULT CURRENT_DATE, -- used directly for day-streak calculation
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Preferences Table
-- One row per user. No membership/premium fields — that system was
-- removed from scope; Spotify Premium status already lives in
-- spotify_tokens.is_premium and is unrelated to any app-level paywall.
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_emotion TEXT,                   -- e.g. 'happy' — used to pre-select on Dashboard
    explicit_content BOOLEAN DEFAULT FALSE,
    autoplay BOOLEAN DEFAULT TRUE,
    language TEXT DEFAULT 'english',
    theme TEXT DEFAULT 'dark',               -- 'dark' | 'light', in case Appearance settings need it later
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(auth_provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_spotify_tokens_user ON spotify_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_liked_songs_user_id ON liked_songs(user_id);
CREATE INDEX IF NOT EXISTS idx_liked_songs_spotify_id ON liked_songs(spotify_track_id);
CREATE INDEX IF NOT EXISTS idx_reset_codes_user_id ON password_reset_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_codes_code ON password_reset_codes(reset_code);
CREATE INDEX IF NOT EXISTS idx_session_tokens_jti ON session_tokens(token_jti);

CREATE INDEX IF NOT EXISTS idx_detections_user_id ON emotion_detections(user_id);
CREATE INDEX IF NOT EXISTS idx_detections_user_emotion ON emotion_detections(user_id, emotion);
CREATE INDEX IF NOT EXISTS idx_detections_detected_at ON emotion_detections(detected_at);

CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist_id ON playlist_songs(playlist_id);

CREATE INDEX IF NOT EXISTS idx_mood_playlists_emotion_lang ON mood_playlists(emotion, language);
CREATE INDEX IF NOT EXISTS idx_mood_playlist_songs_playlist_id ON mood_playlist_songs(mood_playlist_id);

CREATE INDEX IF NOT EXISTS idx_listening_sessions_user_id ON listening_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_listening_sessions_user_date ON listening_sessions(user_id, session_date);

-- Function + Trigger to auto-update updated_at on users
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_timestamp ON users;
CREATE TRIGGER update_user_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_spotify_token_timestamp ON spotify_tokens;
CREATE TRIGGER update_spotify_token_timestamp
BEFORE UPDATE ON spotify_tokens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_playlist_timestamp ON playlists;
CREATE TRIGGER update_playlist_timestamp
BEFORE UPDATE ON playlists
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_preferences_timestamp ON user_preferences;
CREATE TRIGGER update_preferences_timestamp
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- View to get user statistics
-- Powers Profile's "Your Music Journey" cards and Dashboard summaries.
-- Day streak is computed separately in application code (see stats route)
-- since consecutive-day-gap logic isn't clean to express in a single SQL
-- view across arbitrary date ranges — this view covers the simpler counts.
CREATE OR REPLACE VIEW user_statistics AS
SELECT
    u.id,
    u.name,
    u.email,
    u.auth_provider,
    COUNT(DISTINCT ls.id) as total_liked_songs,
    COUNT(DISTINCT ls.emotion_detected) as emotions_explored,
    MAX(ls.liked_at) as last_activity,
    COUNT(DISTINCT ed.id) as total_detections,
    COUNT(DISTINCT lsess.id) as total_listening_sessions,
    COALESCE(SUM(lsess.duration_seconds), 0) as total_seconds_listened
FROM users u
LEFT JOIN liked_songs ls ON u.id = ls.user_id
LEFT JOIN emotion_detections ed ON u.id = ed.user_id
LEFT JOIN listening_sessions lsess ON u.id = lsess.user_id
GROUP BY u.id;