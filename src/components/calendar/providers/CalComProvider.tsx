import Cal, { getCalApi } from '@calcom/embed-react';
import { useEffect } from 'react';
import { createLogger } from '@/lib/logger';
import { useEmbedThemeColor } from '@/hooks/useEmbedThemeColor';

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

  // Theme-aware brand color (issue #39). brandColor tracks the active DaisyUI
  // theme's --color-primary; the binary light/dark `theme` prop is unchanged.
  const { hexWithHash: brandColor, isDark } = useEmbedThemeColor('p');

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
          brandColor,
        },
      }}
    />
  );
}
