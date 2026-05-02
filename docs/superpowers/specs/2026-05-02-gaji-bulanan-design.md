# Design: Fitur Periode Gaji Bulanan

**Tanggal:** 2026-05-02
**Status:** Approved

## Latar Belakang

Pengguna menerima gaji pada tanggal yang tidak pasti — bisa akhir bulan ini atau awal bulan depan. Akibatnya, tracking pengeluaran berbasis bulan kalender tidak mencerminkan realita: gaji Januari bisa masuk 28 Desember, sehingga pengeluaran Januari sebenarnya "milik" gaji yang masuk di Desember.

Saat ini Kantong Pintar mencatat gaji hanya sebagai transaksi biasa tanpa konsep periode gaji. Tidak ada cara untuk melihat "sisa dari gaji ini" atau riwayat per siklus gaji.

## Tujuan

- Menampilkan sisa gaji periode aktif secara real-time di Dashboard
- Menampilkan riwayat pengeluaran per periode gaji di Laporan
- Mengelompokkan semua pemasukan dan pengeluaran ke siklus gaji yang relevan, bukan bulan kalender

## Pendekatan

**Opsi yang dipilih: Dedicated `pay_periods` table.**

Ketika transaksi berkategori "Gaji" diinput, app membuat record periode baru. Periode tidak menyimpan `end_date` — batas akhir dihitung otomatis sebagai `start_date` periode berikutnya. Pengeluaran dikelompokkan ke periode berdasarkan rentang tanggal, bukan foreign key — sehingga backdating transaksi bekerja otomatis.

## Data Model

### Tabel baru: `pay_periods`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK ke auth.users, RLS enabled |
| `label` | text | Label periode, diisi user. Contoh: "Gaji Januari 2026" |
| `start_date` | date | Tanggal transaksi gaji (bukan tanggal input) |
| `created_at` | timestamptz | Timestamp insert |

**Tidak ada kolom:**
- `end_date` — dihitung: `start_date` periode berikutnya - 1 hari
- `gaji_amount` — dihitung dari query transaksi `type = 'income'` dalam rentang periode
- `transaction_id` — tidak disimpan; satu periode bisa punya banyak transaksi pemasukan

### Query pengelompokan pengeluaran

```sql
-- Transaksi milik periode P:
WHERE date >= P.start_date
  AND date < COALESCE(next_period.start_date, 'infinity')
  AND user_id = P.user_id
```

### RLS

Tabel `pay_periods` mengikuti pola RLS yang sama dengan tabel lain di project:
- SELECT, INSERT, UPDATE, DELETE hanya untuk `auth.uid() = user_id`

## Logika Trigger Periode Baru

1. User input transaksi dengan kategori "Gaji"
2. App deteksi: `category_id` yang dipilih merujuk ke kategori dengan `name = 'Gaji'` dan `type = 'income'` di tabel `categories` (bukan string matching langsung)
3. App tampilkan dialog konfirmasi kecil:
   - Label default: `"Gaji [nama bulan dari start_date + 1 bulan] [tahun]"` — contoh: start_date 28 Des 2025 → suggest "Gaji Januari 2026". User bisa edit sebelum konfirmasi
   - Tombol: "Batal" / "Ya, Mulai Periode Baru"
4. Jika dikonfirmasi → transaksi disimpan + `pay_periods` record dibuat dengan `start_date = transaction.date`

**Catatan penting:**
- Hanya kategori "Gaji" yang trigger dialog — insentif, bonus, dividen tidak trigger periode baru
- Dialog muncul setiap kali ada transaksi Gaji baru (sekali per input event); user bisa batalkan tanpa membuat periode
- `start_date` menggunakan tanggal transaksi (bukan `now()`) — mendukung backdating

### Contoh backdating

```
Gaji masuk tgl 26 Jan (user input di tgl 30 Jan, set tanggal = 26 Jan)
→ pay_period.start_date = 26 Jan

Pengeluaran tgl 27, 28, 29 Jan yang sudah diinput sebelumnya
→ otomatis masuk periode baru (27 Jan >= 26 Jan)
→ tidak perlu edit manual
```

## Perhitungan Total Per Periode

```
Total Pemasukan = SUM(amount) WHERE type = 'income'
                  AND date >= start_date AND date < next_start_date

Total Pengeluaran = SUM(amount) WHERE type = 'expense'
                    AND date >= start_date AND date < next_start_date

Sisa = Total Pemasukan - Total Pengeluaran
```

Catatan: Total Pemasukan mencakup SEMUA kategori income (Gaji + Insentif + Bonus + dll), bukan hanya "Gaji".

## UI

### A. Dashboard — Card "Periode Gaji Aktif"

Card baru di Dashboard, di bawah summary bulanan yang sudah ada.

```
┌─────────────────────────────────────┐
│ Gaji Februari 2026                  │
│ 31 Jan – sekarang                   │
├─────────────────────────────────────┤
│ Total Masuk    Rp 12.500.000        │
│ Terpakai       Rp  8.000.000        │
│ ████████░░░░░  64%                  │
│ Sisa           Rp  4.500.000        │
└─────────────────────────────────────┘
```

- Ditampilkan hanya jika ada minimal 1 `pay_period` yang sudah dibuat
- Progress bar merah jika sisa < 10% dari total masuk

### B. Laporan — Tab Baru "Periode Gaji"

Tab baru di halaman Laporan, sejajar dengan tab Bulanan dan Kategori.

**Tampilan list:**
```
Gaji Februari 2026  (31 Jan – 27 Feb)
  Masuk Rp 12.5jt  Keluar Rp 10.2jt  Sisa Rp 2.3jt  ▶

Gaji Januari 2026   (28 Des – 30 Jan)
  Masuk Rp 10jt    Keluar Rp 9.1jt   Sisa Rp 0.9jt  ▶
```

Urutan: terbaru di atas.

**Tampilan detail (setelah tap ▶):**
- List semua transaksi (pemasukan + pengeluaran) dalam periode tersebut
- Grouped by tanggal, format sama dengan TransactionsTab yang sudah ada

### C. TransactionDialog — Perubahan Minimal

Hanya tambah dialog konfirmasi kecil setelah user simpan transaksi berkategori "Gaji". Tidak ada perubahan lain pada form transaksi.

## Edge Cases

| Skenario | Penanganan |
|---|---|
| Gaji + Insentif/Bonus dalam 1 periode | Hanya "Gaji" yang trigger periode baru; insentif masuk ke periode aktif |
| User input gaji dengan tanggal mundur (backdate) | `start_date = transaction.date`; pengeluaran yang sudah ada otomatis ter-assign ulang |
| Belum ada `pay_period` sama sekali | Dashboard card disembunyikan; tab Periode Gaji tampilkan empty state |
| User batalkan dialog konfirmasi | Transaksi tetap tersimpan; periode tidak dibuat |
| Dua transaksi "Gaji" di tanggal yang sama | Validasi: jika sudah ada `pay_period` dengan `start_date` identik, dialog tidak muncul dan periode baru tidak dibuat |
| Transaksi sebelum periode pertama dibuat | Tidak masuk ke tab Periode Gaji; tetap tampil normal di tab Transaksi. Tidak ada backfill otomatis |
| Edit/hapus transaksi gaji setelah periode dibuat | Periode tetap ada; total pemasukan dihitung ulang dari query transaksi — otomatis akurat karena tidak ada nilai yang di-cache |

## Yang Tidak Termasuk Scope Ini

- Alokasi budget per kategori dalam periode (envelope budgeting) — kandidat v1.3
- Notifikasi "gaji belum masuk" jika melebihi window waktu tertentu
- Export laporan per periode gaji ke PDF
