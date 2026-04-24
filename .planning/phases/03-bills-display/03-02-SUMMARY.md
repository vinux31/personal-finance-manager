---
phase: 03-bills-display
plan: "02"
subsystem: ui
tags: [react, tanstack-query, tailwind, rupiah, urgency-coloring, dashboard]
dependency_graph:
  requires:
    - phase: 03-01
      provides: [useUpcomingBills, listUpcomingBills, RecurringTemplate type]
  provides:
    - UpcomingBillsPanel component (urgency dots + Sisa Aman summary)
    - Dashboard row 3 "Tagihan Bulan Ini" full-width panel
  affects: [src/tabs/DashboardTab.tsx, src/components/UpcomingBillsPanel.tsx]
tech_stack:
  added: []
  patterns:
    - "Content-only component wrapped by parent Panel shell (Pitfall 5 avoidance)"
    - "Urgency classification via local-midnight dayDiff helper — no date-fns"
    - "useMemo with [bills] dep for totalBills derived value"
    - "Conditional max-h-64 overflow-y-auto scroll on ul when bills.length > 6"
key_files:
  created:
    - src/components/UpcomingBillsPanel.tsx
  modified:
    - src/tabs/DashboardTab.tsx
key_decisions:
  - "UpcomingBillsPanel is a content-only component — DashboardTab wraps it in local Panel shell (Panel is non-exported)"
  - "dayDiff uses new Date(y, m-1, d) component constructor — avoids UTC midnight offset bug on WIB/UTC+7"
  - "Sisa Aman = income - expense - totalBills, colored red when negative (D-12)"
  - "Empty state renders panel with message (never null) per D-12"
  - "income and expense received as props from DashboardTab monthly useMemo — no second useAggregateByPeriod call (D-08)"
requirements_completed: [BILL-01, BILL-02, BILL-04, NAV-02]
metrics:
  duration: "~10m (prior session)"
  completed: "2026-04-24"
  tasks: 3
  files: 2
---

# Phase 03 Plan 02: Bills UI + Dashboard Integration Summary

UpcomingBillsPanel component with red/yellow/gray urgency dots, due-date sub-text, and Sisa Aman summary integrated as full-width Dashboard row 3.

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-24T00:00:00Z
- **Completed:** 2026-04-24
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint — approved)
- **Files modified:** 2

## Accomplishments

- Created `src/components/UpcomingBillsPanel.tsx` with three urgency tiers (overdue/soon/later), due-date copy strings (terlambat/jatuh tempo hari ini/besok/N hari lagi), and Sisa Aman summary row
- Inserted Dashboard row 3 in `src/tabs/DashboardTab.tsx` — full-width `<Panel title="Tagihan Bulan Ini">` below the existing 2-column grid, passing `monthly.income` and `monthly.expense` as props
- Human checkpoint Task 3 approved — all 9 visual/behavioral verification steps confirmed passing

## Task Commits

1. **Task 1: Create UpcomingBillsPanel component** - `710ef81` (feat)
2. **Task 2: Insert UpcomingBillsPanel as Dashboard row 3** - `850ba23` (feat)
3. **Task 3: Human verification checkpoint** - approved by user

## Files Created/Modified

- `src/components/UpcomingBillsPanel.tsx` — content-only component: useUpcomingBills hook, dayDiff helper, urgency classification, Sisa Aman arithmetic, loading/error/empty states
- `src/tabs/DashboardTab.tsx` — added import + `<Panel title="Tagihan Bulan Ini"><UpcomingBillsPanel .../></Panel>` as row 3 sibling in space-y-6 wrapper

## Decisions Made

- `UpcomingBillsPanel` is content-only — DashboardTab provides the Panel shell (non-exported local component), preventing a circular import
- `dayDiff()` uses `new Date(y, m-1, d)` local-midnight construction to avoid UTC offset off-by-one on WIB (UTC+7)
- Sisa Aman computed inline as `income - expense - totalBills` with `totalBills` in `useMemo([bills])` — no extra query
- Empty state renders the flex centering `<div>` (not null) per D-12 so the panel never disappears from Dashboard

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced beyond what was assessed in Plan 02's threat model (T-03-07 through T-03-14). All mitigations confirmed present:
- React JSX text interpolation prevents XSS on `bill.name`
- `useUpcomingBills` uses `useTargetUserId()` — same scoping as all other Dashboard hooks
- `max-h-64 overflow-y-auto` bounds DOM growth for long bill lists (T-03-10)

## Known Stubs

None — all data flows are wired (bills from Supabase via `useUpcomingBills`, income/expense from DashboardTab `monthly` useMemo).

## Self-Check: PASSED

- src/components/UpcomingBillsPanel.tsx: FOUND
- src/tabs/DashboardTab.tsx: FOUND (import + Panel row 3 confirmed)
- Commit 710ef81 (Task 1): FOUND
- Commit 850ba23 (Task 2): FOUND
- npx tsc --noEmit: exits 0
- Automated grep checks (UpcomingBillsPanel + DashboardTab): both OK

## Next Phase Readiness

Phase 3 Bills Display is complete. All BILL-01, BILL-02, BILL-04, NAV-02 requirements delivered.

Phase 4 (Mark-as-Paid) can now proceed — the `bill_payments` table schema and `useProcessRecurring` modification are the next step. Pre-phase confirmation of Sisa Aman formula required per blocker in STATE.md (formula: pemasukan aktual − pengeluaran aktual bulan ini − tagihan belum lunas bulan ini).

---
*Phase: 03-bills-display*
*Completed: 2026-04-24*
