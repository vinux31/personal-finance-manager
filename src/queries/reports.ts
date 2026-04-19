import { useQuery } from '@tanstack/react-query'
import {
  aggregateByPeriod,
  aggregateByCategory,
  type PeriodGranularity,
  type PeriodAgg,
  type CategoryAgg,
} from '@/db/reports'

export { type PeriodGranularity, type PeriodAgg, type CategoryAgg }

export function useAggregateByPeriod(
  granularity: PeriodGranularity,
  dateFrom?: string,
  dateTo?: string,
) {
  return useQuery({
    queryKey: ['reports', 'period', granularity, dateFrom, dateTo],
    queryFn: () => aggregateByPeriod(granularity, dateFrom, dateTo),
  })
}

export function useAggregateByCategory(
  type: 'income' | 'expense',
  dateFrom?: string,
  dateTo?: string,
) {
  return useQuery({
    queryKey: ['reports', 'category', type, dateFrom, dateTo],
    queryFn: () => aggregateByCategory(type, dateFrom, dateTo),
  })
}
