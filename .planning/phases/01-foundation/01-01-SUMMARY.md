---
phase: 01-foundation
plan: 01
subsystem: db/recurring
tags: [bugfix, date-arithmetic, typescript, tdd]
dependency_graph:
  requires: []
  provides: [nextDueDate-monthly-clamp]
  affects: [phase-3-bills-display, phase-4-mark-as-paid]
tech_stack:
  added: []
  patterns: [mutation-only-date-clamping, setDate(1)-before-setMonth]
key_files:
  created:
    - scripts/test-nextDueDate.mjs
  modified:
    - src/db/recurringTransactions.ts
decisions:
  - "Mutation-only clamping: setDate(1) then setMonth() then Math.min(d, lastDay) — const date stays const, no let reassignment"
  - "lastDay computed with new Date(year, targetMonth+1, 0).getDate() using post-setMonth year for correct Dec->Jan rollover"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-04-24"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
  files_created: 1
requirements_satisfied:
  - FOUND-01
---

# Phase 01 Plan 01: Fix nextDueDate Month-End Overflow Summary

**One-liner:** Mutation-only 4-step Date clamping (setDate(1) + setMonth + Math.min lastDay) fixes monthly overflow for day-31 and day-30 recurring bills.

## What Was Built

Fixed the `nextDueDate()` function's `monthly` case in `src/db/recurringTransactions.ts`. The buggy single-line `date.setMonth(date.getMonth() + 1)` was replaced with a 4-step mutation block:

1. `date.setDate(1)` — resets day to 1 to prevent `setMonth` overflow
2. `date.setMonth(targetMonth)` — advances month safely (day=1 is always valid)
3. `new Date(date.getFullYear(), targetMonth + 1, 0).getDate()` — computes last day of target month (uses post-setMonth year for correct Dec→Jan year rollover)
4. `date.setDate(Math.min(d, lastDay))` — clamps original day `d` to the target month's last valid day

The `const date` variable was preserved as `const` — all operations are mutations via `.setDate()` and `.setMonth()`, no reassignment.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix monthly case with mutation-only clamping | a87bfe3 | src/db/recurringTransactions.ts |
| TDD RED | Failing tests for month-end overflow | 572c868 | scripts/test-nextDueDate.mjs |

## TDD Gate Compliance

- RED gate: `test(01-01)` commit 572c868 — 4 test cases confirmed failing before fix
- GREEN gate: `fix(01-01)` commit a87bfe3 — all 8 test cases pass after fix
- REFACTOR gate: Not needed — implementation was clean on first pass

## Test Results (Post-Fix)

All 6 plan-specified cases + 2 regression cases pass:

| Input | Frequency | Result | Notes |
|-------|-----------|--------|-------|
| 2024-01-31 | monthly | 2024-02-29 | Leap year clamp |
| 2025-01-31 | monthly | 2025-02-28 | Non-leap clamp |
| 2024-03-31 | monthly | 2024-04-30 | April 30-day clamp |
| 2024-05-31 | monthly | 2024-06-30 | June 30-day clamp |
| 2024-12-31 | monthly | 2025-01-31 | Year rollover, no clamp |
| 2024-01-15 | monthly | 2024-02-15 | Day <= 28, no clamp |
| 2024-01-15 | daily | 2024-01-16 | Regression guard |
| 2024-01-15 | weekly | 2024-01-22 | Regression guard |

## Deviations from Plan

None — plan executed exactly as written. The exact code block from PLAN.md action section was applied verbatim. The verify command from the plan would fail due to `import.meta.env` in supabase.ts when run with tsx; verification was performed using an equivalent node inline script and the dedicated test file.

## Known Stubs

None — this plan modifies a pure utility function with no UI surface.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. `nextDueDate()` is a pure function — no I/O. Threat register T-01-02 (DoS via infinite loop) is mitigated: the 4-step mutation pattern has finite bounded operations with no loops. No new threat flags.

## Self-Check

- [x] src/db/recurringTransactions.ts modified — confirmed via git diff
- [x] scripts/test-nextDueDate.mjs created — file exists
- [x] Commit 572c868 (RED) — confirmed in git log
- [x] Commit a87bfe3 (GREEN) — confirmed in git log
- [x] TypeScript compilation clean (`npx tsc --noEmit` exit 0)
- [x] All 8 test cases pass

## Self-Check: PASSED
