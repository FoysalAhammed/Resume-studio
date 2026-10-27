import type { Workspace } from '@careerlens/core';

/**
 * Browser persistence for the local-demo workspace.
 *
 * IndexedDB is used because the workspace is structured data that can grow
 * (parsed CVs, roadmaps, drafts). This is browser-only storage on one device:
 * it is NOT secure production storage, it is not encrypted, and it is not a
 * substitute for the PostgreSQL path described in docs/DATABASE.md.
 *
 * No secret ever belongs here - there are no passwords, tokens or API keys to
 * store, because the application has no credentials of its own.
 */

const DB_NAME = 'careerlens';
const DB_VERSION = 1;
const STORE = 'workspace';
const KEY = 'current';

export type PersistenceMode = 'indexeddb' | 'memory';

let mode: PersistenceMode = 'indexeddb';
let memoryFallback: Workspace | null = null;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened.'));
    request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab.'));
  });
}

function withStore<T>(db: IDBDatabase, mode_: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode_);
    const request = run(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

export function persistenceMode(): PersistenceMode {
  return mode;
}

export async function loadWorkspace(): Promise<Workspace | null> {
  try {
    const db = await openDatabase();
    const stored = await withStore<Workspace | undefined>(db, 'readonly', (store) => store.get(KEY));
    db.close();
    mode = 'indexeddb';
    return stored ?? null;
  } catch {
    mode = 'memory';
    return memoryFallback;
  }
}

export async function saveWorkspace(workspace: Workspace): Promise<boolean> {
  try {
    const db = await openDatabase();
    await withStore(db, 'readwrite', (store) => store.put(workspace, KEY));
    db.close();
    mode = 'indexeddb';
    return true;
  } catch {
    // Private browsing, storage disabled or quota exceeded: keep working in memory.
    mode = 'memory';
    memoryFallback = workspace;
    return false;
  }
}

export async function clearWorkspace(): Promise<void> {
  memoryFallback = null;
  try {
    const db = await openDatabase();
    await withStore(db, 'readwrite', (store) => store.delete(KEY));
    db.close();
  } catch {
    mode = 'memory';
  }
}
