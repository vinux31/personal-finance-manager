-- ============================================================
-- Phase 07 SQL Integration Test: goals_with_progress VIEW (CONS-01)
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/07-goals-with-progress.sql
--
-- Validates 0023_goals_with_progress.sql.
--
-- Convention (mirrors 06-*.sql):
--   - BEGIN ... ROLLBACK wrapper -> no state ever persists.
--   - SET LOCAL row_security = off for SEEDING (superuser bypass).
--   - Output via RAISE NOTICE 'PASS:' / 'FAIL:' -- humans scan, CI greps for "FAIL:".
--
-- Expected: >=5 PASS notices total (4 formula scenarios + 1 RLS pass-through proof).
-- ============================================================

BEGIN;
SET LOCAL row_security = off;

-- ============================================================
-- SECTION 1: VIEW existence and structure proof (inline CASE WHEN style)
-- ============================================================

SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'goals_with_progress')
       THEN 'PASS: VIEW goals_with_progress exists'
       ELSE 'FAIL: VIEW goals_with_progress missing' END AS r;

SELECT CASE WHEN pg_get_viewdef('public.goals_with_progress'::regclass) LIKE '%COALESCE%'
       THEN 'PASS: VIEW uses COALESCE for NULL current_price'
       ELSE 'FAIL: VIEW missing COALESCE' END AS r;

-- security_invoker proof — pg_class.reloptions array contains the marker
SELECT CASE WHEN 'security_invoker=true' = ANY(c.reloptions)
       THEN 'PASS: VIEW has security_invoker = true'
       ELSE 'FAIL: VIEW missing security_invoker — RLS bypass risk' END AS r
FROM pg_class c WHERE c.relname = 'goals_with_progress';

-- ============================================================
-- SECTION 2: Formula scenarios (DO block with auth.users seed + JWT context)
-- ============================================================

DO $$
DECLARE
  v_uid          UUID := '00000000-0000-0000-0000-000000000a07';
  v_goal_id      BIGINT;
  v_goal_id_b    BIGINT;
  v_goal_id_c    BIGINT;
  v_inv_id       BIGINT;
  v_inv_null_id  BIGINT;
  v_total        NUMERIC;
  v_expected     NUMERIC;
BEGIN
  -- Seed auth.users with SKIP fallback (mirror 06-process-due-recurring.sql:67-80)
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES (v_uid, 'phase7-view-test@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP: cannot seed auth.users (%)', SQLERRM;
    RETURN;
  END;
  PERFORM set_config('request.jwt.claim.sub', v_uid::TEXT, true);

  -- Scenario 1: Goal with linked investment 60% x Rp 18jt x 1 = Rp 10.8jt + cash 0 = Rp 10.8jt
  INSERT INTO goals (user_id, name, target_amount, current_amount, status)
  VALUES (v_uid, 'TestGoal-A', 10000000, 0, 'active')
  RETURNING id INTO v_goal_id;

  INSERT INTO investments (user_id, asset_type, asset_name, quantity, buy_price, current_price, buy_date)
  VALUES (v_uid, 'Saham', 'TestInv-A', 1, 15000000, 18000000, CURRENT_DATE)
  RETURNING id INTO v_inv_id;

  INSERT INTO goal_investments (goal_id, investment_id, allocation_pct)
  VALUES (v_goal_id, v_inv_id, 60);

  SELECT total_amount INTO v_total FROM goals_with_progress WHERE id = v_goal_id;
  v_expected := 0 + (60.0 / 100.0 * 18000000 * 1);  -- 10800000

  IF v_total = v_expected THEN
    RAISE NOTICE 'PASS: Scenario 1 — total_amount = % (cash 0 + 60%% x 18jt)', v_total;
  ELSE
    RAISE NOTICE 'FAIL: Scenario 1 — expected %, got %', v_expected, v_total;
  END IF;

  -- Scenario 2: Goal without linked investment -> total = current_amount only
  INSERT INTO goals (user_id, name, target_amount, current_amount, status)
  VALUES (v_uid, 'TestGoal-B', 5000000, 1500000, 'active')
  RETURNING id INTO v_goal_id_b;

  SELECT total_amount INTO v_total FROM goals_with_progress WHERE id = v_goal_id_b;
  IF v_total = 1500000 THEN
    RAISE NOTICE 'PASS: Scenario 2 — total_amount = current_amount when no investment linked';
  ELSE
    RAISE NOTICE 'FAIL: Scenario 2 — expected 1500000, got %', v_total;
  END IF;

  -- Scenario 3: investment with current_price IS NULL -> COALESCE falls back to buy_price
  INSERT INTO investments (user_id, asset_type, asset_name, quantity, buy_price, current_price, buy_date)
  VALUES (v_uid, 'Reksadana', 'TestInv-Null', 2, 5000000, NULL, CURRENT_DATE)
  RETURNING id INTO v_inv_null_id;

  INSERT INTO goals (user_id, name, target_amount, current_amount, status)
  VALUES (v_uid, 'TestGoal-C', 20000000, 0, 'active')
  RETURNING id INTO v_goal_id_c;

  INSERT INTO goal_investments (goal_id, investment_id, allocation_pct)
  VALUES (v_goal_id_c, v_inv_null_id, 100);

  SELECT total_amount INTO v_total FROM goals_with_progress WHERE id = v_goal_id_c;
  v_expected := 0 + (100.0 / 100.0 * 5000000 * 2);  -- 10000000 — falls back to buy_price

  IF v_total = v_expected THEN
    RAISE NOTICE 'PASS: Scenario 3 — COALESCE fallback to buy_price when current_price NULL';
  ELSE
    RAISE NOTICE 'FAIL: Scenario 3 — expected %, got %', v_expected, v_total;
  END IF;

  -- Scenario 4: RLS pass-through proof — set JWT to a different user, query VIEW, expect 0 rows for our seed goals
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000b07', true);
  -- Re-enable RLS for this assertion (we disabled at file top for seeding)
  SET LOCAL row_security = on;

  IF NOT EXISTS (
    SELECT 1 FROM goals_with_progress
    WHERE id IN (v_goal_id, v_goal_id_b, v_goal_id_c)
  ) THEN
    RAISE NOTICE 'PASS: Scenario 4 — RLS pass-through (security_invoker) hides other-user goals via VIEW';
  ELSE
    RAISE NOTICE 'FAIL: Scenario 4 — VIEW leaked rows across users (RLS bypass)';
  END IF;

  -- Restore for cleanup
  SET LOCAL row_security = off;
END $$;

\echo '============================================================'
\echo 'Phase 7 goals_with_progress VIEW test complete. Rolling back all changes.'
\echo 'Review output above for any FAIL: lines.'
\echo '============================================================'

ROLLBACK;
