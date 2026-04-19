import { listTransactions, createTransaction } from './transactions'
import { listCategories } from './categories'
import { parseCsv, toCsv } from '@/lib/csv'

const HEADER = ['date', 'type', 'category', 'amount', 'note']

export async function exportTransactionsCsv(): Promise<string> {
  const rows = await listTransactions()
  const body = rows.map((r) => [
    r.date,
    r.type,
    r.category_name,
    String(r.amount),
    r.note ?? '',
  ])
  return toCsv([HEADER, ...body])
}

export interface ImportResult {
  inserted: number
  skipped: number
  errors: Array<{ line: number; message: string }>
}

export async function importTransactionsCsv(text: string): Promise<ImportResult> {
  const rows = parseCsv(text)
  if (rows.length === 0) return { inserted: 0, skipped: 0, errors: [] }

  const header = rows[0].map((h) => h.toLowerCase().trim())
  const col = {
    date: header.indexOf('date'),
    type: header.indexOf('type'),
    category: header.indexOf('category'),
    amount: header.indexOf('amount'),
    note: header.indexOf('note'),
  }
  if (col.date < 0 || col.type < 0 || col.category < 0 || col.amount < 0) {
    throw new Error('Header tidak valid. Kolom wajib: date, type, category, amount. Opsional: note.')
  }

  const cats = await listCategories()
  const catIndex = new Map<string, number>()
  for (const c of cats) {
    catIndex.set(`${c.type}:${c.name.toLowerCase()}`, c.id)
  }

  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] }

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    try {
      const date = (r[col.date] ?? '').trim()
      const type = (r[col.type] ?? '').trim().toLowerCase()
      const categoryName = (r[col.category] ?? '').trim()
      const amountStr = (r[col.amount] ?? '').replace(/[^\d.-]/g, '')
      const note = col.note >= 0 ? (r[col.note] ?? '').trim() : ''

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Format tanggal harus YYYY-MM-DD')
      if (type !== 'income' && type !== 'expense') throw new Error("Type harus 'income' atau 'expense'")
      const amount = Number(amountStr)
      if (!(amount > 0)) throw new Error('Amount harus > 0')

      const key = `${type}:${categoryName.toLowerCase()}`
      const catId = catIndex.get(key)
      if (!catId) throw new Error(`Kategori tidak ditemukan: ${categoryName} (${type})`)

      await createTransaction({ date, type: type as 'income' | 'expense', category_id: catId, amount, note: note || null })
      result.inserted++
    } catch (e) {
      result.skipped++
      result.errors.push({ line: i + 1, message: String(e instanceof Error ? e.message : e) })
    }
  }
  return result
}
