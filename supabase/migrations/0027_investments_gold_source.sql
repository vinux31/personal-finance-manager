-- 0027_investments_gold_source.sql
-- Tambah kolom gold_source untuk identify sumber harga emas per row.
-- Diperlukan supaya edge function fetch-prices bisa routing:
--   pegadaian → scrape buyback Pegadaian
--   spot      → metals.dev (logic existing, untuk emas non-Pegadaian)
--   manual    → skip auto-fetch, user input current_price sendiri

ALTER TABLE investments ADD COLUMN gold_source TEXT;

-- Backfill DULU sebelum CHECK supaya constraint tidak fail di apply
UPDATE investments
  SET gold_source = 'pegadaian'
  WHERE asset_type = 'Emas' AND asset_name ILIKE '%pegadaian%';

UPDATE investments
  SET gold_source = 'manual'
  WHERE asset_type = 'Emas' AND gold_source IS NULL;

-- CHECK loose: untuk non-emas bebas (NULL atau leftover), untuk emas WAJIB
-- salah satu dari 3 value valid. App-level validation di InvestmentDialog
-- harus pastikan dropdown terisi sebelum submit supaya error tidak bocor.
ALTER TABLE investments ADD CONSTRAINT gold_source_valid_for_emas CHECK (
  asset_type <> 'Emas' OR gold_source IN ('pegadaian', 'spot', 'manual')
);

-- Update seed function 0022: signup user baru harus dapat row Emas dengan
-- gold_source='pegadaian', kalau tidak CHECK akan fail dan transaction rollback.
CREATE OR REPLACE FUNCTION seed_rencana(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := p_user_id;
BEGIN
  IF EXISTS (SELECT 1 FROM user_seed_markers WHERE user_id = v_uid) THEN
    RETURN false;
  END IF;

  INSERT INTO goals (user_id, name, target_amount, current_amount, target_date, status) VALUES
    (v_uid, 'Dana Pernikahan',          100000000, 0, DATE '2027-01-01', 'active'),
    (v_uid, 'DP + Akad Kredit Xpander', 118000000, 0, DATE '2027-01-01', 'active'),
    (v_uid, 'Non-Budget Nikah',          10000000, 0, DATE '2027-01-01', 'active'),
    (v_uid, 'Dana Darurat',              24000000, 0, DATE '2026-12-01', 'active'),
    (v_uid, 'Buffer Cadangan',            5000000, 0, DATE '2027-01-01', 'active');

  INSERT INTO investments (user_id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note, gold_source) VALUES
    (v_uid, 'Reksadana', 'Reksadana Sukuk Sucorinvest Sharia', 1,      100000000, 100000000, DATE '2026-04-01', 'Seeded dari rencana-keuangan-v2.html', NULL),
    (v_uid, 'Emas',      'Emas Tabungan Pegadaian',             5.5278,   2683000,   2683000, DATE '2026-04-01', 'Seeded dari rencana-keuangan-v2.html', 'pegadaian'),
    (v_uid, 'Saham',     'Saham BMRI',                          1200,     5107.65,      4620, DATE '2026-04-01', 'Seeded dari rencana-keuangan-v2.html', NULL);

  INSERT INTO user_seed_markers (user_id) VALUES (v_uid);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION seed_rencana(UUID) TO authenticated;
