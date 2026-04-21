import { supabase } from '@/lib/supabase'

export interface BeiStock {
  id: number
  ticker: string
  name: string
  sector: string
  dividend_yield: number | null
  dividend_growth: number | null
  is_preloaded: boolean
}

export interface DividendTransaction {
  id: number
  user_id: string
  bei_stock_id: number
  type: 'BUY' | 'SELL'
  lots: number
  price_per_share: number
  transaction_date: string
  note: string | null
}

export interface DividendHolding {
  bei_stock_id: number
  ticker: string
  name: string
  sector: string
  dividend_yield: number | null
  dividend_growth: number | null
  total_lots: number
  avg_price: number
  current_price: number | null
  investment_id: number | null
}

export interface CreateDividendTransactionInput {
  bei_stock_id: number
  type: 'BUY' | 'SELL'
  lots: number
  price_per_share: number
  transaction_date: string
  note?: string
}

export async function listBeiStocks(): Promise<BeiStock[]> {
  const { data, error } = await supabase
    .from('bei_stocks')
    .select('id, ticker, name, sector, dividend_yield, dividend_growth, is_preloaded')
    .order('ticker')
  if (error) throw error
  return data as BeiStock[]
}

export async function listDividendTransactions(uid?: string): Promise<DividendTransaction[]> {
  let query = supabase
    .from('dividend_transactions')
    .select('id, user_id, bei_stock_id, type, lots, price_per_share, transaction_date, note')
    .order('transaction_date', { ascending: false })
    .order('id', { ascending: false })
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data as DividendTransaction[]
}

export async function getDividendHoldings(uid?: string): Promise<DividendHolding[]> {
  const { data, error } = await supabase.rpc('get_dividend_holdings', {
    p_user_id: uid ?? null,
  })
  if (error) throw error
  return (data ?? []) as DividendHolding[]
}

export async function createDividendTransaction(
  input: CreateDividendTransactionInput,
): Promise<void> {
  const { error } = await supabase.rpc('create_dividend_transaction', {
    p_bei_stock_id:     input.bei_stock_id,
    p_type:             input.type,
    p_lots:             input.lots,
    p_price_per_share:  input.price_per_share,
    p_transaction_date: input.transaction_date,
    p_note:             input.note ?? null,
  })
  if (error) throw error
}

// --- Pure calculation helpers (no network) ---

export function shares(holding: DividendHolding): number {
  return holding.total_lots * 100
}

export function dividendCostBasis(holding: DividendHolding): number {
  return shares(holding) * holding.avg_price
}

export function dividendCurrentValue(holding: DividendHolding): number {
  const price = holding.current_price ?? holding.avg_price
  return shares(holding) * price
}

export function annualIncome(holding: DividendHolding): number {
  if (holding.dividend_yield == null) return 0
  return Math.round(dividendCurrentValue(holding) * holding.dividend_yield / 100)
}

export function yieldOnCost(holding: DividendHolding): number {
  const cb = dividendCostBasis(holding)
  if (cb === 0) return 0
  return annualIncome(holding) / cb * 100
}

export function weightedAvgYield(holdings: DividendHolding[]): number {
  const totalValue = holdings.reduce((s, h) => s + dividendCurrentValue(h), 0)
  if (totalValue === 0) return 0
  const weighted = holdings.reduce((s, h) => {
    if (h.dividend_yield == null) return s
    return s + dividendCurrentValue(h) * h.dividend_yield
  }, 0)
  return weighted / totalValue
}

export function sectorAllocation(
  holdings: DividendHolding[],
): { sector: string; value: number }[] {
  const map = new Map<string, number>()
  for (const h of holdings) {
    const v = dividendCurrentValue(h)
    map.set(h.sector, (map.get(h.sector) ?? 0) + v)
  }
  return [...map.entries()]
    .map(([sector, value]) => ({ sector, value }))
    .sort((a, b) => b.value - a.value)
}
