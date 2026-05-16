# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.2 — Strategic Layer & Verification Closure

**Shipped:** 2026-05-15
**Phases:** 6 | **Plans:** 17 | **Git commits:** 191 | **Files changed:** 303 (+49k/-4.9k)
**Timeline:** 2026-05-02 → 2026-05-15 (~13 days)

### What Was Built

- `/kesehatan` halaman strategis — piramida 4-tier CSS trapezoid dengan 8 data-driven financial indicators (Dana Darurat, Savings Rate, DAR, Goals on-track, Pensiun, Rasio Investasi, Diversifikasi, Asuransi) + threshold warna hijau/kuning/merah + smart fallback CTA
- Tier 1 inline form Asuransi Kesehatan (3-state machine, optimistic mutation) + Tier 4 smart-gated estate/asuransi jiwa checklist + View-As 3-layer read-only guard
- 6 modul edukasi sub-route `/kesehatan/<slug>` + Fraunces variable font + GlossaryTooltip Radix Popover (8 istilah) + kalkulator compound interest Recharts (4 sliders, tabel 5-tahunan)
- Periode Gaji: `pay_periods` table + PayPeriodCard Dashboard + Laporan + manual management `/periode-gaji`
- B1-B5 live UAT PASS production + migration playbook docs + 0028 hotfix applied to cloud
- Vitest infrastruktur pertama di project (computeFV 10 test cases, GlossaryTooltip jsdom)

### What Worked

- **Design spec → execution pipeline smooth** — design spec `2026-05-08-framework-page-design.md` dibuat sebelum milestone, sehingga plan-phase langsung eksekusi tanpa research phase (kecuali per-phase research kecil). Waktu planning drastis berkurang.
- **Wave-based parallel execution (Phase 13)** — file-ownership matrix per plan eliminasi merge conflict di Wave 2. 4 plans / 2 waves zero conflict.
- **`totalAsetFinansial` helper promoted cross-tier** — keputusan promote exported function di Phase 13 mencegah denominator drift antara Tier 1, Tier 3, dan infoSlot. Satu decision kecil, mencegah banyak bug potensial.
- **Build sebagai regression gate** — `npm run build` (tsc -b + vite build) sebagai single gate cukup efektif untuk project tanpa test suite besar. Tidak ada type regression yang lolos ke production.
- **Phase 16 merge VERIF + TECHDEBT** — menggabungkan dua ops concern ke 1 phase efisien; narrative "v1.1 Closure & Ops Cleanup" coherent dan tidak ada duplikasi overhead planning.

### What Was Inefficient

- **REQUIREMENTS.md tidak di-update selama eksekusi** — traceability table tetap "Pending" untuk semua requirement sampai milestone close. Menyulitkan status-check mid-milestone. Pattern sama terjadi di v1.1.
- **Phase 16 ROADMAP.md checkboxes stale** — plan items masih `[ ]` di ROADMAP.md meski plan sudah complete, karena executor tidak update ROADMAP saat menyelesaikan plan. Harus diperbaiki manual saat milestone close.
- **gsd-tools `milestone complete` phase count salah** — tool hanya detect 4 dari 6 phases (missed Phase 11 karena 0 plan_count di roadmap analyze, missed Phase 15/16 karena stale roadmap data). Stats harus di-fix manual.
- **`audit-open` gsd-tools broken** — ReferenceError: output is not defined. Pre-close audit harus manual.
- **Phase 15 + 16 missing VERIFICATION.md** — process gap; executor langsung ke SUMMARY tanpa buat VERIFICATION.md. UAT results ada di UAT.md dan SUMMARY.md, tapi gap di process.
- **0028 hotfix tidak ter-apply ke cloud** — ditemukan saat B4 live UAT. Root cause: migration 0024 + 0028 tidak di-paste ke Studio saat shipped. Butuh extra session untuk hotfix.

### Patterns Established

- **Client-side indicator compute dengan shared hook cache** — `useIndikator()` composing 7 View-As-aware hooks, memoized derivation. Migration path ke server RPC preserved tanpa break interface.
- **3-layer View-As guard untuk mutation forms** — UI conditional render + mutation hook throw + RLS WITH CHECK. Pattern reusable untuk form apapun yang perlu admin read-only.
- **Lazy-create upsert pattern untuk 1:1 user tables** — `INSERT ... ON CONFLICT DO UPDATE SET health_coverage = EXCLUDED.health_coverage` + `user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE`. Pattern bersih untuk preference tables.
- **Vitest jsdom setup pattern** — `ResizeObserver` + `pointer-capture` polyfills di `src/test/setup.ts`. Template untuk test tambahan berikutnya.
- **Design spec sebagai milestone input** — spec detail (§3-§7) replace research phase; plan-phase langsung eksekusi. Efisien untuk fitur UI-heavy yang sudah dipikirkan matang.

### Key Lessons

1. **Update REQUIREMENTS.md traceability saat plan complete**, bukan di milestone close. Status "Pending" mid-milestone menyulitkan progress tracking.
2. **Update ROADMAP.md plan checkboxes saat plan complete** — bukan defer ke milestone close. gsd-tools roadmap analyze bergantung pada ini untuk phase count yang akurat.
3. **Buat VERIFICATION.md setelah setiap phase selesai** — jangan skip ke SUMMARY langsung. Process gap tidak berbahaya tapi menyulitkan retroactive audit.
4. **Studio paste confirmation** — setiap kali ada migration baru, cek `supabase migration list --linked` untuk verify applied. Phase 16 B4 blocked karena 0024+0028 belum applied. Ikuti migration-playbook.md.
5. **Merge ops concerns ke 1 phase** — VERIF + TECHDEBT merged ke Phase 16 efisien. Principle: phase yang share narrative + dependencies boleh digabung.

### Cost Observations

- Model: Claude Sonnet 4.6 (primary throughout)
- Notable: Design spec + wave-based parallel execution reduced sessions significantly vs v1.1 which needed more discovery work

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 4 | 14 | First production milestone; Playwright UAT established |
| v1.1 | 6 | 25 | Security hardening focus; Studio paste de-facto migration channel established |
| v1.2 | 6 | 17 | Design spec → execution pipeline; wave-based parallel plans; vitest added |

### Cumulative Quality

| Milestone | DB Migrations | RLS Tables | RPCs/Triggers | Test Infra |
|-----------|--------------|------------|---------------|------------|
| v1.0 | 0001-0014 | 4 | 1 RPC | Playwright UAT |
| v1.1 | 0015-0025 | 6+ | 3 RPCs + 1 trigger | Playwright UAT + SQL tests |
| v1.2 | 0026-0029 | 7+ | same | + vitest (10 cases) |

### Top Lessons (Verified Across Milestones)

1. **Production verify-before-close catches real bugs** — v1.0 caught toast bug + deploy gap; v1.1 caught CORS drift; v1.2 caught 0028 not applied. Never skip live UAT.
2. **Studio paste is the migration channel** — `db push` broken since 0014. Document in migration-playbook.md, follow it every time.
3. **Signature changes need explicit DROP FUNCTION** — lesson from v1.1 Phase 5/6; must precede CREATE OR REPLACE for PG function identity correctness.
4. **REQUIREMENTS.md traceability stays stale mid-milestone** — recurring pattern v1.1 + v1.2. Either update at plan-complete time or accept audit-only verification at close.
