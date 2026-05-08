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
  type GoalFilters,
} from '@/db/goals'
import { supabase } from '@/lib/supabase'
import { mapSupabaseError } from '@/lib/errors'
import { useTargetUserId } from '@/auth/useTargetUserId'

export { goalProgress }
export { type Goal, type GoalInput, type GoalStatus, type GoalFilters }

/**
 * GoalWithProgress — read shape dari `goals_with_progress` VIEW (migration 0023).
 *
 * Catatan: VIEW tidak expose `created_at` (Phase 13 Plan 13-03 extend Goal dengan
 * created_at). Consumer GoalsTab/DashboardTab pakai GoalWithProgress di tempat yang
 * expect `Goal`, jadi kita synthesize `created_at` field di mapper query hasil VIEW
 * (fallback timestamp ISO untuk satisfy type contract — value tidak digunakan oleh
 * consumer GoalWithProgress; computeGoalsOnTrack pakai `useGoals()` direct table).
 *
 * Kalau Phase berikutnya butuh real created_at di GoalWithProgress, tambah migration
 * 00XX_goals_with_progress_v2.sql include `g.created_at` ke SELECT + GROUP BY.
 */
export interface GoalWithProgress extends Goal {
  total_amount: number
}

export function useGoals(filters: GoalFilters = {}) {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['goals', uid, filters],
    queryFn: () => listGoals(filters, uid),
    enabled: !!uid,
  })
}

export function useGoalsWithProgress(filters: GoalFilters = {}) {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['goals-with-progress', uid, filters],
    queryFn: async () => {
      let query = supabase
        .from('goals_with_progress')
        .select('id, user_id, name, target_amount, current_amount, target_date, status, total_amount')
        .order('status')
        .order('target_date', { ascending: true, nullsFirst: false })
        .order('id', { ascending: false })
      if (uid) query = query.eq('user_id', uid)
      if (filters.search) query = query.ilike('name', `%${filters.search}%`)
      if (filters.status) query = query.eq('status', filters.status)
      const { data, error } = await query
      if (error) throw error
      // VIEW goals_with_progress tidak expose created_at (migration 0023). Synthesize
      // empty-string fallback untuk satisfy Goal type contract — value tidak digunakan
      // oleh consumer GoalWithProgress (DashboardTab/GoalsTab cuma destructure existing
      // fields). computeGoalsOnTrack (DIAG-05) pakai useGoals() direct table query
      // yang include real created_at.
      return (data ?? []).map(row => ({ ...row, created_at: '' })) as GoalWithProgress[]
    },
    enabled: !!uid,
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GoalInput) => createGoal(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      qc.invalidateQueries({ queryKey: ['goals-with-progress'] })
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
      qc.invalidateQueries({ queryKey: ['goals-with-progress'] })
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
      qc.invalidateQueries({ queryKey: ['goals-with-progress'] })
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
      qc.invalidateQueries({ queryKey: ['goals-with-progress'] })
      toast.success('Dana berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useWithdrawFromGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      withdrawFromGoal(id, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      qc.invalidateQueries({ queryKey: ['goals-with-progress'] })
      toast.success('Dana berhasil ditarik')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
