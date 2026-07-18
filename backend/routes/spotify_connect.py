from flask import Blueprint, request, jsonify, redirect
from flask_jwt_extended import jwt_required, get_jwt_identity, decode_token
from utils.db_helper import DatabaseHelper
from config import Config
import requests as http_requests
from datetime import datetime, timedelta
import urllib.parse

spotify_connect_bp = Blueprint('spotify_connect', __name__, url_prefix='/api/auth/spotify')
db = DatabaseHelper()


@spotify_connect_bp.route('/login', methods=['GET'])
def spotify_login():
    """
    Initiate Spotify OAuth for an already logged-in EmoTune user.
    This connects their Spotify account for playback — not for registration.

    This is a full-page redirect (not an axios call), so the frontend can't
    attach an Authorization header. Instead, the JWT is passed as a `jwt`
    query parameter and decoded manually here.
    """
    token = request.args.get('jwt')

    if not token:
        return redirect('http://localhost:3000/app?spotify=missing_token')

    try:
        decoded = decode_token(token)
        user_id = decoded['sub']
    except Exception as e:
        print(f"Invalid JWT on spotify_login: {str(e)}")
        return redirect('http://localhost:3000/app?spotify=invalid_token')

    params = {
        'client_id': Config.SPOTIFY_CLIENT_ID,
        'response_type': 'code',
        'redirect_uri': Config.SPOTIFY_REDIRECT_URI,
        'scope': Config.SPOTIFY_SCOPES,
        'state': str(user_id)  # Pass user_id as state to retrieve after callback
    }

    auth_url = 'https://accounts.spotify.com/authorize?' + urllib.parse.urlencode(params)
    return redirect(auth_url)


@spotify_connect_bp.route('/callback', methods=['GET'])
def spotify_callback():
    """Handle Spotify OAuth callback after user grants permission"""
    try:
        code = request.args.get('code')
        error = request.args.get('error')
        user_id = request.args.get('state')  # We passed user_id as state

        if error:
            return redirect('http://localhost:3000/app?spotify=denied')

        if not code or not user_id:
            return redirect('http://localhost:3000/app?spotify=failed')

        # Exchange code for tokens
        token_response = http_requests.post('https://accounts.spotify.com/api/token', data={
            'code': code,
            'redirect_uri': Config.SPOTIFY_REDIRECT_URI,
            'grant_type': 'authorization_code'
        }, headers={
            'Content-Type': 'application/x-www-form-urlencoded'
        }, auth=(Config.SPOTIFY_CLIENT_ID, Config.SPOTIFY_CLIENT_SECRET))

        # .json() on an empty/non-JSON body raises a fairly opaque
        # "Expecting value: line 1 column 1 (char 0)" — check the real
        # HTTP status + raw body first so a failure here actually tells us
        # something (e.g. a non-2xx from Spotify, or a body that isn't JSON
        # at all because a proxy/firewall intercepted the request).
        print(f"Spotify token exchange status: {token_response.status_code}")
        if token_response.status_code != 200:
            print(f"Spotify token exchange non-200 body: {token_response.text[:500]!r}")
            detail = urllib.parse.quote(
                f"Spotify token exchange failed (HTTP {token_response.status_code}): "
                f"{token_response.text[:150] or '(empty body)'}"
            )
            return redirect(f'http://localhost:3000/app?spotify=token_failed&detail={detail}')

        if not token_response.text.strip():
            print("Spotify token exchange returned 200 with an empty body")
            return redirect('http://localhost:3000/app?spotify=error&detail=Spotify+returned+an+empty+response+during+token+exchange')

        token_data = token_response.json()

        if 'error' in token_data:
            print(f"Spotify token error: {token_data}")
            return redirect('http://localhost:3000/app?spotify=token_failed')

        missing = [k for k in ('access_token', 'refresh_token', 'expires_in') if k not in token_data]
        if missing:
            print(f"Spotify token response missing fields {missing}: {token_data}")
            return redirect('http://localhost:3000/app?spotify=token_incomplete')

        access_token = token_data['access_token']
        refresh_token = token_data['refresh_token']
        expires_in = token_data['expires_in']  # seconds
        expires_at = datetime.now() + timedelta(seconds=expires_in)

        # Get Spotify user profile to check Premium status
        profile_response = http_requests.get('https://api.spotify.com/v1/me', headers={
            'Authorization': f'Bearer {access_token}'
        })

        print(f"Spotify profile fetch status: {profile_response.status_code}")
        if profile_response.status_code != 200:
            print(f"Spotify profile fetch non-200 body: {profile_response.text[:500]!r}")
            detail = urllib.parse.quote(
                f"Spotify profile fetch failed (HTTP {profile_response.status_code}): "
                f"{profile_response.text[:150] or '(empty body)'}"
            )
            return redirect(f'http://localhost:3000/app?spotify=profile_failed&detail={detail}')

        spotify_profile = profile_response.json()

        if 'error' in spotify_profile:
            return redirect('http://localhost:3000/app?spotify=profile_failed')

        spotify_user_id = spotify_profile.get('id')
        is_premium = spotify_profile.get('product') == 'premium'

        # Save tokens to DB
        db.save_spotify_tokens(
            user_id=int(user_id),
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at.isoformat(),
            spotify_user_id=spotify_user_id,
            is_premium=is_premium
        )

        # Clear any stale "disconnected" notification so a future
        # disconnect can notify again instead of being silently blocked
        # by the dedup guard.
        db.reset_notification_dedup(int(user_id), 'spotify_disconnected')
        db.create_notification(
            user_id=int(user_id),
            notif_type='spotify_status',
            title='Spotify connected 🎧',
            message=(
                'Your Spotify account is connected — full playback is now enabled.'
                if is_premium else
                'Your Spotify account is connected. Free accounts get 30-second previews.'
            ),
            dedup_key=None
        )

        premium_param = 'true' if is_premium else 'false'
        return redirect(f'http://localhost:3000/app?spotify=connected&premium={premium_param}')

    except Exception as e:
        print(f"Error in spotify_callback: {str(e)}")
        # Surfaced in the URL (truncated, URL-encoded) so the frontend can
        # show the real reason instead of just a bare "error" flag — saves
        # a terminal-log round trip for every future failure here.
        error_detail = urllib.parse.quote(str(e)[:200])
        return redirect(f'http://localhost:3000/app?spotify=error&detail={error_detail}')


@spotify_connect_bp.route('/status', methods=['GET'])
@jwt_required()
def spotify_status():
    """Check if the current user has Spotify connected and their Premium status"""
    try:
        user_id = get_jwt_identity()
        tokens = db.get_spotify_tokens(user_id)

        if not tokens:
            return jsonify({
                'success': True,
                'connected': False,
                'is_premium': False
            }), 200

        # Check if token is expired.
        # Note: Postgres TIMESTAMP columns come back from psycopg2's
        # RealDictCursor as native datetime objects already, even though
        # save_spotify_tokens() originally wrote an isoformat() string —
        # Postgres stores it as a real timestamp, so round-tripping gives
        # us a datetime, not a string. Only call fromisoformat() if it's
        # still a string (e.g. never round-tripped through the DB yet).
        expires_at = tokens['expires_at']
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if datetime.now() >= expires_at:
            # Try to refresh
            refreshed = _refresh_spotify_token(user_id, tokens['refresh_token'])
            if not refreshed:
                db.create_notification(
                    user_id=user_id,
                    notif_type='spotify_status',
                    title='Spotify disconnected',
                    message='Your Spotify session expired. Reconnect in Settings to keep enjoying full playback.',
                    dedup_key='spotify_disconnected'
                )
                return jsonify({
                    'success': True,
                    'connected': False,
                    'is_premium': False,
                    'message': 'Spotify token expired. Please reconnect.'
                }), 200

        return jsonify({
            'success': True,
            'connected': True,
            'is_premium': bool(tokens['is_premium']),
            'spotify_user_id': tokens['spotify_user_id']
        }), 200

    except Exception as e:
        print(f"Error in spotify_status: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@spotify_connect_bp.route('/token', methods=['GET'])
@jwt_required()
def get_spotify_access_token():
    """
    Return a valid Spotify access token for the frontend Web Playback SDK.
    Automatically refreshes if expired.
    """
    try:
        user_id = get_jwt_identity()
        tokens = db.get_spotify_tokens(user_id)

        if not tokens:
            return jsonify({'success': False, 'message': 'Spotify not connected'}), 404

        # See note in spotify_status() above: Postgres returns TIMESTAMP
        # columns as native datetime objects, so only parse if it's
        # still a string.
        expires_at = tokens['expires_at']
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)

        # Refresh if expired or expiring within 5 minutes
        if datetime.now() >= expires_at - timedelta(minutes=5):
            refreshed_token = _refresh_spotify_token(user_id, tokens['refresh_token'])
            if not refreshed_token:
                return jsonify({'success': False, 'message': 'Failed to refresh Spotify token'}), 500
            return jsonify({'success': True, 'access_token': refreshed_token}), 200

        return jsonify({
            'success': True,
            'access_token': tokens['access_token'],
            'is_premium': bool(tokens['is_premium'])
        }), 200

    except Exception as e:
        print(f"Error in get_spotify_access_token: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


@spotify_connect_bp.route('/disconnect', methods=['DELETE'])
@jwt_required()
def disconnect_spotify():
    """Disconnect Spotify from the user's account"""
    try:
        user_id = get_jwt_identity()
        db.remove_spotify_tokens(user_id)
        return jsonify({'success': True, 'message': 'Spotify disconnected successfully'}), 200
    except Exception as e:
        print(f"Error in disconnect_spotify: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500


# ==================== HELPER ====================

def _refresh_spotify_token(user_id, refresh_token):
    """Refresh a Spotify access token and update DB. Returns new access token or None."""
    try:
        response = http_requests.post('https://accounts.spotify.com/api/token', data={
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }, headers={
            'Content-Type': 'application/x-www-form-urlencoded'
        }, auth=(Config.SPOTIFY_CLIENT_ID, Config.SPOTIFY_CLIENT_SECRET))

        data = response.json()

        if 'error' in data:
            print(f"Spotify refresh error: {data}")
            return None

        new_access_token = data['access_token']
        new_refresh_token = data.get('refresh_token', refresh_token)  # Spotify may or may not rotate it
        expires_at = datetime.now() + timedelta(seconds=data['expires_in'])

        # Get current tokens to preserve other fields
        tokens = db.get_spotify_tokens(user_id)

        db.save_spotify_tokens(
            user_id=user_id,
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            expires_at=expires_at.isoformat(),
            spotify_user_id=tokens['spotify_user_id'],
            is_premium=tokens['is_premium']
        )

        return new_access_token

    except Exception as e:
        print(f"Error refreshing Spotify token: {str(e)}")
        return None