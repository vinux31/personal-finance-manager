-- ============================================================
-- Phase 07 SQL Integration Test: seed_rencana + reset_rencana_marker (CONS-03)
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/07-seed-rencana.sql
--
-- Validates 0022_user_seed_markers.sql.
--
-- Convention (mirrors 06-*.sql):
--   - BEGIN ... ROLLBACK wrapper -> no state ever persists.
--   - SET LOCAL row_security = off for SEEDING (superuser bypass).
--   - Output via RAISE NOTICE 'PASS:' / 'FAIL:' -- humans scan, CI greps for "FAIL:".
--
-- Expected: >=7 PASS notices total.
-- ============================================================

BEGIN;
SET LOCAL row_security = off;

-- ============================================================
-- SECTION 1: function-def proofs (inline CASE WHEN, mirror 06-withdraw-from-goal.sql:177-180)
-- Does not depend on auth.users seed.
-- ============================================================

\echo 'SECTION 1: function-def proofs'

SELECT CASE WHEN to_regprocedure('public.seed_rencana(uuid)') IS NOT NULL
       THEN 'PASS: function seed_rencana(UUID) exists'
       ELSE 'FAIL: seed_rencana(UUID) missing' END AS r;

SELECT CASE WHEN to_regprocedure('public.reset_rencana_marker()') IS NOT NULL
       THEN 'PASS: function reset_rencana_marker() exists'
       ELSE 'FAIL: reset_rencana_marker() missing' END AS r;

SELECT CASE WHEN pg_get_functiondef('public.seed_rencana(uuid)'::regprocedure) LIKE '%SET search_path%'
       THEN 'PASS: seed_rencana has SET search_path (T-07-04 mitigation)'
       ELSE 'FAIL: seed_rencana missing SET search_path' END AS r;

SELECT CASE WHEN pg_get_functiondef('public.seed_rencana(uuid)'::regprocedure) LIKE '%SECURITY DEFINER%'
       THEN 'PASS: seed_rencana is SECURITY DEFINER'
       ELSE 'FAIL: seed_rencana not SECURITY DEFINER' END AS r;

SELECT CASE WHEN to_regclass('public.user_seed_markers') IS NOT NULL
       THEN 'PASS: table user_seed_markers exists'
       ELSE 'FAIL: user_seed_markers missing' END AS r;

-- ============================================================
-- SECTION 2: behavioral scenarios (require auth.users seed)
-- Mirrors 06-process-due-recurring.sql:48-130 DO block pattern
-- ============================================================

\echo 'SECTION 2: behavioral scenarios (idempotency, counts, reset, re-seed, foreign-uid)'

DO $$
DECLARE
  v_uid       UUID := '00000000-0000-0000-0000-000000000a07';
  v_uid_b     UUID := '00000000-0000-0000-0000-000000000b07';
  v_first     BOOLEAN;
  v_second    BOOLEAN;
  v_goal_count INT;
  v_inv_count  INT;
  v_marker_count INT;
BEGIN
  -- Seed two auth.users with SKIP fallback (Pitfall 10 — restricted environments)
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role) VALUES
      (v_uid,   'phase7-seed-a@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated'),
      (v_uid_b, 'phase7-seed-b@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP: cannot seed auth.users (%)', SQLERRM;
    RETURN;
  END;

  -- Set JWT context to v_uid
  PERFORM set_config('request.jwt.claim.sub', v_uid::TEXT, true);

  -- ============================================================
  -- Scenario 1: First call — returns true, inserts 5 goals + 3 investments + 1 marker
  -- ============================================================
  v_first := seed_rencana(NULL);
  IF v_first IS TRUE THEN
    RAISE NOTICE 'PASS: Scenario 1a — first seed_rencana returns true';
  ELSE
    RAISE NOTICE 'FAIL: Scenario 1a — first call returned %', v_first;
  END IF;

  SELECT COUNT(*) INTO v_goal_count   FROM goals             WHERE user_id = v_uid;
  SELECT COUNT(*) INTO v_inv_count    FROM investments       WHERE user_id = v_uid;
  SELECT COUNT(*) INTO v_marker_count FROM user_seed_markers WHERE user_id = v_uid;

  IF v_goal_count = 5 AND v_inv_count = 3 AND v_marker_count = 1 THEN
    RAISE NOTICE 'PASS: Scenario 1b — exactly 5 goals + 3 investments + 1 marker inserted';
  ELSE
    RAISE NOTICE 'FAIL: Scenario 1b — got % goals, % investments, % markers (expected 5/3/1)',
                 v_goal_count, v_inv_count, v_marker_count;
  END IF;

  -- ============================================================
  -- Scenario 2: Second call — idempotent, returns false, counts unchanged
  -- ============================================================
  v_second := seed_rencana(NULL);
  SELECT COUNT(*) INTO v_goal_count FROM goals       WHERE user_id = v_uid;
  SELECT COUNT(*) INTO v_inv_count  FROM investments WHERE user_id = v_uid;
  IF v_second IS FALSE AND v_goal_count = 5 AND v_inv_count = 3 THEN
    RAISE NOTICE 'PASS: Scenario 2 — second call returns false, no duplicates';
  ELSE
    RAISE NOTICE 'FAIL: Scenario 2 — second call returned %, counts %/%', v_second, v_goal_count, v_inv_count;
  END IF;

  -- ============================================================
  -- Scenario 3: reset_rencana_marker deletes marker (self-only)
  -- ============================================================
  PERFORM reset_rencana_marker();
  SELECT COUNT(*) INTO v_marker_count FROM user_seed_markers WHERE user_id = v_uid;
  IF v_marker_count = 0 THEN
    RAISE NOTICE 'PASS: Scenario 3 — reset_rencana_marker deleted own marker';
  ELSE
    RAISE NOTICE 'FAIL: Scenario 3 — marker still present after reset';
  END IF;

  -- ============================================================
  -- Scenario 4: After reset, seed_rencana(NULL) returns true again (re-seed allowed)
  -- NOTE: goals/investments would now duplicate since we did NOT delete them. So we skip
  -- the count assertion and just check that the function returns true.
  -- This matches the SettingsTab flow which deletes goals BEFORE calling reset_rencana_marker
  -- (see plan 07-05).
  -- ============================================================
  v_first := seed_rencana(NULL);
  IF v_first IS TRUE THEN
    RAISE NOTICE 'PASS: Scenario 4 — seed_rencana returns true again after reset_rencana_marker';
  ELSE
    RAISE NOTICE 'FAIL: Scenario 4 — re-seed after reset returned %', v_first;
  END IF;

  -- ============================================================
  -- Scenario 5: Foreign uid + non-admin → SQLSTATE 42501 (insufficient_privilege)
  -- (mirror 06-process-due-recurring.sql:216-225 EXCEPTION block pattern)
  -- ============================================================
  PERFORM set_config('request.jwt.claim.sub', v_uid_b::TEXT, true);
  BEGIN
    PERFORM seed_rencana(v_uid);  -- v_uid_b calling with v_uid → access denied
    RAISE NOTICE 'FAIL: Scenario 5 — expected 42501 but call succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: Scenario 5 — foreign uid raises 42501 Akses ditolak';
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: Scenario 5 — wrong SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END;
END $$;

-- ============================================================
-- SECTION 3: Backfill correctness (separate DO block, fresh uid)
-- Verifies D-03 backfill pattern — marker auto-inserted for existing users with RENCANA goals
-- ============================================================

\echo 'SECTION 3: backfill correctness'

DO $$
DECLARE
  v_uid UUID := '00000000-0000-0000-0000-000000000c07';
  v_marker_count INT;
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES (v_uid, 'phase7-backfill@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP: backfill scenario — cannot seed auth.users (%)', SQLERRM;
    RETURN;
  END;

  -- Insert one RENCANA goal manually (simulates pre-migration legacy user)
  INSERT INTO goals (user_id, name, target_amount, current_amount, target_date, status)
  VALUES (v_uid, 'Dana Darurat', 24000000, 0, DATE '2026-12-01', 'active');

  -- Verify backfill ran on migration apply: marker should exist for this user.
  -- NOTE: backfill only triggers when migration runs. In a single-test ROLLBACK context,
  -- the backfill INSERT at the bottom of 0022 already ran within this transaction (SET LOCAL
  -- row_security = off allows it). So we check the marker directly.
  SELECT COUNT(*) INTO v_marker_count FROM user_seed_markers WHERE user_id = v_uid;
  IF v_marker_count = 1 THEN
    RAISE NOTICE 'PASS: Scenario 6 — backfill marker inserted for user with pre-existing RENCANA goal';
  ELSE
    RAISE NOTICE 'FAIL: Scenario 6 — backfill marker count = % (expected 1)', v_marker_count;
  END IF;

  -- Verify seed_rencana returns false for backfilled user (idempotency via D-02)
  PERFORM set_config('request.jwt.claim.sub', v_uid::TEXT, true);
  DECLARE
    v_result BOOLEAN;
  BEGIN
    v_result := seed_rencana(NULL);
    IF v_result IS FALSE THEN
      RAISE NOTICE 'PASS: Scenario 7 — seed_rencana returns false for backfilled user (D-02 idempotency)';
    ELSE
      RAISE NOTICE 'FAIL: Scenario 7 — seed_rencana returned % for backfilled user (expected false)', v_result;
    END IF;
  END;
END $$;

\echo '============================================================'
\echo 'Phase 7 seed_rencana test complete. Rolling back all changes.'
\echo 'Review output above for any FAIL: lines.'
\echo 'Expected: >=7 PASS notices (5 from SECTION 1, 5 from SECTION 2, 2 from SECTION 3).'
\echo '============================================================'

ROLLBACK;
