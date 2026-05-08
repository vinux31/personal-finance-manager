---
phase: 12-kesehatan-foundation
plan: "02"
subsystem: ui
tags: [react-router, lucide-react, shadcn-ui, sonner, tailwind, kesehatan]

# Dependency graph
requires: []
provides:
  - "Route /kesehatan mounted dengan KesehatanLayout + KesehatanLanding sebagai index"
  - "Sidebar grup 'Strategi' baru dengan item Kesehatan (HeartPulse icon)"
  - "PiramidaShell: 4-tier CSS clip-path trapezoid component (gray shell, Phase 13 akan inject indicators)"
  - "KalkulatorBanner: teaser card untuk kalkulator compound interest (Phase 15)"
  - "ModulCard: reusable card component untuk 6 modul edukasi"
  - "modulCatalog: konstant 6 modul (arus-kas, tujuan, alokasi-aset, instrumen, pajak-biaya-inflasi, perilaku)"
affects: [12-03-plan, phase-13, phase-14, phase-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS clip-path polygon untuk efek trapezoid piramida (tanpa SVG eksplisit)"
    - "Nested react-router route pattern: KesehatanLayout > Outlet > KesehatanLanding sebagai index"
    - "MODUL_CATALOG const array sebagai single source of truth untuk grid + future route slugs"

key-files:
  created:
    - src/tabs/kesehatan/modulCatalog.ts
    - src/tabs/kesehatan/ModulCard.tsx
    - src/tabs/kesehatan/KalkulatorBanner.tsx
    - src/tabs/kesehatan/PiramidaShell.tsx
    - src/tabs/kesehatan/KesehatanLayout.tsx
    - src/tabs/kesehatan/KesehatanLanding.tsx
  modified:
    - src/shell/navConfig.ts
    - src/routes.tsx

key-decisions:
  - "Pakai CSS clip-path polygon untuk trapezoid piramida — lebih simple dari SVG, responsive, tailwind-compatible"
  - "Direct import (bukan lazy) untuk KesehatanLayout/Landing — konsisten dengan tab existing di pfm-web"
  - "Wildcard route /* tetap di-last di routes.tsx — /kesehatan/kalkulator dan /kesehatan/<slug> Phase 12 redirect ke /dashboard via wildcard (acceptable)"
  - "HeartPulse icon dipilih untuk sidebar item Kesehatan per CONTEXT.md preference"
  - "Grid 2 kolom mulai sm (640px) — sm:grid-cols-2 — konsisten dengan mobile-first pattern pfm-web"

patterns-established:
  - "Nested route layout pattern: {Feature}Layout.tsx wraps Outlet, {Feature}Landing.tsx sebagai index child"
  - "modulCatalog.ts sebagai single source of truth untuk slug + label + icon — future routes akan reference sama array"

requirements-completed: [STRAT-01, STRAT-02]

# Metrics
duration: 20min
completed: 2026-05-08
---

# Phase 12 Plan 02: /kesehatan Shell Foundation Summary

**Sidebar grup Strategi + route /kesehatan dengan landing 3-section (piramida 4-tier CSS trapezoid + banner kalkulator + grid 6 modul card) sepenuhnya terpasang dan siap di-extend oleh Phase 13-15**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-08T (worktree execution)
- **Completed:** 2026-05-08
- **Tasks:** 2 completed + 1 checkpoint (visual UAT)
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments

- 6 file baru di `src/tabs/kesehatan/` tercipta: layout, landing, piramida shell, banner, modul card, katalog modul
- Sidebar `navConfig.ts` mendapat grup baru "Strategi" dengan item Kesehatan (HeartPulse icon) antara grup Tujuan dan footer
- Route `/kesehatan` di `routes.tsx` menggunakan nested pattern `KesehatanLayout > KesehatanLanding` (index child)
- TypeScript clean (tsc --noEmit), production build sukses `✓ built in 4.32s`

## Task Commits

1. **Task 1: Buat 6 file foundation di src/tabs/kesehatan/** - `6fe4750` (feat)
2. **Task 2: Wire sidebar + routes** - `265c5ad` (feat)
3. **Task 3: Visual UAT** - checkpoint:human-verify (menunggu user)

## Files Created/Modified

- `src/tabs/kesehatan/modulCatalog.ts` - Konstant 6 modul (slug/label/description/icon), single source of truth
- `src/tabs/kesehatan/ModulCard.tsx` - Reusable card dengan navigate ke /kesehatan/{slug}, keyboard accessible
- `src/tabs/kesehatan/KalkulatorBanner.tsx` - Banner card gradient primary dengan CTA "Buka kalkulator" → /kesehatan/kalkulator
- `src/tabs/kesehatan/PiramidaShell.tsx` - 4-tier CSS clip-path trapezoid (Warisan/Pertumbuhan/Akumulasi/Proteksi), klik → sonner toast
- `src/tabs/kesehatan/KesehatanLayout.tsx` - Nested route shell dengan `<Outlet />`
- `src/tabs/kesehatan/KesehatanLanding.tsx` - Landing 3 section: hero piramida + banner + grid 6 modul
- `src/shell/navConfig.ts` - Tambah HeartPulse import + grup "Strategi" + item Kesehatan sebelum footer
- `src/routes.tsx` - Tambah import KesehatanLayout/Landing + nested route /kesehatan dengan index child

## Decisions Made

- CSS clip-path polygon dipilih untuk trapezoid piramida — minimal DOM, responsive auto dengan parent width, tidak butuh SVG coordinate math
- Direct import (bukan `React.lazy`) dipertahankan — pfm-web belum pakai route-level code splitting, konsistensi lebih penting
- Wildcard `/*` tetap di posisi akhir router — semua /kesehatan/\* Phase 12 fallback ke /dashboard (acceptable per CONTEXT.md)
- Variant prop `grayed-empty` disiapkan di PiramidaShell untuk DIAG-11 empty state (Plan 12-03 akan gunakan)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript compile dan production build bersih. Warning pre-existing:
- Chunk size >500kB (pre-existing, bukan dari perubahan ini — index bundle 1764KB sudah ada sebelumnya)
- Sonner dynamic import warning (pre-existing dari ReportsTab — bukan dari kesehatan files)

## User Setup Required

None - tidak ada external service configuration, environment variable baru, atau database migration di Plan 12-02.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Klik modul card → /kesehatan/{slug} → wildcard redirect ke /dashboard | ModulCard.tsx | Phase 15 akan tambah child routes per slug |
| Klik "Buka kalkulator" → /kesehatan/kalkulator → wildcard redirect ke /dashboard | KalkulatorBanner.tsx | Phase 15 akan tambah route kalkulator |
| PiramidaShell semua tier gray (no data) | PiramidaShell.tsx | Phase 13 akan inject `indicators` props + warna hijau/kuning/merah |

Stubs di atas adalah intentional Phase 12 shell — tidak menghalangi goal Plan 12-02 (sidebar + landing terlihat oleh user).

## Next Phase Readiness

**Plan 12-03 (DIAG-11 empty state):**
- `KesehatanLanding.tsx` siap dimodifikasi untuk conditional render berdasarkan total count query
- `PiramidaShell.tsx` sudah punya `variant="grayed-empty"` prop yang akan diaktifkan oleh Plan 12-03

**Phase 13 (indicator data layer):**
- `PiramidaShell.tsx` siap terima props `indicators` — Phase 13 extend dengan warna tier
- `KesehatanLayout.tsx` punya Outlet slot untuk TierPanel slide-down interaction

**Phase 15 (konten modul + kalkulator):**
- `MODUL_CATALOG` array di modulCatalog.ts menjadi single source of truth untuk child route slugs
- `/kesehatan` route di routes.tsx siap menerima children tambahan (kalkulator + 6 modul slug routes)

---
*Phase: 12-kesehatan-foundation*
*Completed: 2026-05-08*
