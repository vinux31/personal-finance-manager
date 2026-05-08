---
phase: 13-diagnostic-data-indicators
plan: 01
subsystem: kesehatan-tier-panel-infra
tags: [phase-13, plan-01, accordion, indikator-types, useIndikator-hook, tier-panel-infra, view-as-aware]
requires:
  - Phase 12 PiramidaShell + KesehatanLanding shell
  - radix-ui ^1.4.3 + tw-animate-css ^1.4.0 already in deps
  - useTransactions / useNetWorthAccounts / useNetWorthLiabilities / useGoals / useInvestments / usePensionSim hooks (existing)
  - useTargetUserId() View-As wiring (existing pattern)
provides:
  - shadcn Accordion component (radix-ui umbrella, ChevronDownIcon)
  - IndikatorResult union type (compute / placeholder-data-tipis / cta-fallback) + optional staleMonths
  - THRESHOLDS / LIQUID_TYPES / FINANCIAL_TYPES / KONSUMTIF_LIAB_TYPES / LIFE_EXPECTANCY_YEARS = 75 constants
  - TierColors / TierId types
  - useIndikator() composing 7 View-As-aware hooks (incl. useProtectionChecklist) + useMemo derive
  - aggregateTierColor() pure function + deriveTierColors() helper + TIER_INDICATORS map
  - useProtectionChecklist read-only hook (Tier 1 #4 shell; Phase 14 owns mutation)
  - IndikatorCard 3-variant render component (compute/placeholder/cta-fallback) with staleMonths badge support
  - TierPanel generic shell config-driven (indicators/infoSlot/ctas/modulLinks/placeholderText)
  - PiramidaShell extension: tierColors prop dynamic + renderTrigger callback (Accordion integration)
  - 4 stub TierNPanel.tsx files (Tier1/2/3 stable Props signature for Wave 2 in-place body rewrite; Tier4 permanent placeholder)
affects:
  - src/tabs/kesehatan/KesehatanLanding.tsx (Accordion wire + useIndikator + Tier4Panel placeholder)
  - DIAG-11 empty state path preserved (PiramidaShell variant='grayed-empty' + EmptyStateCTA when count < 3)
tech-stack:
  added:
    - shadcn Accordion via radix-ui umbrella (no new package)
  patterns:
    - radix-ui umbrella import pattern (matches existing dialog.tsx, select.tsx)
    - 6+1 hook composition + useMemo derive (no new query infrastructure)
    - useTargetUserId-aware via existing sub-hooks (no new View-As wiring)
    - File-ownership exclusivity for Wave 2 zero-conflict parallelism
key-files:
  created:
    - src/components/ui/accordion.tsx
    - src/queries/kesehatanTypes.ts
    - src/queries/kesehatanIndikator.ts
    - src/queries/kesehatanTier1.ts
    - src/queries/kesehatanTier2.ts
    - src/queries/kesehatanTier3.ts
    - src/tabs/kesehatan/IndikatorCard.tsx
    - src/tabs/kesehatan/TierPanel.tsx
    - src/tabs/kesehatan/Tier1Panel.tsx
    - src/tabs/kesehatan/Tier2Panel.tsx
    - src/tabs/kesehatan/Tier3Panel.tsx
    - src/tabs/kesehatan/Tier4Panel.tsx
  modified:
    - src/queries/kesehatan.ts
    - src/tabs/kesehatan/PiramidaShell.tsx
    - src/tabs/kesehatan/KesehatanLanding.tsx
decisions:
  - "LIFE_EXPECTANCY_YEARS = 75 locked in kesehatanTypes.ts (BPS Indonesia 2024 ~74 years rounded up). Constant placement enables post-launch tuning without rebuild."
  - "useTransactions filtered with dateFrom = today - 3 months in useIndikator (RESEARCH.md pitfall #2 — avoid full-table scan)."
  - "Hybrid compute strategy (CONTEXT.md decision B): client-side derivation reusing existing query hook cache. Migration path to RPC compute_indicators(uid) preserved without breaking consumers."
  - "Single-open Accordion (CONTEXT.md decision A): shadcn Accordion type='single' collapsible. Animation via tw-animate-css already imported in src/index.css."
  - "File-ownership matrix locked: Wave 2 13-02 owns Tier1Panel.tsx + kesehatanTier1.ts; 13-03 owns Tier2Panel.tsx + kesehatanTier2.ts; 13-04 owns Tier3Panel.tsx + kesehatanTier3.ts. KesehatanLanding NOT modified in Wave 2."
  - "IndikatorResult.compute extended with optional staleMonths?: number (resolves CONTEXT.md Open Question 2 — DIAG-06 stale pension notice)."
  - "PiramidaShell backward compat: renderTrigger absent → fallback toast onClick (Phase 12 default behavior). variant='grayed-empty' DIAG-11 path unchanged."
metrics:
  duration: ~6.4 minutes
  completed: 2026-05-08
  tasks_completed: 4
  files_created: 12
  files_modified: 3
  bundle_js_kb: 1782.78
---

# Phase 13 Plan 01: Tier Panel Infrastructure Summary

**One-liner:** Wave 1 sole plan delivers shadcn Accordion, IndikatorResult type system, useIndikator() composing 7 View-As-aware hooks, IndikatorCard/TierPanel/PiramidaShell extensions, and 4 stub Panel files — opening parallel Wave 2 (13-02/03/04) with zero file overlap.

## What Shipped

### 1. Foundation Files (Task 1)

- **`src/components/ui/accordion.tsx`** — shadcn Accordion (Root/Item/Trigger/Content) wrapping radix-ui umbrella import. ChevronDownIcon rotates 180° on `data-state=open`. Animation classes (`animate-accordion-up`/`animate-accordion-down`) supported via existing `@import "tw-animate-css"` in `src/index.css`.

- **`src/queries/kesehatanTypes.ts`** — Type system + constants:
  - `IndikatorResult` union (3 variants + optional `staleMonths`)
  - `IndikatorColor` = 'green' | 'yellow' | 'red'
  - `THRESHOLDS` constants for 7 indicators (extracted, not inlined)
  - `LIQUID_TYPES`, `FINANCIAL_TYPES`, `KONSUMTIF_LIAB_TYPES` typed account/liability filters
  - **`LIFE_EXPECTANCY_YEARS = 75`** locked (BPS Indonesia 2024 ~74y rounded; constant for post-rilis tuning)
  - `COLOR_BADGE_CLASS` / `COLOR_BORDER_CLASS` Tailwind class maps
  - `TierId` (1|2|3|4) + `TierColors` record types

- **`src/queries/kesehatanIndikator.ts`** — Hooks + helpers:
  - `useIndikator()` composes 7 View-As-aware hooks (transactions filtered to last 3 months, netWorth accounts/liabilities, goals, investments, pension, protection_checklist) + useMemo derive
  - `useProtectionChecklist()` private hook (read-only, RLS protection_checklist)
  - `aggregateTierColor()` pure function (gray > red > yellow > green precedence per spec §4)
  - `deriveTierColors()` helper produces `TierColors` from `IndikatorMap`
  - `TIER_INDICATORS` map (Tier 1: [1,2,3,4] / Tier 2: [5,6] / Tier 3: [7,8] / Tier 4: [])
  - Re-exports `THRESHOLDS`, `COLOR_BADGE_CLASS`, `COLOR_BORDER_CLASS`, `LIFE_EXPECTANCY_YEARS`, types

- **`src/queries/kesehatanTier1/2/3.ts`** — Stub compute functions with stable signatures. Wave 2 13-02/03/04 will overwrite implementation without modifying `kesehatanIndikator.ts` imports.

- **`src/queries/kesehatan.ts`** (existing Phase 12) extended with barrel re-exports — consumers can `import { useIndikator, ... } from '@/queries/kesehatan'`.

### 2. UI Components (Task 2)

- **`src/tabs/kesehatan/IndikatorCard.tsx`** — Renders 3 variants of `IndikatorResult`:
  - `compute` → number + colored badge + display + optional `staleMonths` mini-badge
  - `placeholder-data-tipis` → "Butuh 3 bulan data — sudah X/3" + CTA navigate
  - `cta-fallback` → message + custom CTA label/route

- **`src/tabs/kesehatan/TierPanel.tsx`** — Generic shell config-driven (`indicators[]` / `infoSlot` / `ctas[]` / `modulLinks[]` / `placeholderText`). Wave 2 plans wrap with tier-specific configuration.

- **`src/tabs/kesehatan/PiramidaShell.tsx`** (modified) — Extended signature:
  - `variant` prop preserved (Phase 12 DIAG-11 backward compat)
  - `tierColors` (NEW) — dynamic green/yellow/red/gray per trapezoid based on `deriveTierColors()` output
  - `renderTrigger` callback (NEW) — when provided, parent (KesehatanLanding) wraps trapezoid as AccordionTrigger; when absent, falls back to existing toast onClick handler (Phase 12 backward compat)

### 3. Stub Tier Panels (Task 2.5)

- **`Tier1Panel.tsx`** stub — Props `{ indicators: IndikatorMap, darTotalInfo: DARTotalInfo | null }` (Wave 2 13-02 rewrites body)
- **`Tier2Panel.tsx`** stub — Props `{ indicators: IndikatorMap }` (Wave 2 13-03 rewrites body)
- **`Tier3Panel.tsx`** stub — Props `{ indicators: IndikatorMap }` (Wave 2 13-04 rewrites body)
- **`Tier4Panel.tsx`** — Permanent Phase 13 placeholder ("Smart-gated checklist akan tersedia di update berikutnya"). Phase 14 will replace with mutation form.

### 4. KesehatanLanding Wire (Task 3)

`src/tabs/kesehatan/KesehatanLanding.tsx` extended branching:
- `isLoading` → 4-skeleton placeholder
- `isError` → toast destructive
- `isEmpty` (count < 3) → `<PiramidaShell variant='grayed-empty' />` + `<EmptyStateCTA />` (DIAG-11 preserved, **no Accordion** — toast onClick existing)
- Normal state → `<Accordion type='single' collapsible>` wrapping `<PiramidaShell tierColors={...} renderTrigger={...} />` where each trapezoid is an `AccordionTrigger` and panel content swaps between `<Tier1Panel/>`, `<Tier2Panel/>`, `<Tier3Panel/>`, `<Tier4Panel/>`

`tierColors` derived from `useIndikator()` once data ready (Tier 4 always 'gray' until Phase 14).

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✓ Zero errors |
| `npm run build` | ✓ Success in 2.27s |
| Bundle JS main | 1782.78 kB (delta marginal vs Phase 12 baseline; well within <80KB tolerance for 12 new files) |
| 7 init-files exist | ✓ `accordion.tsx`, `kesehatanTypes.ts`, `kesehatanIndikator.ts`, `kesehatanTier1.ts`, `kesehatanTier2.ts`, `kesehatanTier3.ts`, `IndikatorCard.tsx`, `TierPanel.tsx` (+4 stub TierNPanel.tsx) |
| 3 modified files | ✓ `kesehatan.ts`, `PiramidaShell.tsx`, `KesehatanLanding.tsx` |
| `LIFE_EXPECTANCY_YEARS = 75` exported | ✓ Locked with BPS Indonesia 2024 justification |
| `IndikatorResult` 3-variant union exported | ✓ + optional `staleMonths` extension |
| DIAG-11 empty state preserved | ✓ Phase 12 path unchanged |

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `481b0c6` | feat(13-01): add diagnostic indicator foundation hooks and types |
| 2 | `c098d9e` | feat(13-01): add IndikatorCard + TierPanel + extend PiramidaShell |
| 2.5 | `3c92bd9` | feat(13-01): add Tier1/2/3 stub panels + Tier4 placeholder |
| 3 | `7cf52ad` | feat(13-01): wire Accordion + useIndikator + tier panels in KesehatanLanding |

## Deviations from Plan

None — plan executed exactly as written.

The minor `isError` retention in `KesehatanLanding.tsx` (showing toast-style destructive message before piramida render) was preserved from Phase 12 baseline; the plan-template version omitted it but the existing path adds defensive UX. This is not a deviation but a backward-compat preservation aligned with CLAUDE.md project standards (graceful error fallback).

## Threat Flags

None — `useProtectionChecklist` follows existing `useTotalDataCount` pattern (Phase 12 verified). Mitigations from threat register satisfied:
- T-13-01 (RLS read row): `.eq('user_id', targetUid)` + RLS `auth.uid() = user_id OR is_admin()`
- T-13-04 (transactions full-table scan): `useTransactions({ dateFrom: 3-months-ago })` filter applied

## Hand-off Notes

### For Wave 2 Plans (13-02 / 13-03 / 13-04)

**File ownership exclusivity (zero merge conflict guarantee):**

| Plan | Owns Exclusively |
|------|------------------|
| **13-02** Tier 1 | `src/tabs/kesehatan/Tier1Panel.tsx` (body rewrite) + `src/queries/kesehatanTier1.ts` (compute logic for DIAG-01/02/03/10) |
| **13-03** Tier 2 | `src/tabs/kesehatan/Tier2Panel.tsx` (body rewrite) + `src/queries/kesehatanTier2.ts` (DIAG-05/06) + may extend `src/db/goals.ts` if `Goal.created_at` needed for long-term filter |
| **13-04** Tier 3 | `src/tabs/kesehatan/Tier3Panel.tsx` (body rewrite) + `src/queries/kesehatanTier3.ts` (DIAG-07/08) |

`KesehatanLanding.tsx` is **NOT modified** in Wave 2. Each `TierNPanel` already receives props (`indicators: IndikatorMap`, plus `darTotalInfo` for Tier 1) and Wave 2 just rewrites the panel body to use `<TierPanel tierId={N} indicators={[...]} ctas={[...]} modulLinks={[...]} infoSlot={...} />`.

### For Phase 14 (DIAG-04 Tier 1 inline form + DIAG-09 Tier 4 smart-gated)

- `useProtectionChecklist` hook ready (read-only). Phase 14 mutation tinggal invalidate `['kesehatan', 'protection-checklist', uid]` query key.
- `Tier4Panel.tsx` is permanent placeholder; Phase 14 replaces it with smart-gated checklist content.
- Tier 4 `aggregateTierColor` currently always returns `'gray'`. Phase 14 should update `deriveTierColors` Tier 4 line to compute from checklist completion state.
- `protection_checklist.health_coverage` enum (`'kantor' | 'bpjs' | 'pribadi' | 'kombinasi' | 'tidak'`) typed at `ProtectionChecklistRow` in `kesehatanTier1.ts` — Phase 14 may move to `src/db/protectionChecklist.ts` if it adds mutations.

### Resolved Open Questions

- **CONTEXT.md Open Question 2 (DIAG-06 stale notice):** Resolved via `IndikatorResult.compute.staleMonths?: number` — IndikatorCard renders amber badge `Stale Xbln` when set. Wave 2 13-03 `computePensiun` populates this field when `pension_simulations.updated_at` > 6 months ago.

## Self-Check: PASSED

**Files verified:**
- ✓ `src/components/ui/accordion.tsx`
- ✓ `src/queries/kesehatanTypes.ts`
- ✓ `src/queries/kesehatanIndikator.ts`
- ✓ `src/queries/kesehatanTier1.ts`
- ✓ `src/queries/kesehatanTier2.ts`
- ✓ `src/queries/kesehatanTier3.ts`
- ✓ `src/tabs/kesehatan/IndikatorCard.tsx`
- ✓ `src/tabs/kesehatan/TierPanel.tsx`
- ✓ `src/tabs/kesehatan/Tier1Panel.tsx`
- ✓ `src/tabs/kesehatan/Tier2Panel.tsx`
- ✓ `src/tabs/kesehatan/Tier3Panel.tsx`
- ✓ `src/tabs/kesehatan/Tier4Panel.tsx`
- ✓ `src/queries/kesehatan.ts` (modified)
- ✓ `src/tabs/kesehatan/PiramidaShell.tsx` (modified)
- ✓ `src/tabs/kesehatan/KesehatanLanding.tsx` (modified)

**Commits verified:**
- ✓ `481b0c6` (Task 1)
- ✓ `c098d9e` (Task 2)
- ✓ `3c92bd9` (Task 2.5)
- ✓ `7cf52ad` (Task 3)
