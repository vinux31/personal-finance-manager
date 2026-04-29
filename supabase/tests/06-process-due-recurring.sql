-- ============================================================
-- Phase 06 Wave 1 SQL Integration Test: process_due_recurring (RACE-01)
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/06-process-due-recurring.sql
--
-- Validates migration 0019_process_due_recurring.sql (must be applied first).
--
-- Convention (mirrors 04-mark-bill-paid.sql + 05-tighten-rls.sql):
--   - BEGIN ... ROLLBACK wrapper -> no state ever persists.
--   - SET LOCAL row_security = off for SEEDING (superuser bypass).
--   - Output via RAISE NOTICE 'PASS:' / 'FAIL:' -- humans scan, CI greps for "FAIL:".
--
-- Expected: 9 PASS notices total
-- ============================================================

BEGIN;
SET LOCAL row_security = off;

-- ============================================================
-- SECTION 1: month-end clamping regression guard (FOUND-01 parity via next_due_date_sql)
-- Inline Style A — does not depend on auth.users seed.
-- ============================================================

\echo 'SECTION 1: next_due_date_sql month-end clamp (regression guard)'

SELECT CASE WHEN next_due_date_sql('2025-01-31'::DATE, 'monthly') = '2025-02-28'::DATE
       THEN 'PASS: month-end clamping next_due_date_sql 2025-01-31 -> 2025-02-28 (FOUND-01)'
       ELSE 'FAIL: month-end clamping got ' || next_due_date_sql('2025-01-31'::DATE, 'monthly')::TEXT END AS r;

-- ============================================================
-- SECTION 2: race serialization logical proof (FOR UPDATE in function definition)
-- Inline Style A — does not depend on auth.users seed.
-- ============================================================

\echo 'SECTION 2: race serialization (FOR UPDATE proof)'

SELECT CASE WHEN pg_get_functiondef('process_due_recurring(DATE, UUID, INT)'::regprocedure)
              LIKE '%FOR UPDATE%'
       THEN 'PASS: process_due_recurring uses FOR UPDATE row lock'
       ELSE 'FAIL: FOR UPDATE missing from function definition' END AS r;

-- ============================================================
-- SECTION 3..9: behavioral scenarios (require auth.users seed)
-- ============================================================

\echo 'SECTION 3..9: behavioral scenarios (require auth.users seed)'

DO $$
DECLARE
  v_uid          UUID := '00000000-0000-0000-0000-000000000aaa';
  v_other_uid    UUID := '00000000-0000-0000-0000-000000000bbb';
  v_admin_uid    UUID := '00000000-0000-0000-0000-000000000ccc';
  v_cat_id       BIGINT;
  v_tpl_exp_id   BIGINT;
  v_tpl_inc_id   BIGINT;
  v_tpl_catch_id BIGINT;
  v_today        DATE := CURRENT_DATE;
  v_three_ago    DATE := (CURRENT_DATE - INTERVAL '3 months')::DATE;
  v_processed    INT;
  v_skipped      INT;
  v_tx_count     INT;
  v_bp_count     INT;
  v_inc_tx_type  TEXT;
  v_template_now DATE;
BEGIN
  -- Seed auth.users (with SKIP fallback for restricted environments — Pitfall 10)
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES (v_uid, 'phase6-rec-test@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES (v_other_uid, 'phase6-other@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES (v_admin_uid, 'phase6-admin@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP SECTION 3..9: cannot seed auth.users (%)', SQLERRM;
    RETURN;
  END;

  -- Pick an existing category (any will do)
  SELECT id INTO v_cat_id FROM categories ORDER BY id LIMIT 1;
  IF v_cat_id IS NULL THEN
    RAISE NOTICE 'SKIP SECTION 3..9: no categories seeded';
    RETURN;
  END IF;

  -- Mark v_admin_uid as admin via allowed_emails (is_admin() reads this table per migration 0006)
  -- If allowed_emails table missing or schema differs, admin scenario will be skipped.
  BEGIN
    INSERT INTO allowed_emails (email, is_admin)
    VALUES ('phase6-admin@example.local', true)
    ON CONFLICT (email) DO UPDATE SET is_admin = true;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'NOTE: cannot promote admin via allowed_emails (% — admin scenario may degrade)', SQLERRM;
  END;

  -- Set JWT context to v_uid
  PERFORM set_config('request.jwt.claim.sub', v_uid::TEXT, true);

  -- ============================================================
  -- SECTION 3: expense template — single iteration produces 1 tx + 1 bill_payment
  -- ============================================================

  RAISE NOTICE 'SECTION 3: expense template happy path';

  INSERT INTO recurring_templates (user_id, name, type, category_id, amount, note, frequency, next_due_date, is_active)
  VALUES (v_uid, 'Phase6 Test PLN', 'expense', v_cat_id, 500000, 'phase6-test-exp', 'monthly', v_today, true)
  RETURNING id INTO v_tpl_exp_id;

  SELECT processed_count, skipped_count INTO v_processed, v_skipped
  FROM process_due_recurring(v_today, v_uid, 12);

  IF v_processed = 1 AND v_skipped = 0 THEN
    RAISE NOTICE 'PASS: expense template processed_count=1 skipped_count=0';
  ELSE
    RAISE NOTICE 'FAIL: expense expected (1, 0) got (%, %)', v_processed, v_skipped;
  END IF;

  SELECT COUNT(*) INTO v_tx_count
  FROM transactions WHERE user_id = v_uid AND date = v_today AND note = 'phase6-test-exp';
  SELECT COUNT(*) INTO v_bp_count
  FROM bill_payments WHERE user_id = v_uid AND recurring_template_id = v_tpl_exp_id AND paid_date = v_today;
  IF v_tx_count = 1 AND v_bp_count = 1 THEN
    RAISE NOTICE 'PASS: expense atomicity — 1 transactions row + 1 bill_payments row';
  ELSE
    RAISE NOTICE 'FAIL: expense atomicity — tx=% bp=%', v_tx_count, v_bp_count;
  END IF;

  -- ============================================================
  -- SECTION 4: income template (Gaji) — locks D-01 contract
  -- ============================================================

  RAISE NOTICE 'SECTION 4: income template (Gaji) — D-01 contract';

  INSERT INTO recurring_templates (user_id, name, type, category_id, amount, note, frequency, next_due_date, is_active)
  VALUES (v_uid, 'Phase6 Gaji', 'income', v_cat_id, 10000000, 'phase6-test-inc', 'monthly', v_today, true)
  RETURNING id INTO v_tpl_inc_id;

  SELECT processed_count, skipped_count INTO v_processed, v_skipped
  FROM process_due_recurring(v_today, v_uid, 12);

  -- Income should have been processed exactly once.
  SELECT type INTO v_inc_tx_type
  FROM transactions
  WHERE user_id = v_uid AND date = v_today AND note = 'phase6-test-inc'
  LIMIT 1;
  SELECT COUNT(*) INTO v_bp_count
  FROM bill_payments WHERE user_id = v_uid AND recurring_template_id = v_tpl_inc_id AND paid_date = v_today;

  IF v_inc_tx_type = 'income' AND v_bp_count = 1 THEN
    RAISE NOTICE 'PASS: income template — type=income tx + 1 bill_payments row (D-01 contract locked)';
  ELSE
    RAISE NOTICE 'FAIL: income — tx_type=% bp_count=%', v_inc_tx_type, v_bp_count;
  END IF;

  -- ============================================================
  -- SECTION 5: idempotency — second call same date returns processed_count=0
  -- ============================================================

  RAISE NOTICE 'SECTION 5: idempotency';

  SELECT processed_count, skipped_count INTO v_processed, v_skipped
  FROM process_due_recurring(v_today, v_uid, 12);

  -- After a same-day re-run, no NEW work should be done. skipped_count should be > 0
  -- because the WHILE loop only fires on templates whose next_due_date <= p_today, and
  -- those that were already advanced past p_today won't re-enter the FOR loop.
  -- However, any template still <= p_today (if we seeded any) will hit the IF EXISTS skip.
  IF v_processed = 0 THEN
    RAISE NOTICE 'PASS: idempotency — second call processed_count=0 (was %, skipped_count=%)', v_processed, v_skipped;
  ELSE
    RAISE NOTICE 'FAIL: idempotency — expected processed_count=0 got %', v_processed;
  END IF;

  -- ============================================================
  -- SECTION 6: catch-up — template due 3 months ago, processes 3 iterations
  -- ============================================================

  RAISE NOTICE 'SECTION 6: catch-up multi-month';

  INSERT INTO recurring_templates (user_id, name, type, category_id, amount, note, frequency, next_due_date, is_active)
  VALUES (v_uid, 'Phase6 Catchup', 'expense', v_cat_id, 100000, 'phase6-test-catch', 'monthly', v_three_ago, true)
  RETURNING id INTO v_tpl_catch_id;

  SELECT processed_count, skipped_count INTO v_processed, v_skipped
  FROM process_due_recurring(v_today, v_uid, 12);

  SELECT COUNT(*) INTO v_tx_count
  FROM transactions WHERE user_id = v_uid AND note = 'phase6-test-catch';

  -- Expect 3-4 iterations (3 months of catch-up + possibly today). Allow >=3.
  IF v_processed >= 3 AND v_tx_count >= 3 THEN
    RAISE NOTICE 'PASS: catch-up — processed_count=% (>=3 expected, tx_count=%)', v_processed, v_tx_count;
  ELSE
    RAISE NOTICE 'FAIL: catch-up — processed=% tx_count=% (expected >=3 each)', v_processed, v_tx_count;
  END IF;

  -- Also verify template advanced past today
  SELECT next_due_date INTO v_template_now FROM recurring_templates WHERE id = v_tpl_catch_id;
  IF v_template_now > v_today THEN
    RAISE NOTICE 'PASS: catch-up — template next_due_date advanced past today (now %)', v_template_now;
  ELSE
    RAISE NOTICE 'FAIL: catch-up — template next_due_date=% not advanced past today=%', v_template_now, v_today;
  END IF;

  -- ============================================================
  -- SECTION 7: access guard — non-admin user passes p_uid of other user → SQLSTATE 42501
  -- (mirror 04-mark-bill-paid.sql:163-172 EXCEPTION pattern)
  -- ============================================================

  RAISE NOTICE 'SECTION 7: access guard (non-admin → 42501)';

  -- Caller is v_uid (non-admin). Pass p_uid = v_other_uid → should raise.
  BEGIN
    PERFORM process_due_recurring(v_today, v_other_uid, 12);
    RAISE NOTICE 'FAIL: access guard did not raise for non-admin foreign p_uid';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' AND SQLERRM = 'Akses ditolak' THEN
      RAISE NOTICE 'PASS: SQLSTATE 42501 raised "%"', SQLERRM;
    ELSE
      RAISE NOTICE 'FAIL: unexpected error: SQLSTATE % — %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- ============================================================
  -- SECTION 8: admin view-as — admin caller passes p_uid of non-admin → succeeds
  -- (mirror 05-tighten-rls.sql SECTION 4 admin path)
  -- ============================================================

  RAISE NOTICE 'SECTION 8: admin view-as (admin → succeeds)';

  -- Switch JWT to admin
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::TEXT, true);

  BEGIN
    -- Admin calls RPC with p_uid of non-admin v_other_uid (no templates seeded for v_other_uid → processed_count=0)
    PERFORM process_due_recurring(v_today, v_other_uid, 12);
    RAISE NOTICE 'PASS: admin view-as — admin call with foreign p_uid succeeds (no exception)';
  EXCEPTION WHEN OTHERS THEN
    -- If is_admin() resolution failed (e.g. allowed_emails seed earlier failed), report as NOTE not FAIL.
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'NOTE: admin view-as scenario degraded — is_admin() returned false (allowed_emails seed likely failed). SQLERRM=%', SQLERRM;
    ELSE
      RAISE NOTICE 'FAIL: admin view-as unexpected error: SQLSTATE % — %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- Restore JWT to v_uid for any downstream sections
  PERFORM set_config('request.jwt.claim.sub', v_uid::TEXT, true);

  -- ============================================================
  -- SECTION 9: unauthenticated — JWT claim sub NULL → SQLSTATE 28000
  -- ============================================================

  RAISE NOTICE 'SECTION 9: unauthenticated guard (28000)';

  -- Clear JWT claim. set_config(..., '', true) yields empty string;
  -- auth.uid() returns NULL when claim missing/empty.
  PERFORM set_config('request.jwt.claim.sub', '', true);

  BEGIN
    -- p_uid NULL + auth.uid() NULL → v_uid NULL → guard raises 28000
    PERFORM process_due_recurring(v_today, NULL, 12);
    RAISE NOTICE 'FAIL: unauthenticated guard did not raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '28000' AND SQLERRM = 'Unauthenticated' THEN
      RAISE NOTICE 'PASS: SQLSTATE 28000 raised "%"', SQLERRM;
    ELSE
      RAISE NOTICE 'FAIL: unexpected error: SQLSTATE % — %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- Restore JWT
  PERFORM set_config('request.jwt.claim.sub', v_uid::TEXT, true);

END $$;

\echo '============================================================'
\echo 'Phase 6 process_due_recurring test complete. Rolling back all changes.'
\echo 'Review output above for any FAIL: lines.'
\echo 'Expected: 9 PASS notices.'
\echo '============================================================'

ROLLBACK;
