import { openDB, DBSchema, IDBPDatabase } from 'idb'

// Define the schema for strong typing
interface CrewDBSchema extends DBSchema {
  // A generic key-value store for offline caching
  // Future branches can add specific stores here (e.g. 'runsheets', 'pending-uploads')
  'key-val': {
    key: string
    value: any
  }
}

const DB_NAME = 'gomove-crew-db'
const DB_VERSION = 1
const STORE_NAME = 'key-val'

// Singleton pattern to hold the DB connection promise
let dbPromise: Promise<IDBPDatabase<CrewDBSchema>> | null = null

function getDB() {
  if (typeof window === 'undefined') {
    // Return a dummy promise for SSR (IndexedDB is browser-only)
    return Promise.resolve(null)
  }

  if (!dbPromise) {
    dbPromise = openDB<CrewDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

/**
 * Get a value from the offline store by key
 */
export async function getOffline<T>(key: string): Promise<T | undefined> {
  const db = await getDB()
  if (!db) return undefined
  return db.get(STORE_NAME, key) as Promise<T | undefined>
}

/**
 * Set a value in the offline store by key
 */
export async function setOffline<T>(key: string, value: T): Promise<void> {
  const db = await getDB()
  if (!db) return
  await db.put(STORE_NAME, value, key)
}

/**
 * Delete a value from the offline store by key
 */
export async function delOffline(key: string): Promise<void> {
  const db = await getDB()
  if (!db) return
  await db.delete(STORE_NAME, key)
}

/**
 * Clear all values from the offline store
 */
export async function clearOffline(): Promise<void> {
  const db = await getDB()
  if (!db) return
  await db.clear(STORE_NAME)
}
