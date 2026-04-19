import { all } from './repo'

export interface PeriodAgg {
  period: string
  income: number
  expense: number
}

export interface CategoryAgg {
  category: string
  total: number
}

export type PeriodGranularity = 'day' | 'week' | 'month' | 'year'

/** Group income/expense by period granularity. Date range inclusive. */
export function aggregateByPeriod(
  granularity: PeriodGranularity,
  dateFrom?: string,
  dateTo?: string,
): PeriodAgg[] {
  const group =
    granularity === 'day'
      ? "date"
      : granularity === 'week'
        ? "strftime('%Y-W%W', date)"
        : granularity === 'month'
          ? "strftime('%Y-%m', date)"
          : "strftime('%Y', date)"

  const conds: string[] = []
  const params: unknown[] = []
  if (dateFrom) {
    conds.push('date >= ?')
    params.push(dateFrom)
  }
  if (dateTo) {
    conds.push('date <= ?')
    params.push(dateTo)
  }
  const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : ''

  return all<PeriodAgg>(
    `SELECT ${group} AS period,
            COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS expense
     FROM transactions
     ${where}
     GROUP BY period
     ORDER BY period`,
    params,
  )
}

export function aggregateByCategory(
  type: 'income' | 'expense',
  dateFrom?: string,
  dateTo?: string,
): CategoryAgg[] {
  const conds = ['t.type = ?']
  const params: unknown[] = [type]
  if (dateFrom) {
    conds.push('t.date >= ?')
    params.push(dateFrom)
  }
  if (dateTo) {
    conds.push('t.date <= ?')
    params.push(dateTo)
  }
  return all<CategoryAgg>(
    `SELECT c.name AS category, COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE ${conds.join(' AND ')}
     GROUP BY c.id, c.name
     HAVING total > 0
     ORDER BY total DESC`,
    params,
  )
}
