-- ============================================================
-- Phase 14 UAT pre-condition helper.
--
-- Purpose: reset CURRENT user's protection_checklist row to all-NULL state
-- so dev can re-run Plan 14-02 + 14-03 manual UAT flows from clean slate.
--
-- Usage (Supabase Studio SQL Editor, logged-in as the user under test):
--   \i supabase/scripts/reset-protection-checklist.sql
--   -- OR copy-paste the UPDATE statement below and run.
--
-- Referenced by:
--   - .planning/phases/14-protection-tier4-checklists/14-02-PLAN.md Task 3 UAT pre-condition
--   - .planning/phases/14-protection-tier4-checklists/14-03-PLAN.md Task 4 UAT pre-condition
--
-- Behavior:
--   - If row does not exist: no-op (UPDATE affects 0 rows).
--   - If row exists: all 8 business columns set to NULL; updated_at refreshed.
--   - user_id, created_at preserved (immutable).
--   - RLS WITH CHECK auth.uid() = user_id ensures dev only resets their own row.
-- ============================================================

UPDATE protection_checklist
SET
  health_coverage = NULL,
  has_dependents = NULL,
  life_coverage = NULL,
  life_coverage_sufficient = NULL,
  life_coverage_post_employment = NULL,
  estate_heirs_documented = NULL,
  estate_assets_documented = NULL,
  estate_will_exists = NULL,
  updated_at = NOW()
WHERE user_id = auth.uid();

-- Verify: should print one row (or zero if row never existed) with all NULLs.
SELECT
  user_id,
  health_coverage,
  has_dependents,
  life_coverage,
  life_coverage_sufficient,
  life_coverage_post_employment,
  estate_heirs_documented,
  estate_assets_documented,
  estate_will_exists,
  updated_at
FROM protection_checklist
WHERE user_id = auth.uid();
