/**
 * Playwright fixture: seed messaging encryption keys into IndexedDB.
 *
 * After batch 7c, encryption keys are stored as non-extractable CryptoKey
 * objects in IndexedDB. Playwright's storageState({indexedDB: true})
 * cannot serialize CryptoKey (the in-tree serializer in
 * packages/playwright-core/src/utils/isomorphic/utilityScriptSerializers.ts
 * has no special case for it; CryptoKey has no enumerable own properties,
 * so it serializes as `{}`). We work around this by writing the JWK + salt
 * to a fixture file at auth-setup time, then re-importing it as a
 * non-extractable CryptoKey on each page load via addInitScript.
 *
 * Usage in a messaging spec — replace the standard import:
 *
 *   import { test, expect } from '../fixtures/seed-keys';
 *
 * The fixture is a no-op when the keys file is missing (e.g. when a spec
 * runs without auth-setup having produced it).
 */
import {
  test as base,
  expect,
  type Browser,
  type BrowserContext,
} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const KEYS_FILE = path.join(process.cwd(), 'tests/e2e/fixtures/test-keys.json');
const KEYS_FILE_B = path.join(
  process.cwd(),
  'tests/e2e/fixtures/test-keys-b.json'
);

/**
 * Runs in the browser BEFORE any app code. Stringified by Playwright.
 * Must be self-contained — no Node references, no closure variables.
 *
 * Receives the JSON payload as a string (Playwright serializes the
 * second arg of addInitScript using its standard call-arg encoder).
 */
async function seedInBrowser(payload: string): Promise<void> {
  try {
    const { userId, privateKeyJwk } = JSON.parse(payload) as {
      userId: string;
      privateKeyJwk: JsonWebKey;
    };
    const nonExtractable = await crypto.subtle.importKey(
      'jwk',
      privateKeyJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits', 'deriveKey']
    );

    // Open without specifying version: IDB returns the current version, or
    // creates at v1 if missing. We never want to downgrade a DB that the
    // app may have already opened at a higher version.
    await new Promise<void>((resolve, reject) => {
      const probe = indexedDB.open('MessagingDB');
      probe.onupgradeneeded = () => {
        // Fresh DB: create the store at the implicit version Playwright
        // gives us (1). The app's Dexie will run its own upgrade chain
        // when it opens the DB next.
        const db = probe.result;
        if (!db.objectStoreNames.contains('messaging_private_keys')) {
          db.createObjectStore('messaging_private_keys', {
            keyPath: 'userId',
          });
        }
      };
      probe.onsuccess = () => {
        const db = probe.result;
        if (!db.objectStoreNames.contains('messaging_private_keys')) {
          // Store doesn't exist at current version — close and re-open at
          // version+1 to add it. (Edge case: DB exists with no messaging
          // stores yet because the app hasn't loaded.)
          const ver = db.version + 1;
          db.close();
          const upgrade = indexedDB.open('MessagingDB', ver);
          upgrade.onupgradeneeded = () => {
            const u = upgrade.result;
            if (!u.objectStoreNames.contains('messaging_private_keys')) {
              u.createObjectStore('messaging_private_keys', {
                keyPath: 'userId',
              });
            }
          };
          upgrade.onsuccess = () => {
            const u = upgrade.result;
            const tx = u.transaction('messaging_private_keys', 'readwrite');
            tx.objectStore('messaging_private_keys').put({
              userId,
              privateKey: nonExtractable,
              created_at: Date.now(),
            });
            tx.oncomplete = () => {
              u.close();
              resolve();
            };
            tx.onerror = () => {
              u.close();
              reject(tx.error);
            };
          };
          upgrade.onerror = () => reject(upgrade.error);
          return;
        }
        const tx = db.transaction('messaging_private_keys', 'readwrite');
        tx.objectStore('messaging_private_keys').put({
          userId,
          privateKey: nonExtractable,
          created_at: Date.now(),
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
      probe.onerror = () => reject(probe.error);
    });
  } catch (e) {
    console.error('[seedKeys] failed to seed IndexedDB:', e);
  }
}

/**
 * Read all available key payloads (primary + User B). Returns the JSON
 * strings so they can be passed into addInitScript per context.
 */
function readKeyPayloads(): string[] {
  const payloads: string[] = [];
  for (const p of [KEYS_FILE, KEYS_FILE_B]) {
    if (fs.existsSync(p)) {
      payloads.push(fs.readFileSync(p, 'utf-8'));
    }
  }
  return payloads;
}

/**
 * Seed every available user payload into the context. Two-pronged approach:
 *
 * 1. addInitScript so newly-opened pages re-seed (covers reload + fresh nav)
 * 2. After context creation, open a throwaway page, navigate to baseURL,
 *    AWAIT the IndexedDB write, then close. Subsequent pages opened in this
 *    context will see the persisted IndexedDB row immediately — no race
 *    between the init script and the app's first IDB read.
 *
 * Without step 2, addInitScript schedules the IDB put as a microtask but
 * page scripts may read IndexedDB before the put completes (the init
 * script's returned promise is not awaited by Playwright's page-load
 * sequence). Step 2 fully drains the put before any spec-driven nav.
 */
async function applySeedScripts(context: BrowserContext): Promise<void> {
  const payloads = readKeyPayloads();
  if (payloads.length === 0) return;

  for (const payload of payloads) {
    await context.addInitScript(seedInBrowser, payload);
  }

  // Step 2: drain the IDB put now so subsequent pages see the row.
  // Use a throwaway page on baseURL so the same-origin IndexedDB applies.
  const seedPage = await context.newPage();
  try {
    const baseURL = process.env.BASE_URL || 'http://localhost:3000';
    await seedPage.goto(baseURL, { waitUntil: 'domcontentloaded' });
    // Re-run seedInBrowser explicitly and await it. addInitScript already
    // fired but its promise isn't awaited; this evaluate IS awaited.
    for (const payload of payloads) {
      await seedPage.evaluate(seedInBrowser, payload);
    }
  } finally {
    await seedPage.close();
  }
}

export const test = base.extend<{
  keysFilePath: string;
  browser: Browser;
}>({
  // Expose the path so specs can override (e.g. point at User B's fixture).
  keysFilePath: KEYS_FILE,

  // Auto-apply the seed script to the implicit test-level context.
  context: async ({ context }, runTest) => {
    await applySeedScripts(context);
    await runTest(context);
  },

  // Wrap browser.newContext so manually-created contexts (used by the
  // multi-user messaging specs via `browser.newContext()`) inherit the
  // seed-init-script. Plain spread/proxy: only `newContext` is wrapped.
  browser: async ({ browser }, runTest) => {
    const originalNewContext = browser.newContext.bind(browser);
    // Monkey-patch newContext on this Browser instance for the duration
    // of the test. Playwright reuses the browser across tests in the
    // worker, but each test's `browser` fixture is a fresh wrapper here.
    (
      browser as Browser & {
        newContext: typeof browser.newContext;
      }
    ).newContext = (async (...args: Parameters<typeof originalNewContext>) => {
      const ctx = await originalNewContext(...args);
      await applySeedScripts(ctx);
      return ctx;
    }) as typeof browser.newContext;
    try {
      await runTest(browser);
    } finally {
      // Restore original to avoid affecting other workers/tests
      (
        browser as Browser & {
          newContext: typeof browser.newContext;
        }
      ).newContext = originalNewContext;
    }
  },
});

export { expect };
