from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from utils.db_helper import DatabaseHelper
from config import Config
import random
from datetime import datetime

music_bp = Blueprint('music', __name__, url_prefix='/api/music')
db = DatabaseHelper()

# Mood/keyword terms to mix into search queries per emotion.
# Spotify's /recommendations endpoint is deprecated for new apps (returns 404),
# so we use the Search API with genre + mood keywords instead, then shuffle
# and sample from a larger pool so results vary between calls.
EMOTION_SEARCH_TERMS = {
    'happy': ['feel good', 'upbeat', 'good vibes', 'sunshine'],
    'sad': ['heartbreak', 'melancholy', 'rainy day', 'emotional'],
    'angry': ['rage', 'aggressive', 'intense', 'hard'],
    'neutral': ['relax', 'background', 'study', 'easy listening'],
    'surprise': ['energetic', 'hype', 'party starter'],
    'fear': ['calming', 'soothing', 'peaceful'],
    'disgust': ['edgy', 'raw', 'rebellious'],
    'excited': ['party', 'hype', 'pump up', 'energetic']
}

# Named, system-generated mood playlists per emotion. Each one maps to a
# specific search query, distinct from the general recommendation pool,
# so "Peaceful Piano" reliably sounds like its name rather than just
# being "happy music, batch #3". These get snapshotted into the
# mood_playlists / mood_playlist_songs tables rather than re-generated
# live on every request.
MOOD_PLAYLIST_DEFINITIONS = {
    'happy': [
        {'name': 'Uplifting Pop', 'query': 'genre:pop feel good upbeat', 'description': 'Feel good pop songs to lift your mood.'},
        {'name': 'Morning Acoustic', 'query': 'genre:acoustic morning sunshine', 'description': 'Acoustic songs for a beautiful morning.'},
    ],
    'sad': [
        {'name': 'Lo-Fi Chill', 'query': 'genre:lo-fi chill study', 'description': 'Lo-fi beats to chill, study and unwind.'},
        {'name': 'Rainy Day Vibes', 'query': 'genre:indie rainy day melancholy', 'description': 'Perfect tracks for rainy day feels.'},
    ],
    'angry': [
        {'name': 'Energy Booster', 'query': 'genre:rock intense hard', 'description': 'High energy tracks to burn it off.'},
    ],
    'neutral': [
        {'name': 'Deep Focus', 'query': 'genre:ambient instrumental study', 'description': 'Instrumentals to help you focus better.'},
        {'name': 'Nature Escape', 'query': 'genre:chill nature acoustic', 'description': 'Feel the nature, refresh your soul.'},
    ],
    'surprise': [
        {'name': 'Vibe Escape', 'query': 'genre:electronic energetic hype', 'description': 'High energy tracks to match the moment.'},
    ],
    'fear': [
        {'name': 'Calm Your Mind', 'query': 'genre:classical calming soothing', 'description': 'Calming tracks to ease your mind.'},
    ],
    'disgust': [
        {'name': 'Reset & Relax', 'query': 'genre:alternative chill', 'description': 'Reset and relax with these tracks.'},
    ],
    'excited': [
        {'name': 'Starry Nights', 'query': 'genre:dance energetic party', 'description': 'Chill under the stars with these tunes.'},
    ],
}

# Initialize Spotify client
def get_spotify_client():
    """Get authenticated Spotify client"""
    try:
        client_credentials_manager = SpotifyClientCredentials(
            client_id=Config.SPOTIFY_CLIENT_ID,
            client_secret=Config.SPOTIFY_CLIENT_SECRET
        )
        sp = spotipy.Spotify(
            client_credentials_manager=client_credentials_manager,
            requests_timeout=10
        )
        return sp
    except Exception as e:
        print(f"Error creating Spotify client: {str(e)}")
        return None

@music_bp.route('/recommendations/<emotion>', methods=['GET'])
@jwt_required()
def get_recommendations(emotion):
    """
    Get music recommendations based on detected emotion.

    Uses Spotify's Search API (genre + mood keywords) rather than the
    deprecated /recommendations endpoint, which returns 404 for apps
    created after Nov 2024.

    Query Parameters:
        - language: Language/market code (default: english)
        - limit: Number of tracks to return (default: 6, max: 20)
        - exclude_ids: Comma-separated Spotify track IDs to exclude
          (used for "Show More" pagination so already-shown tracks
          don't repeat)
        - sort: How to order results (default: relevance)
            - 'relevance': weighted random sample, biased toward more
              popular tracks but still varied call-to-call (default)
            - 'popularity': strict descending sort by Spotify popularity
            - 'random': pure random shuffle, no popularity weighting

    Example: /api/music/recommendations/happy?language=hindi&limit=8
    Example (load more): /api/music/recommendations/happy?limit=8&exclude_ids=abc123,def456
    Example (strict popularity): /api/music/recommendations/happy?sort=popularity
    """
    try:
        current_user_id = get_jwt_identity()

        # Get query parameters
        language = request.args.get('language', 'english').lower()
        limit = min(int(request.args.get('limit', 6)), 20)
        sort_mode = request.args.get('sort', 'relevance').lower()
        if sort_mode not in ('relevance', 'popularity', 'random'):
            sort_mode = 'relevance'

        exclude_ids_param = request.args.get('exclude_ids', '')
        exclude_ids = set(x.strip() for x in exclude_ids_param.split(',') if x.strip())

        # Validate emotion
        emotion = emotion.lower()
        if emotion not in Config.EMOTION_GENRE_MAP:
            return jsonify({
                'success': False,
                'message': f'Invalid emotion. Valid emotions: {list(Config.EMOTION_GENRE_MAP.keys())}'
            }), 400

        # Get market code for language
        market = Config.LANGUAGE_MARKET_MAP.get(language, 'US')

        # Get genres for emotion — use the language-specific override if one
        # exists (e.g. Hindi -> bollywood/desi genre tags), otherwise fall
        # back to the default English-language genre tags.
        language_overrides = Config.LANGUAGE_GENRE_OVERRIDES.get(language, {})
        genres = language_overrides.get(emotion, Config.EMOTION_GENRE_MAP[emotion])

        # English mood keywords ("upbeat", "feel good") only make sense
        # mixed into English-language searches. For other languages they'd
        # just bias results back toward English tracks, so skip them.
        mood_terms = EMOTION_SEARCH_TERMS.get(emotion, []) if language == 'english' else []

        # Get Spotify client
        sp = get_spotify_client()
        if not sp:
            return jsonify({
                'success': False,
                'message': 'Failed to connect to Spotify'
            }), 500

        try:
            # Build a pool of tracks across genre+mood query combinations,
            # then filter, dedupe, shuffle and sample so repeated calls
            # (including "Show More" pagination) don't repeat tracks
            # already seen by the user.
            track_pool = {}      # keyed by track id
            seen_signatures = set()  # keyed by normalized "title|artist" to catch
                                      # different Spotify IDs for the same song
                                      # (e.g. album version vs remaster vs single)

            # Use all 4 mapped genres (previously only the first 3) to widen
            # the pool, which matters more now that we're excluding seen tracks.
            queries_to_run = []
            for genre in genres:
                term = random.choice(mood_terms) if mood_terms else ''
                queries_to_run.append(f'genre:{genre} {term}'.strip())

            # If this is a "Show More" request (exclude_ids present), search
            # with a larger offset range so we're more likely to land on
            # tracks outside what's already been shown.
            offset_max = 50 if exclude_ids else 30

            def run_search(query):
                return sp.search(
                    q=query,
                    type='track',
                    limit=20,
                    market=market,
                    offset=random.randint(0, offset_max)
                )

            for query in queries_to_run:
                try:
                    results = run_search(query)
                    items = results['tracks']['items']

                    # Some genre tags (especially the regional/non-English
                    # ones above) aren't part of Spotify's strict internal
                    # genre taxonomy and can return zero results with the
                    # `genre:` filter. Fall back to a plain keyword search
                    # using the same term — Spotify's free-text search still
                    # matches genre/style words against track and artist
                    # metadata even without the filter syntax.
                    if not items:
                        plain_query = query.replace('genre:', '').strip()
                        results = run_search(plain_query)
                        items = results['tracks']['items']

                    for track in items:
                        if not track or not track.get('id'):
                            continue
                        if track['id'] in exclude_ids:
                            continue

                        signature = (
                            track['name'].strip().lower(),
                            ', '.join(sorted(a['name'].strip().lower() for a in track['artists']))
                        )
                        if signature in seen_signatures:
                            continue  # same song, different Spotify ID — skip

                        seen_signatures.add(signature)
                        track_pool[track['id']] = track
                except Exception as search_err:
                    print(f"Search failed for query '{query}': {str(search_err)}")
                    continue

            if not track_pool:
                return jsonify({
                    'success': False,
                    'message': 'No new tracks found. Try a different emotion or check back later.'
                }), 404

            # Order the pool according to the requested sort mode, then
            # take the top `limit` tracks.
            pool_list = list(track_pool.values())

            if sort_mode == 'popularity':
                # Strict descending sort by Spotify's popularity score (0-100)
                pool_list.sort(key=lambda t: t.get('popularity', 0), reverse=True)
                selected = pool_list[:limit]

            elif sort_mode == 'random':
                # Pure random shuffle, no popularity weighting at all
                random.shuffle(pool_list)
                selected = pool_list[:limit]

            else:  # 'relevance' (default)
                # Weighted random sample: more popular tracks are more
                # likely to be picked, but it's not a strict popularity
                # sort, so the same query can still surface different
                # results call-to-call instead of always showing the
                # exact same "top" tracks.
                weights = [max(t.get('popularity', 0), 1) for t in pool_list]  # avoid zero-weight
                pool_size = min(limit, len(pool_list))

                selected = []
                remaining_tracks = pool_list[:]
                remaining_weights = weights[:]

                for _ in range(pool_size):
                    chosen = random.choices(remaining_tracks, weights=remaining_weights, k=1)[0]
                    idx = remaining_tracks.index(chosen)
                    selected.append(remaining_tracks.pop(idx))
                    remaining_weights.pop(idx)

            tracks = []
            for track in selected:
                track_data = {
                    'id': track['id'],
                    'title': track['name'],
                    'artist': ', '.join([artist['name'] for artist in track['artists']]),
                    'album': track['album']['name'],
                    'album_art': track['album']['images'][0]['url'] if track['album']['images'] else None,
                    'preview_url': track['preview_url'],
                    'external_url': track['external_urls']['spotify'],
                    'duration_ms': track['duration_ms'],
                    'popularity': track['popularity']
                }
                tracks.append(track_data)

            return jsonify({
                'success': True,
                'emotion': emotion,
                'language': language,
                'market': market,
                'tracks': tracks,
                'total': len(tracks),
                'genres_used': genres,
                'sort': sort_mode,
                'has_more': len(pool_list) > limit  # hint for frontend whether more might be available right now
            }), 200

        except Exception as e:
            print(f"Spotify API error: {str(e)}")
            return jsonify({
                'success': False,
                'message': 'Failed to fetch recommendations from Spotify'
            }), 500

    except Exception as e:
        print(f"Error in get_recommendations: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@music_bp.route('/like', methods=['POST'])
@jwt_required()
def like_song():
    """
    Like/save a song to user's collection
    
    Expected JSON:
    {
        "song_title": "Song Name",
        "artist": "Artist Name",
        "album_art_url": "https://...",
        "spotify_track_id": "spotify_id",
        "spotify_preview_url": "https://...",
        "genre": "pop",
        "emotion_detected": "happy"
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        if not data.get('song_title') or not data.get('artist'):
            return jsonify({
                'success': False,
                'message': 'Song title and artist are required'
            }), 400
        
        # Check if song is already liked
        if data.get('spotify_track_id'):
            if db.is_song_liked(current_user_id, data['spotify_track_id']):
                return jsonify({
                    'success': False,
                    'message': 'Song is already in your liked songs'
                }), 409
        
        # Add to liked songs
        song_id = db.add_liked_song(
            user_id=current_user_id,
            song_title=data['song_title'],
            artist=data['artist'],
            album_art_url=data.get('album_art_url'),
            spotify_track_id=data.get('spotify_track_id'),
            spotify_preview_url=data.get('spotify_preview_url'),
            genre=data.get('genre'),
            emotion_detected=data.get('emotion_detected')
        )
        
        if not song_id:
            return jsonify({
                'success': False,
                'message': 'Failed to add song to liked songs'
            }), 500
        
        return jsonify({
            'success': True,
            'message': 'Song added to liked songs',
            'song_id': song_id
        }), 201
        
    except Exception as e:
        print(f"Error in like_song: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@music_bp.route('/unlike/<int:song_id>', methods=['DELETE'])
@jwt_required()
def unlike_song(song_id):
    """
    Unlike/remove a song from user's collection
    """
    try:
        current_user_id = get_jwt_identity()
        
        # Remove from liked songs
        success = db.remove_liked_song(current_user_id, song_id)
        
        if not success:
            return jsonify({
                'success': False,
                'message': 'Failed to remove song from liked songs'
            }), 500
        
        return jsonify({
            'success': True,
            'message': 'Song removed from liked songs'
        }), 200
        
    except Exception as e:
        print(f"Error in unlike_song: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@music_bp.route('/liked', methods=['GET'])
@jwt_required()
def get_liked_songs():
    """
    Get all liked songs for the current user
    
    Query Parameters:
        - limit: Number of songs to return (optional)
        - emotion: Filter by emotion (optional)
    """
    try:
        current_user_id = get_jwt_identity()
        
        # Get query parameters
        limit = request.args.get('limit', type=int)
        emotion_filter = request.args.get('emotion')
        
        # Get liked songs
        liked_songs = db.get_liked_songs(current_user_id, limit)
        
        # Filter by emotion if specified
        if emotion_filter:
            emotion_filter = emotion_filter.lower()
            liked_songs = [
                song for song in liked_songs 
                if song.get('emotion_detected', '').lower() == emotion_filter
            ]
        
        return jsonify({
            'success': True,
            'liked_songs': liked_songs,
            'total': len(liked_songs)
        }), 200
        
    except Exception as e:
        print(f"Error in get_liked_songs: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@music_bp.route('/search', methods=['GET'])
@jwt_required()
def search_tracks():
    """
    Search for tracks on Spotify
    
    Query Parameters:
        - q: Search query (required)
        - limit: Number of results (default: 10, max: 50)
        - market: Market/country code (default: US)
    """
    try:
        current_user_id = get_jwt_identity()
        
        # Get query parameters
        query = request.args.get('q')
        if not query:
            return jsonify({
                'success': False,
                'message': 'Search query is required'
            }), 400
        
        limit = min(int(request.args.get('limit', 10)), 50)
        market = request.args.get('market', 'US')
        
        # Get Spotify client
        sp = get_spotify_client()
        if not sp:
            return jsonify({
                'success': False,
                'message': 'Failed to connect to Spotify'
            }), 500
        
        # Search tracks
        try:
            results = sp.search(q=query, type='track', limit=limit, market=market)
            
            tracks = []
            for track in results['tracks']['items']:
                track_data = {
                    'id': track['id'],
                    'title': track['name'],
                    'artist': ', '.join([artist['name'] for artist in track['artists']]),
                    'album': track['album']['name'],
                    'album_art': track['album']['images'][0]['url'] if track['album']['images'] else None,
                    'preview_url': track['preview_url'],
                    'external_url': track['external_urls']['spotify'],
                    'duration_ms': track['duration_ms'],
                    'popularity': track['popularity']
                }
                tracks.append(track_data)
            
            return jsonify({
                'success': True,
                'query': query,
                'tracks': tracks,
                'total': len(tracks)
            }), 200
            
        except Exception as e:
            print(f"Spotify search error: {str(e)}")
            return jsonify({
                'success': False,
                'message': 'Failed to search tracks on Spotify'
            }), 500
        
    except Exception as e:
        print(f"Error in search_tracks: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@music_bp.route('/track/<track_id>', methods=['GET'])
@jwt_required()
def get_track_details(track_id):
    """
    Get detailed information about a specific track
    """
    try:
        current_user_id = get_jwt_identity()
        
        # Get Spotify client
        sp = get_spotify_client()
        if not sp:
            return jsonify({
                'success': False,
                'message': 'Failed to connect to Spotify'
            }), 500
        
        try:
            # Get track details
            track = sp.track(track_id)
            
            # Get audio features
            audio_features = sp.audio_features([track_id])[0]
            
            track_data = {
                'id': track['id'],
                'title': track['name'],
                'artist': ', '.join([artist['name'] for artist in track['artists']]),
                'album': track['album']['name'],
                'album_art': track['album']['images'][0]['url'] if track['album']['images'] else None,
                'preview_url': track['preview_url'],
                'external_url': track['external_urls']['spotify'],
                'duration_ms': track['duration_ms'],
                'popularity': track['popularity'],
                'release_date': track['album']['release_date'],
                'audio_features': {
                    'danceability': audio_features['danceability'] if audio_features else None,
                    'energy': audio_features['energy'] if audio_features else None,
                    'valence': audio_features['valence'] if audio_features else None,
                    'tempo': audio_features['tempo'] if audio_features else None
                }
            }
            
            return jsonify({
                'success': True,
                'track': track_data
            }), 200
            
        except Exception as e:
            print(f"Spotify API error: {str(e)}")
            return jsonify({
                'success': False,
                'message': 'Failed to fetch track details from Spotify'
            }), 500
        
    except Exception as e:
        print(f"Error in get_track_details: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@music_bp.route('/genres', methods=['GET'])
def get_available_genres():
    """
    Get list of available genres from Spotify
    No authentication required
    """
    try:
        # Get Spotify client
        sp = get_spotify_client()
        if not sp:
            return jsonify({
                'success': False,
                'message': 'Failed to connect to Spotify'
            }), 500
        
        try:
            # Get available genre seeds
            genres = sp.recommendation_genre_seeds()
            
            return jsonify({
                'success': True,
                'genres': genres['genres'],
                'total': len(genres['genres'])
            }), 200
            
        except Exception as e:
            print(f"Spotify API error: {str(e)}")
            return jsonify({
                'success': False,
                'message': 'Failed to fetch genres from Spotify'
            }), 500
        
    except Exception as e:
        print(f"Error in get_available_genres: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@music_bp.route('/test', methods=['GET'])
def test_spotify_connection():
    """
    Test Spotify API connection
    No authentication required
    """
    try:
        sp = get_spotify_client()
        
        if not sp:
            return jsonify({
                'success': False,
                'message': 'Failed to create Spotify client. Check your credentials.',
                'spotify_configured': False
            }), 500
        
        # Try a simple API call
        try:
            genres = sp.recommendation_genre_seeds()
            
            return jsonify({
                'success': True,
                'message': 'Spotify API connection successful',
                'spotify_configured': True,
                'available_genres_count': len(genres['genres']),
                'emotion_genre_mapping': Config.EMOTION_GENRE_MAP,
                'supported_languages': list(Config.LANGUAGE_MARKET_MAP.keys())
            }), 200
            
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'Spotify API error: {str(e)}',
                'spotify_configured': False
            }), 500
        
    except Exception as e:
        print(f"Error in test_spotify_connection: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500


# ==================== MOOD PLAYLISTS (system-generated) ====================

def _generate_mood_playlist_songs(query, market, limit=15):
    """Runs a single targeted search query and returns up to `limit`
    tracks formatted for storage in mood_playlist_songs."""
    sp = get_spotify_client()
    if not sp:
        return []

    try:
        results = sp.search(q=query, type='track', limit=limit, market=market)
        songs = []
        for track in results['tracks']['items']:
            if not track or not track.get('id'):
                continue
            songs.append({
                'spotify_track_id': track['id'],
                'song_title': track['name'],
                'artist': ', '.join(a['name'] for a in track['artists']),
                'album_art_url': track['album']['images'][0]['url'] if track['album']['images'] else None,
                'spotify_preview_url': track['preview_url'],
            })
        return songs
    except Exception as e:
        print(f"Mood playlist search failed for query '{query}': {str(e)}")
        return []


@music_bp.route('/mood-playlists/<emotion>', methods=['GET'])
@jwt_required()
def get_mood_playlists(emotion):
    """
    Get the system-generated mood playlists for an emotion (e.g. "Peaceful
    Piano", "Lo-Fi Chill"). If they don't exist yet or are stale, generates
    and snapshots them via Spotify search first.

    Query Parameters:
        - language: Language/market code (default: english)
        - max_age_days: How old a cached playlist can be before it's
          regenerated (default: 7)
    """
    try:
        emotion = emotion.lower()
        if emotion not in Config.EMOTION_GENRE_MAP:
            return jsonify({
                'success': False,
                'message': f'Invalid emotion. Valid emotions: {list(Config.EMOTION_GENRE_MAP.keys())}'
            }), 400

        language = request.args.get('language', 'english').lower()
        max_age_days = int(request.args.get('max_age_days', 7))
        market = Config.LANGUAGE_MARKET_MAP.get(language, 'US')

        definitions = MOOD_PLAYLIST_DEFINITIONS.get(emotion, [])
        if not definitions:
            return jsonify({'success': True, 'playlists': [], 'total': 0}), 200

        result_playlists = []

        for definition in definitions:
            existing = db.get_mood_playlist(emotion, language, definition['name'])

            needs_refresh = True
            if existing:
                refreshed_at = existing['refreshed_at']
                age_days = (datetime.now() - refreshed_at).days
                if age_days < max_age_days:
                    needs_refresh = False

            if needs_refresh:
                songs = _generate_mood_playlist_songs(definition['query'], market)
                if songs:
                    playlist_id = db.create_or_refresh_mood_playlist(
                        emotion=emotion,
                        language=language,
                        name=definition['name'],
                        description=definition['description'],
                        songs=songs
                    )
                else:
                    # Search failed/empty — fall back to whatever was
                    # cached before, if anything, rather than showing nothing.
                    playlist_id = existing['id'] if existing else None
            else:
                playlist_id = existing['id']

            if not playlist_id:
                continue

            song_count_songs = db.get_mood_playlist_songs(playlist_id)
            result_playlists.append({
                'id': playlist_id,
                'name': definition['name'],
                'description': definition['description'],
                'emotion': emotion,
                'language': language,
                'song_count': len(song_count_songs),
                'cover_image_url': song_count_songs[0]['album_art_url'] if song_count_songs else None,
            })

        return jsonify({
            'success': True,
            'playlists': result_playlists,
            'total': len(result_playlists)
        }), 200

    except Exception as e:
        print(f"Error in get_mood_playlists: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@music_bp.route('/mood-playlists/detail/<int:mood_playlist_id>', methods=['GET'])
@jwt_required()
def get_mood_playlist_detail(mood_playlist_id):
    """Get the full song list for a specific mood playlist."""
    try:
        songs = db.get_mood_playlist_songs(mood_playlist_id)

        if not songs:
            return jsonify({'success': False, 'message': 'Mood playlist not found or empty'}), 404

        return jsonify({
            'success': True,
            'songs': songs,
            'total': len(songs)
        }), 200

    except Exception as e:
        print(f"Error in get_mood_playlist_detail: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


# ==================== LISTENING SESSIONS ====================

@music_bp.route('/listening-session', methods=['POST'])
@jwt_required()
def log_listening_session():
    """
    Log a listening session for stats (Time Listened, Songs Played, Day
    Streak). Called by the Web Playback SDK for Premium-connected users
    (is_estimated=False, real telemetry) or by a heartbeat/visibility
    timer for everyone else (is_estimated=True, best-effort guess).

    Expected JSON:
    {
        "spotify_track_id": "abc123",
        "duration_seconds": 187,
        "is_estimated": true
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        if not data or not data.get('spotify_track_id') or data.get('duration_seconds') is None:
            return jsonify({
                'success': False,
                'message': 'spotify_track_id and duration_seconds are required'
            }), 400

        duration = int(data['duration_seconds'])
        if duration < 0 or duration > 3600:  # sanity cap: no single "session" over 1 hour
            return jsonify({'success': False, 'message': 'Invalid duration_seconds'}), 400

        is_estimated = data.get('is_estimated', True)

        session_id = db.log_listening_session(
            user_id=current_user_id,
            spotify_track_id=data['spotify_track_id'],
            duration_seconds=duration,
            is_estimated=is_estimated
        )

        if not session_id:
            return jsonify({'success': False, 'message': 'Failed to log listening session'}), 500

        return jsonify({
            'success': True,
            'session_id': session_id
        }), 201

    except Exception as e:
        print(f"Error in log_listening_session: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500