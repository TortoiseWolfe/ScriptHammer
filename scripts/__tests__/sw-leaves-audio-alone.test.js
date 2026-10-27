/**
 * The band's MP3s (#1408) must never pass through the service worker.
 *
 * A media element seeks with `Range` requests and needs a 206 back. The
 * worker's default handler answers cache-first and stores every 200, so an
 * MP3 routed through it would sit in the cache for nothing and a cached full
 * 200 breaks seeking in Safari. This runs the real public/sw.js in a vm with a
 * fake worker scope and drives its fetch listener, so it fails if the bypass
 * is removed, which a text search of the source would not.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SW = path.resolve(__dirname, '..', '..', 'public', 'sw.js');
const SOURCE = fs.readFileSync(SW, 'utf8');

function loadWorker() {
  const listeners = {};
  const noop = () => {};
  const self = {
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
    registration: { scope: 'https://example.test/' },
    clients: { claim: noop, matchAll: async () => [] },
    skipWaiting: noop,
    location: { origin: 'https://example.test' },
  };
  const context = vm.createContext({
    self,
    caches: {
      match: async () => undefined,
      open: async () => ({ put: noop, addAll: noop }),
      keys: async () => [],
      delete: async () => true,
    },
    fetch: async () => ({ status: 200, clone: () => ({}) }),
    URL,
    Response: class {},
    Headers: class {},
    console,
    Promise,
  });
  vm.runInContext(SOURCE, context, { filename: SW });
  return listeners.fetch;
}

function drive(fetchListener, { url, destination = '', range = false }) {
  let responded = false;
  fetchListener({
    request: {
      url,
      method: 'GET',
      mode: 'no-cors',
      destination,
      headers: { has: (name) => range && name.toLowerCase() === 'range' },
    },
    respondWith: () => {
      responded = true;
    },
  });
  return responded;
}

describe('service worker and audio (#1408)', () => {
  const fetchListener = loadWorker();

  it('registers a fetch listener', () => {
    assert.strictEqual(typeof fetchListener, 'function');
  });

  it('leaves an MP3 to the browser', () => {
    assert.strictEqual(
      drive(fetchListener, {
        url: 'https://example.test/ScriptHammer/band/audio/band-wagon-theme.mp3',
        destination: 'audio',
      }),
      false
    );
  });

  it('leaves a Range request to the browser, whatever the file', () => {
    assert.strictEqual(
      drive(fetchListener, {
        url: 'https://example.test/some/file.bin',
        range: true,
      }),
      false
    );
  });

  it('still handles an ordinary asset (the bypass is narrow)', () => {
    assert.strictEqual(
      drive(fetchListener, { url: 'https://example.test/some/file.css' }),
      true
    );
  });

  it('does not precache any MP3', () => {
    assert.ok(!/STATIC_ASSETS[\s\S]{0,2000}\.mp3/.test(SOURCE));
  });
});
