# Design Spec: Kantong Pintar — Halaman Pengenalan Interaktif

**Tanggal:** 2026-05-01
**File output:** `public/panduan.html`

## Tujuan

Halaman HTML mandiri (single-file, tanpa library eksternal) yang memperkenalkan aplikasi Kantong Pintar secara visual, animatif, dan interaktif — setara landing page produk fintech premium.

## Audiens

Pengguna baru / siapapun yang ingin mengenal fitur Kantong Pintar sebelum menggunakan.

## Struktur Halaman (6 Section)

1. **Hero** — Logo, nama "Kantong Pintar", tagline typewriter, particles animasi, floating icons keuangan, tombol scroll-down
2. **Problem Statement** — 3 pain point keuangan pribadi, ikon + teks, animasi slide-in
3. **Fitur Unggulan** — 8 kartu fitur (Dashboard, Transaksi, Investasi, Finansial, Pensiun, Laporan, Catatan, Pengaturan), masing-masing dengan mockup mini dan deskripsi, muncul saat scroll
4. **Keunggulan** — 4 keunggulan vs cara manual, card animasi
5. **Stats Section** — Count-up numbers (8 Fitur, 100% Privat, dst.)
6. **CTA** — Tombol "Mulai Sekarang", gradient background, animasi pulse

## Animasi & Interaktivitas

- Particles hero (titik bergerak + garis koneksi, canvas)
- Gradient background shift (loop warna hero)
- Typewriter effect (tagline diketik huruf per huruf)
- Scroll-reveal via IntersectionObserver (fade-in + slide-up per section)
- Count-up numbers saat Stats section terlihat
- 3D card tilt (mouse parallax pada hover)
- Glitch effect sesekali pada logo
- Ripple click pada tombol CTA
- Progress bar animasi di mockup fitur
- Floating icons melayang naik-turun di hero background
- Skeleton loader → data reveal pada mockup mini
- Neon glow pulse pada badge/highlight
- Custom cursor (lingkaran gradient mengikuti mouse)
- Floating dot-indicator nav (posisi scroll)
- Hover: card melayang + gradient border menyala

## Visual Style

- **Background:** `#0a0a0f` + noise texture halus
- **Gradient aksen:** `#00d4ff` → `#7c3aed` → `#f472b6`
- **Card bg:** `#111827`, border `rgba(255,255,255,0.08)`
- **Teks:** putih `#ffffff` / sekunder `#9ca3af`
- **Neon highlights:** `#00d4ff` (angka), `#34d399` (positif), `#f87171` (negatif)
- **Font:** Inter (Google Fonts)
- **Bahasa:** Bahasa Indonesia, data mockup realistis (Rupiah)

## Implementasi

- Satu file `public/panduan.html`
- Pure HTML + CSS + Vanilla JS (zero dependencies)
- Semua animasi via CSS keyframes + IntersectionObserver + Canvas API
