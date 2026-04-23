# Visual Refresh — Design Spec
**Tanggal:** 2026-04-23
**Pendekatan:** Visual Refresh (Opsi B)
**Estimasi:** 3–4 minggu
**Prioritas user:** Transaksi > Dashboard > semua tab lainnya
**Perangkat:** Desktop + Mobile (campuran)
**Pengguna:** Multi-user terbatas (keluarga / orang kepercayaan)
**Arah desain:** Modern & Bold — premium, tegas, seperti Stripe/Vercel Dashboard

---

## 1. Design System Baru

### Warna Brand
- **Accent primary:** Indigo `#6366f1` (aktif, CTA, highlight)
- **Accent dark:** `#1e1b4b` / `#312e81` (header gradient)
- **Accent light:** `#ede9fe` (background badge, pill lembut)
- **Success:** `#10b981` emerald (pemasukan, gain)
- **Danger:** `#ef4444` red (pengeluaran, loss)
- **Muted:** `#94a3b8` (label sekunder, placeholder)

### Typography
- Angka keuangan utama: `font-weight: 800`, `letter-spacing: -0.5px`
- Label section: `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.4px`, `font-size: 10–11px`
- Body: `font-weight: 500` untuk nama/kategori, `400` untuk deskripsi

### Spacing
- Card padding: `p-4` (16px) — konsisten di semua card
- Page padding: `p-6` (24px)
- Gap antar card: `gap-4` (16px)

### Border Radius
- Card: `rounded-xl` (12px)
- Badge/pill: `rounded-full`
- Button: `rounded-lg` (8px)

---

## 2. Header & Navigasi

### Header
- Background: `linear-gradient(135deg, #1e1b4b, #312e81)` — dark indigo, **tetap dark di light maupun dark mode** (header selalu gelap, tidak ikut tema)
- Kiri: Logo mark monogram "₱" (kotak 32px, rounded-lg, gradient indigo) + teks "PFM" bold putih + subtitle "Personal Finance" muted `#a5b4fc`
- Kanan: Chip bulan aktif (pill, warna `#a5b4fc` muted) + avatar user (lingkaran 30px, inisial, warna indigo)

### Tab Navigasi
- Style: **underline aktif** — menggantikan pill background yang sekarang
- Tab aktif: `color: #6366f1`, `border-bottom: 2px solid #6366f1`
- Tab non-aktif: `color: #94a3b8`, tidak ada border
- Mobile: `overflow-x: auto`, `white-space: nowrap`, tab tidak wrap ke bawah
- Tab bar background: putih, `border-bottom: 1px solid #f1f5f9`

---

## 3. Dashboard

### MetricCard
Setiap kartu punya aksen warna berbeda via `border-top: 3px solid`:
- Pemasukan → `#10b981` (emerald)
- Pengeluaran → `#ef4444` (red)
- Net → gradient indigo penuh (kartu ini jadi focal point, teks putih)
- Investasi → `#6366f1` (indigo)

Konten kartu:
- Label: uppercase, muted, `font-size: 10px`
- Angka: disingkat via fungsi `shortRupiah()` baru (≥1M → "jt", ≥1B → "M") — hanya untuk MetricCard, bukan tabel/dialog
- Trend badge: pill kecil "↑ +8% vs bln lalu" dengan background lembut sesuai warna
- Data trend didapat dari query bulan lalu (`useAggregateByPeriod` dengan range bulan sebelumnya) — jika data kosong, badge tidak ditampilkan

### Panel bawah
- Transaksi terakhir & Goals aktif: tidak berubah strukturnya, hanya visual polish (spacing, warna konsisten)

---

## 4. Tab Transaksi

### Toolbar — dibagi 2 baris
- **Baris 1 (Filter):** Label "FILTER:" + input Dari / Sampai / Jenis / Kategori
- **Baris 2 (Aksi):** Kiri → tombol outline Ekspor, Impor, Rutin | Kanan → tombol primary "Tambah Transaksi"
- Dibungkus dalam satu card/panel `border: 1px solid #e0e7ff`, `rounded-xl`

### Badge jenis transaksi
- Masuk: background `#dcfce7`, text `#16a34a`, pill rounded-full — menggantikan Badge solid hijau
- Keluar: background `#fee2e2`, text `#dc2626`, pill rounded-full — menggantikan Badge solid merah

### Tabel
- Kolom "Catatan" dipindahkan: tampil sebagai **tooltip** saat hover cell baris (desktop) — bukan expand row. Di mobile kolom ini dihilangkan dari tampilan tabel.
- Dibungkus `overflow-x: auto` untuk mobile
- Header kolom: uppercase, `font-size: 10px`, `letter-spacing: 0.3px`

### Summary strip
- 3 kotak (Masuk/Keluar/Net) dengan background lembut sesuai warna — lebih compact dari sekarang

---

## 5. Tab Investasi

### Desktop
- Tabel tetap 10 kolom, tidak berubah strukturnya
- Visual polish: header uppercase, badge jenis pill, warna G/L konsisten

### Mobile (breakpoint < 768px)
- Tabel diganti **card view per aset**:
  - Header card: badge jenis (pill) + nama aset bold + nilai kini + persentase gain/loss
  - Body: 3 kotak mini (Qty, Harga Beli, Harga Kini)
  - Footer: tombol Update Harga, Edit, Hapus
- Implementasi via CSS `@media` atau Tailwind responsive prefix

---

## 6. Tab Goals

### Summary Bar
- Panel dark gradient indigo di atas daftar goal
- Konten: "Total Terkumpul" (besar, putih) + "dari total target" + persentase + jumlah goals aktif
- Progress bar tipis di bawah (warna `#818cf8`)

### Goal Card
- Border-left berwarna `#6366f1` sebagai visual anchor
- Badge status: pill rounded-full dengan background lembut (`#ede9fe` untuk Aktif)
- Progress bar warna indigo konsisten dengan brand
- Persentase di kiri progress bar, sisa di kanan

---

## 7. Empty States (Global)

Pola yang diterapkan konsisten ke semua tab:
```
[Ikon besar 48px dalam kotak rounded-xl berwarna lembut]
[Judul bold]
[Deskripsi 1–2 kalimat, text-center, max-width 200px]
[CTA button primary "Tambah X Pertama"]
```

Tab yang mendapat empty state baru: Transaksi, Investasi, Goals, Catatan, Laporan.

---

## 8. Tab Pengaturan

### Section Header
Setiap section punya: ikon Lucide 16px dalam kotak 28px `rounded-lg` berwarna lembut + label bold. Pakai Lucide (konsisten dengan codebase), bukan emoji.
- Tampilan → `<Palette />`, background `#ede9fe`
- Rencana → `<Target />`, background `#fef3c7`
- Akun → `<User />`, background `#dcfce7`
- Manajemen Pengguna → `<Users />`, background `#e0f2fe`
- Bantuan → `<HelpCircle />`, background `#f0fdf4`

### Section Rencana (existing, perlu polish)
- Card yang sudah ada (totalTarget, deadline, goals aktif, tombol reset seed) tetap fungsional
- Hanya visual polish: spacing `p-4`, border `#e0e7ff`, section header pakai ikon `<Target />` seperti pola di atas

### Tema Switcher
- Dropdown diganti **3 pill button** (Terang / Gelap / Sistem)
- Pill aktif: `border: 2px solid #6366f1`, `color: #6366f1`

### Akun
- Avatar: lingkaran gradient indigo dengan inisial nama
- Tombol Keluar: background `#fee2e2`, text `#dc2626` — jelas tapi tidak agresif

---

## 9. Perubahan Global

### Confirm Dialog
- Semua `window.confirm()` diganti dengan custom `<ConfirmDialog>` component
- Props: `title`, `description`, `confirmLabel` (default "Hapus"), `variant` (default "destructive")
- Dipakai di: hapus transaksi, hapus investasi, hapus goal, hapus catatan, keluar, reset seed

### Warna Konsistensi
- Seluruh progress bar → indigo `#6366f1` (sekarang campur hitam & default)
- Seluruh link/aksi sekunder → indigo (sekarang campur hitam)
- Icon aksi (Edit, Hapus) → ghost button dengan border `#e0e7ff` di hover

---

## 10. Yang TIDAK Berubah

- Struktur routing/tab (8 tab tetap)
- Logika data & queries (tidak ada perubahan di layer DB/API)
- Fitur-fitur yang sudah ada (recurring, CSV import/export, PDF export, dll)
- Tab Laporan & Pensiun: polish minor = spacing konsisten (`p-4`), progress bar & warna teks menggunakan token indigo, tidak ada perubahan layout atau fitur
- Struktur komponen besar (tidak ada refactor arsitektur)

---

## Urutan Implementasi (Prioritas)

1. Design tokens — CSS variables baru (warna, spacing)
2. Header + navigasi (dampak paling terlihat, tampil di semua halaman)
3. MetricCard Dashboard (tab paling sering dilihat ke-2)
4. Toolbar & tabel Transaksi (tab paling sering dipakai)
5. ConfirmDialog global (menggantikan semua `confirm()`)
6. Empty states global
7. GoalsTab summary bar + card polish
8. InvestmentsTab mobile card view
9. SettingsTab section polish
10. Polish minor: Laporan, Catatan, Pensiun
