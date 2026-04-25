# Spec: Halaman Panduan Penggunaan di Settings

**Tanggal:** 2026-04-25
**Status:** Draft (menunggu review user)
**Scope:** v1.1 candidate — fitur tutorial in-app menggantikan `PanduanDialog` existing

---

## 1. Tujuan

Menyediakan dokumen panduan/tutorial penggunaan fitur Kantong Pintar yang diakses dari menu **Pengaturan** sebagai halaman tersendiri (bukan dialog). Bentuk hybrid: ringkasan welcome card di Settings + halaman penuh dengan sidebar topik untuk konten lengkap.

Menggantikan `PanduanDialog.tsx` yang sekarang aktif (Dialog dengan section sederhana per fitur), karena cakupan konten yang lebih dalam (step-by-step numbered + skenario) tidak cocok dengan format dialog.

## 2. Konten — 14 Topik

### Per-fitur (9 topik)

Mengikuti struktur navigasi nyata di `App.tsx` (8 tab top-level, dengan Finansial berisi 2 sub-tab Kekayaan + Goals):

1. **Dashboard** — baca ringkasan keuangan + RencanaBar
2. **Transaksi** — catat pemasukan/pengeluaran + transaksi berulang
3. **Investasi** — tambah aset, update harga, gain/loss
4. **Finansial → Kekayaan** — input aset & kewajiban (Net Worth)
5. **Finansial → Goals** — buat target keuangan, tambah/tarik uang, link ke investasi
6. **Pensiun** — hitung total dana + simulasi pensiun
7. **Laporan** — grafik pengeluaran + insight teks
8. **Catatan** — catatan keuangan
9. **Pengaturan** — tema, export PDF, view-as, manajemen email allowlist

### Skenario (5 topik)

Berbasis flow penggunaan nyata, lintas fitur:

1. **Mencatat gaji bulanan + tagihan rutin Pertamina** — setup template berulang untuk pemasukan & tagihan tetap
2. **Tracking dana darurat dari nol sampai tercapai** — buat goal, tambah uang berkala, tracking progress
3. **Update harga investasi & lihat performa portofolio** — flow update harga + baca gain/loss
4. **Set target Rencana Keuangan jangka menengah** — link goals + investasi ke RencanaBar Jan 2027
5. **Cek progress kekayaan bersih dari bulan ke bulan** — input aset/kewajiban + baca tren Net Worth

## 3. Format Konten

Setiap topik = **teks + step-by-step numbered**, **tanpa screenshot**.

Struktur: heading section → intro opsional → langkah numerik → tip opsional. Tidak ada video, tidak ada gambar, tidak ada FAQ/troubleshooting terpisah.

## 4. Arsitektur

### File baru

| File | Tujuan |
|------|--------|
| `src/content/panduan.ts` | Data 14 topik sebagai typed array |
| `src/lib/panduanStore.ts` | Zustand store: `{open, activeSlug, openPanduan(slug?), close()}` |
| `src/components/PanduanFullPage.tsx` | Layout halaman penuh (sidebar + konten) |
| `src/components/PanduanWelcomeCard.tsx` | Welcome card untuk SettingsTab |

### File diubah

| File | Perubahan |
|------|-----------|
| `src/App.tsx` | Conditional render: jika `panduanOpen`, render `<PanduanFullPage />` menggantikan `<Tabs>`; header app + OfflineBanner + ViewAsBanner tetap |
| `src/tabs/SettingsTab.tsx` | Hapus state `panduanOpen`, hapus import & usage `PanduanDialog`, tambah `<PanduanWelcomeCard />` di atas section existing; section `TentangDialog` tidak diubah |

### File dihapus

- `src/components/PanduanDialog.tsx`

### Tidak diubah

- `useTabStore`, semua tab konten lain
- Tidak menambah dependency baru (no react-router, no react-markdown, no MDX)
- `TentangDialog` tetap ada

## 5. Data Shape (`src/content/panduan.ts`)

```ts
export type PanduanStep = {
  number: number      // langkah 1, 2, 3...
  text: string        // instruksi singkat
  detail?: string     // penjelasan tambahan opsional
}

export type PanduanSection = {
  heading: string     // mis. "Menambah transaksi baru"
  intro?: string      // paragraf pembuka opsional
  steps: PanduanStep[]
  tip?: string        // tip/catatan opsional di akhir section
}

export type PanduanTopic = {
  slug: string        // 'transaksi', 'skenario-gaji-tagihan'
  title: string       // 'Transaksi'
  category: 'fitur' | 'skenario'
  summary: string     // 1 kalimat ringkas untuk sidebar
  sections: PanduanSection[]
}

export const PANDUAN_TOPICS: PanduanTopic[] = [/* 14 entri */]
```

Konten konkret 14 topik ditulis saat implementasi (di luar scope spec ini — terlalu panjang). Spec ini hanya mengunci shape + jumlah + judul.

### Contoh entri (referensi untuk penulis)

```ts
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
    // ... section lain
  ],
}
```

## 6. State Store (`src/lib/panduanStore.ts`)

```ts
import { create } from 'zustand'

type PanduanState = {
  open: boolean
  activeSlug: string | null
  openPanduan: (slug?: string) => void
  setActiveSlug: (slug: string) => void
  close: () => void
}

export const usePanduanStore = create<PanduanState>((set) => ({
  open: false,
  activeSlug: null,
  openPanduan: (slug) => set({ open: true, activeSlug: slug ?? null }),
  setActiveSlug: (slug) => set({ activeSlug: slug }),
  close: () => set({ open: false }),
}))
```

Tidak di-persist (refresh = kembali ke default Settings tab). Konsisten dengan pola `useTabStore` existing.

## 7. UI Layout — `PanduanFullPage`

### Desktop (≥ 768px)

```
┌─────────────────────────────────────────────────────────────┐
│ [← Kembali ke Pengaturan]  Panduan Penggunaan               │ ← top bar (sticky)
├──────────────────┬──────────────────────────────────────────┤
│  PER-FITUR       │  ## Transaksi                            │
│  • Dashboard     │                                          │
│  • Transaksi  ✓  │  Catat pemasukan & pengeluaran harian.   │
│  • Investasi     │                                          │
│  • Kekayaan      │  ### Menambah transaksi baru             │
│  • Goals         │                                          │
│  • Pensiun       │  1. Buka tab Transaksi.                  │
│  • Laporan       │  2. Klik tombol "Tambah Transaksi"...    │
│  • Catatan       │  3. ...                                  │
│  • Pengaturan    │                                          │
│                  │  💡 Tip: Warna hijau = pemasukan...      │
│  SKENARIO        │                                          │
│  • Mencatat gaji │  ### Mengatur transaksi berulang         │
│  • Dana darurat  │  ...                                     │
│  • Update harga  │                                          │
│  • Rencana       │                                          │
│  • Kekayaan bln  │                                          │
└──────────────────┴──────────────────────────────────────────┘
   sidebar 240px            konten flex-1, max-w-3xl
```

**Komponen:**
- **Top bar:** sticky di dalam `<main>`. Tombol back (icon `ArrowLeft` lucide) + judul "Panduan Penggunaan".
- **Sidebar kiri (240px, sticky):** 2 grup heading (`PER-FITUR`, `SKENARIO`) uppercase muted text-xs. List item per topik = `<button>` dengan `aria-current="page"` saat active. Active style: `bg-accent` + `text-foreground` + `border-l-2 border-[var(--brand)]`. Inactive: `text-muted-foreground hover:bg-accent/50`.
- **Konten kanan:** scrollable, padding `px-8 py-6`, `max-w-3xl`. Render dari `activeTopic.sections`:
  - `<h2>` topic title
  - `<p class="lead">` summary
  - Loop sections: `<h3>` heading + intro + `<ol>` steps numerik + tip box (`bg-muted` + icon `Lightbulb` + text-sm)

### Mobile (< 768px)

- Sidebar collapse ke shadcn `<Select>` dropdown di atas konten
- Konten full-width, padding lebih kecil

### Default state saat halaman dibuka

- Jika `activeSlug` null → tampilkan topik pertama (`'dashboard'`)
- Welcome card di Settings → memanggil `openPanduan()` (tanpa slug, ke default)

## 8. Welcome Card di SettingsTab

**Posisi:** section paling atas di `SettingsTab`, sebelum semua section existing.

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  [📖]  Panduan Penggunaan                           │
│        Pelajari cara pakai semua fitur Kantong      │
│        Pintar lewat tutorial step-by-step.          │
│                                                     │
│                          [Lihat Panduan Lengkap →]  │
└─────────────────────────────────────────────────────┘
```

- shadcn `Card` dengan padding standar
- Icon `BookOpen` (24px) dalam rounded box dengan tone `bg-brand-light` di light mode (sesuai pattern existing)
- Heading: `text-base font-bold`
- Body: 1 kalimat `text-sm text-muted-foreground`
- Tombol kanan bawah: `Button` variant default, klik → `usePanduanStore.openPanduan()`

**Migration dari existing:**
- State `panduanOpen` lokal di `SettingsTab.tsx:39` dihapus
- Import `PanduanDialog` dari line 21 dihapus
- JSX usage `<PanduanDialog .../>` + tombol pemanggilnya dihapus
- Section `TentangDialog` (Tentang Aplikasi) tetap ada, tidak diubah

## 9. Aksesibilitas

- Sidebar items = `<button>` semantik dengan `aria-current="page"` saat active
- Top bar tombol back = `<button>` dengan `aria-label="Kembali ke Pengaturan"`
- Konten dibungkus `<article>` dengan hierarchy `<h2>` → `<h3>` konsisten
- Steps render dalam `<ol>` (numbered list semantik)
- Focus management:
  - Saat `openPanduan()` dipanggil, focus ke heading konten utama (`tabIndex={-1}` + `ref.focus()`)
  - Saat close, focus kembali ke Welcome card button (gunakan `useRef` di SettingsTab)
- Keyboard: `Esc` di PanduanFullPage = back to Settings (handler `useEffect` global)

## 10. Edge Cases

| Kasus | Behavior |
|-------|----------|
| Sidebar topik panjang di mobile | Native dropdown via shadcn `Select`, scroll konten reset ke top saat ganti topik |
| User klik tab lain saat panduan terbuka | Tidak mungkin — tab bar tidak dirender saat `panduanOpen=true` |
| Refresh halaman saat panduan terbuka | Store tidak di-persist; kembali ke Settings tab default |
| `activeSlug` invalid | Fallback ke topik pertama (`'dashboard'`) |
| OfflineBanner / ViewAsBanner aktif | Tetap tampil di atas PanduanFullPage (sudah render di level App.tsx luar conditional) |
| `openPanduan(slug)` dipanggil dari luar Settings | Store API mendukung, tapi out-of-scope v1 (no entry point lain dibuat di v1) |

## 11. Testing — Manual UAT (No Automation)

Project belum punya test runner setup (deferred di v1.0 milestone state). Konsisten dengan pola existing, panduan v1 = **manual UAT only**.

UAT checklist:

1. Settings → Welcome card terlihat di paling atas
2. Klik "Lihat Panduan Lengkap" → halaman penuh terbuka, default ke topik Dashboard
3. Klik tiap topik di sidebar → konten ganti, scroll reset ke top
4. Klik "Kembali ke Pengaturan" → kembali ke Settings tab
5. Tekan `Esc` di panduan → kembali ke Settings
6. Resize ke mobile (< 768px) → sidebar berubah jadi dropdown, dropdown berfungsi
7. Toggle theme dark/light di Settings → buka panduan → warna konsisten dengan tema
8. Refresh saat panduan terbuka → kembali ke Settings (no error)
9. Buka `OfflineBanner` mode (matikan koneksi) → buka panduan → banner tetap di atas
10. Verifikasi semua 14 topik: setiap heading muncul, setiap section punya minimal 1 step, tip render benar saat ada

Jika test infra dibangun di v1.1+, panduan bisa di-cover saat itu (di luar scope spec ini).

## 12. Out of Scope

- ❌ Screenshot, gambar, video, atau MDX
- ❌ Search bar untuk panduan
- ❌ FAQ/Troubleshooting section terpisah
- ❌ Getting Started flow tersendiri
- ❌ Routing URL (`/panduan` di-share/bookmark) — pakai state-based overlay
- ❌ Link cross-topik dalam konten (mis. "lihat juga: Goals") — keep flat di v1
- ❌ Persistence Zustand store ke localStorage
- ❌ Test otomatis — manual UAT saja

## 13. Acceptance Criteria

- [ ] 14 topik panduan ditulis lengkap di `src/content/panduan.ts` dengan minimal 1 section + 3 steps per topik
- [ ] PanduanDialog dihapus, tidak ada referensi tersisa di codebase
- [ ] Welcome card muncul di SettingsTab paling atas
- [ ] Halaman penuh berfungsi: sidebar navigasi, konten render benar, tombol back kembali ke Settings, `Esc` keyboard berfungsi
- [ ] Mobile responsive: sidebar jadi dropdown < 768px
- [ ] Light + dark mode keduanya konsisten visual
- [ ] Aksesibilitas: heading hierarchy, `aria-current`, focus management berfungsi
- [ ] Manual UAT 10 item lulus semua
- [ ] Tidak ada dependency baru di `package.json`
