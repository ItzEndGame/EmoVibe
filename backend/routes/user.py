from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
import uuid
from utils.db_helper import DatabaseHelper
from utils.image_processor import ImageProcessor
from config import Config

user_bp = Blueprint('user', __name__, url_prefix='/api/user')
db = DatabaseHelper()
image_processor = ImageProcessor()

@user_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """
    Get current user's profile
    """
    try:
        current_user_id = get_jwt_identity()
        
        # Get user data
        user = db.get_user_by_id(current_user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        # Get user statistics
        stats = db.get_user_statistics(current_user_id)
        
        # Remove sensitive data
        user_data = {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'profile_picture': user['profile_picture'],
            'preferred_genres': user['preferred_genres'],
            'created_at': user['created_at'],
            'updated_at': user['updated_at']
        }
        
        # Add statistics if available
        if stats:
            user_data['statistics'] = {
                'total_liked_songs': stats.get('total_liked_songs', 0),
                'emotions_explored': stats.get('emotions_explored', 0),
                'last_activity': stats.get('last_activity')
            }
        
        return jsonify({
            'success': True,
            'user': user_data
        }), 200
        
    except Exception as e:
        print(f"Error in get_profile: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@user_bp.route('/profile/edit', methods=['PUT'])
@jwt_required()
def edit_profile():
    """
    Edit user profile
    
    Expected JSON:
    {
        "name": "New Name",
        "preferred_genres": "Pop, Rock, Jazz"
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Get current user
        user = db.get_user_by_id(current_user_id)
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        # Update profile
        name = data.get('name', '').strip() if data.get('name') else None
        preferred_genres = data.get('preferred_genres', '').strip() if data.get('preferred_genres') else None
        
        if not name and not preferred_genres:
            return jsonify({
                'success': False,
                'message': 'No fields to update'
            }), 400
        
        success = db.update_user_profile(
            user_id=current_user_id,
            name=name,
            preferred_genres=preferred_genres
        )
        
        if not success:
            return jsonify({
                'success': False,
                'message': 'Failed to update profile'
            }), 500
        
        # Get updated user data
        updated_user = db.get_user_by_id(current_user_id)
        
        return jsonify({
            'success': True,
            'message': 'Profile updated successfully',
            'user': {
                'id': updated_user['id'],
                'name': updated_user['name'],
                'email': updated_user['email'],
                'profile_picture': updated_user['profile_picture'],
                'preferred_genres': updated_user['preferred_genres'],
                'updated_at': updated_user['updated_at']
            }
        }), 200
        
    except Exception as e:
        print(f"Error in edit_profile: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@user_bp.route('/profile/picture', methods=['POST'])
@jwt_required()
def upload_profile_picture():
    """
    Upload/update profile picture
    
    Expects multipart/form-data with 'picture' file
    """
    try:
        current_user_id = get_jwt_identity()
        
        # Check if file is present
        if 'picture' not in request.files:
            return jsonify({
                'success': False,
                'message': 'No picture file provided'
            }), 400
        
        file = request.files['picture']
        
        if file.filename == '':
            return jsonify({
                'success': False,
                'message': 'No file selected'
            }), 400
        
        # Check file extension
        if not image_processor.validate_file_extension(file.filename):
            return jsonify({
                'success': False,
                'message': f'Invalid file type. Allowed types: {", ".join(Config.ALLOWED_EXTENSIONS)}'
            }), 400
        
        # Generate unique filename
        filename = secure_filename(file.filename)
        file_extension = filename.rsplit('.', 1)[1].lower()
        unique_filename = f"profile_{current_user_id}_{uuid.uuid4()}.{file_extension}"
        
        # Save to temporary location
        temp_path = os.path.join(Config.UPLOAD_FOLDER, unique_filename)
        file.save(temp_path)
        
        try:
            # Process and save profile picture
            final_filename = f"profile_{current_user_id}.jpg"
            final_path = os.path.join(Config.PROFILE_PICTURE_FOLDER, final_filename)
            
            success = image_processor.process_profile_picture(temp_path, final_path)
            
            if not success:
                return jsonify({
                    'success': False,
                    'message': 'Failed to process profile picture'
                }), 500
            
            # Update database
            db.update_user_profile(
                user_id=current_user_id,
                profile_picture=final_filename
            )
            
            return jsonify({
                'success': True,
                'message': 'Profile picture updated successfully',
                'profile_picture': final_filename
            }), 200
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.remove(temp_path)
        
    except Exception as e:
        print(f"Error in upload_profile_picture: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@user_bp.route('/profile/picture', methods=['DELETE'])
@jwt_required()
def remove_profile_picture():
    """
    Remove the user's custom profile picture, reverting to the default
    avatar. Mirrors the same file-cleanup pattern delete_account uses
    below for the profile picture it deletes.
    """
    try:
        current_user_id = get_jwt_identity()
        user = db.get_user_by_id(current_user_id)

        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404

        current_picture = user.get('profile_picture')

        if not current_picture or current_picture == Config.DEFAULT_PROFILE_PICTURE:
            return jsonify({
                'success': False,
                'message': 'No custom profile picture to remove'
            }), 400

        # Delete the actual file (best-effort — don't fail the request if
        # this doesn't work, the DB update is what actually matters)
        picture_path = os.path.join(Config.PROFILE_PICTURE_FOLDER, current_picture)
        if os.path.exists(picture_path):
            try:
                os.remove(picture_path)
            except Exception as e:
                print(f"Error deleting profile picture file: {str(e)}")

        db.update_user_profile(
            user_id=current_user_id,
            profile_picture=Config.DEFAULT_PROFILE_PICTURE
        )

        return jsonify({
            'success': True,
            'message': 'Profile picture removed successfully',
            'profile_picture': Config.DEFAULT_PROFILE_PICTURE
        }), 200

    except Exception as e:
        print(f"Error in remove_profile_picture: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@user_bp.route('/profile/picture/<filename>', methods=['GET'])
def get_profile_picture(filename):
    """
    Get profile picture by filename
    No authentication required (public access)
    """
    try:
        return send_from_directory(Config.PROFILE_PICTURE_FOLDER, filename)
    except Exception as e:
        print(f"Error serving profile picture: {str(e)}")
        # Return default avatar if file not found
        return send_from_directory(Config.PROFILE_PICTURE_FOLDER, Config.DEFAULT_PROFILE_PICTURE)

@user_bp.route('/account', methods=['DELETE'])
@jwt_required()
def delete_account():
    """
    Delete user account permanently
    
    Expected JSON:
    {
        "confirm": true
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Require explicit confirmation
        if not data or not data.get('confirm'):
            return jsonify({
                'success': False,
                'message': 'Account deletion must be explicitly confirmed'
            }), 400
        
        # Get user before deletion (for cleanup)
        user = db.get_user_by_id(current_user_id)
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        # Delete user (cascade will handle liked songs)
        success = db.delete_user(current_user_id)
        
        if not success:
            return jsonify({
                'success': False,
                'message': 'Failed to delete account'
            }), 500
        
        # Clean up profile picture if not default
        if user['profile_picture'] != Config.DEFAULT_PROFILE_PICTURE:
            picture_path = os.path.join(Config.PROFILE_PICTURE_FOLDER, user['profile_picture'])
            if os.path.exists(picture_path):
                try:
                    os.remove(picture_path)
                except Exception as e:
                    print(f"Error deleting profile picture: {str(e)}")
        
        return jsonify({
            'success': True,
            'message': 'Account deleted successfully'
        }), 200
        
    except Exception as e:
        print(f"Error in delete_account: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@user_bp.route('/statistics', methods=['GET'])
@jwt_required()
def get_statistics():
    """
    Get detailed user statistics for the Profile and Dashboard pages.
    """
    try:
        current_user_id = get_jwt_identity()

        # Get user statistics (now includes favorite_mood, day_streak,
        # total_songs_played, total_seconds_listened via db_helper)
        stats = db.get_user_statistics(current_user_id)

        if not stats:
            return jsonify({
                'success': False,
                'message': 'Statistics not available'
            }), 404

        # Get liked songs for additional insights
        liked_songs = db.get_liked_songs(current_user_id)

        # Count songs by emotion
        emotion_breakdown = {}
        for song in liked_songs:
            emotion = song.get('emotion_detected', 'unknown')
            emotion_breakdown[emotion] = emotion_breakdown.get(emotion, 0) + 1

        # Get most liked emotion
        most_liked_emotion = max(emotion_breakdown, key=emotion_breakdown.get) if emotion_breakdown else None

        # Account age in days
        account_age_days = None
        user = db.get_user_by_id(current_user_id)
        if user and user.get('created_at'):
            from datetime import datetime
            created_at = user['created_at']
            if hasattr(created_at, 'replace'):
                account_age_days = (datetime.now() - created_at.replace(tzinfo=None)).days

        # Format listened time as hours/minutes for direct display
        total_seconds = stats.get('total_seconds_listened', 0) or 0
        hours_listened = total_seconds // 3600
        minutes_listened = (total_seconds % 3600) // 60

        statistics = {
            'total_liked_songs': stats.get('total_liked_songs', 0),
            'total_detections': stats.get('total_detections', 0),
            'total_songs_played': stats.get('total_songs_played', 0),
            'emotions_explored': stats.get('emotions_explored', 0),
            'favorite_mood': stats.get('favorite_mood'),  # {emotion, count} or None
            'day_streak': stats.get('day_streak', 0),
            'time_listened': {
                'total_seconds': total_seconds,
                'hours': hours_listened,
                'minutes': minutes_listened,
                'formatted': f"{hours_listened}h {minutes_listened}m"
            },
            'last_activity': stats.get('last_activity'),
            'emotion_breakdown': emotion_breakdown,
            'most_liked_emotion': most_liked_emotion,
            'account_age_days': account_age_days
        }

        return jsonify({
            'success': True,
            'statistics': statistics
        }), 200

    except Exception as e:
        print(f"Error in get_statistics: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@user_bp.route('/preferences', methods=['GET'])
@jwt_required()
def get_preferences():
    """
    Get user's music preferences
    """
    try:
        current_user_id = get_jwt_identity()
        
        user = db.get_user_by_id(current_user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        # Parse preferred genres
        preferred_genres = user['preferred_genres'].split(',') if user['preferred_genres'] else []
        preferred_genres = [genre.strip() for genre in preferred_genres]
        
        return jsonify({
            'success': True,
            'preferences': {
                'preferred_genres': preferred_genres
            }
        }), 200
        
    except Exception as e:
        print(f"Error in get_preferences: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@user_bp.route('/preferences', methods=['PUT'])
@jwt_required()
def update_preferences():
    """
    Update user's music preferences
    
    Expected JSON:
    {
        "preferred_genres": ["Pop", "Rock", "Jazz"]
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'preferred_genres' not in data:
            return jsonify({
                'success': False,
                'message': 'Preferred genres are required'
            }), 400
        
        # Convert array to comma-separated string
        genres_list = data['preferred_genres']
        if isinstance(genres_list, list):
            preferred_genres = ', '.join(genres_list)
        else:
            preferred_genres = genres_list
        
        # Update in database
        success = db.update_user_profile(
            user_id=current_user_id,
            preferred_genres=preferred_genres
        )
        
        if not success:
            return jsonify({
                'success': False,
                'message': 'Failed to update preferences'
            }), 500
        
        return jsonify({
            'success': True,
            'message': 'Preferences updated successfully',
            'preferred_genres': genres_list if isinstance(genres_list, list) else preferred_genres.split(', ')
        }), 200
        
    except Exception as e:
        print(f"Error in update_preferences: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500