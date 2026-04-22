import { supabase } from '@/lib/supabase'

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurringTemplate {
  id: number
  name: string
  type: 'income' | 'expense'
  category_id: number
  amount: number
  note: string | null
  frequency: Frequency
  next_due_date: string
  is_active: boolean
}

export interface RecurringTemplateInput {
  name: string
  type: 'income' | 'expense'
  category_id: number
  amount: number
  note: string | null
  frequency: Frequency
  next_due_date: string
  is_active: boolean
}

export function nextDueDate(current: string, frequency: Frequency): string {
  const [y, m, d] = current.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  switch (frequency) {
    case 'daily': date.setDate(date.getDate() + 1); break
    case 'weekly': date.setDate(date.getDate() + 7); break
    case 'monthly': date.setMonth(date.getMonth() + 1); break
    case 'yearly': date.setFullYear(date.getFullYear() + 1); break
  }
  const ny = date.getFullYear()
  const nm = String(date.getMonth() + 1).padStart(2, '0')
  const nd = String(date.getDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}

export async function listRecurringTemplates(uid?: string): Promise<RecurringTemplate[]> {
  let query = supabase
    .from('recurring_templates')
    .select('id, name, type, category_id, amount, note, frequency, next_due_date, is_active')
    .order('name')
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data as RecurringTemplate[]
}

export async function createRecurringTemplate(t: RecurringTemplateInput): Promise<number> {
  if (!t.name.trim()) throw new Error('Nama wajib diisi')
  if (t.amount <= 0) throw new Error('Jumlah harus lebih dari 0')
  const { data, error } = await supabase
    .from('recurring_templates')
    .insert({
      name: t.name,
      type: t.type,
      category_id: t.category_id,
      amount: t.amount,
      note: t.note,
      frequency: t.frequency,
      next_due_date: t.next_due_date,
      is_active: t.is_active,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateRecurringTemplate(id: number, t: RecurringTemplateInput): Promise<void> {
  if (!t.name.trim()) throw new Error('Nama wajib diisi')
  if (t.amount <= 0) throw new Error('Jumlah harus lebih dari 0')
  const { error } = await supabase
    .from('recurring_templates')
    .update({
      name: t.name,
      type: t.type,
      category_id: t.category_id,
      amount: t.amount,
      note: t.note,
      frequency: t.frequency,
      next_due_date: t.next_due_date,
      is_active: t.is_active,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteRecurringTemplate(id: number): Promise<void> {
  const { error } = await supabase.from('recurring_templates').delete().eq('id', id)
  if (error) throw error
}
