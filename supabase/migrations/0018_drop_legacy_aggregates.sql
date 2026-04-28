-- ============================================================
-- 0018_drop_legacy_aggregates: Phase 5 patch (defense-in-depth)
-- Drops the legacy 3-arg SECURITY DEFINER aggregates left orphaned by 0017's
-- signature change (added p_user_id UUID DEFAULT NULL → new function, old kept).
--
-- The legacy versions (LANGUAGE sql, no user filter at all) leak global
-- transaction aggregates to any authenticated user via PostgREST. Frontend
-- (src/db/reports.ts) and tests (05-tighten-rls.sql) already pass 4 args, so
-- after this drop they resolve to the new plpgsql versions with IDOR guards.
-- Legacy 3-arg callers (if any) will resolve to the new plpgsql via
-- p_user_id DEFAULT NULL → COALESCE(p_user_id, auth.uid()) → safe own-data scope.
--
-- Closes the gap that ROADMAP success criterion #4 (SEC-04 / T-04 IDOR) claimed
-- to fix in Phase 5 but was incomplete.
-- ============================================================

DROP FUNCTION IF EXISTS public.aggregate_by_period(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.aggregate_by_category(TEXT, DATE, DATE);
