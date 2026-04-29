---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Hardening & Consistency
status: executing
stopped_at: Phase 7 complete — ready for Phase 8
last_updated: "2026-04-29T07:00:00.000Z"
last_activity: 2026-04-29 -- Phase 07 complete (PASS-WITH-NOTES)
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 17
  completed_plans: 17
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Pengguna bisa melihat gambaran lengkap kondisi keuangan mereka dalam satu tempat, dengan kalkulasi yang relevan untuk konteks Indonesia.
**Current focus:** Phase 07 — ui-data-consistency

## Current Position

Phase: 07 (ui-data-consistency) — **COMPLETE (PASS-WITH-NOTES)**
Phase: 08 (dev-hygiene) — Not started
Status: Phase 07 complete; Phase 08 ready to plan
Last activity: 2026-04-29 -- Phase 07 UAT complete (5/5 PASS), VERIFICATION.md written

## v1.1 Phase Summary

| Phase | Name | Requirements | Migrations | Status |
|-------|------|--------------|-----------|--------|
| 5 | Security Hardening | SEC-01..04 | `0017_tighten_rls.sql`, `0018_drop_legacy_aggregates.sql` (in-flight patch) | **Complete (PASS-WITH-NOTES)** |
| 6 | Race & Atomicity | RACE-01..03, DEV-01 | `0019_process_due_recurring.sql`, `0020_withdraw_from_goal.sql`, `0021_goal_investments_total_check.sql` | Not started |
| 7 | UI/Data Consistency | CONS-01..03, UX-01..02 | `0022_user_seed_markers.sql` + seed_rencana, `0023_goals_with_progress.sql`, `0024_add_money_to_goal_v2.sql` | **Complete (PASS-WITH-NOTES)** |
| 8 | Dev Hygiene | DEV-02..04 | (none) | Not started |

> ⚠ **Migration numbering shifted by +1 starting Phase 6** — Phase 5 consumed migration slots 0017 (planned) + 0018 (unplanned in-flight patch). Phase 6's `0018_process_due_recurring.sql` etc. need to be renumbered to 0019/0020/0021. Confirm during /gsd-plan-phase 6.

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
- **Migration numbering (initial):** v1.0 ended at 0016. v1.1 starts at 0017 (Phase 5).

### Decisions (v1.1 execution-time, post-Phase-5)

- **Phase 5 PASS-WITH-NOTES.** All 5 ROADMAP success criteria evidenced; SC #3 verified DB-side only (TRUNCATE+signup destructive variant intentionally not run against production).
- **In-flight patch 0018.** Migration 0017 used `CREATE OR REPLACE FUNCTION` to "swap" `aggregate_by_period`/`aggregate_by_category` from sql→plpgsql while adding `p_user_id UUID DEFAULT NULL` arg. PostgreSQL keys function identity on signature → new 4-arg plpgsql versions created alongside (not replacing) legacy 3-arg `sql` versions. Legacy versions had `SECURITY DEFINER` + no user filter → reachable info-disclosure via direct PostgREST 3-arg call. Patched with `0018_drop_legacy_aggregates.sql` during 05-04 verification. **Lesson:** planner must require explicit `DROP FUNCTION` whenever a function signature changes.
- **Migration numbering shift +1 from Phase 6.** Phase 5 consumed slots 0017 (planned) + 0018 (in-flight patch). Phase 6's planned 0018-0020 must be renumbered to 0019-0021. Phase 7's planned 0021-0023 → 0022-0024. Confirm and update during /gsd-plan-phase 6.
- **Studio fallback is the de-facto migration channel.** Per memory `project_supabase_migration_workflow.md`, `supabase db push` fails with history mismatch and `migration repair` is broken. All migrations from 0014 onward have been applied via Studio SQL Editor manual paste. `supabase migration list --linked` will show 0014..0018 as Local-only — this is acceptable for now; reconciling history is a separate hygiene task (filed below).
- **Edge function runtime gate stronger than handler gate.** `verify_jwt = true` in config.toml causes Supabase runtime to reject pre-handler with body `{"code":"UNAUTHORIZED_NO_AUTH_HEADER"...}` instead of the handler's `{"error":"Unauthorized"}`. This is acceptable defense-in-depth; plan-stated body wording is informational only.
- **REST/RPC HTTP testing > DevTools console for RLS UAT.** UAT-1/2/3 in Plan 05-04 originally specified DevTools console assertions (`window.__sb`); we used direct REST/RPC calls with the non-admin JWT instead. Reproducible from CI/shell, captures verbatim JSON evidence, and matches the actual threat model (any token-holder can hit PostgREST directly).

### Decisions (v1.1 execution-time, post-Phase-7)

- **Phase 7 PASS-WITH-NOTES.** All 8 plans complete, all 5 ROADMAP success criteria evidenced. Two notes: (1) D-14 raw NUMERIC formatting in withdraw_from_goal error message (cosmetic, acceptance criteria met); (2) UAT-2 Edge Function CORS blocks live date param verification (code fix in source verified).
- **withdraw_from_goal RETURNS TABLE column ambiguity hotfix (0024).** Supabase plpgsql `RETURNS TABLE (current_amount NUMERIC, ...)` creates output variables in scope, making `SELECT current_amount FROM goals` ambiguous. Fix: qualify table columns with alias `g`. Applied as Studio hot-patch + commit `c1783d2`. **Lesson:** when writing plpgsql RETURNS TABLE, always qualify base-table column references with a table alias to avoid output-variable shadowing.
- **Studio paste de-facto migration channel continues.** `db push` remains broken (history mismatch). Migrations 0022+0023+0024 applied via Studio SQL Editor paste. Migration list shows Local-only — accepted per prior STATE.md decision.
- **seed_rencana creates 5 goals + 3 investments (not 5+5 as in pre-planning notes).** RPC inserts 5 goal rows + 3 investment rows. Confirmed via production UAT (Pengaturan shows "5 goals" post-re-seed). No drift from CONTEXT.md D-04.
- **Edge Function fetch-prices CORS misconfiguration (pre-existing).** Function allows `kantongpintar.app` but app deploys to `kantongpintar.vercel.app`. Blocks live UAT-2 date verification. Deferred to v1.2.

### Pending Todos

None.

### Blockers/Concerns

None active. Phase 7 cleared all in-flight items.

## Deferred Items (carried + new from Phase 5)

| Category | Item | Status | Severity | Deferred At | Source |
|----------|------|--------|----------|-------------|--------|
| bug | createRecurringTemplate missing user_id → RLS 403 (pre-existing) | candidate-for-Phase-6 | HIGH | 2026-04-25 | v1.0-MILESTONE-AUDIT.md Tech Debt #1 |
| test | Full psql regression `supabase/tests/04-mark-bill-paid.sql` not executed (Docker absent) | blocked-by-environment | MEDIUM | 2026-04-25 | 04-VERIFICATION.md |
| ux | UpcomingBillsPanel AlertDialog body shows only nama bill, missing nominal+tanggal | open (not in v1.1) | cosmetic | 2026-04-25 | 04-UAT.md |
| ux | Net Worth card no auto-refresh post mark-as-paid (by-design) — needs tooltip/helper text | open (not in v1.1) | cosmetic | 2026-04-25 | v1.0-MILESTONE-AUDIT.md |
| test | useMarkBillPaid does not invalidate `['net-worth-snapshots']` query | open (not in v1.1) | INFO | 2026-04-25 | v1.0-MILESTONE-AUDIT.md |
| test | `mapSupabaseError` unit test for plain-object errors not added | open (not in v1.1) | LOW | 2026-04-25 | 04-UAT.md |
| bug | net_worth_snapshots auto-insert fails with 42501 when View-As is active — frontend should skip the snapshot job in View-As mode | candidate-for-v1.2 | LOW | 2026-04-28 | 05-VERIFICATION.md / uat-05-04-console-errors.txt |
| test | SC #3 destructive variant (TRUNCATE allowed_emails + signup) — needs staging mirror to upgrade from PASS-WITH-NOTES (DB-side only) → clean PASS | candidate-for-v1.2 | LOW | 2026-04-28 | 05-VERIFICATION.md |
| infra | Migration history reconciliation — `supabase migration list --linked` shows 0014..0024 as Local-only because `db push` is broken in this project; revisit when staging mirror exists | open | LOW | 2026-04-28 | 05-VERIFICATION.md |
| code | 23 lint errors di src/ pre-existing (badge/button/tabs fast-refresh, csvInvestments/investments any, PensiunTab refs-during-render) | candidate-for-Phase-8 | LOW | 2026-04-25 | 05-handoff |
| cosmetic | D-14 error message raw NUMERIC formatting in withdraw_from_goal — shows `0.00` / `100000000.000...` instead of formatted `Rp 0` / `Rp 100.000.000`. Fix: `REPLACE(TO_CHAR(ROUND(v)::BIGINT,'FM999G999G999'),',','.')` in format() call. Requires Studio hot-patch + migration update. | LOW | 2026-04-29 | 07-VERIFICATION.md |
| infra | Edge Function `fetch-prices` CORS misconfiguration — allows `kantongpintar.app` not `kantongpintar.vercel.app`. Blocks UAT-2 live date param verification. Pre-existing, unrelated to Phase 7. | LOW | 2026-04-29 | 07-08-UAT.md UAT-2 |
| test | UAT-3 fresh-signup variant not executed (no second test email in allowed_emails). Admin-reset variant accepted. pgTAP structural proofs cover idempotency. | LOW | 2026-04-29 | 07-VERIFICATION.md |

## Session Continuity

Last session: 2026-04-29
Stopped at: Phase 7 complete (PASS-WITH-NOTES) — 07-VERIFICATION.md written, UAT 5/5 done, STATE.md + REQUIREMENTS.md updated
Resume command: `/gsd-plan-phase 8`
Phase 7 commits on master: c1783d2 (hotfix withdraw_from_goal) + Wave 1-4 commits (07-01..07-07). Push to origin pending.
Phase 8 artifacts: none yet — run `/gsd-plan-phase 8` to create 08-CONTEXT.md, 08-PLAN.md, etc.
Phase 8 scope: DEV-02 (Recharts type cast), DEV-03 (seed.sql config), DEV-04 (performance note doc) — no DB migrations.
