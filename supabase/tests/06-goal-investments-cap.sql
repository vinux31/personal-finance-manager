-- ============================================================
-- Phase 06 Wave 1 SQL Integration Test: goal_investments cap (RACE-02)
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/06-goal-investments-cap.sql
--
-- Validates migration 0021_goal_investments_total_check.sql (must be applied to target DB
-- before running). Trigger function enforce_goal_investment_total + index
-- goal_investments_investment_idx are exercised here.
--
-- Convention (mirrors 04-mark-bill-paid.sql + 05-tighten-rls.sql):
--   - BEGIN ... ROLLBACK wrapper -> no state ever persists.
--   - SET LOCAL row_security = off for SEEDING (superuser bypass).
--   - Output via RAISE NOTICE 'PASS:' / 'FAIL:' -- humans scan, CI greps for "FAIL:".
--
-- Expected: 6 PASS notices total
--   Section 1 (trigger behaviour, multi-step DO block): 3
--     1.1 first insert 60% succeeds
--     1.2 second insert 50% (total 110%) raises SQLSTATE 23514
--     1.3 UPDATE existing row 60% -> 80% (exclude-self) succeeds
--   Section 2 (index existence):                          1
--   Section 3 (race serialization, FOR UPDATE proof):     1
--   Section 4 (SECURITY DEFINER regression guard, D-14):  1
-- ============================================================

BEGIN;
SET LOCAL row_security = off;

-- ============================================================
-- SECTION 1: trigger behaviour — happy path + violation + UPDATE exclude-self
-- ============================================================

DO $$
DECLARE
  v_uid     UUID := '00000000-0000-0000-0000-000000000a0c';
  v_inv_id  BIGINT;
  v_goal_a  BIGINT;
  v_goal_b  BIGINT;
  v_link_id BIGINT;
BEGIN
  -- Try to seed test user; gracefully skip if env disallows (mirror 04:88-97).
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES (v_uid, 'phase6-cap-test@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP SECTION 1: cannot seed auth.users (%)', SQLERRM;
    RETURN;
  END;

  -- Seed investment (NOT NULL columns from 0001_init.sql + user_id from 0006_multi_user.sql:
  --   asset_type, asset_name, quantity, buy_price, buy_date, user_id)
  INSERT INTO investments (user_id, asset_type, asset_name, quantity, buy_price, buy_date)
  VALUES (v_uid, 'reksadana', 'Test Phase6 Reksadana', 100, 1000, CURRENT_DATE)
  RETURNING id INTO v_inv_id;

  -- Seed 2 goals (NOT NULL: name, target_amount; user_id from 0006_multi_user.sql)
  INSERT INTO goals (user_id, name, target_amount, current_amount, status)
  VALUES (v_uid, 'Phase6 Goal A', 10000000, 0, 'active')
  RETURNING id INTO v_goal_a;

  INSERT INTO goals (user_id, name, target_amount, current_amount, status)
  VALUES (v_uid, 'Phase6 Goal B', 5000000, 0, 'active')
  RETURNING id INTO v_goal_b;

  -- Switch to authenticated context so trigger sees JWT claim sub
  PERFORM set_config('request.jwt.claim.sub', v_uid::TEXT, true);

  -- Scenario 1.1: first insert 60% — should succeed (no prior allocations)
  BEGIN
    INSERT INTO goal_investments (user_id, goal_id, investment_id, allocation_pct)
    VALUES (v_uid, v_goal_a, v_inv_id, 60)
    RETURNING id INTO v_link_id;
    RAISE NOTICE 'PASS: first insert 60%% succeeds (total = 60)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: first insert 60%% should succeed but raised: SQLSTATE % — %', SQLSTATE, SQLERRM;
    RETURN;
  END;

  -- Scenario 1.2: second insert 50% on SAME investment_id — total would be 110% → must raise 23514.
  -- Asserts BOTH state code AND message contains "Total alokasi melebihi" — locks D-13 contract.
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

  -- Scenario 1.3: UPDATE existing row 60 -> 80 (no other rows) — should succeed via exclude-self.
  -- Without `id IS DISTINCT FROM NEW.id`, SUM would see the row's own 60% then add NEW 80% = 140 > 100 → false raise.
  BEGIN
    UPDATE goal_investments SET allocation_pct = 80 WHERE id = v_link_id;
    RAISE NOTICE 'PASS: UPDATE 60%% to 80%% (no other rows) succeeds via exclude-self';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: UPDATE exclude-self should succeed: SQLSTATE % — %', SQLSTATE, SQLERRM;
  END;
END $$;

-- ============================================================
-- SECTION 2: index existence (D-15, Style A inline SELECT CASE)
-- ============================================================

SELECT CASE WHEN EXISTS (
  SELECT 1 FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'goal_investments'
    AND indexname = 'goal_investments_investment_idx'
)
THEN 'PASS: index goal_investments_investment_idx exists'
ELSE 'FAIL: index missing' END AS r;

-- ============================================================
-- SECTION 3: race serialization logical proof — pg_get_functiondef LIKE '%FOR UPDATE%'
-- (mirror 06-RESEARCH.md §935-947 logical-proof pattern)
-- ============================================================

SELECT CASE WHEN pg_get_functiondef('enforce_goal_investment_total()'::regprocedure)
              LIKE '%FOR UPDATE%'
       THEN 'PASS: enforce_goal_investment_total uses FOR UPDATE in SUM'
       ELSE 'FAIL: FOR UPDATE missing — concurrent INSERT/UPDATE not serialized' END AS r;

-- ============================================================
-- SECTION 4: SECURITY DEFINER regression guard (D-14)
-- Phase 5 narrowed RLS — this guard ensures trigger SUM aggregate still sees all rows.
-- ============================================================

SELECT CASE WHEN pg_get_functiondef('enforce_goal_investment_total()'::regprocedure)
              LIKE '%SECURITY DEFINER%'
       THEN 'PASS: enforce_goal_investment_total uses SECURITY DEFINER (D-14)'
       ELSE 'FAIL: SECURITY DEFINER missing — trigger SUM may be blocked by RLS' END AS r;

\echo '============================================================'
\echo 'Phase 6 goal_investments cap test complete. Rolling back all changes.'
\echo 'Review output above for any FAIL: lines.'
\echo 'Expected: 6 PASS notices.'
\echo '============================================================'

ROLLBACK;
