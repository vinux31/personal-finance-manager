import { supabase } from '../lib/supabase'

export interface PayPeriod {
  id: number
  user_id: string
  label: string
  start_date: string   // 'YYYY-MM-DD'
  created_at: string
}

export interface PayPeriodSummary extends PayPeriod {
  end_date: string | null   // null = periode aktif; otherwise start_date periode lebih baru
  total_income: number
  total_expense: number
  remaining: number
}

export async function listPayPeriods(): Promise<PayPeriod[]> {
  const { data, error } = await supabase
    .from('pay_periods')
    .select('id, user_id, label, start_date, created_at')
    .order('start_date', { ascending: false })
  if (error) throw error
  return data as PayPeriod[]
}

export async function createPayPeriod(input: {
  label: string
  start_date: string
}): Promise<PayPeriod> {
  const { data, error } = await supabase
    .from('pay_periods')
    .insert({ label: input.label, start_date: input.start_date })
    .select('id, user_id, label, start_date, created_at')
    .single()
  if (error) throw error
  return data as PayPeriod
}

export async function payPeriodExistsOnDate(date: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('pay_periods')
    .select('id')
    .eq('start_date', date)
    .maybeSingle()
  if (error) throw error
  return data !== null
}
