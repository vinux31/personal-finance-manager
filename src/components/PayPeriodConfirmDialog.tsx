import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { useCreatePayPeriod } from '../queries/payPeriods'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionDate: string   // 'YYYY-MM-DD' — tanggal transaksi gaji (bukan hari ini)
  suggestedLabel: string    // e.g. "Gaji Februari 2026"
}

export function PayPeriodConfirmDialog({
  open,
  onOpenChange,
  transactionDate,
  suggestedLabel,
}: Props) {
  const [label, setLabel] = useState(suggestedLabel)
  const createPeriod = useCreatePayPeriod()

  // Sync label tiap kali suggestedLabel berubah (dialog dibuka untuk gaji berbeda)
  useEffect(() => {
    setLabel(suggestedLabel)
  }, [suggestedLabel])

  async function handleConfirm() {
    if (!label.trim()) return
    try {
      await createPeriod.mutateAsync({ label: label.trim(), start_date: transactionDate })
      toast.success(`Periode "${label.trim()}" dimulai`)
      onOpenChange(false)
    } catch (err: any) {
      toast.error('Gagal membuat periode: ' + (err?.message ?? 'Unknown error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mulai Periode Gaji Baru?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Gaji terdeteksi pada{' '}
            <strong>
              {transactionDate
                ? new Date(transactionDate + 'T00:00:00').toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : ''}
            </strong>
            . Beri nama periode ini:
          </p>
          <div className="space-y-1">
            <Label htmlFor="period-label">Label Periode</Label>
            <Input
              id="period-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Gaji Februari 2026"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!label.trim() || createPeriod.isPending}
          >
            {createPeriod.isPending ? 'Menyimpan...' : 'Ya, Mulai Periode'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
