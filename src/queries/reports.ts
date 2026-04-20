import { useQuery } from '@tanstack/react-query'
import {
  aggregateByPeriod,
  aggregateByCategory,
  type PeriodGranularity,
  type PeriodAgg,
  type CategoryAgg,
} from '@/db/reports'

import { useTargetUserId } from '@/auth/useTargetUserId'

export { type PeriodGranularity, type PeriodAgg, type CategoryAgg }

export function useAggregateByPeriod(
  granularity: PeriodGranularity,
  dateFrom?: string,
  dateTo?: string,
) {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['reports', 'period', granularity, dateFrom, dateTo, uid],
    queryFn: () => aggregateByPeriod(granularity, dateFrom, dateTo, uid),
    enabled: !!uid,
  })
}

export function useAggregateByCategory(
  type: 'income' | 'expense',
  dateFrom?: string,
  dateTo?: string,
) {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['reports', 'category', type, dateFrom, dateTo, uid],
    queryFn: () => aggregateByCategory(type, dateFrom, dateTo, uid),
    enabled: !!uid,
  })
}
