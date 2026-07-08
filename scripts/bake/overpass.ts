export const USER_AGENT = 'scripthammer-twin-bake/0.1 (jonpohlner@gmail.com)';
const ENDPOINT = 'https://overpass-api.de/api/interpreter';

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: {
    type: string;
    role: string;
    geometry?: { lat: number; lon: number }[];
  }[];
}
export interface OverpassResponse {
  elements: OverpassElement[];
}

export async function overpassQuery(
  ql: string,
  opts: { retries?: number; backoffMs?: number } = {}
): Promise<OverpassResponse> {
  const retries = opts.retries ?? 3;
  const backoffMs = opts.backoffMs ?? 2000;
  let lastErr = '';
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'data=' + encodeURIComponent(ql),
    });
    if (res.ok) return (await res.json()) as OverpassResponse;
    lastErr = `${res.status}`;
    if (backoffMs)
      await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
  }
  throw new Error(
    `Overpass failed after ${retries + 1} attempts: HTTP ${lastErr}`
  );
}
