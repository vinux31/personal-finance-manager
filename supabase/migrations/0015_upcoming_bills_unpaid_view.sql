-- ============================================================
-- 0015_upcoming_bills_unpaid_view: Sisa Aman D-03 — exclude bills
-- already paid in the current month. First VIEW in the project.
-- Feeds listUpcomingBills() via a simple .from('upcoming_bills_unpaid')
-- swap and automatically keeps client arithmetic correct.
-- ============================================================

-- security_invoker = true (PG 15+) makes the view inherit the CALLER's RLS
-- policies on the underlying tables (recurring_templates + bill_payments).
-- Without this flag, Postgres defaults to security_definer semantics where
-- the view runs as its owner (typically a superuser), bypassing RLS entirely.
-- RESEARCH Pitfall 7 — mandatory.
CREATE OR REPLACE VIEW upcoming_bills_unpaid
WITH (security_invoker = true)
AS
SELECT
  t.id,
  t.user_id,
  t.name,
  t.type,
  t.category_id,
  t.amount,
  t.note,
  t.frequency,
  t.next_due_date,
  t.is_active,
  t.created_at
FROM recurring_templates t
WHERE t.is_active = true
  AND t.type = 'expense'
  AND NOT EXISTS (
    SELECT 1
    FROM bill_payments bp
    WHERE bp.recurring_template_id = t.id
      AND bp.user_id = t.user_id
      AND bp.paid_date >= date_trunc('month', CURRENT_DATE)::DATE
      AND bp.paid_date <  (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::DATE
  );

-- Grant SELECT on the view itself (RLS on underlying tables still enforced
-- because of security_invoker = true).
GRANT SELECT ON upcoming_bills_unpaid TO authenticated;
