-- ============================================================
-- 0017_tighten_rls: Phase 5 Security Hardening (v1.1)
-- Bundles SEC-02 + SEC-03 + SEC-04 into one idempotent migration.
--   - SEC-02: profiles + allowed_emails RLS SELECT (close H-04 info-disclosure)
--   - SEC-03: enforce_email_allowlist hard-coded fallback (close H-05 bootstrap bypass)
--   - SEC-04: aggregate_by_period + aggregate_by_category IDOR guards (close H-06)
-- Idempotent: DROP POLICY IF EXISTS + CREATE OR REPLACE FUNCTION → re-runnable.
-- Reference pattern: mark_bill_paid (0014_mark_bill_paid.sql:56-70).
-- ============================================================

-- ------------------------------------------------------------
-- SEC-02 (H-04): Tighten profiles + allowed_emails SELECT policies
-- Per Supabase RLS best practices — wrap auth.uid() and is_admin() in SELECT
-- for statement-level caching ("99.97% performance improvement").
-- ------------------------------------------------------------

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS allowed_emails_select ON public.allowed_emails;
CREATE POLICY allowed_emails_select ON public.allowed_emails
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

-- ------------------------------------------------------------
-- SEC-03 (H-05): Harden enforce_email_allowlist empty-table branch
-- Hard-coded admin fallback — defense-in-depth if allowed_emails ever wiped.
-- Mirrors invariant from 0006:66-68 (initial seed = bootstrap admin email).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If allowlist somehow empty (DELETE/TRUNCATE went rogue), allow ONLY the bootstrap admin.
  IF NOT EXISTS (SELECT 1 FROM public.allowed_emails) THEN
    IF NEW.email IS DISTINCT FROM 'rinoadi28@gmail.com' THEN
      RAISE EXCEPTION 'Allowlist kosong — hanya admin awal yang dapat sign up';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.allowed_emails WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'Email tidak diizinkan untuk aplikasi ini';
  END IF;
  RETURN NEW;
END;
$$;
-- Trigger itself (created in migration 0001) is unchanged — CREATE OR REPLACE FUNCTION updates body in place.

-- ------------------------------------------------------------
-- SEC-04 (H-06): aggregate_by_period — switch to plpgsql + IDOR guard
-- Pattern mirrors mark_bill_paid (0014:56-70). LANGUAGE must change from sql → plpgsql
-- to allow RAISE EXCEPTION + DECLARE local variable.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.aggregate_by_period(
  p_granularity TEXT,
  p_date_from   DATE DEFAULT NULL,
  p_date_to     DATE DEFAULT NULL,
  p_user_id     UUID DEFAULT NULL
)
RETURNS TABLE (period TEXT, income NUMERIC, expense NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_target_uid UUID := COALESCE(p_user_id, auth.uid());
BEGIN
  -- Auth guard: must be authenticated
  IF v_target_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;
  -- Access guard: own data, or admin
  IF v_target_uid <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    CASE p_granularity
      WHEN 'day'   THEN to_char(t.date, 'YYYY-MM-DD')
      WHEN 'week'  THEN to_char(date_trunc('week', t.date), 'YYYY-"W"IW')
      WHEN 'month' THEN to_char(t.date, 'YYYY-MM')
      ELSE              to_char(t.date, 'YYYY')
    END AS period,
    COALESCE(SUM(CASE WHEN t.type = 'income'  THEN t.amount ELSE 0 END), 0) AS income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS expense
  FROM public.transactions t
  WHERE
    t.user_id = v_target_uid AND
    (p_date_from IS NULL OR t.date >= p_date_from) AND
    (p_date_to   IS NULL OR t.date <= p_date_to)
  GROUP BY 1
  ORDER BY 1;
END;
$$;

-- ------------------------------------------------------------
-- SEC-04 (H-06): aggregate_by_category — same IDOR guard
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.aggregate_by_category(
  p_type      TEXT,
  p_date_from DATE DEFAULT NULL,
  p_date_to   DATE DEFAULT NULL,
  p_user_id   UUID DEFAULT NULL
)
RETURNS TABLE (category TEXT, total NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_target_uid UUID := COALESCE(p_user_id, auth.uid());
BEGIN
  IF v_target_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF v_target_uid <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.name AS category, COALESCE(SUM(t.amount), 0) AS total
  FROM public.transactions t
  JOIN public.categories c ON t.category_id = c.id
  WHERE
    t.user_id = v_target_uid AND
    t.type = p_type AND
    (p_date_from IS NULL OR t.date >= p_date_from) AND
    (p_date_to   IS NULL OR t.date <= p_date_to)
  GROUP BY c.id, c.name
  HAVING COALESCE(SUM(t.amount), 0) > 0
  ORDER BY total DESC;
END;
$$;

-- ------------------------------------------------------------
-- GRANTS — full signature required (default-having params included)
-- Re-grant idempotently (Postgres does not error on duplicate GRANT).
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.aggregate_by_period(TEXT, DATE, DATE, UUID)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.aggregate_by_category(TEXT, DATE, DATE, UUID) TO authenticated;
