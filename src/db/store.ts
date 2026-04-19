import { create } from 'zustand'
import type { Database } from 'sql.js'
import {
  createEmptyDb,
  openDbFromBytes,
  exportDbBytes,
} from './database'
import {
  clearHandle,
  ensurePermission,
  getSavedHandle,
  pickExistingDbFile,
  pickNewDbFile,
  readFileBytes,
  saveHandle,
  writeFileBytes,
} from './fileHandle'

type DbStatus = 'idle' | 'loading' | 'ready' | 'error'

interface DbState {
  db: Database | null
  handle: FileSystemFileHandle | null
  status: DbStatus
  error: string | null
  dirty: boolean
  // actions
  tryRestore: () => Promise<boolean>
  createNew: () => Promise<void>
  openExisting: () => Promise<void>
  save: () => Promise<void>
  reset: () => Promise<void>
  markDirty: () => void
}

export const useDbStore = create<DbState>((set, get) => ({
  db: null,
  handle: null,
  status: 'idle',
  error: null,
  dirty: false,

  tryRestore: async () => {
    set({ status: 'loading', error: null })
    try {
      const handle = await getSavedHandle()
      if (!handle) {
        set({ status: 'idle' })
        return false
      }
      const ok = await ensurePermission(handle, 'readwrite')
      if (!ok) {
        set({ status: 'idle' })
        return false
      }
      const bytes = await readFileBytes(handle)
      const db = await openDbFromBytes(bytes)
      set({ db, handle, status: 'ready' })
      return true
    } catch (e) {
      set({ status: 'error', error: String(e) })
      return false
    }
  },

  createNew: async () => {
    set({ status: 'loading', error: null })
    try {
      const handle = await pickNewDbFile()
      const db = await createEmptyDb()
      const bytes = exportDbBytes(db)
      await writeFileBytes(handle, bytes)
      await saveHandle(handle)
      set({ db, handle, status: 'ready', dirty: false })
    } catch (e) {
      set({ status: 'error', error: String(e) })
    }
  },

  openExisting: async () => {
    set({ status: 'loading', error: null })
    try {
      const handle = await pickExistingDbFile()
      const bytes = await readFileBytes(handle)
      const db = await openDbFromBytes(bytes)
      await saveHandle(handle)
      set({ db, handle, status: 'ready', dirty: false })
    } catch (e) {
      set({ status: 'error', error: String(e) })
    }
  },

  save: async () => {
    const { db, handle } = get()
    if (!db || !handle) return
    const bytes = exportDbBytes(db)
    await writeFileBytes(handle, bytes)
    set({ dirty: false })
  },

  reset: async () => {
    const { db } = get()
    db?.close()
    await clearHandle()
    set({ db: null, handle: null, status: 'idle', dirty: false, error: null })
  },

  markDirty: () => set({ dirty: true }),
}))

/** Call this after any write. Marks dirty + autosaves file. */
export async function persist() {
  const { save, markDirty } = useDbStore.getState()
  markDirty()
  await save()
}
