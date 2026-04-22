-- ============================================================
-- 0008_price_history_unique: Deduplicate + UNIQUE constraint
-- ============================================================

-- Step 1: Hapus baris duplikat, pertahankan hanya yang id-nya terbesar
-- (asumsi: baris terbaru = harga terkini yang paling valid)
DELETE FROM price_history
WHERE id NOT IN (
  SELECT MAX(id)
  FROM price_history
  GROUP BY investment_id, date
);

-- Step 2: Tambah UNIQUE constraint
ALTER TABLE price_history
  ADD CONSTRAINT price_history_investment_date_unique
  UNIQUE (investment_id, date);
