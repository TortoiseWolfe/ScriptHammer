/**
 * Offline queue management for form submissions using IndexedDB
 */

import { createLogger } from '@/lib/logger';

const logger = createLogger('utils:offline-queue');

const DB_NAME = 'OfflineFormSubmissions';
const DB_VERSION = 1;
const STORE_NAME = 'submissions';

export interface QueuedSubmission {
  id?: number;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  lastAttempt?: number;
}

/**
 * Open IndexedDB database
 */
export async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    };
  });
}

/**
 * Add form submission to offline queue
 */
export async function addToQueue(
  data: Record<string, unknown>
): Promise<boolean> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const submission: QueuedSubmission = {
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    store.add(submission);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };

      transaction.onerror = () => {
        db.close();
        reject(new Error('Failed to add to queue'));
      };
    });
  } catch (error) {
    logger.error('Error adding to offline queue', { error });
    return false;
  }
}

/**
 * Get all queued submissions
 */
export async function getQueuedItems(): Promise<QueuedSubmission[]> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const items: QueuedSubmission[] = [];
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          items.push(cursor.value);
          cursor.continue();
        } else {
          db.close();
          resolve(items);
        }
      };

      request.onerror = () => {
        db.close();
        reject(new Error('Failed to retrieve queued items'));
      };
    });
  } catch (error) {
    logger.error('Error getting queued items', { error });
    return [];
  }
}

/**
 * Remove item from queue by ID
 */
export async function removeFromQueue(id: number): Promise<boolean> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    store.delete(id);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };

      transaction.onerror = () => {
        db.close();
        reject(new Error('Failed to remove from queue'));
      };
    });
  } catch (error) {
    logger.error('Error removing from queue', { error });
    return false;
  }
}

/**
 * Clear all items from queue
 */
export async function clearQueue(): Promise<boolean> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    store.clear();

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };

      transaction.onerror = () => {
        db.close();
        reject(new Error('Failed to clear queue'));
      };
    });
  } catch (error) {
    logger.error('Error clearing queue', { error });
    return false;
  }
}

/**
 * Get the number of items in queue
 */
export async function getQueueSize(): Promise<number> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.count();

      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };

      request.onerror = () => {
        db.close();
        reject(new Error('Failed to get queue size'));
      };
    });
  } catch (error) {
    logger.error('Error getting queue size', { error });
    return 0;
  }
}

/**
 * Update retry count for a submission
 */
export async function updateRetryCount(
  id: number,
  retryCount: number
): Promise<boolean> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const getRequest = store.get(id);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const submission = getRequest.result;
        if (submission) {
          submission.retryCount = retryCount;
          submission.lastAttempt = Date.now();
          store.put(submission);

          transaction.oncomplete = () => {
            db.close();
            resolve(true);
          };
        } else {
          db.close();
          resolve(false);
        }
      };

      getRequest.onerror = () => {
        db.close();
        reject(new Error('Failed to update retry count'));
      };
    });
  } catch (error) {
    logger.error('Error updating retry count', { error });
    return false;
  }
}
