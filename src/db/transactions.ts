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
  search?: string
  searchCategoryIds?: number[]
  page?: number
  pageSize?: number
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

export async function listTransactions(
  f: TransactionFilters = {},
  uid?: string,
): Promise<{ data: Transaction[]; total: number }> {
  let query = supabase
    .from('transactions')
    .select(
      'id, date, type, category_id, amount, note, categories!transactions_category_id_fkey(name)',
      { count: 'exact' },
    )
    .order('date', { ascending: false })
    .order('id', { ascending: false })

  if (uid) query = query.eq('user_id', uid)
  if (f.dateFrom) query = query.gte('date', f.dateFrom)
  if (f.dateTo) query = query.lte('date', f.dateTo)
  if (f.type) query = query.eq('type', f.type)
  if (f.categoryId != null) query = query.eq('category_id', f.categoryId)
  if (f.limit) query = query.limit(f.limit)

  if (f.search) {
    const term = `%${f.search}%`
    const parts = [`note.ilike.${term}`, `amount::text.ilike.${term}`]
    if (f.searchCategoryIds?.length) {
      parts.push(`category_id.in.(${f.searchCategoryIds.join(',')})`)
    }
    query = query.or(parts.join(','))
  }

  if (f.page != null) {
    const ps = f.pageSize ?? 20
    const offset = (f.page - 1) * ps
    query = query.range(offset, offset + ps - 1)
  }

  const { data, error, count } = await query
  if (error) throw error

  const mapped = ((data as unknown as ListTransactionsRow[]) ?? []).map(
    ({ categories, ...rest }) => ({
      ...rest,
      category_name: categories?.name ?? '',
    }),
  )

  return { data: mapped, total: count ?? 0 }
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
