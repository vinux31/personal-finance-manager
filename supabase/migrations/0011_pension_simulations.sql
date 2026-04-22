create table pension_simulations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  updated_at  timestamptz not null default now(),

  -- Profil Dasar
  usia            int not null default 30,
  usia_pensiun    int not null default 56,
  gaji_pokok      bigint not null default 0,
  masa_kerja      int not null default 0,
  target_bulanan  bigint not null default 10000000,

  -- Panel Simulasi Investasi
  sim_investasi_bulanan   bigint not null default 500000,
  sim_kenaikan_pct        numeric(5,2) not null default 5,
  sim_inflasi_pct         numeric(5,2) not null default 4,
  sim_target_spend        bigint not null default 10000000,
  sim_alokasi_emas        int not null default 40,
  sim_alokasi_saham       int not null default 30,
  sim_alokasi_rd          int not null default 30,
  sim_rd_type             text not null default 'cp',

  -- Panel Hitung Total: enable flags
  ht_en_bpjs      boolean not null default true,
  ht_en_dppk      boolean not null default false,
  ht_en_dplk      boolean not null default false,
  ht_en_taspen    boolean not null default false,
  ht_en_pesangon  boolean not null default true,
  ht_en_invest    boolean not null default true,

  -- BPJS
  ht_bpjs_upah    bigint not null default 0,

  -- DPPK
  ht_dppk_type    text not null default 'ppmp',
  ht_dppk_phdp    bigint not null default 0,
  ht_dppk_faktor  numeric(5,2) not null default 2.5,
  ht_dppk_iuran   bigint not null default 0,

  -- DPLK
  ht_dplk_iuran   bigint not null default 0,
  ht_dplk_return  numeric(5,2) not null default 7,
  ht_dplk_saldo   bigint not null default 0,

  -- Taspen
  ht_taspen_gaji  bigint not null default 0,
  ht_taspen_gol   text not null default 'IIIa',

  -- Investasi Mandiri (Hitung Total)
  ht_inv_bulanan  bigint not null default 500000,
  ht_inv_return   numeric(5,2) not null default 10,
  ht_inv_saldo    bigint not null default 0,
  ht_inv_kenaikan numeric(5,2) not null default 5,

  unique(user_id)
);

alter table pension_simulations enable row level security;

create policy "Users manage own pension sim"
  on pension_simulations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
