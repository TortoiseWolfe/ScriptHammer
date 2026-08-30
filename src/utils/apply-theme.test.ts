import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  applyTheme,
  readStoredTheme,
  readStoredThemeOrNull,
  DEFAULT_THEME,
} from './apply-theme';
import { CONSENT_STORAGE_KEY } from '@/config/accessibility-tokens';

/**
 * #382 extracted this module so there would be ONE theme implementation, and then
 * nothing tested it — which is how GlobalNav came to carry a second copy that
 * ignored cookie consent for as long as it did (#1016). These are the assertions
 * that make "one implementation" a checked claim rather than a comment.
 */
const allowFunctional = () =>
  localStorage.setItem(
    CONSENT_STORAGE_KEY,
    JSON.stringify({ functional: true })
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.body.removeAttribute('data-theme');
});

afterEach(() => vi.restoreAllMocks());

describe('readStoredThemeOrNull', () => {
  it('returns null when nothing is stored', () => {
    // Distinct from DEFAULT_THEME on purpose: a caller cannot otherwise tell
    // "nothing stored" from "the default is stored", and GlobalNav needs that to
    // avoid stomping the theme ThemeScript already painted.
    expect(readStoredThemeOrNull()).toBeNull();
  });

  it('prefers localStorage once functional consent is granted', () => {
    allowFunctional();
    localStorage.setItem('theme', 'dracula');
    sessionStorage.setItem('theme', 'cupcake');
    expect(readStoredThemeOrNull()).toBe('dracula');
  });

  it('prefers sessionStorage when consent is declined', () => {
    localStorage.setItem('theme', 'dracula');
    sessionStorage.setItem('theme', 'cupcake');
    expect(readStoredThemeOrNull()).toBe('cupcake');
  });

  it('falls back to localStorage for a theme stored BEFORE the gate existed', () => {
    // No consent record, value only in localStorage — every visitor who picked a
    // theme while the nav wrote there unconditionally. Reading it back is not the
    // violation; writing it without consent was. Without this fallback they all
    // silently lose their theme the day the gate lands.
    localStorage.setItem('theme', 'nord');
    expect(readStoredThemeOrNull()).toBe('nord');
  });

  it('falls back to sessionStorage for a consenting visitor mid-session', () => {
    allowFunctional();
    sessionStorage.setItem('theme', 'cupcake');
    expect(readStoredThemeOrNull()).toBe('cupcake');
  });
});

describe('readStoredTheme', () => {
  it('answers the default when nothing is stored', () => {
    expect(readStoredTheme()).toBe(DEFAULT_THEME);
  });

  it('answers the stored value when there is one', () => {
    sessionStorage.setItem('theme', 'cupcake');
    expect(readStoredTheme()).toBe('cupcake');
  });
});

describe('applyTheme', () => {
  it('paints html AND body', () => {
    applyTheme('dracula');
    // body matters: /themes' curated plates and the home rail read from the
    // nearest ancestor carrying data-theme.
    expect(document.documentElement.getAttribute('data-theme')).toBe('dracula');
    expect(document.body.getAttribute('data-theme')).toBe('dracula');
  });

  it('persists to BOTH stores once consent is granted', () => {
    allowFunctional();
    applyTheme('dracula');
    expect(localStorage.getItem('theme')).toBe('dracula');
    expect(sessionStorage.getItem('theme')).toBe('dracula');
  });

  it('persists ONLY to sessionStorage when consent is declined', () => {
    applyTheme('cupcake');
    // The whole point of the gate. Declining costs persistence across visits,
    // not the ability to choose a theme.
    expect(localStorage.getItem('theme')).toBeNull();
    expect(sessionStorage.getItem('theme')).toBe('cupcake');
  });

  it('broadcasts themechange REGARDLESS of consent', () => {
    // It touches no storage, so it carries no consent implication — and it is
    // the only signal a declined visitor produces, since the StorageEvent below
    // is gated (#1016).
    const heard: string[] = [];
    const onChange = (e: Event) => heard.push((e as CustomEvent).detail.theme);
    window.addEventListener('themechange', onChange);
    applyTheme('cupcake');
    window.removeEventListener('themechange', onChange);
    expect(heard).toEqual(['cupcake']);
  });

  it('broadcasts a StorageEvent to other tabs ONLY with consent', () => {
    const withoutConsent: string[] = [];
    const spy = (e: Event) => {
      const se = e as StorageEvent;
      if (se.key === 'theme') withoutConsent.push(se.newValue ?? '');
    };
    window.addEventListener('storage', spy);
    applyTheme('cupcake');
    expect(withoutConsent).toEqual([]);

    allowFunctional();
    applyTheme('dracula');
    window.removeEventListener('storage', spy);
    // `storage` does not fire in the tab that wrote it, so applyTheme dispatches
    // it by hand for same-tab listeners too.
    expect(withoutConsent).toEqual(['dracula']);
  });

  it('still paints when storage throws, as it does in Safari private mode', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    applyTheme('nord');
    // The theme works for this page view even when it cannot be remembered.
    expect(document.documentElement.getAttribute('data-theme')).toBe('nord');
  });
});
