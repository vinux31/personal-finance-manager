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
import { type Goal, type GoalStatus } from '@/queries/goals'
import { useCreateGoal, useUpdateGoal } from '@/queries/goals'
import { parseRupiah, formatRupiah } from '@/lib/format'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Goal | null
}

export default function GoalDialog({ open, onOpenChange, editing }: Props) {
  const [name, setName] = useState('')
  const [targetStr, setTargetStr] = useState('')
  const [currentStr, setCurrentStr] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [status, setStatus] = useState<GoalStatus>('active')

  const create = useCreateGoal()
  const update = useUpdateGoal()
  const saving = create.isPending || update.isPending

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setTargetStr(String(Math.round(editing.target_amount)))
      setCurrentStr(String(Math.round(editing.current_amount)))
      setTargetDate(editing.target_date ?? '')
      setStatus(editing.status)
    } else {
      setName('')
      setTargetStr('')
      setCurrentStr('0')
      setTargetDate('')
      setStatus('active')
    }
  }, [open, editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const target = parseRupiah(targetStr)
    const current = parseRupiah(currentStr || '0')
    if (!name.trim() || target <= 0) {
      toast.error('Nama dan target (> 0) wajib diisi')
      return
    }
    if (current > target) {
      toast.error('Dana terkumpul tidak boleh melebihi target')
      return
    }
    const payload = {
      name: name.trim(),
      target_amount: target,
      current_amount: current,
      target_date: targetDate || null,
      status,
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
            <DialogTitle>{editing ? 'Edit Goal' : 'Tambah Goal'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="g-name">Nama</Label>
              <Input id="g-name" placeholder="Contoh: Dana Darurat, Beli Motor" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="g-target">Target (Rp)</Label>
              <Input id="g-target" inputMode="numeric" placeholder="0" value={targetStr} onChange={(e) => setTargetStr(e.target.value)} />
              {targetStr && <p className="text-xs text-muted-foreground">{formatRupiah(parseRupiah(targetStr))}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="g-current">Sudah Terkumpul (Rp)</Label>
              <Input id="g-current" inputMode="numeric" placeholder="0" value={currentStr} onChange={(e) => setCurrentStr(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="g-date">Target Tanggal</Label>
                <Input id="g-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as GoalStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="paused">Jeda</SelectItem>
                    <SelectItem value="completed">Tercapai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
