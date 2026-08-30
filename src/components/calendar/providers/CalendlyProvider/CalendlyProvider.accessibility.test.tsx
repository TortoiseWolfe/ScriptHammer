import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CalendlyProvider } from './CalendlyProvider';

expect.extend(toHaveNoViolations);

/**
 * The booking UI lives inside Calendly's cross-origin iframe, so its accessibility
 * is Calendly's and not ours to assert — axe cannot see across that boundary, and a
 * green check that implies otherwise is worth less than no check. Same reasoning and
 * same stub shape as `CaptchaWidget.accessibility.test.tsx`.
 *
 * (A real <iframe> in the stub does not work either: axe fails outright in jsdom with
 * "Respondable target must be a frame in the current window", and disabling
 * frame-tested does not suppress it.)
 *
 * What IS ours: the markup we put around the embed, and the popup trigger we render
 * ourselves.
 */
vi.mock('react-calendly', () => ({
  InlineWidget: () => <div data-testid="calendly-inline-stub" />,
  PopupWidget: ({ text }: { text: string }) => (
    <button type="button">{text}</button>
  ),
  useCalendlyEventListener: () => {},
}));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/hooks/useEmbedThemeColor', () => ({
  useEmbedThemeColor: () => ({ hex: 'ff0000', isDark: false }),
}));

const URL = 'https://calendly.com/example/intro';

describe('CalendlyProvider Accessibility', () => {
  it('has no violations around the inline embed', async () => {
    const { container } = render(<CalendlyProvider url={URL} mode="inline" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations around the popup trigger', async () => {
    const { container } = render(<CalendlyProvider url={URL} mode="popup" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('adds no wrapper of its own around the inline embed', () => {
    const { container } = render(<CalendlyProvider url={URL} mode="inline" />);
    // Nothing between the page and the widget: nothing to mislabel, and no landmark
    // or heading invented on the third party's behalf.
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toHaveAttribute(
      'data-testid',
      'calendly-inline-stub'
    );
  });

  it('names the popup trigger by what it does', () => {
    const { getByRole } = render(<CalendlyProvider url={URL} mode="popup" />);
    expect(
      getByRole('button', { name: 'Schedule a Meeting' })
    ).toBeInTheDocument();
  });
});
