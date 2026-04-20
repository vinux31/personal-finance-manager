-- ============================================================
-- 0006_multi_user: Multi-user support
-- ============================================================

-- ----- Tabel baru: profiles --------------------------------

CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin     BOOLEAN NOT NULL DEFAULT false,
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_upsert ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ----- Tabel baru: allowed_emails --------------------------

CREATE TABLE allowed_emails (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  added_by   UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY allowed_emails_select ON allowed_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY allowed_emails_insert ON allowed_emails FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY allowed_emails_delete ON allowed_emails FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ----- Helper function is_admin() --------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- ----- Tambah kolom user_id ke semua tabel data ------------

ALTER TABLE transactions     ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE investments      ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE price_history    ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE goals             ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE notes             ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE goal_investments  ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- settings: ubah PK menjadi (user_id, key)
ALTER TABLE settings DROP CONSTRAINT settings_pkey;
ALTER TABLE settings ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE settings ADD PRIMARY KEY (user_id, key);

-- ----- Seed data: admin + allowed_emails -------------------
-- (dijalankan sebelum SET NOT NULL agar baris existing mendapat user_id)

INSERT INTO allowed_emails (email)
  SELECT email FROM auth.users WHERE email = 'rinoadi28@gmail.com'
  ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, is_admin, display_name)
  SELECT id, true, raw_user_meta_data->>'full_name'
  FROM auth.users WHERE email = 'rinoadi28@gmail.com'
  ON CONFLICT (id) DO UPDATE SET is_admin = true;

-- Assign semua data existing ke UID admin
UPDATE transactions     SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com') WHERE user_id IS NULL;
UPDATE investments      SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com') WHERE user_id IS NULL;
UPDATE price_history    SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com') WHERE user_id IS NULL;
UPDATE goals            SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com') WHERE user_id IS NULL;
UPDATE notes            SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com') WHERE user_id IS NULL;
UPDATE goal_investments SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com') WHERE user_id IS NULL;
UPDATE settings         SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com') WHERE user_id IS NULL;

-- SET NOT NULL setelah semua baris ter-assign
ALTER TABLE transactions     ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE investments      ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE price_history    ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE goals             ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE notes             ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE goal_investments  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE settings          ALTER COLUMN user_id SET NOT NULL;

-- ----- Update RLS policies ---------------------------------

-- transactions
DROP POLICY auth_all_transactions ON transactions;
CREATE POLICY transactions_select ON transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY transactions_write ON transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- investments
DROP POLICY auth_all_investments ON investments;
CREATE POLICY investments_select ON investments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY investments_write ON investments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- price_history
DROP POLICY auth_all_price_history ON price_history;
CREATE POLICY price_history_select ON price_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY price_history_write ON price_history FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- goals
DROP POLICY auth_all_goals ON goals;
CREATE POLICY goals_select ON goals FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY goals_write ON goals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- notes
DROP POLICY auth_all_notes ON notes;
CREATE POLICY notes_select ON notes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY notes_write ON notes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- goal_investments
DROP POLICY auth_all_goal_investments ON goal_investments;
CREATE POLICY goal_investments_select ON goal_investments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY goal_investments_write ON goal_investments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- settings
DROP POLICY auth_all_settings ON settings;
CREATE POLICY settings_select ON settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY settings_write ON settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- categories tetap global (tidak ada perubahan policy)

-- ----- Update trigger email allowlist ---------------------

CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bootstrap: jika tabel masih kosong, izinkan (setup awal)
  IF NOT EXISTS (SELECT 1 FROM allowed_emails) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM allowed_emails WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'Email tidak diizinkan untuk aplikasi ini';
  END IF;
  RETURN NEW;
END;
$$;
-- Trigger sudah ada dari migration 0001, fungsi saja yang diupdate.

-- ----- Update RPCs untuk support view-as admin ------------

CREATE OR REPLACE FUNCTION aggregate_by_period(
  p_granularity TEXT,
  p_date_from   DATE    DEFAULT NULL,
  p_date_to     DATE    DEFAULT NULL,
  p_user_id     UUID    DEFAULT NULL
)
RETURNS TABLE (period TEXT, income NUMERIC, expense NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE p_granularity
      WHEN 'day'   THEN to_char(date, 'YYYY-MM-DD')
      WHEN 'week'  THEN to_char(date_trunc('week', date), 'YYYY-"W"IW')
      WHEN 'month' THEN to_char(date, 'YYYY-MM')
      ELSE              to_char(date, 'YYYY')
    END AS period,
    COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS income,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
  FROM transactions
  WHERE
    user_id = COALESCE(p_user_id, auth.uid()) AND
    (p_date_from IS NULL OR date >= p_date_from) AND
    (p_date_to   IS NULL OR date <= p_date_to)
  GROUP BY period
  ORDER BY period;
$$;

CREATE OR REPLACE FUNCTION aggregate_by_category(
  p_type      TEXT,
  p_date_from DATE    DEFAULT NULL,
  p_date_to   DATE    DEFAULT NULL,
  p_user_id   UUID    DEFAULT NULL
)
RETURNS TABLE (category TEXT, total NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.name AS category, COALESCE(SUM(t.amount), 0) AS total
  FROM transactions t
  JOIN categories c ON t.category_id = c.id
  WHERE
    t.user_id = COALESCE(p_user_id, auth.uid()) AND
    t.type = p_type AND
    (p_date_from IS NULL OR t.date >= p_date_from) AND
    (p_date_to   IS NULL OR t.date <= p_date_to)
  GROUP BY c.id, c.name
  HAVING COALESCE(SUM(t.amount), 0) > 0
  ORDER BY total DESC;
$$;

-- Update add_money_to_goal: pastikan goal milik pemanggil
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
  v_target     NUMERIC;
  v_new_amount NUMERIC;
  v_new_status TEXT;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Jumlah harus > 0';
  END IF;

  UPDATE goals
  SET current_amount = goals.current_amount + p_amount
  WHERE id = p_id AND user_id = auth.uid()
  RETURNING goals.current_amount, goals.target_amount
  INTO v_new_amount, v_target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal tidak ditemukan';
  END IF;

  v_new_status := CASE WHEN v_new_amount >= v_target THEN 'completed' ELSE NULL END;

  IF v_new_status IS NOT NULL THEN
    UPDATE goals SET status = v_new_status WHERE id = p_id AND user_id = auth.uid();
  END IF;

  RETURN QUERY SELECT v_new_amount, COALESCE(v_new_status, (SELECT goals.status FROM goals WHERE id = p_id));
END;
$$;

GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
