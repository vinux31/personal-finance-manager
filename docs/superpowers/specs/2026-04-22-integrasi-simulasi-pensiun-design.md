# Design Spec: Integrasi Simulasi Pensiun ke PFM-Web

**Tanggal:** 2026-04-22  
**Status:** Approved by user  
**Author:** Brainstorming session

---

## Konteks & Tujuan

File `simulasi-pensiun (1).html` adalah kalkulator pensiun standalone (vanilla JS + Chart.js, ~46KB) yang belum terintegrasi ke app utama pfm-web. File ini berisi 5 tab: Simulasi Investasi, Sumber Dana Pensiun, Hitung Total Pensiun, Perbandingan Instrumen, dan Analisis & Strategi.

Tujuan: mengintegrasikan seluruh konten ke dalam app React pfm-web sebagai tab baru "Pensiun" yang mengikuti design system app (Tailwind/shadcn, Recharts, Supabase), dengan gold accent khusus dan layout step-by-step wizard yang nyaman dibaca.

---

## Keputusan Desain

| Aspek | Keputusan | Alasan |
|-------|-----------|--------|
| Navigasi | 1 tab "Pensiun" di main nav + 3 sub-tab | App sudah 7 tab — tambah 1 saja, sub-tab merge konten yang mirip |
| Sub-tab | Simulasi Investasi · Hitung Total · Panduan | 5 tab → 3: Tab 1 + Tab 4 digabung jadi Panduan |
| Data | Supabase `pension_simulations`, 1 row/user, auto-save debounce 1.5s | Persist antar session, tidak perlu tombol simpan |
| Style | Hybrid: Tailwind/shadcn + gold accent | Konsisten dengan app + nuansa premium pensiun |
| Tema default | Light mode | User preference; dark tetap support via toggle Pengaturan |
| Integrasi data | Semua input manual, disimpan di `pension_simulations` | `profiles` table tidak ada field usia; tidak perlu ubah schema yang ada |
| Charts | Recharts | Sudah ada di app, tidak tambah dependency |
| Layout | Step-by-step Wizard (SimulasiPanel: 3 step, HitungTotalPanel: 2 step) | Solusi cramping — setiap step penuh layar, data lega |
| Arsitektur | Modular: PensiunTab shell + 3 panel + pensiun-calc.ts | Ikuti pola app, separation of concerns, testable |

---

## Arsitektur & File Structure

### File Baru

```
src/
├── tabs/
│   ├── PensiunTab.tsx                    ← shell: profil strip, sub-tab nav, route ke panel
│   └── pensiun/
│       ├── SimulasiPanel.tsx             ← DCA calculator, 3-step wizard
│       ├── HitungTotalPanel.tsx          ← 6 sumber kalkulasi, 2-step wizard
│       └── PanduanPanel.tsx             ← edukasi + strategi, single scroll page
├── lib/
│   └── pensiun-calc.ts                  ← pure functions: calcDCA, calcBPJS, calcDPPK, calcTaspen, calcPesangon
├── db/
│   └── pensiun.ts                       ← getPensionSim, upsertPensionSim
└── queries/
    └── pensiun.ts                       ← usePensionSim, useUpsertPensionSim (React Query)

supabase/migrations/
└── 0008_pension_simulations.sql         ← tabel baru + RLS
```

### File Dimodifikasi

```
src/App.tsx          ← tambah entry di TABS array: { value: 'pensiun', label: 'Pensiun', icon: PiggyBank, Comp: PensiunTab }
src/index.css        ← tambah CSS variable: --gold: #d97706 (light), --gold-bg: #fef9ee, --gold-border: #fde68a
```

---

## Supabase Schema

### Migration: `0008_pension_simulations.sql`

```sql
create table pension_simulations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  updated_at  timestamptz not null default now(),

  -- Profil Dasar (shared semua panel)
  usia            int not null default 30,       -- input manual; profiles table tidak punya field usia
  usia_pensiun    int not null default 56,
  gaji_pokok      bigint not null default 0,
  masa_kerja      int not null default 0,
  target_bulanan  bigint not null default 10000000,

  -- Panel Simulasi Investasi
  sim_investasi_bulanan   bigint not null default 500000,
  sim_kenaikan_pct        numeric(5,2) not null default 5,
  sim_inflasi_pct         numeric(5,2) not null default 4,
  sim_target_spend        bigint not null default 10000000,
  sim_alokasi_emas        int not null default 40,
  sim_alokasi_saham       int not null default 30,
  sim_alokasi_rd          int not null default 30,
  sim_rd_type             text not null default 'cp',  -- pu|pt|cp|sh

  -- Panel Hitung Total: enable flags
  ht_en_bpjs      boolean not null default true,
  ht_en_dppk      boolean not null default false,
  ht_en_dplk      boolean not null default false,
  ht_en_taspen    boolean not null default false,
  ht_en_pesangon  boolean not null default true,
  ht_en_invest    boolean not null default true,

  -- BPJS
  ht_bpjs_upah    bigint not null default 0,

  -- DPPK
  ht_dppk_type    text not null default 'ppmp',  -- ppmp|ppip
  ht_dppk_phdp    bigint not null default 0,
  ht_dppk_faktor  numeric(5,2) not null default 2.5,
  ht_dppk_iuran   bigint not null default 0,

  -- DPLK
  ht_dplk_iuran   bigint not null default 0,
  ht_dplk_return  numeric(5,2) not null default 7,
  ht_dplk_saldo   bigint not null default 0,

  -- Taspen
  ht_taspen_gaji  bigint not null default 0,
  ht_taspen_gol   text not null default 'IIIa',

  -- Investasi Mandiri (Hitung Total)
  ht_inv_bulanan  bigint not null default 500000,
  ht_inv_return   numeric(5,2) not null default 10,
  ht_inv_saldo    bigint not null default 0,
  ht_inv_kenaikan numeric(5,2) not null default 5,

  unique(user_id)
);

-- RLS
alter table pension_simulations enable row level security;

create policy "Users manage own pension sim"
  on pension_simulations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

## Komponen: PensiunTab.tsx (Shell)

**Tanggung jawab:**
- Load data dari Supabase (`usePensionSim`)
- Render profil strip: semua field input manual, disimpan di `pension_simulations`
- Manage sub-tab state (Simulasi / Hitung Total / Panduan)
- Pass shared state ke panel sebagai props
- Auto-save ke Supabase via debounce 1.5s setiap kali form berubah

**Profil strip fields** (always visible, di atas sub-tab nav):
- Usia: input manual (default 30), disimpan di `pension_simulations.usia`
- Usia pensiun: input manual (default 56)
- Gaji pokok: Rupiah, controlled input
- Masa kerja: tahun, number input
- Target pengeluaran/bulan: Rupiah
- Status indicator: "✓ Tersimpan" / "Menyimpan..."

---

## Komponen: SimulasiPanel.tsx

**Wizard 3 step:**

### Step 1 — Parameter Investasi
Form fields (full width, 4-column grid):
- Investasi per bulan (Rupiah)
- Kenaikan investasi per tahun (%)
- Asumsi inflasi (%)
- Target pengeluaran saat pensiun/bulan (Rupiah, pre-filled dari shared)

### Step 2 — Alokasi Aset
- 3 slider: Emas, Saham BMRI, Reksadana (normalisasi otomatis ke 100%)
- Bar alokasi berwarna (gold / blue / green)
- Select tipe Reksadana: Pasar Uang (5%), Pendapatan Tetap (7%), Campuran (10%), Saham (14%)

### Step 3 — Hasil Simulasi
Layout:
- **Hero metric** (full width, background amber-50): Total Dana Terkumpul (font besar)
- Gap pill: "✓ Dana cukup X tahun" (green) atau "⚠ Kurang Y tahun" (red)
- **4 metric boxes**: Total Dana · Modal · Keuntungan · Dana Cukup Untuk
- **AreaChart** (Recharts, 3/5 width): Proyeksi pertumbuhan per tahun, 3 area (emas/saham/rd)
- **Breakdown legend** (2/5 width): per aset dengan persentase + nilai
- Navigasi: ← Ubah Alokasi | Lanjut ke Hitung Total →

**Kalkulasi** (di `pensiun-calc.ts`):
```ts
function calcDCA(params: SimulasiParams): SimulasiResult
// DCA bulanan dengan kenaikan tahunan, compound per bulan
// Return: { totalDana, totalModal, keuntungan, perAset, yearlyData }
```

---

## Komponen: HitungTotalPanel.tsx

**Wizard 2 step** (dikurangi dari 3 — step Review dihapus, redundan):

### Step 1 — Pilih Sumber & Input Parameter
6 checkbox expandable (accordion, semua input langsung di sini):
- ✅ BPJS JHT + JP → input: upah BPJS/bulan (masa_kerja dari shared profil)
- ☐ DPPK → input: tipe (PPMP/PPIP), PhDP, faktor, iuran
- ☐ DPLK → input: iuran, return, saldo awal
- ☐ Taspen → input: gaji terakhir, golongan
- ✅ Pesangon → otomatis dari gaji_pokok + masa_kerja shared (tidak ada input tambahan)
- ✅ Investasi Mandiri → input: investasi/bln, return, saldo awal, kenaikan/thn
- Tombol "🧮 Hitung Total Pensiun" di bawah semua sumber

### Step 2 — Hasil Total
Layout:
- **Grand total hero**: estimasi total seluruh sumber (angka besar, background amber-50)
- **2 metric boxes**: Estimasi/bulan · Target/bulan
- **Gap analysis pill**: Surplus (green) / Defisit (red) dengan rekomendasi teks
- **Horizontal bar per sumber** (nama · progress bar · nilai)
- **BarChart** (Recharts): estimasi bulanan vs target per sumber
- Navigasi: ← Ubah Sumber | Lihat Panduan →

**Fungsi kalkulasi** (di `pensiun-calc.ts`):
```ts
function calcBPJS(params): { jht: number; jpBulanan: number }
function calcDPPK(params): { total: number }
function calcDPLK(params): { total: number }
function calcTaspen(params): { bulanan: number; tht: number }
function calcPesangon(gaji: number, masaKerja: number): { total: number }
function calcInvestasiMandiri(params): { total: number }
```

---

## Komponen: PanduanPanel.tsx

Single scroll page (tidak ada wizard), full width. Sections:

1. **6 Sumber Dana Pensiun** — 6 card grid (icon, nama, badge wajib/sukarela/dll, deskripsi + formula singkat)
2. **Strategi Alokasi per Usia** — tabel: Usia | Emas | Saham | Reksadana | Obligasi | Profil Risiko
3. **Perbandingan 8 Instrumen** — tabel: Instrumen | Return/thn | Risiko | 10thn | 20thn | 30thn (Rp 500k/bln)
4. **Tips & Kesalahan Umum** — 2 kolom: ✓ Yang Harus Dilakukan | ✗ Kesalahan Umum

Data di panel ini **static** (tidak ada perhitungan, tidak ada Supabase call).

---

## UX Flow & Auto-Save

```
Mount PensiunTab
  └─ usePensionSim() → load from Supabase
  └─ if null → insert default row (semua default values)
  └─ populate semua form dengan saved values

User ubah input (profil strip atau panel)
  └─ setState local
  └─ debounce 1.5s
  └─ useUpsertPensionSim() → upsert ke Supabase
  └─ show "✓ Tersimpan"

Semua field (termasuk usia) disimpan di pension_simulations.
Tidak ada dependency ke tabel lain — fully self-contained.
```

---

## Gold Accent — CSS Variables

Tambahkan di `src/index.css`:

```css
/* Light mode */
:root {
  --gold: #d97706;         /* amber-600 — gold di light mode */
  --gold-light: #f59e0b;   /* amber-400 */
  --gold-bg: #fef9ee;      /* latar hero, card highlight */
  --gold-border: #fde68a;  /* border card pensiun */
  --gold-text: #92400e;    /* amber-800, teks di atas gold-bg */
}

/* Dark mode */
.dark {
  --gold: #d4a437;         /* gold original dari HTML */
  --gold-light: #e6bb4a;
  --gold-bg: rgba(212,164,55,0.08);
  --gold-border: rgba(212,164,55,0.25);
  --gold-text: #fbbf24;
}
```

Dipakai di: border-top card, step active color, hero background, tombol Hitung, slider fill.

---

## Rencana Verifikasi

Sebelum dianggap selesai, verifikasi end-to-end:

1. **Supabase**: migration berhasil, row terbuat saat user pertama buka tab Pensiun, upsert berjalan tanpa error RLS
2. **Auto-save**: ubah input → 1.5s → "✓ Tersimpan" muncul → refresh → data tetap ada
3. **Simulasi Investasi**: hitung DCA dengan nilai berbeda, bandingkan output dengan file HTML asli untuk memastikan kalkulasi sama
4. **Hitung Total**: aktifkan semua 6 sumber, verifikasi total = sum per sumber
5. **Panduan**: semua section render, tabel responsive di berbagai lebar layar
6. **Tema**: toggle dark/light di Pengaturan → tab Pensiun ikut berubah, gold accent tetap kontras di kedua mode
7. **Usia persisted**: isi usia → refresh → usia tetap ada (bukan dari auth, dari pension_simulations)
8. **Light mode default**: buka app fresh (clear localStorage) → tab Pensiun tampil light
