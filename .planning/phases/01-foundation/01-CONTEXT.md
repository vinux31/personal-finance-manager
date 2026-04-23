# Phase 1: Foundation - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers DB infrastructure, a bug fix, and navigation restructuring — no new feature UI. After this phase: 4 new Supabase tables exist with correct RLS, the `nextDueDate()` bug is fixed, and the Goals tab has become "Finansial" with 2 sub-tabs (Kekayaan first, Goals second). No CRUD dialogs, no charts, no widgets — those are Phase 2 and beyond.

</domain>

<decisions>
## Implementation Decisions

### Tab Transition (Goals → Finansial)
- **D-01:** Tab `value` stays `'goals'` — do NOT change to `'finansial'`. Only the label changes to `"Finansial"`. This prevents existing users' persisted active tab from breaking.
- **D-02:** Tab icon stays `Target` (Lucide) — no icon change needed since Goals remains a sub-tab.
- **D-03:** Sub-tab `defaultValue` set to `'kekayaan'` — Kekayaan shows first when user opens the tab, highlighting the new feature.
- **D-04:** Sub-tab visual style: follow the PensiunTab pattern exactly — horizontal tabs with underline indicator (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from shadcn/ui). See `src/tabs/PensiunTab.tsx` as the direct reference.

### Migration Strategy
- **D-05:** Split into 2 migration files:
  - `0012_net_worth.sql` — 3 tables: `net_worth_accounts`, `net_worth_liabilities`, `net_worth_snapshots`
  - `0013_bill_payments.sql` — 1 table: `bill_payments`
  - Rationale: bill_payments belongs conceptually to Phase 2 (Upcoming Bills) but is created in Phase 1 Foundation to avoid mid-feature migrations.
- **D-06:** RLS pattern: follow `0010_recurring_transactions.sql` exactly — `auth.uid() = user_id` on both `USING` and `WITH CHECK`. Include `is_admin()` on SELECT policy for admin view-as support.
- **D-07:** Schema uses two separate tables (`net_worth_accounts` + `net_worth_liabilities`) — not a single combined table. Cleaner query semantics (already decided in STATE.md).

### nextDueDate() Bug Fix
- **D-08:** Fix the month-end overflow by clamping: after `setMonth()`, if the resulting month is wrong (overflowed), backtrack to the last valid day of the target month. Use native Date arithmetic — no external library.
- **D-09:** Claude's discretion on exact clamping implementation — standard approach: `new Date(y, targetMonth + 1, 0).getDate()` to get last day of target month.
- **D-10:** No unit test file required in this phase — fix is small and the behavior is verifiable manually. Tests can be added when a test suite is introduced.

### Claude's Discretion
- Exact SQL column types and constraints (follow existing migrations as reference)
- Whether to use `bigint generated always as identity` or `uuid` for PKs (follow existing pattern — bigint)
- `net_worth_snapshots.net_worth` column: computed as stored generated column (`GENERATED ALWAYS AS (total_accounts + total_investments - total_liabilities) STORED`) or computed in application layer — Claude decides
- GoalsTab content remains 100% unchanged — only wrapped in a sub-tab container

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Migration Pattern
- `supabase/migrations/0010_recurring_transactions.sql` — canonical RLS policy pattern to follow for all new tables

### Navigation Pattern
- `src/App.tsx` — tab array definition, current Goals tab entry (`value: 'goals'`, line ~32)
- `src/tabs/PensiunTab.tsx` — sub-tab implementation pattern (Tabs inside top-level tab)

### Bug Fix Target
- `src/db/recurringTransactions.ts` — `nextDueDate()` function (line ~1), `monthly` case is the bug

### State Management
- `.planning/STATE.md` — Accumulated Context section, decisions already made (schema = two tables, bill_payments = Option A)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/tabs.tsx` (shadcn Tabs, TabsList, TabsTrigger, TabsContent) — already used in PensiunTab for sub-tabs; use the same components for FinansialTab
- `src/tabs/PensiunTab.tsx` — complete working example of Tabs-inside-Tabs pattern; copy structure directly
- `src/tabs/GoalsTab.tsx` — existing content, wrap unchanged inside sub-tab

### Established Patterns
- Migration files use `bigint generated always as identity primary key` for IDs
- All tables: `user_id uuid not null references auth.users(id) on delete cascade`
- RLS: `auth.uid() = user_id` on both `USING` and `WITH CHECK`; SELECT also includes `OR is_admin()` for admin view-as
- `created_at timestamptz not null default now()` on every table
- Next migration number: **0012** (last is `0011_pension_simulations.sql`)

### Integration Points
- `src/App.tsx` TABS array — modify Goals entry label only (value stays 'goals'), replace `GoalsTab` component with new `FinansialTab`
- `src/tabs/GoalsTab.tsx` — no changes; imported into new FinansialTab as sub-tab content
- New file: `src/tabs/FinansialTab.tsx` — wraps GoalsTab + placeholder KekayaanTab in shadcn sub-tabs

</code_context>

<specifics>
## Specific Ideas

- Sub-tab default: `defaultValue="kekayaan"` (Kekayaan first, not Goals)
- Sub-tab style: exact copy of PensiunTab's `<Tabs defaultValue="..."><TabsList>...` structure
- GoalsTab: zero changes to its internal code — just re-exported inside the new container

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-23*
