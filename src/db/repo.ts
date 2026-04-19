import type { Database } from 'sql.js'
import { useDbStore, persist } from './store'

export function requireDb(): Database {
  const db = useDbStore.getState().db
  if (!db) throw new Error('Database not loaded')
  return db
}

/** Run a query and return objects keyed by column name. */
export function all<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): T[] {
  const db = requireDb()
  const stmt = db.prepare(sql)
  const out: T[] = []
  stmt.bind(params as never)
  while (stmt.step()) out.push(stmt.getAsObject() as T)
  stmt.free()
  return out
}

export function one<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): T | null {
  const rows = all<T>(sql, params)
  return rows[0] ?? null
}

/** Execute a mutation. Returns lastInsertRowId (if INSERT) and rowsAffected. */
export async function run(
  sql: string,
  params: unknown[] = [],
): Promise<{ lastId: number; changes: number }> {
  const db = requireDb()
  const stmt = db.prepare(sql)
  stmt.run(params as never)
  stmt.free()
  const lastIdRow = db.exec('SELECT last_insert_rowid() AS id')[0]
  const lastId = Number(lastIdRow?.values?.[0]?.[0] ?? 0)
  const changesRow = db.exec('SELECT changes() AS c')[0]
  const changes = Number(changesRow?.values?.[0]?.[0] ?? 0)
  await persist()
  return { lastId, changes }
}
