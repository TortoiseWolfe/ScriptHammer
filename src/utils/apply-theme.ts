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

/** Read the persisted theme, preferring whichever store consent allows. */
export function readStoredTheme(): string {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const store = canUseCookies(CookieCategory.FUNCTIONAL)
      ? window.localStorage
      : window.sessionStorage;
    return store.getItem('theme') || DEFAULT_THEME;
  } catch {
    // Safari private mode throws on access.
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme: string): void {
  if (typeof document === 'undefined') return;

  // Both elements: `data-theme` on <body> is what the scoped swatches on
  // /themes and the home rail read from, and DaisyUI resolves tokens from the
  // nearest ancestor carrying it.
  document.documentElement.setAttribute('data-theme', theme);
  document.body?.setAttribute('data-theme', theme);

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
