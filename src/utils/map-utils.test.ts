import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LatLngTuple } from 'leaflet';
import {
  DEFAULT_MAP_CONFIG,
  fixLeafletIconPaths,
  calculateDistance,
  isValidLatitude,
  isValidLongitude,
  isValidLatLng,
  isValidZoom,
  formatCoordinates,
  getGeolocationErrorMessage,
  createMapError,
  MapErrorCode,
  OSM_TILE_URL,
  OSM_ATTRIBUTION,
  CARTO_LIGHT_TILE_URL,
  CARTO_DARK_TILE_URL,
  CARTO_VOYAGER_TILE_URL,
  CARTO_ATTRIBUTION,
} from './map-utils';

/**
 * `map-utils.ts` had no test (#909).
 *
 * Three things in here cannot be caught by TypeScript and are the reason most
 * of these assertions exist:
 *
 *   1. **`LatLngTuple` is `[number, number]`** — lat first. Nothing in the type
 *      system distinguishes a latitude from a longitude, so a transposed index
 *      compiles perfectly and silently plots Cornwall in the Gulf of Guinea.
 *      Every coordinate assertion below therefore uses a point where lat and
 *      lng are *not* interchangeable, and `calculateDistance` is checked at
 *      60°N (where a degree of longitude is half a degree of latitude) rather
 *      than at the equator (where they are identical and a swap is invisible).
 *   2. **The validators coerce.** `isNaN(x)` and `x >= -90` both run ToNumber,
 *      so `isValidLatLng` accepts numeric *strings* and `null`. That is tested
 *      as-is and flagged, not "fixed".
 *   3. **`getGeolocationErrorMessage` switches on the error's OWN constants**
 *      (`error.PERMISSION_DENIED`), not the global ones. A plain `{ code: 1 }`
 *      falls through to the unknown-error arm — which is exactly what a
 *      hand-rolled test double looks like.
 *
 * Distances are asserted with `toBeCloseTo(..., 3)` — half a millimetre. The
 * arithmetic is deterministic IEEE-754, so these values are reproducible to the
 * last digit printed; 3 places is loose enough to survive an algebraically
 * equivalent rewrite of the formula (ULP drift at 2×10^7 m is ~10^-8 m) and
 * still roughly six orders of magnitude tighter than any real defect.
 */

const at = (lat: number, lng: number): LatLngTuple => [lat, lng];

// One degree of latitude, anywhere, on a 6371 km sphere.
const ONE_DEGREE_M = 111194.926644;

describe('DEFAULT_MAP_CONFIG', () => {
  it('is the exact London-centred default the map components spread', () => {
    expect(DEFAULT_MAP_CONFIG).toEqual({
      center: [51.505, -0.09],
      zoom: 13,
      minZoom: 1,
      maxZoom: 18,
      height: '400px',
      width: '100%',
      showUserLocation: false,
      allowZoom: true,
      allowPan: true,
      scrollWheelZoom: false,
      keyboardNavigation: true,
      zoomControl: true,
    });
  });

  it('centres on London, not on the Gulf of Guinea', () => {
    // Both halves of the tuple are in range, so `isValidLatLng` cannot tell a
    // swap from the real thing. Formatting it can: transposed this reads
    // "0.0900°N, 51.5050°E", which is open ocean off West Africa.
    // Spreading the tuple would not type-check: Leaflet's LatLngTuple also
    // admits a 3-element [lat, lng, alt] form, so it never narrows to exactly
    // two arguments. Index explicitly instead.
    const [lat, lng] = DEFAULT_MAP_CONFIG.center;
    expect(formatCoordinates(lat, lng)).toBe('51.5050°N, 0.0900°W');
  });

  it('defaults to a zoom its own min/max admit', () => {
    expect(isValidZoom(DEFAULT_MAP_CONFIG.zoom)).toBe(true);
    expect(DEFAULT_MAP_CONFIG.zoom).toBeGreaterThanOrEqual(
      DEFAULT_MAP_CONFIG.minZoom
    );
    expect(DEFAULT_MAP_CONFIG.zoom).toBeLessThanOrEqual(
      DEFAULT_MAP_CONFIG.maxZoom
    );
  });

  it('keeps its zoom bounds in step with isValidZoom, which duplicates them', () => {
    // isValidZoom's `min = 1, max = 18` defaults are a second copy of these two
    // numbers. Moving one and not the other yields a config the validator
    // rejects; nothing else in the repo would notice.
    expect(isValidZoom(DEFAULT_MAP_CONFIG.minZoom)).toBe(true);
    expect(isValidZoom(DEFAULT_MAP_CONFIG.minZoom - 1)).toBe(false);
    expect(isValidZoom(DEFAULT_MAP_CONFIG.maxZoom)).toBe(true);
    expect(isValidZoom(DEFAULT_MAP_CONFIG.maxZoom + 1)).toBe(false);
  });

  it('leaves scroll-wheel zoom off so the map cannot hijack page scrolling', () => {
    expect(DEFAULT_MAP_CONFIG.scrollWheelZoom).toBe(false);
    // ...while keyboard navigation stays on, which is the a11y half of that
    // trade: no wheel zoom means the keyboard is the non-pointer route in.
    expect(DEFAULT_MAP_CONFIG.keyboardNavigation).toBe(true);
  });
});

describe('calculateDistance', () => {
  it('returns exactly zero for a point and itself', () => {
    expect(calculateDistance(at(51.505, -0.09), at(51.505, -0.09))).toBe(0);
  });

  it('measures one degree of latitude as ~111.195 km', () => {
    expect(calculateDistance(at(0, 0), at(1, 0))).toBeCloseTo(ONE_DEGREE_M, 3);
    // Meridians do not converge, so the same degree costs the same at 60°N.
    expect(calculateDistance(at(60, 0), at(61, 0))).toBeCloseTo(
      ONE_DEGREE_M,
      3
    );
  });

  it('shrinks a degree of longitude with latitude — the lat/lng ordering guard', () => {
    // At the equator a degree of lng equals a degree of lat, so an
    // index-transposed implementation passes there. At 60°N it does not: the
    // parallel is half as long, and reading [1] as the latitude would report
    // 111 km instead of 55.6 km.
    expect(calculateDistance(at(0, 0), at(0, 1))).toBeCloseTo(ONE_DEGREE_M, 3);
    expect(calculateDistance(at(60, 0), at(60, 1))).toBeCloseTo(
      55596.934071,
      3
    );
    expect(calculateDistance(at(60, 0), at(60, 1))).toBeLessThan(
      calculateDistance(at(60, 0), at(61, 0))
    );
  });

  it('crosses the antimeridian the short way', () => {
    // Δλ here is -358°, and the naive "difference in degrees × metres" reading
    // of that is 39,800 km — the long way round the planet. Haversine's
    // sin(Δλ/2) is what makes it come out as the true 2° = 222 km.
    const acrossTheLine = calculateDistance(at(0, 179), at(0, -179));
    expect(acrossTheLine).toBeCloseTo(2 * ONE_DEGREE_M, 3);
    expect(acrossTheLine).toBeLessThan(300_000);
  });

  it('caps antipodal pairs at half the circumference', () => {
    const halfCircumference = Math.PI * 6371e3; // 20,015,086.796 m
    expect(calculateDistance(at(0, 0), at(0, 180))).toBeCloseTo(
      halfCircumference,
      3
    );
    expect(calculateDistance(at(90, 0), at(-90, 0))).toBeCloseTo(
      halfCircumference,
      3
    );
    // atan2 (rather than asin) is what keeps this finite and non-NaN when the
    // haversine term rounds to exactly 1.
    expect(Number.isFinite(calculateDistance(at(90, 0), at(-90, 0)))).toBe(
      true
    );
  });

  it('agrees with published great-circle distances', () => {
    expect(
      calculateDistance(at(51.505, -0.09), at(48.8566, 2.3522))
    ).toBeCloseTo(341954.438041, 3); // London → Paris, ~342 km
    expect(
      calculateDistance(at(40.7128, -74.006), at(51.5074, -0.1278))
    ).toBeCloseTo(5570222.179738, 3); // New York → London, ~5570 km
    expect(
      calculateDistance(at(-33.8688, 151.2093), at(51.5074, -0.1278))
    ).toBeCloseTo(16993933.459796, 3); // Sydney → London, ~16994 km
  });

  it('resolves sub-100-metre separations rather than rounding them away', () => {
    // useGeolocation exposes this as getDistanceTo(target); a "within N metres"
    // check is worthless if short hops collapse to 0.
    expect(
      calculateDistance(at(51.505, -0.09), at(51.505, -0.089))
    ).toBeCloseTo(69.212875, 5);
  });

  it('is symmetric', () => {
    const a = at(-33.8688, 151.2093);
    const b = at(35.6762, 139.6503);
    expect(calculateDistance(a, b)).toBe(calculateDistance(b, a));
  });

  it('propagates NaN rather than throwing or returning 0', () => {
    // Documented as-is: there is no validation here, so a caller that skips
    // isValidLatLng gets NaN back, not an exception. `NaN < 100` is false, so a
    // proximity check fails closed — worth knowing, not worth "fixing" here.
    expect(calculateDistance(at(NaN, 0), at(0, 0))).toBeNaN();
    expect(calculateDistance(at(0, 0), at(0, NaN))).toBeNaN();
  });
});

describe('isValidLatitude', () => {
  it.each([
    [0, true],
    [51.505, true],
    [-33.8688, true],
    [90, true], // inclusive upper bound: the North Pole is a latitude
    [-90, true], // inclusive lower bound
    [90.0001, false],
    [-90.0001, false],
    [180, false], // a longitude handed in as a latitude
    [NaN, false],
    [Infinity, false],
    [-Infinity, false],
  ])('isValidLatitude(%p) === %p', (lat, expected) => {
    expect(isValidLatitude(lat)).toBe(expected);
  });
});

describe('isValidLongitude', () => {
  it.each([
    [0, true],
    [-0.09, true],
    [151.2093, true],
    [180, true], // inclusive: the antimeridian is addressable from both signs
    [-180, true],
    [180.0001, false],
    [-180.0001, false],
    [NaN, false],
    [Infinity, false],
    [-Infinity, false],
  ])('isValidLongitude(%p) === %p', (lng, expected) => {
    expect(isValidLongitude(lng)).toBe(expected);
  });

  it('accepts longitudes a latitude check would reject', () => {
    // The whole point of having two validators: 150 is a fine longitude and a
    // nonsense latitude. If these ever agree, one of them is calling the other.
    expect(isValidLongitude(150)).toBe(true);
    expect(isValidLatitude(150)).toBe(false);
  });
});

describe('isValidLatLng', () => {
  it('accepts a well-formed [lat, lng] pair', () => {
    expect(isValidLatLng([51.505, -0.09])).toBe(true);
    expect(isValidLatLng([-90, -180])).toBe(true);
    expect(isValidLatLng([90, 180])).toBe(true);
  });

  it('applies the latitude bound to index 0 and the longitude bound to index 1', () => {
    // [0, 100] is valid and [100, 0] is not. Transposing the two calls inside
    // isValidLatLng flips both of these, and nothing else in the suite would.
    expect(isValidLatLng([0, 100])).toBe(true);
    expect(isValidLatLng([100, 0])).toBe(false);
  });

  it.each([
    ['not an array', 'string'],
    ['a number', 51.505],
    ['null', null],
    ['undefined', undefined],
    ['an empty array', []],
    ['a one-element array', [51.505]],
    ['a three-element array', [51.505, -0.09, 100]],
    ['an object with numeric keys', { 0: 51.505, 1: -0.09, length: 2 }],
    ['a pair of undefineds', [undefined, undefined]],
    ['an out-of-range latitude', [91, 0]],
    ['an out-of-range longitude', [0, 181]],
    ['a NaN latitude', [NaN, 0]],
  ])('rejects %s', (_label, value) => {
    expect(isValidLatLng(value)).toBe(false);
  });

  it('SURPRISE: coercion lets numeric strings and null through', () => {
    // `isNaN('51.5')` is false and `'51.5' >= -90` runs ToNumber, so a tuple
    // that came out of a form or a query string validates as a LatLngTuple and
    // is then handed to Leaflet as `["51.5", "-0.09"]`. Same for null, via
    // Number(null) === 0 — i.e. [null, null] validates as Null Island.
    // Recorded as the module's actual contract; the fix belongs in the module,
    // not in this file.
    expect(isValidLatLng(['51.5', '-0.09'])).toBe(true);
    expect(isValidLatLng([null, null])).toBe(true);
    expect(isValidLatLng(['', ''])).toBe(true);
    // The coercion is not unlimited — a non-numeric string still fails.
    expect(isValidLatLng(['north', 'west'])).toBe(false);
  });
});

describe('isValidZoom', () => {
  it.each([
    [1, true], // inclusive default min
    [13, true],
    [18, true], // inclusive default max
    [0, false],
    [19, false],
    [-1, false],
    [NaN, false],
    [Infinity, false],
  ])(
    'isValidZoom(%p) === %p with the default 1–18 bounds',
    (zoom, expected) => {
      expect(isValidZoom(zoom)).toBe(expected);
    }
  );

  it('rejects fractional zooms even inside the range', () => {
    // Leaflet permits fractional zoom only with zoomSnap configured; this
    // helper deliberately does not, via Number.isInteger.
    expect(isValidZoom(13.5)).toBe(false);
    expect(isValidZoom(0.5)).toBe(false);
    expect(isValidZoom(17.999999)).toBe(false);
    expect(isValidZoom(13.0)).toBe(true); // 13.0 IS the integer 13
  });

  it('honours custom bounds instead of the defaults', () => {
    expect(isValidZoom(0, 0, 22)).toBe(true);
    expect(isValidZoom(22, 0, 22)).toBe(true);
    expect(isValidZoom(23, 0, 22)).toBe(false);
    expect(isValidZoom(13, 14, 18)).toBe(false);
    expect(isValidZoom(-5, -10, 0)).toBe(true);
  });

  it('rejects everything when the bounds are inverted', () => {
    // min > max is an empty interval, not a silently-swapped one.
    expect(isValidZoom(13, 18, 1)).toBe(false);
  });
});

describe('formatCoordinates', () => {
  it.each([
    [51.505, -0.09, '51.5050°N, 0.0900°W'], // London
    [-33.8688, 151.2093, '33.8688°S, 151.2093°E'], // Sydney
    [40.7128, -74.006, '40.7128°N, 74.0060°W'], // New York
    [-34.6037, -58.3816, '34.6037°S, 58.3816°W'], // Buenos Aires
    [0, 0, '0.0000°N, 0.0000°E'], // Null Island: zero is N and E
  ])('formats (%p, %p) as %p', (lat, lng, expected) => {
    expect(formatCoordinates(lat, lng)).toBe(expected);
  });

  it('puts the latitude first and drops the sign in favour of the hemisphere', () => {
    // Transposing the arguments gives '20.0000°N, 10.0000°E'; dropping Math.abs
    // gives '-10.0000°S'. Both are caught here.
    expect(formatCoordinates(10, 20)).toBe('10.0000°N, 20.0000°E');
    expect(formatCoordinates(-10, -20)).toBe('10.0000°S, 20.0000°W');
    expect(formatCoordinates(10, -20)).toBe('10.0000°N, 20.0000°W');
    expect(formatCoordinates(-10, 20)).toBe('10.0000°S, 20.0000°E');
  });

  it('pads and rounds to exactly four decimal places (~11 m of precision)', () => {
    expect(formatCoordinates(1, 2)).toBe('1.0000°N, 2.0000°E');
    expect(formatCoordinates(51.99999, 0.00005)).toBe('52.0000°N, 0.0001°E');
    // toFixed rounds the stored double, not the decimal literal: 12.34565 is
    // held as slightly less than the tie, so it rounds DOWN. Deterministic per
    // ECMA-262, but not what "round half up" would predict.
    expect(formatCoordinates(12.34565, 0)).toBe('12.3456°N, 0.0000°E');
  });

  it('does not validate — out-of-range input is formatted, not rejected', () => {
    // Real behaviour, and a reason callers must gate on isValidLatLng first.
    expect(formatCoordinates(999, -999)).toBe('999.0000°N, 999.0000°W');
    expect(formatCoordinates(NaN, NaN)).toBe('NaN°S, NaN°W');
  });
});

describe('getGeolocationErrorMessage', () => {
  const geolocationError = (code: number): GeolocationPositionError => ({
    code,
    message: '',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  });

  it('explains a denied permission and points at browser settings', () => {
    expect(getGeolocationErrorMessage(geolocationError(1))).toBe(
      'Location access was denied. Please enable location permissions in your browser settings.'
    );
  });

  it('explains an unavailable position', () => {
    expect(getGeolocationErrorMessage(geolocationError(2))).toBe(
      'Your location could not be determined. Please check your device settings.'
    );
  });

  it('explains a timeout and invites a retry', () => {
    expect(getGeolocationErrorMessage(geolocationError(3))).toBe(
      'Location request timed out. Please try again.'
    );
  });

  it.each([0, 4, -1, NaN])(
    'falls back to the unknown-error message for code %p',
    (code) => {
      expect(getGeolocationErrorMessage(geolocationError(code))).toBe(
        'An unknown error occurred while getting your location.'
      );
    }
  );

  it('gives four distinct messages, one per branch', () => {
    const messages = [1, 2, 3, 99].map((c) =>
      getGeolocationErrorMessage(geolocationError(c))
    );
    expect(new Set(messages).size).toBe(4);
    for (const message of messages) {
      // These render straight into the UI next to LocationButton.
      expect(message).toMatch(/^[A-Z].*\.$/);
    }
  });

  it('SURPRISE: switches on the error object’s OWN constants, not the global ones', () => {
    // `case error.PERMISSION_DENIED:` reads the instance. A test double or a
    // structured-clone survivor that carries only `{ code: 1 }` compares 1
    // against undefined and lands in `default:` — so a real permission denial
    // can be reported as "unknown error" purely because the constants were
    // stripped in transit.
    const stripped = { code: 1, message: '' } as GeolocationPositionError;
    expect(getGeolocationErrorMessage(stripped)).toBe(
      'An unknown error occurred while getting your location.'
    );
  });
});

describe('MapErrorCode', () => {
  it('pins every member to its own name as a string value', () => {
    expect({ ...MapErrorCode }).toEqual({
      PERMISSION_DENIED: 'PERMISSION_DENIED',
      POSITION_UNAVAILABLE: 'POSITION_UNAVAILABLE',
      TIMEOUT: 'TIMEOUT',
      TILE_LOAD_ERROR: 'TILE_LOAD_ERROR',
      INVALID_COORDINATES: 'INVALID_COORDINATES',
      LEAFLET_INIT_ERROR: 'LEAFLET_INIT_ERROR',
    });
  });

  it('is a string enum, so a serialised code survives a round trip', () => {
    for (const [key, value] of Object.entries(MapErrorCode)) {
      expect(value).toBe(key);
      expect(JSON.parse(JSON.stringify({ code: value })).code).toBe(key);
    }
  });
});

describe('createMapError', () => {
  it('produces a real Error carrying the code and details', () => {
    const details = { tile: '13/4093/2723', status: 503 };
    const error = createMapError(
      MapErrorCode.TILE_LOAD_ERROR,
      'Tile failed to load',
      details
    ) as Error & { code: MapErrorCode; details?: unknown };

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Tile failed to load');
    expect(error.code).toBe(MapErrorCode.TILE_LOAD_ERROR);
    expect(error.details).toBe(details); // by reference, not a copy
    expect(error.name).toBe('Error');
    expect(typeof error.stack).toBe('string');
  });

  it('leaves details undefined when the caller omits them', () => {
    const error = createMapError(
      MapErrorCode.INVALID_COORDINATES,
      'Bad coordinates'
    ) as Error & { details?: unknown };
    expect(error.details).toBeUndefined();
    expect(error.message).toBe('Bad coordinates');
  });

  it('survives throw/catch with its code intact', () => {
    // The only reason to attach `code` to an Error rather than return an object
    // is so a catch block can branch on it.
    expect(() => {
      throw createMapError(MapErrorCode.LEAFLET_INIT_ERROR, 'init failed');
    }).toThrow('init failed');

    try {
      throw createMapError(MapErrorCode.TIMEOUT, 'timed out', 5000);
    } catch (caught) {
      const error = caught as Error & {
        code: MapErrorCode;
        details?: unknown;
      };
      expect(error.code).toBe(MapErrorCode.TIMEOUT);
      expect(error.details).toBe(5000);
      expect(String(error)).toBe('Error: timed out');
    }
    expect.assertions(4);
  });

  it('returns a distinct instance per call', () => {
    const a = createMapError(MapErrorCode.TIMEOUT, 'x');
    const b = createMapError(MapErrorCode.TIMEOUT, 'x');
    expect(a).not.toBe(b);
  });
});

describe('tile URLs and attribution', () => {
  it('pins the OSM template, including the {s} subdomain placeholder', () => {
    // Leaflet substitutes {s}/{z}/{x}/{y} itself; a missing brace ships a URL
    // that 404s on every tile with no build or type error.
    expect(OSM_TILE_URL).toBe(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    );
  });

  it('pins the CARTO templates, which add the {r} retina placeholder', () => {
    expect(CARTO_LIGHT_TILE_URL).toBe(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    );
    expect(CARTO_DARK_TILE_URL).toBe(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    );
    expect(CARTO_VOYAGER_TILE_URL).toBe(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
    );
  });

  it('gives the light and dark basemaps genuinely different styles', () => {
    // A copy-paste that leaves both pointing at light_all type-checks, and the
    // dark-theme map then just looks slightly dimmed by the CSS filter.
    const urls = [
      CARTO_LIGHT_TILE_URL,
      CARTO_DARK_TILE_URL,
      CARTO_VOYAGER_TILE_URL,
    ];
    expect(new Set(urls).size).toBe(3);
    expect(CARTO_LIGHT_TILE_URL).toContain('/light_all/');
    expect(CARTO_DARK_TILE_URL).toContain('/dark_all/');
  });

  it('serves every basemap over https with the coordinate placeholders intact', () => {
    for (const url of [
      OSM_TILE_URL,
      CARTO_LIGHT_TILE_URL,
      CARTO_DARK_TILE_URL,
      CARTO_VOYAGER_TILE_URL,
    ]) {
      expect(url.startsWith('https://')).toBe(true);
      expect(url).toContain('{s}');
      expect(url).toContain('{z}');
      expect(url).toContain('{x}');
      expect(url).toContain('{y}');
    }
  });

  it('credits OpenStreetMap, which its licence requires', () => {
    // ODbL attribution is a legal obligation, not decoration, and it is
    // rendered as raw HTML into the Leaflet attribution control.
    expect(OSM_ATTRIBUTION).toBe(
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    );
    expect(CARTO_ATTRIBUTION).toContain(
      'https://www.openstreetmap.org/copyright'
    );
    expect(CARTO_ATTRIBUTION).toContain('https://carto.com/attributions');
    expect(CARTO_ATTRIBUTION).toBe(
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    );
  });
});

// Local mock overrides the global Leaflet stub in tests/setup.ts so this file
// can assert on a prototype and a spy it owns, rather than on shared state
// another test file may already have mutated.
const leaflet = vi.hoisted(() => ({
  prototype: {} as Record<string, unknown>,
  mergeOptions: vi.fn(),
}));

vi.mock('leaflet', () => ({
  default: {
    Icon: {
      Default: {
        prototype: leaflet.prototype,
        mergeOptions: leaflet.mergeOptions,
      },
    },
  },
}));

describe('fixLeafletIconPaths', () => {
  beforeEach(() => {
    leaflet.mergeOptions.mockClear();
    // Leaflet's real default icon resolves its URL through this method, which
    // webpack rewrites into a broken path. Re-arm it before every test.
    leaflet.prototype._getIconUrl = () => 'broken-webpack-path.png';
  });

  it('points the default marker at the three /leaflet/ assets', async () => {
    await fixLeafletIconPaths();

    expect(leaflet.mergeOptions).toHaveBeenCalledTimes(1);
    expect(leaflet.mergeOptions).toHaveBeenCalledWith({
      iconRetinaUrl: '/leaflet/marker-icon-2x.png',
      iconUrl: '/leaflet/marker-icon.png',
      shadowUrl: '/leaflet/marker-shadow.png',
    });
  });

  it('deletes _getIconUrl first, or mergeOptions would be ignored', async () => {
    expect('_getIconUrl' in leaflet.prototype).toBe(true);

    await fixLeafletIconPaths();

    // Leaflet prefers _getIconUrl over the merged options, so the delete is
    // the load-bearing half of this function: leave it in place and the icons
    // stay broken however correct the three URLs are.
    expect('_getIconUrl' in leaflet.prototype).toBe(false);
  });

  it('is idempotent, since MapContainer calls it on every mount', async () => {
    await fixLeafletIconPaths();
    await expect(fixLeafletIconPaths()).resolves.toBeUndefined();
    expect(leaflet.mergeOptions).toHaveBeenCalledTimes(2);
    expect('_getIconUrl' in leaflet.prototype).toBe(false);
  });

  it('does nothing on the server, where importing Leaflet would throw', async () => {
    // Leaflet reads window.requestAnimationFrame at module scope, so this
    // guard is what keeps the static export build (and any RSC render) from
    // crashing. Removing it makes `await import('leaflet')` run server-side.
    vi.stubGlobal('window', undefined);
    try {
      expect(typeof window).toBe('undefined');
      await expect(fixLeafletIconPaths()).resolves.toBeUndefined();
      expect(leaflet.mergeOptions).not.toHaveBeenCalled();
      expect('_getIconUrl' in leaflet.prototype).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(typeof window).toBe('object');
  });
});
