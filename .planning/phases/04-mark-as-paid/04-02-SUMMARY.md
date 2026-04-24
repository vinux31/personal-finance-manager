---
phase: 04-mark-as-paid
plan: "02"
subsystem: database
tags: [supabase, postgres, view, rls, security-invoker, migration, sisa-aman]

# Dependency graph
requires:
  - phase: 04-mark-as-paid
    provides: "bill_payments table (0013) with recurring_template_id FK + paid_date; mark_bill_paid RPC (0014) writes paid records"
provides:
  - "upcoming_bills_unpaid VIEW — filtered projection of recurring_templates excluding bills paid in current month"
  - "security_invoker VIEW convention (first in project)"
  - "Sisa Aman D-03 formula enablement at DB layer — client arithmetic stays unchanged"
affects: [04-03 (SQL test will assert VIEW filter semantics), 04-04 (Wave 2 schema push applies migration), 04-05 (listUpcomingBills swaps .from('recurring_templates') -> .from('upcoming_bills_unpaid'))]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PostgreSQL VIEW with security_invoker = true — caller RLS inherited (PG 15+)"
    - "Half-open month window: [date_trunc('month', CURRENT_DATE), + INTERVAL '1 month') to avoid last-day-of-month edge case"
    - "NOT EXISTS subquery with dual scope (recurring_template_id AND user_id) defensive even with RLS"

key-files:
  created:
    - "supabase/migrations/0015_upcoming_bills_unpaid_view.sql"
  modified: []

key-decisions:
  - "First VIEW in project uses security_invoker = true to inherit caller RLS from underlying tables (recurring_templates + bill_payments). Without this flag Postgres defaults to security_definer semantics which would bypass RLS and leak rows across users."
  - "Half-open month window [date_trunc('month', CURRENT_DATE), +1 month) rather than BETWEEN start AND end_of_month — avoids off-by-one when paid_date lands on last day of month."
  - "View SELECT projects all columns required by RecurringTemplate TS interface (id, user_id, name, type, category_id, amount, note, frequency, next_due_date, is_active) + created_at for schema parity — enables drop-in swap from .from('recurring_templates') with no client signature change."
  - "NOT EXISTS subquery scopes on BOTH recurring_template_id AND bp.user_id = t.user_id. Defensive — even if RLS is mis-configured, subquery cannot match rows across users."

patterns-established:
  - "VIEW convention: CREATE OR REPLACE VIEW <name> WITH (security_invoker = true) AS SELECT ... + GRANT SELECT TO authenticated"
  - "Current-month date window: paid_date >= date_trunc('month', CURRENT_DATE)::DATE AND paid_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::DATE"

requirements-completed: [BILL-03]

# Metrics
duration: 1m
completed: 2026-04-24
---

# Phase 04 Plan 02: upcoming_bills_unpaid VIEW Summary

**First VIEW in project: security_invoker projection of recurring_templates filtered to active expense templates not yet paid in the current month, enabling D-03 Sisa Aman formula without any client changes.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-24T11:43:58Z
- **Completed:** 2026-04-24T11:45:07Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Authored `supabase/migrations/0015_upcoming_bills_unpaid_view.sql` with verbatim content from the plan's action block.
- Established the project's first VIEW convention with `security_invoker = true` (RESEARCH Pitfall 7 mitigation).
- Projected all columns needed by the `RecurringTemplate` TypeScript interface so `listUpcomingBills` can swap `.from('recurring_templates')` -> `.from('upcoming_bills_unpaid')` in Plan 04-05 without a signature change.
- Baked in half-open month window (`>= start` AND `< start_of_next_month`) to dodge the last-day-of-month edge case.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 0015_upcoming_bills_unpaid_view.sql with security_invoker view** - `c24747e` (feat)

## Files Created/Modified
- `supabase/migrations/0015_upcoming_bills_unpaid_view.sql` - First VIEW in project. Filters recurring_templates to active expense rows with no bill_payments record in current month. WITH (security_invoker = true) inherits caller RLS. GRANT SELECT to authenticated.

## Decisions Made
- None beyond those already prescribed in the plan. All authoring decisions (security_invoker, half-open window, column projection, NOT EXISTS dual scope) were specified exactly in the plan's action block; execution reproduced the content verbatim.

## Verification

All 11 automated grep checks from the plan passed:

| # | Check | Result |
|---|-------|--------|
| 1 | File exists | OK |
| 2 | `CREATE OR REPLACE VIEW upcoming_bills_unpaid` | 1 |
| 3 | `security_invoker = true` | 3 (DDL directive on line 14 + 2 explanatory comments — plan content authored verbatim) |
| 4 | `recurring_template_id` | 1 |
| 5 | `NOT EXISTS` | 1 |
| 6 | `date_trunc('month', CURRENT_DATE)` | 2 (lower + upper bound) |
| 7 | `GRANT SELECT ON upcoming_bills_unpaid TO authenticated` | 1 |
| 8 | `t.is_active = true` | 1 |
| 9 | `t.type = 'expense'` | 1 |
| 10 | bare `template_id =` column use | 0 |
| 11 | Column projection (id, user_id, name, type, category_id, amount, note, frequency, next_due_date, is_active) | all present (1 each) |

Additional syntactic sanity: 11 open parens = 11 close parens, 2 trailing semicolons (one per DDL statement).

Check #3 note: the plan's acceptance criteria specified "outputs 1" but the plan's exact action-block content includes two explanatory comments that also contain the literal phrase `security_invoker = true`. The DDL directive on line 14 is unique and correct; the two additional occurrences are in comments (lines 8, 41) — intentional per the plan's specified file contents. No deviation from the plan's action block.

## Deviations from Plan

None — plan executed exactly as written. File content is character-identical to the plan's action block.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Migration will be applied to the database in Plan 04-04 (Wave 2 schema push).

## Next Phase Readiness
- Migration file ready to be applied via `supabase db push` in Plan 04-04.
- Plan 04-03 (SQL test script) can assert the VIEW's NOT EXISTS filter semantics on top of this file.
- Plan 04-05 can swap `listUpcomingBills` query source from `.from('recurring_templates')` to `.from('upcoming_bills_unpaid')` — column projection matches the `RecurringTemplate` TS interface.

## Self-Check: PASSED

- FOUND: supabase/migrations/0015_upcoming_bills_unpaid_view.sql
- FOUND: .planning/phases/04-mark-as-paid/04-02-SUMMARY.md
- FOUND: commit c24747e

---
*Phase: 04-mark-as-paid*
*Plan: 02*
*Completed: 2026-04-24*
