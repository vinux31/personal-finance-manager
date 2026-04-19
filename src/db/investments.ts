import { all, one, run } from './repo'

export interface Investment {
  id: number
  asset_type: string
  asset_name: string
  quantity: number
  buy_price: number
  current_price: number | null
  buy_date: string
  note: string | null
}

export interface InvestmentInput {
  asset_type: string
  asset_name: string
  quantity: number
  buy_price: number
  current_price: number | null
  buy_date: string
  note: string | null
}

export interface PriceHistoryEntry {
  id: number
  investment_id: number
  price: number
  date: string
}

export function listInvestments(): Investment[] {
  return all<Investment>(
    `SELECT id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note
     FROM investments
     ORDER BY buy_date DESC, id DESC`,
  )
}

export function getInvestment(id: number): Investment | null {
  return one<Investment>(
    `SELECT id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note
     FROM investments WHERE id = ?`,
    [id],
  )
}

export async function createInvestment(i: InvestmentInput): Promise<number> {
  if (i.quantity < 0) throw new Error('Kuantitas tidak boleh negatif')
  if (i.buy_price < 0) throw new Error('Harga beli tidak boleh negatif')
  const { lastId } = await run(
    `INSERT INTO investments (asset_type, asset_name, quantity, buy_price, current_price, buy_date, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      i.asset_type,
      i.asset_name,
      i.quantity,
      i.buy_price,
      i.current_price,
      i.buy_date,
      i.note,
    ],
  )
  if (i.current_price != null) {
    await run(
      `INSERT INTO price_history (investment_id, price, date) VALUES (?, ?, ?)`,
      [lastId, i.current_price, i.buy_date],
    )
  }
  return lastId
}

export async function updateInvestment(
  id: number,
  i: InvestmentInput,
): Promise<void> {
  if (i.quantity < 0) throw new Error('Kuantitas tidak boleh negatif')
  if (i.buy_price < 0) throw new Error('Harga beli tidak boleh negatif')
  await run(
    `UPDATE investments
     SET asset_type = ?, asset_name = ?, quantity = ?, buy_price = ?,
         current_price = ?, buy_date = ?, note = ?
     WHERE id = ?`,
    [
      i.asset_type,
      i.asset_name,
      i.quantity,
      i.buy_price,
      i.current_price,
      i.buy_date,
      i.note,
      id,
    ],
  )
}

export async function deleteInvestment(id: number): Promise<void> {
  await run('DELETE FROM price_history WHERE investment_id = ?', [id])
  await run('DELETE FROM investments WHERE id = ?', [id])
}

export async function updatePrice(
  investmentId: number,
  price: number,
  date: string,
): Promise<void> {
  if (price < 0) throw new Error('Harga tidak boleh negatif')
  await run(
    `UPDATE investments SET current_price = ? WHERE id = ?`,
    [price, investmentId],
  )
  await run(
    `INSERT INTO price_history (investment_id, price, date) VALUES (?, ?, ?)`,
    [investmentId, price, date],
  )
}

export function getPriceHistory(investmentId: number): PriceHistoryEntry[] {
  return all<PriceHistoryEntry>(
    `SELECT id, investment_id, price, date FROM price_history
     WHERE investment_id = ? ORDER BY date DESC, id DESC`,
    [investmentId],
  )
}

/** Distinct asset_type values seen in DB, plus defaults. */
export function listAssetTypes(): string[] {
  const rows = all<{ t: string }>(
    `SELECT DISTINCT asset_type AS t FROM investments ORDER BY t`,
  )
  const existing = rows.map((r) => r.t)
  const defaults = ['Saham', 'Reksadana', 'Emas', 'Kripto', 'Obligasi']
  const merged = [...new Set([...defaults, ...existing])]
  return merged
}

// Computation helpers
export function costBasis(inv: Investment): number {
  return inv.quantity * inv.buy_price
}

export function currentValue(inv: Investment): number {
  const price = inv.current_price ?? inv.buy_price
  return inv.quantity * price
}

export function gainLoss(inv: Investment): number {
  return currentValue(inv) - costBasis(inv)
}

export function gainLossPercent(inv: Investment): number {
  const cb = costBasis(inv)
  if (cb === 0) return 0
  return (gainLoss(inv) / cb) * 100
}
