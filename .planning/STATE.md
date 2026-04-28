---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Hardening & Consistency
status: executing
stopped_at: Phase 5 Wave 1 merged to master — Wave 2 (05-04 deploy+UAT) pending user
last_updated: "2026-04-28T00:00:00.000Z"
last_activity: 2026-04-28 -- Phase 05 Wave 1 merged (3/4 plans complete)
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 4
  completed_plans: 3
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Pengguna bisa melihat gambaran lengkap kondisi keuangan mereka dalam satu tempat, dengan kalkulasi yang relevan untuk konteks Indonesia.
**Current focus:** Phase 05 — security-hardening

## Current Position

Phase: 05 (security-hardening) — EXECUTING
Plan: 4 of 4 (Wave 2 — 05-04 deploy & UAT) pending user
Status: Wave 1 (05-01/02/03) merged to master, smoke gate pass
Last activity: 2026-04-28 -- Phase 05 Wave 1 merged (3 worktree branches → master, build PASS, lint clean for Wave 1 files)

## v1.1 Phase Summary

| Phase | Name | Requirements | Migrations | Status |
|-------|------|--------------|-----------|--------|
| 5 | Security Hardening | SEC-01..04 | `0017_tighten_rls.sql` | Wave 1 done (3/4) — 05-04 deploy+UAT pending |
| 6 | Race & Atomicity | RACE-01..03, DEV-01 | `0018_process_due_recurring.sql`, `0019_withdraw_from_goal.sql`, `0020_goal_investments_total_check.sql` | Not started |
| 7 | UI/Data Consistency | CONS-01..03, UX-01..02 | `0021_user_seed_markers.sql` + seed_rencana, `0022_goals_with_progress.sql`, `0023_add_money_to_goal_v2.sql` | Not started |
| 8 | Dev Hygiene | DEV-02..04 | (none) | Not started |

## Accumulated Context

### Decisions (carried from v1.0)

- Build order: Foundation (DB + bug fix + nav) → Net Worth Tracker (additive UI) → Bills Display (display-only) → Mark-as-Paid (riskiest, isolated last)
- Investasi auto-included di Net Worth sebagai baris read-only dari tabel investments — block manual investasi account untuk cegah double-count
- bill_payments table (Option A): mark-as-paid atomik buat transaction + catat payment + advance next_due_date sekaligus
- Schema: dua tabel terpisah (net_worth_accounts + net_worth_liabilities) — cleaner untuk query semantics
- Mutation-only Date clamping for nextDueDate monthly: setDate(1)+setMonth+Math.min(d,lastDay)
- RLS D-06: dua tabel terpisah (accounts + liabilities), bill_payments.transaction_id nullable + SET NULL
- mark_bill_paid RPC uses SECURITY DEFINER + explicit user_id=v_uid (cannot rely on DEFAULT auth.uid()); idempotency via FOR UPDATE row lock + IF EXISTS on bill_payments
- upcoming_bills_unpaid VIEW security_invoker=true; half-open month window [start, +1 month)
- SQL tests convention: supabase/tests/<phase>-<feature>.sql, BEGIN/ROLLBACK, RAISE NOTICE PASS:/FAIL:
- Optimistic mutation + snapshot rollback (first di project) — pattern verified
- Production verify-before-close (Playwright + Supabase Cloud) — caught 1 deploy gap + 1 toast bug
- mapSupabaseError extract `.message` dari plain-object errors (Supabase RPC errors bukan Error instance)

### Decisions (v1.1 roadmap-time)

- **Phase order:** 5 (Security) → 6 (Race) → 7 (UI Consistency) → 8 (Dev Hygiene). Phase 5 first per blast-radius hierarchy (defensive only, zero user-facing change). Phase 6 isolated karena highest-blast-radius DB writes. Phase 7 has dep on Phase 6 (CONS-01 reuses pattern dari RACE-03 withdraw RPC). Phase 8 last — pure code/config, no DB.
- **Phase 5 single migration:** `0017_tighten_rls.sql` bundles all 4 SEC findings — `CREATE OR REPLACE FUNCTION` + `DROP POLICY IF EXISTS` make it idempotent; splitting would risk incomplete rollouts (H-04 deployed but not H-06 = IDOR still open).
- **Phase 6 vs Phase 5 independence:** No hard dep, can parallel-deploy, but ship Phase 5 first per research recommendation (lower blast radius).
- **Phase 7 vs Phase 8 split rationale:** Phase 7 has 3 DB migrations (additive view + new table + RPC v2), Phase 8 is pure code/config. Different deploy paths + different test gates → keep separate even though both low risk.
- **DEV-01 mapped to Phase 6:** `nextDueDate` TS removal is auto-resolved by RACE-01 RPC refactor. Snapshot/parity test ditulis sebagai bagian dari verifikasi Phase 6, bukan Phase 8.
- **UX-01 + UX-02 mapped to Phase 7:** UI-facing fixes (localStorage key + View-As CSV gate) — both small, low-risk, koheren dengan tema "UI/Data Consistency".
- **Migration numbering:** v1.0 ended at 0016. v1.1 starts at 0017 (Phase 5). No collision risk because Phase 5 ships first (`0017`), Phase 6 ships next (`0018`-`0020`), Phase 7 ships last with DB migrations (`0021`-`0023`).
- **Granularity:** No `granularity` field di config.json. Default = standard (5-8 phases). 4 phases for v1.1 = below standard floor, justified karena scope sempit (16 hardening items, no new features).

### Pending Todos

None.

### Blockers/Concerns

- **Phase 05 Wave 2 (05-04) requires user interaction** — `supabase db push --linked` (atau SQL Editor fallback per `project_supabase_migration_workflow`), `supabase functions deploy fetch-prices`, 3 curl smoke tests, dan 5 browser-MCP UAT scenarios. Tidak autonomous.
- 23 lint errors di src/ pre-existing (badge/button/tabs fast-refresh, csvInvestments/investments any, PensiunTab refs-during-render) — defer ke Phase 8 Dev Hygiene.

## Deferred Items (carried from v1.0 — review for v1.1 inclusion)

| Category | Item | Status | Severity | Deferred At | Source |
|----------|------|--------|----------|-------------|--------|
| bug | createRecurringTemplate missing user_id → RLS 403 (pre-existing) | candidate-for-Phase-6 | HIGH | 2026-04-25 | v1.0-MILESTONE-AUDIT.md Tech Debt #1 |
| test | Full psql regression `supabase/tests/04-mark-bill-paid.sql` not executed (Docker absent) | blocked-by-environment | MEDIUM | 2026-04-25 | 04-VERIFICATION.md |
| ux | UpcomingBillsPanel AlertDialog body shows only nama bill, missing nominal+tanggal | open (not in v1.1) | cosmetic | 2026-04-25 | 04-UAT.md |
| ux | Net Worth card no auto-refresh post mark-as-paid (by-design) — needs tooltip/helper text | open (not in v1.1) | cosmetic | 2026-04-25 | v1.0-MILESTONE-AUDIT.md |
| test | useMarkBillPaid does not invalidate `['net-worth-snapshots']` query | open (not in v1.1) | INFO | 2026-04-25 | v1.0-MILESTONE-AUDIT.md |
| test | `mapSupabaseError` unit test for plain-object errors not added | open (not in v1.1) | LOW | 2026-04-25 | 04-UAT.md |

## Session Continuity

Last session: 2026-04-28 — Phase 05 Wave 1 finalized (worktree merge + smoke gate)
Stopped at: Wave 2 (05-04 deploy & UAT) — pending user, requires interactive checkpoints
Resume command: `/gsd-execute-phase 5` (akan masuk ke Wave 2 / 05-04)
Next file expected: `.planning/phases/05-security-hardening/05-04-SUMMARY.md` + `.planning/phases/05-security-hardening/05-VERIFICATION.md`
Wave 1 commits di master: `4692dc4` (05-01) → `4cf5129` (05-02) → `d7a0521` (05-03)
