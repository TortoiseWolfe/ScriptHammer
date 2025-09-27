'use client';

import { FC } from 'react';
import dynamic from 'next/dynamic';
import { useConsent } from '@/contexts/ConsentContext';
import { calendarConfig } from '@/config/calendar.config';
import CalendarConsent from '../../calendar/CalendarConsent';

export interface CalendarEmbedProps {
  mode?: 'inline' | 'popup';
  url?: string;
  provider?: 'calendly' | 'calcom';
  prefill?: {
    name?: string;
    email?: string;
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
          <p className="text-base-content/70 mt-4">Loading calendar...</p>
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
          <p className="text-base-content/70 mt-4">Loading calendar...</p>
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
      <CalendarConsent
        provider={provider}
        onAccept={() => {
          // Update consent will trigger re-render
        }}
      />
    );
  }

  if (!url) {
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
          calLink={url}
          mode={mode}
          config={prefill}
          styles={calendarConfig.styles}
        />
      )}
    </div>
  );
};

export default CalendarEmbed;
