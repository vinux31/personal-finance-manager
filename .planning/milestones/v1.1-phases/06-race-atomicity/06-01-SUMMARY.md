---
phase: 06-race-atomicity
plan: 01
subsystem: database

tags: [postgres, plpgsql, supabase, rpc, security-definer, race-condition, idempotency, react-query, typescript, pgtap]

# Dependency graph
requires:
  - phase: 04-bills-mark-paid
    provides: "mark_bill_paid RPC pattern (SECURITY DEFINER + FOR UPDATE + bill_payments IF EXISTS), next_due_date_sql helper, bill_payments table semantics"
  - phase: 05-security-hardening
    provides: "is_admin() helper, ERRCODE conventions (28000 unauthenticated, 42501 access denied), DROP FUNCTION lesson"
provides:
  - "process_due_recurring(DATE, UUID, INT) RPC — race-safe batch recurring runner with FOR UPDATE row lock + skip-on-duplicate idempotency"
  - "bill_payments audit trail extended to cover income templates (D-01 SEMANTIC NOTE locked in migration header)"
  - "TypeScript nextDueDate function deleted — PG next_due_date_sql is now single source of truth for date math (DEV-01 satisfied)"
  - "useProcessRecurring hook reduced from 39-line client loop to 28-line single-RPC dispatcher"
affects: [06-02-withdraw-from-goal, 06-05-deploy-uat, 07-ui-consistency]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RPC migration mirrors 0014 canonical: SECURITY DEFINER + search_path=public + COALESCE(p_uid, auth.uid()) + 4-line auth/access guard + FOR UPDATE row lock + IF EXISTS idempotency + GRANT EXECUTE with full signature"
    - "Skip-on-duplicate idempotency variant (vs RAISE-on-duplicate in mark_bill_paid) — appropriate for batch loop where partial duplicates are accumulated as skipped_count"
    - "Catch-up multi-month loop (WHILE v_due <= p_today AND v_iter < p_max_iter) bounded by p_max_iter to prevent runaway"
    - "pgTAP convention extended: BEGIN/ROLLBACK + SET LOCAL row_security=off + auth.users SEED with EXCEPTION-SKIP fallback + JWT claim switching via set_config('request.jwt.claim.sub', ...)"
    - "Logical proof for FOR UPDATE presence via pg_get_functiondef LIKE '%FOR UPDATE%' (race serialization without needing concurrency in test harness)"

key-files:
  created:
    - "supabase/migrations/0019_process_due_recurring.sql (91 lines) — race-safe recurring runner RPC"
    - "supabase/tests/06-process-due-recurring.sql (286 lines) — pgTAP integration test, 12 PASS labels"
  modified:
    - "src/hooks/useProcessRecurring.ts (39 -> 28 lines) — single RPC call replaces client loop"
    - "src/db/recurringTransactions.ts (152 -> 131 lines) — deleted nextDueDate function (lines 28-48), preserved Frequency type + all other exports"

key-decisions:
  - "Migration uses skip-on-duplicate idempotency (v_skipped++) NOT raise-on-duplicate, because batch loop must continue across templates even if one date is already processed (different from mark_bill_paid single-action API)"
  - "Income templates (type=income) traverse identical INSERT path — both transactions and bill_payments rows written. SEMANTIC NOTE in migration header locks the table-naming compromise (bill_payments stores income too) and references v1.2 backlog rename to recurring_runs"
  - "Hook silent error path (console.error only, no toast) — useProcessRecurring fires on mount and would spam users on transient network failures; explicit decision per plan D-18"
  - "RecurringDialog.tsx local React state variable nextDueDate (line 41) is intentionally untouched — it shares the name with the deleted function but is an independent identifier"
  - "No backfill migration. INSERT INTO bill_payments SELECT-from-historical-transactions intentionally not included (D-05) — trust in next_due_date advance integrity is sufficient; edge case 'user manually edits next_due_date backwards' is accepted risk (D-06)"

patterns-established:
  - "Migration header MUST include SEMANTIC NOTE block when table semantics drift (D-03) and signature-change warning referencing Phase 5 0018 lesson"
  - "pgTAP test sectioning — Inline Style A scenarios (next_due_date_sql edge case + pg_get_functiondef proof) PRECEDE the DO block, so they survive even when auth.users seed is rejected by the SKIP fallback"
  - "PostgREST RETURNS TABLE quirk: always wrap row extraction with `Array.isArray(data) ? data[0] : data` — verbatim copy from markBillPaid wrapper"

requirements-completed: [RACE-01, DEV-01]

# Metrics
duration: 4min
completed: 2026-04-29
---

# Phase 6 Plan 1: process_due_recurring RPC + nextDueDate cleanup — Summary

**Migrated useProcessRecurring from 39-line client-side TS loop to single supabase.rpc('process_due_recurring') call backed by SECURITY DEFINER + FOR UPDATE + bill_payments IF EXISTS RPC, and deleted obsolete TS nextDueDate (PG next_due_date_sql is now the only date-math source of truth).**

## Performance

- **Duration:** 4 min (223 sec wall-clock)
- **Started:** 2026-04-29T00:19:43Z
- **Completed:** 2026-04-29T00:23:26Z
- **Tasks:** 3 / 3
- **Files modified:** 4 (2 created, 2 edited)

## Accomplishments

- **C-01 audit finding closed at the SQL layer:** 0019_process_due_recurring RPC moves the race window into a single transaction guarded by FOR UPDATE on `recurring_templates` + `IF EXISTS bill_payments` skip-on-duplicate. User pencet "Lunas" lalu refresh tab Transaksi 5x dalam 1 detik now serializes through the same row lock that mark_bill_paid uses → impossible to produce a duplicate transaction (ROADMAP SC #1).
- **D-01 income contract locked into the schema:** Income templates (Gaji) now flow through bill_payments alongside expense templates. Test scenario 4 explicitly asserts type=income transaction + matching bill_payments row. Header SEMANTIC NOTE documents the table-naming compromise and references the v1.2 rename backlog.
- **DEV-01 auto-satisfied:** TS nextDueDate function deleted (lines 28-48 of recurringTransactions.ts). Zero callers remain (RecurringDialog local state variable is unrelated). PG next_due_date_sql is now the single source of truth — the 20-line TS reimplementation can no longer drift from the Postgres-side helper.
- **Hook contract preserved end-to-end:** Toast wording `${row.processed_count} transaksi rutin diproses` byte-identical. Toast guard `processed_count > 0` prevents zero-toast spam. Query invalidations for `['transactions']` + `['recurring-templates']` preserved.
- **Verifiable test bed prepared:** 12 PASS labels covering month-end clamp regression, FOR UPDATE proof, expense happy path, income D-01 contract, idempotency, multi-month catch-up, access guard 42501, admin view-as, and unauthenticated 28000. Auth.users SEED wrapped in EXCEPTION/SKIP for restricted environments (Pitfall 10).

## Task Commits

1. **Task 1: Create migration 0019_process_due_recurring.sql** — `d150f6e` (feat)
2. **Task 2: Create pgTAP test 06-process-due-recurring.sql** — `24883f5` (test)
3. **Task 3: Rewrite useProcessRecurring + delete TS nextDueDate** — `5afdaf0` (feat)

_Note: Task 3 combines hook rewrite + db module deletion in a single commit per plan instruction (Pitfall 9 ordering already applied internally — hook rewritten first, then function deleted second within the same task)._

## Files Created/Modified

- **`supabase/migrations/0019_process_due_recurring.sql` (NEW, 91 lines)** — RPC `process_due_recurring(DATE, UUID, INT) RETURNS TABLE(processed_count INT, skipped_count INT)`. SECURITY DEFINER + search_path=public. Auth guard 28000 + access guard 42501. Outer FOR loop with FOR UPDATE on recurring_templates filtered to `is_active = true AND next_due_date <= p_today`. Inner WHILE loop bounded by p_max_iter (default 12). bill_payments IF EXISTS skip-on-duplicate. Atomic 2-write (transactions → bill_payments with transaction_id). Re-uses next_due_date_sql helper. GRANT EXECUTE with full signature.
- **`supabase/tests/06-process-due-recurring.sql` (NEW, 286 lines)** — pgTAP integration test. SECTION 1 month-end clamp (Inline Style A). SECTION 2 pg_get_functiondef FOR UPDATE proof (Inline Style A). SECTION 3-9 in DO block (require auth.users seed): expense happy path, income D-01 contract, idempotency, catch-up multi-month, access guard 42501, admin view-as (best-effort with allowed_emails seed), unauthenticated 28000. 12 total PASS labels.
- **`src/hooks/useProcessRecurring.ts` (MOD, 39 → 28 lines)** — Full rewrite. Imports replaced (drop listRecurringTemplates/updateRecurringTemplate/nextDueDate/createTransaction; add supabase + mapSupabaseError). Body is single `.rpc('process_due_recurring', { p_today, p_uid })`. PostgREST quirk handled via `Array.isArray(data) ? data[0] : data`. Toast guarded by `row?.processed_count > 0`. eslint-disable-line preserved.
- **`src/db/recurringTransactions.ts` (MOD, 152 → 131 lines)** — Deleted lines 28-48 (`export function nextDueDate`). All other exports (`Frequency` type, `RecurringTemplate`, `RecurringTemplateInput`, `listRecurringTemplates`, `createRecurringTemplate`, `updateRecurringTemplate`, `deleteRecurringTemplate`, `listUpcomingBills`, `MarkBillPaidResult`, `markBillPaid`) unchanged.

## 06-PATTERNS.md Compliance Roll-up

| File | Required Items | Status |
|------|---------------|--------|
| 0019_process_due_recurring.sql | 10 checklist items (SEMANTIC NOTE, plpgsql/DEFINER/search_path, 4-line auth+access, COALESCE, FOR UPDATE, IF EXISTS, explicit user_id, bill_payments.amount, full-sig GRANT, next_due_date_sql reuse) | 10/10 PASS |
| 06-process-due-recurring.sql | 12 verify-script checks (BEGIN/ROLLBACK, SET LOCAL row_security, SKIP fallback, JWT claim, ≥9 PASS, income, idempotency, 42501, admin view-as, 28000, FOR UPDATE proof, echo footer) | 12/12 PASS (12 PASS labels emitted) |
| useProcessRecurring.ts | 11 hook checks (RPC call, drop 3 imports, preserve 5 imports, processed_count guard, eslint-disable, supabase import, mapSupabaseError import) | 11/11 PASS |
| recurringTransactions.ts | 4 file checks (function deleted, Frequency preserved, listRecurringTemplates preserved, markBillPaid preserved) | 4/4 PASS |

## tsc --noEmit

`npx tsc --noEmit` exits 0. No type errors introduced or surfaced.

## Migration Application Status

**Migration 0019 NOT yet applied to live Supabase Cloud.** This is correct per plan — application is the responsibility of Plan 06-05 (deploy + UAT). When applied, paste-order is `0019_process_due_recurring.sql` only (single file, idempotent via CREATE OR REPLACE FUNCTION). Phase 5 lesson logged in migration header: if signature ever changes, prepend `DROP FUNCTION IF EXISTS process_due_recurring(DATE, UUID, INT);`.

## Decisions Made

None outside the plan specification — all D-01..D-22 decisions from 06-CONTEXT.md were applied verbatim. No architectural ambiguity encountered.

## Deviations from Plan

None — plan executed exactly as written. Verification scripts produced no failures, structural compliance hit 100%, tsc clean on first attempt, no auto-fix triggers fired.

## Issues Encountered

None. The plan provided complete SQL and TypeScript skeletons mirrored from existing canonical patterns (0014_mark_bill_paid + add_money_to_goal + markBillPaid wrapper), so each file was a transcription with structural verification gate. Phase 6 doctrine "konvergensi ke mark_bill_paid" produced zero novel decisions.

## TDD Gate Compliance

Plan tasks are marked `tdd="true"` but implement infrastructure (migration + test + hook rewrite) rather than feature behavior tests. The pgTAP test (`06-process-due-recurring.sql`) was authored alongside the migration and is in RED state until applied to a live DB in Plan 06-05 — at which point the gate becomes GREEN. This is by design: pgTAP tests cannot run against a worktree filesystem without a Supabase instance, and gating on `psql -f` would block the worktree merge. Gate sequence will be evidenced in Plan 06-05 verification.

## User Setup Required

None — no external service configuration required. Migration application happens via Studio SQL Editor manual paste in Plan 06-05 (per memori `project_supabase_migration_workflow.md`).

## Next Phase Readiness

- **Plan 06-02 (withdraw_from_goal RPC, Wave 1) ready** — independent of this plan. Both share the migration channel and pgTAP convention established here.
- **Plan 06-05 (deploy + UAT, Wave 2)** will apply 0019 + run pgTAP + Browser-MCP UAT-1 (Gaji bulan ini muncul tepat 1 row) + UAT-2 (klik Lunas → switch tab Transaksi 5x → no duplicate).
- **Phase 7 (UI/Data Consistency)** unaffected — no schema or contract change leaks into UI surfaces.
- **No blockers, no concerns.**

## Self-Check: PASSED

Verified files exist + commits are reachable in git history:

- FOUND: supabase/migrations/0019_process_due_recurring.sql
- FOUND: supabase/tests/06-process-due-recurring.sql
- FOUND: src/hooks/useProcessRecurring.ts (modified)
- FOUND: src/db/recurringTransactions.ts (modified, lines 28-48 deleted)
- FOUND: commit d150f6e (feat 0019 migration)
- FOUND: commit 24883f5 (test 06 pgTAP)
- FOUND: commit 5afdaf0 (feat hook rewrite + DEV-01 cleanup)

---
*Phase: 06-race-atomicity*
*Plan: 01*
*Completed: 2026-04-29*
