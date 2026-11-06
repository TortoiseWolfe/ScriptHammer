import { describe, it, expect } from 'vitest';
import { fraction, needleAngle, offScale, roundPerDay, signed } from './gauges';

describe('band gauges maths', () => {
  it('puts zero on a -15..15 scale straight up', () => {
    expect(needleAngle(0, -15, 15)).toBe(0);
  });
  it('puts the two ends at -135 and +135', () => {
    expect(needleAngle(-15, -15, 15)).toBe(-135);
    expect(needleAngle(15, -15, 15)).toBe(135);
  });
  it('pins a value past the end and says so', () => {
    expect(needleAngle(40, -15, 15)).toBe(135);
    expect(offScale(40, -15, 15)).toBe(true);
    expect(offScale(15, -15, 15)).toBe(false);
    expect(offScale(-16, -15, 15)).toBe(true);
  });
  it('measures plays a day from 0 to the busiest song', () => {
    expect(needleAngle(0, 0, 15)).toBe(-135);
    expect(needleAngle(7.5, 0, 15)).toBe(0);
    expect(needleAngle(15, 0, 15)).toBe(135);
  });
  it('does not divide by zero on an empty scale', () => {
    expect(fraction(3, 5, 5)).toBe(0);
  });
  it('writes numbers with a sign and one decimal', () => {
    expect(signed(6)).toBe('+6');
    expect(signed(0)).toBe('0');
    expect(signed(-3)).toBe('-3');
    expect(roundPerDay(6.2857)).toBe(6.3);
  });
});
