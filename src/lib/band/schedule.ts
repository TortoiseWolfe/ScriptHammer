/**
 * The ScriptHammer Twitch channel's weekly grid, all in Eastern time.
 *
 * It is the same grid as the Schedule panel on the channel's About page, so the
 * two never disagree. Times are minutes after midnight (0 to 1440) so the
 * tests can prove the day has no gap and no overlap; labels are made from them.
 *
 * Not listed on purpose: the space opera game, GeoLARP and the AI tutorials.
 * They join the grid when they exist.
 */

export const SCHEDULE_HEADING = 'When we are on';
export const SCHEDULE_ZONE_NOTE = 'All times are Eastern (ET).';
export const SCHEDULE_CHANNEL = 'twitch.tv/scripthammer';
export const SCHEDULE_CHANNEL_URL = 'https://twitch.tv/scripthammer';

export interface ScheduleSlot {
  id: string;
  /** Minutes after midnight Eastern, 0 to 1440. */
  start: number;
  end: number;
  title: string;
  detail: string;
}

/** Every day. On Thursdays the 6:00 to 10:00 PM rows are replaced by THURSDAY_EVENING. */
export const DAILY_SLOTS: readonly ScheduleSlot[] = [
  {
    id: 'overnight',
    start: 0,
    end: 360,
    title: 'Overnight Rotation',
    detail: 'The album, the jams and live-set reruns, around the clock.',
  },
  {
    id: 'practice',
    start: 360,
    end: 540,
    title: 'Band Practice & Jams',
    detail: 'The band warms up and jams.',
  },
  {
    id: 'vault-morning',
    start: 540,
    end: 720,
    title: 'The Jam Vault',
    detail: 'Jams from the vault.',
  },
  {
    id: 'album-midday',
    start: 720,
    end: 780,
    title: 'Album Show (midday)',
    detail:
      'The Band Wagon straight through. Vote songs with !up or !down; the winners graduate to the evening show.',
  },
  {
    id: 'afternoon',
    start: 780,
    end: 1080,
    title: 'Afternoon Rotation',
    detail: 'Jam sessions, album replays and live-set reruns.',
  },
  {
    id: 'album-evening',
    start: 1080,
    end: 1200,
    title: 'Album Show (evening)',
    detail: 'The day’s voted winners.',
  },
  {
    id: 'reruns',
    start: 1200,
    end: 1320,
    title: 'Set Reruns & Jam Vault',
    detail: 'The best of the band’s sets and jams, again.',
  },
  {
    id: 'late',
    start: 1320,
    end: 1440,
    title: 'Late Jams',
    detail: 'Jams to close the day.',
  },
];

/** Thursdays, from 6:00 to 10:00 PM. These replace the evening album show and the set reruns. */
export const THURSDAY_EVENING: readonly ScheduleSlot[] = [
  {
    id: 'thursday-live',
    start: 1080,
    end: 1170,
    title: 'Live Band Set',
    detail: 'The band plays live.',
  },
  {
    id: 'thursday-jams',
    start: 1170,
    end: 1200,
    title: 'Band jams',
    detail: 'The jams after the set.',
  },
  {
    id: 'thursday-rerun',
    start: 1200,
    end: 1320,
    title: 'Rerun of the live set',
    detail: 'Missed it? The live set plays again.',
  },
];

/** 0 -> "12:00 AM", 1080 -> "6:00 PM", 1440 -> "12:00 AM". */
export function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${suffix}`;
}

/** "6:00 PM to 8:00 PM". */
export function range(slot: ScheduleSlot): string {
  return `${clock(slot.start)} to ${clock(slot.end)}`;
}
