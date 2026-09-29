/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Menu,
  X,
  ArrowUpRight,
  Mail,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Camera,
  Sparkles,
  LogOut,
  Shield,
  Youtube,
  Instagram,
  Facebook,
  Linkedin,
  Globe,
  Video,
  Twitter,
} from 'lucide-react';
import {
  INITIAL_PROJECTS,
  SOCIAL_PROFILES,
  SERVICES_LIST,
  SOFTWARE_SKILLS,
  PortfolioProject,
  SocialProfile,
} from './data/portfolioData';
import {
  initAuth,
  visitorGoogleSignIn,
  logout,
  OWNER_EMAIL,
} from './services/workspaceAuth';
import { PortfolioSection } from './components/PortfolioSection';
import { ClientUploadSection } from './components/ClientUploadSection';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { BrandLogo, useBrandLogo } from './components/BrandLogo';

const STORAGE_KEYS = {
  PROJECTS: 'rupam_portfolio_projects_v1',
  PROFILE_IMAGE: 'rupam_profile_portrait_v1',
  SESSION_ID: 'rupam_visitor_session_id_v1',
  SOCIALS: 'rupam_social_profiles_v1',
};

export default function App() {
  // Portfolio Projects state (persisted locally + synced with Google Sheets)
  const [projects, setProjects] = useState<PortfolioProject[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_PROJECTS;
  });

  // Personal Profile Portrait state (preserves original appearance, editable anytime)
  const [profileImage, setProfileImage] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.PROFILE_IMAGE);
    } catch {
      return null;
    }
  });

  // Social profiles state (flexible to add more accounts later)
  const [socialProfiles] = useState<SocialProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SOCIALS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return SOCIAL_PROFILES;
  });

  // Navigation & Modal State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const { uploadExactLogoFile } = useBrandLogo();

  // Visitor & Owner Google Sign-In State
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    photoURL?: string | null;
  } | null>(null);
  const [userAccessToken, setUserAccessToken] = useState<string | null>(null);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [googleAuthFeedback, setGoogleAuthFeedback] = useState<string | null>(null);

  // Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('Video Editing Inquiry');
  const [contactMessage, setContactMessage] = useState('');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Anonymous Session ID for privacy-conscious visitor tracking
  const getOrCreateSessionId = (): string => {
    try {
      let sid = sessionStorage.getItem(STORAGE_KEYS.SESSION_ID);
      if (!sid) {
        sid = `vis-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sid);
      }
      return sid;
    } catch {
      return `vis-${Date.now()}`;
    }
  };

  const trackPageVisit = async (pageName: string) => {
    try {
      const sessionId = getOrCreateSessionId();
      await fetch('/api/analytics/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, page: pageName }),
      });
    } catch {
      // non-blocking analytics
    }
  };

  useEffect(() => {
    trackPageVisit('Home');
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 650);
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser({
          name: user.displayName || 'Google Visitor',
          email: user.email || '',
          photoURL: user.photoURL,
        });
        if (token) setUserAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setUserAccessToken(null);
      }
    );
    return () => {
      clearTimeout(splashTimer);
      unsubscribe();
    };
  }, []);

  const handleUpdateProjects = (updated: PortfolioProject[]) => {
    setProjects(updated);
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleAddProject = (newProj: PortfolioProject) => {
    const next = [newProj, ...projects];
    handleUpdateProjects(next);
  };

  const handleUpdateProfileImage = (dataUrl: string | null) => {
    setProfileImage(dataUrl);
    try {
      if (dataUrl) {
        localStorage.setItem(STORAGE_KEYS.PROFILE_IMAGE, dataUrl);
      } else {
        localStorage.removeItem(STORAGE_KEYS.PROFILE_IMAGE);
      }
    } catch {
      // ignore quota error
    }
  };

  const handleHeroPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleUpdateProfileImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Voluntary Visitor "Continue with Google" handler
  const handleVisitorGoogleSignIn = async () => {
    setIsSigningInGoogle(true);
    setGoogleAuthFeedback(null);
    try {
      const result = await visitorGoogleSignIn();
      const user = result.user;
      const name = user.displayName || 'Google Visitor';
      const email = user.email || '';

      setCurrentUser({
        name,
        email,
        photoURL: user.photoURL,
      });
      if (result.accessToken) {
        setUserAccessToken(result.accessToken);
      }

      if (email && !contactEmail) setContactEmail(email);
      if (name && !contactName) setContactName(name);

      // Record authorized visitor in Website Visitors Google Sheet tab
      await fetch('/api/visitors/google-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          pageVisited: 'Home',
          visitorAccessToken: result.accessToken,
        }),
      });

      setGoogleAuthFeedback(`Signed in as ${name}`);
    } catch {
      // User closed popup or cancelled
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleVisitorSignOut = async () => {
    await logout();
    setCurrentUser(null);
    setUserAccessToken(null);
    setGoogleAuthFeedback(null);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    setContactSuccess(false);

    if (
      !contactName.trim() ||
      !contactEmail.trim() ||
      !contactSubject.trim() ||
      !contactMessage.trim()
    ) {
      setContactError('Please fill out all required fields before sending your message.');
      return;
    }

    setIsSubmittingContact(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName.trim(),
          email: contactEmail.trim(),
          subject: contactSubject.trim(),
          message: contactMessage.trim(),
          userAccessToken,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setContactError(
          data.error || "We couldn't save your information right now. Please try again."
        );
        return;
      }

      setContactSuccess(true);
      setContactMessage('');
    } catch {
      setContactError("We couldn't save your information right now. Please try again.");
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(OWNER_EMAIL);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const renderSocialIcon = (id: string) => {
    switch (id) {
      case 'youtube':
        return <Youtube className="w-5 h-5 text-[#00D2FF]" />;
      case 'instagram':
        return <Instagram className="w-5 h-5 text-[#7AA2F7]" />;
      case 'facebook':
        return <Facebook className="w-5 h-5 text-[#00D2FF]" />;
      case 'linkedin':
        return <Linkedin className="w-5 h-5 text-[#7AA2F7]" />;
      case 'x':
        return <Twitter className="w-5 h-5 text-[#BB9AFF]" />;
      case 'tiktok':
        return <Video className="w-5 h-5 text-[#00D2FF]" />;
      default:
        return <Globe className="w-5 h-5 text-[#BB9AFF]" />;
    }
  };

  return (
    <div
      className="min-h-screen bg-[#03030F] text-[#F4F6FB] relative selection:bg-[#00D2FF]/30 selection:text-[#00D2FF]"
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={async (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file && file.type.startsWith('image/') && /rupam|logo/i.test(file.name)) {
          e.preventDefault();
          await uploadExactLogoFile(file);
        }
      }}
    >
      {/* LOADING / SPLASH SCREEN WITH OFFICIAL WEBSITE LOGO */}
      {showSplash && (
        <div
          aria-label="Loading Rupam Portfolio"
          className="fixed inset-0 z-50 bg-[#03030F] flex flex-col items-center justify-center gap-5 transition-opacity duration-300"
        >
          <BrandLogo size="2xl" />
          <div className="w-36 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-full bg-gradient-to-r from-[#00D2FF] via-[#7AA2F7] to-[#BB9AFF] animate-pulse" />
          </div>
        </div>
      )}

      {/* Subtle Ambient Studio Glow Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] rounded-full bg-[#00D2FF]/[0.06] blur-[130px]" />
        <div className="absolute top-1/3 -right-32 w-[460px] h-[460px] rounded-full bg-[#7AA2F7]/[0.06] blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 w-[480px] h-[480px] rounded-full bg-[#BB9AFF]/[0.04] blur-[140px]" />
      </div>

      {/* STICKY TOP NAVIGATION BAR (Strict 3-Zone Top Bar Contract) */}
      <header className="sticky top-0 z-40 bg-[#03030F]/85 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Single official brand logo */}
          <a
            href="#home"
            onClick={() => trackPageVisit('Home')}
            className="inline-flex items-center shrink-0 focus:outline-none"
            aria-label="Rafiul Islam Rupam Official Logo — Home"
          >
            <BrandLogo size="md" />
          </a>

          {/* Zone 2: Clean text navigation links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#94A3B8]"
          >
            <a
              href="#home"
              onClick={() => trackPageVisit('Home')}
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              Home
            </a>
            <a
              href="#about"
              onClick={() => trackPageVisit('About')}
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              About
            </a>
            <a
              href="#work"
              onClick={() => trackPageVisit('Work')}
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              Work
            </a>
            <a
              href="#services"
              onClick={() => trackPageVisit('Services')}
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              Services
            </a>
            <a
              href="#socials"
              onClick={() => trackPageVisit('Socials')}
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              Socials
            </a>
            <a
              href="#client-upload"
              onClick={() => trackPageVisit('Client Upload')}
              className="hover:text-[#00D2FF] transition-colors whitespace-nowrap"
            >
              Client Upload
            </a>
            <a
              href="#contact"
              onClick={() => trackPageVisit('Contact')}
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              Contact
            </a>
          </nav>

          {/* Zone 3: Primary actions (Continue with Google + Separate Admin Login) */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            {!currentUser ? (
              <button
                type="button"
                onClick={handleVisitorGoogleSignIn}
                disabled={isSigningInGoogle}
                className="gsi-material-button"
                title="By signing in with Google, you agree that your basic account information may be used for portfolio visitor and communication management."
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      ></path>
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      ></path>
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      ></path>
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      ></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isSigningInGoogle ? 'Signing in...' : 'Continue with Google'}
                  </span>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0B0D1E] border border-white/10 text-xs">
                <span className="text-[#CBD5E1] truncate max-w-[140px]">{currentUser.name}</span>
                <button
                  type="button"
                  onClick={handleVisitorSignOut}
                  className="text-[#94A3B8] hover:text-white cursor-pointer"
                  title="Sign out of Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setAdminModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/15 bg-white/[0.03] hover:border-[#00D2FF]/50 text-xs font-medium text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-[#00D2FF]" />
              <span>Admin Login</span>
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-[#CBD5E1] hover:text-white hover:bg-white/5 cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#080A18] border-b border-white/10 px-6 py-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <a
                href="#home"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex items-center gap-3"
              >
                <BrandLogo size="md" />
                <span className="text-sm font-bold text-white">Rafiul Islam Rupam</span>
              </a>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white"
                aria-label="Close Mobile Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm font-medium text-[#CBD5E1]">
              <a
                href="#home"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white"
              >
                Home
              </a>
              <a
                href="#about"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white"
              >
                About
              </a>
              <a
                href="#work"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white"
              >
                Work
              </a>
              <a
                href="#services"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white"
              >
                Services
              </a>
              <a
                href="#socials"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white"
              >
                Socials
              </a>
              <a
                href="#client-upload"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 text-[#00D2FF]"
              >
                Client Upload
              </a>
              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white"
              >
                Contact
              </a>
            </div>

            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-3">
              {!currentUser ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleVisitorGoogleSignIn();
                  }}
                  className="gsi-material-button"
                >
                  <div className="gsi-material-button-content-wrapper">
                    <span className="gsi-material-button-contents">Continue with Google</span>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleVisitorSignOut}
                  className="px-3 py-2 rounded-lg bg-white/10 text-xs text-white"
                >
                  Sign Out ({currentUser.name})
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAdminModalOpen(true);
                }}
                className="px-4 py-2 rounded-lg border border-white/15 text-xs font-medium text-white"
              >
                Admin Login
              </button>
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="relative z-10">
        {/* SECTION 3: HERO SECTION */}
        <section id="home" className="pt-16 pb-24 md:pt-24 md:pb-32 overflow-hidden">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
              {/* Left Column: Headline, Subheading, CTAs, and Privacy-Compliant Google Sign-In */}
              <div className="lg:col-span-7 space-y-7">
                <div className="flex items-center gap-3.5">
                  <BrandLogo size="lg" />
                  <div className="text-xs font-mono tracking-wider text-[#00D2FF]">
                    Rafiul Islam Rupam · Video Editor &amp; Motion Graphics Designer · Bangladesh
                  </div>
                </div>

                <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.08] [text-wrap:balance]">
                  We Capture. We Edit.{' '}
                  <span className="bg-gradient-to-r from-[#00D2FF] via-[#7AA2F7] to-[#BB9AFF] bg-clip-text text-transparent">
                    We Perfect.
                  </span>
                </h1>

                <p className="text-xl sm:text-2xl font-medium text-[#E2E8F0]">
                  Video Editor &amp; Motion Graphics Designer
                </p>

                <p className="text-[#94A3B8] text-base sm:text-lg leading-relaxed max-w-2xl">
                  Transforming raw footage into polished, engaging, and professional visual content.
                  Specializing in narrative video editing, kinetic motion graphics, color grading,
                  YouTube production, and high-impact visual design.
                </p>

                {/* Primary Hero Buttons */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <a
                    href="#work"
                    onClick={() => trackPageVisit('Work')}
                    className="px-7 py-3.5 rounded-xl bg-[#00D2FF] text-[#03030F] font-semibold text-sm hover:bg-[#33DBFF] transition-colors whitespace-nowrap shadow-[0_0_25px_rgba(0,210,255,0.25)]"
                  >
                    View My Work
                  </a>
                  <a
                    href="#contact"
                    onClick={() => trackPageVisit('Contact')}
                    className="px-7 py-3.5 rounded-xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 text-white font-semibold text-sm transition-colors whitespace-nowrap"
                  >
                    Let&apos;s Connect
                  </a>
                </div>

                {/* Optional Visitor Google Sign-In Card with Mandatory Consent Notice */}
                <div className="pt-6 border-t border-white/[0.08] max-w-xl space-y-2.5">
                  <div className="flex flex-wrap items-center gap-4">
                    {!currentUser ? (
                      <button
                        type="button"
                        onClick={handleVisitorGoogleSignIn}
                        disabled={isSigningInGoogle}
                        className="gsi-material-button"
                      >
                        <div className="gsi-material-button-state"></div>
                        <div className="gsi-material-button-content-wrapper">
                          <div className="gsi-material-button-icon">
                            <svg
                              version="1.1"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 48 48"
                              style={{ display: 'block' }}
                            >
                              <path
                                fill="#EA4335"
                                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                              ></path>
                              <path
                                fill="#4285F4"
                                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                              ></path>
                              <path
                                fill="#FBBC05"
                                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                              ></path>
                              <path
                                fill="#34A853"
                                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                              ></path>
                              <path fill="none" d="M0 0h48v48H0z"></path>
                            </svg>
                          </div>
                          <span className="gsi-material-button-contents">
                            {isSigningInGoogle ? 'Connecting...' : 'Continue with Google'}
                          </span>
                        </div>
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-2 text-xs text-emerald-300 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>
                          Connected as {currentUser.name} ({currentUser.email})
                        </span>
                      </div>
                    )}

                    {googleAuthFeedback && (
                      <span className="text-xs text-[#00D2FF]">{googleAuthFeedback}</span>
                    )}
                  </div>

                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    By signing in with Google, you agree that your basic account information (such
                    as your name and email) may be used for portfolio visitor and communication
                    management.
                  </p>
                </div>
              </div>

              {/* Right Column: Hero Portrait Frame with Subtle Motion-Graphics Backdrop */}
              <div className="lg:col-span-5 relative">
                {/* Subtle animated motion-graphics-inspired orbital lines behind portrait */}
                <div
                  aria-hidden="true"
                  className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-[#00D2FF]/20 via-[#7AA2F7]/10 to-[#BB9AFF]/20 blur-2xl opacity-70"
                />

                <div className="relative rounded-2xl bg-[#0B0D1E] border border-white/10 overflow-hidden shadow-2xl">
                  <div className="aspect-[4/5] w-full relative bg-gradient-to-b from-[#0E1329] via-[#080B1A] to-[#03030F] flex flex-col items-center justify-center overflow-hidden">
                    {profileImage ? (
                      <img
                        src={profileImage}
                        alt="Rafiul Islam Rupam — Video Editor & Motion Graphics Designer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full p-6 pb-20 flex items-center justify-center">
                        <BrandLogo
                          size="hero"
                          className="w-full h-full"
                          imgClassName="w-full h-full object-contain"
                        />
                      </div>
                    )}

                    {/* Bottom Scrim & Upload / Change Personal Photo Action */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-5 flex items-end justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <BrandLogo size="sm" />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">Rafiul Islam Rupam</div>
                          <div className="text-xs text-[#CBD5E1] truncate">
                            Video Editing · Motion Graphics · Color Grading
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <label
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
                          title="Upload your personal portrait image"
                        >
                          <Camera className="w-3.5 h-3.5 text-[#00D2FF]" />
                          <span>{profileImage ? 'Change Photo' : 'Upload Photo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleHeroPhotoUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: ABOUT ME */}
        <section id="about" className="py-24 border-t border-white/[0.07]">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              <div className="lg:col-span-5 space-y-3">
                <div className="text-xs font-mono tracking-wider text-[#00D2FF]">01. About Me</div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
                  Rafiul Islam Rupam
                </h2>
                <p className="text-sm text-[#7AA2F7] font-medium">
                  Video Editor, Motion Graphics Designer &amp; Visual Content Creator from
                  Bangladesh
                </p>
              </div>

              <div className="lg:col-span-7 space-y-6 text-[#CBD5E1] text-base leading-relaxed">
                <p>
                  I am <strong className="text-white font-semibold">Rafiul Islam Rupam</strong>, a
                  dedicated Video Editor, Motion Graphics Designer, and Visual Content Creator
                  based in Bangladesh. I focus on shaping raw footage and creative concepts into
                  clear, purposeful visual stories.
                </p>
                <p>
                  My work spans narrative video editing, custom motion graphics, visual
                  storytelling, color grading, YouTube video production, vertical short-form social
                  media edits, high-impact thumbnail design, logo animation, and promotional
                  digital design. Every timeline is approached with careful attention to pacing,
                  visual rhythm, audio clarity, and cohesive aesthetics.
                </p>

                {/* Primary Focus Areas rendered as clean unboxed editorial grid */}
                <div className="pt-6 border-t border-white/[0.07] grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 text-sm text-[#94A3B8]">
                  <div>01. Video Editing &amp; Visual Storytelling</div>
                  <div>02. Motion Graphics &amp; Motion Design</div>
                  <div>03. YouTube &amp; Social Media Video Editing</div>
                  <div>04. Color Grading &amp; Look Development</div>
                  <div>05. Thumbnail &amp; Graphic Design</div>
                  <div>06. Logo Animation &amp; Promotional Video</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTIONS 5 & 6: MY WORK / PORTFOLIO + VIDEO SHOWCASE */}
        <PortfolioSection
          projects={projects}
          onAddProject={handleAddProject}
          onTrackPage={trackPageVisit}
        />

        {/* SECTION 11 & 12: SERVICES & SOFTWARE SKILLS */}
        <section id="services" className="py-24 border-t border-white/[0.07]">
          <div className="max-w-[1200px] mx-auto px-6 space-y-20">
            {/* Services Grid */}
            <div className="space-y-12">
              <div className="space-y-3 max-w-2xl">
                <div className="text-xs font-mono tracking-wider text-[#00D2FF]">
                  04. Capabilities &amp; Disciplines
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
                  Services
                </h2>
                <p className="text-[#94A3B8] text-base">
                  Comprehensive post-production, motion design, and visual content creation tailored
                  for creators, channels, and brands.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {SERVICES_LIST.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-6 rounded-2xl bg-[#0B0D1E] border border-white/[0.07] hover:border-[#00D2FF]/35 transition-colors flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-3">
                      <h3 className="text-lg font-bold text-white">
                        <span className="font-mono text-xs text-[#00D2FF] mr-2">{srv.index}.</span>
                        {srv.title}
                      </h3>
                      <p className="text-sm text-[#94A3B8] leading-relaxed">{srv.description}</p>
                    </div>
                    <div className="pt-4 border-t border-white/[0.06] text-xs text-[#64748B]">
                      {srv.deliverables}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Software / Tools Section */}
            <div className="pt-12 border-t border-white/[0.07] space-y-8">
              <div className="space-y-2">
                <div className="text-xs font-mono tracking-wider text-[#7AA2F7]">
                  Post-Production Suite
                </div>
                <h3 className="text-2xl font-bold text-white">Software &amp; Creative Tools</h3>
                <p className="text-sm text-[#94A3B8]">
                  Industry-standard editing, motion design, color grading, and graphic design
                  applications I work with.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {SOFTWARE_SKILLS.map((tool) => (
                  <div
                    key={tool.id}
                    className="p-5 rounded-2xl bg-[#0B0D1E] border border-white/[0.07] hover:border-white/20 transition-colors space-y-3"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#03030F] border border-white/10 flex items-center justify-center font-mono font-bold text-base text-[#00D2FF]">
                      {tool.shortCode}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-white">{tool.name}</div>
                      <p className="text-xs text-[#94A3B8] leading-relaxed">{tool.discipline}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7: SOCIAL MEDIA HUB ("FIND ME ONLINE") */}
        <section id="socials" className="py-24 border-t border-white/[0.07] bg-[#050614]/60">
          <div className="max-w-[1200px] mx-auto px-6 space-y-12">
            <div className="space-y-3 max-w-2xl">
              <div className="text-xs font-mono tracking-wider text-[#00D2FF]">
                05. Official Channels &amp; Profiles
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
                Find Me Online
              </h2>
              <p className="text-[#94A3B8] text-base">
                Connect with Rafiul Islam Rupam across YouTube, Instagram, TikTok, Facebook, X,
                LinkedIn, and portfolio archives.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {socialProfiles.map((soc) => (
                <div
                  key={soc.id}
                  className="p-6 rounded-2xl bg-[#0B0D1E] border border-white/[0.08] hover:border-[#00D2FF]/40 transition-colors flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-[#03030F] border border-white/10 flex items-center justify-center">
                        {renderSocialIcon(soc.id)}
                      </div>
                      <span className="text-xs font-mono text-[#94A3B8]">{soc.platform}</span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white">{soc.platform}</h3>
                      <div className="text-xs font-mono text-[#00D2FF] mt-0.5 truncate">
                        {soc.handle}
                      </div>
                    </div>

                    <p className="text-xs text-[#94A3B8] leading-relaxed">{soc.description}</p>
                  </div>

                  <div className="pt-3 border-t border-white/[0.06]">
                    <a
                      href={soc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-[#00D2FF] hover:text-[#03030F] text-xs font-semibold text-white transition-colors"
                    >
                      <span>Visit Profile</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CLIENT VIDEO UPLOAD SYSTEM — GOOGLE DRIVE */}
        <ClientUploadSection
          userAccessToken={userAccessToken}
          onTrackPage={trackPageVisit}
        />

        {/* SECTION 13: CONTACT SECTION ("LET'S WORK TOGETHER") */}
        <section id="contact" className="py-24 border-t border-white/[0.07]">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              {/* Left Column: Direct Email & Actions */}
              <div className="lg:col-span-5 space-y-6">
                <div className="flex items-center gap-3.5">
                  <BrandLogo size="lg" />
                  <div className="text-xs font-mono tracking-wider text-[#00D2FF]">
                    07. Project Inquiries &amp; Collaboration
                  </div>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
                  Let&apos;s Work Together
                </h2>
                <p className="text-[#94A3B8] text-base leading-relaxed">
                  Have raw footage ready for editing, need custom motion graphics, or looking for a
                  dedicated video editor for your channel or brand? Send a message or email me
                  directly.
                </p>

                <div className="p-5 rounded-2xl bg-[#0B0D1E] border border-white/[0.08] space-y-4">
                  <div className="space-y-1">
                    <div className="text-xs text-[#94A3B8]">Direct Email</div>
                    <div className="text-sm sm:text-base font-mono font-medium text-white break-all">
                      {OWNER_EMAIL}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={`mailto:${OWNER_EMAIL}`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00D2FF] text-[#03030F] text-xs font-semibold hover:bg-[#33DBFF] transition-colors whitespace-nowrap"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Email Me</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-medium text-white transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {copiedEmail ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Email Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-[#00D2FF]" />
                          <span>Copy Email</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Contact Form -> Google Sheets + Gmail Notification */}
              <div className="lg:col-span-7">
                <form
                  onSubmit={handleContactSubmit}
                  className="p-6 sm:p-8 rounded-2xl bg-[#0B0D1E] border border-white/[0.08] space-y-5"
                >
                  <div className="flex items-center gap-3">
                    <BrandLogo size="sm" />
                    <h3 className="text-lg font-bold text-white">Send a Project Message</h3>
                  </div>

                  {contactError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{contactError}</span>
                    </div>
                  )}

                  {contactSuccess && (
                    <div
                      role="status"
                      className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5"
                    >
                      <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Message Sent Successfully</span>
                      </div>
                      <p className="text-xs text-emerald-200/90">
                        Thank you for contacting me. I’ll get back to you as soon as possible.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="contact-name"
                        className="block text-xs font-medium text-[#CBD5E1] mb-1.5"
                      >
                        Name *
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Your Name"
                        className="w-full px-4 py-3 rounded-xl bg-[#03030F] border border-white/10 text-white text-sm focus:outline-none focus:border-[#00D2FF] transition-colors"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="contact-email"
                        className="block text-xs font-medium text-[#CBD5E1] mb-1.5"
                      >
                        Email *
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-4 py-3 rounded-xl bg-[#03030F] border border-white/10 text-white text-sm focus:outline-none focus:border-[#00D2FF] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="contact-subject"
                      className="block text-xs font-medium text-[#CBD5E1] mb-1.5"
                    >
                      Subject / Project Type *
                    </label>
                    <input
                      id="contact-subject"
                      type="text"
                      required
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      placeholder="e.g. YouTube Video Editing / Motion Graphics / Commercial Cut"
                      className="w-full px-4 py-3 rounded-xl bg-[#03030F] border border-white/10 text-white text-sm focus:outline-none focus:border-[#00D2FF] transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-message"
                      className="block text-xs font-medium text-[#CBD5E1] mb-1.5"
                    >
                      Message *
                    </label>
                    <textarea
                      id="contact-message"
                      rows={4}
                      required
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Tell me about your project, timeline, and video requirements..."
                      className="w-full px-4 py-3 rounded-xl bg-[#03030F] border border-white/10 text-white text-sm focus:outline-none focus:border-[#00D2FF] transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingContact}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#00D2FF] text-[#03030F] font-semibold text-sm hover:bg-[#33DBFF] transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingContact ? 'Sending Message...' : 'Send Message'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* SECTION 19: MINIMAL PREMIUM FOOTER */}
      <footer className="border-t border-white/[0.08] bg-[#02020A] py-12 relative z-10">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <a href="#home" aria-label="Rafiul Islam Rupam Official Logo">
              <BrandLogo size="lg" />
            </a>
            <div className="space-y-1">
              <div className="text-lg font-bold text-white font-display">Rafiul Islam Rupam</div>
              <div className="text-xs text-[#94A3B8]">
                Video Editor &amp; Motion Graphics Designer
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-[#94A3B8]">
            <a
              href="https://www.youtube.com/@RafiuzzamanGlitchX"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#00D2FF] transition-colors"
            >
              YouTube
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://www.instagram.com/md.rafiulrupam/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#00D2FF] transition-colors"
            >
              Instagram
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://www.tiktok.com/@itsmerupamhere"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#00D2FF] transition-colors"
            >
              TikTok
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://www.facebook.com/profile.php?id=61574862845580"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#00D2FF] transition-colors"
            >
              Facebook
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://x.com/rafiul_rup34054"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#00D2FF] transition-colors"
            >
              X
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://www.linkedin.com/in/md-rafiul-islam-rupom-763594394/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#00D2FF] transition-colors"
            >
              LinkedIn
            </a>
          </div>

          <div className="text-xs text-[#64748B]">
            © 2026 Rafiul Islam Rupam. All rights reserved.
          </div>
        </div>
      </footer>

      {/* ADMIN LOGIN & ADMIN DASHBOARD MODAL */}
      <AdminDashboardModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        projects={projects}
        onUpdateProjects={handleUpdateProjects}
        profileImage={profileImage}
        onUpdateProfileImage={handleUpdateProfileImage}
        ownerAccessToken={userAccessToken}
        onSetOwnerAccessToken={(t) => setUserAccessToken(t)}
        currentUserEmail={currentUser?.email || null}
      />
    </div>
  );
}
