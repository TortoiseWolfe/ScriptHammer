import { describe, it, expect } from 'vitest';
import { parseHourParam, parseWeatherParam } from '../TwinCanvas.client';

describe('parseHourParam — ?hour= time of day', () => {
  it('defaults to 13 (bright afternoon) when absent or malformed', () => {
    expect(parseHourParam('')).toBe(13);
    expect(parseHourParam('?diorama&walk')).toBe(13);
    expect(parseHourParam('?hour=')).toBe(13);
    expect(parseHourParam('?hour=abc')).toBe(13);
  });

  it('reads the hour and clamps it to [0, 24]', () => {
    expect(parseHourParam('?hour=6')).toBe(6);
    expect(parseHourParam('?hour=18.5')).toBe(18.5);
    expect(parseHourParam('?walk&hour=20')).toBe(20);
    expect(parseHourParam('?hour=-3')).toBe(0); // clamp low
    expect(parseHourParam('?hour=30')).toBe(24); // clamp high
  });
});

describe('parseWeatherParam — ?weather=', () => {
  it('is none unless explicitly rain', () => {
    expect(parseWeatherParam('')).toBe('none');
    expect(parseWeatherParam('?diorama&walk')).toBe('none');
    expect(parseWeatherParam('?weather=snow')).toBe('none');
    expect(parseWeatherParam('?weather=')).toBe('none');
  });
  it('turns on rain', () => {
    expect(parseWeatherParam('?weather=rain')).toBe('rain');
    expect(parseWeatherParam('?walk&weather=rain')).toBe('rain');
  });
});
