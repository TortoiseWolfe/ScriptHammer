import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import PWAInstall from './PWAInstall';

expect.extend(toHaveNoViolations);

vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({ trackPWAEvent: vi.fn() }),
}));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

/** ?pwa-debug=true is the component's own way to render without a real prompt. */
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/?pwa-debug=true');
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

/**
 * A floating overlay pinned over every page, which makes it a keyboard and screen
 * reader obstacle if it is wrong. It is also invisible to the E2E touch-target and
 * contrast gates, because those walk ordinary pages and this only exists once the
 * browser has offered an install prompt.
 */
describe('PWAInstall Accessibility', () => {
  it('has no violations in the expanded pill', async () => {
    const { container } = render(<PWAInstall />);
    await screen.findByRole('button', { name: 'Install' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations when minimised', async () => {
    const user = userEvent.setup();
    const { container } = render(<PWAInstall />);
    await user.click(await screen.findByRole('button', { name: 'Minimize' }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names the icon-only controls', async () => {
    const user = userEvent.setup();
    render(<PWAInstall />);
    // "Minimize" and the collapsed trigger are icons alone; without an aria-label
    // they are announced as "button" and nothing else.
    expect(
      await screen.findByRole('button', { name: 'Minimize' })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Minimize' }));
    expect(
      screen.getByRole('button', { name: 'Install Progressive Web App' })
    ).toBeInTheDocument();
  });

  it('spells out what a PWA is rather than assuming the acronym', async () => {
    render(<PWAInstall />);
    const install = await screen.findByRole('button', { name: 'Install' });
    expect(install.getAttribute('title')).toMatch(/works offline/i);
  });

  it('is fully operable by keyboard', async () => {
    const user = userEvent.setup();
    render(<PWAInstall />);
    const minimize = await screen.findByRole('button', { name: 'Minimize' });
    minimize.focus();
    await user.keyboard('{Enter}');
    expect(
      screen.getByRole('button', { name: 'Install Progressive Web App' })
    ).toBeInTheDocument();
  });

  it('meets the 44px touch floor on every control', async () => {
    // #1013. Was an it.fails: the pill's controls were btn-xs (~24px) and the
    // collapsed trigger btn-sm (~32px), against this repo's documented
    // `min-h-11 min-w-11`. No E2E gate could see them — mobile-touch-targets
    // walks ordinary pages and this needs an install prompt to exist at all.
    render(<PWAInstall />);
    await screen.findByRole('button', { name: 'Install' });
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('min-h-11');
    }
  });

  it('keeps the floor on the collapsed trigger too', async () => {
    const u = userEvent.setup();
    render(<PWAInstall />);
    await u.click(await screen.findByRole('button', { name: 'Minimize' }));
    const trigger = screen.getByRole('button', {
      name: 'Install Progressive Web App',
    });
    // The state a visitor is left in for the longest, and the one they must hit
    // to get the prompt back.
    expect(trigger.className).toContain('min-h-11');
    expect(trigger.className).toContain('min-w-11');
  });

  it('names the dismiss control by what it does, not by its glyph', async () => {
    render(<PWAInstall />);
    await screen.findByRole('button', { name: 'Install' });
    expect(
      screen.getByRole('button', { name: "Don't show this again" })
    ).toBeInTheDocument();
  });
});
