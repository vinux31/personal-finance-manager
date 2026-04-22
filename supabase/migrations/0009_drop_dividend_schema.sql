-- ============================================================
-- 0009_drop_dividend_schema: Hapus seluruh schema tab Dividen
-- Tab Dividen dihapus pada commit 7d4d7ad. Schema ini orphan.
-- ============================================================

-- 1. Drop RPCs yang bergantung pada tabel dividen
DROP FUNCTION IF EXISTS create_dividend_transaction(BIGINT, TEXT, INTEGER, BIGINT, DATE, TEXT);
DROP FUNCTION IF EXISTS get_dividend_holdings(UUID);

-- 2. Drop tabel dividend_transactions (FK ke bei_stocks)
DROP TABLE IF EXISTS dividend_transactions;

-- 3. Drop kolom bei_stock_id dari investments (FK ke bei_stocks)
--    Index idx_investments_bei_stock otomatis terhapus bersama kolom
ALTER TABLE investments DROP COLUMN IF EXISTS bei_stock_id;

-- 4. Drop tabel bei_stocks (harus setelah semua FK dihapus)
DROP TABLE IF EXISTS bei_stocks;
