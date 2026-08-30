import { canUseCookies } from './consent';
import { CookieCategory } from './consent-types';

/**
 * Apply a theme and persist it, honouring cookie consent.
 *
 * Extracted from `ThemeSwitcher` (#382) because `/themes` now offers a second
 * way to switch — the curated plates — and this is more than a
 * `setAttribute` call: it writes html AND body, chooses storage based on
 * consent, broadcasts to other tabs, and tells the service worker. A second
 * copy would have drifted from the first the moment either changed, which is
 * the failure #408 removed from the theme LIST and would have reintroduced in
 * the theme ACTION.
 *
 * Callers own their own React state; this touches the DOM and storage only.
 */
export const DEFAULT_THEME = 'scripthammer-dark';

/**
 * Read the persisted theme, or null when nothing is stored.
 *
 * The consent-selected store is preferred, but the OTHER store is consulted as a
 * fallback, and that asymmetry is deliberate: consent governs whether we may
 * WRITE a value, not whether we may read one that is already sitting there.
 * Without the fallback, every visitor who chose a theme before persistence was
 * consent-gated (#1016) would silently lose it, because the nav used to write
 * localStorage unconditionally while a declined visitor now reads sessionStorage.
 *
 * Returns null rather than DEFAULT_THEME so a caller can tell "nothing stored"
 * from "stored the default" — GlobalNav needs that distinction to avoid stomping
 * the theme ThemeScript has already painted.
 */
export function readStoredThemeOrNull(): string | null {
  if (typeof window === 'undefined') return null;
  const preferred = canUseCookies(CookieCategory.FUNCTIONAL)
    ? window.localStorage
    : window.sessionStorage;
  const other =
    preferred === window.localStorage
      ? window.sessionStorage
      : window.localStorage;
  try {
    return preferred.getItem('theme') || other.getItem('theme') || null;
  } catch {
    // Safari private mode throws on access.
    return null;
  }
}

/** Read the persisted theme, falling back to the default. */
export function readStoredTheme(): string {
  return readStoredThemeOrNull() || DEFAULT_THEME;
}

export function applyTheme(theme: string): void {
  if (typeof document === 'undefined') return;

  // Both elements: `data-theme` on <body> is what the scoped swatches on
  // /themes and the home rail read from, and DaisyUI resolves tokens from the
  // nearest ancestor carrying it.
  document.documentElement.setAttribute('data-theme', theme);
  document.body?.setAttribute('data-theme', theme);

  // In-page broadcast, dispatched unconditionally because it touches no storage
  // and therefore carries no consent implication. GlobalNav used to dispatch this
  // itself (#1016); moving it here rather than dropping it keeps the one signal
  // that reaches a DECLINED visitor — the StorageEvent below is consent-gated, so
  // without this they would get no broadcast at all.
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));

  const canPersist = canUseCookies(CookieCategory.FUNCTIONAL);

  try {
    if (canPersist) {
      window.localStorage.setItem('theme', theme);
      window.sessionStorage.setItem('theme', theme);

      // Broadcast to other tabs — `storage` does not fire in the tab that
      // wrote it, so this is dispatched manually for same-tab listeners too.
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'theme',
          newValue: theme,
          url: window.location.href,
          storageArea: window.localStorage,
        })
      );
    } else {
      window.sessionStorage.setItem('theme', theme);
    }
  } catch {
    // Storage unavailable — the DOM attributes above still applied, so the
    // theme works for this page view even if it cannot be remembered.
  }

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'THEME_CHANGE',
      theme,
    });
  }
}
