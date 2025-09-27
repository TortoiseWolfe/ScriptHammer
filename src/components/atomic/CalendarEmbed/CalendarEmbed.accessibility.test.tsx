import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import CalendarEmbed from './CalendarEmbed';

expect.extend(toHaveNoViolations);

// Mock the consent context
vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: () => ({
    consent: { functional: true },
    updateConsent: vi.fn(),
  }),
}));

// Mock the providers to avoid external dependencies
vi.mock('../../calendar/providers/CalendlyProvider', () => ({
  CalendlyProvider: () => <div>Calendly Provider</div>,
}));

vi.mock('../../calendar/providers/CalComProvider', () => ({
  CalComProvider: () => <div>Cal.com Provider</div>,
}));

// Mock CalendarConsent
vi.mock('../../calendar/CalendarConsent', () => ({
  default: () => <div>Calendar Consent</div>,
}));

// Mock config
vi.mock('@/config/calendar.config', () => ({
  calendarConfig: {
    provider: 'calendly',
    url: 'https://calendly.com/default',
    utm: { source: 'test' },
    styles: { height: '700px' },
  },
}));

describe('CalendarEmbed Accessibility', () => {
  it('should have no accessibility violations in inline mode', async () => {
    const { container } = render(<CalendarEmbed mode="inline" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in popup mode', async () => {
    const { container } = render(<CalendarEmbed mode="popup" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with Calendly provider', async () => {
    const { container } = render(
      <CalendarEmbed provider="calendly" url="https://calendly.com/test" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with Cal.com provider', async () => {
    const { container } = render(
      <CalendarEmbed provider="calcom" url="test/meeting" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with prefilled data', async () => {
    const { container } = render(
      <CalendarEmbed
        prefill={{ name: 'Test User', email: 'test@example.com' }}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with custom className', async () => {
    const { container } = render(
      <CalendarEmbed className="custom-accessibility-test" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
