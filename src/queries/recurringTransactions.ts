import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listRecurringTemplates,
  createRecurringTemplate,
  updateRecurringTemplate,
  deleteRecurringTemplate,
  type RecurringTemplate,
  type RecurringTemplateInput,
} from '@/db/recurringTransactions'
import { mapSupabaseError } from '@/lib/errors'
import { useTargetUserId } from '@/auth/useTargetUserId'

export { type RecurringTemplate, type RecurringTemplateInput }

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
