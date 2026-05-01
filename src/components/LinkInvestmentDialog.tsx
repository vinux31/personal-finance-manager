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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type Goal } from '@/queries/goals'
import { useInvestments, currentValue } from '@/queries/investments'
import { useGoalInvestments, useUpsertGoalInvestment, useDeleteGoalInvestment } from '@/queries/goalInvestments'
import { formatRupiah } from '@/lib/format'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: Goal | null
}

export default function LinkInvestmentDialog({ open, onOpenChange, goal }: Props) {
  const [selectedInvId, setSelectedInvId] = useState<string>('')
  const [pctStr, setPctStr] = useState<string>('')

  const { data: investments = [] } = useInvestments()
  const { data: allAllocs = [] } = useGoalInvestments()
  const upsert = useUpsertGoalInvestment()
  const remove = useDeleteGoalInvestment()

  const selectedInv = investments.find((i) => i.id === Number(selectedInvId))

  const existingLink = goal && selectedInvId
    ? allAllocs.find((a) => a.goal_id === goal.id && a.investment_id === Number(selectedInvId))
    : null

  const usedElsewhere = goal && selectedInvId
    ? allAllocs
        .filter((a) => a.investment_id === Number(selectedInvId) && a.goal_id !== goal.id)
        .reduce((sum, a) => sum + a.allocation_pct, 0)
    : 0
  const remainingPct = 100 - usedElsewhere

  useEffect(() => {
    if (!open) return
    if (existingLink) {
      setPctStr(String(existingLink.allocation_pct))
    } else {
      setPctStr('')
    }
  }, [open, selectedInvId, existingLink])

  useEffect(() => {
    if (open) {
      setSelectedInvId('')
      setPctStr('')
    }
  }, [open])

  const pct = Number(pctStr)
  const previewAmount = selectedInv && pct > 0 ? currentValue(selectedInv) * pct / 100 : null

  async function handleSave() {
    if (!goal || !selectedInvId) {
      toast.error('Pilih investasi terlebih dahulu')
      return
    }
    if (!(pct > 0) || pct > 100) {
      toast.error('Alokasi harus antara 1–100%')
      return
    }
    if (pct > remainingPct + (existingLink?.allocation_pct ?? 0)) {
      toast.error(`Alokasi melebihi sisa — tersedia ${(remainingPct + (existingLink?.allocation_pct ?? 0)).toFixed(2)}%`)
      return
    }
    try {
      await upsert.mutateAsync({ goalId: goal.id, investmentId: Number(selectedInvId), allocationPct: pct })
      onOpenChange(false)
    } catch {
      // error toast handled by mutation
    }
  }

  async function handleDelete() {
    if (!goal || !selectedInvId) return
    try {
      await remove.mutateAsync({ goalId: goal.id, investmentId: Number(selectedInvId) })
      onOpenChange(false)
    } catch {
      // error toast handled by mutation
    }
  }

  if (!goal) return null

  const isBusy = upsert.isPending || remove.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hubungkan Investasi — {goal.name}</DialogTitle>
          <DialogDescription>Hubungkan investasi ke goal ini dengan menentukan persentase alokasi.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Pilih Investasi</Label>
            <Select value={selectedInvId} onValueChange={setSelectedInvId}>
              <SelectTrigger><SelectValue placeholder="Pilih investasi…" /></SelectTrigger>
              <SelectContent>
                {investments.map((inv) => (
                  <SelectItem key={inv.id} value={String(inv.id)}>
                    {inv.asset_name} ({inv.asset_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedInv && (
              <p className="text-xs text-muted-foreground">
                Nilai saat ini: {formatRupiah(currentValue(selectedInv))}
              </p>
            )}
          </div>

          {selectedInvId && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="li-pct">Alokasi (%)</Label>
                <Input
                  id="li-pct"
                  inputMode="decimal"
                  placeholder="Contoh: 60"
                  value={pctStr}
                  onChange={(e) => setPctStr(e.target.value)}
                />
                {previewAmount != null && (
                  <p className="text-xs text-muted-foreground">
                    = {formatRupiah(previewAmount)} dialokasikan ke goal ini
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Sisa alokasi investasi ini ke goal lain:{' '}
                <span className={remainingPct < pct ? 'text-red-600 font-medium' : 'font-medium'}>
                  {remainingPct.toFixed(2)}%
                </span>
              </p>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {existingLink && (
            <Button variant="destructive" onClick={handleDelete} disabled={isBusy}>
              Hapus Link
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={isBusy || !selectedInvId}>
            {isBusy ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
