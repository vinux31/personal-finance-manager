import { all, run } from './repo'

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
}

export function listTransactions(f: TransactionFilters = {}): Transaction[] {
  const conds: string[] = []
  const params: unknown[] = []
  if (f.dateFrom) {
    conds.push('t.date >= ?')
    params.push(f.dateFrom)
  }
  if (f.dateTo) {
    conds.push('t.date <= ?')
    params.push(f.dateTo)
  }
  if (f.type) {
    conds.push('t.type = ?')
    params.push(f.type)
  }
  if (f.categoryId) {
    conds.push('t.category_id = ?')
    params.push(f.categoryId)
  }
  const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : ''
  return all<Transaction>(
    `SELECT t.id, t.date, t.type, t.category_id, t.amount, t.note,
            c.name AS category_name
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     ${where}
     ORDER BY t.date DESC, t.id DESC`,
    params,
  )
}

export interface TransactionInput {
  date: string
  type: 'income' | 'expense'
  category_id: number
  amount: number
  note: string | null
}

export async function createTransaction(t: TransactionInput): Promise<number> {
  if (t.amount <= 0) throw new Error('Jumlah harus lebih dari 0')
  const { lastId } = await run(
    `INSERT INTO transactions (date, type, category_id, amount, note)
     VALUES (?, ?, ?, ?, ?)`,
    [t.date, t.type, t.category_id, t.amount, t.note],
  )
  return lastId
}

export async function updateTransaction(
  id: number,
  t: TransactionInput,
): Promise<void> {
  if (t.amount <= 0) throw new Error('Jumlah harus lebih dari 0')
  await run(
    `UPDATE transactions
     SET date = ?, type = ?, category_id = ?, amount = ?, note = ?
     WHERE id = ?`,
    [t.date, t.type, t.category_id, t.amount, t.note, id],
  )
}

export async function deleteTransaction(id: number): Promise<void> {
  await run('DELETE FROM transactions WHERE id = ?', [id])
}
