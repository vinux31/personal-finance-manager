import { useUpcomingBills } from '@/queries/recurringTransactions'
import { todayISO } from '@/lib/format'

export function useRecurringDueCount(): number {
  const { data } = useUpcomingBills()
  if (!data) return 0
  const today = todayISO()
  return data.filter((b) => b.next_due_date <= today).length
}
