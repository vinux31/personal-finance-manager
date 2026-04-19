import { all, one, run } from './repo'

export interface Note {
  id: number
  title: string
  content: string
  date: string
  linked_transaction_id: number | null
}

export interface NoteInput {
  title: string
  content: string
  date: string
  linked_transaction_id: number | null
}

export function listNotes(): Note[] {
  return all<Note>(
    `SELECT id, title, content, date, linked_transaction_id
     FROM notes ORDER BY date DESC, id DESC`,
  )
}

export function getNote(id: number): Note | null {
  return one<Note>(
    `SELECT id, title, content, date, linked_transaction_id
     FROM notes WHERE id = ?`,
    [id],
  )
}

export async function createNote(n: NoteInput): Promise<number> {
  if (!n.title.trim()) throw new Error('Judul wajib diisi')
  if (!n.content.trim()) throw new Error('Isi wajib diisi')
  const { lastId } = await run(
    `INSERT INTO notes (title, content, date, linked_transaction_id)
     VALUES (?, ?, ?, ?)`,
    [n.title, n.content, n.date, n.linked_transaction_id],
  )
  return lastId
}

export async function updateNote(id: number, n: NoteInput): Promise<void> {
  if (!n.title.trim()) throw new Error('Judul wajib diisi')
  if (!n.content.trim()) throw new Error('Isi wajib diisi')
  await run(
    `UPDATE notes SET title = ?, content = ?, date = ?, linked_transaction_id = ?
     WHERE id = ?`,
    [n.title, n.content, n.date, n.linked_transaction_id, id],
  )
}

export async function deleteNote(id: number): Promise<void> {
  await run('DELETE FROM notes WHERE id = ?', [id])
}
