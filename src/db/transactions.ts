import { supabase } from '@/lib/supabase'

export interface Transaction {
  id: number
  date: string
  type: 'income' | 'expense'
  category_id: number
  category_name: string
  amount: number
  note: string | null
}

export interface TransactionFilters {
  dateFrom?: string
  dateTo?: string
  type?: 'income' | 'expense' | ''
  categoryId?: number | null
  limit?: number
}

export interface TransactionInput {
  date: string
  type: 'income' | 'expense'
  category_id: number
  amount: number
  note: string | null
}

type ListTransactionsRow = Omit<Transaction, 'category_name'> & {
  categories: { name: string } | null
}

export async function listTransactions(f: TransactionFilters = {}, uid?: string): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('id, date, type, category_id, amount, note, categories!transactions_category_id_fkey(name)')
    .order('date', { ascending: false })
    .order('id', { ascending: false })

  if (uid) query = query.eq('user_id', uid)
  if (f.dateFrom) query = query.gte('date', f.dateFrom)
  if (f.dateTo) query = query.lte('date', f.dateTo)
  if (f.type) query = query.eq('type', f.type)
  if (f.categoryId != null) query = query.eq('category_id', f.categoryId)
  if (f.limit) query = query.limit(f.limit)

  const { data, error } = await query
  if (error) throw error

  return ((data as unknown as ListTransactionsRow[]) ?? []).map(({ categories, ...rest }) => ({
    ...rest,
    category_name: categories?.name ?? '',
  }))
}

export async function createTransaction(t: TransactionInput): Promise<number> {
  if (t.amount <= 0) throw new Error('Jumlah harus lebih dari 0')
  const { data, error } = await supabase
    .from('transactions')
    .insert({ date: t.date, type: t.type, category_id: t.category_id, amount: t.amount, note: t.note })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateTransaction(id: number, t: TransactionInput): Promise<void> {
  if (t.amount <= 0) throw new Error('Jumlah harus lebih dari 0')
  const { error } = await supabase
    .from('transactions')
    .update({ date: t.date, type: t.type, category_id: t.category_id, amount: t.amount, note: t.note })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTransaction(id: number): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}
