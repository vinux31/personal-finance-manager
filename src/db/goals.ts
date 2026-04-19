import { all, one, run } from './repo'

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

export function listGoals(): Goal[] {
  return all<Goal>(
    `SELECT id, name, target_amount, current_amount, target_date, status
     FROM goals
     ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
              target_date IS NULL, target_date, id DESC`,
  )
}

export function getGoal(id: number): Goal | null {
  return one<Goal>(
    `SELECT id, name, target_amount, current_amount, target_date, status
     FROM goals WHERE id = ?`,
    [id],
  )
}

export async function createGoal(g: GoalInput): Promise<number> {
  if (g.target_amount <= 0) throw new Error('Target harus > 0')
  if (g.current_amount < 0) throw new Error('Terkumpul tidak boleh negatif')
  const { lastId } = await run(
    `INSERT INTO goals (name, target_amount, current_amount, target_date, status)
     VALUES (?, ?, ?, ?, ?)`,
    [g.name, g.target_amount, g.current_amount, g.target_date, g.status],
  )
  return lastId
}

export async function updateGoal(id: number, g: GoalInput): Promise<void> {
  if (g.target_amount <= 0) throw new Error('Target harus > 0')
  if (g.current_amount < 0) throw new Error('Terkumpul tidak boleh negatif')
  await run(
    `UPDATE goals
     SET name = ?, target_amount = ?, current_amount = ?, target_date = ?, status = ?
     WHERE id = ?`,
    [g.name, g.target_amount, g.current_amount, g.target_date, g.status, id],
  )
}

export async function deleteGoal(id: number): Promise<void> {
  await run('DELETE FROM goals WHERE id = ?', [id])
}

export async function addMoneyToGoal(id: number, amount: number): Promise<void> {
  if (amount <= 0) throw new Error('Jumlah harus > 0')
  const goal = getGoal(id)
  if (!goal) throw new Error('Goal tidak ditemukan')
  const newAmount = goal.current_amount + amount
  const newStatus: GoalStatus =
    newAmount >= goal.target_amount ? 'completed' : goal.status
  await run(
    `UPDATE goals SET current_amount = ?, status = ? WHERE id = ?`,
    [newAmount, newStatus, id],
  )
}

export function goalProgress(g: Goal): number {
  if (g.target_amount <= 0) return 0
  return Math.min(100, (g.current_amount / g.target_amount) * 100)
}
