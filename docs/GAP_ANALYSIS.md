# Gap Analysis: PFM-Web v1.0

> Dokumen ini mencatat gap fungsional dan teknis yang diprioritaskan untuk pengembangan selanjutnya.
> Dibuat: 2026-04-19

---

## Gap yang Diprioritaskan

### ~~Gap 4 — Update Harga Investasi Manual~~ ✅ SELESAI

**Diselesaikan:** 2026-04-20

Tombol "Refresh Harga" ditambahkan di tab Investasi. Saham IDX diambil dari Yahoo Finance via Supabase Edge Function (`fetch-prices`), emas dari metals.dev × kurs USD/IDR (open.er-api.com). Reksadana tetap manual. Kode ticker IDX diekstrak otomatis dari `asset_name` (contoh: "Saham BMRI" → `BMRI.JK`).

---

### ~~Gap 5 — Goals Tidak Bisa Tarik Dana~~ ✅ SELESAI

**Diselesaikan:** 2026-04-20

Tombol Tarik Dana ditambahkan di AddMoneyDialog (toggle Tambah/Tarik), DB function `withdrawFromGoal` dengan auto-reset status, validasi saldo, dan mutation hook `useWithdrawFromGoal`.

---

### ~~Gap 6 — Fitur "Rencana" Hardcoded~~ ✅ SELESAI

**Diselesaikan:** 2026-04-20

RencanaBar tidak lagi hardcode — target & deadline dihitung dinamis dari goals aktif. `rencanaNames` dijadikan single source of truth untuk nama seed. Nama investasi dan goals Rencana sudah menggunakan referensi terpusat.

---

### ~~Gap 7 — Settings Belum Berfungsi~~ ✅ SELESAI

**Diselesaikan:** 2026-04-20

Tab Settings ditambahkan seksi Rencana: menampilkan info computed (total target, deadline dari goals aktif) dan tombol Reset Seed untuk inisialisasi ulang data Rencana.

---

### ~~Gap 8 — Tidak Ada Export Laporan ke PDF~~ ✅ SELESAI

**Diselesaikan:** 2026-04-20

Tombol "Export PDF" ditambahkan di header filter tab Laporan (ujung kanan). PDF berisi summary Pemasukan/Pengeluaran/Net, tabel pengeluaran per kategori, tabel pemasukan per kategori, dan tabel kinerja investasi. Nama file otomatis dari periode aktif (contoh: `laporan-keuangan-2026-04.pdf`). Diimplementasikan dengan `jsPDF` + `jspdf-autotable` tanpa dependency DOM capture.

---

### ~~Gap 9 — Single User Hardcoded di Database~~ ✅ SELESAI

**Diselesaikan:** 2026-04-20

Arsitektur diubah dari single-user menjadi multi-user. Tabel `profiles` menyimpan flag `is_admin`, tabel `allowed_emails` menggantikan email hardcode di trigger SQL. Kolom `user_id` ditambahkan ke semua tabel data dengan RLS per-user. Admin bisa kelola daftar email yang diizinkan login dan melihat keuangan user lain (read-only) via banner "Sedang melihat data" di Settings.

---

## Ringkasan & Urutan Pengerjaan

| # | Gap | Kompleksitas | Prioritas | Status |
|---|-----|-------------|-----------|--------|
| 5 | Goals: fitur tarik dana | Rendah | Sedang | ✅ Selesai |
| 6 | Rencana Hardcoded → dinamis | Sedang | Tinggi | ✅ Selesai |
| 7 | Settings berfungsi | Rendah | Tinggi | ✅ Selesai |
| 4 | Harga investasi otomatis | Tinggi | Sedang | ✅ Selesai |
| 8 | Export laporan PDF | Sedang | Rendah | ✅ Selesai |
| 9 | Manajemen user dari UI | Tinggi | Rendah | ✅ Selesai |

**Semua gap telah diselesaikan.**

---

*Dokumen ini akan diperbarui seiring progress pengembangan.*
