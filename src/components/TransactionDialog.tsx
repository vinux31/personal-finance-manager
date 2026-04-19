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
import {
  createTransaction,
  updateTransaction,
  type Transaction,
} from '@/db/transactions'
import { listCategories, type Category } from '@/db/categories'
import { todayISO, parseRupiah, formatRupiah } from '@/lib/format'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editing?: Transaction | null
}

export default function TransactionDialog({
  open,
  onOpenChange,
  onSaved,
  editing,
}: Props) {
  const [date, setDate] = useState(todayISO())
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [categoryId, setCategoryId] = useState<string>('')
  const [amountStr, setAmountStr] = useState('')
  const [note, setNote] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCategories(listCategories(type))
  }, [open, type])

  useEffect(() => {
    if (!open) return
    if (editing) {
      setDate(editing.date)
      setType(editing.type)
      setCategoryId(String(editing.category_id))
      setAmountStr(String(editing.amount))
      setNote(editing.note ?? '')
    } else {
      setDate(todayISO())
      setType('expense')
      setCategoryId('')
      setAmountStr('')
      setNote('')
    }
  }, [open, editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseRupiah(amountStr)
    if (!date || !categoryId || amount <= 0) {
      toast.error('Lengkapi tanggal, kategori, dan jumlah (> 0)')
      return
    }
    setSaving(true)
    try {
      const payload = {
        date,
        type,
        category_id: Number(categoryId),
        amount,
        note: note.trim() || null,
      }
      if (editing) {
        await updateTransaction(editing.id, payload)
        toast.success('Transaksi diperbarui')
      } else {
        await createTransaction(payload)
        toast.success('Transaksi ditambahkan')
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Transaksi' : 'Tambah Transaksi'}
            </DialogTitle>
            <DialogDescription>
              Catat pemasukan atau pengeluaran.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tx-type">Jenis</Label>
              <Select
                value={type}
                onValueChange={(v) => {
                  setType(v as 'income' | 'expense')
                  setCategoryId('')
                }}
              >
                <SelectTrigger id="tx-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Pengeluaran</SelectItem>
                  <SelectItem value="income">Pemasukan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tx-date">Tanggal</Label>
              <Input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tx-cat">Kategori</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="tx-cat">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tx-amount">Jumlah (Rp)</Label>
              <Input
                id="tx-amount"
                inputMode="numeric"
                placeholder="0"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
              />
              {amountStr && (
                <p className="text-xs text-muted-foreground">
                  {formatRupiah(parseRupiah(amountStr))}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tx-note">Catatan (opsional)</Label>
              <Textarea
                id="tx-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
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
