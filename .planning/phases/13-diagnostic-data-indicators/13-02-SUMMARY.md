---
phase: 13-diagnostic-data-indicators
plan: 02
subsystem: kesehatan-tier1-indicators
tags: [phase-13, plan-02, tier1, dana-darurat, savings-rate, dar-konsumtif, asuransi-shell, dar-total, edge-case-data-tipis]
requires:
  - Plan 13-01 TierPanelInfra (Tier1Panel stub, IndikatorMap type, DARTotalInfo type, useIndikator skeleton, TierPanel generic shell)
  - kesehatanTypes.ts constants (THRESHOLDS, LIQUID_TYPES, FINANCIAL_TYPES, KONSUMTIF_LIAB_TYPES)
  - Existing hooks: useTransactions (filtered dateFrom 3mo), useNetWorthAccounts, useNetWorthLiabilities, useInvestments, useProtectionChecklist
provides:
  - computeDanaDarurat (DIAG-01) — bulan dana darurat, threshold ≥6/3-5/<3
  - computeSavingsRate (DIAG-02) — per-bulan rate avg 3 bulan, threshold ≥20/10-19/<10
  - computeDARKonsumtif (DIAG-03) — INVERTED threshold <20 hijau / 20-40 kuning / >40 merah
  - computeDARTotal — info-only with kprFraction for KPR vs non-KPR contextualization
  - computeAsuransiShell (DIAG-04 partial) — read protection_checklist.health_coverage with Indonesian labels
  - distinctMonths helper (substring(0,7) calendar grouping for DIAG-10 edge case)
  - totalAsetFinansial helper (FINANCIAL_TYPES + investments currentValue)
  - ProtectionChecklistRow type (single source of truth, Phase 14 mutation form akan import dari sini)
  - Tier1Panel real wrapper (TierPanel + 4 indikator config + DAR Total infoSlot + 2 CTA + 1 modul link)
affects:
  - src/queries/kesehatanTier1.ts (replaced stub with real implementation, 33→285 lines)
  - src/tabs/kesehatan/Tier1Panel.tsx (replaced placeholder body with real wrapper, 27→73 lines)
  - src/tabs/kesehatan/KesehatanLanding.tsx — NOT modified (file ownership exclusive Plan 13-01)
tech-stack:
  added:
    - (none — pure compute logic + JSX wrapping; reuse Plan 13-01 infra)
  patterns:
    - Distinct calendar month grouping via Set<YYYY-MM> + sorted last-3 slice (DIAG-10)
    - Per-month savings rate avg (avoid -Infinity from /0 income)
    - Aset finansial denominator helper shared between DAR Konsumtif + future Rasio Investasi
    - Indonesian label map for enum (HEALTH_COVERAGE_LABEL) — fail-safe display layer
    - Props signature stability for Wave 2 in-place body rewrite (zero KesehatanLanding edit)
key-files:
  modified:
    - src/queries/kesehatanTier1.ts
    - src/tabs/kesehatan/Tier1Panel.tsx
decisions:
  - "Distinct months filter via t.date.substring(0,7) into Set<string>, then sorted slice(-3) — handles non-consecutive months correctly (Jan/Mar with Feb skipped → length=2 → placeholder)."
  - "T-13-07 mitigation chosen: avgExpense=0 returns placeholder-data-tipis (not red) — user with 3 calendar months but all 0 expense is 'belum representatif' rather than 'high risk'."
  - "T-13-08 mitigation: asetFinansial=0 returns red 'compute' kind (not placeholder) with display '— (perlu aset)' — tetap ikut tier aggregation as red since user with no assets is genuine high-risk default."
  - "T-13-10 mitigation: INVERTED threshold encoded explicitly with `pct < green` and `pct <= yellow` — boundary semantics: 19% green, 20% yellow, 40% yellow, 41% red."
  - "computeDARTotal returns null (not 0%) when total liabilities = 0 OR aset = 0 — Tier1Panel infoSlot conditionally renders only when meaningful data exists."
  - "ProtectionChecklistRow type re-exported from kesehatanTier1.ts (single source); Phase 14 mutation hook imports from here. Avoids duplicate type definitions when Phase 14 lands."
  - "kprFraction contextualization tier in Tier1Panel: >0.5 = mayoritas KPR, 0..0.5 = campuran, 0 = tanpa KPR — three-band display matches spec §4 narrative guidance."
metrics:
  duration: ~4 minutes
  completed: 2026-05-08
  tasks_completed: 2 (Tasks 1-2 fully executed; Task 3 visual UAT handed off to user)
  files_created: 0
  files_modified: 2
  bundle_js_kb: 1785.70
---

# Phase 13 Plan 02: Tier 1 Indicators (PROTEKSI) Summary

**One-liner:** Replace Wave 1 stubs with real compute logic for DIAG-01/02/03/10 + Tier 1 #4 shell, plus Tier1Panel wrapper rendering 4 IndikatorCard + DAR Total info row + 2 CTA + 1 modul link — KesehatanLanding untouched, opening parallel Wave 2 Plan 13-03/13-04 with zero file overlap.

## What Shipped

### 1. Tier 1 Compute Logic (Task 1 — `src/queries/kesehatanTier1.ts`)

Replaced Wave 1 stub (33 lines, all returning placeholder-data-tipis) with real implementation (285 lines, 5 compute functions + 2 helpers).

**Five compute functions:**

| Function | Spec ID | Formula | Threshold | Edge Case |
|----------|---------|---------|-----------|-----------|
| `computeDanaDarurat` | DIAG-01 | SUM(akun likuid) ÷ avg(expense 3mo) | ≥6 hijau · 3-5 kuning · <3 merah | <3 calendar months OR avgExpense=0 → placeholder-data-tipis |
| `computeSavingsRate` | DIAG-02 | per-month (income-expense)/income avg ÷ 3 | ≥20% hijau · 10-19% kuning · <10% merah | <3 calendar months → placeholder-data-tipis; income=0 in month → rate=0 (avoid -Inf) |
| `computeDARKonsumtif` | DIAG-03 | konsumtif/asetFinansial × 100 | **INVERTED** <20 hijau · 20-40 kuning · >40 merah | aset=0 → red "— (perlu aset)" (compute kind, ikut aggregation) |
| `computeDARTotal` | (info) | total liab/asetFinansial × 100 + kprFraction | (no color — info-only) | aset=0 OR total=0 → returns null |
| `computeAsuransiShell` | DIAG-04 partial | read protection_checklist.health_coverage | covered → green · null/'tidak' → red | row null OR health_coverage null → "Belum diisi" red |

**Helpers:**

- `distinctMonths(transactions, filterType?)` — Set<YYYY-MM> via `t.date.substring(0,7)`, sorted return. Handles non-consecutive months correctly.
- `totalAsetFinansial(accounts, investments)` — FINANCIAL_TYPES + currentValue(inv) sum. Shared between DAR Konsumtif (Plan 13-02) and future Rasio Investasi (Plan 13-04).

**Type re-export:** `ProtectionChecklistRow` moved from Wave 1 stub to canonical export here (single source of truth). Phase 14 mutation form akan import dari sini.

**Indonesian label map:** `HEALTH_COVERAGE_LABEL` translates enum (`kantor` | `bpjs` | `pribadi` | `kombinasi` | `tidak`) → display strings (`Dari kantor` | `BPJS pribadi` | etc.). T-13-09 mitigation: display layer fail-safe — never expose raw enum value.

### 2. Tier1Panel Real Wrapper (Task 2 — `src/tabs/kesehatan/Tier1Panel.tsx`)

Replaced Wave 1 stub body (placeholderText only) with TierPanel wrapper consuming `IndikatorMap` + `DARTotalInfo`. Props signature unchanged (zero file overlap with Plan 13-03/13-04).

**Configuration passed to TierPanel:**

- `tierId={1}`
- `indicators` array (4 entries):
  - Dana Darurat — hint "≥ 6 bulan hijau · 3-5 kuning · < 3 merah" → indicators['1']
  - Savings Rate — hint "≥ 20% hijau · 10-19% kuning · < 10% merah" → indicators['2']
  - DAR Konsumtif — hint "< 20% hijau · 20-40% kuning · > 40% merah" → indicators['3']
  - Asuransi Kesehatan — hint "Covered (kantor/BPJS/pribadi/kombinasi) hijau · belum diisi atau tidak covered merah" → indicators['4']
- `infoSlot` — DAR Total contextualized:
  - kprFraction > 0.5 → "X% (mayoritas KPR — beban rumah)"
  - 0 < kprFraction ≤ 0.5 → "X% (campuran KPR & utang konsumtif)"
  - kprFraction = 0 → "X% (tanpa KPR)"
  - darTotalInfo === null → infoSlot undefined (not rendered)
- `ctas` array:
  - { label: 'Kelola akun & utang', to: '/kekayaan', variant: 'default' }
  - { label: 'Catat transaksi', to: '/transaksi', variant: 'outline' }
- `modulLinks`:
  - { label: 'Pondasi & Cash Flow', slug: 'arus-kas' } → /kesehatan/arus-kas

**File ownership preserved:** `KesehatanLanding.tsx` zero diff verified post-task-2 (`git diff --stat` empty). Plan 13-01 already wired `<Tier1Panel indicators={...} darTotalInfo={...} />` in `renderTierContent`.

### 3. Visual UAT (Task 3 — handed off to user)

Task 3 is `checkpoint:human-verify` — Steps 1-9 (tier color aggregation, accordion slide, 4 IndikatorCard render, edge case data tipis, DAR Total info row, CTA navigation, View-As compatibility, mobile responsive, build delta) documented in 13-02-PLAN.md `<action>`. Build automation prerequisite already satisfied:

- `npx tsc --noEmit` → zero errors
- `npm run build` → success in 2.32s
- Bundle main JS: 1785.70 kB (delta +2.92 kB vs Plan 13-01 baseline 1782.78 kB; well within <15 kB tolerance)

User to run `npm run dev` + visual checks per Plan steps. UAT outcomes feed into Phase 13 closure verification by verifier agent.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✓ Zero errors |
| `npm run build` | ✓ Success in 2.32s |
| Bundle main JS | 1785.70 kB (+2.92 kB vs Plan 13-01) |
| 5 compute functions exported | ✓ computeDanaDarurat, computeSavingsRate, computeDARKonsumtif, computeDARTotal, computeAsuransiShell |
| `expenseMonths.length < 3` placeholder branch | ✓ Present (DIAG-10) |
| `last3Months` slice + filter pattern | ✓ Present in #1 and #2 |
| INVERTED threshold encoded explicitly | ✓ `pct < THRESHOLDS.darKonsumtif.green` and `pct <= THRESHOLDS.darKonsumtif.yellow` |
| `kprFraction` returned from computeDARTotal | ✓ Present + contextualized in Tier1Panel |
| Tier1Panel grep `Pondasi & Cash Flow` | ✓ Present |
| Tier1Panel grep `/kekayaan` + `/transaksi` + `arus-kas` | ✓ All present |
| Tier1Panel grep `DAR Total kamu` | ✓ Present |
| Tier1Panel "STUB Wave 1" removed | ✓ Confirmed (grep returns no match) |
| KesehatanLanding.tsx unchanged | ✓ `git diff --stat` empty |

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `2dace56` | feat(13-02): implement Tier 1 compute logic (DIAG-01/02/03/10 + #4 shell) |
| 2 | `2d28f06` | feat(13-02): wire Tier1Panel real implementation (4 indikator + DAR Total + 2 CTA + modul link) |

## Deviations from Plan

None — plan executed exactly as written. All compute formulas, threshold semantics, edge case handling, and Tier1Panel configuration match Plan 13-02 source verbatim.

## Threat Flags

None — all threats from plan threat register (T-13-07 through T-13-12) have explicit mitigations encoded in code (avgExpense=0 guard, asetFinansial=0 guard, INVERTED threshold explicit operators, Indonesian label map, caller-side skeleton guard inherited from Plan 13-01, distinctMonths Set allocation cost accepted).

## Hand-off Notes

### For Wave 2 Parallel Plans (13-03 / 13-04)

Plan 13-02 owns `kesehatanTier1.ts` + `Tier1Panel.tsx` exclusively. Wave 2 Plan 13-03 (Tier 2 indicators DIAG-05/06) and Plan 13-04 (Tier 3 indicators DIAG-07/08) target separate files (`kesehatanTier2.ts`/`Tier2Panel.tsx`, `kesehatanTier3.ts`/`Tier3Panel.tsx`) per file-ownership matrix locked in Plan 13-01 SUMMARY. **Zero file conflict** — they can run in parallel worktrees safely.

**Pattern established for Tier2Panel/Tier3Panel:** Wrap `<TierPanel tierId={N} indicators={[...]} ctas={[...]} modulLinks={[...]} infoSlot={optional} />`. Props shape `{ indicators: IndikatorMap }` (Tier 1 also gets `darTotalInfo`).

**Helper reusable:** `totalAsetFinansial(accounts, investments)` exported from `kesehatanTier1.ts` — Plan 13-04 `computeRasioInvestasi` may import this directly to avoid re-implementing the FINANCIAL_TYPES + currentValue denominator.

### For Phase 14 (DIAG-04 mutation form + DIAG-09 Tier 4 checklist)

- **`ProtectionChecklistRow` type** is canonically exported from `src/queries/kesehatanTier1.ts`. Phase 14 mutation hook should import from here. If Phase 14 needs to extend with `has_dependents`, `life_*`, `estate_*` fields, prefer either:
  - (a) extend type definition in-place (kesehatanTier1.ts owns), or
  - (b) move to `src/db/protectionChecklist.ts` and re-export from kesehatanTier1.ts (preserves consumer imports).
- **`computeAsuransiShell` reads-only** — Phase 14 mutation just needs to invalidate `['kesehatan', 'protection-checklist', uid]` query key (already wired in Plan 13-01 `useProtectionChecklist`).
- **Tier 1 #4 indicator** transitions from "Belum diisi" red → green dengan label Indonesian saat user submit form Phase 14. Reactivity automatic via React Query invalidation.

### For User UAT (Task 3 handoff)

Run UAT steps from Plan 13-02 Task 3 `<action>`:
- Test 1-3: tier color aggregation + accordion slide + 4 IndikatorCard render
- Test 3.1: threshold hint text
- Test 4: edge case data tipis (DIAG-10) — simulate via account dengan transaksi <3 bulan kalender
- Test 5: DAR Total info row contextualization (mayoritas KPR / campuran / tanpa KPR)
- Test 6: CTA navigation (/kekayaan, /transaksi, /kesehatan/arus-kas)
- Test 7: View-As compatibility (admin saw viewed-user data)
- Test 8: Mobile responsive ≤640px
- Test 9: Build success + bundle delta (already verified)

Issues to flag: tier color mismatch panel aggregate, animation jerky, label/hint typo, edge case bypass, kprFraction display salah, View-As bocor data.

## Self-Check: PASSED

**Files verified:**
- ✓ `src/queries/kesehatanTier1.ts` (modified, 285 lines, all 5 compute functions + 2 helpers + ProtectionChecklistRow type + HEALTH_COVERAGE_LABEL map)
- ✓ `src/tabs/kesehatan/Tier1Panel.tsx` (modified, 73 lines, 4 indikator config + infoSlot + 2 CTA + 1 modul link)
- ✓ `src/tabs/kesehatan/KesehatanLanding.tsx` UNCHANGED (`git diff --stat` empty post-task-2)

**Commits verified:**
- ✓ `2dace56` (Task 1 — compute logic)
- ✓ `2d28f06` (Task 2 — Tier1Panel wrapper)
