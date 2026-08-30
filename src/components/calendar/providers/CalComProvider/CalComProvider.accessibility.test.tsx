import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CalComProvider } from './CalComProvider';

expect.extend(toHaveNoViolations);

/**
 * As with the Calendly half: the booking UI is inside Cal.com's cross-origin iframe,
 * so it is their accessibility, not ours, and axe cannot cross that boundary. The
 * embed is stubbed for the same reason `CaptchaWidget.accessibility.test.tsx` stubs
 * Turnstile. What IS ours is the popup trigger, which this component renders itself.
 */
vi.mock('@calcom/embed-react', () => ({
  default: () => <div data-testid="cal-inline-stub" />,
  getCalApi: () => Promise.resolve(vi.fn()),
}));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/hooks/useEmbedThemeColor', () => ({
  useEmbedThemeColor: () => ({ hexWithHash: '#ff0000', isDark: false }),
}));

const LINK = 'example/intro';

describe('CalComProvider Accessibility', () => {
  it('has no violations around the inline embed', async () => {
    const { container } = render(
      <CalComProvider calLink={LINK} mode="inline" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations around the popup trigger', async () => {
    const { container } = render(
      <CalComProvider calLink={LINK} mode="popup" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('makes the popup trigger a real button', () => {
    render(<CalComProvider calLink={LINK} mode="popup" />);
    // Cal.com drives this by data-attribute, which would work just as well on a
    // <div> — and then it would be unreachable by keyboard and unannounced. The
    // element type is the accessibility here.
    const button = screen.getByRole('button', { name: 'Schedule a Meeting' });
    expect(button.tagName).toBe('BUTTON');
  });

  it('adds no wrapper of its own around the inline embed', () => {
    const { container } = render(
      <CalComProvider calLink={LINK} mode="inline" />
    );
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toHaveAttribute(
      'data-testid',
      'cal-inline-stub'
    );
  });
});
