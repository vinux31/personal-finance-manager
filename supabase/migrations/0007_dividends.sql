-- ============================================================
-- 0007_dividends: Tab Dividen — BEI stock dividend tracking
-- ============================================================

-- ----- bei_stocks: master data saham BEI --------------------

CREATE TABLE bei_stocks (
  id              BIGSERIAL PRIMARY KEY,
  ticker          TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  sector          TEXT NOT NULL,
  dividend_yield  NUMERIC(5,2),
  dividend_growth NUMERIC(5,2),
  is_preloaded    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- No RLS: master data, public read for authenticated users

-- ----- dividend_transactions: log BUY/SELL per user ---------

CREATE TABLE dividend_transactions (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  bei_stock_id     BIGINT NOT NULL REFERENCES bei_stocks(id),
  type             TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  lots             INTEGER NOT NULL CHECK (lots > 0),
  price_per_share  BIGINT NOT NULL CHECK (price_per_share > 0),
  transaction_date DATE NOT NULL,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dividend_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY dtxn_select ON dividend_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY dtxn_write ON dividend_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----- investments: add bei_stock_id FK ---------------------

ALTER TABLE investments ADD COLUMN bei_stock_id BIGINT REFERENCES bei_stocks(id);
CREATE INDEX idx_investments_bei_stock ON investments(bei_stock_id)
  WHERE bei_stock_id IS NOT NULL;

-- ----- Seed: 10 preloaded BEI stocks ------------------------

INSERT INTO bei_stocks (ticker, name, sector, dividend_yield, dividend_growth, is_preloaded) VALUES
  ('BBCA', 'Bank Central Asia',      'Finance',          2.50, 8.00, true),
  ('UNVR', 'Unilever Indonesia',     'Consumer Staples', 3.20, NULL, true),
  ('TLKM', 'Telkom Indonesia',       'Telecom',          4.50, NULL, true),
  ('ICBP', 'Indofood CBP',           'Consumer Staples', 2.80, NULL, true),
  ('GGRM', 'Gudang Garam',           'Consumer Staples', 6.50, NULL, true),
  ('PGAS', 'Perusahaan Gas Negara',  'Energy',           5.20, NULL, true),
  ('ITMG', 'Indo Tambangraya',       'Energy',           8.00, NULL, true),
  ('AALI', 'Astra Agro Lestari',     'Plantation',       4.80, NULL, true),
  ('ADRO', 'Adaro Energy',           'Energy',           7.00, NULL, true),
  ('BSDE', 'Bumi Serpong Damai',     'Real Estate',      5.50, NULL, true);

-- ----- RPC: create_dividend_transaction (atomic) ------------

CREATE OR REPLACE FUNCTION create_dividend_transaction(
  p_bei_stock_id    BIGINT,
  p_type            TEXT,
  p_lots            INTEGER,
  p_price_per_share BIGINT,
  p_transaction_date DATE,
  p_note            TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticker          TEXT;
  v_total_lots      INTEGER;
  v_avg_price       BIGINT;
  v_first_buy_date  DATE;
  v_investment_id   BIGINT;
BEGIN
  -- Validate SELL does not exceed current holdings
  IF p_type = 'SELL' THEN
    SELECT COALESCE(SUM(CASE WHEN type = 'BUY' THEN lots ELSE -lots END), 0)
    INTO v_total_lots
    FROM dividend_transactions
    WHERE user_id = auth.uid() AND bei_stock_id = p_bei_stock_id;

    IF v_total_lots < p_lots THEN
      RAISE EXCEPTION 'Tidak bisa jual % lot — hanya punya % lot', p_lots, v_total_lots;
    END IF;
  END IF;

  -- Get ticker for investments record
  SELECT ticker INTO v_ticker FROM bei_stocks WHERE id = p_bei_stock_id;

  -- Insert the transaction
  INSERT INTO dividend_transactions (user_id, bei_stock_id, type, lots, price_per_share, transaction_date, note)
  VALUES (auth.uid(), p_bei_stock_id, p_type, p_lots, p_price_per_share, p_transaction_date, p_note);

  -- Recalculate holdings after insert
  SELECT
    COALESCE(SUM(CASE WHEN type = 'BUY' THEN lots ELSE -lots END), 0),
    COALESCE(
      SUM(CASE WHEN type = 'BUY' THEN lots * price_per_share ELSE 0 END) /
      NULLIF(SUM(CASE WHEN type = 'BUY' THEN lots ELSE 0 END), 0),
      0
    ),
    MIN(CASE WHEN type = 'BUY' THEN transaction_date ELSE NULL END)
  INTO v_total_lots, v_avg_price, v_first_buy_date
  FROM dividend_transactions
  WHERE user_id = auth.uid() AND bei_stock_id = p_bei_stock_id;

  -- Upsert investments record
  SELECT id INTO v_investment_id
  FROM investments
  WHERE user_id = auth.uid() AND bei_stock_id = p_bei_stock_id;

  IF v_investment_id IS NULL THEN
    INSERT INTO investments (user_id, asset_type, asset_name, quantity, buy_price, buy_date, bei_stock_id)
    VALUES (auth.uid(), 'Saham', v_ticker, v_total_lots * 100, v_avg_price, v_first_buy_date, p_bei_stock_id);
  ELSE
    UPDATE investments
    SET quantity  = v_total_lots * 100,
        buy_price = v_avg_price,
        buy_date  = v_first_buy_date
    WHERE id = v_investment_id AND user_id = auth.uid();
  END IF;
END;
$$;

-- ----- RPC: get_dividend_holdings ---------------------------

CREATE OR REPLACE FUNCTION get_dividend_holdings(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  bei_stock_id    BIGINT,
  ticker          TEXT,
  name            TEXT,
  sector          TEXT,
  dividend_yield  NUMERIC,
  dividend_growth NUMERIC,
  total_lots      INTEGER,
  avg_price       BIGINT,
  current_price   NUMERIC,
  investment_id   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bs.id                                                         AS bei_stock_id,
    bs.ticker,
    bs.name,
    bs.sector,
    bs.dividend_yield,
    bs.dividend_growth,
    CAST(SUM(CASE WHEN dt.type = 'BUY' THEN dt.lots ELSE -dt.lots END) AS INTEGER) AS total_lots,
    CAST(
      SUM(CASE WHEN dt.type = 'BUY' THEN dt.lots * dt.price_per_share ELSE 0 END) /
      NULLIF(SUM(CASE WHEN dt.type = 'BUY' THEN dt.lots ELSE 0 END), 0)
    AS BIGINT)                                                    AS avg_price,
    inv.current_price,
    inv.id                                                        AS investment_id
  FROM dividend_transactions dt
  JOIN bei_stocks bs ON dt.bei_stock_id = bs.id
  LEFT JOIN investments inv
    ON inv.bei_stock_id = bs.id
   AND inv.user_id = COALESCE(p_user_id, auth.uid())
  WHERE dt.user_id = COALESCE(p_user_id, auth.uid())
  GROUP BY bs.id, bs.ticker, bs.name, bs.sector, bs.dividend_yield, bs.dividend_growth,
           inv.current_price, inv.id
  HAVING SUM(CASE WHEN dt.type = 'BUY' THEN dt.lots ELSE -dt.lots END) > 0
  ORDER BY bs.ticker;
$$;

GRANT EXECUTE ON FUNCTION create_dividend_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION get_dividend_holdings TO authenticated;
