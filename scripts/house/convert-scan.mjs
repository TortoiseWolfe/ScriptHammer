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
//     --out public/twins/<slug>/house/model.glb
//
// Prints mesh stats (vertex count + bounding-box metres) so the result can be
// sanity-checked against ground truth (e.g. a floorplan's extents) before it
// ever renders. PRIVACY: client scans live under public/twins/<slug>/ which
// is gitignored by default — this tool is committed, its inputs are not.

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
    dae: { type: 'string' },
    out: { type: 'string' },
  },
});
if (!values.dae || !values.out) {
  console.error(
    'usage: node scripts/house/convert-scan.mjs --dae <scan.dae> --out <model.glb>'
  );
  process.exit(1);
}
const daePath = resolve(values.dae);
const outPath = resolve(values.out);
if (!existsSync(daePath)) {
  console.error(`no such file: ${daePath}`);
  process.exit(1);
}
const daeDir = dirname(daePath);
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

const PAGE = `<!doctype html><html><head>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

try {
  // loadAsync resolves when the DAE parses, but its textures load through the
  // manager asynchronously — the exporter needs REAL image data, so barrier on
  // the manager before exporting.
  const manager = new THREE.LoadingManager();
  const everythingLoaded = new Promise((resolve, reject) => {
    manager.onLoad = resolve;
    manager.onError = (url) => reject(new Error('failed to load: ' + url));
  });
  const collada = await new ColladaLoader(manager).loadAsync('/scan/${encodeURIComponent(basename(daePath))}');
  await everythingLoaded;
  const scene = collada.scene;
  scene.updateMatrixWorld(true);

  let verts = 0, meshes = 0;
  scene.traverse((o) => {
    if (o.isMesh && o.geometry?.attributes?.position) {
      meshes++;
      verts += o.geometry.attributes.position.count;
    }
  });
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());

  const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
  const bytes = new Uint8Array(glb);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  window.__result = {
    glbBase64: btoa(bin),
    stats: {
      meshes,
      verts,
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
    `[convert-scan] ${basename(daePath)} → ${values.out} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`
  );
  console.log(
    `[convert-scan] ${stats.meshes} mesh(es), ${stats.verts} verts, bbox ${stats.bbox.x} x ${stats.bbox.y} x ${stats.bbox.z} m (min.y ${stats.min.y})`
  );
} finally {
  await browser.close();
  server.close();
}
