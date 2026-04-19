# Gap 5 — Goals Tarik Dana Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah fitur tarik dana dari goal dengan auto-reset status completed → active, dan extend AddMoneyDialog dengan dua mode (Tambah / Tarik).

**Architecture:** Tambah `withdrawFromGoal()` di `db/goals.ts` (targeted update 2 field, no migration), hook `useWithdrawFromGoal()` di `queries/goals.ts`, lalu extend `AddMoneyDialog` dengan state `mode` dan toggle UI. GoalsTab hapus `disabled` untuk goal completed.

**Tech Stack:** React 19, TypeScript, TanStack React Query 5, Supabase JS SDK, Sonner (toast), Tailwind CSS, Shadcn/ui

---

## File Map

| File | Aksi | Tanggung Jawab |
|------|------|----------------|
| `src/db/goals.ts` | Modify | Tambah `withdrawFromGoal()` — logic + validasi |
| `src/queries/goals.ts` | Modify | Tambah `useWithdrawFromGoal()` — React Query mutation |
| `src/components/AddMoneyDialog.tsx` | Modify | Extend dengan mode state + toggle UI + handler tarik |
| `src/tabs/GoalsTab.tsx` | Modify | Hapus `disabled={g.status === 'completed'}` |

---

## Task 1: Tambah `withdrawFromGoal()` di `src/db/goals.ts`

**Files:**
- Modify: `src/db/goals.ts`

Fungsi ini melakukan targeted update hanya pada `current_amount` dan `status`. Tidak menggunakan `updateGoal()` karena itu replace semua field.

- [ ] **Step 1.1: Buka `src/db/goals.ts`, tambah fungsi di bagian bawah file (sebelum `RENCANA_GOALS`)**

Tambahkan fungsi berikut setelah `goalProgress()` dan sebelum `const RENCANA_GOALS`:

```ts
export async function withdrawFromGoal(
  id: number,
  amount: number,
  goal: Goal
): Promise<void> {
  if (amount <= 0) throw new Error('Jumlah harus > 0')
  const newAmount = goal.current_amount - amount
  if (newAmount < 0) throw new Error('Dana tidak cukup')
  const newStatus: GoalStatus =
    goal.status === 'completed' && newAmount < goal.target_amount
      ? 'active'
      : goal.status
  const { error } = await supabase
    .from('goals')
    .update({ current_amount: newAmount, status: newStatus })
    .eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 1.2: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```

Expected: tidak ada output (tidak ada error).

- [ ] **Step 1.3: Commit**

```bash
git add src/db/goals.ts
git commit -m "feat(db): tambah withdrawFromGoal — tarik dana dengan auto-reset status"
```

---

## Task 2: Tambah `useWithdrawFromGoal()` di `src/queries/goals.ts`

**Files:**
- Modify: `src/queries/goals.ts`

- [ ] **Step 2.1: Tambah import `withdrawFromGoal` di bagian import `src/queries/goals.ts`**

Cari baris import dari `@/db/goals`:
```ts
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  addMoneyToGoal,
  goalProgress,
  type Goal,
  type GoalInput,
  type GoalStatus,
} from '@/db/goals'
```

Tambahkan `withdrawFromGoal` ke dalam import:
```ts
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  addMoneyToGoal,
  withdrawFromGoal,
  goalProgress,
  type Goal,
  type GoalInput,
  type GoalStatus,
} from '@/db/goals'
```

- [ ] **Step 2.2: Tambah hook `useWithdrawFromGoal()` di bagian bawah file**

Tambahkan setelah `useAddMoneyToGoal()`:

```ts
export function useWithdrawFromGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount, goal }: { id: number; amount: number; goal: Goal }) =>
      withdrawFromGoal(id, amount, goal),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Dana berhasil ditarik')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

- [ ] **Step 2.3: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```

Expected: tidak ada output.

- [ ] **Step 2.4: Commit**

```bash
git add src/queries/goals.ts
git commit -m "feat(queries): tambah useWithdrawFromGoal mutation hook"
```

---

## Task 3: Extend `src/components/AddMoneyDialog.tsx` dengan mode Tambah / Tarik

**Files:**
- Modify: `src/components/AddMoneyDialog.tsx`

- [ ] **Step 3.1: Ganti seluruh isi `src/components/AddMoneyDialog.tsx`**

```tsx
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
}

export default function AddMoneyDialog({ open, onOpenChange, goal }: Props) {
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
        await withdraw.mutateAsync({ id: goal.id, amount, goal })
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
                : `Saldo kas tersedia: ${formatRupiah(goal.current_amount)}`}
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
```

- [ ] **Step 3.2: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```

Expected: tidak ada output.

- [ ] **Step 3.3: Verifikasi visual di browser**

Jalankan dev server jika belum:
```bash
npm run dev
```

Buka `http://localhost:5173` → tab Goals. Klik tombol **Tambah Uang** di salah satu goal. Pastikan:
- Dialog muncul dengan dua tombol toggle: "Tambah Uang" dan "Tarik Dana"
- Mode default adalah "Tambah Uang"
- Deskripsi menampilkan "Sisa yang perlu dikumpulkan: Rp X"
- Switch ke "Tarik Dana" → deskripsi berubah ke "Saldo kas tersedia: Rp X"
- Input ter-reset saat ganti mode
- Judul dialog ikut berubah sesuai mode

- [ ] **Step 3.4: Commit**

```bash
git add src/components/AddMoneyDialog.tsx
git commit -m "feat(AddMoneyDialog): tambah mode Tarik Dana dengan toggle Tambah/Tarik"
```

---

## Task 4: Update `src/tabs/GoalsTab.tsx` — hapus disabled untuk completed

**Files:**
- Modify: `src/tabs/GoalsTab.tsx`

- [ ] **Step 4.1: Cari dan hapus `disabled` di tombol Tambah Uang**

Cari baris (sekitar baris 121-126):
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => { setAddMoneyFor(g); setAddMoneyOpen(true) }}
  disabled={g.status === 'completed'}
>
  <PiggyBank className="h-4 w-4" />Tambah Uang
</Button>
```

Ganti dengan (hapus baris `disabled`):
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => { setAddMoneyFor(g); setAddMoneyOpen(true) }}
>
  <PiggyBank className="h-4 w-4" />Tambah Uang
</Button>
```

- [ ] **Step 4.2: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```

Expected: tidak ada output.

- [ ] **Step 4.3: Verifikasi visual + test fungsional di browser**

Buka `http://localhost:5173` → tab Goals. Pastikan:

**Test A — Tambah uang normal:**
- Klik "Tambah Uang" pada goal aktif → input jumlah → klik Tambah
- Progress bar naik sesuai jumlah yang ditambahkan
- Toast "Dana berhasil ditambahkan" muncul

**Test B — Tarik dana:**
- Klik "Tambah Uang" pada goal yang punya `current_amount > 0`
- Switch ke tab "Tarik Dana"
- Input jumlah ≤ saldo kas → klik Tarik
- Progress bar turun, toast "Dana berhasil ditarik" muncul

**Test C — Tarik dari goal completed:**
- Pastikan ada goal completed (atau buat goal dengan current = target)
- Tombol "Tambah Uang" pada goal completed sekarang tidak disabled
- Klik → switch ke "Tarik Dana" → tarik sebagian
- Status goal berubah dari "Tercapai" → "Aktif"

**Test D — Validasi tarik berlebih:**
- Switch ke "Tarik Dana"
- Input jumlah > saldo kas
- Toast error "Dana tidak cukup" muncul, dialog tetap terbuka

- [ ] **Step 4.4: Commit**

```bash
git add src/tabs/GoalsTab.tsx
git commit -m "feat(GoalsTab): enable tombol Tambah Uang untuk goal completed"
```

---

## Self-Review Checklist

### Spec Coverage

| Requirement dari Spec | Task |
|-----------------------|------|
| `withdrawFromGoal()` di db/goals.ts | Task 1 |
| Validasi `amount > 0` | Task 1 |
| Validasi `newAmount >= 0` | Task 1 |
| Auto-reset status completed → active | Task 1 |
| Status paused tetap paused | Task 1 |
| `useWithdrawFromGoal()` di queries/goals.ts | Task 2 |
| Import `withdrawFromGoal` di queries | Task 2 |
| State `mode` di AddMoneyDialog | Task 3 |
| Reset mode + amountStr saat dialog buka | Task 3 |
| Toggle UI Tambah / Tarik | Task 3 |
| Input reset saat ganti mode | Task 3 |
| Deskripsi kontekstual per mode | Task 3 |
| Saldo tarik = `goal.current_amount` (bukan totalCurrent) | Task 3 |
| Judul dialog dinamis | Task 3 |
| Label tombol submit dinamis | Task 3 |
| `isPending = addMoney.isPending \|\| withdraw.isPending` | Task 3 |
| Hapus `disabled` untuk goal completed | Task 4 |

Semua requirement tercakup. ✅

### Type Consistency

- `withdrawFromGoal(id: number, amount: number, goal: Goal)` — Task 1 ✅
- `useWithdrawFromGoal()` mutationFn params: `{ id, amount, goal }` — Task 2 ✅
- `withdraw.mutateAsync({ id: goal.id, amount, goal })` — Task 3 ✅
- `Goal` type diimpor dari `@/queries/goals` di AddMoneyDialog ✅
