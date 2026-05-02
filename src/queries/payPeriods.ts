import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listPayPeriods,
  createPayPeriod,
  payPeriodExistsOnDate,
} from '../db/payPeriods'
import type { PayPeriod, PayPeriodSummary } from '../db/payPeriods'
import { listTransactions } from '../db/transactions'

export function usePayPeriods() {
  return useQuery({
    queryKey: ['payPeriods'],
    queryFn: listPayPeriods,
  })
}

export function useCurrentPayPeriod() {
  return useQuery({
    queryKey: ['payPeriods'],
    queryFn: listPayPeriods,
    select: (periods) => periods[0] ?? null,
  })
}

// Hitung summary per periode dengan join ke semua transaksi
export function usePayPeriodSummaries() {
  const periodsQuery = useQuery({
    queryKey: ['payPeriods'],
    queryFn: listPayPeriods,
  })

  const txQuery = useQuery({
    queryKey: ['transactions', 'all'],
    queryFn: () => listTransactions(),
    enabled: (periodsQuery.data?.length ?? 0) > 0,
  })

  const summaries: PayPeriodSummary[] | undefined = periodsQuery.data?.map(
    (period, index) => {
      const periods = periodsQuery.data!
      // Sorted DESC: periods[0] = paling baru.
      // end_date untuk period[i] = start_date period[i-1] (lebih baru), atau null jika i=0
      const end_date = index === 0 ? null : periods[index - 1].start_date

      const txInPeriod = (txQuery.data ?? []).filter((tx) => {
        const afterStart = tx.date >= period.start_date
        const beforeEnd = end_date ? tx.date < end_date : true
        return afterStart && beforeEnd
      })

      const total_income = txInPeriod
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + tx.amount, 0)

      const total_expense = txInPeriod
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0)

      return {
        ...period,
        end_date,
        total_income,
        total_expense,
        remaining: total_income - total_expense,
      }
    }
  )

  return {
    data: summaries,
    isLoading: periodsQuery.isLoading || txQuery.isLoading,
    error: periodsQuery.error ?? txQuery.error,
  }
}

// Transaksi dalam satu periode — fetch dari dateFrom, filter client-side sampai endDate
export function usePayPeriodTransactions(
  period: PayPeriod | null,
  endDate: string | null
) {
  return useQuery({
    queryKey: ['transactions', 'period', period?.id],
    queryFn: async () => {
      if (!period) return []
      const all = await listTransactions({ dateFrom: period.start_date })
      return endDate ? all.filter((tx) => tx.date < endDate) : all
    },
    enabled: !!period,
  })
}

export function useCreatePayPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPayPeriod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payPeriods'] })
    },
  })
}

export function usePayPeriodExistsOnDate(date: string) {
  return useQuery({
    queryKey: ['payPeriods', 'exists', date],
    queryFn: () => payPeriodExistsOnDate(date),
    enabled: !!date,
  })
}
