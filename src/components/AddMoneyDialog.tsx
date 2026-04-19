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
import { type Goal } from '@/queries/goals'
import { useAddMoneyToGoal } from '@/queries/goals'
import { parseRupiah, formatRupiah } from '@/lib/format'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: Goal | null
}

export default function AddMoneyDialog({ open, onOpenChange, goal }: Props) {
  const [amountStr, setAmountStr] = useState('')
  const addMoney = useAddMoneyToGoal()

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
    try {
      await addMoney.mutateAsync({ id: goal.id, amount })
      const remaining = goal.target_amount - (goal.current_amount + amount)
      if (remaining <= 0) toast.success('Selamat! Goal tercapai 🎉')
      onOpenChange(false)
    } catch {
      // error toast handled by mutation hook
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
            <DialogDescription>Sisa yang perlu dikumpulkan: {formatRupiah(remaining)}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="am-amount">Jumlah (Rp)</Label>
              <Input id="am-amount" inputMode="numeric" placeholder="0" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} autoFocus />
              {amountStr && <p className="text-xs text-muted-foreground">{formatRupiah(parseRupiah(amountStr))}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={addMoney.isPending}>Batal</Button>
            <Button type="submit" disabled={addMoney.isPending}>{addMoney.isPending ? 'Menyimpan…' : 'Tambah'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
