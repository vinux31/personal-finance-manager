# Phase 13: Diagnostic Data Indicators — Context

**Gathered:** 2026-05-08
**Status:** Ready for planning
**Source:** Design spec `docs/superpowers/specs/2026-05-08-framework-page-design.md` (commit `b219fc3`) §4 — semua formula, threshold, CTA mapping, fallback rules sudah locked di spec; CONTEXT.md ini hanya capture decisions implementation yang spec tidak define.

<domain>
## Phase Boundary

**This phase delivers:**
- Tier panel expand interaction — klik tier piramida di `/kesehatan` → Accordion panel slide-down menampilkan indikator hidup
- 8 indikator data-driven (DIAG-01..03, 05..08) computed dari Supabase data via existing query hooks + `useMemo` derive
- DAR Total info di Tier 1 panel (bukan indikator warna)
- Tier color aggregation: hijau/kuning/merah/abu-abu sesuai spec §4
- Smart fallback CTA cards untuk #5 (no long-term goal) & #6 (no pension simulation, plus stale-6mo notice)
- Edge case data tipis untuk #1 & #2: placeholder "Butuh 3 bulan data, sudah X/3"
- CTA mapping per spec §4.5 (Tier 1/2/3) — link ke route + modul
- Tier 4 panel placeholder (smart-gated checklist deliver di Phase 14)
- View-As compatibility: indikator pakai `useTargetUserId()` data viewed-user

**This phase does NOT deliver:**
- Tier 1 #4 inline checklist Asuransi Kesehatan (mutation form) — Phase 14 (DIAG-04). Phase 13 hanya tampil shell "covered/tidak covered" placeholder atau read state dari `protection_checklist.health_coverage` kalau row exist.
- Tier 4 smart-gated checklist mutation — Phase 14 (DIAG-09)
- View-As read-only mode untuk forms — Phase 14 (DIAG-12) deliver bersamaan dengan form
- 6 modul edukasi sub-route content — Phase 15
- Kalkulator compound interest — Phase 15

**Why this is now:** Phase 12 sudah deliver landing shell + protection_checklist table. Phase 14 butuh tier panel infrastructure (DIAG-09 Tier 4 → expand + checklist) — Phase 13 wire panel + indicators dulu, Phase 14 inject form mutations.

</domain>

<decisions>
## Implementation Decisions (Locked)

### B. Compute Strategy: Hybrid (extend existing hooks + useMemo derive)

**Decision:** Extend existing query hooks dengan client-side derivation. Zero schema change. Reuse cache + auto-invalidation dari existing mutations.

**Files:**
- `src/queries/kesehatan.ts` (existing, dari Phase 12) — tambah `useIndikator()` + 8 compute functions
- Reuse existing hooks: `useTransactions`, `useNetWorth` (atau `useNetWorthAccounts`), `useGoals`, `useInvestments`, `usePensiun`

**Skeleton:**
```ts
export function useIndikator() {
  const tx = useTransactions()
  const nw = useNetWorth()
  const goals = useGoals()
  const inv = useInvestments()
  const pens = usePensiun()

  return useMemo(() => {
    if (tx.isLoading || nw.isLoading || goals.isLoading || inv.isLoading || pens.isLoading) {
      return { isLoading: true, indicators: null }
    }
    return {
      isLoading: false,
      indicators: {
        '1': computeDanaDarurat(tx.data, nw.data),
        '2': computeSavingsRate(tx.data),
        '3': computeDARKonsumtif(nw.data, inv.data),
        '4': computeAsuransiShell(),  // Phase 13 = shell only, baca protection_checklist kalau row exist
        '5': computeGoalsOnTrack(goals.data),  // returns 'cta-fallback' kalau no long-term goal
        '6': computePensiun(pens.data),         // returns 'cta-fallback' kalau no row, + stale notice kalau >6mo
        '7': computeRasioInvestasi(inv.data, nw.data),
        '8': computeDiversifikasi(inv.data, nw.data),
      },
      darTotalInfo: computeDARTotal(nw.data),  // info-only, bukan indikator warna
    }
  }, [tx, nw, goals, inv, pens])
}
```

**Indicator return type:**
```ts
type IndikatorResult =
  | { kind: 'compute', value: number, color: 'green' | 'yellow' | 'red', display: string }
  | { kind: 'placeholder-data-tipis', monthsAvailable: number, ctaTo: string }  // #1, #2 only
  | { kind: 'cta-fallback', message: string, ctaLabel: string, ctaTo: string }  // #5, #6 only
```

**Tier color aggregation** (helper function di same file):
```ts
function aggregateTierColor(indicators: IndikatorResult[]): 'green' | 'yellow' | 'red' | 'gray' {
  const computed = indicators.filter(i => i.kind === 'compute')
  if (computed.length === 0) return 'gray'  // semua placeholder/fallback
  if (computed.some(i => i.color === 'red')) return 'red'
  if (computed.some(i => i.color === 'yellow')) return 'yellow'
  return 'green'
}
```

**Trade-off accepted:** Client-side compute sedikit lebih heavy untuk user dengan banyak transaksi (>10k rows agregasi 3-bulan-avg). Pfm-web user tipikal <500 tx/3bln → fine. Kalau performance jadi issue post-rilis, migrate ke RPC `compute_indicators(uid)` di phase berikutnya tanpa break consumer (`useIndikator()` interface tetap).

### A. Tier Panel UX: Single-Open + shadcn Accordion

**Decision:** Pakai `shadcn/ui Accordion` dengan `type="single" collapsible`. Klik tier baru auto-close tier lama. Built-in animation, keyboard nav, ARIA proper.

**Setup:**
- Add `src/components/ui/accordion.tsx` via shadcn CLI atau manual port (radix-ui umbrella sudah di deps `package.json`)
- Tidak perlu tambah dependency baru — `radix-ui ^1.4.3` sudah include `@radix-ui/react-accordion`

**Pattern:**
```tsx
<Accordion type="single" collapsible value={openTier} onValueChange={setOpenTier}>
  <AccordionItem value="tier-4">
    <AccordionTrigger>
      <PiramidaTier id={4} colorBadge={tierColors.tier4} subtitleBadge={...} />
    </AccordionTrigger>
    <AccordionContent>
      <TierPanel tier={4} />  {/* Phase 13: placeholder; Phase 14: actual checklist */}
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="tier-3">...</AccordionItem>
  <AccordionItem value="tier-2">...</AccordionItem>
  <AccordionItem value="tier-1">...</AccordionItem>
</Accordion>
```

**PiramidaShell extend** (dari Phase 12 grayed shell jadi colored interactive):
- Existing variant `default` & `grayed-empty` tetap (untuk DIAG-11 empty state)
- Tambah variant `active` (atau prop `tierColors`) untuk warna hijau/kuning/merah/abu-abu per tier
- Trapezoid existing tetap dengan `clip-path` — tinggal swap `bg-gray-300` jadi color class dynamic

**Visual continuity:** Klik trapezoid yang sudah jadi AccordionTrigger → animation slide-down inline (bukan modal). Mempertahankan piramida visual context.

### C. Plan Breakdown: By Tier (4 plans, 2 waves)

**Decision:** 4 plans split by responsibility/tier, 2 waves dengan parallelism di Wave 2.

**Wave 1** (1 plan, sequential):
- **13-01 — TierPanelInfra**
  - Add shadcn Accordion component file
  - Extend PiramidaShell variant: support `tierColors` prop dynamic color per tier
  - Buat `IndikatorCard.tsx` reusable (untuk semua 8 indikator)
  - Buat `TierPanel.tsx` shell yang render indikator cards + info row + CTA row + modul link
  - Buat `useIndikator()` skeleton hook + helper `aggregateTierColor()` + `useTargetUserId()` wiring
  - Tier color aggregation logic + tipe `IndikatorResult` exported
  - Wire Accordion ke piramida (tapi indikator masih placeholder/skeleton — Wave 2 isi)
  - **Files:** `src/components/ui/accordion.tsx`, `src/tabs/kesehatan/PiramidaShell.tsx` (modify), `src/tabs/kesehatan/TierPanel.tsx` (new), `src/tabs/kesehatan/IndikatorCard.tsx` (new), `src/queries/kesehatan.ts` (extend dengan skeleton), `src/tabs/kesehatan/KesehatanLanding.tsx` (modify wire)
  - **Requirements:** STRAT-03 (panel infra)

**Wave 2** (3 plans, parallel worktree-isolated):
- **13-02 — Tier 1 Indicators**
  - Implement `computeDanaDarurat`, `computeSavingsRate`, `computeDARKonsumtif`, `computeDARTotal`
  - Implement `computeAsuransiShell` (read protection_checklist row kalau exist, else placeholder "belum diisi")
  - Edge case data tipis untuk #1 & #2: detect months calendar distinct via transactions data, return `{ kind: 'placeholder-data-tipis', monthsAvailable }` kalau <3 bulan
  - Wire Tier 1 panel: 4 IndikatorCard (#1 #2 #3 #4) + DAR Total info row + 2 CTA (Kelola akun → /kekayaan, Catat transaksi → /transaksi) + modul link "Pondasi & Cash Flow"
  - **Files:** `src/queries/kesehatan.ts` (compute functions), `src/tabs/kesehatan/Tier1Panel.tsx` (atau extend TierPanel dengan tier-specific config)
  - **Requirements:** DIAG-01, DIAG-02, DIAG-03, DIAG-10

- **13-03 — Tier 2 Indicators + Smart Fallback**
  - Implement `computeGoalsOnTrack` (filter long-term, linear progress check, smart fallback `cta-fallback` kalau no long-term goal active)
  - Implement `computePensiun` (proyeksi/target ratio, smart fallback kalau no pension_simulations row, stale notice 6+ bulan)
  - Wire Tier 2 panel: 2 IndikatorCard (#5 #6) + 2 CTA (Kelola Goals → /goals, Simulasi pensiun → /pensiun) + modul link "Tujuan & Risiko"
  - **Files:** `src/queries/kesehatan.ts`, `src/tabs/kesehatan/Tier2Panel.tsx`
  - **Requirements:** DIAG-05, DIAG-06

- **13-04 — Tier 3 Indicators**
  - Implement `computeRasioInvestasi` (investments + deposito) ÷ aset finansial
  - Implement `computeDiversifikasi` (DISTINCT asset_type + (1 if deposito > 0))
  - Wire Tier 3 panel: 2 IndikatorCard (#7 #8) + 1 CTA (Kelola investasi → /investasi) + modul link ("Alokasi Aset" + "Instrumen")
  - **Files:** `src/queries/kesehatan.ts`, `src/tabs/kesehatan/Tier3Panel.tsx`
  - **Requirements:** DIAG-07, DIAG-08

**Wave 2 files_modified overlap risk:** All 3 plans touch `src/queries/kesehatan.ts` (compute function additions). Mitigation:
- **Option A (preferred):** Each tier-plan creates separate file `src/queries/kesehatanTier{N}.ts`, then re-exports from `kesehatan.ts` index. Avoids conflict.
- **Option B:** Wave 2 sequential (no parallelism). Slower wall time tapi zero risk.
- Plan-phase decide approach saat detail planning. Lock at planner discretion.

**Tier 4 panel placeholder** — Wave 1 (13-01) buat shell minimal untuk Tier 4 ("Smart-gated checklist akan tersedia di update berikutnya — atau no panel content sama sekali, biarkan Phase 14 fill"). No requirement Phase 13 untuk Tier 4 functional content.

### View-As Wiring (DIAG-12 partial — Phase 13 scope)

DIAG-12 full scope (read-only mode untuk forms) di Phase 14. Phase 13 hanya:
- `useIndikator()` consume `useTargetUserId()` — semua compute pakai data viewed-user kalau admin View-As aktif
- Existing hooks (`useTransactions` etc.) sudah View-As-aware via existing pattern dari Phase 10 v1.1 commit `40bd3ec`

### Claude's Discretion (planner can decide)

- Loading skeleton style: per-IndikatorCard skeleton vs whole-tier skeleton — planner pilih based on UX feel
- Error fallback per indikator: "—" placeholder, error message, atau hide — planner pilih
- IndikatorCard visual layout: number-first vs label-first, threshold legend reveal mode (always/hover/click info icon), color treatment (badge/dot/border)
- Animation tuning: durasi transition Accordion (default radix OK)
- Real-time invalidation: extend existing mutation invalidation di useTransactions/useGoals/useInvestments mutations untuk include `['kesehatan', ...]` keys — planner pick keys
- Whether to colocate panel components di `src/tabs/kesehatan/` atau buat sub-folder `src/tabs/kesehatan/tiers/`

</decisions>

<deferred>
## Deferred Ideas

- **Indikator history chart:** Track perubahan indikator over time. Out of scope v1.2.
- **Indikator goal-setting:** User set personal target untuk Dana Darurat dst. Out of scope.
- **Threshold customization:** User adjust threshold sendiri (mis. user single tanpa tanggungan butuh dana darurat lebih kecil). Defer ke v2.
- **Server-side compute migration:** Kalau performance jadi issue, migrate hybrid → RPC `compute_indicators` tanpa break consumer interface. Track sebagai post-rilis monitor.
- **Tier 4 panel content:** Phase 14 deliver smart-gated checklist + asuransi jiwa form. Phase 13 hanya placeholder.

</deferred>

<dependencies>
## Phase Dependencies

**Required (must be complete):**
- Phase 12 — Sidebar route, PiramidaShell shell component, KesehatanLanding, protection_checklist table, modulCatalog, useTotalDataCount + DIAG-11 empty state branching

**Provides (other phases need):**
- Tier panel infrastructure (Accordion + IndikatorCard + TierPanel) → Phase 14 (DIAG-04 Tier 1 inline checklist + DIAG-09 Tier 4 smart-gated checklist)
- `useIndikator()` indicator computation hooks → Phase 14 (Tier 1 #4 read state setelah mutation)
- View-As pattern proof → Phase 14 (DIAG-12 read-only mode forms)

</dependencies>
