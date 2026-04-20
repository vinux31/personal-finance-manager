import { supabase } from '@/lib/supabase'

export interface GoalInvestment {
  id: number
  goal_id: number
  investment_id: number
  allocation_pct: number
}

export async function listGoalInvestments(uid?: string): Promise<GoalInvestment[]> {
  let query = supabase
    .from('goal_investments')
    .select('id, goal_id, investment_id, allocation_pct')
    .order('id')
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data as GoalInvestment[]
}

export async function upsertGoalInvestment(
  goalId: number,
  investmentId: number,
  allocationPct: number
): Promise<void> {
  const { error } = await supabase
    .from('goal_investments')
    .upsert(
      { goal_id: goalId, investment_id: investmentId, allocation_pct: allocationPct },
      { onConflict: 'goal_id,investment_id' }
    )
  if (error) throw error
}

export async function deleteGoalInvestment(
  goalId: number,
  investmentId: number
): Promise<void> {
  const { error } = await supabase
    .from('goal_investments')
    .delete()
    .eq('goal_id', goalId)
    .eq('investment_id', investmentId)
  if (error) throw error
}
