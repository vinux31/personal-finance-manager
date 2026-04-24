-- ============================================================
-- 0012_net_worth: Tabel aset, liabilitas, dan snapshot kekayaan
-- ============================================================

-- Tabel aset/akun
CREATE TABLE net_worth_accounts (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN (
               'tabungan','giro','cash','deposito',
               'dompet_digital','properti','kendaraan'
             )),
  balance    NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE net_worth_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own net worth accounts"
  ON net_worth_accounts FOR ALL
  USING      (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);

-- Tabel liabilitas
CREATE TABLE net_worth_liabilities (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN (
               'kpr','cicilan_kendaraan','kartu_kredit','paylater','kta'
             )),
  amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE net_worth_liabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own net worth liabilities"
  ON net_worth_liabilities FOR ALL
  USING      (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);

-- Tabel snapshot bulanan (computed net_worth column)
CREATE TABLE net_worth_snapshots (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_month     DATE NOT NULL,
  total_accounts     NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_investments  NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_liabilities  NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_worth          NUMERIC(15,2) GENERATED ALWAYS AS
                       (total_accounts + total_investments - total_liabilities) STORED,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, snapshot_month)
);

ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own net worth snapshots"
  ON net_worth_snapshots FOR ALL
  USING      (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);
