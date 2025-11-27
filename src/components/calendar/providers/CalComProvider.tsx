import Cal, { getCalApi } from '@calcom/embed-react';
import { useEffect } from 'react';
import { createLogger } from '@/lib/logger';

interface CalComProviderProps {
  calLink: string;
  mode: 'inline' | 'popup';
  config?: {
    name?: string;
    email?: string;
    notes?: string;
    guests?: string[];
    theme?: 'light' | 'dark' | 'auto';
  };
  styles?: Record<string, string>;
}

const logger = createLogger('components:calendar:CalCom');

export function CalComProvider({
  calLink,
  mode = 'inline',
  config,
  styles,
}: CalComProviderProps) {
  useEffect(() => {
    (async function () {
      const cal = await getCalApi();

      // Listen for Cal.com events
      cal('on', {
        action: 'bookingSuccessful',

        callback: (e: any) => {
          logger.info('Calendar scheduled', {
            provider: 'Cal.com',
            name: e.detail?.name,
          });
        },
      });

      cal('on', {
        action: 'linkReady',
        callback: () => {
          logger.info('Calendar viewed', { provider: 'Cal.com' });
        },
      });
    })();
  }, []);

  // Auto-detect theme
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

  if (mode === 'popup') {
    return (
      <button
        className="btn btn-primary"
        data-cal-link={calLink}
        data-cal-config={JSON.stringify({
          ...config,
          theme: isDark ? 'dark' : 'light',
        })}
      >
        Schedule a Meeting
      </button>
    );
  }

  return (
    <Cal
      calLink={calLink}
      style={{
        width: '100%',
        height: styles?.height || '700px',
        minHeight: styles?.minHeight || '500px',
        overflow: 'hidden',
        ...styles,
      }}
      config={{
        ...config,
        theme: isDark ? 'dark' : 'light',
        branding: {
          brandColor: '#00a2ff',
        },
      }}
    />
  );
}
