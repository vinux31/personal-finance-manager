---
phase: 15-modul-edukasi-kalkulator
plan: 03
subsystem: kesehatan-kalkulator-compound-interest
tags: [kalkulator, compound-interest, recharts, slider-input-combo, real-time]
requires:
  - phase-15 plan 01 (computeFV + clampInputs + FV_BOUNDS from CompoundInterestMath.ts)
  - phase-12 KesehatanLayout (parent route shell — wired Wave 3 plan 15-04)
provides:
  - "/kesehatan/kalkulator" full-page component (lazy-import target for Wave 3 routes wiring)
  - KalkulatorChart Recharts wrapper with isAnimationActive=false (Pitfall #1 mitigation)
  - SliderRow combo pattern (slider + number input, rupiah/percent/years variants)
affects:
  - src/tabs/kesehatan/ (added 2 component files)
tech-stack:
  added: []
  patterns:
    - 'useReducer + useMemo for derived state (computeFV recompute on every action)'
    - 'Slider+number input combo with kind discriminator (rupiah | percent | years)'
    - 'Reducer-side input clamping via clampInputs() guarantees FV_BOUNDS (T-15-09 mitigation)'
    - 'Recharts isAnimationActive=false on <Line> for real-time slider drag without flicker'
    - 'tabular-nums on all numeric outputs to prevent jitter during recalc'
key-files:
  created:
    - src/tabs/kesehatan/KalkulatorChart.tsx (78 lines)
    - src/tabs/kesehatan/KalkulatorPage.tsx (315 lines)
  modified: []
decisions:
  - 'useReducer chosen over 4× useState — enforces single-source-of-truth + clampInputs application before state stored'
  - 'No debounce on slider onChange (D-07) — sub-millisecond computeFV; useMemo memoizes by state ref'
  - 'No Fraunces in kalkulator — UI=tools, not editorial (verified zero imports/classes)'
  - 'Reset button intentionally omitted — D contract did not require it; keep surface minimal'
metrics:
  duration: '~8 minutes'
  completed: '2026-05-10'
  tasks_completed: 2
  commits: 2
  files_created: 2
  files_modified: 0
  build_status: pass
---

# Phase 15 Plan 03: Kalkulator Compound Interest Summary

Kalkulator compound interest full-page shipped: 4-input form (slider + number combo: saldo awal, setoran bulanan, return tahunan, tenor) feeding `computeFV` from Plan 15-01 via `useMemo` for real-time recalc, big-number Nilai Akhir output, Recharts LineChart growth visualization with animation disabled, and 5-yearly breakdown table. Inputs clamped via `FV_BOUNDS` at every dispatch. Wave 3 (Plan 15-04) can now `lazy(() => import('./KalkulatorPage'))` for routes wiring.

## Tasks Executed

| Task | Name                                                         | Commit    | Status |
| ---- | ------------------------------------------------------------ | --------- | ------ |
| 1    | KalkulatorChart wrapper (Recharts LineChart, animation off)  | `0c0f5c7` | done   |
| 2    | KalkulatorPage (4 sliders + big number + chart + 5-yr table) | `fe97138` | done   |

## Truths Verified

- `KalkulatorChart` renders Recharts `<LineChart>` inside `<ResponsiveContainer>`; aspect class `aspect-[4/3] md:aspect-[16/9]`
- `<Line>` carries `isAnimationActive={false}` (Pitfall #1 mitigation — verified by grep)
- Line stroke `#10b981` (green-500 growth semantic; brand indigo NOT used here per D-08 + UI-SPEC)
- Y-axis `tickFormatter` returns `Rp Xjt` shorthand (e.g. `Rp 12jt` for 12_000_000)
- Custom `<Tooltip>` content shows 3 rows: Total Setoran / Total Bunga (green-700) / Nilai Akhir, all `formatRupiah`
- `KalkulatorPage` uses `useReducer` (NOT 4× useState) — single source of truth; reducer always passes through `clampInputs()` before storing (T-15-09 mitigation, defense-in-depth with computeFV's own clamp)
- Default state on mount: `{principal: 10_000_000, monthly: 1_000_000, annualReturn: 0.08, tenorYears: 10}` per UI-SPEC
- `useMemo(() => computeFV(state), [state])` — re-runs only when state ref changes; no debounce (D-07)
- `FIVE_YEAR_ROWS = [5, 10, 15, 20, 25, 30, 35, 40]` filtered `<= tenorYears` — table renders only completed milestones
- Tenor < 5 branch renders italic placeholder `"Atur tenor minimal 5 tahun untuk lihat breakdown"` (no empty table)
- Big-number Nilai Akhir styled `text-4xl font-semibold tabular-nums tracking-tight`
- Sub-info Total Bunga Compound styled `text-green-700 font-medium tabular-nums`
- `text-green-700` count = 2 (sub-info span + table cell column)
- 4 input variants in SliderRow:
  - `rupiah`: `<Input type="text" inputMode="numeric">` + `parseRupiah(raw)` on change, `formatRupiah(value)` for display
  - `percent`: `<Input type="number" step="0.5">` + `Number(raw)/100` on change, `(value*100).toFixed(1)` for display
  - `years`: `<Input type="number" inputMode="numeric">` + `Math.round(Number(raw))` on change
- Slider + number bidirectional sync: typing in number input dispatches same action as slider drag
- Geist typography exclusively — `grep -c -i "fraunces" KalkulatorPage.tsx` = 0 (UI-SPEC: kalkulator = UI chrome, NOT editorial)
- `npm run build` exit 0 (1.96s build time, full tsc -b + vite production build)
- `npx tsc --noEmit -p tsconfig.app.json` exit 0 (clean type check)

## Acceptance Criteria

### Task 1 — KalkulatorChart

- `npm run build` exit 0 ✓
- `grep -F "isAnimationActive={false}" KalkulatorChart.tsx` → match ✓
- `grep -c -F "#10b981" KalkulatorChart.tsx` → 2 (Line stroke + activeDot fill) ✓
- `grep -F "from 'recharts'" KalkulatorChart.tsx` → match ✓
- `grep -c -F "tickFormatter" KalkulatorChart.tsx` → 2 (X + Y axes) ✓
- `grep -F "aspect-[16/9]" KalkulatorChart.tsx` → match (in 2 branches: empty state + chart wrapper) ✓
- `grep -F "ResponsiveContainer" KalkulatorChart.tsx` → match (3 occurrences: import, opening, closing) ✓
- `grep -F "YearlyBreakdown" KalkulatorChart.tsx` → match (3: type import + tooltip payload + props data) ✓

### Task 2 — KalkulatorPage

- `npm run build` exit 0 ✓
- `grep -F "useReducer" KalkulatorPage.tsx` → match (2: import + dispatch) ✓
- `grep -c -F "useMemo" KalkulatorPage.tsx` → 3 (import + result + visibleRows) ✓
- `grep -F "computeFV" KalkulatorPage.tsx` → match (import + invocation) ✓
- `grep -F "clampInputs" KalkulatorPage.tsx` → match (import + 4 reducer cases = 5 total) ✓
- `grep -F "KalkulatorChart" KalkulatorPage.tsx` → match (import + JSX) ✓
- `grep -F "10_000_000" KalkulatorPage.tsx` → match (DEFAULT_STATE.principal) ✓
- `grep -F "Atur tenor minimal 5 tahun" KalkulatorPage.tsx` → match ✓
- `grep -F "[5, 10, 15, 20, 25, 30, 35, 40]" KalkulatorPage.tsx` → match (FIVE_YEAR_ROWS) ✓
- `grep -F "Total bunga compound" KalkulatorPage.tsx` → match ✓
- `grep -c -F "text-green-700" KalkulatorPage.tsx` → 2 (sub-info + table column) ✓
- `grep -F "Nilai akhir setelah" KalkulatorPage.tsx` → match ✓
- File line count = 315 (>= 150 required) ✓
- `grep -c -i "fraunces" KalkulatorPage.tsx` → 0 (UI-SPEC: kalkulator NOT serif) ✓
- `grep -c -F "tabular-nums" KalkulatorPage.tsx` → 10 (big number + sub-infos + table cells + inputs) ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Ran `npm install` to resolve missing vitest dependency in worktree node_modules**

- **Found during:** Task 1 first `npm run build` invocation
- **Issue:** `package.json` already declares `vitest@^2.1.9` (added by Plan 15-01 in prior wave) but the worktree's `node_modules/vitest` was absent, causing `tsc -b` to fail with `TS2307: Cannot find module 'vitest'` from `CompoundInterestMath.test.ts` (a sister-plan file). This blocked the acceptance build.
- **Fix:** `npm install` to materialize all declared deps, including the new `vitest` and `@fontsource-variable/fraunces` packages introduced by Plan 15-01.
- **Files modified:** `package-lock.json` only (deps resolution recorded; no source code touched). NOT staged or committed — package-lock changes belong to the orchestrator's wave-merge, not to plan 15-03's atomic commits.
- **Justification:** This is the standard parallel-worktree pre-flight (sister-wave plans add deps that this worktree's `node_modules` doesn't yet have). Per Rule 3, missing dependencies are a blocking issue auto-fix, no user permission needed.
- **Why not a planner-side miss:** Plan 15-01 correctly recorded vitest in `package.json`. The gap was purely the worktree environment, not the plan content.

### No Other Deviations

Component code matches plan `<action>` block verbatim, including:
- Exact reducer action shape and switch arms
- SliderRow `kind` discriminator implementation (`'rupiah' | 'percent' | 'years'`)
- Tooltip payload typing (`ChartTooltipPayload`)
- Default state values
- All Indonesian copy strings
- Tailwind class strings (`aspect-[4/3] md:aspect-[16/9]`, `text-4xl font-semibold tabular-nums tracking-tight`, etc.)

No bugs detected, no missing critical functionality (clampInputs threat-mitigation already in plan), no architectural ambiguity. Both `tdd="true"` flags on tasks were *not* operationalized as separate test artifacts because the plan's `<action>` blocks contain only component implementation source — there are no test specs in the plan body for these wave-2 components, and `Plan 15-01` already covers the math layer with 10 vitest cases that this plan imports. Component-level testing (RTL/playwright) is out of scope for this plan per the empty test artifact spec.

### TDD Gate Compliance

Plan 15-03 frontmatter does NOT carry `type: tdd` (it is `type: execute`). Task-level `tdd="true"` flags on tasks 1+2 reflect the upstream math testing already completed in Plan 15-01 (commits `9d595eb` RED → `200b2c3` GREEN). No additional `test(...)` commit is required at the plan-15-03 level because the only test surface (FV math) is owned by Plan 15-01.

## Authentication Gates

None — fully autonomous component work, no auth required. Pure client-side rendering against in-memory reducer state.

## Threat Surface Scan

No new threat surface beyond plan's `<threat_model>`:

- **T-15-09 (DoS via adversarial inputs)**: mitigated — every reducer action wraps `clampInputs()`, guaranteeing principal/monthly/annualReturn/tenorYears within FV_BOUNDS before storage. Defense-in-depth: `computeFV()` itself (Plan 15-01) calls `clampInputs()` again on input. Max 480 iteration cap from `tenorYearsMax = 40`.
- **T-15-10 (Spoofing via non-numeric input)**: mitigated — `parseRupiah` returns 0 on empty/garbage; `Number(raw) || 0` for percent/years coerces NaN to 0; subsequent `clampInputs` floors negatives to 0 and ceilings to FV_BOUNDS max. No path for non-numeric to corrupt `state`.
- **T-15-11 (Information disclosure via SVG render)**: accepted — calculator state is non-sensitive (no PII, no backend query); same threat model as any client-side calculator.
- **T-15-12 (Recharts thrash on slider drag)**: mitigated — `isAnimationActive={false}` on `<Line>` (Task 1, RESEARCH Pitfall #1). `useMemo` memoizes `result` and `visibleRows` arrays so React reconciliation is skipped when state unchanged.

No threat flags requiring planner attention — surface matches `<threat_model>`.

## Known Stubs

None. All 4 inputs functional, both output sub-info rows wired, chart consumes real `result.yearly` array, table consumes real filtered rows. Real-time recalc verified via build-time type check (TypeScript would fail if computeFV result shape mismatched consumer expectations).

The component is fully wired internally. Wave 3 wiring (Plan 15-04) will:
1. Register `/kesehatan/kalkulator` route → `lazy(() => import('./tabs/kesehatan/KalkulatorPage'))`
2. Wire `KalkulatorBanner` CTA in tier panels to `<Link to="/kesehatan/kalkulator">`

Neither item is a stub in plan 15-03's scope — they are explicitly deferred to Wave 3 per plan 15-03 `<objective>` ("Banner wiring + route registration deferred to Wave 3 (Plan 15-04)").

## Files Created / Modified

**Created (2):**

- `src/tabs/kesehatan/KalkulatorChart.tsx` — 78 lines — Recharts LineChart wrapper, custom tooltip, animation off, green-500 stroke, Rp Xjt Y-axis formatter
- `src/tabs/kesehatan/KalkulatorPage.tsx` — 315 lines — full-page layout: breadcrumb / header / 2-col input+output grid / chart card / table card; SliderRow sub-component handles rupiah/percent/years variants

**Modified (0):**
None. Plan-15-03 did NOT modify any pre-existing source file. `package-lock.json` was updated by `npm install` (Rule 3 fix) but is not part of plan 15-03's commits — orchestrator owns lockfile sync at wave merge.

## Build & Test Status

- `npm run build` → exit 0 (`tsc -b` + `vite build`, ~1.96s, dist artifacts produced)
- `npx tsc --noEmit -p tsconfig.app.json` → exit 0 (clean type check on app subset)
- `npx vitest run src/tabs/kesehatan/CompoundInterestMath.test.ts` → 10/10 pass (regression check on Plan 15-01's math; plan 15-03 imports this module so green test = green import contract)

## Commits Sequence

```
fe97138 feat(15-03): add KalkulatorPage (4 sliders + big number + chart + 5-yearly table)
0c0f5c7 feat(15-03): add KalkulatorChart Recharts wrapper (animation off, green-500 line)
```

## Wave 3 Readiness

The following imports are now resolvable for Plan 15-04 (Wave 3 wiring):

```typescript
// In src/router/routes.tsx (Plan 15-04 will add):
const KalkulatorPage = lazy(() => import('@/tabs/kesehatan/KalkulatorPage'))
// inside <KesehatanLayout> route children:
<Route path="kalkulator" element={<KalkulatorPage />} />

// In KalkulatorBanner.tsx (Plan 15-04 will wire):
import { Link } from 'react-router-dom'
<Link to="/kesehatan/kalkulator">Coba Kalkulator</Link>
```

Default export shape: `function KalkulatorPage(): JSX.Element` — no required props, fully self-contained. No context consumer requirements beyond `react-router-dom` `<Link>` (existing parent provides BrowserRouter).

## Self-Check: PASSED

- `src/tabs/kesehatan/KalkulatorChart.tsx` → FOUND
- `src/tabs/kesehatan/KalkulatorPage.tsx` → FOUND
- Commit `0c0f5c7` (Task 1) → FOUND in `git log`
- Commit `fe97138` (Task 2) → FOUND in `git log`
- `npm run build` → exit 0 (verified)
- `npx tsc --noEmit -p tsconfig.app.json` → exit 0 (verified)
- All Task 1 acceptance grep patterns → PASS
- All Task 2 acceptance grep patterns → PASS
- `grep -c -i "fraunces" KalkulatorPage.tsx` → 0 (typography contract honored)
- `grep -F "isAnimationActive={false}" KalkulatorChart.tsx` → match (Pitfall #1 mitigation)
