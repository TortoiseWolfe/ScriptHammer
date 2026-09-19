#!/usr/bin/env node
/**
 * Does the live-imagery ground hitch when you walk into new tiles? (#1176)
 *
 * WHY THIS EXISTS AS A SCRIPT. It was a user report — "it lags periodically,
 * maybe as I'm walking over the stitching" — and the useful thing was not a
 * frame-rate number but an ATTRIBUTION: of the frames that stalled, how many
 * landed within 400 ms of a tile finishing. That fraction is what says whether
 * the imagery pipeline is the cause, and it is what to re-check after touching
 * the loader, the radius, the tile size or the geometry cache.
 *
 * IT WARMS UP FIRST, deliberately. Scene init, the first geometry builds and
 * the first texture uploads all land in the opening seconds and are not what
 * "lags while walking" means. Measuring through them buries the steady-state
 * signal under one startup spike — the first version of this did exactly that
 * and reported a 4.6 s worst frame that had nothing to do with the complaint.
 *
 * IT IS NOT A GATE, and must not become one. It runs under swiftshader, where
 * every GPU operation is CPU work, so the ABSOLUTE numbers are far worse than
 * any real device and would produce a threshold that is either meaningless or
 * permanently red. Read the ratios and the attribution, and compare a before
 * against an after on the same machine.
 *
 *   docker compose run --rm builder pnpm build
 *   node scripts/perf/ground-tile-stalls.mjs          # needs a server on :3005
 *
 * Measured on this box while fixing the report, same camera path each run:
 *
 *   baseline                              worst 4783ms  p95 3933  125/184 on a tile
 *   + geometry cached per tile            worst 5066ms  p95  283   (tail only)
 *   + ImageBitmapLoader (off-thread)      worst 2133ms  p95 1700  106/142 on a tile
 *   + one texture upload per frame        worst 1750ms  p95 1567   71/147 on a tile
 */
import { chromium } from 'playwright';
const b = await chromium.launch({
  args: [
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
});
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://127.0.0.1:3005/ScriptHammer/chatt/?diorama&notour', {
  waitUntil: 'load',
  timeout: 120000,
});
await p.waitForSelector('canvas', { timeout: 60000 });

// WARM UP FIRST. Scene init, the first geometry builds and the first texture
// uploads all land in the opening seconds and are not what "lags while walking"
// means. Measuring through them buries the steady-state signal under one spike.
await p.waitForTimeout(25000);

await p.evaluate(() => {
  const w = window;
  w.__f = [];
  w.__tileAt = [];
  let last = performance.now();
  const tick = (t) => {
    w.__f.push([t, t - last]);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // Mark when a county image finishes decoding, so a stall can be ATTRIBUTED.
  const po = new PerformanceObserver((l) => {
    for (const e of l.getEntries())
      if (e.name.includes('hamiltontn.gov')) w.__tileAt.push(e.responseEnd);
  });
  po.observe({ type: 'resource', buffered: true });
});

for (let i = 0; i < 24; i++) {
  await p.mouse.move(400 + (i % 2 ? 300 : -300), 400, { steps: 10 });
  await p.mouse.wheel(0, i % 4 === 0 ? -160 : 160);
  await p.waitForTimeout(1200);
}

const r = await p.evaluate(() => {
  const f = window.__f;
  const d = f.map((x) => x[1]);
  const s = [...d].sort((a, b) => a - b);
  const pct = (q) => s[Math.floor(s.length * q)] ?? 0;
  // Was each big stall within 400 ms of a tile finishing? That is the claim.
  const tiles = window.__tileAt;
  const stalls = f.filter((x) => x[1] > 250);
  const nearTile = stalls.filter(([t]) =>
    tiles.some((tt) => Math.abs(t - tt) < 400)
  );
  return {
    frames: d.length,
    median: +pct(0.5).toFixed(1),
    p95: +pct(0.95).toFixed(1),
    p99: +pct(0.99).toFixed(1),
    worst: +Math.max(...d).toFixed(1),
    stalls_over_250ms: stalls.length,
    stalls_near_a_tile_arrival: nearTile.length,
    tiles_in_window: tiles.length,
  };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
