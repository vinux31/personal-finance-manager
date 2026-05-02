import type { PayPeriod } from '@/db/payPeriods'
import { usePayPeriodTransactions } from '@/queries/payPeriods'
import { formatRupiah } from '@/lib/format'
import { Button } from '@/components/ui/button'

interface Props {
  period: PayPeriod
  endDate: string | null
  onBack: () => void
}

export function PayPeriodDetail({ period, endDate, onBack }: Props) {
  const { data: txs = [], isLoading } = usePayPeriodTransactions(period, endDate)

  const grouped = txs.reduce<Record<string, typeof txs>>((acc, tx) => {
    if (!acc[tx.date]) acc[tx.date] = []
    acc[tx.date].push(tx)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← Kembali
      </Button>
      <h3 className="font-semibold text-base">{period.label}</h3>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Memuat transaksi...</p>
      )}

      {sortedDates.map((date) => (
        <div key={date} className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          {grouped[date].map((tx) => (
            <div
              key={tx.id}
              className="flex justify-between items-center py-1.5 border-b last:border-0"
            >
              <div>
                <p className="text-sm">{tx.category_name}</p>
                {tx.note && (
                  <p className="text-xs text-muted-foreground">{tx.note}</p>
                )}
              </div>
              <span
                className={`text-sm font-medium ${tx.type === 'income' ? 'text-green-600' : ''}`}
              >
                {tx.type === 'income' ? '+' : '-'}
                {formatRupiah(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      ))}

      {!isLoading && txs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">
          Tidak ada transaksi dalam periode ini
        </p>
      )}
    </div>
  )
}
