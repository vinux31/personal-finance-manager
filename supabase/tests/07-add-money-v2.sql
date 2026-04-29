-- ============================================================
-- Phase 07 SQL Integration Test: add_money_to_goal v2 (CONS-01)
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/07-add-money-v2.sql
--
-- Validates 0024_add_money_to_goal_v2.sql.
--
-- Convention (mirrors 06-*.sql):
--   - BEGIN ... ROLLBACK wrapper -> no state ever persists.
--   - SET LOCAL row_security = off for SEEDING (superuser bypass).
--   - Output via RAISE NOTICE 'PASS:' / 'FAIL:' -- humans scan, CI greps for "FAIL:".
--
-- Expected: ≥7 PASS notices total.
-- ============================================================

BEGIN;
SET LOCAL row_security = off;

-- ============================================================
-- SECTION 1: function-def proofs (inline CASE WHEN)
-- Mirror 04-mark-bill-paid.sql SECTION 1 pattern + 06-withdraw:177-180 FOR UPDATE proof
-- ============================================================

SELECT CASE WHEN to_regprocedure('public.add_money_to_goal(bigint,numeric)') IS NOT NULL
       THEN 'PASS: function add_money_to_goal(BIGINT, NUMERIC) exists'
       ELSE 'FAIL: add_money_to_goal v2 missing' END AS r;

SELECT CASE WHEN pg_get_functiondef('public.add_money_to_goal(bigint,numeric)'::regprocedure) LIKE '%FOR UPDATE%'
       THEN 'PASS: add_money_to_goal v2 uses FOR UPDATE (race-safe)'
       ELSE 'FAIL: add_money_to_goal v2 missing FOR UPDATE' END AS r;

SELECT CASE WHEN pg_get_functiondef('public.add_money_to_goal(bigint,numeric)'::regprocedure) LIKE '%goal_investments%'
       THEN 'PASS: add_money_to_goal v2 considers linked investments'
       ELSE 'FAIL: add_money_to_goal v2 missing goal_investments subquery' END AS r;

SELECT CASE WHEN pg_get_functiondef('public.add_money_to_goal(bigint,numeric)'::regprocedure) LIKE '%SET search_path%'
       THEN 'PASS: add_money_to_goal v2 has SET search_path'
       ELSE 'FAIL: add_money_to_goal v2 missing SET search_path' END AS r;

-- Withdraw MESSAGE patch (D-14)
SELECT CASE WHEN pg_get_functiondef('public.withdraw_from_goal(bigint,numeric)'::regprocedure) LIKE '%terpisah dari Rp %% di investasi%'
       THEN 'PASS: withdraw_from_goal MESSAGE includes split kas vs investasi (D-14)'
       ELSE 'FAIL: withdraw_from_goal MESSAGE not patched' END AS r;

-- ============================================================
-- SECTION 2: DO block status-flip scenarios
-- Mirror: 06-withdraw-from-goal.sql DO block — inverse direction (add, not withdraw)
-- ============================================================

DO $$
DECLARE
  v_uid          UUID := '00000000-0000-0000-0000-000000000a07';
  v_goal_id      BIGINT;
  v_inv_id       BIGINT;
  v_paused_id    BIGINT;
  v_completed_id BIGINT;
  v_result       RECORD;
BEGIN
  -- Seed auth.users with SKIP fallback (mirror 06-withdraw:29-40)
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES (v_uid, 'phase7-add-money@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP: cannot seed auth.users (%)', SQLERRM;
    RETURN;
  END;
  PERFORM set_config('request.jwt.claim.sub', v_uid::TEXT, true);

  -- ============================================================
  -- Scenario 1: add tiny amount (1) — investment alone closes target → status flips to 'completed'
  -- Setup: goal target=10jt, current=0 + linked investment 60% × 18jt = 10.8jt
  -- Total after add: 1 + 10.8jt = 10.800.001 >= 10jt → active → completed
  -- ============================================================

  -- Setup: investment 18jt
  INSERT INTO investments (user_id, asset_type, asset_name, quantity, buy_price, current_price, buy_date)
  VALUES (v_uid, 'Saham', 'TestInv-AddMoney', 1, 15000000, 18000000, CURRENT_DATE)
  RETURNING id INTO v_inv_id;

  -- Setup: active goal target=10jt, cash=0
  INSERT INTO goals (user_id, name, target_amount, current_amount, status)
  VALUES (v_uid, 'TestGoal-Active', 10000000, 0, 'active')
  RETURNING id INTO v_goal_id;

  -- Link 60% of investment to goal
  INSERT INTO goal_investments (goal_id, investment_id, allocation_pct)
  VALUES (v_goal_id, v_inv_id, 60);

  -- Call add_money_to_goal — tiny amount, investment alone pushes total >= target
  SELECT * INTO v_result FROM add_money_to_goal(v_goal_id, 1);
  IF v_result.status = 'completed' THEN
    RAISE NOTICE 'PASS: Scenario 1 — status flipped to completed via investment-only contribution';
  ELSE
    RAISE NOTICE 'FAIL: Scenario 1 — status got %, expected completed (cash 1 + 60%% × 18jt = 10800001 >= 10jt)', v_result.status;
  END IF;

  -- ============================================================
  -- Scenario 2: paused goal stays paused even after add_money pushes total >= target
  -- D-11: paused status must be preserved (user-explicit pause, no auto-flip)
  -- ============================================================

  INSERT INTO goals (user_id, name, target_amount, current_amount, status)
  VALUES (v_uid, 'TestGoal-Paused', 5000000, 0, 'paused')
  RETURNING id INTO v_paused_id;

  -- Link 30% of same investment: 30% × 18jt = 5.4jt > 5jt target
  INSERT INTO goal_investments (goal_id, investment_id, allocation_pct)
  VALUES (v_paused_id, v_inv_id, 30);

  SELECT * INTO v_result FROM add_money_to_goal(v_paused_id, 100);
  IF v_result.status = 'paused' THEN
    RAISE NOTICE 'PASS: Scenario 2 — paused status preserved (no auto-flip per D-11)';
  ELSE
    RAISE NOTICE 'FAIL: Scenario 2 — paused goal flipped to %', v_result.status;
  END IF;

  -- ============================================================
  -- Scenario 3: completed goal stays completed (no double-flip / no reverse on add)
  -- D-11: completed stays completed on add_money
  -- ============================================================

  INSERT INTO goals (user_id, name, target_amount, current_amount, status)
  VALUES (v_uid, 'TestGoal-Completed', 5000000, 5000000, 'completed')
  RETURNING id INTO v_completed_id;

  SELECT * INTO v_result FROM add_money_to_goal(v_completed_id, 100);
  IF v_result.status = 'completed' THEN
    RAISE NOTICE 'PASS: Scenario 3 — completed status preserved';
  ELSE
    RAISE NOTICE 'FAIL: Scenario 3 — completed goal status changed to %', v_result.status;
  END IF;

  -- ============================================================
  -- Scenario 4: amount <= 0 → exception 'Jumlah harus > 0'
  -- ============================================================

  BEGIN
    PERFORM add_money_to_goal(v_goal_id, 0);
    RAISE NOTICE 'FAIL: Scenario 4 — expected exception on amount=0, got success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Jumlah harus > 0%' THEN
      RAISE NOTICE 'PASS: Scenario 4 — amount <= 0 raises Jumlah harus > 0';
    ELSE
      RAISE NOTICE 'FAIL: Scenario 4 — wrong error: %', SQLERRM;
    END IF;
  END;

  -- ============================================================
  -- Scenario 5: nonexistent goal → exception 'Goal tidak ditemukan'
  -- ============================================================

  BEGIN
    PERFORM add_money_to_goal(999999999, 100);
    RAISE NOTICE 'FAIL: Scenario 5 — expected exception on nonexistent goal';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Goal tidak ditemukan%' THEN
      RAISE NOTICE 'PASS: Scenario 5 — nonexistent goal raises Goal tidak ditemukan';
    ELSE
      RAISE NOTICE 'FAIL: Scenario 5 — wrong error: %', SQLERRM;
    END IF;
  END;

  -- ============================================================
  -- Scenario 6: cash-only progress (no linked investment) — status flips when cash alone hits target
  -- ============================================================

  DECLARE
    v_cash_only_id BIGINT;
  BEGIN
    INSERT INTO goals (user_id, name, target_amount, current_amount, status)
    VALUES (v_uid, 'TestGoal-CashOnly', 1000000, 999999, 'active')
    RETURNING id INTO v_cash_only_id;

    SELECT * INTO v_result FROM add_money_to_goal(v_cash_only_id, 1);
    IF v_result.status = 'completed' AND v_result.current_amount = 1000000 THEN
      RAISE NOTICE 'PASS: Scenario 6 — cash-only goal flips to completed when cash alone >= target';
    ELSE
      RAISE NOTICE 'FAIL: Scenario 6 — got status=%, current_amount=%', v_result.status, v_result.current_amount;
    END IF;
  END;

END $$;

\echo '============================================================'
\echo 'Phase 7 add_money_to_goal v2 test complete. Rolling back all changes.'
\echo 'Review output above for any FAIL: lines.'
\echo '============================================================'

ROLLBACK;
