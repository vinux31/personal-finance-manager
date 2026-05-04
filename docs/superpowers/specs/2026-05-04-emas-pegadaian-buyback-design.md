# Emas Pegadaian Buyback — Design Spec

**Tanggal:** 2026-05-04
**Status:** Draft
**Milestone:** v1.2 (kandidat)

## Konteks & Masalah

Saat user klik "Refresh Harga" untuk row `asset_type='Emas'`, edge function `fetch-prices` ambil harga emas spot dunia dari metals.dev × kurs USD/IDR. Itu **bukan harga Pegadaian buyback** yang relevan untuk pemegang Tabungan Emas Pegadaian.

**Bukti konkret (4 Mei 2026):**
- Edge function output: Rp 2.546.238/g (spot dunia)
- Buyback Pegadaian aktual: Rp 2.592.000/g
- Selisih: Rp 45.762/g × 5,5278 g = **Rp 253.000 keliru** untuk 1 row user
- Akibatnya: G/L row tampil **−5,10%** padahal di app Pegadaian Digital/Tring tampil **+15,17%**

**Akar penyebab:**
1. `fetchEmasPrice()` di `supabase/functions/fetch-prices/index.ts:155` hardcoded ke metals.dev
2. Edge function loop emas (line 107-118) treat semua row `asset_type='Emas'` sama — tidak ada disambiguasi source
3. Database tidak menyimpan informasi sumber harga per row

## Scope

**In scope (milestone ini):**
- Tambah dropdown "Sumber Harga" untuk asset_type='Emas' dengan 3 pilihan: `pegadaian`, `spot`, `manual`
- Implementasi scrape Pegadaian buyback untuk source `pegadaian`
- Pertahankan logic existing (metals.dev) untuk source `spot`
- Skip auto-fetch untuk source `manual`
- Migration backfill row emas existing yang asset_name mengandung "Pegadaian" → `'pegadaian'`, sisanya → `'manual'`
- Update CSV import/export untuk include kolom `gold_source`
- Update seed function `seed_rencana()` agar signup user baru tidak patah CHECK constraint

**Out of scope (deferred ke milestone berikutnya):**
- Source Antam (LM fisik) — perlu source kedua (logammulia.com), tunggu user nyata yang punya LM
- Source UBS, Galeri24
- Auto-refresh otomatis saat buka tab Investasi (manual saja sesuai pilihan user)
- Per-row override harga vs source default

## Keputusan Design

| # | Topik | Pilihan | Alasan |
|---|---|---|---|
| 1 | Scope source | Pegadaian saja (+ spot fallback) | Kasus user konkret, scope kecil = ship cepat |
| 2 | Harga `H.Kini` | Buyback (jual) | Akuntansi konservatif, match app sumber, jujur untuk net worth |
| 3 | Cara ambil harga | Scrape `sahabat.pegadaian.co.id/harga-emas` | Sumber resmi, gratis, structure stabil |
| 4 | Identify source | Dropdown eksplisit `gold_source` | Reliable (tidak tergantung typo nama), future-proof |
| 5 | Refresh trigger | Manual via tombol existing | Hemat traffic scrape, user kontrol |

## Arsitektur

```
┌─────────────────────┐
│  Frontend (React)   │
│  Tab Investasi      │
│   - Form Edit       │
│     [Sumber Harga ▾]│ (kondisional kalau Jenis=Emas)
│   - Refresh Harga   │
└──────────┬──────────┘
           │ klik Refresh
           ↓
┌─────────────────────┐
│  Supabase Edge Fn   │
│  fetch-prices       │
│                     │
│  Routing per row:   │
│   gold_source='pegadaian' → fetchPegadaianBuyback() ─┐
│   gold_source='spot'      → fetchEmasPrice() (existing)
│   gold_source='manual'    → skip                     │
│   asset_type='Saham'      → fetchSahamPrice() (existing)
└──────────┬──────────┘                                │
           ↓                                           │
   ┌────────────────────────────────┐                  │
   │ sahabat.pegadaian.co.id/harga-emas │ ←────────────┘
   │ scrape buyback Tabungan Emas        │
   └────────────────────────────────────┘
```

## Komponen yang Berubah

### 1. Migration `supabase/migrations/0027_investments_gold_source.sql`

```sql
-- Kolom baru
ALTER TABLE investments ADD COLUMN gold_source TEXT;

-- Backfill dulu, baru CHECK
UPDATE investments
  SET gold_source = 'pegadaian'
  WHERE asset_type = 'Emas' AND asset_name ILIKE '%pegadaian%';

UPDATE investments
  SET gold_source = 'manual'
  WHERE asset_type = 'Emas' AND gold_source IS NULL;

-- CHECK constraint loose: untuk non-emas bebas (NULL atau leftover),
-- untuk emas WAJIB salah satu dari 3 value valid.
-- Trade-off: app-level validation harus pastikan dropdown terisi
-- saat asset_type='Emas' supaya error tidak bocor ke DB.
ALTER TABLE investments ADD CONSTRAINT gold_source_valid_for_emas CHECK (
  asset_type <> 'Emas' OR gold_source IN ('pegadaian', 'spot', 'manual')
);

-- Update seed function supaya signup user baru tidak patah CHECK
CREATE OR REPLACE FUNCTION seed_rencana(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := p_user_id;
BEGIN
  -- (idempotency check & body sama seperti 0022, hanya INSERT investments yang berubah)
  IF EXISTS (SELECT 1 FROM user_seed_markers WHERE user_id = v_uid) THEN
    RETURN false;
  END IF;

  INSERT INTO goals (user_id, name, target_amount, current_amount, target_date, status) VALUES
    (v_uid, 'Dana Pernikahan',          100000000, 0, DATE '2027-01-01', 'active'),
    (v_uid, 'DP + Akad Kredit Xpander', 118000000, 0, DATE '2027-01-01', 'active'),
    (v_uid, 'Non-Budget Nikah',          10000000, 0, DATE '2027-01-01', 'active'),
    (v_uid, 'Dana Darurat',              24000000, 0, DATE '2026-12-01', 'active'),
    (v_uid, 'Buffer Cadangan',            5000000, 0, DATE '2027-01-01', 'active');

  INSERT INTO investments (user_id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note, gold_source) VALUES
    (v_uid, 'Reksadana', 'Reksadana Sukuk Sucorinvest Sharia', 1,      100000000, 100000000, DATE '2026-04-01', 'Seeded dari rencana-keuangan-v2.html', NULL),
    (v_uid, 'Emas',      'Emas Tabungan Pegadaian',             5.5278,   2683000,   2683000, DATE '2026-04-01', 'Seeded dari rencana-keuangan-v2.html', 'pegadaian'),
    (v_uid, 'Saham',     'Saham BMRI',                          1200,     5107.65,      4620, DATE '2026-04-01', 'Seeded dari rencana-keuangan-v2.html', NULL);

  INSERT INTO user_seed_markers (user_id) VALUES (v_uid);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION seed_rencana(UUID) TO authenticated;
```

### 2. `src/db/investments.ts`

```ts
export type GoldSource = 'pegadaian' | 'spot' | 'manual'

export interface Investment {
  id: number
  asset_type: string
  asset_name: string
  quantity: number
  buy_price: number
  current_price: number | null
  buy_date: string
  note: string | null
  gold_source: GoldSource | null
}

export interface InvestmentInput {
  asset_type: string
  asset_name: string
  quantity: number
  buy_price: number
  current_price: number | null
  buy_date: string
  note: string | null
  gold_source: GoldSource | null
}
```

- `listInvestments()`, `getInvestment()`: tambah `'gold_source'` ke SELECT statement
- `createInvestment()`, `updateInvestment()`: tambah `gold_source: i.gold_source` ke INSERT/UPDATE payload
- `fetchPrices()` filter: skip emas dengan `gold_source === 'manual'`:
  ```ts
  const toFetch = investments.filter((i) =>
    i.asset_type === 'Saham' ||
    (i.asset_type === 'Emas' && i.gold_source !== 'manual')
  )
  ```
  Update signature `Pick<Investment, 'id' | 'asset_type' | 'asset_name' | 'gold_source'>`

### 3. `src/queries/investments.ts`

Re-export type `GoldSource`:
```ts
import { ..., type GoldSource } from '@/db/investments'
export { ..., type GoldSource }
```

`useRefreshPrices()` (line 110) sudah terima `Investment[]` full object — auto-include `gold_source` setelah type update.

### 4. `src/components/InvestmentDialog.tsx`

- State baru: `const [goldSourceSel, setGoldSourceSel] = useState<GoldSource>('pegadaian')`
- `useEffect` initialize: `setGoldSourceSel(editing?.gold_source ?? 'pegadaian')`
- Field conditional render setelah "Nama Aset", sebelum "Kuantitas":
  ```tsx
  {(assetTypeSel === 'Emas' || (assetTypeSel === CUSTOM && customType.trim() === 'Emas')) && (
    <div className="grid gap-2">
      <Label>Sumber Harga</Label>
      <Select value={goldSourceSel} onValueChange={(v) => setGoldSourceSel(v as GoldSource)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="pegadaian">Pegadaian Tabungan Emas (auto-refresh)</SelectItem>
          <SelectItem value="spot">Spot Internasional (auto-refresh)</SelectItem>
          <SelectItem value="manual">Manual (saya input sendiri)</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {goldSourceSel === 'pegadaian' && 'Harga buyback Pegadaian — match dengan app Pegadaian Digital/Tring.'}
        {goldSourceSel === 'spot' && 'Harga emas dunia × kurs USD/IDR. Untuk emas non-Pegadaian (perkiraan).'}
        {goldSourceSel === 'manual' && 'Tombol Refresh Harga akan skip aset ini. Input manual via Edit atau Update Harga.'}
      </p>
    </div>
  )}
  ```
- Validasi pre-submit:
  ```ts
  if (finalType === 'Emas' && !['pegadaian', 'spot', 'manual'].includes(goldSourceSel)) {
    toast.error('Pilih sumber harga emas')
    return
  }
  ```
- Payload: `gold_source: finalType === 'Emas' ? goldSourceSel : null`

### 5. `src/db/csvInvestments.ts`

- Header: tambah `'gold_source'` ke array `HEADER`
- Export: tambah `r.gold_source ?? ''` ke body
- Import:
  - `col.gold_source = header.indexOf('gold_source')`
  - Tambah `gold_source` ke `ValidRow` type
  - Parse logic:
    ```ts
    const goldSourceRaw = col.gold_source >= 0 ? (r[col.gold_source] ?? '').trim().toLowerCase() : ''
    const gold_source = asset_type === 'Emas'
      ? (['pegadaian', 'spot', 'manual'].includes(goldSourceRaw) ? goldSourceRaw : 'manual')
      : null
    ```
  - **Default behavior:** emas tanpa kolom `gold_source` di CSV → fallback `'manual'` (paling aman, no surprise auto-fetch)

### 6. `supabase/functions/fetch-prices/index.ts`

#### Update interface

```ts
interface InvestmentInput {
  id: number
  asset_type: string
  asset_name: string
  gold_source: 'pegadaian' | 'spot' | 'manual' | null
}
```

#### Function baru

```ts
async function fetchPegadaianBuyback(): Promise<number> {
  const res = await fetch('https://sahabat.pegadaian.co.id/harga-emas', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KantongPintar/1.0)' },
  })
  if (!res.ok) throw new Error(`Pegadaian fetch error: ${res.status}`)
  const html = await res.text()

  // Regex bounded — cari label "Buyback" terdekat dengan angka /0,01 gram
  const m = html.match(/Buyback[\s\S]{0,300}?Rp\s*([\d.]+)\s*\/\s*0[,.]01\s*gram/i)
  if (!m) throw new Error('Harga buyback Pegadaian tidak ditemukan di halaman')

  const pricePer001g = Number(m[1].replace(/\./g, ''))
  if (!Number.isFinite(pricePer001g) || pricePer001g <= 0) {
    throw new Error(`Parse harga gagal: ${m[1]}`)
  }
  return pricePer001g * 100  // → per gram
}
```

#### Routing baru (replace lines 107-118)

```ts
const emas = investments.filter((i) => i.asset_type === 'Emas')

if (emas.length > 0) {
  const needPegadaian = emas.filter((i) => i.gold_source === 'pegadaian')
  const needSpot = emas.filter((i) => i.gold_source === 'spot' || i.gold_source == null)
  // gold_source='manual' → skip (defensive; frontend juga sudah filter)

  if (needPegadaian.length > 0) {
    try {
      const price = await fetchPegadaianBuyback()
      for (const inv of needPegadaian) results.push({ id: inv.id, price })
    } catch (e) {
      for (const inv of needPegadaian) {
        errors.push({ id: inv.id, asset_name: inv.asset_name, reason: String(e) })
      }
    }
  }

  if (needSpot.length > 0) {
    try {
      const price = await fetchEmasPrice()
      for (const inv of needSpot) results.push({ id: inv.id, price })
    } catch (e) {
      for (const inv of needSpot) {
        errors.push({ id: inv.id, asset_name: inv.asset_name, reason: String(e) })
      }
    }
  }
}
```

**Backwards-compat note:** `gold_source == null` di-treat sebagai `'spot'`. Ini melindungi skenario edge function deployed dulu (sebelum migration applied) — frontend lama yang belum kirim `gold_source` tetap dapat hasil seperti sebelumnya.

## Komponen yang TIDAK Berubah

- `InvestmentsTab.tsx` — kolom tabel tetap (tidak tambah kolom "Sumber"; user bisa lihat via Edit)
- `PriceUpdateDialog.tsx` — manual price update tetap independen
- `LinkInvestmentDialog.tsx` — hanya read-only, tidak terdampak
- Toast handler `useRefreshPrices()` — sudah handle partial-success, otomatis cover skenario "row Pegadaian gagal scrape"
- Logic `costBasis`, `currentValue`, `gainLoss`, `gainLossPercent`
- Saham (Yahoo Finance), Reksadana, Kripto

## Error Handling

| Skenario | Behavior |
|---|---|
| Pegadaian website 5xx / timeout | Row Pegadaian masuk `errors[]`, row spot tetap di-fetch (independen) |
| Regex tidak match (layout Pegadaian berubah) | `errors[]` dengan reason "Harga buyback Pegadaian tidak ditemukan", user lihat warning toast, klik Edit + switch ke `manual` + input dari app Tring |
| Network gagal total | Outer `try/catch` existing tangkap, return 400 |
| `gold_source = null` (legacy/edge case) | Treat sebagai `'spot'` (backwards compat) |
| User edit asset_type Saham → Emas tanpa pilih source | App-level validation toast error sebelum submit; tidak hit DB CHECK |
| CSV import row Emas tanpa kolom `gold_source` | Default `'manual'` — user dapat edit kemudian |

## Testing

### Manual UAT (live test post-deploy)

1. Buka tab Investasi: row Emas Tabungan Pegadaian muncul, layout sama
2. Klik Edit row Emas: dropdown "Sumber Harga" muncul, value="Pegadaian Tabungan Emas"
3. Klik Refresh Harga: toast "1 harga diperbarui", H.Kini ~Rp 2.592.000/g, G/L +15-16%
4. Tambah Emas baru source="Manual": Refresh Harga skip row ini
5. Tambah Emas baru source="Spot Internasional": Refresh ambil dari metals.dev (~Rp 2.546.000/g)
6. Edit row Saham → ubah Jenis Aset jadi Emas → dropdown muncul, submit no error
7. Export CSV → import lagi: round-trip konsisten
8. Signup user baru via incognito: seed lengkap tanpa error

### Automated tests

- **`InvestmentDialog`** (Vitest + Testing Library): conditional render dropdown, default value, edit mode preservation, submit payload include/exclude `gold_source` based on asset type
- **`csvInvestments`** (Vitest): export include kolom, import parse + default behavior, round-trip
- **`fetchPrices()` filter** (Vitest): skip `manual` dari payload edge function

### Skipped (UAT-only coverage)

- `fetchPegadaianBuyback()` parser — Deno function, tidak compatible dengan Vitest. Risk acceptable: function pure, regression deteksi cepat via toast error saat user klik Refresh.

## Rollout Plan

```
1. Apply migration 0027 via Supabase SQL Editor
   - ALTER TABLE ADD COLUMN gold_source TEXT
   - UPDATE backfill (existing emas rows)
   - ADD CONSTRAINT (after backfill, won't fail)
   - CREATE OR REPLACE FUNCTION seed_rencana

2. Deploy edge function
   - supabase functions deploy fetch-prices

3. Deploy frontend (git push → Vercel auto-deploy ~15-30 detik)

4. Smoke test: Refresh Harga → match Tring buyback aktual
```

**Urutan ini aman karena:**
- Step 1 backwards-compat (kolom NULL allowed sementara, frontend lama tidak break)
- Step 2 backwards-compat (`gold_source == null` → treat as `'spot'`)
- Step 3 minimal window broken (Vercel cepat)

**Rollback:**
- Frontend: `git revert` + Vercel redeploy
- Edge function: `supabase functions deploy` dari commit lama
- DB: `ALTER TABLE investments DROP COLUMN gold_source CASCADE`

## Definition of Done

- [ ] Migration 0027 applied di production
- [ ] Edge function deployed dengan `fetchPegadaianBuyback()`
- [ ] Frontend deployed dengan dropdown "Sumber Harga"
- [ ] UAT 1-8 lulus
- [ ] H.Kini Emas Tabungan Pegadaian user match buyback aktual hari ujicoba (presisi ±Rp 1.000/g)
- [ ] Signup user baru dapat seed lengkap (test via incognito + email baru)
- [ ] G/L row emas user tampil sesuai realita app Tring/Pegadaian Digital

## Future Enhancements (out of scope)

- Source Antam (LM fisik) via scrape `logammulia.com/id/sell-buy`
- Source UBS, Galeri24
- Auto-refresh saat tab Investasi mounted (>6 jam stale)
- Cron daily refresh untuk semua user
- Per-row history harga buyback Pegadaian (chart trend)
- Toggle "tampilkan dengan harga jual atau buyback" di tabel
