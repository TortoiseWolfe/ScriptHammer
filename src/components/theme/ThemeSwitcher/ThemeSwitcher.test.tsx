import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeSwitcher } from './ThemeSwitcher';
import {
  THEMES,
  THEME_COUNT,
  HOUSE_THEME_COUNT,
  DAISYUI_THEME_COUNT,
} from '@/config/themes';
import { DEFAULT_THEME } from '@/utils/apply-theme';
import { CONSENT_STORAGE_KEY } from '@/config/accessibility-tokens';

const trackThemeChange = vi.fn();
vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({ trackThemeChange }),
}));

/** Grant functional consent, which is what moves persistence to localStorage. */
const allowFunctional = () =>
  localStorage.setItem(
    CONSENT_STORAGE_KEY,
    JSON.stringify({ functional: true })
  );

beforeEach(() => {
  trackThemeChange.mockClear();
  localStorage.clear();
  // sessionStorage too: applyTheme writes there on EVERY path, consent or not, so
  // leaving it set carries one test's chosen theme into the next mount. That is
  // what made the analytics case report ('cupcake', 'cupcake') the first time.
  sessionStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeSwitcher', () => {
  it('offers every configured theme — the count is derived, not typed', () => {
    render(<ThemeSwitcher />);
    // #514: both numbers used to be hardcoded and happened to be right, which is
    // how a claim goes stale on a live page with nothing checking it.
    for (const theme of THEMES) {
      expect(screen.getByRole('button', { name: theme })).toBeInTheDocument();
    }
    expect(
      screen.getByText(
        `Choose from ${THEME_COUNT} themes (${HOUSE_THEME_COUNT} house + ${DAISYUI_THEME_COUNT} DaisyUI)`
      )
    ).toBeInTheDocument();
    expect(HOUSE_THEME_COUNT + DAISYUI_THEME_COUNT).toBe(THEME_COUNT);
  });

  it('applies the stored theme to <html> on mount, WITH functional consent', async () => {
    allowFunctional();
    localStorage.setItem('theme', THEMES[3]);
    render(<ThemeSwitcher />);
    await vi.waitFor(() =>
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        THEMES[3]
      )
    );
  });

  it('reads sessionStorage instead when functional cookies are declined', async () => {
    // The gate is the point: a declined visitor still gets their theme for the
    // session, and the localStorage value is NOT consulted. Both halves are
    // asserted, because checking only the session value would still pass if the
    // gate disappeared entirely.
    sessionStorage.setItem('theme', THEMES[3]);
    localStorage.setItem('theme', THEMES[7]);
    render(<ThemeSwitcher />);
    await vi.waitFor(() =>
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        THEMES[3]
      )
    );
  });

  it('falls back to the default theme when nothing is stored', async () => {
    render(<ThemeSwitcher />);
    await vi.waitFor(() =>
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        DEFAULT_THEME
      )
    );
  });

  it('applies a chosen theme to the document', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.click(screen.getByRole('button', { name: THEMES[5] }));
    expect(document.documentElement.getAttribute('data-theme')).toBe(THEMES[5]);
  });

  it('reports the change to analytics WITH the theme it replaced', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.click(screen.getByRole('button', { name: THEMES[5] }));
    expect(trackThemeChange).toHaveBeenCalledWith(THEMES[5], DEFAULT_THEME);

    await user.click(screen.getByRole('button', { name: THEMES[6] }));
    expect(trackThemeChange).toHaveBeenLastCalledWith(THEMES[6], THEMES[5]);
  });

  it('marks the active theme, and only the active one', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.click(screen.getByRole('button', { name: THEMES[5] }));
    expect(screen.getByRole('button', { name: THEMES[5] })).toHaveClass(
      'btn-primary'
    );
    expect(screen.getByRole('button', { name: THEMES[6] })).not.toHaveClass(
      'btn-primary'
    );
  });

  it('previews each swatch in its OWN theme, not the active one', () => {
    render(<ThemeSwitcher />);
    // data-theme per button is what makes the grid a preview rather than a list.
    expect(
      screen.getByRole('button', { name: THEMES[2] }).closest('[data-theme]')
    ).toHaveAttribute('data-theme', THEMES[2]);
  });
});
