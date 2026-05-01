# Phase 9: QA Bug Fix — Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 7 (1 migration baru + 6 frontend)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/0025_fix_goal_bugs.sql` | migration | CRUD + event-driven | `0024_add_money_to_goal_v2.sql` + `0021_goal_investments_total_check.sql` | exact (kedua fungsi yg di-fix sudah ada di sini) |
| `src/tabs/FinansialTab.tsx` | tab/layout | request-response | `src/tabs/ReportsTab.tsx` (Radix Tabs parent pattern) | role-match |
| `src/auth/AuthProvider.tsx` | provider | event-driven | dirinya sendiri (modify existing) | exact |
| `src/components/AddMoneyDialog.tsx` | component/dialog | request-response | dirinya sendiri (modify existing) | exact |
| `src/components/GoalDialog.tsx` | component/dialog | CRUD | `src/components/TransactionDialog.tsx` | role-match (DialogDescription pattern) |
| `src/components/LinkInvestmentDialog.tsx` | component/dialog | CRUD | `src/components/TransactionDialog.tsx` | role-match (DialogDescription pattern) |
| `src/tabs/ReportsTab.tsx` | tab | request-response | dirinya sendiri (1-char text fix) | exact |

---

## Pattern Assignments

### `supabase/migrations/0025_fix_goal_bugs.sql` (migration, CRUD)

**Analog 1:** `supabase/migrations/0021_goal_investments_total_check.sql`
**Analog 2:** `supabase/migrations/0024_add_money_to_goal_v2.sql` (Section 2 + Section 4)

#### Bug #1 — Broken trigger: `FOR UPDATE` + aggregate (Critical)

**Current broken code** (`0021_goal_investments_total_check.sql` lines 44-48):
```sql
SELECT COALESCE(SUM(allocation_pct), 0) INTO v_total
FROM goal_investments
WHERE investment_id = NEW.investment_id
  AND id IS DISTINCT FROM NEW.id
FOR UPDATE;
```

**Fix pattern** — pisahkan lock ke subquery, aggregate di outer query (D-02):
```sql
SELECT COALESCE(SUM(sub.allocation_pct), 0) INTO v_total
FROM (
  SELECT allocation_pct
  FROM goal_investments
  WHERE investment_id = NEW.investment_id
    AND id IS DISTINCT FROM NEW.id
  FOR UPDATE
) sub;
```

**Migration header pattern** (copy dari 0024 preamble):
```sql
-- ============================================================
-- 0025_fix_goal_bugs: Fix Critical #1 (trigger FOR UPDATE+aggregate)
--                     + Critical #2 (add_money_to_goal ambiguous column)
-- (Phase 9 QA Bug Fix, D-01..D-06)
-- ============================================================
```

**CREATE OR REPLACE pattern** (idempotent, dari 0021 line 29):
```sql
CREATE OR REPLACE FUNCTION enforce_goal_investment_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  -- ... body ...
END;
$$;
```

**Trigger re-attach pattern** (idempotent, dari 0021 lines 63-66):
```sql
DROP TRIGGER IF EXISTS goal_investments_total_check ON goal_investments;
CREATE TRIGGER goal_investments_total_check
  BEFORE INSERT OR UPDATE ON goal_investments
  FOR EACH ROW EXECUTE FUNCTION enforce_goal_investment_total();
```

#### Bug #2 — Ambiguous column di `add_money_to_goal` (Critical)

**Current broken code** (`0024_add_money_to_goal_v2.sql` lines 54-58):
```sql
SELECT id, current_amount, target_amount, status
INTO v_goal
FROM goals
WHERE id = p_id AND user_id = v_uid
FOR UPDATE;
```

**Fixed pattern** — mirror dari `withdraw_from_goal` Section 4 (`0024_add_money_to_goal_v2.sql` lines 147-151):
```sql
SELECT g.id, g.current_amount, g.target_amount, g.status
INTO v_goal
FROM goals g
WHERE g.id = p_id AND g.user_id = v_uid
FOR UPDATE;
```

**DROP + CREATE OR REPLACE pattern** (Phase 5 discipline, dari 0024 lines 21 + 28-35):
```sql
DROP FUNCTION IF EXISTS public.add_money_to_goal(BIGINT, NUMERIC);

CREATE OR REPLACE FUNCTION add_money_to_goal(
  p_id     BIGINT,
  p_amount NUMERIC
)
RETURNS TABLE (current_amount NUMERIC, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
```

**GRANT pattern** (dari 0024 line 91):
```sql
GRANT EXECUTE ON FUNCTION add_money_to_goal(BIGINT, NUMERIC) TO authenticated;
```

---

### `src/tabs/FinansialTab.tsx` (tab, request-response)

**Analog:** dirinya sendiri — 1 prop change

**Current code** (lines 1-22, full file):
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import GoalsTab from '@/tabs/GoalsTab'
import KekayaanTab from '@/tabs/KekayaanTab'

export default function FinansialTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="kekayaan" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="kekayaan">Kekayaan</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>
        <TabsContent value="kekayaan">
          <KekayaanTab />
        </TabsContent>
        <TabsContent value="goals">
          <GoalsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

**Exact line to change** (line 16):
```tsx
// Before:
<TabsContent value="goals">

// After (D-08):
<TabsContent value="goals" forceMount>
```

**Constraint:** TabsContent "kekayaan" (line 13) TIDAK diberi `forceMount` — biarkan unmount (D-09).

---

### `src/auth/AuthProvider.tsx` (provider, event-driven)

**Analog:** dirinya sendiri — tambah error handler di existing `onAuthStateChange` + `getSession`

**Current `useEffect` block** (lines 34-53) — titik inject error handler:
```tsx
useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    setSession(data.session)
    if (data.session?.user) {
      upsertProfile(data.session.user.id, data.session.user.user_metadata)
    }
    setLoading(false)
  })

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session)
    if (session?.user) {
      upsertProfile(session.user.id, session.user.user_metadata)
    } else {
      setIsAdmin(false)
    }
  })

  return () => subscription.unsubscribe()
}, [])
```

**Toast import pattern** (dari seluruh app — contoh AddMoneyDialog line 16):
```tsx
import { toast } from 'sonner'
```

**AuthApiError import pattern** (perlu ditambah ke existing import):
```tsx
import { type Session, type User, AuthApiError } from '@supabase/supabase-js'
```

**Error handler pattern** (D-10, D-11, D-12) — inject ke `.getSession().then(...)` + `onAuthStateChange`:
```tsx
// Inject ke getSession block (replace .then dengan async wrapper):
supabase.auth.getSession().then(({ data, error }) => {
  if (error instanceof AuthApiError) {
    console.error('[AuthProvider] getSession error:', error)
    toast.error('Sesi berakhir, silakan login kembali')
    supabase.auth.signOut()
    setLoading(false)
    return
  }
  setSession(data.session)
  if (data.session?.user) {
    upsertProfile(data.session.user.id, data.session.user.user_metadata)
  }
  setLoading(false)
})
```

**onAuthStateChange event pattern** — tambah TOKEN_REFRESHED_FAILED guard:
```tsx
const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && !session) {
    // refresh token expired or not found
    console.error('[AuthProvider] Token refresh failed')
    toast.error('Sesi berakhir, silakan login kembali')
    supabase.auth.signOut()
    return
  }
  setSession(session)
  if (session?.user) {
    upsertProfile(session.user.id, session.user.user_metadata)
  } else {
    setIsAdmin(false)
  }
})
```

---

### `src/components/AddMoneyDialog.tsx` (component/dialog, request-response)

**Analog:** dirinya sendiri — 1 baris kalkulasi change

**Current broken line** (line 62):
```tsx
const remaining = Math.max(0, goal.target_amount - goal.current_amount)
```

**Fixed line** (D-13):
```tsx
const remaining = Math.max(0, goal.target_amount - goal.current_amount - (investedValue ?? 0))
```

**Context:** `investedValue` sudah ada sebagai prop (line 22-23):
```tsx
interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: Goal | null
  investedValue?: number  // NEW (D-15): from goals_with_progress.total_amount - goals.current_amount
}
```

**Tidak ada perubahan lain** — DialogDescription sudah ada di file ini (lines 4-6 + 72-80).

---

### `src/components/GoalDialog.tsx` (component/dialog, CRUD)

**Analog:** `src/components/TransactionDialog.tsx` (DialogDescription pattern)

#### Perubahan 1 — Tambah `DialogDescription` import (Bug #7)

**Current import block** (lines 1-8) — `DialogDescription` TIDAK ada:
```tsx
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
```

**Pattern dari TransactionDialog** (lines 1-9) — `DialogDescription` ada:
```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
```

#### Perubahan 2 — Inject `<DialogDescription>` di JSX (Bug #7)

**Current JSX** (lines 92-95) — tidak ada DialogDescription:
```tsx
<DialogHeader>
  <DialogTitle>{editing ? 'Edit Goal' : 'Tambah Goal'}</DialogTitle>
</DialogHeader>
```

**Pattern dari TransactionDialog** (lines 96-99) — DialogDescription setelah DialogTitle:
```tsx
<DialogHeader>
  <DialogTitle>{editing ? 'Edit Transaksi' : 'Tambah Transaksi'}</DialogTitle>
  <DialogDescription>Catat pemasukan atau pengeluaran.</DialogDescription>
</DialogHeader>
```

**Apply ke GoalDialog** (D-18):
```tsx
<DialogHeader>
  <DialogTitle>{editing ? 'Edit Goal' : 'Tambah Goal'}</DialogTitle>
  <DialogDescription>Buat atau edit goal keuangan Anda.</DialogDescription>
</DialogHeader>
```

#### Perubahan 3 — Label "Dana Kas Terkumpul" + helper text (Bug #6)

**Current label + input block** (lines 109-112):
```tsx
<div className="grid gap-2">
  <Label htmlFor="g-current">Sudah Terkumpul (Rp)</Label>
  <Input id="g-current" inputMode="numeric" placeholder="0" value={currentStr} onChange={(e) => setCurrentStr(e.target.value)} />
</div>
```

**Fixed block** (D-15, D-16):
```tsx
<div className="grid gap-2">
  <Label htmlFor="g-current">Dana Kas Terkumpul (Rp)</Label>
  <Input id="g-current" inputMode="numeric" placeholder="0" value={currentStr} onChange={(e) => setCurrentStr(e.target.value)} />
  <p className="text-xs text-muted-foreground">Investasi terhubung dihitung otomatis dari portofolio</p>
</div>
```

**Helper text className pattern** — konsisten dengan existing helper texts di GoalDialog line 106 + AddMoneyDialog line 118:
```tsx
className="text-xs text-muted-foreground"
```

---

### `src/components/LinkInvestmentDialog.tsx` (component/dialog, CRUD)

**Analog:** `src/components/TransactionDialog.tsx` (DialogDescription pattern)

#### Perubahan 1 — Tambah `DialogDescription` import (Bug #7)

**Current import block** (lines 1-8) — `DialogDescription` TIDAK ada:
```tsx
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
```

**Fixed** — tambahkan `DialogDescription` (sama seperti GoalDialog fix):
```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
```

#### Perubahan 2 — Inject `<DialogDescription>` di JSX (Bug #7)

**Current JSX** (lines 110-112) — tidak ada DialogDescription:
```tsx
<DialogHeader>
  <DialogTitle>Hubungkan Investasi — {goal.name}</DialogTitle>
</DialogHeader>
```

**Fixed** (D-19):
```tsx
<DialogHeader>
  <DialogTitle>Hubungkan Investasi — {goal.name}</DialogTitle>
  <DialogDescription>Hubungkan investasi ke goal ini dengan menentukan persentase alokasi.</DialogDescription>
</DialogHeader>
```

---

### `src/tabs/ReportsTab.tsx` (tab, request-response)

**Analog:** dirinya sendiri — 1-char text change

**Current button text** (line 168):
```tsx
Export PDF
```

**Fixed** (D-21):
```tsx
Ekspor PDF
```

**Full button block context** (lines 160-170):
```tsx
<div className="ml-auto">
  <Button
    variant="outline"
    size="sm"
    disabled={exporting}
    onClick={handleExport}
  >
    <Download className="mr-2 h-4 w-4" />
    Export PDF
  </Button>
</div>
```

---

## Shared Patterns

### `CREATE OR REPLACE FUNCTION` (idempotent migration)
**Source:** `supabase/migrations/0021_goal_investments_total_check.sql` line 29, `0024_add_money_to_goal_v2.sql` line 28
**Apply to:** Kedua fungsi DB di 0025 migration
```sql
CREATE OR REPLACE FUNCTION <name>(...)
RETURNS ...
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
```

### `DROP FUNCTION IF EXISTS` sebelum CREATE (Phase 5 discipline)
**Source:** `supabase/migrations/0024_add_money_to_goal_v2.sql` lines 21, 119
**Apply to:** `add_money_to_goal` di 0025 (wajib karena RETURNS TABLE name clash adalah bug-nya)
```sql
DROP FUNCTION IF EXISTS public.add_money_to_goal(BIGINT, NUMERIC);
```
**Catatan:** Untuk `enforce_goal_investment_total()` RETURNS TRIGGER — signature tidak berubah, jadi DROP FUNCTION tidak wajib; cukup `CREATE OR REPLACE` + `DROP TRIGGER IF EXISTS` sebelum `CREATE TRIGGER`.

### `DialogDescription` import + placement
**Source:** `src/components/TransactionDialog.tsx` lines 1-9, 97-98
**Apply to:** `GoalDialog.tsx`, `LinkInvestmentDialog.tsx`
```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,   // tambahkan baris ini
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
```
```tsx
// Placement: tepat setelah <DialogTitle>, di dalam <DialogHeader>
<DialogHeader>
  <DialogTitle>...</DialogTitle>
  <DialogDescription>...</DialogDescription>
</DialogHeader>
```

### `toast` dari `sonner`
**Source:** `src/components/AddMoneyDialog.tsx` line 16, semua dialog files
**Apply to:** `src/auth/AuthProvider.tsx` (belum punya import ini)
```tsx
import { toast } from 'sonner'
```

### Helper text di form field
**Source:** `src/components/GoalDialog.tsx` line 106, `src/components/AddMoneyDialog.tsx` line 118
**Apply to:** Field "Dana Kas Terkumpul" di GoalDialog
```tsx
<p className="text-xs text-muted-foreground">...</p>
```

---

## No Analog Found

Tidak ada file tanpa analog — semua 7 file memiliki close match atau merupakan modifikasi file existing.

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `src/tabs/`, `src/components/`, `src/auth/`
**Files scanned:** 10 (3 migrations + 5 components + 1 tab + 1 provider)
**Pattern extraction date:** 2026-05-01
