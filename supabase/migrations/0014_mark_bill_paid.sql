-- ============================================================
-- 0014_mark_bill_paid: Atomic mark-as-paid RPC (BILL-03, D-04)
-- Implements 3-op atomic transaction:
--   1. INSERT INTO transactions (expense)
--   2. INSERT INTO bill_payments (audit record)
--   3. UPDATE recurring_templates.next_due_date (advance cycle)
-- Also introduces next_due_date_sql helper (port of TS nextDueDate with FOUND-01 month-end clamping).
-- ============================================================

-- ------------------------------------------------------------
-- 1. next_due_date_sql: port of TS nextDueDate() from src/db/recurringTransactions.ts:28-48
--    Preserves FOUND-01 behavior: 31 Jan monthly -> 28 Feb (NOT 3 Mar)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION next_due_date_sql(p_current DATE, p_freq TEXT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_original_day INT;
  v_target_month DATE;  -- first day of target month
  v_last_day INT;       -- last day of target month
BEGIN
  CASE p_freq
    WHEN 'daily'  THEN RETURN p_current + INTERVAL '1 day';
    WHEN 'weekly' THEN RETURN p_current + INTERVAL '7 days';
    WHEN 'yearly' THEN RETURN p_current + INTERVAL '1 year';
    WHEN 'monthly' THEN
      v_original_day := EXTRACT(DAY FROM p_current)::INT;
      -- First day of next month
      v_target_month := (date_trunc('month', p_current) + INTERVAL '1 month')::DATE;
      -- Last day of that month: first-of-next-next-month minus 1 day
      v_last_day := EXTRACT(DAY FROM (v_target_month + INTERVAL '1 month - 1 day'))::INT;
      -- Clamp: min(original_day, last_day_of_target_month) — mirrors Math.min(d, lastDay) in TS
      RETURN v_target_month + (LEAST(v_original_day, v_last_day) - 1) * INTERVAL '1 day';
    ELSE
      RAISE EXCEPTION 'Unknown frequency: %', p_freq;
  END CASE;
END;
$$;

-- ------------------------------------------------------------
-- 2. mark_bill_paid: atomic RPC (transaction + bill_payment + next_due advance)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_bill_paid(
  p_template_id BIGINT,
  p_uid         UUID DEFAULT NULL,
  p_paid_date   DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (transaction_id BIGINT, bill_payment_id BIGINT, new_next_due DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_uid, auth.uid());
  v_template RECORD;
  v_tx_id BIGINT;
  v_bp_id BIGINT;
  v_new_next DATE;
BEGIN
  -- Auth guard: must be authenticated
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- Access guard: only owner or admin can mark
  IF v_uid != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  -- Fetch + row-lock the template (serializes against concurrent mark-as-paid and useProcessRecurring)
  SELECT id, name, type, category_id, amount, note, frequency, next_due_date
  INTO v_template
  FROM recurring_templates
  WHERE id = p_template_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template tidak ditemukan';
  END IF;

  -- Idempotency guard: prevent double-click and race with useProcessRecurring
  IF EXISTS (
    SELECT 1 FROM bill_payments
    WHERE recurring_template_id = p_template_id
      AND user_id = v_uid
      AND paid_date = p_paid_date
  ) THEN
    RAISE EXCEPTION 'Tagihan sudah ditandai lunas untuk tanggal ini';
  END IF;

  -- 1. Insert expense transaction
  --    NOTE: explicit user_id = v_uid — cannot rely on DEFAULT auth.uid()
  --    because SECURITY DEFINER context has owner uid, not caller uid.
  INSERT INTO transactions (date, type, category_id, amount, note, user_id)
  VALUES (p_paid_date, v_template.type, v_template.category_id, v_template.amount,
          COALESCE(v_template.note, v_template.name), v_uid)
  RETURNING id INTO v_tx_id;

  -- 2. Insert bill_payment audit record (amount is NOT NULL — must fill explicitly)
  INSERT INTO bill_payments (user_id, recurring_template_id, paid_date, amount, transaction_id)
  VALUES (v_uid, p_template_id, p_paid_date, v_template.amount, v_tx_id)
  RETURNING id INTO v_bp_id;

  -- 3. Advance next_due_date using next_due_date_sql helper
  v_new_next := next_due_date_sql(v_template.next_due_date, v_template.frequency);

  UPDATE recurring_templates
  SET next_due_date = v_new_next
  WHERE id = p_template_id AND user_id = v_uid;

  RETURN QUERY SELECT v_tx_id, v_bp_id, v_new_next;
END;
$$;

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION next_due_date_sql(DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_bill_paid(BIGINT, UUID, DATE) TO authenticated;
