-- ============================================================
-- Phase 06 Wave 1 SQL Integration Test: withdraw_from_goal (RACE-03)
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/06-withdraw-from-goal.sql
--
-- Validates migration 0020_withdraw_from_goal.sql (must be applied to target DB before running).
--
-- Convention (mirrors 04-mark-bill-paid.sql + 05-tighten-rls.sql):
--   - BEGIN ... ROLLBACK wrapper -> no state ever persists.
--   - SET LOCAL row_security = off for SEEDING (superuser bypass).
--   - Output via RAISE NOTICE 'PASS:' / 'FAIL:' -- humans scan, CI greps for "FAIL:".
--
-- Expected: 8 PASS notices total
-- ============================================================

BEGIN;
SET LOCAL row_security = off;

DO $$
DECLARE
  v_uid       UUID := '00000000-0000-0000-0000-000000000a0d';
  v_uid_other UUID := '00000000-0000-0000-0000-000000000a0e';
  v_goal_id   BIGINT;
  v_goal_other BIGINT;
  v_balance   NUMERIC;
  v_status    TEXT;
BEGIN
  -- Seed primary test user; SKIP fallback if restricted env rejects auth.users INSERT
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES (v_uid, 'phase6-with-test@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
    -- Seed secondary user for foreign-goal scenario
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES (v_uid_other, 'phase6-with-test-other@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP: cannot seed auth.users (%)', SQLERRM;
    RETURN;
  END;

  -- Set JWT claim to primary test user
  PERFORM set_config('request.jwt.claim.sub', v_uid::TEXT, true);

  -- ============================================================
  -- Scenario 1: happy path — withdraw 30k from current=100k → 70k, status unchanged (active)
  -- ============================================================
  INSERT INTO goals (user_id, name, target_amount, current_amount, target_date, status)
  VALUES (v_uid, 'Phase6 Test Goal 1', 200000, 100000, NULL, 'active')
  RETURNING id INTO v_goal_id;

  PERFORM withdraw_from_goal(v_goal_id, 30000::NUMERIC);

  SELECT current_amount, status INTO v_balance, v_status
  FROM goals WHERE id = v_goal_id;

  IF v_balance = 70000 AND v_status = 'active' THEN
    RAISE NOTICE 'PASS: happy path — withdraw 30k from 100k, balance=70k, status=active';
  ELSE
    RAISE NOTICE 'FAIL: happy path — expected (70000, active), got (%, %)', v_balance, v_status;
  END IF;

  -- ============================================================
  -- Scenario 2: completed → active flip — current=100k target=100k status=completed, withdraw 1
  -- ============================================================
  INSERT INTO goals (user_id, name, target_amount, current_amount, target_date, status)
  VALUES (v_uid, 'Phase6 Test Goal 2 (completed)', 100000, 100000, NULL, 'completed')
  RETURNING id INTO v_goal_id;

  PERFORM withdraw_from_goal(v_goal_id, 1::NUMERIC);

  SELECT current_amount, status INTO v_balance, v_status
  FROM goals WHERE id = v_goal_id;

  IF v_balance = 99999 AND v_status = 'active' THEN
    RAISE NOTICE 'PASS: completed → active flip when new < target (D-11)';
  ELSE
    RAISE NOTICE 'FAIL: completed→active flip — expected (99999, active), got (%, %)', v_balance, v_status;
  END IF;

  -- ============================================================
  -- Scenario 3: paused stays paused (locks D-11 paused branch)
  -- ============================================================
  INSERT INTO goals (user_id, name, target_amount, current_amount, target_date, status)
  VALUES (v_uid, 'Phase6 Test Goal 3 (paused)', 100000, 50000, NULL, 'paused')
  RETURNING id INTO v_goal_id;

  PERFORM withdraw_from_goal(v_goal_id, 10000::NUMERIC);

  SELECT current_amount, status INTO v_balance, v_status
  FROM goals WHERE id = v_goal_id;

  IF v_balance = 40000 AND v_status = 'paused' THEN
    RAISE NOTICE 'PASS: paused stays paused after withdraw (D-11)';
  ELSE
    RAISE NOTICE 'FAIL: paused branch — expected (40000, paused), got (%, %)', v_balance, v_status;
  END IF;

  -- ============================================================
  -- Scenario 4: active stays active (locks D-11 active branch)
  -- ============================================================
  INSERT INTO goals (user_id, name, target_amount, current_amount, target_date, status)
  VALUES (v_uid, 'Phase6 Test Goal 4 (active)', 100000, 50000, NULL, 'active')
  RETURNING id INTO v_goal_id;

  PERFORM withdraw_from_goal(v_goal_id, 10000::NUMERIC);

  SELECT current_amount, status INTO v_balance, v_status
  FROM goals WHERE id = v_goal_id;

  IF v_balance = 40000 AND v_status = 'active' THEN
    RAISE NOTICE 'PASS: active stays active after withdraw (D-11)';
  ELSE
    RAISE NOTICE 'FAIL: active branch — expected (40000, active), got (%, %)', v_balance, v_status;
  END IF;

  -- ============================================================
  -- Scenario 5: insufficient saldo — withdraw 60k from current=50k → SQLSTATE P0001
  -- ============================================================
  INSERT INTO goals (user_id, name, target_amount, current_amount, target_date, status)
  VALUES (v_uid, 'Phase6 Test Goal 5 (insufficient)', 100000, 50000, NULL, 'active')
  RETURNING id INTO v_goal_id;

  BEGIN
    PERFORM withdraw_from_goal(v_goal_id, 60000::NUMERIC);
    RAISE NOTICE 'FAIL: insufficient saldo did not raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' AND SQLERRM LIKE '%Saldo kas tidak cukup%' THEN
      RAISE NOTICE 'PASS: SQLSTATE P0001 raised "%" (D-10)', SQLERRM;
    ELSE
      RAISE NOTICE 'FAIL: unexpected error: SQLSTATE % — %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- ============================================================
  -- Scenario 6: amount <= 0 raises 'Jumlah harus > 0'
  -- ============================================================
  INSERT INTO goals (user_id, name, target_amount, current_amount, target_date, status)
  VALUES (v_uid, 'Phase6 Test Goal 6 (zero amt)', 100000, 50000, NULL, 'active')
  RETURNING id INTO v_goal_id;

  BEGIN
    PERFORM withdraw_from_goal(v_goal_id, 0::NUMERIC);
    RAISE NOTICE 'FAIL: zero amount did not raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Jumlah harus > 0' THEN
      RAISE NOTICE 'PASS: amount <= 0 raised "Jumlah harus > 0"';
    ELSE
      RAISE NOTICE 'FAIL: unexpected error on zero amount: SQLSTATE % — %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- ============================================================
  -- Scenario 7: foreign goal — caller v_uid tries to withdraw from v_uid_other's goal → 'Goal tidak ditemukan'
  -- ============================================================
  INSERT INTO goals (user_id, name, target_amount, current_amount, target_date, status)
  VALUES (v_uid_other, 'Phase6 Other-User Goal', 100000, 50000, NULL, 'active')
  RETURNING id INTO v_goal_other;

  -- Caller is still v_uid (set above); v_goal_other is owned by v_uid_other
  BEGIN
    PERFORM withdraw_from_goal(v_goal_other, 10000::NUMERIC);
    RAISE NOTICE 'FAIL: foreign-goal withdraw did not raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Goal tidak ditemukan' THEN
      RAISE NOTICE 'PASS: foreign goal raised "Goal tidak ditemukan" (T-6-10 IDOR mitigation)';
    ELSE
      RAISE NOTICE 'FAIL: unexpected error on foreign goal: SQLSTATE % — %', SQLSTATE, SQLERRM;
    END IF;
  END;

END $$;

-- ============================================================
-- Scenario 8: race serialization — pg_get_functiondef LIKE '%FOR UPDATE%' (logical proof)
-- ============================================================
SELECT CASE WHEN pg_get_functiondef('withdraw_from_goal(BIGINT, NUMERIC)'::regprocedure)
              LIKE '%FOR UPDATE%'
       THEN 'PASS: withdraw_from_goal uses FOR UPDATE row lock (T-6-08 mitigation)'
       ELSE 'FAIL: FOR UPDATE missing from withdraw_from_goal definition' END AS r;

\echo '============================================================'
\echo 'Phase 6 withdraw_from_goal test complete. Rolling back all changes.'
\echo 'Review output above for any FAIL: lines.'
\echo 'Expected: 8 PASS notices.'
\echo '============================================================'

ROLLBACK;
