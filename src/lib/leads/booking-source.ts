/**
 * Pages that may tag a booking with `/schedule?from=<key>`. The value becomes the booking's
 * prefilled notes, so only these keys are accepted: any other `from` is ignored rather than
 * echoed into a form from the address bar.
 */
const BOOKING_SOURCES: Readonly<Record<string, string>> = {
  band: 'Band booking',
};

/** The notes to prefill for a `from` value, or undefined when it is missing or unknown. */
export function bookingNotes(
  from: string | null | undefined
): string | undefined {
  return from && Object.hasOwn(BOOKING_SOURCES, from)
    ? BOOKING_SOURCES[from]
    : undefined;
}
