import {
  InlineWidget,
  PopupWidget,
  useCalendlyEventListener,
} from 'react-calendly';
import { createLogger } from '@/lib/logger';
import { useEmbedThemeColor } from '@/hooks/useEmbedThemeColor';

interface CalendlyProviderProps {
  url: string;
  mode: 'inline' | 'popup';
  utm?: Record<string, string>;
  styles?: Record<string, string>;
  prefill?: {
    name?: string;
    email?: string;
    customAnswers?: Record<string, string>;
  };
}

const logger = createLogger('components:calendar:Calendly');

export function CalendlyProvider({
  url,
  mode = 'inline',
  utm,
  styles,
  prefill,
}: CalendlyProviderProps) {
  // Track calendar events
  useCalendlyEventListener({
    onProfilePageViewed: () => {
      logger.info('Calendar viewed', { provider: 'Calendly' });
    },
    onDateAndTimeSelected: () => {
      logger.info('Calendar time selected', { provider: 'Calendly' });
    },
    onEventScheduled: (e) => {
      logger.info('Calendar scheduled', {
        provider: 'Calendly',
        inviteeUri: e.data.payload.invitee.uri,
      });
    },
  });

  // Theme-aware brand color (issue #39). The accent is the active DaisyUI
  // theme's --color-primary, applied to the widget on mount; bg/text stay on
  // the dark/light split. (react-calendly builds the iframe once on mount, so
  // an already-rendered widget keeps its color until it next re-initializes.)
  const { hex: primaryColor, isDark } = useEmbedThemeColor('p');

  const pageSettings = {
    backgroundColor: isDark ? '1a1a1a' : 'ffffff',
    hideEventTypeDetails: false,
    hideLandingPageDetails: false,
    primaryColor,
    textColor: isDark ? 'ffffff' : '000000',
  };

  if (mode === 'popup') {
    // PopupWidget requires a root element for the modal portal
    // We need to ensure this only runs on the client side
    if (typeof document === 'undefined') {
      return <div>Loading...</div>;
    }

    return (
      <div className="inline-block">
        <PopupWidget
          url={url}
          utm={utm}
          prefill={prefill}
          pageSettings={pageSettings}
          text="Schedule a Meeting"
          rootElement={document.getElementById('__next') || document.body}
        />
      </div>
    );
  }

  return (
    <InlineWidget
      url={url}
      utm={utm}
      prefill={prefill}
      pageSettings={pageSettings}
      styles={{
        height: styles?.height || '1200px',
        minHeight: styles?.minHeight || '1000px',
        ...styles,
      }}
    />
  );
}
