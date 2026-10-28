import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STAGE_HREF, STAGE_AUDIENCE, STAGE_FACE_DEG } from './stage';
import { parseAtParam, parseFaceParam } from '@/lib/twin-location';

const stage = JSON.parse(
  readFileSync(join(process.cwd(), 'public/twins/chatt/stage.json'), 'utf8')
) as {
  lat: number;
  lon: number;
  facingDeg: number;
  audience: { lat: number; lon: number };
};

describe('the /band link to the stage', () => {
  const [path, search] = STAGE_HREF.split('?');

  it('goes to the Chattanooga twin in walk mode', () => {
    expect(path).toBe('/chatt/');
    const params = new URLSearchParams(search);
    expect(params.has('diorama')).toBe(true);
    expect(params.has('walk')).toBe(true);
  });

  it('spawns at the audience spot in stage.json', () => {
    expect(STAGE_AUDIENCE).toEqual(stage.audience);
    expect(parseAtParam(`?${search}`)).toEqual(stage.audience);
  });

  it('arrives facing the stage front', () => {
    // The front faces facingDeg; the audience looks the opposite way, at it.
    expect(STAGE_FACE_DEG).toBe((stage.facingDeg + 180) % 360);
    expect(parseFaceParam(`?${search}`)).toBe(STAGE_FACE_DEG);
  });

  it('puts the audience in front of the stage, not behind it', () => {
    // Front faces south (180), so the audience must be south of the deck.
    expect(stage.facingDeg).toBe(180);
    expect(stage.audience.lat).toBeLessThan(stage.lat);
  });
});
