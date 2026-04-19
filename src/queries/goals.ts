import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  addMoneyToGoal,
  withdrawFromGoal,
  goalProgress,
  type Goal,
  type GoalInput,
  type GoalStatus,
} from '@/db/goals'
import { mapSupabaseError } from '@/lib/errors'

export { goalProgress }
export { type Goal, type GoalInput, type GoalStatus }

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: listGoals,
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GoalInput) => createGoal(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Goal berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: GoalInput }) => updateGoal(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Goal berhasil diubah')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteGoal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Goal dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useAddMoneyToGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) => addMoneyToGoal(id, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Dana berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useWithdrawFromGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount, goal }: { id: number; amount: number; goal: Goal }) =>
      withdrawFromGoal(id, amount, goal),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Dana berhasil ditarik')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
