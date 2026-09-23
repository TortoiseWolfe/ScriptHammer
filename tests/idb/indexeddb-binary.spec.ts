/**
 * IndexedDB binary-storage capability probe (#1209).
 *
 * WHY THIS EXISTS. WebKit cannot store a `Blob` or a `File` in IndexedDB. Anything that
 * persists binary client-side works in Chromium and Firefox and fails on iOS, and the
 * failure is unusually quiet: the write transaction fires `onerror` with a **null
 * `tx.error`**, `put()` does not throw, and `fake-indexeddb` does not faithfully clone
 * binary either — so unit tests, local development and most of CI all stay green.
 *
 * WHAT IS LOAD-BEARING HERE. The `ArrayBuffer` + MIME-type round trip is ASSERTED: that
 * is the pattern `src/lib/offline-queue/types.ts` tells a fork to use, and if it ever
 * stops working on any engine, the recommendation is wrong and this must go red.
 *
 * The raw-`Blob` measurement is REPORTED, never asserted. Asserting "webkit fails" would
 * turn a future WebKit fix into a red build, and asserting "webkit succeeds" would fail
 * today. Printing it keeps the REASON for the indirection visible — without it, the next
 * reader sees a needlessly convoluted storage shape and simplifies it back.
 *
 * No Supabase, no build, no app server: it drives a synthetic same-origin document, so it
 * measures the browser and nothing else.
 */
import { test, expect } from '@playwright/test';

/** IndexedDB is unavailable on `about:blank`, so serve a real (intercepted) origin. */
const ORIGIN = 'https://idb-probe.test/';

type ProbeResult = { ok: boolean; error: string | null };

test.beforeEach(async ({ page }) => {
  await page.route(`${ORIGIN}**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><head><title>idb probe</title></head><body></body></html>',
    })
  );
  await page.goto(ORIGIN);
});

/**
 * Store one value under a fresh database and read it back.
 *
 * Returns `{ok, error}` rather than throwing, because the interesting failure reports a
 * NULL error — a probe that rejected with the raw value would surface in Playwright as
 * `page.evaluate: null`, which is how this first appeared downstream and told us nothing.
 */
async function roundTrip(
  page: import('@playwright/test').Page,
  kind: 'blob' | 'bytes'
): Promise<ProbeResult> {
  return page.evaluate(async (which): Promise<ProbeResult> => {
    const name = `idb-probe-${which}-${Date.now()}`;
    const bytes = new Uint8Array([1, 2, 3, 4, 250, 251, 252, 253]);
    const type = 'application/octet-stream';
    const value =
      which === 'blob'
        ? new Blob([bytes], { type })
        : { bytes: bytes.buffer, type };

    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const open = indexedDB.open(name, 1);
      open.onupgradeneeded = () => open.result.createObjectStore('s');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(new Error('open failed'));
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('s', 'readwrite');
        // The error arrives on the TRANSACTION, not on the request, and `tx.error` is
        // null for this failure — so report the whole shape rather than `.message`.
        tx.onerror = () =>
          reject(
            new Error(
              `transaction error: ${tx.error ? tx.error.name : 'null tx.error'}`
            )
          );
        tx.onabort = () =>
          reject(
            new Error(
              `transaction abort: ${tx.error ? tx.error.name : 'null tx.error'}`
            )
          );
        tx.oncomplete = () => resolve();
        tx.objectStore('s').put(value, 'k');
      });

      const read = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction('s', 'readonly');
        const req = tx.objectStore('s').get('k');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(new Error('read failed'));
      });

      if (which === 'blob') {
        const back = read as Blob;
        if (!(back instanceof Blob))
          throw new Error('did not read back a Blob');
        if (back.size !== bytes.byteLength)
          throw new Error(`size ${back.size} != ${bytes.byteLength}`);
      } else {
        const row = read as { bytes: ArrayBuffer; type: string };
        if (!(row.bytes instanceof ArrayBuffer))
          throw new Error('bytes did not survive as an ArrayBuffer');
        const rebuilt = new Blob([row.bytes], { type: row.type });
        if (rebuilt.size !== bytes.byteLength)
          throw new Error(
            `rebuilt size ${rebuilt.size} != ${bytes.byteLength}`
          );
        if (rebuilt.type !== type)
          throw new Error(`rebuilt type ${rebuilt.type} != ${type}`);
        const seen = new Uint8Array(row.bytes);
        for (let i = 0; i < bytes.length; i += 1) {
          if (seen[i] !== bytes[i]) throw new Error(`byte ${i} differs`);
        }
      }
      return { ok: true, error: null };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      db.close();
      indexedDB.deleteDatabase(name);
    }
  }, kind);
}

test('ArrayBuffer + MIME type round-trips, and rebuilds an identical Blob', async ({
  page,
}) => {
  const result = await roundTrip(page, 'bytes');
  expect(
    result.ok,
    `The storage shape this repo recommends (src/lib/offline-queue/types.ts) failed on ` +
      `this engine: ${result.error}. If that is genuine, the recommendation is wrong and ` +
      `the docs must change with it — do not relax this assertion.`
  ).toBe(true);
});

test('reports whether a raw Blob survives, without asserting it', async ({
  page,
}, testInfo) => {
  const result = await roundTrip(page, 'blob');
  const verdict = result.ok ? 'ACCEPTED' : `REJECTED (${result.error})`;
  // Deliberately not an assertion. See the file header: pinning either outcome makes this
  // wrong the day an engine changes, and the value is the record, not the gate.
  testInfo.annotations.push({
    type: 'raw-Blob in IndexedDB',
    description: `${testInfo.project.name}: ${verdict}`,
  });
  console.log(`[#1209] raw Blob on ${testInfo.project.name}: ${verdict}`);
  expect(typeof result.ok).toBe('boolean');
});
