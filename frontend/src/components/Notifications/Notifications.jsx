import React, { useState, useEffect } from 'react';
import './Notifications.css';
import { notificationsAPI } from '../../services/api';

// Icon + accent shown per notification type. Falls back to a generic bell
// for any type not listed here, so a future notif type never renders blank.
const TYPE_META = {
  streak_milestone: { icon: '🔥' },
  spotify_status: { icon: '🎧' },
};

const getTypeMeta = (type) => TYPE_META[type] || { icon: '🔔' };

// Turns a timestamp into "10 min ago" / "Yesterday" / "3 days ago" / etc.
// Falls back to a plain date once it's more than a week old.
const timeAgo = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = () => {
    notificationsAPI.getAll()
      .then((res) => setNotifications(res.notifications || []))
      .catch((err) => console.error('Failed to load notifications:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleCardClick = async (notif) => {
    if (notif.read_at) return; // already read — nothing to do

    // Optimistic update so the highlight/dot disappears immediately
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
    );

    try {
      await notificationsAPI.markRead(notif.id);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      // Revert on failure so the UI doesn't lie about server state
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read_at: null } : n))
      );
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;

    setMarkingAll(true);
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));

    try {
      await notificationsAPI.markAllRead();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      setNotifications(previous); // revert
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <>
      <header className="notif-header">
        <div>
          <h1>Notifications</h1>
          <p>Streak milestones, Spotify connection status, and other updates.</p>
        </div>
        {notifications.length > 0 && (
          <button
            className="notif-mark-all"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || markingAll}
          >
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </button>
        )}
      </header>

      {loading ? (
        <div className="notif-list">
          {[1, 2, 3].map((i) => (
            <div className="notif-skeleton" key={i}>
              <div className="notif-skeleton-bar" style={{ width: '40%' }} />
              <div className="notif-skeleton-bar" style={{ width: '70%' }} />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="notif-empty">
          <div className="notif-empty-icon">🔔</div>
          <h3>No new notifications</h3>
          <p>We'll let you know about streak milestones and Spotify updates here.</p>
        </div>
      ) : (
        <div className="notif-list">
          {notifications.map((notif) => {
            const meta = getTypeMeta(notif.type);
            const isUnread = !notif.read_at;
            return (
              <div
                key={notif.id}
                className={`notif-card ${isUnread ? 'notif-card-unread' : ''}`}
                onClick={() => handleCardClick(notif)}
              >
                <div className="notif-icon">{meta.icon}</div>
                <div className="notif-body">
                  <p className="notif-title">{notif.title}</p>
                  {notif.message && <p className="notif-message">{notif.message}</p>}
                  <p className="notif-time">{timeAgo(notif.created_at)}</p>
                </div>
                {isUnread && <span className="notif-unread-dot" />}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default Notifications;