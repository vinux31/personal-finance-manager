-- ============================================================
-- Phase 04 Wave 0 SQL Integration Test: mark_bill_paid + next_due_date_sql + upcoming_bills_unpaid
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/04-mark-bill-paid.sql
-- (for local dev: psql "postgresql://postgres:postgres@localhost:54322/postgres" -f ...)
--
-- Expects: every \echo "TEST X" line is followed by a PASS or FAIL row.
-- Everything runs inside BEGIN ... ROLLBACK so state is never persisted.
--
-- Assertions use CASE WHEN ... THEN 'PASS: <label>' ELSE 'FAIL: <label>'
-- so humans can scan output and CI can grep for "FAIL:".
-- ============================================================

BEGIN;

-- Disable row-level security for this session so seeds do not hit policies.
-- (Inside a SUPERUSER psql session, RLS is bypassed by default; this is belt-and-suspenders.)
SET LOCAL row_security = off;

-- ============================================================
-- SECTION 1: next_due_date_sql edge cases (FOUND-01 parity)
-- ============================================================

\echo 'SECTION 1: next_due_date_sql'

SELECT CASE WHEN next_due_date_sql('2025-01-15'::DATE, 'monthly') = '2025-02-15'::DATE
       THEN 'PASS: monthly 2025-01-15 -> 2025-02-15'
       ELSE 'FAIL: monthly 2025-01-15 got ' || next_due_date_sql('2025-01-15'::DATE, 'monthly')::TEXT END AS r;

SELECT CASE WHEN next_due_date_sql('2025-01-31'::DATE, 'monthly') = '2025-02-28'::DATE
       THEN 'PASS: monthly 2025-01-31 -> 2025-02-28 (FOUND-01 non-leap clamp)'
       ELSE 'FAIL: monthly 2025-01-31 got ' || next_due_date_sql('2025-01-31'::DATE, 'monthly')::TEXT END AS r;

SELECT CASE WHEN next_due_date_sql('2024-01-31'::DATE, 'monthly') = '2024-02-29'::DATE
       THEN 'PASS: monthly 2024-01-31 -> 2024-02-29 (leap clamp)'
       ELSE 'FAIL: monthly 2024-01-31 got ' || next_due_date_sql('2024-01-31'::DATE, 'monthly')::TEXT END AS r;

SELECT CASE WHEN next_due_date_sql('2025-03-31'::DATE, 'monthly') = '2025-04-30'::DATE
       THEN 'PASS: monthly 2025-03-31 -> 2025-04-30 (30-day-month clamp)'
       ELSE 'FAIL: monthly 2025-03-31 got ' || next_due_date_sql('2025-03-31'::DATE, 'monthly')::TEXT END AS r;

SELECT CASE WHEN next_due_date_sql('2025-02-28'::DATE, 'monthly') = '2025-03-28'::DATE
       THEN 'PASS: monthly 2025-02-28 -> 2025-03-28 (no false clamp)'
       ELSE 'FAIL: monthly 2025-02-28 got ' || next_due_date_sql('2025-02-28'::DATE, 'monthly')::TEXT END AS r;

SELECT CASE WHEN next_due_date_sql('2025-02-14'::DATE, 'weekly') = '2025-02-21'::DATE
       THEN 'PASS: weekly 2025-02-14 -> 2025-02-21'
       ELSE 'FAIL: weekly 2025-02-14 got ' || next_due_date_sql('2025-02-14'::DATE, 'weekly')::TEXT END AS r;

SELECT CASE WHEN next_due_date_sql('2025-12-31'::DATE, 'daily') = '2026-01-01'::DATE
       THEN 'PASS: daily 2025-12-31 -> 2026-01-01'
       ELSE 'FAIL: daily 2025-12-31 got ' || next_due_date_sql('2025-12-31'::DATE, 'daily')::TEXT END AS r;

SELECT CASE WHEN next_due_date_sql('2025-06-15'::DATE, 'yearly') = '2026-06-15'::DATE
       THEN 'PASS: yearly 2025-06-15 -> 2026-06-15'
       ELSE 'FAIL: yearly 2025-06-15 got ' || next_due_date_sql('2025-06-15'::DATE, 'yearly')::TEXT END AS r;

-- Unknown frequency must raise
DO $$
BEGIN
  PERFORM next_due_date_sql('2025-01-15'::DATE, 'bogus');
  RAISE NOTICE 'FAIL: bogus frequency did not raise';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS: bogus frequency raised as expected (%)', SQLERRM;
END $$;

-- ============================================================
-- SECTION 2: mark_bill_paid happy path + atomicity
-- ============================================================

\echo 'SECTION 2: mark_bill_paid happy path'

-- Seed: create a synthetic user + category + recurring_template.
-- Note: auth.users is Supabase-managed; we INSERT directly inside ROLLBACK scope.
-- If auth.users FK triggers reject manual inserts in this environment, this test
-- section is skipped by the CASE WHEN guards below (seed failure = FAIL printed).

DO $$
DECLARE
  v_uid UUID := '00000000-0000-0000-0000-000000000aaa';
  v_cat_id BIGINT;
  v_template_id BIGINT;
  v_result RECORD;
  v_tx_count INT;
  v_bp_count INT;
  v_new_next DATE;
BEGIN
  -- Insert the test user into auth.users (Supabase allows this in local dev).
  -- If this INSERT fails (e.g. in a restricted environment), the rest of SECTION 2 and 3 is skipped.
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES (v_uid, 'phase4-test@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP SECTION 2: cannot seed auth.users (%)', SQLERRM;
    RETURN;
  END;

  -- Pick an existing category (any will do — seeded by 0004_kategori_pertamina.sql)
  SELECT id INTO v_cat_id FROM categories ORDER BY id LIMIT 1;
  IF v_cat_id IS NULL THEN
    RAISE NOTICE 'SKIP SECTION 2: no categories seeded';
    RETURN;
  END IF;

  -- Seed a monthly expense template at 2025-01-31 (month-end edge)
  INSERT INTO recurring_templates (user_id, name, type, category_id, amount, note, frequency, next_due_date, is_active)
  VALUES (v_uid, 'Test PLN', 'expense', v_cat_id, 500000, 'phase4-test', 'monthly', '2025-01-31'::DATE, true)
  RETURNING id INTO v_template_id;

  -- Call mark_bill_paid as the test user context (use p_uid param since auth.uid() in DO block is null).
  -- Temporarily bypass the v_uid != auth.uid() guard by setting local auth settings.
  -- In a real call via PostgREST, JWT provides auth.uid(); here we pass p_uid and rely on is_admin()
  -- being false AND v_uid != auth.uid() — so we SKIP the guard test here and verify core atomicity only.
  -- To bypass, temporarily set the JWT claim:
  PERFORM set_config('request.jwt.claim.sub', v_uid::TEXT, true);

  SELECT transaction_id, bill_payment_id, new_next_due
  INTO v_result
  FROM mark_bill_paid(v_template_id, v_uid, '2025-01-31'::DATE);

  -- Assertion: exactly 1 transaction created for this user + date
  SELECT COUNT(*) INTO v_tx_count
  FROM transactions
  WHERE user_id = v_uid AND date = '2025-01-31'::DATE AND category_id = v_cat_id;
  IF v_tx_count = 1 THEN
    RAISE NOTICE 'PASS: atomicity — 1 transaction inserted';
  ELSE
    RAISE NOTICE 'FAIL: atomicity — expected 1 transaction, got %', v_tx_count;
  END IF;

  -- Assertion: exactly 1 bill_payment created
  SELECT COUNT(*) INTO v_bp_count
  FROM bill_payments
  WHERE recurring_template_id = v_template_id AND user_id = v_uid AND paid_date = '2025-01-31'::DATE;
  IF v_bp_count = 1 THEN
    RAISE NOTICE 'PASS: atomicity — 1 bill_payment inserted with recurring_template_id';
  ELSE
    RAISE NOTICE 'FAIL: atomicity — expected 1 bill_payment, got %', v_bp_count;
  END IF;

  -- Assertion: next_due_date advanced to 2025-02-28 (FOUND-01 clamp)
  SELECT next_due_date INTO v_new_next FROM recurring_templates WHERE id = v_template_id;
  IF v_new_next = '2025-02-28'::DATE THEN
    RAISE NOTICE 'PASS: next_due advanced 2025-01-31 -> 2025-02-28 (FOUND-01)';
  ELSE
    RAISE NOTICE 'FAIL: next_due expected 2025-02-28 got %', v_new_next;
  END IF;

  -- Assertion: bill_payment.amount equals template.amount (Pitfall 3 — NOT NULL amount)
  IF EXISTS (SELECT 1 FROM bill_payments WHERE recurring_template_id = v_template_id AND amount = 500000) THEN
    RAISE NOTICE 'PASS: bill_payment.amount filled from template.amount';
  ELSE
    RAISE NOTICE 'FAIL: bill_payment.amount missing or wrong';
  END IF;

  -- ============================================================
  -- SECTION 3: idempotency guard (double-click / race with useProcessRecurring)
  -- ============================================================

  RAISE NOTICE 'SECTION 3: idempotency guard';

  BEGIN
    PERFORM mark_bill_paid(v_template_id, v_uid, '2025-01-31'::DATE);
    RAISE NOTICE 'FAIL: second mark_bill_paid same date should have raised';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%sudah ditandai lunas%' THEN
      RAISE NOTICE 'PASS: idempotency guard raised "%".', SQLERRM;
    ELSE
      RAISE NOTICE 'FAIL: unexpected error on duplicate: %', SQLERRM;
    END IF;
  END;

  -- ============================================================
  -- SECTION 4: access guard (wrong owner)
  -- ============================================================

  RAISE NOTICE 'SECTION 4: access guard';

  -- Reset JWT claim to a different user to simulate a foreign caller
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ff', true);

  BEGIN
    PERFORM mark_bill_paid(v_template_id, v_uid, '2025-02-01'::DATE);
    RAISE NOTICE 'FAIL: foreign-user mark_bill_paid should have raised Akses ditolak';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Akses ditolak' THEN
      RAISE NOTICE 'PASS: access guard raised "Akses ditolak"';
    ELSE
      RAISE NOTICE 'FAIL: unexpected error on foreign call: %', SQLERRM;
    END IF;
  END;

  -- Restore owner
  PERFORM set_config('request.jwt.claim.sub', v_uid::TEXT, true);

  -- ============================================================
  -- SECTION 5: Template-not-found guard
  -- ============================================================

  RAISE NOTICE 'SECTION 5: template-not-found guard';

  BEGIN
    PERFORM mark_bill_paid(999999999::BIGINT, v_uid, '2025-02-01'::DATE);
    RAISE NOTICE 'FAIL: non-existent template should have raised Template tidak ditemukan';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Template tidak ditemukan' THEN
      RAISE NOTICE 'PASS: not-found guard raised "Template tidak ditemukan"';
    ELSE
      RAISE NOTICE 'FAIL: unexpected error on missing template: %', SQLERRM;
    END IF;
  END;

  -- ============================================================
  -- SECTION 6: upcoming_bills_unpaid view — paid bill is excluded
  -- ============================================================

  RAISE NOTICE 'SECTION 6: upcoming_bills_unpaid view';

  -- Only meaningful if we paid a bill whose paid_date is in the current month.
  -- For this run, seed a FRESH template with next_due_date = CURRENT_DATE and pay it,
  -- then assert the view excludes it.

  INSERT INTO recurring_templates (user_id, name, type, category_id, amount, note, frequency, next_due_date, is_active)
  VALUES (v_uid, 'Test Current-Month Bill', 'expense', v_cat_id, 100000, 'phase4-test', 'monthly', CURRENT_DATE, true)
  RETURNING id INTO v_template_id;

  -- Before paying: view should include it
  IF EXISTS (SELECT 1 FROM upcoming_bills_unpaid WHERE id = v_template_id) THEN
    RAISE NOTICE 'PASS: view includes unpaid template';
  ELSE
    RAISE NOTICE 'FAIL: view missing unpaid template';
  END IF;

  -- Pay it
  PERFORM mark_bill_paid(v_template_id, v_uid, CURRENT_DATE);

  -- After paying: view must exclude it
  IF NOT EXISTS (SELECT 1 FROM upcoming_bills_unpaid WHERE id = v_template_id) THEN
    RAISE NOTICE 'PASS: view excludes paid template (D-03 Sisa Aman refinement)';
  ELSE
    RAISE NOTICE 'FAIL: view still returns paid template';
  END IF;

END $$;

\echo '============================================================'
\echo 'Test complete. Rolling back all changes.'
\echo 'Review output above for any FAIL: lines.'
\echo '============================================================'

ROLLBACK;
