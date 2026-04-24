---
phase: 03-bills-display
plan: "01"
subsystem: data-layer
tags: [supabase, tanstack-query, recurring-transactions, bills]
dependency_graph:
  requires: []
  provides: [listUpcomingBills, useUpcomingBills]
  affects: [src/db/recurringTransactions.ts, src/queries/recurringTransactions.ts]
tech_stack:
  added: []
  patterns: [useQuery+useTargetUserId pattern, useMemo for stable endOfMonth string]
key_files:
  created: []
  modified:
    - src/db/recurringTransactions.ts
    - src/queries/recurringTransactions.ts
decisions:
  - "endOfMonth computed via new Date(year, month+1, 0) component constructor — avoids string-parse timezone issues (Pitfall 4)"
  - "useMemo with empty dep array prevents re-render loop from string identity change on every render"
  - "uid parameter typed as string|undefined (not optional uid?) to match explicit call-site contract"
  - "DB-side sort by next_due_date — no client-side sort needed in Plan 02"
metrics:
  duration: "~5m"
  completed: "2026-04-24"
  tasks: 2
  files: 2
---

# Phase 03 Plan 01: Bills Data Layer Summary

Supabase query function and TanStack Query hook for upcoming bills — filtered to is_active=true, type=expense, next_due_date <= end of current month.

## What Was Built

**Task 1 — `listUpcomingBills` in `src/db/recurringTransactions.ts`** (commit ffeffa3)

Appended async function with three filter predicates in required order: `.eq('is_active', true)`, `.eq('type', 'expense')`, `.lte('next_due_date', endOfMonth)`, sorted ascending by `next_due_date`. The uid guard mirrors the existing `listRecurringTemplates` pattern. Returns `Promise<RecurringTemplate[]>` reusing the existing type.

**Task 2 — `useUpcomingBills` in `src/queries/recurringTransactions.ts`** (commit 9b3c784)

Appended hook using `useTargetUserId()` + `useQuery` pattern. `endOfMonth` computed via `useMemo` with `new Date(year, month+1, 0)` local-midnight construction and `padStart(2,'0')` formatting. Query key `['upcoming-bills', uid, endOfMonth]` scopes cache per user and per month. Added `useMemo` import from `react` and `listUpcomingBills` to the existing `@/db/recurringTransactions` import.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `listUpcomingBills` Supabase query is covered by the existing `recurring_templates` RLS policy (`auth.uid() = user_id`). T-03-01 through T-03-06 from the plan's threat model are all addressed as documented.

## Self-Check: PASSED

- src/db/recurringTransactions.ts: FOUND
- src/queries/recurringTransactions.ts: FOUND
- Commit ffeffa3 (Task 1): FOUND
- Commit 9b3c784 (Task 2): FOUND
