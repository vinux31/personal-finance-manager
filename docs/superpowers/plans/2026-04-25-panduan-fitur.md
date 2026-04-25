# Halaman Panduan Penggunaan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti `PanduanDialog` existing dengan halaman panduan penuh yang diakses dari welcome card di Settings, berisi 14 topik (9 per-fitur + 5 skenario) format step-by-step numbered.

**Architecture:** State-based overlay tanpa router. Zustand store `usePanduanStore` mengontrol open/close. Saat open, `App.tsx` render `<PanduanFullPage />` menggantikan `<Tabs>` (header + banner tetap). Sidebar topik kiri + konten kanan; mobile sidebar jadi `<Select>` dropdown. Konten hard-coded di `src/content/panduan.ts`.

**Tech Stack:** React 19, TypeScript, Zustand 5, shadcn UI (Card, Button, Select), Tailwind v4, lucide-react.

**Catatan testing:** Project ini belum punya test runner setup (deferred di v1.0 milestone). Konsisten dengan pola existing — verifikasi pakai **manual UAT** (Task 9), bukan unit test. Setiap task tetap dipecah jadi steps kecil + commit per task untuk traceability.

**Spec referensi:** `docs/superpowers/specs/2026-04-25-panduan-fitur-design.md`

---

## File Structure

**Files to create:**
- `src/lib/panduanStore.ts` — Zustand store untuk state overlay
- `src/content/panduan.ts` — Data 14 topik (typed array)
- `src/components/PanduanFullPage.tsx` — Layout halaman penuh
- `src/components/PanduanWelcomeCard.tsx` — Welcome card di Settings

**Files to modify:**
- `src/App.tsx` — Conditional render PanduanFullPage
- `src/tabs/SettingsTab.tsx` — Hapus PanduanDialog usage, tambah WelcomeCard

**Files to delete:**
- `src/components/PanduanDialog.tsx`

---

### Task 1: Buat Zustand store `usePanduanStore`

**Files:**
- Create: `src/lib/panduanStore.ts`

- [ ] **Step 1: Tulis store**

File: `src/lib/panduanStore.ts`

```ts
import { create } from 'zustand'

interface PanduanStore {
  open: boolean
  activeSlug: string | null
  openPanduan: (slug?: string) => void
  setActiveSlug: (slug: string) => void
  close: () => void
}

export const usePanduanStore = create<PanduanStore>((set) => ({
  open: false,
  activeSlug: null,
  openPanduan: (slug) => set({ open: true, activeSlug: slug ?? null }),
  setActiveSlug: (slug) => set({ activeSlug: slug }),
  close: () => set({ open: false }),
}))
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors related to new file)

- [ ] **Step 3: Commit**

```bash
git add src/lib/panduanStore.ts
git commit -m "feat(panduan): tambah usePanduanStore untuk state overlay"
```

---

### Task 2: Buat data konten `src/content/panduan.ts` dengan 14 topik

**Files:**
- Create: `src/content/panduan.ts`

- [ ] **Step 1: Buat folder content + file panduan.ts dengan types + 14 topik lengkap**

File: `src/content/panduan.ts`

```ts
export type PanduanStep = {
  number: number
  text: string
  detail?: string
}

export type PanduanSection = {
  heading: string
  intro?: string
  steps: PanduanStep[]
  tip?: string
}

export type PanduanTopic = {
  slug: string
  title: string
  category: 'fitur' | 'skenario'
  summary: string
  sections: PanduanSection[]
}

export const PANDUAN_TOPICS: PanduanTopic[] = [
  {
    slug: 'dashboard',
    title: 'Dashboard',
    category: 'fitur',
    summary: 'Baca ringkasan keuangan harian dan progress Rencana.',
    sections: [
      {
        heading: 'Memahami kartu ringkasan',
        intro: 'Dashboard menampilkan ringkasan keuangan bulan berjalan saat dibuka.',
        steps: [
          { number: 1, text: 'Buka tab Dashboard.' },
          { number: 2, text: 'Lihat 3 kartu di atas: Pemasukan, Pengeluaran, dan Net (selisih) bulan ini.' },
          { number: 3, text: 'Lihat kartu Portofolio Investasi: total modal, nilai sekarang, dan persentase gain/loss.' },
          { number: 4, text: 'Scroll ke bawah untuk widget 5 transaksi terbaru dan 4 goals teratas dengan progress bar.' },
        ],
        tip: 'Net hijau = surplus, merah = defisit bulan ini.',
      },
      {
        heading: 'Membaca RencanaBar',
        steps: [
          { number: 1, text: 'Cari progress bar "Rencana Keuangan" di area atas Dashboard.' },
          { number: 2, text: 'Bar menampilkan total terkumpul vs target Rencana (default Rp 257 juta, Jan 2027).' },
          { number: 3, text: 'Persentase kanan = (terkumpul ÷ target) × 100%.' },
        ],
        tip: 'Target & nama Rencana bisa diubah dari Pengaturan → Rencana.',
      },
    ],
  },
  {
    slug: 'transaksi',
    title: 'Transaksi',
    category: 'fitur',
    summary: 'Catat pemasukan & pengeluaran harian.',
    sections: [
      {
        heading: 'Menambah transaksi baru',
        steps: [
          { number: 1, text: 'Buka tab Transaksi.' },
          { number: 2, text: 'Klik tombol "Tambah Transaksi" di kanan atas.' },
          { number: 3, text: 'Pilih Jenis: Pemasukan atau Pengeluaran.' },
          { number: 4, text: 'Isi tanggal, kategori, jumlah (Rp), dan catatan opsional.' },
          { number: 5, text: 'Klik "Simpan".', detail: 'Transaksi langsung muncul di daftar dan ringkasan Dashboard ter-update.' },
        ],
        tip: 'Warna hijau = pemasukan, merah = pengeluaran.',
      },
      {
        heading: 'Menyaring transaksi',
        steps: [
          { number: 1, text: 'Gunakan filter periode di atas tabel: Bulan ini / Tahun ini / Semua / Kustom.' },
          { number: 2, text: 'Pilih kategori untuk lihat hanya jenis tertentu.' },
          { number: 3, text: 'Klik header kolom (Tanggal, Jumlah) untuk sorting.' },
        ],
      },
      {
        heading: 'Mengedit atau menghapus transaksi',
        steps: [
          { number: 1, text: 'Klik baris transaksi di daftar.' },
          { number: 2, text: 'Pilih "Edit" untuk ubah, "Hapus" untuk menghilangkan.' },
          { number: 3, text: 'Konfirmasi dialog jika menghapus.' },
        ],
      },
    ],
  },
  {
    slug: 'investasi',
    title: 'Investasi',
    category: 'fitur',
    summary: 'Pantau portofolio aset & performa gain/loss.',
    sections: [
      {
        heading: 'Menambah aset baru',
        steps: [
          { number: 1, text: 'Buka tab Investasi.' },
          { number: 2, text: 'Klik "Tambah Investasi".' },
          { number: 3, text: 'Pilih jenis aset (saham, reksadana, emas, kripto, obligasi, dll).' },
          { number: 4, text: 'Isi nama aset, jumlah unit/lot, harga beli per unit, dan tanggal beli.' },
          { number: 5, text: 'Klik "Simpan".' },
        ],
      },
      {
        heading: 'Update harga terkini',
        steps: [
          { number: 1, text: 'Cari aset di daftar Investasi.' },
          { number: 2, text: 'Klik ikon grafik (↗) di baris aset.' },
          { number: 3, text: 'Masukkan harga terkini per unit.' },
          { number: 4, text: 'Simpan — gain/loss otomatis terhitung dan riwayat harga tersimpan.' },
        ],
        tip: 'Riwayat harga dipakai grafik di tab Laporan untuk melihat tren portofolio.',
      },
    ],
  },
  {
    slug: 'kekayaan',
    title: 'Finansial → Kekayaan',
    category: 'fitur',
    summary: 'Catat aset & kewajiban untuk hitung Net Worth.',
    sections: [
      {
        heading: 'Membuka sub-tab Kekayaan',
        steps: [
          { number: 1, text: 'Buka tab Finansial.' },
          { number: 2, text: 'Pilih sub-tab "Kekayaan" (default).' },
        ],
      },
      {
        heading: 'Menambah aset',
        intro: 'Aset = hal yang Anda miliki (rumah, mobil, deposito, dll).',
        steps: [
          { number: 1, text: 'Klik "Tambah Aset".' },
          { number: 2, text: 'Isi nama aset, jenis (kas, properti, kendaraan, lainnya), dan nilai estimasi.' },
          { number: 3, text: 'Klik "Simpan".' },
        ],
      },
      {
        heading: 'Menambah kewajiban',
        intro: 'Kewajiban = utang/kredit yang harus Anda bayar.',
        steps: [
          { number: 1, text: 'Klik "Tambah Kewajiban".' },
          { number: 2, text: 'Isi nama (mis. KPR, KMG), saldo terutang, dan jenis.' },
          { number: 3, text: 'Klik "Simpan".' },
        ],
        tip: 'Net Worth = Total Aset − Total Kewajiban. Update nilai tiap bulan untuk tracking tren.',
      },
    ],
  },
  {
    slug: 'goals',
    title: 'Finansial → Goals',
    category: 'fitur',
    summary: 'Buat target keuangan dan tabung secara berkala.',
    sections: [
      {
        heading: 'Membuat goal baru',
        steps: [
          { number: 1, text: 'Buka tab Finansial → sub-tab Goals.' },
          { number: 2, text: 'Klik "Tambah Goal".' },
          { number: 3, text: 'Isi nama goal (mis. "Dana Darurat"), target jumlah (Rp), dan target tanggal.' },
          { number: 4, text: 'Simpan.' },
        ],
      },
      {
        heading: 'Menabung ke goal',
        steps: [
          { number: 1, text: 'Klik tombol "Tambah Uang" di kartu goal.' },
          { number: 2, text: 'Masukkan jumlah yang ditabung dan tanggal.' },
          { number: 3, text: 'Simpan — progress bar bergerak otomatis.' },
        ],
        tip: 'Jika terkumpul ≥ target, status goal otomatis berubah jadi "Tercapai".',
      },
      {
        heading: 'Menarik uang dari goal',
        steps: [
          { number: 1, text: 'Klik "Tarik Uang" di kartu goal.' },
          { number: 2, text: 'Masukkan jumlah penarikan dan alasan.' },
          { number: 3, text: 'Simpan — saldo goal berkurang.' },
        ],
      },
      {
        heading: 'Menghubungkan goal ke investasi',
        intro: 'Goal bisa dilink ke aset investasi — saldo ikut nilai investasi terkini.',
        steps: [
          { number: 1, text: 'Klik "Link Investasi" di kartu goal.' },
          { number: 2, text: 'Pilih aset investasi yang akan dihubungkan.' },
          { number: 3, text: 'Simpan — kontribusi goal mengikuti nilai aset terkini.' },
        ],
      },
    ],
  },
  {
    slug: 'pensiun',
    title: 'Pensiun',
    category: 'fitur',
    summary: 'Hitung dana pensiun terkumpul dan simulasi kebutuhan.',
    sections: [
      {
        heading: 'Hitung Total dana pensiun',
        steps: [
          { number: 1, text: 'Buka tab Pensiun.' },
          { number: 2, text: 'Pilih panel "Hitung Total".' },
          { number: 3, text: 'Sistem menjumlahkan saldo dari aset & investasi yang ditandai sebagai dana pensiun.' },
        ],
      },
      {
        heading: 'Menjalankan simulasi',
        steps: [
          { number: 1, text: 'Pilih panel "Simulasi" di tab Pensiun.' },
          { number: 2, text: 'Isi usia sekarang, usia pensiun target, dan estimasi pengeluaran bulanan saat pensiun.' },
          { number: 3, text: 'Atur asumsi inflasi dan return investasi.' },
          { number: 4, text: 'Lihat hasil: kebutuhan total saat pensiun + kekurangan/kelebihan vs dana terkumpul.' },
        ],
        tip: 'Panel "Panduan" di tab Pensiun berisi penjelasan asumsi simulasi.',
      },
    ],
  },
  {
    slug: 'laporan',
    title: 'Laporan',
    category: 'fitur',
    summary: 'Visualisasi grafik & insight teks dari data Anda.',
    sections: [
      {
        heading: 'Memilih periode laporan',
        steps: [
          { number: 1, text: 'Buka tab Laporan.' },
          { number: 2, text: 'Pilih periode di dropdown atas: Bulan ini / Tahun ini / Semua / Kustom.' },
        ],
      },
      {
        heading: 'Membaca grafik',
        steps: [
          { number: 1, text: 'Bar chart: pemasukan vs pengeluaran per hari/minggu/bulan.' },
          { number: 2, text: 'Pie chart: distribusi pengeluaran per kategori.' },
          { number: 3, text: 'Line chart: tren modal vs nilai investasi sepanjang waktu.' },
          { number: 4, text: 'Hover titik grafik untuk lihat angka detail.' },
        ],
      },
      {
        heading: 'Insight teks otomatis',
        steps: [
          { number: 1, text: 'Scroll ke section "Insight" di bawah grafik.' },
          { number: 2, text: 'Sistem otomatis menulis ringkasan: kategori pengeluaran terbesar, perubahan vs periode sebelumnya, dan saran.' },
        ],
      },
    ],
  },
  {
    slug: 'catatan',
    title: 'Catatan',
    category: 'fitur',
    summary: 'Catat pemikiran atau reminder keuangan.',
    sections: [
      {
        heading: 'Membuat catatan',
        steps: [
          { number: 1, text: 'Buka tab Catatan.' },
          { number: 2, text: 'Klik "Tambah Catatan".' },
          { number: 3, text: 'Isi judul, tanggal, dan isi bebas.' },
          { number: 4, text: 'Simpan.' },
        ],
        tip: 'Catatan panjang dipotong dengan "..." di tampilan kartu — klik untuk lihat lengkap.',
      },
      {
        heading: 'Mengedit/menghapus catatan',
        steps: [
          { number: 1, text: 'Klik kartu catatan.' },
          { number: 2, text: 'Pilih "Edit" untuk ubah, "Hapus" untuk hilangkan.' },
        ],
      },
    ],
  },
  {
    slug: 'pengaturan',
    title: 'Pengaturan',
    category: 'fitur',
    summary: 'Atur tema, target Rencana, akses pengguna, dan ekspor.',
    sections: [
      {
        heading: 'Mengubah tema',
        steps: [
          { number: 1, text: 'Buka tab Pengaturan.' },
          { number: 2, text: 'Section "Tampilan" → pilih Terang, Gelap, atau Sistem.' },
        ],
      },
      {
        heading: 'Mengatur Rencana Keuangan',
        steps: [
          { number: 1, text: 'Section "Rencana" menampilkan Total Target, Deadline, dan jumlah Goals aktif.' },
          { number: 2, text: 'Klik "Reset Seed Rencana" jika ingin menghapus goals & investasi hasil seed default.' },
          { number: 3, text: 'Buka Dashboard untuk inisialisasi ulang seed setelah reset.' },
        ],
      },
      {
        heading: 'Mengelola akses pengguna (admin)',
        steps: [
          { number: 1, text: 'Section "Pengguna" hanya muncul untuk akun admin.' },
          { number: 2, text: 'Tambah email baru ke allowlist via form di section.' },
          { number: 3, text: 'Klik "Hapus" untuk mencabut akses email yang sudah ada.' },
          { number: 4, text: 'Pakai "Lihat Keuangan" untuk view-as data pengguna lain (read-only).' },
        ],
      },
      {
        heading: 'Logout dari aplikasi',
        steps: [
          { number: 1, text: 'Klik avatar di kanan atas header.' },
          { number: 2, text: 'Pilih "Keluar".' },
          { number: 3, text: 'Konfirmasi dialog logout.' },
        ],
      },
    ],
  },
  {
    slug: 'skenario-gaji-tagihan',
    title: 'Mencatat gaji bulanan + tagihan rutin',
    category: 'skenario',
    summary: 'Setup template berulang untuk pemasukan tetap dan tagihan bulanan.',
    sections: [
      {
        heading: 'Persiapan',
        intro: 'Skenario ini cocok untuk pemasukan/pengeluaran tetap setiap bulan, mis. gaji Pertamina + tagihan listrik/internet.',
        steps: [
          { number: 1, text: 'Pastikan tab Transaksi sudah aktif dan Anda hafal nominal serta tanggal jatuh tempo.' },
        ],
      },
      {
        heading: 'Setup pemasukan gaji bulanan',
        steps: [
          { number: 1, text: 'Klik "Tambah Transaksi" di tab Transaksi.' },
          { number: 2, text: 'Pilih Jenis: Pemasukan, kategori "Gaji" (atau spesifik Pertamina jika tersedia).' },
          { number: 3, text: 'Aktifkan opsi "Berulang" → pilih frekuensi Bulanan, tanggal payday (mis. 25).' },
          { number: 4, text: 'Isi jumlah dan catatan, lalu Simpan sebagai template.' },
        ],
        tip: 'Template berulang otomatis muncul di panel Tagihan/Recurring tiap bulan.',
      },
      {
        heading: 'Setup tagihan rutin (listrik, internet, dll)',
        steps: [
          { number: 1, text: 'Klik "Tambah Transaksi" → pilih Pengeluaran.' },
          { number: 2, text: 'Pilih kategori (mis. "Listrik", "Internet"), aktifkan "Berulang" Bulanan.' },
          { number: 3, text: 'Set tanggal jatuh tempo dan estimasi nominal.' },
          { number: 4, text: 'Simpan template untuk setiap tagihan.' },
        ],
      },
      {
        heading: 'Verifikasi di Dashboard',
        steps: [
          { number: 1, text: 'Buka Dashboard.' },
          { number: 2, text: 'Cek panel "Tagihan Mendatang" — semua tagihan template harus muncul.' },
          { number: 3, text: 'Saat tagihan dibayar, klik "Tandai Dibayar" → transaksi otomatis tercatat.' },
        ],
      },
    ],
  },
  {
    slug: 'skenario-dana-darurat',
    title: 'Tracking dana darurat dari nol sampai tercapai',
    category: 'skenario',
    summary: 'Buat goal dana darurat, tabung berkala, pantau progress.',
    sections: [
      {
        heading: 'Membuat goal Dana Darurat',
        steps: [
          { number: 1, text: 'Buka Finansial → Goals → "Tambah Goal".' },
          { number: 2, text: 'Nama: "Dana Darurat".' },
          { number: 3, text: 'Target: 6× pengeluaran bulanan (cek angka di Laporan jika belum yakin).' },
          { number: 4, text: 'Target tanggal: realistis, mis. 18 bulan dari sekarang.' },
          { number: 5, text: 'Simpan.' },
        ],
      },
      {
        heading: 'Menabung berkala',
        steps: [
          { number: 1, text: 'Tiap kali transfer ke rekening dana darurat, klik "Tambah Uang" di kartu goal.' },
          { number: 2, text: 'Masukkan jumlah dan tanggal transfer.' },
          { number: 3, text: 'Progress bar otomatis bergerak.' },
        ],
        tip: 'Konsistensi > nominal besar. Tabung tiap payday meski sedikit.',
      },
      {
        heading: 'Memantau progress',
        steps: [
          { number: 1, text: 'Cek widget "Goals Aktif" di Dashboard tiap minggu.' },
          { number: 2, text: 'Lihat persentase progress vs sisa hari menuju target.' },
          { number: 3, text: 'Saat tercapai, status otomatis berubah jadi "Tercapai" dengan badge hijau.' },
        ],
      },
    ],
  },
  {
    slug: 'skenario-update-investasi',
    title: 'Update harga investasi & lihat performa',
    category: 'skenario',
    summary: 'Refresh harga aset dan baca grafik tren portofolio.',
    sections: [
      {
        heading: 'Update harga semua aset',
        steps: [
          { number: 1, text: 'Buka tab Investasi.' },
          { number: 2, text: 'Untuk setiap aset, klik ikon grafik (↗) di baris.' },
          { number: 3, text: 'Cek harga terkini dari sumber Anda (saham → IDX, reksadana → Bareksa, dll).' },
          { number: 4, text: 'Masukkan harga, simpan — gain/loss langsung ter-update.' },
        ],
        tip: 'Update minimal 1× per minggu untuk grafik tren yang berarti.',
      },
      {
        heading: 'Membaca performa portofolio',
        steps: [
          { number: 1, text: 'Lihat kartu "Portofolio Investasi" di Dashboard untuk total nilai + gain/loss persen.' },
          { number: 2, text: 'Buka Laporan → line chart "Modal vs Nilai" untuk tren historis.' },
          { number: 3, text: 'Hover titik grafik untuk angka detail per tanggal update.' },
        ],
      },
      {
        heading: 'Identifikasi aset terbaik/terburuk',
        steps: [
          { number: 1, text: 'Di tab Investasi, sort kolom "Gain/Loss %" descending.' },
          { number: 2, text: 'Aset paling atas = top performer; paling bawah = under-performer.' },
          { number: 3, text: 'Gunakan info ini untuk keputusan rebalancing.' },
        ],
      },
    ],
  },
  {
    slug: 'skenario-rencana-jangka-menengah',
    title: 'Set target Rencana Keuangan jangka menengah',
    category: 'skenario',
    summary: 'Hubungkan goals + investasi ke RencanaBar (mis. Jan 2027).',
    sections: [
      {
        heading: 'Memahami Rencana default',
        intro: 'RencanaBar di Dashboard mengakumulasi saldo dari goals & investasi yang ditandai sebagai bagian Rencana.',
        steps: [
          { number: 1, text: 'Buka Dashboard, cari progress bar "Rencana Keuangan".' },
          { number: 2, text: 'Total target default: Rp 257 juta, deadline Jan 2027 (bisa diubah).' },
        ],
      },
      {
        heading: 'Menambah goal ke Rencana',
        steps: [
          { number: 1, text: 'Buat goal sesuai kebutuhan (mis. "Nikah", "DP Rumah") di Finansial → Goals.' },
          { number: 2, text: 'Beri nama persis sama dengan daftar Rencana di Pengaturan jika ingin auto-include (lihat panduan Pengaturan).' },
          { number: 3, text: 'Tambah uang ke goal seperti biasa.' },
        ],
      },
      {
        heading: 'Menghubungkan investasi ke Rencana',
        steps: [
          { number: 1, text: 'Buat aset di tab Investasi dengan nama yang masuk dalam daftar Rencana.' },
          { number: 2, text: 'Update harga rutin agar nilai aktual terbawa ke RencanaBar.' },
        ],
        tip: 'RencanaBar update real-time setiap kali Anda menabung atau update harga.',
      },
    ],
  },
  {
    slug: 'skenario-net-worth-bulanan',
    title: 'Cek progress kekayaan bersih bulanan',
    category: 'skenario',
    summary: 'Update aset & kewajiban tiap bulan dan baca tren Net Worth.',
    sections: [
      {
        heading: 'Update Aset awal bulan',
        steps: [
          { number: 1, text: 'Buka Finansial → Kekayaan di awal bulan.' },
          { number: 2, text: 'Untuk tiap aset (rumah, mobil, deposito), update nilai estimasi terbaru.' },
          { number: 3, text: 'Tambah aset baru jika ada akuisisi sejak update terakhir.' },
        ],
      },
      {
        heading: 'Update Kewajiban awal bulan',
        steps: [
          { number: 1, text: 'Cek saldo terutang dari aplikasi bank/kreditur (KPR, KMG, kartu kredit).' },
          { number: 2, text: 'Update angka di tiap entri kewajiban.' },
          { number: 3, text: 'Hapus entri yang sudah lunas.' },
        ],
      },
      {
        heading: 'Baca tren Net Worth',
        steps: [
          { number: 1, text: 'Lihat angka Net Worth di header sub-tab Kekayaan: Total Aset − Total Kewajiban.' },
          { number: 2, text: 'Bandingkan dengan bulan sebelumnya — naik = aset bertambah/utang berkurang.' },
          { number: 3, text: 'Catat hasil di tab Catatan jika ingin punya log historis.' },
        ],
        tip: 'Konsistensi tanggal update (mis. selalu tanggal 1) membuat tren lebih akurat.',
      },
    ],
  },
]
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/content/panduan.ts
git commit -m "feat(panduan): tambah konten 14 topik (9 fitur + 5 skenario)"
```

---

### Task 3: Buat komponen `PanduanFullPage`

**Files:**
- Create: `src/components/PanduanFullPage.tsx`

- [ ] **Step 1: Tulis komponen**

File: `src/components/PanduanFullPage.tsx`

```tsx
import { useEffect, useMemo, useRef } from 'react'
import { ArrowLeft, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePanduanStore } from '@/lib/panduanStore'
import { useTabStore } from '@/lib/tabStore'
import { PANDUAN_TOPICS, type PanduanTopic } from '@/content/panduan'

const FITUR_TOPICS = PANDUAN_TOPICS.filter((t) => t.category === 'fitur')
const SKENARIO_TOPICS = PANDUAN_TOPICS.filter((t) => t.category === 'skenario')

function resolveActive(slug: string | null): PanduanTopic {
  if (slug) {
    const found = PANDUAN_TOPICS.find((t) => t.slug === slug)
    if (found) return found
  }
  return PANDUAN_TOPICS[0]
}

export default function PanduanFullPage() {
  const { activeSlug, setActiveSlug, close } = usePanduanStore()
  const { setActiveTab } = useTabStore()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const active = useMemo(() => resolveActive(activeSlug), [activeSlug])

  function handleBack() {
    close()
    setActiveTab('settings')
  }

  function handleSelectSlug(slug: string) {
    setActiveSlug(slug)
    contentRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }

  useEffect(() => {
    headingRef.current?.focus()
  }, [active.slug])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          aria-label="Kembali ke Pengaturan"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Pengaturan
        </Button>
        <h1 className="text-base font-bold sm:text-lg">Panduan Penggunaan</h1>
      </div>

      {/* Mobile: Select dropdown */}
      <div className="border-b border-border px-4 py-3 md:hidden">
        <Select value={active.slug} onValueChange={handleSelectSlug}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Per-Fitur</SelectLabel>
              {FITUR_TOPICS.map((t) => (
                <SelectItem key={t.slug} value={t.slug}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Skenario</SelectLabel>
              {SKENARIO_TOPICS.map((t) => (
                <SelectItem key={t.slug} value={t.slug}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-60 shrink-0 overflow-y-auto border-r border-border px-3 py-4 md:block">
          <SidebarGroup
            label="Per-Fitur"
            topics={FITUR_TOPICS}
            activeSlug={active.slug}
            onSelect={handleSelectSlug}
          />
          <div className="h-4" />
          <SidebarGroup
            label="Skenario"
            topics={SKENARIO_TOPICS}
            activeSlug={active.slug}
            onSelect={handleSelectSlug}
          />
        </aside>

        {/* Konten */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <article className="mx-auto max-w-3xl">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl font-bold outline-none"
            >
              {active.title}
            </h2>
            <p className="mt-2 text-base text-muted-foreground">{active.summary}</p>

            <div className="mt-8 space-y-10">
              {active.sections.map((section, idx) => (
                <section key={idx}>
                  <h3 className="text-lg font-semibold">{section.heading}</h3>
                  {section.intro && (
                    <p className="mt-2 text-sm text-muted-foreground">{section.intro}</p>
                  )}
                  <ol className="mt-4 list-decimal space-y-3 pl-6 text-sm">
                    {section.steps.map((step) => (
                      <li key={step.number}>
                        <span>{step.text}</span>
                        {step.detail && (
                          <span className="mt-1 block text-muted-foreground">
                            {step.detail}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                  {section.tip && (
                    <div className="mt-4 flex gap-2 rounded-lg bg-muted p-3 text-sm">
                      <Lightbulb className="h-4 w-4 shrink-0 text-[var(--brand)]" />
                      <span>{section.tip}</span>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}

function SidebarGroup({
  label,
  topics,
  activeSlug,
  onSelect,
}: {
  label: string
  topics: PanduanTopic[]
  activeSlug: string
  onSelect: (slug: string) => void
}) {
  return (
    <div>
      <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <ul className="space-y-0.5">
        {topics.map((t) => {
          const isActive = t.slug === activeSlug
          return (
            <li key={t.slug}>
              <button
                onClick={() => onSelect(t.slug)}
                aria-current={isActive ? 'page' : undefined}
                className={`block w-full rounded-md border-l-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  isActive
                    ? 'border-[var(--brand)] bg-accent text-foreground'
                    : 'border-transparent text-muted-foreground hover:bg-accent/50'
                }`}
              >
                {t.title}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/PanduanFullPage.tsx
git commit -m "feat(panduan): tambah PanduanFullPage komponen layout penuh"
```

---

### Task 4: Buat komponen `PanduanWelcomeCard`

**Files:**
- Create: `src/components/PanduanWelcomeCard.tsx`

- [ ] **Step 1: Tulis komponen**

File: `src/components/PanduanWelcomeCard.tsx`

```tsx
import { ArrowRight, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePanduanStore } from '@/lib/panduanStore'

export default function PanduanWelcomeCard() {
  const { openPanduan } = usePanduanStore()

  return (
    <div className="rounded-xl border border-[var(--brand-muted)] bg-card p-5">
      <div className="flex items-start gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--brand-light)' }}
        >
          <BookOpen className="h-5 w-5 text-[var(--brand)]" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold">Panduan Penggunaan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pelajari cara pakai semua fitur Kantong Pintar lewat tutorial step-by-step.
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => openPanduan()}>
          Lihat Panduan Lengkap
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/PanduanWelcomeCard.tsx
git commit -m "feat(panduan): tambah PanduanWelcomeCard untuk Settings"
```

---

### Task 5: Wire `PanduanFullPage` ke `App.tsx` (conditional render)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Tambah import + conditional render**

Edit `src/App.tsx`. Cari blok import dan tambah:

```tsx
import PanduanFullPage from '@/components/PanduanFullPage'
import { usePanduanStore } from '@/lib/panduanStore'
```

Di dalam komponen `App`, setelah baris `const { activeTab, setActiveTab } = useTabStore()`, tambah:

```tsx
const { open: panduanOpen } = usePanduanStore()
```

Lalu di dalam `<main className="p-6">`, **bungkus** isi `<Tabs>...</Tabs>` dengan conditional. Ganti blok `<main>` saat ini dengan:

```tsx
<main className={panduanOpen ? '' : 'p-6'}>
  {panduanOpen ? (
    <PanduanFullPage />
  ) : (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        <TabsList className="inline-flex w-max min-w-full rounded-none border-b border-border bg-transparent p-0 [&>button:not([role='tab'])]:hidden">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:border-[var(--brand)] data-[state=active]:text-[var(--brand)] data-[state=active]:shadow-none"
            >
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {TABS.map(({ value, Comp }) => (
        <TabsContent key={value} value={value}>
          <Comp />
        </TabsContent>
      ))}
    </Tabs>
  )}
</main>
```

Alasan padding `p-6` dilepas saat panduan: PanduanFullPage punya padding sendiri + sidebar yang harus full-height tanpa offset. Header app + OfflineBanner + ViewAsBanner tetap di luar conditional, jadi tidak hilang.

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Verify lint**

Run: `npm run lint`
Expected: PASS (no new errors)

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(panduan): conditional render PanduanFullPage di App.tsx"
```

---

### Task 6: Update `SettingsTab.tsx` — hapus `PanduanDialog`, tambah `PanduanWelcomeCard`

**Files:**
- Modify: `src/tabs/SettingsTab.tsx`

- [ ] **Step 1: Hapus import `PanduanDialog`**

Edit `src/tabs/SettingsTab.tsx`. Hapus baris 21:

```tsx
import PanduanDialog from '@/components/PanduanDialog'
```

- [ ] **Step 2: Tambah import `PanduanWelcomeCard`**

Tambah setelah import `TentangDialog` (sekitar baris 22):

```tsx
import PanduanWelcomeCard from '@/components/PanduanWelcomeCard'
```

- [ ] **Step 3: Hapus state `panduanOpen`**

Hapus baris (sekitar 39):

```tsx
const [panduanOpen, setPanduanOpen] = useState(false)
```

- [ ] **Step 4: Hapus tombol "Panduan Pengguna" di section Bantuan**

Cari section Bantuan (sekitar baris 294-307). Ganti seluruh blok section dengan versi tanpa tombol Panduan:

```tsx
{/* Bantuan */}
<section>
  <SectionHeader icon={HelpCircle} label="Bantuan" iconBg="bg-[#fef9c3]" />
  <div className="flex flex-wrap gap-2">
    <Button variant="outline" onClick={() => setTentangOpen(true)}>
      <HelpCircle className="h-4 w-4" />
      Tentang
    </Button>
  </div>
</section>
```

Tombol "Panduan Pengguna" dengan icon `BookOpen` dihapus; akses panduan sekarang hanya via WelcomeCard di atas.

- [ ] **Step 5: Hapus render `<PanduanDialog />`**

Hapus baris (sekitar 309):

```tsx
<PanduanDialog open={panduanOpen} onOpenChange={setPanduanOpen} />
```

- [ ] **Step 6: Hapus import icon `BookOpen` jika tidak terpakai lagi**

Cek di `src/tabs/SettingsTab.tsx`: setelah hapus tombol Panduan, `BookOpen` mungkin tidak terpakai lagi. Jika true, hapus dari baris import lucide-react:

```bash
# Search BookOpen usage
```

Run: `grep -n "BookOpen" src/tabs/SettingsTab.tsx`
Jika hanya match di line import, hapus `BookOpen,` dari list import lucide-react di baris 20.

- [ ] **Step 7: Tambah `<PanduanWelcomeCard />` di paling atas return JSX**

Di awal return statement, sebelum section "Tampilan", tambah:

```tsx
return (
  <div className="max-w-2xl space-y-8">
    <PanduanWelcomeCard />

    {/* Tampilan */}
    <section>
      ...
```

- [ ] **Step 8: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/tabs/SettingsTab.tsx
git commit -m "feat(panduan): ganti PanduanDialog dengan PanduanWelcomeCard di SettingsTab"
```

---

### Task 7: Hapus file `PanduanDialog.tsx`

**Files:**
- Delete: `src/components/PanduanDialog.tsx`

- [ ] **Step 1: Verifikasi tidak ada referensi tersisa**

Run: `grep -rn "PanduanDialog" src/`
Expected: NO results (semua referensi sudah dihapus di Task 6)

Jika ada hasil selain di file PanduanDialog.tsx itu sendiri, cek dan hapus referensi tersebut sebelum lanjut.

- [ ] **Step 2: Hapus file**

Run: `rm src/components/PanduanDialog.tsx`

- [ ] **Step 3: Verify typecheck + lint + build**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm run lint`
Expected: PASS

Run: `npm run build`
Expected: PASS (no errors, no warnings tentang missing PanduanDialog)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(panduan): hapus PanduanDialog (digantikan halaman penuh)"
```

---

### Task 8: Verify dev server build clean

**Files:** —

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts at http://localhost:5173 tanpa error di terminal.

- [ ] **Step 2: Buka di browser dan cek console**

Buka http://localhost:5173 di browser, login, buka tab Pengaturan. Buka DevTools Console.

Expected:
- No red errors di console
- Welcome card "Panduan Penggunaan" terlihat di atas section Tampilan
- Section Bantuan hanya menampilkan tombol "Tentang"

- [ ] **Step 3: Hentikan dev server**

Tekan `Ctrl+C` di terminal dev server.

---

### Task 9: Manual UAT (10 checks)

**Files:** —

- [ ] **Step 1: Buka aplikasi production-mode preview**

Run: `npm run build && npm run preview`

Buka URL preview yang muncul di terminal.

- [ ] **Step 2: UAT-01 Welcome card di Settings**

Login → buka tab Pengaturan.
Expected: Welcome card "Panduan Penggunaan" terlihat di paling atas, sebelum section Tampilan.

- [ ] **Step 3: UAT-02 Buka panduan default**

Klik tombol "Lihat Panduan Lengkap" di welcome card.
Expected: Halaman penuh terbuka, default ke topik Dashboard, sidebar menampilkan grup PER-FITUR + SKENARIO dengan Dashboard di-highlight.

- [ ] **Step 4: UAT-03 Navigasi sidebar**

Klik beberapa topik di sidebar (mis. Transaksi, Investasi, Goals).
Expected: Konten kanan ganti, scroll konten kembali ke top, item sidebar yang aktif di-highlight (border kiri brand color).

- [ ] **Step 5: UAT-04 Tombol back**

Klik tombol "Kembali ke Pengaturan" di top bar.
Expected: Kembali ke tab Pengaturan, welcome card masih terlihat.

- [ ] **Step 6: UAT-05 Tombol Esc**

Buka panduan lagi. Tekan tombol `Esc` di keyboard.
Expected: Sama seperti tombol back — kembali ke Pengaturan.

- [ ] **Step 7: UAT-06 Mobile responsive**

Resize browser ke < 768px (atau pakai DevTools mobile view).
Expected: Sidebar berubah jadi `<Select>` dropdown di atas konten. Pilih topik dari dropdown — konten ganti.

- [ ] **Step 8: UAT-07 Theme toggle**

Settings → toggle tema (Terang ↔ Gelap). Buka panduan.
Expected: Warna teks, background, border, dan brand accent konsisten dengan tema aktif. Tip box (`bg-muted`) terbaca jelas di kedua tema.

- [ ] **Step 9: UAT-08 Refresh saat panduan terbuka**

Buka panduan, lalu tekan F5 / refresh browser.
Expected: Kembali ke tab Pengaturan (Zustand store tidak persist). No console error.

- [ ] **Step 10: UAT-09 OfflineBanner aktif**

Matikan koneksi internet (DevTools → Network → Offline). Buka panduan.
Expected: OfflineBanner tetap tampil di atas halaman panduan. Konten panduan tetap berfungsi (data hard-coded, tidak butuh network).

- [ ] **Step 11: UAT-10 Konten 14 topik komplit**

Klik tiap dari 14 topik di sidebar (9 fitur + 5 skenario):
- Dashboard, Transaksi, Investasi, Finansial → Kekayaan, Finansial → Goals, Pensiun, Laporan, Catatan, Pengaturan
- Mencatat gaji bulanan + tagihan rutin
- Tracking dana darurat dari nol sampai tercapai
- Update harga investasi & lihat performa
- Set target Rencana Keuangan jangka menengah
- Cek progress kekayaan bersih bulanan

Expected: Setiap topik render dengan title + summary + minimal 1 section + langkah numerik. Tip box render saat ada.

- [ ] **Step 12: Catat hasil UAT**

Jika semua 10 UAT lulus, commit catatan:

```bash
git commit --allow-empty -m "test(panduan): UAT manual 10 check semua PASS"
```

Jika ada UAT gagal, jangan commit pass — fix bug-nya dulu (masuk task baru).

---

## Self-Review

**Spec coverage:**
- ✓ Section 1 (Tujuan) → seluruh plan
- ✓ Section 2 (14 topik) → Task 2 isi lengkap
- ✓ Section 3 (Format step-by-step) → Task 2 data shape + content
- ✓ Section 4 (Arsitektur) → File creates di Task 1-4, modifies Task 5-6, delete Task 7
- ✓ Section 5 (Data shape) → Task 2 step 1
- ✓ Section 6 (State store) → Task 1
- ✓ Section 7 (UI Layout desktop+mobile) → Task 3
- ✓ Section 8 (Welcome Card) → Task 4 + integration Task 6
- ✓ Section 9 (Aksesibilitas: aria-current, focus, Esc) → Task 3 (focus mgmt + keydown handler + aria attributes)
- ✓ Section 10 (Edge cases) → covered in Task 3 (resolveActive fallback) + Task 5 (banner di luar conditional) + Task 9 UAT
- ✓ Section 11 (Manual UAT) → Task 9
- ✓ Section 12 (Out of scope) → tidak diimplementasikan, di-confirm via plan tidak menyentuh
- ✓ Section 13 (Acceptance Criteria) → tercakup di Task 9 UAT

**Placeholder scan:** Tidak ada "TBD"/"TODO". Semua step punya kode konkret atau perintah konkret.

**Type consistency:**
- `PanduanTopic.slug: string` (Task 2) ↔ `usePanduanStore.activeSlug: string | null` (Task 1) — konsisten
- `openPanduan(slug?: string)` (Task 1) ↔ dipanggil tanpa arg di WelcomeCard Task 4 — konsisten
- `setActiveSlug(slug: string)` (Task 1) ↔ dipanggil dengan `t.slug` di Task 3 sidebar — konsisten
- `resolveActive(slug)` di Task 3 mengembalikan `PanduanTopic` non-null — konsisten dengan rendering yang akses `.title`, `.summary`, `.sections`

Tidak ada inconsistency.

---

## Plan Complete

Plan tersimpan. Ada 9 task, masing-masing dengan steps kecil dan commit per task. Siap eksekusi.
