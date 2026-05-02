import { usePayPeriodSummaries } from '@/queries/payPeriods'
import { formatRupiah } from '@/lib/format'

export function PayPeriodCard() {
  const { data: summaries, isLoading } = usePayPeriodSummaries()
  const current = summaries?.[0]

  if (isLoading || !current) return null

  const pct =
    current.total_income > 0
      ? Math.min(Math.round((current.total_expense / current.total_income) * 100), 100)
      : 0
  const isLow = current.total_income > 0 && current.remaining / current.total_income < 0.1

  const startLabel = new Date(current.start_date + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  })
  const endLabel = current.end_date
    ? new Date(current.end_date + 'T00:00:00').toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
      })
    : 'sekarang'

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium">{current.label}</p>
        <p className="text-xs text-muted-foreground">
          {startLabel} – {endLabel}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Total Masuk</p>
          <p className="font-semibold">{formatRupiah(current.total_income)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Terpakai</p>
          <p className="font-semibold">{formatRupiah(current.total_expense)}</p>
        </div>
      </div>
      <div className="space-y-1">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isLow ? 'bg-red-500' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{pct}% terpakai</span>
          <span className={isLow ? 'text-red-500 font-medium' : ''}>
            Sisa {formatRupiah(current.remaining)}
          </span>
        </div>
      </div>
    </div>
  )
}
