# Roadmap: Kantong Pintar — v1.0 Financial Foundation

## Overview

Milestone v1.0 menambahkan Net Worth Tracker dan Upcoming Bills Calendar ke app Kantong Pintar yang sudah berjalan. Roadmap dibagi 4 fase terfokus untuk mengurangi risiko per fase: Foundation (DB + bug fix + nav restructure) → Net Worth Tracker (UI baru, additive only) → Bills Display (display-only, baca data yang sudah ada) → Mark-as-Paid (perubahan paling berisiko, diisolasi di fase terakhir).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - DB infrastructure, fix bug nextDueDate, restructure navigasi — tanpa UI baru
- [ ] **Phase 2: Net Worth Tracker** - CRUD akun/liabilitas, tab Kekayaan, metric card Net Worth di Dashboard
- [ ] **Phase 3: Bills Display** - Daftar tagihan bulan ini di Dashboard, color-coding urgency, proyeksi Sisa Aman
- [ ] **Phase 4: Mark-as-Paid** - Tandai tagihan lunas secara atomik tanpa duplikasi transaksi

## Phase Details

### Phase 1: Foundation
**Goal**: Semua DB infrastructure siap, bug nextDueDate diperbaiki, dan navigasi direstruktur — tanpa ada UI baru yang ditambahkan
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, NAV-01
**Success Criteria** (what must be TRUE):
  1. Bug nextDueDate month-end overflow sudah diperbaiki: tagihan tanggal 31 Januari tidak melompat ke 3 Maret setelah satu siklus
  2. 4 tabel baru ada di database (net_worth_accounts, net_worth_liabilities, net_worth_snapshots, bill_payments) masing-masing dengan RLS policy `auth.uid() = user_id` — query dari user lain mengembalikan 0 baris
  3. Tab "Goals" telah diganti menjadi tab "Finansial" dengan 2 sub-tab di dalamnya: "Goals" dan "Kekayaan" — navigasi berfungsi tanpa error
  4. Semua fitur yang sudah ada (transaksi, investasi, goals, pensiun, laporan) tetap berjalan normal setelah perubahan ini
**Plans:** 1/3 plans executed
- [x] 01-01-PLAN.md — Fix nextDueDate month-end overflow (FOUND-01)
- [ ] 01-02-PLAN.md — Create 4 new Supabase tables with RLS in migrations 0012 + 0013 (FOUND-02)
- [ ] 01-03-PLAN.md — Rename Goals tab to Finansial with Kekayaan + Goals sub-tabs (NAV-01)

### Phase 2: Net Worth Tracker
**Goal**: User bisa mengelola aset dan liabilitas, melihat total Net Worth, dan melihat trend bulanan dari sub-tab Kekayaan dan metric card Dashboard
**Depends on**: Phase 1
**Requirements**: NW-01, NW-02, NW-03, NW-04, NW-05, NW-06, NW-07
**Success Criteria** (what must be TRUE):
  1. User dapat menambah, edit, dan hapus akun/aset (tabungan, giro, cash, deposito, dompet digital, properti, kendaraan) dengan nama dan saldo
  2. User dapat menambah, edit, dan hapus liabilitas (KPR, cicilan kendaraan, kartu kredit, paylater, KTA) dengan nama dan jumlah outstanding
  3. Nilai investasi dari tab Investasi tampil otomatis sebagai baris read-only di breakdown Net Worth — tidak bisa diinput manual sebagai akun baru
  4. Total Net Worth (aset + investasi − liabilitas) tampil sebagai metric card ke-5 di Dashboard
  5. Chart trend Net Worth bulanan tersedia di sub-tab Kekayaan, dan snapshot bulan ini tercatat otomatis saat tab dibuka (sekali per bulan)
**Plans**: TBD
**UI hint**: yes

### Phase 3: Bills Display
**Goal**: User bisa melihat daftar tagihan bulan ini di Dashboard dengan color-coding urgency dan proyeksi Sisa Aman — tanpa memodifikasi hook yang sudah ada
**Depends on**: Phase 2
**Requirements**: BILL-01, BILL-02, BILL-04, NAV-02 (partial — bills widget only)
**Success Criteria** (what must be TRUE):
  1. Widget di Dashboard menampilkan daftar tagihan bulan ini dari recurring_templates (is_active=true, type=expense, next_due_date ≤ akhir bulan berjalan)
  2. Setiap tagihan tampil dengan color-coding urgency: merah = sudah lewat/hari ini, kuning = ≤7 hari, abu = >7 hari
  3. "Sisa Aman Bulan Ini" tampil di widget: pemasukan aktual bulan ini − pengeluaran aktual bulan ini − tagihan bulan ini yang belum lunas
  4. Semua fitur yang sudah ada tetap berjalan normal — useProcessRecurring tidak dimodifikasi di fase ini
**Plans**: TBD
**UI hint**: yes

### Phase 4: Mark-as-Paid
**Goal**: User bisa menandai tagihan lunas secara atomik — satu operasi membuat transaksi expense, mencatat bill_payment, dan memajukan next_due_date tanpa kemungkinan duplikasi oleh useProcessRecurring
**Depends on**: Phase 3
**Requirements**: BILL-03, NAV-02 (partial — dashboard wiring complete)
**Success Criteria** (what must be TRUE):
  1. User bisa tandai tagihan "Lunas" dari widget Dashboard — satu tombol, satu operasi
  2. Setelah ditandai lunas: expense transaction terbuat, bill_payments tercatat, dan next_due_date pada recurring_template sudah dimajukan ke siklus berikutnya
  3. useProcessRecurring tidak membuat duplikat transaksi untuk tagihan yang sudah ditandai lunas — bahkan jika komponen remount sebelum refresh penuh
  4. Tagihan yang sudah lunas tidak lagi muncul di widget bulan berjalan
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/3 | In Progress|  |
| 2. Net Worth Tracker | 0/TBD | Not started | - |
| 3. Bills Display | 0/TBD | Not started | - |
| 4. Mark-as-Paid | 0/TBD | Not started | - |
