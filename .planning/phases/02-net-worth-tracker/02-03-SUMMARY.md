---
phase: 02-net-worth-tracker
plan: "03"
subsystem: dashboard
tags: [react, dashboard, metric-card, net-worth, trend-badge]
dependency_graph:
  requires: [02-01]
  provides: [NW-01]
  affects: [src/tabs/DashboardTab.tsx]
tech_stack:
  added: []
  patterns: [useMemo-computed-net-worth, conditional-trend-badge, responsive-grid-5col]
key_files:
  modified:
    - src/tabs/DashboardTab.tsx
decisions:
  - "trendPct(curr, prev) argument order: existing DashboardTab signature is trendPct(curr, prev) — so netWorthTrend uses trendPct(lastTwo[1].net_worth, lastTwo[0].net_worth) where [1] is newest snapshot (higher index = more recent per ascending sort order from listSnapshots)"
  - "netWorth is live-computed client-side from 3 query sources (accounts + investments - liabilities), NOT read from snapshot — snapshots used only for trend % delta"
  - "Backward-compat preserved: Net Bulan Ini card passes trend={null} so gradient branch renders no badge for that card — only Net Worth card passes a potentially non-null trend"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-04-24"
  tasks_completed: 1
  tasks_total: 2
  files_modified: 1
---

# Phase 02 Plan 03: Dashboard Net Worth MetricCard Summary

**One-liner:** Added 5th MetricCard "Net Worth" with live-computed value and trend badge to Dashboard, fixed MetricCard gradient branch's silent-drop of trend prop.

---

## What Was Built

A single surgical modification to `src/tabs/DashboardTab.tsx` implementing 5 changes:

1. **Import** — Added `useNetWorthAccounts`, `useNetWorthLiabilities`, `useNetWorthSnapshots` from `@/queries/netWorth`

2. **Hooks** — Wired all 3 net worth query hooks inside `DashboardTab()` alongside existing hooks

3. **Computed values** — Two new `useMemo` blocks:
   - `netWorth`: live sum of `nwAccounts.balance + invRows.currentValue − nwLiabilities.amount` (NOT from snapshot)
   - `netWorthTrend`: `trendPct(lastTwo[1].net_worth, lastTwo[0].net_worth)` — returns `null` when fewer than 2 snapshots exist

4. **Grid update** — Changed `sm:grid-cols-4` → `sm:grid-cols-3 md:grid-cols-5` for proper 5-card responsive layout (mobile 2 cols, sm 3 cols, md+ 5 cols)

5. **5th MetricCard** — Appended `<MetricCard label="Net Worth" value={shortRupiah(netWorth)} gradient trend={netWorthTrend} />` after the 4th card

6. **Gradient branch bug fix** — Extended the `if (gradient)` branch in the inline `MetricCard` component to render a trend badge when `trend != null` — using `bg-emerald-500/30 text-emerald-100` for positive trend and `bg-red-500/30 text-red-100` for negative

---

## Lines Changed

- **+31 lines, -1 line** (net +30) in `src/tabs/DashboardTab.tsx`
- Commit: `5844d1a`

---

## trendPct Argument Order

The existing `trendPct` function in DashboardTab (line ~54 before edits) has signature:
```typescript
function trendPct(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}
```

Argument order is `(curr, prev)`. The `netWorthTrend` useMemo calls:
```typescript
trendPct(Number(lastTwo[1].net_worth), Number(lastTwo[0].net_worth))
```

Where `nwSnapshots` are returned from `listSnapshots()` sorted ascending by `snapshot_month` — so `lastTwo[1]` is the most recent (current) snapshot and `lastTwo[0]` is the prior month. This correctly maps to `trendPct(curr, prev)` — positive when net worth grew month-over-month.

---

## Acceptance Criteria — All Passed

| Check | Result |
|-------|--------|
| Import from `@/queries/netWorth` with all 3 hooks | PASS |
| Grid class `sm:grid-cols-3 md:grid-cols-5` present (count=1) | PASS |
| Old class `sm:grid-cols-4` absent (count=0) | PASS |
| `label="Net Worth"` present exactly once | PASS |
| `trend={netWorthTrend}` present | PASS |
| `const netWorth = useMemo` present | PASS |
| `const netWorthTrend = useMemo` present | PASS |
| `trend != null &&` in gradient branch | PASS |
| `bg-emerald-500/30` color class present | PASS |
| `bg-red-500/30` color class present | PASS |
| `npx tsc --noEmit` exits 0 | PASS |
| `npm run build` exits 0 | PASS |

---

## Deviations from Plan

None — plan executed exactly as written.

The only adaptation: the plan's Edit 2 note said to substitute the actual investments variable name if different from `invRows` — confirmed `invRows` is the correct variable name (line 37 of original file: `const { data: invRows = [] } = useInvestments()`), so no substitution needed.

---

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan is read-only additions to the Dashboard using existing RLS-protected queries from Plan 01. T-02-12 and T-02-13 mitigations already implemented in `src/queries/netWorth.ts` via `useTargetUserId()`.

---

## Known Stubs

None — `netWorth` is live-computed from real query data (not hardcoded), `netWorthTrend` is derived from real snapshot data. If DB has no accounts/liabilities/snapshots, values gracefully default to 0 and null respectively (via `= []` defaults and `slice(-2).length < 2` guard).

---

## Browser Checkpoint Outcome

Task 2 is a `checkpoint:human-verify` gate — browser verification pending. The human verifier should:

1. Open Dashboard tab after `npm run dev`
2. Confirm 5th card "NET WORTH" with indigo gradient appears
3. Confirm value equals `shortRupiah(accounts + investments − liabilities)` — with no accounts/liabilities, shows investments-only amount
4. Confirm trend badge hidden when 0 or 1 snapshots
5. Confirm "Net Bulan Ini" card visual unchanged (no badge)
6. Confirm grid responsive: 2 cols mobile / 3 cols sm / 5 cols md+
7. Optionally insert a fake prior-month snapshot to test emerald/red trend badge

---

## Note for /gsd-verify-work — NW-01 Success Criteria

To validate NW-01 (Net Worth visible at Dashboard):

```bash
# 1. Check import
grep "from '@/queries/netWorth'" src/tabs/DashboardTab.tsx

# 2. Check 5th card
grep 'label="Net Worth"' src/tabs/DashboardTab.tsx

# 3. Check grid
grep "sm:grid-cols-3 md:grid-cols-5" src/tabs/DashboardTab.tsx

# 4. Check live computation (not snapshot read)
grep "const netWorth = useMemo" src/tabs/DashboardTab.tsx

# 5. Check trend (null guard)
grep "const netWorthTrend = useMemo" src/tabs/DashboardTab.tsx

# 6. TypeScript + build
npx tsc --noEmit && npm run build
```

Browser check: open Dashboard, confirm 5th gradient card with label "NET WORTH" and live Rupiah value renders correctly.

---

## Self-Check

Files exist:
- `src/tabs/DashboardTab.tsx` — FOUND (modified)
- `.planning/phases/02-net-worth-tracker/02-03-SUMMARY.md` — this file

Commits exist:
- `5844d1a` — feat(02-03): add Net Worth MetricCard to Dashboard + fix gradient trend badge

## Self-Check: PASSED
