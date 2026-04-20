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

### Gap 8 — Tidak Ada Export Laporan ke PDF

**Kondisi sekarang:**
Laporan hanya bisa dilihat di layar browser. Tidak ada cara untuk menyimpan atau membagikan laporan dalam format yang portabel (PDF, gambar, dll). Hanya transaksi dan investasi yang bisa di-export via CSV.

**Dampak:**
- Tidak bisa berbagi ringkasan keuangan bulanan
- Tidak ada arsip laporan jika data dihapus atau akun berubah
- Untuk perencanaan keluarga, sulit berbagi kondisi keuangan

**Solusi yang mungkin:**
- Export PDF menggunakan library `jsPDF` + `html2canvas` (capture grafik sebagai gambar)
- Atau export laporan ke format Excel (XLSX) dengan `SheetJS`
- Minimal: tombol "Print" yang trigger browser print dialog dengan layout yang rapi

**Prioritas:** Rendah-Sedang — nice-to-have, bisa dikerjakan belakangan

---

### Gap 9 — Single User Hardcoded di Database

**Kondisi sekarang:**
Email yang diizinkan login (`rinoadi28@gmail.com`) dikunci di level database via trigger SQL. Tidak ada UI untuk mengelola daftar email yang boleh akses. Kalau ingin menambah atau mengubah email, harus langsung edit database via Supabase dashboard.

**Dampak:**
- Tidak ada cara mudah ganti email akun jika suatu saat diperlukan
- Tidak bisa berbagi akses ke anggota keluarga tanpa masuk ke Supabase
- Risiko: kalau akun Google berubah, harus edit database manual

**Solusi yang mungkin:**
- Tambah UI di Settings untuk melihat email yang terdaftar (read-only)
- Tambah tombol "Ganti Email Utama" dengan verifikasi
- Untuk multi-user keluarga: tambah tabel `allowed_users` yang bisa dikelola dari UI
- Jangka pendek: dokumentasikan cara ganti email di Supabase dashboard

**Prioritas:** Rendah untuk sekarang, tapi perlu diantisipasi

---

## Ringkasan & Urutan Pengerjaan

| # | Gap | Kompleksitas | Prioritas | Status |
|---|-----|-------------|-----------|--------|
| 5 | Goals: fitur tarik dana | Rendah | Sedang | ✅ Selesai |
| 6 | Rencana Hardcoded → dinamis | Sedang | Tinggi | ✅ Selesai |
| 7 | Settings berfungsi | Rendah | Tinggi | ✅ Selesai |
| 4 | Harga investasi otomatis | Tinggi | Sedang | ✅ Selesai |
| 8 | Export laporan PDF | Sedang | Rendah | Belum |
| 9 | Manajemen user dari UI | Tinggi | Rendah | Belum |

**Urutan pengerjaan selanjutnya:**
1. Gap 8 (Export PDF) — polish
2. Gap 9 (Multi-user) — kalau memang dibutuhkan

---

*Dokumen ini akan diperbarui seiring progress pengembangan.*
