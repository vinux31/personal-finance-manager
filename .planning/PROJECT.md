# Kantong Pintar

## What This Is

Kantong Pintar adalah aplikasi personal finance management (PFM) berbasis web untuk pengguna Indonesia. Membantu individu melacak pemasukan/pengeluaran, investasi, tujuan keuangan, dan perencanaan pensiun — dengan konteks lokal Indonesia (BPJS, saham IDX, emas). Sejak v1.0 ditambahkan **Net Worth Tracker** (saldo aset/liabilitas + trend bulanan) dan **Upcoming Bills Calendar** dengan flow atomic mark-as-paid.

## Core Value

Pengguna bisa melihat gambaran lengkap kondisi keuangan mereka dalam satu tempat, dengan kalkulasi yang relevan untuk konteks Indonesia.

## Current State

**Latest milestone:** v1.2 Strategic Layer & Verification Closure — shipped 2026-05-15 (6 phases, 17 plans, ~13 days execution)
**Active milestone:** None — planning v1.3
**Production:** https://kantongpintar.vercel.app/ — B1-B5 live UAT PASS 2026-05-15 (process_due_recurring idempotency, mark-paid race, 2-tab withdraw lock, completed→active flip, WIB date)
**Audit:** v1.2 tech_debt — 26/26 requirements satisfied; deferred 37 human visual UAT items (non-blocking)
**Tech stack stable:** React 19 + TS + Vite + Supabase (RLS + 30 migrations applied via Studio) + TailwindCSS 4 + shadcn/ui + Recharts + vitest
**Codebase size:** 303 files changed +49k/-4.9k since v1.1 (191 commits); ~81k+ LOC total estimate

**Started:** 2026-05-08

## Requirements

### Validated

<!-- Existing features sebelum v1.0 -->

- ✓ Dashboard dengan summary cards (pemasukan, pengeluaran, net bulan ini, nilai investasi) — pre-v1.0
- ✓ Transaksi: CRUD, filter, CSV import/export, recurring transactions — pre-v1.0
- ✓ Investasi: portfolio tracking, auto price update (saham IDX + emas), CSV, price history — pre-v1.0
- ✓ Goals: buat/edit/hapus goals, link ke investasi, alokasi persentase, progress bar — pre-v1.0
- ✓ Pensiun: simulasi DCA, hitung total (BPJS JHT/JP, DPPK, DPLK, Taspen, pesangon), panduan — pre-v1.0
- ✓ Laporan: bar/pie charts per periode, PDF export — pre-v1.0
- ✓ Catatan: notes linked ke transaksi, search, pagination — pre-v1.0
- ✓ Pengaturan: theme, admin multi-user, view-as mode — pre-v1.0
- ✓ Auth: Google OAuth via Supabase, allowed emails whitelist — pre-v1.0
- ✓ Offline banner, dark mode, responsive design — pre-v1.0

<!-- v1.0 Financial Foundation — shipped 2026-04-25 -->

- ✓ nextDueDate() monthly clamping (FOUND-01) — v1.0 Phase 1
- ✓ DB schema net worth (net_worth_accounts, net_worth_liabilities, net_worth_snapshots) + RLS (FOUND-02) — v1.0 Phase 1
- ✓ DB schema bill_payments + RLS + FK semantics (FOUND-02) — v1.0 Phase 1
- ✓ Navigasi: tab "Finansial" dengan sub-tab Kekayaan + Goals (NAV-01) — v1.0 Phase 1
- ✓ User bisa lihat Net Worth total (aset − liabilitas) di dashboard (NW-01) — v1.0 Phase 2
- ✓ User bisa input saldo rekening bank — 7 tipe akun (NW-02, NW-03) — v1.0 Phase 2
- ✓ User bisa input utang/liabilitas — 5 tipe (NW-04, NW-05) — v1.0 Phase 2
- ✓ Nilai investasi read-only di Net Worth (NW-06) — v1.0 Phase 2
- ✓ Net Worth trend chart bulanan + auto-snapshot (NW-07) — v1.0 Phase 2
- ✓ Upcoming bills dari recurring templates tampil di dashboard (BILL-01) — v1.0 Phase 3
- ✓ Color-coded urgency pada bills (BILL-02) — v1.0 Phase 3
- ✓ Atomic mark-as-paid (single op: expense + bill_payment + advance next_due_date) (BILL-03) — v1.0 Phase 4
- ✓ Sisa Aman formula: pemasukan − pengeluaran − tagihan belum bayar (BILL-04) — v1.0 Phase 3+4
- ✓ Dashboard metric card ke-5 Net Worth + widget Tagihan + mark-as-paid wiring (NAV-02) — v1.0 Phase 2+3+4

<!-- v1.1 Hardening & Consistency — shipped 2026-05-02 -->

- ✓ Edge function fetch-prices JWT enforcement (verify_jwt platform-layer + auth.getUser) + per-domain CORS allowlist (kantongpintar.app, www, vercel.app) — v1.1 Phase 5 + Phase 10 (SEC-01)
- ✓ RLS profiles + allowed_emails: non-admin only sees own row; allowed_emails admin-only — v1.1 Phase 5 (SEC-02)
- ✓ enforce_email_allowlist hardened with empty-table fallback (only initial admin can signup) — v1.1 Phase 5 (SEC-03)
- ✓ aggregate_by_period + aggregate_by_category RPC IDOR guards (raise 42501 for cross-user access) — v1.1 Phase 5 (SEC-04)
- ✓ process_due_recurring RPC: race-safe FOR UPDATE per template + bill_payments idempotency — v1.1 Phase 6 (RACE-01)
- ✓ goal_investments_total_check trigger BEFORE INSERT/UPDATE FOR UPDATE — v1.1 Phase 6 (RACE-02)
- ✓ withdraw_from_goal atomic RPC dengan FOR UPDATE row lock + status flip completed→active — v1.1 Phase 6 (RACE-03)
- ✓ TS nextDueDate dihapus dari hot path (replaced by RPC); parity test dengan PG next_due_date_sql — v1.1 Phase 6 (DEV-01)
- ✓ goals_with_progress VIEW (security_invoker) + add_money_to_goal_v2 considers cash + investasi totals — v1.1 Phase 7 (CONS-01)
- ✓ todayISO() WIB-aware date utility + ESLint no-restricted-syntax rule (price_history live verified Phase 10) — v1.1 Phase 7 + Phase 10 (CONS-02)
- ✓ seed_rencana atomic RPC + user_seed_markers (replaces localStorage) — v1.1 Phase 7 (CONS-03)
- ✓ Reset Seed Rencana UX: localStorage key per-user — v1.1 Phase 7 (UX-01)
- ✓ View-As CSV import gate (TransactionsTab + InvestmentsTab disabled) — v1.1 Phase 7 (UX-02)
- ✓ Recharts pie label PieLabelRenderProps typed (no unsafe cast) — v1.1 Phase 8 (DEV-02)
- ✓ supabase/seed.sql aligned dengan config.toml — v1.1 Phase 8 (DEV-03)
- ✓ Performance note recentTx documented in PROJECT.md Context — v1.1 Phase 8 (DEV-04)
- ✓ 8 QA bugs fixed (2 Critical DB triggers/RPC + 4 Medium frontend + 2 Low a11y/i18n) — v1.1 Phase 9 (QA-CRITICAL-1, QA-CRITICAL-2, QA-MEDIUM-3..6, QA-LOW-7..8)

<!-- v1.2 Strategic Layer & Verification Closure — shipped 2026-05-15 -->

- ✓ `pay_periods` table + PayPeriodCard Dashboard + Laporan Periode Gaji + manual management `/periode-gaji` (migration 0026) — v1.2 Phase 11
- ✓ Halaman `/kesehatan` accessible via sidebar grup "Strategi" (STRAT-01) — v1.2 Phase 12
- ✓ Landing `/kesehatan` — piramida 4-tier CSS trapezoid + banner kalkulator + grid 6 card modul (STRAT-02) — v1.2 Phase 12
- ✓ Tabel `protection_checklist` dengan RLS `auth.uid()=user_id OR is_admin()` + lazy-create upsert (SCHEMA-01) — v1.2 Phase 12 (migration 0029)
- ✓ Empty state full (< 3 rows total) — piramida grayed-out + 3 quick-link CTA `/transaksi`/`/kekayaan`/`/goals` (DIAG-11) — v1.2 Phase 12
- ✓ Indikator Dana Darurat data-driven (likuid ÷ avg expense 3bln, threshold ≥6/3-5/<3 bulan) + edge case data tipis placeholder (DIAG-01, DIAG-10) — v1.2 Phase 13
- ✓ Indikator Savings Rate avg 3 bulan kalender (≥20/10-19/<10%) (DIAG-02) — v1.2 Phase 13
- ✓ Indikator DAR Konsumtif (non-KPR ÷ aset finansial) + DAR Total info-only (DIAG-03) — v1.2 Phase 13
- ✓ Indikator Goals On-track long-term + smart fallback CTA /goals (DIAG-05) — v1.2 Phase 13
- ✓ Indikator Pensiun readiness + smart fallback CTA /pensiun + stale 6+ bulan notice (DIAG-06) — v1.2 Phase 13
- ✓ Indikator Rasio Investasi (investments+deposito ÷ aset finansial, ≥40/20-39/<20%) (DIAG-07) — v1.2 Phase 13
- ✓ Indikator Diversifikasi DISTINCT asset_type + deposito bonus (≥3/2/≤1) (DIAG-08) — v1.2 Phase 13
- ✓ Tier expand panel inline menampilkan indikator + CTA + modul link (STRAT-03) — v1.2 Phase 13
- ✓ Tier 1 inline form Asuransi Kesehatan (3-state machine, optimistic mutation, 5 opsi radio) (DIAG-04) — v1.2 Phase 14
- ✓ Tier 4 smart-gated checklist estate/asuransi jiwa (gate-conditional, auto-save per radio) (DIAG-09) — v1.2 Phase 14
- ✓ View-As 3-layer read-only guard (UI disable + mutation throw + RLS WITH CHECK) (DIAG-12) — v1.2 Phase 14
- ✓ 6 modul edukasi sub-route `/kesehatan/<slug>` + Fraunces variable font + breadcrumb + prev/next (STRAT-04) — v1.2 Phase 15
- ✓ Kalkulator compound interest full-page `/kesehatan/kalkulator` (4 sliders + Recharts + tabel 5-tahunan) (STRAT-05) — v1.2 Phase 15
- ✓ GlossaryTooltip Radix Popover (8 istilah teknis inline di prose modul) (STRAT-06) — v1.2 Phase 15
- ✓ B1-B5 live UAT PASS production — process_due_recurring idempotency, mark-paid 5x race, 2-tab withdraw pessimistic lock, completed→active flip, todayISO WIB date (VERIF-01..06) — v1.2 Phase 16
- ✓ Migration history reconciliation Path (b) — docs/migration-playbook.md + procedural Studio-paste default documented (TECHDEBT-01) — v1.2 Phase 16

### Active

(No active milestone — start v1.3 with `/gsd-new-milestone`)

### Out of Scope

- Bank account auto-sync — Indonesia belum ada open banking API; manual input saja
- AI auto-kategorisasi — jangka panjang
- Budget/Anggaran per kategori — kandidat untuk milestone berikutnya (sebelumnya Out of Scope; user belum konfirmasi prioritas)
- Zakat calculator — kandidat untuk milestone berikutnya

## Context

- **Stack:** React 19 + TypeScript + Vite + Supabase (PostgreSQL + RLS + Auth) + TailwindCSS 4 + shadcn/ui + Recharts + sonner toast + react-query
- **Auth:** Google OAuth only, signup dibatasi via `allowed_emails` table
- **DB:** Supabase dengan Row Level Security — setiap data terikat `user_id`. View `upcoming_bills_unpaid` (security_invoker) sejak v1.0
- **RPC:** `mark_bill_paid`, `process_due_recurring` (batch recurring → unified expense + income atomically; D-01), `withdraw_from_goal` (atomic withdraw, FOR UPDATE serialization, P0001 insufficient saldo) — semua SECURITY DEFINER FOR UPDATE race-safe. Helper `next_due_date_sql`. Trigger `goal_investments_total_check` BEFORE INSERT/UPDATE on `goal_investments` (RACE-02 cap enforcement). Sejak v1.1 Phase 6.
- **Deployment:** Vercel auto-deploy dari `master` (build time ~15-30s)
- **Existing recurring data:** Tabel `recurring_templates` sudah ada — dipakai untuk Bills via `upcoming_bills_unpaid` view. **Audit table `bill_payments` sekarang mencatat BOTH expense AND income runs (D-04, sejak Phase 6)** — semantic note di migration 0019 menjelaskan nama tabel kept untuk back-compat dengan `mark_bill_paid` + view; rename ke `recurring_runs` adalah v1.2 backlog kalau dataset/ambiguity ganggu.
- **Multi-user:** Admin bisa view-as user lain — fitur baru harus support ini juga
- **Migrations:** 0001 → 0029 (29+ migrations applied to cloud via Studio SQL Editor — v1.2 Phase 11 added 0026, Phase 12 added 0029_protection_checklist.sql, Phase 16 applied 0028 hotfix; `db push` broken (history mismatch 0014+), Studio paste tetap default per migration-playbook.md)
- **Edge Functions:** `fetch-prices` (JWT-enforced via verify_jwt=true; CORS allowlist 3 domains incl. kantongpintar.vercel.app since Phase 10)
- **Performance:** Dashboard `recentTx` query pakai `useTransactions({ limit: 5 })` + index `transactions_date_idx` — sufficient untuk dataset < 50k rows; pertimbangkan migrasi ke materialized view jika dataset user aktif melewati threshold tersebut.

## Constraints

- **Tech stack:** Tetap di existing stack — tidak tambah library besar kecuali sangat perlu
- **Database:** Semua tabel baru harus pakai RLS dengan `user_id`
- **Indonesia-first:** Semua copy/label dalam Bahasa Indonesia
- **Mobile-responsive:** App diakses dari mobile — tabel → card stack di layar kecil
- **Production verify-before-close:** Setiap milestone close memerlukan production UAT, bukan hanya dev server

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Manual bank balance input | Tidak ada open banking API di Indonesia | ✓ Shipped (v1.0) |
| Recurring templates sebagai sumber upcoming bills | Data sudah ada di DB, tidak perlu duplikasi | ✓ Shipped (v1.0) |
| Snapshot net worth bulanan | Cukup untuk trend chart, tidak perlu real-time | ✓ Shipped (v1.0) |
| Mutation-only Date clamping (setDate(1)+setMonth+Math.min) | `const date` tetap const, tidak perlu reassignment | ✓ Shipped (v1.0 Phase 1) |
| RLS D-06: USING auth.uid()=user_id OR is_admin() + WITH CHECK auth.uid()=user_id | Admin bisa READ semua tapi tidak bisa WRITE atas nama user lain | ✓ Shipped (v1.0 Phase 1) |
| net_worth_accounts & liabilities dua tabel terpisah | Cleaner query semantics daripada discriminator column | ✓ Shipped (v1.0 Phase 1) |
| bill_payments.transaction_id nullable + ON DELETE SET NULL | Payment bisa exist sebelum transaction dibuat (atomic create flow) | ✓ Shipped (v1.0 Phase 1) |
| Build order: Foundation → Net Worth → Bills Display → Mark-as-Paid (riskiest last) | Modifikasi useProcessRecurring perubahan paling berisiko, diisolasi di akhir | ✓ Good — 4 phases shipped no regressions |
| Mark-as-paid via atomic RPC (`mark_bill_paid`) bukan client-side multi-step | Mencegah duplikasi via race dengan useProcessRecurring; FOR UPDATE row lock + IF EXISTS guard | ✓ Good — Playwright UAT verified |
| Optimistic mutation + snapshot rollback (first di project) | UX instant; rollback aman jika RPC fail | ✓ Good — Test 4 UAT verified rollback works |
| Production verify-before-close (Playwright + Supabase Cloud) | Local UAT bisa miss deploy gap (terbukti: prod ternyata di Phase 2 era saat verify-before-close dimulai) | ✓ Validated (catched 1 deploy gap, 1 toast bug) |
| `mapSupabaseError` extract `.message` dari plain-object errors | Supabase RPC errors bukan Error instance, `String(error)` jatuh ke "[object Object]" | ✓ Shipped (v1.0 hot-fix commit a1f96eb) |
| `bill_payments` table unified untuk expense + income (D-04, Phase 6) | Pattern parity dengan `mark_bill_paid` audit; menghindari rebuat tabel kedua untuk income runs; rename → `recurring_runs` ke v1.2 backlog | ✓ Shipped (v1.1 Phase 6 — migration 0019) |
| `process_due_recurring` RPC batch (DATE, UUID, INT) — eliminasi client TS loop di `useProcessRecurring` | Race + IDOR mitigation: `FOR UPDATE` row lock per template + `IF EXISTS bill_payments` skip-on-duplicate. Drops TS `nextDueDate` from hot path (DEV-01). | ✓ Shipped (v1.1 Phase 6 — migration 0019 + hook rewrite) |
| `goal_investments_total_check` trigger BEFORE INSERT/UPDATE FOR EACH ROW with `SUM ... FOR UPDATE` exclude-self | Race-safe cap enforcement at DB layer (RACE-02). SECURITY DEFINER for cross-row sum bypass RLS. Defense-in-depth pasangan client-side check di LinkInvestmentDialog. | ✓ Shipped (v1.1 Phase 6 — migration 0021) |
| `withdraw_from_goal` RPC ganti optimistic lock client | Atomic withdraw, race-safe via `FOR UPDATE` row lock pada goals row. P0001 + Indonesian message dengan saldo eksplisit; status flip `completed` → `active` per D-11. | ✓ Shipped (v1.1 Phase 6 — migration 0020 + frontend refactor) |
| Future signature changes Phase 6 functions WAJIB emit `DROP FUNCTION IF EXISTS sig` sebelum CREATE OR REPLACE | Phase 5 0017→0018 lesson: PG keys function identity on (name, arg_types). Tanpa explicit DROP, signature change → second overload, old version tetap callable via direct PostgREST → race + IDOR vector. | ✓ Documented (v1.1 Phase 6 VERIFICATION code-review checklist) |
| RETURNS TABLE plpgsql output variables shadowing — qualify base-table refs dengan alias | withdraw_from_goal v1.1 Phase 7 hot-fix 0024: `RETURNS TABLE (current_amount NUMERIC, ...)` membuat output var conflict dengan column `goals.current_amount` → ambiguous `SELECT current_amount FROM goals`. Fix: gunakan alias `g.current_amount`. | ✓ Documented (v1.1 Phase 7 — migration 0024) |
| Edge Function deploy via Supabase Dashboard sebagai workaround saat CLI tidak terinstall | Phase 10 lesson: dev machine tanpa `supabase` CLI tetap bisa deploy via Dashboard → Edge Functions → Code editor. Caveat: tidak ada git-source-of-truth verification (manual paste). Kandidat dev-onboarding doc v1.2. | ✓ Validated (v1.1 Phase 10) |
| CORS allowlist drift saat domain baru — domain decision = ALLOWED_ORIGINS update di same plan/PR | Phase 10 lesson: deploy ke domain baru (kantongpintar.vercel.app) tanpa update edge function ALLOWED_ORIGINS → silent fail (OPTIONS pre-flight 200 tapi browser block POST karena Origin mismatch). Pattern: tightly couple domain change dengan CORS update. | ✓ Documented (v1.1 Phase 10) |
| Gateway-layer JWT reject (verify_jwt=true) > handler-layer reject (defense-in-depth) | Phase 10 lesson: curl tanpa Authorization → gateway returns `{code:UNAUTHORIZED_NO_AUTH_HEADER}` dengan `Access-Control-Allow-Origin: *` (gateway, bukan handler). Handler tidak dieksekusi. CORS-echo-back assertion tidak applicable untuk request tanpa JWT. Functional auth gate intact via dual layer. | ✓ Validated (v1.1 Phase 5 + Phase 10) |
| Migration history reconciliation (0014..0030 Local-only) — Path (b) document procedural alternative | `supabase db push` broken karena history mismatch: 0001-0013 applied via CLI, 0014-0030 applied via Studio SQL Editor paste yang tidak update `schema_migrations`. Path (a) repair terlalu berisiko tanpa staging mirror. Path (b): Studio paste tetap default, dokumentasi playbook, opsional tambah dummy entries di `schema_migrations`. | ✓ Documented (v1.2 Phase 16 — docs/migration-playbook.md) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-16 — after v1.2 milestone*
