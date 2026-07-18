from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.db_helper import DatabaseHelper

notifications_bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')
db = DatabaseHelper()


@notifications_bp.route('', methods=['GET'])
@jwt_required()
def get_notifications():
    """Get the current user's notifications, most recent first."""
    try:
        current_user_id = get_jwt_identity()
        notifications = db.get_notifications(current_user_id)

        return jsonify({
            'success': True,
            'notifications': notifications,
            'total': len(notifications)
        }), 200

    except Exception as e:
        print(f"Error in get_notifications: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@notifications_bp.route('/unread-count', methods=['GET'])
@jwt_required()
def get_unread_count():
    """Returns the number of unread notifications — powers the bell badge."""
    try:
        current_user_id = get_jwt_identity()
        count = db.get_unread_notification_count(current_user_id)

        return jsonify({
            'success': True,
            'unread_count': count
        }), 200

    except Exception as e:
        print(f"Error in get_unread_count: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@notifications_bp.route('/<int:notification_id>/read', methods=['PATCH'])
@jwt_required()
def mark_read(notification_id):
    """Mark a single notification as read."""
    try:
        current_user_id = get_jwt_identity()
        success = db.mark_notification_read(notification_id, current_user_id)

        if not success:
            return jsonify({'success': False, 'message': 'Notification not found or already read'}), 404

        return jsonify({'success': True, 'message': 'Notification marked as read'}), 200

    except Exception as e:
        print(f"Error in mark_read: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@notifications_bp.route('/read-all', methods=['PATCH'])
@jwt_required()
def mark_all_read():
    """Mark all of the current user's notifications as read."""
    try:
        current_user_id = get_jwt_identity()
        updated_count = db.mark_all_notifications_read(current_user_id)

        return jsonify({
            'success': True,
            'message': f'{updated_count} notification(s) marked as read',
            'updated_count': updated_count
        }), 200

    except Exception as e:
        print(f"Error in mark_all_read: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500