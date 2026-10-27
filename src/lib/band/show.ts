/**
 * The Band Wagon show (#1408, FR-010): one night, then a replay.
 *
 * Every instant is written in UTC, because that is unambiguous. Eastern time is
 * EDT (UTC-4) on both days: US clocks change on 1 November, after the replay.
 * City times come from the tz database through Intl, so a city's own daylight
 * saving rules are applied for the day, not hard-coded.
 */

export const SHOW_TITLE = 'The Band Wagon: One Night Only, Every City on Earth';
export const SHOW_CHANNEL = 'twitch.tv/scripthammer';
export const SHOW_CHANNEL_URL = 'https://twitch.tv/scripthammer';

export interface ShowSlot {
  id: 'live-opening' | 'live-headline' | 'replay-opening' | 'replay-headline';
  label: string;
  /** The set's name, shared by the live night and the replay. */
  set: 'Opening set' | 'Headline';
  start: string;
  end: string;
}

export const SHOW_SLOTS: readonly ShowSlot[] = [
  {
    id: 'live-opening',
    label: 'LIVE Thursday 29 October, opening set',
    set: 'Opening set',
    start: '2026-10-29T22:00:00Z',
    end: '2026-10-29T23:30:00Z',
  },
  {
    id: 'live-headline',
    label: 'LIVE Thursday 29 October, headline',
    set: 'Headline',
    start: '2026-10-30T00:00:00Z',
    end: '2026-10-30T02:00:00Z',
  },
  {
    id: 'replay-opening',
    label: 'REPLAY Saturday 31 October, opening set',
    set: 'Opening set',
    start: '2026-10-31T22:00:00Z',
    end: '2026-10-31T23:30:00Z',
  },
  {
    id: 'replay-headline',
    label: 'REPLAY Saturday 31 October, headline',
    set: 'Headline',
    start: '2026-11-01T00:00:00Z',
    end: '2026-11-01T02:00:00Z',
  },
];

export type ShowState = 'before' | 'live' | 'between' | 'replay' | 'over';

const t = (iso: string) => Date.parse(iso);

/** Where the show is, for a given moment. 'over' starts when the replay ends. */
export function showState(now: number): ShowState {
  if (now >= t(SHOW_SLOTS[3].end)) return 'over';
  if (now >= t(SHOW_SLOTS[2].start)) return 'replay';
  if (now >= t(SHOW_SLOTS[1].end)) return 'between';
  if (now >= t(SHOW_SLOTS[0].start)) return 'live';
  return 'before';
}

export interface ShowCity {
  name: string;
  zone: string;
}

export const SHOW_CITIES: readonly ShowCity[] = [
  { name: 'Los Angeles', zone: 'America/Los_Angeles' },
  { name: 'New York', zone: 'America/New_York' },
  { name: 'São Paulo', zone: 'America/Sao_Paulo' },
  { name: 'London', zone: 'Europe/London' },
  { name: 'Berlin', zone: 'Europe/Berlin' },
  { name: 'Mumbai', zone: 'Asia/Kolkata' },
  { name: 'Tokyo', zone: 'Asia/Tokyo' },
  { name: 'Sydney', zone: 'Australia/Sydney' },
];

function parts(ms: number, zone: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(ms)) o[p.type] = p.value;
  return {
    day: `${o.year}-${o.month}-${o.day}`,
    clock: `${o.hour}:${o.minute} ${o.dayPeriod.toUpperCase()}`,
  };
}

export interface CityTime {
  /** "10:00 PM to 11:30 PM" */
  range: string;
  /** True when the set starts on the day after Thursday evening in New York. */
  nextDay: boolean;
}

/** One set of the live night, as it reads on a city's own clock. */
export function cityTime(slot: ShowSlot, zone: string): CityTime {
  const a = parts(t(slot.start), zone);
  const b = parts(t(slot.end), zone);
  const eastern = parts(t(SHOW_SLOTS[0].start), 'America/New_York').day;
  return {
    range: `${a.clock} to ${b.clock}`,
    nextDay: a.day !== eastern,
  };
}

function icsStamp(iso: string) {
  return iso.replace(/[-:]/g, '').replace('.000', '');
}

/** The four slots as an iCalendar file (RFC 5545), CRLF line endings. */
export function buildIcs(): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ScriptHammer//The Band Wagon//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${SHOW_TITLE}`,
  ];
  for (const s of SHOW_SLOTS) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@scripthammer.com`,
      'DTSTAMP:20261027T120000Z',
      `DTSTART:${icsStamp(s.start)}`,
      `DTEND:${icsStamp(s.end)}`,
      `SUMMARY:The Band Wagon: ${s.set} (${s.id.startsWith('live') ? 'LIVE' : 'REPLAY'})`,
      `DESCRIPTION:Watch free on Twitch at ${SHOW_CHANNEL}. More at https://scripthammer.com/band/`,
      `URL:${SHOW_CHANNEL_URL}`,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

/** The description shared by the page's og:description and twitter:description. */
export const SHOW_DESCRIPTION =
  'The Band Wagon: one night only, every city on earth. ScriptHammer, the house band, plays LIVE Thursday 29 October on Twitch, with a replay Saturday 31 October. Free for everyone.';
