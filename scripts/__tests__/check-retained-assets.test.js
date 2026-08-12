const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'ci', 'check-retained-assets.mjs');

function retainedEntries(extra = []) {
  return [
    ...extra,
    ...Array.from(
      { length: 20 - extra.length },
      (_, index) => `/_next/static/chunks/asset-${index}.js`
    ),
  ];
}

function runProbe(baseUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT, baseUrl]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function startServer(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('accepts a CDN-style 206 ranged GET when HEAD is unavailable', async (t) => {
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer((request, response) => {
    if (request.url === '/_next/static/ASSET_MANIFEST.txt') {
      response.end(entries.join('\n'));
      return;
    }
    if (request.method === 'HEAD') {
      response.writeHead(405).end();
      return;
    }
    assert.equal(request.headers.range, 'bytes=0-0');
    response.writeHead(206, { 'content-range': 'bytes 0-0/1' }).end('x');
  });
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl);

  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /MISSING   0/);
});

test('fails and names a missing retained stylesheet', async (t) => {
  const missing = '/_next/static/css/removed.css';
  const entries = retainedEntries([missing]);
  const server = await startServer((request, response) => {
    if (request.url === '/_next/static/ASSET_MANIFEST.txt') {
      response.end(entries.join('\n'));
      return;
    }
    if (request.url === missing) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200).end();
  });
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 1, output);
  assert.match(output, /removed\.css/);
  assert.match(output, /STYLESHEETS/);
});
