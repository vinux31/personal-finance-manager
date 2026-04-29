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
import { useAddMoneyToGoal, useWithdrawFromGoal } from '@/queries/goals'
import { parseRupiah, formatRupiah } from '@/lib/format'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: Goal | null
  investedValue?: number  // NEW (D-15): from goals_with_progress.total_amount - goals.current_amount
}

export default function AddMoneyDialog({ open, onOpenChange, goal, investedValue }: Props) {
  const [amountStr, setAmountStr] = useState('')
  const [mode, setMode] = useState<'tambah' | 'tarik'>('tambah')
  const addMoney = useAddMoneyToGoal()
  const withdraw = useWithdrawFromGoal()

  useEffect(() => {
    if (open) {
      setAmountStr('')
      setMode('tambah')
    }
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
      if (mode === 'tambah') {
        const result = await addMoney.mutateAsync({ id: goal.id, amount })
        if (result?.status === 'completed') toast.success('Selamat! Goal tercapai 🎉')
      } else {
        await withdraw.mutateAsync({ id: goal.id, amount })
      }
      onOpenChange(false)
    } catch {
      // error toast handled by mutation hooks
    }
  }

  if (!goal) return null

  const isPending = addMoney.isPending || withdraw.isPending
  const remaining = Math.max(0, goal.target_amount - goal.current_amount)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'tambah' ? 'Tambah Uang' : 'Tarik Dana'} — {goal.name}
            </DialogTitle>
            <DialogDescription>
              {mode === 'tambah'
                ? `Sisa yang perlu dikumpulkan: ${formatRupiah(remaining)}`
                : `Saldo kas tersedia: ${formatRupiah(goal.current_amount)}${
                    investedValue !== undefined && investedValue > 0
                      ? ` (terpisah dari investasi ${formatRupiah(investedValue)})`
                      : ''
                  }`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Mode toggle */}
            <div className="flex gap-1 rounded-lg border p-1">
              <Button
                type="button"
                variant={mode === 'tambah' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1"
                onClick={() => { setMode('tambah'); setAmountStr('') }}
              >
                Tambah Uang
              </Button>
              <Button
                type="button"
                variant={mode === 'tarik' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1"
                onClick={() => { setMode('tarik'); setAmountStr('') }}
              >
                Tarik Dana
              </Button>
            </div>

            {/* Amount input */}
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
              disabled={isPending}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Menyimpan…' : mode === 'tambah' ? 'Tambah' : 'Tarik'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
