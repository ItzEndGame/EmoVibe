import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI, musicAPI, getUser, logout } from '../../services/api';
import { color } from 'framer-motion';

const ProfilePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [user, setUser] = useState(() => getUser());
  const userId = user?.id || user?.email;
  const [likedSongs, setLikedSongs] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('7days');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [profileImage, setProfileImage] = useState(localStorage.getItem('profileImage') || null);
  const [imagePreview, setImagePreview] = useState(profileImage);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    preferred_genres: user?.preferred_genres || ''
  });
   
  
  // Analysis data - Load from localStorage or use defaults
  const [analysisData, setAnalysisData] = useState(() => {
    const saved = localStorage.getItem('moodAnalysis');
    return saved ? JSON.parse(saved) : {
      weeklyMoods: [
        { day: 'Mon', emotion: 'happy', count: 5 },
        { day: 'Tue', emotion: 'sad', count: 3 },
        { day: 'Wed', emotion: 'happy', count: 7 },
        { day: 'Thu', emotion: 'neutral', count: 4 },
        { day: 'Fri', emotion: 'happy', count: 6 },
        { day: 'Sat', emotion: 'surprise', count: 2 },
        { day: 'Sun', emotion: 'happy', count: 8 }
      ],
      emotionStats: [
        { emotion: 'Happy', count: 45, percentage: 40, color: '#FFD700' },
        { emotion: 'Sad', count: 20, percentage: 18, color: '#4A90E2' },
        { emotion: 'Angry', count: 10, percentage: 9, color: '#E74C3C' },
        { emotion: 'Neutral', count: 25, percentage: 22, color: '#95A5A6' },
        { emotion: 'Surprise', count: 8, percentage: 7, color: '#9B59B6' },
        { emotion: 'Fear', count: 3, percentage: 3, color: '#34495E' },
        { emotion: 'Disgust', count: 1, percentage: 1, color: '#27AE60' }
      ],
      totalSongs: 112,
      listeningTime: '24h 32m',
      currentStreak: 5,
      favoriteEmotion: 'Happy'
    };
  });

  const emotionEmojis = {
    happy: '😊',
    sad: '😢',
    angry: '😠',
    neutral: '😐',
    surprise: '😲',
    fear: '😰',
    disgust: '🤢'
  };

  useEffect(() => {
    fetchLikedSongs();
  }, []);

  const fetchLikedSongs = async () => {
    try {
      const response = await musicAPI.getLikedSongs();
      if (response.success) {
        setLikedSongs(response.liked_songs);
      }
    } catch (err) {
      console.error('Error fetching liked songs:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Avatar Upload Functions
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleSaveImage = () => {
  if (imagePreview) {
    localStorage.setItem('profileImage', imagePreview);
    setProfileImage(imagePreview);
    
    // ✅ Dispatch custom event
    window.dispatchEvent(new Event('profileImageUpdated'));
    
    alert('✅ Profile image updated!');
  }
};

const handleRemoveImage = () => {
  localStorage.removeItem('profileImage');
  setProfileImage(null);
  setImagePreview(null);
  
  // ✅ Dispatch custom event
  window.dispatchEvent(new Event('profileImageUpdated'));
  
  alert('✅ Profile image removed!');
};

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const response = await userAPI.updateProfile(formData);
      if (response.success) {
        setUser(response.user);
        localStorage.setItem('user', JSON.stringify(response.user));
        setEditing(false);
        alert('✅ Profile updated successfully!');
      }
    } catch (err) {
      alert('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      '⚠️ Are you sure you want to delete your account? This action cannot be undone!'
    );
    
    if (confirmed) {
      try {
        await userAPI.deleteAccount();
        alert('Account deleted successfully');
        logout();
      } catch (err) {
        alert('Failed to delete account. Please try again.');
      }
    }
  };

  const handleUnlikeSong = async (songId) => {
    try {
      await musicAPI.unlikeSong(songId);
      setLikedSongs(likedSongs.filter(song => song.id !== songId));
      alert('❤️ Song removed from liked songs');
    } catch (err) {
      alert('Failed to unlike song');
    }
  };

  const handleClearAnalysis = () => {
    if (showClearConfirm) {
      // Actually clear the data
      const emptyData = {
        weeklyMoods: Array(7).fill(0).map((_, i) => ({
          day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
          emotion: 'neutral',
          count: 0
        })),
        emotionStats: [
          { emotion: 'Happy', count: 0, percentage: 0, color: '#FFD700' },
          { emotion: 'Sad', count: 0, percentage: 0, color: '#4A90E2' },
          { emotion: 'Angry', count: 0, percentage: 0, color: '#E74C3C' },
          { emotion: 'Neutral', count: 0, percentage: 0, color: '#95A5A6' },
          { emotion: 'Surprise', count: 0, percentage: 0, color: '#9B59B6' },
          { emotion: 'Fear', count: 0, percentage: 0, color: '#34495E' },
          { emotion: 'Disgust', count: 0, percentage: 0, color: '#27AE60' }
        ],
        totalSongs: 0,
        listeningTime: '0h 0m',
        currentStreak: 0,
        favoriteEmotion: '-'
      };
      
      setAnalysisData(emptyData);
      localStorage.setItem('moodAnalysis', JSON.stringify(emptyData));
      localStorage.removeItem('moodHistory');
      localStorage.removeItem('listeningStats');
      setShowClearConfirm(false);
      alert('✅ Analysis data cleared successfully!');
    } else {
      setShowClearConfirm(true);
      // Auto-cancel after 5 seconds
      setTimeout(() => setShowClearConfirm(false), 5000);
    }
  };

  const getMaxMoodCount = () => {
    const max = Math.max(...analysisData.weeklyMoods.map(m => m.count));
    return max > 0 ? max : 10;
  };

  return (
    <div className="app-container">
      <div className="background-animation">
        <div className="floating-shapes">
          <div className="shape"></div>
          <div className="shape"></div>
          <div className="shape"></div>
          <div className="shape"></div>
        </div>
      </div>

      {/* Header */}
      <div className="header">
        <div className="header-logo"
          onClick={() => navigate('/')} 
          style={{ cursor: 'pointer' }}
          > 
          🎵 EmoTune</div>
        <div className="header-nav">
          <button
            onClick={() => navigate('/app')}
            style={{
              padding: '10px 20px',
              background: 'var(--primary-gradient)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: '600',
              marginRight: '15px'
            }}
          >
            ← Back to App
          </button>
          <button
            onClick={logout}
            style={{
              padding: '10px 20px',
              background: 'var(--warning-gradient)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="container">
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <h2 style={{
            fontSize: '2.5rem',
            background: 'var(--primary-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            My Profile
          </h2>
        </div>

        <div className="glass-card" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Profile Header with Avatar Upload */}
          <div style={{ 
            textAlign: 'center', 
            padding: '30px',
            borderBottom: '1px solid var(--glass-border)',
            marginBottom: '30px'
          }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
              <div style={{
                width: '170px',
                height: '170px',
                background: profileImage ? 'transparent' : 'var(--primary-gradient)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '3rem',
                border: '4px solid var(--glass-border)',
                overflow: 'hidden',
                cursor: 'pointer'
              }}
              onClick={handleUploadClick}
              >
                {profileImage ? (
                  <img src={profileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  '👤'
                )}
              </div>
              
              {/* Avatar Action Buttons */}
              <div style={{
                position: 'absolute',
                bottom: '-10px',
                right: '-10px',
                display: 'flex',
                gap: '5px'
              }}>
                <button
                  onClick={handleUploadClick}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'var(--accent-gradient)',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Upload Image"
                >
                  📷
                </button>
                {imagePreview && imagePreview !== profileImage && (
                  <button
                    onClick={handleSaveImage}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: '#27AE60',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Save Image"
                  >
                    ✓
                  </button>
                )}
                {profileImage && (
                  <button
                    onClick={handleRemoveImage}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: '#E74C3C',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Remove Image"
                  >
                    ✖
                  </button>
                )}
              </div>
            </div>
            
            {editing ? (
              <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <div className="form-group">
                  <input
                    type="text"
                    name="name"
                    className="form-input"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your name"
                  />
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    name="preferred_genres"
                    className="form-input"
                    value={formData.preferred_genres}
                    onChange={handleChange}
                    placeholder="Preferred genres (comma-separated)"
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleSaveProfile}
                    className="btn btn-primary"
                    disabled={loading}
                    style={{ width: 'auto', flex: 1 }}
                  >
                    {loading ? 'Saving...' : '✅ Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="btn"
                    style={{ 
                      width: 'auto', 
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    ❌ Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: '2rem', marginBottom: '10px' }}>
                  {user?.name}
                </h3>
                <p style={{ opacity: 0.9, fontSize: '1.1rem', marginBottom: '15px' }}>
                  {user?.email}
                </p>
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    padding: '10px 25px',
                    background: 'var(--accent-gradient)',
                    border: 'none',
                    borderRadius: '12px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    fontWeight: '600'
                  }}
                >
                  ✏️ Edit Profile
                </button>
              </>
            )}
          </div>

          {/* Account Info */}
          <div style={{ 
            padding: '25px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '15px',
            marginBottom: '30px'
          }}>
            <h4 style={{ marginBottom: '20px', fontSize: '1.5rem' }}>
              📋 Account Information
            </h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '225px'
            }}>
              <div>
                <p style={{ opacity: 0.9, fontSize: '1.2rem', marginBottom: '5px' }}>Account Created</p>
                <p style={{ fontWeight: '450', fontSize: '1.1rem' }}>
                  {new Date(user?.created_at).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p style={{ opacity: 0.9, fontSize: '1.2rem', marginBottom: '5px' }}>Preferred Genres</p>
                <p style={{ fontWeight: '450', fontSize: '1.1rem' }}>
                  {user?.preferred_genres || 'Not set'}
                </p>
              </div>
              <div>
                <p style={{ opacity: 0.7, fontSize: '1.2rem', marginBottom: '5px' }}>Liked Songs</p>
                <p style={{ fontWeight: '450', fontSize: '1.1rem' }}>
                  {likedSongs.length} songs
                </p>
              </div>
            </div>
          </div>

          {/* ANALYSIS SECTION WITH BEAUTIFUL GRAPHS */}
          <div style={{
            padding: '25px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '15px',
            marginBottom: '30px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '25px',
              flexWrap: 'wrap',
              gap: '15px'
            }}>
              <h4 style={{ fontSize: '1.5rem', margin: 0 }}>
                📊 Mood Analysis
              </h4>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  style={{
                    padding: '8px 15px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '10px',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="alltime">All Time</option>
                </select>
                <button
                  onClick={handleClearAnalysis}
                  style={{
                    padding: '8px 15px',
                    background: showClearConfirm ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : 'rgba(231, 76, 60, 0.3)',
                    border: '1px solid rgba(231, 76, 60, 0.5)',
                    borderRadius: '10px',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    animation: showClearConfirm ? 'pulse 0.5s ease' : 'none'
                  }}
                >
                  {showClearConfirm ? '⚠️ Confirm Clear?' : '🗑️ Clear Data'}
                </button>
                {showClearConfirm && (
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '10px',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    ✖️
                  </button>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '15px',
              marginBottom: '25px'
            }}>
              {[
                { icon: '🎵', value: analysisData.totalSongs, label: 'Songs Played' },
                { icon: '⏱️', value: analysisData.listeningTime, label: 'Listening Time' },
                { icon: '🔥', value: `${analysisData.currentStreak} days`, label: 'Current Streak' },
                { icon: '⭐', value: analysisData.favoriteEmotion, label: 'Favorite Mood' }
              ].map((stat, index) => (
                <div key={index} style={{
                  padding: '20px',
                  background: `linear-gradient(135deg, rgba(102, 126, 234, ${0.3 - index * 0.05}) 0%, rgba(118, 75, 162, ${0.3 - index * 0.05}) 100%)`,
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid var(--glass-border)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px) scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px', animation: 'bounce 2s infinite ease-in-out', animationDelay: `${index * 0.1}s` }}>
                    {stat.icon}
                  </div>
                  <div style={{ 
                    fontSize: '1.8rem', 
                    fontWeight: '700', 
                    marginBottom: '5px',
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Weekly Mood Graph - FIXED VERSION */}
<div style={{
  padding: '25px',
  background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.2) 100%)',
  borderRadius: '15px',
  marginBottom: '20px',
  border: '1px solid var(--glass-border)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
}}>
  <h5 style={{ 
    marginBottom: '25px', 
    fontSize: '1.2rem', 
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  }}>
    📊 Weekly Mood Trend
  </h5>
  
  <div style={{
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '400px', // Fixed container height
    gap: '12px',
    padding: '20px 0'
  }}>
    {analysisData.weeklyMoods.map((mood, index) => {
      // PIXEL CALCULATION - Not percentage
      const maxCount = Math.max(...analysisData.weeklyMoods.map(m => m.count));
      const maxHeight = 500; // Maximum bar height in pixels
      const minHeight = 90; // Minimum bar height in pixels
      
      // Calculate actual height
      let barHeight;
      if (mood.count === 0) {
        barHeight = 80; // Very small for zero
      } else if (maxCount === 0) {
        barHeight = minHeight;
      } else {
        barHeight = (mood.count / maxCount) * maxHeight;
        barHeight = Math.max(barHeight, minHeight); // Ensure minimum
      }
      
      return (
        <div key={index} style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          height: '100%'
        }}>
          {/* Bar */}
          <div style={{
            width: '100%',
            maxWidth: '70px',
            height: `${barHeight}px`, // PIXELS NOT PERCENTAGE
            background: `linear-gradient(180deg, 
              ${['#667eea', '#f093fb', '#4fd1c5', '#f5576c', '#feca57', '#48dbfb', '#ff6348'][index % 7]} 0%,
              ${['#764ba2', '#f5576c', '#667eea', '#764ba2', '#ff9ff3', '#0abde3', '#ee5a6f'][index % 7]} 100%
            )`,
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: '10px 0',
            transition: 'all 0.5s ease',
            animation: `growUp 1s ease ${index * 0.1}s backwards`,
            boxShadow: `0 5px 20px ${['rgba(102, 126, 234, 0.4)', 'rgba(240, 147, 251, 0.4)', 'rgba(79, 209, 197, 0.4)', 'rgba(245, 87, 108, 0.4)', 'rgba(254, 202, 87, 0.4)', 'rgba(72, 219, 251, 0.4)', 'rgba(255, 99, 72, 0.4)'][index % 7]}`,
            cursor: 'pointer',
            position: 'relative',
            marginTop: 'auto' // Push to bottom
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scaleY(1.05) scaleX(1.05)';
            e.currentTarget.style.boxShadow = `0 10px 40px ${['rgba(102, 126, 234, 0.6)', 'rgba(240, 147, 251, 0.6)', 'rgba(79, 209, 197, 0.6)', 'rgba(245, 87, 108, 0.6)', 'rgba(254, 202, 87, 0.6)', 'rgba(72, 219, 251, 0.6)', 'rgba(255, 99, 72, 0.6)'][index % 7]}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scaleY(1) scaleX(1)';
            e.currentTarget.style.boxShadow = `0 5px 20px ${['rgba(102, 126, 234, 0.4)', 'rgba(240, 147, 251, 0.4)', 'rgba(79, 209, 197, 0.4)', 'rgba(245, 87, 108, 0.4)', 'rgba(254, 202, 87, 0.4)', 'rgba(72, 219, 251, 0.4)', 'rgba(255, 99, 72, 0.4)'][index % 7]}`;
          }}
          >
            {/* Emoji */}
            <span style={{ 
              fontSize: '1.6rem', 
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              marginBottom: '0.1px'
            }}>
              {emotionEmojis[mood.emotion] || '😊'}
            </span>
            
            {/* Count */}
            <span style={{ 
              fontSize: '0.9rem',
              fontWeight: '570',
              color: 'white',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)'
            }}>
              {mood.count}
            </span>
          </div>
          
          {/* Day Label */}
          <span style={{ 
            fontSize: '0.85rem', 
            fontWeight: '570',
            opacity: 0.9,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: mood.count > 0 ? 'white' : 'rgba(255,255,255,0.5)'
          }}>
            {mood.day}
          </span>
        </div>
      );
    })}
  </div>
</div>

            {/* Emotion Distribution - BEAUTIFUL ANIMATED PROGRESS BARS */}
            <div style={{
              padding: '25px',
              background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.2) 100%)',
              borderRadius: '15px',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
            }}>
              <h5 style={{ marginBottom: '25px', fontSize: '1.6rem', fontWeight: '600' }}>
                🎭 Emotion Distribution
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {analysisData.emotionStats.map((stat, index) => (
                  <div key={index} style={{
                    animation: `slideInRight 0.6s ease ${index * 0.3}s backwards`
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                      fontSize: '1.1rem',
                      fontWeight: '500'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.6rem' }}>{emotionEmojis[stat.emotion.toLowerCase()]}</span>
                        {stat.emotion}
                      </span>
                      <span style={{ 
                        opacity: 0.9,
                        background: 'rgba(255, 255, 255, 0.1)',
                        padding: '6px 12px',
                        borderRadius: '12px',
                        marginBottom: '2px',
                        fontSize: '1.1rem'
                      }}>
                        {stat.count} songs
                      </span>
                    </div>
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      borderRadius: '20px',
                      height: '35px',
                      overflow: 'hidden',
                      position: 'relative',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <div style={{
                        width: `${stat.percentage}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${stat.color} 0%, ${stat.color}dd 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: '1px',
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        color: 'white',
                        transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        animation: `fillBar 1.5s ease ${index * 0.1}s backwards`,
                        boxShadow: `inset 0 2px 10px rgba(255, 255, 255, 0.2), 0 0 20px ${stat.color}40`,
                        textShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                        position: 'relative',
                        overflow: 'visible'
                      }}>
                        <span style={{
                          position: 'relative',
                          zIndex: 2
                        }}>
                          {stat.percentage}%
                        </span>
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: `linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%)`,
                          animation: 'shimmer 2s infinite linear'
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Liked Songs */}
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ 
              marginBottom: '20px', 
              fontSize: '1.6rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              ❤️ Liked Songs
            </h4>
            
            {likedSongs.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px',
                opacity: 0.7
              }}>
                <p style={{ fontSize: '3rem', marginBottom: '15px' }}>🎵</p>
                <p>No liked songs yet. Start detecting emotions and like some music!</p>
              </div>
            ) : (
              <div style={{ 
                display: 'grid', 
                gap: '15px'
              }}>
                {likedSongs.map((song) => (
                  <div
                    key={song.id}
                    style={{
                      padding: '20px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '15px',
                      display: 'flex',
                      fontSize: '1.1rem',
                      fontWeight: '300',
                      opacity: 0.95,
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid var(--glass-border)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h5 style={{ marginBottom: '5px', fontSize: '1.3rem', fontWeight: '500' }}>
                        {song.song_title}
                      </h5>
                      <p style={{ opacity: 0.9, marginBottom: '5px' }}>
                        {song.artist}
                      </p>
                      {song.emotion_detected && (
                        <span style={{
                          fontSize: '1rem',
                          padding: '8px 15px',
                          background: 'var(--accent-gradient)',
                          borderRadius: '12px',
                          fontWeight: '500',
                          color: 'black',
                          display: 'inline-block'
                        }}>
                          Mood: {song.emotion_detected}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleUnlikeSong(song.id)}
                      style={{
                        padding: '10px 20px',
                        background: 'var(--warning-gradient)',
                        border: 'none',
                        borderRadius: '10px',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '1rem',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      💔 Unlike
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div style={{
            padding: '25px',
            background: 'rgba(255, 107, 149, 0.1)',
            border: '1px solid rgba(255, 107, 149, 0.13)',
            borderRadius: '15px'
          }}>
            <h4 style={{ 
              marginBottom: '15px', 
              fontSize: '1.3rem',
              color: '#e50544ff'
            }}>
              ⚠️ Danger Zone
            </h4>
            <p style={{ opacity: 1.0, marginBottom: '20px' }}>
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button
              onClick={handleDeleteAccount}
              style={{
                padding: '12px 25px',
                background: 'var(--secondary-gradient)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.3s ease'
              }}
            >
              🗑️ Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Add CSS Animations */}
      <style>{`
        @keyframes growUp {
          from {
            height: 0;
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fillBar {
          from {
            width: 0;
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
};

export default ProfilePage;