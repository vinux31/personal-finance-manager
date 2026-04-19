import { listInvestments, createInvestment } from './investments'
import { parseCsv, toCsv } from '@/lib/csv'

const HEADER = ['asset_type', 'asset_name', 'quantity', 'buy_price', 'current_price', 'buy_date', 'note']

export async function exportInvestmentsCsv(): Promise<string> {
  const rows = await listInvestments()
  const body = rows.map((r) => [
    r.asset_type,
    r.asset_name,
    String(r.quantity),
    String(r.buy_price),
    r.current_price != null ? String(r.current_price) : '',
    r.buy_date,
    r.note ?? '',
  ])
  return toCsv([HEADER, ...body])
}

export interface ImportResult {
  inserted: number
  skipped: number
  errors: Array<{ line: number; message: string }>
}

export async function importInvestmentsCsv(text: string): Promise<ImportResult> {
  const rows = parseCsv(text)
  if (rows.length === 0) return { inserted: 0, skipped: 0, errors: [] }

  const header = rows[0].map((h) => h.toLowerCase().trim())
  const col = {
    asset_type: header.indexOf('asset_type'),
    asset_name: header.indexOf('asset_name'),
    quantity: header.indexOf('quantity'),
    buy_price: header.indexOf('buy_price'),
    current_price: header.indexOf('current_price'),
    buy_date: header.indexOf('buy_date'),
    note: header.indexOf('note'),
  }
  const required: Array<keyof typeof col> = ['asset_type', 'asset_name', 'quantity', 'buy_price', 'buy_date']
  for (const k of required) {
    if (col[k] < 0) throw new Error(`Kolom wajib hilang: ${k}`)
  }

  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] }
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (r.every((f) => !f.trim())) continue
    try {
      const asset_type = (r[col.asset_type] ?? '').trim()
      const asset_name = (r[col.asset_name] ?? '').trim()
      const quantity = Number((r[col.quantity] ?? '').replace(',', '.').replace(/[^\d.]/g, ''))
      const buy_price = Number((r[col.buy_price] ?? '').replace(/[^\d]/g, ''))
      const cpStr = col.current_price >= 0 ? (r[col.current_price] ?? '').trim() : ''
      const current_price = cpStr === '' ? null : Number(cpStr.replace(/[^\d]/g, ''))
      const buy_date = (r[col.buy_date] ?? '').trim()
      const note = col.note >= 0 ? (r[col.note] ?? '').trim() : ''

      if (!asset_type) throw new Error('asset_type kosong')
      if (!asset_name) throw new Error('asset_name kosong')
      if (!(quantity > 0)) throw new Error('quantity harus > 0')
      if (!(buy_price > 0)) throw new Error('buy_price harus > 0')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(buy_date)) throw new Error('buy_date harus YYYY-MM-DD')

      await createInvestment({ asset_type, asset_name, quantity, buy_price, current_price, buy_date, note: note || null })
      result.inserted++
    } catch (e) {
      result.skipped++
      result.errors.push({ line: i + 1, message: String(e instanceof Error ? e.message : e) })
    }
  }
  return result
}
