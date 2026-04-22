-- ============================================================
-- 0011_pension_simulations: Tabel simulasi pensiun BUMN
-- ============================================================

CREATE TABLE pension_simulations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- updated_at is set explicitly by the app on every upsert (not auto-triggered)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Profil Dasar
  usia            INT NOT NULL DEFAULT 30,
  usia_pensiun    INT NOT NULL DEFAULT 56,
  gaji_pokok      BIGINT NOT NULL DEFAULT 0,
  masa_kerja      INT NOT NULL DEFAULT 0,
  target_bulanan  BIGINT NOT NULL DEFAULT 10000000,

  -- Panel Simulasi Investasi
  sim_investasi_bulanan   BIGINT NOT NULL DEFAULT 500000,
  sim_kenaikan_pct        NUMERIC(5,2) NOT NULL DEFAULT 5,
  sim_inflasi_pct         NUMERIC(5,2) NOT NULL DEFAULT 4,
  sim_target_spend        BIGINT NOT NULL DEFAULT 10000000,
  sim_alokasi_emas        INT NOT NULL DEFAULT 40,
  sim_alokasi_saham       INT NOT NULL DEFAULT 30,
  sim_alokasi_rd          INT NOT NULL DEFAULT 30,
  sim_rd_type             TEXT NOT NULL DEFAULT 'cp' CHECK (sim_rd_type IN ('pu', 'pt', 'cp', 'sh')),

  -- Panel Hitung Total: enable flags
  ht_en_bpjs      BOOLEAN NOT NULL DEFAULT true,
  ht_en_dppk      BOOLEAN NOT NULL DEFAULT false,
  ht_en_dplk      BOOLEAN NOT NULL DEFAULT false,
  ht_en_taspen    BOOLEAN NOT NULL DEFAULT false,
  ht_en_pesangon  BOOLEAN NOT NULL DEFAULT true,
  ht_en_invest    BOOLEAN NOT NULL DEFAULT true,

  -- BPJS
  ht_bpjs_upah    BIGINT NOT NULL DEFAULT 0,

  -- DPPK
  ht_dppk_type    TEXT NOT NULL DEFAULT 'ppmp' CHECK (ht_dppk_type IN ('ppmp', 'ppip')),
  ht_dppk_phdp    BIGINT NOT NULL DEFAULT 0,
  ht_dppk_faktor  NUMERIC(5,2) NOT NULL DEFAULT 2.5,
  ht_dppk_iuran   BIGINT NOT NULL DEFAULT 0,

  -- DPLK
  ht_dplk_iuran   BIGINT NOT NULL DEFAULT 0,
  ht_dplk_return  NUMERIC(5,2) NOT NULL DEFAULT 7,
  ht_dplk_saldo   BIGINT NOT NULL DEFAULT 0,

  -- Taspen
  ht_taspen_gaji  BIGINT NOT NULL DEFAULT 0,
  ht_taspen_gol   TEXT NOT NULL DEFAULT 'IIIa',

  -- Investasi Mandiri (Hitung Total)
  ht_inv_bulanan  BIGINT NOT NULL DEFAULT 500000,
  ht_inv_return   NUMERIC(5,2) NOT NULL DEFAULT 10,
  ht_inv_saldo    BIGINT NOT NULL DEFAULT 0,
  ht_inv_kenaikan NUMERIC(5,2) NOT NULL DEFAULT 5,

  UNIQUE(user_id)
);

ALTER TABLE pension_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pension sim"
  ON pension_simulations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
