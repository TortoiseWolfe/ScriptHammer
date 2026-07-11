#!/usr/bin/env node
// Dev-only overrides writer (#259 iteration 6).
//
// The twin placement editor edits live in browser localStorage; making them
// part of the shipped model previously required Export → paste into
// overrides-<site>.json → re-bake. On a STATIC-EXPORT site the browser can't
// write repo files, and Next's `output:'export'` forbids a write API route.
// This tiny sidecar runs ONLY alongside `next dev` on the developer's machine
// and owns one job: POST the current overrides → merge into
// scripts/warehouse/overrides-<site>.json on disk. The next bake picks them
// up automatically — no clipboard, no paste.
//
// It is never part of the production build and never runs on the live site
// (the editor only shows its Save button when this server answers /health on
// localhost).
//
// Run:  node scripts/dev/overrides-server.mjs   (or via the dev script)

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.OVERRIDES_PORT ?? 3099);
const ROOT = process.cwd();
// Only the dev origin may call this; it never listens beyond localhost.
const ALLOW_ORIGIN = process.env.OVERRIDES_ORIGIN ?? 'http://127.0.0.1:3002';

const isPlainOverride = (v) =>
  v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).every((k) =>
    ['yawDeg', 'scale', 'yOffset', 'dx', 'dz', 'exclude', '_why'].includes(k)
  );

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, service: 'twin-overrides' }));
  }
  const m = req.method === 'POST' && /^\/twin-overrides\/([a-z0-9-]+)$/.exec(req.url ?? '');
  if (!m) {
    res.writeHead(404);
    return res.end('not found');
  }
  const site = m[1];
  const file = path.join(ROOT, 'scripts', 'warehouse', `overrides-${site}.json`);

  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    try {
      const incoming = JSON.parse(body || '{}');
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        res.writeHead(400);
        return res.end('body must be an object of slug → override');
      }
      for (const [slug, ov] of Object.entries(incoming)) {
        if (slug === '_readme') continue;
        if (!isPlainOverride(ov)) {
          res.writeHead(400);
          return res.end(`invalid override for "${slug}"`);
        }
      }

      // Merge onto the existing file: preserve _readme and any curated _why
      // metadata; incoming edits replace a slug's placement fields. An empty
      // incoming override ({}) means "no local tuning" — drop the entry
      // UNLESS it carries curated metadata (exclude/_why) we shouldn't lose.
      const existing = await readFile(file, 'utf8')
        .then((t) => JSON.parse(t))
        .catch(() => ({}));
      const merged = { ...existing };
      for (const [slug, ov] of Object.entries(incoming)) {
        if (slug === '_readme') continue;
        const prev = existing[slug] ?? {};
        const hasEdits = Object.keys(ov).length > 0;
        if (!hasEdits) {
          // Editor cleared this slug. Keep it only if it was a curated exclude.
          if (prev.exclude && prev._why) merged[slug] = prev;
          else delete merged[slug];
          continue;
        }
        // Preserve a curated _why if the incoming edit doesn't set one.
        merged[slug] = prev._why && !ov._why ? { ...ov, _why: prev._why } : ov;
      }

      await writeFile(file, JSON.stringify(merged, null, 2) + '\n');
      const count = Object.keys(merged).filter((k) => k !== '_readme').length;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, file: `overrides-${site}.json`, count }));
      console.log(
        `[overrides] wrote ${Object.keys(incoming).length} edit(s) → overrides-${site}.json (${count} total)`
      );
    } catch (err) {
      res.writeHead(500);
      res.end(String(err?.message ?? err));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `[overrides] dev writer on http://127.0.0.1:${PORT} (allow ${ALLOW_ORIGIN}) — POST /twin-overrides/<site>`
  );
});
