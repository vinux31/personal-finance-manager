---
status: testing
phase: 02-net-worth-tracker
source:
  - .planning/phases/02-net-worth-tracker/02-01-SUMMARY.md
  - .planning/phases/02-net-worth-tracker/02-02-SUMMARY.md
  - .planning/phases/02-net-worth-tracker/02-03-SUMMARY.md
started: "2026-04-24T00:00:00Z"
updated: "2026-04-24T00:00:00Z"
---

## Current Test

number: 1
name: Dashboard Net Worth Card
expected: |
  Buka Dashboard tab. Harus ada kartu ke-5 "NET WORTH" dengan indigo gradient (sama persis seperti "NET BULAN INI"). Nilainya adalah shortRupiah dari: total saldo akun + total investasi − total liabilitas. Jika belum ada akun/liabilitas, nilainya adalah total investasi saja (bisa Rp 0 jika juga belum ada investasi).
awaiting: user response

## Tests

### 1. Dashboard Net Worth Card
expected: |
  Buka Dashboard tab. Harus ada kartu ke-5 "NET WORTH" dengan indigo gradient (sama persis seperti "NET BULAN INI"). Nilainya adalah shortRupiah dari: total saldo akun + total investasi − total liabilitas. Jika belum ada akun/liabilitas, nilainya adalah total investasi saja (bisa Rp 0 jika juga belum ada investasi).
result: [pending]

### 2. Dashboard Grid Layout + Backward Compat
expected: |
  Masih di Dashboard. Resize browser: mobile (<640px) → 2+2+1 baris. sm (640-767px) → 3+2 baris. md (≥768px) → 5 kartu dalam 1 baris. Kartu "NET BULAN INI" tidak berubah — masih gradient tanpa trend badge.
result: [pending]

### 3. Kekayaan Sub-tab Loads
expected: |
  Buka Finansial → tab Kekayaan. Halaman harus menampilkan KekayaanTab (bukan placeholder teks). Di atas ada summary card indigo gradient dengan 3 angka: "Net Worth", "Aset", "Liabilitas". Di bawahnya ada dua section: "Aset & Rekening" dan "Liabilitas", masing-masing dengan tombol "+ Tambah".
result: [pending]

### 4. Add Account
expected: |
  Di section "Aset & Rekening", klik "+ Tambah Akun". Dialog terbuka dengan field: Nama Akun, Tipe (dropdown 7 pilihan), Saldo/Nilai. Isi nama="Test BCA", tipe=Tabungan, saldo=10000000. Klik Simpan. Dialog tutup, kartu "Test BCA" muncul di list dengan nilai "Rp 10.000.000" dan badge "Tabungan". Summary card angka Aset ikut naik.
result: [pending]

### 5. Edit Account
expected: |
  Klik ikon pensil (edit) pada kartu "Test BCA". Dialog terbuka dengan data pre-filled (nama, tipe, saldo). Ubah nama jadi "Test BCA Edited" dan saldo jadi 12000000. Klik Simpan. Kartu di list sekarang menampilkan "Test BCA Edited" dan "Rp 12.000.000".
result: [pending]

### 6. Delete Account
expected: |
  Klik ikon tempat sampah (hapus) pada kartu "Test BCA Edited". ConfirmDialog muncul dengan judul "Hapus Akun" dan deskripsi menyebut nama "Test BCA Edited". Klik Hapus. Dialog tutup, kartu hilang dari list, sonner toast "Akun dihapus" muncul.
result: [pending]

### 7. Liability CRUD (Add / Edit / Delete)
expected: |
  Di section "Liabilitas", klik "+ Tambah Liabilitas". Dialog terbuka dengan field Nama, Tipe (5 pilihan: KPR, Cicilan Kendaraan, Kartu Kredit, PayLater, KTA), Jumlah Outstanding. Isi nama="Test KK", tipe=Kartu Kredit, outstanding=5000000 → Simpan → kartu muncul. Edit: ubah saldo → update. Hapus: ConfirmDialog "Hapus Liabilitas" → dihapus + toast.
result: [pending]

### 8. Read-only Nilai Investasi Row
expected: |
  Jika ada data di tab Investasi: di section "Aset & Rekening" muncul baris dengan ikon TrendingUp, teks italic "Nilai Investasi", badge "otomatis", dan total nilai investasi di bawahnya. Baris ini TIDAK punya tombol pensil/hapus. Jika belum ada investasi, baris ini tidak muncul.
result: [pending]

### 9. Auto-snapshot + Idempotency
expected: |
  Buka tab Kekayaan. Di Supabase dashboard → tabel net_worth_snapshots: harus ada 1 baris untuk bulan ini dengan snapshot_month = "2026-04-01". Kolom total_accounts, total_investments, total_liabilities sesuai data saat ini. net_worth (GENERATED) = total_accounts + total_investments - total_liabilities. Refresh tab 3x → tetap hanya 1 baris untuk bulan April (tidak duplikat).
result: [pending]

### 10. Net Worth Tren AreaChart
expected: |
  Setelah snapshot ada (dari test 9), section "Tren Net Worth" harus menampilkan AreaChart dengan fill indigo gradient di bawah garis. X-axis menampilkan label bulan, Y-axis menampilkan nilai Rp (shortRupiah). Hover tooltip menampilkan angka Rupiah lengkap. Jika hanya 1 snapshot, chart tetap render (tidak crash). Jika 0 snapshot, tampil teks "Belum ada data tren. Buka tab ini tiap bulan...".
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps

[none yet]
