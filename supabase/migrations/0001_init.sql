-- ============================================================
-- 0001_init: PFM Cloud v1.0 schema (lift-and-shift dari sql.js)
-- ============================================================

-- ----- Tables ------------------------------------------------

CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, type)
);

CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category_id BIGINT NOT NULL REFERENCES categories(id),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transactions_date_idx ON transactions(date DESC);
CREATE INDEX transactions_category_idx ON transactions(category_id);

CREATE TABLE investments (
  id BIGSERIAL PRIMARY KEY,
  asset_type TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  quantity NUMERIC(20, 8) NOT NULL CHECK (quantity >= 0),
  buy_price NUMERIC(20, 8) NOT NULL CHECK (buy_price >= 0),
  current_price NUMERIC(20, 8) CHECK (current_price >= 0),
  buy_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE price_history (
  id BIGSERIAL PRIMARY KEY,
  investment_id BIGINT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  price NUMERIC(20, 8) NOT NULL CHECK (price >= 0),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX price_history_investment_idx ON price_history(investment_id, date DESC);

CREATE TABLE goals (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  target_amount NUMERIC(15, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notes (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  date DATE NOT NULL,
  linked_transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- settings table dipertahankan untuk parity (belum dipakai aktif di MVP)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ----- Seed default categories -------------------------------

INSERT INTO categories (name, type) VALUES
  ('Makanan', 'expense'),
  ('Transportasi', 'expense'),
  ('Hiburan', 'expense'),
  ('Tagihan', 'expense'),
  ('Kesehatan', 'expense'),
  ('Belanja', 'expense'),
  ('Lainnya', 'expense'),
  ('Gaji', 'income'),
  ('Bonus', 'income'),
  ('Dividen', 'income'),
  ('Lainnya', 'income');

-- ----- Row Level Security ------------------------------------
-- Single-user model: any authenticated user has full access.
-- Email allowlist enforced via auth.users trigger below.

ALTER TABLE categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings       ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_all_categories    ON categories    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_transactions  ON transactions  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_investments   ON investments   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_price_history ON price_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_goals         ON goals         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_notes         ON notes         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_settings      ON settings      FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----- Email allowlist (sign-up gate) ------------------------

CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email NOT IN ('rinoadi28@gmail.com') THEN
    RAISE EXCEPTION 'Email tidak diizinkan untuk aplikasi ini';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_email_allowlist_trg
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_email_allowlist();
