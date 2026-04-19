# Gap Analysis: PFM-Web v1.0

> Dokumen ini mencatat gap fungsional dan teknis yang diprioritaskan untuk pengembangan selanjutnya.
> Dibuat: 2026-04-19

---

## Gap yang Diprioritaskan

### Gap 4 — Update Harga Investasi Manual

**Kondisi sekarang:**
Harga investasi (saham, emas, reksadana) harus diupdate secara manual oleh pengguna satu per satu lewat dialog edit. Tidak ada koneksi ke sumber data eksternal.

**Dampak:**
- Data portofolio bisa basi kalau lupa update
- Tidak bisa lihat performa investasi real-time
- Proses membosankan kalau punya banyak aset

**Solusi yang mungkin:**
- Integrasi API harga saham IDX (misalnya `api.frankfurter.app` untuk kurs, atau scraping IHSG)
- Untuk emas: integrasi harga logam mulia Antam (tersedia publik)
- Alternatif sederhana: tombol "Refresh Semua Harga" yang pull dari satu sumber terpusat
- Atau minimal: bulk update harga lewat CSV

**Prioritas:** Sedang-Tinggi — langsung mempengaruhi akurasi laporan investasi

---

### Gap 5 — Goals Tidak Bisa Tarik Dana

**Kondisi sekarang:**
Fitur Goals hanya bisa **menambah** uang ke goal (satu arah). Tidak ada mekanisme untuk menarik dana keluar dari goal — misalnya kalau target dibatalkan atau dana darurat dipakai.

**Dampak:**
- Saldo goal tidak bisa dikurangi kecuali reset/hapus goal
- Menghapus goal berarti kehilangan riwayat progress
- Workflow tidak realistis (di dunia nyata kita kadang ambil uang dari tabungan)

**Solusi yang mungkin:**
- Tambah tombol "Tarik Dana" di samping "Tambah Dana" pada setiap goal
- Validasi: tidak boleh tarik lebih dari saldo saat ini
- Opsional: catat riwayat penarikan per goal

**Prioritas:** Sedang — UX incomplete, terutama untuk goals jangka panjang

---

### Gap 6 — Fitur "Rencana" Hardcoded

**Kondisi sekarang:**
Target besar ("investasi Rp 257 juta sebelum Januari 2027") dikodekan langsung di source code (`useRencanaInit.ts`). Pengguna tidak bisa mengubah angka atau tanggal target dari UI. Jika target berubah, harus edit kode dan redeploy.

**Dampak:**
- Tidak fleksibel — target finansial bisa berubah seiring waktu
- Data awal (3 investasi + 5 goals) di-seed otomatis tanpa bisa dikonfigurasi
- Tidak ada UI untuk "Reset Rencana" kalau sudah tidak relevan

**Solusi yang mungkin:**
- Pindahkan konfigurasi Rencana ke tab Pengaturan (target amount, target date)
- Simpan di database (tabel `settings`) bukan di localStorage + kode
- Tambah tombol "Edit Target Rencana" di RencanaBar
- Buat proses seeding lebih transparan (muncul dialog konfirmasi pertama kali)

**Prioritas:** Sedang — penting untuk sustainability jangka panjang

---

### Gap 7 — Settings Belum Berfungsi

**Kondisi sekarang:**
Tab Pengaturan hanya menampilkan: pilihan tema (terang/gelap/sistem), info akun, dan tombol logout. Tabel `settings` di database sudah ada tapi belum dipakai. Tidak ada konfigurasi yang bisa diubah.

**Dampak:**
- Tab terasa "kosong" dan tidak berguna
- Banyak hal yang harusnya bisa dikonfigurasi pengguna (target Rencana, preferensi laporan, dll) tidak bisa diubah

**Solusi yang mungkin:**
- Integrasikan konfigurasi Rencana di sini (lihat Gap 6)
- Tambah pengaturan: mata uang default, format tanggal, periode laporan default
- Tambah pengaturan notifikasi (kalau goals hampir deadline)
- Manfaatkan tabel `settings` yang sudah ada di database

**Prioritas:** Sedang — terhubung erat dengan Gap 6

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

| # | Gap | Kompleksitas | Prioritas | Ketergantungan |
|---|-----|-------------|-----------|----------------|
| 6 | Rencana Hardcoded → pindah ke Settings | Sedang | Tinggi | - |
| 7 | Settings berfungsi | Rendah | Tinggi | Tergantung Gap 6 |
| 5 | Goals: fitur tarik dana | Rendah | Sedang | - |
| 4 | Harga investasi otomatis | Tinggi | Sedang | - |
| 8 | Export laporan PDF | Sedang | Rendah | - |
| 9 | Manajemen user dari UI | Tinggi | Rendah | - |

**Rekomendasi urutan:**
1. Gap 6 + 7 (Settings fungsional + Rencana configurable) — satu paket, saling terkait
2. Gap 5 (Tarik dana Goals) — fitur kecil, high value
3. Gap 4 (Harga investasi otomatis) — perlu riset API dulu
4. Gap 8 (Export PDF) — polish
5. Gap 9 (Multi-user) — kalau memang dibutuhkan

---

*Dokumen ini akan diperbarui seiring progress pengembangan.*
