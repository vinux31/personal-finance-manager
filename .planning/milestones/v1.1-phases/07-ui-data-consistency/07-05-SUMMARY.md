---
phase: 07-ui-data-consistency
plan: "05"
subsystem: frontend-goals-seed
tags: [goals, seed, rpc, view, localstorage, ux]
dependency_graph:
  requires: [07-04]
  provides: [useGoalsWithProgress, seed_rencana-wiring, reset_rencana_marker-wiring, investedValue-prop]
  affects: [GoalsTab, AddMoneyDialog, SettingsTab, useRencanaInit]
tech_stack:
  added: []
  patterns: [RPC-call-wrapper-Pattern-E, goals_with_progress-VIEW-read, dual-queryKey-invalidation]
key_files:
  created: []
  modified:
    - src/lib/useRencanaInit.ts
    - src/db/goals.ts
    - src/db/investments.ts
    - src/queries/goals.ts
    - src/components/AddMoneyDialog.tsx
    - src/tabs/GoalsTab.tsx
    - src/tabs/SettingsTab.tsx
decisions:
  - "D-04: RENCANA seed data lives in SQL function body only — JS constants + seedRencana* functions removed"
  - "D-06: seed_rencana RPC return value (bool) ignored — false means already seeded, silent no-op"
  - "D-07.3/D-07.4/D-07.5: doResetSeed extended with reset_rencana_marker RPC + per-user LS key + legacy cleanup"
  - "D-08: localStorage per-user fast-path cache preserved, RPC as authoritative fallback"
  - "D-09 read-side: GoalsTab queries goals_with_progress VIEW via useGoalsWithProgress hook"
  - "D-15: AddMoneyDialog withdraw mode shows kas + investasi breakdown from VIEW total_amount"
  - "Rule 1 auto-fix: removed unused RENCANA_*_NAMES imports from db/goals.ts + db/investments.ts after seed functions deleted"
  - "Rule 1 auto-fix: useRencanaInit .catch() chain replaced with void operator — supabase.rpc() returns PromiseLike not full Promise"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-29"
  tasks_completed: 2
  files_modified: 7
---

# Phase 7 Plan 05: Frontend Goals/Seed Wiring Summary

**One-liner:** Goals UI wired to `goals_with_progress` VIEW for `total_amount`-based progress; seed flow refactored to call `seed_rencana` RPC with per-user localStorage cache; `doResetSeed` extended with `reset_rencana_marker` RPC + UX-01 localStorage fix.

## What Was Built

### Task 1 — Seed flow refactor (CONS-03 + UX-01)

- `src/lib/useRencanaInit.ts`: Full rewrite. Now calls `supabase.rpc('seed_rencana', { p_uid: null })` with per-user localStorage fast-path key `rencana_seeded_${user.id}`. Removed all references to `seedRencanaGoals` / `seedRencanaInvestments`.
- `src/db/goals.ts`: Removed `RENCANA_GOALS` const + `seedRencanaGoals` export. Also removed now-unused `RENCANA_GOAL_NAMES` import (auto-fix Rule 1 — SettingsTab imports directly from `@/lib/rencanaNames`).
- `src/db/investments.ts`: Removed `RENCANA_INVESTMENTS` const + `seedRencanaInvestments` export. Also removed now-unused `RENCANA_INVESTMENT_NAMES` import (auto-fix Rule 1).
- `src/tabs/SettingsTab.tsx`: `doResetSeed` extended with:
  - `supabase.rpc('reset_rencana_marker')` (D-07.3)
  - `localStorage.removeItem(\`rencana_seeded_${user.id}\`)` (D-07.4 — UX-01 fix)
  - `localStorage.removeItem('rencana_seeded')` (D-07.5 — legacy global key one-shot cleanup)
  - `mapSupabaseError(e)` in catch (replaces generic 'Gagal mereset seed.' toast)
  - Added `import { supabase } from '@/lib/supabase'`

### Task 2 — Goals VIEW wiring + AddMoneyDialog investedValue (CONS-01 + D-15)

- `src/queries/goals.ts`:
  - New `export interface GoalWithProgress extends Goal { total_amount: number }`
  - New `export function useGoalsWithProgress(filters)` — queries `goals_with_progress` VIEW, queryKey `['goals-with-progress', uid, filters]`
  - All 5 mutation hooks (`useCreateGoal`, `useUpdateGoal`, `useDeleteGoal`, `useAddMoneyToGoal`, `useWithdrawFromGoal`) now invalidate BOTH `['goals']` AND `['goals-with-progress']` (T-07-21 mitigation)
  - `goals-with-progress` appears 6 times total (1 in hook + 5 in mutation invalidations)
- `src/components/AddMoneyDialog.tsx`:
  - Added `investedValue?: number` to Props interface (D-15)
  - `DialogDescription` in withdraw mode now shows: `Saldo kas tersedia: Rp X (terpisah dari investasi Rp Y)` when `investedValue !== undefined && investedValue > 0`; backwards-compatible when no linked investment
- `src/tabs/GoalsTab.tsx`:
  - Switched data source from `useGoals` to `useGoalsWithProgress` for all display
  - Progress bar uses `g.total_amount` (cash + investment market value via VIEW)
  - Summary bar `totalCollected` uses `g.total_amount` directly
  - `investedAmount = Math.max(0, g.total_amount - g.current_amount)` for breakdown display
  - `investedValue` computed from `addMoneyFor.total_amount - addMoneyFor.current_amount`, passed to `<AddMoneyDialog>`
  - State type changed to `GoalWithProgress | null` for `addMoneyFor`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused RENCANA_*_NAMES imports after seed function removal**
- **Found during:** Task 1 TypeScript check
- **Issue:** After `seedRencanaGoals` and `seedRencanaInvestments` were deleted, their `RENCANA_GOAL_NAMES` / `RENCANA_INVESTMENT_NAMES` imports in `db/goals.ts` and `db/investments.ts` became unused → TypeScript TS6133 error
- **Fix:** Removed both unused imports. SettingsTab already imports these directly from `@/lib/rencanaNames` — no behavior change
- **Files modified:** `src/db/goals.ts`, `src/db/investments.ts`
- **Commit:** `0e785f9`

**2. [Rule 1 - Bug] Fixed PromiseLike `.catch()` chain in useRencanaInit**
- **Found during:** Task 1 TypeScript check
- **Issue:** `supabase.rpc()` returns `PromiseLike<void>` (not full `Promise`) — TypeScript TS2339 error on `.catch()` chain; also TS7006 implicit `any` on `err` parameter
- **Fix:** Changed to `void supabase.rpc(...).then(...)` pattern (drop `.catch()`, use `void` operator to suppress floating promise lint). Error handling moved into `.then()` body with early return on `error`. Per PATTERNS.md Pattern E analog.
- **Files modified:** `src/lib/useRencanaInit.ts`
- **Commit:** `0e785f9`

**3. [Rule 1 - Note] RENCANA_GOAL_NAMES import NOT retained in db/goals.ts**
- The plan said "RENCANA_GOAL_NAMES import MUST be retained" — but this was based on the assumption that `SettingsTab` imported it from `db/goals.ts`. Actual code: `SettingsTab.tsx:17` imports `RENCANA_GOAL_NAMES` directly from `@/lib/rencanaNames`. The import in `db/goals.ts` was only needed by `seedRencanaGoals` (now deleted). Removing it was correct — retaining it would have caused a TS6133 error.

## Threats Addressed

| Threat ID | Status | Notes |
|-----------|--------|-------|
| T-07-19 | Mitigated | Per-user `rencana_seeded_${user.id}` localStorage key implemented in both useRencanaInit + doResetSeed |
| T-07-20 | Mitigated | Legacy `'rencana_seeded'` global key removed in doResetSeed (D-07.5) |
| T-07-21 | Mitigated | All 5 mutation hooks invalidate both `['goals']` and `['goals-with-progress']` |
| T-07-22 | Accepted | investedValue sourced from RLS-scoped VIEW — no cross-user disclosure |

## Decisions Implemented

D-04, D-06, D-07, D-07.3, D-07.4, D-07.5, D-08, D-09 (read-side), D-15

## Unchanged Callsites

- `src/db/goals.ts:addMoneyToGoal` — RPC name + signature identical post-0024 migration (D-13). No rename needed.
- `src/db/goals.ts:withdrawFromGoal` — unchanged.
- `GoalsTab.tsx` write paths (GoalDialog, LinkInvestmentDialog) — still use base `goals` table hooks (useCreateGoal, useUpdateGoal, useDeleteGoal).

## Build Status

- `tsc -b`: exits 0 (no type errors)
- `vite build`: exits 0, 2772 modules transformed (pre-existing chunk size warning, not new)

## Wave 4 Sibling Plan Conflicts

Zero file conflicts with sibling Wave 4 plans:
- `07-06`: modifies `eslint.config.js` + `src/queries/investments.ts` — no overlap
- `07-07`: modifies `src/tabs/TransactionsTab.tsx` + `src/tabs/InvestmentsTab.tsx` — no overlap

## Next Steps

Plan `07-08` will perform browser-MCP UAT (UAT-1..UAT-5) against live Vercel deploy after Wave 4 results are merged to master.

## Known Stubs

None — all data is wired to live Supabase queries (VIEW `goals_with_progress` live post-07-04 migrations).

## Self-Check

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/lib/useRencanaInit.ts | FOUND |
| src/db/goals.ts | FOUND |
| src/db/investments.ts | FOUND |
| src/queries/goals.ts | FOUND |
| src/components/AddMoneyDialog.tsx | FOUND |
| src/tabs/GoalsTab.tsx | FOUND |
| src/tabs/SettingsTab.tsx | FOUND |
| .planning/phases/07-ui-data-consistency/07-05-SUMMARY.md | FOUND |
| commit 4ce3913 (Task 1) | FOUND |
| commit 0e785f9 (Task 2) | FOUND |
