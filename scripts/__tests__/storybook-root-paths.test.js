/**
 * Guards scripts/fix-storybook-root-paths.mjs.
 *
 * Production serves Storybook under /storybook/. A root-absolute script tag in iframe.html makes the
 * browser fetch it from the site root, where it is a 404 page, and every story then fails with
 * "Importing a module script failed" (14 Nov 2026, the module mocker). Each case has a control.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { relativise, rootScripts } from '../fix-storybook-root-paths.mjs';

const BUILT =
  '<head><script type="module" src="/vite-inject-mocker-entry.js"></script>' +
  '<script type="module" crossorigin src="./assets/iframe-abc.js"></script></head>';

describe('fix-storybook-root-paths', () => {
  it('makes the mocker entry relative when the build emitted it', () => {
    const { html, changed } = relativise(
      BUILT,
      (f) => f === 'vite-inject-mocker-entry.js'
    );
    assert.deepEqual(changed, ['vite-inject-mocker-entry.js']);
    assert.match(html, /src="\.\/vite-inject-mocker-entry\.js"/);
    assert.deepEqual(rootScripts(html), []);
  });

  it('control: the untouched build output is caught as loading from the site root', () => {
    assert.deepEqual(rootScripts(BUILT), ['/vite-inject-mocker-entry.js']);
  });

  it('leaves a root path alone when no such file was built, and still reports it', () => {
    const { html, changed } = relativise(BUILT, () => false);
    assert.deepEqual(changed, []);
    assert.equal(html, BUILT);
    assert.deepEqual(rootScripts(html), ['/vite-inject-mocker-entry.js']);
  });

  it('does not touch relative or protocol-relative sources', () => {
    const page =
      '<script src="./a.js"></script><script src="//cdn.example/b.js"></script>';
    assert.deepEqual(rootScripts(page), []);
    assert.equal(relativise(page, () => true).html, page);
  });
});
