-- ============================================================
-- 0029_protection_checklist: Tabel checklist proteksi (Tier 1 #4 + Tier 4)
--
-- Phase 12 SCHEMA-01: Foundation untuk Phase 14 mutation forms.
-- - Tier 1 #4 Asuransi Kesehatan: health_coverage
-- - Tier 4 gate: has_dependents
-- - Tier 4 asuransi jiwa (kalau has_dependents=true): life_coverage*
-- - Tier 4 estate (universal): estate_*
--
-- Default behavior: row dibuat lazy di first interaction (Phase 14).
-- Empty state (no row) = semua tier 1 #4 dan tier 4 questions tampil unanswered (merah).
-- ============================================================

CREATE TABLE protection_checklist (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tier 1 #4: Asuransi Kesehatan
  health_coverage TEXT CHECK (health_coverage IN
    ('kantor','bpjs','pribadi','kombinasi','tidak')),

  -- Tier 4 gate
  has_dependents BOOLEAN,

  -- Tier 4: Asuransi Jiwa (relevant kalau has_dependents = true)
  life_coverage TEXT CHECK (life_coverage IN
    ('kantor','pribadi','keduanya','tidak')),
  life_coverage_sufficient BOOLEAN,
  life_coverage_post_employment TEXT CHECK (life_coverage_post_employment IN
    ('ya','tidak','tidak_yakin')),

  -- Tier 4: Estate (universal — applies whether has_dependents true atau false)
  estate_heirs_documented BOOLEAN,
  estate_assets_documented BOOLEAN,
  estate_will_exists BOOLEAN,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE protection_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own protection checklist"
  ON protection_checklist FOR ALL
  USING      ((SELECT auth.uid()) = user_id OR (SELECT is_admin()))
  WITH CHECK ((SELECT auth.uid()) = user_id);
