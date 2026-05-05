-- D-14 fix: format() di withdraw_from_goal MESSAGE menampilkan NUMERIC mentah
-- (mis. "Rp 0.00 (Rp 100000000.000000)") yang tidak user-friendly.
-- Format ke ribuan dengan separator titik (id-ID style): "Rp 100.000.000".
--
-- Sumber concern: backlog v1.2 item A2 — kosmetik LOW.

DROP FUNCTION IF EXISTS public.withdraw_from_goal(BIGINT, NUMERIC);

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
  v_uid          UUID := auth.uid();
  v_goal         RECORD;
  v_invested     NUMERIC;
  v_new_cash     NUMERIC;
  v_new_total    NUMERIC;
  v_new_status   TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Jumlah harus > 0';
  END IF;

  SELECT g.id, g.current_amount, g.target_amount, g.status
  INTO v_goal
  FROM goals g
  WHERE g.id = p_id AND g.user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal tidak ditemukan';
  END IF;

  SELECT COALESCE(SUM(gi.allocation_pct / 100.0
                      * COALESCE(i.current_price, i.buy_price) * i.quantity), 0)
  INTO v_invested
  FROM goal_investments gi
  LEFT JOIN investments i ON i.id = gi.investment_id
  WHERE gi.goal_id = p_id;

  IF v_goal.current_amount < p_amount THEN
    RAISE EXCEPTION USING
      MESSAGE = format(
        'Saldo kas tidak cukup. Tersedia Rp %s (terpisah dari Rp %s di investasi)',
        REPLACE(TO_CHAR(ROUND(v_goal.current_amount)::BIGINT, 'FM999G999G999'), ',', '.'),
        REPLACE(TO_CHAR(ROUND(v_invested)::BIGINT, 'FM999G999G999'), ',', '.')
      ),
      ERRCODE = 'P0001';
  END IF;

  v_new_cash := v_goal.current_amount - p_amount;
  v_new_total := v_new_cash + v_invested;

  v_new_status := CASE
    WHEN v_goal.status = 'completed' AND v_new_total < v_goal.target_amount THEN 'active'
    ELSE v_goal.status
  END;

  UPDATE goals g
  SET current_amount = v_new_cash, status = v_new_status
  WHERE g.id = p_id AND g.user_id = v_uid;

  RETURN QUERY SELECT v_new_cash, v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION withdraw_from_goal(BIGINT, NUMERIC) TO authenticated;
