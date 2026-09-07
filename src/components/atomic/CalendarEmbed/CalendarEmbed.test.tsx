import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next/dynamic first to prevent async loading
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: React.ComponentType }>) => {
    // Return the component directly without dynamic loading
    const componentName = loader.toString();

    if (componentName.includes('CalendlyProvider')) {
      const CalendlyMock = ({ mode, url }: { mode: string; url: string }) => (
        <div data-testid="calendly-provider">
          Calendly Provider - Mode: {mode} - URL: {url}
        </div>
      );
      CalendlyMock.displayName = 'CalendlyMock';
      return CalendlyMock;
    }

    if (componentName.includes('CalComProvider')) {
      const CalComMock = ({
        mode,
        calLink,
      }: {
        mode: string;
        calLink: string;
      }) => (
        <div data-testid="calcom-provider">
          Cal.com Provider - Mode: {mode} - URL: {calLink}
        </div>
      );
      CalComMock.displayName = 'CalComMock';
      return CalComMock;
    }

    const DefaultMock = () => <div>Mock Dynamic Component</div>;
    DefaultMock.displayName = 'DefaultMock';
    return DefaultMock;
  },
}));

// Import CalendarEmbed after mocking dynamic
import CalendarEmbed from './CalendarEmbed';

// Mock the consent context
const mockUpdateConsent = vi.fn();
const mockConsent = { functional: true };

vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: () => ({
    consent: mockConsent,
    updateConsent: mockUpdateConsent,
  }),
}));

// Mock calendar consent component
vi.mock('../../calendar/CalendarConsent', () => ({
  default: ({
    provider,
    onAccept,
  }: {
    provider: string;
    onAccept: () => void;
  }) => (
    <div data-testid="calendar-consent">
      <p>Consent required for {provider}</p>
      <button onClick={onAccept}>Accept</button>
    </div>
  ),
}));

// Mock config
// `calendarConfig` is stubbed so these tests do not depend on the environment, but
// `toCalLink` is imported for real (#1100): mocking it would make the Cal.com assertions
// verify a stub rather than the narrowing they exist to pin.
vi.mock('@/config/calendar.config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/calendar.config')>()),
  calendarConfig: {
    provider: 'calendly',
    url: 'https://calendly.com/default',
    utm: { source: 'test' },
    styles: { height: '700px' },
  },
}));

describe('CalendarEmbed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsent.functional = true;
  });

  it('renders Calendly provider when functional consent is granted', () => {
    render(
      <CalendarEmbed provider="calendly" url="https://calendly.com/test" />
    );
    expect(screen.getByTestId('calendly-provider')).toBeInTheDocument();
    expect(
      screen.getByText(/URL: https:\/\/calendly.com\/test/)
    ).toBeInTheDocument();
  });

  it('renders Cal.com provider when specified', () => {
    render(<CalendarEmbed provider="calcom" url="test/meeting" />);
    expect(screen.getByTestId('calcom-provider')).toBeInTheDocument();
    expect(screen.getByText(/URL: test\/meeting/)).toBeInTheDocument();
  });

  it('narrows a configured Cal.com URL to the bare link the embed needs (#1100)', () => {
    // THE CASE THE SUITE WAS MISSING. The test above passes `test/meeting` — already bare,
    // and a shape `calendar.config.ts` never produces, because the same value has to be an
    // absolute URL for `buildBookingUrl` and `CalendarConsent`. So the Cal.com branch was
    // green while being unusable with any real configuration.
    render(
      <CalendarEmbed
        provider="calcom"
        url="https://cal.com/turtle-wolfe/office-hours"
      />
    );
    const embed = screen.getByTestId('calcom-provider');
    expect(embed).toHaveTextContent('URL: turtle-wolfe/office-hours');
    // Stated as the failure too: `data-cal-link` silently resolves nothing when handed an
    // absolute URL, and the breakage is invisible because it happens inside the iframe.
    expect(embed).not.toHaveTextContent('https://');
  });

  it('shows the not-configured warning for a Cal.com origin with no event path', () => {
    render(<CalendarEmbed provider="calcom" url="https://cal.com/" />);
    expect(screen.queryByTestId('calcom-provider')).not.toBeInTheDocument();
    expect(screen.getByText(/not configured/i)).toBeInTheDocument();
  });

  it('leaves the Calendly branch on absolute URLs', () => {
    // Counterweight: the narrowing must apply to Cal.com ONLY. Calendly's widget takes a
    // full URL, so stripping the origin there would break the provider that works today.
    render(
      <CalendarEmbed provider="calendly" url="https://calendly.com/you/30min" />
    );
    expect(screen.getByTestId('calendly-provider')).toHaveTextContent(
      'URL: https://calendly.com/you/30min'
    );
  });

  it('shows consent component when functional consent is not granted', () => {
    mockConsent.functional = false;
    render(<CalendarEmbed />);
    expect(screen.getByTestId('calendar-consent')).toBeInTheDocument();
    expect(screen.getByText(/Consent required/)).toBeInTheDocument();
  });

  it('shows warning when no URL is configured', () => {
    render(<CalendarEmbed url="" />);
    expect(screen.getByText(/Calendar URL not configured/)).toBeInTheDocument();
  });

  it('uses default config when props are not provided', () => {
    render(<CalendarEmbed />);
    expect(screen.getByTestId('calendly-provider')).toBeInTheDocument();
    expect(
      screen.getByText(/URL: https:\/\/calendly.com\/default/)
    ).toBeInTheDocument();
  });

  it('accepts inline mode', () => {
    render(<CalendarEmbed mode="inline" url="test" />);
    expect(screen.getByText(/Mode: inline/)).toBeInTheDocument();
  });

  it('accepts popup mode', () => {
    render(<CalendarEmbed mode="popup" url="test" />);
    expect(screen.getByText(/Mode: popup/)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <CalendarEmbed className="custom-class" url="test" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('custom-class');
  });

  it('applies inline mode styles', () => {
    const { container } = render(<CalendarEmbed mode="inline" url="test" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('w-full');
    expect(wrapper.className).toContain('rounded-lg');
    expect(wrapper.className).toContain('shadow-xl');
  });

  it('does not apply inline styles for popup mode', () => {
    const { container } = render(<CalendarEmbed mode="popup" url="test" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).not.toContain('w-full');
    expect(wrapper.className).not.toContain('rounded-lg');
  });
});
