# Kantong Pintar

## What This Is

Kantong Pintar adalah aplikasi personal finance management (PFM) berbasis web untuk pengguna Indonesia. Membantu individu melacak pemasukan/pengeluaran, investasi, tujuan keuangan, dan perencanaan pensiun — dengan konteks lokal Indonesia (BPJS, saham IDX, emas).

## Core Value

Pengguna bisa melihat gambaran lengkap kondisi keuangan mereka dalam satu tempat, dengan kalkulasi yang relevan untuk konteks Indonesia.

## Current Milestone: v1.0 Financial Foundation

**Goal:** Tambahkan Net Worth Tracker dan Upcoming Bills Calendar sebagai fondasi finansial yang belum ada di app.

**Target features:**
- Net Worth Tracker: saldo rekening bank, aset non-investasi, utang/liabilitas, trend net worth
- Upcoming Bills Calendar: tagihan jatuh tempo 14 hari ke depan dari recurring templates, mark as paid, proyeksi cashflow

## Requirements

### Validated

<!-- Existing features — sudah shipped dan berjalan -->

- ✓ nextDueDate() monthly clamping — Phase 1 (tagihan tgl 31 tidak overflow ke bulan berikutnya)
- ✓ DB schema net worth (net_worth_accounts, net_worth_liabilities, net_worth_snapshots) + RLS — Phase 1
- ✓ DB schema bill_payments + RLS + FK semantics (CASCADE/SET NULL) — Phase 1
- ✓ Navigasi: tab "Finansial" dengan sub-tab Kekayaan + Goals — Phase 1
- ✓ Dashboard dengan summary cards (pemasukan, pengeluaran, net bulan ini, nilai investasi)
- ✓ Transaksi: CRUD, filter, CSV import/export, recurring transactions
- ✓ Investasi: portfolio tracking, auto price update (saham IDX + emas), CSV, price history
- ✓ Goals: buat/edit/hapus goals, link ke investasi, alokasi persentase, progress bar
- ✓ Pensiun: simulasi DCA, hitung total (BPJS JHT/JP, DPPK, DPLK, Taspen, pesangon), panduan
- ✓ Laporan: bar/pie charts per periode, PDF export
- ✓ Catatan: notes linked ke transaksi, search, pagination
- ✓ Pengaturan: theme, admin multi-user, view-as mode
- ✓ Auth: Google OAuth via Supabase, allowed emails whitelist
- ✓ Offline banner, dark mode, responsive design

### Active

<!-- Milestone v1.0 — sedang dibangun -->

- [ ] User bisa lihat Net Worth total (aset − liabilitas) di dashboard
- [ ] User bisa input saldo rekening bank (tabungan, giro, cash)
- [ ] User bisa input utang/liabilitas (KPR, cicilan, kartu kredit, dll)
- [ ] Net Worth trend chart bulanan tersedia
- [ ] Upcoming bills dari recurring templates tampil di dashboard (14 hari ke depan)
- [ ] User bisa mark tagihan sebagai sudah dibayar
- [ ] Proyeksi "sisa aman bulan ini" dihitung dari income − bills terjadwal

### Out of Scope

- Bank account auto-sync — Indonesia belum ada open banking API; manual input saja
- Budget/Anggaran per kategori — milestone berikutnya
- Zakat calculator — milestone berikutnya
- AI auto-kategorisasi — jangka panjang

## Context

- **Stack:** React 19 + TypeScript + Vite + Supabase (PostgreSQL + RLS + Auth) + TailwindCSS 4 + shadcn/ui + Recharts
- **Auth:** Google OAuth only, signup dibatasi via allowed_emails table
- **DB:** Supabase dengan Row Level Security — setiap data terikat user_id
- **Deployment:** Vercel
- **Existing recurring data:** Table `recurring_templates` sudah ada dengan `next_due_date`, `frequency`, `amount`, `is_active` — bisa langsung dipakai untuk upcoming bills
- **Multi-user:** Admin bisa view-as user lain — fitur baru harus support ini juga

## Constraints

- **Tech stack:** Tetap di existing stack — tidak tambah library besar kecuali sangat perlu
- **Database:** Semua tabel baru harus pakai RLS dengan user_id
- **Indonesia-first:** Semua copy/label dalam Bahasa Indonesia
- **Mobile-responsive:** App diakses dari mobile — tabel → card stack di layar kecil

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Manual bank balance input | Tidak ada open banking API di Indonesia | — Pending |
| Recurring templates sebagai sumber upcoming bills | Data sudah ada di DB, tidak perlu duplikasi | — Pending |
| Snapshot net worth bulanan | Cukup untuk trend chart, tidak perlu real-time | — Pending |
| Mutation-only Date clamping (setDate(1)+setMonth+Math.min) | `const date` tetap const, tidak perlu reassignment — Phase 1 | ✓ Shipped |
| RLS D-06: USING (auth.uid()=user_id OR is_admin()) + WITH CHECK (auth.uid()=user_id) | Admin bisa READ semua tapi tidak bisa WRITE atas nama user lain — Phase 1 | ✓ Shipped |
| net_worth_accounts & liabilities dua tabel terpisah (bukan discriminator column) | Cleaner query semantics — Phase 1 | ✓ Shipped |
| bill_payments.transaction_id nullable + ON DELETE SET NULL | Payment bisa exist sebelum transaction dibuat (atomic create flow) — Phase 1 | ✓ Shipped |

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
*Last updated: 2026-04-24 after Phase 1 (Foundation)*
