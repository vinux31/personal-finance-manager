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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type RecurringTemplate } from '@/queries/recurringTransactions'
import { useCreateRecurringTemplate, useUpdateRecurringTemplate } from '@/queries/recurringTransactions'
import { useCategories } from '@/queries/categories'
import { todayISO, parseRupiah, formatRupiah, categoryLabel } from '@/lib/format'
import { type Frequency } from '@/db/recurringTransactions'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: RecurringTemplate | null
}

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  yearly: 'Tahunan',
}

export default function RecurringDialog({ open, onOpenChange, editing }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [categoryId, setCategoryId] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [note, setNote] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [nextDueDate, setNextDueDate] = useState(todayISO())

  const { data: categories = [] } = useCategories(type)
  const create = useCreateRecurringTemplate()
  const update = useUpdateRecurringTemplate()
  const saving = create.isPending || update.isPending

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setType(editing.type)
      setCategoryId(String(editing.category_id))
      setAmountStr(String(editing.amount))
      setNote(editing.note ?? '')
      setFrequency(editing.frequency)
      setNextDueDate(editing.next_due_date)
    } else {
      setName('')
      setType('expense')
      setCategoryId('')
      setAmountStr('')
      setNote('')
      setFrequency('monthly')
      setNextDueDate(todayISO())
    }
  }, [open, editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Nama wajib diisi'); return }
    if (!categoryId) { toast.error('Pilih kategori'); return }
    const amount = parseRupiah(amountStr)
    if (amount <= 0) { toast.error('Jumlah harus lebih dari 0'); return }
    if (!nextDueDate) { toast.error('Tanggal mulai wajib diisi'); return }

    const payload = {
      name: name.trim(),
      type,
      category_id: Number(categoryId),
      amount,
      note: note.trim() || null,
      frequency,
      next_due_date: nextDueDate,
      is_active: editing?.is_active ?? true,
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
            <DialogTitle>{editing ? 'Edit Template Rutin' : 'Tambah Template Rutin'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rec-name">Nama</Label>
              <Input id="rec-name" placeholder="misal: Gaji Bulanan" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rec-type">Jenis</Label>
              <Select value={type} onValueChange={(v) => { setType(v as 'income' | 'expense'); setCategoryId('') }}>
                <SelectTrigger id="rec-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Pengeluaran</SelectItem>
                  <SelectItem value="income">Pemasukan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rec-cat">Kategori</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="rec-cat"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{categoryLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rec-amount">Jumlah (Rp)</Label>
              <Input id="rec-amount" inputMode="numeric" placeholder="0" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
              {amountStr && <p className="text-xs text-muted-foreground">{formatRupiah(parseRupiah(amountStr))}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rec-freq">Frekuensi</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                <SelectTrigger id="rec-freq"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(FREQUENCY_LABELS) as [Frequency, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rec-date">Jatuh Tempo Pertama</Label>
              <Input id="rec-date" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rec-note">Catatan (opsional)</Label>
              <Textarea id="rec-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
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
