import { useEffect, useState } from 'react'
import {
  listGoals,
  deleteGoal,
  goalProgress,
  type Goal,
} from '@/db/goals'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Plus, Pencil, Trash2, PiggyBank } from 'lucide-react'
import { formatRupiah, formatDateID } from '@/lib/format'
import GoalDialog from '@/components/GoalDialog'
import AddMoneyDialog from '@/components/AddMoneyDialog'
import { toast } from 'sonner'

export default function GoalsTab() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [editing, setEditing] = useState<Goal | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addMoneyFor, setAddMoneyFor] = useState<Goal | null>(null)
  const [addMoneyOpen, setAddMoneyOpen] = useState(false)

  function refresh() {
    setGoals(listGoals())
  }

  useEffect(() => refresh(), [])

  async function onDelete(g: Goal) {
    if (!confirm(`Hapus goal "${g.name}"?`)) return
    await deleteGoal(g.id)
    toast.success('Goal dihapus')
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          Tambah Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          Belum ada goal. Tetapkan target tabungan pertama Anda.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const pct = goalProgress(g)
            const remaining = Math.max(0, g.target_amount - g.current_amount)
            return (
              <div key={g.id} className="rounded-lg border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-semibold">{g.name}</div>
                    {g.target_date && (
                      <div className="text-xs text-muted-foreground">
                        Target: {formatDateID(g.target_date)}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={g.status} />
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">
                      {formatRupiah(g.current_amount)}
                    </span>
                    <span className="text-muted-foreground">
                      dari {formatRupiah(g.target_amount)}
                    </span>
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
                </div>

                <div className="mt-4 flex justify-end gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAddMoneyFor(g)
                      setAddMoneyOpen(true)
                    }}
                    disabled={g.status === 'completed'}
                  >
                    <PiggyBank className="h-4 w-4" />
                    Tambah Uang
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(g)
                      setDialogOpen(true)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void onDelete(g)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <GoalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={refresh}
        editing={editing}
      />
      <AddMoneyDialog
        open={addMoneyOpen}
        onOpenChange={setAddMoneyOpen}
        onSaved={refresh}
        goal={addMoneyFor}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: Goal['status'] }) {
  if (status === 'completed')
    return <Badge className="bg-emerald-600">Tercapai</Badge>
  if (status === 'paused') return <Badge variant="secondary">Jeda</Badge>
  return <Badge>Aktif</Badge>
}
