// DAE → GLB converter for premium as-built scans (#234).
//
// Converts a Polycam/Assimp COLLADA scan (with relative texture refs) into a
// single self-contained binary GLB the twin runtime can load with useGLTF.
// Runs three.js's own ColladaLoader + GLTFExporter inside headless Chromium
// (Playwright is already part of this repo's toolchain), so the conversion
// uses exactly the loader semantics the runtime ecosystem expects and needs
// no extra native dependencies.
//
//   docker compose exec scripthammer node scripts/house/convert-scan.mjs \
//     --dae public/twins/<slug>/house/_src/scan.dae \
//     [--dae public/twins/<slug>/house/_src/scan_2.dae ...] \
//     --out public/twins/<slug>/house/model.glb
//
// A Polycam PROJECT often exports as several captures — pass --dae once per
// fragment and they merge into ONE GLB, each fragment under a named group
// (its file basename) so per-part placement stays addressable downstream.
// All fragments must live in the same directory (shared textures/ subdir).
//
// Prints per-fragment mesh stats (vertex count + bounding-box metres) so the
// result can be sanity-checked against ground truth (e.g. a floorplan's
// extents) before it ever renders. PRIVACY: client scans live under
// public/twins/<slug>/ which is gitignored by default — this tool is
// committed, its inputs are not.

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, extname, basename, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

const MIME = {
  '.dae': 'model/vnd.collada+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.js': 'text/javascript',
  '.html': 'text/html',
};

const { values } = parseArgs({
  options: {
    dae: { type: 'string', multiple: true },
    out: { type: 'string' },
  },
});
if (!values.dae?.length || !values.out) {
  console.error(
    'usage: node scripts/house/convert-scan.mjs --dae <scan.dae> [--dae <more.dae> ...] --out <model.glb>'
  );
  process.exit(1);
}
const daePaths = values.dae.map((p) => resolve(p));
const outPath = resolve(values.out);
for (const p of daePaths) {
  if (!existsSync(p)) {
    console.error(`no such file: ${p}`);
    process.exit(1);
  }
}
const daeDir = dirname(daePaths[0]);
if (daePaths.some((p) => dirname(p) !== daeDir)) {
  console.error(
    'all --dae fragments must live in the same directory (shared textures/)'
  );
  process.exit(1);
}
const threeDir = resolve('node_modules/three');

// Tiny static server: /scan/** -> the DAE's directory (textures resolve
// relatively), /three/** -> the repo's three package (importmap below).
const routes = { '/scan/': daeDir, '/three/': threeDir };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(PAGE);
      return;
    }
    for (const [prefix, root] of Object.entries(routes)) {
      if (!url.startsWith(prefix)) continue;
      const rel = url.slice(prefix.length);
      const path = resolve(root, rel);
      // stay inside the served root
      if (path !== root && !path.startsWith(root + sep)) break;
      const body = await readFile(path);
      res.writeHead(200, {
        'content-type': MIME[extname(path)] ?? 'application/octet-stream',
      });
      res.end(body);
      return;
    }
    res.writeHead(404).end('not found');
  } catch {
    res.writeHead(404).end('not found');
  }
});

const FRAGMENTS = JSON.stringify(
  daePaths.map((p) => ({
    url: `/scan/${encodeURIComponent(basename(p))}`,
    name: basename(p, '.dae'),
  }))
);

const PAGE = `<!doctype html><html><head>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

try {
  const fragments = ${FRAGMENTS};
  // loadAsync resolves when the DAE parses, but its textures load through the
  // manager asynchronously — the exporter needs REAL image data. The manager
  // batches: onLoad fires when EVERYTHING queued so far completes, so arm a
  // fresh barrier BEFORE each fragment's load and await it right after the
  // parse (its textures were queued during parse and belong to that batch).
  const manager = new THREE.LoadingManager();
  const root = new THREE.Group();
  const perFragment = [];
  for (const frag of fragments) {
    const batchLoaded = new Promise((resolve, reject) => {
      manager.onLoad = resolve;
      manager.onError = (url) => reject(new Error('failed to load: ' + url));
    });
    const collada = await new ColladaLoader(manager).loadAsync(frag.url);
    await batchLoaded;
    const group = new THREE.Group();
    group.name = frag.name;
    group.add(collada.scene);
    root.add(group);
    let verts = 0, meshes = 0;
    collada.scene.traverse((o) => {
      if (o.isMesh && o.geometry?.attributes?.position) {
        meshes++;
        verts += o.geometry.attributes.position.count;
      }
    });
    root.updateMatrixWorld(true);
    const fbox = new THREE.Box3().setFromObject(group);
    const fsize = fbox.getSize(new THREE.Vector3());
    perFragment.push({
      name: frag.name, meshes, verts,
      bbox: { x: +fsize.x.toFixed(2), y: +fsize.y.toFixed(2), z: +fsize.z.toFixed(2) },
      min: { x: +fbox.min.x.toFixed(2), y: +fbox.min.y.toFixed(2), z: +fbox.min.z.toFixed(2) },
    });
  }
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());

  const glb = await new GLTFExporter().parseAsync(root, { binary: true });
  const bytes = new Uint8Array(glb);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  window.__result = {
    glbBase64: btoa(bin),
    stats: {
      fragments: perFragment,
      bbox: {
        x: +size.x.toFixed(2),
        y: +size.y.toFixed(2),
        z: +size.z.toFixed(2),
      },
      min: { y: +box.min.y.toFixed(2) },
    },
  };
} catch (e) {
  window.__error = String(e?.stack ?? e);
}
</script></body></html>`;

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('[page]', m.text().slice(0, 200));
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(
    () => window.__result || window.__error,
    undefined,
    { timeout: 120_000 }
  );
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error(`conversion failed in-page:\n${err}`);
  const { glbBase64, stats } = await page.evaluate(() => window.__result);

  await mkdir(dirname(outPath), { recursive: true });
  const buf = Buffer.from(glbBase64, 'base64');
  await writeFile(outPath, buf);
  console.log(
    `[convert-scan] ${daePaths.map((p) => basename(p)).join(' + ')} → ${values.out} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`
  );
  for (const f of stats.fragments) {
    console.log(
      `[convert-scan]   ${f.name}: ${f.meshes} mesh(es), ${f.verts} verts, bbox ${f.bbox.x} x ${f.bbox.y} x ${f.bbox.z} m (min ${f.min.x}, ${f.min.y}, ${f.min.z})`
    );
  }
  console.log(
    `[convert-scan] combined bbox ${stats.bbox.x} x ${stats.bbox.y} x ${stats.bbox.z} m (min.y ${stats.min.y})`
  );
} finally {
  await browser.close();
  server.close();
}
