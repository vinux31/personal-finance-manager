---
phase: 07-ui-data-consistency
plan: "01"
subsystem: database/views
tags: [view, security-invoker, rls, goals, investments, pgtap, cons-01]
dependency_graph:
  requires: []
  provides: [goals_with_progress VIEW, supabase/migrations/0023_goals_with_progress.sql, supabase/tests/07-goals-with-progress.sql]
  affects: [plan-07-03 (backfill uses VIEW IN clause), plan-07-05 (UI switches to VIEW)]
tech_stack:
  added: []
  patterns: [VIEW security_invoker=true, LEFT JOIN aggregation, COALESCE price fallback, pgTAP BEGIN/ROLLBACK]
key_files:
  created:
    - supabase/migrations/0023_goals_with_progress.sql
    - supabase/tests/07-goals-with-progress.sql
  modified: []
decisions:
  - "D-09: VIEW formula = current_amount + SUM(allocation_pct/100 * COALESCE(current_price, buy_price) * quantity) via LEFT JOIN"
  - "D-26: Migration numbered 0023 (not 0022) per Phase 6 numbering shift +1"
  - "security_invoker = true mandatory for RLS pass-through (T-07-01 mitigation)"
metrics:
  duration: ~15 minutes
  completed: 2026-04-29T05:39:27Z
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 7 Plan 01: goals_with_progress VIEW Summary

**One-liner:** VIEW `goals_with_progress` dengan `security_invoker = true` menghitung `total_amount = current_amount + Σ(allocation_pct/100 × COALESCE(current_price, buy_price) × quantity)` via LEFT JOIN goals/goal_investments/investments, menjadi single source-of-truth CONS-01 read path.

## What Was Built

### Migration 0023_goals_with_progress.sql

```sql
-- ============================================================
-- 0023_goals_with_progress: VIEW kompositor goal progress (CONS-01, D-09)
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
```

**Key design points:**
- `WITH (security_invoker = true)` — VIEW mewarisi RLS caller, bukan VIEW owner (wajib untuk hindari cross-user info-disclosure)
- `LEFT JOIN` — goals tanpa linked investment tetap muncul dengan `total_amount = current_amount`
- `COALESCE(i.current_price, i.buy_price)` — investasi yang belum pernah di-refresh harga tetap ter-kalkulasi menggunakan buy_price
- `gi.allocation_pct / 100.0` — pembagian desimal (bukan integer truncation)
- `GROUP BY g.id` — aman karena `goals.id` adalah PK (Postgres functional dependency rule)
- `GRANT SELECT` only — VIEW tidak writable; writes ke `goals` harus lewat RLS base table

### pgTAP Test 07-goals-with-progress.sql

File test mencakup 7 assertions total:

**SECTION 1 — Inline CASE WHEN (3 assertions):**
1. VIEW `goals_with_progress` exists (information_schema.views check)
2. VIEW menggunakan COALESCE (pg_get_viewdef LIKE '%COALESCE%')
3. VIEW punya `security_invoker=true` (pg_class.reloptions array check)

**SECTION 2 — DO block formula scenarios (4 RAISE NOTICE PASS/FAIL scenarios):**
4. Scenario 1: Goal dengan linked investment 60% × Rp 18jt × 1 → `total_amount = 10.800.000` (cash 0 + alokasi)
5. Scenario 2: Goal tanpa linked investment → `total_amount = current_amount` (LEFT JOIN sanity check)
6. Scenario 3: Investment dengan `current_price IS NULL` → COALESCE fallback ke `buy_price` (100% × 5jt × 2 = 10jt)
7. Scenario 4: RLS pass-through proof — JWT ganti ke user lain, row_security ON → 0 rows visible dari goals milik user pertama

## Pattern Source

**Analog utama:** `supabase/migrations/0015_upcoming_bills_unpaid_view.sql`
- `WITH (security_invoker = true)` — pattern identik
- `GRANT SELECT ON ... TO authenticated` — pattern identik
- Header comment style — dipertahankan

**Test analog:** `supabase/tests/06-withdraw-from-goal.sql`
- BEGIN/ROLLBACK wrapper
- auth.users seed dengan EXCEPTION SKIP fallback
- `set_config('request.jwt.claim.sub', ...)` untuk JWT context
- RAISE NOTICE 'PASS:' / 'FAIL:' convention (bukan pgtap plan/ok/is)

## Decisions Implemented

| Decision | Description |
|----------|-------------|
| D-09 | VIEW formula verbatim: `current_amount + COALESCE(SUM(pct/100 * COALESCE(cur,buy) * qty), 0)` |
| D-26 | Migration numbered 0023 (tidak 0022) — Phase 6 numbering shift +1 documented di STATE.md |
| Pattern C | `WITH (security_invoker = true)` mandatory — RLS pass-through untuk base tables |
| D-28 | pgTAP test convention: BEGIN/ROLLBACK, SET LOCAL row_security = off, RAISE NOTICE PASS:/FAIL: |

## Threats Addressed

| Threat | Category | Mitigation Applied |
|--------|----------|--------------------|
| T-07-01 | Information Disclosure | `WITH (security_invoker = true)` — VIEW mewarisi caller's RLS; tanpa ini VIEW run as owner (postgres), bypass RLS → cross-user goal leak. Verified oleh Scenario 4 (RLS pass-through) + SECTION 1 reloptions check. |
| T-07-02 | Information Disclosure | Inherited via T-07-01 — security_invoker berlaku ke JOIN investments juga; only own investments via goal_investments FK chain |
| T-07-03 | Tampering | `GRANT SELECT` only — no INSERT/UPDATE/DELETE on VIEW; base table writes lewat RLS |

## Next Steps (dependent plans)

- **Plan 07-03** (`goals.status` backfill) depends on VIEW ini — uses `IN (SELECT id FROM goals_with_progress WHERE total_amount >= target_amount)` di migration 0024
- **Plan 07-05** (UI switch) — GoalsTab dan AddMoneyDialog akan query `goals_with_progress` bukan base `goals` untuk `total_amount` display
- **Migration deploy:** Paste ke Supabase Studio SQL Editor (order: 0022 → **0023** → 0024 per D-27). `supabase db push` tidak digunakan (STATE.md decision).

## Deviations from Plan

None — plan executed exactly as written. Migration content matches verbatim template dari PLAN.md action block. Test file follows exact structure from PLAN.md action block with all required scenarios.

## Known Stubs

None — VIEW fully defined, test uses concrete numeric values. No placeholder or empty data.

## Self-Check: PASSED

- `supabase/migrations/0023_goals_with_progress.sql` EXISTS (verified)
- `supabase/tests/07-goals-with-progress.sql` EXISTS (verified)
- Commit `c40e337` — feat(07-01): create VIEW goals_with_progress migration 0023 (verified)
- Commit `e751aa7` — test(07-01): add pgTAP integration test for goals_with_progress VIEW (verified)
- `grep -c "WITH (security_invoker = true)" ...` returns 1 (verified)
- `grep -c "RAISE NOTICE 'PASS:" ...` returns 5 (≥4 requirement met, verified)
