import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geocode, slugify, slugFromGeocode } from '../geocode';
import { USER_AGENT } from '../overpass';

beforeEach(() => vi.restoreAllMocks());

// Public-landmark fixture (downtown commercial block by the aquarium) — test
// fixtures must never carry a client address or parcel coordinates.
const NOMINATIM_HIT = [
  {
    lat: '35.0563000',
    lon: '-85.3111000',
    display_name:
      '1, Broad Street, Chattanooga, Hamilton County, Tennessee, 37402, United States',
    address: {
      house_number: '1',
      road: 'Broad Street',
      city: 'Chattanooga',
      state: 'Tennessee',
    },
  },
];

describe('geocode', () => {
  it('GETs Nominatim with the polite User-Agent and parses the hit', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(NOMINATIM_HIT), { status: 200 })
      );
    const r = await geocode('1 Broad St, Chattanooga TN');
    expect(r.lat).toBeCloseTo(35.0563, 7);
    expect(r.lon).toBeCloseTo(-85.3111, 7);
    expect(r.address.road).toBe('Broad Street');

    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain('nominatim.openstreetmap.org/search');
    expect(String(url)).toContain('format=jsonv2');
    expect(String(url)).toContain('limit=1');
    expect(String(url)).toContain(
      encodeURIComponent('1 Broad St, Chattanooga TN')
    );
    expect((init!.headers as Record<string, string>)['User-Agent']).toBe(
      USER_AGENT
    );
  });
  it('throws a clear error on zero results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('[]', { status: 200 })
    );
    await expect(geocode('nowhere at all')).rejects.toThrow(/found nothing/);
  });
  it('throws on an HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('slow down', { status: 429 })
    );
    await expect(geocode('x')).rejects.toThrow(/429/);
  });
});

describe('slugify / slugFromGeocode', () => {
  it('produces schema-valid slugs', () => {
    expect(slugify('Broad Street Chattanooga')).toBe(
      'broad-street-chattanooga'
    );
    expect(slugify('  --Weird__ Input!! ')).toBe('weird-input');
    expect(slugify('!!!')).toBe('site');
  });
  it('derives road + city from the structured address', () => {
    expect(
      slugFromGeocode({
        lat: 0,
        lon: 0,
        displayName: NOMINATIM_HIT[0].display_name,
        address: NOMINATIM_HIT[0].address,
      })
    ).toBe('broad-street-chattanooga');
  });
  it('falls back to the display name head without structured fields', () => {
    expect(
      slugFromGeocode({
        lat: 0,
        lon: 0,
        displayName: 'Someplace, Somewhere, Country',
        address: {},
      })
    ).toBe('someplace-somewhere');
  });
});
