# Roadmap: Kantong Pintar

## Milestones

- ✅ **v1.0 Financial Foundation** — Phases 1-4 (shipped 2026-04-25) — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Hardening & Consistency** — Phases 5-10 (shipped 2026-05-02) — see [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- 🚧 **v1.2 Strategic Layer & Verification Closure** — Phases 11-16 (started 2026-05-08)

## Phases

<details>
<summary>✅ v1.0 Financial Foundation (Phases 1-4) — SHIPPED 2026-04-25</summary>

- [x] Phase 1: Foundation (3/3 plans) — DB infrastructure, FOUND-01 nextDueDate fix, navigasi restructure
- [x] Phase 2: Net Worth Tracker (3/3 plans) — CRUD akun/liabilitas, tab Kekayaan, metric card Dashboard
- [x] Phase 3: Bills Display (2/2 plans) — daftar tagihan + color urgency + Sisa Aman
- [x] Phase 4: Mark-as-Paid (6/6 plans) — atomic mark_bill_paid RPC + AlertDialog + Playwright UAT

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
Audit verdict (PASS-WITH-NOTES): [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.1 Hardening & Consistency (Phases 5-10) — SHIPPED 2026-05-02</summary>

- [x] Phase 5: Security Hardening (4/4 plans) — Edge function auth + CORS + RLS + RPC IDOR (migrations 0017+0018) — 2026-04-28 PASS-WITH-NOTES
- [x] Phase 6: Race & Atomicity (5/5 plans) — process_due_recurring/withdraw_from_goal RPCs + goal_investments trigger (migrations 0019+0020+0021) — 2026-04-29 PASS-WITH-NOTES
- [x] Phase 7: UI/Data Consistency (8/8 plans) — goals_with_progress VIEW, atomic seed_rencana, todayISO ESLint rule, View-As CSV gate (migrations 0022-0024) — 2026-04-29 PASS-WITH-NOTES
- [x] Phase 8: Dev Hygiene (2/2 plans) — Recharts type cleanup, seed.sql config, perf doc note — PASS
- [x] Phase 9: QA Bug Fix (4/4 plans) — Fix 8 bug dari QA-FINDINGS.md (migration 0025) — 2026-05-01 PASS
- [x] Phase 10: fetch-prices CORS fix (2/2 plans) — Tambah kantongpintar.vercel.app ke ALLOWED_ORIGINS + live UAT — 2026-05-02 PASS

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
Audit verdict (tech_debt → resolved Phase 10): [milestones/v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md)

</details>

### 🚧 v1.2 Strategic Layer & Verification Closure (Phases 11-16)

**Shipped:**
- [x] **Phase 11: Periode Gaji** — `pay_periods` table + PayPeriodCard Dashboard + tab Laporan Periode Gaji + PayPeriodConfirmDialog (migration 0026) — 2026-05-02 PASS

**Planned:**
- [x] **Phase 12: /kesehatan Foundation** — sidebar grup Strategi + landing shell + `protection_checklist` schema + empty state piramida (completed 2026-05-08)
- [x] **Phase 13: Diagnostic Data Indicators** — 8 data-driven indikator (Tier 1-3) + tier panel expand + edge case data tipis (completed 2026-05-08)
- [ ] **Phase 14: Protection & Tier 4 Checklists** — Tier 1 inline form (Asuransi Kesehatan) + Tier 4 smart-gated checklist + View-As read-only mode
- [ ] **Phase 15: Modul Edukasi & Kalkulator** — 6 modul sub-route + kalkulator compound interest + glossary tooltip
- [ ] **Phase 16: v1.1 Closure & Ops Cleanup** — B1-B5 live UAT (Gaji idempotency, mark-paid race, 2-tab withdraw, completed flip, Refresh Harga WIB) + migration history reconciliation (0014..0028 Local-only)

## Phase Details

### Phase 11: Periode Gaji
**Goal**: User punya konsep "periode gaji" sebagai window utama untuk Sisa Aman & laporan, bukan bulan kalender
**Depends on**: Nothing
**Requirements**: (pre-defined v1.2 scope)
**Success Criteria** (what must be TRUE):
  1. User bisa lihat PayPeriodCard di Dashboard menampilkan window gaji aktif + Sisa Aman dalam periode itu
  2. User bisa buka tab Laporan Periode Gaji dan lihat agregasi income/expense per periode
  3. User bisa kelola periode gaji manual (create/rename/hapus) di /periode-gaji
**Plans**: 1/1 complete (shipped 2026-05-02)
**Status**: ✅ PASS — commit 3ece3f8 + manual management commit 1748f54..d00ce92

### Phase 12: /kesehatan Foundation
**Goal**: User bisa akses halaman `/kesehatan` baru via sidebar grup "Strategi" dengan piramida shell, banner kalkulator, dan grid 6 modul — meskipun belum data-driven
**Depends on**: Nothing
**Requirements**: SCHEMA-01, STRAT-01, STRAT-02, DIAG-11
**Success Criteria** (what must be TRUE):
  1. User klik grup "Strategi" → "Kesehatan" di sidebar → masuk ke route `/kesehatan` dengan layout landing (hero piramida + banner kalkulator + grid 6 card modul)
  2. Tabel `protection_checklist` tersedia di production dengan RLS `auth.uid() = user_id OR is_admin()` — `SELECT/INSERT/UPDATE` dari user lain ditolak (verified via SQL)
  3. User baru (rows total < 3 di transactions+accounts+goals+investments) lihat piramida grayed-out + 3 quick-link CTA ke /transaksi /kekayaan /goals; banner kalkulator + grid modul tetap accessible
  4. Sidebar restructure — grup "Strategi" muncul antara grup "Tujuan" dan Footer; navConfig + AppShell tetap sehat di mobile drawer
**Plans**: 3 plans
  - [x] 12-01-PLAN.md — protection_checklist schema + RLS + SQL test (SCHEMA-01)
  - [x] 12-02-PLAN.md — sidebar grup Strategi + route /kesehatan + landing shell 3 section (STRAT-01, STRAT-02)
  - [x] 12-03-PLAN.md — DIAG-11 empty state full (welcome banner + grayed piramida + 3 CTA)
**UI hint**: yes

### Phase 13: Diagnostic Data Indicators
**Goal**: User bisa klik tier piramida → lihat indikator finansial mereka dihitung otomatis dari data Supabase, dengan warna hijau/kuning/merah dan smart fallback
**Depends on**: Phase 12 (landing shell + sidebar route harus ada)
**Requirements**: DIAG-01, DIAG-02, DIAG-03, DIAG-05, DIAG-06, DIAG-07, DIAG-08, DIAG-10, STRAT-03
**Success Criteria** (what must be TRUE):
  1. User klik tier 1/2/3 piramida → panel slide-down inline menampilkan indikator hidup (Dana Darurat, Savings Rate, DAR Konsumtif, Goals on-track, Pensiun, Rasio Investasi, Diversifikasi) dengan angka + warna sesuai threshold spec §4
  2. User dengan transactions < 3 bulan kalender lihat indikator #1 dan #2 sebagai placeholder "Butuh 3 bulan data, sudah X/3" + CTA `/transaksi`; placeholder tidak ikut agregasi warna tier
  3. User tanpa long-term goal aktif lihat #5 sebagai CTA card "Belum punya tujuan jangka panjang?" → `/goals`; user tanpa pension_simulations lihat #6 sebagai CTA card → `/pensiun`; user dengan simulasi > 6 bulan lihat catatan "Simulasi terakhir: X bulan lalu"
  4. Tier 1 panel tampil DAR Total sebagai info tambahan (bukan indikator warna) + CTA mapping per spec §4.5 (Kelola akun & utang, Catat transaksi, Pelajari modul)
  5. Aset finansial denominator konsisten (akun likuid + deposito + investments) — properti & kendaraan exclude — terverifikasi via spot-check production data
**Plans**: TBD
**UI hint**: yes

### Phase 14: Protection & Tier 4 Checklists
**Goal**: User bisa jawab inline checklist Asuransi Kesehatan (Tier 1) + smart-gated checklist Estate/Asuransi Jiwa (Tier 4) — disimpan di `protection_checklist`, read-only saat View-As mode
**Depends on**: Phase 12 (SCHEMA-01 protection_checklist table), Phase 13 (tier panel infrastructure)
**Requirements**: DIAG-04, DIAG-09, DIAG-12
**Success Criteria** (what must be TRUE):
  1. User klik Tier 1 → lihat inline form 1 question "Kesehatan kamu (& keluarga) tercover?" dengan 5 opsi radio; submit → row protection_checklist lazy-create + indikator #4 berubah hijau (kalau bukan "tidak") atau merah (kalau "tidak")
  2. User klik Tier 4 → lihat gate question "Punya tanggungan finansial?"; pilih "Tidak" → 3 estate basic; pilih "Ya" → 3 estate + 3 asuransi jiwa; threshold warna tier 4 sesuai spec §4 (hijau semua "ya", merah ada "tidak" estate/asuransi)
  3. Admin dengan View-As aktif lihat indikator pakai data viewed-user, tetapi inline form Tier 1 #4 dan Tier 4 checklist switch ke read-only mode (input disabled, no submit) — admin tidak bisa modify protection_checklist user lain
**Plans**: TBD
**UI hint**: yes

### Phase 15: Modul Edukasi & Kalkulator
**Goal**: User bisa baca 6 modul edukasi finansial via sub-route + pakai kalkulator compound interest interaktif + lihat tooltip glossary inline di angka teknis
**Depends on**: Phase 12 (landing grid + banner)
**Requirements**: STRAT-04, STRAT-05, STRAT-06
**Success Criteria** (what must be TRUE):
  1. User klik card modul di landing → masuk ke `/kesehatan/<slug>` (arus-kas, tujuan, alokasi-aset, instrumen, pajak-biaya-inflasi, perilaku) dengan typography Fraunces serif + breadcrumb "Kesehatan / <Modul>" + footer link ke modul lain
  2. User klik banner kalkulator → masuk ke `/kesehatan/kalkulator` dengan slider awal/bulanan/return/tenor + nilai akhir big number + grafik garis Recharts tahun-per-tahun + tabel breakdown 5-tahunan
  3. User hover/tap istilah teknis (Asset Allocation, Real Return, Sharpe Ratio, DCA, Drawdown, Expense Ratio, Rebalancing, Risk Tolerance) di prose modul → Radix Tooltip muncul dengan definisi singkat
**Plans**: TBD
**UI hint**: yes

### Phase 16: v1.1 Closure & Ops Cleanup
**Goal**: Tutup loose ends dari v1.1 — 5 live UAT yang deferred (B1-B5) + migration history reconciliation (0014..0028 Local-only). Ops phase tanpa UI baru.
**Depends on**: Nothing (independent dari /kesehatan stack — boleh parallel)
**Requirements**: VERIF-01, VERIF-02, VERIF-03, VERIF-04, VERIF-05, VERIF-06, TECHDEBT-01
**Success Criteria** (what must be TRUE):
  1. Pre-condition data state untuk B1-B5 ada di production: template Gaji recurring (next_due_date bulan ini), expense recurring + bill due ≤ today, goal cash > 0, goal status='completed'
  2. B1 (idempotency Gaji): Login → Transaksi tab → Gaji bulan ini muncul tepat 1 row; reload → masih 1 row (zero duplikasi process_due_recurring)
  3. B2 (mark-paid race): Klik "Lunas" → switch tab 5x dalam 1 detik → SQL verify no duplicate transaction row untuk tanggal+kategori sama
  4. B3 (2-tab withdraw): 2 tab withdraw Rp 50k dari goal Rp 100k quick succession → satu sukses, satu toast "Saldo kas tidak cukup (tersedia Rp 50.000)"
  5. B4 (completed flip): Withdraw Rp 1 dari goal completed → badge berubah "Tercapai" → "Aktif" + SQL verify `goals.status='active'`
  6. B5 (Refresh Harga WIB date): Klik Refresh Harga di Investasi → network request payload field `date` adalah WIB (bukan UTC) — verified live (sudah un-blocked Phase 10 v1.1)
  7. Migration history: keputusan dipilih dan didokumentasikan di PROJECT.md Key Decisions — jalur (a) repair history sehingga `db push` jalan, atau jalur (b) document procedural alternative (Studio paste tetap default + dummy applied entry); `supabase migration list --linked` sesuai jalur; future-migration playbook tertulis (kapan Studio paste vs CLI push, handle signature changes)
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | ✅ Complete | 2026-04-23 |
| 2. Net Worth Tracker | v1.0 | 3/3 | ✅ Complete | 2026-04-23 |
| 3. Bills Display | v1.0 | 2/2 | ✅ Complete | 2026-04-24 |
| 4. Mark-as-Paid | v1.0 | 6/6 | ✅ Complete | 2026-04-25 |
| 5. Security Hardening | v1.1 | 4/4 | ✅ Complete (PASS-WITH-NOTES) | 2026-04-28 |
| 6. Race & Atomicity | v1.1 | 5/5 | ✅ Complete (PASS-WITH-NOTES) | 2026-04-29 |
| 7. UI/Data Consistency | v1.1 | 8/8 | ✅ Complete (PASS-WITH-NOTES) | 2026-04-29 |
| 8. Dev Hygiene | v1.1 | 2/2 | ✅ Complete | 2026-04-29 |
| 9. QA Bug Fix | v1.1 | 4/4 | ✅ Complete | 2026-05-01 |
| 10. fetch-prices CORS fix | v1.1 | 2/2 | ✅ Complete (PASS) | 2026-05-02 |
| 11. Periode Gaji | v1.2 | 1/1 | ✅ Complete (PASS) | 2026-05-02 |
| 12. /kesehatan Foundation | v1.2 | 3/3 | Complete    | 2026-05-08 |
| 13. Diagnostic Data Indicators | v1.2 | 4/4 | Complete   | 2026-05-08 |
| 14. Protection & Tier 4 Checklists | v1.2 | 0/? | Not started | — |
| 15. Modul Edukasi & Kalkulator | v1.2 | 0/? | Not started | — |
| 16. v1.1 Closure & Ops Cleanup | v1.2 | 0/? | Not started | — |
