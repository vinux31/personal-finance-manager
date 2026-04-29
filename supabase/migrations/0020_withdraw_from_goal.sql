-- ============================================================
-- 0020_withdraw_from_goal: Atomic withdraw RPC (RACE-03, D-10..D-12)
-- Direct mirror dari add_money_to_goal (0006:225-261) dengan inverse logic + status flip + FOR UPDATE.
--
-- Status transitions (D-11):
--   - completed AND new_amount < target_amount → flip ke 'active'
--   - paused stays 'paused'
--   - active stays 'active'
-- Error semantics (D-10): SQLSTATE P0001 + Indonesian message dengan saldo eksplisit.
-- Forward-compatible dengan Phase 7 CONS-01 yang akan split kas vs investasi.
--
-- No p_uid param: withdraw is always self-action; admin View-As impersonation
-- handled via JWT 'sub' claim switch in client. (Deviation from process_due_recurring
-- which has p_uid for batch processing.) Per D-12 simplicity decision.
--
-- NOTE: If you ever change this signature, MUST emit DROP FUNCTION IF EXISTS ... (sig)
--       before CREATE OR REPLACE. Phase 5 lesson — see 0018_drop_legacy_aggregates.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION withdraw_from_goal(
  p_id     BIGINT,
  p_amount NUMERIC
)
RETURNS TABLE (current_amount NUMERIC, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_goal       RECORD;
  v_new_amount NUMERIC;
  v_new_status TEXT;
BEGIN
  -- Auth guard (mirror 0014:62-65 + 0017 ERRCODE)
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;

  -- Precondition (mirror 0006:239-241)
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Jumlah harus > 0';
  END IF;

  -- Fetch + row-lock the goal (serializes concurrent withdraws)
  SELECT id, current_amount, target_amount, status
  INTO v_goal
  FROM goals
  WHERE id = p_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal tidak ditemukan';
  END IF;

  v_new_amount := v_goal.current_amount - p_amount;
  IF v_new_amount < 0 THEN
    RAISE EXCEPTION 'Saldo kas tidak cukup (tersedia Rp %)', v_goal.current_amount
      USING ERRCODE = 'P0001';
  END IF;

  -- Status transition logic (D-11)
  v_new_status := CASE
    WHEN v_goal.status = 'completed' AND v_new_amount < v_goal.target_amount THEN 'active'
    ELSE v_goal.status
  END;

  UPDATE goals
  SET current_amount = v_new_amount, status = v_new_status
  WHERE id = p_id AND user_id = v_uid;

  RETURN QUERY SELECT v_new_amount, v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION withdraw_from_goal(BIGINT, NUMERIC) TO authenticated;
