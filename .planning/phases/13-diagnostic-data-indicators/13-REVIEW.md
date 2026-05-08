---
phase: 13-diagnostic-data-indicators
reviewed: 2026-05-08T09:03:28Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/components/ui/accordion.tsx
  - src/db/goals.ts
  - src/queries/goals.ts
  - src/queries/kesehatan.ts
  - src/queries/kesehatanIndikator.ts
  - src/queries/kesehatanTier1.ts
  - src/queries/kesehatanTier2.ts
  - src/queries/kesehatanTier3.ts
  - src/queries/kesehatanTypes.ts
  - src/tabs/kesehatan/IndikatorCard.tsx
  - src/tabs/kesehatan/KesehatanLanding.tsx
  - src/tabs/kesehatan/PiramidaShell.tsx
  - src/tabs/kesehatan/Tier1Panel.tsx
  - src/tabs/kesehatan/Tier2Panel.tsx
  - src/tabs/kesehatan/Tier3Panel.tsx
  - src/tabs/kesehatan/Tier4Panel.tsx
  - src/tabs/kesehatan/TierPanel.tsx
findings:
  critical: 0
  high: 0
  medium: 2
  low: 6
  total: 8
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-05-08T09:03:28Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 13 (diagnostic-data-indicators) ships 8 financial health indicators with strong defensive coding throughout: explicit threshold operators, divide-by-zero guards on every ratio, INVERTED-threshold encoding documented inline, smart fallback CTA pattern, View-As-aware hook composition. Reviewed all 17 source files at standard depth.

**No bugs in core formulas.** Threshold semantics for DIAG-01 / 02 / 03 / 05 / 06 / 07 / 08 all verified against spec §4. Hint text in Tier1/2/3Panel matches threshold ranges encoded in `THRESHOLDS` constants. View-As composition correct (all 7 sub-hooks use `useTargetUserId()` via existing pattern). File-ownership matrix preserved (KesehatanLanding only edited in 13-01).

**No security issues.** All Supabase queries parameterized via `.eq()/.gte()/.ilike()`. RLS enforced server-side. No XSS surface (all rendered values flow through React auto-escape; `display` strings produced by compute layer, not user-controllable). No `eval`/`innerHTML`/secrets.

**Findings cluster at low/medium severity** — narrative boundary semantics (kprFraction display tiers), 30-day month approximation for stale-pension notice, defensive concerns around `'invalid date string'` propagation in `computeGoalsOnTrack`, redundant `tx.data ?? []` after pre-filtered hook return, and quality nits.

## Medium Issues

### MD-01: `kprFraction` boundary at exactly 0.5 falls into "campuran" branch instead of "mayoritas KPR"

**File:** `src/tabs/kesehatan/Tier1Panel.tsx:31-35`
**Issue:** Three-band display uses `kprFraction > 0.5` strict. At exact `0.5` (50% liabilities are KPR), the user lands in the "campuran KPR & utang konsumtif" bucket. Per the SUMMARY's narrative ("mayoritas KPR" should mean ≥50%), 50/50 should be "mayoritas KPR" or, more clearly, a separate "seimbang" label. Edge case but reachable on exact 50/50 portfolios.
**Fix:**
```tsx
{darTotalInfo.kprFraction >= 0.5
  ? ' (mayoritas KPR — beban rumah)'
  : darTotalInfo.kprFraction > 0
  ? ' (campuran KPR & utang konsumtif)'
  : ' (tanpa KPR)'}
```
Change `> 0.5` → `>= 0.5` to make the upper band inclusive of the boundary, matching the "majority/half-or-more" intuition.

### MD-02: 30-day month approximation for stale-pension notice can mis-report by ~5 days at boundary

**File:** `src/queries/kesehatanTier2.ts:200-203, 247, 264`
**Issue:** `monthsStale = (Date.now() - updatedAt) / (1000 * 60 * 60 * 24 * 30)` uses a fixed 30-day month. After 6 calendar months (≈182.5 days), `monthsStale ≈ 6.08` triggers stale notice as expected. But after exactly 5 calendar months and ~26 days (~177 days, `monthsStale ≈ 5.9`), still under threshold — fine. The display, however, uses `Math.floor(monthsStale)` which can show "Stale 6bln" when only ~5.5 calendar months have passed, and conversely show "Stale 7bln" when ~7.0 months has passed (where calendar would say 7). Not a correctness bug for the threshold flag itself, but the display number can drift up to ~1 month relative to user expectation over long ranges (e.g., 12 stale months reads "Stale 12bln" only if 360 days elapsed; 365 days reads "Stale 12bln" still — fine — but anything 18 months reads "Stale 18bln" only at 540 days vs 547 calendar days).
**Fix:** Acceptable as-is for v1.2 (shipped, low impact). If tightening desired, swap to a calendar-month diff:
```ts
const updated = new Date(sim.updated_at)
const now = new Date()
const monthsStale =
  (now.getFullYear() - updated.getFullYear()) * 12 +
  (now.getMonth() - updated.getMonth()) -
  (now.getDate() < updated.getDate() ? 1 : 0)
const isStale = monthsStale > STALE_THRESHOLD_MONTHS
// ...
...(isStale && { staleMonths: monthsStale })
```
This yields integer calendar-month diffs and matches user expectations. Optional — current logic is shipped and acceptable per RESEARCH.md pitfall #6.

## Low Issues

### LO-01: `computeGoalsOnTrack` propagates `NaN` if `created_at` is non-empty invalid string

**File:** `src/queries/kesehatanTier2.ts:55-73`
**Issue:** `g.created_at ? new Date(g.created_at) : <fallback>` — empty string is correctly handled (falsy → fallback). But a non-empty malformed value (e.g., legacy migration garbage like `'0000-00-00'` or `'TBD'`) yields `Invalid Date`; subsequent `start.getTime()` returns `NaN`, `totalMs = NaN`, `NaN <= 0` is `false` (skips the on-track-by-default branch), and the goal silently counts as off-track. This is theoretically unreachable (DB column is `TIMESTAMPTZ NOT NULL DEFAULT now()`), but the synthesized `created_at: ''` mapper in `src/queries/goals.ts:69` shows the project already has one path that injects fake values — defense-in-depth would prevent future regressions.
**Fix:**
```ts
const startRaw = g.created_at ? new Date(g.created_at) : null
const start = startRaw && !Number.isNaN(startRaw.getTime())
  ? startRaw
  : new Date(now.getFullYear(), 0, 1)
```

### LO-02: Redundant `tx.data ?? []` defensive coalesce in `useIndikator`

**File:** `src/queries/kesehatanIndikator.ts:120-126`
**Issue:** `useTransactions` already returns `data: query.data?.data ?? []` (see `src/queries/transactions.ts:26`), so `tx.data` is never undefined. The `tx.data ?? []` here is dead code (idempotent but signals confusion about the upstream contract). Same pattern duplicates 7x for accounts/liabilities/goals/inv/pens/protection — most other hooks return `UseQueryResult` where `.data` IS undefined while loading, so for those the coalesce is correct. Specifically only `tx.data ?? []` is redundant.
**Fix:** Either remove the `?? []` for `tx` only, or leave for symmetry/readability. Lowest-effort: leave a comment noting `useTransactions` returns `[]` already to clarify.

### LO-03: `sim.ht_dppk_type` cast bypasses validation of malformed string

**File:** `src/queries/kesehatanTier2.ts:140`
**Issue:** `(sim.ht_dppk_type as 'ppmp' | 'ppip') || 'ppmp'` — cast lies if DB has unexpected values like `'ppmp_v2'` or accidental whitespace `'ppmp '`. The `|| 'ppmp'` only catches falsy (`''`, `null`, `undefined`). `calcDPPK` then receives an invalid `type` and may misbehave. The DB column is typed `TEXT` (not enum); risk is real if a future bug or admin SQL inserts garbage.
**Fix:**
```ts
const dppkType: 'ppmp' | 'ppip' =
  sim.ht_dppk_type === 'ppip' ? 'ppip' : 'ppmp'
const r = calcDPPK({ type: dppkType, ... })
```
Defaults to `'ppmp'` for any non-`'ppip'` value (matches the existing fallback semantic).

### LO-04: `computePensiun` divide-by-zero edge case (`usia_pensiun ≥ 75`) silently produces inflated ratio

**File:** `src/queries/kesehatanTier2.ts:237`
**Issue:** `Math.max(LIFE_EXPECTANCY_YEARS - sim.usia_pensiun, 1)` floors years-remaining to 1. If user enters `usia_pensiun = 80`, the formula reads "I need 1 year of post-retirement spending," which inflates the ratio dramatically — almost certainly green even with tiny projection. Comment acknowledges this as "edge case rare." Better UX: render a warning/info badge "usia pensiun ≥ usia harapan — review angka," or return a `compute` red with explanatory display.
**Fix (optional):**
```ts
if (sim.usia_pensiun >= LIFE_EXPECTANCY_YEARS) {
  return {
    kind: 'compute',
    value: 0,
    color: 'yellow',
    display: '— (cek usia pensiun)',
    ...(isStale && { staleMonths: Math.floor(monthsStale) }),
  }
}
```
Defer to Phase 14 acceptable; document in v1.3 backlog.

### LO-05: `aria-label` redundancy on PiramidaShell trapezoid wrapper

**File:** `src/tabs/kesehatan/PiramidaShell.tsx:76-84`
**Issue:** When `renderTrigger` is supplied, the inner `<div>` (which becomes an `AccordionTrigger` child) carries `aria-label="Tier N LABEL"`. AccordionTrigger from Radix already provides button semantics with the visible text content as the accessible name. Result: screenreaders may announce the tier label twice or override Radix's correct labeling. Not a bug — Radix's button name typically wins from `aria-labelledby`/text content, but the redundant aria-label adds maintenance noise.
**Fix:** Remove `aria-label` from the inner wrapper div when `renderTrigger` is in use. Move it (or omit entirely) to the fallback `<button>` branch only.

### LO-06: `IndikatorCard` accordion chevron icon visually hidden inside trigger but never re-shown

**File:** `src/tabs/kesehatan/KesehatanLanding.tsx:138`
**Issue:** `<AccordionTrigger className="... [&>svg]:hidden">` hides the default ChevronDownIcon shipped by `accordion.tsx:44` because the trapezoid is the visual affordance. This is intentional, but loses the affordance signal to keyboard users (the rotation animation that signals "open" is now invisible). Consider adding a subtle border/background change to the trapezoid on `data-state=open` to compensate (currently colors stay constant during expand).
**Fix (optional UX nit):** Add `data-[state=open]:ring-2 data-[state=open]:ring-primary/40` to the AccordionTrigger className, or add a state-aware visual cue inside the trapezoid via the parent. Defer if visual-UAT (Task 3 handoff) confirms acceptable.

---

## Notes (not findings)

**Verified clean:**
- All threshold formulas match spec §4 verbatim (DIAG-01 through DIAG-08).
- INVERTED threshold for DIAG-03 encoded explicitly with `pct < green` and `pct <= yellow` — boundary semantics 19% green / 20% yellow / 40% yellow / 41% red.
- `asetFinansial === 0` divide-by-zero guards present in computeDARKonsumtif, computeDARTotal, computeRasioInvestasi.
- `avgExpenseBulanan === 0` guard in computeDanaDarurat (placeholder-data-tipis).
- `target_amount > 0` guard in linear-progress fraction.
- `target_bulanan * 12 * yearsRemaining ≤ 0` guard in computePensiun.
- `total === 0` guard in computeDARTotal kprFraction (returns null before division).
- asset_type normalization (lowercase + trim + empty filter) consistent with Plan 13-04 spec.
- View-As wiring intact: `useTransactions`, `useNetWorthAccounts/Liabilities`, `useGoals`, `useInvestments`, `usePensionSim`, `useProtectionChecklist` all use `useTargetUserId()`.
- File-ownership preserved: `KesehatanLanding.tsx` only modified in 13-01 (verified via file content matching SUMMARY's claim).
- `Goal.created_at` extension is additive and backward-compat; cascade fix in `queries/goals.ts:69` synthesizes `''` only for `goals_with_progress` VIEW path which is not consumed by `computeGoalsOnTrack`.
- shadcn Accordion implementation (`accordion.tsx`) is a verbatim port from shadcn/ui template; uses radix-ui umbrella import matching project pattern.
- No `console.log` left behind (only intentional `console.warn` for partial-error telemetry in useTotalDataCount and useProtectionChecklist).
- No `TODO`/`FIXME`/`XXX`/`HACK` markers introduced.
- No empty catch blocks.
- No `as any` / `as unknown` type erasure (SUMMARY 13-03 explicitly avoided `Record<string, unknown>` blind cast).
- All threshold constants extracted to `kesehatanTypes.ts` (no magic numbers in compute logic).

**Out-of-scope for v1 review (per review_scope):**
- Performance: useMemo deps are correct; transactions filtered to last 3 months prevents full-table scan.
- `Set<string>` allocation for asset_type DISTINCT — accepted (sub-50ms even at 10k investments).

---

_Reviewed: 2026-05-08T09:03:28Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
