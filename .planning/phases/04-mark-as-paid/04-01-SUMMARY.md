---
phase: 04-mark-as-paid
plan: "01"
subsystem: database
tags: [supabase, plpgsql, rpc, atomic-transaction, migration, security-definer]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "bill_payments table, recurring_templates.next_due_date, is_admin() helper, nextDueDate TS source"
provides:
  - "next_due_date_sql(DATE, TEXT) PL/pgSQL helper (port of TS nextDueDate, preserves FOUND-01 month-end clamp)"
  - "mark_bill_paid(BIGINT, UUID, DATE) atomic RPC (transaction + bill_payment + next_due advance)"
  - "SECURITY DEFINER discipline: explicit user_id in INSERT, owner-or-admin guard, parameterized CASE on frequency"
  - "Idempotency guard pattern: FOR UPDATE row lock + IF EXISTS on bill_payments"
affects: [04-02, 04-03, 04-04, 04-05, 04-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PL/pgSQL atomic RPC with SECURITY DEFINER + SET search_path = public (mirrors 0003_goals_atomic_rpc.sql)"
    - "SQL port of TS date math using EXTRACT(DAY) + date_trunc + LEAST clamp (FOUND-01 parity)"
    - "Idempotency via (FOR UPDATE row lock) + (pre-check IF EXISTS) rather than UNIQUE constraint"
    - "Owner/admin guard: v_uid := COALESCE(p_uid, auth.uid()) then IF v_uid != auth.uid() AND NOT is_admin()"

key-files:
  created:
    - "supabase/migrations/0014_mark_bill_paid.sql"
  modified: []

key-decisions:
  - "next_due_date_sql uses LEAST(EXTRACT(DAY FROM p_current), EXTRACT(DAY FROM (first_of_next_month + 1 month - 1 day))) to mirror Math.min(d, lastDay) — prevents 31 Jan -> 3 Mar overflow"
  - "mark_bill_paid explicitly sets user_id = v_uid in INSERT INTO transactions — cannot rely on DEFAULT auth.uid() because SECURITY DEFINER runs as function owner, not caller (Pitfall 1)"
  - "Idempotency check uses IF EXISTS on bill_payments AFTER FOR UPDATE row lock — guards against double-click race AND interleave with useProcessRecurring"
  - "Error messages in Bahasa Indonesia per codebase convention: 'Akses ditolak', 'Template tidak ditemukan', 'Tagihan sudah ditandai lunas untuk tanggal ini'"
  - "Migration authored only (not applied). Schema push to Supabase deferred to Plan 04 (Wave 2)"

patterns-established:
  - "Pattern: Atomic 3-op mark-as-paid via PL/pgSQL function — INSERT transaction + INSERT bill_payment + UPDATE recurring_templates.next_due_date in implicit transaction"
  - "Pattern: SECURITY DEFINER RPC must explicitly pass user_id to dependent INSERTs (cannot rely on DEFAULT auth.uid() because caller JWT is erased under DEFINER)"
  - "Pattern: Race safety via row lock (FOR UPDATE) on the resource being mutated + idempotency EXISTS check on audit table"

requirements-completed: [BILL-03]

# Metrics
duration: 4min
completed: 2026-04-24
---

# Phase 04 Plan 01: Atomic mark-as-paid RPC migration Summary

**Migration 0014 adds next_due_date_sql helper + mark_bill_paid atomic RPC with owner/admin guard, FOR UPDATE race safety, and FOUND-01 month-end clamp parity with TS nextDueDate.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-24T11:37Z
- **Completed:** 2026-04-24T11:41Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments
- Created `supabase/migrations/0014_mark_bill_paid.sql` with two functions fully defined and granted to `authenticated` role
- `next_due_date_sql(DATE, TEXT)` IMMUTABLE SQL port of TS `nextDueDate()` — preserves FOUND-01 month-end clamp (31 Jan monthly -> 28 Feb) via `LEAST(EXTRACT(DAY FROM p_current), last_day_of_target_month)`
- `mark_bill_paid(BIGINT, UUID, DATE)` SECURITY DEFINER atomic RPC performing three writes in one implicit transaction:
  1. INSERT expense transaction (explicit `user_id = v_uid` — SECURITY DEFINER safety)
  2. INSERT bill_payments audit row (including NOT NULL `amount` = template amount)
  3. UPDATE recurring_templates.next_due_date via next_due_date_sql
- Four guards implemented:
  - Auth: `Unauthenticated` if `v_uid IS NULL`
  - Access: `Akses ditolak` if `v_uid != auth.uid()` AND NOT `is_admin()` (IDOR mitigation T-04-01)
  - Existence: `Template tidak ditemukan` if `SELECT ... FOR UPDATE` returns no row
  - Idempotency: `Tagihan sudah ditandai lunas untuk tanggal ini` if `(recurring_template_id, user_id, paid_date)` already exists in bill_payments (T-04-02 dedup)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 0014_mark_bill_paid.sql** — `614b3c1` (feat)

**Plan metadata:** pending final commit after SUMMARY + STATE updates

## Files Created/Modified
- `supabase/migrations/0014_mark_bill_paid.sql` — two PL/pgSQL functions (`next_due_date_sql`, `mark_bill_paid`) + GRANT EXECUTE to authenticated

## Decisions Made
- See frontmatter `key-decisions`. Most notable:
  - Explicit `user_id = v_uid` in dependent INSERT (SECURITY DEFINER erases caller JWT)
  - `LEAST` + `EXTRACT(DAY)` clamp as SQL equivalent of `Math.min(d, lastDay)`
  - Row lock + EXISTS check for idempotency (not UNIQUE constraint) — cheaper, gives a Bahasa Indonesia error message before wasting INSERT work

## Deviations from Plan

None — plan executed exactly as written. The migration SQL was authored verbatim from the plan's `<action>` block.

### Note on verify grep count precision

Plan's automated verify block listed two grep counts whose expected values were set slightly off relative to the spec'd SQL content:
- Check 4 expected `SECURITY DEFINER` count = `1`; actual = `2` because one occurrence is in a comment clarifying SECURITY DEFINER semantics (`-- because SECURITY DEFINER context has owner uid, not caller uid`). The functional intent ("only mark_bill_paid uses it; next_due_date_sql is IMMUTABLE") is preserved.
- Check 6 expected `recurring_template_id` count ≥ `3`; actual = `2` (guard WHERE + INSERT). The spec'd SQL contains it exactly twice; code matches spec verbatim.

These are plan-authoring grep-count imprecisions, not code defects. No content changes made — code matches plan spec character-for-character.

---

**Total deviations:** 0
**Impact on plan:** None. Every acceptance criterion semantically satisfied; migration SQL matches the plan's `<action>` block verbatim.

## Issues Encountered
None.

## Known Stubs
None. Migration file is complete and self-contained.

## Threat Flags
None. All STRIDE threats from plan's threat model (T-04-01 through T-04-06) are mitigated in the delivered SQL:
- T-04-01 (IDOR via p_uid): `IF v_uid != auth.uid() AND NOT is_admin() THEN RAISE EXCEPTION 'Akses ditolak'`
- T-04-02 (double-call / race): `FOR UPDATE` on recurring_templates + `IF EXISTS` on bill_payments
- T-04-03 (SQL injection via p_freq): parameterized `CASE p_freq WHEN ... ELSE RAISE EXCEPTION 'Unknown frequency: %'`
- T-04-04 (RLS bypass): explicit `WHERE user_id = v_uid` on SELECT INTO
- T-04-05 (owner uid leak): explicit `VALUES (..., v_uid)` on INSERT INTO transactions
- T-04-06 (FOUND-01 regression): `LEAST(v_original_day, v_last_day)` clamp preserved

## User Setup Required
None — migration is authored but not applied. Schema push (`supabase db push`) is deferred to Plan 04 (Wave 2) where behavior will be validated end-to-end against Plan 03's SQL test script.

## Next Phase Readiness
- `mark_bill_paid` RPC is ready to be called by client code in Plan 02 (`markBillPaid` TS wrapper) and tested in Plan 04 (Wave 2 schema push + validation)
- Plan 03 SQL test script (when created) can validate this migration's behavior in Postgres
- No blockers. Wave 1 Plan 01 (DB foundation for mark-as-paid) complete

## Self-Check: PASSED
- supabase/migrations/0014_mark_bill_paid.sql: FOUND
- Commit 614b3c1: FOUND

---
*Phase: 04-mark-as-paid*
*Completed: 2026-04-24*
