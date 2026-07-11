import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Base configuration class"""

    # Flask Configuration
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    DEBUG = FLASK_ENV == 'development'

    # Server Configuration
    HOST = os.getenv('HOST', '127.0.0.1')
    PORT = int(os.getenv('PORT', 5000))

    # Database Configuration (PostgreSQL — e.g. Supabase connection string)
    DATABASE_URL = os.getenv('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT Configuration
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 3600)))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # Spotify API Configuration (Client Credentials - for music search/recommendations)
    SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID')
    SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET')
    SPOTIFY_REDIRECT_URI = os.getenv('SPOTIFY_REDIRECT_URI', 'http://127.0.0.1:5000/api/auth/spotify/callback')

    # Spotify OAuth Scopes (user-level)
    SPOTIFY_SCOPES = 'user-read-private user-read-email streaming user-modify-playback-state user-library-read'

    # Google OAuth Configuration
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
    GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://127.0.0.1:5000/api/auth/google/callback')

    # Email (Gmail SMTP) - used for password reset codes
    SMTP_EMAIL = os.getenv('SMTP_EMAIL')
    SMTP_APP_PASSWORD = os.getenv('SMTP_APP_PASSWORD')

    # Model Configuration
    MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model', 'best_model.keras')
    CLASS_INDICES_PATH = os.path.join(os.path.dirname(__file__), 'model', 'class_indices.json')

    # Image Upload Configuration
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}

    # Image Processing Configuration
    IMAGE_SIZE = (75, 75)  # Must match your model's input size
    GRAYSCALE = True

    # Face Detection Configuration (OpenCV DNN - res10 SSD Caffe model)
    # Replaces Haar Cascade, which was unreliable under poor/uneven lighting.
    # Only runs once per capture, so the extra model weight is a non-issue.
    # Lives alongside best_model.keras / class_indices.json in the same
    # `model/` folder. Download once:
    #   deploy.prototxt:
    #     https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt
    #   res10_300x300_ssd_iter_140000.caffemodel:
    #     https://raw.githubusercontent.com/opencv/opencv_3rdparty/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel
    DNN_FACE_PROTOTXT = os.path.join(os.path.dirname(__file__), 'model', 'deploy.prototxt')
    DNN_FACE_MODEL = os.path.join(os.path.dirname(__file__), 'model', 'res10_300x300_ssd_iter_140000.caffemodel')
    DNN_FACE_CONFIDENCE = float(os.getenv('DNN_FACE_CONFIDENCE', 0.5))  # Minimum detection confidence (0-1)

    # Profile Picture Configuration
    PROFILE_PICTURE_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads', 'profiles')
    DEFAULT_PROFILE_PICTURE = 'default_avatar.png'

    # CORS Configuration
    CORS_ORIGINS = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',  # Vite dev server
        'http://127.0.0.1:5173'
    ]

    # Emotion to Genre Mapping
    # NOTE: keys must exactly match the model's output labels in
    # model/class_indices.json: angry, disgust, fear, happy, neutral, sad, surprise
    # ('excited' isn't a model output — it's unused by detection but kept
    # for any manual mood-selector use elsewhere in the app).
    EMOTION_GENRE_MAP = {
        'happy': ['pop', 'dance', 'party', 'happy'],
        'sad': ['acoustic', 'indie', 'sad', 'piano'],
        'angry': ['rock', 'metal', 'hard-rock', 'punk'],
        'neutral': ['chill', 'ambient', 'lo-fi', 'jazz'],
        'surprise': ['electronic', 'edm', 'dance', 'pop'],
        'fear': ['classical', 'calm', 'ambient', 'meditation'],
        'disgust': ['punk', 'alternative', 'indie', 'rock'],
        'excited': ['dance', 'electronic', 'upbeat', 'party']
    }

    # Language to Spotify Market Code Mapping
    LANGUAGE_MARKET_MAP = {
        'english': 'US',
        'hindi': 'IN',
        'punjabi': 'IN',
        'spanish': 'ES',
        'french': 'FR',
        'korean': 'KR',
        'japanese': 'JP',
        'german': 'DE',
        'italian': 'IT',
        'portuguese': 'BR'
    }

    # Genre tags to use per language, per emotion. Spotify's `market` parameter
    # only controls licensing/availability region — it does NOT filter by the
    # language or origin of the music itself. Without this override, a
    # "happy" + Hindi request would still search genre:pop/dance/party (all
    # English-language genre tags) and just happen to restrict results to
    # what's licensed in India, which is mostly still English/Western pop.
    # This map swaps in the actual regional genre tags Spotify recognizes.
    LANGUAGE_GENRE_OVERRIDES = {
        'hindi': {
            'happy': ['bollywood', 'desi pop', 'filmi', 'indian pop'],
            'sad': ['bollywood', 'desi', 'sad bollywood', 'filmi'],
            'angry': ['desi hip hop', 'indian hip hop', 'bollywood'],
            'neutral': ['bollywood', 'indian classical', 'desi chill'],
            'surprise': ['bollywood dance', 'desi pop', 'indian edm'],
            'fear': ['indian classical', 'desi chill', 'instrumental'],
            'disgust': ['desi hip hop', 'indian hip hop'],
            'excited': ['bollywood dance', 'desi pop', 'indian edm']
        },
        'punjabi': {
            'happy': ['punjabi pop', 'bhangra', 'punjabi'],
            'sad': ['punjabi', 'punjabi sad songs'],
            'angry': ['punjabi hip hop', 'desi hip hop'],
            'neutral': ['punjabi', 'punjabi chill'],
            'surprise': ['bhangra', 'punjabi dance'],
            'fear': ['punjabi', 'instrumental'],
            'disgust': ['punjabi hip hop'],
            'excited': ['bhangra', 'punjabi dance', 'punjabi pop']
        },
        'korean': {
            'happy': ['k-pop', 'korean pop'],
            'sad': ['k-ballad', 'korean ballad'],
            'angry': ['k-hip hop', 'korean hip hop'],
            'neutral': ['k-indie', 'korean indie'],
            'surprise': ['k-pop', 'k-pop dance'],
            'fear': ['korean ost', 'korean ballad'],
            'disgust': ['k-hip hop'],
            'excited': ['k-pop', 'k-pop dance']
        },
        'japanese': {
            'happy': ['j-pop', 'japanese pop'],
            'sad': ['j-ballad', 'japanese ballad'],
            'angry': ['j-rock', 'japanese rock'],
            'neutral': ['city pop', 'japanese chill'],
            'surprise': ['j-pop', 'japanese dance'],
            'fear': ['japanese ost', 'japanese ambient'],
            'disgust': ['j-rock', 'visual kei'],
            'excited': ['j-pop', 'japanese dance']
        },
        'spanish': {
            'happy': ['latin pop', 'reggaeton'],
            'sad': ['latin ballad', 'bolero'],
            'angry': ['latin trap', 'reggaeton'],
            'neutral': ['latin chill', 'bossa nova'],
            'surprise': ['reggaeton', 'latin dance'],
            'fear': ['latin ballad', 'instrumental'],
            'disgust': ['latin trap'],
            'excited': ['reggaeton', 'latin dance', 'latin pop']
        },
        'french': {
            'happy': ['french pop', 'chanson'],
            'sad': ['chanson', 'french ballad'],
            'angry': ['french rap', 'french hip hop'],
            'neutral': ['french chill', 'chanson'],
            'surprise': ['french pop', 'french dance'],
            'fear': ['chanson', 'instrumental'],
            'disgust': ['french rap'],
            'excited': ['french pop', 'french dance']
        }
    }

    # Emotion Display Configuration
    EMOTION_EMOJIS = {
        'happy': '😊',
        'sad': '😢',
        'angry': '😠',
        'neutral': '😐',
        'surprise': '😲',
        'fear': '😰',
        'disgust': '🤢',
        'excited': '🤩'
    }

    # Password Reset Configuration
    RESET_CODE_EXPIRY = timedelta(minutes=15)  # Reset codes expire in 15 minutes
    RESET_CODE_LENGTH = 6  # 6-digit reset code

    @staticmethod
    def init_app(app):
        """Initialize application with configuration"""
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(Config.PROFILE_PICTURE_FOLDER, exist_ok=True)
        os.makedirs(os.path.join(os.path.dirname(__file__), 'database'), exist_ok=True)


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False


class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = True
    TESTING = True
    # Use a separate Postgres database/schema for tests if needed;
    # falls back to the same DATABASE_URL if no test-specific one is set.
    DATABASE_URL = os.getenv('TEST_DATABASE_URL', os.getenv('DATABASE_URL'))


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}