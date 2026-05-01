---
phase: 09-phase-09-qa-bug-fix-fix-semua-bug-dari-qa-findings-md
plan: "01"
subsystem: database-migrations
tags: [sql, migration, trigger, rpc, goal-bugs, critical-fix]
dependency_graph:
  requires: []
  provides: [supabase/migrations/0025_fix_goal_bugs.sql]
  affects: [supabase/migrations/0021_goal_investments_total_check.sql, supabase/migrations/0024_add_money_to_goal_v2.sql]
tech_stack:
  added: []
  patterns: [FOR-UPDATE-subquery-isolation, table-alias-column-disambiguation, DROP-FUNCTION-before-CREATE-Phase5-discipline]
key_files:
  created:
    - supabase/migrations/0025_fix_goal_bugs.sql
  modified: []
decisions:
  - "FOR UPDATE di trigger enforce_goal_investment_total dipindahkan ke subquery — PostgreSQL melarang kombinasi FOR UPDATE + aggregate di level yang sama"
  - "Table alias 'g' ditambahkan ke semua column reference goals di add_money_to_goal — mirror pattern withdraw_from_goal Section 4 (0024:147-151)"
  - "DROP FUNCTION IF EXISTS sebelum CREATE untuk add_money_to_goal — Phase 5 discipline meskipun signature unchanged"
metrics:
  duration_seconds: 152
  completed_date: "2026-05-01T11:56:16Z"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 09 Plan 01: Create Migration 0025 — Fix Goal Bugs (Critical #1 + #2) Summary

**One-liner:** SQL migration fix trigger FOR UPDATE+aggregate isolation (Critical #1) dan table alias column disambiguation di add_money_to_goal RPC (Critical #2).

## What Was Built

File `supabase/migrations/0025_fix_goal_bugs.sql` — migration SQL idempotent berisi dua fix untuk bug Critical dari QA-FINDINGS.md:

**Section 1 (lines 22-62) — Critical #1: enforce_goal_investment_total trigger**
- Bug: `FOR UPDATE` bersamaan dengan `SUM()` aggregate di level yang sama melanggar PostgreSQL constraint
- Fix (D-02): pindahkan `FOR UPDATE` ke subquery, aggregate `SUM(sub.allocation_pct)` di outer SELECT
- Trigger di-re-attach dengan `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` (idempotent)

**Section 2 (lines 65-137) — Critical #2: add_money_to_goal ambiguous column**
- Bug: `RETURNS TABLE (current_amount NUMERIC, status TEXT)` mendefinisikan output variable dengan nama sama dengan kolom base table `goals` — SELECT tanpa alias menjadi ambigu
- Fix (D-05): tambahkan alias `g` pada semua column reference (`FROM goals g`, `WHERE g.id`, `UPDATE goals g`)
- Pattern mirror dari `withdraw_from_goal` Section 4 (0024:147-151) yang sudah benar
- `DROP FUNCTION IF EXISTS public.add_money_to_goal(BIGINT, NUMERIC)` sebelum CREATE (Phase 5 discipline)

## File Details

| Property | Value |
|----------|-------|
| Path | `supabase/migrations/0025_fix_goal_bugs.sql` |
| SHA-1 | `5f703a78ae76136de58f4fa52d809fc38a93aa5b` |
| Lines | 137 |
| Section 1 line range | 22–62 (enforce_goal_investment_total: function lines 27-57 + trigger lines 59-62) |
| Section 2 line range | 65–137 (add_money_to_goal: DROP line 70, CREATE lines 72-133, GRANT line 137) |
| Commit | `20473bc` |

## Acceptance Criteria Verification

| Criteria | Result |
|----------|--------|
| File `supabase/migrations/0025_fix_goal_bugs.sql` exists | PASS |
| `CREATE OR REPLACE FUNCTION enforce_goal_investment_total` — exactly 1 occurrence | PASS (line 27) |
| `DROP FUNCTION IF EXISTS public.add_money_to_goal(BIGINT, NUMERIC)` — exactly 1 | PASS (line 70) |
| `CREATE OR REPLACE FUNCTION add_money_to_goal` — exactly 1 | PASS (line 72) |
| `FROM goals g` — at least 1 occurrence | PASS (line 92) |
| `UPDATE goals g` — at least 1 occurrence | PASS (line 122) |
| `WHERE g.id = p_id AND g.user_id = v_uid` — exactly 2 occurrences (SELECT + UPDATE) | PASS |
| `FROM (` followed by `FOR UPDATE` followed by `) sub;` — proves subquery isolation | PASS (lines 41-47) |
| `DROP TRIGGER IF EXISTS goal_investments_total_check ON goal_investments` | PASS (line 59) |
| `CREATE TRIGGER goal_investments_total_check` | PASS (line 60) |
| `GRANT EXECUTE ON FUNCTION add_money_to_goal(BIGINT, NUMERIC) TO authenticated` | PASS (line 137) |
| File does NOT contain bare aggregate-with-FOR-UPDATE pattern | PASS |
| File does NOT contain `CREATE OR REPLACE FUNCTION withdraw_from_goal` | PASS (0 occurrences) |
| Only `0025_fix_goal_bugs.sql` modified (git diff shows 1 file) | PASS |

## Threat Model Compliance

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-09-01 | mitigate — SQL injection via plpgsql parameter binding (BIGINT, NUMERIC types) | Applied — all params strongly typed, no dynamic SQL |
| T-09-02 | accept — SUM scalar only observed, no row data returned | Maintained |
| T-09-03 | mitigate — auth.uid() guard + user_id filter on all reads/writes | Applied — g.user_id = v_uid on SELECT and UPDATE |
| T-09-04 | accept — FOR UPDATE scoped to narrow predicate (investment_id match) | Maintained |
| T-09-05 | mitigate — idempotency via CREATE OR REPLACE + DROP TRIGGER IF EXISTS + DROP FUNCTION IF EXISTS | Applied — all three patterns present |
| T-09-06 | accept — trigger invoked by machinery, cannot be bypassed at app level | Maintained |

## Deviations from Plan

None — plan executed exactly as written. SQL content is verbatim from plan specification.

## Known Stubs

None. File ini adalah SQL migration, bukan frontend component. Tidak ada data flow ke UI dari file ini secara langsung — efek hanya terjadi setelah Plan 09-03 (paste ke Studio).

## Threat Flags

None. File ini tidak menambahkan endpoint baru atau auth path baru. Hanya mengganti implementasi dua fungsi yang sudah ada.

## Next Steps

File ini siap di-paste ke Supabase Studio SQL Editor di Plan 09-03 (blocking task). Tidak ada yang perlu dijalankan sekarang — migration hanya efektif setelah di-apply ke database production.

## Self-Check

- [x] File `supabase/migrations/0025_fix_goal_bugs.sql` exists: FOUND
- [x] Commit `20473bc` exists in git log
- [x] No other migration files modified
