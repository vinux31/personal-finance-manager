import { useState } from 'react'
import { useGoalsWithProgress, useDeleteGoal, type GoalWithProgress, type Goal, type GoalFilters, type GoalStatus } from '@/queries/goals'
import { useInvestments, currentValue } from '@/queries/investments'
import { useGoalInvestments } from '@/queries/goalInvestments'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Plus, Pencil, Trash2, PiggyBank, Link2, Target } from 'lucide-react'
import { formatRupiah, formatDateID } from '@/lib/format'
import GoalDialog from '@/components/GoalDialog'
import { EmptyState } from '@/components/ui/empty-state'
import AddMoneyDialog from '@/components/AddMoneyDialog'
import LinkInvestmentDialog from '@/components/LinkInvestmentDialog'

export default function GoalsTab() {
  const [editing, setEditing] = useState<Goal | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addMoneyFor, setAddMoneyFor] = useState<GoalWithProgress | null>(null)
  const [addMoneyOpen, setAddMoneyOpen] = useState(false)
  const [linkFor, setLinkFor] = useState<Goal | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [filters, setFilters] = useState<GoalFilters>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmGoal, setConfirmGoal] = useState<Goal | null>(null)

  const { data: goals = [], isLoading } = useGoalsWithProgress(filters)
  const { data: investments = [] } = useInvestments()
  const { data: allAllocs = [] } = useGoalInvestments()
  const deleteGoal = useDeleteGoal()

  const activeGoals = goals.filter((g) => g.status === 'active')
  const totalCollected = activeGoals.reduce((sum, g) => sum + g.total_amount, 0)
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.target_amount, 0)
  const totalPct = totalTarget > 0 ? Math.min(100, (totalCollected / totalTarget) * 100) : 0

  // investedValue from VIEW: total_amount - current_amount
  const investedValue = addMoneyFor
    ? Math.max(0, addMoneyFor.total_amount - addMoneyFor.current_amount)
    : undefined

  function onDelete(g: Goal) {
    setConfirmGoal(g)
    setConfirmOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Summary bar — hanya tampil jika ada goal aktif */}
      {activeGoals.length > 0 && (
        <div
          className="rounded-xl p-4 text-white"
          style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }}
        >
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
            Ringkasan Goals Aktif
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-extrabold tracking-tight">{formatRupiah(totalCollected)}</div>
              <div className="text-xs text-indigo-300">dari {formatRupiah(totalTarget)} target total</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-indigo-200">{totalPct.toFixed(0)}%</div>
              <div className="text-xs text-indigo-300">{activeGoals.length} goals aktif</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/10">
            <div
              className="h-1.5 rounded-full bg-indigo-400 transition-all"
              style={{ width: `${totalPct}%` }}
            />
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Cari nama goal…"
            value={filters.search ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
            className="h-8 w-48"
          />
          <Select
            value={filters.status ?? '__all__'}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v === '__all__' ? undefined : (v as GoalStatus) }))}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue placeholder="Semua status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Semua status</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="completed">Tercapai</SelectItem>
              <SelectItem value="paused">Jeda</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" />Tambah Goal
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">Memuat…</div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Belum ada goal"
          description="Tetapkan target keuangan Anda dan pantau progresnya dari sini."
          actionLabel="+ Buat Goal Pertama"
          onAction={() => { setEditing(null); setDialogOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const linkedAllocs = allAllocs.filter((a) => a.goal_id === g.id)
            // Use total_amount from VIEW for progress bar (CONS-01)
            const totalCurrent = g.total_amount
            const pct = g.target_amount > 0
              ? Math.min(100, (totalCurrent / g.target_amount) * 100)
              : 0
            const remaining = Math.max(0, g.target_amount - totalCurrent)
            // investedAmount for display breakdown (from VIEW)
            const investedAmount = Math.max(0, g.total_amount - g.current_amount)

            return (
              <div key={g.id} className="rounded-xl border bg-card p-4" style={{ borderLeft: '4px solid var(--brand)' }}>
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
                  <Progress value={pct} className="[&>[data-slot=progress-indicator]]:bg-[var(--brand)]" />
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

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Hapus "${confirmGoal?.name ?? ''}"`}
        description="Goal ini akan dihapus permanen."
        onConfirm={() => { if (confirmGoal) deleteGoal.mutate(confirmGoal.id) }}
      />
      <GoalDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <AddMoneyDialog
        open={addMoneyOpen}
        onOpenChange={setAddMoneyOpen}
        goal={addMoneyFor}
        investedValue={investedValue}
      />
      <LinkInvestmentDialog open={linkOpen} onOpenChange={setLinkOpen} goal={linkFor} />
    </div>
  )
}

function StatusBadge({ status }: { status: Goal['status'] }) {
  if (status === 'completed') return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">Tercapai</span>
  if (status === 'paused') return <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-600">Jeda</span>
  return <span className="rounded-full bg-[var(--brand-light)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--brand)]">Aktif</span>
}
