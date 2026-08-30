import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CookieActions } from './CookieActions';

expect.extend(toHaveNoViolations);

vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: () => ({ openModal: vi.fn() }),
}));

describe('CookieActions Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<CookieActions />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names its landmark, so it is distinguishable from other navs', async () => {
    render(<CookieActions />);
    expect(
      screen.getByRole('navigation', { name: /Cookie policy actions/i })
    ).toBeInTheDocument();
  });

  it('gives every control a non-empty accessible name', () => {
    render(<CookieActions />);
    for (const el of [
      ...screen.getAllByRole('link'),
      ...screen.getAllByRole('button'),
    ]) {
      const name = el.getAttribute('aria-label') ?? el.textContent ?? '';
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });
});
