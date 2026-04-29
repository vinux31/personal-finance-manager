import { supabase } from '@/lib/supabase'
import { RENCANA_GOAL_NAMES } from '@/lib/rencanaNames'

export type GoalStatus = 'active' | 'completed' | 'paused'

export interface Goal {
  id: number
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  status: GoalStatus
}

export interface GoalInput {
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  status: GoalStatus
}

export interface GoalFilters {
  search?: string
  status?: GoalStatus | ''
}

export async function listGoals(f: GoalFilters | string = {}, uid?: string): Promise<Goal[]> {
  const filters: GoalFilters = typeof f === 'string' ? {} : f
  const resolvedUid = typeof f === 'string' ? f : uid
  let query = supabase
    .from('goals')
    .select('id, name, target_amount, current_amount, target_date, status')
    .order('status')
    .order('target_date', { ascending: true, nullsFirst: false })
    .order('id', { ascending: false })
  if (resolvedUid) query = query.eq('user_id', resolvedUid)
  if (filters.search) query = query.ilike('name', `%${filters.search}%`)
  if (filters.status) query = query.eq('status', filters.status)
  const { data, error } = await query
  if (error) throw error
  return data as Goal[]
}

export async function getGoal(id: number): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .select('id, name, target_amount, current_amount, target_date, status')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Goal | null
}

export async function createGoal(g: GoalInput): Promise<number> {
  if (g.target_amount <= 0) throw new Error('Target harus > 0')
  if (g.current_amount < 0) throw new Error('Terkumpul tidak boleh negatif')
  const { data, error } = await supabase
    .from('goals')
    .insert({
      name: g.name,
      target_amount: g.target_amount,
      current_amount: g.current_amount,
      target_date: g.target_date,
      status: g.status,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateGoal(id: number, g: GoalInput): Promise<void> {
  if (g.target_amount <= 0) throw new Error('Target harus > 0')
  if (g.current_amount < 0) throw new Error('Terkumpul tidak boleh negatif')
  const { error } = await supabase
    .from('goals')
    .update({
      name: g.name,
      target_amount: g.target_amount,
      current_amount: g.current_amount,
      target_date: g.target_date,
      status: g.status,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteGoal(id: number): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw error
}

export async function addMoneyToGoal(id: number, amount: number): Promise<{ current_amount: number; status: GoalStatus }> {
  if (amount <= 0) throw new Error('Jumlah harus > 0')
  const { data, error } = await supabase.rpc('add_money_to_goal', { p_id: id, p_amount: amount })
  if (error) throw error
  return data[0] as { current_amount: number; status: GoalStatus }
}

export function goalProgress(g: Goal): number {
  if (g.target_amount <= 0) return 0
  return Math.min(100, (g.current_amount / g.target_amount) * 100)
}

export async function withdrawFromGoal(
  id: number,
  amount: number,
): Promise<{ current_amount: number; status: GoalStatus }> {
  if (amount <= 0) throw new Error('Jumlah harus > 0')
  const { data, error } = await supabase.rpc('withdraw_from_goal', { p_id: id, p_amount: amount })
  if (error) throw error
  return data[0] as { current_amount: number; status: GoalStatus }
}

