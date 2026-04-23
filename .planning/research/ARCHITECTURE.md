# Architecture: Net Worth Tracker + Upcoming Bills Calendar

**Project:** Kantong Pintar v1.0
**Researched:** 2026-04-23
**Mode:** Integration architecture for brownfield React + Supabase app

---

## 1. New Supabase Tables

### 1.1 `net_worth_accounts`

Stores bank accounts, cash holdings, and non-investment assets (things with a manual balance).

```sql
create table net_worth_accounts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,                        -- "BCA Tabungan", "Kas Tangan"
  type          text not null check (type in (
                  'bank_savings',  -- tabungan
                  'bank_checking', -- giro
                  'cash',          -- uang tunai
                  'receivable',    -- piutang
                  'other_asset'    -- aset lain (properti, kendaraan)
                )),
  balance       numeric(15,2) not null default 0,
  note          text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS
alter table net_worth_accounts enable row level security;

create policy "user owns accounts"
  on net_worth_accounts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### 1.2 `net_worth_liabilities`

Stores debts and liabilities (KPR, cicilan, kartu kredit).

```sql
create table net_worth_liabilities (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,                        -- "KPR BRI", "Cicilan Motor"
  type          text not null check (type in (
                  'mortgage',      -- KPR
                  'vehicle_loan',  -- cicilan kendaraan
                  'credit_card',   -- kartu kredit
                  'personal_loan', -- pinjaman pribadi
                  'other_debt'     -- utang lain
                )),
  balance       numeric(15,2) not null default 0,     -- sisa utang
  note          text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS (same pattern)
alter table net_worth_liabilities enable row level security;

create policy "user owns liabilities"
  on net_worth_liabilities
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### 1.3 `net_worth_snapshots`

Monthly point-in-time record of total assets and liabilities. Used for trend chart.

```sql
create table net_worth_snapshots (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  snapshot_month      date not null,               -- always first day of month: '2026-04-01'
  total_accounts      numeric(15,2) not null,      -- sum of net_worth_accounts.balance
  total_investments   numeric(15,2) not null,      -- sum of investments current value
  total_liabilities   numeric(15,2) not null,      -- sum of net_worth_liabilities.balance
  net_worth           numeric(15,2) not null,      -- accounts + investments - liabilities
  created_at          timestamptz not null default now(),

  unique(user_id, snapshot_month)                  -- one per user per month, upsertable
);

-- RLS
alter table net_worth_snapshots enable row level security;

create policy "user owns snapshots"
  on net_worth_snapshots
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### 1.4 `bill_payments`

Tracks which recurring template occurrences (and one-time bills) have been marked paid.
Does NOT replace `recurring_templates` — it records individual payment events.

```sql
create table bill_payments (
  id                    bigint generated always as identity primary key,
  user_id               uuid not null references auth.users(id) on delete cascade,
  recurring_template_id bigint references recurring_templates(id) on delete set null,
                                                    -- null = one-time bill
  due_date              date not null,              -- the specific due date being paid
  amount_paid           numeric(15,2) not null,
  paid_at               timestamptz not null default now(),
  transaction_id        bigint references transactions(id) on delete set null,
                                                    -- linked if auto-created in transactions
  note                  text,
  created_at            timestamptz not null default now()
);

-- RLS
alter table bill_payments enable row level security;

create policy "user owns bill_payments"
  on bill_payments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

**Note on one-time bills:** The requirement mentions "adds one-time bills." These live in a separate lightweight table:

```sql
create table one_time_bills (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  amount      numeric(15,2) not null,
  due_date    date not null,
  category_id bigint references categories(id),
  note        text,
  created_at  timestamptz not null default now()
);

alter table one_time_bills enable row level security;

create policy "user owns one_time_bills"
  on one_time_bills
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

## 2. RLS Pattern — Consistency with Existing Tables

All existing tables use the same RLS pattern:
- `auth.uid() = user_id` on both `using` (read/update/delete) and `with check` (insert/update)
- No service-role bypasses — everything goes through the Supabase JS client authenticated as the logged-in user

The new tables follow this exact same pattern. The admin view-as feature reads data scoped to a target user_id passed as a query parameter — the authenticated user (admin) cannot read another user's rows via RLS. The existing workaround in `listRecurringTemplates(uid?)` pattern (passing uid to `.eq('user_id', uid)`) implies the admin reads under their own session but filters by uid. This only works if:

**Option A (current pattern):** Admin's own `auth.uid()` is the admin's uid, not the target user's. RLS would block cross-user reads. The app likely uses a service-role key on the client for admin queries, or the admin is exempted from RLS via a policy.

Check the actual supabase client init — if the client is initialized with `service_role` key, RLS is bypassed. If it uses the `anon` key + user JWT, RLS applies and cross-user admin reads would fail. Either way, new tables must match the existing behavior: if service_role is used, new tables just need the RLS policies defined consistently.

---

## 3. Where Do These Features Live in the UI?

### 3.1 Net Worth — New Tab (`Kekayaan`)

**Decision: New dedicated tab**, not integrated into Dashboard or Settings.

Rationale:
- Net worth has its own CRUD operations (add account, add liability, edit balances) — too much for a Dashboard widget
- Settings is for app configuration, not financial data entry
- Dashboard should remain a summary/overview — it can show a single "Net Worth" metric card that links to the new tab
- The existing 8-tab layout has room for a 9th tab; the TabsList is already scrollable on mobile (`overflow-x-auto`)
- Placing it between Goals and Pensiun is logical (financial position → financial goals → retirement planning)

**Dashboard integration:** Add a 5th `MetricCard` to the existing 4-card grid showing current net worth total, linked to the Kekayaan tab via `useTabStore().setActiveTab('kekayaan')`. The grid is already `grid-cols-2 sm:grid-cols-4` — adding a 5th card either wraps gracefully on mobile or the grid becomes `sm:grid-cols-5`, both acceptable.

### 3.2 Upcoming Bills — Dashboard Widget + Own Section

**Decision: Dual presence.**

- **Dashboard widget:** A "Tagihan Mendatang" panel in the existing 2-column grid (alongside "Transaksi Terakhir" and "Goals Aktif"). Shows bills due in the next 14 days, with a one-click "Bayar" button.
- **Full management section:** Lives inside the Transaksi tab or as a sub-view, since bills are conceptually part of transaction management. The existing `RecurringListDialog` already manages templates — a `UpcomingBillsTab` within the Transaksi section (using a sub-tab pattern like `Tabs` inside `Tabs`) avoids adding another top-level tab.

**Rationale against a separate top-level tab:** Upcoming bills primarily surfaces data already in `recurring_templates`. A new top-level tab for what is essentially a filtered list + mark-paid action would crowd the navbar. The dashboard widget is the primary surface; the full view is secondary.

---

## 4. Mark-as-Paid Flow

**Decision: Auto-create a transaction in `transactions`, then record in `bill_payments`.**

Flow:

```
User clicks "Bayar" on a bill item
  → Confirm dialog (pre-filled: date=today, amount=template.amount, category=template.category_id)
  → User can adjust amount/date before confirming
  → On confirm:
      1. createTransaction({ date, type: 'expense', category_id, amount, note: template.name })
         → returns transaction_id
      2. insertBillPayment({ recurring_template_id, due_date, amount_paid, transaction_id })
      3. If recurring template: update recurring_templates.next_due_date to next occurrence
      4. Invalidate: ['transactions'], ['recurring-templates'], ['bill-payments']
  → Toast: "Tagihan {name} ditandai lunas dan dicatat sebagai transaksi"
```

**Why auto-create transaction:** The existing `useProcessRecurring` hook already auto-creates transactions for overdue recurring templates. Paying a bill from the upcoming bills view should be consistent — it creates a real transaction record. This keeps the Laporan/Reports tab accurate without manual double-entry.

**The `bill_payments` table** serves as the "paid" ledger for the upcoming bills view. A bill item is shown as paid if a `bill_payments` row exists for `(recurring_template_id, due_date)`. Without this, the dashboard would re-show a paid bill after re-render.

**One-time bills:** Same flow but `recurring_template_id` is null, and no `next_due_date` update. After payment, the `one_time_bills` row can be soft-deleted or left as-is (already paid).

**Edge case: useProcessRecurring conflict.** The existing `useProcessRecurring` hook processes overdue templates automatically on load. If a user has already manually paid a bill via the upcoming bills flow, `useProcessRecurring` would try to create a duplicate transaction for the same period. Resolution: `useProcessRecurring` should check `bill_payments` before auto-creating. Add: `const alreadyPaid = bill_payments where recurring_template_id = t.id and due_date = due`. If found, skip transaction creation but still advance `next_due_date`.

---

## 5. Net Worth Snapshot — Trigger Strategy

**Decision: On-load trigger, with upsert semantics, once per month per user.**

```
NetWorthTab mounts
  → useEffect fires
  → Check: does a snapshot exist for current month (snapshot_month = first day of current month)?
  → No: compute totals from current data, upsert snapshot
  → Yes: do nothing (snapshot already recorded for this month)
```

**Implementation:**

```typescript
// In src/hooks/useNetWorthSnapshot.ts
export function useNetWorthSnapshot() {
  const uid = useTargetUserId()
  const { data: accounts } = useAccounts()
  const { data: liabilities } = useLiabilities()
  const { data: investments } = useInvestments()
  const qc = useQueryClient()

  useEffect(() => {
    if (!uid || !accounts || !liabilities || !investments) return
    const monthStart = firstDayOfCurrentMonth()

    async function maybeSnapshot() {
      const existing = await getSnapshot(uid, monthStart)
      if (existing) return  // already snapshotted this month

      const totalAccounts = accounts.reduce((s, a) => s + a.balance, 0)
      const totalInvestments = investments.reduce((s, i) => s + currentValue(i), 0)
      const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0)
      const netWorth = totalAccounts + totalInvestments - totalLiabilities

      await upsertSnapshot(uid, { snapshot_month: monthStart, totalAccounts, totalInvestments, totalLiabilities, netWorth })
      qc.invalidateQueries({ queryKey: ['net-worth-snapshots', uid] })
    }

    maybeSnapshot().catch(console.error)
  }, [uid, accounts, liabilities, investments])
}
```

**Why not Supabase cron / pg_cron:** Requires Supabase Pro plan and adds operational complexity. On-load is simpler, works offline-first (when data loads it snapshots), and the `unique(user_id, snapshot_month)` constraint with upsert prevents duplicates. Since app load is triggered by the user opening the app, monthly frequency is naturally satisfied — users who open the app at least once a month get a snapshot.

**Why not manual button:** Reduces friction; the snapshot is automatic and invisible to the user. The trend chart just works.

**Admin view-as consideration:** When admin views as another user, `useTargetUserId()` returns the target uid. The snapshot hook should NOT fire when in view-as mode — admin viewing should not create snapshots in the target user's data. Add a guard: `const { viewingAs } = useViewAsContext(); if (viewingAs) return`.

---

## 6. Admin View-As Mode

All new queries follow the identical pattern established by existing queries:

```typescript
// In every new query hook:
const uid = useTargetUserId()
// uid = viewingAs.uid if admin is viewing, else session user's uid

return useQuery({
  queryKey: ['accounts', uid],
  queryFn: () => listAccounts(uid),
  enabled: !!uid,
})
```

```typescript
// In every new db function:
export async function listAccounts(uid?: string) {
  let query = supabase.from('net_worth_accounts').select('*').order('name')
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data
}
```

**Mutations in view-as mode:** Existing mutations do NOT check view-as — they create data for the session user. New mutations (add account, mark as paid) must match this behavior. The admin is typically read-only when viewing another user's data, but the app currently has no explicit guard on mutations during view-as. Do not add one now — preserve parity with existing behavior.

**Snapshot hook in view-as mode:** Add explicit guard as noted in Section 5. This is the one exception where admin view-as should be inactive — creating snapshots for another user's account without their action would be incorrect.

---

## 7. React Query Cache Keys and Invalidation

### Cache Key Conventions

```typescript
// Net Worth
['accounts', uid]                    // useAccounts()
['liabilities', uid]                 // useLiabilities()
['net-worth-snapshots', uid]         // useNetWorthSnapshots()

// Upcoming Bills
['bill-payments', uid]               // useBillPayments()
['one-time-bills', uid]              // useOneTimeBills()
// recurring-templates already exists: ['recurring-templates', uid]
```

### Invalidation on Mark-as-Paid Mutation

```typescript
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ['transactions'] })         // new tx appears in recent
  qc.invalidateQueries({ queryKey: ['recurring-templates'] })  // next_due_date advanced
  qc.invalidateQueries({ queryKey: ['bill-payments'] })        // paid status updates
  toast.success('Tagihan berhasil dibayar')
}
```

### Invalidation on Account/Liability Update

```typescript
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ['accounts'] })
  // Do NOT auto-invalidate snapshots — snapshots are point-in-time historical records
}
```

### Dashboard Widget Reads

The dashboard will use existing cached data:
- `useRecurringTemplates()` — already cached at `['recurring-templates', uid]`
- `useBillPayments()` — new, cached at `['bill-payments', uid]`
- `useAccounts()` and `useLiabilities()` — new, for the net worth metric card

No additional network cost at dashboard load; TanStack Query deduplicates.

---

## 8. Component Plan — New vs Modified

### New Files

```
src/tabs/NetWorthTab.tsx              — Full net worth tab (accounts + liabilities + trend chart)
src/db/netWorth.ts                   — DB functions: listAccounts, createAccount, updateAccount,
                                       deleteAccount, listLiabilities, createLiability, ...,
                                       upsertSnapshot, listSnapshots
src/queries/netWorth.ts              — React Query hooks: useAccounts, useLiabilities,
                                       useNetWorthSnapshots, useCreateAccount, ...
src/hooks/useNetWorthSnapshot.ts     — Auto-snapshot on NetWorthTab mount
src/db/bills.ts                      — DB functions: listBillPayments, createBillPayment,
                                       listOneTimeBills, createOneTimeBill, deleteOneTimeBill
src/queries/bills.ts                 — React Query hooks: useBillPayments, useUpcomingBills
                                       (computed from recurring-templates + one-time-bills),
                                       useMarkBillPaid, useCreateOneTimeBill
src/components/UpcomingBillsWidget.tsx — Dashboard widget (14-day bill list + pay button)
src/components/AccountDialog.tsx     — Add/edit account form
src/components/LiabilityDialog.tsx   — Add/edit liability form
src/components/BillPayDialog.tsx     — Confirm payment dialog (adjustable amount/date)
src/components/OneTimeBillDialog.tsx — Add one-time bill form
```

### Modified Files

```
src/App.tsx
  — Add NetWorthTab import and new tab entry { value: 'kekayaan', label: 'Kekayaan', icon: Landmark }
  — Position: after 'goals', before 'pensiun'

src/tabs/DashboardTab.tsx
  — Add 5th MetricCard: Net Worth total (reads useAccounts + useLiabilities)
  — Add UpcomingBillsWidget in the 2-column panel grid
  — Add useNetWorthSnapshot call (or move to NetWorthTab only — see build order note)

src/hooks/useProcessRecurring.ts
  — Add bill_payments check before creating duplicate transaction for already-manually-paid bills
```

---

## 9. Data Flow Diagram

```
Supabase Tables
├── recurring_templates (existing) ──────────┐
├── transactions (existing)                   │
├── net_worth_accounts (new)                 │
├── net_worth_liabilities (new)              │
├── net_worth_snapshots (new)               │
├── bill_payments (new)                      │
└── one_time_bills (new)                     │
                                             │
React Query Cache Layer                      │
├── ['recurring-templates', uid] ────────────┤──→ useUpcomingBills() (computed)
├── ['bill-payments', uid] ─────────────────┘
├── ['accounts', uid]
├── ['liabilities', uid]
├── ['net-worth-snapshots', uid]
├── ['one-time-bills', uid]
└── ['transactions', uid] (existing)

Components
├── DashboardTab
│   ├── MetricCard (Net Worth total) ← useAccounts + useLiabilities
│   └── UpcomingBillsWidget ← useUpcomingBills + useBillPayments
│       └── BillPayDialog → useMarkBillPaid
│                               → createTransaction
│                               → createBillPayment
│                               → updateRecurringTemplate.next_due_date
└── NetWorthTab
    ├── AccountsList ← useAccounts
    │   └── AccountDialog → useCreateAccount / useUpdateAccount
    ├── LiabilitiesList ← useLiabilities
    │   └── LiabilityDialog → useCreateLiability / useUpdateLiability
    ├── NetWorthSummaryCard (total = accounts + investments - liabilities)
    └── NetWorthTrendChart ← useNetWorthSnapshots (Recharts LineChart)
        useNetWorthSnapshot (auto-snapshot hook)
```

---

## 10. Build Order

**Build Net Worth first, then Upcoming Bills.**

Rationale:
1. Net Worth has no dependencies on the bills feature. Bills depend on nothing new either, but the `useMarkBillPaid` mutation needs to call `createTransaction` which requires understanding transaction structure — that's already done. Net Worth is the simpler, more self-contained feature with pure CRUD.
2. The snapshot hook requires `useInvestments` which is already working. Building Net Worth first exercises the `currentValue()` function from the investments module without new risks.
3. Upcoming Bills requires modifying `useProcessRecurring` to add the bill_payments check. This is a riskier change (modifying an existing hook that auto-runs on load). It's safer to do this after Net Worth is validated and merged.
4. The Dashboard widget for bills and the Net Worth metric card are both additive to `DashboardTab.tsx` — small, low-risk additions added in Phase 2.

### Suggested Phase Breakdown

**Phase 1 — Net Worth Tracker**
1. Create migrations: `net_worth_accounts`, `net_worth_liabilities`, `net_worth_snapshots`
2. Write `src/db/netWorth.ts` (all DB functions)
3. Write `src/queries/netWorth.ts` (all React Query hooks)
4. Write `src/hooks/useNetWorthSnapshot.ts`
5. Build `NetWorthTab.tsx` with AccountDialog, LiabilityDialog, trend chart
6. Modify `App.tsx`: add Kekayaan tab
7. Modify `DashboardTab.tsx`: add Net Worth MetricCard

**Phase 2 — Upcoming Bills Calendar**
1. Create migrations: `bill_payments`, `one_time_bills`
2. Write `src/db/bills.ts`
3. Write `src/queries/bills.ts` (including `useUpcomingBills` computed query)
4. Modify `useProcessRecurring.ts`: add bill_payments duplicate check
5. Build `UpcomingBillsWidget.tsx` + `BillPayDialog.tsx` + `OneTimeBillDialog.tsx`
6. Modify `DashboardTab.tsx`: add UpcomingBillsWidget panel

---

## 11. Open Architecture Questions

1. **Supabase client mode (anon vs service_role):** The admin view-as pattern uses `.eq('user_id', uid)` to filter for another user's data. If RLS is enforced with the anon key, this query would return nothing for a different user's data. Verify which key `src/lib/supabase.ts` uses — if service_role, all RLS policies are advisory only.

2. **Investments in Net Worth total:** The `currentValue()` function computes investment value client-side from `investments` data. The net worth snapshot stores `total_investments` as a computed value at snapshot time. Should investment values be live (recalculated on render) or from last price update? Recommendation: live on the summary card, stored value in snapshot.

3. **Cashflow projection formula:** The requirement mentions "sisa aman bulan ini = income − bills terjadwal." This needs: projected income (sum of income-type recurring_templates due this month) minus projected expenses (sum of expense-type recurring_templates due this month). Confirm whether this calculation should use recurring templates only, or also include already-recorded transactions for the current month.

4. **`recurring_templates` has no `user_id` in the select list** in `listRecurringTemplates`. The insert in `createRecurringTemplate` also does not explicitly set `user_id`. This means RLS on `recurring_templates` auto-populates `user_id = auth.uid()` at insert. New tables should follow the same pattern — do not include user_id in insert payloads; let RLS enforce it.
