import { supabase } from '@/lib/supabase'

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

export interface NoteFilters {
  search?: string
  dateFrom?: string
  dateTo?: string
  page?: number
}

const PAGE_SIZE = 20

export async function listNotes(
  f: NoteFilters = {},
  uid?: string
): Promise<{ data: Note[]; count: number }> {
  let query = supabase
    .from('notes')
    .select('id, title, content, date, linked_transaction_id', { count: 'exact' })
    .order('date', { ascending: false })
    .order('id', { ascending: false })
  if (uid) query = query.eq('user_id', uid)
  if (f.search) query = query.ilike('title', `%${f.search}%`)
  if (f.dateFrom) query = query.gte('date', f.dateFrom)
  if (f.dateTo) query = query.lte('date', f.dateTo)
  const page = f.page ?? 0
  query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  const { data, error, count } = await query
  if (error) throw error
  return { data: data as Note[], count: count ?? 0 }
}

export async function getNote(id: number): Promise<Note | null> {
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, content, date, linked_transaction_id')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Note | null
}

export async function createNote(n: NoteInput): Promise<number> {
  if (!n.title.trim()) throw new Error('Judul wajib diisi')
  if (!n.content.trim()) throw new Error('Isi wajib diisi')
  const { data, error } = await supabase
    .from('notes')
    .insert({
      title: n.title,
      content: n.content,
      date: n.date,
      linked_transaction_id: n.linked_transaction_id,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateNote(id: number, n: NoteInput): Promise<void> {
  if (!n.title.trim()) throw new Error('Judul wajib diisi')
  if (!n.content.trim()) throw new Error('Isi wajib diisi')
  const { error } = await supabase
    .from('notes')
    .update({
      title: n.title,
      content: n.content,
      date: n.date,
      linked_transaction_id: n.linked_transaction_id,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteNote(id: number): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}
