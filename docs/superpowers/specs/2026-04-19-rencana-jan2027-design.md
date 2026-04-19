# Design Spec: pfm-web × Rencana Keuangan Jan 2027

**Date:** 2026-04-19
**Status:** Approved
**Goal:** Integrasikan data dari `rencana-keuangan-v2.html` ke pfm-web — tracking harian + visibility rencana keuangan Jan 2027 dalam satu app.

---

## Context

File `rencana-keuangan-v2.html` adalah master blueprint keuangan menuju pernikahan adat Jawa Mataraman + pembelian Xpander (Jan 2027). Target total: **Rp 257.000.000**. Aset awal April 2026: **Rp 120.965.180**.

pfm-web sudah punya infrastruktur lengkap (Goals, Investasi, Transaksi, Dashboard). Yang kurang: data dari blueprint belum masuk ke app, dan tidak ada visibility progress menuju Rp 257M.

---

## Keputusan Desain

| Dimensi | Keputusan |
|---------|-----------|
| Struktur navigasi | Tidak tambah tab baru — upgrade tabs yang ada |
| Fitur | Dashboard banner + Goals seed + Kategori + Investasi seed |
| Data banner | Dinamis dari Supabase (real-time) |
| Implementasi seed | Hybrid: SQL migration untuk kategori, hook seed untuk goals + investasi |
| Kalkulasi progress | `inv.totalNilai / Rp 257M` |

---

## Arsitektur

```
src/
├── tabs/DashboardTab.tsx          ← tambah <RencanaBar> + useRencanaInit()
├── components/RencanaBar.tsx      ← komponen baru (compact progress banner)
├── lib/useRencanaInit.ts          ← hook seed (localStorage flag, jalankan sekali)
├── db/goals.ts                    ← tambah seedRencanaGoals()
├── db/investments.ts              ← tambah seedRencanaInvestments()
└── supabase/migrations/
    └── 0004_kategori_pertamina.sql
```

---

## 1. Dashboard — RencanaBar Component

**Posisi:** Di antara metric cards dan panel Transaksi/Goals (compact inline).

**File:** `src/components/RencanaBar.tsx`

**Data (semua dari props, dihitung di DashboardTab):**
- `totalNilai` — dari `inv.totalNilai` (sudah dihitung di DashboardTab)
- `target` — konstanta `257_000_000`
- `bulanLagi` — hitung dari `new Date()` ke `2027-01-01`

**Logic:**
```ts
const TARGET_RENCANA = 257_000_000
const progress = Math.min(100, (inv.totalNilai / TARGET_RENCANA) * 100)
const gap = TARGET_RENCANA - inv.totalNilai

// Hitung bulan tersisa ke Jan 2027 tanpa date-fns
const deadline = new Date('2027-01-01')
const now = new Date()
const bulanLagi = (deadline.getFullYear() - now.getFullYear()) * 12
  + (deadline.getMonth() - now.getMonth())
```

**Tampilan (compact inline, style shadcn/tailwind):**
- Background: biru muted (`bg-blue-50 border border-blue-200`)
- Kiri: badge biru dengan persentase + "Jan 2027"
- Tengah: teks `Rp X / Rp 257 Jt · N bulan lagi` + progress bar
- Kanan: label "Gap" + nilai gap (merah jika > 0)
- Tidak tampil jika `inv.totalNilai === 0` dan belum ada data (hindari 0% yang misleading)

**Integrasi ke DashboardTab:**
```tsx
// Setelah metric cards grid, sebelum panel grid:
{inv.totalNilai > 0 && (
  <RencanaBar totalNilai={inv.totalNilai} />
)}
```

---

## 2. SQL Migration — Kategori Income Pertamina

**File:** `supabase/migrations/0004_kategori_pertamina.sql`

**5 kategori baru (type: income):**

```sql
INSERT INTO categories (name, type, icon) VALUES
  ('THR Keagamaan',          'income', '💰'),
  ('IKI (Insentif Kinerja)', 'income', '📈'),
  ('Jaspro / Tantiem',       'income', '🏭'),
  ('Gaji ke-13',             'income', '💵'),
  ('Tunjangan Cuti',         'income', '🏖️')
ON CONFLICT (name) DO NOTHING;
```

Idempotent — aman dijalankan ulang.

---

## 3. Seed Hook — `useRencanaInit`

**File:** `src/lib/useRencanaInit.ts`

**Logic:**
1. Cek `localStorage.getItem('rencana_seeded')`
2. Jika belum: jalankan `seedRencanaGoals()` + `seedRencanaInvestments()`
3. Set `localStorage.setItem('rencana_seeded', '1')`
4. Hook dipanggil dari `DashboardTab` — hanya saat tab Dashboard dibuka

```ts
export function useRencanaInit(queryClient: QueryClient) {
  useEffect(() => {
    if (localStorage.getItem('rencana_seeded')) return
    Promise.all([seedRencanaGoals(), seedRencanaInvestments()])
      .then(() => {
        localStorage.setItem('rencana_seeded', '1')
        // Invalidate agar UI langsung refresh setelah seed
        queryClient.invalidateQueries({ queryKey: ['goals'] })
        queryClient.invalidateQueries({ queryKey: ['investments'] })
      })
      .catch(console.error)
  }, [])
}
```

---

## 4. Seed Function — Goals

**File:** `src/db/goals.ts` — tambah `seedRencanaGoals()`

**5 goals yang di-seed (cek by name, skip jika sudah ada):**

| Nama | Target | Deadline | Status |
|------|--------|----------|--------|
| Dana Pernikahan | Rp 100.000.000 | 2027-01-01 | active |
| DP + Akad Kredit Xpander | Rp 118.000.000 | 2027-01-01 | active |
| Non-Budget Nikah | Rp 10.000.000 | 2027-01-01 | active |
| Dana Darurat | Rp 24.000.000 | 2026-12-01 | active |
| Buffer Cadangan | Rp 5.000.000 | 2027-01-01 | active |

`current_amount` semua dimulai dari `0` — user update manual via "Tambah Dana" di Goals tab.

**Implementasi (idempotent):**
```ts
export async function seedRencanaGoals(): Promise<void> {
  const existing = await listGoals()
  const existingNames = new Set(existing.map(g => g.name))
  const toInsert = RENCANA_GOALS.filter(g => !existingNames.has(g.name))
  for (const g of toInsert) await createGoal(g)
}
```

---

## 5. Seed Function — Investasi

**File:** `src/db/investments.ts` — tambah `seedRencanaInvestments()`

**3 investasi yang di-seed (cek by asset_name, skip jika sudah ada):**

| Nama | Tipe | Qty | Buy Price | Current Price | Buy Date |
|------|------|-----|-----------|---------------|----------|
| Reksadana Sukuk Sucorinvest Sharia | Reksadana | 1 | 100.000.000 | 100.000.000 | 2026-04-01 |
| Emas Tabungan Pegadaian | Emas | 5.5278 | 2.683.000 | 2.683.000 | 2026-04-01 |
| Saham BMRI | Saham | 1 | 6.129.180 | 6.129.180 | 2026-04-01 |

> Reksadana disimpan sebagai qty=1, buy_price=100.000.000 (nilai total). Emas: qty=gram, buy_price=harga/gram.

---

## Data Flow

```
DashboardTab
  ├── useRencanaInit()          → seed goals + investasi (sekali, via localStorage)
  ├── useInvestments()          → inv.totalNilai untuk RencanaBar
  ├── useGoals()                → activeGoals untuk panel Goals Aktif
  └── <RencanaBar totalNilai={inv.totalNilai} />
        └── progress = totalNilai / 257_000_000
```

---

## Error Handling

- Seed failure: log ke console, tidak throw — app tetap jalan normal
- RencanaBar tidak tampil jika `totalNilai === 0` (data belum ada)
- Migration conflict: `ON CONFLICT DO NOTHING` — aman

---

## Testing / Verifikasi

1. Jalankan migration `0004` via Supabase dashboard atau CLI
2. Buka app → Dashboard → pastikan RencanaBar muncul dengan progress ~47%
3. Buka tab Transaksi → catat income → pastikan 5 kategori Pertamina tersedia
4. Buka tab Goals → pastikan 5 goals muncul dengan `current_amount = 0`
5. Buka tab Investasi → pastikan 3 instrumen muncul dengan nilai total ~Rp 120,9M
6. Refresh app → pastikan seed tidak jalan dua kali (cek via Goals tab, tidak ada duplikat)
