# Kantong Pintar

## What This Is

Kantong Pintar adalah aplikasi personal finance management (PFM) berbasis web untuk pengguna Indonesia. Membantu individu melacak pemasukan/pengeluaran, investasi, tujuan keuangan, dan perencanaan pensiun — dengan konteks lokal Indonesia (BPJS, saham IDX, emas). Sejak v1.0 ditambahkan **Net Worth Tracker** (saldo aset/liabilitas + trend bulanan) dan **Upcoming Bills Calendar** dengan flow atomic mark-as-paid.

## Core Value

Pengguna bisa melihat gambaran lengkap kondisi keuangan mereka dalam satu tempat, dengan kalkulasi yang relevan untuk konteks Indonesia.

## Current State

**Latest milestone:** v1.0 Financial Foundation — shipped 2026-04-25 (3 days execution)
**Production:** https://kantongpintar.vercel.app/ — verified live via Playwright UAT 2026-04-25
**Audit:** PASS-WITH-NOTES (15/15 requirements satisfied; 8 deferred items tracked in `.planning/STATE.md`)

## Current Milestone: v1.1 Hardening & Consistency

**Goal:** Tutup 16 finding security/race/data-integrity dari audit pasca-v1.0 (`.planning/codebase/REVIEW-2026-04-27.md`) — 3 Critical + 6 High + 7 Medium.

**Target areas:**
- Security: Edge Function auth + CORS, RLS info-disclosure (profiles/allowed_emails), allowlist bootstrap protection, RPC IDOR (aggregate functions)
- Race & data integrity: useProcessRecurring duplicate-transaction prevention, allocation_pct cross-row enforcement, seed atomicity
- Consistency: timezone (UTC vs WIB), goal cash/investasi UX, withdraw RPC, csv view-as guard, nextDueDate parity (TS vs SQL)
- Dev hygiene: missing seed.sql, pie-label cast, dashboard recentTx note

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

### Active

(v1.1 requirements ditulis di `.planning/REQUIREMENTS.md` setelah research selesai)

### Out of Scope

- Bank account auto-sync — Indonesia belum ada open banking API; manual input saja
- AI auto-kategorisasi — jangka panjang
- Budget/Anggaran per kategori — kandidat untuk milestone berikutnya (sebelumnya Out of Scope; user belum konfirmasi prioritas)
- Zakat calculator — kandidat untuk milestone berikutnya

## Context

- **Stack:** React 19 + TypeScript + Vite + Supabase (PostgreSQL + RLS + Auth) + TailwindCSS 4 + shadcn/ui + Recharts + sonner toast + react-query
- **Auth:** Google OAuth only, signup dibatasi via `allowed_emails` table
- **DB:** Supabase dengan Row Level Security — setiap data terikat `user_id`. View `upcoming_bills_unpaid` (security_invoker) sejak v1.0
- **RPC:** `mark_bill_paid` (atomic SECURITY DEFINER, FOR UPDATE race-safe), `next_due_date_sql` helper — sejak v1.0
- **Deployment:** Vercel auto-deploy dari `master` (build time ~15-30s)
- **Existing recurring data:** Tabel `recurring_templates` sudah ada — dipakai untuk Bills via `upcoming_bills_unpaid` view
- **Multi-user:** Admin bisa view-as user lain — fitur baru harus support ini juga
- **Migrations:** 0001 → 0015 (15 migrations applied to cloud)

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
*Last updated: 2026-04-27 — v1.1 milestone started (Hardening & Consistency)*
