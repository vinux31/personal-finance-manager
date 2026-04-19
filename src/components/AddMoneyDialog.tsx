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
import { addMoneyToGoal, type Goal } from '@/db/goals'
import { parseRupiah, formatRupiah } from '@/lib/format'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  goal: Goal | null
}

export default function AddMoneyDialog({
  open,
  onOpenChange,
  onSaved,
  goal,
}: Props) {
  const [amountStr, setAmountStr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setAmountStr('')
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!goal) return
    const amount = parseRupiah(amountStr)
    if (amount <= 0) {
      toast.error('Jumlah harus > 0')
      return
    }
    setSaving(true)
    try {
      await addMoneyToGoal(goal.id, amount)
      const remaining = goal.target_amount - (goal.current_amount + amount)
      if (remaining <= 0) toast.success('Selamat! Goal tercapai 🎉')
      else toast.success('Uang ditambahkan')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err))
    } finally {
      setSaving(false)
    }
  }

  if (!goal) return null
  const remaining = Math.max(0, goal.target_amount - goal.current_amount)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Tambah Uang — {goal.name}</DialogTitle>
            <DialogDescription>
              Sisa yang perlu dikumpulkan: {formatRupiah(remaining)}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="am-amount">Jumlah (Rp)</Label>
              <Input
                id="am-amount"
                inputMode="numeric"
                placeholder="0"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                autoFocus
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
              {saving ? 'Menyimpan…' : 'Tambah'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
