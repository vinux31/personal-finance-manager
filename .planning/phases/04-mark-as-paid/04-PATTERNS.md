# Phase 4: Mark-as-Paid - Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 7 (5 created + 2 modified)
**Analogs found:** 6 / 7  (one file — `supabase/tests/04-mark-bill-paid.sql` — has no in-repo analog; minimal pattern proposed below)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0014_mark_bill_paid.sql` | DB migration / atomic RPC (PL/pgSQL) | request-response, transactional | `supabase/migrations/0003_goals_atomic_rpc.sql` | exact (same RPC archetype) |
| `supabase/migrations/0015_upcoming_bills_unpaid_view.sql` | DB migration / VIEW | read-only projection | (no view exists in repo yet) — closest reference: `aggregate_by_period` RPC in `supabase/migrations/0006_multi_user.sql:169-197` for `security_invoker`/`SECURITY DEFINER` discipline | partial (no view precedent — see Pattern Note below) |
| `supabase/tests/04-mark-bill-paid.sql` | SQL test script (Wave 0) | sequential SELECT/CALL assertions | (no `supabase/tests/` directory exists) — minimal pattern proposed below | NEW pattern |
| `src/components/ui/alert-dialog.tsx` | shadcn UI primitive wrapper | n/a (presentation) | `src/components/ui/dialog.tsx` | exact (same Radix wrapper archetype) |
| `src/db/recurringTransactions.ts` (add `markBillPaid` + refactor `listUpcomingBills`) | DB wrapper / RPC client + table query | request-response | `src/db/goals.ts:94-99` (`addMoneyToGoal` — RPC call) AND `src/db/recurringTransactions.ts:106-121` (`listUpcomingBills` self-precedent) | exact |
| `src/queries/recurringTransactions.ts` (add `useMarkBillPaid` + adjust `useUpcomingBills`) | TanStack mutation + query hook | event-driven mutation, optimistic | `src/queries/goals.ts:67-77` (`useAddMoneyToGoal`) for invalidate-only; **no in-repo precedent** for `onMutate` optimistic pattern — research Pattern 3 must be authored | role-match (no optimistic precedent) |
| `src/components/UpcomingBillsPanel.tsx` (modify) | React UI component | event-driven UI | self-precedent (Phase 3 implementation lines 80-114) + `src/components/ui/confirm-dialog.tsx:37-58` for dialog composition shape | exact (self) |

---

## Pattern Assignments

### `supabase/migrations/0014_mark_bill_paid.sql` (PL/pgSQL atomic RPC)

**Analog:** `supabase/migrations/0003_goals_atomic_rpc.sql` (lines 1-45, the entire file)

**Why this is the canonical analog:** It is the only existing `SECURITY DEFINER` PL/pgSQL function in the codebase that performs writes inside an implicit transaction. Phase 4 must mirror its structure exactly: signature shape, `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = public`, `RAISE EXCEPTION` for guards, `RETURN QUERY SELECT ...`, and a trailing `GRANT EXECUTE ... TO authenticated`.

**Header comment + signature pattern** (lines 1-13 of analog):
```sql
-- ============================================================
-- 0003_goals_atomic_rpc: Atomic increment for addMoneyToGoal
-- Fixes race condition where concurrent requests could cause lost writes
-- ============================================================

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

**Guard + error pattern** (lines 19-22, 30-32):
```sql
IF p_amount <= 0 THEN
  RAISE EXCEPTION 'Jumlah harus > 0';
END IF;
...
IF NOT FOUND THEN
  RAISE EXCEPTION 'Goal tidak ditemukan';
END IF;
```
Mirror with: `RAISE EXCEPTION 'Akses ditolak';` for the `auth.uid()` mismatch and `RAISE EXCEPTION 'Template tidak ditemukan';` after the `SELECT ... FOR UPDATE`. Use Bahasa Indonesia consistently — codebase precedent.

**Permission grant pattern** (line 44):
```sql
GRANT EXECUTE ON FUNCTION add_money_to_goal TO authenticated;
```
Mirror exactly: `GRANT EXECUTE ON FUNCTION mark_bill_paid TO authenticated;` and `GRANT EXECUTE ON FUNCTION next_due_date_sql TO authenticated;`

**Multi-user / view-as guard pattern** — secondary analog from `supabase/migrations/0006_multi_user.sql:169-197` (`aggregate_by_period`):
```sql
CREATE OR REPLACE FUNCTION aggregate_by_period(
  p_granularity TEXT,
  p_date_from   DATE    DEFAULT NULL,
  p_date_to     DATE    DEFAULT NULL,
  p_user_id     UUID    DEFAULT NULL
)
...
WHERE
  user_id = COALESCE(p_user_id, auth.uid()) AND
```
Mirror this `COALESCE(p_uid, auth.uid())` resolution + an explicit `IF v_uid != auth.uid() AND NOT is_admin() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;` (uses `is_admin()` helper from `supabase/migrations/0006_multi_user.sql:37-47`).

**FOR UPDATE row-lock pattern** — NOT present in 0003 (single UPDATE without explicit lock). Phase 4 introduces `FOR UPDATE` on the `SELECT INTO v_template` per RESEARCH.md Pitfall 4. No in-repo analog — first-of-kind. Use the literal form from RESEARCH Pattern 1:
```sql
SELECT id, name, type, category_id, amount, note, frequency, next_due_date
INTO v_template
FROM recurring_templates
WHERE id = p_template_id AND user_id = v_uid
FOR UPDATE;
```

**Naming + numbering convention:**
- Migrations are numbered `NNNN_snake_case.sql` zero-padded to 4 digits. Latest is `0013_bill_payments.sql` → next is **`0014_mark_bill_paid.sql`**.
- Function names are `snake_case`. Parameters are prefixed `p_` (precedent: `p_id`, `p_amount`, `p_user_id`). Local variables prefixed `v_` (precedent: `v_target`, `v_new_amount`, `v_new_status`).

---

### `supabase/migrations/0015_upcoming_bills_unpaid_view.sql` (VIEW — first of kind)

**Analog:** None — there are zero `CREATE VIEW` statements anywhere in `supabase/migrations/` (verified via Grep). Closest discipline reference is `supabase/migrations/0006_multi_user.sql:169-197` for `SECURITY DEFINER` semantic and `auth.uid()` scoping.

**Pattern note (no precedent — author from RESEARCH.md Pattern 5 Option A):**
```sql
-- ============================================================
-- 0015_upcoming_bills_unpaid_view: Sisa Aman D-03 — exclude paid bills
-- ============================================================

CREATE OR REPLACE VIEW upcoming_bills_unpaid AS
SELECT t.id, t.user_id, t.name, t.type, t.category_id, t.amount, t.note,
       t.frequency, t.next_due_date, t.is_active, t.created_at
FROM recurring_templates t
WHERE t.is_active = true
  AND t.type = 'expense'
  AND NOT EXISTS (
    SELECT 1 FROM bill_payments bp
    WHERE bp.recurring_template_id = t.id
      AND bp.user_id = t.user_id
      AND bp.paid_date >= date_trunc('month', CURRENT_DATE)::DATE
      AND bp.paid_date <  (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::DATE
  );

ALTER VIEW upcoming_bills_unpaid SET (security_invoker = true);
```

**Critical naming gotcha (column-name fix from RESEARCH.md):** the foreign key column on `bill_payments` is **`recurring_template_id`** (verified `supabase/migrations/0013_bill_payments.sql:8`), NOT `template_id`. The CONTEXT.md D-03 prose uses the abbreviation `template_id` — executor MUST use the full `recurring_template_id` everywhere (RPC INSERT, view subquery, test script).

**Why `security_invoker = true`:** Postgres views default to `security_definer` semantic — they execute with view-owner privileges and bypass RLS of the calling user. `security_invoker = true` makes the view inherit the caller's RLS. Without this, all users see all rows. No in-repo precedent — apply per RESEARCH.md Pitfall 7.

**Numbering:** `0015_upcoming_bills_unpaid_view.sql` (sequential after 0014).

---

### `supabase/tests/04-mark-bill-paid.sql` (Wave 0 SQL test — first of kind)

**Analog:** None. The directory `supabase/tests/` does not exist (verified — `ls supabase/` returns only `config.toml functions migrations`). This is the first SQL test script in the project.

**Proposed minimal pattern** (no in-repo precedent — author plan should establish this template):
```sql
-- ============================================================
-- Phase 04 Wave 0 test: mark_bill_paid + next_due_date_sql
-- Run via: psql "$DATABASE_URL" -f supabase/tests/04-mark-bill-paid.sql
-- Expects: each \echo block prints expected vs actual; no RAISE.
-- ============================================================

BEGIN;

-- 1. next_due_date_sql edge cases (FOUND-01 parity)
\echo 'TEST 1.1: 2025-01-31 monthly → 2025-02-28'
SELECT next_due_date_sql('2025-01-31'::DATE, 'monthly');     -- expect 2025-02-28

\echo 'TEST 1.2: 2024-01-31 monthly leap → 2024-02-29'
SELECT next_due_date_sql('2024-01-31'::DATE, 'monthly');     -- expect 2024-02-29

\echo 'TEST 1.3: 2025-03-31 monthly → 2025-04-30'
SELECT next_due_date_sql('2025-03-31'::DATE, 'monthly');     -- expect 2025-04-30

\echo 'TEST 1.4: 2025-02-14 weekly → 2025-02-21'
SELECT next_due_date_sql('2025-02-14'::DATE, 'weekly');      -- expect 2025-02-21

-- 2. mark_bill_paid happy path (requires seeded uid + template — see plan)
-- ... insert seed, call mark_bill_paid, assert 3 rows created, next_due advanced ...

ROLLBACK;  -- always rollback so test is repeatable
```

**Convention proposal:** filename pattern `<phase-padded>-<feature>.sql`, top-level `BEGIN; ... ROLLBACK;` for repeatability, `\echo` headers for human-readable output. Planner should note this is a NEW convention in the SUMMARY.md so future phases can follow.

---

### `src/components/ui/alert-dialog.tsx` (shadcn wrapper)

**Analog:** `src/components/ui/dialog.tsx` (lines 1-168, the entire file)

**Why this is the canonical analog:** The project uses the `radix-ui` meta package (verified: `import { Dialog as DialogPrimitive } from "radix-ui"` on line 4). The same import idiom must be used for `AlertDialog`. RESEARCH.md notes `@radix-ui/react-alert-dialog@1.1.15` is bundled in `radix-ui@1.4.3`. **Preferred path is `npx shadcn add alert-dialog`** (UI-SPEC §Registry Safety), which generates the wrapper using the project's `components.json` `style: radix-nova`. The hand-rollable structure must mirror `dialog.tsx` if the CLI is unavailable.

**Imports pattern** (lines 1-8 of `dialog.tsx`):
```typescript
"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"
```
For `alert-dialog.tsx`: `import { AlertDialog as AlertDialogPrimitive } from "radix-ui"`. Drop `XIcon` (no close button on AlertDialog).

**Sub-component wrapper pattern** (lines 10-32 — Root/Trigger/Portal/Close):
```typescript
function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}
```
Mirror: `AlertDialog`, `AlertDialogTrigger`, `AlertDialogPortal`. AlertDialog has no `Close` — it has `Cancel` and `Action` instead.

**Overlay + Content className pattern** (lines 34-86 — frozen tokens to preserve):
```typescript
className={cn(
  "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
  className
)}
```
Reuse the same overlay + content classes verbatim so dark/light theming and animation stay consistent.

**Title / Description font + color tokens** (lines 125-155):
```typescript
className={cn(
  "font-heading text-base leading-none font-medium",
  className
)}
...
className={cn(
  "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
  className
)}
```
Mirror these exactly for `AlertDialogTitle` and `AlertDialogDescription`.

**Export shape** (lines 157-168) — alphabetical export object. Mirror with `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogOverlay`, `AlertDialogPortal`, `AlertDialogTitle`, `AlertDialogTrigger`.

**Note:** `Cancel` and `Action` need `buttonVariants()` styling. RESEARCH.md Pattern 4 notes: pass `className="bg-destructive text-destructive-foreground hover:bg-destructive/90"` on the `Action` for the destructive variant required by UI-SPEC.

---

### `src/db/recurringTransactions.ts` — add `markBillPaid()` + refactor `listUpcomingBills()`

**Analog (RPC call):** `src/db/goals.ts:94-99`

```typescript
export async function addMoneyToGoal(id: number, amount: number): Promise<{ current_amount: number; status: GoalStatus }> {
  if (amount <= 0) throw new Error('Jumlah harus > 0')
  const { data, error } = await supabase.rpc('add_money_to_goal', { p_id: id, p_amount: amount })
  if (error) throw error
  return data[0] as { current_amount: number; status: GoalStatus }
}
```
Mirror exactly:
- Pre-validation throw (`if (paidDate ...)`-style guards) BEFORE RPC call.
- `await supabase.rpc('mark_bill_paid', { p_template_id, p_uid, p_paid_date })`.
- `if (error) throw error` (no `mapSupabaseError` here — done at hook layer).
- Return shape: `data[0] as { transaction_id: number; bill_payment_id: number; new_next_due: string }`.

**Analog (table query — self-precedent for `listUpcomingBills` refactor):** `src/db/recurringTransactions.ts:106-121` (current implementation):
```typescript
export async function listUpcomingBills(
  uid: string | undefined,
  endOfMonth: string,
): Promise<RecurringTemplate[]> {
  let query = supabase
    .from('recurring_templates')
    .select('id, name, type, category_id, amount, note, frequency, next_due_date, is_active')
    .eq('is_active', true)
    .eq('type', 'expense')
    .lte('next_due_date', endOfMonth)
    .order('next_due_date')
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data as RecurringTemplate[]
}
```
Refactor to `.from('upcoming_bills_unpaid')` (the new view) — drop `.eq('is_active', true).eq('type', 'expense')` (the view already filters them); KEEP `.lte('next_due_date', endOfMonth)`, `.order('next_due_date')`, and the `.eq('user_id', uid)` guard. Per RESEARCH.md the signature can stay `(uid, endOfMonth)` — no `monthStart` needed because the view internally uses `CURRENT_DATE`-derived month bounds.

**Type definitions to reuse** (lines 3-15):
```typescript
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurringTemplate {
  id: number
  name: string
  type: 'income' | 'expense'
  category_id: number
  amount: number
  note: string | null
  frequency: Frequency
  next_due_date: string
  is_active: boolean
}
```
Same `RecurringTemplate` shape applies to view rows — the view's column list mirrors the table.

**`nextDueDate()` TS reference for SQL parity** (lines 28-48) — must be ported to `next_due_date_sql` PL/pgSQL helper inside migration 0014. Verified canonical TS implementation:
```typescript
case 'monthly': {
  const targetMonth = date.getMonth() + 1
  date.setDate(1)
  date.setMonth(targetMonth)
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate()
  date.setDate(Math.min(d, lastDay))
  break
}
```
SQL equivalent in RESEARCH.md Pattern 2.

**Naming convention:** functions are `camelCase` (`listUpcomingBills`, `markBillPaid`). NOT `mark_bill_paid` — that name is reserved for the RPC. Always pair: `markBillPaid()` (TS wrapper) → `mark_bill_paid` (SQL function).

---

### `src/queries/recurringTransactions.ts` — add `useMarkBillPaid()` + adjust `useUpcomingBills`

**Analog (mutation hook — invalidate-only baseline):** `src/queries/goals.ts:67-77`
```typescript
export function useAddMoneyToGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) => addMoneyToGoal(id, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Dana berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```
This is the **shape** to mirror for the basic mutation skeleton: `useMutation` from `@tanstack/react-query`, `useQueryClient()`, `mutationFn` accepting an object param, `onSuccess` invalidate + `toast.success(...)`, `onError` → `toast.error(mapSupabaseError(e))`. Imports follow same module — `import { toast } from 'sonner'`, `import { mapSupabaseError } from '@/lib/errors'`.

**Analog (closer mutation hook — same file):** `src/queries/recurringTransactions.ts:27-37` (`useCreateRecurringTemplate`):
```typescript
export function useCreateRecurringTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RecurringTemplateInput) => createRecurringTemplate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-templates'] })
      toast.success('Template berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```
This is in the SAME file the planner is modifying — append `useMarkBillPaid()` immediately after the existing mutations. Follow the exact `qc.invalidateQueries({ queryKey: [...] })` shape.

**Optimistic `onMutate` pattern — NO in-repo precedent.** Verified via Grep: `onMutate`, `cancelQueries`, `setQueriesData` produce zero matches under `src/queries/`. RESEARCH.md Pattern 3 must be authored from the canonical TanStack v5 idiom shown there. Key skeleton (must be added new):
```typescript
onMutate: async ({ templateId }) => {
  await qc.cancelQueries({ queryKey: ['upcoming-bills'] })
  const snapshots = qc.getQueriesData<RecurringTemplate[]>({ queryKey: ['upcoming-bills'] })
  qc.setQueriesData<RecurringTemplate[]>(
    { queryKey: ['upcoming-bills'] },
    (old) => old?.filter((b) => b.id !== templateId) ?? []
  )
  return { snapshots }
},
onError: (err, _vars, context) => {
  context?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data))
  toast.error(mapSupabaseError(err))
},
onSettled: () => {
  qc.invalidateQueries({ queryKey: ['upcoming-bills'] })
  qc.invalidateQueries({ queryKey: ['transactions'] })
  qc.invalidateQueries({ queryKey: ['reports'] })
  qc.invalidateQueries({ queryKey: ['recurring-templates'] })
},
```

**Query key invalidation contract — verified from existing files:**
| Query | Key prefix to invalidate | Source |
|-------|--------------------------|--------|
| Upcoming bills list | `['upcoming-bills']` | `src/queries/recurringTransactions.ts:75` (`['upcoming-bills', uid, endOfMonth]`) |
| Transactions list | `['transactions']` | precedent: `useProcessRecurring.ts:41` |
| Reports / aggregates | `['reports']` | per RESEARCH.md (CONTEXT D-02 calls it `aggregate` but actual key is `['reports']`) |
| Recurring templates | `['recurring-templates']` | `src/queries/recurringTransactions.ts:21,32` |

**`useUpcomingBills()` adjustment** (current lines 64-79): the queryKey `['upcoming-bills', uid, endOfMonth]` can stay as-is since the view internally pins to `CURRENT_DATE` month — no monthStart param needed. Cache freshness is fine because mark-as-paid invalidates the prefix.

**Naming convention:** mutation hooks are `useVerb...Noun()` — `useMarkBillPaid`, `useAddMoneyToGoal`, `useCreateRecurringTemplate`. Import the DB wrapper from `@/db/recurringTransactions` alongside types.

---

### `src/components/UpcomingBillsPanel.tsx` (modify — append Lunas button + AlertDialog)

**Analog (self):** Current `src/components/UpcomingBillsPanel.tsx` (lines 80-114) — the existing render path that the planner is extending.

**Row layout to extend** (lines 87-101 — the bill row that gets a button appended):
```typescript
<li key={bill.id} className="flex items-center gap-3 py-2.5">
  <span
    className={`h-2 w-2 shrink-0 rounded-full ${urgencyDotClass[urgency]}`}
  />
  <div className="min-w-0 flex-1">
    <div className="truncate text-sm font-semibold">{bill.name}</div>
    <div className={`text-xs ${urgencyTextClass[urgency]}`}>
      {dueSubText(diff)}
    </div>
  </div>
  <span className="text-sm font-semibold tabular-nums">
    {formatRupiah(bill.amount)}
  </span>
</li>
```
**Modification:** append `<Button variant="outline" size="sm" className="h-auto py-0.5 px-2 text-xs" onClick={() => setSelectedBill(bill)}>Lunas</Button>` as the next sibling AFTER the amount span. This preserves all existing layout invariants (UI-SPEC §Spacing).

**Dialog composition pattern (analog):** `src/components/ui/confirm-dialog.tsx:37-58`
```typescript
return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && (
          <DialogDescription>{description}</DialogDescription>
        )}
      </DialogHeader>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === 'destructive' ? 'destructive' : 'default'}
          onClick={handleConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
```
**Adapt to AlertDialog** — same nested structure, but swap `Dialog*` → `AlertDialog*` and use `AlertDialogCancel` / `AlertDialogAction` (NOT plain `<Button>`) per RESEARCH.md Pattern 4. UI-SPEC explicitly mandates AlertDialog (not Dialog) for `role="alertdialog"` a11y semantics. Do NOT reuse `ConfirmDialog` directly — it is built on `Dialog` and would fail the a11y contract.

**State pattern** (RESEARCH.md Pattern 4 — first of kind for this file):
```typescript
const [selectedBill, setSelectedBill] = useState<RecurringTemplate | null>(null)
const markPaid = useMarkBillPaid()
```
Single panel-level dialog driven by `selectedBill` — NOT per-row. AlertDialog opens when `selectedBill !== null`.

**Mutation invocation pattern:**
```typescript
markPaid.mutate(
  { templateId: selectedBill.id, paidDate: todayISO() },
  { onSuccess: () => setSelectedBill(null) },
)
```
`todayISO()` is imported from `@/lib/format` (verified `src/lib/format.ts:29-35` returns local-midnight `YYYY-MM-DD`). Per Pitfall 6 — DO NOT use `new Date().toISOString()`.

**State invariants to preserve from Phase 3 (lines 52-77):**
- Loading: `<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Memuat…</div>`
- Error: same shell, copy `Gagal memuat tagihan. Coba lagi.`
- Empty: same shell, copy `Tidak ada tagihan bulan ini.`
- Sisa Aman row: lines 104-111 — **leave totally untouched** (formula automatically refines because `bills` now contains only unpaid items per D-03).

**Naming convention:** Component file uses `PascalCase.tsx`. State variables `camelCase`. The bill prop is named `bill` (current line 84). `selectedBill` follows that.

---

## Shared Patterns

### Indonesian copy in `RAISE EXCEPTION` and toast
**Source:** `supabase/migrations/0003_goals_atomic_rpc.sql:21,31` (`'Jumlah harus > 0'`, `'Goal tidak ditemukan'`) + `src/queries/goals.ts:73` (`'Dana berhasil ditambahkan'`).
**Apply to:** all RPC error messages in 0014 + all toast messages in `useMarkBillPaid()`.
- RPC errors: `'Akses ditolak'`, `'Template tidak ditemukan'`, `'Tagihan sudah ditandai lunas hari ini'` (per Pitfall 4 robust variant).
- Toast success: `'✓ Tagihan dilunasi'` per UI-SPEC Copywriting table (locked).

### Multi-user (`COALESCE(p_uid, auth.uid())`) discipline
**Source:** `supabase/migrations/0006_multi_user.sql:192` (`user_id = COALESCE(p_user_id, auth.uid())`) + `is_admin()` helper at lines 37-47.
**Apply to:** `mark_bill_paid` RPC — resolve `v_uid := COALESCE(p_uid, auth.uid())` then guard `IF v_uid != auth.uid() AND NOT is_admin() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;` — and use `v_uid` in EVERY `WHERE user_id =` and `INSERT ... user_id =` (Pitfall 1).

### `useTargetUserId()` for view-as
**Source:** `src/auth/useTargetUserId.ts:1-8`
```typescript
import { useAuthContext } from './AuthProvider'
import { useViewAsContext } from './ViewAsContext'

export function useTargetUserId(): string | undefined {
  const { user } = useAuthContext()
  const { viewingAs } = useViewAsContext()
  return viewingAs?.uid ?? user?.id
}
```
**Apply to:** `useMarkBillPaid` — must call `const uid = useTargetUserId()` and pass `uid` as `p_uid` to the RPC. This is what makes admin "view-as" mode work.

### Error handling via `mapSupabaseError`
**Source:** every mutation hook in `src/queries/*.ts` — example `src/queries/goals.ts:75`: `onError: (e) => toast.error(mapSupabaseError(e))`.
**Apply to:** `useMarkBillPaid()` — same `import { mapSupabaseError } from '@/lib/errors'` and same shape inside `onError`.

### Tailwind className tokens for shadcn destructive button (NEW — no precedent for AlertDialogAction)
**Source:** RESEARCH.md Pattern 4 (no in-repo analog because shadcn AlertDialog is being added in this phase).
**Apply to:** `<AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">` — required because shadcn-generated `AlertDialogAction` defaults to primary variant per UI-SPEC.

### Migration sequencing convention
**Source:** every file in `supabase/migrations/` follows `NNNN_snake_case.sql` zero-padded to 4 digits.
**Apply to:** `0014_mark_bill_paid.sql` then `0015_upcoming_bills_unpaid_view.sql`. Two separate migrations is RECOMMENDED (atomic per concern) — but the planner may opt to combine into a single `0014_mark_bill_paid.sql` if Wave 0 review prefers fewer files. Either is consistent with the codebase (see 0006 for a multi-concern migration).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/migrations/0015_upcoming_bills_unpaid_view.sql` | DB VIEW | read-only projection | No `CREATE VIEW` exists in migrations (Grep verified zero matches). First view in the project. Use RESEARCH.md Pattern 5 Option A as the template. |
| `supabase/tests/04-mark-bill-paid.sql` | SQL test | sequential assert | Directory `supabase/tests/` does not exist. First SQL test in the project. Pattern proposed above; planner should establish convention. |
| Optimistic `onMutate` block in `useMarkBillPaid` | TanStack mutation | event-driven optimistic | `onMutate`/`cancelQueries`/`setQueriesData` Grep returns zero matches under `src/queries/`. First optimistic mutation in the project. Use RESEARCH.md Pattern 3 verbatim. |

---

## Metadata

**Analog search scope:**
- `supabase/migrations/` (13 files, all read or grepped)
- `src/db/` (14 files; deep-read: `recurringTransactions.ts`, `goals.ts`, `reports.ts`)
- `src/queries/` (10 files; deep-read: `recurringTransactions.ts`, `goals.ts`)
- `src/components/ui/` (`dialog.tsx`, `confirm-dialog.tsx`)
- `src/components/UpcomingBillsPanel.tsx`
- `src/auth/`, `src/lib/`, `src/hooks/useProcessRecurring.ts`

**Files scanned:** ~40

**Pattern extraction date:** 2026-04-24
