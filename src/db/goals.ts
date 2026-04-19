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

export async function listGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('id, name, target_amount, current_amount, target_date, status')
    .order('status')
    .order('target_date', { ascending: true, nullsFirst: false })
    .order('id', { ascending: false })
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
  goal: Goal
): Promise<void> {
  if (amount <= 0) throw new Error('Jumlah harus > 0')
  const newAmount = goal.current_amount - amount
  if (newAmount < 0) throw new Error('Dana tidak cukup')
  const newStatus: GoalStatus =
    goal.status === 'completed' && newAmount < goal.target_amount
      ? 'active'
      : goal.status
  const { error } = await supabase
    .from('goals')
    .update({ current_amount: newAmount, status: newStatus })
    .eq('id', id)
  if (error) throw error
}

const RENCANA_GOALS: GoalInput[] = [
  { name: RENCANA_GOAL_NAMES[0], target_amount: 100_000_000, current_amount: 0, target_date: '2027-01-01', status: 'active' },
  { name: RENCANA_GOAL_NAMES[1], target_amount: 118_000_000, current_amount: 0, target_date: '2027-01-01', status: 'active' },
  { name: RENCANA_GOAL_NAMES[2], target_amount: 10_000_000,  current_amount: 0, target_date: '2027-01-01', status: 'active' },
  { name: RENCANA_GOAL_NAMES[3], target_amount: 24_000_000,  current_amount: 0, target_date: '2026-12-01', status: 'active' },
  { name: RENCANA_GOAL_NAMES[4], target_amount: 5_000_000,   current_amount: 0, target_date: '2027-01-01', status: 'active' },
]

export async function seedRencanaGoals(): Promise<void> {
  const existing = await listGoals()
  const existingNames = new Set(existing.map((g) => g.name))
  const toInsert = RENCANA_GOALS.filter((g) => !existingNames.has(g.name))
  for (const g of toInsert) await createGoal(g)
}
