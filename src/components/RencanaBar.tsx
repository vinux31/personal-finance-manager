import { type Goal } from '@/db/goals'
import { Progress } from '@/components/ui/progress'
import { formatRupiah } from '@/lib/format'

interface RencanaBarProps {
  totalNilai: number
  goals: Goal[]
}

export default function RencanaBar({ totalNilai, goals }: RencanaBarProps) {
  const activeGoals = goals.filter((g) => g.status === 'active')
  const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0)

  if (totalTarget === 0) return null

  const deadlineStr = activeGoals
    .filter((g) => g.target_date)
    .reduce((latest, g) => (g.target_date! > latest ? g.target_date! : latest), '')
  const deadline = deadlineStr ? new Date(deadlineStr) : null

  const progress = Math.min(100, (totalNilai / totalTarget) * 100)
  const gap = Math.max(0, totalTarget - totalNilai)

  const now = new Date()
  const bulanLagi = deadline
    ? (deadline.getFullYear() - now.getFullYear()) * 12 +
      (deadline.getMonth() - now.getMonth())
    : null

  const deadlineLabel = deadline
    ? deadline.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex shrink-0 flex-col items-center rounded-md bg-blue-600 px-3 py-1.5 text-white">
        {deadlineLabel && <span className="text-xs font-medium opacity-80">{deadlineLabel}</span>}
        <span className="text-lg font-bold leading-tight">{progress.toFixed(0)}%</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 text-sm font-medium text-blue-900">
          {formatRupiah(totalNilai)} / {formatRupiah(totalTarget)}
          {bulanLagi !== null && bulanLagi > 0 && (
            <span className="ml-1 font-normal text-blue-700">· {bulanLagi} bulan lagi</span>
          )}
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      {gap > 0 && (
        <div className="shrink-0 text-right">
          <div className="text-xs text-muted-foreground">Gap</div>
          <div className="text-sm font-semibold text-red-600">{formatRupiah(gap)}</div>
        </div>
      )}
    </div>
  )
}
