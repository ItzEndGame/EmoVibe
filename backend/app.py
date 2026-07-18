from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
import os

from routes.auth import auth_bp
from routes.emotion import emotion_bp
from routes.music import music_bp
from routes.user import user_bp
from routes.spotify_connect import spotify_connect_bp
from routes.playlists import playlists_bp
from routes.preferences import preferences_bp
from routes.notifications import notifications_bp

def create_app(config_name='development'):
    app = Flask(__name__)
    app.config.from_object(Config)
    Config.init_app(app)

    CORS(app,
         origins=Config.CORS_ORIGINS,
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

    jwt = JWTManager(app)

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'success': False, 'message': 'Token has expired', 'error': 'token_expired'}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({'success': False, 'message': 'Invalid token', 'error': 'invalid_token'}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({'success': False, 'message': 'Authorization token is missing', 'error': 'authorization_required'}), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify({'success': False, 'message': 'Token has been revoked', 'error': 'token_revoked'}), 401

    app.register_blueprint(auth_bp)
    app.register_blueprint(emotion_bp)
    app.register_blueprint(music_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(spotify_connect_bp)
    app.register_blueprint(playlists_bp)
    app.register_blueprint(preferences_bp)
    app.register_blueprint(notifications_bp)

    @app.route('/')
    def index():
        return jsonify({
            'success': True,
            'message': 'EmoTune API - Emotion-Based Music Recommender',
            'version': '1.0.0'
        }), 200

    @app.route('/health')
    def health_check():
        health_status = {
            'api': 'healthy',
            'database': 'unknown',
            'emotion_model': 'unknown',
            'spotify': 'unknown'
        }

        try:
            from utils.db_helper import DatabaseHelper
            db = DatabaseHelper()
            with db.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('SELECT 1')
            health_status['database'] = 'healthy'
        except Exception as e:
            print(f"❌ Health check DB error: {str(e)}")
            health_status['database'] = 'unavailable'

        try:
            from utils.emotion_detector import EmotionDetector
            detector = EmotionDetector()
            health_status['emotion_model'] = 'healthy' if detector.model is not None else 'not loaded'
        except Exception as e:
            print(f"❌ Health check Emotion Model error: {str(e)}")
            health_status['emotion_model'] = f'error: {str(e)}'

        try:
            from routes.music import get_spotify_client
            sp = get_spotify_client()
            if sp:
                sp.recommendation_genre_seeds()
                health_status['spotify'] = 'healthy'
            else:
                health_status['spotify'] = 'not configured'
        except Exception as e:
            health_status['spotify'] = f'error: {str(e)}'

        all_healthy = all(status == 'healthy' for status in health_status.values())

        return jsonify({
            'success': all_healthy,
            'status': 'healthy' if all_healthy else 'degraded',
            'services': health_status
        }), 200 if all_healthy else 503

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'success': False, 'message': 'Endpoint not found'}), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({'success': False, 'message': 'Method not allowed'}), 405

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

    if Config.DEBUG:
        @app.before_request
        def log_request():
            from flask import request
            print(f"\n{'='*50}")
            print(f"📥 {request.method} {request.path}")
            if request.get_json(silent=True):
                print(f"📦 Body: {request.get_json()}")
            print(f"{'='*50}\n")

        @app.after_request
        def log_response(response):
            print(f"\n{'='*50}")
            print(f"📤 Response Status: {response.status_code}")
            print(f"{'='*50}\n")
            return response

    return app


app = create_app()

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🎵 EmoTune Backend Server Starting...")
    print("="*60)

    print(f"\n📋 Configuration:")
    print(f"   - Environment: {Config.FLASK_ENV}")
    print(f"   - Debug Mode: {Config.DEBUG}")
    print(f"   - Host: {Config.HOST}")
    print(f"   - Port: {Config.PORT}")
    print(f"   - Model Path: {Config.MODEL_PATH}")
    print(f"   - Database: {Config.DATABASE_URL}")

    print(f"\n🔧 Service Status:")

    if Config.SPOTIFY_CLIENT_ID and Config.SPOTIFY_CLIENT_SECRET:
        print(f"   ✅ Spotify API: Configured")
    else:
        print(f"   ⚠️  Spotify API: Not configured (check .env file)")

    if Config.GOOGLE_CLIENT_ID and Config.GOOGLE_CLIENT_SECRET:
        print(f"   ✅ Google OAuth: Configured")
    else:
        print(f"   ⚠️  Google OAuth: Not configured (check .env file)")

    if os.path.exists(Config.MODEL_PATH):
        print(f"   ✅ Emotion Model: Found")
    else:
        print(f"   ❌ Emotion Model: Not found at {Config.MODEL_PATH}")

    if os.path.exists(Config.CLASS_INDICES_PATH):
        print(f"   ✅ Class Indices: Found")
    else:
        print(f"   ❌ Class Indices: Not found at {Config.CLASS_INDICES_PATH}")

    print(f"\n🚀 Available Endpoints:")
    print(f"   - Root:            http://{Config.HOST}:{Config.PORT}/")
    print(f"   - Health:          http://{Config.HOST}:{Config.PORT}/health")
    print(f"   - Auth:            http://{Config.HOST}:{Config.PORT}/api/auth/*")
    print(f"   - Google OAuth:    http://{Config.HOST}:{Config.PORT}/api/auth/google/*")
    print(f"   - Spotify Connect: http://{Config.HOST}:{Config.PORT}/api/auth/spotify/*")
    print(f"   - Emotion:         http://{Config.HOST}:{Config.PORT}/api/emotion/*")
    print(f"   - Music:           http://{Config.HOST}:{Config.PORT}/api/music/*")
    print(f"   - User:            http://{Config.HOST}:{Config.PORT}/api/user/*")
    print(f"   - Playlists:       http://{Config.HOST}:{Config.PORT}/api/playlists/*")
    print(f"   - Preferences:     http://{Config.HOST}:{Config.PORT}/api/preferences/*")
    print(f"   - Notifications:   http://{Config.HOST}:{Config.PORT}/api/notifications/*")

    print("\n" + "="*60)
    print("🎉 Server is ready! Press CTRL+C to stop.")
    print("="*60 + "\n")

    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)