import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './LandingPage.css';
import { isAuthenticated, authAPI, setAuthToken, setUser } from '../../services/api';

import logo from '../../assets/emovibe-logo.png';
import heroPerson from '../../assets/hero-person-cutout.png';
import heroBg from '../../assets/hero-bg.jpg';
import recPeacefulPiano from '../../assets/rec-peaceful-piano.jpg';
import recNatureEscape from '../../assets/rec-nature-escape.jpg';
import recMorningAcoustic from '../../assets/rec-morning-acoustic.jpg';

const NAV_LINKS = ['Home', 'How It Works', 'Features', 'Benefits', 'About Me'];

const FaceScanIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M7 3H4a1 1 0 00-1 1v3M17 3h3a1 1 0 011 1v3M7 21H4a1 1 0 01-1-1v-3M17 21h3a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="9" cy="11" r="1" fill="currentColor" />
    <circle cx="15" cy="11" r="1" fill="currentColor" />
    <path d="M9 15c.8.6 1.9 1 3 1s2.2-.4 3-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const EmotionIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 21s-7.5-4.6-10-9.2C.4 8.1 2 4.5 5.6 4c2-.3 3.8.7 4.9 2.2.4.5.6.8.6.8s.2-.3.6-.8C12.7 4.7 14.5 3.7 16.5 4c3.5.5 5.2 4.1 3.5 7.8C17.5 16.4 12 21 12 21z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M5.5 12h3l1.5-2.5L12 14l1.5-2.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MusicNoteIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M9 18V5l11-2v13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="17" cy="16" r="3" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

// ===== Icons for the sections below the hero =====

const CameraIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M4 8a2 2 0 012-2h1.5l1-1.6A1 1 0 019.35 4h5.3a1 1 0 01.85.4l1 1.6H18a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const HeartLineIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const LinkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M10 14a4.5 4.5 0 006.4.4l2.5-2.5a4.5 4.5 0 00-6.4-6.4l-1.5 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 10a4.5 4.5 0 00-6.4-.4L5.1 12a4.5 4.5 0 006.4 6.4l1.4-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M4 12.5l5.5 5.5L20 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HERO_FEATURES = [
  {
    title: 'AI Face Recognition',
    body: 'Advanced AI detects your facial emotions',
    icon: <FaceScanIcon />,
  },
  {
    title: 'Emotion Detection',
    body: 'Accurate mood analysis in real-time',
    icon: <EmotionIcon />,
  },
  {
    title: 'Mood-based Recommendations',
    body: 'Get the perfect music for your vibe',
    icon: <MusicNoteIcon />,
  },
];

const RECOMMENDATIONS = [
  { name: 'Peaceful Piano', type: 'Playlist', art: recPeacefulPiano },
  { name: 'Nature Escape', type: 'Playlist', art: recNatureEscape },
  { name: 'Morning Acoustic', type: 'Playlist', art: recMorningAcoustic },
];

const WAVEFORM_HEIGHTS = [6, 14, 8, 22, 10, 18, 26, 12, 20, 8, 16, 24, 10, 6, 18, 14, 22, 8, 12, 20, 16, 10, 24, 6];

const GENRES = [
  'Pop', 'Rock', 'Hip-Hop', 'R&B', 'Electronic', 'Dance',
  'Classical', 'Jazz', 'Country', 'Folk', 'Indie', 'Alternative',
];

// A real, ordered process — numbered steps are earned here, unlike the
// grid sections below where the items don't have a sequence.
const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Enable Your Camera',
    body: "Give EmoVibe a moment to see you. Everything happens the instant you're ready — no download, no setup.",
    icon: <CameraIcon />,
  },
  {
    step: '02',
    title: 'AI Reads Your Mood',
    body: 'One photo is enough. Our model recognizes seven core emotions in real time, right from your expression.',
    icon: <FaceScanIcon />,
  },
  {
    step: '03',
    title: 'Get Matched Music',
    body: "In seconds, EmoVibe hands you playlists and tracks tuned to exactly how you're feeling.",
    icon: <MusicNoteIcon />,
  },
  {
    step: '04',
    title: 'Save What You Love',
    body: 'Like a track, build a playlist, or run another detection and let your mood take you somewhere new.',
    icon: <HeartLineIcon />,
  },
];

// First three intentionally mirror HERO_FEATURES (same icons, fuller
// copy) — the hero teases them, this section is where they're delivered
// in full, plus three more.
const FEATURE_CARDS = [
  {
    title: 'AI Face Recognition',
    body: 'A lightweight model runs the moment you take a photo — right in your browser, no external hardware or noticeable lag.',
    icon: <FaceScanIcon />,
  },
  {
    title: 'Real-Time Emotion Detection',
    body: 'Trained to recognize seven core emotions — happy, sad, angry, surprised, fearful, disgusted, and neutral — from a single expression.',
    icon: <EmotionIcon />,
  },
  {
    title: 'Mood-Based Recommendations',
    body: 'Every detection returns a fresh set of tracks and playlists chosen to match, or gently shift, how you feel.',
    icon: <MusicNoteIcon />,
  },
  {
    title: 'Spotify Integration',
    body: 'Connect your Spotify account for full-length playback, Premium-quality streaming, and one-click playlist imports.',
    icon: <LinkIcon />,
  },
  {
    title: 'Your Own Music Library',
    body: "Like songs and build playlists, then revisit anything you've saved — all in one place, organized by mood.",
    icon: <HeartLineIcon />,
  },
  {
    title: 'Mood & Listening Insights',
    body: 'Your profile tracks streaks, favorite moods, and time spent listening, so your patterns become visible over time.',
    icon: <ChartIcon />,
  },
];

const BENEFITS = [
  {
    title: 'Skip the scrolling',
    body: "No more losing ten minutes to finding the right playlist. EmoVibe reads the moment and hands you music before you've finished sitting down.",
  },
  {
    title: "Backed by Spotify's full catalog",
    body: 'Not a limited built-in library — every recommendation pulls from Spotify itself, so the music is always real and always current.',
  },
  {
    title: 'Watch your patterns emerge',
    body: 'Your profile quietly tracks moods and listening habits over time, turning scattered sessions into a picture of how you actually feel, day to day.',
  },
  {
    title: 'Free to start',
    body: 'Create an account and get your first mood-matched playlist in under a minute — no credit card required.',
  },
];

const STAT_HIGHLIGHTS = [
  { value: '7', label: 'Core emotions recognized' },
  { value: '<3s', label: 'Average detection time' },
  { value: 'Unlimited', label: 'Spotify-powered catalog' },
  { value: 'Free', label: 'To get started' },
];

// Friendly copy for error codes the backend can send back via
// /login?error=<code> after a failed Google OAuth attempt.
const OAUTH_ERROR_MESSAGES = {
  oauth_failed: 'Google sign-in failed. Please try again.',
  google_denied: 'Google sign-in was cancelled. Please try again if you want to continue.',
  google_failed: 'Google sign-in did not return a valid response. Please try again.',
  google_token_failed: 'Google sign-in could not be completed on the server. Please try again.',
  google_userinfo_failed: 'Google sign-in could not read your profile. Please try again.',
  user_creation_failed: 'We could not create your account from Google. Please try again.',
  server_error: 'Google sign-in hit an unexpected server error. Please try again.',
  google_session_failed: "Google sign-in went through, but we couldn't start your session. This usually means the login cookie wasn't accepted — please try again.",
  email_exists: 'An account with this email already exists. Please log in with your email and password instead.',
  account_exists: 'An account with this email already exists. Please log in with your email and password instead.',
  email_taken: 'An account with this email already exists. Please log in with your email and password instead.',
};
const DEFAULT_OAUTH_ERROR = 'Something went wrong signing in with Google. Please try again or use your email and password.';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.66-.22-2.44H12v4.62h6.47a5.54 5.54 0 01-2.4 3.64v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A11.99 11.99 0 0012 24z" />
    <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 014.9 12c0-.79.14-1.56.37-2.28V6.61H1.26A11.99 11.99 0 000 12c0 1.94.46 3.77 1.26 5.39l4.01-3.11z" />
    <path fill="#EA4335" d="M12 4.76c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.61l4.01 3.11C6.22 6.87 8.87 4.76 12 4.76z" />
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3.5 6.5l8.5 6.5 8.5-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M7.5 10V7a4.5 4.5 0 019 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isLoggedIn = isAuthenticated();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  // Page loading screen
  const [assetsReady, setAssetsReady] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(true);

  // Login
  const [loginData, setLoginData] = useState({ email: '', password: '', rememberMe: false });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Sign up
  const [regData, setRegData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [regGenres, setRegGenres] = useState([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  // Forgot password
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState(1);
  const [resetMsg, setResetMsg] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Opens the panel on a given tab and reflects it in the URL so /login
  // and /register are shareable, bookmarkable, and back-button friendly.
  const openAuth = (tab) => {
    setAuthTab(tab);
    setAuthOpen(true);
    setForgotOpen(false);
    setLoginError('');
    setRegError('');
    navigate(tab === 'signup' ? '/register' : '/login');

    // The auth panel lives inside the hero section, so if this was
    // triggered from a lower section (About Me, Benefits, etc.), scroll
    // back up so the panel is actually visible.
    requestAnimationFrame(() => {
      document.getElementById('home')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const closeAuth = () => {
    setAuthOpen(false);
    setForgotOpen(false);
    if (location.pathname !== '/') navigate('/');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await authAPI.login({ email: loginData.email, password: loginData.password });
      if (res.success) {
        setAuthToken('session');
        setUser(res.user);
        setTimeout(() => navigate('/app'), 100);
      }
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    if (regData.password !== regData.confirmPassword) { setRegError('Passwords do not match'); return; }
    if (regData.password.length < 8) { setRegError('Password must be at least 8 characters'); return; }
    if (regGenres.length === 0) { setRegError('Select at least one genre'); return; }
    setRegLoading(true);
    try {
      const res = await authAPI.register({
        name: regData.name,
        email: regData.email,
        password: regData.password,
        preferred_genres: regGenres.join(', '),
      });
      if (res.success) {
        setAuthToken('session');
        localStorage.setItem('user', JSON.stringify(res.user));
        setTimeout(() => navigate('/app'), 100);
      }
    } catch (err) {
      setRegError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setRegLoading(false);
    }
  };

  const toggleGenre = (g) =>
    setRegGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const openForgot = () => {
    setForgotOpen(true);
    setResetStep(1);
    setResetMsg('');
    setResetError('');
  };

  const closeForgot = () => {
    setForgotOpen(false);
    setResetStep(1);
    setResetEmail('');
    setResetCode('');
    setNewPassword('');
    setResetMsg('');
    setResetError('');
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetMsg('');
    setResetLoading(true);
    try {
      if (resetStep === 1) {
        const res = await authAPI.forgotPassword(resetEmail);
        if (res.success) {
          setResetMsg('Reset code sent! Check your email.');
          setResetStep(2);
        }
      } else if (resetStep === 2) {
        const res = await authAPI.verifyResetCode(resetEmail, resetCode);
        if (res.success) {
          setResetMsg('Code verified! Enter your new password.');
          setResetStep(3);
        }
      } else {
        const res = await authAPI.resetPassword(resetEmail, resetCode, newPassword);
        if (res.success) {
          setResetMsg('Password reset! You can now log in.');
          setTimeout(() => {
            closeForgot();
            openAuth('login');
          }, 1800);
        }
      }
    } catch (err) {
      setResetError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Open the panel automatically if someone lands directly on /login or
  // /register (e.g. a bookmarked link, or AuthCallback bouncing back here
  // after a failed Google sign-in).
  useEffect(() => {
    if (isLoggedIn) {
      navigate('/app', { replace: true });
      return;
    }

    const params = new URLSearchParams(location.search);
    if (location.pathname === '/login') {
      setAuthTab('login');
      setAuthOpen(true);
      const errorCode = params.get('error');
      if (errorCode) {
        setLoginError(OAUTH_ERROR_MESSAGES[errorCode] || DEFAULT_OAUTH_ERROR);
      }
    } else if (location.pathname === '/register') {
      setAuthTab('signup');
      setAuthOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, location.pathname, navigate]);

  // Preload the hero imagery + fonts before showing the page so the
  // first paint doesn't pop in piecemeal.
  useEffect(() => {
    let cancelled = false;
    const imageSources = [heroBg, heroPerson, logo, recPeacefulPiano, recNatureEscape, recMorningAcoustic];

    const imagePromises = imageSources.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve;
          img.src = src;
        })
    );

    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    const minimumDisplay = new Promise((resolve) => setTimeout(resolve, 700));

    Promise.all([...imagePromises, fontsReady, minimumDisplay]).then(() => {
      if (!cancelled) setAssetsReady(true);
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!assetsReady) return undefined;
    const timeout = setTimeout(() => setLoaderVisible(false), 500);
    return () => clearTimeout(timeout);
  }, [assetsReady]);

  useEffect(() => {
    document.body.style.overflow = loaderVisible || menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [loaderVisible, menuOpen]);

  // Highlight the nav link for whichever section is currently in view
  useEffect(() => {
    const sectionIds = NAV_LINKS.map((l) => l.toLowerCase().replace(/\s+/g, '-'));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="ev-landing">
      {loaderVisible && (
        <div className={`ev-loader${assetsReady ? ' ev-loader-fade' : ''}`} role="status" aria-live="polite">
          <img src={logo} alt="EmoVibe" className="ev-loader-logo" />
          <div className="ev-loader-bars">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span key={i} style={{ animationDelay: `${i * 0.09}s` }} />
            ))}
          </div>
          <p className="ev-loader-text">Tuning into your vibe…</p>
        </div>
      )}

      {/* ===== Nav ===== */}
      <header className="ev-nav">
        <div className="ev-nav-inner">
          <a href="#home" className="ev-logo">
            <img src={logo} alt="EmoVibe" className="ev-logo-img" />
          </a>

          <nav className="ev-nav-links">
            {NAV_LINKS.map((link) => {
              const id = link.toLowerCase().replace(/\s+/g, '-');
              return (
                <a
                  key={link}
                  href={`#${id}`}
                  className={activeSection === id ? 'ev-nav-active' : ''}
                >
                  {link}
                </a>
              );
            })}
          </nav>

          <div className="ev-nav-actions">
            {isLoggedIn ? (
              <>
                <button className="ev-btn ev-btn-ghost" onClick={handleLogout}>
                  Logout
                </button>
                <button className="ev-btn ev-btn-primary" onClick={() => navigate('/app')}>
                  Go to App
                </button>
              </>
            ) : (
              <button
                className="ev-btn ev-btn-outline"
                onClick={() => openAuth('login')}
              >
                Login
              </button>
            )}

            <button
              className="ev-hamburger"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="ev-mobile-menu">
            {NAV_LINKS.map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setMenuOpen(false)}
              >
                {link}
              </a>
            ))}
          </nav>
        )}
      </header>

      {/* ===== Hero ===== */}
      <section className="ev-hero" id="home" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="ev-hero-bg" />
        <div className="ev-hero-grid">

          {/* Left column — copy */}
          <div className="ev-hero-copy">
            <h1 className="ev-h1">
              Your Emotion.
              <br />
              Our Music.
              <br />
              <span className="ev-h1-accent">One Perfect Match.</span>
            </h1>

            <p className="ev-sub">
              AI-powered face recognition detects how you feel and recommends the
              perfect music to match your mood.
            </p>

            <div className="ev-cta-row">
              <button
                className="ev-btn ev-btn-primary"
                onClick={() => (isLoggedIn ? navigate('/app') : openAuth('signup'))}
              >
                Get Started
                <span>→</span>
              </button>
              <button
                type="button"
                className="ev-btn ev-btn-outline"
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M6 4l14 8-14 8V4z" fill="currentColor" />
                </svg>
                See How It Works
              </button>
            </div>

            {/* Icon above title on desktop; icon+title side-by-side on mobile */}
            <ul className="ev-feature-row">
              {HERO_FEATURES.map((f) => (
                <li key={f.title}>
                  <span className="ev-feature-icon">{f.icon}</span>
                  <div>
                    <p className="ev-feature-title">{f.title}</p>
                    <p className="ev-feature-body">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right column — hero photo + mood card, swaps for the auth panel */}
          <div className={`ev-hero-right${authOpen ? ' ev-auth-open' : ''}`}>

            <div className="ev-hero-photo-mood-group" aria-hidden={authOpen}>
              <div className="ev-hero-photo-wrap">
                <div className="ev-hero-photo">
                  <span className="ev-live-pill">
                    <span className="ev-live-dot" />
                    Live Detection
                  </span>
                  <img src={heroPerson} alt="Person listening to music" className="ev-hero-person" />
                </div>
              </div>

              <div className="ev-mood-card">
                <p className="ev-mood-label">Detected Mood</p>
                <div className="ev-mood-face">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#8fe34d" strokeWidth="1.6" />
                    <circle cx="9" cy="10" r="1" fill="#8fe34d" />
                    <circle cx="15" cy="10" r="1" fill="#8fe34d" />
                    <path d="M8 14c1 1.2 2.4 2 4 2s3-.8 4-2" stroke="#8fe34d" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <span className="ev-mood-name">Calm</span>
                </div>

                <div className="ev-waveform">
                  {WAVEFORM_HEIGHTS.map((h, i) => (
                    <span key={i} style={{ height: `${h}px` }} />
                  ))}
                </div>

                <p className="ev-mood-rec-label">Recommended For You</p>
                <ul className="ev-mood-rec-list">
                  {RECOMMENDATIONS.map((rec) => (
                    <li key={rec.name}>
                      <span
                        className="ev-rec-art"
                        style={{ backgroundImage: `url(${rec.art})` }}
                      >
                        <span className="ev-rec-play">
                          <svg viewBox="0 0 24 24" fill="#04130a">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      </span>
                      <div>
                        <p className="ev-rec-name">{rec.name}</p>
                        <p className="ev-rec-type">{rec.type}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Auth panel — fades/slides in over the photo + mood card */}
            <div className="ev-auth-panel" aria-hidden={!authOpen}>
              <button
                type="button"
                className="ev-auth-close"
                aria-label="Close login panel"
                onClick={closeAuth}
              >
                ×
              </button>

              {forgotOpen ? (
                <>
                  <button
                    type="button"
                    className="ev-auth-back"
                    aria-label="Back to login"
                    onClick={closeForgot}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <div className="ev-auth-head">
                    <h2>Reset Password</h2>
                    <p>
                      {resetStep === 1 && 'Enter your email to receive a reset code'}
                      {resetStep === 2 && 'Enter the 6-digit code we emailed you'}
                      {resetStep === 3 && 'Choose a new password'}
                    </p>
                  </div>

                  {resetError && <div className="ev-auth-error">{resetError}</div>}
                  {resetMsg && <div className="ev-auth-success">{resetMsg}</div>}

                  <form className="ev-auth-form" onSubmit={handleForgot}>
                    {resetStep === 1 && (
                      <div className="ev-auth-field">
                        <MailIcon />
                        <input
                          type="email"
                          placeholder="Email address"
                          autoComplete="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          required
                        />
                      </div>
                    )}

                    {resetStep === 2 && (
                      <div className="ev-auth-field">
                        <LockIcon />
                        <input
                          type="text"
                          placeholder="6-digit code"
                          maxLength={6}
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value)}
                          required
                        />
                      </div>
                    )}

                    {resetStep === 3 && (
                      <div className="ev-auth-field">
                        <LockIcon />
                        <input
                          type="password"
                          placeholder="New password (min 8 chars)"
                          autoComplete="new-password"
                          minLength={8}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      className="ev-btn ev-btn-primary ev-auth-submit"
                      disabled={resetLoading}
                    >
                      {resetLoading ? (
                        <span className="ev-auth-spinner" />
                      ) : (
                        <>
                          {resetStep === 1 ? 'Send Reset Code' : resetStep === 2 ? 'Verify Code' : 'Reset Password'}
                          <span>→</span>
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="ev-auth-head">
                    <h2>{authTab === 'login' ? 'Welcome Back!' : 'Create Your Account'}</h2>
                    <p>
                      {authTab === 'login'
                        ? 'Login to continue your musical journey'
                        : 'Sign up and start getting mood-matched music'}
                    </p>
                  </div>

                  <div className="ev-auth-tabs">
                    <button
                      type="button"
                      className={authTab === 'login' ? 'ev-auth-tab-active' : ''}
                      onClick={() => openAuth('login')}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      className={authTab === 'signup' ? 'ev-auth-tab-active' : ''}
                      onClick={() => openAuth('signup')}
                    >
                      Sign Up
                    </button>
                    <span
                      className="ev-auth-tab-indicator"
                      style={{ transform: authTab === 'login' ? 'translateX(0%)' : 'translateX(100%)' }}
                    />
                  </div>

                  {authTab === 'login' ? (
                    <>
                      <button
                        type="button"
                        className="ev-auth-google"
                        onClick={() => authAPI.loginWithGoogle()}
                      >
                        <GoogleIcon />
                        Continue with Google
                      </button>

                      <div className="ev-auth-divider"><span />or<span /></div>

                      {loginError && <div className="ev-auth-error">{loginError}</div>}

                      <form className="ev-auth-form" onSubmit={handleLogin}>
                        <div className="ev-auth-field">
                          <MailIcon />
                          <input
                            type="email"
                            placeholder="Email address"
                            autoComplete="email"
                            value={loginData.email}
                            onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                            required
                          />
                        </div>

                        <div className="ev-auth-field">
                          <LockIcon />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password"
                            autoComplete="current-password"
                            value={loginData.password}
                            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                            required
                          />
                          <button
                            type="button"
                            className="ev-auth-toggle-pw"
                            onClick={() => setShowPassword((s) => !s)}
                          >
                            <EyeIcon />
                            {showPassword ? 'Hide' : 'Show'}
                          </button>
                        </div>

                        <div className="ev-auth-row">
                          <label className="ev-auth-remember">
                            <input
                              type="checkbox"
                              checked={loginData.rememberMe}
                              onChange={(e) => setLoginData({ ...loginData, rememberMe: e.target.checked })}
                            />
                            Remember me
                          </label>
                          <a
                            href="#forgot-password"
                            onClick={(e) => { e.preventDefault(); openForgot(); }}
                          >
                            Forgot Password?
                          </a>
                        </div>

                        <button
                          type="submit"
                          className="ev-btn ev-btn-primary ev-auth-submit"
                          disabled={loginLoading}
                        >
                          {loginLoading ? <span className="ev-auth-spinner" /> : <>Login <span>→</span></>}
                        </button>
                      </form>

                      <p className="ev-auth-switch">
                        Don&apos;t have an account?{' '}
                        <button type="button" onClick={() => openAuth('signup')}>Sign Up</button>
                      </p>
                    </>
                  ) : (
                    <>
                      {regError && <div className="ev-auth-error">{regError}</div>}

                      <form className="ev-auth-form" onSubmit={handleRegister}>
                        <div className="ev-auth-field">
                          <UserIcon />
                          <input
                            type="text"
                            placeholder="Full name"
                            autoComplete="name"
                            value={regData.name}
                            onChange={(e) => setRegData({ ...regData, name: e.target.value })}
                            required
                          />
                        </div>

                        <div className="ev-auth-field">
                          <MailIcon />
                          <input
                            type="email"
                            placeholder="Email address"
                            autoComplete="email"
                            value={regData.email}
                            onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                            required
                          />
                        </div>

                        <div className="ev-auth-field">
                          <LockIcon />
                          <input
                            type="password"
                            placeholder="Password (min 8 chars)"
                            autoComplete="new-password"
                            minLength={8}
                            value={regData.password}
                            onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                            required
                          />
                        </div>

                        <div className="ev-auth-field">
                          <LockIcon />
                          <input
                            type="password"
                            placeholder="Confirm password"
                            autoComplete="new-password"
                            value={regData.confirmPassword}
                            onChange={(e) => setRegData({ ...regData, confirmPassword: e.target.value })}
                            required
                          />
                        </div>

                        <p className="ev-auth-genre-label">
                          Favourite genres <span>(pick at least one)</span>
                        </p>
                        <div className="ev-auth-genres">
                          {GENRES.map((g) => (
                            <button
                              key={g}
                              type="button"
                              className={`ev-auth-genre-chip${regGenres.includes(g) ? ' ev-auth-genre-chip-active' : ''}`}
                              onClick={() => toggleGenre(g)}
                            >
                              {g}
                            </button>
                          ))}
                        </div>

                        <button
                          type="submit"
                          className="ev-btn ev-btn-primary ev-auth-submit"
                          disabled={regLoading}
                        >
                          {regLoading ? <span className="ev-auth-spinner" /> : <>Create Account <span>→</span></>}
                        </button>
                      </form>

                      <p className="ev-auth-switch">
                        Already have an account?{' '}
                        <button type="button" onClick={() => openAuth('login')}>Login</button>
                      </p>
                    </>
                  )}
                </>
              )}
            </div>

          </div>

        </div>

        <p className="ev-quote">
          "Music is the voice of the soul. We just help you find the right one." 🎵
        </p>
      </section>

      {/* ===== How It Works ===== */}
      <section className="ev-section" id="how-it-works">
        <div className="ev-section-inner">
          <div className="ev-section-head">
            <span className="ev-eyebrow">How It Works</span>
            <h2 className="ev-section-title">
              From your face to your feed, <span className="ev-title-accent">in four steps.</span>
            </h2>
            <p className="ev-section-sub">
              No forms to fill out and no genres to pre-select — just tell EmoVibe how you feel, one photo at a time.
            </p>
          </div>

          <div className="ev-steps-row">
            {HOW_IT_WORKS_STEPS.map((s) => (
              <div className="ev-step-card" key={s.step}>
                <span className="ev-step-icon-wrap">
                  <span className="ev-step-icon">{s.icon}</span>
                  <span className="ev-step-number">{s.step}</span>
                </span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section className="ev-section" id="features">
        <div className="ev-section-inner">
          <div className="ev-section-head">
            <span className="ev-eyebrow">Features</span>
            <h2 className="ev-section-title">
              Everything you need, <span className="ev-title-accent">nothing you don't.</span>
            </h2>
            <p className="ev-section-sub">
              The three ideas from above, in full — plus what happens after the music starts playing.
            </p>
          </div>

          <div className="ev-features-grid">
            {FEATURE_CARDS.map((f) => (
              <div className="ev-feature-card" key={f.title}>
                <span className="ev-feature-card-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Benefits ===== */}
      <section className="ev-section" id="benefits">
        <div className="ev-section-inner">
          <div className="ev-benefits-grid">
            <div>
              <div className="ev-section-head ev-section-head-left">
                <span className="ev-eyebrow">Benefits</span>
                <h2 className="ev-section-title">
                  Why people <span className="ev-title-accent">stick with EmoVibe.</span>
                </h2>
              </div>

              <ul className="ev-benefits-list">
                {BENEFITS.map((b) => (
                  <li key={b.title}>
                    <span className="ev-benefit-check"><CheckIcon /></span>
                    <div>
                      <h3>{b.title}</h3>
                      <p>{b.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ev-stats-panel">
              <p className="ev-stats-panel-label">EmoVibe at a glance</p>
              <div className="ev-stats-grid">
                {STAT_HIGHLIGHTS.map((s) => (
                  <div className="ev-stat-item" key={s.label}>
                    <p className="ev-stat-value">{s.value}</p>
                    <p className="ev-stat-label">{s.label}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="ev-btn ev-btn-primary ev-stats-cta"
                onClick={() => (isLoggedIn ? navigate('/app') : openAuth('signup'))}
              >
                Get Started <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== About Me ===== */}
      <section className="ev-section" id="about-me">
        <div className="ev-section-inner">
          <div className="ev-about-card">
            <span className="ev-eyebrow">About Me</span>
            <h2 className="ev-section-title">
              Built for the moment music should <span className="ev-title-accent">feel like you.</span>
            </h2>
            <p>
              EmoVibe started with a simple observation: the right song can change how a moment feels, but finding
              it usually means scrolling past a dozen playlists that don't quite fit. So I paired a fast, in-browser
              face reader with Spotify's catalog to close that gap — read the room, then hand you the music, without
              the search.
            </p>
            <p>
              I built and maintain EmoVibe on my own, for anyone who wants their music to keep up with how they
              actually feel, not just what they searched for last week.
            </p>
            <button
              type="button"
              className="ev-btn ev-btn-outline"
              onClick={() => (isLoggedIn ? navigate('/app') : openAuth('signup'))}
            >
              Join EmoVibe Free
            </button>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="ev-footer">
        <div className="ev-footer-inner">
          <div className="ev-footer-brand">
            <img src={logo} alt="EmoVibe" className="ev-footer-logo" />
            <p>Your emotion. Our music. One perfect match.</p>
          </div>

          <nav className="ev-footer-links">
            {NAV_LINKS.map((link) => (
              <a key={link} href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}>
                {link}
              </a>
            ))}
          </nav>

          <p className="ev-footer-copyright">© {new Date().getFullYear()} EmoVibe. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;