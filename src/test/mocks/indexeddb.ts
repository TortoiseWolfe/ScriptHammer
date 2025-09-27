/**
 * IndexedDB Mock Setup for Tests
 * Uses fake-indexeddb for proper Dexie.js support
 */

// fake-indexeddb is loaded via import 'fake-indexeddb/auto' in setup.ts
// This provides a full IndexedDB implementation for testing

/**
 * Clean up all IndexedDB databases
 * Useful for test isolation
 */
export async function clearAllDatabases(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  const databases = await indexedDB.databases();
  await Promise.all(
    databases.map((db) => {
      if (db.name) {
        return indexedDB.deleteDatabase(db.name);
      }
      return Promise.resolve();
    })
  );
}

/**
 * Setup IndexedDB mock for tests
 * Call this in beforeAll() if needed
 */
export function setupIndexedDBMock(): void {
  // Already setup by imports above
  // This function exists for explicit setup if needed
}

/**
 * Reset IndexedDB state between tests
 * Call this in beforeEach() or afterEach()
 */
export async function resetIndexedDB(): Promise<void> {
  await clearAllDatabases();
}
