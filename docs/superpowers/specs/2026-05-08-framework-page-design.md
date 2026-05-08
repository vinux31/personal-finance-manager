# Halaman /kesehatan — Piramida Diagnostic + Literasi Finansial — Design Spec

**Tanggal:** 2026-05-08
**Status:** Draft → menunggu review user
**Lingkup:** Halaman baru `/kesehatan` (grup sidebar baru "Strategi") yang menggabungkan piramida diagnostic 4-tier data-driven, 6 modul edukasi editorial, dan kalkulator compound interest. Port konten dari `financial_framework.html` ke React, dengan adaptasi indikator data-driven berbasis schema pfm-web yang sudah ada.

## 1. Tujuan

Saat ini pfm-web punya tabs operasional (transaksi, kekayaan, goals, investasi, pensiun) tapi tidak punya **lapisan strategis** — tempat user lihat *kondisi keuangan secara utuh* dan *belajar konsep finansial*. File `financial_framework.html` di root project punya konten editorial gaya majalah Capital (4 section: piramida + 6 modul + kalkulator + glossary) yang belum terintegrasi ke app.

Setelah perubahan:

- Halaman `/kesehatan` jadi rujukan strategis user — "kondisi gue gimana, mau ke mana, harus belajar apa"
- Piramida 4 tier dengan **warna hijau/kuning/merah hidup berdasarkan data user** — bukan sekadar konten editorial
- 6 modul edukasi accessible sebagai sub-route dengan typography Fraunces serif preserve gaya source
- Kalkulator compound interest sebagai page sendiri di `/kesehatan/kalkulator`
- Tidak menggantikan `/panduan` (manual cara pakai app, kategori beda)

## 2. Konteks

### Source konten

`financial_framework.html` (1515 baris di root) — 4 section:
1. **§01 Pyramid** — 4 tier hierarki: Wealth Protection → Accumulation → Growth → Transfer
2. **§02 6 Modul** — Pondasi & Cash Flow, Tujuan/Risiko, Asset Allocation, Instrumen, Pajak/Biaya/Inflasi, Behavioral Finance
3. **§03 Tools** — Kalkulator compound interest interaktif
4. **§04 Glossary** — 8 istilah teknis

### Schema pfm-web yang dipakai

Semua indikator data-driven memakai tabel yang sudah ada:
- `transactions` (income/expense + date) → savings rate, avg expense bulanan
- `pay_periods` → window periode untuk savings rate
- `net_worth_accounts` (tabungan, giro, cash, deposito, dompet_digital, properti, kendaraan + balance) → dana darurat, denominator rasio investasi
- `net_worth_liabilities` (kpr, cicilan_kendaraan, kartu_kredit, paylater, kta + amount) → DAR
- `goals` (target_amount, current_amount, target_date, status) → goals on-track
- `investments` (asset_type, asset_name, quantity, buy_price, current_price) → rasio investasi, diversifikasi
- `pension_simulations` → kesiapan pensiun

### Sidebar restructure

`src/shell/navConfig.ts` saat ini punya 5 grup: (no label), Keuangan, Aset, Tujuan, Footer (Panduan/Pengaturan). Akan ditambah **grup baru "Strategi"** sebelum Footer:

```
[Dashboard]
Keuangan  : Transaksi, Periode Gaji, Laporan, Catatan
Aset      : Investasi, Kekayaan
Tujuan    : Goals, Pensiun
Strategi  : Kesehatan          ← grup BARU
─ Footer ─
Panduan, Pengaturan
```

## 3. Arsitektur

### Sub-routes

| Path | Konten | Layout |
|---|---|---|
| `/kesehatan` | Landing: piramida + banner kalkulator + grid 6 modul | `<KesehatanLayout>` |
| `/kesehatan/arus-kas` | Modul 1: Pondasi & Cash Flow | Modul layout (Fraunces) |
| `/kesehatan/tujuan` | Modul 2: Tujuan / Time Horizon / Risiko | Modul layout |
| `/kesehatan/alokasi-aset` | Modul 3: Asset Allocation & Diversifikasi | Modul layout |
| `/kesehatan/instrumen` | Modul 4: Instrumen Indonesia & Global | Modul layout |
| `/kesehatan/pajak-biaya-inflasi` | Modul 5: Pajak, Biaya & Inflasi | Modul layout |
| `/kesehatan/perilaku` | Modul 6: Behavioral Finance & Disiplin | Modul layout |
| `/kesehatan/kalkulator` | Compound interest calculator (full page) | Calculator layout |

React-router setup: nested route dengan `<Outlet />` di layout component. Breadcrumb di sub-page: `Kesehatan / <Modul>`.

### Komponen baru

```
src/tabs/kesehatan/
├── KesehatanLayout.tsx          # nested route layout dengan breadcrumb
├── KesehatanLanding.tsx         # piramida + banner + grid modul
├── PiramidaSehatan.tsx          # 4-tier interactive pyramid
├── TierPanel.tsx                # expand panel per tier (state: tier, indicators)
├── indicators/
│   ├── DanaDaruratCard.tsx      # #1
│   ├── SavingsRateCard.tsx      # #2
│   ├── DarKonsumtifCard.tsx     # #3 (+ DAR Total info)
│   ├── AsuransiKesehatanForm.tsx # #4 inline checklist
│   ├── GoalsOnTrackCard.tsx     # #5 (+ smart fallback)
│   ├── PensiunCard.tsx          # #6 (+ smart fallback)
│   ├── RasioInvestasiCard.tsx   # #7
│   └── DiversifikasiCard.tsx    # #8
├── Tier4Checklist.tsx           # smart-gated checklist Tier 4
├── KalkulatorCompound.tsx       # /kesehatan/kalkulator
├── ModulCard.tsx                # card di grid landing
├── modul/
│   ├── ArusKasModul.tsx
│   ├── TujuanModul.tsx
│   ├── AlokasiAsetModul.tsx
│   ├── InstrumenModul.tsx
│   ├── PajakBiayaInflasiModul.tsx
│   └── PerilakuModul.tsx
└── GlossaryTooltip.tsx          # inline tooltip 8 istilah
```

### Data layer

```
src/queries/kesehatan.ts
  useDanaDarurat(userId, viewingAs?)   # likuid/avg expense
  useSavingsRate(userId, viewingAs?)   # 3-bulan avg
  useDarKonsumtif(userId, viewingAs?)  # non-KPR / aset finansial
  useGoalsOnTrack(userId, viewingAs?)  # goals long-term
  useRasioInvestasi(userId, viewingAs?)
  useDiversifikasi(userId, viewingAs?)
  usePensiunReadiness(userId, viewingAs?)  # dari pension_simulations

src/queries/protectionChecklist.ts
  useProtectionChecklist(userId, viewingAs?)
  useUpdateProtectionChecklist()
```

Semua query menerima `viewingAs?: string` parameter untuk View-As mode (admin viewing other user). Data layer pakai `viewingAs ?? userId` untuk filter, konsisten dengan pattern existing.

## 4. Piramida + Indikator

### Struktur 4 Tier

```
TIER 4 — WARISAN              Smart-gated checklist
TIER 3 — PERTUMBUHAN          #7 Rasio Investasi  #8 Diversifikasi
TIER 2 — AKUMULASI            #5 Goals on-track   #6 Pensiun
TIER 1 — PROTEKSI             #1 Dana Darurat     #2 Savings Rate
                              #3 DAR Konsumtif    #4 Asuransi Kesehatan
```

### Agregasi warna tier

Warna tier = agregasi indikator yang **sudah ter-compute** (skip placeholder & smart-fallback CTA card):
- **Hijau** : semua indikator ter-compute hijau
- **Kuning** : ada minimal 1 kuning, tidak ada merah
- **Merah** : ada minimal 1 merah
- **Abu-abu** : *semua* indikator di tier dalam keadaan placeholder/smart-fallback (tidak ada yang ter-compute)

Badge sekunder di tier (kalau ada placeholder/fallback ≥ 1 tapi tier tidak abu-abu):
> *"X indikator butuh data"* — informational, tidak mengubah warna tier dominan.

### Tabel indikator + threshold

| # | Indikator | Hijau | Kuning | Merah | Formula |
|---|---|---|---|---|---|
| 1 | Dana Darurat (bulan) | ≥ 6 | 3-5 | < 3 | `SUM(accounts likuid) ÷ avg(expense bulanan, 3 bulan)` |
| 2 | Savings Rate | ≥ 20% | 10-19% | < 10% | `(income − expense) ÷ income`, avg 3 bulan |
| 3 | DAR Konsumtif | < 20% | 20-40% | > 40% | `SUM(liabilities WHERE type ≠ 'kpr') ÷ aset finansial` |
| 4 | Asuransi Kesehatan | covered | — | tidak covered | inline checklist 1Q (kantor/BPJS/pribadi/kombinasi/tidak) |
| 5 | Goals on-track | ≥ 75% on-track | 50-74% | < 50% | % goals long-term yang progress sesuai timeline |
| 6 | Pensiun | ≥ 100% | 70-99% | < 70% | `proyeksi total ÷ target_bulanan × 12 × usia harapan` (smart fallback) |
| 7 | Rasio Investasi | ≥ 40% | 20-39% | < 20% | `(investments + deposito) ÷ aset finansial` |
| 8 | Diversifikasi | ≥ 3 | 2 | ≤ 1 | `COUNT(DISTINCT asset_type) + (1 if deposito > 0)` |

**Definisi yang konsisten:**
- **Akun likuid** = `net_worth_accounts WHERE type IN ('tabungan','giro','cash','dompet_digital')`
- **Aset finansial** = akun likuid + `net_worth_accounts WHERE type='deposito'` + `SUM(investments.current_price × quantity)`
- **Properti & kendaraan** dikecualikan dari semua perhitungan rasio (kategori use-asset, bukan financial)
- **Long-term goal** = `goals WHERE target_date > NOW() + 1 year AND status = 'active'`
- **Goal on-track** = `current_amount / target_amount ≥ time_elapsed / total_duration` (linear assumption)
- **DAR Total** = `SUM(all liabilities) ÷ aset finansial` — tampil sebagai info di Tier 1 panel, BUKAN indikator warna

### Tier panel behavior

Pas user klik tier di piramida, panel slide-down inline:

```
┌─ TIER 1 — PROTEKSI ──────────────────────────────────┐
│  Dana Darurat: 4.2 bulan        🟡                   │
│  Savings Rate: 18%              🟡                   │
│  DAR Konsumtif: 12%             🟢                   │
│  Asuransi Kesehatan             ✓ covered (kantor)   │
│                                                       │
│  ▸ Info: DAR Total kamu: 38% (mayoritas KPR)         │
│                                                       │
│  Aksi:                                                │
│  [ Kelola akun & utang → /kekayaan ]                  │
│  [ Catat transaksi → /transaksi ]                     │
│                                                       │
│  📖 Pelajari: Modul Pondasi & Cash Flow →            │
└──────────────────────────────────────────────────────┘
```

### CTA mapping

| Tier | Primary CTA | Secondary CTA | Link Modul |
|---|---|---|---|
| 1 | Kelola akun & utang → `/kekayaan` | Catat transaksi → `/transaksi` | `/kesehatan/arus-kas` |
| 2 | Kelola Goals → `/goals` | Simulasi pensiun → `/pensiun` | `/kesehatan/tujuan` |
| 3 | Kelola investasi → `/investasi` | — | `/kesehatan/alokasi-aset` + `/kesehatan/instrumen` |
| 4 | (inline form, no nav) | — | (no link, asimetri OK — defer modul Warisan ke v2) |

### Smart fallback (saat data belum tersedia)

**Indikator #5 Goals on-track:**
- Kalau user belum punya goal long-term aktif → tampil sebagai **CTA card**: *"Belum punya tujuan jangka panjang? Buat di sini →"* → `/goals`
- Kalau punya → tampil rasio + warna normal

**Indikator #6 Pensiun:**
- Kalau `pension_simulations` row tidak ada → tampil **CTA card**: *"Belum simulasi pensiun? Hitung di sini →"* → `/pensiun`
- Kalau ada → tampil angka + warna normal
- Tambahan: kalau `updated_at` > 6 bulan, tampil catatan kecil: *"Simulasi terakhir: X bulan lalu — pertimbangkan update di /pensiun"*. Warna tetap dari simulasi.

### Inline checklist Tier 1 (#4 Asuransi Kesehatan)

Single question rendered inline di tier panel:

> **Kesehatan kamu (& keluarga) tercover sekarang?**
> ◯ Dari kantor (BPJS/asuransi corporate)
> ◯ BPJS pribadi
> ◯ Asuransi pribadi
> ◯ Kombinasi
> ◯ Tidak covered

Hijau kalau bukan "tidak covered". Merah kalau "tidak covered". Disimpan di field `health_coverage` di tabel `protection_checklist`.

### Smart-gated checklist Tier 4

Gate question:
> **Punya tanggungan finansial (pasangan, anak, orang tua yang bergantung)?**
> ◯ Ya
> ◯ Tidak

**Kalau "Tidak"** — tampil 3 pertanyaan estate basic:
1. Sudah catat siapa ahli waris (nama, hubungan, kontak)?
2. Sudah catat semua aset penting (rekening, investasi, properti) yang ahli waris perlu tahu lokasinya?
3. Punya wasiat/testament resmi (notaris atau wakaf)?

**Kalau "Ya"** — tampil 3 estate + 3 asuransi jiwa:
1. Punya santunan/asuransi jiwa kalau kamu meninggal? (kantor / pribadi / keduanya / tidak)
2. Coverage cukup buat keluarga bertahan beberapa tahun? (rule of thumb: 5-10× annual income) (ya/tidak)
3. Coverage tetap ada kalau kamu pensiun/resign? (ya/tidak/tidak yakin)

**Threshold Tier 4:**
- Hijau: semua relevant questions "ya" (atau setara, mis. asuransi covered)
- Kuning: ada "ya tapi cuma kantor" / "tidak yakin" pada question transition risk
- Merah: ada "tidak" di asuransi atau estate basic

### Edge case: data tipis (#1 dan #2)

Indikator #1 dan #2 butuh **3 bulan kalender data** transactions. Definisi: ada expense entry di setidaknya 3 bulan kalender berbeda (bukan 90 hari).

Kalau data < 3 bulan kalender:
- Indikator slot tetap muncul di panel
- Tampil placeholder konsisten:
  > 📊 **Butuh 3 bulan data**
  > Sudah catat: 1 bulan dari 3.
  > [→ Buka /transaksi]
- Indikator placeholder tidak ikut agregasi warna tier (lihat aturan "Agregasi warna tier" di atas — tier abu-abu hanya kalau semua indikator di tier dalam keadaan placeholder/fallback)

### Empty state full (user baru banget)

Trigger: total `transactions + accounts + goals + investments` rows < 3.

Tampilan:
- Hero: piramida tampil **grayed-out** dengan label *"Yuk mulai isi data"*
- Single big CTA: **"Mulai dari mana?"** dengan quick-link ke:
  - Catat transaksi pertama → `/transaksi`
  - Tambah akun bank → `/kekayaan`
  - Bikin tujuan finansial → `/goals`
- Banner kalkulator + grid modul tetap accessible (modul bisa dibaca tanpa data)

### View-As compatibility

Pas `viewingAs !== null`:
- Semua indikator pakai data user yang di-view (via `useEffect` query dengan `viewingAs ?? userId`)
- **Inline form Tier 1 (#4) dan Tier 4 checklist switch ke read-only mode** — admin tidak boleh modify data user lain
- CTA navigasi tetap clickable; route tujuan inherit View-As state via existing context
- Konsisten dengan pattern `KekayaanTab` guard yang sudah ada (Phase 10 v1.1 commit `40bd3ec`)

## 5. Kalkulator Compound Interest

Sub-route `/kesehatan/kalkulator` — full page calculator.

### Input
- Saldo awal (slider Rp 0 — Rp 1M, default Rp 10jt)
- Setoran bulanan (slider Rp 0 — Rp 50jt, default Rp 1jt)
- Return tahunan % (slider 0-25%, default 8%)
- Tenor tahun (slider 1-40, default 10)

### Output
- Nilai akhir (big number)
- Total setoran (info)
- Total bunga compound (info)
- Grafik garis tahun-per-tahun (Recharts existing dependency)
- Tabel breakdown 5-tahun-an

### Discoverability
Banner di landing `/kesehatan` antara piramida & grid modul:

```
🧮 Hitung target investasimu dengan kalkulator compound interest
   [ Buka kalkulator → ]
```

## 6. 6 Modul Edukasi

### Layout

Sub-page modul punya layout sendiri:
- Header: breadcrumb `Kesehatan / <Modul>`
- Body: prose Fraunces serif (max-width 65ch)
- Section structure: theory → studi kasus → quick check (2-3 pertanyaan, **tidak disimpan, tidak di-tracked** di v1)
- Footer: link ke modul lain

### Konten

Port langsung dari `financial_framework.html` dengan light editing:
- Replace contoh hardcoded dengan placeholder yang lebih generic
- Fix istilah teknis: pakai `<GlossaryTooltip>` untuk 8 istilah glossary

### Glossary tooltip (8 istilah)

Asset Allocation, Real Return, Sharpe Ratio, DCA, Drawdown, Expense Ratio, Rebalancing, Risk Tolerance.

Implementation: `<GlossaryTooltip term="DCA">DCA</GlossaryTooltip>` rendering Radix Tooltip (existing dependency) dengan definisi singkat (1-2 kalimat).

## 7. Schema Changes

### Tabel baru: `protection_checklist`

```sql
CREATE TABLE protection_checklist (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tier 1: Asuransi Kesehatan (#4)
  health_coverage TEXT CHECK (health_coverage IN
    ('kantor','bpjs','pribadi','kombinasi','tidak')),

  -- Tier 4: Gate
  has_dependents BOOLEAN,

  -- Tier 4: Asuransi Jiwa (kalau has_dependents = true)
  life_coverage TEXT CHECK (life_coverage IN
    ('kantor','pribadi','keduanya','tidak')),
  life_coverage_sufficient BOOLEAN,
  life_coverage_post_employment TEXT CHECK (life_coverage_post_employment IN
    ('ya','tidak','tidak_yakin')),

  -- Tier 4: Estate (universal, juga kalau has_dependents = false)
  estate_heirs_documented BOOLEAN,
  estate_assets_documented BOOLEAN,
  estate_will_exists BOOLEAN,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE protection_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own protection checklist"
  ON protection_checklist FOR ALL
  USING      (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);
```

Default behavior: row dibuat lazy di first interaction. Empty state (no row) = semua field null = tier 1 #4 dan tier 4 semua tampil unanswered (merah).

**Tidak ada schema change lain.** Semua indikator data-driven pakai tabel existing.

## 8. Visual Design

### Typography

- **Landing, tier panel, dashboard data, kalkulator UI**: Inter sans-serif (existing pfm-web)
- **Modul prose & glossary tooltip**: Fraunces serif (preserve gaya `financial_framework.html`)
- Implementation: load Fraunces dari Google Fonts hanya di route `/kesehatan/<modul>` (route-level font loading, lazy)

### Warna

- Hijau: `green-500` / `green-100` background
- Kuning: `amber-500` / `amber-100` background
- Merah: `red-500` / `red-100` background
- Abu-abu (placeholder): `gray-300` / `gray-100` background
- Tier outline: border 2px sesuai warna tier dominan
- Konsisten dengan badge "deadline" di RencanaBar (commit `6cdd788`)

### Piramida visual

- SVG-based pyramid dengan 4 trapezoidal tier
- Hover state: tier sedikit terangkat + cursor pointer
- Click: expand panel inline di bawah piramida
- Mobile: piramida tetap full-width, panel jadi accordion

## 9. Out of Scope (defer ke v2)

- **Modul "Warisan & Estate Planning"** — Tier 4 cuma checklist tanpa link modul (asimetri acceptable)
- **IPS Builder** — Investment Policy Statement, feature gede sendiri
- **Quiz tracking** — modul punya quick-check, tapi tidak disimpan score di v1
- **Kalkulator suite tambahan** — real return, expense drag, retirement gap (cuma compound di v1)
- **Risk tolerance quiz**
- **Behavior gap detector**
- **Tier 4 jadi diagnostic data-driven** — saat ini cuma checklist self-assessment
- **Asset class normalization** — v1 trust user input untuk `investments.asset_type`; potential issue: user ketik "Saham A" + "Saham B" jadi 2 class palsu di hitungan diversifikasi
- **Tier panel "shareable snapshot" / export PDF**
- **Tier 4 dengan gate question stored persistently** — saat ini hanya boolean field; v2 mungkin perlu separate "scope" untuk mencatat alasan / context

## 10. Open Questions / Risks

### Risk 1 — Threshold tidak tervalidasi empiris

Threshold semua indikator pakai rule-of-thumb umum, belum divalidasi terhadap demografi user pfm-web Indonesia. Mitigasi: terima feedback pasca-rilis, adjust threshold lewat config (bukan hard-coded di komponen — pakai konstanta di `src/queries/kesehatan.ts` yang gampang di-tune).

### Risk 2 — User Pertamina vs target umum

App pfm-web multi-user dengan email allowlist (`kantongpintar.vercel.app`), bukan internal Pertamina. Konten copy harus generic (tidak hard-code "BUMN" atau "Pertamina"). Yang sudah BUMN-flavored: `pension_simulations` (DPPK/DPLK/Taspen) — tetap dipakai karena segmen target plausibly skewed ke karyawan formal yang punya akses skema pensiun ini.

### Risk 3 — DAR threshold konsumtif belum kalibrasi

Threshold < 20% hijau untuk DAR Konsumtif itu konservatif. Bisa jadi terlalu ketat — user dengan kartu kredit aktif normal (utilization 30%) bisa kena merah. Monitor pasca-rilis.

### Risk 4 — Pension simulation BUMN-spesifik

`pension_simulations.ht_*` fields specific ke skema BUMN (DPPK, DPLK, Taspen). User non-BUMN (UMKM owner, freelancer, dll) hasil simulasinya kurang akurat. Indikator #6 tidak gate by user type — semua user yang isi simulasi dapat hasil. Acceptable: indikator self-assessed via input user.

### Risk 5 — `investments.asset_type` TEXT bebas

Diversifikasi pakai DISTINCT count `asset_type`, tapi field-nya TEXT bebas. User bisa "game" dengan ketik beda-beda untuk 1 saham (mis. "BBCA" vs "Saham BCA"). Untuk v1 trust user; kalau jadi masalah real → v2 normalize ke 5 standar (Saham/Reksadana/Emas/Kripto/Obligasi) dengan migration.

### Open Question — Modul content authoring

File source HTML 1515 baris itu udah lengkap untuk 6 modul, tapi belum diadaptasi untuk gaya pfm-web (saat ini contoh-contohnya generic, bukan referensi user data). Plan phase nanti perlu putuskan: port apa adanya (cepat) atau adaptasi konten (lebih bermakna, lebih mahal). Default rekomendasi: **port apa adanya untuk v1**, adaptasi inkremental v2.

---

## Lampiran — Mapping konten file source ke modul React

| File source section | Modul React | Slug |
|---|---|---|
| §02 Modul 01 Pondasi & Cash Flow | `ArusKasModul.tsx` | `/kesehatan/arus-kas` |
| §02 Modul 02 Tujuan/Time Horizon/Risiko | `TujuanModul.tsx` | `/kesehatan/tujuan` |
| §02 Modul 03 Asset Allocation & Diversifikasi | `AlokasiAsetModul.tsx` | `/kesehatan/alokasi-aset` |
| §02 Modul 04 Instrumen Indonesia & Global | `InstrumenModul.tsx` | `/kesehatan/instrumen` |
| §02 Modul 05 Pajak/Biaya/Inflasi | `PajakBiayaInflasiModul.tsx` | `/kesehatan/pajak-biaya-inflasi` |
| §02 Modul 06 Behavioral Finance & Disiplin | `PerilakuModul.tsx` | `/kesehatan/perilaku` |
| §03 Tools (kalkulator) | `KalkulatorCompound.tsx` | `/kesehatan/kalkulator` |
| §04 Glossary 8 istilah | `GlossaryTooltip.tsx` (inline tooltip) | (no route) |
| §01 Pyramid (visual+narasi) | `PiramidaSehatan.tsx` (data-driven) | `/kesehatan` (landing hero) |
