-- ============================================================
-- 0003_goals_atomic_rpc: Atomic increment for addMoneyToGoal
-- Fixes race condition where concurrent requests could cause lost writes
-- ============================================================

CREATE OR REPLACE FUNCTION add_money_to_goal(
  p_id     BIGINT,
  p_amount NUMERIC
)
RETURNS TABLE (current_amount NUMERIC, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target NUMERIC;
  v_new_amount NUMERIC;
  v_new_status TEXT;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Jumlah harus > 0';
  END IF;

  UPDATE goals
  SET current_amount = goals.current_amount + p_amount
  WHERE id = p_id
  RETURNING goals.current_amount, goals.target_amount
  INTO v_new_amount, v_target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal tidak ditemukan';
  END IF;

  v_new_status := CASE WHEN v_new_amount >= v_target THEN 'completed' ELSE NULL END;

  IF v_new_status IS NOT NULL THEN
    UPDATE goals SET status = v_new_status WHERE id = p_id;
  END IF;

  RETURN QUERY SELECT v_new_amount, COALESCE(v_new_status, (SELECT goals.status FROM goals WHERE id = p_id));
END;
$$;

GRANT EXECUTE ON FUNCTION add_money_to_goal TO authenticated;
