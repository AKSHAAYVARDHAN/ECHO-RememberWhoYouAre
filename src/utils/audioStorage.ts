/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const DB_NAME = 'echo_audio_db';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

export interface StoredAudioRecord {
  id: string;
  userId: string | null;
  name: string;
  filename: string;
  size: number;
  type: string;
  createdAt: number;
  blob: Blob;
}

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

export function openAudioDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Failed to open IndexedDB for audio.'));
    };
  });

  return dbPromise;
}

/**
 * Save an audio file blob along with metadata
 */
export async function saveAudioRecord(
  metadata: {
    id: string;
    userId: string | null;
    name: string;
    filename: string;
    size: number;
    type: string;
    createdAt: number;
  },
  blob: Blob
): Promise<void> {
  const db = await openAudioDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: StoredAudioRecord = {
        ...metadata,
        blob,
      };
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Could not save audio to storage.'));
      tx.onabort = () => reject(tx.error || new Error('Audio storage transaction aborted.'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Get all audio track records belonging to a user (or anonymous)
 */
export async function getAudioRecordsForUser(userId: string | null): Promise<Omit<StoredAudioRecord, 'blob'>[]> {
  const db = await openAudioDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();
      const results: Omit<StoredAudioRecord, 'blob'>[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const val = cursor.value as StoredAudioRecord;
          // Filter by matching user ID or null for anonymous
          if ((userId && val.userId === userId) || (!userId && (!val.userId || val.userId === 'anonymous'))) {
            const { blob: _, ...meta } = val;
            results.push(meta);
          }
          cursor.continue();
        } else {
          // Sort descending by createdAt
          results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error || new Error('Could not load stored audio list.'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Retrieve the raw audio Blob by track ID
 */
export async function getAudioBlob(id: string): Promise<Blob | null> {
  const db = await openAudioDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const record = request.result as StoredAudioRecord | undefined;
        resolve(record ? record.blob : null);
      };

      request.onerror = () => reject(request.error || new Error('Could not load audio blob.'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Delete an audio record by track ID
 */
export async function deleteAudioRecord(id: string): Promise<void> {
  const db = await openAudioDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Could not delete audio track.'));
      tx.onabort = () => reject(tx.error || new Error('Audio delete transaction aborted.'));
    } catch (err) {
      reject(err);
    }
  });
}
