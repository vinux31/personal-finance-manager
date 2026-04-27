---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Hardening & Consistency
status: defining-requirements
stopped_at: Milestone v1.1 started — research running before REQUIREMENTS
last_updated: "2026-04-27T00:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Pengguna bisa melihat gambaran lengkap kondisi keuangan mereka dalam satu tempat, dengan kalkulasi yang relevan untuk konteks Indonesia.
**Current focus:** v1.1 Hardening & Consistency — defining requirements (post-REVIEW-2026-04-27 audit)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Research running, REQUIREMENTS pending
Last activity: 2026-04-27 — Milestone v1.1 started after audit found 22 issues (3 Critical / 6 High / 7 Medium scoped in)

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

### Pending Todos

None.

### Blockers/Concerns

- (none — v1.1 baru mulai)

## Deferred Items (carried from v1.0 — review for v1.1 inclusion)

| Category | Item | Status | Severity | Deferred At | Source |
|----------|------|--------|----------|-------------|--------|
| bug | createRecurringTemplate missing user_id → RLS 403 (pre-existing) | **considering for v1.1** | HIGH | 2026-04-25 | v1.0-MILESTONE-AUDIT.md Tech Debt #1 |
| test | Full psql regression `supabase/tests/04-mark-bill-paid.sql` not executed (Docker absent) | blocked-by-environment | MEDIUM | 2026-04-25 | 04-VERIFICATION.md |
| ux | UpcomingBillsPanel AlertDialog body shows only nama bill, missing nominal+tanggal | open | cosmetic | 2026-04-25 | 04-UAT.md |
| ux | Net Worth card no auto-refresh post mark-as-paid (by-design) — needs tooltip/helper text | open | cosmetic | 2026-04-25 | v1.0-MILESTONE-AUDIT.md |
| test | useMarkBillPaid does not invalidate `['net-worth-snapshots']` query | open | INFO | 2026-04-25 | v1.0-MILESTONE-AUDIT.md |
| test | `mapSupabaseError` unit test for plain-object errors not added | open | LOW | 2026-04-25 | 04-UAT.md |

## Session Continuity

Last session: 2026-04-27 — Milestone v1.1 started
Stopped at: Defining requirements (research running)
Resume file: None
