# Technology Stack — Milestone v1.0 Feature Additions

**Project:** Kantong Pintar
**Milestone:** Net Worth Tracker + Upcoming Bills Calendar
**Researched:** 2026-04-23
**Confidence:** HIGH (all conclusions grounded in codebase inspection + Recharts/Supabase official patterns)

---

## Verdict: Zero New Runtime Dependencies

Both features can be fully implemented with the existing stack. No new `npm install` required.

---

## Feature 1: Net Worth Tracker

### What needs to be built

| Layer | What | How |
|-------|------|-----|
| DB | Two new tables: `financial_accounts` + `net_worth_snapshots` | Supabase migration |
| DB | RLS policies with `user_id` and admin view-as support | Same pattern as all other tables |
| Data layer | `src/db/netWorth.ts` | Same pattern as `src/db/investments.ts` |
| Query layer | `src/queries/netWorth.ts` | Same pattern as `src/queries/investments.ts` |
| UI | `src/tabs/NetWorthTab.tsx` | New tab |
| UI | Dashboard summary card + sparkline | Added to `DashboardTab.tsx` |

### Database Schema (new tables)

```sql
-- Rekening dan aset non-investasi (manual input)
CREATE TABLE financial_accounts (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,           -- "BCA Tabungan", "Dana Darurat Cash"
  type        TEXT NOT NULL CHECK (type IN ('bank', 'cash', 'receivable', 'other_asset', 'credit_card', 'loan', 'kpr', 'other_liability')),
  balance     NUMERIC(15,2) NOT NULL DEFAULT 0,
  note        TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Snapshot bulanan net worth untuk trend chart
CREATE TABLE net_worth_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,         -- selalu tanggal 1 bulan (YYYY-MM-01)
  total_assets  NUMERIC(15,2) NOT NULL,
  total_liabilities NUMERIC(15,2) NOT NULL,
  net_worth     NUMERIC(15,2) NOT NULL GENERATED ALWAYS AS (total_assets - total_liabilities) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_date)     -- satu snapshot per bulan per user
);
```

### Supabase RLS Pattern

Follow the exact pattern from `recurring_templates` (migration 0010) — the most recently established and cleanest pattern:

```sql
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fa_select" ON financial_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "fa_write" ON financial_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nws_select" ON net_worth_snapshots FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "nws_write" ON net_worth_snapshots FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### Snapshot Strategy: Manual Trigger with Upsert

Do NOT auto-snapshot on every balance edit — this creates noise. Instead:

- Snapshot is triggered explicitly when the user saves changes on the Net Worth tab ("Simpan & Rekam Snapshot").
- The snapshot date is always forced to the first day of the current month (`YYYY-MM-01`) to keep the trend chart clean.
- Use `INSERT ... ON CONFLICT (user_id, snapshot_date) DO UPDATE` so re-saving in the same month overwrites rather than appending.
- On first load, if no snapshot exists for the current month, auto-create one silently (no toast needed).

```typescript
// Pattern: upsert snapshot
const { error } = await supabase
  .from('net_worth_snapshots')
  .upsert(
    { user_id: uid, snapshot_date: firstOfMonth, total_assets, total_liabilities },
    { onConflict: 'user_id,snapshot_date' }
  )
```

### Date Manipulation: No Library Needed

The existing `src/lib/format.ts` `todayISO()` + manual arithmetic is sufficient. A "first of month" helper belongs directly in the net worth data layer or format module:

```typescript
// Add to src/lib/format.ts
export function firstOfMonthISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
```

Do NOT add `date-fns`. The existing codebase deliberately avoids it (confirmed: not in `package.json`). All date operations are simple enough to do with native `Date`.

### Net Worth Trend Chart: Recharts AreaChart (already installed)

Use the same `AreaChart` already used in `src/tabs/pensiun/SimulasiPanel.tsx`. For the dashboard sparkline variant (compact, no axes), suppress the axes with Recharts props — no separate sparkline library needed:

```tsx
// Full chart on NetWorthTab — same pattern as SimulasiPanel.tsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Compact sparkline on Dashboard — hide axes and grid
<ResponsiveContainer width="100%" height={48}>
  <AreaChart data={snapshots} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
    <Area type="monotone" dataKey="net_worth" stroke="#6366f1" fill="#6366f140" dot={false} />
    {/* No XAxis, YAxis, CartesianGrid, Tooltip for sparkline */}
  </AreaChart>
</ResponsiveContainer>
```

Confidence: HIGH — `AreaChart` without axis components is documented Recharts behavior and already proven in the codebase.

### What Reuses Existing Stack

| Concern | Existing Mechanism | Reuse |
|---------|-------------------|-------|
| Data fetching | TanStack React Query v5 | `useQuery` + `useMutation` in `src/queries/netWorth.ts` |
| State | Zustand not needed — server state only | React Query handles it |
| Toast feedback | Sonner (already installed) | Same `toast.success/error` pattern |
| Formatting | `formatRupiah`, `shortRupiah` from `src/lib/format.ts` | Direct reuse |
| Admin view-as | `useTargetUserId()` hook | Pass `uid` to all DB queries, same as investments |
| UI components | shadcn/ui `Card`, `Input`, `Button`, `Badge` | Direct reuse |
| Charts | Recharts 3 `AreaChart` | Already imported in SimulasiPanel |

---

## Feature 2: Upcoming Bills Calendar

### What needs to be built

| Layer | What | How |
|-------|------|-----|
| DB | No new tables — `recurring_templates` already has everything | Read existing table |
| DB | Optional: `bill_payments` table to track mark-as-paid without creating a full transaction | New table (see below) |
| Data layer | `src/db/upcomingBills.ts` | Client-side computation from recurring_templates data |
| Query layer | `src/queries/upcomingBills.ts` | Wraps existing `useRecurringTemplates` query |
| UI | Dashboard panel "Tagihan Mendatang" | Added to `DashboardTab.tsx` |
| UI | Optional dedicated section or modal | Depends on UX decision |

### Existing Data — Already Sufficient

`recurring_templates` has `next_due_date`, `frequency`, `amount`, `is_active`, `name`, `type`. All bills data exists. No new DB table is needed to *display* upcoming bills — just filter and project forward from the existing query.

```typescript
// Pure computation — no new library
function getUpcomingBills(templates: RecurringTemplate[], days = 14): UpcomingBill[] {
  const today = todayISO()
  const cutoff = addDays(today, days)   // see date helper below
  const bills: UpcomingBill[] = []

  for (const t of templates) {
    if (!t.is_active || t.type !== 'expense') continue
    let due = t.next_due_date
    let iterations = 0
    while (due <= cutoff && iterations < 5) {
      if (due >= today) bills.push({ ...t, due_date: due })
      due = nextDueDate(due, t.frequency)   // already exists in src/db/recurringTransactions.ts
      iterations++
    }
  }

  return bills.sort((a, b) => a.due_date.localeCompare(b.due_date))
}
```

`nextDueDate` is already implemented in `src/db/recurringTransactions.ts` — reuse directly.

### Mark-as-Paid: Two Options

**Option A — Mark paid without a transaction (simpler, YAGNI-safe):**

Add a small `bill_payments` table that records which template was marked paid for which due date. This avoids polluting `transactions` with auto-created entries and lets the user explicitly control what becomes a real transaction.

```sql
CREATE TABLE bill_payments (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurring_template_id BIGINT NOT NULL REFERENCES recurring_templates(id) ON DELETE CASCADE,
  due_date              DATE NOT NULL,
  paid_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, recurring_template_id, due_date)
);
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bp_all" ON bill_payments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Display logic: a bill is "paid" if a `bill_payments` row exists for `(template_id, due_date)`. The existing `useProcessRecurring` hook already handles advancing `next_due_date` when a real transaction is auto-created.

**Option B — Mark paid by creating a real transaction (reuses existing flow):**

Call `createTransaction` + `updateRecurringTemplate` (advance `next_due_date`) when user clicks "Sudah Bayar". This is essentially what `useProcessRecurring` does automatically for overdue items. Simpler schema-wise but conflates "I marked it paid" with "this transaction happened."

**Recommendation: Option A (bill_payments table).** Keeps the mark-as-paid state separate from the transaction ledger. The user retains control — they can create a real transaction separately if they want the expense recorded. This is the cleaner separation of concerns.

### Cashflow Projection: Pure Computation

"Sisa aman bulan ini" = `projected_income_this_month - projected_bills_this_month`.

```typescript
function projectCashflow(
  templates: RecurringTemplate[],
  monthlyIncome: number,   // from existing useAggregateByPeriod
): number {
  const monthStart = firstOfMonthISO()
  const monthEnd = lastOfMonthISO()   // simple date helper, see below
  const bills = getUpcomingBills(templates, 31)
    .filter(b => b.due_date <= monthEnd)
  const totalBills = bills.reduce((s, b) => s + b.amount, 0)
  return monthlyIncome - totalBills
}
```

Uses `monthlyIncome` from the existing `useAggregateByPeriod('month', ...)` query already called in `DashboardTab.tsx` — no additional data fetch needed.

### Date Helpers Needed (Add to src/lib/format.ts)

```typescript
// Add to src/lib/format.ts — native Date, no library
export function firstOfMonthISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function lastOfMonthISO(): string {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
```

All three are pure native Date arithmetic — same style as the existing `nextDueDate` in `src/db/recurringTransactions.ts`. No `date-fns`, no `dayjs`, no `luxon`.

### What Reuses Existing Stack

| Concern | Existing Mechanism | Reuse |
|---------|-------------------|-------|
| Bills data | `listRecurringTemplates` in `src/db/recurringTransactions.ts` | Direct reuse |
| Date projection | `nextDueDate` in `src/db/recurringTransactions.ts` | Direct reuse |
| Monthly income | `useAggregateByPeriod` already in DashboardTab | Share the existing query result via prop or context |
| UI | shadcn/ui `Badge`, `Button`, `Card` | Direct reuse |
| Mark-paid feedback | Sonner toast | Same pattern |
| Admin view-as | `useTargetUserId()` | Pass uid to all queries |

---

## What NOT to Add (YAGNI)

| Item | Why Not |
|------|---------|
| `date-fns` / `dayjs` / `luxon` | Native Date is sufficient; all existing date code uses manual arithmetic; adding a date library would be inconsistent and bloat the bundle |
| Calendar grid component (`react-calendar`, etc.) | "Upcoming bills in 14 days" is a sorted list, not a monthly grid — a calendar widget is over-engineering for this requirement |
| TimescaleDB / time-series extension | Monthly snapshots (max ~24 rows per user for 2 years) do not need a time-series DB; plain PostgreSQL `net_worth_snapshots` is correct |
| Zustand store for net worth state | All data is server-owned; React Query cache is the source of truth; no client-side state needed beyond form inputs |
| Recharts sparkline library (e.g., `react-sparklines`) | Recharts `AreaChart` without axes IS a sparkline — already proven in codebase |
| Separate charting library for net worth trend | Recharts already handles area/line charts with full customization |
| React Virtualized / TanStack Virtual | Net worth accounts will be small in number (< 20 rows); no virtualization needed |
| Optimistic updates | Not needed for accounts with infrequent writes; React Query `invalidateQueries` on mutation success is sufficient |

---

## Migration Numbering

Next migration should be `0012_net_worth.sql`. It creates:
1. `financial_accounts` table + RLS
2. `net_worth_snapshots` table + RLS + UNIQUE constraint

And if Option A for mark-as-paid is confirmed: `0013_bill_payments.sql`.

---

## Risk Notes

**Snapshot timing mismatch:** If a user updates balances mid-month, the snapshot for that month reflects the latest balance, not an average. This is acceptable — users are informed they are recording "current state." No action needed.

**Multi-user admin view:** When an admin views another user's net worth via view-as mode, the `useTargetUserId()` hook returns the target user's UID. All DB queries must pass this UID explicitly (same as `listInvestments(filters, uid)` pattern). Financial accounts and snapshots must NOT default to `auth.uid()` in query parameters when a uid is explicitly passed.

**`recurring_templates` `next_due_date` is mutated by `useProcessRecurring`:** After the hook auto-processes overdue templates, `next_due_date` advances past today. The upcoming bills computation therefore only shows bills *from next_due_date forward*, which is correct — already-processed (auto-transacted) bills do not appear as "upcoming." This is the intended behavior.
