# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 5 (3 create, 2 modify)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/db/recurringTransactions.ts` | utility (date calc) | transform | self (modify existing function) | exact — single function edit |
| `supabase/migrations/0012_net_worth.sql` | migration | CRUD | `supabase/migrations/0011_pension_simulations.sql` | exact — same RLS pattern with explicit WITH CHECK |
| `supabase/migrations/0013_bill_payments.sql` | migration | CRUD | `supabase/migrations/0010_recurring_transactions.sql` | role-match — single table, FK to existing tables |
| `src/tabs/FinansialTab.tsx` | component (tab wrapper) | request-response | `src/tabs/PensiunTab.tsx` | exact — Tabs-inside-Tabs structure |
| `src/App.tsx` | config (TABS array) | request-response | self (modify existing entry) | exact — 2-field patch |

---

## Pattern Assignments

### `src/db/recurringTransactions.ts` (utility, transform)

**Analog:** Self — modify existing `nextDueDate()` function at line 28.

**Current buggy pattern** (lines 28-41):
```typescript
export function nextDueDate(current: string, frequency: Frequency): string {
  const [y, m, d] = current.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  switch (frequency) {
    case 'daily': date.setDate(date.getDate() + 1); break
    case 'weekly': date.setDate(date.getDate() + 7); break
    case 'monthly': date.setMonth(date.getMonth() + 1); break   // <-- BUG: line 34
    case 'yearly': date.setFullYear(date.getFullYear() + 1); break
  }
  const ny = date.getFullYear()
  const nm = String(date.getMonth() + 1).padStart(2, '0')
  const nd = String(date.getDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}
```

**Fixed monthly case — replace line 34 only** (mutation-only; `const date` stays `const`):
```typescript
    case 'monthly': {
      // Clamp to last valid day of target month (D-08, D-09)
      // Step 1: setDate(1) first to prevent setMonth overflow.
      // Step 2: setMonth() advances safely (day=1 is always valid).
      // Step 3: compute last day of target month via new Date(year, month+1, 0).
      // Step 4: setDate(Math.min(originalDay, lastDay)) clamps correctly.
      const targetMonth = date.getMonth() + 1
      date.setDate(1)
      date.setMonth(targetMonth)
      const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate()
      date.setDate(Math.min(d, lastDay))
      break
    }
```

**Key constraints:**
- `d` is already the original day parsed at line 29 — use it directly as the clamping reference (DO NOT use `date.getDate()` after setMonth; setMonth mutates and can overflow)
- Replace single-line `case 'monthly': date.setMonth(date.getMonth() + 1); break` with the block above
- All other cases (daily, weekly, yearly) and the format block (lines 37-40) are UNCHANGED
- The outer `const date = new Date(y, m - 1, d)` at line 30 stays `const` — **all operations in the monthly block are mutations (setDate/setMonth)**, no reassignment. Do NOT change `const` to `let`.

---

### `supabase/migrations/0012_net_worth.sql` (migration, CRUD)

**Analog:** `supabase/migrations/0011_pension_simulations.sql`

**RLS pattern from analog** (lines 64-69):
```sql
ALTER TABLE pension_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pension sim"
  ON pension_simulations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Deviation from analog:** D-06 requires `OR is_admin()` on the USING clause (for admin view-as). Analog 0011 does not have this. Analog 0010 also does not have it. The `is_admin()` clause must be added per CONTEXT.md D-06. **VERIFIED:** `is_admin()` function is defined in `supabase/migrations/0006_multi_user.sql` (lines 37-48) — safe to use in new policies.

**PK pattern from analog 0010** (line 6):
```sql
-- 0010 uses BIGSERIAL (older syntax)
id BIGSERIAL PRIMARY KEY,
-- CONTEXT.md specifies the newer equivalent:
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
```

**Column constraint pattern from 0010** (lines 7-17):
```sql
user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
name       TEXT NOT NULL,
type       TEXT NOT NULL CHECK (type IN ('income', 'expense')),
amount     NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

**GENERATED ALWAYS AS STORED pattern** (for `net_worth_snapshots.net_worth`):
```sql
-- Native PostgreSQL computed column — no analog exists in current migrations
-- Use exactly this syntax (PostgreSQL >= 12, supported by Supabase):
net_worth NUMERIC(15,2) GENERATED ALWAYS AS
            (total_accounts + total_investments - total_liabilities) STORED,
```

**UNIQUE constraint pattern from 0011** (line 62):
```sql
UNIQUE(user_id)
-- For net_worth_snapshots, use composite unique:
UNIQUE(user_id, snapshot_month)
```

**Full file structure to produce:**
```
-- File header comment block
-- CREATE TABLE net_worth_accounts (...)
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY
-- CREATE POLICY ...
-- blank line
-- CREATE TABLE net_worth_liabilities (...)
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY
-- CREATE POLICY ...
-- blank line
-- CREATE TABLE net_worth_snapshots (...)
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY
-- CREATE POLICY ...
```

---

### `supabase/migrations/0013_bill_payments.sql` (migration, CRUD)

**Analog:** `supabase/migrations/0010_recurring_transactions.sql`

**Reason for analog:** 0010 is the simpler single-table pattern with FK references to existing tables — bill_payments also has FK to `recurring_templates(id)` and `transactions(id)`.

**FK pattern from analog 0010** (lines 11-12):
```sql
category_id BIGINT NOT NULL REFERENCES categories(id),
-- bill_payments equivalent:
recurring_template_id BIGINT NOT NULL REFERENCES recurring_templates(id) ON DELETE CASCADE,
transaction_id        BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
```

**Nullable FK pattern** — `transaction_id` is nullable (payment may not be linked to a transaction yet). Follow the pattern: column without `NOT NULL` and `ON DELETE SET NULL`.

**RLS pattern** (same as 0012 — USING with `OR is_admin()`, explicit WITH CHECK):
```sql
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bill payments"
  ON bill_payments FOR ALL
  USING  (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);
```

---

### `src/tabs/FinansialTab.tsx` (component, request-response)

**Analog:** `src/tabs/PensiunTab.tsx`

**Sub-tab structure to copy** (PensiunTab lines 134-151):
```tsx
{/* Sub-tab Navigation */}
<Tabs defaultValue="simulasi" className="w-full">
  <TabsList className="mb-4">
    <TabsTrigger value="simulasi">Simulasi Investasi</TabsTrigger>
    <TabsTrigger value="hitung">Hitung Total</TabsTrigger>
    <TabsTrigger value="panduan">Panduan</TabsTrigger>
  </TabsList>

  <TabsContent value="simulasi">
    <SimulasiPanel form={form} onChange={handleChange} />
  </TabsContent>
  <TabsContent value="hitung">
    <HitungTotalPanel form={form} onChange={handleChange} />
  </TabsContent>
  <TabsContent value="panduan">
    <PanduanPanel />
  </TabsContent>
</Tabs>
```

**FinansialTab adaptation** (D-03, D-04 — defaultValue "kekayaan", 2 sub-tabs only):
```tsx
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
          {/* Phase 2 placeholder */}
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

**Imports pattern** (PensiunTab line 3 — copy only what FinansialTab needs):
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
```

**Key constraints:**
- No state, no hooks, no effects needed — FinansialTab is a pure structural wrapper
- GoalsTab (lines 1-30 confirmed) is self-contained: uses `useState` internally and React Query hooks — passes ZERO props from parent. Safe to render as `<GoalsTab />` with no props.
- Outer wrapper `<div className="space-y-6">` matches PensiunTab line 67

---

### `src/App.tsx` (config, request-response)

**Analog:** Self — surgical 2-field modification to existing TABS array.

**Current entry** (line 32):
```typescript
{ value: 'goals',  label: 'Goals',     icon: Target, Comp: GoalsTab },
```

**Target entry** (D-01, D-02):
```typescript
{ value: 'goals',  label: 'Finansial', icon: Target, Comp: FinansialTab },
```

**Import changes required** (lines 13-20):
```typescript
// ADD this import:
import FinansialTab from '@/tabs/FinansialTab'

// REMOVE this import (GoalsTab is no longer referenced directly by App.tsx):
// import GoalsTab from '@/tabs/GoalsTab'
// GoalsTab is imported by FinansialTab.tsx internally.
```

**Only changes to the file:**
1. Remove `import GoalsTab from '@/tabs/GoalsTab'` (unused after swap)
2. Add `import FinansialTab from '@/tabs/FinansialTab'`
3. Change `label: 'Goals'` → `label: 'Finansial'` on line 32
4. Change `Comp: GoalsTab` → `Comp: FinansialTab` on line 32

(Items 3 and 4 are a single line replacement.)

---

## Shared Patterns

### Migration File Structure
**Source:** `supabase/migrations/0010_recurring_transactions.sql` and `0011_pension_simulations.sql`
**Apply to:** `0012_net_worth.sql`, `0013_bill_payments.sql`

```sql
-- ============================================================
-- NNNN_name: Short description
-- ============================================================

CREATE TABLE table_name (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ... columns ...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own [entity]"
  ON table_name FOR ALL
  USING  (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);
```

### RLS Split: USING vs WITH CHECK
**Source:** `0011_pension_simulations.sql` lines 64-69 (has explicit WITH CHECK)
**Apply to:** All 4 new tables in 0012 and 0013

- USING: `auth.uid() = user_id OR is_admin()` — allows admin to read any user's data
- WITH CHECK: `auth.uid() = user_id` — prevents admin from writing as another user
- 0010 uses only `USING` without `WITH CHECK` — do NOT follow 0010's RLS; follow 0011's pattern with both clauses

### Tab Wrapper Component Structure
**Source:** `src/tabs/PensiunTab.tsx` lines 66-67, 134-151
**Apply to:** `src/tabs/FinansialTab.tsx`

```tsx
return (
  <div className="space-y-6">
    <Tabs defaultValue="..." className="w-full">
      <TabsList className="mb-4">
        ...triggers...
      </TabsList>
      ...contents...
    </Tabs>
  </div>
)
```

### Import Path Alias
**Source:** All existing tab and component files
**Apply to:** `FinansialTab.tsx`

All project imports use `@/` alias (e.g., `@/components/ui/tabs`, `@/tabs/GoalsTab`). Never use relative paths like `../components/`.

---

## No Analog Found

None — all 5 files have direct analogs in the codebase.

---

## Critical Warnings for Planner

| Warning | Affects | Detail |
|---|---|---|
| `const date` stays `const` (mutation-only) | `recurringTransactions.ts` | The monthly-case fix uses `setDate(1)` / `setMonth()` / `setDate(Math.min())` mutations on the existing `date` variable. **Do NOT change `const` to `let`** — no reassignment happens. |
| `is_admin()` availability | `0012_net_worth.sql`, `0013_bill_payments.sql` | **VERIFIED:** `is_admin()` is defined in `supabase/migrations/0006_multi_user.sql` (lines 37-48). Safe to use `OR is_admin()` in USING clauses. |
| GoalsTab import in App.tsx | `App.tsx` | After swap, `GoalsTab` is no longer used in App.tsx — remove the import to avoid TS unused-import lint error |
| `value: 'goals'` must NOT change | `App.tsx` | Changing the tab `value` would break `useTabStore` persisted state for existing users (D-01) |

---

## Metadata

**Analog search scope:** `src/db/`, `src/tabs/`, `src/App.tsx`, `supabase/migrations/`
**Files read:** 6 (recurringTransactions.ts, PensiunTab.tsx, GoalsTab.tsx top-30, App.tsx, 0010_recurring_transactions.sql, 0011_pension_simulations.sql, 0006_multi_user.sql)
**Pattern extraction date:** 2026-04-24
**Last revised:** 2026-04-24 (checker feedback — const/let canonicalization, is_admin() verification)
