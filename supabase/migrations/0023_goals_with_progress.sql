-- ============================================================
-- 0023_goals_with_progress: VIEW kompositor goal progress (CONS-01, D-09)
-- Single source-of-truth: total_amount = current_amount + Σ(allocation_pct × investment.current_value).
-- COALESCE(current_price, buy_price) handle investasi belum di-refresh harga.
-- LEFT JOIN handle goals tanpa linked investment (total_amount = current_amount only).
--
-- security_invoker = true (PG 15+) makes the view inherit the CALLER's RLS
-- policies on goals + goal_investments + investments. Mandatory — pattern parity
-- dengan 0015_upcoming_bills_unpaid_view.sql.
-- ============================================================

CREATE OR REPLACE VIEW goals_with_progress
WITH (security_invoker = true)
AS
SELECT
  g.id,
  g.user_id,
  g.name,
  g.target_amount,
  g.current_amount,
  g.target_date,
  g.status,
  g.current_amount + COALESCE(
    SUM(gi.allocation_pct / 100.0 * COALESCE(i.current_price, i.buy_price) * i.quantity),
    0
  ) AS total_amount
FROM goals g
LEFT JOIN goal_investments gi ON gi.goal_id = g.id
LEFT JOIN investments i ON i.id = gi.investment_id
GROUP BY g.id;

GRANT SELECT ON goals_with_progress TO authenticated;
