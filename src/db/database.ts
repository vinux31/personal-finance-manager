import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { SCHEMA_SQL, DEFAULT_CATEGORIES } from './schema'

let SQL: SqlJsStatic | null = null

async function getSQL(): Promise<SqlJsStatic> {
  if (SQL) return SQL
  SQL = await initSqlJs({
    locateFile: () => '/sql-wasm.wasm',
  })
  return SQL
}

export async function createEmptyDb(): Promise<Database> {
  const sql = await getSQL()
  const db = new sql.Database()
  db.exec(SCHEMA_SQL)
  seedDefaults(db)
  return db
}

export async function openDbFromBytes(bytes: Uint8Array): Promise<Database> {
  const sql = await getSQL()
  const db = new sql.Database(bytes)
  // Ensure schema (idempotent) for older files
  db.exec(SCHEMA_SQL)
  return db
}

function seedDefaults(db: Database) {
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO categories (name, type) VALUES (?, ?)',
  )
  for (const [name, type] of DEFAULT_CATEGORIES) {
    stmt.run([name, type])
  }
  stmt.free()
}

export function exportDbBytes(db: Database): Uint8Array {
  return db.export()
}
