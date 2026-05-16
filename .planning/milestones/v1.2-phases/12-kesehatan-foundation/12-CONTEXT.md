# Phase 12: /kesehatan Foundation — Context

**Gathered:** 2026-05-08
**Status:** Ready for planning
**Source:** Design spec `docs/superpowers/specs/2026-05-08-framework-page-design.md` (commit `b219fc3`) — sections relevan untuk Phase 12 di-extract di sini sebagai locked decisions.

<domain>
## Phase Boundary

**This phase delivers:**
- Halaman `/kesehatan` baru yang accessible via grup sidebar baru "Strategi"
- Layout landing dengan **shell** piramida (struktur visual 4-tier, belum data-driven), banner kalkulator (link teaser, kalkulator detail di Phase 15), dan grid 6 card modul (link teaser, konten modul di Phase 15)
- Tabel database baru `protection_checklist` dengan RLS — lazy-create row pada first interaction (mutation logic actual di Phase 14)
- Empty state full untuk user baru: piramida grayed-out + 3 quick-link CTA ke `/transaksi` / `/kekayaan` / `/goals`

**This phase does NOT deliver:**
- Indicator data layer (Tier 1-3 angka hidup) — Phase 13
- Tier panel expand interaction dengan content — Phase 13
- Inline checklist Tier 1 + Tier 4 forms (mutation) — Phase 14
- Konten 6 modul (port dari `financial_framework.html`) — Phase 15
- Kalkulator compound interest interactive — Phase 15
- Glossary tooltip — Phase 15

**Why this is foundation:** Subsequent phases (13/14/15) depend pada (a) tabel `protection_checklist` exist, (b) route `/kesehatan` mounted, (c) layout shell punya slot untuk fill content. Phase 12 demo-able dengan empty state — user bisa klik sidebar "Strategi → Kesehatan" → lihat piramida grayed-out + 3 CTA. Acceptable interim state sebelum Phase 13+.

</domain>

<decisions>
## Implementation Decisions (Locked)

### Sidebar Restructure (STRAT-01)
- **Tambah grup baru "Strategi"** di `src/shell/navConfig.ts` antara grup "Tujuan" dan Footer
- **Single item** dalam grup: `{ to: '/kesehatan', label: 'Kesehatan', icon: ... }`
- **Icon:** kandidat dari lucide-react — `Shield`, `Activity`, atau `HeartPulse` (pilih saat planning, prefer `HeartPulse` karena align dengan "kesehatan keuangan")
- Naming Indonesian + professional-casual sejalan dengan grup eksisting (Keuangan, Aset, Tujuan)

### Route + Layout (STRAT-02)
- React-router nested route setup di `src/routes.tsx` (atau equivalent main router file)
- Path `/kesehatan` → `<KesehatanLayout>` dengan `<Outlet />` untuk sub-routes (sub-routes itu sendiri kosong di Phase 12 — akan diisi Phase 15)
- Landing component `KesehatanLanding.tsx` sebagai default route content
- Layout landing 3 section vertikal:
  1. **HERO**: Piramida 4-tier (visual shell, all gray, klik tier belum aksi anything di Phase 12 — atau toast "Coming soon")
  2. **BANNER kalkulator**: Card dengan "🧮 Hitung target investasimu dengan kalkulator compound interest [Buka →]" — link ke `/kesehatan/kalkulator` (404 atau coming-soon di Phase 12)
  3. **GRID 6 card modul**: 2 kolom × 3 baris di desktop, single kolom di mobile — masing-masing card link ke `/kesehatan/<slug>` (juga coming-soon di Phase 12)

### Schema (SCHEMA-01)
- **Tabel baru:** `protection_checklist` dengan `user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- **Fields nullable** (lazy-fill di Phase 14):
  - `health_coverage TEXT CHECK IN ('kantor','bpjs','pribadi','kombinasi','tidak')`
  - `has_dependents BOOLEAN`
  - `life_coverage TEXT CHECK IN ('kantor','pribadi','keduanya','tidak')`
  - `life_coverage_sufficient BOOLEAN`
  - `life_coverage_post_employment TEXT CHECK IN ('ya','tidak','tidak_yakin')`
  - `estate_heirs_documented BOOLEAN`
  - `estate_assets_documented BOOLEAN`
  - `estate_will_exists BOOLEAN`
- **Timestamps:** `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **RLS:** `auth.uid() = user_id OR is_admin()` (USING) + `auth.uid() = user_id` (WITH CHECK) — same pattern dengan tabel existing
- **Migration filename:** `0029_protection_checklist.sql` (continue dari 0028 yang udah applied di prod)
- **Apply path:** Studio SQL Editor manual paste (db push broken — same dengan migration sebelumnya, didokumentasikan di STATE.md decisions)
- Phase 12 cuma create tabel + RLS; data layer/RPC belum (Phase 14)

### Empty State Full (DIAG-11)
- Trigger: query `SELECT COUNT(*) FROM transactions + accounts + goals + investments` < 3 untuk user
- Implementation: query layer cek total count via parallel `useQuery` ke 4 tabel (atau 1 query agregate)
- Tampilan empty state:
  - Hero piramida tetap tampil (struktur 4-tier) tapi semua tier diwarnai abu-abu (no green/yellow/red)
  - Overlay/badge text: *"Yuk mulai isi data"*
  - Single hero CTA: **"Mulai dari mana?"** dengan 3 quick-link buttons:
    - `[ Catat transaksi pertama → /transaksi ]`
    - `[ Tambah akun bank → /kekayaan ]`
    - `[ Bikin tujuan finansial → /goals ]`
  - Banner kalkulator + grid modul tetap accessible di bawah (modul/kalkulator tidak butuh user data)

### View-As Compatibility (carry from spec, baseline)
- Phase 12 sudah harus support View-As mode untuk semua components yang baca user data (DIAG-11 empty state count)
- Pattern: pakai `viewingAs ?? userId` untuk filter query, konsisten dengan tabs existing
- Tidak ada mutation di Phase 12 — semua read-only, jadi tidak perlu read-only guard logic Phase 14

### Claude's Discretion
- **Pilihan icon Strategi/Kesehatan** — `HeartPulse` rekomendasi default, planner boleh adjust
- **Visual treatment piramida shell di empty state** — apakah pakai SVG path, CSS clip-path, atau component library; planner pilih sesuai pattern existing pfm-web (kemungkinan custom SVG dengan tailwind classes — lihat existing PayPeriodCard atau dashboard charts untuk reference)
- **Banner & card grid styling** — pakai shadcn/ui `Card` component (existing dependency), spacing/typography konsisten dengan landing pattern existing
- **Total count query — agregate vs parallel** — planner pilih based on performance trade-off; agregate single RPC mungkin overkill untuk Phase 12, parallel 4 useQuery acceptable
- **Test strategy** — minimum: 1 SQL test untuk RLS isolation tabel `protection_checklist`, 1 component test untuk empty state rendering. Planner boleh tambah Playwright UAT live test untuk sidebar nav.

</decisions>

<canonical_refs>
## Canonical References

- **Design spec (full):** `docs/superpowers/specs/2026-05-08-framework-page-design.md` — sections §3 (Arsitektur), §4 (empty state), §7 (Schema)
- **Existing sidebar config:** `src/shell/navConfig.ts` — pattern reference untuk grup baru
- **Existing app shell:** `src/shell/AppShell.tsx`, `src/shell/AppSidebar.tsx`, `src/shell/AppTopBar.tsx`
- **Existing routes:** check `src/routes.tsx` atau equivalent main router
- **Existing RLS pattern:** `supabase/migrations/0012_net_worth.sql` (net_worth_accounts, net_worth_liabilities) — closest pattern untuk new table dengan user-scoped RLS
- **View-As pattern:** `src/tabs/KekayaanTab.tsx` (commit `40bd3ec` Phase 10 v1.1) — reference untuk `viewingAs` context handling
- **Migration apply procedure:** `project_supabase_migration_workflow.md` memory — Studio SQL Editor manual paste, db push broken

</canonical_refs>

<specific_ideas>
## Specific Ideas (Hints, Not Requirements)

- **Discoverability test:** setelah deploy Phase 12, user yang udah pakai pfm-web minimal 1x harus bisa nemu menu "Kesehatan" dalam waktu 10 detik. Kalau user gak ngerti grup "Strategi" itu apa, nama grup atau icon perlu adjust.
- **Performance:** total count query untuk DIAG-11 trigger jangan jadi blocker rendering — pakai Suspense boundary atau initial state "loading" yang gak ngebuat user nunggu lama. Cache result via react-query default staleTime.
- **Sidebar mobile drawer:** verify grup "Strategi" muncul dengan benar di mobile drawer (sidebar collapsed-mode), tidak break scroll/layout.

</specific_ideas>

<deferred>
## Deferred (Out of Scope Phase 12 — masuk Phase 13+)

- Tier panel expand interaction dengan indicator content — Phase 13
- Indicator data queries (Dana Darurat, Savings Rate, dll) — Phase 13
- DAR Total info display di Tier 1 panel — Phase 13
- Smart fallback CTA (Goals on-track, Pensiun) — Phase 13
- Edge case data tipis untuk indikator #1, #2 — Phase 13
- Inline checklist Tier 1 mutation form — Phase 14
- Smart-gated checklist Tier 4 mutation form — Phase 14
- View-As read-only guard untuk forms — Phase 14
- 6 modul sub-route content — Phase 15
- Kalkulator compound interactive — Phase 15
- Glossary tooltip — Phase 15

</deferred>
