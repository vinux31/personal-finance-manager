import { supabase } from '@/lib/supabase'

export interface PeriodAgg {
  period: string
  income: number
  expense: number
}

export interface CategoryAgg {
  category: string
  total: number
}

export type PeriodGranularity = 'day' | 'week' | 'month' | 'year'

export async function aggregateByPeriod(
  granularity: PeriodGranularity,
  dateFrom?: string,
  dateTo?: string,
  uid?: string,
): Promise<PeriodAgg[]> {
  const { data, error } = await supabase.rpc('aggregate_by_period', {
    p_granularity: granularity,
    p_date_from: dateFrom ?? null,
    p_date_to: dateTo ?? null,
    p_user_id: uid ?? null,
  })
  if (error) throw error
  return (data ?? []) as PeriodAgg[]
}

export async function aggregateByCategory(
  type: 'income' | 'expense',
  dateFrom?: string,
  dateTo?: string,
  uid?: string,
): Promise<CategoryAgg[]> {
  const { data, error } = await supabase.rpc('aggregate_by_category', {
    p_type: type,
    p_date_from: dateFrom ?? null,
    p_date_to: dateTo ?? null,
    p_user_id: uid ?? null,
  })
  if (error) throw error
  return (data ?? []) as CategoryAgg[]
}
