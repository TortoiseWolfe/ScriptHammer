export interface CalendarConfig {
  provider: 'calendly' | 'calcom';
  url: string;
  eventTypes?: string[];
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
  styles?: {
    height?: string;
    minHeight?: string;
    backgroundColor?: string;
  };
}

export const calendarConfig: CalendarConfig = {
  provider:
    (process.env.NEXT_PUBLIC_CALENDAR_PROVIDER as 'calendly' | 'calcom') ||
    'calendly',
  url: process.env.NEXT_PUBLIC_CALENDAR_URL || '',
  utm: {
    source: 'scripthammer',
    medium: 'embed',
    campaign: 'website',
  },
  styles: {
    height: '700px',
    minHeight: '500px',
  },
};
