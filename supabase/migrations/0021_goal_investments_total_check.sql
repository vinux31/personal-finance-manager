-- ============================================================
-- 0021_goal_investments_total_check: Cross-row allocation_pct enforcement (RACE-02, D-13..D-16)
-- BEFORE INSERT/UPDATE trigger SUM check + new index goal_investments_investment_idx.
-- SECURITY DEFINER agar SUM bypass RLS — aman karena hanya validate (D-14).
--
-- Pattern: mirror 0017_tighten_rls.sql:38-58 (enforce_email_allowlist trigger function)
--          + 0006_multi_user.sql:37-47 (SECURITY DEFINER for cross-row visibility)
--          + 0014_mark_bill_paid.sql:72-77 (FOR UPDATE row lock for race serialization).
--
-- PRE-DEPLOY GATE (D-16): Run BEFORE pasting this migration:
--   SELECT investment_id, SUM(allocation_pct) FROM goal_investments
--   GROUP BY 1 HAVING SUM(allocation_pct) > 100;
--   → Kalau ada row, fix manual SEBELUM apply trigger (otherwise existing 110% rows
--     yang ditouch kemudian akan raise 23514 padahal user tidak bikin violation baru).
--   Trigger BEFORE INSERT/UPDATE: existing rows yang TIDAK di-touch tidak kena check;
--   tapi user pertama yang touch row violating → trigger akan raise.
--
-- NOTE: If you ever change the trigger function signature, MUST emit
--       DROP FUNCTION IF EXISTS enforce_goal_investment_total() before CREATE OR REPLACE.
--       Phase 5 lesson — see 0018_drop_legacy_aggregates.sql: PostgreSQL keys function identity
--       on (name, arg_types), so signature change tanpa explicit DROP akan create new
--       function alongside legacy version → reachable via direct invocation.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Index untuk performa SUM lookup (D-15)
-- Naming match existing convention: `<table>_<column>_idx` (cf. transactions_date_idx,
-- price_history_investment_idx).
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS goal_investments_investment_idx
  ON goal_investments(investment_id);

-- ------------------------------------------------------------
-- 2. Trigger function (SECURITY DEFINER for RLS bypass on SUM aggregate)
-- D-14: Trigger only validates (RAISE EXCEPTION on > 100), no data leak ke caller.
-- ------------------------------------------------------------
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
  -- `id IS DISTINCT FROM NEW.id` (bukan `<>`) handles both cases:
  --   INSERT: NEW.id IS NULL pre-insert → DISTINCT FROM NULL is TRUE → all rows summed
  --   UPDATE: NEW.id is the row being updated → exclude it (avoid double-count)
  -- FOR UPDATE serializes concurrent INSERT/UPDATE pada investment_id sama:
  --   tx2 blocks until tx1 COMMIT, then tx2's SUM sees tx1's row dan raises 23514.
  SELECT COALESCE(SUM(allocation_pct), 0) INTO v_total
  FROM goal_investments
  WHERE investment_id = NEW.investment_id
    AND id IS DISTINCT FROM NEW.id
  FOR UPDATE;

  IF v_total + NEW.allocation_pct > 100 THEN
    RAISE EXCEPTION 'Total alokasi melebihi 100%% (sudah %, tambah % > 100)',
      v_total, NEW.allocation_pct
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 3. Attach trigger (idempotent via DROP IF EXISTS)
-- Convention dari 0017 SEC-02 lines 17-18 (DROP POLICY IF EXISTS then CREATE).
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS goal_investments_total_check ON goal_investments;
CREATE TRIGGER goal_investments_total_check
  BEFORE INSERT OR UPDATE ON goal_investments
  FOR EACH ROW EXECUTE FUNCTION enforce_goal_investment_total();

-- No GRANT statement — trigger functions invoked by trigger machinery, not by RPC.
