#!/usr/bin/env node
/**
 * QC contact sheet for the sampled city (issue #259, iteration 3).
 *
 * Generates sites/_warehouse/qc.html (LOCAL-ONLY, gitignored): one card per
 * emitted model — the Warehouse's own public thumbnail render, title,
 * creator, ★rating (reviewCount), downloads, our post-abstraction stats,
 * links to the Warehouse page and the viewer deep-link
 * (/chatt/?edit&select=<slug>) — with an Exclude checkbox per card. Inline
 * JS builds paste-ready overrides JSON from the checked set for
 * scripts/warehouse/overrides-<site>.json.
 *
 * Run:  docker compose exec scripthammer pnpm run warehouse:qc
 * Open: sites/_warehouse/qc.html in any browser (thumbnails hotlink the
 *       Warehouse's public CDN — local viewing only, nothing is published).
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: { site: { type: 'string', default: 'chatt' } },
});
const site = args.site;

const ROOT = path.resolve('sites/_warehouse');
const inventory = JSON.parse(await readFile(path.join(ROOT, 'inventory.json'), 'utf8'));
const report = JSON.parse(await readFile(path.join(ROOT, 'report.json'), 'utf8'));
const modelsJson = JSON.parse(
  await readFile(path.resolve(`public/twins/${site}/models/models.json`), 'utf8')
);
const overrides = JSON.parse(
  await readFile(path.resolve(`scripts/warehouse/overrides-${site}.json`), 'utf8')
);
// Per-slug pipeline grants (#259 iter 5) — a granted extent isn't flagged.
const abstractCfg = await readFile(
  path.resolve(`scripts/warehouse/abstract-${site}.json`),
  'utf8'
)
  .then((t) => JSON.parse(t))
  .catch(() => ({}));

const invById = new Map(inventory.models.map((m) => [m.id, m]));
const statsBySlug = new Map(report.models.map((m) => [m.slug, m.after]));

// Extent badge (#259 iter 5): the review found 91/134 models shipping site
// context (>150m XZ); after culling, anything still oversized and ungranted
// is a curation decision waiting to happen — flag it and sort it first.
const EXTENT_WARN_M = 150;
const EXTENT_RED_M = 300;
function extentBadge(slug, st) {
  const d = st.dimensions;
  if (!d) return { level: 0, html: '' };
  const xz = Math.max(d.x, d.z);
  const grant = abstractCfg[slug] ?? {};
  const granted =
    grant.keepAll === true ||
    (typeof grant.maxExtentM === 'number' && xz <= grant.maxExtentM);
  const dims = `${Math.round(d.x)}×${Math.round(d.y)}×${Math.round(d.z)}m`;
  if (granted || xz <= EXTENT_WARN_M)
    return { level: 0, html: `<span class="meta">${dims}</span>` };
  const cls = xz > EXTENT_RED_M ? 'ext-red' : 'ext-warn';
  return {
    level: xz > EXTENT_RED_M ? 2 : 1,
    html: `<span class="badge ${cls}">${dims} — context?</span>`,
  };
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const cards = modelsJson.models
  .map((m) => {
    const inv = invById.get(m.warehouseId) ?? {};
    const st = statsBySlug.get(m.slug) ?? {};
    const excluded = overrides[m.slug]?.exclude === true;
    const rating =
      m.rating != null ? `★${m.rating.toFixed(1)}${m.reviewCount ? ` (${m.reviewCount})` : ''}` : '—';
    const tris = st.lodTriangles?.LOD0 != null ? `${(st.lodTriangles.LOD0 / 1e3).toFixed(1)}k tris` : '';
    const kb = st.glbBytes != null ? `${Math.round(st.glbBytes / 1024)} KB` : '';
    const badge = extentBadge(m.slug, st);
    return {
      level: badge.level,
      html: `
    <div class="card" data-slug="${esc(m.slug)}">
      <img loading="lazy" src="${esc(inv.thumbnailUrl ?? '')}" alt="${esc(m.title)}">
      <div class="body">
        <strong>${esc(m.title)}</strong>
        <span class="meta">${esc(m.creator)} · ${rating} · ${m.downloads ?? 0} dl</span>
        <span class="meta">${esc(m.neighborhood)} · ${tris} · ${kb}</span>
        ${badge.html}
        <span class="links">
          <a href="${esc(m.url)}" target="_blank" rel="noreferrer">Warehouse ↗</a>
          <a href="http://127.0.0.1:3002/ScriptHammer/${site}/?edit&amp;select=${esc(m.slug)}" target="_blank">Viewer ↗</a>
        </span>
        <label><input type="checkbox" class="exclude" ${excluded ? 'checked' : ''}> Exclude</label>
      </div>
    </div>`,
    };
  })
  // Flagged cards first (red, then amber), so remaining offenders are one scroll.
  .sort((a, b) => b.level - a.level)
  .map((c) => c.html)
  .join('\n');

const html = `<!doctype html>
<meta charset="utf-8">
<title>Warehouse QC — ${esc(site)} (${modelsJson.models.length} models)</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; margin: 16px; background: #12161f; color: #eee; }
  h1 { font-size: 18px; } .hint { opacity: .7; font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-top: 12px; }
  .card { background: #1c2230; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; }
  .card img { width: 100%; aspect-ratio: 4/3; object-fit: cover; background: #0d1017; }
  .card .body { padding: 8px 10px; display: flex; flex-direction: column; gap: 3px; }
  .meta { font-size: 12px; opacity: .7; } .links a { color: #7db3ff; font-size: 12px; margin-right: 10px; }
  .badge { font-size: 12px; font-weight: 600; border-radius: 4px; padding: 1px 6px; width: fit-content; }
  .ext-warn { background: #7a5b1b; color: #ffd97a; }
  .ext-red { background: #6e2320; color: #ffb3ad; }
  label { font-size: 12px; margin-top: 4px; user-select: none; }
  .card:has(.exclude:checked) { outline: 2px solid #e5534b; opacity: .55; }
  #out { position: sticky; bottom: 0; background: #1c2230; padding: 10px; border-radius: 10px; margin-top: 16px; }
  textarea { width: 100%; height: 90px; background: #0d1017; color: #eee; border: 1px solid #333; border-radius: 6px; }
  button { padding: 8px 14px; border-radius: 6px; border: 0; background: #7db3ff; cursor: pointer; }
</style>
<h1>Warehouse QC — ${esc(site)} <span class="hint">(${modelsJson.models.length} models · generated ${new Date().toISOString().slice(0, 16)}Z)</span></h1>
<p class="hint">Check "Exclude" on any card that shouldn't ship, then copy the JSON below into
<code>scripts/warehouse/overrides-${esc(site)}.json</code> (merge with existing entries) and re-run
<code>pnpm warehouse:sync</code>. Viewer links need the dev server on :3002.</p>
<div class="grid">${cards}</div>
<div id="out">
  <textarea id="json" readonly></textarea>
  <button id="copy">Copy exclude-overrides JSON</button>
</div>
<script>
  const update = () => {
    const out = {};
    document.querySelectorAll('.card').forEach((c) => {
      if (c.querySelector('.exclude').checked) out[c.dataset.slug] = { exclude: true };
    });
    document.getElementById('json').value = JSON.stringify(out, null, 2);
  };
  document.addEventListener('change', update);
  document.getElementById('copy').addEventListener('click', () =>
    navigator.clipboard.writeText(document.getElementById('json').value));
  update();
</script>`;

const outPath = path.join(ROOT, 'qc.html');
await writeFile(outPath, html);
console.log(`[qc] ${modelsJson.models.length} cards → ${outPath}`);
