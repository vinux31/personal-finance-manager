# Milestone v1.2 — Strategic Layer & Verification Closure

**Status:** Active
**Started:** 2026-05-08
**Source:** Design spec `docs/superpowers/specs/2026-05-08-framework-page-design.md` (commit `b219fc3`) + memory `project_v1_2_verification_backlog.md`
**Research:** Skip — design spec sudah detail; plan-phase boleh research per-phase kalau perlu.

**Goal:** Tambahkan halaman `/kesehatan` (piramida diagnostic + literasi finansial) sebagai layer strategis di atas tabs operasional, sekaligus tutup sisa verification debt dari v1.1 (B1-B5 live UAT) dan tech debt minor (migration history reconciliation).

---

## v1.2 Requirements

### Strategic Layer — /kesehatan (STRAT)

- [ ] **STRAT-01**: User punya halaman `/kesehatan` yang accessible via grup sidebar baru "Strategi" (sejajar dengan Keuangan/Aset/Tujuan, di atas Footer). Item sidebar single: "Kesehatan". _Source: design spec §3._
- [ ] **STRAT-02**: Landing `/kesehatan` menampilkan hero piramida 4-tier hidup berwarna, banner kalkulator, dan grid 6 card modul. _Source: design spec §3 layout._
- [x] **STRAT-03**: User klik tier piramida → expand panel inline menampilkan indikator detail + CTA aksi + (kecuali Tier 4) link ke modul terkait. CTA mapping per spec §4.5. _Source: design spec §4 CTA mapping._
- [ ] **STRAT-04**: User akses 6 modul edukasi via sub-route `/kesehatan/<slug>` dengan slug Indonesian: `arus-kas`, `tujuan`, `alokasi-aset`, `instrumen`, `pajak-biaya-inflasi`, `perilaku`. Modul prose pakai typography Fraunces serif. _Source: design spec §3 + §6._
- [ ] **STRAT-05**: User akses kalkulator compound interest via `/kesehatan/kalkulator` (full page) + teaser banner di landing. Kalkulator punya slider awal/bulanan/return/tenor + grafik tahun-per-tahun + tabel breakdown 5-tahunan. _Source: design spec §5._
- [ ] **STRAT-06**: 8 istilah teknis (Asset Allocation, Real Return, Sharpe Ratio, DCA, Drawdown, Expense Ratio, Rebalancing, Risk Tolerance) tampil sebagai tooltip inline (Radix Tooltip) di angka teknis modul. _Source: design spec §6 glossary._

### Diagnostic Indicators (DIAG)

- [x] **DIAG-01**: Indikator Dana Darurat dihitung dari `SUM(net_worth_accounts likuid) ÷ avg(expense bulanan, 3 bulan)`. Threshold: ≥ 6 bulan hijau, 3-5 kuning, < 3 merah. Akun likuid = type IN ('tabungan','giro','cash','dompet_digital'). _Source: design spec §4 tabel indikator._
- [x] **DIAG-02**: Indikator Savings Rate dihitung dari `(income − expense) ÷ income`, avg 3 bulan kalender. Threshold: ≥ 20% hijau, 10-19% kuning, < 10% merah. _Source: design spec §4._
- [x] **DIAG-03**: Indikator DAR Konsumtif dihitung dari `SUM(liabilities WHERE type ≠ 'kpr') ÷ aset finansial`. Threshold: < 20% hijau, 20-40% kuning, > 40% merah. DAR Total tampil sebagai info tambahan, bukan indikator warna. _Source: design spec §4 + Gap 5._
- [ ] **DIAG-04**: Tier 1 panel berisi inline checklist Asuransi Kesehatan (single question: kantor/BPJS/pribadi/kombinasi/tidak). Hijau kalau bukan "tidak", merah kalau "tidak". _Source: design spec §4 inline checklist._
- [ ] **DIAG-05**: Indikator Goals Long-term on-track menghitung % goals yang `current_amount/target_amount ≥ time_elapsed/total_duration`, filter `target_date > NOW() + 1 year AND status='active'`. Threshold: ≥ 75% hijau, 50-74% kuning, < 50% merah. Smart fallback CTA kalau user belum punya long-term goal. _Source: design spec §4 + Gap 3._
- [ ] **DIAG-06**: Indikator Pensiun menghitung `pension_simulations` projection ÷ target. Threshold: ≥ 100% hijau, 70-99% kuning, < 70% merah. Smart fallback CTA kalau belum simulasi; catatan kecil kalau `updated_at > 6 bulan`. _Source: design spec §4 + Gap 4._
- [ ] **DIAG-07**: Indikator Rasio Investasi dihitung dari `(SUM(investments value) + SUM(deposito balance)) ÷ aset finansial`. Threshold: ≥ 40% hijau, 20-39% kuning, < 20% merah. Properti & kendaraan exclude dari denominator. _Source: design spec §4._
- [ ] **DIAG-08**: Indikator Diversifikasi dihitung dari `COUNT(DISTINCT investments.asset_type) + (1 if deposito balance > 0)`. Threshold: ≥ 3 hijau, 2 kuning, ≤ 1 merah. _Source: design spec §4._
- [ ] **DIAG-09**: Tier 4 panel berisi smart-gated checklist — gate question "punya tanggungan?" → kalau Tidak: 3 estate basic; kalau Ya: 3 estate + 3 asuransi jiwa. _Source: design spec §4 smart-gated._
- [x] **DIAG-10**: Edge case data tipis (transactions < 3 bulan kalender berbeda) untuk indikator #1 dan #2 → placeholder "Butuh 3 bulan data, sudah X/3" dengan CTA `/transaksi`. Indikator placeholder tidak ikut agregasi warna tier; tier abu-abu hanya kalau semua indikator placeholder/fallback. _Source: design spec §4 edge case._
- [ ] **DIAG-11**: Empty state full (total `transactions + accounts + goals + investments` rows < 3) → welcome state piramida grayed-out + 3 quick-link CTA ke `/transaksi` / `/kekayaan` / `/goals`. Banner kalkulator + grid modul tetap accessible. _Source: design spec §4 empty state._
- [ ] **DIAG-12**: View-As mode → semua indikator pakai data viewed-user (via `viewingAs ?? userId`). Inline form Tier 1 #4 dan Tier 4 checklist switch ke read-only mode (admin tidak boleh modify data user lain). _Source: design spec §4 View-As compatibility._

### Schema (SCHEMA)

- [ ] **SCHEMA-01**: Tabel baru `protection_checklist` dengan PRIMARY KEY `user_id`, fields untuk Tier 1 #4 (`health_coverage`) + Tier 4 gate + estate + life insurance, RLS policy `auth.uid() = user_id OR is_admin()`. Default behavior lazy-create row di first interaction. _Source: design spec §7._

### Verification Closure dari v1.1 (VERIF)

- [ ] **VERIF-01**: Pre-condition data state untuk B1-B5 UAT dibuat — template Gaji recurring (next_due_date bulan ini), expense recurring template + bill due ≤ today, goal dengan cash > 0, goal status='completed' dengan cash ≥ target. _Source: memory v1_2_verification_backlog._
- [ ] **VERIF-02** (B1): Login → Transaksi tab → assert Gaji bulan ini tepat 1 row; reload → masih 1 row (idempotency RPC `process_due_recurring`). _Source: memory v1_2_verification_backlog Ph06 UAT-1._
- [ ] **VERIF-03** (B2): Klik "Lunas" → switch Transaksi tab 5x dalam 1 detik → assert no duplicate row di `transactions` untuk tanggal+kategori sama. _Source: memory v1_2_verification_backlog Ph06 UAT-2._
- [ ] **VERIF-04** (B3): Buka 2 tab, "Tarik Dana" Rp 50.000 dari goal Rp 100.000 di tiap tab, submit quick succession → assert satu sukses, satu toast "Saldo kas tidak cukup (tersedia Rp 50.000)". _Source: memory v1_2_verification_backlog Ph06 UAT-4._
- [ ] **VERIF-05** (B4): Tarik Dana Rp 1 dari goal completed → assert badge berubah dari "Tercapai" ke "Aktif" + SQL verify `goals.status='active'`. _Source: memory v1_2_verification_backlog Ph06 UAT-5._
- [ ] **VERIF-06** (B5): Klik Refresh Harga di Investasi tab → network request → verifikasi field `date` di payload adalah WIB (bukan UTC). _Source: memory v1_2_verification_backlog Ph07 UAT-2 (CORS unblocked Phase 10 v1.1)._

### Tech Debt Minor (TECHDEBT)

- [ ] **TECHDEBT-01**: Migration history reconciliation — `supabase migration list --linked` saat ini menunjukkan 0014..0028 sebagai Local-only karena `db push` broken (history mismatch). Ada 2 jalur: (a) repair history sehingga `db push` jalan kembali, atau (b) document procedural alternative (Studio paste tetap) + dummy "applied" entry. Pilih satu, dokumentasikan keputusan di PROJECT.md Key Decisions. _Source: STATE.md deferred items + memory `project_supabase_migration_workflow`._

---

## Future Requirements (Deferred from v1.2)

Kandidat untuk v1.3+:

- Modul "Warisan & Estate Planning" — Tier 4 v1.2 cuma checklist tanpa link modul; v1.3 boleh tambah modul edukasi tentang estate planning Indonesia
- Kalkulator suite tambahan — real return (compound + inflasi + pajak), expense drag, retirement gap calculator
- IPS Builder — Investment Policy Statement guided form
- Risk tolerance quiz — kuesioner profil risiko + suggest target allocation
- Behavior gap detector — analisis pattern transaksi untuk surface bias kognitif
- Tier 4 jadi diagnostic data-driven — saat ini cuma checklist self-assessment; v1.3 bisa pull dari schema baru (asuransi tracking, dll)
- Asset class normalization — `investments.asset_type` saat ini TEXT bebas; v1.3 normalize ke 5 standar dengan migration
- Tier panel "shareable snapshot" / export PDF
- SEC-01 SC#3 destructive variant — butuh staging mirror infra
- Quiz tracking di modul edukasi — saat ini quick-check tidak save score

## Out of Scope

- **Bank account auto-sync** — Indonesia belum ada open banking API; manual input saja (carry over dari pre-v1.0)
- **AI auto-kategorisasi transaksi** — jangka panjang (carry over)
- **Budget/Anggaran per kategori** — kandidat untuk milestone berikutnya, user belum konfirmasi prioritas (carry over)
- **Zakat calculator** — kandidat untuk milestone berikutnya (carry over)

---

## Traceability

| REQ | Phase | Status | Notes |
|-----|-------|--------|-------|
| STRAT-01 | Phase 12 | Pending | Sidebar grup "Strategi" + route /kesehatan |
| STRAT-02 | Phase 12 | Pending | Landing shell (piramida + banner + grid 6 modul) |
| STRAT-03 | Phase 13 | Complete | Tier expand panel — wired dengan indicator queries |
| STRAT-04 | Phase 15 | Pending | 6 modul sub-route + Fraunces serif |
| STRAT-05 | Phase 15 | Pending | Kalkulator compound interest + banner |
| STRAT-06 | Phase 15 | Pending | Glossary tooltip 8 istilah (Radix Tooltip) |
| DIAG-01 | Phase 13 | Complete | Indikator Dana Darurat (likuid ÷ avg expense 3 bln) |
| DIAG-02 | Phase 13 | Complete | Indikator Savings Rate (3-bulan avg) |
| DIAG-03 | Phase 13 | Complete | Indikator DAR Konsumtif (non-KPR) + DAR Total info |
| DIAG-04 | Phase 14 | Pending | Tier 1 inline checklist Asuransi Kesehatan |
| DIAG-05 | Phase 13 | Pending | Goals long-term on-track + smart fallback CTA |
| DIAG-06 | Phase 13 | Pending | Pensiun readiness + smart fallback CTA + stale notice |
| DIAG-07 | Phase 13 | Pending | Rasio Investasi (investments + deposito) |
| DIAG-08 | Phase 13 | Pending | Diversifikasi (DISTINCT asset_type + deposito) |
| DIAG-09 | Phase 14 | Pending | Tier 4 smart-gated checklist (estate + asuransi jiwa) |
| DIAG-10 | Phase 13 | Complete | Edge case data tipis #1 & #2 placeholder |
| DIAG-11 | Phase 12 | Pending | Empty state full landing (grayed piramida + 3 CTA) |
| DIAG-12 | Phase 14 | Pending | View-As read-only mode untuk inline form & checklist |
| SCHEMA-01 | Phase 12 | Pending | Tabel `protection_checklist` + RLS |
| VERIF-01 | Phase 16 | Pending | Pre-condition data state setup B1-B5 |
| VERIF-02 | Phase 16 | Pending | B1 — Gaji idempotency UAT |
| VERIF-03 | Phase 16 | Pending | B2 — mark-paid 5x rapid race UAT |
| VERIF-04 | Phase 16 | Pending | B3 — 2-tab withdraw race UAT |
| VERIF-05 | Phase 16 | Pending | B4 — completed→active flip UAT |
| VERIF-06 | Phase 16 | Pending | B5 — Refresh Harga WIB date UAT |
| TECHDEBT-01 | Phase 16 | Pending | Migration history reconciliation (jalur a vs b) — merged dengan VERIF as ops cleanup |

**Coverage:** 26/26 requirements mapped ✓ (100%, no orphans, no duplicates)
