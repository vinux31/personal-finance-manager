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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type Investment } from '@/queries/investments'
import { useCreateInvestment, useUpdateInvestment, useAssetTypes } from '@/queries/investments'
import { todayISO, parseRupiah, formatRupiah } from '@/lib/format'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Investment | null
}

const CUSTOM = '__custom__'

export default function InvestmentDialog({ open, onOpenChange, editing }: Props) {
  const [assetTypeSel, setAssetTypeSel] = useState('Saham')
  const [customType, setCustomType] = useState('')
  const [assetName, setAssetName] = useState('')
  const [qtyStr, setQtyStr] = useState('')
  const [buyPriceStr, setBuyPriceStr] = useState('')
  const [currentPriceStr, setCurrentPriceStr] = useState('')
  const [buyDate, setBuyDate] = useState(todayISO())
  const [note, setNote] = useState('')

  const { data: assetTypes = [] } = useAssetTypes()
  const create = useCreateInvestment()
  const update = useUpdateInvestment()
  const saving = create.isPending || update.isPending

  useEffect(() => {
    if (!open) return
    if (editing) {
      setAssetTypeSel(editing.asset_type)
      setCustomType('')
      setAssetName(editing.asset_name)
      setQtyStr(String(editing.quantity))
      setBuyPriceStr(String(editing.buy_price))
      setCurrentPriceStr(editing.current_price != null ? String(editing.current_price) : '')
      setBuyDate(editing.buy_date)
      setNote(editing.note ?? '')
    } else {
      setAssetTypeSel('Saham')
      setCustomType('')
      setAssetName('')
      setQtyStr('')
      setBuyPriceStr('')
      setCurrentPriceStr('')
      setBuyDate(todayISO())
      setNote('')
    }
  }, [open, editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const finalType = assetTypeSel === CUSTOM ? customType.trim() : assetTypeSel
    const qty = Number(qtyStr)
    const buyPrice = parseRupiah(buyPriceStr)
    const currentPrice = currentPriceStr.trim() === '' ? null : parseRupiah(currentPriceStr)
    if (!finalType || !assetName.trim() || !buyDate || qty <= 0 || buyPrice <= 0) {
      toast.error('Lengkapi jenis, nama, tanggal, kuantitas (> 0), harga beli (> 0)')
      return
    }
    const payload = {
      asset_type: finalType,
      asset_name: assetName.trim(),
      quantity: qty,
      buy_price: buyPrice,
      current_price: currentPrice,
      buy_date: buyDate,
      note: note.trim() || null,
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input: payload })
      } else {
        await create.mutateAsync(payload)
      }
      onOpenChange(false)
    } catch {
      // error toast handled by mutation hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Investasi' : 'Tambah Investasi'}</DialogTitle>
            <DialogDescription>Catat aset yang Anda miliki.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Jenis Aset</Label>
              <Select value={assetTypeSel} onValueChange={setAssetTypeSel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {assetTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  <SelectItem value={CUSTOM}>+ Jenis lain…</SelectItem>
                </SelectContent>
              </Select>
              {assetTypeSel === CUSTOM && (
                <Input placeholder="Nama jenis aset baru" value={customType} onChange={(e) => setCustomType(e.target.value)} />
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="inv-name">Nama Aset</Label>
              <Input id="inv-name" placeholder="Contoh: BBCA, Reksadana ABC" value={assetName} onChange={(e) => setAssetName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="inv-qty">Kuantitas</Label>
                <Input id="inv-qty" inputMode="decimal" placeholder="0" value={qtyStr} onChange={(e) => setQtyStr(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inv-date">Tanggal Beli</Label>
                <Input id="inv-date" type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="inv-buy">Harga Beli / unit (Rp)</Label>
              <Input id="inv-buy" inputMode="numeric" placeholder="0" value={buyPriceStr} onChange={(e) => setBuyPriceStr(e.target.value)} />
              {buyPriceStr && (
                <p className="text-xs text-muted-foreground">
                  Total modal: {formatRupiah((Number(qtyStr) || 0) * parseRupiah(buyPriceStr))}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="inv-curr">Harga Saat Ini / unit (Rp, opsional)</Label>
              <Input id="inv-curr" inputMode="numeric" placeholder="Kosongkan jika belum tahu" value={currentPriceStr} onChange={(e) => setCurrentPriceStr(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="inv-note">Catatan (opsional)</Label>
              <Textarea id="inv-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
