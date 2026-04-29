-- ============================================================
-- 0024_add_money_to_goal_v2: REPLACE v1 dengan v2 yang status-aware via VIEW total
-- (CONS-01, D-10..D-13). v1 hanya cek cash; v2 cek cash + investment market value via
-- inline subquery (mirror VIEW formula). Status flip active→completed kalau total >= target.
--
-- Phase 5 lesson 0018: DROP FUNCTION explicit sebelum CREATE — supaya
-- kalau executor accidentally ubah signature, legacy v1 (cash-only) tidak coexist
-- dan menjadi info-disclosure / wrong-status surface via direct PostgREST 2-arg call.
--
-- Order:
--   Section 1: DROP v1 (explicit signature)
--   Section 2: CREATE v2 (same signature, new body)
--   Section 3: Backfill goals.status (one-time UPDATE)
--   Section 4: Patch withdraw_from_goal MESSAGE (D-14 — split kas vs investasi)
-- ============================================================

-- ============================================================
-- Section 1: DROP v1 (Phase 5 lesson D-13 — mandatory before CREATE)
-- ============================================================

DROP FUNCTION IF EXISTS public.add_money_to_goal(BIGINT, NUMERIC);

-- ============================================================
-- Section 2: CREATE v2 (investment-aware status flip)
-- Mirror: 0006:225-261 base + 0020:30-72 lock+status pattern + D-10
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
  v_uid          UUID := auth.uid();
  v_goal         RECORD;
  v_invested     NUMERIC;
  v_new_cash     NUMERIC;
  v_new_total    NUMERIC;
  v_new_status   TEXT;
BEGIN
  -- Auth guard (Phase 6 D-19 ERRCODE convention)
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Jumlah harus > 0';
  END IF;

  -- FOR UPDATE on base table (mirror 0020:46-50). NOT on VIEW — FOR UPDATE on VIEWs is tricky.
  SELECT id, current_amount, target_amount, status
  INTO v_goal
  FROM goals
  WHERE id = p_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal tidak ditemukan';
  END IF;

  v_new_cash := v_goal.current_amount + p_amount;

  -- Inline subquery — mirror VIEW formula (D-10.4). Lock already taken on goals row;
  -- no need for FOR UPDATE on goal_investments/investments because total is read-only here.
  SELECT COALESCE(SUM(gi.allocation_pct / 100.0
                      * COALESCE(i.current_price, i.buy_price) * i.quantity), 0)
  INTO v_invested
  FROM goal_investments gi
  LEFT JOIN investments i ON i.id = gi.investment_id
  WHERE gi.goal_id = p_id;

  v_new_total := v_new_cash + v_invested;

  -- Status transition (D-11): only active → completed; paused/completed preserved
  v_new_status := CASE
    WHEN v_goal.status = 'active' AND v_new_total >= v_goal.target_amount THEN 'completed'
    ELSE v_goal.status
  END;

  UPDATE goals
  SET current_amount = v_new_cash, status = v_new_status
  WHERE id = p_id AND user_id = v_uid;

  RETURN QUERY SELECT v_new_cash, v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION add_money_to_goal(BIGINT, NUMERIC) TO authenticated;

-- ============================================================
-- Section 3: Backfill goals.status (D-12 — one-time UPDATE)
-- Flip active goals ke completed kalau total_amount >= target_amount,
-- berdasarkan VIEW goals_with_progress yang dibuat oleh migration 0023.
-- Eager + deterministic: SC#1 demo case visible langsung post-deploy tanpa user action.
-- ============================================================

-- D-12: backfill goals.status untuk eligible candidates supaya SC#1 visible post-deploy
-- without user action. References goals_with_progress VIEW from 0023 (already applied).
UPDATE goals
SET status = 'completed'
WHERE status = 'active'
  AND id IN (SELECT id FROM goals_with_progress WHERE total_amount >= target_amount);

-- ============================================================
-- Section 4: Patch withdraw_from_goal MESSAGE (D-14 — split kas vs investasi)
-- Signature unchanged (BIGINT, NUMERIC) — hanya MESSAGE string yang berubah.
-- DROP dulu (Phase 5 discipline): externally-observable behavior (error MESSAGE)
-- di-observe oleh frontend mapSupabaseError + UAT-1 verifier.
-- ============================================================

-- D-14: extend withdraw_from_goal MESSAGE to split kas vs investasi.
-- Signature unchanged; CREATE OR REPLACE sufficient — but Phase 5 discipline says DROP first
-- when changing externally-observable behavior (the error MESSAGE is observed by frontend
-- mapSupabaseError + UAT-1 verifier).

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

  -- FIX: qualify all columns with table alias to avoid RETURNS TABLE output
  --      variable name clash with goals.current_amount / goals.status
  SELECT g.id, g.current_amount, g.target_amount, g.status
  INTO v_goal
  FROM goals g
  WHERE g.id = p_id AND g.user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal tidak ditemukan';
  END IF;

  -- Compute v_invested for the error MESSAGE (D-14)
  SELECT COALESCE(SUM(gi.allocation_pct / 100.0
                      * COALESCE(i.current_price, i.buy_price) * i.quantity), 0)
  INTO v_invested
  FROM goal_investments gi
  LEFT JOIN investments i ON i.id = gi.investment_id
  WHERE gi.goal_id = p_id;

  -- D-14: error MESSAGE splits kas vs investasi (parallel with AddMoneyDialog helper text)
  IF v_goal.current_amount < p_amount THEN
    RAISE EXCEPTION USING
      MESSAGE = format('Saldo kas tidak cukup. Tersedia Rp %s (terpisah dari Rp %s di investasi)',
                       v_goal.current_amount, v_invested),
      ERRCODE = 'P0001';
  END IF;

  v_new_cash := v_goal.current_amount - p_amount;
  v_new_total := v_new_cash + v_invested;

  -- Reverse status transition: completed → active when total drops below target (preserved from Phase 6 D-11)
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
