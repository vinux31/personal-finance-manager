-- ============================================================
-- 0025_fix_goal_bugs: Fix Critical #1 + Critical #2 dari QA-FINDINGS.md (2026-05-01)
-- (Phase 9 QA Bug Fix, D-01..D-06)
--
-- Critical #1 — enforce_goal_investment_total trigger:
--   PostgreSQL melarang FOR UPDATE bersamaan dengan aggregate (SUM).
--   Fix (D-02): pisahkan FOR UPDATE ke subquery, aggregate di outer SELECT.
--
-- Critical #2 — add_money_to_goal ambiguous column:
--   RETURNS TABLE (current_amount NUMERIC, status TEXT) menciptakan output
--   variable dengan nama sama dengan kolom base table goals → ambigu di
--   SELECT ... INTO v_goal. Fix (D-05): qualify semua column dengan alias `g`.
--   Pattern mirror dari withdraw_from_goal Section 4 (0024:147-151).
--
-- Idempotent: CREATE OR REPLACE FUNCTION untuk kedua fungsi.
-- Untuk add_money_to_goal: DROP FUNCTION IF EXISTS dulu (Phase 5 discipline,
--   konsisten dengan 0024:21 — meskipun signature unchanged, ini affect
--   externally-observable behavior bagi frontend).
-- ============================================================

-- ============================================================
-- Section 1: Fix Critical #1 — enforce_goal_investment_total()
-- D-02: pisahkan FOR UPDATE (subquery) dari aggregate (outer SELECT).
-- Trigger signature unchanged (RETURNS TRIGGER, no args) — DROP TRIGGER cukup.
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_goal_investment_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  -- Sum existing allocations untuk investment yang sama, exclude-self pada UPDATE.
  -- `id IS DISTINCT FROM NEW.id` handles INSERT (NEW.id NULL) dan UPDATE.
  -- FOR UPDATE serializes concurrent INSERT/UPDATE pada investment_id sama;
  -- HARUS di subquery — PostgreSQL melarang FOR UPDATE bersamaan dengan aggregate.
  SELECT COALESCE(SUM(sub.allocation_pct), 0) INTO v_total
  FROM (
    SELECT allocation_pct
    FROM goal_investments
    WHERE investment_id = NEW.investment_id
      AND id IS DISTINCT FROM NEW.id
    FOR UPDATE
  ) sub;

  IF v_total + NEW.allocation_pct > 100 THEN
    RAISE EXCEPTION 'Total alokasi melebihi 100%% (sudah %, tambah % > 100)',
      v_total, NEW.allocation_pct
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- Re-attach trigger (idempotent; konsisten dengan 0021:63-66)
DROP TRIGGER IF EXISTS goal_investments_total_check ON goal_investments;
CREATE TRIGGER goal_investments_total_check
  BEFORE INSERT OR UPDATE ON goal_investments
  FOR EACH ROW EXECUTE FUNCTION enforce_goal_investment_total();

-- ============================================================
-- Section 2: Fix Critical #2 — add_money_to_goal() ambiguous column
-- D-05: qualify semua column dengan alias `g` (mirror withdraw_from_goal 0024:147-151).
-- DROP dulu (Phase 5 discipline, sama seperti 0024:21).
-- ============================================================

DROP FUNCTION IF EXISTS public.add_money_to_goal(BIGINT, NUMERIC);

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
  -- Auth guard
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Jumlah harus > 0';
  END IF;

  -- FIX (D-05): qualify all base-table columns with alias `g` to avoid
  --             clash dengan RETURNS TABLE output variables (current_amount, status).
  --             Mirror pattern dari withdraw_from_goal Section 4 (0024:147-151).
  SELECT g.id, g.current_amount, g.target_amount, g.status
  INTO v_goal
  FROM goals g
  WHERE g.id = p_id AND g.user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal tidak ditemukan';
  END IF;

  v_new_cash := v_goal.current_amount + p_amount;

  -- Inline subquery — mirror VIEW formula (D-10.4 dari Phase 7)
  SELECT COALESCE(SUM(gi.allocation_pct / 100.0
                      * COALESCE(i.current_price, i.buy_price) * i.quantity), 0)
  INTO v_invested
  FROM goal_investments gi
  LEFT JOIN investments i ON i.id = gi.investment_id
  WHERE gi.goal_id = p_id;

  v_new_total := v_new_cash + v_invested;

  -- Status transition: only active → completed; paused/completed preserved
  v_new_status := CASE
    WHEN v_goal.status = 'active' AND v_new_total >= v_goal.target_amount THEN 'completed'
    ELSE v_goal.status
  END;

  -- FIX (D-05): qualify all columns in UPDATE too
  UPDATE goals g
  SET current_amount = v_new_cash, status = v_new_status
  WHERE g.id = p_id AND g.user_id = v_uid;

  RETURN QUERY SELECT v_new_cash, v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION add_money_to_goal(BIGINT, NUMERIC) TO authenticated;
