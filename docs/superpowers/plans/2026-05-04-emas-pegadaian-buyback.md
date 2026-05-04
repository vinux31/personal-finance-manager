# Emas Pegadaian Buyback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bikin field `gold_source` di tabel investments + dropdown UI + scrape buyback Pegadaian di edge function, supaya G/L row Emas Tabungan Pegadaian akurat (match app Tring/Pegadaian Digital).

**Architecture:** Tambah kolom `gold_source` di DB dengan CHECK constraint untuk nilai valid `'pegadaian'|'spot'|'manual'`. Dropdown di form Edit muncul kondisional saat asset_type='Emas'. Edge function routing per row: scrape `sahabat.pegadaian.co.id` untuk `pegadaian`, metals.dev untuk `spot`, skip untuk `manual`. Backwards-compat: `null` → treat sebagai `spot`.

**Tech Stack:** PostgreSQL (Supabase), TypeScript, React 19, Deno (edge function), `@supabase/supabase-js`, `@tanstack/react-query`. **Tidak ada test framework** — verifikasi via `npm run build` (tsc), `npm run lint`, dan manual UAT.

**Reference:** `docs/superpowers/specs/2026-05-04-emas-pegadaian-buyback-design.md`

---

## File Structure

| Action | Path | Tanggung jawab |
|---|---|---|
| Create | `supabase/migrations/0027_investments_gold_source.sql` | Add kolom, backfill, CHECK, update seed function |
| Modify | `src/db/investments.ts` | Type `GoldSource`, field di Investment + InvestmentInput, SELECT/INSERT/UPDATE, fetchPrices filter |
| Modify | `src/queries/investments.ts` | Re-export `GoldSource` |
| Modify | `src/db/csvInvestments.ts` | Tambah kolom CSV header, parse dengan default 'manual' untuk emas |
| Modify | `src/components/InvestmentDialog.tsx` | State `goldSourceSel`, dropdown conditional, validation, payload |
| Modify | `supabase/functions/fetch-prices/index.ts` | Add `fetchPegadaianBuyback()`, routing per `gold_source` |

---

## Task 1: Migration 0027 — kolom + backfill + CHECK + seed function

**Files:**
- Create: `supabase/migrations/0027_investments_gold_source.sql`

- [ ] **Step 1: Buat migration file**

Create `supabase/migrations/0027_investments_gold_source.sql`:

```sql
-- 0027_investments_gold_source.sql
-- Tambah kolom gold_source untuk identify sumber harga emas per row.
-- Diperlukan supaya edge function fetch-prices bisa routing:
--   pegadaian → scrape buyback Pegadaian
--   spot      → metals.dev (logic existing, untuk emas non-Pegadaian)
--   manual    → skip auto-fetch, user input current_price sendiri

ALTER TABLE investments ADD COLUMN gold_source TEXT;

-- Backfill DULU sebelum CHECK supaya constraint tidak fail di apply
UPDATE investments
  SET gold_source = 'pegadaian'
  WHERE asset_type = 'Emas' AND asset_name ILIKE '%pegadaian%';

UPDATE investments
  SET gold_source = 'manual'
  WHERE asset_type = 'Emas' AND gold_source IS NULL;

-- CHECK loose: untuk non-emas bebas (NULL atau leftover), untuk emas WAJIB
-- salah satu dari 3 value valid. App-level validation di InvestmentDialog
-- harus pastikan dropdown terisi sebelum submit supaya error tidak bocor.
ALTER TABLE investments ADD CONSTRAINT gold_source_valid_for_emas CHECK (
  asset_type <> 'Emas' OR gold_source IN ('pegadaian', 'spot', 'manual')
);

-- Update seed function 0022: signup user baru harus dapat row Emas dengan
-- gold_source='pegadaian', kalau tidak CHECK akan fail dan transaction rollback.
CREATE OR REPLACE FUNCTION seed_rencana(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := p_user_id;
BEGIN
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

- [ ] **Step 2: Commit migration file**

```bash
git add supabase/migrations/0027_investments_gold_source.sql
git commit -m "feat(db): tambah kolom gold_source ke investments dengan CHECK constraint"
```

> Catatan: migration BELUM diterapkan ke DB di task ini. Apply dilakukan di Task 7 (rollout step) via Supabase SQL Editor — sesuai memory project, JANGAN pakai `supabase db push`.

---

## Task 2: Update types & DB functions di `src/db/investments.ts`

**Files:**
- Modify: `src/db/investments.ts`

- [ ] **Step 1: Tambah type `GoldSource` setelah baris 1**

Edit `src/db/investments.ts`. Setelah `import { todayISO } from '@/lib/format'` (line 2), tambah:

```ts
export type GoldSource = 'pegadaian' | 'spot' | 'manual'
```

- [ ] **Step 2: Tambah field `gold_source` ke interface `Investment` (lines 4-13)**

Replace:
```ts
export interface Investment {
  id: number
  asset_type: string
  asset_name: string
  quantity: number
  buy_price: number
  current_price: number | null
  buy_date: string
  note: string | null
}
```

With:
```ts
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
```

- [ ] **Step 3: Tambah field `gold_source` ke `InvestmentInput` (lines 15-23)**

Replace:
```ts
export interface InvestmentInput {
  asset_type: string
  asset_name: string
  quantity: number
  buy_price: number
  current_price: number | null
  buy_date: string
  note: string | null
}
```

With:
```ts
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

- [ ] **Step 4: Tambah `gold_source` ke SELECT statement di `listInvestments` (line 48)**

Replace:
```ts
.select('id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note')
```

With:
```ts
.select('id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note, gold_source')
```

- [ ] **Step 5: Tambah `gold_source` ke SELECT statement di `getInvestment` (line 63)**

Replace:
```ts
.select('id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note')
```

With:
```ts
.select('id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note, gold_source')
```

- [ ] **Step 6: Tambah `gold_source` ke INSERT payload di `createInvestment` (lines 76-84)**

Replace:
```ts
.insert({
  asset_type: i.asset_type,
  asset_name: i.asset_name,
  quantity: i.quantity,
  buy_price: i.buy_price,
  current_price: i.current_price,
  buy_date: i.buy_date,
  note: i.note,
})
```

With:
```ts
.insert({
  asset_type: i.asset_type,
  asset_name: i.asset_name,
  quantity: i.quantity,
  buy_price: i.buy_price,
  current_price: i.current_price,
  buy_date: i.buy_date,
  note: i.note,
  gold_source: i.gold_source,
})
```

- [ ] **Step 7: Tambah `gold_source` ke UPDATE payload di `updateInvestment` (lines 106-114)**

Replace:
```ts
.update({
  asset_type: i.asset_type,
  asset_name: i.asset_name,
  quantity: i.quantity,
  buy_price: i.buy_price,
  current_price: i.current_price,
  buy_date: i.buy_date,
  note: i.note,
})
```

With:
```ts
.update({
  asset_type: i.asset_type,
  asset_name: i.asset_name,
  quantity: i.quantity,
  buy_price: i.buy_price,
  current_price: i.current_price,
  buy_date: i.buy_date,
  note: i.note,
  gold_source: i.gold_source,
})
```

- [ ] **Step 8: Update `fetchPrices` signature & filter (lines 182-192)**

Replace seluruh function:
```ts
export async function fetchPrices(investments: Pick<Investment, 'id' | 'asset_type' | 'asset_name'>[]): Promise<FetchPriceResult> {
  const toFetch = investments.filter((i) => i.asset_type === 'Saham' || i.asset_type === 'Emas')
  if (toFetch.length === 0) return { results: [], errors: [] }

  const { data, error } = await supabase.functions.invoke('fetch-prices', {
    body: { investments: toFetch },
  })

  if (error) throw new Error(`Edge Function error: ${error.message}`)
  return data as FetchPriceResult
}
```

With:
```ts
export async function fetchPrices(
  investments: Pick<Investment, 'id' | 'asset_type' | 'asset_name' | 'gold_source'>[]
): Promise<FetchPriceResult> {
  // Skip emas dengan gold_source='manual' — user input sendiri, tidak perlu auto-fetch
  const toFetch = investments.filter((i) =>
    i.asset_type === 'Saham' ||
    (i.asset_type === 'Emas' && i.gold_source !== 'manual')
  )
  if (toFetch.length === 0) return { results: [], errors: [] }

  const { data, error } = await supabase.functions.invoke('fetch-prices', {
    body: { investments: toFetch },
  })

  if (error) throw new Error(`Edge Function error: ${error.message}`)
  return data as FetchPriceResult
}
```

- [ ] **Step 9: Verifikasi TypeScript compile**

Run: `npm run build`

Expected: build sukses tanpa TS error. Kalau ada error tentang `gold_source` missing di consumer (misal CSV import, dialog), itu akan ditangani di task berikutnya — **HARUS lulus tsc dulu di akhir setiap task**, jadi kalau ada error di consumer, task ini belum complete sampai semua konsumen di-update juga.

> Catatan praktis: error TS dari consumer (`csvInvestments.ts`, `InvestmentDialog.tsx`) akan muncul setelah Step 8 — itu wajar dan akan ditangani di Task 4 & 5. Skip commit sampai seluruh suite type-check.

- [ ] **Step 10: HOLD commit sampai Task 4 & 5 selesai**

Type changes di task ini break consumer files. Type-system memaksa fix berurutan, jadi commit gabungan setelah semua consumer updated. Lanjut ke Task 3.

---

## Task 3: Re-export `GoldSource` di `src/queries/investments.ts`

**Files:**
- Modify: `src/queries/investments.ts`

- [ ] **Step 1: Tambah `GoldSource` ke import (line 3-20)**

Edit `src/queries/investments.ts`. Replace:
```ts
import {
  listInvestments,
  createInvestment,
  updateInvestment,
  deleteInvestment,
  updatePrice,
  getPriceHistory,
  listAssetTypes,
  fetchPrices,
  costBasis,
  currentValue,
  gainLoss,
  gainLossPercent,
  type Investment,
  type InvestmentInput,
  type InvestmentFilters,
  type PriceHistoryEntry,
} from '@/db/investments'
```

With (tambah `type GoldSource`):
```ts
import {
  listInvestments,
  createInvestment,
  updateInvestment,
  deleteInvestment,
  updatePrice,
  getPriceHistory,
  listAssetTypes,
  fetchPrices,
  costBasis,
  currentValue,
  gainLoss,
  gainLossPercent,
  type Investment,
  type InvestmentInput,
  type InvestmentFilters,
  type PriceHistoryEntry,
  type GoldSource,
} from '@/db/investments'
```

- [ ] **Step 2: Tambah `GoldSource` ke re-export (line 26)**

Replace:
```ts
export { type Investment, type InvestmentInput, type InvestmentFilters, type PriceHistoryEntry }
```

With:
```ts
export { type Investment, type InvestmentInput, type InvestmentFilters, type PriceHistoryEntry, type GoldSource }
```

- [ ] **Step 3: Lanjut ke Task 4 (commit gabungan)**

---

## Task 4: Update CSV import/export di `src/db/csvInvestments.ts`

**Files:**
- Modify: `src/db/csvInvestments.ts`

- [ ] **Step 1: Tambah `gold_source` ke HEADER (line 5)**

Edit `src/db/csvInvestments.ts`. Replace:
```ts
const HEADER = ['asset_type', 'asset_name', 'quantity', 'buy_price', 'current_price', 'buy_date', 'note']
```

With:
```ts
const HEADER = ['asset_type', 'asset_name', 'quantity', 'buy_price', 'current_price', 'buy_date', 'note', 'gold_source']
```

- [ ] **Step 2: Tambah `r.gold_source` ke export body (lines 9-17)**

Replace:
```ts
const body = rows.map((r) => [
  r.asset_type,
  r.asset_name,
  String(r.quantity),
  String(r.buy_price),
  r.current_price != null ? String(r.current_price) : '',
  r.buy_date,
  r.note ?? '',
])
```

With:
```ts
const body = rows.map((r) => [
  r.asset_type,
  r.asset_name,
  String(r.quantity),
  String(r.buy_price),
  r.current_price != null ? String(r.current_price) : '',
  r.buy_date,
  r.note ?? '',
  r.gold_source ?? '',
])
```

- [ ] **Step 3: Tambah `gold_source` ke col index map (lines 32-40)**

Replace:
```ts
const col = {
  asset_type: header.indexOf('asset_type'),
  asset_name: header.indexOf('asset_name'),
  quantity: header.indexOf('quantity'),
  buy_price: header.indexOf('buy_price'),
  current_price: header.indexOf('current_price'),
  buy_date: header.indexOf('buy_date'),
  note: header.indexOf('note'),
}
```

With:
```ts
const col = {
  asset_type: header.indexOf('asset_type'),
  asset_name: header.indexOf('asset_name'),
  quantity: header.indexOf('quantity'),
  buy_price: header.indexOf('buy_price'),
  current_price: header.indexOf('current_price'),
  buy_date: header.indexOf('buy_date'),
  note: header.indexOf('note'),
  gold_source: header.indexOf('gold_source'),
}
```

- [ ] **Step 4: Update `ValidRow` type (line 47)**

Replace:
```ts
type ValidRow = { asset_type: string; asset_name: string; quantity: number; buy_price: number; current_price: number | null; buy_date: string; note: string | null }
```

With:
```ts
type ValidRow = { asset_type: string; asset_name: string; quantity: number; buy_price: number; current_price: number | null; buy_date: string; note: string | null; gold_source: 'pegadaian' | 'spot' | 'manual' | null }
```

- [ ] **Step 5: Parse `gold_source` di loop import (sebelum push ke valid, around line 61-69)**

Replace seluruh blok:
```ts
const buy_date = (r[col.buy_date] ?? '').trim()
const note = col.note >= 0 ? (r[col.note] ?? '').trim() : ''

if (!asset_type) throw new Error('asset_type kosong')
if (!asset_name) throw new Error('asset_name kosong')
if (!(quantity > 0)) throw new Error('quantity harus > 0')
if (!(buy_price > 0)) throw new Error('buy_price harus > 0')
if (!/^\d{4}-\d{2}-\d{2}$/.test(buy_date)) throw new Error('buy_date harus YYYY-MM-DD')

valid.push({ asset_type, asset_name, quantity, buy_price, current_price, buy_date, note: note || null })
```

With:
```ts
const buy_date = (r[col.buy_date] ?? '').trim()
const note = col.note >= 0 ? (r[col.note] ?? '').trim() : ''

if (!asset_type) throw new Error('asset_type kosong')
if (!asset_name) throw new Error('asset_name kosong')
if (!(quantity > 0)) throw new Error('quantity harus > 0')
if (!(buy_price > 0)) throw new Error('buy_price harus > 0')
if (!/^\d{4}-\d{2}-\d{2}$/.test(buy_date)) throw new Error('buy_date harus YYYY-MM-DD')

// Default behavior: emas tanpa kolom gold_source di CSV → 'manual'
// (paling aman; user bisa edit per row kalau mau switch)
const goldSourceRaw = col.gold_source >= 0 ? (r[col.gold_source] ?? '').trim().toLowerCase() : ''
const gold_source: 'pegadaian' | 'spot' | 'manual' | null = asset_type === 'Emas'
  ? (['pegadaian', 'spot', 'manual'].includes(goldSourceRaw) ? (goldSourceRaw as 'pegadaian' | 'spot' | 'manual') : 'manual')
  : null

valid.push({ asset_type, asset_name, quantity, buy_price, current_price, buy_date, note: note || null, gold_source })
```

- [ ] **Step 6: Lanjut ke Task 5 (commit gabungan)**

---

## Task 5: Update `InvestmentDialog.tsx` — dropdown Sumber Harga

**Files:**
- Modify: `src/components/InvestmentDialog.tsx`

- [ ] **Step 1: Tambah `GoldSource` import (line 21-22)**

Edit `src/components/InvestmentDialog.tsx`. Replace:
```ts
import { type Investment } from '@/queries/investments'
import { useCreateInvestment, useUpdateInvestment, useAssetTypes } from '@/queries/investments'
```

With:
```ts
import { type Investment, type InvestmentInput, type GoldSource } from '@/queries/investments'
import { useCreateInvestment, useUpdateInvestment, useAssetTypes } from '@/queries/investments'
```

- [ ] **Step 2: Tambah state `goldSourceSel` (after line 42, end of state declarations)**

Setelah baris `const [note, setNote] = useState('')` (line 42), tambah:

```ts
const [goldSourceSel, setGoldSourceSel] = useState<GoldSource>('pegadaian')
```

- [ ] **Step 3: Initialize `goldSourceSel` di useEffect (lines 49-70)**

Replace:
```ts
useEffect(() => {
  if (!open) return
  if (editing) {
    setAssetTypeSel(editing.asset_type)
    setCustomType('')
    setAssetName(editing.asset_name)
    setQtyStr(String(editing.quantity))
    setBuyPriceStr(String(editing.buy_price))
    setCurrentPriceStr(editing.current_price != null ? String(editing.current_price) : '')
    setBuyDate(editing.buy_date)
    setNote(editing.note ?? '')
  } else {
    setAssetTypeSel('Saham')
    setCustomType('')
    setAssetName('')
    setQtyStr('')
    setBuyPriceStr('')
    setCurrentPriceStr('')
    setBuyDate(todayISO())
    setNote('')
  }
}, [open, editing])
```

With:
```ts
useEffect(() => {
  if (!open) return
  if (editing) {
    setAssetTypeSel(editing.asset_type)
    setCustomType('')
    setAssetName(editing.asset_name)
    setQtyStr(String(editing.quantity))
    setBuyPriceStr(String(editing.buy_price))
    setCurrentPriceStr(editing.current_price != null ? String(editing.current_price) : '')
    setBuyDate(editing.buy_date)
    setNote(editing.note ?? '')
    setGoldSourceSel(editing.gold_source ?? 'pegadaian')
  } else {
    setAssetTypeSel('Saham')
    setCustomType('')
    setAssetName('')
    setQtyStr('')
    setBuyPriceStr('')
    setCurrentPriceStr('')
    setBuyDate(todayISO())
    setNote('')
    setGoldSourceSel('pegadaian')
  }
}, [open, editing])
```

- [ ] **Step 4: Tambah validasi gold_source di `handleSubmit` (after line 80)**

Setelah blok validasi existing (line 78-81):
```ts
if (!finalType || !assetName.trim() || !buyDate || !(qty > 0) || buyPrice <= 0) {
  toast.error('Lengkapi jenis, nama, tanggal, kuantitas (> 0), harga beli (> 0)')
  return
}
```

Tambah validasi baru:
```ts
if (finalType === 'Emas' && !['pegadaian', 'spot', 'manual'].includes(goldSourceSel)) {
  toast.error('Pilih sumber harga emas')
  return
}
```

- [ ] **Step 5: Update payload di `handleSubmit` (lines 82-90)**

Replace:
```ts
const payload = {
  asset_type: finalType,
  asset_name: assetName.trim(),
  quantity: qty,
  buy_price: buyPrice,
  current_price: currentPrice,
  buy_date: buyDate,
  note: note.trim() || null,
}
```

With:
```ts
const payload: InvestmentInput = {
  asset_type: finalType,
  asset_name: assetName.trim(),
  quantity: qty,
  buy_price: buyPrice,
  current_price: currentPrice,
  buy_date: buyDate,
  note: note.trim() || null,
  gold_source: finalType === 'Emas' ? goldSourceSel : null,
}
```

- [ ] **Step 6: Tambah dropdown UI di form**

Sisipkan SETELAH field "Nama Aset" (after line 130, sebelum `<div className="grid grid-cols-2 gap-3">` Kuantitas/Tanggal):

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

- [ ] **Step 7: Verifikasi TypeScript build**

Run: `npm run build`

Expected: build sukses, tidak ada TS error.

Kalau ada error: baca pesan, fix issue (kemungkinan import missing atau type mismatch). Tidak commit sampai build hijau.

- [ ] **Step 8: Verifikasi lint**

Run: `npm run lint`

Expected: pass (mungkin ada existing warnings yang tidak terkait — abaikan, fokus pada error baru dari perubahan ini).

- [ ] **Step 9: Commit gabungan Task 2-5**

```bash
git add src/db/investments.ts src/queries/investments.ts src/db/csvInvestments.ts src/components/InvestmentDialog.tsx
git commit -m "feat(investasi): tambah field gold_source — type, dialog, CSV"
```

---

## Task 6: Edge function — `fetchPegadaianBuyback()` + routing per source

**Files:**
- Modify: `supabase/functions/fetch-prices/index.ts`

- [ ] **Step 1: Update interface `InvestmentInput` (lines 28-32)**

Edit `supabase/functions/fetch-prices/index.ts`. Replace:
```ts
interface InvestmentInput {
  id: number
  asset_type: string
  asset_name: string
}
```

With:
```ts
interface InvestmentInput {
  id: number
  asset_type: string
  asset_name: string
  gold_source: 'pegadaian' | 'spot' | 'manual' | null
}
```

- [ ] **Step 2: Tambah function `fetchPegadaianBuyback()` setelah `fetchEmasPrice()`**

Setelah `fetchEmasPrice()` (line 179, akhir function), tambah:

```ts
async function fetchPegadaianBuyback(): Promise<number> {
  const res = await fetch('https://sahabat.pegadaian.co.id/harga-emas', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KantongPintar/1.0)' },
  })
  if (!res.ok) throw new Error(`Pegadaian fetch error: ${res.status}`)
  const html = await res.text()

  // Cari label "Buyback" lalu angka terdekat dalam format "Rp X.XXX / 0,01 gram".
  // Bound 300 char: cegah false-match kalau Pegadaian ubah layout drastis.
  const m = html.match(/Buyback[\s\S]{0,300}?Rp\s*([\d.]+)\s*\/\s*0[,.]01\s*gram/i)
  if (!m) throw new Error('Harga buyback Pegadaian tidak ditemukan di halaman')

  // Format website: "Rp 25.920 / 0,01 gram" → 25920 → ×100 = 2.592.000 per gram
  const pricePer001g = Number(m[1].replace(/\./g, ''))
  if (!Number.isFinite(pricePer001g) || pricePer001g <= 0) {
    throw new Error(`Parse harga gagal: ${m[1]}`)
  }
  return pricePer001g * 100
}
```

- [ ] **Step 3: Replace routing emas (lines 107-118)**

Replace:
```ts
if (emas.length > 0) {
  try {
    const emasPrice = await fetchEmasPrice()
    for (const inv of emas) {
      results.push({ id: inv.id, price: emasPrice })
    }
  } catch (e) {
    for (const inv of emas) {
      errors.push({ id: inv.id, asset_name: inv.asset_name, reason: String(e) })
    }
  }
}
```

With:
```ts
if (emas.length > 0) {
  // Routing per gold_source. null → treat sebagai 'spot' (backwards-compat
  // untuk frontend lama yang belum kirim field).
  const needPegadaian = emas.filter((i) => i.gold_source === 'pegadaian')
  const needSpot = emas.filter((i) => i.gold_source === 'spot' || i.gold_source == null)
  // gold_source='manual' → skip (frontend juga sudah filter, defensive di sini)

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

- [ ] **Step 4: Commit edge function changes**

```bash
git add supabase/functions/fetch-prices/index.ts
git commit -m "feat(edge): scrape Pegadaian buyback + routing per gold_source"
```

---

## Task 7: Rollout — apply migration + deploy edge function + frontend

**Files:** (no code changes; deployment steps)

- [ ] **Step 1: Apply migration via Supabase SQL Editor**

Buka Supabase Dashboard → SQL Editor (production project). Copy seluruh isi `supabase/migrations/0027_investments_gold_source.sql`, paste, klik Run.

Expected output: `Success. No rows returned` untuk DDL, `UPDATE 1` (atau lebih) untuk backfill.

Verifikasi via query baru:
```sql
SELECT id, asset_type, asset_name, gold_source FROM investments WHERE asset_type = 'Emas';
```

Expected: row "Emas Tabungan Pegadaian" punya `gold_source = 'pegadaian'`.

> JANGAN pakai `supabase db push` — sesuai memory project, workflow ini broken untuk repo ini (history mismatch). Hanya SQL Editor.

- [ ] **Step 2: Deploy edge function**

```bash
supabase functions deploy fetch-prices
```

Expected output: `Deployed Function fetch-prices on project ref ...`.

Kalau gagal auth, login dulu: `supabase login` lalu retry.

- [ ] **Step 3: Push commits ke main → Vercel auto-deploy frontend**

```bash
git push origin master
```

Expected: Vercel webhook fire, deployment selesai dalam 15-30 detik (sesuai memory project).

- [ ] **Step 4: Smoke test build production**

Buka https://kantongpintar.vercel.app di browser. Login, navigasi ke tab Investasi.

Expected: row "Emas Tabungan Pegadaian" muncul dengan H.Beli, H.Kini, Modal, Nilai, G/L. Tidak ada error di console.

---

## Task 8: Manual UAT

**Files:** (no code changes)

> Catatan: untuk setiap UAT step di bawah, kalau hasil tidak match expected, **balikkan ke Task korespondensi** untuk fix, lalu push & re-deploy.

- [ ] **UAT 1: Refresh Harga untuk row Pegadaian**

1. Tab Investasi → klik tombol "Refresh Harga"
2. Expected: toast "1 harga diperbarui" (atau ">=1 harga diperbarui" kalau Saham juga ter-update)
3. Cek row "Emas Tabungan Pegadaian":
   - H.Kini ≈ Rp 2.592.000/g (presisi ±Rp 1.000) — angka harus mirip yang di app Pegadaian Digital/Tring user
   - G/L tampil **+15-16%** (atau angka aktual hari ujicoba), TIDAK negatif
4. Bandingkan dengan app Pegadaian Digital/Tring user: nilai harus match (±Rp 5.000 untuk rounding)

- [ ] **UAT 2: Edit dialog dropdown muncul untuk Emas**

1. Klik Edit di row "Emas Tabungan Pegadaian"
2. Expected: dialog terbuka, field "Sumber Harga" muncul dengan value "Pegadaian Tabungan Emas"
3. Dropdown punya 3 opsi: Pegadaian, Spot Internasional, Manual
4. Hint text muncul di bawah dropdown sesuai pilihan saat ini

- [ ] **UAT 3: Dropdown TIDAK muncul untuk asset non-Emas**

1. Klik Edit di row "Saham BMRI"
2. Expected: TIDAK ada field "Sumber Harga" di dialog
3. Klik Edit di row "Reksadana Sukuk Sucorinvest Sharia"
4. Expected: TIDAK ada field "Sumber Harga"

- [ ] **UAT 4: Tambah Emas baru source="Manual"**

1. Klik "Tambah Investasi"
2. Pilih Jenis Aset: Emas
3. Pilih Sumber Harga: Manual
4. Isi: Nama "Emas Test Manual", Qty 1, Tgl hari ini, H.Beli 2500000, H.Kini kosong, Catatan "test UAT"
5. Klik Simpan
6. Klik Refresh Harga
7. Expected: row "Emas Test Manual" TIDAK ter-update (H.Kini tetap atau null)
8. Cleanup: hapus row test ini

- [ ] **UAT 5: Tambah Emas baru source="Spot Internasional"**

1. Klik "Tambah Investasi" → Jenis Emas → Sumber Harga "Spot Internasional"
2. Isi: Nama "Emas Test Spot", Qty 1, Tgl hari ini, H.Beli 2500000
3. Simpan, klik Refresh Harga
4. Expected: H.Kini terisi dari metals.dev (sekitar Rp 2.5xx.xxx, lebih rendah dari Pegadaian buyback ~Rp 46.000/g)
5. Cleanup: hapus row test ini

- [ ] **UAT 6: Edit Saham → ubah ke Emas**

1. Klik "Tambah Investasi" → Jenis Saham → Nama "TEST.JK", Qty 100, H.Beli 1000
2. Simpan
3. Klik Edit row "TEST.JK"
4. Ubah Jenis Aset jadi: Emas
5. Expected: dropdown "Sumber Harga" muncul dengan default "Pegadaian Tabungan Emas"
6. Klik Simpan → expected: TIDAK ada error (CHECK constraint OK karena gold_source ke-set)
7. Cleanup: hapus row test ini

- [ ] **UAT 7: CSV round-trip**

1. Klik tombol "Ekspor" → download CSV
2. Buka CSV file, verifikasi:
   - Header punya kolom `gold_source`
   - Row "Emas Tabungan Pegadaian" punya value `pegadaian` di kolom tsb
   - Row Saham/Reksadana punya value kosong di kolom tsb
3. (Opsional) Hapus row Emas Test, klik "Impor", upload CSV yang sama
4. Expected: round-trip konsisten — gold_source ter-restore dengan benar

- [ ] **UAT 8: Signup user baru — verifikasi seed**

1. Buka https://kantongpintar.vercel.app di browser **incognito**
2. Daftar pakai email baru (mis. `test+uat@yourdomain`)
3. Setelah login, tab Investasi
4. Expected: 3 row seed muncul tanpa error: Reksadana, Emas Tabungan Pegadaian, Saham BMRI
5. Klik Edit row "Emas Tabungan Pegadaian"
6. Expected: Sumber Harga = "Pegadaian Tabungan Emas"
7. Klik Refresh Harga
8. Expected: H.Kini Emas ter-update ke harga Pegadaian aktual

> **PENTING — kalau UAT 8 gagal:** itu berarti `seed_rencana()` di migration 0027 kurang sesuatu, atau CHECK constraint patah seed. Rollback frontend & edge function, **JANGAN** rollback DB migration (data user existing aman). Investigate via `SELECT * FROM investments WHERE user_id = '<test uid>'` di SQL Editor.

- [ ] **Step 9: Commit checklist UAT (kalau pakai docs)**

UAT bisa di-track di phase verification doc kalau ini bagian dari milestone GSD. Kalau standalone, cukup confirm semua checkbox dicentang manual.

---

## Definition of Done

Semua checkbox di atas dicentang. Specifically:

- [ ] Migration 0027 applied di production
- [ ] Edge function `fetch-prices` deployed dengan `fetchPegadaianBuyback()` aktif
- [ ] Frontend `kantongpintar.vercel.app` deployed dengan dropdown "Sumber Harga"
- [ ] UAT 1-8 lulus
- [ ] H.Kini Emas Tabungan Pegadaian user match buyback aktual (presisi ±Rp 1.000/g)
- [ ] G/L row emas user tampil sesuai realita app Tring/Pegadaian Digital (positif, ~15%)
- [ ] Signup user baru via incognito dapat seed lengkap tanpa error

---

## Rollback Plan (kalau ada masalah produksi)

**Frontend (UI broken):**
```bash
git revert HEAD~N..HEAD  # N = jumlah commit terkait fitur ini
git push origin master
```
Vercel auto-redeploy ~30 detik.

**Edge function (scrape error semua user):**
Deploy versi sebelumnya:
```bash
git checkout <commit-sebelum-task-6> -- supabase/functions/fetch-prices/index.ts
supabase functions deploy fetch-prices
git checkout HEAD -- supabase/functions/fetch-prices/index.ts  # revert local
```

**DB migration (CHECK breaking):**
Hanya rollback kalau migration apply gagal-fail. Setelah berhasil apply, JANGAN rollback (data backfill akan hilang). Kalau benar-benar perlu:
```sql
ALTER TABLE investments DROP CONSTRAINT gold_source_valid_for_emas;
ALTER TABLE investments DROP COLUMN gold_source;
-- Restore seed_rencana ke versi 0022 (copy-paste body dari migration tsb)
```

---

## Catatan Penting

1. **Tidak ada test framework** — verifikasi via `npm run build`, `npm run lint`, dan UAT manual. Plan ini sengaja TIDAK include `vitest`/`jest` karena codebase belum punya infra test.

2. **Migration apply manual via SQL Editor** — sesuai memory project (`db push` rusak history). Tetap commit file SQL ke git untuk dokumentasi & onboarding user baru.

3. **Vercel deploy 15-30 detik** — jangan tunggu 90 detik (memory project).

4. **Backwards-compat di edge function** — `gold_source == null` di-treat sebagai `'spot'`. Ini melindungi window kecil di mana migration sudah apply tapi frontend belum deploy (frontend lama tidak kirim field, edge function fallback ke logic lama).

5. **Order matters di Task 7:** migration → edge function → frontend. Membalik urutan berisiko window broken.
