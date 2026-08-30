import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PrivacyActions } from './PrivacyActions';

expect.extend(toHaveNoViolations);

vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: () => ({ openModal: vi.fn() }),
}));

describe('PrivacyActions Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<PrivacyActions />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names its landmark, so it is distinguishable from other navs', async () => {
    render(<PrivacyActions />);
    expect(
      screen.getByRole('navigation', { name: /Privacy policy actions/i })
    ).toBeInTheDocument();
  });

  it('gives every control a non-empty accessible name', () => {
    render(<PrivacyActions />);
    for (const el of [
      ...screen.getAllByRole('link'),
      ...screen.getAllByRole('button'),
    ]) {
      const name = el.getAttribute('aria-label') ?? el.textContent ?? '';
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });
});
