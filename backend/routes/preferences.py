from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.db_helper import DatabaseHelper
from config import Config

preferences_bp = Blueprint('preferences', __name__, url_prefix='/api/preferences')
db = DatabaseHelper()


@preferences_bp.route('', methods=['GET'])
@jwt_required()
def get_preferences():
    """Get the current user's preferences. Creates a default row on first access."""
    try:
        current_user_id = get_jwt_identity()
        prefs = db.get_user_preferences(current_user_id)

        if not prefs:
            return jsonify({'success': False, 'message': 'Failed to load preferences'}), 500

        return jsonify({
            'success': True,
            'preferences': prefs
        }), 200

    except Exception as e:
        print(f"Error in get_preferences: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@preferences_bp.route('', methods=['PUT'])
@jwt_required()
def update_preferences():
    """
    Update the current user's preferences. All fields optional —
    only the ones provided are changed.

    Expected JSON (any subset):
    {
        "default_emotion": "happy",
        "explicit_content": false,
        "autoplay": true,
        "language": "english",
        "theme": "dark"
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        if not data:
            return jsonify({'success': False, 'message': 'No preference data provided'}), 400

        # Light validation on fields with a known set of valid values
        if 'default_emotion' in data and data['default_emotion'] not in Config.EMOTION_GENRE_MAP:
            return jsonify({
                'success': False,
                'message': f'Invalid default_emotion. Valid options: {list(Config.EMOTION_GENRE_MAP.keys())}'
            }), 400

        if 'language' in data and data['language'] not in Config.LANGUAGE_MARKET_MAP:
            return jsonify({
                'success': False,
                'message': f'Invalid language. Valid options: {list(Config.LANGUAGE_MARKET_MAP.keys())}'
            }), 400

        if 'theme' in data and data['theme'] not in ('dark', 'light'):
            return jsonify({'success': False, 'message': "theme must be 'dark' or 'light'"}), 400

        success = db.update_user_preferences(
            current_user_id,
            default_emotion=data.get('default_emotion'),
            explicit_content=data.get('explicit_content'),
            autoplay=data.get('autoplay'),
            language=data.get('language'),
            theme=data.get('theme'),
        )

        if not success:
            return jsonify({'success': False, 'message': 'No valid fields to update'}), 400

        updated = db.get_user_preferences(current_user_id)

        return jsonify({
            'success': True,
            'message': 'Preferences updated successfully',
            'preferences': updated
        }), 200

    except Exception as e:
        print(f"Error in update_preferences: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500