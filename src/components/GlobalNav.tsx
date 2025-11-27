'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayeredScriptHammerLogo } from '@/components/atomic/SpinningLogo';
import { ColorblindToggle } from '@/components/atomic/ColorblindToggle';
import { FontSizeControl } from '@/components/navigation/FontSizeControl';
import { detectedConfig } from '@/config/project-detected';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import AvatarDisplay from '@/components/atomic/AvatarDisplay';
import { useUnreadCount } from '@/hooks/useUnreadCount';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function GlobalNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile();
  const unreadCount = useUnreadCount();
  const [theme, setTheme] = useState<string>('');
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Also set on body for consistency
    if (document.body) {
      document.body.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);

    // Also set on body for consistency
    if (document.body) {
      document.body.setAttribute('data-theme', newTheme);
    }

    // Dispatch custom event for other components to listen to
    window.dispatchEvent(
      new CustomEvent('themechange', {
        detail: { theme: newTheme },
      })
    );
  };

  // PWA installation
  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowInstallButton(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowInstallButton(false);
    }
    setDeferredPrompt(null);
  };

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/blog', label: 'Blog' },
    { href: '/docs', label: 'Docs' },
  ];

  const themes = [
    'light',
    'dark',
    'cupcake',
    'bumblebee',
    'emerald',
    'corporate',
    'synthwave',
    'retro',
    'cyberpunk',
    'valentine',
    'halloween',
    'garden',
    'forest',
    'aqua',
    'lofi',
    'pastel',
    'fantasy',
    'wireframe',
    'black',
    'luxury',
    'dracula',
    'cmyk',
    'autumn',
    'business',
    'acid',
    'lemonade',
    'night',
    'coffee',
    'winter',
    'dim',
    'nord',
    'sunset',
  ];

  return (
    <nav className="border-base-300 bg-base-100/95 sticky top-0 z-50 border-b shadow-sm backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <div className="h-8 w-8">
                <LayeredScriptHammerLogo
                  size={32}
                  speed="slow"
                  className="drop-shadow-sm"
                />
              </div>
              <span className="hidden text-xl font-bold sm:block">
                {detectedConfig.projectName}
              </span>
            </Link>
          </div>

          {/* Main Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`btn btn-ghost btn-sm ${
                  pathname === item.href ||
                  (pathname?.startsWith(item.href + '/') && item.href !== '/')
                    ? 'btn-active'
                    : ''
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right Section: Auth, Theme & PWA - Mobile-first spacing (PRP-017 T025) */}
          <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2">
            {/* Messages Icon (authenticated users only) */}
            {user && (
              <Link
                href="/messages"
                className="btn btn-ghost btn-circle indicator min-h-11 min-w-11"
                title="Messages"
                aria-label="Messages"
              >
                {unreadCount > 0 && (
                  <span className="indicator-item badge badge-primary badge-sm">
                    {unreadCount}
                  </span>
                )}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </Link>
            )}

            {/* Auth Buttons */}
            {user ? (
              <div className="dropdown dropdown-end">
                <label
                  tabIndex={0}
                  className="btn btn-ghost btn-circle avatar min-h-11 min-w-11"
                  aria-label="User account menu"
                >
                  <AvatarDisplay
                    avatarUrl={
                      profile?.avatar_url ||
                      (user.user_metadata?.avatar_url as string) ||
                      null
                    }
                    displayName={profile?.display_name || user.email || 'User'}
                    size="sm"
                  />
                </label>
                <ul
                  tabIndex={0}
                  className="menu menu-sm dropdown-content bg-base-100 rounded-box -right-2 z-[1] mt-3 w-48 max-w-[calc(100vw-4rem)] p-2 shadow sm:w-52"
                >
                  <li className="menu-title">
                    <span>{user.email}</span>
                  </li>
                  <li>
                    <Link href="/profile">Profile</Link>
                  </li>
                  <li>
                    <Link href="/account">Account Settings</Link>
                  </li>
                  <li>
                    <Link
                      href="/messages"
                      className="flex items-center justify-between"
                    >
                      <span>Messages</span>
                      {unreadCount > 0 && (
                        <span className="badge badge-primary badge-sm">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  </li>
                  <li>
                    <Link href="/messages?tab=connections">Connections</Link>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        // Close dropdown
                        if (document.activeElement instanceof HTMLElement) {
                          document.activeElement.blur();
                        }
                        // Sign out and redirect
                        signOut().then(() => {
                          window.location.href = '/';
                        });
                      }}
                    >
                      Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="btn btn-ghost btn-sm min-h-11 min-w-11"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="btn btn-primary btn-sm min-h-11 min-w-11"
                >
                  Sign Up
                </Link>
              </>
            )}

            {/* Mobile Menu - 44px touch target */}
            <div className="dropdown dropdown-end md:hidden">
              <label
                tabIndex={0}
                className="btn btn-ghost btn-circle min-h-11 min-w-11"
                aria-label="Navigation menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </label>
              <ul
                tabIndex={0}
                className="menu menu-sm dropdown-content bg-base-100 rounded-box -right-2 z-[1] mt-3 w-40 max-w-[calc(100vw-4rem)] p-2 shadow sm:w-44"
              >
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={pathname === item.href ? 'active' : ''}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                {user ? (
                  <>
                    <li className="menu-title mt-2">
                      <span>Account</span>
                    </li>
                    <li>
                      <Link href="/profile">Profile</Link>
                    </li>
                    <li>
                      <Link href="/account">Settings</Link>
                    </li>
                    <li>
                      <Link
                        href="/messages"
                        className="flex items-center justify-between"
                      >
                        <span>Messages</span>
                        {unreadCount > 0 && (
                          <span className="badge badge-primary badge-sm">
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                    </li>
                    <li>
                      <Link href="/messages?tab=connections">Connections</Link>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          // Close dropdown
                          if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                          }
                          // Sign out and redirect
                          signOut().then(() => {
                            window.location.href = '/';
                          });
                        }}
                      >
                        Sign Out
                      </button>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="menu-title mt-2">
                      <span>Account</span>
                    </li>
                    <li>
                      <Link href="/sign-in">Sign In</Link>
                    </li>
                    <li>
                      <Link href="/sign-up">Sign Up</Link>
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* PWA Install Button */}
            {showInstallButton && !isInstalled && (
              <button
                onClick={handleInstallClick}
                className="btn btn-primary btn-sm min-h-11 min-w-11"
                title="Progressive Web App (PWA) - Install this app for offline access and better performance"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 stroke-current"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span className="hidden lg:inline">Install App</span>
              </button>
            )}

            {/* Font Size Control */}
            <FontSizeControl />

            {/* Color Vision Control */}
            <ColorblindToggle className="compact" />

            {/* Theme Selector - Mobile-first touch targets */}
            <div className="dropdown dropdown-end">
              <label
                tabIndex={0}
                className="btn btn-ghost btn-circle min-h-11 min-w-11"
                title="Change theme"
                aria-label="Change theme"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                  />
                </svg>
              </label>
              <ul
                tabIndex={0}
                className="dropdown-content bg-base-100 rounded-box z-[1] max-h-96 w-44 max-w-[calc(100vw-4rem)] overflow-y-auto p-2 shadow-lg sm:w-52"
              >
                {themes.map((t) => (
                  <li key={t}>
                    <button
                      className={`btn btn-ghost btn-sm w-full justify-start ${theme === t ? 'btn-active' : ''}`}
                      onClick={() => handleThemeChange(t)}
                    >
                      <span className="capitalize">{t}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
