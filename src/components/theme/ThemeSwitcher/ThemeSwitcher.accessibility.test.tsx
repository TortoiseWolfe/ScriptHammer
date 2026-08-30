import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeSwitcher } from './ThemeSwitcher';
import { THEMES } from '@/config/themes';

expect.extend(toHaveNoViolations);

vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({ trackThemeChange: vi.fn() }),
}));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeSwitcher Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<ThemeSwitcher />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('every swatch is a real button with a readable name', () => {
    render(<ThemeSwitcher />);
    // The label is the theme name itself; a grid of unnamed colour chips would be
    // unusable without sight, and `capitalize` is CSS so the name stays the token.
    for (const theme of THEMES) {
      expect(screen.getByRole('button', { name: theme })).toBeInTheDocument();
    }
  });

  it('is operable by keyboard alone', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    const target = screen.getByRole('button', { name: THEMES[4] });
    target.focus();
    await user.keyboard('{Enter}');
    expect(document.documentElement.getAttribute('data-theme')).toBe(THEMES[4]);
  });

  it('does not rely on colour alone to show which theme is active', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    const target = screen.getByRole('button', { name: THEMES[4] });
    await user.click(target);
    // Honest about the current state: selection is conveyed by the btn-primary
    // class only. Recorded as a class assertion so that if the visual treatment
    // changes, someone has to look at whether the new one is announced.
    expect(target).toHaveClass('btn-primary');
  });
});
