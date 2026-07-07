"""
One-off test script: confirms whether Spotify's audio-features endpoint
still works for this app, or is deprecated (404) like /recommendations was.
Run this once from the backend folder: python test_audio_features.py
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import Config
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

client_credentials_manager = SpotifyClientCredentials(
    client_id=Config.SPOTIFY_CLIENT_ID,
    client_secret=Config.SPOTIFY_CLIENT_SECRET
)
sp = spotipy.Spotify(client_credentials_manager=client_credentials_manager)

# A well-known, definitely-public track ID (Blinding Lights)
test_track_id = "0VjIjW4GlUZAMYd2vXMi3b"

try:
    features = sp.audio_features([test_track_id])
    print("✅ audio_features WORKS")
    print(features)
except Exception as e:
    print("❌ audio_features FAILED")
    print(f"Error: {str(e)}")