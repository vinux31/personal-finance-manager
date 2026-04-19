import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listGoalInvestments,
  upsertGoalInvestment,
  deleteGoalInvestment,
  type GoalInvestment,
} from '@/db/goalInvestments'
import { mapSupabaseError } from '@/lib/errors'

export { type GoalInvestment }

export function useGoalInvestments() {
  return useQuery({
    queryKey: ['goal-investments'],
    queryFn: listGoalInvestments,
  })
}

export function useUpsertGoalInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      goalId,
      investmentId,
      allocationPct,
    }: {
      goalId: number
      investmentId: number
      allocationPct: number
    }) => upsertGoalInvestment(goalId, investmentId, allocationPct),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal-investments'] })
      toast.success('Alokasi berhasil disimpan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useDeleteGoalInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      goalId,
      investmentId,
    }: {
      goalId: number
      investmentId: number
    }) => deleteGoalInvestment(goalId, investmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal-investments'] })
      toast.success('Link investasi dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
