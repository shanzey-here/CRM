import { openDB, DBSchema, IDBPDatabase } from 'idb'

export type PendingUpload = {
  id: string
  jobId: string
  file: File | Blob
  caption: string
  status: 'pending' | 'uploading' | 'failed'
  createdAt: number
  error?: string
}

// Define the schema for strong typing
interface CrewDBSchema extends DBSchema {
  // A generic key-value store for offline caching
  'key-val': {
    key: string
    value: any
  }
  // Store for pending photo uploads
  'pending-uploads': {
    key: string
    value: PendingUpload
    indexes: { 'by-job': string }
  }
  // Store for pending job signoffs
  'pending-signoffs': {
    key: string
    value: {
      id: string
      jobId: string
      signatureName: string
      base64Image: string
      status: 'pending' | 'syncing' | 'failed'
      createdAt: number
      error?: string
    }
    indexes: { 'by-job': string }
  }
}

const DB_NAME = 'gomove-crew-db'
const DB_VERSION = 4
const STORE_NAME = 'key-val'
const UPLOADS_STORE = 'pending-uploads'
const SIGNOFFS_STORE = 'pending-signoffs'

// Singleton pattern to hold the DB connection promise
let dbPromise: Promise<IDBPDatabase<CrewDBSchema>> | null = null

function getDB() {
  if (typeof window === 'undefined') {
    // Return a dummy promise for SSR (IndexedDB is browser-only)
    return Promise.resolve(null)
  }

  if (!dbPromise) {
    dbPromise = openDB<CrewDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
        
        let uploadsStore
        if (!db.objectStoreNames.contains(UPLOADS_STORE)) {
          uploadsStore = db.createObjectStore(UPLOADS_STORE, { keyPath: 'id' })
        } else {
          uploadsStore = transaction.objectStore(UPLOADS_STORE)
        }
        if (!uploadsStore.indexNames.contains('by-job')) {
          uploadsStore.createIndex('by-job', 'jobId')
        }

        let signoffsStore
        if (!db.objectStoreNames.contains(SIGNOFFS_STORE)) {
          signoffsStore = db.createObjectStore(SIGNOFFS_STORE, { keyPath: 'id' })
        } else {
          signoffsStore = transaction.objectStore(SIGNOFFS_STORE)
        }
        if (!signoffsStore.indexNames.contains('by-job')) {
          signoffsStore.createIndex('by-job', 'jobId')
        }
      }
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

/**
 * Queue a photo for upload
 */
export async function queuePhotoUpload(upload: PendingUpload): Promise<void> {
  const db = await getDB()
  if (!db) return
  await db.put(UPLOADS_STORE, upload)
}

/**
 * Get all pending uploads for a specific job
 */
export async function getJobPendingUploads(jobId: string): Promise<PendingUpload[]> {
  const db = await getDB()
  if (!db) return []
  return db.getAllFromIndex(UPLOADS_STORE, 'by-job', jobId)
}

/**
 * Get all pending uploads across all jobs
 */
export async function getAllPendingUploads(): Promise<PendingUpload[]> {
  const db = await getDB()
  if (!db) return []
  return db.getAll(UPLOADS_STORE)
}

/**
 * Update the status of a pending upload
 */
export async function updatePendingStatus(id: string, status: 'pending' | 'uploading' | 'failed', error?: string) {
  const db = await getDB()
  if (!db) return
  
  const upload = await db.get(UPLOADS_STORE, id)
  if (upload) {
    upload.status = status
    if (error) upload.error = error
    await db.put(UPLOADS_STORE, upload)
  }
}

// ----------------------------------------------------------------------------
// Job Signoffs (Phase 3)
// ----------------------------------------------------------------------------

export async function queueSignoff(jobId: string, signatureName: string, base64Image: string) {
  const db = await getDB()
  if (!db) return
  
  const id = crypto.randomUUID()
  await db.put(SIGNOFFS_STORE, {
    id,
    jobId,
    signatureName,
    base64Image,
    status: 'pending',
    createdAt: Date.now()
  })
  
  return id
}

export async function getPendingSignoffs(jobId?: string) {
  const db = await getDB()
  if (!db) return []
  
  if (jobId) {
    return db.getAllFromIndex(SIGNOFFS_STORE, 'by-job', jobId)
  }
  return db.getAll(SIGNOFFS_STORE)
}

export async function removePendingSignoff(id: string) {
  const db = await getDB()
  if (!db) return
  await db.delete(SIGNOFFS_STORE, id)
}

export async function updateSignoffStatus(id: string, status: 'pending' | 'syncing' | 'failed', error?: string) {
  const db = await getDB()
  if (!db) return
  
  const signoff = await db.get(SIGNOFFS_STORE, id)
  if (signoff) {
    signoff.status = status
    if (error) signoff.error = error
    await db.put(SIGNOFFS_STORE, signoff)
  }
}

/**
 * Remove a pending upload
 */
export async function removePendingUpload(id: string): Promise<void> {
  const db = await getDB()
  if (!db) return
  await db.delete(UPLOADS_STORE, id)
}
