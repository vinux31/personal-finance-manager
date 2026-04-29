-- ============================================================
-- 0019_process_due_recurring: Eliminasi race condition di useProcessRecurring (RACE-01, D-01..D-09)
-- Mirror pattern 0014_mark_bill_paid: SECURITY DEFINER + FOR UPDATE + bill_payments IF EXISTS.
--
-- SEMANTIC NOTE (D-03): bill_payments sekarang stores BOTH expense AND income runs.
-- Nama tabel kept untuk back-compat dengan mark_bill_paid + upcoming_bills_unpaid VIEW.
-- Rename ke recurring_runs jadi v1.2 backlog jika dataset/ambiguity ganggu.
--
-- NOTE: If you ever change this signature, MUST emit DROP FUNCTION IF EXISTS ... (sig)
--       before CREATE OR REPLACE. Phase 5 lesson — see 0018_drop_legacy_aggregates.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION process_due_recurring(
  p_today    DATE DEFAULT CURRENT_DATE,
  p_uid      UUID DEFAULT NULL,
  p_max_iter INT  DEFAULT 12
)
RETURNS TABLE (processed_count INT, skipped_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := COALESCE(p_uid, auth.uid());
  v_template  RECORD;
  v_due       DATE;
  v_iter      INT;
  v_processed INT := 0;
  v_skipped   INT := 0;
  v_tx_id     BIGINT;
BEGIN
  -- Auth guard (mirror 0014:62-65 + 0017 ERRCODE)
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;
  -- Access guard (mirror 0014:67-70 + 0017 ERRCODE)
  IF v_uid != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE row lock pada outer SELECT — serializes vs concurrent mark_bill_paid
  -- + concurrent process_due_recurring on the same template row.
  FOR v_template IN
    SELECT id, name, type, category_id, amount, note, frequency, next_due_date
    FROM recurring_templates
    WHERE user_id = v_uid AND is_active = true AND next_due_date <= p_today
    FOR UPDATE
  LOOP
    v_due  := v_template.next_due_date;
    v_iter := 0;
    WHILE v_due <= p_today AND v_iter < p_max_iter LOOP
      -- Idempotency guard (mirror 0014:84-91, skip-on-duplicate variant for batch loop)
      IF EXISTS (
        SELECT 1 FROM bill_payments
        WHERE recurring_template_id = v_template.id
          AND user_id = v_uid
          AND paid_date = v_due
      ) THEN
        v_skipped := v_skipped + 1;
      ELSE
        -- 1. Insert transaction (expense or income — D-01 unified path)
        --    NOTE: explicit user_id = v_uid — cannot rely on DEFAULT auth.uid()
        --    because SECURITY DEFINER context has owner uid, not caller uid.
        INSERT INTO transactions (date, type, category_id, amount, note, user_id)
        VALUES (v_due, v_template.type, v_template.category_id, v_template.amount,
                COALESCE(v_template.note, v_template.name), v_uid)
        RETURNING id INTO v_tx_id;

        -- 2. Insert bill_payments audit (BOTH expense + income per D-01/D-03 SEMANTIC NOTE)
        --    bill_payments.amount is NOT NULL — Pitfall 3 from Phase 4.
        INSERT INTO bill_payments (user_id, recurring_template_id, paid_date, amount, transaction_id)
        VALUES (v_uid, v_template.id, v_due, v_template.amount, v_tx_id);

        v_processed := v_processed + 1;
      END IF;
      -- Re-use existing helper (FOUND-01 month-end clamping handled there)
      v_due  := next_due_date_sql(v_due, v_template.frequency);
      v_iter := v_iter + 1;
    END LOOP;

    -- 3. Advance template next_due_date to first future date past p_today
    UPDATE recurring_templates
    SET next_due_date = v_due
    WHERE id = v_template.id AND user_id = v_uid;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_skipped;
END;
$$;

GRANT EXECUTE ON FUNCTION process_due_recurring(DATE, UUID, INT) TO authenticated;
