import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { usePayPeriodSummaries } from '@/queries/payPeriods'
import type { PayPeriodSummary } from '@/db/payPeriods'
import { PayPeriodDetail } from '@/components/PayPeriodDetail'
import { formatRupiah } from '@/lib/format'

export function PayPeriodList() {
  const { data: summaries = [], isLoading } = usePayPeriodSummaries()
  const [selected, setSelected] = useState<PayPeriodSummary | null>(null)

  if (selected) {
    return (
      <PayPeriodDetail
        period={selected}
        endDate={selected.end_date}
        onBack={() => setSelected(null)}
      />
    )
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-4">Memuat...</p>
  }

  if (summaries.length === 0) {
    return (
      <div className="text-center py-14 space-y-2">
        <p className="text-sm font-medium">Belum ada periode gaji</p>
        <p className="text-xs text-muted-foreground">
          Catat transaksi dengan kategori &quot;Gaji&quot; untuk memulai periode pertama
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {summaries.map((s) => {
        const startLabel = new Date(s.start_date + 'T00:00:00').toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
        })
        const endLabel = s.end_date
          ? new Date(s.end_date + 'T00:00:00').toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
            })
          : 'sekarang'
        const isDeficit = s.remaining < 0

        return (
          <button
            key={s.id}
            onClick={() => setSelected(s)}
            className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-medium truncate">{s.label}</p>
                <p className="text-xs text-muted-foreground">
                  {startLabel} – {endLabel}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs pt-1">
                  <span className="text-green-600">
                    Masuk {formatRupiah(s.total_income)}
                  </span>
                  <span className="text-muted-foreground">
                    Keluar {formatRupiah(s.total_expense)}
                  </span>
                  <span className={isDeficit ? 'text-red-500 font-medium' : ''}>
                    {isDeficit ? 'Defisit' : 'Sisa'}{' '}
                    {formatRupiah(Math.abs(s.remaining))}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </button>
        )
      })}
    </div>
  )
}
