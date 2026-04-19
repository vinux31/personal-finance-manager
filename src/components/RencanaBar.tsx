import { Progress } from '@/components/ui/progress'
import { formatRupiah } from '@/lib/format'

const TARGET_RENCANA = 257_000_000

interface RencanaBarProps { totalNilai: number }

export default function RencanaBar({ totalNilai }: RencanaBarProps) {
  const progress = Math.min(100, (totalNilai / TARGET_RENCANA) * 100)
  const gap = Math.max(0, TARGET_RENCANA - totalNilai)
  const deadline = new Date('2027-01-01')
  const now = new Date()
  const bulanLagi = (deadline.getFullYear() - now.getFullYear()) * 12
    + (deadline.getMonth() - now.getMonth())

  return (
    <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex shrink-0 flex-col items-center rounded-md bg-blue-600 px-3 py-1.5 text-white">
        <span className="text-xs font-medium opacity-80">Jan 2027</span>
        <span className="text-lg font-bold leading-tight">{progress.toFixed(0)}%</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 text-sm font-medium text-blue-900">
          {formatRupiah(totalNilai)} / {formatRupiah(TARGET_RENCANA)}
          {bulanLagi > 0 && <span className="ml-1 font-normal text-blue-700">· {bulanLagi} bulan lagi</span>}
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
