# Requirements: Kantong Pintar

**Defined:** 2026-04-23
**Core Value:** Pengguna bisa melihat gambaran lengkap kondisi keuangan mereka dalam satu tempat, dengan kalkulasi yang relevan untuk konteks Indonesia.

## v1.0 Requirements — Financial Foundation

### Kekayaan (Net Worth)

- [ ] **NW-01**: User dapat melihat total Net Worth (aset − liabilitas) sebagai metric card di Dashboard
- [ ] **NW-02**: User dapat menambah akun/aset dengan nama, tipe (tabungan, giro, cash, deposito, dompet digital, properti, kendaraan), dan saldo
- [ ] **NW-03**: User dapat edit dan hapus akun/aset yang sudah ada
- [ ] **NW-04**: User dapat menambah liabilitas dengan nama, tipe (KPR, cicilan kendaraan, kartu kredit, paylater, KTA), dan jumlah outstanding
- [ ] **NW-05**: User dapat edit dan hapus liabilitas yang sudah ada
- [ ] **NW-06**: Nilai investasi dari tab Investasi otomatis masuk hitungan Net Worth (read-only, tidak bisa diinput manual — cegah double-count)
- [ ] **NW-07**: User dapat melihat trend chart Net Worth bulanan — snapshot auto-terjadi saat buka tab Kekayaan (sekali per bulan)

### Tagihan (Upcoming Bills)

- [x] **BILL-01**: User dapat melihat daftar tagihan bulan ini (dari recurring_templates, type=expense, next_due_date ≤ akhir bulan berjalan)
- [x] **BILL-02**: Tagihan ditampilkan color-coded by urgency: merah = sudah lewat/hari ini, kuning = ≤7 hari, abu = >7 hari
- [ ] **BILL-03**: User dapat tandai tagihan "Lunas" secara atomik — buat transaksi expense + catat bill_payment + update next_due_date dalam satu operasi
- [x] **BILL-04**: User dapat lihat "Sisa Aman Bulan Ini" = pemasukan aktual bulan ini − pengeluaran aktual bulan ini − tagihan bulan ini yang belum lunas

### Navigasi

- [ ] **NAV-01**: Tab "Goals" diganti nama menjadi "Finansial" dengan 2 sub-tab: "Goals" dan "Kekayaan"
- [x] **NAV-02**: Dashboard mendapat metric card Net Worth (ke-5) dan widget panel "Tagihan Bulan Ini"

### Foundation

- [x] **FOUND-01**: Bug `nextDueDate()` month-end overflow diperbaiki (31 Jan + 1 bulan = 28 Feb, bukan 3 Mar)
- [x] **FOUND-02**: Migrasi DB: 4 tabel baru (`net_worth_accounts`, `net_worth_liabilities`, `net_worth_snapshots`, `bill_payments`) dengan RLS policy `auth.uid() = user_id`

## Future Requirements

### Kekayaan v2

- **NW-08**: Deposito ditampilkan dengan maturity date dan reminder jatuh tempo
- **NW-09**: History saldo per akun (tidak hanya snapshot net worth agregat)

### Tagihan v2

- **BILL-05**: User dapat tambah tagihan satu kali (one_time_bills) yang tidak ada di recurring templates
- **BILL-06**: Proyeksi cashflow multi-bulan ke depan

### Indonesia-Specific (milestone berikutnya)

- **ZKT-01**: Kalkulator zakat — 2.5% dari tabungan yang mencapai nisab
- **THR-01**: Deteksi income spike THR dan suggestion alokasi
- **BGT-01**: Budget/anggaran per kategori per bulan dengan alert

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bank auto-sync | Tidak ada open banking API di Indonesia |
| One-time bill entry | Defer ke v2 — recurring templates cover primary use case |
| Deposito maturity tracking | Defer ke v2 — adds schema complexity |
| Calendar grid view untuk bills | Unusable di 375px mobile; list chronological saja |
| Separate "Tagihan" tab | Bills adalah view dari recurring_templates, bukan entitas baru |
| Push notifications | Tidak ada infrastructure di milestone ini |
| Budget/anggaran | Milestone berikutnya |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| NAV-01 | Phase 1 | Pending |
| NW-01 | Phase 2 | Pending |
| NW-02 | Phase 2 | Pending |
| NW-03 | Phase 2 | Pending |
| NW-04 | Phase 2 | Pending |
| NW-05 | Phase 2 | Pending |
| NW-06 | Phase 2 | Pending |
| NW-07 | Phase 2 | Pending |
| BILL-01 | Phase 3 | Complete |
| BILL-02 | Phase 3 | Complete |
| BILL-04 | Phase 3 | Complete |
| NAV-02 (partial — bills widget) | Phase 3 | Pending |
| BILL-03 | Phase 4 | Pending |
| NAV-02 (partial — dashboard wiring complete) | Phase 4 | Pending |

**Coverage:**
- v1.0 requirements: 15 total (NAV-02 split across Phase 3 and Phase 4)
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-23*
*Last updated: 2026-04-23 — traceability updated untuk 4-fase roadmap*
