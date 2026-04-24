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
  type NetWorthAccount,
  type AccountType,
  useCreateNetWorthAccount,
  useUpdateNetWorthAccount,
} from '@/queries/netWorth'
import { parseRupiah, formatRupiah } from '@/lib/format'
import { toast } from 'sonner'

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  tabungan: 'Tabungan',
  giro: 'Giro',
  cash: 'Cash',
  deposito: 'Deposito',
  dompet_digital: 'Dompet Digital',
  properti: 'Properti',
  kendaraan: 'Kendaraan',
}

const ACCOUNT_TYPE_ORDER: AccountType[] = [
  'tabungan',
  'giro',
  'cash',
  'deposito',
  'dompet_digital',
  'properti',
  'kendaraan',
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: NetWorthAccount | null
}

export default function NetWorthAccountDialog({ open, onOpenChange, editing }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('tabungan')
  const [balanceStr, setBalanceStr] = useState('')

  const create = useCreateNetWorthAccount()
  const update = useUpdateNetWorthAccount()
  const saving = create.isPending || update.isPending

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setType(editing.type)
      setBalanceStr(String(Math.round(editing.balance)))
    } else {
      setName('')
      setType('tabungan')
      setBalanceStr('')
    }
  }, [open, editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const balance = parseRupiah(balanceStr)
    if (!name.trim() || balance <= 0) {
      toast.error('Nama dan saldo (> 0) wajib diisi')
      return
    }
    const payload = { name: name.trim(), type, balance }
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
            <DialogTitle>{editing ? 'Edit Akun' : 'Tambah Akun'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="acc-name" className="text-sm font-semibold">
                Nama Akun
              </Label>
              <Input
                id="acc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth: BCA Tabungan Utama"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-semibold">Tipe</Label>
              <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACCOUNT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc-balance" className="text-sm font-semibold">
                Saldo / Nilai
              </Label>
              <Input
                id="acc-balance"
                type="text"
                inputMode="numeric"
                value={balanceStr}
                onChange={(e) => setBalanceStr(e.target.value)}
              />
              {balanceStr && (
                <p className="text-xs text-muted-foreground">
                  {formatRupiah(parseRupiah(balanceStr))}
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
