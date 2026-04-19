import { supabase } from '@/lib/supabase'

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

export async function addMoneyToGoal(id: number, amount: number): Promise<void> {
  if (amount <= 0) throw new Error('Jumlah harus > 0')
  const goal = await getGoal(id)
  if (!goal) throw new Error('Goal tidak ditemukan')
  const newAmount = goal.current_amount + amount
  const newStatus: GoalStatus = newAmount >= goal.target_amount ? 'completed' : goal.status
  const { error } = await supabase
    .from('goals')
    .update({ current_amount: newAmount, status: newStatus })
    .eq('id', id)
  if (error) throw error
}

export function goalProgress(g: Goal): number {
  if (g.target_amount <= 0) return 0
  return Math.min(100, (g.current_amount / g.target_amount) * 100)
}
