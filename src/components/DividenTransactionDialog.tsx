import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { todayISO } from '@/lib/format'
import { useBeiStocks, useCreateDividendTransaction, type DividendHolding } from '@/queries/dividends'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultHolding?: DividendHolding
}

export default function DividenTransactionDialog({ open, onOpenChange, defaultHolding }: Props) {
  const { data: stocks = [] } = useBeiStocks()
  const create = useCreateDividendTransaction()

  const [bei_stock_id, setBeiStockId] = useState('')
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY')
  const [lots, setLots] = useState('')
  const [price_per_share, setPricePerShare] = useState('')
  const [transaction_date, setTransactionDate] = useState(todayISO())
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setBeiStockId(defaultHolding ? String(defaultHolding.bei_stock_id) : '')
      setType('BUY')
      setLots('')
      setPricePerShare('')
      setTransactionDate(todayISO())
      setNote('')
    }
  }, [open, defaultHolding])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const lotsNum = parseInt(lots, 10)
    const priceNum = parseInt(price_per_share, 10)
    if (!bei_stock_id || lotsNum <= 0 || priceNum <= 0 || !transaction_date) return

    create.mutate(
      {
        bei_stock_id: parseInt(bei_stock_id, 10),
        type,
        lots: lotsNum,
        price_per_share: priceNum,
        transaction_date,
        note: note.trim() || undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Transaksi Dividen</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Saham</Label>
            <Select value={bei_stock_id} onValueChange={setBeiStockId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih saham…" />
              </SelectTrigger>
              <SelectContent>
                {stocks.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.ticker} — {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Jenis</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'BUY' | 'SELL')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUY">BUY — Beli</SelectItem>
                <SelectItem value="SELL">SELL — Jual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Lot</Label>
              <Input
                type="number"
                min={1}
                placeholder="5"
                value={lots}
                onChange={(e) => setLots(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Harga / Saham (Rp)</Label>
              <Input
                type="number"
                min={1}
                placeholder="5000"
                value={price_per_share}
                onChange={(e) => setPricePerShare(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Tanggal Transaksi</Label>
            <Input
              type="date"
              value={transaction_date}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Catatan (opsional)</Label>
            <Input
              placeholder="Catatan transaksi…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
