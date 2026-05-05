---
phase: 06-race-atomicity
plan: 03
subsystem: database
tags: [postgres, supabase, plpgsql, rpc, security-definer, for-update, race-condition, react-query, typescript]

# Dependency graph
requires:
  - phase: 06-race-atomicity
    provides: "Pattern map (06-PATTERNS.md) — withdraw_from_goal mirrors add_money_to_goal (0006:225-261) + FOR UPDATE pattern from mark_bill_paid (0014:72-77)"
  - phase: 05-security
    provides: "ERRCODE convention (28000 unauthenticated, P0001 raise_exception, 42501 access denied) and SECURITY DEFINER lessons (0017+0018 — explicit DROP FUNCTION on signature change)"
  - phase: 04-bills (v1.0)
    provides: "Canonical mark_bill_paid RPC pattern (0014) — SECURITY DEFINER + search_path + auth guard + FOR UPDATE row lock + GRANT EXECUTE"
provides:
  - "Atomic withdraw_from_goal(BIGINT, NUMERIC) RPC — eliminates client-side optimistic-lock race (M-02 from REVIEW-2026-04-27)"
  - "DB-side FOR UPDATE row lock serializes concurrent withdraws (T-6-08 mitigation)"
  - "SQLSTATE P0001 + Indonesian saldo error contract (D-10) — forward-compatible with Phase 7 CONS-01 cash/investasi split"
  - "Status flip semantics: completed→active when balance<target; paused stays; active stays (D-11)"
  - "TS withdrawFromGoal(id, amount) signature mirroring addMoneyToGoal — RPC wrapper pattern reusable"
  - "pgTAP integration test 06-withdraw-from-goal.sql with 8 scenarios + logical FOR UPDATE proof"
affects: [phase-7-ui-consistency, phase-6-05-deploy, phase-6-04-ts-cleanup]

# Tech tracking
tech-stack:
  added: []  # No new libraries; uses existing PostgreSQL + Supabase RPC + react-query
  patterns:
    - "withdraw_from_goal RPC mirrors add_money_to_goal (inverse) plus FOR UPDATE row lock — direct copy-and-adapt per phase doctrine 'konvergensi ke mark_bill_paid'"
    - "SQLSTATE P0001 + Indonesian message contract for user-facing recoverable errors; mapSupabaseError forwards msg verbatim"
    - "Self-action RPCs omit p_uid param (auth.uid() only) — admin View-As impersonation handled via JWT 'sub' switching in client (D-12)"
    - "TS RPC wrapper pattern: 5-line body (precondition → .rpc() → error throw → return data[0] cast)"
    - "react-query mutation input type matches RPC param shape exactly — drops legacy client-side aggregate args"

key-files:
  created:
    - "supabase/migrations/0020_withdraw_from_goal.sql — Atomic withdraw RPC, SECURITY DEFINER + FOR UPDATE + P0001 + status flip"
    - "supabase/tests/06-withdraw-from-goal.sql — pgTAP integration test, 8 PASS scenarios + 1 logical FOR UPDATE proof"
  modified:
    - "src/db/goals.ts — withdrawFromGoal reduced from 21-line optimistic-lock body to 5-line RPC wrapper; signature drops goal: Goal param"
    - "src/queries/goals.ts — useWithdrawFromGoal mutation input type drops goal: Goal field; mutationFn 2-arg call"
    - "src/components/AddMoneyDialog.tsx line 50 — single-line patch dropping goal arg from mutateAsync"

key-decisions:
  - "Mirror add_money_to_goal exactly (same RETURNS TABLE shape, same precondition, same NOT FOUND raise) — only add FOR UPDATE + inverse arithmetic + status flip (D-11) + P0001 for insufficient (D-10)"
  - "No p_uid param: withdraw is always self-action; documented in migration header (per D-12). Phase 7 admin-action RPCs may revisit"
  - "Drop client-side optimistic lock entirely — DB-side FOR UPDATE on goals row serializes concurrent withdraws, no need for current_amount equality check"
  - "Toast wording 'Dana berhasil ditarik' preserved verbatim — Phase 6 is defensive only, no UX copy change"
  - "Migration NOT applied to live DB during this plan — deferred to Plan 06-05 (canonical Studio paste channel per memory project_supabase_migration_workflow.md)"

patterns-established:
  - "Inverse-mirror in same file: withdrawFromGoal mirrors addMoneyToGoal (db/goals.ts) + useWithdrawFromGoal mirrors useAddMoneyToGoal (queries/goals.ts)"
  - "pgTAP scenario 'foreign goal IDOR' — caller v_uid attempts withdraw on v_uid_other's goal_id, asserts 'Goal tidak ditemukan' raise (T-6-10 belt-and-suspenders, RLS-equivalent test)"
  - "Logical-proof scenario via pg_get_functiondef LIKE '%FOR UPDATE%' — verifies row-lock presence without needing concurrent-session orchestration"

requirements-completed: [RACE-03]

# Metrics
duration: 4min
completed: 2026-04-29
---

# Phase 6 Plan 3: RACE-03 withdraw_from_goal Atomic RPC Summary

**Replaced client-side optimistic-lock withdrawFromGoal with atomic SECURITY DEFINER RPC using FOR UPDATE row lock, SQLSTATE P0001 saldo error, and D-11 status flip — closes M-02 race window from REVIEW-2026-04-27.**

## Performance

- **Duration:** ~4 min (223s wall clock)
- **Started:** 2026-04-29T00:20:06Z
- **Completed:** 2026-04-29T00:23:49Z
- **Tasks:** 3 (all auto, all TDD-flavored)
- **Files modified:** 5 (2 created, 3 refactored)

## Accomplishments

- **Race window eliminated.** Old TS body: SELECT current_amount → UPDATE WHERE current_amount = old. Two concurrent withdraws could pass the check between SELECT and UPDATE, second producing negative balance. New RPC: FOR UPDATE inside transaction — tx2 blocks until tx1 COMMIT, then re-reads new balance and either succeeds or raises P0001 with eksplisit saldo. Verified by Task 2 scenario 8 logical proof.
- **Status flip D-11 enforced atomically with balance update.** `completed AND new<target → active`; `paused stays`; `active stays`. Single UPDATE statement under row lock — no client-side reconciliation possible.
- **Indonesian error contract forward-compatible with Phase 7.** Message includes "kas" qualifier ("Saldo kas tidak cukup") so when CONS-01 splits cash vs investasi, message remains accurate without copy change.
- **Belt-and-suspenders IDOR mitigation.** `WHERE id = p_id AND user_id = v_uid` filter inside SECURITY DEFINER body — even though RLS would also block, explicit filter makes T-6-10 mitigation obvious in code review.
- **Threat register fully covered:** T-6-08 (race), T-6-10 (IDOR), T-6-11 (zero-amount tampering) all mitigated by code in Task 1 + asserted by Task 2 tests. T-6-09 (info disclosure of own balance) accepted per plan.

## Task Commits

Each task was committed atomically with --no-verify (parallel-executor mode):

1. **Task 1: Migration 0020_withdraw_from_goal.sql** — `def152c` (feat)
2. **Task 2: pgTAP test 06-withdraw-from-goal.sql** — `d45311c` (test)
3. **Task 3: TS refactor (db/goals.ts + queries/goals.ts + AddMoneyDialog.tsx)** — `31e0f07` (refactor)

**Plan metadata commit:** Pending after this SUMMARY write.

## Files Created/Modified

- **Created** `supabase/migrations/0020_withdraw_from_goal.sql` — 76 lines. SECURITY DEFINER RPC with auth guard (28000), amount precondition, FOR UPDATE row lock on goals, NOT FOUND raise, P0001 saldo raise, D-11 status CASE, GRANT EXECUTE TO authenticated. Header includes signature-change DROP FUNCTION reminder (Phase 5 lesson per STATE.md).
- **Created** `supabase/tests/06-withdraw-from-goal.sql` — 188 lines. BEGIN/ROLLBACK wrapper, SET LOCAL row_security=off, auth.users SKIP fallback, JWT claim switching. 8 scenarios: happy path, completed→active flip, paused stays, active stays, P0001 saldo (BOTH SQLSTATE AND msg LIKE), zero amount, foreign goal IDOR, FOR UPDATE logical proof.
- **Modified** `src/db/goals.ts` — `withdrawFromGoal` body lines 106-126: reduced from 21-line optimistic-lock implementation to 5-line RPC wrapper. Signature changed `(id, amount, goal: Goal): Promise<void>` → `(id, amount): Promise<{ current_amount, status }>`. Mirrors `addMoneyToGoal` (lines 94-99) exactly.
- **Modified** `src/queries/goals.ts` — `useWithdrawFromGoal` lines 79-90: mutation input type `{ id, amount, goal }` → `{ id, amount }`. mutationFn drops 3rd arg. Toast wording `'Dana berhasil ditarik'` and `onError: toast.error(mapSupabaseError(e))` PRESERVED.
- **Modified** `src/components/AddMoneyDialog.tsx` line 50 — single-line patch. `withdraw.mutateAsync({ id: goal.id, amount, goal })` → `withdraw.mutateAsync({ id: goal.id, amount })`. All other usages of `goal` variable (lines 39, 58, 61, 73, 74) intact.

## Compliance with 06-PATTERNS.md migration 0020 checklist

| Check | Status |
|-------|--------|
| `v_uid := auth.uid()` (NO COALESCE — no admin View-As) | PASS |
| Auth guard 28000 (1 guard, not 2 — no access guard since no p_uid) | PASS |
| `p_amount <= 0` precondition raise (mirror 0006:239-241) | PASS |
| `FOR UPDATE` row lock before reading goal (NEW vs add_money_to_goal) | PASS |
| `IF NOT FOUND THEN RAISE 'Goal tidak ditemukan'` | PASS |
| Insufficient saldo raise with `SQLSTATE 'P0001'` + Indonesian + saldo `Rp %` | PASS |
| Status transition D-11: completed→active when new<target; paused stays; active stays | PASS |
| `RETURN TABLE (current_amount NUMERIC, status TEXT)` matches `add_money_to_goal` shape | PASS |
| `GRANT EXECUTE ... TO authenticated` with full `(BIGINT, NUMERIC)` signature | PASS |
| Header includes signature-change DROP FUNCTION reminder | PASS |
| Header includes "No p_uid param" comment block (D-12 deviation explanation) | PASS |

## Compliance with 06-PATTERNS.md test 06-withdraw-from-goal checklist

| Check | Status |
|-------|--------|
| Same preamble structure as 04-mark-bill-paid (BEGIN/ROLLBACK + SET LOCAL row_security) | PASS |
| Scenario 1: happy path withdraw 30k from 100k, status unchanged | PASS |
| Scenario 2: completed → active flip with verify v_balance + v_status | PASS |
| Scenario 3: paused stays paused (locks D-11) | PASS |
| Scenario 4: active stays active (locks D-11) | PASS |
| Scenario 5: insufficient saldo with `SQLSTATE = 'P0001'` AND `SQLERRM LIKE '%Saldo kas tidak cukup%'` | PASS |
| Scenario 6: amount <= 0 raises 'Jumlah harus > 0' | PASS |
| Scenario 7: foreign user goal raises 'Goal tidak ditemukan' (added 2nd auth.users seed) | PASS |
| Scenario 8: race serialization logical-proof (pg_get_functiondef LIKE '%FOR UPDATE%') | PASS |
| Closing `\echo` block + ROLLBACK | PASS |
| ≥ 7 PASS notices target | PASS (9 PASS labels) |

## Decisions Made

None new — followed plan's D-10..D-12 exactly:
- D-10 P0001 + Indonesian saldo: implemented verbatim
- D-11 status flip (3 branches): implemented verbatim, all 3 covered by Tasks 2 scenarios 2/3/4
- D-12 drop `goal: Goal` param: implemented; AddMoneyDialog only callsite touched (GoalsTab.tsx confirmed not a callsite per RESEARCH §358)

## Deviations from Plan

None — plan executed exactly as written.

**Note on plan-level `<verification>` regex:** The plan's free-form structural-check regex on line 561 has the order of `'Saldo kas tidak cukup'` and `ERRCODE = 'P0001'` reversed relative to the actual emitted SQL form (`RAISE EXCEPTION 'Saldo kas tidak cukup ...' USING ERRCODE = 'P0001'` — message always precedes the USING clause in PostgreSQL syntax). This is a typo in the planner's verification spot-check, NOT a deviation in the implementation. The Task 1 `<verify>` block (13 individual substring checks) PASSED, confirming both substrings are present and used correctly. Implementation matches `add_money_to_goal` precedent and 06-PATTERNS.md §"0020" SQL skeleton verbatim. Documented here for the next executor; no action needed.

## Issues Encountered

**SUMMARY.md initial write went to parent-repo path.** First Write call for SUMMARY.md targeted `pfm-web/.planning/...` instead of the worktree's `.claude/worktrees/agent-ab8460a366b995679/.planning/...`. Detected via post-write `ls` self-check (file missing in worktree). Removed the misplaced file from the parent repo and re-wrote to the correct worktree absolute path. No commits affected — the parent repo's `.planning/` is not staged in this worktree's git index. Lesson for future executor: when working in a worktree, ALL writes including SUMMARY.md must use the worktree's absolute path prefix.

## User Setup Required

None — no environment variable / external service configuration. Migration application to live DB is deferred to Plan 06-05 (canonical Studio paste channel per project memory `project_supabase_migration_workflow.md` — `db push` is broken in this project).

## Next Phase Readiness

- **For Plan 06-04 (DEV-01 nextDueDate cleanup):** Independent — no dependency on 06-03 artifacts. Can run in parallel within Wave 1.
- **For Plan 06-05 (deploy + UAT):** This plan delivers migration `0020_withdraw_from_goal.sql` ready to paste; pgTAP test ready to run via Studio SQL Editor. UAT-4 (2 tabs simultaneously withdraw Rp 50k each from goal current=100k) and UAT-5 (completed goal withdraw Rp 1 → status flip to active) wired to the artifacts produced here.
- **For Phase 7 CONS-01:** TS `withdrawFromGoal` signature now matches `addMoneyToGoal`, enabling parallel future RPC `withdraw_from_goal_v2` (cash + investasi split) without breaking callers.

## Self-Check: PASSED

Files exist (worktree-relative):
- FOUND: `supabase/migrations/0020_withdraw_from_goal.sql`
- FOUND: `supabase/tests/06-withdraw-from-goal.sql`
- FOUND: `src/db/goals.ts` (modified)
- FOUND: `src/queries/goals.ts` (modified)
- FOUND: `src/components/AddMoneyDialog.tsx` (modified)
- FOUND: `.planning/phases/06-race-atomicity/06-03-SUMMARY.md` (this file, after path correction)

Commits exist (verified via `git log`):
- FOUND: `def152c` (Task 1: feat 0020 migration)
- FOUND: `d45311c` (Task 2: test pgTAP integration)
- FOUND: `31e0f07` (Task 3: refactor TS callsites)

Verification gates passed:
- All 13 Task 1 verify checks: PASS
- All 12 Task 2 verify checks: PASS (9 PASS labels in test ≥ 7 target)
- All 12 Task 3 verify checks: PASS
- `npx tsc --noEmit` exit 0: PASS
- Plan-level overall verification (5 of 5 spot-checks): PASS

---
*Phase: 06-race-atomicity*
*Plan: 03*
*Completed: 2026-04-29*
