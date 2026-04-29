---
phase: 06-race-atomicity
plan: 02
subsystem: database/race-safety
tags: [migration, trigger, race, allocation, RACE-02, D-13, D-14, D-15, D-16]
requires:
  - supabase/migrations/0001_init.sql (goal_investments + investments + goals schemas)
  - supabase/migrations/0006_multi_user.sql (user_id columns + RLS policies)
  - supabase/migrations/0014_mark_bill_paid.sql (FOR UPDATE row-lock pattern)
  - supabase/migrations/0017_tighten_rls.sql (SECURITY DEFINER trigger function pattern)
provides:
  - "trigger function `enforce_goal_investment_total()` (SECURITY DEFINER, returns TRIGGER)"
  - "trigger `goal_investments_total_check` BEFORE INSERT OR UPDATE FOR EACH ROW on goal_investments"
  - "index `goal_investments_investment_idx` ON goal_investments(investment_id)"
  - "pgTAP integration test `06-goal-investments-cap.sql` (6 PASS scenarios)"
affects:
  - "future allocation_pct INSERTs/UPDATEs on goal_investments table (DB-side enforcement)"
  - "Plan 06-04 mapSupabaseError integration (SQLSTATE 23514 → 'Total alokasi investasi melebihi 100%')"
  - "Plan 06-05 D-16 pre-deploy gate + UAT-3 verification"
tech-stack:
  added: []
  patterns:
    - "BEFORE INSERT OR UPDATE row trigger with cross-row SUM aggregate validation"
    - "FOR UPDATE in trigger SUM subquery → race serialization across concurrent inserts"
    - "id IS DISTINCT FROM NEW.id (NULL-safe exclude-self) for INSERT/UPDATE-shared trigger"
    - "SECURITY DEFINER on validation trigger to bypass RLS without leaking data"
key-files:
  created:
    - supabase/migrations/0021_goal_investments_total_check.sql
    - supabase/tests/06-goal-investments-cap.sql
  modified: []
decisions:
  - "Index created AFTER CREATE TRIGGER (not before) to satisfy plan-level verification regex order; functionally equivalent."
  - "Investments seed in test uses (asset_type='reksadana', asset_name, quantity=100, buy_price=1000, buy_date=CURRENT_DATE) — NOT NULL columns from 0001_init.sql:29-39 honored."
  - "Goals seed uses (name, target_amount, current_amount, status='active') — matches 0001_init.sql:51-59 + user_id from 0006."
  - "No GRANT statement on trigger function — trigger functions invoked by trigger machinery, not by direct RPC calls."
metrics:
  start_time: "2026-04-29T00:18:00Z"
  end_time: "2026-04-29T00:23:41Z"
  duration_minutes: ~6
  tasks_total: 2
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  commits: 3
  completed_date: 2026-04-29
---

# Phase 6 Plan 2: goal_investments Allocation Trigger + Index Summary

DB-side enforcement of `SUM(allocation_pct) <= 100` per `investment_id` via `BEFORE INSERT OR UPDATE` trigger with `FOR UPDATE` row-lock for race safety, plus a new `goal_investments_investment_idx` index for SUM-lookup performance — closes audit finding H-03 (RACE-02).

## Objective Recap

Tutup race window di `LinkInvestmentDialog.tsx` (lines 81-84) antara client-side `SELECT SUM` check dan `INSERT goal_investments`. Trigger jadi second-line defense yang race-safe; existing client-side check tetap berfungsi sebagai UX guard cepat. NO TS code change in this plan — wiring `mapSupabaseError` SQLSTATE 23514 ditangani Plan 06-04, UAT-3 ditangani Plan 06-05.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Buat migration 0021_goal_investments_total_check.sql | `b198cbc` | `supabase/migrations/0021_goal_investments_total_check.sql` |
| 1b | Reorder index after trigger (deviation Rule 3) | `bd8c047` | same migration file |
| 2 | Buat pgTAP test 06-goal-investments-cap.sql | `1336257` | `supabase/tests/06-goal-investments-cap.sql` |

All 13 Task 1 automated checks PASS. All 12 Task 2 automated checks PASS. Plan-level structural regex (success criteria #1) PASS.

## File Diffs

### Created — `supabase/migrations/0021_goal_investments_total_check.sql` (76 lines)

**Header (lines 1-23):** PRE-DEPLOY GATE D-16 reminder block + signature-change Phase 5 lesson reference (lesson: PostgreSQL keys function identity on `(name, arg_types)`; signature change without explicit `DROP FUNCTION IF EXISTS` creates new function alongside legacy version → reachable via direct invocation).

**Trigger function (lines 26-57):**

- `CREATE OR REPLACE FUNCTION enforce_goal_investment_total() RETURNS TRIGGER`
- `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public` (D-14 — bypass RLS for SUM aggregate)
- SUM lookup: `WHERE investment_id = NEW.investment_id AND id IS DISTINCT FROM NEW.id FOR UPDATE`
  - `IS DISTINCT FROM` (not `<>`) handles NULL pre-INSERT correctly: `NEW.id IS NULL → DISTINCT FROM NULL is TRUE → all rows summed`
  - `FOR UPDATE` serializes concurrent INSERT/UPDATE on same `investment_id` (tx2 blocks until tx1 COMMIT, then tx2's SUM sees tx1's row → raises 23514)
- `RAISE EXCEPTION 'Total alokasi melebihi 100%% (sudah %, tambah % > 100)', v_total, NEW.allocation_pct USING ERRCODE = '23514'` (D-13)

**Trigger attachment (lines 59-66):**

```sql
DROP TRIGGER IF EXISTS goal_investments_total_check ON goal_investments;
CREATE TRIGGER goal_investments_total_check
  BEFORE INSERT OR UPDATE ON goal_investments
  FOR EACH ROW EXECUTE FUNCTION enforce_goal_investment_total();
```

Idempotent re-run safe via `DROP TRIGGER IF EXISTS` first (mirror 0017 SEC-02 lines 17-18 `DROP POLICY IF EXISTS` then CREATE convention).

**Index (lines 68-78):**

```sql
CREATE INDEX IF NOT EXISTS goal_investments_investment_idx
  ON goal_investments(investment_id);
```

D-15 — naming convention `<table>_<column>_idx` matches `transactions_date_idx`, `price_history_investment_idx`. Performance support for `SUM(allocation_pct) WHERE investment_id = X` lookup performed by trigger function.

### Created — `supabase/tests/06-goal-investments-cap.sql` (142 lines)

**Section structure:**

| Section | PASS labels | Style | Purpose |
|---------|------------|-------|---------|
| 1 (DO block) | 3 | Style B (DO + RAISE NOTICE) | Trigger behaviour: 60% insert succeeds, second 50% raises 23514, UPDATE 60→80 exclude-self succeeds |
| 2 | 1 | Style A (SELECT CASE) | Index existence via `pg_indexes` lookup |
| 3 | 1 | Style A (SELECT CASE) | Race serialization logical proof: `pg_get_functiondef LIKE '%FOR UPDATE%'` |
| 4 | 1 | Style A (SELECT CASE) | SECURITY DEFINER regression guard (D-14): `pg_get_functiondef LIKE '%SECURITY DEFINER%'` |

**Total: 6 PASS notices** (matches plan target).

**Seed pattern:**

- `auth.users` insertion wrapped in `BEGIN/EXCEPTION` block with `RAISE NOTICE 'SKIP SECTION 1: cannot seed auth.users (%)'` fallback (mirror 04:88-97).
- `investments` seed: `(user_id, asset_type='reksadana', asset_name='Test Phase6 Reksadana', quantity=100, buy_price=1000, buy_date=CURRENT_DATE)` — all NOT NULL columns from 0001_init.sql:29-39 + user_id from 0006_multi_user.sql:52 honored.
- `goals` seed: `(user_id, name, target_amount=10000000/5000000, current_amount=0, status='active')` — all NOT NULL columns from 0001_init.sql:51-59 + user_id from 0006_multi_user.sql:54 honored.
- JWT context via `set_config('request.jwt.claim.sub', v_uid::TEXT, true)`.

**Scenario 1.2 EXCEPTION pattern (mirror 04:163-172):**

```sql
BEGIN
  INSERT INTO goal_investments (user_id, goal_id, investment_id, allocation_pct)
  VALUES (v_uid, v_goal_b, v_inv_id, 50);
  RAISE NOTICE 'FAIL: second insert 50%% (total 110%%) did NOT raise';
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE = '23514' AND SQLERRM LIKE '%Total alokasi melebihi 100%%%' THEN
    RAISE NOTICE 'PASS: SQLSTATE 23514 raised "%".', SQLERRM;
  ELSE
    RAISE NOTICE 'FAIL: unexpected error: SQLSTATE % — %', SQLSTATE, SQLERRM;
  END IF;
END;
```

Locks D-13 contract by asserting BOTH `SQLSTATE = '23514'` AND `SQLERRM LIKE '%Total alokasi melebihi 100%%%'`.

## Compliance with 06-PATTERNS.md Checklist

For migration `0021_goal_investments_total_check.sql`:

- [x] Comment block dengan referensi pre-deploy gate D-16 di top
- [x] Trigger function `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`
- [x] `id IS DISTINCT FROM NEW.id` (bukan `<>`) untuk exclude-self
- [x] `FOR UPDATE` di SELECT SUM untuk race serialization
- [x] `RAISE EXCEPTION ... USING ERRCODE = '23514'` dengan `%%` escape + `v_total, NEW.allocation_pct` placeholders
- [x] `DROP TRIGGER IF EXISTS ... ON goal_investments;` sebelum CREATE TRIGGER
- [x] `BEFORE INSERT OR UPDATE ... FOR EACH ROW EXECUTE FUNCTION ...`
- [x] Index `CREATE INDEX IF NOT EXISTS goal_investments_investment_idx ON goal_investments(investment_id)`
- [x] No GRANT needed (trigger functions invoked by trigger machinery, not direct calls)

For test `06-goal-investments-cap.sql`:

- [x] Section header `RAISE NOTICE 'SECTION N: ...'` style mirror 05 (used `-- SECTION` block comments)
- [x] Scenario 1: single insert 60% succeeds (Style B)
- [x] Scenario 2: total > 100% raises with `SQLSTATE = '23514'` AND message contains "Total alokasi melebihi"
- [x] Scenario 3: UPDATE existing row (exclude-self via `id IS DISTINCT FROM`) succeeds
- [x] Scenario 4: index exists (Style A SELECT CASE + pg_indexes lookup)
- [x] Scenario 5: race serialization logical-proof (`pg_get_functiondef('enforce_goal_investment_total()'::regprocedure) LIKE '%FOR UPDATE%'`)
- [x] Scenario 6: trigger SECURITY DEFINER bypass RLS (regression guard untuk Phase 5)
- [x] Closing `\echo` + ROLLBACK
- [x] Target ≥ 6 PASS notices (achieved exactly 6)

## Schema Confirmation (per success criteria #4)

Executor verified `investments` and `goals` schema columns before writing test seed:

| Table | Source | NOT NULL columns required for INSERT |
|-------|--------|--------------------------------------|
| `investments` | `0001_init.sql:29-39` + `0006_multi_user.sql:52,86` | `asset_type`, `asset_name`, `quantity`, `buy_price`, `buy_date`, `user_id` |
| `goals` | `0001_init.sql:51-59` + `0006_multi_user.sql:54,88` | `name`, `target_amount`, `user_id` (current_amount has DEFAULT 0, status has DEFAULT 'active') |
| `goal_investments` | `0005_goal_investments.sql:1-8` + `0006_multi_user.sql:56,90` | `goal_id`, `investment_id`, `allocation_pct`, `user_id` |

Test seed uses these columns explicitly. No schema deviation — test file should run cleanly against any DB with migrations 0001+0005+0006 applied.

## Deviations from Plan

### Rule 3 — Auto-fix blocking issue

**1. Index ordering reversed in migration**

- **Found during:** Task 1 plan-level verification (`<verification>` block line 438 regex check)
- **Issue:** Plan `<action>` skeleton (lines 154-189) listed index creation as step 1 (BEFORE trigger function). Plan `<verification>` regex (line 438) requires order `SECURITY DEFINER ... DROP TRIGGER IF EXISTS ... CREATE TRIGGER ... CREATE INDEX IF NOT EXISTS goal_investments_investment_idx` — index must come AFTER trigger CREATE. Original Task 1 commit (`b198cbc`) followed action skeleton → failed plan-level verify regex.
- **Fix:** Reordered index block to AFTER trigger CREATE block. Functionally equivalent (index consulted at row insert/update time via planner; trigger function lookup at trigger creation does not consult the index). Comment in section 3 explains why ordering changed. Both Task 1 inline verify (13/13 PASS) and plan-level verification (PASS) now satisfied.
- **Files modified:** `supabase/migrations/0021_goal_investments_total_check.sql`
- **Commit:** `bd8c047`
- **Why Rule 3 not Rule 4:** Functional behaviour unchanged — purely cosmetic block reorder to satisfy plan's own verification regex. No architectural decision needed.

No other deviations. No CLAUDE.md present (working directory has no project-level CLAUDE.md). No skills directory present.

## Authentication Gates

None. This plan is migration-only — no live DB access, no auth flow.

## Live DB Status

**NOT applied to live DB.** Per plan `<pre_deploy_gate_d16>` (lines 96-105), migration application is Plan 06-05's responsibility. Plan 06-05 deploy task MUST run pre-deploy gate D-16 first:

```sql
SELECT investment_id, SUM(allocation_pct)
FROM goal_investments
GROUP BY investment_id
HAVING SUM(allocation_pct) > 100;
```

If non-empty → STOP. Either auto-cap or manual fix BEFORE pasting 0021. Existing 110% rows that get touched after migration will raise 23514 even though the user did not introduce a new violation.

## Threat Surface Scan

No new threat surface introduced beyond the plan's existing `<threat_model>` (T-6-05, T-6-06, T-6-07, T-6-INFO-02). Trigger function:

- Reads only from `goal_investments` (already accessible to authenticated users via RLS).
- Returns no data to caller (only RAISE EXCEPTION on violation).
- Uses SECURITY DEFINER but logic is bounded to validate-and-raise; no INSERT/UPDATE/DELETE; no row return.

T-6-05 (constraint bypass via RLS narrowing) and T-6-06 (concurrent INSERT race) — both `mitigate` dispositions — are coded as required (SECURITY DEFINER + FOR UPDATE present in migration). Coverage verified by Task 2 scenarios 5 (FOR UPDATE proof) and 6 (SECURITY DEFINER proof).

## Known Stubs

None. Plan output is migration + test SQL only — no UI or data-flow stubs introduced.

## Next Plan Hand-off

- **Plan 06-04** (CONS-04 mapSupabaseError): Add SQLSTATE 23514 → `'Total alokasi investasi melebihi 100%'` branch in `src/lib/errors.ts` (per D-20). When LinkInvestmentDialog client-side check race-window slips, toast will show this user-facing summary.
- **Plan 06-05** (deploy + UAT):
  1. Run D-16 pre-deploy gate query — abort if any row found.
  2. Paste `supabase/migrations/0021_goal_investments_total_check.sql` to Supabase Studio SQL Editor.
  3. Run `psql ... -f supabase/tests/06-goal-investments-cap.sql` — confirm 6 PASS notices.
  4. UAT-3: 2 tabs simultan, link investment 60% di tab 1, link 50% di tab 2 → second click should raise 23514 → toast displays "Total alokasi investasi melebihi 100%".

## Self-Check: PASSED

**Files verified to exist:**
- `supabase/migrations/0021_goal_investments_total_check.sql` — FOUND
- `supabase/tests/06-goal-investments-cap.sql` — FOUND

**Commits verified to exist:**
- `b198cbc` (Task 1 initial) — FOUND
- `1336257` (Task 2) — FOUND
- `bd8c047` (Task 1 reorder) — FOUND

**Verification regexes pass:**
- Task 1 inline verify (13 checks): PASS
- Task 2 inline verify (12 checks): PASS
- Plan-level verification 1 (structural regex): PASS

No missing items. SUMMARY.md ready for orchestrator.
