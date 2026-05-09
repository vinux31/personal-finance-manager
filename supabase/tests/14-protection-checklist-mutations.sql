-- ============================================================
-- Phase 14 SQL Integration Test: protection_checklist mutations
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/14-protection-checklist-mutations.sql
--
-- Validates Phase 14 mutation surface:
--   T1 — Lazy-create row on first INSERT (UPSERT semantics)
--   T2 — Update merge: subsequent UPSERT preserves prior fields
--   T3 — Owner UPSERT allowed (auth.uid() = user_id)
--   T4 — Admin cross-user UPSERT rejected (WITH CHECK 42501)
--   T5 — CHECK constraint rejects invalid enum (23514)
--   T6 — NULL reset works for 3-state radio
--
-- Setup pattern mirrors supabase/tests/12-protection-checklist.sql verbatim
-- (auth.users seed + profiles + JWT-claim-via-set_config + RLS-rejection idiom).
--
-- Expected: 6 PASS notices total (T1..T6).
-- ============================================================

BEGIN;

SET LOCAL row_security = off;

DO $$
DECLARE
  v_admin_uid UUID := '00000000-0000-0000-0000-000000000c01';
  v_user_uid  UUID := '00000000-0000-0000-0000-000000000c02';
  v_other_uid UUID := '00000000-0000-0000-0000-000000000c03';
  v_count     INT;
  v_health    TEXT;
  v_dep       BOOLEAN;
  v_will      BOOLEAN;
BEGIN
  -- Seed 3 synthetic users (admin + 2 non-admin) — abort gracefully if env disallows
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES
      (v_admin_uid, 'phase14-admin@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated'),
      (v_user_uid,  'phase14-user@example.local',  '', NOW(), NOW(), 'authenticated', 'authenticated'),
      (v_other_uid, 'phase14-other@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP ALL SECTIONS: cannot seed auth.users (%). Probably restricted environment.', SQLERRM;
    RETURN;
  END;

  INSERT INTO profiles (id, is_admin, display_name)
  VALUES (v_admin_uid, true, 'Phase14 Admin')
  ON CONFLICT (id) DO UPDATE SET is_admin = true;

  INSERT INTO profiles (id, is_admin, display_name)
  VALUES (v_user_uid, false, 'Phase14 User')
  ON CONFLICT (id) DO UPDATE SET is_admin = false;

  INSERT INTO profiles (id, is_admin, display_name)
  VALUES (v_other_uid, false, 'Phase14 Other')
  ON CONFLICT (id) DO UPDATE SET is_admin = false;

  -- ============================================================
  -- SECTION: Mutation tests under authenticated user JWT
  -- ============================================================
  RAISE NOTICE 'SECTION: protection_checklist mutations';

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_user_uid::TEXT, true);

  -- ============================================================
  -- T1 — Lazy-create row on first UPSERT
  -- ============================================================
  INSERT INTO protection_checklist (user_id, health_coverage)
  VALUES (v_user_uid, 'bpjs')
  ON CONFLICT (user_id) DO UPDATE SET health_coverage = EXCLUDED.health_coverage,
                                       updated_at = NOW();
  SELECT health_coverage, has_dependents INTO v_health, v_dep
  FROM protection_checklist WHERE user_id = v_user_uid;
  IF v_health = 'bpjs' AND v_dep IS NULL THEN
    RAISE NOTICE 'PASS: T1 lazy-create — health_coverage=bpjs, has_dependents=NULL';
  ELSE
    RAISE NOTICE 'FAIL: T1 lazy-create — got health=%, has_dependents=%', v_health, v_dep;
  END IF;

  -- ============================================================
  -- T2 — Update merge preserves prior fields
  -- ============================================================
  INSERT INTO protection_checklist (user_id, has_dependents)
  VALUES (v_user_uid, true)
  ON CONFLICT (user_id) DO UPDATE SET has_dependents = EXCLUDED.has_dependents,
                                       updated_at = NOW();
  SELECT health_coverage, has_dependents INTO v_health, v_dep
  FROM protection_checklist WHERE user_id = v_user_uid;
  IF v_health = 'bpjs' AND v_dep = true THEN
    RAISE NOTICE 'PASS: T2 update merge preserves health_coverage';
  ELSE
    RAISE NOTICE 'FAIL: T2 update merge — got health=%, has_dependents=%', v_health, v_dep;
  END IF;

  -- ============================================================
  -- T3 — Owner UPSERT allowed (implicit from T1+T2 success under v_user_uid JWT)
  -- ============================================================
  RAISE NOTICE 'PASS: T3 owner UPSERT allowed (T1+T2 succeeded under JWT claim sub=v_user_uid)';

  -- ============================================================
  -- T4 — Admin cross-user UPSERT rejected (WITH CHECK 42501)
  -- ============================================================
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::TEXT, true);
  BEGIN
    INSERT INTO protection_checklist (user_id, health_coverage)
    VALUES (v_other_uid, 'kantor')
    ON CONFLICT (user_id) DO UPDATE SET health_coverage = 'kantor';
    RAISE NOTICE 'FAIL: T4 admin cross-user UPSERT SUCCEEDED (WITH CHECK leaked)';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'PASS: T4 admin cross-user UPSERT raised 42501 (WITH CHECK enforced)';
    ELSE
      RAISE NOTICE 'FAIL: T4 admin cross-user UPSERT raised wrong SQLSTATE % -- %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- ============================================================
  -- T5 — CHECK constraint rejects invalid enum (23514)
  -- ============================================================
  RESET ROLE;
  SET LOCAL row_security = off;
  BEGIN
    INSERT INTO protection_checklist (user_id, health_coverage)
    VALUES ('00000000-0000-0000-0000-000000000ce5'::UUID, 'invalid_value');
    RAISE NOTICE 'FAIL: T5 invalid health_coverage SUCCEEDED';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: T5 CHECK rejects invalid health_coverage enum (23514)';
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: T5 wrong SQLSTATE % -- %', SQLSTATE, SQLERRM;
  END;

  -- ============================================================
  -- T6 — NULL reset works for 3-state radio
  -- ============================================================
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_user_uid::TEXT, true);
  INSERT INTO protection_checklist (user_id, estate_will_exists)
  VALUES (v_user_uid, true)
  ON CONFLICT (user_id) DO UPDATE SET estate_will_exists = true, updated_at = NOW();
  INSERT INTO protection_checklist (user_id, estate_will_exists)
  VALUES (v_user_uid, NULL)
  ON CONFLICT (user_id) DO UPDATE SET estate_will_exists = NULL, updated_at = NOW();
  SELECT estate_will_exists INTO v_will FROM protection_checklist WHERE user_id = v_user_uid;
  IF v_will IS NULL THEN
    RAISE NOTICE 'PASS: T6 NULL reset works for 3-state radio (estate_will_exists IS NULL)';
  ELSE
    RAISE NOTICE 'FAIL: T6 NULL reset got estate_will_exists=%', v_will;
  END IF;

  RESET ROLE;
END $$;

\echo '============================================================'
\echo 'Phase 14 protection_checklist mutations test complete.'
\echo 'Expected: 6 PASS notices total (T1..T6).'
\echo '============================================================'

ROLLBACK;
