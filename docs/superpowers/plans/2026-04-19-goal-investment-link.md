# Goal–Investment Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hubungkan investasi ke goal finansial sehingga nilai investasi (real-time) otomatis terhitung sebagai bagian dari progress goal, di samping uang tunai manual.

**Architecture:** Tabel join `goal_investments` menyimpan `allocation_pct` per pasangan (goal, investment). GoalsTab fetch semua alokasi sekaligus, lalu hitung `investedAmount` per goal di frontend menggunakan `currentValue()` yang sudah ada. Progress bar menampilkan total `current_amount + investedAmount`.

**Tech Stack:** React 18, TypeScript, TanStack Query v5, Supabase (PostgreSQL + RLS), shadcn/ui, Sonner (toast)

---

## File Map

| File | Aksi | Tanggung Jawab |
|------|------|----------------|
| `supabase/migrations/0005_goal_investments.sql` | Baru | DDL tabel + RLS |
| `src/db/goalInvestments.ts` | Baru | CRUD Supabase untuk `goal_investments` |
| `src/queries/goalInvestments.ts` | Baru | TanStack Query hooks |
| `src/components/LinkInvestmentDialog.tsx` | Baru | Dialog pilih investasi + alokasi persen |
| `src/tabs/GoalsTab.tsx` | Ubah | Tambah query, kalkulasi invested, UI baru |

---

## Task 1: Supabase Migration

**Files:**
- Create: `supabase/migrations/0005_goal_investments.sql`

- [ ] **Step 1: Buat file migrasi**

```sql
-- supabase/migrations/0005_goal_investments.sql

CREATE TABLE goal_investments (
  id             BIGSERIAL PRIMARY KEY,
  goal_id        BIGINT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  investment_id  BIGINT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  allocation_pct NUMERIC(5,2) NOT NULL CHECK (allocation_pct > 0 AND allocation_pct <= 100),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(goal_id, investment_id)
);

ALTER TABLE goal_investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_all_goal_investments
  ON goal_investments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Push migrasi ke Supabase**

```bash
npx supabase db push
```

Expected: `Applying migration 0005_goal_investments.sql... done`

Jika ada error "already exists", cek apakah tabel sudah ada di Supabase dashboard.

- [ ] **Step 3: Verifikasi di Supabase dashboard**

Buka Table Editor → pastikan tabel `goal_investments` muncul dengan kolom: `id, goal_id, investment_id, allocation_pct, created_at`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_goal_investments.sql
git commit -m "feat(migration): add goal_investments table with RLS"
```

---

## Task 2: DB Layer

**Files:**
- Create: `src/db/goalInvestments.ts`

- [ ] **Step 1: Buat file `src/db/goalInvestments.ts`**

```ts
import { supabase } from '@/lib/supabase'

export interface GoalInvestment {
  id: number
  goal_id: number
  investment_id: number
  allocation_pct: number
}

export async function listGoalInvestments(): Promise<GoalInvestment[]> {
  const { data, error } = await supabase
    .from('goal_investments')
    .select('id, goal_id, investment_id, allocation_pct')
    .order('id')
  if (error) throw error
  return data as GoalInvestment[]
}

export async function upsertGoalInvestment(
  goalId: number,
  investmentId: number,
  allocationPct: number
): Promise<void> {
  const { error } = await supabase
    .from('goal_investments')
    .upsert(
      { goal_id: goalId, investment_id: investmentId, allocation_pct: allocationPct },
      { onConflict: 'goal_id,investment_id' }
    )
  if (error) throw error
}

export async function deleteGoalInvestment(
  goalId: number,
  investmentId: number
): Promise<void> {
  const { error } = await supabase
    .from('goal_investments')
    .delete()
    .eq('goal_id', goalId)
    .eq('investment_id', investmentId)
  if (error) throw error
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/goalInvestments.ts
git commit -m "feat(db): add goalInvestments CRUD"
```

---

## Task 3: Queries Layer

**Files:**
- Create: `src/queries/goalInvestments.ts`

- [ ] **Step 1: Buat file `src/queries/goalInvestments.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listGoalInvestments,
  upsertGoalInvestment,
  deleteGoalInvestment,
  type GoalInvestment,
} from '@/db/goalInvestments'
import { mapSupabaseError } from '@/lib/errors'

export { type GoalInvestment }

export function useGoalInvestments() {
  return useQuery({
    queryKey: ['goal-investments'],
    queryFn: listGoalInvestments,
  })
}

export function useUpsertGoalInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      goalId,
      investmentId,
      allocationPct,
    }: {
      goalId: number
      investmentId: number
      allocationPct: number
    }) => upsertGoalInvestment(goalId, investmentId, allocationPct),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal-investments'] })
      toast.success('Alokasi berhasil disimpan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useDeleteGoalInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      goalId,
      investmentId,
    }: {
      goalId: number
      investmentId: number
    }) => deleteGoalInvestment(goalId, investmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal-investments'] })
      toast.success('Link investasi dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/queries/goalInvestments.ts
git commit -m "feat(queries): add goalInvestments TanStack Query hooks"
```

---

## Task 4: LinkInvestmentDialog

**Files:**
- Create: `src/components/LinkInvestmentDialog.tsx`

- [ ] **Step 1: Buat file `src/components/LinkInvestmentDialog.tsx`**

```tsx
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

  // Existing link for this goal + selected investment
  const existingLink = goal && selectedInvId
    ? allAllocs.find((a) => a.goal_id === goal.id && a.investment_id === Number(selectedInvId))
    : null

  // Remaining allocation: 100 - total already allocated to OTHER goals
  const usedElsewhere = goal && selectedInvId
    ? allAllocs
        .filter((a) => a.investment_id === Number(selectedInvId) && a.goal_id !== goal.id)
        .reduce((sum, a) => sum + a.allocation_pct, 0)
    : 0
  const remainingPct = 100 - usedElsewhere

  // Pre-fill when switching investments
  useEffect(() => {
    if (!open) return
    if (existingLink) {
      setPctStr(String(existingLink.allocation_pct))
    } else {
      setPctStr('')
    }
  }, [open, selectedInvId, existingLink])

  // Reset on open
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
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/LinkInvestmentDialog.tsx
git commit -m "feat(component): add LinkInvestmentDialog"
```

---

## Task 5: Update GoalsTab

**Files:**
- Modify: `src/tabs/GoalsTab.tsx`

- [ ] **Step 1: Ganti seluruh isi `src/tabs/GoalsTab.tsx`**

```tsx
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
                  {(g.current_amount > 0 || investedAmount > 0) && investedAmount > 0 && (
                    <div className="text-xs text-muted-foreground pt-1">
                      {g.current_amount > 0 && <span>{formatRupiah(g.current_amount)} tunai</span>}
                      {g.current_amount > 0 && investedAmount > 0 && <span> + </span>}
                      {investedAmount > 0 && <span>{formatRupiah(investedAmount)} investasi</span>}
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
                    disabled={g.status === 'completed'}
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
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Test manual di browser**

```bash
npm run dev
```

Checklist:
- [ ] Kartu goal tampil normal (progress bar, angka, status badge)
- [ ] Tombol "Investasi" muncul di setiap kartu goal
- [ ] Klik "Investasi" → dialog terbuka dengan dropdown investasi
- [ ] Pilih investasi → tampil nilai saat ini + info sisa alokasi
- [ ] Input persen → preview Rp muncul real-time
- [ ] Simpan → toast sukses, dialog tutup, kartu goal langsung update (progress bar naik)
- [ ] Investasi ter-link tampil di kartu goal (nama, %, nilai Rp)
- [ ] Pilih investasi yang sudah ter-link → persen ter-pre-fill, tombol "Hapus Link" muncul
- [ ] Hapus Link → toast sukses, investasi hilang dari kartu goal
- [ ] Update harga investasi (via tab Investasi) → progress goal otomatis berubah

- [ ] **Step 4: Commit**

```bash
git add src/tabs/GoalsTab.tsx
git commit -m "feat(ui): connect goals to investments with allocation tracking"
```

---

## Task 6: Push ke Remote

- [ ] **Step 1: Push semua commit**

```bash
git push
```

Expected: semua commit naik ke GitHub, Vercel deploy otomatis.
