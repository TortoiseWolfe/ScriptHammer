import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SHOW_SLOTS,
  SHOW_CITIES,
  SHOW_DESCRIPTION,
  buildIcs,
  cityTime,
  showState,
} from './show';

const ms = (iso: string) => Date.parse(iso);

describe('show slots', () => {
  it('are 6:00 to 7:30 PM and 8:00 to 10:00 PM Eastern, live and replay', () => {
    const eastern = (iso: string) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
        .format(ms(iso))
        .replace(/[^\w:]+/g, ' ')
        .trim();
    expect(
      SHOW_SLOTS.map((s) => `${eastern(s.start)}-${eastern(s.end)}`)
    ).toEqual([
      'Thu 6:00 PM-Thu 7:30 PM',
      'Thu 8:00 PM-Thu 10:00 PM',
      'Sat 6:00 PM-Sat 7:30 PM',
      'Sat 8:00 PM-Sat 10:00 PM',
    ]);
  });
});

describe('city times (tz database)', () => {
  const opening = SHOW_SLOTS[0];
  const headline = SHOW_SLOTS[1];
  const by = (name: string) => SHOW_CITIES.find((c) => c.name === name)!.zone;

  it('applies each city own rules for the day (UK is on GMT since 25 Oct)', () => {
    expect(cityTime(opening, by('London')).range).toBe('10:00 PM to 11:30 PM');
    expect(cityTime(opening, by('Berlin')).range).toBe('11:00 PM to 12:30 AM');
    expect(cityTime(opening, by('Los Angeles')).range).toBe(
      '3:00 PM to 4:30 PM'
    );
    expect(cityTime(opening, by('Mumbai')).range).toBe('3:30 AM to 5:00 AM');
    expect(cityTime(headline, by('Tokyo')).range).toBe('9:00 AM to 11:00 AM');
    expect(cityTime(opening, by('Sydney')).range).toBe('9:00 AM to 10:30 AM');
  });

  it('flags the sets that fall on the next day', () => {
    expect(cityTime(opening, by('New York')).nextDay).toBe(false);
    expect(cityTime(opening, by('London')).nextDay).toBe(false);
    expect(cityTime(headline, by('London')).nextDay).toBe(true);
    expect(cityTime(opening, by('Tokyo')).nextDay).toBe(true);
  });
});

describe('showState', () => {
  it('walks before, live, between, replay, over', () => {
    expect(showState(ms('2026-10-27T12:00:00Z'))).toBe('before');
    expect(showState(ms('2026-10-29T22:30:00Z'))).toBe('live');
    expect(showState(ms('2026-10-30T01:59:00Z'))).toBe('live');
    expect(showState(ms('2026-10-30T12:00:00Z'))).toBe('between');
    expect(showState(ms('2026-10-31T22:30:00Z'))).toBe('replay');
    expect(showState(ms('2026-11-01T02:00:00Z'))).toBe('over');
    expect(showState(ms('2027-01-01T00:00:00Z'))).toBe('over');
  });
});

describe('calendar file', () => {
  const ics = buildIcs();
  it('holds the four slots with CRLF line endings', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(ics).toContain('DTSTART:20261029T220000Z');
    expect(ics).toContain('DTEND:20261101T020000Z');
    expect(ics.split('\r\n').every((l) => !l.includes('\n'))).toBe(true);
  });
  it('is the file we ship, byte for byte', () => {
    const shipped = readFileSync(
      join(process.cwd(), 'public/band/the-band-wagon.ics'),
      'utf8'
    );
    expect(shipped).toBe(ics);
  });
});

describe('description', () => {
  it('names the show and the live date', () => {
    expect(SHOW_DESCRIPTION).toContain('The Band Wagon');
    expect(SHOW_DESCRIPTION).toContain('Thursday 29 October');
  });
});
