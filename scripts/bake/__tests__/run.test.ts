import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bakeOrder, run } from '../run';

beforeEach(() => vi.restoreAllMocks());

describe('bake orchestration', () => {
  it('runs fetches before build-scene (lidar after terrain: it needs the DTM)', () => {
    expect(bakeOrder).toEqual([
      'fetch-osm',
      'fetch-ms-heights',
      'fetch-terrain',
      'fetch-lidar-heights',
      'fetch-drape',
      'build-scene',
    ]);
  });

  it('selects terrain from the geocoded country for address scaffolds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            lat: '48.8566',
            lon: '2.3522',
            display_name: '1, Rue de Rivoli, Paris, France',
            address: {
              house_number: '1',
              road: 'Rue de Rivoli',
              city: 'Paris',
              country_code: 'fr',
            },
          },
        ]),
        { status: 200 }
      )
    );
    const logged: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      logged.push(args.join(' '));
    });

    await run([
      '--address',
      '1 Rue de Rivoli, Paris',
      '--radius',
      '800',
      '--dry-run',
    ]);

    expect(logged.join('\n')).toContain('"dataset": "srtm30m"');
    expect(logged.join('\n')).toContain('slug=1-rue-de-rivoli-paris');
  });

  it('fails clearly when address geocoding has no country code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            lat: '48.8566',
            lon: '2.3522',
            display_name: 'Somewhere',
            address: {},
          },
        ]),
        { status: 200 }
      )
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(
      run(['--address', 'Somewhere', '--radius', '800', '--dry-run'])
    ).rejects.toThrow(/no country code/);
  });
});
