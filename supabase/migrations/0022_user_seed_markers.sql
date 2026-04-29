-- ============================================================
-- 0022_user_seed_markers: Tabel marker + RPC seed_rencana + reset_rencana_marker (CONS-03, D-01..D-08)
-- Authoritative source untuk "user sudah seeded". RPC = single transaction:
--   1. Idempotency: IF EXISTS (user_seed_markers) RETURN false (D-02 marker-only dedup)
--   2. INSERT 5 RENCANA goals (hardcoded — synced with src/lib/rencanaNames.ts (RENCANA_GOAL_NAMES, length 5)
--      and src/db/goals.ts:RENCANA_GOALS lines 116-122 — update both atomically if seed data changes)
--   3. INSERT 3 RENCANA investments (hardcoded — synced with src/lib/rencanaNames.ts
--      (RENCANA_INVESTMENT_NAMES, length 3) and src/db/investments.ts:RENCANA_INVESTMENTS lines 183-187)
--   4. INSERT user_seed_markers row → marks done (atomic via implicit transaction)
-- Backfill (D-03): existing users yang sudah punya RENCANA goals → INSERT marker ON CONFLICT DO NOTHING.
--
-- NOTE: If you ever change function signature (e.g. add param), MUST emit
--       DROP FUNCTION IF EXISTS seed_rencana(UUID); BEFORE CREATE OR REPLACE.
--       Phase 5 lesson — see 0018_drop_legacy_aggregates.sql.
-- ============================================================

-- ============================================================
-- Section 1: Table + RLS (mirror 0013_bill_payments.sql with PK on user_id)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_seed_markers (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rencana_seeded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_seed_markers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own seed markers" ON user_seed_markers;
CREATE POLICY "Users manage own seed markers"
  ON user_seed_markers FOR ALL
  USING      (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Section 2: RPC seed_rencana (Pattern A + D-02 marker dedup + D-04 hardcoded data + D-05 atomic)
-- ============================================================

CREATE OR REPLACE FUNCTION seed_rencana(p_uid UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_uid, auth.uid());
BEGIN
  -- Auth guard (Pattern A — Phase 6 D-19 ERRCODE)
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;
  -- Access guard: View-As admin allowed; foreign uid blocked
  IF v_uid != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  -- Idempotency: D-02 marker-only dedup (mirror 0014:84-91 IF EXISTS pattern)
  IF EXISTS (SELECT 1 FROM user_seed_markers WHERE user_id = v_uid) THEN
    RETURN false;
  END IF;

  -- INSERT 5 RENCANA goals (synced with src/db/goals.ts:RENCANA_GOALS lines 116-122)
  -- 5 goals + 3 investments — synced with rencanaNames.ts (RENCANA_GOAL_NAMES length 5, RENCANA_INVESTMENT_NAMES length 3)
  INSERT INTO goals (user_id, name, target_amount, current_amount, target_date, status) VALUES
    (v_uid, 'Dana Pernikahan',          100000000, 0, DATE '2027-01-01', 'active'),
    (v_uid, 'DP + Akad Kredit Xpander', 118000000, 0, DATE '2027-01-01', 'active'),
    (v_uid, 'Non-Budget Nikah',          10000000, 0, DATE '2027-01-01', 'active'),
    (v_uid, 'Dana Darurat',              24000000, 0, DATE '2026-12-01', 'active'),
    (v_uid, 'Buffer Cadangan',            5000000, 0, DATE '2027-01-01', 'active');

  -- INSERT 3 RENCANA investments (synced with src/db/investments.ts:RENCANA_INVESTMENTS lines 183-187)
  INSERT INTO investments (user_id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note) VALUES
    (v_uid, 'Reksadana', 'Reksadana Sukuk Sucorinvest Sharia', 1,      100000000, 100000000, DATE '2026-04-01', 'Seeded dari rencana-keuangan-v2.html'),
    (v_uid, 'Emas',      'Emas Tabungan Pegadaian',             5.5278,   2683000,   2683000, DATE '2026-04-01', 'Seeded dari rencana-keuangan-v2.html'),
    (v_uid, 'Saham',     'Saham BMRI',                          1200,     5107.65,      4620, DATE '2026-04-01', 'Seeded dari rencana-keuangan-v2.html');

  -- INSERT marker LAST — atomic implicit transaction; if any prior INSERT fails, this rolls back too
  INSERT INTO user_seed_markers (user_id) VALUES (v_uid);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION seed_rencana(UUID) TO authenticated;

-- ============================================================
-- Section 3: RPC reset_rencana_marker (D-07.3 strict self-only, no admin override)
-- ============================================================

CREATE OR REPLACE FUNCTION reset_rencana_marker()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;
  -- Strict self-only — no p_uid parameter, no admin override (D-07.3 from CONTEXT.md)
  DELETE FROM user_seed_markers WHERE user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_rencana_marker() TO authenticated;

-- ============================================================
-- Section 4: Backfill (D-03 — last step)
-- D-03: backfill marker for existing users who already have RENCANA goals
-- (e.g. admin awal seeded via TS-only path before this migration). Prevents double-seed on next Dashboard load.
-- ============================================================

INSERT INTO user_seed_markers (user_id, rencana_seeded_at)
SELECT DISTINCT user_id, NOW()
FROM goals
WHERE name = ANY(ARRAY[
  'Dana Pernikahan',
  'DP + Akad Kredit Xpander',
  'Non-Budget Nikah',
  'Dana Darurat',
  'Buffer Cadangan'
]::text[])
ON CONFLICT (user_id) DO NOTHING;
