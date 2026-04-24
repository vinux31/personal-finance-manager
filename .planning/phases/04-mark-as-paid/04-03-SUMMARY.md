---
phase: 04-mark-as-paid
plan: "03"
subsystem: testing
tags: [supabase, sql-test, plpgsql, integration-test, wave-0, psql]

requires:
  - phase: 04-mark-as-paid plan 01
    provides: mark_bill_paid RPC + next_due_date_sql helper (migration 0014)
  - phase: 04-mark-as-paid plan 02
    provides: upcoming_bills_unpaid VIEW (migration 0015)
provides:
  - First SQL integration test in the project (supabase/tests/ directory convention established)
  - Full coverage of mark_bill_paid happy path, idempotency, access guard, not-found guard
  - FOUND-01 month-end clamp regression safety net (31 Jan non-leap, 31 Jan leap, 31 Mar, 28 Feb)
  - Covers all 4 nextDueDate frequencies (daily/weekly/monthly/yearly) + unknown-frequency raise
  - Asserts upcoming_bills_unpaid VIEW exclusion semantics (D-03 Sisa Aman refinement)
  - Re-runnable test via BEGIN ... ROLLBACK wrapper — no state pollution
affects: [04-mark-as-paid plan 04 (execution), future supabase SQL tests in other phases]

tech-stack:
  added: [PL/pgSQL DO-block test harness, psql \echo sections, RAISE NOTICE PASS/FAIL pattern]
  patterns:
    - "supabase/tests/<phase>-<feature>.sql — NEW test file convention"
    - "BEGIN; ... ROLLBACK; top-level wrapper — makes test idempotent/repeatable"
    - "DO $$ ... $$ block with EXCEPTION WHEN OTHERS — tests error paths without aborting transaction"
    - "set_config('request.jwt.claim.sub', uid, true) — simulate auth.uid() in psql session"
    - "Graceful SKIP via nested BEGIN ... EXCEPTION + RETURN — survives restricted environments"

key-files:
  created:
    - supabase/tests/04-mark-bill-paid.sql (252 lines, 19 PASS / 24 FAIL assertion branches)
  modified: []

key-decisions:
  - "BEGIN ... ROLLBACK wrapper chosen over separate teardown — simplest and bullet-proof repeatability"
  - "RAISE NOTICE PASS:/FAIL: convention (not pgTAP) — zero-dependency, human+CI-readable, grep-friendly"
  - "Graceful SKIP path for auth.users seed failure — test survives environments with stricter auth.users controls"
  - "set_config('request.jwt.claim.sub', ...) to set auth.uid() — avoids needing a real Supabase session"
  - "Single DO $$ block holds sections 2-6 (sequential state machine) — Section 1 runs as independent SELECTs"

patterns-established:
  - "SQL test file naming: supabase/tests/<phase-padded>-<feature>.sql"
  - "Section headers via \echo 'SECTION N: <name>' (outside DO block) and RAISE NOTICE 'SECTION N: <name>' (inside DO block)"
  - "Assertion style: SELECT CASE WHEN <cond> THEN 'PASS: <label>' ELSE 'FAIL: <label>' END AS r — for simple value checks"
  - "Assertion style: IF <cond> THEN RAISE NOTICE 'PASS: ...' ELSE RAISE NOTICE 'FAIL: ...' END IF — inside DO blocks where side effects matter"
  - "Error-path assertion: nested BEGIN ... EXCEPTION WHEN OTHERS — inspect SQLERRM for expected message, PASS if match"

requirements-completed: [BILL-03]

duration: 2min
completed: 2026-04-24
---

# Phase 04 Plan 03: SQL Integration Test for mark_bill_paid Summary

**First SQL test script in the project — 6-section integration test covering next_due_date_sql edge cases, mark_bill_paid atomicity/idempotency/guards, and upcoming_bills_unpaid view exclusion, wrapped in BEGIN/ROLLBACK for repeatable runs.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-24T11:47:00Z
- **Completed:** 2026-04-24T11:49:01Z
- **Tasks:** 1 (Task 1: Create supabase/tests/04-mark-bill-paid.sql)
- **Files modified:** 1 created, 0 modified

## Accomplishments

- Created `supabase/tests/` directory — first SQL test directory in the codebase
- Authored 252-line SQL integration test covering 6 sections (19 PASS branches, 24 FAIL diagnostics)
- Established the `supabase/tests/<phase>-<feature>.sql` naming convention + BEGIN/ROLLBACK wrapping + RAISE NOTICE PASS/FAIL output pattern for future phases
- All 16 automated grep verification checks passed (file presence, structure, keyword frequencies, error-message strings)
- Test is runnable via `psql "$DATABASE_URL" -f supabase/tests/04-mark-bill-paid.sql` once migrations 0014 + 0015 are applied (deferred to Plan 04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create supabase/tests/04-mark-bill-paid.sql with full test coverage** — `8fcffe3` (test)

**Plan metadata:** (appended below — see final commit)

## Files Created/Modified

- `supabase/tests/04-mark-bill-paid.sql` — 252 lines. 6 sections:
  - SECTION 1: `next_due_date_sql` edge cases (8 frequency/date combinations + 1 unknown-frequency raise)
  - SECTION 2: `mark_bill_paid` happy path — asserts 1 transaction + 1 bill_payment + advanced next_due_date + correct bill_payment.amount
  - SECTION 3: idempotency guard — second call same date must raise "sudah ditandai lunas"
  - SECTION 4: access guard — foreign JWT-claim caller must raise "Akses ditolak"
  - SECTION 5: not-found guard — bogus template_id must raise "Template tidak ditemukan"
  - SECTION 6: `upcoming_bills_unpaid` view — unpaid template appears, paid template disappears

## Decisions Made

- **Assertion convention:** `RAISE NOTICE 'PASS: <label>'` / `'FAIL: <label>'` — zero-dependency (no pgTAP install), greppable via `grep "FAIL:"` for CI, human-scannable in terminal output
- **JWT-claim simulation:** `set_config('request.jwt.claim.sub', uid, true)` — Supabase `auth.uid()` reads from this claim; avoids needing a live session
- **Graceful SKIP:** nested `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'SKIP'; RETURN; END;` around `INSERT INTO auth.users` so the test does not hard-crash in environments where auth.users seeding is restricted
- **DO-block structure:** sections 2–6 share a single DO $$ block because they share state (`v_template_id`, `v_uid`, `v_cat_id`) — sequential state-machine style; section 1 stands alone as independent SELECTs

## Deviations from Plan

None — plan executed exactly as written. The <action> block in Plan 04-03 specified the SQL file content verbatim; that content was written character-for-character and all 16 grep verification gates passed on the first run.

## Issues Encountered

None. Git did flag a CRLF conversion warning on commit (Windows default `core.autocrlf=true`) — this is expected repo behavior on Windows, not an issue.

## User Setup Required

None — no external service configuration required. The test file is inert until executed in Plan 04 (which runs it after `supabase db push` applies migrations 0014 + 0015).

## Next Phase Readiness

- **Ready for Plan 04 execution:** `psql "$DATABASE_URL" -f supabase/tests/04-mark-bill-paid.sql` after `supabase db push`
- **Ready for Plan 04 TypeScript wrapper:** the SQL contract (function signatures, error messages, view column set) is now pinned by this test
- **Ready for Plan 05 UI work:** the idempotency + access-guard semantics are anchored; UI can rely on the exact error strings surfacing via PostgREST

## Self-Check: PASSED

- `supabase/tests/04-mark-bill-paid.sql` exists at the expected path
- Commit `8fcffe3` present in `git log --oneline`
- All 16 automated verify checks passed (see verify output — BEGIN:1, ROLLBACK:1, next_due_date_sql:20, mark_bill_paid(:5, upcoming_bills_unpaid:5, PASS::19, FAIL::24, etc.)

---
*Phase: 04-mark-as-paid*
*Completed: 2026-04-24*
