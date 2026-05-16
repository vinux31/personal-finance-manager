---
phase: 12-kesehatan-foundation
plan: "03"
subsystem: ui
tags: [react-query, supabase, empty-state, onboarding, view-as, tailwind, shadcn-ui, kesehatan]

# Dependency graph
requires:
  - "12-02 (PiramidaShell dengan variant='grayed-empty' + KesehatanLanding shell)"
provides:
  - "useTotalDataCount hook di src/queries/kesehatan.ts — agregat count 4 tabel dengan View-As support"
  - "EMPTY_STATE_THRESHOLD = 3 konstanta (mudah adjust pasca-rilis)"
  - "EmptyStateCTA component — welcome banner dengan 3 quick-link CTA"
  - "KesehatanLanding updated — loading/empty/normal branching berdasarkan total count"
affects: [phase-13, phase-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase HEAD count query: select('*', { count: 'exact', head: true }) — lightweight count tanpa fetch rows"
    - "Promise.all 4 parallel count queries — bukan sequential, avoid 4x latency"
    - "isEmpty guard: !isLoading && data !== undefined — avoid flash empty state saat loading"
    - "staleTime 60_000 di count query — kurangi unnecessary refetch saat tab focus"

key-files:
  created:
    - src/queries/kesehatan.ts
    - src/tabs/kesehatan/EmptyStateCTA.tsx
  modified:
    - src/tabs/kesehatan/KesehatanLanding.tsx

key-decisions:
  - "isEmpty computed hanya setelah !isLoading && data !== undefined — prevent flash empty state saat network slow"
  - "Query error (network fail) → data === undefined → piramida render default (bukan empty state) — defensive fallback"
  - "4 parallel HEAD count queries dipilih daripada single RPC aggregate — simpler, no migration, no SECURITY DEFINER complexity"
  - "EMPTY_STATE_THRESHOLD = 3 diekspor sebagai konstanta dari src/queries/kesehatan.ts supaya gampang tune pasca-rilis"
  - "Banner kalkulator + grid modul tetap render di semua state (loading/empty/normal) — modul catalog static, no benefit dari hide"

requirements-completed: [DIAG-11]

# Metrics
duration: ~3min
completed: 2026-05-08
---

# Phase 12 Plan 03: DIAG-11 Empty State Full Summary

**useTotalDataCount hook (View-As-aware, 4 parallel HEAD count queries) + EmptyStateCTA welcome banner (3 CTA) + KesehatanLanding conditional branching (loading/empty/normal) selesai diimplementasikan untuk DIAG-11**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-08T (worktree execution)
- **Completed:** 2026-05-08
- **Tasks:** 2 auto completed + 1 checkpoint:human-verify (menunggu UAT)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- File `src/queries/kesehatan.ts` dibuat: hook `useTotalDataCount` dengan 4 parallel HEAD count queries ke transactions/net_worth_accounts/goals/investments, View-As-aware via `useTargetUserId()`, konstanta `EMPTY_STATE_THRESHOLD = 3`
- File `src/tabs/kesehatan/EmptyStateCTA.tsx` dibuat: welcome card dengan 3 CTA buttons (Wallet→/transaksi, Landmark→/kekayaan, Target→/goals), responsive grid (sm:grid-cols-3 → single kolom di mobile)
- `src/tabs/kesehatan/KesehatanLanding.tsx` diupdate: loading skeleton 4-tier, empty state branching (PiramidaShell grayed-empty + EmptyStateCTA), normal state (PiramidaShell default), banner kalkulator + grid modul tetap accessible di semua state
- TypeScript compile bersih (`npx tsc --noEmit`)
- Production build sukses (`✓ built in 1.62s`)

## Task Commits

1. **Task 1: useTotalDataCount + EMPTY_STATE_THRESHOLD** — `b1dd6cc` (feat)
2. **Task 2: EmptyStateCTA + conditional KesehatanLanding** — `df0c06b` (feat)
3. **Task 3: Visual UAT** — checkpoint:human-verify (menunggu user)

## Files Created/Modified

- `src/queries/kesehatan.ts` — Hook `useTotalDataCount` + konstanta `EMPTY_STATE_THRESHOLD`. File ini akan di-extend di Phase 13 dengan `useDanaDarurat`, `useSavingsRate`, dll.
- `src/tabs/kesehatan/EmptyStateCTA.tsx` — Welcome banner DIAG-11 dengan 3 quick-link CTA. Responsive: `sm:grid-cols-3` (desktop 3 kolom, mobile 1 kolom stacked).
- `src/tabs/kesehatan/KesehatanLanding.tsx` — Conditional render: `isLoading` → skeleton; `isEmpty` (total < 3) → grayed-empty + CTA; normal → default piramida.

## Decisions Made

- `isEmpty` dihitung hanya setelah `!isLoading && countQuery.data !== undefined` — mencegah flash empty state sesaat sebelum data arrive (transient "false→true→false" tidak terjadi)
- Query error → `data === undefined` → `isEmpty = false` → piramida default render. Defensive: lebih baik user lihat shell daripada empty state palsu saat network fail
- 4 parallel HEAD count queries (bukan single RPC aggregate) — simpler, tidak butuh DB migration, tidak ada SECURITY DEFINER complexity. Trade-off acceptable di scale pfm-web
- `EMPTY_STATE_THRESHOLD = 3` diekspor sebagai konstanta — mudah adjust pasca-rilis tanpa cari literal inline

## Deviations from Plan

None - plan executed exactly as written.

## Build Verification

- `npx tsc --noEmit`: PASS (no errors)
- `npm run build`: PASS (`✓ built in 1.62s`)
- Pre-existing warnings (tidak dari perubahan ini):
  - Chunk size >500kB (index bundle 1767KB — pre-existing)
  - Sonner dynamic import warning (pre-existing dari ReportsTab)

## Threat Surface Scan

Tidak ada surface baru di luar threat model yang sudah didefinisikan di PLAN.md:
- T-12-09: useTotalDataCount View-As leak → dimitigasi via `.eq('user_id', targetUid)` filter + RLS
- T-12-10: Non-admin spoof targetUid → dimitigasi via ViewAsContext admin-only + RLS USING block
- T-12-11: Quota exhaustion 4 parallel queries → accepted (staleTime 60s, HEAD queries ringan)
- T-12-12: EMPTY_STATE_THRESHOLD bypass via DevTools → accepted (user self-defeat, no server state)

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| PiramidaShell default state masih all-gray (no indicator colors) | PiramidaShell.tsx | Phase 13 akan inject `indicators` props + warna hijau/kuning/merah |
| Klik tier piramida → toast "Coming soon" | PiramidaShell.tsx | Phase 13 akan replace dengan slide-down TierPanel |
| Modul card klik → redirect ke /dashboard via wildcard | ModulCard.tsx | Phase 15 akan tambah child routes per slug |

Stubs di atas intentional — tidak menghalangi goal Plan 12-03 (empty state guide user baru).

## Visual UAT (Checkpoint — Menunggu User)

Task 3 adalah `checkpoint:human-verify`. Berikut yang perlu diverifikasi:

**Test 1 — Empty state visual (< 3 rows total):**
- Piramida 4 tier lebih redup (grayed-empty, `bg-gray-200 text-gray-500`)
- Caption: "Yuk mulai isi data untuk lihat warna hijau/kuning/merah di setiap tier."
- Card "Mulai dari mana?" dengan 3 button outline (Wallet/Landmark/Target icons)
- Banner kalkulator + grid 6 modul tetap muncul di bawah

**Test 2 — 3 CTA navigasi:**
- "Catat transaksi pertama" → /transaksi
- "Tambah akun bank" → /kekayaan
- "Bikin tujuan finansial" → /goals

**Test 3 — Toast tier click di empty state:**
- Expected: "Yuk isi data dulu — Tier X LABEL akan terbuka setelah ada minimal 3 data poin."

**Test 4 — Normal state (≥ 3 rows):**
- Piramida default (lebih terang, `bg-gray-300 text-gray-700`)
- Tidak ada card "Mulai dari mana?"

**Test 5 — Loading state (Slow 3G):**
- Skeleton 4 bar pulsing, banner + modul tetap render
- No flash empty state saat loading

**Test 6 — View-As (jika tersedia):**
- Admin View-As ke user dengan data sedikit → empty state berdasarkan viewed-user

**Test 7 — Mobile responsive (≤640px):**
- 3 CTA stacked single kolom, tidak overflow horizontal

## Hand-off Notes

**Untuk Phase 13 (Indicator Data Layer):**
- `src/queries/kesehatan.ts` siap di-extend: tambah `useDanaDarurat`, `useSavingsRate`, `useDarKonsumtif`, `useGoalsOnTrack`, `useRasioInvestasi`, `useDiversifikasi`, `usePensiunReadiness`
- `PiramidaShell.tsx` siap terima props `indicators` untuk warna hijau/kuning/merah per tier
- `KesehatanLanding.tsx` siap terima prop/context dari Phase 13 untuk inject TierPanel di bawah piramida
- Empty state behavior: Phase 13 indikator placeholder masih tampil di tier panel. Tier abu-abu hanya kalau SEMUA indikator di tier dalam keadaan placeholder (per design spec §4 "Agregasi warna tier")

**Untuk Phase 14 (Inline Checklist + Mutation):**
- Tabel `protection_checklist` sudah live (Plan 12-01)
- Pattern `useTargetUserId()` sudah di-establish di Plan 12-03 — Phase 14 pakai pattern yang sama untuk read; mutation form harus add read-only guard (non-admin tidak boleh mutate via View-As, per DIAG-12 di Phase 14 scope)

**Konstanta penting:**
- `EMPTY_STATE_THRESHOLD = 3` di `src/queries/kesehatan.ts` — adjust value ini untuk tune empty state trigger pasca-rilis

---
*Phase: 12-kesehatan-foundation*
*Completed: 2026-05-08*
