import { supabase } from '@/lib/supabase'

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

export async function listInvestments(): Promise<Investment[]> {
  const { data, error } = await supabase
    .from('investments')
    .select('id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note')
    .order('buy_date', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return data as Investment[]
}

export async function getInvestment(id: number): Promise<Investment | null> {
  const { data, error } = await supabase
    .from('investments')
    .select('id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Investment | null
}

export async function createInvestment(i: InvestmentInput): Promise<number> {
  if (i.quantity < 0) throw new Error('Kuantitas tidak boleh negatif')
  if (i.buy_price < 0) throw new Error('Harga beli tidak boleh negatif')
  if (i.current_price !== null && i.current_price < 0) throw new Error('Harga saat ini tidak boleh negatif')
  const { data, error } = await supabase
    .from('investments')
    .insert({
      asset_type: i.asset_type,
      asset_name: i.asset_name,
      quantity: i.quantity,
      buy_price: i.buy_price,
      current_price: i.current_price,
      buy_date: i.buy_date,
      note: i.note,
    })
    .select('id')
    .single()
  if (error) throw error

  if (i.current_price != null) {
    await supabase.from('price_history').insert({
      investment_id: data.id,
      price: i.current_price,
      date: i.buy_date,
    })
  }
  return data.id
}

export async function updateInvestment(id: number, i: InvestmentInput): Promise<void> {
  if (i.quantity < 0) throw new Error('Kuantitas tidak boleh negatif')
  if (i.buy_price < 0) throw new Error('Harga beli tidak boleh negatif')
  if (i.current_price !== null && i.current_price < 0) throw new Error('Harga saat ini tidak boleh negatif')
  const { error } = await supabase
    .from('investments')
    .update({
      asset_type: i.asset_type,
      asset_name: i.asset_name,
      quantity: i.quantity,
      buy_price: i.buy_price,
      current_price: i.current_price,
      buy_date: i.buy_date,
      note: i.note,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteInvestment(id: number): Promise<void> {
  const { error } = await supabase.from('investments').delete().eq('id', id)
  if (error) throw error
}

export async function updatePrice(investmentId: number, price: number, date: string): Promise<void> {
  if (price < 0) throw new Error('Harga tidak boleh negatif')
  const { error: e1 } = await supabase
    .from('investments')
    .update({ current_price: price })
    .eq('id', investmentId)
  if (e1) throw e1

  const { error: e2 } = await supabase
    .from('price_history')
    .insert({ investment_id: investmentId, price, date })
  if (e2) throw e2
}

export async function getPriceHistory(investmentId: number): Promise<PriceHistoryEntry[]> {
  const { data, error } = await supabase
    .from('price_history')
    .select('id, investment_id, price, date')
    .eq('investment_id', investmentId)
    .order('date', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return data as PriceHistoryEntry[]
}

export async function listAssetTypes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('investments')
    .select('asset_type')
  if (error) throw error
  const existing = [...new Set((data ?? []).map((r: any) => r.asset_type as string))]
  const defaults = ['Saham', 'Reksadana', 'Emas', 'Kripto', 'Obligasi']
  return [...new Set([...defaults, ...existing])].sort()
}

// Computation helpers (pure, no network)
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

const RENCANA_INVESTMENTS: InvestmentInput[] = [
  { asset_type: 'Reksadana', asset_name: 'Reksadana Sukuk Sucorinvest Sharia', quantity: 1, buy_price: 100_000_000, current_price: 100_000_000, buy_date: '2026-04-01', note: 'Seeded dari rencana-keuangan-v2.html' },
  { asset_type: 'Emas', asset_name: 'Emas Tabungan Pegadaian', quantity: 5.5278, buy_price: 2_683_000, current_price: 2_683_000, buy_date: '2026-04-01', note: 'Seeded dari rencana-keuangan-v2.html' },
  { asset_type: 'Saham', asset_name: 'Saham BMRI', quantity: 1, buy_price: 6_129_180, current_price: 6_129_180, buy_date: '2026-04-01', note: 'Seeded dari rencana-keuangan-v2.html' },
]

export async function seedRencanaInvestments(): Promise<void> {
  const existing = await listInvestments()
  const existingNames = new Set(existing.map((i) => i.asset_name))
  const toInsert = RENCANA_INVESTMENTS.filter((i) => !existingNames.has(i.asset_name))
  for (const inv of toInsert) await createInvestment(inv)
}
