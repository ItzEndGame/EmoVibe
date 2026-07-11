import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import './AppShell.css';
import logo from '../../assets/emovibe-logo.png';
import { getUser, logout } from '../../services/api';

/* ============================== Icons ============================== */

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const GridIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const HeartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const PlaylistIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="3" cy="6" r="1.5" fill="currentColor" />
    <circle cx="3" cy="12" r="1.5" fill="currentColor" />
    <circle cx="3" cy="18" r="1.5" fill="currentColor" />
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const GamepadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="8" cy="11" r="1" fill="currentColor" />
    <circle cx="8" cy="13" r="1" fill="currentColor" />
    <circle cx="6" cy="12" r="1" fill="currentColor" />
    <circle cx="10" cy="12" r="1" fill="currentColor" />
    <circle cx="16" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

// Sidebar/profile-menu items that don't have a dedicated route yet get
// pointed at Profile, which already surfaces liked songs + mood history,
// instead of hitting the app's 404 redirect.
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: GridIcon, path: '/app' },
  { id: 'history', label: 'History', icon: HistoryIcon, path: '/app/history' },
  { id: 'search', label: 'Search', icon: SearchIcon, path: '/app/search' },
  { id: 'liked', label: 'Liked Songs', icon: HeartIcon, path: '/app/liked' },
  { id: 'playlists', label: 'Playlists', icon: PlaylistIcon, path: '/app/playlists' },
  { id: 'games', label: 'Games', icon: GamepadIcon, path: '/games' },
  { id: 'profile', label: 'Profile', icon: UserIcon, path: '/profile' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, path: '/app/settings' },
];

// Derives which nav item should be highlighted from the current route,
// rather than tracking it in local state — that way it stays correct
// on refresh, back/forward navigation, or landing here from a link.
const activeNavFor = (pathname) => {
  if (pathname.startsWith('/app/history')) return 'history';
  if (pathname.startsWith('/app/search')) return 'search';
  if (pathname.startsWith('/app/liked')) return 'liked';
  if (pathname.startsWith('/app/playlists')) return 'playlists';
  if (pathname.startsWith('/app/settings')) return 'settings';
  if (pathname.startsWith('/app')) return 'dashboard'; // covers /app and /app/detect
  if (pathname.startsWith('/games')) return 'games';
  if (pathname.startsWith('/profile')) return 'profile';
  return 'dashboard';
};

const AppShell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const activeNav = activeNavFor(location.pathname);
  const profileImage = typeof window !== 'undefined' ? localStorage.getItem('profileImage') : null;
  const initial = user?.name?.charAt(0).toUpperCase() || 'U';
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const goTo = (path) => {
    navigate(path);
    setMobileNavOpen(false);
    setUserMenuOpen(false);
  };

  // Close the account menu on an outside click, so it behaves like a
  // normal dropdown instead of staying open until something inside it
  // is clicked.
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
  };

  return (
    <div className="db-root">
      {/* Mobile top bar — hidden on desktop via CSS */}
      <div className="db-mobile-topbar">
        <button
          className="db-hamburger-btn"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
        <a href="/" className="db-mobile-logo">
          <img src={logo} alt="EmoVibe" />
        </a>
        <span className="db-mobile-topbar-spacer" />
      </div>

      {/* Backdrop for the mobile drawer */}
      {mobileNavOpen && (
        <div className="db-sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`db-sidebar ${mobileNavOpen ? 'db-sidebar-open' : ''}`}>
        <div className="db-sidebar-top">
          <div className="db-logo-row">
            <a href="/" className="db-logo">
              <img src={logo} alt="EmoVibe" />
            </a>
            <button
              className="db-sidebar-close-btn"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close menu"
            >
              <CloseIcon />
            </button>
          </div>

          <nav className="db-nav">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`db-nav-item ${activeNav === item.id ? 'db-nav-active' : ''}`}
                  onClick={() => goTo(item.path)}
                >
                  <Icon />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="db-sidebar-bottom" ref={userMenuRef}>
          {userMenuOpen && (
            <div className="db-user-menu-dropdown">
              <button onClick={() => goTo('/profile')}>
                <UserIcon /> View Profile
              </button>
              <button onClick={() => goTo('/app/settings')}>
                <SettingsIcon /> Settings
              </button>
              <div className="db-user-menu-divider" />
              <button className="db-user-menu-logout" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          )}

          <div className="db-user-card" onClick={() => setUserMenuOpen((prev) => !prev)}>
            <div className="db-user-avatar">
              {profileImage ? <img src={profileImage} alt={user?.name || 'User'} /> : initial}
            </div>
            <div className="db-user-info">
              <p className="db-user-name">{user?.name || 'User'}</p>
              <p className="db-user-email">{user?.email || 'email@example.com'}</p>
            </div>
            <span className="db-user-menu-caret" aria-hidden="true">
              {userMenuOpen ? '▾' : '▴'}
            </span>
          </div>
        </div>
      </aside>

      {/* Page content */}
      <main className="db-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AppShell;