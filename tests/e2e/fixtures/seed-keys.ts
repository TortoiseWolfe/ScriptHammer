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
import { test as base, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const KEYS_FILE = path.join(process.cwd(), 'tests/e2e/fixtures/test-keys.json');

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
    await new Promise<void>((resolve, reject) => {
      // Open at version 2 so the database — if missing — is created with
      // the schema MessagingDatabase v2 expects. If the app has already
      // opened MessagingDB, our open call uses the existing version.
      const open = indexedDB.open('MessagingDB', 2);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('messaging_private_keys')) {
          db.createObjectStore('messaging_private_keys', {
            keyPath: 'userId',
          });
        }
      };
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('messaging_private_keys')) {
          db.close();
          resolve();
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
      open.onerror = () => reject(open.error);
    });
  } catch (e) {
    console.error('[seedKeys] failed to seed IndexedDB:', e);
  }
}

export const test = base.extend<{ keysFilePath: string }>({
  // Expose the path so specs can override (e.g. point at User B's fixture).
  keysFilePath: KEYS_FILE,

  context: async ({ context, keysFilePath }, runTest) => {
    if (fs.existsSync(keysFilePath)) {
      const payload = fs.readFileSync(keysFilePath, 'utf-8');
      // addInitScript applies to all pages opened in the context.
      await context.addInitScript(seedInBrowser, payload);
    }
    await runTest(context);
  },
});

export { expect };
