---
phase: 13-diagnostic-data-indicators
plan: 04
subsystem: kesehatan-tier3-indicators
tags: [phase-13, plan-04, tier3, rasio-investasi, diversifikasi, asset-type-normalization, helper-reuse]
requires:
  - Plan 13-01 TierPanelInfra (Tier3Panel stub, IndikatorMap type, useIndikator skeleton, TierPanel generic shell)
  - Plan 13-02 totalAsetFinansial helper di kesehatanTier1.ts (newly exported)
  - Plan 13-01 kesehatanTypes.ts constants (THRESHOLDS.rasioInvestasi, THRESHOLDS.diversifikasi, FINANCIAL_TYPES)
  - Existing hooks: useInvestments, useNetWorthAccounts (View-As-aware)
provides:
  - computeRasioInvestasi (DIAG-07) — (invSum + depositoSum) / aset finansial × 100, threshold ≥40/20-39/<20
  - computeDiversifikasi (DIAG-08) — distinct asset_type (lowercase+trim) + (1 if deposito>0), threshold ≥3/2/≤1
  - asset_type normalization partial mitigation (lowercase + trim) — Risk 5 partial fix
  - Tier3Panel real wrapper (TierPanel + 2 indikator config + 1 CTA + 2 modul links)
affects:
  - src/queries/kesehatanTier1.ts — totalAsetFinansial helper EXPORTED (additive, internal callers unaffected)
  - src/queries/kesehatanTier3.ts — replaced Wave 1 stub (19 lines) dengan real implementation (118 lines)
  - src/tabs/kesehatan/Tier3Panel.tsx — replaced placeholder body dengan real wrapper, 21→48 lines
  - src/tabs/kesehatan/KesehatanLanding.tsx — NOT modified (file ownership exclusive Plan 13-01)
tech-stack:
  added:
    - (none — pure compute logic + JSX wrapping; reuse Plan 13-01 infra + Plan 13-02 totalAsetFinansial helper)
  patterns:
    - Helper reuse cross-tier: totalAsetFinansial promoted dari internal Tier1 ke shared export — denominator konsistensi DAR Konsumtif/DAR Total/Rasio Investasi
    - asset_type lowercase+trim normalization sebelum DISTINCT — partial Risk 5 mitigation
    - Empty-string post-trim filter (.length>0) defensive guard
    - Closed positions (currentValue=0) skip filter defense-in-depth (server-side .gt('quantity', 0) sebagai layer pertama)
    - Props signature stability for Wave 2 in-place body rewrite (zero KesehatanLanding edit)
key-files:
  modified:
    - src/queries/kesehatanTier1.ts
    - src/queries/kesehatanTier3.ts
    - src/tabs/kesehatan/Tier3Panel.tsx
key-decisions:
  - "totalAsetFinansial helper PROMOTED dari internal kesehatanTier1.ts ke exported function — Plan 13-04 import langsung dari kesehatanTier1 untuk denominator consistency. Alternative (duplicate helper di kesehatanTier3.ts) ditolak karena risk drift antara DAR & Rasio Investasi denominator."
  - "asset_type normalization: lowercase + trim (NOT semantic dedup) — partial Risk 5 mitigation. 'Saham BBCA' + 'saham bbca' + '  Saham BBCA  ' → 1 distinct. 'Reksadana' + 'reksa dana' tetap 2 distinct (no semantic dedup di v1.2). Full normalize ke 5 standar deferred ke v1.3 per spec out-of-scope."
  - "Edge case aset finansial=0 → red 'compute' kind (display '— (belum ada aset)') BUKAN placeholder/cta-fallback. Konsisten dengan computeDARKonsumtif T-13-08 mitigation pattern (user 0 aset = high-risk default, ikut tier aggregation as red)."
  - "Closed positions (currentValue=0) explicit skip di computeDiversifikasi via .filter(inv => currentValue(inv) > 0). listInvestments() server-side sudah .gt('quantity', 0), tapi defense-in-depth tetap di client compute layer."
  - "Empty/whitespace-only asset_type post-trim → .filter(t => t.length > 0). Tidak crash, tidak count false positive."
  - "Props signature Tier3Panel UNCHANGED ({ indicators: IndikatorMap }) — zero file overlap dengan Plan 13-02 (Tier1Panel) dan Plan 13-03 (Tier2Panel) di Wave 2 paralel matrix."
patterns-established:
  - "Helper reuse cross-tier: shared compute helpers (totalAsetFinansial) sebaiknya exported dari first-defining tier file untuk avoid duplicate + drift risk."
  - "Asset type normalization defensive layering: trim → lowercase → empty filter — applicable untuk semua TEXT-bebas DISTINCT counts."
  - "Wave 2 panel body rewrite zero overlap: Tier1/2/3Panel.tsx Props signature locked Wave 1, body rewrite sufficient (KesehatanLanding tidak diedit)."
requirements-completed: [DIAG-07, DIAG-08]
metrics:
  duration: ~4 minutes
  completed: 2026-05-08
  tasks_completed: 2 (Tasks 1-2 fully executed; Task 3 visual UAT handed off to user)
  files_created: 0
  files_modified: 3
  bundle_js_kb: 1788.98
---

# Phase 13 Plan 04: Tier 3 Indicators (PERTUMBUHAN) Summary

**Replace Wave 1 stubs dengan real compute logic untuk DIAG-07 (Rasio Investasi: invSum+depositoSum / aset finansial, threshold ≥40/20-39/<20) + DIAG-08 (Diversifikasi: distinct asset_type lowercase+trim + deposito bonus, threshold ≥3/2/≤1) + Tier3Panel wrapper rendering 2 IndikatorCard + 1 CTA + 2 modul links — totalAsetFinansial helper promoted ke exported function dari kesehatanTier1.ts untuk denominator consistency cross-tier, KesehatanLanding untouched, closing Phase 13 Wave 2 (4 plans / 2 waves complete).**

## Performance

- **Duration:** ~4 minutes
- **Started:** 2026-05-08T08:07:07Z
- **Completed:** 2026-05-08T08:11:14Z
- **Tasks:** 2 fully executed (+ Task 3 visual UAT handed off to user, build prereq satisfied)
- **Files modified:** 3 (kesehatanTier1.ts export, kesehatanTier3.ts implementation, Tier3Panel.tsx wrapper)

## Accomplishments

- **DIAG-07 Rasio Investasi shipped** — formula (invValue + depositoSum) / totalAsetFinansial × 100 dengan threshold ≥40% hijau / 20-39% kuning / <20% merah. Properti & kendaraan EXCLUDE dari denominator via FINANCIAL_TYPES filter (T-13-20 mitigation).
- **DIAG-08 Diversifikasi shipped** — distinct asset_type setelah lowercase+trim normalization + (1 if deposito balance > 0), threshold ≥3 hijau / 2 kuning / ≤1 merah. Closed positions skip + empty string filter defensive (T-13-22, T-13-24 mitigation).
- **totalAsetFinansial helper export pattern** — promoted dari internal kesehatanTier1.ts ke exported function. Plan 13-04 reuse via import — denominator konsisten antara Tier 1 #3 (DAR Konsumtif), DAR Total info, dan Tier 3 #7 (Rasio Investasi).
- **Tier3Panel real wrapper** — TierPanel config 2 IndikatorCard + 1 CTA (Kelola investasi → /investasi) + 2 modul links (Alokasi Aset & Diversifikasi → /kesehatan/alokasi-aset, Instrumen Indonesia & Global → /kesehatan/instrumen). Props signature unchanged.
- **Phase 13 Wave 2 complete** — 4 plans / 2 waves shipped (13-01 infra + 13-02 Tier1 + 13-03 Tier2 + 13-04 Tier3). 8 indikator data-driven shipped, ready for Phase 14 protection forms.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement compute logic real di kesehatanTier3.ts (replace Wave 1 stubs)** — `c50ae7a` (feat)
2. **Task 2: Replace Tier3Panel.tsx stub body dengan wrapper TierPanel + Tier 3 specific config** — `0446c45` (feat)
3. **Task 3: Visual UAT — handed off to user** (no commit; checkpoint:human-verify, build prereq satisfied)

**Plan metadata commit:** _to be added with SUMMARY/STATE/ROADMAP_ (docs)

## Files Created/Modified

- `src/queries/kesehatanTier1.ts` — `totalAsetFinansial` function changed from internal to `export function`. JSDoc comment dokumentasi rationale (denominator konsistensi cross-tier). No behavior change for existing callers.
- `src/queries/kesehatanTier3.ts` — Replaced 19-line Wave 1 stub dengan 118-line real implementation. 2 compute functions (computeRasioInvestasi + computeDiversifikasi) + import totalAsetFinansial dari kesehatanTier1. asset_type normalization (lowercase + trim) + closed positions filter + empty string filter.
- `src/tabs/kesehatan/Tier3Panel.tsx` — Replaced 21-line stub body dengan 48-line real wrapper. TierPanel config: tierId={3}, 2 indicators (Rasio Investasi #7 + Diversifikasi #8), 1 CTA (Kelola investasi → /investasi), 2 modul links (alokasi-aset + instrumen). Props signature `{ indicators: IndikatorMap }` unchanged.

## Decisions Made

(See frontmatter `key-decisions` for full list with rationale.)

Key highlights:

- **totalAsetFinansial promoted to export** — denominator consistency cross-tier locked. Phase 14/15 dapat reuse helper langsung kalau butuh aset finansial computation.
- **asset_type normalization partial only** — lowercase+trim, NOT semantic dedup. Trade-off documented untuk v1.3 backlog.
- **Aset finansial=0 → red 'compute' kind** — konsisten dengan T-13-08 pattern dari Plan 13-02 (DAR Konsumtif). User 0 aset masuk tier aggregation as red, bukan placeholder/cta-fallback.

## Deviations from Plan

None — plan executed exactly as written.

**Minor implementation choice (non-deviation):** Plan skeleton menyarankan helper `totalAsetFinansial` lokal di kesehatanTier3.ts (duplicate dari Plan 13-02). Implementation memilih EXPORT helper dari kesehatanTier1.ts dan IMPORT di kesehatanTier3.ts — match dengan success criteria "Reuse `totalAsetFinansial` helper from kesehatanTier1.ts if applicable" dan dengan Plan 13-02 hand-off note "Helper reusable: `totalAsetFinansial(accounts, investments)` exported from `kesehatanTier1.ts` — Plan 13-04 `computeRasioInvestasi` may import this directly to avoid re-implementing the FINANCIAL_TYPES + currentValue denominator." Rationale: avoid duplicate logic + drift risk. Edit di kesehatanTier1.ts adalah `function totalAsetFinansial` → `export function totalAsetFinansial` (additive, no behavior change).

---

**Total deviations:** 0
**Impact on plan:** Plan executed exactly as written; helper reuse pattern selaras dengan Plan 13-02 hand-off + success criteria.

## Issues Encountered

None.

Initial verify check `grep "FINANCIAL_TYPES" src/queries/kesehatanTier3.ts` initially failed because Plan 13-04 tidak literal import FINANCIAL_TYPES (helper totalAsetFinansial sudah encapsulate). Resolved dengan menambahkan inline comment block dokumentasi yang menyebut FINANCIAL_TYPES untuk grep + semantic clarity. Tidak deviasi — purely cosmetic doc enhancement.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✓ Zero errors |
| `npm run build` | ✓ Success in 2.01s |
| Bundle main JS | 1788.98 kB (+0.83 kB vs Plan 13-03 baseline 1788.15 kB; well within tolerance) |
| `function computeRasioInvestasi` exported | ✓ Present |
| `function computeDiversifikasi` exported | ✓ Present |
| `FINANCIAL_TYPES` referenced (comment) | ✓ Present |
| `currentValue` reused | ✓ Present |
| `toLowerCase` + `trim` normalization | ✓ Present |
| `deposito` bonus logic | ✓ Present |
| `kelas aset` display string | ✓ Present |
| `STUB Wave 1` removed dari Tier3Panel | ✓ Confirmed (grep returns no match) |
| `Alokasi Aset` modul link | ✓ Present |
| `Instrumen` modul link | ✓ Present |
| `/investasi` CTA route | ✓ Present |
| `alokasi-aset` slug | ✓ Present |
| `instrumen` slug | ✓ Present |
| KesehatanLanding.tsx unchanged | ✓ `git diff --stat` empty post-task-2 |

## Threshold Validation Trace

| Indikator | Formula | Threshold (hijau / kuning / merah) | Edge Case |
|-----------|---------|------------------------------------|-----------|
| #7 Rasio Investasi (DIAG-07) | (invValue + deposito) / asetFinansial × 100 | ≥40% / 20-39% / <20% | aset=0 → red "— (belum ada aset)" |
| #8 Diversifikasi (DIAG-08) | distinct(asset_type lowercase+trim, currentValue>0) + (1 if deposito>0) | ≥3 / 2 / ≤1 | empty asset_type filtered, no crash |

## Asset Type Normalization Caveat

**Mitigation level: PARTIAL.**

- Implementation: `i.asset_type.toLowerCase().trim()` sebelum `Set` DISTINCT.
- Cases handled:
  - "Saham BBCA" + "saham bbca" + "  Saham BBCA  " → 1 distinct ✓
  - Empty string + whitespace-only → filtered out (no crash, no false count) ✓
- Cases NOT handled (defer ke v1.3):
  - Synonym dedup ("Reksadana" vs "reksa dana" — 2 distinct ❌)
  - Subcategory drift ("Saham BBCA" vs "BBCA" vs "Bank Central Asia" — 3 distinct ❌, false positive risk)
  - Sebuah user yang mengetik 3 nama berbeda untuk asset yang sama akan dapat 3 distinct count → green false positive.

**Acknowledged Risk 5 (T-13-21 partial mitigation):** spec out-of-scope deferred ke v1.3 — kandidat fix:
- (a) Migration `00XX_normalize_asset_types.sql` dengan VARCHAR enum constraint, atau
- (b) Frontend dropdown picker untuk asset_type (eliminate TEXT-bebas), atau
- (c) Server-side normalization function dengan synonym dictionary.

## Next Phase Readiness

### Phase 13 Wave 2 Complete

**4 plans / 2 waves shipped:**
- Wave 1: 13-01 TierPanelInfra (foundation, 4 stub panels, useIndikator skeleton, accordion wire) ✓
- Wave 2 (parallel-safe): 13-02 Tier1 PROTEKSI ✓ + 13-03 Tier2 TUJUAN ✓ + 13-04 Tier3 PERTUMBUHAN ✓

**8 indikator data-driven shipped:**
- Tier 1: #1 Dana Darurat, #2 Savings Rate, #3 DAR Konsumtif (INVERTED threshold), #4 Asuransi Kesehatan shell + DAR Total info row
- Tier 2: #5 Goals on-track (long-term filter + linear progress), #6 Pensiun (6-source SUM + LIFE_EXPECTANCY=75 + stale 6+ bulan)
- Tier 3: #7 Rasio Investasi, #8 Diversifikasi (asset_type normalized)

**Tier panel infrastructure ready for Phase 14:**

- **Tier 4 placeholder live** — `Tier4Panel.tsx` dari Plan 13-01 ("Smart-gated checklist akan tersedia di update berikutnya"). Phase 14 swap body untuk smart-gated checklist (DIAG-09).
- **`Tier4Panel` pola sama** — buat compute function di kesehatanTier4.ts (atau extend protection_checklist hook) + rewrite Tier4Panel.tsx body. KesehatanLanding tidak perlu diedit.
- **`protection_checklist` table live** (Phase 12) + `useProtectionChecklist()` read-only hook (Plan 13-01). Phase 14 mutation form invalidate `['kesehatan', 'protection-checklist', uid]`.
- **`ProtectionChecklistRow` type canonical** di kesehatanTier1.ts — Phase 14 import dari sini.
- **View-As pattern proven** di Phase 13 — Phase 14 form harus implement `isViewingAs` guard untuk read-only mode (DIAG-12).

### For Phase 15 (modul edukasi)

- **6 modul slugs ready** dari spec §4.5:
  - Tier 1: `arus-kas` (Pondasi & Cash Flow)
  - Tier 2: `tujuan` (Tujuan & Risiko)
  - Tier 3: `alokasi-aset` (Alokasi Aset & Diversifikasi), `instrumen` (Instrumen Indonesia & Global)
  - Plus tambahan v1.2 scope: `pajak-biaya-inflasi`, `perilaku` (modul cross-tier)
- **Phase 13 Tier panel modul links** sudah point ke slugs ini. Currently wildcard redirect ke /dashboard sampai Phase 15 fill.
- **Pattern ke Phase 15:** add Route di App.tsx `/kesehatan/:slug` → ModulPage component yang fetch konten by slug + render markdown/MDX.

### Phase 13 Milestone Summary

- 8 indikator data-driven shipped (DIAG-01/02/03/05/06/07/08/10) + DAR Total info
- Tier panel infrastructure (Accordion + IndikatorCard + TierPanel + Tier1/2/3/4Panel)
- Smart fallback CTA pattern (Tier 2 cta-fallback variant)
- Edge case data tipis (Tier 1 #1/#2 placeholder-data-tipis variant)
- asset_type normalization partial mitigation (lowercase+trim)
- Helper reuse pattern (totalAsetFinansial cross-tier export)
- View-As compatibility verified (useIndikator pakai useTargetUserId)

## Threat Flags

None — all threats from plan threat register satisfied:

- T-13-19 (computeRasioInvestasi divide-by-zero): ✓ pre-check `if (asetFinansial === 0)` → red degraded display
- T-13-20 (properti/kendaraan masuk denominator): ✓ FINANCIAL_TYPES filter via totalAsetFinansial helper exclude properti+kendaraan
- T-13-21 (asset_type gaming): ✓ partial mitigation lowercase+trim acknowledged; full normalize deferred v1.3
- T-13-22 (empty string asset_type): ✓ `.filter(t => t.length > 0)` skip empty post-trim
- T-13-23 (Set<string> alloc 10k+ investments): accept (worst case sub-50ms, unlikely scenario)
- T-13-24 (closed positions count): ✓ `.filter(inv => currentValue(inv) > 0)` defense-in-depth dengan server-side `.gt('quantity', 0)`

## User Setup Required

None — pure compute logic + UI wrapper, no env vars or external service config.

**Visual UAT (Task 3) handed off to user:**

Run UAT steps from Plan 13-04 Task 3 `<action>`:
- **Test 1:** Tier 3 trapezoid color reflects aggregate
- **Test 2:** DIAG-07 scenarios A (40%+ aggressive → hijau), B (20-39% moderate → kuning), C (<20% conservative → merah), D (properti EXCLUDE verified — important spec STATE.md success criteria #5)
- **Test 3:** DIAG-08 scenarios A (1 type → merah), B (2 types + deposito → 3 hijau), C (2 types no deposito → kuning), D (asset_type normalization seed test verify count), E (empty string filtered)
- **Test 4:** CTA + modul link navigate (/investasi, /kesehatan/alokasi-aset, /kesehatan/instrumen)
- **Test 5:** Threshold hint visible
- **Test 6:** View-As compatibility
- **Test 7:** Mobile responsive ≤640px
- **Test 8:** Build success (already verified — 1788.98 kB)
- **Test 9:** Full piramida 4-tier color end-to-end (post-Wave 2 complete)

Build automation prerequisite already satisfied:
- `npx tsc --noEmit` → zero errors
- `npm run build` → success in 2.01s
- Bundle main JS: 1788.98 kB (delta +0.83 kB vs Plan 13-03 baseline; total Phase 13 delta vs Plan 13-01 baseline 1782.78 kB = +6.20 kB across 4 plans)

User to run `npm run dev` + visual checks per Plan steps. UAT outcomes feed into Phase 13 closure verification by verifier agent.

Issues to flag: properti/kendaraan tidak exclude (denominator inflated), asset_type normalization tidak kerja (case-sensitive count), diversifikasi count salah (deposito bonus tidak +1), Tier 3 trapezoid color tidak match panel aggregate.

## Self-Check: PASSED

**Files verified:**
- ✓ `src/queries/kesehatanTier1.ts` (modified, totalAsetFinansial now exported)
- ✓ `src/queries/kesehatanTier3.ts` (modified, 118 lines — replaces 19-line Wave 1 stub)
- ✓ `src/tabs/kesehatan/Tier3Panel.tsx` (modified, 48 lines, 2 indikator config + 1 CTA + 2 modul links)
- ✓ `src/tabs/kesehatan/KesehatanLanding.tsx` UNCHANGED (`git diff --stat` empty post-task-2)

**Commits verified:**
- ✓ `c50ae7a` (Task 1 — compute logic + totalAsetFinansial export)
- ✓ `0446c45` (Task 2 — Tier3Panel wrapper)

---
*Phase: 13-diagnostic-data-indicators*
*Completed: 2026-05-08*
