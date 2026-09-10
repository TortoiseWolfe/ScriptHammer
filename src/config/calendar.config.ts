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
   * to `url`, which is what happened for office hours until the paid event
   * existed at the provider.
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
    // `prd-office-hours` — the paid SKU, pointing at the Cal.com office-hours
    // event (#1092). `resolveCalendarUrl` drops empty entries, so an unset
    // variable degrades to the general call rather than a dead link.
    'prd-office-hours': process.env.NEXT_PUBLIC_CALENDAR_URL_OFFICE_HOURS || '',
  },
  utm: {
    source: 'scripthammer',
    medium: 'embed',
    campaign: 'website',
  },
  // NO HEIGHT HERE, AND THAT IS THE FIX FOR THE CLIPPED CALENDAR (#1162).
  //
  // This block used to read `{ height: '700px', minHeight: '500px' }`, and it is passed to BOTH
  // providers — so one number decided the size of two embeds that size themselves in opposite
  // ways. Cal.com's embed auto-resizes: it measures its own content and sets the iframe height by
  // postMessage. Calendly's does not, and needs to be told.
  //
  // 700px was right for neither. Measured on live production: the Cal.com iframe had correctly
  // grown itself to 1786px while `.cal-inline-container` stayed pinned at 700 with
  // `overflow: hidden`, so 1086px of the month grid — most of it — was simply cut off, inside a
  // panel that was already reserving 1250px for it.
  //
  // With this empty, each provider applies its own default: 'auto' for Cal.com so its own
  // resizing wins, 1200px for Calendly which has no resizing of its own. A caller can still pass
  // `styles` to override either.
  styles: {},
};

/**
 * The scheduler URL a given SKU should book, falling back to the default.
 *
 * An override is only used when it is a non-empty string, so an unset
 * `NEXT_PUBLIC_CALENDAR_URL_*` degrades to the general call rather than producing a
 * dead link. Callers still have to handle `''` — nothing is configured at all is a
 * separate case, and `buildBookingUrl` returns null for it.
 */
/**
 * The bare `user/event-slug` a Cal.com embed needs, derived from a full booking URL.
 *
 * WHY THE CONFIG STORES A URL AND NOT THIS SHAPE. Three consumers read the same
 * configured value and two of them need an absolute URL:
 *
 *   - `buildBookingUrl` (checkout confirmation) does `new URL(base)` to attach UTM
 *     parameters and returns `null` when that throws. Hand it a bare `user/slug` and a
 *     buyer who has just paid gets NO booking link at all — strictly worse than the
 *     wrong-length link #1092 was filed for.
 *   - `CalendarConsent` offers the value as a plain `href` to anyone declining
 *     third-party cookies (#919).
 *   - The embed is the ONLY consumer wanting a path.
 *
 * So the URL is canonical and this narrows it at the one call site that needs narrowing.
 * Doing it the other way round — storing `user/slug` and reconstructing an origin — puts
 * a hardcoded `https://cal.com` in the source and breaks self-hosted Cal.com instances.
 *
 * It also keeps `scripts/ci/check-calendar-configured.mjs` worth having: that check
 * asserts the CONFIGURED value reached the bundle verbatim, and `turtle-wolfe/office-hours`
 * is a far weaker string to match than an absolute URL.
 *
 * A value that is already bare passes through unchanged, so a fork configuring
 * `user/slug` directly still embeds correctly.
 */
export function toCalLink(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  let path: string;
  try {
    // `pathname` drops the query and hash for free — `data-cal-link` takes neither.
    path = new URL(trimmed).pathname;
  } catch {
    // Not absolute: assume it is already `user/slug`.
    path = trimmed;
  }

  return path.replace(/^\/+/, '').replace(/\/+$/, '');
}

export function resolveCalendarUrl(sku?: string | null): string {
  if (sku) {
    const override = calendarConfig.eventTypes?.[sku];
    if (override) return override;
  }
  return calendarConfig.url;
}
