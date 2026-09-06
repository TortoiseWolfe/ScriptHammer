export interface CalendarConfig {
  provider: 'calendly' | 'calcom';
  /** The default scheduler URL. Every SKU without an override books here. */
  url: string;
  /**
   * Per-SKU scheduler overrides, keyed by `Product.id` (#1092).
   *
   * WHY THIS EXISTS. Meeting length is not data anywhere in this product — it is an
   * opaque slug inside a Calendly URL. With one global `url`, a free enquiry and a
   * paid session resolve to the same event, so `prd-office-hours` ($99, advertised as
   * a "90-minute live 1:1 session" with screen-share) booked the 15-minute call.
   *
   * WHY A FIXED MAP AND NOT A LOOKUP. This is a static export: `process.env` is
   * substituted at build time, so every variable has to be named literally. A map
   * built from `NEXT_PUBLIC_CALENDAR_URL_*` cannot be computed — each SKU that needs
   * its own event gets a line here.
   *
   * An unset variable is not an error. The entry is dropped and that SKU falls back
   * to `url`, which is what happens today for office hours until the 90-minute event
   * exists in Calendly.
   */
  eventTypes?: Record<string, string>;
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
  eventTypes: {
    // `prd-office-hours` — the $99 SKU. Unset until the 90-minute Calendly event
    // exists; see #1092. `resolveCalendarUrl` drops empty entries.
    'prd-office-hours': process.env.NEXT_PUBLIC_CALENDAR_URL_OFFICE_HOURS || '',
  },
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

/**
 * The scheduler URL a given SKU should book, falling back to the default.
 *
 * An override is only used when it is a non-empty string, so an unset
 * `NEXT_PUBLIC_CALENDAR_URL_*` degrades to the general call rather than producing a
 * dead link. Callers still have to handle `''` — nothing is configured at all is a
 * separate case, and `buildBookingUrl` returns null for it.
 */
export function resolveCalendarUrl(sku?: string | null): string {
  if (sku) {
    const override = calendarConfig.eventTypes?.[sku];
    if (override) return override;
  }
  return calendarConfig.url;
}
