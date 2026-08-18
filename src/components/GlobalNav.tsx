'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayeredScriptHammerLogo } from '@/components/atomic/SpinningLogo';
import { AnimatedLogo } from '@/components/atomic/AnimatedLogo';
import { ColorVisionPanel } from '@/components/molecular/ColorblindToggle';
import { TextSettingsPanel } from '@/components/navigation/FontSizeControl';
import { detectedConfig } from '@/config/project-detected';
import { THEMES } from '@/config/themes';
import { getInternalUrl } from '@/config/project.config';
import { selectRenderer } from '@/twin/renderer-select';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import AvatarDisplay from '@/components/atomic/AvatarDisplay';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { AdminAuthService } from '@/services/admin/admin-auth-service';
import { createClient } from '@/lib/supabase/client';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Open state plus the three ways a nav popover must close: Escape (returning
 * focus to the trigger), a pointer press outside it, and tabbing out.
 *
 * Shared by {@link NavGroupMenu} and {@link NavPopover} so the keyboard contract
 * is written once. Both are React-owned rather than DaisyUI `:focus-within` —
 * with that pattern the trigger lives INSIDE `.dropdown`, so returning focus to
 * it re-opens the panel on the same frame.
 */
function useDismissable() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, setOpen, wrap, trigger };
}

/**
 * A nav popover holding CONTROLS rather than destinations (#378).
 *
 * Deliberately not a `role="menu"`. `NavGroupMenu` is correct for a list of
 * links, but a menu's children are `menuitem`s — putting a `<select>`, a toggle
 * and button groups inside one misdescribes them to a screen reader. This is a
 * disclosure: `aria-expanded` on the trigger, a plain panel, and the same
 * dismiss contract via {@link useDismissable}.
 *
 * `aria-haspopup="true"` rather than `"menu"` for the same reason.
 */
function NavPopover({
  label,
  triggerClass,
  icon,
  children,
}: {
  label: string;
  triggerClass: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { open, setOpen, wrap, trigger } = useDismissable();
  const triggerId = useId();

  return (
    <div
      ref={wrap}
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={label}
        className={triggerClass}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <span className="hidden lg:inline">{label}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          className="sh-plate bg-base-100 rounded-box absolute end-0 z-[1] mt-2 max-h-[80vh] w-72 max-w-[calc(100vw-1.5rem)] space-y-4 overflow-y-auto p-4"
          role="group"
          // NAMED BY THE TRIGGER, not by a second `aria-label={label}`.
          // Putting the same label on both put two elements in the
          // accessibility tree with one name — confusing to announce, and it
          // made `[aria-label="Display"]` resolve to two nodes, which is a
          // Playwright strict-mode violation. Caught by the new gate test.
          aria-labelledby={triggerId}
          data-testid={`nav-popover-${label.toLowerCase()}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * A nav group rendered as a real menu button (#378).
 *
 * NOT a DaisyUI `:focus-within` dropdown. That pattern cannot satisfy the
 * ticket's keyboard requirement, and the reason is structural rather than a
 * missing handler: the trigger lives INSIDE `.dropdown`, so "close the menu
 * and return focus to the trigger" re-opens it on the same frame. Measured —
 * Escape left the menu visible with focus correctly on the trigger.
 *
 * So the open state is React's, the trigger is a `<button>` carrying
 * `aria-expanded`/`aria-haspopup`, Escape closes and restores focus, and a
 * click or focus elsewhere dismisses it.
 */
function NavGroupMenu({
  label,
  triggerClass,
  children,
}: {
  label: string;
  triggerClass: string;
  children: React.ReactNode;
}) {
  const { open, setOpen, wrap, trigger } = useDismissable();

  return (
    <div
      ref={wrap}
      className="relative"
      // Tabbing out of the group closes it, so a keyboard user is never
      // dragging an open menu along behind them.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={triggerClass}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul
          role="menu"
          className="menu menu-sm bg-base-100 rounded-box absolute end-0 z-[1] mt-2 w-52 p-2 shadow-lg"
        >
          {children}
        </ul>
      )}
    </div>
  );
}

/**
 * Every item in a DaisyUI `menu` needs an explicit height floor: `li > a`
 * renders at 26px, and the 44px gate cannot see items inside a closed
 * dropdown, so they stay under it indefinitely (#378). Named rather than
 * repeated so a new entry cannot arrive without one.
 */
const MENU_ITEM = 'min-h-11 flex items-center';

/** A single nav destination. */
type NavLeaf = { href: string; label: string; reload?: boolean };
/** A labelled group of destinations, rendered as a dropdown. */
type NavGroup = { label: string; items: NavLeaf[] };
type NavEntry = NavLeaf | NavGroup;

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
  const [isAdmin, setIsAdmin] = useState(false);
  // Client-mount flag so the map nav highlight can read window.location.search
  // (the query that picks atlas vs diorama) without a hydration mismatch.
  const [mapMounted, setMapMounted] = useState(false);
  useEffect(() => setMapMounted(true), []);

  useEffect(() => {
    if (!user?.id) {
      setIsAdmin(false);
      return;
    }
    const supabase = createClient();
    const service = new AdminAuthService(supabase);
    service.checkIsAdmin(user.id).then(setIsAdmin);
  }, [user?.id]);

  // Theme management — read existing theme, don't overwrite ThemeScript's work.
  // ThemeScript runs before hydration and sets data-theme from localStorage
  // or system preference; we just sync React state to it here.
  useEffect(() => {
    const savedTheme =
      localStorage.getItem('theme') ||
      document.documentElement.getAttribute('data-theme') ||
      'scripthammer-dark';
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

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallButton(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
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

  // Two maps of Chattanooga: the Three.js diorama and the Cesium globe atlas.
  // `reload: true` forces a FULL-page navigation (plain <a>) instead of a client
  // Link — they share ONE route (/chatt) and differ only by ?diorama, but the
  // renderer (atlas vs diorama) is chosen from the query at MOUNT and is not
  // reactive, so a client-side query-only nav would keep the current renderer
  // and you could never switch atlas↔diorama. A hard nav re-reads the query
  // (and gives each heavy map a fresh WebGL context).
  // #378: Home lives on the logo (which already links to `/`), and the demos
  // are grouped. Atlas and Diorama are THE SAME ROUTE differing only by query
  // — two adjacent flat links pointing at one route is exactly what a group
  // expresses better. Grouping also surfaces Map, Game, Payments and Schedule,
  // which were in no nav at all and reachable only from the home page.
  //
  // Net: one fewer top-level slot, five more routes reachable.
  const navItems: NavEntry[] = [
    { href: '/docs', label: 'Docs' },
    { href: '/blog', label: 'Blog' },
    // Top-level so the walkable/bikeable 3D Chattanooga isn't buried under
    // Demos → Diorama → ⋯ → Walk. Deep-links straight in: ?diorama picks the
    // Three renderer, ?walk opens first-person Walk mode. reload:true so both
    // query flags are read at mount (same reason Atlas/Diorama reload below).
    { href: '/chatt?diorama&walk', label: 'Play', reload: true },
    // TOP LEVEL, deliberately not inside Demos. Until this landed, the only
    // payment-adjacent destination in the whole nav was `/payment-demo` labelled
    // "Payments" — a DEMO, sitting in the Demos menu between Diorama and Game.
    // Nothing anywhere led a buyer to a price. A storefront you cannot navigate to
    // is not a storefront.
    { href: '/pricing', label: 'Pricing' },
    {
      label: 'Demos',
      items: [
        // `reload: true` is load-bearing on both — Cesium needs a full document
        // load to get a fresh WebGL context, and a client-side nav cannot
        // re-read the ?diorama query. Grouping must not change that.
        { href: '/chatt', label: 'Atlas', reload: true },
        { href: '/chatt?diorama', label: 'Diorama', reload: true },
        { href: '/wireframes', label: 'Wireframes' },
        { href: '/map', label: 'Map' },
        { href: '/game', label: 'Game' },
        { href: '/payment-demo', label: 'Payments' },
        { href: '/schedule', label: 'Schedule' },
      ],
    },
    { href: '/themes', label: 'Themes' },
    { href: '/status', label: 'Status' },
  ];

  /** Every leaf, flattened — for the mobile menu and for active-state checks. */
  const navLeaves: NavLeaf[] = navItems.flatMap((e) =>
    'items' in e ? e.items : [e]
  );

  // The two map entries share the /chatt pathname and differ only by ?diorama,
  // so usePathname (query-blind) can't tell them apart — it would light up
  // "Atlas" even on the diorama. Reflect the ACTUAL renderer instead. Read the
  // query on the client only (mapMounted) to avoid a hydration mismatch; the map
  // links full-navigate, so the nav re-mounts and re-reads on every switch.
  const mapRenderer =
    mapMounted && typeof window !== 'undefined'
      ? selectRenderer(new URLSearchParams(window.location.search))
      : 'atlas';
  const isActive = (item: { href: string }): boolean => {
    if (item.href.startsWith('/chatt')) {
      const onChatt =
        pathname === '/chatt' || !!pathname?.startsWith('/chatt/');
      return (
        onChatt &&
        (item.href.includes('?diorama') ? 'diorama' : 'atlas') === mapRenderer
      );
    }
    return (
      pathname === item.href ||
      (!!pathname?.startsWith(item.href + '/') && item.href !== '/')
    );
  };

  return (
    // data-global-nav is a styling hook for the twin routes' glass treatment
    // (globals.css, #301). An attribute rather than [aria-label='...'] like the
    // rules next to it: coupling CSS to an accessible name means renaming the
    // label silently breaks the styling, and it gives the E2E specs a stable
    // selector. No logic here is route-aware — the CSS keys off a body class
    // TwinCanvasHost already sets.
    <header
      data-global-nav
      className="border-base-300 bg-base-100 sticky top-0 z-50 border-b shadow-sm"
    >
      {/* Same gutter ladder as `Footer.tsx:15` (#373 §A5). These two are
          siblings in one layout and had no reason to disagree: measured on prod,
          the nav's content edge sat at 18px from 320px all the way to 1280px
          while the footer's climbed 16 -> 24 -> 32, so the two landmarks framing
          every page were inset differently at every width above 428px. */}
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              // #378 moved Home onto the logo. Its visible text is the project
              // name, so without an explicit name nothing announces it as the
              // way home — and `a:has-text("Home")` in cross-page-navigation
              // had nothing left to match.
              aria-label={`${detectedConfig.projectName} — Home`}
              className="flex min-h-11 items-center gap-3 transition-opacity hover:opacity-80"
            >
              {/* The comp seats the mark in a 40px cut WELL, which is what
                  makes it read as a machined badge rather than a floating
                  image (#379). */}
              <span className="bg-base-100 sh-groove flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                <span className="h-[30px] w-[30px]">
                  <LayeredScriptHammerLogo />
                </span>
              </span>
              <span className="hidden sm:block">
                <AnimatedLogo
                  text={detectedConfig.projectName}
                  className="font-display !text-[17px] tracking-[-0.01em] uppercase"
                  animationSpeed="normal"
                />
              </span>
            </Link>
          </div>

          {/* Main Navigation */}
          <nav className="sh-rail hidden items-center lg:flex">
            {navItems.map((entry) => {
              // min-h-11 keeps the 44px target the repo gates on; the comp's
              // 33px rows are a desktop-only drawing.
              const base =
                'text-base-content inline-flex min-h-11 items-center rounded-full px-2.5 font-mono text-[11.5px] tracking-[.1em] uppercase transition-colors xl:px-3.5';

              if ('items' in entry) {
                const active = entry.items.some(isActive);
                return (
                  <NavGroupMenu
                    key={entry.label}
                    label={entry.label}
                    triggerClass={`${base} cursor-pointer gap-1 ${active ? 'sh-rail-active' : 'hover:bg-base-200'}`}
                  >
                    {entry.items.map((item) => (
                      <li key={item.href} role="none">
                        {item.reload ? (
                          <a
                            role="menuitem"
                            href={getInternalUrl(item.href)}
                            className={`min-h-11 ${isActive(item) ? 'active' : ''}`}
                          >
                            {item.label}
                          </a>
                        ) : (
                          <Link
                            role="menuitem"
                            href={item.href}
                            className={`min-h-11 ${isActive(item) ? 'active' : ''}`}
                          >
                            {item.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </NavGroupMenu>
                );
              }

              const cls = `${base} ${isActive(entry) ? 'sh-rail-active' : 'hover:bg-base-200'}`;
              return entry.reload ? (
                <a
                  key={entry.href}
                  href={getInternalUrl(entry.href)}
                  className={cls}
                >
                  {entry.label}
                </a>
              ) : (
                <Link key={entry.href} href={entry.href} className={cls}>
                  {entry.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Section: Auth, Theme & PWA - Mobile-first spacing (PRP-017 T025) */}
          {/* Use flex-shrink-0 to prevent items from shrinking, overflow-hidden to prevent horizontal scroll */}
          <div className="flex flex-shrink-0 items-center gap-0.5 sm:gap-1 md:gap-2">
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
            {/* User account dropdown (logged in) or auth buttons (logged out) */}
            {/* Auth buttons hidden on mobile - they're in the hamburger menu */}
            {user ? (
              <div className="dropdown dropdown-end">
                <label
                  tabIndex={0}
                  className="btn btn-ghost btn-circle min-h-11 min-w-11"
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
                    <Link href="/profile" className={MENU_ITEM}>
                      Profile
                    </Link>
                  </li>
                  <li>
                    <Link href="/account" className={MENU_ITEM}>
                      Account Settings
                    </Link>
                  </li>
                  <li>
                    {/* MENU_ITEM, not a bare flex: this was the only nav row
                        in the file with no height floor, and DaisyUI renders
                        `menu li > a` at 26px (#378). Its twin in the mobile
                        menu already reads the same. No gate caught it because
                        the touch-target sweep runs signed OUT and this row
                        only renders signed in (#502). */}
                    <Link
                      href="/messages"
                      className={`${MENU_ITEM} justify-between`}
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
                    <Link
                      href="/messages?tab=connections"
                      className={MENU_ITEM}
                    >
                      Connections
                    </Link>
                  </li>
                  {isAdmin && (
                    <li>
                      <Link href="/admin" className={MENU_ITEM}>
                        Admin Dashboard
                      </Link>
                    </li>
                  )}
                  <li>
                    {/* min-h-11: DaisyUI's menu default renders this at 26px,
                        18px under the 44px standard. It sits inside a closed
                        dropdown, so the touch-target gate never measured it
                        until that gate was taught to open the menu (#378). */}
                    <button
                      type="button"
                      className="min-h-11"
                      onClick={(e) => {
                        e.preventDefault();
                        // Close dropdown
                        if (document.activeElement instanceof HTMLElement) {
                          document.activeElement.blur();
                        }
                        // signOut() handles the window.location.href='/'
                        // redirect internally; setting it again here races
                        // with the in-flight navigation on Firefox and
                        // manifests as NS_BINDING_ABORTED in Playwright's
                        // page.waitForURL.
                        void signOut();
                      }}
                    >
                      Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            ) : (
              <>
                {/* The comp pairs a quiet text action with one lit pill.
                    Its pill says "Clone it"; ours stays Sign Up — this app has
                    real auth, and the primary nav action should be the one a
                    visitor actually needs. Same treatment, honest label. */}
                <Link
                  href="/sign-in"
                  className="text-base-content hidden min-h-11 min-w-11 items-center px-3 font-mono text-[11.5px] tracking-[.1em] uppercase lg:inline-flex"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="sh-btn sh-btn-primary hidden !min-w-11 !rounded-full !px-[18px] !py-[11px] !text-[11.5px] lg:inline-flex"
                >
                  Sign Up
                </Link>
              </>
            )}

            {/* Mobile/tablet menu (visible below lg) - 44px touch target */}
            <div className="dropdown dropdown-end lg:hidden">
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
                {navLeaves.map((item) => (
                  <li key={item.href}>
                    {item.reload ? (
                      <a
                        href={getInternalUrl(item.href)}
                        className={`${MENU_ITEM} ${isActive(item) ? 'active' : ''}`}
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className={`${MENU_ITEM} ${isActive(item) ? 'active' : ''}`}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
                {user ? (
                  <>
                    <li className="menu-title mt-2">
                      <span>Account</span>
                    </li>
                    <li>
                      <Link href="/profile" className={MENU_ITEM}>
                        Profile
                      </Link>
                    </li>
                    <li>
                      <Link href="/account" className={MENU_ITEM}>
                        Settings
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/messages"
                        className={`${MENU_ITEM} justify-between`}
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
                      <Link
                        href="/messages?tab=connections"
                        className={MENU_ITEM}
                      >
                        Connections
                      </Link>
                    </li>
                    {isAdmin && (
                      <li>
                        <Link href="/admin" className={MENU_ITEM}>
                          Admin Dashboard
                        </Link>
                      </li>
                    )}
                    <li>
                      {/* Same 26px default as the desktop menu above. */}
                      <button
                        type="button"
                        className="min-h-11"
                        onClick={(e) => {
                          e.preventDefault();
                          // Close dropdown
                          if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                          }
                          // signOut() handles the redirect internally.
                          void signOut();
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
                      <Link href="/sign-in" className={MENU_ITEM}>
                        Sign In
                      </Link>
                    </li>
                    <li>
                      <Link href="/sign-up" className={MENU_ITEM}>
                        Sign Up
                      </Link>
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

            {/* ONE `Display ▾` for every appearance setting (#378).
                Replaces three separate popovers — text settings, colour vision
                and theme — each of which was `hidden lg:block`. Measured: below
                1024px the hamburger holds 13 destinations and ZERO appearance
                controls, so on a phone there was no way to change the theme or
                the font size from the nav at all. The comment on the old font
                block claimed it was "accessible via hamburger"; it was not.

                No breakpoint gate here on purpose. The label text collapses
                below lg so the trigger stays icon-sized, but the control itself
                is present at every width.

                Named `Display`, NOT "Display menu": mobile-navigation.spec.ts
                locates `[aria-label*="menu" i]`, `.first()` follows document
                order and nav precedes page content, so a name containing "menu"
                shadows the mobile hamburger — #378's own earlier regression. */}
            <NavPopover
              label="Display"
              triggerClass="btn btn-ghost min-h-11 min-w-11 gap-1 px-2"
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                  />
                </svg>
              }
            >
              <TextSettingsPanel />
              <div className="divider my-0"></div>
              <ColorVisionPanel />
              <div className="divider my-0"></div>
              <div>
                <h3 className="mb-2 text-sm font-semibold tracking-wide uppercase">
                  Theme
                </h3>
                <ul>
                  {THEMES.map((t) => (
                    <li key={t}>
                      <button
                        type="button"
                        className={`btn btn-ghost min-h-11 w-full justify-start ${theme === t ? 'btn-active' : ''}`}
                        onClick={() => handleThemeChange(t)}
                        aria-current={theme === t ? 'true' : undefined}
                      >
                        <span className="capitalize">{t}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </NavPopover>
          </div>
        </div>
      </nav>
    </header>
  );
}
