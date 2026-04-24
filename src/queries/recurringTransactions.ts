import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listRecurringTemplates,
  listUpcomingBills,
  createRecurringTemplate,
  updateRecurringTemplate,
  deleteRecurringTemplate,
  markBillPaid,
  type RecurringTemplate,
  type RecurringTemplateInput,
  type MarkBillPaidResult,
} from '@/db/recurringTransactions'
import { mapSupabaseError } from '@/lib/errors'
import { useTargetUserId } from '@/auth/useTargetUserId'

export { type RecurringTemplate, type RecurringTemplateInput, type MarkBillPaidResult }

export function useRecurringTemplates() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['recurring-templates', uid],
    queryFn: () => listRecurringTemplates(uid),
    enabled: !!uid,
  })
}

export function useCreateRecurringTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RecurringTemplateInput) => createRecurringTemplate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-templates'] })
      toast.success('Template berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useUpdateRecurringTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: RecurringTemplateInput }) =>
      updateRecurringTemplate(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-templates'] })
      toast.success('Template berhasil diubah')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useDeleteRecurringTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteRecurringTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-templates'] })
      toast.success('Template dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useUpcomingBills() {
  const uid = useTargetUserId()
  const endOfMonth = useMemo(() => {
    const d = new Date()
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const y = lastDay.getFullYear()
    const mo = String(lastDay.getMonth() + 1).padStart(2, '0')
    const day = String(lastDay.getDate()).padStart(2, '0')
    return `${y}-${mo}-${day}`
  }, [])
  return useQuery({
    queryKey: ['upcoming-bills', uid, endOfMonth],
    queryFn: () => listUpcomingBills(uid, endOfMonth),
    enabled: !!uid,
  })
}

export function useMarkBillPaid() {
  const qc = useQueryClient()
  const uid = useTargetUserId()
  return useMutation({
    mutationFn: ({ templateId, paidDate }: { templateId: number; paidDate: string }) =>
      markBillPaid(templateId, uid, paidDate),

    onMutate: async ({ templateId }) => {
      // Cancel any in-flight ['upcoming-bills'] refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: ['upcoming-bills'] })

      // Snapshot every matching ['upcoming-bills', ...] cache entry for rollback
      const snapshots = qc.getQueriesData<RecurringTemplate[]>({ queryKey: ['upcoming-bills'] })

      // Optimistically remove the bill from every matching cache
      qc.setQueriesData<RecurringTemplate[]>(
        { queryKey: ['upcoming-bills'] },
        (old) => old?.filter((b) => b.id !== templateId) ?? [],
      )

      return { snapshots }
    },

    onError: (err, _vars, context) => {
      // Rollback all snapshots
      context?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data))
      toast.error(mapSupabaseError(err))
    },

    onSuccess: () => {
      toast.success('✓ Tagihan dilunasi')
    },

    onSettled: () => {
      // Refetch on both success and error to reconcile with server truth
      qc.invalidateQueries({ queryKey: ['upcoming-bills'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      qc.invalidateQueries({ queryKey: ['recurring-templates'] })
    },
  })
}
