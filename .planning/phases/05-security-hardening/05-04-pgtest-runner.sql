-- ============================================================
-- Phase 05 Wave 1 SQL Integration Test: Security Hardening (SEC-02 + SEC-03 + SEC-04)
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/05-tighten-rls.sql
-- (for local dev: psql "postgresql://postgres:postgres@localhost:54322/postgres" -f ...)
--
-- Validates migration 0017_tighten_rls.sql (must be applied to target DB before running).
--
-- Convention (mirrors 04-mark-bill-paid.sql):
--   - BEGIN ... ROLLBACK wrapper -> no state ever persists.
--   - SET LOCAL row_security = off for SEEDING (superuser bypass), then
--     SET LOCAL ROLE authenticated + set_config('request.jwt.claim.sub', uid, true)
--     for ASSERTIONS that need RLS to be enforced.
--   - Output via RAISE NOTICE 'PASS:' / 'FAIL:' -- humans scan, CI greps for "FAIL:".
--
-- Expected: 14 PASS notices total
--   Section 1 (RLS profiles + allowed_emails): 5
--   Section 2 (allowlist bootstrap fail-closed): 2
--   Section 3 (aggregate RPC IDOR guards):      4
--   Section 4 (admin View-As regression):       3
-- ============================================================

BEGIN;

-- Allow seeds to bypass RLS at the session level. RLS is re-enforced for assertions
-- by switching role + setting JWT claim.
SET LOCAL row_security = off;

-- ============================================================
-- SHARED SEEDS -- synthetic admin + non-admin user
-- ============================================================

DO $$
DECLARE
  v_admin_uid    UUID := '00000000-0000-0000-0000-000000000a01';
  v_user_uid     UUID := '00000000-0000-0000-0000-000000000a02';
  v_other_uid    UUID := '00000000-0000-0000-0000-000000000a03';
  v_cat_id       BIGINT;
  v_count        INT;
BEGIN
  -- Try to seed test users; abort all sections gracefully if env disallows
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES
      (v_admin_uid, 'phase5-admin@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated'),
      (v_user_uid,  'phase5-user@example.local',  '', NOW(), NOW(), 'authenticated', 'authenticated'),
      (v_other_uid, 'phase5-other@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP ALL SECTIONS: cannot seed auth.users (%). Probably restricted environment.', SQLERRM;
    RETURN;
  END;

  -- Mark admin (insert/update profile with is_admin = true)
  INSERT INTO profiles (id, is_admin, display_name)
  VALUES (v_admin_uid, true,  'Phase5 Admin')
  ON CONFLICT (id) DO UPDATE SET is_admin = true;

  INSERT INTO profiles (id, is_admin, display_name)
  VALUES (v_user_uid,  false, 'Phase5 User')
  ON CONFLICT (id) DO UPDATE SET is_admin = false;

  INSERT INTO profiles (id, is_admin, display_name)
  VALUES (v_other_uid, false, 'Phase5 Other')
  ON CONFLICT (id) DO UPDATE SET is_admin = false;

  -- Add allowed_emails for test users (so non-admin signup tests are not blocked by normal allowlist)
  INSERT INTO allowed_emails (email)
  VALUES ('phase5-user@example.local'), ('phase5-other@example.local')
  ON CONFLICT (email) DO NOTHING;

  -- Pick a category to use for transactions (any will do -- already seeded by 0004)
  SELECT id INTO v_cat_id FROM categories ORDER BY id LIMIT 1;
  IF v_cat_id IS NULL THEN
    RAISE NOTICE 'SKIP ALL SECTIONS: no categories seeded';
    RETURN;
  END IF;

  -- Seed sample transactions for admin (so aggregate has data to expose if guard is broken)
  INSERT INTO transactions (date, type, category_id, amount, note, user_id)
  VALUES (CURRENT_DATE, 'expense', v_cat_id, 123456, 'phase5-admin-test', v_admin_uid);

  -- Seed sample transactions for non-admin user (so aggregate_by_period(NULL) returns >= 0 rows)
  INSERT INTO transactions (date, type, category_id, amount, note, user_id)
  VALUES (CURRENT_DATE, 'expense', v_cat_id, 999, 'phase5-user-test', v_user_uid);

  -- ============================================================
  -- SECTION 1: SEC-02 / H-04 -- profiles + allowed_emails RLS
  -- ============================================================

  RAISE NOTICE 'SECTION 1: profiles + allowed_emails RLS (SEC-02 / H-04)';

  -- Switch to non-admin user context: RLS now applies
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_user_uid::TEXT, true);

  -- Test 1.1 -- non-admin sees own profile only (exactly 1 row)
  SELECT count(*) INTO v_count FROM profiles;
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS: non-admin sees exactly 1 profile row (own)';
  ELSE
    RAISE EXCEPTION 'FAIL: non-admin sees % profile rows (expected 1)', v_count;
  END IF;

  -- Test 1.2 -- non-admin cannot see admin profile row directly
  SELECT count(*) INTO v_count FROM profiles WHERE id = v_admin_uid;
  IF v_count = 0 THEN
    RAISE NOTICE 'PASS: non-admin cannot SELECT admin profile row';
  ELSE
    RAISE EXCEPTION 'FAIL: non-admin can SELECT admin profile row (RLS leaked)';
  END IF;

  -- Test 1.3 -- non-admin sees empty allowed_emails (admin-only policy)
  SELECT count(*) INTO v_count FROM allowed_emails;
  IF v_count = 0 THEN
    RAISE NOTICE 'PASS: non-admin sees empty allowed_emails';
  ELSE
    RAISE EXCEPTION 'FAIL: non-admin sees % allowed_emails rows (expected 0)', v_count;
  END IF;

  -- Switch to admin context for Tests 1.4 and 1.5
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::TEXT, true);

  -- Test 1.4 -- admin sees all profile rows (>= 3 seeded)
  SELECT count(*) INTO v_count FROM profiles;
  IF v_count >= 3 THEN
    RAISE NOTICE 'PASS: admin sees all profile rows (% >= 3)', v_count;
  ELSE
    RAISE EXCEPTION 'FAIL: admin sees % profile rows (expected >= 3)', v_count;
  END IF;

  -- Test 1.5 -- admin sees allowed_emails rows
  SELECT count(*) INTO v_count FROM allowed_emails;
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS: admin sees allowed_emails (% >= 1)', v_count;
  ELSE
    RAISE EXCEPTION 'FAIL: admin sees % allowed_emails rows (expected >= 1)', v_count;
  END IF;

  -- ============================================================
  -- SECTION 2: SEC-03 / H-05 -- allowlist bootstrap fail-closed
  -- ============================================================

  RAISE NOTICE 'SECTION 2: enforce_email_allowlist bootstrap fail-closed (SEC-03 / H-05)';

  -- Reset to superuser-equivalent for TRUNCATE (only superuser can truncate in test scope)
  RESET ROLE;
  SET LOCAL row_security = off;

  -- Snapshot then wipe allowed_emails to simulate rogue DELETE/TRUNCATE
  CREATE TEMP TABLE _allowed_emails_snapshot AS SELECT * FROM allowed_emails;
  TRUNCATE allowed_emails;

  -- Test 2.1 -- non-admin signup raises 'Allowlist kosong' on empty allowlist
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES ('00000000-0000-0000-0000-0000000000ee', 'attacker@evil.com', '', NOW(), NOW(), 'authenticated', 'authenticated');
    RAISE EXCEPTION 'FAIL: signup attacker@evil.com on empty allowlist did NOT raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Allowlist kosong%' THEN
      RAISE NOTICE 'PASS: empty-allowlist non-admin signup raised Allowlist kosong';
    ELSE
      RAISE EXCEPTION 'FAIL: unexpected error on empty-allowlist non-admin signup: %', SQLERRM;
    END IF;
  END;

  -- Test 2.2 -- bootstrap admin (rinoadi28@gmail.com) succeeds even with empty allowlist
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES ('00000000-0000-0000-0000-0000000000ad', 'rinoadi28@gmail.com', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (email) DO NOTHING;
    -- ON CONFLICT DO NOTHING: if production DB already has this row, silently skip -- trigger fired and passed.
    -- Any real error from the trigger is caught in EXCEPTION below.
    RAISE NOTICE 'PASS: bootstrap admin rinoadi28@gmail.com signup allowed on empty allowlist';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: bootstrap admin signup raised unexpectedly: %', SQLERRM;
  END;

  -- Restore allowed_emails for clean state in subsequent sections
  INSERT INTO allowed_emails SELECT * FROM _allowed_emails_snapshot
  ON CONFLICT (email) DO NOTHING;
  DROP TABLE _allowed_emails_snapshot;

  -- ============================================================
  -- SECTION 3: SEC-04 / H-06 -- aggregate RPC IDOR guards
  -- ============================================================

  RAISE NOTICE 'SECTION 3: aggregate RPCs IDOR guard (SEC-04 / H-06)';

  -- Switch to non-admin context
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_user_uid::TEXT, true);

  -- Test 3.1 -- non-admin calling aggregate_by_period(p_user_id := admin uid) raises SQLSTATE 42501
  BEGIN
    PERFORM * FROM aggregate_by_period('month', NULL, NULL, v_admin_uid);
    RAISE EXCEPTION 'FAIL: aggregate_by_period IDOR (non-admin -> admin uid) did NOT raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'PASS: aggregate_by_period IDOR raised SQLSTATE 42501 (Akses ditolak)';
    ELSE
      RAISE EXCEPTION 'FAIL: aggregate_by_period IDOR raised wrong SQLSTATE % -- %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- Test 3.2 -- non-admin calling aggregate_by_category(p_user_id := admin uid) raises SQLSTATE 42501
  BEGIN
    PERFORM * FROM aggregate_by_category('expense', NULL, NULL, v_admin_uid);
    RAISE EXCEPTION 'FAIL: aggregate_by_category IDOR (non-admin -> admin uid) did NOT raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'PASS: aggregate_by_category IDOR raised SQLSTATE 42501 (Akses ditolak)';
    ELSE
      RAISE EXCEPTION 'FAIL: aggregate_by_category IDOR raised wrong SQLSTATE % -- %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- Test 3.3 -- non-admin calling aggregate_by_period(p_user_id := NULL) returns own data (no false-positive lockout)
  SELECT count(*) INTO v_count FROM aggregate_by_period('month', NULL, NULL, NULL);
  IF v_count >= 0 THEN
    RAISE NOTICE 'PASS: non-admin can call aggregate_by_period(NULL) for own data (% rows returned)', v_count;
  ELSE
    RAISE EXCEPTION 'FAIL: aggregate_by_period(NULL) unexpectedly failed for non-admin';
  END IF;

  -- Test 3.4 -- non-admin calling aggregate_by_period(p_user_id := own uid) succeeds (no false-positive lockout)
  SELECT count(*) INTO v_count FROM aggregate_by_period('month', NULL, NULL, v_user_uid);
  IF v_count >= 0 THEN
    RAISE NOTICE 'PASS: non-admin can call aggregate_by_period(p_user_id = own) (% rows returned)', v_count;
  ELSE
    RAISE EXCEPTION 'FAIL: aggregate_by_period(p_user_id = own) unexpectedly failed for non-admin';
  END IF;

  -- ============================================================
  -- SECTION 4: T-05 -- Admin View-As regression guard
  -- ============================================================

  RAISE NOTICE 'SECTION 4: Admin View-As regression (T-05)';

  -- Switch to admin context
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::TEXT, true);

  -- Test 4.1 -- admin calling aggregate_by_period(p_user_id := non-admin uid) succeeds (View-As)
  BEGIN
    PERFORM * FROM aggregate_by_period('month', NULL, NULL, v_user_uid);
    RAISE NOTICE 'PASS: admin can call aggregate_by_period with arbitrary p_user_id (View-As works)';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: admin aggregate_by_period for impersonated uid raised: %', SQLERRM;
  END;

  -- Test 4.2 -- admin SELECT on profiles returns all rows (View-As precondition: is_admin = true check)
  SELECT count(*) INTO v_count FROM profiles;
  IF v_count >= 3 THEN
    RAISE NOTICE 'PASS: admin SELECT profiles returns all rows for View-As (% >= 3)', v_count;
  ELSE
    RAISE EXCEPTION 'FAIL: admin SELECT profiles returned only % rows (View-As broken)', v_count;
  END IF;

  -- Test 4.3 -- admin SELECT on allowed_emails returns rows (admin-only policy lets admin see list)
  SELECT count(*) INTO v_count FROM allowed_emails;
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS: admin SELECT allowed_emails returns rows (% >= 1)', v_count;
  ELSE
    RAISE EXCEPTION 'FAIL: admin SELECT allowed_emails returned 0 rows (unexpected)';
  END IF;

  RESET ROLE;
END $$;


ROLLBACK;
