// Address -> lat/lon via Nominatim (#232 step 1). One request per bake run —
// inherently under the 1 req/s usage policy; identified by the shared polite UA.

import { USER_AGENT } from './overpass';

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
  address: Record<string, string>;
}

export async function geocode(query: string): Promise<GeocodeResult> {
  const url = `${ENDPOINT}?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const results = (await res.json()) as {
    lat: string;
    lon: string;
    display_name: string;
    address?: Record<string, string>;
  }[];
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(
      `Nominatim found nothing for "${query}" — try a more specific address`
    );
  }
  const r = results[0];
  return {
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    displayName: r.display_name,
    address: r.address ?? {},
  };
}

export function slugify(s: string): string {
  const slug = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || 'site';
}

/** Derive a site slug from the geocoder's structured address (road + city). */
export function slugFromGeocode(r: GeocodeResult): string {
  const a = r.address;
  const road = a.road ?? a.neighbourhood ?? a.suburb;
  const city = a.city ?? a.town ?? a.village ?? a.county;
  const parts = [road, city].filter(Boolean).join(' ');
  return slugify(parts || r.displayName.split(',').slice(0, 2).join(' '));
}
