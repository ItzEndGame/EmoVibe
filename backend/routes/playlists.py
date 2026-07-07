from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.db_helper import DatabaseHelper

playlists_bp = Blueprint('playlists', __name__, url_prefix='/api/playlists')
db = DatabaseHelper()


# ==================== USER PLAYLISTS ====================

@playlists_bp.route('', methods=['GET'])
@jwt_required()
def get_playlists():
    """Get all playlists belonging to the current user, with song counts."""
    try:
        current_user_id = get_jwt_identity()
        playlists = db.get_user_playlists(current_user_id)

        return jsonify({
            'success': True,
            'playlists': playlists,
            'total': len(playlists)
        }), 200

    except Exception as e:
        print(f"Error in get_playlists: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@playlists_bp.route('', methods=['POST'])
@jwt_required()
def create_playlist():
    """
    Create a new playlist.

    Expected JSON:
    {
        "name": "My Chill Mix",
        "description": "Songs for unwinding",   (optional)
        "cover_image_url": "https://..."         (optional)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        if not data or not data.get('name'):
            return jsonify({'success': False, 'message': 'Playlist name is required'}), 400

        playlist_id = db.create_playlist(
            user_id=current_user_id,
            name=data['name'],
            description=data.get('description'),
            cover_image_url=data.get('cover_image_url')
        )

        if not playlist_id:
            return jsonify({'success': False, 'message': 'Failed to create playlist'}), 500

        playlist = db.get_playlist_by_id(playlist_id, current_user_id)

        return jsonify({
            'success': True,
            'message': 'Playlist created successfully',
            'playlist': playlist
        }), 201

    except Exception as e:
        print(f"Error in create_playlist: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@playlists_bp.route('/<int:playlist_id>', methods=['GET'])
@jwt_required()
def get_playlist(playlist_id):
    """Get a single playlist's details and its songs."""
    try:
        current_user_id = get_jwt_identity()
        playlist = db.get_playlist_by_id(playlist_id, current_user_id)

        if not playlist:
            return jsonify({'success': False, 'message': 'Playlist not found'}), 404

        songs = db.get_playlist_songs(playlist_id)

        return jsonify({
            'success': True,
            'playlist': playlist,
            'songs': songs,
            'total_songs': len(songs)
        }), 200

    except Exception as e:
        print(f"Error in get_playlist: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@playlists_bp.route('/<int:playlist_id>', methods=['PUT'])
@jwt_required()
def update_playlist(playlist_id):
    """
    Update a playlist's name, description, or cover image.

    Expected JSON (all optional, at least one required):
    {
        "name": "New Name",
        "description": "New description",
        "cover_image_url": "https://..."
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        if not data:
            return jsonify({'success': False, 'message': 'No update data provided'}), 400

        # Confirm ownership first so we return 404, not a silent no-op,
        # if the playlist doesn't belong to this user.
        existing = db.get_playlist_by_id(playlist_id, current_user_id)
        if not existing:
            return jsonify({'success': False, 'message': 'Playlist not found'}), 404

        success = db.update_playlist(
            playlist_id,
            current_user_id,
            name=data.get('name'),
            description=data.get('description'),
            cover_image_url=data.get('cover_image_url')
        )

        if not success:
            return jsonify({'success': False, 'message': 'No changes made'}), 400

        updated = db.get_playlist_by_id(playlist_id, current_user_id)

        return jsonify({
            'success': True,
            'message': 'Playlist updated successfully',
            'playlist': updated
        }), 200

    except Exception as e:
        print(f"Error in update_playlist: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@playlists_bp.route('/<int:playlist_id>', methods=['DELETE'])
@jwt_required()
def delete_playlist(playlist_id):
    """Delete a playlist (and all its songs, via cascade)."""
    try:
        current_user_id = get_jwt_identity()

        existing = db.get_playlist_by_id(playlist_id, current_user_id)
        if not existing:
            return jsonify({'success': False, 'message': 'Playlist not found'}), 404

        db.delete_playlist(playlist_id, current_user_id)

        return jsonify({
            'success': True,
            'message': 'Playlist deleted successfully'
        }), 200

    except Exception as e:
        print(f"Error in delete_playlist: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@playlists_bp.route('/<int:playlist_id>/songs', methods=['POST'])
@jwt_required()
def add_song(playlist_id):
    """
    Add a song to a playlist.

    Expected JSON:
    {
        "spotify_track_id": "abc123",
        "song_title": "Track Name",
        "artist": "Artist Name",
        "album_art_url": "https://...",      (optional)
        "spotify_preview_url": "https://..."  (optional)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        required_fields = ['spotify_track_id', 'song_title', 'artist']
        if not data or not all(data.get(f) for f in required_fields):
            return jsonify({
                'success': False,
                'message': f'Required fields: {", ".join(required_fields)}'
            }), 400

        existing = db.get_playlist_by_id(playlist_id, current_user_id)
        if not existing:
            return jsonify({'success': False, 'message': 'Playlist not found'}), 404

        song_id = db.add_song_to_playlist(
            playlist_id=playlist_id,
            spotify_track_id=data['spotify_track_id'],
            song_title=data['song_title'],
            artist=data['artist'],
            album_art_url=data.get('album_art_url'),
            spotify_preview_url=data.get('spotify_preview_url')
        )

        if not song_id:
            return jsonify({
                'success': False,
                'message': 'Song already in playlist or failed to add'
            }), 409

        return jsonify({
            'success': True,
            'message': 'Song added to playlist',
            'song_id': song_id
        }), 201

    except Exception as e:
        print(f"Error in add_song: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@playlists_bp.route('/<int:playlist_id>/songs/<string:spotify_track_id>', methods=['DELETE'])
@jwt_required()
def remove_song(playlist_id, spotify_track_id):
    """Remove a song from a playlist."""
    try:
        current_user_id = get_jwt_identity()

        existing = db.get_playlist_by_id(playlist_id, current_user_id)
        if not existing:
            return jsonify({'success': False, 'message': 'Playlist not found'}), 404

        success = db.remove_song_from_playlist(playlist_id, spotify_track_id)

        if not success:
            return jsonify({'success': False, 'message': 'Song not found in playlist'}), 404

        return jsonify({
            'success': True,
            'message': 'Song removed from playlist'
        }), 200

    except Exception as e:
        print(f"Error in remove_song: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500