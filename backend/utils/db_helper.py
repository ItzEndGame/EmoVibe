import os
import time
import bcrypt
import random
import string
from datetime import datetime, timedelta
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from psycopg2 import pool, errors as pg_errors

from config import Config


class DatabaseLockedError(Exception):
    """Kept for compatibility with route code that catches this on registration.
    Postgres handles concurrency natively, so this should rarely fire, but we
    keep the same exception type so callers don't need to change."""
    pass


class DatabaseConnectionError(Exception):
    """Raised when the connection pool can't reach the database after
    retries, e.g. wrong DATABASE_URL, project paused, or a network/DNS
    issue. Distinct from DatabaseLockedError so callers can tell 'can't
    reach the DB at all' apart from 'a query hit a lock/constraint'."""
    pass


class DatabaseHelper:
    """Handles all database operations for EmoTune (PostgreSQL)"""

    _connection_pool = None

    # How many times to retry establishing the pool on startup, and how
    # long to wait between attempts. Covers transient issues (Supabase
    # free-tier project waking up from being paused, a brief network
    # blip) without hanging forever on a genuinely bad connection string.
    CONNECT_MAX_RETRIES = 3
    CONNECT_RETRY_DELAY_SECONDS = 2
    CONNECT_TIMEOUT_SECONDS = 10

    def __init__(self):
        if DatabaseHelper._connection_pool is None:
            DatabaseHelper._connection_pool = self._create_pool_with_retry()
        self.init_database()

    def _create_pool_with_retry(self):
        """Attempt to create the connection pool, retrying transient
        failures with a short backoff. Fails fast (no retry) on errors
        that retrying can't fix, like a missing/invalid DATABASE_URL."""

        if not Config.DATABASE_URL:
            raise DatabaseConnectionError(
                "DATABASE_URL is not set. Check that your .env file exists "
                "and is being loaded (see config.py's load_dotenv() call)."
            )

        last_error = None

        for attempt in range(1, self.CONNECT_MAX_RETRIES + 1):
            try:
                connection_pool = psycopg2.pool.SimpleConnectionPool(
                    1, 10,  # min/max connections
                    dsn=Config.DATABASE_URL,
                    connect_timeout=self.CONNECT_TIMEOUT_SECONDS
                )
                if attempt > 1:
                    print(f"✅ Database connection established on retry {attempt}")
                return connection_pool

            except psycopg2.OperationalError as e:
                last_error = e
                error_msg = str(e).lower()

                # DNS/hostname failures usually mean a bad connection
                # string (e.g. Supabase's IPv6-only direct host on a
                # network without IPv6) rather than something a retry
                # will fix — surface a clear hint immediately.
                if 'could not translate host name' in error_msg or 'name or service not known' in error_msg:
                    raise DatabaseConnectionError(
                        f"Could not resolve the database host in DATABASE_URL. "
                        f"If you're using Supabase, its direct connection host "
                        f"(db.<project-ref>.supabase.co) only resolves over IPv6 — "
                        f"if your network doesn't support IPv6, use the Session "
                        f"Pooler connection string from Supabase's dashboard "
                        f"(Connect button) instead.\nOriginal error: {e}"
                    ) from e

                if attempt < self.CONNECT_MAX_RETRIES:
                    print(f"⚠️ Database connection attempt {attempt} failed: {e}")
                    print(f"   Retrying in {self.CONNECT_RETRY_DELAY_SECONDS}s...")
                    time.sleep(self.CONNECT_RETRY_DELAY_SECONDS)

        raise DatabaseConnectionError(
            f"Could not connect to the database after {self.CONNECT_MAX_RETRIES} attempts. "
            f"Check that DATABASE_URL is correct and the database is running/unpaused.\n"
            f"Original error: {last_error}"
        ) from last_error

    @contextmanager
    def get_connection(self):
        conn = DatabaseHelper._connection_pool.getconn()
        try:
            yield conn
        finally:
            DatabaseHelper._connection_pool.putconn(conn)

    def init_database(self):
        try:
            schema_path = os.path.join(os.path.dirname(__file__), '..', 'database', 'schema.sql')
            with open(schema_path, 'r') as f:
                schema = f.read()
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(schema)
                conn.commit()
            print("✅ Database initialized successfully")
        except Exception as e:
            print(f"❌ Error initializing database: {str(e)}")
            raise

    def _dict_cursor(self, conn):
        return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ==================== USER OPERATIONS ====================

    def create_user(self, name, email, password, preferred_genres=None, auth_provider='email'):
        try:
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        INSERT INTO users (name, email, password_hash, preferred_genres, auth_provider)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id
                    ''', (name, email, password_hash, preferred_genres, auth_provider))
                    user_id = cursor.fetchone()[0]
                conn.commit()
            return user_id
        except pg_errors.UniqueViolation:
            print(f"User with email {email} already exists")
            return None
        except Exception as e:
            print(f"Error creating user: {str(e)}")
            return None

    def create_oauth_user(self, name, email, auth_provider, provider_user_id, profile_picture=None):
        """Create a user who signed up via Google or Spotify (no password)"""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        INSERT INTO users (name, email, password_hash, auth_provider, provider_user_id, profile_picture)
                        VALUES (%s, %s, NULL, %s, %s, %s)
                        RETURNING id
                    ''', (name, email, auth_provider, provider_user_id, profile_picture))
                    user_id = cursor.fetchone()[0]
                conn.commit()
            return user_id
        except pg_errors.UniqueViolation:
            print(f"User with email {email} already exists")
            return None
        except Exception as e:
            print(f"Error creating OAuth user: {str(e)}")
            return None

    def update_user_provider(self, user_id, auth_provider, provider_user_id):
        """Link an OAuth provider to an existing email account"""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        UPDATE users SET auth_provider = %s, provider_user_id = %s WHERE id = %s
                    ''', (auth_provider, provider_user_id, user_id))
                conn.commit()
            return True
        except Exception as e:
            print(f"Error updating user provider: {str(e)}")
            return False

    def get_user_by_email(self, email):
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('SELECT * FROM users WHERE email = %s', (email,))
                    user = cursor.fetchone()
            return dict(user) if user else None
        except Exception as e:
            print(f"Error getting user: {str(e)}")
            return None

    def get_user_by_id(self, user_id):
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))
                    user = cursor.fetchone()
            return dict(user) if user else None
        except Exception as e:
            print(f"Error getting user: {str(e)}")
            return None

    def get_user_by_provider(self, auth_provider, provider_user_id):
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute(
                        'SELECT * FROM users WHERE auth_provider = %s AND provider_user_id = %s',
                        (auth_provider, provider_user_id)
                    )
                    user = cursor.fetchone()
            return dict(user) if user else None
        except Exception as e:
            print(f"Error getting user by provider: {str(e)}")
            return None

    def verify_password(self, email, password):
        user = self.get_user_by_email(email)
        if not user or not user.get('password_hash'):
            return None
        if bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            return user
        return None

    def update_user_profile(self, user_id, name=None, preferred_genres=None, profile_picture=None):
        try:
            updates = []
            params = []
            if name:
                updates.append('name = %s')
                params.append(name)
            if preferred_genres:
                updates.append('preferred_genres = %s')
                params.append(preferred_genres)
            if profile_picture:
                updates.append('profile_picture = %s')
                params.append(profile_picture)
            if not updates:
                return False
            params.append(user_id)
            query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(query, params)
                conn.commit()
            return True
        except Exception as e:
            print(f"Error updating user profile: {str(e)}")
            return False

    def delete_user(self, user_id):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('DELETE FROM users WHERE id = %s', (user_id,))
                conn.commit()
            return True
        except Exception as e:
            print(f"Error deleting user: {str(e)}")
            return False

    # ==================== SPOTIFY TOKEN OPERATIONS ====================

    def save_spotify_tokens(self, user_id, access_token, refresh_token, expires_at, spotify_user_id, is_premium):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        INSERT INTO spotify_tokens
                            (user_id, access_token, refresh_token, expires_at, spotify_user_id, is_premium)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (user_id) DO UPDATE SET
                            access_token = EXCLUDED.access_token,
                            refresh_token = EXCLUDED.refresh_token,
                            expires_at = EXCLUDED.expires_at,
                            spotify_user_id = EXCLUDED.spotify_user_id,
                            is_premium = EXCLUDED.is_premium,
                            updated_at = CURRENT_TIMESTAMP
                    ''', (user_id, access_token, refresh_token, expires_at, spotify_user_id, is_premium))
                conn.commit()
            return True
        except Exception as e:
            print(f"Error saving Spotify tokens: {str(e)}")
            return False

    def get_spotify_tokens(self, user_id):
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('SELECT * FROM spotify_tokens WHERE user_id = %s', (user_id,))
                    tokens = cursor.fetchone()
            return dict(tokens) if tokens else None
        except Exception as e:
            print(f"Error getting Spotify tokens: {str(e)}")
            return None

    def remove_spotify_tokens(self, user_id):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('DELETE FROM spotify_tokens WHERE user_id = %s', (user_id,))
                conn.commit()
            return True
        except Exception as e:
            print(f"Error removing Spotify tokens: {str(e)}")
            return False

    # ==================== LIKED SONGS OPERATIONS ====================

    def add_liked_song(self, user_id, song_title, artist, album_art_url=None,
                       spotify_track_id=None, spotify_preview_url=None,
                       genre=None, emotion_detected=None):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        INSERT INTO liked_songs
                        (user_id, song_title, artist, album_art_url, spotify_track_id,
                         spotify_preview_url, genre, emotion_detected)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    ''', (user_id, song_title, artist, album_art_url, spotify_track_id,
                          spotify_preview_url, genre, emotion_detected))
                    song_id = cursor.fetchone()[0]
                conn.commit()
            return song_id
        except Exception as e:
            print(f"Error adding liked song: {str(e)}")
            return None

    def remove_liked_song(self, user_id, song_id):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('DELETE FROM liked_songs WHERE id = %s AND user_id = %s', (song_id, user_id))
                conn.commit()
            return True
        except Exception as e:
            print(f"Error removing liked song: {str(e)}")
            return False

    def get_liked_songs(self, user_id, limit=None):
        try:
            query = 'SELECT * FROM liked_songs WHERE user_id = %s ORDER BY liked_at DESC'
            params = [user_id]
            if limit:
                query += ' LIMIT %s'
                params.append(limit)
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute(query, params)
                    songs = cursor.fetchall()
            return [dict(song) for song in songs]
        except Exception as e:
            print(f"Error getting liked songs: {str(e)}")
            return []

    def is_song_liked(self, user_id, spotify_track_id):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        SELECT id FROM liked_songs WHERE user_id = %s AND spotify_track_id = %s
                    ''', (user_id, spotify_track_id))
                    result = cursor.fetchone()
            return result is not None
        except Exception as e:
            print(f"Error checking liked song: {str(e)}")
            return False

    # ==================== PASSWORD RESET OPERATIONS ====================

    def generate_reset_code(self):
        return ''.join(random.choices(string.digits, k=Config.RESET_CODE_LENGTH))

    def create_reset_code(self, user_id):
        try:
            code = self.generate_reset_code()
            expires_at = datetime.now() + Config.RESET_CODE_EXPIRY
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        UPDATE password_reset_codes SET is_used = TRUE WHERE user_id = %s AND is_used = FALSE
                    ''', (user_id,))
                    cursor.execute('''
                        INSERT INTO password_reset_codes (user_id, reset_code, expires_at)
                        VALUES (%s, %s, %s)
                    ''', (user_id, code, expires_at))
                conn.commit()
            return code
        except Exception as e:
            print(f"Error creating reset code: {str(e)}")
            return None

    def verify_reset_code(self, email, code):
        try:
            user = self.get_user_by_email(email)
            if not user:
                return False
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('''
                        SELECT * FROM password_reset_codes
                        WHERE user_id = %s AND reset_code = %s AND is_used = FALSE
                    ''', (user['id'], code))
                    reset_record = cursor.fetchone()
            if not reset_record:
                return False
            expires_at = reset_record['expires_at']
            if datetime.now() > expires_at:
                return False
            return True
        except Exception as e:
            print(f"Error verifying reset code: {str(e)}")
            return False

    def reset_password(self, email, code, new_password):
        try:
            if not self.verify_reset_code(email, code):
                return False
            user = self.get_user_by_email(email)
            if not user:
                return False
            password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('UPDATE users SET password_hash = %s WHERE id = %s', (password_hash, user['id']))
                    cursor.execute('''
                        UPDATE password_reset_codes SET is_used = TRUE WHERE user_id = %s AND reset_code = %s
                    ''', (user['id'], code))
                conn.commit()
            return True
        except Exception as e:
            print(f"Error resetting password: {str(e)}")
            return False

    # ==================== EMOTION DETECTIONS ====================

    def log_detection(self, user_id, emotion, method):
        """Record a single emotion detection event. No photo is stored —
        just the emotion, the method used, and the timestamp."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        INSERT INTO emotion_detections (user_id, emotion, method)
                        VALUES (%s, %s, %s)
                        RETURNING id
                    ''', (user_id, emotion, method))
                    detection_id = cursor.fetchone()[0]
                conn.commit()
            return detection_id
        except Exception as e:
            print(f"Error logging detection: {str(e)}")
            return None

    def get_recent_detections(self, user_id, limit=10):
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('''
                        SELECT * FROM emotion_detections
                        WHERE user_id = %s
                        ORDER BY detected_at DESC
                        LIMIT %s
                    ''', (user_id, limit))
                    rows = cursor.fetchall()
            return [dict(r) for r in rows]
        except Exception as e:
            print(f"Error getting recent detections: {str(e)}")
            return []

    def get_favorite_mood(self, user_id):
        """Returns the most frequently detected emotion for this user,
        plus how many times it's been detected. None if no detections yet."""
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('''
                        SELECT emotion, COUNT(*) as count
                        FROM emotion_detections
                        WHERE user_id = %s
                        GROUP BY emotion
                        ORDER BY count DESC
                        LIMIT 1
                    ''', (user_id,))
                    row = cursor.fetchone()
            return dict(row) if row else None
        except Exception as e:
            print(f"Error getting favorite mood: {str(e)}")
            return None

    def get_detection_streak(self, user_id):
        """Counts consecutive days (ending today or yesterday) with at
        least one detection. Returns 0 if today and yesterday both have
        no detections (streak considered broken)."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        SELECT DISTINCT detected_at::date as d
                        FROM emotion_detections
                        WHERE user_id = %s
                        ORDER BY d DESC
                    ''', (user_id,))
                    dates = [row[0] for row in cursor.fetchall()]

            if not dates:
                return 0

            today = datetime.now().date()
            # Streak only counts if the most recent activity was today or yesterday
            if dates[0] != today and dates[0] != today - timedelta(days=1):
                return 0

            streak = 1
            for i in range(1, len(dates)):
                if (dates[i - 1] - dates[i]).days == 1:
                    streak += 1
                else:
                    break
            return streak
        except Exception as e:
            print(f"Error computing detection streak: {str(e)}")
            return 0

    # ==================== USER PLAYLISTS ====================

    def create_playlist(self, user_id, name, description=None, cover_image_url=None):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        INSERT INTO playlists (user_id, name, description, cover_image_url)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                    ''', (user_id, name, description, cover_image_url))
                    playlist_id = cursor.fetchone()[0]
                conn.commit()
            return playlist_id
        except Exception as e:
            print(f"Error creating playlist: {str(e)}")
            return None

    def get_user_playlists(self, user_id):
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('''
                        SELECT p.*,
                               COUNT(ps.id) as song_count
                        FROM playlists p
                        LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
                        WHERE p.user_id = %s
                        GROUP BY p.id
                        ORDER BY p.updated_at DESC
                    ''', (user_id,))
                    rows = cursor.fetchall()
            return [dict(r) for r in rows]
        except Exception as e:
            print(f"Error getting user playlists: {str(e)}")
            return []

    def get_playlist_by_id(self, playlist_id, user_id):
        """Fetches a playlist only if it belongs to the given user."""
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('''
                        SELECT * FROM playlists WHERE id = %s AND user_id = %s
                    ''', (playlist_id, user_id))
                    playlist = cursor.fetchone()
            return dict(playlist) if playlist else None
        except Exception as e:
            print(f"Error getting playlist: {str(e)}")
            return None

    def update_playlist(self, playlist_id, user_id, name=None, description=None, cover_image_url=None):
        try:
            updates = []
            params = []
            if name is not None:
                updates.append('name = %s')
                params.append(name)
            if description is not None:
                updates.append('description = %s')
                params.append(description)
            if cover_image_url is not None:
                updates.append('cover_image_url = %s')
                params.append(cover_image_url)
            if not updates:
                return False
            params.extend([playlist_id, user_id])
            query = f"UPDATE playlists SET {', '.join(updates)} WHERE id = %s AND user_id = %s"
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(query, params)
                    affected = cursor.rowcount
                conn.commit()
            return affected > 0
        except Exception as e:
            print(f"Error updating playlist: {str(e)}")
            return False

    def delete_playlist(self, playlist_id, user_id):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        DELETE FROM playlists WHERE id = %s AND user_id = %s
                    ''', (playlist_id, user_id))
                    affected = cursor.rowcount
                conn.commit()
            return affected > 0
        except Exception as e:
            print(f"Error deleting playlist: {str(e)}")
            return False

    def add_song_to_playlist(self, playlist_id, spotify_track_id, song_title, artist,
                              album_art_url=None, spotify_preview_url=None):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        INSERT INTO playlist_songs
                            (playlist_id, spotify_track_id, song_title, artist, album_art_url, spotify_preview_url)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (playlist_id, spotify_track_id) DO NOTHING
                        RETURNING id
                    ''', (playlist_id, spotify_track_id, song_title, artist, album_art_url, spotify_preview_url))
                    row = cursor.fetchone()
                conn.commit()
            return row[0] if row else None
        except Exception as e:
            print(f"Error adding song to playlist: {str(e)}")
            return None

    def remove_song_from_playlist(self, playlist_id, spotify_track_id):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        DELETE FROM playlist_songs WHERE playlist_id = %s AND spotify_track_id = %s
                    ''', (playlist_id, spotify_track_id))
                    affected = cursor.rowcount
                conn.commit()
            return affected > 0
        except Exception as e:
            print(f"Error removing song from playlist: {str(e)}")
            return False

    def get_playlist_songs(self, playlist_id):
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('''
                        SELECT * FROM playlist_songs
                        WHERE playlist_id = %s
                        ORDER BY added_at ASC
                    ''', (playlist_id,))
                    rows = cursor.fetchall()
            return [dict(r) for r in rows]
        except Exception as e:
            print(f"Error getting playlist songs: {str(e)}")
            return []

    # ==================== MOOD PLAYLISTS (system-generated) ====================

    def get_mood_playlist(self, emotion, language, name):
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('''
                        SELECT * FROM mood_playlists
                        WHERE emotion = %s AND language = %s AND name = %s
                    ''', (emotion, language, name))
                    playlist = cursor.fetchone()
            return dict(playlist) if playlist else None
        except Exception as e:
            print(f"Error getting mood playlist: {str(e)}")
            return None

    def get_mood_playlists_for_emotion(self, emotion, language='english'):
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('''
                        SELECT mp.*, COUNT(mps.id) as song_count
                        FROM mood_playlists mp
                        LEFT JOIN mood_playlist_songs mps ON mp.id = mps.mood_playlist_id
                        WHERE mp.emotion = %s AND mp.language = %s
                        GROUP BY mp.id
                        ORDER BY mp.name ASC
                    ''', (emotion, language))
                    rows = cursor.fetchall()
            return [dict(r) for r in rows]
        except Exception as e:
            print(f"Error getting mood playlists: {str(e)}")
            return []

    def create_or_refresh_mood_playlist(self, emotion, language, name, description, songs):
        """
        Creates a mood playlist if it doesn't exist, or replaces its songs
        if it does (full refresh, not incremental). `songs` is a list of
        dicts with keys: spotify_track_id, song_title, artist,
        album_art_url, spotify_preview_url.
        """
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        INSERT INTO mood_playlists (emotion, language, name, description, refreshed_at)
                        VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                        ON CONFLICT (emotion, language, name) DO UPDATE SET
                            description = EXCLUDED.description,
                            refreshed_at = CURRENT_TIMESTAMP
                        RETURNING id
                    ''', (emotion, language, name, description))
                    playlist_id = cursor.fetchone()[0]

                    # Full refresh: clear old songs, insert the new snapshot
                    cursor.execute('DELETE FROM mood_playlist_songs WHERE mood_playlist_id = %s', (playlist_id,))

                    for position, song in enumerate(songs):
                        cursor.execute('''
                            INSERT INTO mood_playlist_songs
                                (mood_playlist_id, spotify_track_id, song_title, artist,
                                 album_art_url, spotify_preview_url, position)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (mood_playlist_id, spotify_track_id) DO NOTHING
                        ''', (playlist_id, song['spotify_track_id'], song['song_title'], song['artist'],
                              song.get('album_art_url'), song.get('spotify_preview_url'), position))
                conn.commit()
            return playlist_id
        except Exception as e:
            print(f"Error creating/refreshing mood playlist: {str(e)}")
            return None

    def get_mood_playlist_songs(self, mood_playlist_id):
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('''
                        SELECT * FROM mood_playlist_songs
                        WHERE mood_playlist_id = %s
                        ORDER BY position ASC
                    ''', (mood_playlist_id,))
                    rows = cursor.fetchall()
            return [dict(r) for r in rows]
        except Exception as e:
            print(f"Error getting mood playlist songs: {str(e)}")
            return []

    # ==================== LISTENING SESSIONS ====================

    def log_listening_session(self, user_id, spotify_track_id, duration_seconds, is_estimated=True):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        INSERT INTO listening_sessions (user_id, spotify_track_id, duration_seconds, is_estimated)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                    ''', (user_id, spotify_track_id, duration_seconds, is_estimated))
                    session_id = cursor.fetchone()[0]
                conn.commit()
            return session_id
        except Exception as e:
            print(f"Error logging listening session: {str(e)}")
            return None

    def get_listening_stats(self, user_id):
        """Returns total seconds listened and total sessions (~= songs played)."""
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('''
                        SELECT
                            COALESCE(SUM(duration_seconds), 0) as total_seconds,
                            COUNT(*) as total_sessions
                        FROM listening_sessions
                        WHERE user_id = %s
                    ''', (user_id,))
                    row = cursor.fetchone()
            return dict(row) if row else {'total_seconds': 0, 'total_sessions': 0}
        except Exception as e:
            print(f"Error getting listening stats: {str(e)}")
            return {'total_seconds': 0, 'total_sessions': 0}

    # ==================== USER PREFERENCES ====================

    def get_user_preferences(self, user_id):
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('SELECT * FROM user_preferences WHERE user_id = %s', (user_id,))
                    prefs = cursor.fetchone()

                    if not prefs:
                        # Create a default row on first access so callers
                        # always get a usable preferences object back.
                        cursor.execute('''
                            INSERT INTO user_preferences (user_id) VALUES (%s)
                            ON CONFLICT (user_id) DO NOTHING
                            RETURNING *
                        ''', (user_id,))
                        prefs = cursor.fetchone()
                conn.commit()
            return dict(prefs) if prefs else None
        except Exception as e:
            print(f"Error getting user preferences: {str(e)}")
            return None

    def update_user_preferences(self, user_id, **kwargs):
        """Accepts any of: default_emotion, explicit_content, autoplay, language, theme"""
        allowed_fields = {'default_emotion', 'explicit_content', 'autoplay', 'language', 'theme'}
        updates = []
        params = []
        for key, value in kwargs.items():
            if key in allowed_fields and value is not None:
                updates.append(f'{key} = %s')
                params.append(value)

        if not updates:
            return False

        try:
            # Ensure a row exists first (in case preferences were never read/created)
            self.get_user_preferences(user_id)

            params.append(user_id)
            query = f"UPDATE user_preferences SET {', '.join(updates)} WHERE user_id = %s"
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(query, params)
                conn.commit()
            return True
        except Exception as e:
            print(f"Error updating user preferences: {str(e)}")
            return False

    # ==================== STATISTICS ====================

    def get_user_statistics(self, user_id):
        """
        Returns a combined stats object for Profile/Dashboard:
        - total_liked_songs, emotions_explored, last_activity (from the view)
        - total_detections, total_seconds_listened (from the view)
        - favorite_mood (emotion + count, from emotion_detections)
        - day_streak (consecutive days with at least one detection)
        - total_songs_played (count of listening sessions)
        """
        try:
            with self.get_connection() as conn:
                with self._dict_cursor(conn) as cursor:
                    cursor.execute('SELECT * FROM user_statistics WHERE id = %s', (user_id,))
                    stats = cursor.fetchone()

            if not stats:
                return None

            stats = dict(stats)
            stats['favorite_mood'] = self.get_favorite_mood(user_id)
            stats['day_streak'] = self.get_detection_streak(user_id)

            listening = self.get_listening_stats(user_id)
            stats['total_songs_played'] = listening['total_sessions']
            # total_seconds_listened already comes from the view, but the
            # view's join can double count if a user has many liked songs
            # AND many sessions; recomputing directly here is safer.
            stats['total_seconds_listened'] = listening['total_seconds']

            return stats
        except Exception as e:
            print(f"Error getting user statistics: {str(e)}")
            return None