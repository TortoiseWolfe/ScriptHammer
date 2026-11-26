import { describe, it, expect } from 'vitest';
import {
  DAILY_SLOTS,
  THURSDAY_EVENING,
  clock,
  range,
  type ScheduleSlot,
} from './schedule';

const covers = (slots: readonly ScheduleSlot[], from: number, to: number) => {
  let at = from;
  for (const s of slots) {
    expect(s.start).toBe(at);
    expect(s.end).toBeGreaterThan(s.start);
    at = s.end;
  }
  expect(at).toBe(to);
};

describe('stream schedule', () => {
  it('fills the whole day with no gap and no overlap', () => {
    covers(DAILY_SLOTS, 0, 1440);
  });

  it('has Thursday evening fill 6:00 to 10:00 PM exactly', () => {
    covers(THURSDAY_EVENING, 1080, 1320);
  });

  it('matches the Twitch panel: the daily rows', () => {
    expect(DAILY_SLOTS.map((s) => `${s.title}|${range(s)}`)).toEqual([
      'Overnight Rotation|12:00 AM to 6:00 AM',
      'Band Practice & Jams|6:00 AM to 9:00 AM',
      'The Jam Vault|9:00 AM to 12:00 PM',
      'Album Show (midday)|12:00 PM to 1:00 PM',
      'Afternoon Rotation|1:00 PM to 6:00 PM',
      'Album Show (evening)|6:00 PM to 8:00 PM',
      'Set Reruns & Jam Vault|8:00 PM to 10:00 PM',
      'Late Jams|10:00 PM to 12:00 AM',
    ]);
  });

  it('matches the Twitch panel: Thursday evening', () => {
    expect(THURSDAY_EVENING.map((s) => `${s.title}|${range(s)}`)).toEqual([
      'Live Band Set|6:00 PM to 7:30 PM',
      'Band jams|7:30 PM to 8:00 PM',
      'Rerun of the live set|8:00 PM to 10:00 PM',
    ]);
  });

  it('writes clock times the 12-hour way', () => {
    expect(clock(0)).toBe('12:00 AM');
    expect(clock(720)).toBe('12:00 PM');
    expect(clock(1440)).toBe('12:00 AM');
    expect(clock(1170)).toBe('7:30 PM');
  });

  it('does not list what does not exist yet', () => {
    const all = [...DAILY_SLOTS, ...THURSDAY_EVENING]
      .map((s) => `${s.title} ${s.detail}`)
      .join(' ');
    expect(all).not.toMatch(/space opera|geolarp|tutorial/i);
  });
});
