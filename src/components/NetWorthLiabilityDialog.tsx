import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type NetWorthLiability,
  type LiabilityType,
  useCreateNetWorthLiability,
  useUpdateNetWorthLiability,
} from '@/queries/netWorth'
import { parseRupiah, formatRupiah } from '@/lib/format'
import { toast } from 'sonner'

const LIABILITY_TYPE_LABELS: Record<LiabilityType, string> = {
  kpr: 'KPR',
  cicilan_kendaraan: 'Cicilan Kendaraan',
  kartu_kredit: 'Kartu Kredit',
  paylater: 'PayLater',
  kta: 'KTA',
}

const LIABILITY_TYPE_ORDER: LiabilityType[] = [
  'kpr',
  'cicilan_kendaraan',
  'kartu_kredit',
  'paylater',
  'kta',
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: NetWorthLiability | null
}

export default function NetWorthLiabilityDialog({ open, onOpenChange, editing }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<LiabilityType>('kartu_kredit')
  const [amountStr, setAmountStr] = useState('')

  const create = useCreateNetWorthLiability()
  const update = useUpdateNetWorthLiability()
  const saving = create.isPending || update.isPending

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setType(editing.type)
      setAmountStr(String(Math.round(editing.amount)))
    } else {
      setName('')
      setType('kartu_kredit')
      setAmountStr('')
    }
  }, [open, editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseRupiah(amountStr)
    if (!name.trim() || amount <= 0) {
      toast.error('Nama dan outstanding (> 0) wajib diisi')
      return
    }
    const payload = { name: name.trim(), type, amount }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: payload })
      else await create.mutateAsync(payload)
      onOpenChange(false)
    } catch {
      /* toast handled in mutation */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Liabilitas' : 'Tambah Liabilitas'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="liab-name" className="text-sm font-semibold">
                Nama
              </Label>
              <Input
                id="liab-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth: KPR BTN Rumah Cipete"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-semibold">Tipe</Label>
              <Select value={type} onValueChange={(v) => setType(v as LiabilityType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIABILITY_TYPE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {LIABILITY_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="liab-amount" className="text-sm font-semibold">
                Jumlah Outstanding
              </Label>
              <Input
                id="liab-amount"
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
              />
              {amountStr && (
                <p className="text-xs text-muted-foreground">
                  {formatRupiah(parseRupiah(amountStr))}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
