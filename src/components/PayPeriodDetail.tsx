import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { PayPeriod } from '@/db/payPeriods'
import {
  usePayPeriodTransactions,
  usePayPeriodTransactionCount,
  useDeletePayPeriod,
} from '@/queries/payPeriods'
import { formatRupiah } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { PayPeriodFormDialog } from '@/components/PayPeriodFormDialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

interface Props {
  period: PayPeriod
  endDate: string | null
  isOldest: boolean
  onBack: () => void
}

export function PayPeriodDetail({ period, endDate, isOldest, onBack }: Props) {
  const { data: txs = [], isLoading } = usePayPeriodTransactions(period, endDate)
  const [showRename, setShowRename] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const txCountQuery = usePayPeriodTransactionCount(
    showDelete ? period.start_date : null,
    endDate,
  )
  const deleteMut = useDeletePayPeriod()

  async function handleDelete() {
    try {
      await deleteMut.mutateAsync(period.id)
      toast.success('Periode dihapus')
      setShowDelete(false)
      onBack()
    } catch (err: any) {
      toast.error('Gagal hapus: ' + (err?.message ?? 'Unknown error'))
    }
  }

  const grouped = txs.reduce<Record<string, typeof txs>>((acc, tx) => {
    if (!acc[tx.date]) acc[tx.date] = []
    acc[tx.date].push(tx)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Kembali
          </Button>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRename(true)}
              aria-label="Rename periode"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDelete(true)}
              aria-label="Hapus periode"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
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

      <PayPeriodFormDialog
        mode="rename"
        open={showRename}
        onOpenChange={setShowRename}
        periodId={period.id}
        initialLabel={period.label}
      />

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus periode &quot;{period.label}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const n = txCountQuery.data
                if (txCountQuery.isLoading) {
                  return 'Menghitung jumlah transaksi yang terdampak...'
                }
                if (txCountQuery.isError || n === undefined) {
                  return 'Transaksi tidak akan terhapus, tapi keanggotaan periode-nya akan berubah.'
                }
                if (isOldest) {
                  return `${n} transaksi tidak akan terhapus, tapi tidak akan masuk ke periode mana pun (masih bisa dilihat di halaman Transaksi).`
                }
                return `${n} transaksi tidak akan terhapus, akan melebur ke periode sebelumnya.`
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMut.isPending}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {deleteMut.isPending ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
