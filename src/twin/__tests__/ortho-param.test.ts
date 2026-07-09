import { describe, it, expect } from 'vitest';
import { parseOrthoParam } from '../TwinCanvas.client';

describe('parseOrthoParam (?ortho scripted-capture syntax)', () => {
  it('absent → off', () => {
    expect(parseOrthoParam('')).toEqual({ on: false });
    expect(parseOrthoParam('?house')).toEqual({ on: false });
  });
  it('bare ?ortho → on, full-extent frame (no override)', () => {
    expect(parseOrthoParam('?ortho')).toEqual({ on: true });
    expect(parseOrthoParam('?house&ortho')).toEqual({ on: true });
  });
  it('?ortho=cx,cz,halfH → district zoom frame in world metres', () => {
    expect(parseOrthoParam('?ortho=-6.5,9.25,120')).toEqual({
      on: true,
      frame: { center: [-6.5, 9.25], halfH: 120 },
    });
  });
  it('malformed value degrades to bare on (never crashes the view)', () => {
    expect(parseOrthoParam('?ortho=abc')).toEqual({ on: true });
    expect(parseOrthoParam('?ortho=1,2')).toEqual({ on: true });
    expect(parseOrthoParam('?ortho=1,2,-3')).toEqual({ on: true }); // negative halfH
  });
  it('halfH=0 degrades to full extent — a zero half-height means a 0/0 frustum (NaN projection, blank canvas)', () => {
    expect(parseOrthoParam('?ortho=1,2,0')).toEqual({ on: true });
    expect(parseOrthoParam('?ortho=1,2,0.0')).toEqual({ on: true });
    expect(parseOrthoParam('?ortho=1,2,0.5')).toEqual({
      on: true,
      frame: { center: [1, 2], halfH: 0.5 },
    });
  });
});
