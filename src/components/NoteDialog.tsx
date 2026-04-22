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
import { type Note } from '@/queries/notes'
import { useCreateNote, useUpdateNote } from '@/queries/notes'
import { useTransactions } from '@/queries/transactions'
import { todayISO, formatDateID, formatRupiah } from '@/lib/format'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Note | null
}

export default function NoteDialog({ open, onOpenChange, editing }: Props) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [date, setDate] = useState(todayISO())
  const [linkedTransactionId, setLinkedTransactionId] = useState<number | null>(null)

  const create = useCreateNote()
  const update = useUpdateNote()
  const saving = create.isPending || update.isPending
  const { data: transactions = [] } = useTransactions({})

  useEffect(() => {
    if (!open) return
    if (editing) {
      setTitle(editing.title)
      setContent(editing.content)
      setDate(editing.date)
      setLinkedTransactionId(editing.linked_transaction_id ?? null)
    } else {
      setTitle('')
      setContent('')
      setDate(todayISO())
      setLinkedTransactionId(null)
    }
  }, [open, editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      toast.error('Judul dan isi wajib diisi')
      return
    }
    const payload = {
      title: title.trim(),
      content: content.trim(),
      date,
      linked_transaction_id: linkedTransactionId,
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
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Catatan' : 'Tambah Catatan'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="n-title">Judul</Label>
              <Input id="n-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="n-date">Tanggal</Label>
              <Input id="n-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="n-linked" className="text-xs">Transaksi Terkait (opsional)</Label>
              <Select
                value={linkedTransactionId?.toString() ?? ''}
                onValueChange={(v) => setLinkedTransactionId(v ? Number(v) : null)}
              >
                <SelectTrigger id="n-linked">
                  <SelectValue placeholder="Pilih transaksi (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tidak ada</SelectItem>
                  {transactions.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {formatDateID(t.date)} · {t.category_name} · {formatRupiah(t.amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="n-content">Isi</Label>
              <Textarea id="n-content" rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
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
