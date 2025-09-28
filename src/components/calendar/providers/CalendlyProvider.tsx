import {
  InlineWidget,
  PopupWidget,
  useCalendlyEventListener,
} from 'react-calendly';
import { useEffect } from 'react';

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
      console.log('Calendar viewed - Calendly');
    },
    onDateAndTimeSelected: () => {
      console.log('Calendar time selected - Calendly');
    },
    onEventScheduled: (e) => {
      console.log('Calendar scheduled - Calendly', e.data.payload.invitee.uri);
    },
  });

  // Apply theme-aware styles
  useEffect(() => {
    const theme = document.documentElement.getAttribute('data-theme');
    const isDark = [
      'dark',
      'dracula',
      'night',
      'coffee',
      'dim',
      'sunset',
    ].includes(theme || '');

    // Theme will be applied through pageSettings below
    console.log('Theme detected:', theme, 'isDark:', isDark);
  }, []);

  const theme =
    typeof window !== 'undefined'
      ? document.documentElement.getAttribute('data-theme')
      : 'light';
  const isDark = [
    'dark',
    'dracula',
    'night',
    'coffee',
    'dim',
    'sunset',
  ].includes(theme || '');

  const pageSettings = {
    backgroundColor: isDark ? '1a1a1a' : 'ffffff',
    hideEventTypeDetails: false,
    hideLandingPageDetails: false,
    primaryColor: '00a2ff',
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
