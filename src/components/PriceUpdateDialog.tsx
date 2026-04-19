import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type Investment } from '@/queries/investments'
import { useUpdatePrice, usePriceHistory } from '@/queries/investments'
import { todayISO, parseRupiah, formatRupiah, formatDateID } from '@/lib/format'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  investment: Investment | null
}

export default function PriceUpdateDialog({ open, onOpenChange, investment }: Props) {
  const [priceStr, setPriceStr] = useState('')
  const [date, setDate] = useState(todayISO())

  const { data: history = [] } = usePriceHistory(investment?.id ?? 0)
  const updatePrice = useUpdatePrice()

  useEffect(() => {
    if (!open || !investment) return
    setPriceStr(investment.current_price != null ? String(investment.current_price) : '')
    setDate(todayISO())
  }, [open, investment])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!investment) return
    const price = parseRupiah(priceStr)
    if (price <= 0) {
      toast.error('Harga harus > 0')
      return
    }
    try {
      await updatePrice.mutateAsync({ id: investment.id, price, date })
      onOpenChange(false)
    } catch {
      // error toast handled by mutation hook
    }
  }

  if (!investment) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Update Harga — {investment.asset_name}</DialogTitle>
            <DialogDescription>Masukkan harga terkini untuk menghitung gain/loss.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="pu-price">Harga / unit (Rp)</Label>
                <Input id="pu-price" inputMode="numeric" placeholder="0" value={priceStr} onChange={(e) => setPriceStr(e.target.value)} autoFocus />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pu-date">Tanggal</Label>
                <Input id="pu-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            {history.length > 0 && (
              <div>
                <Label className="text-xs">Riwayat harga (terbaru di atas)</Label>
                <div className="mt-2 max-h-48 overflow-auto rounded border">
                  <table className="w-full text-sm">
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id} className="border-b last:border-0">
                          <td className="px-3 py-1.5 text-muted-foreground">{formatDateID(h.date)}</td>
                          <td className="px-3 py-1.5 text-right">{formatRupiah(h.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={updatePrice.isPending}>Batal</Button>
            <Button type="submit" disabled={updatePrice.isPending}>{updatePrice.isPending ? 'Menyimpan…' : 'Simpan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
