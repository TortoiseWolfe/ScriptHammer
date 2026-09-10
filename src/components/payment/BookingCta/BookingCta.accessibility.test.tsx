import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import BookingCta from './BookingCta';

expect.extend(toHaveNoViolations);

vi.mock('@/config/calendar.config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/calendar.config')>()),
  calendarConfig: {
    provider: 'calcom',
    url: 'https://cal.com/turtle-wolfe/15min',
    eventTypes: {},
    utm: {},
    styles: {},
  },
}));

describe('BookingCta Accessibility', () => {
  it('has no violations as a link', async () => {
    const { container } = render(<BookingCta source="pricing" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('announces the unconfigured state instead of leaving a silent gap', async () => {
    vi.resetModules();
    vi.doMock('@/config/calendar.config', () => ({
      calendarConfig: {
        provider: 'calcom',
        url: '',
        eventTypes: {},
        utm: {},
        styles: {},
      },
    }));
    const { default: Unconfigured } = await import('./BookingCta');
    const { container } = render(<Unconfigured source="pricing" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
