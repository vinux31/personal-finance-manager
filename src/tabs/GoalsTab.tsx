import { useState } from 'react'
import { useGoals, useDeleteGoal, type Goal } from '@/queries/goals'
import { useInvestments, currentValue } from '@/queries/investments'
import { useGoalInvestments } from '@/queries/goalInvestments'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Plus, Pencil, Trash2, PiggyBank, Link2 } from 'lucide-react'
import { formatRupiah, formatDateID } from '@/lib/format'
import GoalDialog from '@/components/GoalDialog'
import AddMoneyDialog from '@/components/AddMoneyDialog'
import LinkInvestmentDialog from '@/components/LinkInvestmentDialog'

export default function GoalsTab() {
  const [editing, setEditing] = useState<Goal | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addMoneyFor, setAddMoneyFor] = useState<Goal | null>(null)
  const [addMoneyOpen, setAddMoneyOpen] = useState(false)
  const [linkFor, setLinkFor] = useState<Goal | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)

  const { data: goals = [], isLoading } = useGoals()
  const { data: investments = [] } = useInvestments()
  const { data: allAllocs = [] } = useGoalInvestments()
  const deleteGoal = useDeleteGoal()

  function onDelete(g: Goal) {
    if (!confirm(`Hapus goal "${g.name}"?`)) return
    deleteGoal.mutate(g.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" />Tambah Goal
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">Memuat…</div>
      ) : goals.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          Belum ada goal. Tetapkan target tabungan pertama Anda.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const linkedAllocs = allAllocs.filter((a) => a.goal_id === g.id)
            const investedAmount = linkedAllocs.reduce((sum, a) => {
              const inv = investments.find((i) => i.id === a.investment_id)
              return sum + (inv ? currentValue(inv) * a.allocation_pct / 100 : 0)
            }, 0)
            const totalCurrent = g.current_amount + investedAmount
            const pct = g.target_amount > 0
              ? Math.min(100, (totalCurrent / g.target_amount) * 100)
              : 0
            const remaining = Math.max(0, g.target_amount - totalCurrent)

            return (
              <div key={g.id} className="rounded-lg border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-semibold">{g.name}</div>
                    {g.target_date && (
                      <div className="text-xs text-muted-foreground">Target: {formatDateID(g.target_date)}</div>
                    )}
                  </div>
                  <StatusBadge status={g.status} />
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{formatRupiah(totalCurrent)}</span>
                    <span className="text-muted-foreground">dari {formatRupiah(g.target_amount)}</span>
                  </div>
                  <Progress value={pct} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{pct.toFixed(1)}%</span>
                    {remaining > 0 ? (
                      <span>Sisa {formatRupiah(remaining)}</span>
                    ) : (
                      <span className="font-medium text-emerald-600">Tercapai 🎉</span>
                    )}
                  </div>
                  {investedAmount > 0 && (
                    <div className="text-xs text-muted-foreground pt-1">
                      {g.current_amount > 0 && <span>{formatRupiah(g.current_amount)} tunai</span>}
                      {g.current_amount > 0 && <span> + </span>}
                      <span>{formatRupiah(investedAmount)} investasi</span>
                    </div>
                  )}
                </div>

                {linkedAllocs.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {linkedAllocs.map((a) => {
                      const inv = investments.find((i) => i.id === a.investment_id)
                      if (!inv) return null
                      return (
                        <div key={a.id} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 text-xs">
                          <span className="font-medium">{inv.asset_name}</span>
                          <span className="text-muted-foreground">
                            {a.allocation_pct}% · {formatRupiah(currentValue(inv) * a.allocation_pct / 100)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="mt-4 flex justify-end gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setLinkFor(g); setLinkOpen(true) }}
                  >
                    <Link2 className="h-4 w-4" />Investasi
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setAddMoneyFor(g); setAddMoneyOpen(true) }}
                  >
                    <PiggyBank className="h-4 w-4" />Tambah Uang
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(g); setDialogOpen(true) }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(g)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <GoalDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <AddMoneyDialog open={addMoneyOpen} onOpenChange={setAddMoneyOpen} goal={addMoneyFor} />
      <LinkInvestmentDialog open={linkOpen} onOpenChange={setLinkOpen} goal={linkFor} />
    </div>
  )
}

function StatusBadge({ status }: { status: Goal['status'] }) {
  if (status === 'completed') return <Badge className="bg-emerald-600">Tercapai</Badge>
  if (status === 'paused') return <Badge variant="secondary">Jeda</Badge>
  return <Badge>Aktif</Badge>
}
