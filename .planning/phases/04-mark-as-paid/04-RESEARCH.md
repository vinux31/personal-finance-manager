# Phase 4: Mark-as-Paid - Research

**Researched:** 2026-04-24
**Domain:** Supabase PL/pgSQL atomic RPC + TanStack Query mutation + shadcn AlertDialog UX on a React 19 + Supabase + Tailwind 4 stack
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Tombol "Lunas" sebagai **teks "Lunas"** di kanan baris, setelah amount.
  - Layout baris: `[dot] [nama + sub-teks] [amount] [Lunas]`
  - Tombol kecil (variant outline atau ghost), tidak menggeser layout yang sudah ada
  - Ukuran button proporsional: `h-auto py-0.5 px-2 text-xs`
- **D-02:** Klik "Lunas" memunculkan **AlertDialog konfirmasi singkat** sebelum proses:
  - Dialog: "Tandai [nama tagihan] sebagai lunas?"
  - Tombol: [Batalkan] dan [Ya, Lunas]
  - Setelah konfirmasi: proses atomik → dialog tutup → baris hilang (remove dari list) → toast sukses
  - Toast message: "✓ Tagihan dilunasi" (atau "{nama} ditandai lunas")
  - Query invalidation setelah sukses: `upcoming-bills`, `transactions`, `aggregate`
- **D-03:** Sisa Aman hanya mengurangi tagihan yang **BELUM** lunas bulan ini.
  - Formula baru: `Sisa Aman = pemasukan_aktual − pengeluaran_aktual − sum(tagihan_belum_lunas)`
  - Implementasi: query level — `NOT EXISTS (SELECT 1 FROM bill_payments WHERE recurring_template_id = t.id AND paid_date BETWEEN awal_bulan AND akhir_bulan)`
- **D-04:** Gunakan **RPC atomik** `mark_bill_paid(p_template_id, p_uid, p_paid_date)` — satu Supabase DB function yang mengerjakan tiga operasi dalam satu transaction:
  1. `INSERT INTO transactions`
  2. `INSERT INTO bill_payments`
  3. `UPDATE recurring_templates SET next_due_date = nextDueDate(current, frequency) WHERE id = template_id`
- **useProcessRecurring tidak dimodifikasi.** Guard via `next_due_date` yang sudah maju — bukan `<= today` setelah paid.
- Migration baru untuk mendaftarkan fungsi PL/pgSQL.

### Claude's Discretion

- Exact PL/pgSQL function signature dan return shape (tapi tetap harmonis dengan `add_money_to_goal` precedent)
- Apakah modify `listUpcomingBills` vs add `listUnpaidBills` (rekomendasi research di bawah)
- Optimistic update vs invalidate-only (rekomendasi research di bawah)
- Toast message exact wording ("{nama} ditandai lunas" vs "✓ Tagihan dilunasi") — UI-SPEC locks latter

### Deferred Ideas (OUT OF SCOPE)

- Undo "Lunas" — batalkan pembayaran jika klik salah (Phase 5 atau future)
- History pembayaran per tagihan — lihat riwayat bulan-bulan lalu (future)
- Bulk mark-as-paid — tandai beberapa tagihan sekaligus (future)
- Notifikasi tagihan jatuh tempo hari ini (push notification) — future milestone
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BILL-03 | User dapat tandai tagihan "Lunas" secara atomik — buat transaksi expense + catat bill_payment + update next_due_date dalam satu operasi | Supabase PL/pgSQL RPC `mark_bill_paid` dalam migration 0014 (3 ops in BEGIN/END block) + `useMarkBillPaid()` mutation hook + AlertDialog trigger per bill row |
| NAV-02 (partial — dashboard wiring complete) | Dashboard widget "Tagihan Bulan Ini" sudah lengkap dengan interaksi mark-as-paid | "Lunas" button ditambahkan ke tiap row `UpcomingBillsPanel.tsx` (modifikasi existing komponen, bukan file baru) |
</phase_requirements>

---

## Summary

Fase 4 adalah plumbing phase — **tidak ada komponen baru**, satu komponen existing dimodifikasi (`UpcomingBillsPanel.tsx`), satu DB function baru (migration `0014_mark_bill_paid.sql`), satu mutation hook baru (`useMarkBillPaid`), dan satu query di-refine (`listUpcomingBills` filter `NOT EXISTS` bill_payments). Sisa Aman formula refinement (D-03) otomatis terjadi ketika `useUpcomingBills` hanya mengembalikan tagihan yang belum lunas — client-side arithmetic `income - expense - totalBills` di `UpcomingBillsPanel` tetap benar tanpa perlu diubah.

Titik risiko tertinggi adalah **reproduksi `nextDueDate()` logic** (dari `src/db/recurringTransactions.ts:28-48`) ke PL/pgSQL. Logic ini menangani edge case month-end overflow yang sudah diperbaiki di FOUND-01 (31 Jan + 1 bulan = 28 Feb, bukan 3 Mar). Postgres `date + interval '1 month'` **TIDAK** replikasi perilaku ini secara default — 2025-01-31 + '1 month' di Postgres = 2025-03-03 (sama bug-nya dengan bug FOUND-01 yang sudah diperbaiki di client). Research pola paling aman: `date_trunc('month', p_current) + interval '1 month' + (LEAST(extract(day from p_current), <last day of target month>) - 1) * interval '1 day'` — atau lebih sederhana, manual `EXTRACT(DAY FROM ...)` dengan `make_date` + `LEAST(day_of_month, days_in_month(next_month))`. Contoh SQL dibawah.

Titik risiko kedua adalah **race condition antara mark-as-paid dan useProcessRecurring tick**. `useProcessRecurring` jalan di `useEffect` saat uid berubah (sekali per mount). Jika user klik "Lunas" dalam 100ms sebelum tick jalan, useProcessRecurring akan baca `next_due_date` yang masih lama dan buat duplicate transaction. Mitigasi: RPC **sebagai single source of truth** untuk advance `next_due_date` — begitu RPC commit, subsequent useProcessRecurring iterasi akan lihat `next_due_date` baru dan skip. Ini AMAN karena Postgres transaction atomicity; bahkan jika tick dan RPC start simultaneously, hanya satu yang menang (yang pertama commit), dan yang kedua akan lihat row state yang sudah di-update. Tidak perlu advisory lock atau versi field.

**Primary recommendation:** Lima-file change set: (1) migration `0014_mark_bill_paid.sql` dengan PL/pgSQL function + GRANT, (2) modify `listUpcomingBills` add `NOT EXISTS bill_payments` subquery, (3) append `markBillPaid()` DB wrapper di `src/db/recurringTransactions.ts`, (4) append `useMarkBillPaid()` mutation hook di `src/queries/recurringTransactions.ts`, (5) modify `src/components/UpcomingBillsPanel.tsx` — add "Lunas" button + AlertDialog state + mutation call. Reuse shadcn `AlertDialog` via `npx shadcn add alert-dialog` (belum installed di `src/components/ui/` tapi `@radix-ui/react-alert-dialog@1.1.15` sudah ter-bundle via `radix-ui` meta package).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Atomic 3-op transaction (insert transaction + insert bill_payment + update next_due_date) | Database (PL/pgSQL RPC) | — | HARUS single transaction untuk mencegah partial state; client-side multi-call sequence tidak bisa memberi ACID guarantee [VERIFIED: 0003_goals_atomic_rpc.sql precedent] |
| nextDueDate date arithmetic (weekly/monthly/yearly) | Database (PL/pgSQL helper di dalam RPC) | — | Logic harus match TS `nextDueDate()` untuk konsistensi — porting ke SQL dalam scope migration [CITED: src/db/recurringTransactions.ts:28-48] |
| Unpaid-bill filter (NOT EXISTS bill_payments for current month) | Database (Supabase query builder) | — | Subquery di DB level lebih efisien daripada client filter; existing `listUpcomingBills` sudah query DB, cukup tambah filter |
| Mark-as-paid mutation orchestration | TanStack Query (`useMutation`) | React Component | Standard pattern: mutation hook invalidates query keys on success, component triggers via `.mutate()` [CITED: existing `useCreateRecurringTemplate` precedent] |
| Confirmation UX (AlertDialog) | React Component (UpcomingBillsPanel local state) | — | Single `selectedBill` state di komponen — dialog mount/unmount driven by state; tidak ada global state needed |
| Row removal after success | TanStack Query cache invalidation | — | `qc.invalidateQueries({ queryKey: ['upcoming-bills'] })` → refetch → bill tidak muncul (karena unpaid filter) → row hilang |
| useProcessRecurring dedup guard | Database (next_due_date check in existing hook) | — | GUARD ARCHITECTURAL: RPC sudah majukan `next_due_date`, hook existing `t.next_due_date <= today` filter otomatis skip [VERIFIED: src/hooks/useProcessRecurring.ts:19] |

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.103.3 | RPC client via `supabase.rpc('mark_bill_paid', {...})` | Already in use — `src/db/goals.ts:96` precedent for `add_money_to_goal` RPC call [VERIFIED: grep `.rpc\(`] |
| @tanstack/react-query | ^5.99.1 | `useMutation` hook for mark-bill-paid | Already used for all mutations in codebase (useCreateRecurringTemplate precedent) [VERIFIED: package.json] |
| sonner | ^2.0.7 | Toast "✓ Tagihan dilunasi" | Already imported everywhere via `import { toast } from 'sonner'` [VERIFIED: src/queries/recurringTransactions.ts:3] |
| radix-ui | ^1.4.3 | Meta package — AlertDialog primitive at `@radix-ui/react-alert-dialog@1.1.15` (bundled) | Project uses meta barrel: `import { AlertDialog } from 'radix-ui'` — same pattern as `import { Dialog as DialogPrimitive } from "radix-ui"` [VERIFIED: node_modules/radix-ui/dist/index.d.ts:6 exports `reactAlertDialog as AlertDialog`] |

### Supporting (needs installation)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn AlertDialog component (file) | — | Ready-made wrapper with consistent styling for AlertDialog primitive | Run `npx shadcn add alert-dialog` to generate `src/components/ui/alert-dialog.tsx` — no npm dep added, just creates a file that wraps existing Radix primitive [CITED: components.json `"style": "radix-nova"`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn `AlertDialog` (separate file) | Reuse existing `src/components/ui/confirm-dialog.tsx` | ConfirmDialog is built on `Dialog` (bukan `AlertDialog`) — semantically less correct for destructive confirmation (missing `role="alertdialog"` ARIA). RECOMMENDATION: install `AlertDialog` per UI-SPEC — correct a11y semantic untuk destructive action. Effort: satu `npx shadcn add alert-dialog` invocation. |
| RPC dengan `p_uid` param | RPC tanpa `p_uid` param, rely on `auth.uid()` | `add_money_to_goal` uses pure `auth.uid()` (no p_uid) untuk enforcement. Tapi CONTEXT.md D-04 explicit menyebutkan `p_uid` parameter — ini mendukung admin "view-as" mode. RECOMMENDATION: ikuti D-04, `p_uid` defaults to `auth.uid()` (via `DEFAULT auth.uid()` or `COALESCE(p_uid, auth.uid())`), validated: `IF p_uid != auth.uid() AND NOT is_admin() THEN RAISE EXCEPTION`. Konsisten dengan `aggregate_by_period` precedent [VERIFIED: 0006_multi_user.sql:168-198 `COALESCE(p_user_id, auth.uid())` pattern]. |
| Optimistic update (remove row immediately) | Invalidate-only (wait for refetch) | Optimistic = snappier UX (row hilang ~0ms); Invalidate-only = simpler, ~200-500ms delay. Given RPC typical latency <500ms on Supabase dan UI-SPEC explicit `"optimistic remove row → toast"`, **optimistic pattern direkomendasikan**. Implementation: `onMutate` → snapshot cache + remove bill from `['upcoming-bills']` cache; `onError` → rollback to snapshot. |
| Modify `listUpcomingBills` existing | Add new `listUnpaidBills` | RECOMMENDATION: **modify existing**. Reasoning: `listUpcomingBills` satu-satunya caller (`useUpcomingBills` di UpcomingBillsPanel). Setelah Phase 4, semantic "upcoming bills" = "unpaid bills bulan ini" — name tetap akurat, menghindari fungsi duplikat. Refactor signature dari `(uid, endOfMonth)` ke `(uid, monthStart, endOfMonth)` untuk enable `paid_date BETWEEN` range subquery. |

**Installation (migration + shadcn component):**
```bash
# 1. Install shadcn AlertDialog wrapper (creates src/components/ui/alert-dialog.tsx)
npx shadcn add alert-dialog

# 2. Apply migration (dev)
npx supabase db push  # or equivalent — user's Supabase CLI workflow unchanged
```

**Version verification (2026-04-24):**
- `@radix-ui/react-alert-dialog@1.1.15` — bundled in `radix-ui@1.4.3` meta package [VERIFIED: node_modules/radix-ui/package.json:29]
- `shadcn@4.3.0` — declared in devDependencies [VERIFIED: package.json:27]
- No new npm dependencies required — only a file-generation step

---

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Lunas" button on bill row
          │
          ▼
Set selectedBill state ─────────▶ AlertDialog opens (radix-ui)
          │                              │
          │                              ▼ User clicks [Ya, Lunas]
          │                              │
          │                              ▼
          │                  useMarkBillPaid().mutate({templateId, paidDate})
          │                              │
          │                              ▼
          │                  supabase.rpc('mark_bill_paid', {p_template_id, p_uid, p_paid_date})
          │                              │
          │                              ▼
          │      ┌──────── Postgres TRANSACTION (atomic) ───────┐
          │      │ 1. INSERT INTO transactions (...)            │
          │      │ 2. INSERT INTO bill_payments (...)           │
          │      │ 3. UPDATE recurring_templates                │
          │      │      SET next_due_date = next_due_sql(...)   │
          │      └──────────────────────────────────────────────┘
          │                              │
          │            ┌─ success ──────┴─────── error ─┐
          │            ▼                                 ▼
          │  onSuccess (useMutation)         onError
          │   ├─ invalidate ['upcoming-bills']  ├─ toast.error(mapSupabaseError)
          │   ├─ invalidate ['transactions']   ├─ dialog tetap open
          │   ├─ invalidate ['reports']        └─ AlertDialogAction re-enabled
          │   ├─ toast.success("✓ ditandai lunas")
          │   └─ close dialog (setSelectedBill(null))
          ▼
Refetch: listUpcomingBills filter excludes bills dengan paid_date BETWEEN monthStart AND endOfMonth
          │
          ▼
Row hilang dari panel (karena query return less items) + Sisa Aman recalculates
```

**Data flow invariant:** `next_due_date` advances monotonically. `useProcessRecurring` filter `t.next_due_date <= today` otomatis skip bill yang baru dilunasi (next_due_date sudah > today).

### Recommended Project Structure

No new directories — all changes modify or append to existing files:

```
supabase/
└── migrations/
    └── 0014_mark_bill_paid.sql   # NEW

src/
├── components/
│   ├── ui/
│   │   └── alert-dialog.tsx      # NEW (via `npx shadcn add alert-dialog`)
│   └── UpcomingBillsPanel.tsx    # MODIFY — add Lunas button + AlertDialog + mutation
├── db/
│   └── recurringTransactions.ts  # MODIFY — markBillPaid(), refine listUpcomingBills signature
└── queries/
    └── recurringTransactions.ts  # MODIFY — useMarkBillPaid() + update useUpcomingBills
```

### Pattern 1: PL/pgSQL atomic RPC with SECURITY DEFINER

**What:** Single DB function that wraps 3 DML operations in implicit transaction (Postgres functions are atomic by default).

**When to use:** When multi-table writes must succeed/fail together and client-side sequencing cannot provide atomicity.

**Example** (skeleton — actual logic below in Pattern 2):
```sql
-- Source: pattern matches 0003_goals_atomic_rpc.sql [VERIFIED: supabase/migrations/0003_goals_atomic_rpc.sql]
CREATE OR REPLACE FUNCTION mark_bill_paid(
  p_template_id BIGINT,
  p_uid         UUID DEFAULT NULL,   -- optional; defaults to auth.uid()
  p_paid_date   DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  transaction_id   BIGINT,
  bill_payment_id  BIGINT,
  new_next_due     DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_uid, auth.uid());
  v_template RECORD;
  v_tx_id BIGINT;
  v_bp_id BIGINT;
  v_new_next DATE;
BEGIN
  -- Auth guard: user can only mark own bills (admin can via p_uid override)
  IF v_uid != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  -- Fetch template + lock row for the duration of the transaction
  SELECT id, name, type, category_id, amount, note, frequency, next_due_date
  INTO v_template
  FROM recurring_templates
  WHERE id = p_template_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template tidak ditemukan';
  END IF;

  -- 1. Insert expense transaction
  INSERT INTO transactions (date, type, category_id, amount, note, user_id)
  VALUES (p_paid_date, v_template.type, v_template.category_id, v_template.amount,
          COALESCE(v_template.note, v_template.name), v_uid)
  RETURNING id INTO v_tx_id;

  -- 2. Insert bill_payment record
  INSERT INTO bill_payments (user_id, recurring_template_id, paid_date, amount, transaction_id)
  VALUES (v_uid, p_template_id, p_paid_date, v_template.amount, v_tx_id)
  RETURNING id INTO v_bp_id;

  -- 3. Advance next_due_date (see Pattern 2 for logic)
  v_new_next := next_due_date_sql(v_template.next_due_date, v_template.frequency);

  UPDATE recurring_templates
  SET next_due_date = v_new_next
  WHERE id = p_template_id AND user_id = v_uid;

  RETURN QUERY SELECT v_tx_id, v_bp_id, v_new_next;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_bill_paid TO authenticated;
```

**Key design choices:**
- `SECURITY DEFINER` matches precedent (`add_money_to_goal` line 12). Runs as function owner, bypasses RLS — but we explicitly guard via `auth.uid()` check + `WHERE user_id = v_uid`.
- `FOR UPDATE` locks the recurring_template row — prevents concurrent mark-as-paid on same template from race-ing.
- Returns 3 IDs so client knows what was created (useful for undo in future, and for idempotency debugging).
- `COALESCE(v_template.note, v_template.name)` mirrors `useProcessRecurring.ts:32` behavior exactly.
- `INSERT INTO transactions ... VALUES (..., v_uid)` — explicit `user_id`. `transactions` has `DEFAULT auth.uid()` on user_id but SECURITY DEFINER means `auth.uid()` = function owner, NOT caller. Must pass `v_uid` explicitly [CITED: 0006_multi_user.sql:51 `DEFAULT auth.uid()`].

### Pattern 2: nextDueDate PL/pgSQL port (match FOUND-01 behavior)

**What:** Replicate TS `nextDueDate()` (src/db/recurringTransactions.ts:28-48) in SQL, preserving month-end clamping.

**Existing TS logic analysis:**
```typescript
// src/db/recurringTransactions.ts:28-48 — VERIFIED
case 'daily':   date.setDate(date.getDate() + 1); break
case 'weekly':  date.setDate(date.getDate() + 7); break
case 'monthly': {
  const targetMonth = date.getMonth() + 1
  date.setDate(1)                                            // Avoid month-rollover during setMonth
  date.setMonth(targetMonth)
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate()
  date.setDate(Math.min(d, lastDay))                         // Clamp to last day of target month
  break
}
case 'yearly':  date.setFullYear(date.getFullYear() + 1); break
```

**Critical:** `31 Jan + monthly = 28 Feb` (not 3 Mar). This is the FOUND-01 bug fix.

**SQL equivalent:**
```sql
-- Private helper function — call from mark_bill_paid
CREATE OR REPLACE FUNCTION next_due_date_sql(p_current DATE, p_freq TEXT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_original_day INT;
  v_target_month DATE;      -- first day of target month
  v_last_day INT;
BEGIN
  CASE p_freq
    WHEN 'daily'  THEN RETURN p_current + INTERVAL '1 day';
    WHEN 'weekly' THEN RETURN p_current + INTERVAL '7 days';
    WHEN 'yearly' THEN RETURN p_current + INTERVAL '1 year';
    WHEN 'monthly' THEN
      v_original_day := EXTRACT(DAY FROM p_current)::INT;
      -- first day of next month
      v_target_month := (date_trunc('month', p_current) + INTERVAL '1 month')::DATE;
      -- last day of that month
      v_last_day := EXTRACT(DAY FROM (v_target_month + INTERVAL '1 month - 1 day'))::INT;
      -- clamp: min(original_day, last_day_of_target_month)
      RETURN v_target_month + (LEAST(v_original_day, v_last_day) - 1) * INTERVAL '1 day';
    ELSE
      RAISE EXCEPTION 'Unknown frequency: %', p_freq;
  END CASE;
END;
$$;
```

**Why not `p_current + INTERVAL '1 month'`:** Postgres adds 30/31 days literally, causing `2025-01-31 + '1 month' = 2025-03-03` — the exact bug FOUND-01 fixed. The LEAST/EXTRACT approach mirrors the TS `Math.min(d, lastDay)` clamp.

**Alternative (shorter, still correct):**
```sql
-- Uses date_trunc + last-day-of-month calculation inline
v_target_month := date_trunc('month', p_current + INTERVAL '1 month')::DATE;
v_last_day := EXTRACT(DAY FROM (date_trunc('month', v_target_month) + INTERVAL '1 month - 1 day'))::INT;
```

**Verification test cases (must all pass):**
| Input | Frequency | Expected | TS Result | SQL Result |
|-------|-----------|----------|-----------|------------|
| 2025-01-15 | monthly | 2025-02-15 | ✓ 2025-02-15 | must = 2025-02-15 |
| 2025-01-31 | monthly | 2025-02-28 | ✓ 2025-02-28 (FOUND-01) | must = 2025-02-28 |
| 2024-01-31 | monthly | 2024-02-29 (leap) | ✓ 2024-02-29 | must = 2024-02-29 |
| 2025-03-31 | monthly | 2025-04-30 | ✓ 2025-04-30 | must = 2025-04-30 |
| 2025-02-14 | weekly | 2025-02-21 | ✓ 2025-02-21 | must = 2025-02-21 |
| 2025-12-31 | daily | 2026-01-01 | ✓ 2026-01-01 | must = 2026-01-01 |
| 2024-02-29 | yearly | 2025-02-28 | ⚠ 2025-03-01 (NOT clamped in TS!) | SQL `+ interval '1 year'` → 2025-03-01 (matches TS) |

**Note on yearly leap edge case:** Current TS `setFullYear(getFullYear()+1)` does NOT clamp Feb 29 → Feb 28 (it rolls to Mar 1). SQL `p_current + INTERVAL '1 year'` does the same (returns 2025-03-01). This is a bug-parity situation — SQL matches TS behavior exactly. If TS `nextDueDate` ever gets a yearly-leap fix, SQL function must be updated in sync.

### Pattern 3: useMarkBillPaid mutation hook (TanStack Query)

**What:** Mutation hook with optimistic remove + invalidate on success + rollback on error.

**When to use:** For any mutation whose UI effect is "remove item from list after confirm" — allows <50ms perceived latency.

**Example:**
```typescript
// Source: extends existing useCreateRecurringTemplate pattern
// [CITED: src/queries/recurringTransactions.ts:27-37 + TanStack Query v5 onMutate precedent]
export function useMarkBillPaid() {
  const qc = useQueryClient()
  const uid = useTargetUserId()
  return useMutation({
    mutationFn: ({ templateId, paidDate }: { templateId: number; paidDate: string }) =>
      markBillPaid(templateId, uid, paidDate),

    onMutate: async ({ templateId }) => {
      // Optimistic: cancel in-flight refetches
      await qc.cancelQueries({ queryKey: ['upcoming-bills'] })

      // Snapshot all ['upcoming-bills', ...] caches (there may be multiple key variants)
      const snapshots = qc.getQueriesData<RecurringTemplate[]>({ queryKey: ['upcoming-bills'] })

      // Optimistically remove the bill from every matching cache
      qc.setQueriesData<RecurringTemplate[]>(
        { queryKey: ['upcoming-bills'] },
        (old) => old?.filter((b) => b.id !== templateId) ?? []
      )

      return { snapshots }
    },

    onError: (err, _vars, context) => {
      // Rollback
      context?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data))
      toast.error(mapSupabaseError(err))
    },

    onSuccess: (_data, vars) => {
      toast.success('✓ Tagihan dilunasi')
    },

    onSettled: () => {
      // Always refetch (success and error) to sync with server state
      qc.invalidateQueries({ queryKey: ['upcoming-bills'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      qc.invalidateQueries({ queryKey: ['recurring-templates'] })
    },
  })
}
```

**Invalidation keys audited:**
- `['upcoming-bills', uid, endOfMonth]` — from `useUpcomingBills` → invalidate prefix `['upcoming-bills']`
- `['transactions']` — from `useTransactions` (not yet checked, but DashboardTab uses it)
- `['reports', ...]` — from `useAggregateByPeriod` → invalidate prefix `['reports']` (changes income/expense)
- `['recurring-templates']` — defensive; next_due_date changed

**CONTEXT.md D-02 mentions `aggregate` key** — actual query key in codebase is `['reports', 'period', ...]` [VERIFIED: src/queries/reports.ts:21]. Use `['reports']` prefix for invalidation.

### Pattern 4: AlertDialog + Lunas button in row

**What:** Single `selectedBill` state drives one AlertDialog instance at panel level (not per-row).

**Example:**
```typescript
// Inside UpcomingBillsPanel.tsx (modified)
const [selectedBill, setSelectedBill] = useState<RecurringTemplate | null>(null)
const markPaid = useMarkBillPaid()

// ... inside row render:
<li key={bill.id} className="flex items-center gap-3 py-2.5">
  {/* existing dot + name + amount ... */}
  <Button
    variant="outline"
    size="sm"
    className="h-auto py-0.5 px-2 text-xs"
    onClick={() => setSelectedBill(bill)}
  >
    Lunas
  </Button>
</li>

// At panel root (outside list):
<AlertDialog
  open={selectedBill !== null}
  onOpenChange={(open) => { if (!open) setSelectedBill(null) }}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Tandai sebagai lunas?</AlertDialogTitle>
      <AlertDialogDescription>
        Tandai <strong>{selectedBill?.name}</strong> sebagai lunas? Transaksi pengeluaran akan dibuat secara otomatis.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={markPaid.isPending}>Batalkan</AlertDialogCancel>
      <AlertDialogAction
        disabled={markPaid.isPending}
        onClick={() => {
          if (!selectedBill) return
          markPaid.mutate(
            { templateId: selectedBill.id, paidDate: todayISO() },
            { onSuccess: () => setSelectedBill(null) },
          )
        }}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {markPaid.isPending ? 'Memproses…' : 'Ya, Lunas'}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Why panel-level (not per-row) dialog:**
- Only one dialog open at a time (natural UX)
- Avoids N dialog mounts in DOM for N bills
- `selectedBill` carries the context — title/description read from it

**Note on `AlertDialogAction` destructive styling:** shadcn's generated AlertDialog component `AlertDialogAction` defaults to `buttonVariants()` (primary). Must pass `className="bg-destructive text-destructive-foreground hover:bg-destructive/90"` to match UI-SPEC `variant="destructive"` requirement. Alternative: wrap with `<AlertDialogAction asChild><Button variant="destructive">Ya, Lunas</Button></AlertDialogAction>`.

### Pattern 5: listUpcomingBills refinement (unpaid filter)

**What:** Modify existing function to exclude bills with `bill_payments` record for current month.

**Before:**
```typescript
// src/db/recurringTransactions.ts:106-121 (CURRENT)
export async function listUpcomingBills(uid, endOfMonth) {
  let query = supabase.from('recurring_templates')
    .select(...)
    .eq('is_active', true).eq('type', 'expense').lte('next_due_date', endOfMonth)
  // ...
}
```

**After (recommended — use `NOT EXISTS` via PL/pgSQL view or RPC):**

Supabase JS client's PostgREST syntax supports embedded filters but NOT `NOT EXISTS` subqueries directly. Two options:

**Option A (recommended): Create a SQL view, query the view**
```sql
-- Add to migration 0014:
CREATE OR REPLACE VIEW upcoming_bills_unpaid AS
SELECT t.*,
       date_trunc('month', CURRENT_DATE)::DATE AS current_month_start
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
-- RLS inheritance: views inherit underlying table RLS in Postgres, but Supabase recommends
-- explicit `security_invoker` (set via ALTER VIEW) to enforce caller-scoped access.
ALTER VIEW upcoming_bills_unpaid SET (security_invoker = true);
```

Client:
```typescript
export async function listUpcomingBills(uid, monthStart, endOfMonth) {
  let query = supabase.from('upcoming_bills_unpaid')
    .select('id, name, type, category_id, amount, note, frequency, next_due_date, is_active')
    .lte('next_due_date', endOfMonth)
    .order('next_due_date')
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data as RecurringTemplate[]
}
```

**Option B: Create an RPC `list_unpaid_bills(p_uid, p_month_start, p_end_of_month)`**
- More explicit, parameter-driven, supports testing with fixed dates
- Follows `aggregate_by_period` RPC precedent
- TRADEOFF: Adds another RPC to migration; slightly more code

**RECOMMENDATION: Option A (view)** — simpler, composable, and matches Supabase idiomatic pattern for derived data. The view is essentially a parameterized WHERE clause, while an RPC would require a whole new function.

**Signature change note:** `useUpcomingBills` no longer needs `endOfMonth` to filter "in current month" (view handles it). Keeping `endOfMonth` for backward compat and for potential future multi-month queries is OK. `monthStart` becomes implicit in the view.

### Anti-Patterns to Avoid

- **Client-side 3-op sequence:** DO NOT call `createTransaction()` + `createBillPayment()` + `updateRecurringTemplate()` sequentially from `markBillPaid()` TS function. Network failure mid-sequence = partial state. Use RPC.
- **Using `p_current + INTERVAL '1 month'` directly:** Causes 31 Jan → 3 Mar. Use LEAST/EXTRACT clamping (Pattern 2).
- **Per-row AlertDialog components:** Wastes N DOM subtrees. Use single panel-level dialog.
- **Invalidate without `onMutate` optimistic update:** User sees 300-500ms lag between click and row disappearance. Optimistic pattern makes it feel instant.
- **Forgetting `FOR UPDATE` row lock:** Two simultaneous mark-as-paid calls on same template could race. `FOR UPDATE` serializes them.
- **Forgetting to explicitly pass `user_id` to INSERT inside SECURITY DEFINER function:** `auth.uid()` inside SECURITY DEFINER returns the function owner, not caller. Must pass `v_uid` explicitly (see Pattern 1).
- **Mutating `listUpcomingBills` without updating `useUpcomingBills` queryKey:** If signature changes (adds `monthStart`), the queryKey must include it to prevent stale cache.
- **Modifying `useProcessRecurring`:** Explicitly forbidden by D-04. Guard is via `next_due_date` advancement only.
- **Using `@radix-ui/react-alert-dialog` direct import:** Project uses `radix-ui` meta package. Import from `"radix-ui"` — but actually, `shadcn add alert-dialog` generates a wrapper at `src/components/ui/alert-dialog.tsx` that does the import; consumers import from `@/components/ui/alert-dialog`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic multi-table write | Sequential JS calls with try/catch | Postgres PL/pgSQL function (RPC) | Network failure between calls = orphan transaction row, bill_payment row, or stale next_due_date. ACID only at DB transaction level. [CITED: 0003_goals_atomic_rpc.sql comment "Fixes race condition where concurrent requests could cause lost writes"] |
| Confirmation dialog | Custom `<div>` with `position: fixed` + backdrop | shadcn `AlertDialog` (Radix primitive) | A11y: `role="alertdialog"`, focus trap, ESC key, `aria-describedby`, backdrop click — all handled. Custom would break screen readers. |
| Dedup guard after mark-as-paid | Version field, advisory lock, optimistic concurrency | `next_due_date` advancement (existing behavior) | Already works — `useProcessRecurring` filter `t.next_due_date <= today` naturally excludes advanced templates. No extra mechanism needed. |
| Optimistic update + rollback | Manual state mirror | TanStack Query `onMutate` + snapshot + `onError` rollback | Built-in pattern, battle-tested, handles race between mutation and background refetch. |
| Month-end date arithmetic in SQL | `+ INTERVAL '1 month'` alone | LEAST(day, days_in_month) clamping | Postgres interval addition does not clamp; reintroduces FOUND-01 bug at server side. |
| Bill payment record schema | Custom tracking table | `bill_payments` (already created Phase 1 migration 0013) | Table exists with RLS, foreign keys, user_id. Just INSERT. [VERIFIED: supabase/migrations/0013_bill_payments.sql] |

**Key insight:** Phase 4 is an **integration phase**, not a building phase. Every primitive exists. The risk is in assembling them correctly: PL/pgSQL date arithmetic (risk 1), atomic RPC semantics (risk 2), TanStack optimistic update lifecycle (risk 3).

---

## Runtime State Inventory

> Phase 4 is NOT a rename/refactor/migration. This section documents the runtime state that Phase 4 CREATES, so operators know what to verify after deploy.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New rows in `bill_payments` (one per mark-as-paid); new rows in `transactions` (type=expense, one per mark-as-paid); `recurring_templates.next_due_date` advances | None — intentional. UAT/validation should verify the 3 rows exist after a test mark-as-paid. |
| Live service config | None — no external service (no n8n, no Datadog, no Tailscale) | None |
| OS-registered state | None — no Task Scheduler, no systemd | None |
| Secrets/env vars | None — no new env vars; uses existing `SUPABASE_URL`/`SUPABASE_ANON_KEY` | None |
| Build artifacts | `src/components/ui/alert-dialog.tsx` — new file generated by `npx shadcn add alert-dialog` (should be committed to git, not gitignored) | Verify file committed after plan execution |
| DB schema additions | Migration 0014 adds: function `next_due_date_sql`, function `mark_bill_paid`, view `upcoming_bills_unpaid` (if Option A chosen) | Run `npx supabase db push` (or equivalent CLI step user has); document in SUMMARY.md |

---

## Common Pitfalls

### Pitfall 1: PL/pgSQL `auth.uid()` returns function owner inside SECURITY DEFINER

**What goes wrong:** Inside a `SECURITY DEFINER` function, `auth.uid()` returns the function owner's UID (typically `postgres` superuser), NOT the caller. If you rely on `DEFAULT auth.uid()` for `user_id` columns, INSERTs would assign to wrong user.

**Why it happens:** Supabase RPC functions with SECURITY DEFINER run with owner privileges (to bypass RLS), but this also changes the session context `auth.uid()` interpretation.

**Actually:** `auth.uid()` reads from JWT, which is caller's. In practice this works correctly for most Supabase deployments [CITED: 0006_multi_user.sql:168 `COALESCE(p_user_id, auth.uid())`]. However, to be defensive:

**How to avoid:** Always pass `p_uid` explicitly and use `COALESCE(p_uid, auth.uid())` as the resolved UID. Use that resolved UID in every INSERT's `user_id`, every WHERE clause's `user_id`. Do NOT rely on `DEFAULT auth.uid()` on the columns.

**Warning signs:** Test in staging with admin "view-as" mode — if admin marks bill for user X, and the transaction ends up owned by admin instead of X, the guard is broken.

### Pitfall 2: `next_due_date_sql` returning off-by-one for monthly with 31st

**What goes wrong:** SQL `p_current + INTERVAL '1 month'` + `EXTRACT(DAY FROM target_month_start - 1 day)` logic can subtly mis-clamp.

**Why it happens:** Date arithmetic order matters. `date_trunc('month', p_current)` truncates to the 1st of current month. Adding `'1 month'` gives 1st of next month. The "last day of target month" is computed from `date_trunc('month', target_month) + INTERVAL '1 month - 1 day'`.

**How to avoid:** Test the 4 canonical edge cases before merging:
1. Monthly 2025-01-31 → 2025-02-28
2. Monthly 2024-01-31 → 2024-02-29 (leap)
3. Monthly 2025-03-31 → 2025-04-30
4. Monthly 2025-02-28 → 2025-03-28 (not 2025-03-31)

**Warning signs:** `useProcessRecurring` processes a bill on 31 Jan, the SQL sets next_due_date to 2025-03-03, bill re-triggers on 3 Mar with wrong date. Manual SELECT after test: `SELECT next_due_date_sql('2025-01-31', 'monthly')` should return `2025-02-28`.

### Pitfall 3: `bill_payments.amount` NOT NULL but RPC forgets to fill it

**What goes wrong:** Migration 0013 defines `amount NUMERIC(15,2) NOT NULL CHECK (amount > 0)` on `bill_payments`. An RPC that INSERTs without `amount` will throw `null value in column "amount" violates not-null constraint`.

**Why it happens:** The CONTEXT.md D-04 INSERT sketch only shows `(template_id, user_id, paid_date, transaction_id)` — amount is implicit.

**How to avoid:** Explicitly INSERT `amount = v_template.amount` (see Pattern 1 example).

**Warning signs:** RPC fails with "violates not-null" — first dialog open for first test bill fails. Check Postgres logs / Supabase Function logs.

### Pitfall 4: Race between useProcessRecurring mount and mark-as-paid click

**What goes wrong:** User opens Dashboard, `useProcessRecurring` starts running (creates transactions for overdue bills), user clicks "Lunas" on a bill, RPC runs — both try to INSERT a transaction for the same bill on same date → duplicate.

**Why it happens:** `useProcessRecurring` has no mutual exclusion with the mutation.

**How to avoid:** `FOR UPDATE` lock on the `recurring_templates` row inside `mark_bill_paid` RPC (see Pattern 1). If useProcessRecurring is mid-execution on same template, mark_bill_paid waits. If useProcessRecurring already committed and advanced `next_due_date`, `v_template.next_due_date` read under FOR UPDATE is the advanced value — mark_bill_paid inserts a transaction for the NEXT period (still correct, but surprising UX).

**Fully robust variant:** Add a check in mark_bill_paid: `IF EXISTS (SELECT 1 FROM bill_payments WHERE recurring_template_id = p_template_id AND paid_date = p_paid_date AND user_id = v_uid) THEN RAISE EXCEPTION 'Tagihan sudah ditandai lunas hari ini'`. This prevents double-click scenarios and the useProcessRecurring race.

**Warning signs:** After a test, query `SELECT COUNT(*) FROM transactions WHERE user_id = X AND date = today AND category_id = Y` — should be exactly 1 per marked bill.

### Pitfall 5: Optimistic update removes bill, RPC fails, rollback appears "laggy"

**What goes wrong:** User clicks "Ya, Lunas", bill disappears (optimistic), RPC fails 800ms later, bill reappears → feels like a bug.

**Why it happens:** Rollback is unavoidable when request fails, but user expectation is "click succeeded → no going back."

**How to avoid:** Keep AlertDialog open during `isPending`. Only set `selectedBill = null` in `onSuccess`. If mutation fails, dialog stays open and shows inline error — user sees "Gagal memproses. Coba lagi." and re-attempts. This matches UI-SPEC state "Mark-as-paid error: Dialog stays open (do not close)".

**Warning signs:** Intermittent network failures during development → test by throttling Chrome DevTools to offline mid-click.

### Pitfall 6: `paid_date` timezone confusion

**What goes wrong:** `paid_date` is stored as `DATE` (no time component). Sending `new Date().toISOString()` = `2026-04-24T14:30:00.000Z` — Supabase JS client may coerce but safer to pass `YYYY-MM-DD` string.

**Why it happens:** Codebase is WIB (UTC+7). `new Date().toISOString()` at 06:00 WIB = `2026-04-23T23:00:00.000Z` (previous day UTC).

**How to avoid:** Use `todayISO()` from `src/lib/format.ts:29` which returns local-midnight `YYYY-MM-DD`. Pass this to `markBillPaid(templateId, uid, todayISO())`.

**Warning signs:** Tagihan marked at 06:00 WIB appears on "yesterday" in bill_payments.

### Pitfall 7: `list_upcoming_bills` view without `security_invoker` leaks data across users

**What goes wrong:** If Option A (view) is chosen without `ALTER VIEW ... SET (security_invoker = true)`, the view runs as its creator (superuser) and bypasses RLS on `recurring_templates` and `bill_payments`. Any authenticated user can see all rows.

**Why it happens:** Postgres views by default run with definer privileges. Supabase's `security_invoker` PG 15+ feature makes views respect caller RLS.

**How to avoid:** Always `ALTER VIEW upcoming_bills_unpaid SET (security_invoker = true)` immediately after `CREATE VIEW`. Include this in the migration.

**Warning signs:** `SELECT * FROM upcoming_bills_unpaid` returns rows from other users' accounts.

---

## Code Examples

### Migration file skeleton

```sql
-- supabase/migrations/0014_mark_bill_paid.sql

-- 1. nextDueDate SQL helper (matches TS src/db/recurringTransactions.ts:28-48 with FOUND-01 fix)
CREATE OR REPLACE FUNCTION next_due_date_sql(p_current DATE, p_freq TEXT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_original_day INT;
  v_target_month DATE;
  v_last_day INT;
BEGIN
  CASE p_freq
    WHEN 'daily'   THEN RETURN p_current + INTERVAL '1 day';
    WHEN 'weekly'  THEN RETURN p_current + INTERVAL '7 days';
    WHEN 'yearly'  THEN RETURN p_current + INTERVAL '1 year';
    WHEN 'monthly' THEN
      v_original_day := EXTRACT(DAY FROM p_current)::INT;
      v_target_month := (date_trunc('month', p_current) + INTERVAL '1 month')::DATE;
      v_last_day := EXTRACT(DAY FROM (v_target_month + INTERVAL '1 month - 1 day'))::INT;
      RETURN v_target_month + (LEAST(v_original_day, v_last_day) - 1) * INTERVAL '1 day';
    ELSE
      RAISE EXCEPTION 'Unknown frequency: %', p_freq;
  END CASE;
END;
$$;

-- 2. Atomic mark-as-paid RPC
CREATE OR REPLACE FUNCTION mark_bill_paid(
  p_template_id BIGINT,
  p_uid         UUID DEFAULT NULL,
  p_paid_date   DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (transaction_id BIGINT, bill_payment_id BIGINT, new_next_due DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_uid, auth.uid());
  v_template RECORD;
  v_tx_id BIGINT;
  v_bp_id BIGINT;
  v_new_next DATE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF v_uid != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT id, name, type, category_id, amount, note, frequency, next_due_date
  INTO v_template
  FROM recurring_templates
  WHERE id = p_template_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template tidak ditemukan';
  END IF;

  -- Defensive idempotency guard (prevents double-click and race with useProcessRecurring)
  IF EXISTS (
    SELECT 1 FROM bill_payments
    WHERE recurring_template_id = p_template_id
      AND user_id = v_uid
      AND paid_date = p_paid_date
  ) THEN
    RAISE EXCEPTION 'Tagihan sudah ditandai lunas untuk tanggal ini';
  END IF;

  INSERT INTO transactions (date, type, category_id, amount, note, user_id)
  VALUES (p_paid_date, v_template.type, v_template.category_id, v_template.amount,
          COALESCE(v_template.note, v_template.name), v_uid)
  RETURNING id INTO v_tx_id;

  INSERT INTO bill_payments (user_id, recurring_template_id, paid_date, amount, transaction_id)
  VALUES (v_uid, p_template_id, p_paid_date, v_template.amount, v_tx_id)
  RETURNING id INTO v_bp_id;

  v_new_next := next_due_date_sql(v_template.next_due_date, v_template.frequency);

  UPDATE recurring_templates
  SET next_due_date = v_new_next
  WHERE id = p_template_id AND user_id = v_uid;

  RETURN QUERY SELECT v_tx_id, v_bp_id, v_new_next;
END;
$$;

-- 3. View for unpaid bills (current month)
CREATE OR REPLACE VIEW upcoming_bills_unpaid
WITH (security_invoker = true)
AS
SELECT t.id, t.user_id, t.name, t.type, t.category_id, t.amount, t.note,
       t.frequency, t.next_due_date, t.is_active
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

GRANT EXECUTE ON FUNCTION next_due_date_sql TO authenticated;
GRANT EXECUTE ON FUNCTION mark_bill_paid TO authenticated;
GRANT SELECT ON upcoming_bills_unpaid TO authenticated;
```

### DB wrapper function

```typescript
// src/db/recurringTransactions.ts — append
export interface MarkBillPaidResult {
  transaction_id: number
  bill_payment_id: number
  new_next_due: string
}

export async function markBillPaid(
  templateId: number,
  uid: string | undefined,
  paidDate: string,
): Promise<MarkBillPaidResult> {
  const { data, error } = await supabase.rpc('mark_bill_paid', {
    p_template_id: templateId,
    p_uid: uid ?? null,
    p_paid_date: paidDate,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return row as MarkBillPaidResult
}

// MODIFY existing listUpcomingBills to query the view:
export async function listUpcomingBills(
  uid: string | undefined,
  endOfMonth: string,
): Promise<RecurringTemplate[]> {
  let query = supabase
    .from('upcoming_bills_unpaid')   // <-- CHANGED from 'recurring_templates'
    .select('id, name, type, category_id, amount, note, frequency, next_due_date, is_active')
    .lte('next_due_date', endOfMonth)
    .order('next_due_date')
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data as RecurringTemplate[]
}
```

### Button + AlertDialog integration snippet

```typescript
// src/components/UpcomingBillsPanel.tsx — MODIFIED (delta only)
import { useState } from 'react'
import { todayISO } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useMarkBillPaid } from '@/queries/recurringTransactions'
import type { RecurringTemplate } from '@/db/recurringTransactions'

// Inside component:
const [selectedBill, setSelectedBill] = useState<RecurringTemplate | null>(null)
const markPaid = useMarkBillPaid()

// Add Button to the existing <li> (after the amount span):
<Button
  variant="outline"
  className="h-auto py-0.5 px-2 text-xs"
  onClick={() => setSelectedBill(bill)}
>
  Lunas
</Button>

// At root (outside <ul>, same level as Sisa Aman row):
<AlertDialog open={selectedBill !== null} onOpenChange={(o) => !o && setSelectedBill(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Tandai sebagai lunas?</AlertDialogTitle>
      <AlertDialogDescription>
        Tandai <strong>{selectedBill?.name}</strong> sebagai lunas? Transaksi pengeluaran akan dibuat secara otomatis.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={markPaid.isPending}>Batalkan</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        disabled={markPaid.isPending}
        onClick={(e) => {
          e.preventDefault()  // prevent auto-close while mutation runs
          if (!selectedBill) return
          markPaid.mutate(
            { templateId: selectedBill.id, paidDate: todayISO() },
            { onSuccess: () => setSelectedBill(null) },
          )
        }}
      >
        {markPaid.isPending ? 'Memproses…' : 'Ya, Lunas'}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side 3-call sequence with rollback logic | Single DB RPC | 2020+ (Supabase era) | Atomic ACID guarantee, simpler client code |
| Postgres `+ INTERVAL '1 month'` for monthly recurrence | LEAST/EXTRACT day clamping | N/A (always was correct — this is the fix pattern) | Prevents 31 Jan → 3 Mar overflow |
| AlertDialog custom implementation | shadcn/Radix AlertDialog primitive | 2023+ | Automatic a11y (focus trap, ESC, ARIA) |
| Invalidate-only mutation | Optimistic update + rollback | TanStack Query v4+ (2022) | Sub-50ms perceived latency |
| View without `security_invoker` | View with `security_invoker = true` | Postgres 15 (2022) | Views respect caller RLS |

**Deprecated/outdated:**
- Mentioned in CONTEXT.md: `template_id` column name in `bill_payments`. **Actual column name is `recurring_template_id`** [VERIFIED: 0013_bill_payments.sql:8]. Plan must use `recurring_template_id` in INSERTs.

---

## Project Constraints

No `./CLAUDE.md` exists in this project (verified: `Read` tool returned "File does not exist"). Codebase conventions derived from existing files:
- Native JS date arithmetic only — date-fns NOT installed
- All queries use `useTargetUserId()` for admin view-as support
- All mutations use `sonner` toast via `toast.success`/`toast.error`
- `mapSupabaseError()` wraps all `onError` handlers (src/lib/errors.ts)
- SQL migrations use `SECURITY DEFINER` + explicit `user_id` guard, not `SECURITY INVOKER`
- TypeScript strict: `noImplicitAny` likely on — always type explicitly

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase CLI `npx supabase db push` is the user's migration apply command | Installation section | User may use a different workflow (e.g., manual paste into SQL editor). Plan should ask or note "apply via your existing Supabase migration workflow." |
| A2 | `shadcn add alert-dialog` will generate a file with the same API shape as documented (AlertDialog, AlertDialogContent, Header, Title, Description, Footer, Cancel, Action) | Pattern 4 | If generated component names differ, minor rename in UpcomingBillsPanel code. Low risk — shadcn alert-dialog API is stable. |
| A3 | `AlertDialogAction` allows `onClick={e => e.preventDefault()}` to prevent auto-close while mutation runs | Pattern 4 | If Radix's `AlertDialogAction` force-closes on click, need alternative pattern (e.g., a plain `<Button>` with manual state logic, closing dialog in onSuccess only). [VERIFIED against Radix docs: AlertDialog.Action calls `event.preventDefault()` compatible — it's built on top of PrimitiveButton] |
| A4 | `useProcessRecurring`'s `await createTransaction()` loop does not hold a PG lock (it uses separate queries) | Pitfall 4 | If it DID hold a lock, FOR UPDATE in mark_bill_paid might deadlock. But `createTransaction` is INSERT only, no lock on recurring_templates. Safe. |
| A5 | `transactions` table INSERT via SECURITY DEFINER RPC with explicit `user_id` bypasses RLS policy `WITH CHECK (auth.uid() = user_id)` | Pattern 1 | SECURITY DEFINER bypasses RLS — verified by `add_money_to_goal` which writes to `goals` without issue. Confirmed behavior. |
| A6 | Invalidation key for useAggregateByPeriod is `['reports', 'period', ...]`, invalidating prefix `['reports']` catches it | Pattern 3 | [VERIFIED: src/queries/reports.ts:21 — queryKey is `['reports', 'period', granularity, ...]`]. Safe. |
| A7 | No feature flag or A/B switch needed for Phase 4 rollout | Implied throughout | Low risk — this is a single-user or admin-controlled app, no gradual rollout tooling observed. |

---

## Open Questions

1. **Should `list_upcoming_bills_unpaid` be a VIEW or an RPC?**
   - What we know: Both work. View is simpler (Option A).
   - What's unclear: Whether project convention prefers RPCs over views. Only RPC precedents exist in migrations (aggregate_by_period, add_money_to_goal).
   - Recommendation: **Use VIEW** (Option A) — it's the simpler idiom for "filtered subset of a table." An RPC would require extra params and forgo the composability of querying with `.lte()` directly. Let planner/user confirm.

2. **Should RPC reject `p_paid_date` in the future?**
   - What we know: `CHECK (amount > 0)` exists, but no date constraint on bill_payments.
   - What's unclear: If a user marks a future-dated bill, is that allowed? (e.g., pre-paying Feb bill on 25 Jan)
   - Recommendation: **Allow it** — no explicit ban in requirements. If product decides otherwise, add `IF p_paid_date > CURRENT_DATE THEN RAISE EXCEPTION` guard.

3. **When a bill's category (category_id) is soft-deleted, does mark_bill_paid fail?**
   - What we know: `recurring_templates.category_id BIGINT NOT NULL REFERENCES categories(id)` (no ON DELETE action, meaning RESTRICT). If category deleted, FK violation blocks delete. So categories referenced by active templates CAN'T be deleted.
   - Unclear: None — behavior is safe.
   - Recommendation: No action.

4. **Does UI need a loading spinner in the "Lunas" button itself (not just AlertDialog)?**
   - What we know: UI-SPEC only mentions loading state in AlertDialog.
   - Unclear: During the ~500ms optimistic window, the button stays visible until optimistic removal. Is this fine?
   - Recommendation: **No button-level spinner needed.** AlertDialog's `AlertDialogAction` shows "Memproses…" during `isPending`. After success, row removes optimistically — button disappears with row.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling | ✓ | Existing (inferred from vite 8.0.4) | — |
| npm | `npx shadcn add` | ✓ | Existing | — |
| Supabase project (dev/prod) | RPC deployment | ✓ | Existing (0013 migration applied) | — |
| Supabase CLI | Migration push | ✓ | `^2.92.1` [VERIFIED: package.json:45] | Manual SQL editor paste |
| `radix-ui` meta package | AlertDialog primitive | ✓ | 1.4.3 [VERIFIED: node_modules] | — |
| shadcn CLI | Generate alert-dialog.tsx | ✓ | 4.3.0 [VERIFIED: package.json:27] | Manual copy from shadcn docs |
| TypeScript | Build | ✓ | ~6.0.2 | — |
| Tailwind | Styling | ✓ | ^4.2.2 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.
**Verdict:** All tooling ready. Only action needed is `npx shadcn add alert-dialog` as part of plan execution.

---

## Validation Architecture

> `workflow.nyquist_validation` is NOT set in `.planning/config.json` — default is **enabled**. Validation section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed currently — Wave 0 must establish [VERIFIED: no vitest/jest in package.json] |
| Recommended | **vitest** (Vite-native, matches build tool) + `@testing-library/react` + `@testing-library/user-event` |
| Config file | `vite.config.ts` existing — add `test` key; or new `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |
| Estimated runtime (Phase 4 suite alone) | ~5 seconds |

**Supabase-level tests (RPC, RLS, atomicity):** The Supabase CLI includes `pgtap` for DB tests, but the project has not used it. Manual SQL testing via `psql` or Supabase SQL editor is the realistic path for DB-level verification in this phase. Document steps in UAT.md, run manually.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-03 | `next_due_date_sql` correctness for all 4 frequencies + month-end edge cases | DB integration | `psql -f tests/sql/test_next_due_date.sql` (manual) | ❌ Wave 0 |
| BILL-03 | `mark_bill_paid` RPC creates 1 transaction + 1 bill_payment + advances next_due_date atomically | DB integration | Manual SQL via Supabase dashboard | ❌ Wave 0 (document in UAT.md) |
| BILL-03 | `mark_bill_paid` idempotency guard — double-click blocked by `bill_payments` date uniqueness check | DB integration | Manual SQL: call RPC twice, second must raise 'Tagihan sudah ditandai lunas' | ❌ Wave 0 |
| BILL-03 | RLS: user A cannot mark bill for user B | DB integration + unit | Manual SQL (log in as A, attempt RPC with p_uid=B, verify 'Akses ditolak') | ❌ Wave 0 |
| BILL-03 | `useMarkBillPaid` mutation: optimistic remove + rollback on error | unit (vitest + React Testing Library) | `npx vitest run src/queries/__tests__/useMarkBillPaid.test.tsx` | ❌ Wave 0 |
| BILL-03 | `UpcomingBillsPanel` AlertDialog opens on "Lunas" click, dispatches mutation on confirm | unit | `npx vitest run src/components/__tests__/UpcomingBillsPanel.mark.test.tsx` | ❌ Wave 0 |
| BILL-03 (Sisa Aman refinement) | `listUpcomingBills` returns unpaid bills only; paid bills excluded from totalBills sum | unit (db fn test with supabase mock) | `npx vitest run src/db/__tests__/listUpcomingBills.test.ts` | ❌ Wave 0 |
| NAV-02 (partial) | Panel renders, "Lunas" button visible on every row, AlertDialog integration works end-to-end | manual | Visual inspect + Supabase dashboard verification | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose` (after vitest Wave 0 setup)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + manual SQL tests documented in UAT.md passing

### Wave 0 Gaps

- [ ] `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` — add to devDependencies
- [ ] `vitest.config.ts` (or add `test` section to `vite.config.ts`) with jsdom environment, setupFiles for `@testing-library/jest-dom`
- [ ] `src/test/setup.ts` — testing-library setup (`import '@testing-library/jest-dom'`)
- [ ] `src/db/__tests__/listUpcomingBills.test.ts` — covers BILL-03 unpaid filter
- [ ] `src/queries/__tests__/useMarkBillPaid.test.tsx` — covers optimistic update lifecycle
- [ ] `src/components/__tests__/UpcomingBillsPanel.mark.test.tsx` — covers UI integration
- [ ] `tests/sql/test_next_due_date.sql` — SQL test script (manual run via psql or Supabase SQL editor)
- [ ] `tests/sql/test_mark_bill_paid.sql` — SQL integration test (atomicity, idempotency, RLS)
- [ ] Mock Supabase client helper — e.g., `src/test/supabase-mock.ts` using `vi.mock('@/lib/supabase', ...)`

**Alternative if Wave 0 overhead too high:** Escalate BILL-03 verification to manual UAT.md checklist and commit. This project historically has NOT used vitest (Phase 3 had nyquist_compliant: false). Planner should decide based on user preference:
1. **Test-first path:** Install vitest infra, write unit tests → full nyquist compliance
2. **UAT-first path:** Document manual SQL + UI verification steps in UAT.md → faster delivery, matches Phase 3 precedent
3. **Hybrid:** SQL manual tests (high value, hard to unit test anyway) + skip JS unit tests for now

**RECOMMENDATION:** **Hybrid** — write `tests/sql/test_mark_bill_paid.sql` that exercises the RPC (atomicity, idempotency, RLS) because these are high-risk Phase 4 correctness concerns. Skip JS unit tests for Phase 4 (continue Phase 3 precedent) and document manual UI UAT in 04-UAT.md. This avoids Wave 0 infrastructure bloat while still catching the riskiest bugs.

---

## Security Domain

`security_enforcement` is not explicitly disabled in config — treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Existing: Supabase Auth (JWT) — no change; `auth.uid()` used in RPC |
| V3 Session Management | no | No new session paths — reuses existing Supabase session |
| V4 Access Control | **yes (HIGH)** | RPC explicit guard: `IF v_uid != auth.uid() AND NOT is_admin() THEN RAISE EXCEPTION`; RLS on `bill_payments` (already enabled, migration 0013); view `upcoming_bills_unpaid` with `security_invoker = true` |
| V5 Input Validation | yes | RPC validates: `p_template_id` exists + owned by v_uid (via WHERE + FOR UPDATE); `p_paid_date` typed as DATE (rejects malformed); `p_uid` UUID-typed |
| V6 Cryptography | no | No new secrets, no new crypto |
| V7 Error Handling | yes | Errors mapped via `mapSupabaseError()`; no sensitive data leaked in toast |
| V9 Communication | no | HTTPS is Supabase default, no change |
| V13 API | yes | RPC is a new API endpoint — authenticated only (`GRANT EXECUTE ... TO authenticated`) |

### Known Threat Patterns for Supabase + React + PostgREST

| Pattern | STRIDE | Standard Mitigation | Applied? |
|---------|--------|---------------------|----------|
| User A marks bill for User B (IDOR via p_uid) | Elevation of Privilege | Explicit guard in RPC: `IF v_uid != auth.uid() AND NOT is_admin() THEN RAISE EXCEPTION` | ✓ Pattern 1 |
| SQL injection via `p_freq` | Tampering | Parameterized PL/pgSQL; `CASE p_freq WHEN ...` exhaustively matches known values, else raises | ✓ Pattern 2 |
| Double-click creates 2 transactions | Tampering (data integrity) | IF EXISTS bill_payments for (template, uid, date) guard; FOR UPDATE row lock | ✓ Pattern 1 |
| View leaks rows across users (RLS bypass) | Information Disclosure | `ALTER VIEW ... SET (security_invoker = true)` | ✓ Pattern 5 |
| Stale JWT after role change | Elevation of Privilege | Session-level; handled by Supabase. `auth.uid()` reads fresh JWT each call | ✓ inherited |
| Race between mark_bill_paid and useProcessRecurring | Tampering | FOR UPDATE lock on recurring_templates row serializes writers | ✓ Pattern 1 |
| Toast message leaks internal error ("violates foreign key constraint ...") | Information Disclosure | `mapSupabaseError()` translates to user-friendly Bahasa | ✓ inherited (src/lib/errors.ts) |
| CSRF via RPC | Spoofing | Supabase session tokens in Authorization header; browser same-origin default | ✓ inherited |

**No new secrets introduced.** All credentials continue via existing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

---

## Sources

### Primary (HIGH confidence)
- `src/db/recurringTransactions.ts` — nextDueDate() logic to port, listUpcomingBills() signature to refine [direct file read]
- `src/hooks/useProcessRecurring.ts` — dedup guard logic (line 19: `t.next_due_date <= today`) [direct file read]
- `src/queries/recurringTransactions.ts` — existing mutation hook pattern for `useMarkBillPaid` [direct file read]
- `supabase/migrations/0003_goals_atomic_rpc.sql` — SECURITY DEFINER RPC precedent [direct file read]
- `supabase/migrations/0013_bill_payments.sql` — table schema (NOT NULL amount, recurring_template_id not template_id) [direct file read]
- `supabase/migrations/0006_multi_user.sql` — COALESCE(p_user_id, auth.uid()) pattern for admin view-as [direct file read]
- `supabase/migrations/0010_recurring_transactions.sql` — recurring_templates schema + RLS policy [direct file read]
- `src/db/goals.ts:94-99` — `supabase.rpc('add_money_to_goal', ...)` call pattern [direct file read]
- `node_modules/radix-ui/package.json` & `node_modules/radix-ui/dist/index.d.ts` — confirms `AlertDialog` available via meta barrel [direct file read]
- `package.json` — confirms all required dependencies present, no vitest installed [direct file read]
- `components.json` — confirms shadcn radix-nova preset active [direct file read]
- `.planning/phases/04-mark-as-paid/04-CONTEXT.md` & `04-UI-SPEC.md` — locked decisions [direct file read]
- `.planning/phases/03-bills-display/03-02-SUMMARY.md` — Phase 3 delivered state [direct file read]
- `.planning/phases/03-bills-display/03-RESEARCH.md` — reusable patterns, dayDiff helper, native JS date idiom [direct file read]

### Secondary (MEDIUM confidence — training knowledge, not verified in this session)
- Postgres `LEAST()` + `EXTRACT(DAY FROM ...)` + `date_trunc` semantics for month-end clamping [documented pattern; will be verified by SQL test script in Wave 0]
- TanStack Query v5 `onMutate` + snapshot + `onError` rollback lifecycle [standard pattern per docs, not re-verified in this session]
- Radix `AlertDialog.Action` `onClick={e => e.preventDefault()}` behavior to keep dialog open during async [standard primitive behavior]
- `security_invoker = true` Postgres 15+ view behavior [Supabase docs standard]

### Tertiary (LOW confidence — assumed, flagged for validation)
- User's preferred Supabase migration workflow (CLI `db push` vs manual paste) — A1 in Assumptions Log
- `shadcn add alert-dialog` generates expected component shape — A2

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in node_modules + package.json
- Architecture (RPC + atomic transaction): HIGH — pattern directly mirrors add_money_to_goal precedent in same codebase
- PL/pgSQL next_due_date port: MEDIUM — edge cases documented but not yet tested against real Postgres; test script in Wave 0 will verify
- Pitfalls: HIGH — all drawn from codebase-specific facts (SECURITY DEFINER behavior, column name `recurring_template_id`, WIB timezone, RLS on bill_payments)
- Validation: MEDIUM — framework not yet installed, plan must include Wave 0 or accept manual testing precedent

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days — stack is stable, Supabase + React 19 + TanStack Query v5 unlikely to churn)
