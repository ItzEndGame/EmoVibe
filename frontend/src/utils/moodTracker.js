// Mood Tracking Utility
export const moodTracker = {
  // Save detected mood
  saveMood: (emotion) => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const moodHistory = JSON.parse(localStorage.getItem('moodHistory') || '[]');
    
    moodHistory.push({
      emotion: emotion.toLowerCase(),
      date: today,
      timestamp: new Date().toISOString()
    });
    
    localStorage.setItem('moodHistory', JSON.stringify(moodHistory));
    updateAnalytics();
  },

  // Save liked song with emotion
  saveLikedSong: (songData, emotion) => {
    const listeningStats = JSON.parse(localStorage.getItem('listeningStats') || '[]');
    
    listeningStats.push({
      songTitle: songData.title,
      artist: songData.artist,
      emotion: emotion.toLowerCase(),
      timestamp: new Date().toISOString()
    });
    
    localStorage.setItem('listeningStats', JSON.stringify(listeningStats));
    updateAnalytics();
  },

  // Get last 7 days mood data
  getWeeklyMoods: () => {
    const moodHistory = JSON.parse(localStorage.getItem('moodHistory') || '[]');
    const last7Days = getLast7Days();
    
    return last7Days.map(day => {
      const dayMoods = moodHistory.filter(m => m.date === day.date);
      const emotionCount = {};
      
      dayMoods.forEach(m => {
        emotionCount[m.emotion] = (emotionCount[m.emotion] || 0) + 1;
      });
      
      // Get most frequent emotion for that day
      const dominantEmotion = Object.keys(emotionCount).length > 0 
        ? Object.keys(emotionCount).reduce((a, b) => emotionCount[a] > emotionCount[b] ? a : b)
        : 'neutral';
      
      return {
        day: day.label,
        emotion: dominantEmotion,
        count: dayMoods.length
      };
    });
  },

  // Get emotion distribution
  getEmotionStats: () => {
    const moodHistory = JSON.parse(localStorage.getItem('moodHistory') || '[]');
    const emotions = ['happy', 'sad', 'angry', 'neutral', 'surprise', 'fear', 'disgust'];
    const colors = {
      happy: '#FFD700',
      sad: '#4A90E2',
      angry: '#E74C3C',
      neutral: '#95A5A6',
      surprise: '#9B59B6',
      fear: '#34495E',
      disgust: '#27AE60'
    };
    
    const emotionCount = {};
    emotions.forEach(e => emotionCount[e] = 0);
    
    moodHistory.forEach(m => {
      if (emotionCount[m.emotion] !== undefined) {
        emotionCount[m.emotion]++;
      }
    });
    
    const total = moodHistory.length || 1;
    
    return emotions.map(emotion => ({
      emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
      count: emotionCount[emotion],
      percentage: Math.round((emotionCount[emotion] / total) * 100),
      color: colors[emotion]
    }));
  },

  // Get total stats
  getTotalStats: () => {
    const moodHistory = JSON.parse(localStorage.getItem('moodHistory') || '[]');
    const listeningStats = JSON.parse(localStorage.getItem('listeningStats') || '[]');
    
    // Calculate listening time (assume 3 min per song)
    const totalMinutes = listeningStats.length * 3;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    // Calculate streak
    const streak = calculateStreak(moodHistory);
    
    // Get favorite emotion
    const emotionCount = {};
    moodHistory.forEach(m => {
      emotionCount[m.emotion] = (emotionCount[m.emotion] || 0) + 1;
    });
    
    const favoriteEmotion = Object.keys(emotionCount).length > 0
      ? Object.keys(emotionCount).reduce((a, b) => emotionCount[a] > emotionCount[b] ? a : b)
      : '-';
    
    return {
      totalSongs: listeningStats.length,
      listeningTime: `${hours}h ${minutes}m`,
      currentStreak: streak,
      favoriteEmotion: favoriteEmotion.charAt(0).toUpperCase() + favoriteEmotion.slice(1)
    };
  },

  // Clear all data
  clearAllData: () => {
    localStorage.removeItem('moodHistory');
    localStorage.removeItem('listeningStats');
    localStorage.removeItem('moodAnalysis');
  }
};

// Helper: Get last 7 days
function getLast7Days() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    result.push({
      date: date.toISOString().split('T')[0],
      label: days[date.getDay()]
    });
  }
  
  return result;
}

// Helper: Calculate streak
function calculateStreak(moodHistory) {
  if (moodHistory.length === 0) return 0;
  
  const sortedDates = [...new Set(moodHistory.map(m => m.date))].sort().reverse();
  let streak = 0;
  
  
  for (let i = 0; i < sortedDates.length; i++) {
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - i);
    const expected = expectedDate.toISOString().split('T')[0];
    
    if (sortedDates[i] === expected) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

// Update analytics in localStorage
function updateAnalytics() {
  const analytics = {
    weeklyMoods: moodTracker.getWeeklyMoods(),
    emotionStats: moodTracker.getEmotionStats(),
    ...moodTracker.getTotalStats()
  };
  
  localStorage.setItem('moodAnalysis', JSON.stringify(analytics));
}