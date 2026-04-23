# Roadmap: Kantong Pintar — v1.0 Financial Foundation

## Overview

Milestone v1.0 menambahkan dua kapabilitas baru ke app Kantong Pintar yang sudah berjalan: Net Worth Tracker (fase 1) dan Upcoming Bills Calendar (fase 2). Net Worth dibangun lebih dulu karena self-contained CRUD dengan tabel baru dan tidak ada risiko ke hook yang sudah berjalan. Upcoming Bills dibangun setelah itu karena memodifikasi `useProcessRecurring` yang auto-run di setiap load — lebih aman disentuh setelah fase 1 tervalidasi.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Net Worth Tracker** - DB migrations, CRUD akun/liabilitas, tab Finansial, metric card Dashboard
- [ ] **Phase 2: Upcoming Bills Calendar** - bill_payments table, widget Dashboard, mark-as-paid atomik, sisa aman, fix nextDueDate bug

## Phase Details

### Phase 1: Net Worth Tracker
**Goal**: User bisa melihat dan mengelola total kekayaan bersih mereka — aset, liabilitas, dan investasi otomatis — dari tab Finansial dan Dashboard
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01 (partial), FOUND-02 (partial: 3 tabel), NW-01, NW-02, NW-03, NW-04, NW-05, NW-06, NW-07, NAV-01
**Success Criteria** (what must be TRUE):
  1. User dapat menambah, edit, dan hapus akun/aset (tabungan, giro, cash, deposito, dompet digital, properti, kendaraan) dengan nama dan saldo
  2. User dapat menambah, edit, dan hapus liabilitas (KPR, cicilan kendaraan, kartu kredit, paylater, KTA) dengan nama dan jumlah outstanding
  3. Nilai investasi dari tab Investasi tampil otomatis sebagai baris read-only di breakdown Net Worth — tidak bisa diinput manual
  4. Total Net Worth (aset + investasi − liabilitas) tampil sebagai metric card ke-5 di Dashboard
  5. Chart trend Net Worth bulanan tersedia di sub-tab Kekayaan, dan snapshot bulan ini tercatat otomatis saat tab dibuka
**Plans**: TBD
**UI hint**: yes

### Phase 2: Upcoming Bills Calendar
**Goal**: User bisa melihat tagihan yang akan jatuh tempo bulan ini, menandai yang sudah lunas secara atomik, dan mengetahui proyeksi sisa uang aman bulan ini
**Depends on**: Phase 1
**Requirements**: FOUND-01, FOUND-02 (partial: tabel bill_payments), BILL-01, BILL-02, BILL-03, BILL-04, NAV-02
**Success Criteria** (what must be TRUE):
  1. Widget di Dashboard menampilkan daftar tagihan bulan ini dari recurring templates (type=expense, next_due_date ≤ akhir bulan) dengan color-coding: merah = lewat/hari ini, kuning = ≤7 hari, abu = >7 hari
  2. User bisa tandai tagihan "Lunas" dan satu operasi tersebut membuat expense transaction, mencatat bill_payment, serta memajukan next_due_date — tanpa kemungkinan duplikasi oleh useProcessRecurring
  3. "Sisa Aman Bulan Ini" tampil di Dashboard: pemasukan aktual − pengeluaran aktual − tagihan bulan ini yang belum lunas
  4. Bug nextDueDate month-end overflow sudah diperbaiki: tagihan tanggal 31 Januari tidak melompat ke 3 Maret setelah dibayar
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Net Worth Tracker | 0/TBD | Not started | - |
| 2. Upcoming Bills Calendar | 0/TBD | Not started | - |
