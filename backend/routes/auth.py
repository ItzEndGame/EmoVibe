from flask import Blueprint, request, jsonify, redirect, make_response
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity
)
from utils.db_helper import DatabaseHelper, DatabaseLockedError
from utils.email_helper import send_reset_code_email
from config import Config
import requests as http_requests

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')
db = DatabaseHelper()


def _cookie_options():
    return {
        'httponly': True,
        'secure': Config.COOKIE_SECURE,
        'samesite': Config.COOKIE_SAMESITE,
        'path': '/',
    }


def _set_auth_cookies(response, access_token, refresh_token):
    response.set_cookie(
        'access_token_cookie',
        access_token,
        max_age=int(Config.JWT_ACCESS_TOKEN_EXPIRES.total_seconds()),
        **_cookie_options()
    )
    response.set_cookie(
        'refresh_token_cookie',
        refresh_token,
        max_age=int(Config.JWT_REFRESH_TOKEN_EXPIRES.total_seconds()),
        **_cookie_options()
    )
    return response


def _clear_auth_cookies(response):
    response.set_cookie('access_token_cookie', '', expires=0, path='/', httponly=True, secure=Config.COOKIE_SECURE, samesite=Config.COOKIE_SAMESITE)
    response.set_cookie('refresh_token_cookie', '', expires=0, path='/', httponly=True, secure=Config.COOKIE_SECURE, samesite=Config.COOKIE_SAMESITE)
    return response


def _resolve_google_redirect_uri():
    configured = (Config.GOOGLE_REDIRECT_URI or '').strip()
    if configured:
        # If the configured redirect is a loopback value, follow the host that the
        # browser actually used for this request so Google accepts the callback.
        if '127.0.0.1' in configured or 'localhost' in configured:
            host = request.host or request.headers.get('Host') or ''
            if host:
                scheme = 'https' if request.is_secure else 'http'
                return f'{scheme}://{host}/api/auth/google/callback'
        return configured

    return f'{Config.BACKEND_URL}/api/auth/google/callback'


# ==================== EMAIL AUTH ====================

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()

        if not data.get('name') or not data.get('email') or not data.get('password'):
            return jsonify({'success': False, 'message': 'Name, email, and password are required'}), 400

        if '@' not in data['email'] or '.' not in data['email']:
            return jsonify({'success': False, 'message': 'Invalid email format'}), 400

        if len(data['password']) < 6:
            return jsonify({'success': False, 'message': 'Password must be at least 6 characters'}), 400

        try:
            user_id = db.create_user(
                name=data['name'],
                email=data['email'],
                password=data['password'],
                preferred_genres=data.get('preferred_genres'),
                auth_provider='email'
            )
        except DatabaseLockedError:
            return jsonify({
                'success': False,
                'message': 'Server is busy right now. Please try again in a moment.'
            }), 503

        if not user_id:
            return jsonify({'success': False, 'message': 'Email already registered'}), 409

        user = db.get_user_by_id(user_id)
        access_token = create_access_token(identity=user_id)
        refresh_token = create_refresh_token(identity=user_id)

        response = make_response(jsonify({
            'success': True,
            'message': 'Account created successfully',
            'user': {
                'id': user['id'],
                'name': user['name'],
                'email': user['email'],
                'profile_picture': user.get('profile_picture'),
                'preferred_genres': user.get('preferred_genres'),
                'auth_provider': user.get('auth_provider', 'email')
            }
        }), 201)
        return _set_auth_cookies(response, access_token, refresh_token)

    except Exception as e:
        print(f"Error in register: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()

        if not data.get('email') or not data.get('password'):
            return jsonify({'success': False, 'message': 'Email and password are required'}), 400

        existing_user = db.get_user_by_email(data['email'])
        if existing_user and existing_user.get('auth_provider') != 'email':
            provider = existing_user['auth_provider'].capitalize()
            return jsonify({
                'success': False,
                'message': f'This account uses {provider} login. Please sign in with {provider} instead.',
                'auth_provider': existing_user['auth_provider']
            }), 400

        user = db.verify_password(data['email'], data['password'])

        if not user:
            return jsonify({'success': False, 'message': 'Invalid email or password'}), 401

        access_token = create_access_token(identity=user['id'])
        refresh_token = create_refresh_token(identity=user['id'])

        response = make_response(jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {
                'id': user['id'],
                'name': user['name'],
                'email': user['email'],
                'profile_picture': user.get('profile_picture'),
                'preferred_genres': user.get('preferred_genres'),
                'auth_provider': user.get('auth_provider', 'email')
            }
        }), 200)
        return _set_auth_cookies(response, access_token, refresh_token)

    except Exception as e:
        print(f"Error in login: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    try:
        current_user_id = get_jwt_identity()
        new_access_token = create_access_token(identity=current_user_id)
        refresh_token = request.cookies.get('refresh_token_cookie', '')
        response = make_response(jsonify({'success': True, 'access_token': new_access_token}), 200)
        return _set_auth_cookies(response, new_access_token, refresh_token)
    except Exception as e:
        print(f"Error in refresh: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@auth_bp.route('/logout', methods=['POST'])
def logout():
    response = make_response(jsonify({'success': True, 'message': 'Logged out'}), 200)
    return _clear_auth_cookies(response)


@auth_bp.route('/validate-token', methods=['GET'])
@jwt_required()
def validate_token():
    try:
        current_user_id = get_jwt_identity()
        user = db.get_user_by_id(current_user_id)

        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        return jsonify({
            'success': True,
            'message': 'Token is valid',
            'user': {
                'id': user['id'],
                'name': user['name'],
                'email': user['email'],
                'profile_picture': user.get('profile_picture'),
                'preferred_genres': user.get('preferred_genres'),
                'auth_provider': user.get('auth_provider', 'email')
            }
        }), 200

    except Exception as e:
        print(f"Error in validate_token: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json()

        if not data.get('email'):
            return jsonify({'success': False, 'message': 'Email is required'}), 400

        user = db.get_user_by_email(data['email'])

        if user and user.get('auth_provider') != 'email':
            provider = user['auth_provider'].capitalize()
            return jsonify({
                'success': False,
                'message': f'This account uses {provider} login. Password reset is not available. Please sign in with {provider}.',
                'auth_provider': user['auth_provider']
            }), 400

        if not user:
            return jsonify({'success': True, 'message': 'If this email exists, a reset code has been sent'}), 200

        reset_code = db.create_reset_code(user['id'])

        if not reset_code:
            return jsonify({'success': False, 'message': 'Failed to generate reset code'}), 500

        email_sent = send_reset_code_email(data['email'], user['name'], reset_code)

        if not email_sent:
            # Still log it server-side as a fallback so testing isn't blocked
            # if SMTP isn't configured yet, but avoid exposing the reset code.
            print(f"⚠️ Password reset email could not be sent for {data['email']}; check SMTP configuration.")

        return jsonify({
            'success': True,
            'message': 'If this email exists, a reset code has been sent'
        }), 200

    except Exception as e:
        print(f"Error in forgot_password: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@auth_bp.route('/verify-reset-code', methods=['POST'])
def verify_reset_code():
    try:
        data = request.get_json()

        if not data.get('email') or not data.get('code'):
            return jsonify({'success': False, 'message': 'Email and reset code are required'}), 400

        is_valid = db.verify_reset_code(data['email'], data['code'])

        if not is_valid:
            return jsonify({'success': False, 'message': 'Invalid or expired reset code'}), 400

        return jsonify({'success': True, 'message': 'Reset code is valid'}), 200

    except Exception as e:
        print(f"Error in verify_reset_code: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()

        if not data.get('email') or not data.get('code') or not data.get('new_password'):
            return jsonify({'success': False, 'message': 'Email, reset code, and new password are required'}), 400

        if len(data['new_password']) < 6:
            return jsonify({'success': False, 'message': 'New password must be at least 6 characters'}), 400

        success = db.reset_password(data['email'], data['code'], data['new_password'])

        if not success:
            return jsonify({'success': False, 'message': 'Invalid or expired reset code'}), 400

        return jsonify({'success': True, 'message': 'Password reset successfully'}), 200

    except Exception as e:
        print(f"Error in reset_password: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


# ==================== GOOGLE OAUTH ====================

@auth_bp.route('/google/login', methods=['GET'])
def google_login():
    """Redirect user to Google OAuth consent screen"""
    redirect_uri = _resolve_google_redirect_uri()
    google_auth_url = (
        'https://accounts.google.com/o/oauth2/v2/auth'
        f'?client_id={Config.GOOGLE_CLIENT_ID}'
        f'&redirect_uri={redirect_uri}'
        '&response_type=code'
        '&scope=openid email profile'
        '&access_type=offline'
    )
    return redirect(google_auth_url)


@auth_bp.route('/google/callback', methods=['GET'])
def google_callback():
    """Handle Google OAuth callback"""
    try:
        code = request.args.get('code')
        error = request.args.get('error')

        if error:
            return redirect(f'{Config.FRONTEND_URL}/login?error=google_denied')

        if not code:
            return redirect(f'{Config.FRONTEND_URL}/login?error=google_failed')

        redirect_uri = _resolve_google_redirect_uri()
        token_response = http_requests.post('https://oauth2.googleapis.com/token', data={
            'code': code,
            'client_id': Config.GOOGLE_CLIENT_ID,
            'client_secret': Config.GOOGLE_CLIENT_SECRET,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code'
        }, timeout=15)

        if token_response.status_code != 200:
            print(f"Google token exchange failed: {token_response.status_code} {token_response.text}")
            return redirect(f'{Config.FRONTEND_URL}/login?error=google_token_failed')

        token_data = token_response.json()

        if 'error' in token_data:
            print(f"Google token error: {token_data}")
            return redirect(f'{Config.FRONTEND_URL}/login?error=google_token_failed')

        user_info_response = http_requests.get('https://www.googleapis.com/oauth2/v2/userinfo', headers={
            'Authorization': f"Bearer {token_data['access_token']}"
        })

        google_user = user_info_response.json()

        if 'error' in google_user:
            return redirect(f'{Config.FRONTEND_URL}/login?error=google_userinfo_failed')

        google_id = google_user.get('id')
        email = google_user.get('email')
        name = google_user.get('name')
        picture = google_user.get('picture')

        existing_user = db.get_user_by_email(email)

        if existing_user:
            if existing_user['auth_provider'] == 'email':
                db.update_user_provider(existing_user['id'], 'google', google_id)
            user_id = existing_user['id']
        else:
            user_id = db.create_oauth_user(
                name=name,
                email=email,
                auth_provider='google',
                provider_user_id=google_id,
                profile_picture=picture
            )

        if not user_id:
            return redirect(f'{Config.FRONTEND_URL}/login?error=user_creation_failed')

        access_token = create_access_token(identity=user_id)
        refresh_token = create_refresh_token(identity=user_id)

        response = redirect(f'{Config.FRONTEND_URL}/auth/callback?provider=google')
        return _set_auth_cookies(response, access_token, refresh_token)

    except Exception as e:
        print(f"Error in google_callback: {str(e)}")
        return redirect(f'{Config.FRONTEND_URL}/login?error=server_error')


@auth_bp.route('/google/token', methods=['POST'])
def google_token():
    """
    Alternative: Accept Google ID token from frontend (Google Sign-In JS SDK).
    Frontend sends the credential token, backend verifies it with Google.
    """
    try:
        data = request.get_json()
        credential = data.get('credential')

        if not credential:
            return jsonify({'success': False, 'message': 'Google credential is required'}), 400

        verify_response = http_requests.get(
            f'https://oauth2.googleapis.com/tokeninfo?id_token={credential}'
        )
        google_user = verify_response.json()

        if 'error_description' in google_user or verify_response.status_code != 200:
            return jsonify({'success': False, 'message': 'Invalid Google token'}), 401

        if google_user.get('aud') != Config.GOOGLE_CLIENT_ID:
            return jsonify({'success': False, 'message': 'Token audience mismatch'}), 401

        google_id = google_user.get('sub')
        email = google_user.get('email')
        name = google_user.get('name')
        picture = google_user.get('picture')

        existing_user = db.get_user_by_email(email)

        if existing_user:
            if existing_user['auth_provider'] == 'email':
                db.update_user_provider(existing_user['id'], 'google', google_id)
            user_id = existing_user['id']
        else:
            user_id = db.create_oauth_user(
                name=name,
                email=email,
                auth_provider='google',
                provider_user_id=google_id,
                profile_picture=picture
            )

        if not user_id:
            return jsonify({'success': False, 'message': 'Failed to create user'}), 500

        user = db.get_user_by_id(user_id)
        access_token = create_access_token(identity=user_id)
        refresh_token = create_refresh_token(identity=user_id)

        return jsonify({
            'success': True,
            'message': 'Google login successful',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'id': user['id'],
                'name': user['name'],
                'email': user['email'],
                'profile_picture': user.get('profile_picture'),
                'preferred_genres': user.get('preferred_genres'),
                'auth_provider': user.get('auth_provider', 'google')
            }
        }), 200

    except Exception as e:
        print(f"Error in google_token: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500