---
phase: 06-race-atomicity
plan: 04
subsystem: error-mapping
tags: [errors.ts, sqlstate, race-cond, ux-toast, cross-cutting]
requires:
  - "Phase 5 errors.ts SQLSTATE branches (42501, 28000) — landed v1.1 Phase 5"
provides:
  - "errors.ts SQLSTATE 23514 branch — surfaces RACE-02 trigger raise (Total alokasi > 100%) di toast"
  - "errors.ts SQLSTATE P0001 branch — surfaces RACE-03 RPC's verbatim Indonesian message di toast (forward-compatible untuk Phase 7 CONS-01)"
affects:
  - "src/lib/errors.ts mapSupabaseError function"
  - "Indirect: LinkInvestmentDialog.tsx error path (Phase 6 Plan 03 trigger), AddMoneyDialog.tsx withdraw error path (Phase 6 Plan 02 RPC)"
tech_stack_added: []
tech_stack_patterns:
  - "SQLSTATE-first branch ordering (Pitfall 8): exact-code matches sebelum substring matches; cluster all SQLSTATE branches first untuk cheap O(1) lookup, substring branches last untuk ambiguous fallback"
  - "Comment-block per branch (mirror Phase 5 style line 19-20): 1-2 baris jelaskan SQLSTATE meaning + RPC origin"
key_files_created: []
key_files_modified:
  - "src/lib/errors.ts (+12 lines: 2 new SQLSTATE branches + comment blocks)"
decisions:
  - "D-20 honored: 23514 returns hardcoded user-facing summary 'Total alokasi investasi melebihi 100%' (NOT msg) — toast brevity priority over RAISE detail"
  - "D-20 honored: P0001 returns msg apa adanya (RPC owns wording) — forward-compatible dengan Phase 7 CONS-01 split kas/investasi"
  - "Pitfall 8 honored: branches inserted AFTER 28000 block, BEFORE substring branches"
metrics:
  duration: "59s"
  completed_date: "2026-04-29"
  tasks_total: 1
  tasks_completed: 1
  files_changed: 1
  lines_added: 12
  lines_removed: 0
---

# Phase 6 Plan 04: mapSupabaseError SQLSTATE 23514 + P0001 Branches Summary

**One-liner:** Cross-cutting error-mapper wiring untuk Phase 6 race-cond surfaces — SQLSTATE 23514 (check_violation) maps ke user-friendly summary, SQLSTATE P0001 (raise_exception) forwards RPC's verbatim Indonesian message, supaya RACE-02 trigger raises dan RACE-03 RPC raises tampil benar di toast.

## Objective Recap

Tambah dua branch SQLSTATE ke `src/lib/errors.ts` `mapSupabaseError`:

- **`23514`** (check_violation) → returns hardcoded `'Total alokasi investasi melebihi 100%'` (D-20). Surfaces RACE-02 trigger raise dari `enforce_goal_investment_total` (Plan 06-03 trigger).
- **`P0001`** (raise_exception) → returns `msg` (forward verbatim). Surfaces RACE-03 RPC's user-friendly Bahasa Indonesia message (e.g. `'Saldo kas tidak cukup (tersedia Rp 50.000)'`).

**Purpose:** Standalone plan (bukan di-fold ke 06-02 atau 06-03) supaya:

1. Tidak ada merge conflict di `errors.ts` antara dua plan parallel di Wave 1.
2. Plan 06-05 deploy gate punya errors.ts wiring sudah landed di Vercel **sebelum** migrations dipaste — mirror Phase 5 ordering: 05-01 errors.ts branch landed before 05-04 deploy ran.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Insert SQLSTATE 23514 + P0001 branches ke `mapSupabaseError` | `2af1975` | `src/lib/errors.ts` |

## File Diff

```diff
@@ src/lib/errors.ts
   if (code === '28000' || msg === 'Unauthenticated') {
     return 'Sesi habis. Silakan login ulang.'
   }

+  // SQLSTATE 23514 = check_violation — RACE-02 trigger raise (Total alokasi > 100%).
+  // User-facing summary; full RAISE detail tidak diforward untuk toast brevity.
+  if (code === '23514') {
+    return 'Total alokasi investasi melebihi 100%'
+  }
+  // SQLSTATE P0001 = raise_exception — RPC user-friendly Bahasa Indonesia message
+  // (e.g. RACE-03 'Saldo kas tidak cukup (tersedia Rp X)').
+  // Forward msg apa adanya — RPC sudah bertanggung jawab atas wording.
+  if (code === 'P0001') {
+    return msg
+  }
+
   if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
```

**Net change:** +12 lines (10 code + 2 blank separator). Zero lines removed. Existing 42501/28000 branches and substring/fallback chain preserved verbatim.

## Branch Order Confirmation (Pitfall 8)

`grep -n "code === " src/lib/errors.ts`:

```
21:  if (code === '42501' || msg === 'Akses ditolak') {
24:  if (code === '28000' || msg === 'Unauthenticated') {
30:  if (code === '23514') {
36:  if (code === 'P0001') {
```

Substring branches (`Failed to fetch`, `JWT expired`, `violates row-level security`, `unique constraint`/`duplicate key`, `foreign key`) follow at line 40+. Fallback `return msg` at line 55. **Order verified: SQLSTATE-first (42501 → 28000 → 23514 → P0001) → substring → fallback.**

## Verification Evidence

### Automated checks (12/12 PASS)

```
PASS
```

Inline node script asserted all 12 conditions:
- `23514 branch present` ✓
- `23514 returns user summary 'Total alokasi investasi melebihi 100%'` ✓
- `P0001 branch present` ✓
- `P0001 returns msg` ✓
- `order: 28000 before 23514` ✓
- `order: 23514 before substring` ✓
- `order: P0001 before substring` ✓
- `existing 42501 untouched` ✓
- `existing 28000 untouched` ✓
- `fallback preserved` ✓
- `comment block 23514 (mentions check_violation)` ✓
- `comment block P0001 (mentions raise_exception)` ✓

### Manual verification (verification block 1+2)

```bash
# Branch behavior
$ grep -c "Total alokasi investasi melebihi 100%" src/lib/errors.ts
1
$ grep -A 2 "code === 'P0001'" src/lib/errors.ts | grep -c "return msg"
1
```

### TypeScript

```bash
$ npx tsc --noEmit
# exit 0
```

**Clean.** No new TS errors introduced. All 23 pre-existing lint warnings (tracked in deferred items, candidate-for-Phase-8) NOT touched.

## Success Criteria

- [x] `src/lib/errors.ts` has 23514 branch returning `'Total alokasi investasi melebihi 100%'`
- [x] `src/lib/errors.ts` has P0001 branch returning `msg`
- [x] Branch order: 42501 → 28000 → 23514 → P0001 → substring → fallback
- [x] `npx tsc --noEmit` exits 0
- [x] No edits outside `src/lib/errors.ts`
- [x] Single git commit `feat(06-04): RACE-02/03 mapSupabaseError SQLSTATE 23514 + P0001 branches`

## Deviations from Plan

**None — plan executed exactly as written.**

Single-task plan, single Edit, all 12 automated verify checks PASS first try. No Rule 1-4 deviations triggered. No auth gates encountered. No threat-flag-worthy new surface introduced (this plan only routes errors from mitigated RPCs/triggers in 06-01/02/03; threat T-6-13 mitigated per `<threat_model>` via branch order; T-6-12 + T-6-14 disposition `accept` already documented).

## Deploy Sequencing Note

**This plan must land + Vercel-deploy GREEN before Plan 06-05 deploys migrations** to Supabase Cloud, so that:

1. Toast wiring is live before user-facing race scenarios exercised in UAT-3 (RACE-02 LinkInvestment dialog) and UAT-4 (RACE-03 withdraw dialog).
2. If user encounters race during the migration paste window, they see the user-friendly Indonesian toast (`'Total alokasi investasi melebihi 100%'` or RPC's Indonesian message) rather than raw `'new row violates check constraint'` or generic fallback.

This mirrors Phase 5 ordering precedent: Plan 05-01 errors.ts SQLSTATE 42501 branch landed before Plan 05-04 deploy gate.

**Cross-plan dependency:** Plan 06-02 (`withdraw_from_goal` RPC) raises `SQLSTATE P0001`; Plan 06-03 (`enforce_goal_investment_total` trigger) raises `SQLSTATE 23514`. Both produce raw error objects that flow through this Plan 06-04 wiring before reaching `toast.error(mapSupabaseError(e))` in `useWithdrawFromGoal.onError` and `useLinkInvestment.onError` respectively.

## Self-Check: PASSED

**Files claimed exist:**
- `src/lib/errors.ts` — FOUND ✓ (modified, +12 lines, content verified via Read post-Edit)

**Commits claimed exist:**
- `2af1975` — FOUND ✓ in git log on branch `worktree-agent-a5aa9c623aaa18a7d`

**SUMMARY artifact:**
- `.planning/phases/06-race-atomicity/06-04-SUMMARY.md` — about to be written + committed in next step.
