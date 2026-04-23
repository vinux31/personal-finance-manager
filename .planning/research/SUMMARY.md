# Research Summary - Kantong Pintar Milestone v1.0

**Project:** Kantong Pintar
**Milestone:** Net Worth Tracker + Upcoming Bills Calendar
**Researched:** 2026-04-23
**Confidence:** HIGH

---

## Executive Summary

Milestone v1.0 adds two features to an existing React 19 + Supabase PFM app. Both can be built without installing any new runtime dependencies. Recharts, TanStack Query, shadcn/ui, and Sonner already cover all UI and data needs. The recommended build order is Net Worth Tracker first (pure CRUD with new tables, no risk to live hooks), then Upcoming Bills Calendar (requires modifying the existing auto-process hook, which carries duplication risk if not handled atomically).

The single highest-risk area is the interaction between the new mark-as-paid action and the existing useProcessRecurring hook. If a user manually pays a bill from the Upcoming Bills UI and the auto-process hook fires again before next_due_date is advanced in the database, a duplicate expense transaction is created silently. The mark-as-paid mutation must advance next_due_date atomically alongside creating the transaction.

Two structural decisions must be made before coding begins: (1) whether investments are auto-included in net worth read-only from the existing investments table (recommended: yes), and (2) whether a single financial_accounts table or two separate tables are used. Both decisions affect schema and cannot be changed cheaply after migrations are applied.

---

## 1. Stack Additions

**Verdict: Zero new runtime dependencies.**

| Concern | Mechanism | Reuse |
|---------|-----------|-------|
| Charts (trend + sparkline) | Recharts AreaChart already in SimulasiPanel.tsx | Suppress axes for sparkline; no new library |
| Data fetching | TanStack React Query v5 useQuery / useMutation | Follow src/queries/investments.ts pattern |
| DB layer | Supabase JS client | Follow src/db/investments.ts pattern |
| UI components | shadcn/ui Card, Input, Button, Badge | Direct reuse |
| Toast feedback | Sonner toast.success/error | Same pattern everywhere |
| Admin view-as | useTargetUserId() hook | Must be called in every new query hook |
| Date math | Native Date arithmetic in src/lib/format.ts | Add 3 helpers: firstOfMonthISO, lastOfMonthISO, addDaysISO |

**Patterns to reuse without modification:**
- src/db/investments.ts: template for new src/db/netWorth.ts and src/db/bills.ts
- src/queries/investments.ts: template for new src/queries/netWorth.ts and src/queries/bills.ts
- Migration 0010 RLS pattern (recurring_templates): copy policy structure for all new tables

**Migration numbers:** 0012_net_worth.sql (3 tables), 0013_bill_payments.sql (1-2 tables).

---

## 2. Feature Table Stakes

### Net Worth Tracker - must-have for MVP

| Feature | Notes |
|---------|-------|
| Total net worth (aset minus liabilitas) | Core concept; show on NetWorthTab and Dashboard |
| Manual account entry: name, type, balance | No open banking in Indonesia |
| Account grouping: Aset vs Liabilitas | Asset types: tabungan, dompet digital, deposito, properti, kendaraan, lainnya. Liability types: KPR, cicilan kendaraan, kartu kredit, paylater, KTA, utang lainnya |
| Investments auto-included (read-only) | Pull from existing investments table; display as Portofolio Investasi (otomatis); never allow manual investasi account |
| Monthly trend chart (6-12 months) | Recharts AreaChart from net_worth_snapshots; auto-snapshot on page load if none exists for current month |
| Net Worth widget on Dashboard | 5th MetricCard: total + delta vs last month |

**Scope traps to avoid:**
- No bank auto-sync (no open banking API in Indonesia)
- No goals integration (Goals tab already exists)
- No currency conversion (IDR only)
- Block manual investasi account type (investments auto-pulled from Investasi tab to prevent double-counting)

### Upcoming Bills Calendar - must-have for MVP

| Feature | Notes |
|---------|-------|
| Bills due in next 14 days | Filter recurring_templates: is_active=true, type=expense, next_due_date<=today+14; client-side ISO string comparison only |
| Each bill: nama, jumlah, tanggal jatuh tempo | Already in RecurringTemplate type |
| Visual urgency indicator | Overdue=red, due today=orange, upcoming=neutral |
| Tandai Lunas (mark as paid) | Creates real transaction + records in bill_payments + advances next_due_date atomically |
| Sisa aman bulan ini | Formula: actual_income_this_month minus paid_expenses_this_month minus unpaid_bills_due_this_month; display breakdown |
| Dashboard widget: 5 soonest bills | Reuse recurring-templates cache; no additional network call |

**Scope traps to avoid:**
- No calendar grid (unusable on 375px mobile; use chronological list)
- No push notifications (no infrastructure this milestone)
- No separate Bills tab (upcoming bills is a filtered view over recurring_templates)
- No multi-month cashflow projection (current month only)

---

## 3. Architecture Decisions

### New database tables

| Table | Purpose | Key constraint |
|-------|---------|---------------|
| net_worth_accounts (or financial_accounts) | Manual asset balances | RLS: '+uid+' |
| net_worth_liabilities (or same table with flag) | Manual debt balances | RLS: same |
| net_worth_snapshots | Monthly totals for trend chart | UNIQUE(user_id, snapshot_month); upsert semantics |
| bill_payments | Records paid template occurrences | Links recurring_template_id + transaction_id; prevents duplicate auto-processing |

### Component placement

| Component | Location | Rationale |
|-----------|----------|-----------|
| NetWorthTab.tsx | New top-level tab Kekayaan | Has own CRUD; too much for Dashboard |
| Net Worth MetricCard | DashboardTab.tsx (5th card) | At-a-glance; links to Kekayaan tab |
| UpcomingBillsWidget.tsx | DashboardTab.tsx panel | Primary surface; bills need visibility on first screen |
| Full bills management | Inside Transaksi sub-view | Bills are recurring templates; avoid crowding top nav |

### Build order

**Phase 1 - Net Worth Tracker (build first):**
1. Migrations: net_worth_accounts + net_worth_liabilities + net_worth_snapshots
2. src/db/netWorth.ts + src/queries/netWorth.ts
3. src/hooks/useNetWorthSnapshot.ts (with view-as guard: if viewingAs return early)
4. NetWorthTab.tsx with AccountDialog, LiabilityDialog, trend chart
5. App.tsx: add Kekayaan tab (after Goals, before Pensiun)
6. DashboardTab.tsx: add Net Worth MetricCard

**Phase 2 - Upcoming Bills Calendar (build second):**
1. Migrations: bill_payments
2. src/db/bills.ts + src/queries/bills.ts
3. Modify useProcessRecurring.ts: add bill_payments deduplication check
4. Build UpcomingBillsWidget.tsx + BillPayDialog.tsx
5. DashboardTab.tsx: add UpcomingBillsWidget panel

Rationale: Net Worth is self-contained CRUD with no risk to existing hooks. Upcoming Bills requires modifying useProcessRecurring (auto-runs on every load) - safer after Phase 1 is validated.

---

## 4. Watch Out For

### 1. Mark-as-paid duplicates useProcessRecurring (CRITICAL)

useProcessRecurring auto-creates transactions for overdue templates on mount. If the user pays from the Upcoming Bills UI but next_due_date is not yet advanced when the component remounts, a duplicate transaction is created silently.

**Prevention:** The mark-as-paid mutation must create the transaction, advance next_due_date, and insert the bill_payments row in a single sequential await chain. Separately, modify useProcessRecurring to check bill_payments before inserting a transaction for a given (template_id, due_date).

### 2. RLS policies wrong or missing on new tables (CRITICAL)

Tables created with ENABLE ROW LEVEL SECURITY but incorrect policies (e.g., USING (true)) silently expose all users balance data to each other.

**Prevention:** Every migration must include '+rls+'. Test by signing in as User B and querying User A rows - expect 0 rows returned.

### 3. Investment double-counting in Net Worth (CRITICAL)

If the UI allows a manual investasi account, net worth counts the portfolio twice: once from manual entry and once from the auto-pulled investments table.

**Prevention:** Block the investasi account type in the account creation form. Show inline message: Nilai investasi sudah dihitung otomatis dari tab Investasi. Display auto-pulled investment line as read-only in the breakdown.

### 4. useTargetUserId() missing from new hooks (HIGH)

New hooks using useAuthContext().user.id instead of useTargetUserId() show the admin own data when viewing as another user. The snapshot hook must also guard against view-as mode to avoid writing snapshots into another user account.

**Prevention:** Every new query hook starts with: const uid = useTargetUserId(). Add to code review checklist. Snapshot hook adds: if (viewingAs) return.

### 5. nextDueDate() month-end overflow (HIGH)

date.setMonth(date.getMonth() + 1) overflows January 31 into March. A bill set to the 31st silently drifts forward over several cycles.

**Prevention:** Fix nextDueDate() in src/db/recurringTransactions.ts to clamp to the last valid day of the target month. Write a unit test for the 31st-of-month case first. Fix applies to useProcessRecurring as well - do it in the same PR as Upcoming Bills.

---

## 5. Open Questions

Decisions that must be resolved before implementation. All affect schema and cannot be changed cheaply after migrations are applied.

| # | Question | Recommendation |
|---|----------|---------------|
| 1 | Single financial_accounts table vs separate net_worth_accounts + net_worth_liabilities? STACK.md prefers one; ARCHITECTURE.md prefers two. | Resolve before Migration 0012. Two tables is cleaner for query semantics. |
| 2 | bill_payments table (Option A) vs mark-paid always creates transaction only (Option B)? | Option A. Keeps transaction ledger clean; user retains control of expense records. |
| 3 | Is one_time_bills in scope for this milestone? | Defer unless explicitly required. Recurring templates cover the primary use case. |
| 4 | Supabase client key: anon or service_role? | Check src/lib/supabase.ts on day one. If service_role, RLS is advisory and security depends entirely on app-level .eq(user_id) filters. |
| 5 | Sisa aman formula: projected templates only vs real transactions + upcoming unpaid? | Use real transactions this month minus upcoming unpaid bills. Define exact formula in spec. |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase inspection; no ambiguity about installed dependencies |
| Features | MEDIUM-HIGH | Cross-referenced Monarch, Empower, YNAB; Indonesian account types from bank/fintech context |
| Architecture | HIGH | Based on existing codebase patterns; minor schema disagreement on Open Question 1 |
| Pitfalls | HIGH | All identified from direct code inspection of useProcessRecurring.ts, recurringTransactions.ts, RLS migration files |

**Overall confidence:** HIGH

### Gaps to address during implementation

- Supabase client key mode (OQ4): check src/lib/supabase.ts on day one.
- Single vs split asset/liability table (OQ1): resolve before Migration 0012.
- Sisa aman formula (OQ5): define exact formula in requirements spec; do not leave to implementer discretion.

---

## Sources

### Primary (HIGH confidence - direct codebase inspection)
- src/hooks/useProcessRecurring.ts - auto-process behavior and deduplication gap
- src/db/recurringTransactions.ts - nextDueDate() implementation and month-end overflow
- src/tabs/DashboardTab.tsx - existing query count and MetricCard grid
- src/auth/useTargetUserId.ts + src/auth/ViewAsContext.tsx - view-as pattern
- src/tabs/pensiun/SimulasiPanel.tsx - confirmed Recharts AreaChart usage
- supabase/migrations/0010_*.sql - canonical RLS policy pattern
- package.json - confirmed no date-fns, no calendar library, no sparkline library

### Secondary (MEDIUM-HIGH confidence - product research)
- Monarch Money, Empower, YNAB, PocketGuard - feature benchmarks
- Indonesian banking context (BCA, Mandiri, BRI, BNI, BSI, GoPay, OVO, DANA) - account type taxonomy
- Supabase official docs - RLS policy patterns, upsert semantics

### Tertiary (LOW-MEDIUM confidence)
- Finku (Indonesian PFM) - limited documentation; feature set inferred, not confirmed

---

*Research completed: 2026-04-23*
*Ready for roadmap: yes*
