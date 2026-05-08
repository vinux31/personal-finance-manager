-- ============================================================
-- Phase 12 SQL Integration Test: protection_checklist RLS + CHECK
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/12-protection-checklist.sql
--
-- Validates migration 0029_protection_checklist.sql (must be applied first).
--
-- Expected: 8 PASS notices total
--   Section 1 (RLS isolation):     5
--   Section 2 (CHECK constraints): 3
-- ============================================================

BEGIN;

SET LOCAL row_security = off;

DO $$
DECLARE
  v_admin_uid UUID := '00000000-0000-0000-0000-000000000c01';
  v_user_uid  UUID := '00000000-0000-0000-0000-000000000c02';
  v_other_uid UUID := '00000000-0000-0000-0000-000000000c03';
  v_count     INT;
BEGIN
  -- Seed 3 synthetic users (admin + 2 non-admin) — abort gracefully if env disallows
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES
      (v_admin_uid, 'phase12-admin@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated'),
      (v_user_uid,  'phase12-user@example.local',  '', NOW(), NOW(), 'authenticated', 'authenticated'),
      (v_other_uid, 'phase12-other@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP ALL SECTIONS: cannot seed auth.users (%). Probably restricted environment.', SQLERRM;
    RETURN;
  END;

  INSERT INTO profiles (id, is_admin, display_name)
  VALUES (v_admin_uid, true, 'Phase12 Admin')
  ON CONFLICT (id) DO UPDATE SET is_admin = true;

  INSERT INTO profiles (id, is_admin, display_name)
  VALUES (v_user_uid, false, 'Phase12 User')
  ON CONFLICT (id) DO UPDATE SET is_admin = false;

  INSERT INTO profiles (id, is_admin, display_name)
  VALUES (v_other_uid, false, 'Phase12 Other')
  ON CONFLICT (id) DO UPDATE SET is_admin = false;

  -- Seed protection_checklist row untuk other user (target of cross-user attempts)
  INSERT INTO protection_checklist (user_id, health_coverage)
  VALUES (v_other_uid, 'bpjs')
  ON CONFLICT (user_id) DO UPDATE SET health_coverage = 'bpjs';

  -- ============================================================
  -- SECTION 1: RLS isolation (non-admin scope)
  -- ============================================================
  RAISE NOTICE 'SECTION 1: RLS isolation';

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_user_uid::TEXT, true);

  -- Test 1.1 — non-admin tidak bisa SELECT row user lain
  SELECT count(*) INTO v_count FROM protection_checklist WHERE user_id = v_other_uid;
  IF v_count = 0 THEN
    RAISE NOTICE 'PASS: non-admin cannot SELECT other user protection_checklist row';
  ELSE
    RAISE NOTICE 'FAIL: non-admin sees % rows for other user (RLS leaked)', v_count;
  END IF;

  -- Test 1.2 — non-admin bisa INSERT row sendiri
  BEGIN
    INSERT INTO protection_checklist (user_id, health_coverage)
    VALUES (v_user_uid, 'kantor');
    RAISE NOTICE 'PASS: non-admin INSERT own row succeeded';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: non-admin INSERT own row raised: %', SQLERRM;
  END;

  -- Test 1.3 — non-admin UPDATE row user lain hits 0 rows (RLS USING filter)
  UPDATE protection_checklist SET health_coverage = 'tidak' WHERE user_id = v_other_uid;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE NOTICE 'PASS: non-admin UPDATE other user row affected 0 rows (RLS filter)';
  ELSE
    RAISE NOTICE 'FAIL: non-admin UPDATE other user row affected % rows', v_count;
  END IF;

  -- Test 1.4 — admin bisa SELECT semua rows (View-As precondition)
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::TEXT, true);
  SELECT count(*) INTO v_count FROM protection_checklist WHERE user_id IN (v_user_uid, v_other_uid);
  IF v_count = 2 THEN
    RAISE NOTICE 'PASS: admin SELECT both seeded rows (% = 2)', v_count;
  ELSE
    RAISE NOTICE 'FAIL: admin sees % rows (expected 2)', v_count;
  END IF;

  -- Test 1.5 — admin tidak bisa INSERT row atas nama user lain (WITH CHECK enforces auth.uid() = user_id)
  BEGIN
    INSERT INTO protection_checklist (user_id, has_dependents)
    VALUES ('00000000-0000-0000-0000-000000000c99'::UUID, true);
    RAISE NOTICE 'FAIL: admin INSERT atas nama user lain SUCCEEDED (WITH CHECK leaked)';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'PASS: admin INSERT cross-user raised SQLSTATE 42501 (WITH CHECK enforced)';
    ELSE
      RAISE NOTICE 'FAIL: admin INSERT cross-user raised wrong SQLSTATE % -- %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- ============================================================
  -- SECTION 2: CHECK constraints
  -- ============================================================
  RAISE NOTICE 'SECTION 2: CHECK constraints';

  RESET ROLE;
  SET LOCAL row_security = off;

  -- Test 2.1 — health_coverage='invalid' raises 23514
  BEGIN
    INSERT INTO protection_checklist (user_id, health_coverage)
    VALUES ('00000000-0000-0000-0000-000000000ce1'::UUID, 'invalid_value');
    RAISE NOTICE 'FAIL: invalid health_coverage SUCCEEDED';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: invalid health_coverage raised check_violation (23514)';
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: invalid health_coverage raised wrong SQLSTATE % -- %', SQLSTATE, SQLERRM;
  END;

  -- Test 2.2 — life_coverage='invalid' raises 23514
  BEGIN
    INSERT INTO protection_checklist (user_id, life_coverage)
    VALUES ('00000000-0000-0000-0000-000000000ce2'::UUID, 'badvalue');
    RAISE NOTICE 'FAIL: invalid life_coverage SUCCEEDED';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: invalid life_coverage raised check_violation (23514)';
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: invalid life_coverage raised wrong SQLSTATE % -- %', SQLSTATE, SQLERRM;
  END;

  -- Test 2.3 — life_coverage_post_employment='invalid' raises 23514
  BEGIN
    INSERT INTO protection_checklist (user_id, life_coverage_post_employment)
    VALUES ('00000000-0000-0000-0000-000000000ce3'::UUID, 'maybe');
    RAISE NOTICE 'FAIL: invalid life_coverage_post_employment SUCCEEDED';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: invalid life_coverage_post_employment raised check_violation (23514)';
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: invalid life_coverage_post_employment raised wrong SQLSTATE % -- %', SQLSTATE, SQLERRM;
  END;

  RESET ROLE;
END $$;

\echo '============================================================'
\echo 'Phase 12 protection_checklist test complete. Rolling back.'
\echo 'Expected: 8 PASS notices total.'
\echo '============================================================'

ROLLBACK;
