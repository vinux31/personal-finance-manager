# Phase 6: Race & Atomicity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `06-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 06-race-atomicity
**Areas discussed:** Income audit trail, Backfill strategy, DEV-01 TS nextDueDate, Withdraw error semantics, RPC implementation parameters

---

## Income Audit Trail (RACE-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `bill_payments` | Insert income runs ke bill_payments yang sama; comment di migration + PROJECT.md note. Zero schema change, lowest blast radius. Cross-RPC consistency dengan `mark_bill_paid` (idempotency check sama tabel). | ✓ |
| New table `recurring_runs` | Bikin tabel baru clean semantics. +1 migration. Risk: dual-source idempotency cross `mark_bill_paid` ↔ `process_due_recurring`. | |
| Rename `bill_payments` → `recurring_runs` | ALTER TABLE RENAME. Break VIEW + Phase 4 RPC + callsite. Bertentangan zero behavior change. | |

**User's choice:** Reuse `bill_payments` (after analysis request).
**Notes:** User asked "analisa, best option mana" via Other. Provided 3-way trade-off comparison; user agreed dengan Option A. Rename masuk v1.2 backlog kalau dataset/ambiguity ganggu.

---

## Backfill Strategy (RACE-01)

| Option | Description | Selected |
|--------|-------------|----------|
| No backfill | Trust `next_due_date` advance integrity. RPC tidak akan duplikat selama next_due_date ≥ today. Edge case manual edit mundur = accept risk. | ✓ |
| One-time SQL backfill | Migration 0019 INSERT INTO bill_payments SELECT FROM transactions (heuristic JOIN by category_id+amount+user_id). Risk false-positive match ke manual non-recurring entry. | |
| Second-line guard di RPC | Tambah cek IF EXISTS transaction matching date+category+amount. Belt-and-suspenders. Risk: skip legit duplicate (2 makan siang Rp 50k same date). | |

**User's choice:** No backfill.
**Notes:** Edge case "user edit template next_due_date mundur" jadi accepted risk. Catat di SUMMARY post-execution kalau ada lapor.

---

## DEV-01 TS `nextDueDate`

| Option | Description | Selected |
|--------|-------------|----------|
| Kill total | Hapus function dari src/db/recurringTransactions.ts. Zero caller post-RACE-01 (grep verified). Zero parity test perlu. PG single source of truth. | ✓ |
| Keep + parity test sebagai regression guard | Pertahankan TS marked deprecated. Tambah Vitest parity test 8+ cases. Insurance kalau revive future. Trade-off: dead code + test maintenance. | |
| Keep no parity test | Pertahankan apa adanya. Contradicts REQUIREMENTS.md DEV-01 wording. | |

**User's choice:** Kill total.
**Notes:** Pre-decision grep: `nextDueDate` import only di `useProcessRecurring.ts` (akan dihapus). `RecurringDialog.tsx` punya local state variable beda nama. REQUIREMENTS.md DEV-01 satisfied karena clause "jika ada penggunaan TS date math yang tersisa" tidak triggered.

---

## Withdraw Error Semantics (RACE-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Forward-compatible | Phase 6 ship langsung 'Saldo kas tidak cukup (tersedia Rp X)'. SQLSTATE P0001. Konsisten dengan UX direction Phase 7 CONS-01. Zero re-deploy. | ✓ |
| Simple now, refine di Phase 7 | Phase 6 ship 'Saldo tidak cukup (tersedia Rp X)'. Phase 7 update message + view. 2x perubahan RPC dalam 1 milestone. | |
| Generic 'Dana tidak cukup' | Pertahankan existing wording. Worse than current optimistic-lock error karena hilangkan info available balance. | |

**User's choice:** Forward-compatible.
**Notes:** Eksplisit kasih tau user bahwa ini cash-only operation. SQLSTATE P0001 → mapSupabaseError forward .message langsung.

---

## RPC Implementation Parameters

### `p_max_iter` Default

| Option | Description | Selected |
|--------|-------------|----------|
| 12 (Recommended) | Research default. Catch-up 1 tahun monthly templates. User absen >1 tahun rare; manual call dengan override. | ✓ |
| 24 | Defensive 2 tahun. Slight cost negligible. | |
| Configurable, no default cap | Loop sampai due > today. Risk infinite loop. | |

**User's choice:** 12.

### RACE-02 Trigger Error Message

| Option | Description | Selected |
|--------|-------------|----------|
| Detail dengan numbers | `'Total alokasi melebihi 100%% (sudah X%, tambah Y% > 100)'`. SQLSTATE 23514. Actionable info untuk user. | ✓ (per "ur suggest") |
| Generic | `'Total alokasi investasi melebihi 100%'`. No number, simpler. User harus buka tab investasi untuk cek detail. | |

**User's choice:** "ur suggest" — Claude picks. Detail variant chosen — gives user actionable info (existing total + their input).

### Index Naming

| Option | Description | Selected |
|--------|-------------|----------|
| `goal_investments_investment_idx` | Match Postgres convention `<table>_<column>_idx` + match `transactions_date_idx` di codebase. | ✓ (per "ur suggest") |
| `idx_goal_investments_investment_id` | Alt convention `idx_<table>_<column>`. Tidak match existing. | |

**User's choice:** "ur suggest" — Claude picks. `goal_investments_investment_idx` chosen — match existing convention.

### mapSupabaseError Updates

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add 23514 + P0001 branches | SQLSTATE 23514 → 'Total alokasi investasi melebihi 100%', P0001 → forward error.message. Konsisten Phase 5 pattern. | ✓ |
| Skip — forward raw error | Trust RPC RAISE EXCEPTION message. Tidak konsisten Phase 5. | |

**User's choice:** Yes — add 23514 + P0001 branches.

---

## Claude's Discretion

Areas where user said "you decide" or deferred to Claude:
- RACE-02 trigger error message wording (detail variant chosen)
- Index naming convention (`goal_investments_investment_idx` chosen)
- Loop body micro-optimization di `process_due_recurring`
- pgTAP test naming detail
- Decision auto-cap vs manual-fix kalau pre-deploy `goal_investments` violation found (defer ke planner)
- Whether to expose `process_due_recurring` debug/log columns

## Deferred Ideas

Ideas mentioned during discussion but noted for future phases:
- Rename `bill_payments` → `recurring_runs` (v1.2 backlog)
- Backfill `bill_payments` dari historical transactions (v1.2 if user reports)
- Layer 2 server-side enforce View-As CSV (already deferred from v1.1 scope)
- One-time UPDATE backfill `goals.status` post-Phase-7 CONS-01 (Phase 7 scope)
- Income recurring (Gaji) audit trail UI (defer — no UI displays bill_payments for income)
- Goal status `completed` → `active` UX nudge toast (cosmetic)
