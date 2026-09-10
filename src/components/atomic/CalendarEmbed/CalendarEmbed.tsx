'use client';

import { FC } from 'react';
import dynamic from 'next/dynamic';
import { useConsent } from '@/contexts/ConsentContext';
import { calendarConfig, toCalLink } from '@/config/calendar.config';
import CalendarConsent from '../../calendar/CalendarConsent';

export interface CalendarEmbedProps {
  mode?: 'inline' | 'popup';
  url?: string;
  provider?: 'calendly' | 'calcom';
  prefill?: {
    name?: string;
    email?: string;
    /**
     * The lead this booking belongs to (#562 T039).
     *
     * Cal.com turns `config` into the embed iframe's QUERY STRING, and a custom booking field
     * is prefilled by a query parameter named after its own identifier — so this arrives as
     * `responses.lead_ref` in the BOOKING_CREATED webhook, which is what lets a booking be
     * matched back to the click that started it. The field is configured `hidden` on the
     * event type, so the person booking never sees it.
     *
     * The obvious carrier, `utm_content`, does NOT work: Cal.com keeps auto-tracked UTM in a
     * separate table its webhook never reads from.
     */
    lead_ref?: string;
  };
  className?: string;
}

// Dynamic imports for calendar providers with loading state
const CalendlyProvider = dynamic(
  () =>
    import('../../calendar/providers/CalendlyProvider').then((mod) => ({
      default: mod.CalendlyProvider,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="text-base-content mt-4">Loading calendar...</p>
        </div>
      </div>
    ),
  }
);

const CalComProvider = dynamic(
  () =>
    import('../../calendar/providers/CalComProvider').then((mod) => ({
      default: mod.CalComProvider,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="text-base-content mt-4">Loading calendar...</p>
        </div>
      </div>
    ),
  }
);

const CalendarEmbed: FC<CalendarEmbedProps> = ({
  mode = 'inline',
  url = calendarConfig.url,
  provider = calendarConfig.provider,
  prefill,
  className,
}) => {
  const { consent } = useConsent();

  // Require functional consent for calendar embedding
  if (!consent.functional) {
    return (
      // `url` is passed so the card can offer a plain booking link to someone who does
      // not want third-party cookies (#919). No onAccept: updating consent re-renders
      // this component, which is the transition.
      <CalendarConsent provider={provider} url={url} />
    );
  }

  // Derived BEFORE the guard so a URL that parses to an empty path (`https://cal.com/`)
  // takes the "not configured" branch rather than mounting an embed with no event.
  const calLink = provider === 'calcom' ? toCalLink(url) : '';

  if (!url || (provider === 'calcom' && !calLink)) {
    return (
      <div className="alert alert-warning">
        <span>
          Calendar URL not configured. Please add NEXT_PUBLIC_CALENDAR_URL to
          environment.
        </span>
      </div>
    );
  }

  const containerClasses = `
    ${mode === 'inline' ? 'w-full rounded-lg overflow-hidden shadow-xl' : ''}
    ${className || ''}
  `.trim();

  return (
    <div className={containerClasses}>
      {provider === 'calendly' ? (
        <CalendlyProvider
          url={url}
          mode={mode}
          utm={calendarConfig.utm}
          styles={calendarConfig.styles}
          prefill={prefill}
        />
      ) : (
        <CalComProvider
          calLink={calLink}
          mode={mode}
          config={prefill}
          styles={calendarConfig.styles}
        />
      )}
    </div>
  );
};

export default CalendarEmbed;
