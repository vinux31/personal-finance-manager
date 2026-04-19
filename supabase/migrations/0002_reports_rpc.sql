-- ============================================================
-- 0002_reports_rpc: Aggregation RPC functions for ReportsTab
-- ============================================================

CREATE OR REPLACE FUNCTION aggregate_by_period(
  p_granularity TEXT,
  p_date_from   DATE DEFAULT NULL,
  p_date_to     DATE DEFAULT NULL
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
    (p_date_from IS NULL OR date >= p_date_from) AND
    (p_date_to   IS NULL OR date <= p_date_to)
  GROUP BY period
  ORDER BY period;
$$;

CREATE OR REPLACE FUNCTION aggregate_by_category(
  p_type      TEXT,
  p_date_from DATE DEFAULT NULL,
  p_date_to   DATE DEFAULT NULL
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
    t.type = p_type AND
    (p_date_from IS NULL OR t.date >= p_date_from) AND
    (p_date_to   IS NULL OR t.date <= p_date_to)
  GROUP BY c.id, c.name
  HAVING COALESCE(SUM(t.amount), 0) > 0
  ORDER BY total DESC;
$$;

GRANT EXECUTE ON FUNCTION aggregate_by_period TO authenticated;
GRANT EXECUTE ON FUNCTION aggregate_by_category TO authenticated;
