import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTargetUserId } from '@/auth/useTargetUserId'
import { listRecurringTemplates, updateRecurringTemplate, nextDueDate } from '@/db/recurringTransactions'
import { createTransaction } from '@/db/transactions'
import { todayISO } from '@/lib/format'

export function useProcessRecurring() {
  const uid = useTargetUserId()
  const qc = useQueryClient()

  useEffect(() => {
    if (!uid) return
    const today = todayISO()

    async function process() {
      const templates = await listRecurringTemplates(uid)
      const overdue = templates.filter((t) => t.is_active && t.next_due_date <= today)
      if (overdue.length === 0) return

      let created = 0
      for (const t of overdue) {
        let due = t.next_due_date
        let iterations = 0
        while (due <= today && iterations < 12) {
          await createTransaction({
            date: due,
            type: t.type,
            category_id: t.category_id,
            amount: t.amount,
            note: t.note ?? t.name,
          })
          due = nextDueDate(due, t.frequency)
          iterations++
          created++
        }
        await updateRecurringTemplate(t.id, { ...t, next_due_date: due })
      }

      await qc.invalidateQueries({ queryKey: ['transactions'] })
      await qc.invalidateQueries({ queryKey: ['recurring-templates'] })
      toast.success(`${created} transaksi rutin diproses`)
    }

    process().catch(console.error)
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps
}
