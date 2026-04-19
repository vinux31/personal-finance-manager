/**
 * File System Access API wrapper.
 * Persists the FileSystemFileHandle across sessions via IndexedDB
 * (small IndexedDB usage — just for the handle pointer, not the data).
 */

const DB_NAME = 'pfm-handle-store'
const STORE = 'handles'
const KEY = 'current'

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, val: unknown): Promise<void> {
  const db = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(val, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function isFsApiSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window
}

export async function getSavedHandle(): Promise<FileSystemFileHandle | null> {
  const handle = await idbGet<FileSystemFileHandle>(KEY)
  return handle ?? null
}

export async function saveHandle(handle: FileSystemFileHandle): Promise<void> {
  await idbSet(KEY, handle)
}

export async function clearHandle(): Promise<void> {
  await idbDelete(KEY)
}

export async function ensurePermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  // @ts-expect-error — queryPermission is not in all TS lib versions
  const current = await handle.queryPermission({ mode })
  if (current === 'granted') return true
  // @ts-expect-error — requestPermission likewise
  const requested = await handle.requestPermission({ mode })
  return requested === 'granted'
}

export async function pickNewDbFile(
  suggestedName = 'pfm-data.db',
): Promise<FileSystemFileHandle> {
  // @ts-expect-error — showSaveFilePicker not in default lib
  const handle: FileSystemFileHandle = await window.showSaveFilePicker({
    suggestedName,
    types: [
      {
        description: 'Personal Finance Manager DB',
        accept: { 'application/x-sqlite3': ['.db'] },
      },
    ],
  })
  return handle
}

export async function pickExistingDbFile(): Promise<FileSystemFileHandle> {
  // @ts-expect-error — showOpenFilePicker not in default lib
  const [handle]: FileSystemFileHandle[] = await window.showOpenFilePicker({
    types: [
      {
        description: 'Personal Finance Manager DB',
        accept: { 'application/x-sqlite3': ['.db'] },
      },
    ],
    multiple: false,
  })
  return handle
}

export async function readFileBytes(
  handle: FileSystemFileHandle,
): Promise<Uint8Array> {
  const file = await handle.getFile()
  const buf = await file.arrayBuffer()
  return new Uint8Array(buf)
}

export async function writeFileBytes(
  handle: FileSystemFileHandle,
  bytes: Uint8Array,
): Promise<void> {
  const writable = await handle.createWritable()
  // Copy into a fresh ArrayBuffer-backed Uint8Array so TS is happy
  // regardless of SharedArrayBuffer typing quirks.
  const view = new Uint8Array(bytes.byteLength)
  view.set(bytes)
  await writable.write(view)
  await writable.close()
}
