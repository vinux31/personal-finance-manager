# Phase 2: Net Worth Tracker - Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 7 (5 new + 2 modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/db/netWorth.ts` | service/db | CRUD | `src/db/goals.ts` | exact |
| `src/queries/netWorth.ts` | service/query | CRUD | `src/queries/goals.ts` | exact |
| `src/tabs/KekayaanTab.tsx` | component/tab | CRUD + event-driven (auto-snapshot) | `src/tabs/GoalsTab.tsx` | role-match (GoalsTab is single-section; KekayaanTab has 3 sections + chart) |
| `src/components/NetWorthAccountDialog.tsx` | component/dialog | request-response | `src/components/GoalDialog.tsx` | exact |
| `src/components/NetWorthLiabilityDialog.tsx` | component/dialog | request-response | `src/components/GoalDialog.tsx` | exact |
| `src/tabs/FinansialTab.tsx` | component/tab (modified) | request-response | self | n/a — surgical edit |
| `src/tabs/DashboardTab.tsx` | component/tab (modified) | request-response | self | n/a — surgical edit |

---

## Pattern Assignments

### `src/db/netWorth.ts` (db layer, CRUD)

**Analog:** `src/db/goals.ts`

**Imports pattern** (goals.ts lines 1-2):
```typescript
import { supabase } from '@/lib/supabase'
// No additional imports needed for netWorth.ts — supabase client only
```

**Type/interface pattern** (goals.ts lines 4-26):
```typescript
export type GoalStatus = 'active' | 'completed' | 'paused'

export interface Goal {
  id: number
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  status: GoalStatus
}

export interface GoalInput {
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  status: GoalStatus
}
```
Adapt for netWorth.ts: two sets of types — `AccountType`, `NetWorthAccount`, `NetWorthAccountInput` and `LiabilityType`, `NetWorthLiability`, `NetWorthLiabilityInput`. Types must match DB CHECK constraints verbatim (underscores, no spaces):
- AccountType: `'tabungan' | 'giro' | 'cash' | 'deposito' | 'dompet_digital' | 'properti' | 'kendaraan'`
- LiabilityType: `'kpr' | 'cicilan_kendaraan' | 'kartu_kredit' | 'paylater' | 'kta'`

**Core CRUD pattern — list** (goals.ts lines 28-43):
```typescript
export async function listGoals(f: GoalFilters | string = {}, uid?: string): Promise<Goal[]> {
  const filters: GoalFilters = typeof f === 'string' ? {} : f
  const resolvedUid = typeof f === 'string' ? f : uid
  let query = supabase
    .from('goals')
    .select('id, name, target_amount, current_amount, target_date, status')
    .order('status')
    .order('target_date', { ascending: true, nullsFirst: false })
    .order('id', { ascending: false })
  if (resolvedUid) query = query.eq('user_id', resolvedUid)
  // ...filters applied...
  const { data, error } = await query
  if (error) throw error
  return data as Goal[]
}
```
For netWorth: `listAccounts(uid: string)` and `listLiabilities(uid: string)` — simpler than goals, uid always required, no filter object. Use `.order('created_at', { ascending: true })`.

**Core CRUD pattern — create** (goals.ts lines 55-71):
```typescript
export async function createGoal(g: GoalInput): Promise<number> {
  if (g.target_amount <= 0) throw new Error('Target harus > 0')
  const { data, error } = await supabase
    .from('goals')
    .insert({
      name: g.name,
      target_amount: g.target_amount,
      // ...other fields...
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}
```
**CRITICAL difference for netWorth:** goals.ts does NOT include `user_id` in the insert payload — but `net_worth_accounts` RLS policy is `WITH CHECK (auth.uid() = user_id)` with no auto-inject trigger. Pass `user_id: uid` explicitly in every insert for accounts, liabilities, and snapshots.

Correct pattern for netWorth:
```typescript
export async function createAccount(uid: string, input: NetWorthAccountInput): Promise<number> {
  const { data, error } = await supabase
    .from('net_worth_accounts')
    .insert({ user_id: uid, ...input })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}
```

**Core CRUD pattern — update** (goals.ts lines 73-87):
```typescript
export async function updateGoal(id: number, g: GoalInput): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ name: g.name, /* ...fields */ })
    .eq('id', id)
  if (error) throw error
}
```

**Core CRUD pattern — delete** (goals.ts line 89-91):
```typescript
export async function deleteGoal(id: number): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw error
}
```

**Snapshot upsert pattern** (no analog — new function unique to netWorth):
```typescript
export async function insertSnapshotIfNeeded(
  uid: string,
  snapshotMonth: string,       // format: 'YYYY-MM-01' — DATE column, day required
  totalAccounts: number,
  totalInvestments: number,
  totalLiabilities: number
): Promise<void> {
  const { error } = await supabase
    .from('net_worth_snapshots')
    .upsert(
      {
        user_id: uid,
        snapshot_month: snapshotMonth,
        total_accounts: totalAccounts,
        total_investments: totalInvestments,
        total_liabilities: totalLiabilities,
        // net_worth omitted — GENERATED ALWAYS AS (total_accounts + total_investments - total_liabilities) STORED
      },
      { onConflict: 'user_id,snapshot_month', ignoreDuplicates: true }
    )
  if (error) throw error
}
```

**listSnapshots pattern:**
```typescript
export async function listSnapshots(uid: string): Promise<NetWorthSnapshot[]> {
  const { data, error } = await supabase
    .from('net_worth_snapshots')
    .select('id, user_id, snapshot_month, total_accounts, total_investments, total_liabilities, net_worth, created_at')
    .eq('user_id', uid)
    .order('snapshot_month', { ascending: true })
  if (error) throw error
  return data as NetWorthSnapshot[]
}
// Note: use .select() without .single() — snapshot history is an array
```

---

### `src/queries/netWorth.ts` (query layer, CRUD)

**Analog:** `src/queries/goals.ts`

**Imports pattern** (goals.ts lines 1-20):
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  // ...other db functions...
  type Goal,
  type GoalInput,
} from '@/db/goals'
import { mapSupabaseError } from '@/lib/errors'
import { useTargetUserId } from '@/auth/useTargetUserId'

export { type Goal, type GoalInput }  // re-export types for consumers
```
Adapt: import from `@/db/netWorth`, re-export all types.

**useQuery hook pattern** (goals.ts lines 22-29):
```typescript
export function useGoals(filters: GoalFilters = {}) {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['goals', uid, filters],
    queryFn: () => listGoals(filters, uid),
    enabled: !!uid,
  })
}
```
Adapt for accounts, liabilities, snapshots — simpler (no filters):
```typescript
export function useNetWorthAccounts() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['net-worth-accounts', uid],
    queryFn: () => listAccounts(uid!),
    enabled: !!uid,
  })
}
```

**useMutation create pattern** (goals.ts lines 31-41):
```typescript
export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GoalInput) => createGoal(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Goal berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```
**Key difference:** netWorth mutations must pass `uid` to the db function. Pattern:
```typescript
export function useCreateNetWorthAccount() {
  const qc = useQueryClient()
  const uid = useTargetUserId()
  return useMutation({
    mutationFn: (input: NetWorthAccountInput) => createAccount(uid!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['net-worth-accounts'] })  // no uid — invalidates all variants
      toast.success('Akun berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

**useMutation update pattern** (goals.ts lines 43-53):
```typescript
export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: GoalInput }) => updateGoal(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Goal berhasil diubah')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

**useMutation delete pattern** (goals.ts lines 55-65):
```typescript
export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteGoal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Goal dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

**invalidateQueries scope:** Use `{ queryKey: ['net-worth-accounts'] }` without uid — this invalidates all query key variants (per TanStack Query v5 prefix matching). Same pattern confirmed in investments.ts lines 59-60.

**Hooks to implement in netWorth.ts:**
- `useNetWorthAccounts()` — useQuery
- `useCreateNetWorthAccount()` — useMutation
- `useUpdateNetWorthAccount()` — useMutation `{ id, input }`
- `useDeleteNetWorthAccount()` — useMutation `id: number`
- `useNetWorthLiabilities()` — useQuery
- `useCreateNetWorthLiability()` — useMutation
- `useUpdateNetWorthLiability()` — useMutation
- `useDeleteNetWorthLiability()` — useMutation
- `useNetWorthSnapshots()` — useQuery (read-only, no mutations)

---

### `src/tabs/KekayaanTab.tsx` (tab component, CRUD + event-driven)

**Analog:** `src/tabs/GoalsTab.tsx`

**Imports pattern** (GoalsTab.tsx lines 1-16):
```typescript
import { useState } from 'react'
import { useGoals, useDeleteGoal, type Goal, type GoalFilters, type GoalStatus } from '@/queries/goals'
import { useInvestments, currentValue } from '@/queries/investments'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Plus, Pencil, Trash2, Target } from 'lucide-react'
import { formatRupiah } from '@/lib/format'
import GoalDialog from '@/components/GoalDialog'
import { EmptyState } from '@/components/ui/empty-state'
```
Adapt for KekayaanTab: add `useEffect` import, add netWorth query hooks, add `shortRupiah`, add Recharts imports, add both dialog components. Remove filter/search imports (not needed).

**State management pattern** (GoalsTab.tsx lines 18-27):
```typescript
const [editing, setEditing] = useState<Goal | null>(null)
const [dialogOpen, setDialogOpen] = useState(false)
const [confirmOpen, setConfirmOpen] = useState(false)
const [confirmGoal, setConfirmGoal] = useState<Goal | null>(null)
```
Adapt for KekayaanTab — two independent CRUD sections:
```typescript
const [accountDialogOpen, setAccountDialogOpen] = useState(false)
const [editingAccount, setEditingAccount] = useState<NetWorthAccount | null>(null)
const [liabilityDialogOpen, setLiabilityDialogOpen] = useState(false)
const [editingLiability, setEditingLiability] = useState<NetWorthLiability | null>(null)
const [confirmOpen, setConfirmOpen] = useState(false)
const [confirmTarget, setConfirmTarget] = useState<{ type: 'account' | 'liability'; id: number; name: string } | null>(null)
```

**Loading state pattern** (GoalsTab.tsx line 107-108):
```typescript
{isLoading ? (
  <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">Memuat…</div>
) : ...}
```

**EmptyState pattern** (GoalsTab.tsx lines 109-116):
```typescript
<EmptyState
  icon={Target}
  title="Belum ada goal"
  description="Tetapkan target keuangan Anda dan pantau progresnya dari sini."
  actionLabel="+ Buat Goal Pertama"
  onAction={() => { setEditing(null); setDialogOpen(true) }}
/>
```

**Card item pattern** (GoalsTab.tsx lines 132-205) — card with left accent border, title, action buttons:
```typescript
<div key={g.id} className="rounded-xl border bg-card p-4" style={{ borderLeft: '4px solid var(--brand)' }}>
  <div className="flex items-start justify-between gap-2">
    <div>
      <div className="text-lg font-semibold">{g.name}</div>
      {/* subtitle */}
    </div>
    {/* badge */}
  </div>
  {/* body content */}
  <div className="mt-4 flex justify-end gap-1">
    <Button variant="ghost" size="icon" onClick={() => { setEditing(g); setDialogOpen(true) }}>
      <Pencil className="h-4 w-4" />
    </Button>
    <Button variant="ghost" size="icon" onClick={() => onDelete(g)}>
      <Trash2 className="h-4 w-4 text-red-600" />
    </Button>
  </div>
</div>
```

**Summary gradient card pattern** (GoalsTab.tsx lines 53-78):
```typescript
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
  </div>
</div>
```
Adapt for KekayaanTab summary card: gradient `linear-gradient(135deg, #6366f1, #818cf8)` (D-07), show 3 values (Net Worth / Aset / Liabilitas).

**ConfirmDialog pattern** (GoalsTab.tsx lines 211-217):
```typescript
<ConfirmDialog
  open={confirmOpen}
  onOpenChange={setConfirmOpen}
  title={`Hapus "${confirmGoal?.name ?? ''}"`}
  description="Goal ini akan dihapus permanen."
  onConfirm={() => { if (confirmGoal) deleteGoal.mutate(confirmGoal.id) }}
/>
```

**Auto-snapshot useEffect pattern** (new — no analog, derived from Pitfall 2 in RESEARCH.md):
```typescript
// Must wait for all 3 queries to finish loading before inserting snapshot
useEffect(() => {
  if (!uid || accountsLoading || liabilitiesLoading) return
  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
  insertSnapshotIfNeeded(uid, monthKey, totalAccounts, totalInvestments, totalLiabilities)
    .catch(console.error)
}, [uid, accountsLoading, liabilitiesLoading, totalAccounts, totalInvestments, totalLiabilities])
```

**AreaChart pattern** (SimulasiPanel.tsx lines 285-296):
```typescript
<ResponsiveContainer width="100%" height={220}>
  <AreaChart data={result.yearlyData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="tahun" tick={{ fontSize: 11 }} />
    <YAxis tickFormatter={(v) => shortRupiah(v)} tick={{ fontSize: 10 }} width={70} />
    <Tooltip formatter={(v: unknown) => formatRupiah(typeof v === 'number' ? v : 0)} />
    <Legend />
    <Area type="monotone" dataKey="emas" name="Emas" stackId="1" stroke="#d97706" fill="#fde68a" />
  </AreaChart>
</ResponsiveContainer>
```
Adapt for KekayaanTab: single area with gradient fill (linearGradient in `<defs>` — SimulasiPanel uses solid fill colors, not linearGradient; netWorth needs the gradient version from D-08):
```typescript
<ResponsiveContainer width="100%" height={220}>
  <AreaChart data={chartData}>
    <defs>
      <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
    <YAxis tickFormatter={shortRupiah} tick={{ fontSize: 12 }} width={70} />
    <Tooltip formatter={(v: unknown) => formatRupiah(typeof v === 'number' ? v : 0)} />
    <Area
      type="monotone"
      dataKey="net_worth"
      stroke="#6366f1"
      strokeWidth={2}
      fill="url(#netWorthGradient)"
    />
  </AreaChart>
</ResponsiveContainer>
```

**Chart data transform:**
```typescript
const chartData = snapshots
  .sort((a, b) => a.snapshot_month.localeCompare(b.snapshot_month))
  .slice(-6)
  .map(s => ({
    month: new Date(s.snapshot_month).toLocaleDateString('id-ID', { month: 'short' }),
    net_worth: s.net_worth,
  }))
```

**Investasi read-only row** (D-02 — no structural analog in GoalsTab, new pattern):
```typescript
// Place inside "Aset & Rekening" section, after editable account cards
const totalInvestments = investments.reduce((s, i) => s + currentValue(i), 0)

{totalInvestments > 0 && (
  <div className="rounded-xl border bg-card p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm italic text-muted-foreground">Nilai Investasi</span>
        <Badge variant="secondary">otomatis</Badge>
      </div>
      {/* No edit/delete buttons — read-only */}
    </div>
    <div className="text-[10px] text-muted-foreground mt-1">{formatRupiah(totalInvestments)}</div>
  </div>
)}
```

---

### `src/components/NetWorthAccountDialog.tsx` (dialog component, request-response)

**Analog:** `src/components/GoalDialog.tsx`

**Imports pattern** (GoalDialog.tsx lines 1-22):
```typescript
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
```
Adapt: import `NetWorthAccount`, `AccountType`, `useCreateNetWorthAccount`, `useUpdateNetWorthAccount` from `@/queries/netWorth`.

**Props interface pattern** (GoalDialog.tsx lines 24-28):
```typescript
interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Goal | null
}
```

**Controlled state + useEffect populate pattern** (GoalDialog.tsx lines 30-56):
```typescript
export default function GoalDialog({ open, onOpenChange, editing }: Props) {
  const [name, setName] = useState('')
  const [targetStr, setTargetStr] = useState('')
  // ...other fields...
  const [status, setStatus] = useState<GoalStatus>('active')

  const create = useCreateGoal()
  const update = useUpdateGoal()
  const saving = create.isPending || update.isPending

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setTargetStr(String(Math.round(editing.target_amount)))
      // ...populate other fields...
    } else {
      setName('')
      setTargetStr('')
      // ...reset to defaults...
    }
  }, [open, editing])
```
Adapt for NetWorthAccountDialog: fields = `name`, `type` (Select, default `'tabungan'`), `balanceStr` (numeric input). No `status` field — not in DB schema.

**handleSubmit pattern** (GoalDialog.tsx lines 58-87):
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  const target = parseRupiah(targetStr)
  if (!name.trim() || target <= 0) {
    toast.error('Nama dan target (> 0) wajib diisi')
    return
  }
  const payload = { name: name.trim(), /* ...fields */ }
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
```

**Dialog JSX structure** (GoalDialog.tsx lines 89-141):
```typescript
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
            <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {/* ...other fields... */}
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as GoalStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktif</SelectItem>
              </SelectContent>
            </Select>
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
```

**Type label mapping pattern** (new, needed for Select display):
```typescript
const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  tabungan: 'Tabungan',
  giro: 'Giro',
  cash: 'Cash',
  deposito: 'Deposito',
  dompet_digital: 'Dompet Digital',
  properti: 'Properti',
  kendaraan: 'Kendaraan',
}
```

**Preview-while-typing pattern** (GoalDialog.tsx lines 106-107):
```typescript
{targetStr && <p className="text-xs text-muted-foreground">{formatRupiah(parseRupiah(targetStr))}</p>}
```
Use same for `balanceStr` in NetWorthAccountDialog.

---

### `src/components/NetWorthLiabilityDialog.tsx` (dialog component, request-response)

**Analog:** `src/components/GoalDialog.tsx`

Identical structure to `NetWorthAccountDialog` above. Differences:
- Import `NetWorthLiability`, `LiabilityType`, `useCreateNetWorthLiability`, `useUpdateNetWorthLiability`
- Fields: `name`, `type` (LiabilityType, default `'kartu_kredit'`), `amountStr` (numeric, label "Outstanding (Rp)")
- DialogTitle: `editing ? 'Edit Liabilitas' : 'Tambah Liabilitas'`
- Type label mapping:
```typescript
const LIABILITY_TYPE_LABELS: Record<LiabilityType, string> = {
  kpr: 'KPR',
  cicilan_kendaraan: 'Cicilan Kendaraan',
  kartu_kredit: 'Kartu Kredit',
  paylater: 'PayLater',
  kta: 'KTA',
}
```
- Validation: `!name.trim() || amount <= 0` → `toast.error('Nama dan outstanding (> 0) wajib diisi')`

---

### `src/tabs/FinansialTab.tsx` (modified — surgical edit)

**Current state** (FinansialTab.tsx lines 1-25):
```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import GoalsTab from '@/tabs/GoalsTab'

export default function FinansialTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="kekayaan" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="kekayaan">Kekayaan</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>
        <TabsContent value="kekayaan">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-muted-foreground text-sm">
              Fitur Kekayaan (Net Worth) akan hadir di Phase 2.
            </span>
          </div>
        </TabsContent>
        <TabsContent value="goals">
          <GoalsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

**Required edit — add import + replace placeholder:**
```typescript
// Add to imports (line 2, after existing imports):
import KekayaanTab from '@/tabs/KekayaanTab'

// Replace lines 12-18 (TabsContent value="kekayaan" placeholder):
<TabsContent value="kekayaan">
  <KekayaanTab />
</TabsContent>
```
No other changes needed. Two-line surgical edit.

---

### `src/tabs/DashboardTab.tsx` (modified — add MetricCard + update grid)

**Current grid class** (DashboardTab.tsx line 78):
```typescript
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
```
**New grid class** (per NW-01 and Pitfall 5):
```typescript
<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
```

**Current 4 MetricCards** (DashboardTab.tsx lines 79-108):
```typescript
<MetricCard label="Pemasukan" ... />
<MetricCard label="Pengeluaran" ... />
<MetricCard label="Net Bulan Ini" value={shortRupiah(monthly.net)} gradient trend={null} />
<MetricCard label="Nilai Investasi" ... />
```

**MetricCard ke-5 to append after line 107:**
```typescript
<MetricCard
  label="Net Worth"
  value={shortRupiah(netWorth)}
  gradient
  trend={netWorthTrend}
/>
```

**Data needed for MetricCard ke-5** — add these queries to DashboardTab (after existing queries at lines 36-39):
```typescript
// Add these imports at top of file:
import { useNetWorthAccounts, useNetWorthLiabilities, useNetWorthSnapshots } from '@/queries/netWorth'
// useInvestments already imported (line 4)
// currentValue already imported (line 4)
// shortRupiah already imported (line 6)

// Add these hooks inside DashboardTab() after existing hooks:
const { data: nwAccounts = [] } = useNetWorthAccounts()
const { data: nwLiabilities = [] } = useNetWorthLiabilities()
const { data: nwSnapshots = [] } = useNetWorthSnapshots()

// Computed (after existing useMemo blocks):
const netWorth = useMemo(() => {
  const totalAccounts = nwAccounts.reduce((s, a) => s + a.balance, 0)
  const totalInvestments = invRows.reduce((s, i) => s + currentValue(i), 0)  // invRows already exists (line 37)
  const totalLiabilities = nwLiabilities.reduce((s, l) => s + l.amount, 0)
  return totalAccounts + totalInvestments - totalLiabilities
}, [nwAccounts, nwLiabilities, invRows])

const netWorthTrend = useMemo(() => {
  const lastTwo = nwSnapshots.slice(-2)
  if (lastTwo.length < 2) return null
  return trendPct(lastTwo[1].net_worth, lastTwo[0].net_worth)  // trendPct already defined line 54
}, [nwSnapshots])
```

**MetricCard gradient branch — CRITICAL BUG to fix** (DashboardTab.tsx lines 192-201):

Current gradient branch does NOT render `trend` (lines 192-201):
```typescript
if (gradient) {
  return (
    <div
      className="rounded-xl p-4 text-white"
      style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
    >
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">{label}</div>
      <div className="text-xl font-extrabold tracking-tight">{value}</div>
    </div>  // ← trend prop ignored here
  )
}
```
Must extend to render trend badge when `trend != null`:
```typescript
if (gradient) {
  const trendColor = trend == null ? '' : trend >= 0 ? 'bg-emerald-500/30 text-emerald-100' : 'bg-red-500/30 text-red-100'
  const trendArrow = trend == null ? '' : trend >= 0 ? '↑' : '↓'
  return (
    <div
      className="rounded-xl p-4 text-white"
      style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
    >
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">{label}</div>
      <div className="text-xl font-extrabold tracking-tight">{value}</div>
      {trend != null && (
        <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${trendColor}`}>
          {trendArrow} {Math.abs(trend)}% vs bln lalu
        </span>
      )}
    </div>
  )
}
```
Note: "Net Bulan Ini" card uses `trend={null}` so this change is backward-compatible — it renders no badge for that card.

---

## Shared Patterns

### useTargetUserId (D-11 — mandatory on all queries)
**Source:** `src/auth/useTargetUserId.ts` lines 1-8
```typescript
import { useAuthContext } from './AuthProvider'
import { useViewAsContext } from './ViewAsContext'

export function useTargetUserId(): string | undefined {
  const { user } = useAuthContext()
  const { viewingAs } = useViewAsContext()
  return viewingAs?.uid ?? user?.id
}
```
**Apply to:** All hooks in `src/queries/netWorth.ts`. Every `useQuery` must have `enabled: !!uid`. Every `useMutation` that calls a create function must pass `uid!` (non-null assertion safe because mutation can only be called when uid exists).

### Error handling (toast via mutation)
**Source:** `src/lib/errors.ts` lines 1-21 + `src/queries/goals.ts` line 39
```typescript
onError: (e) => toast.error(mapSupabaseError(e)),
```
**Apply to:** Every `useMutation` in `src/queries/netWorth.ts`. The `mapSupabaseError` function handles network errors, JWT expiry, RLS violations, and unique constraint errors.

### formatRupiah / shortRupiah / parseRupiah
**Source:** `src/lib/format.ts`
```typescript
export function formatRupiah(n: number): string { ... }    // full: Rp 10.000.000
export function shortRupiah(n: number): string { ... }     // abbreviated: 10 jt
export function parseRupiah(s: string): number { ... }     // parse IDR input string
```
**Apply to:**
- `parseRupiah` — in both dialog components for balance/amount string → number conversion
- `formatRupiah` — everywhere a full Rupiah value is displayed
- `shortRupiah` — in Dashboard MetricCard (value prop) and chart Y-axis tickFormatter

### Dialog structure (open + onOpenChange + editing)
**Source:** `src/components/GoalDialog.tsx` lines 24-28 + 30
```typescript
interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Goal | null
}
```
**Apply to:** Both `NetWorthAccountDialog` and `NetWorthLiabilityDialog`. Parent tab controls `open` state; dialog calls `onOpenChange(false)` on successful save or cancel.

### ConfirmDialog before delete
**Source:** `src/tabs/GoalsTab.tsx` lines 45-48 + 211-217
```typescript
function onDelete(g: Goal) {
  setConfirmGoal(g)
  setConfirmOpen(true)
}
// ...
<ConfirmDialog
  open={confirmOpen}
  onOpenChange={setConfirmOpen}
  title={`Hapus "${confirmGoal?.name ?? ''}"`}
  description="Goal ini akan dihapus permanen."
  onConfirm={() => { if (confirmGoal) deleteGoal.mutate(confirmGoal.id) }}
/>
```
**Apply to:** Both account delete and liability delete in `KekayaanTab`. Use single `confirmTarget` state with `type: 'account' | 'liability'` to route the confirm action.

### Loading state (inline text "Memuat…")
**Source:** `src/tabs/GoalsTab.tsx` line 108
```typescript
<div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">Memuat…</div>
```
**Apply to:** Both account section and liability section loading states in `KekayaanTab`. This is the dominant pattern in GoalsTab (no skeletons).

---

## No Analog Found

All files have analogs in the codebase. The following sub-patterns are new (no existing analog) but are derived from established primitives:

| Sub-Pattern | Where Used | Derivation |
|---|---|---|
| `insertSnapshotIfNeeded` db function | `src/db/netWorth.ts` | Supabase upsert + UNIQUE constraint from migration 0012 |
| Auto-snapshot `useEffect` | `src/tabs/KekayaanTab.tsx` | Derived from RESEARCH.md Pitfall 2 guard pattern |
| `linearGradient` in Recharts `<defs>` | `src/tabs/KekayaanTab.tsx` | SimulasiPanel uses solid fills; gradient variant is Recharts standard API |
| MetricCard gradient trend badge | `src/tabs/DashboardTab.tsx` | Extends existing `MetricCard` non-gradient branch trend rendering |
| `confirmTarget` with type discriminant | `src/tabs/KekayaanTab.tsx` | GoalsTab uses single `confirmGoal`; KekayaanTab needs account vs liability routing |

---

## Metadata

**Analog search scope:** `src/db/`, `src/queries/`, `src/tabs/`, `src/components/`, `src/auth/`, `src/lib/`, `supabase/migrations/`
**Files scanned:** 12
**Pattern extraction date:** 2026-04-24
