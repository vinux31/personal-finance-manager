# Gap 4 — Refresh Harga Investasi Otomatis: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah tombol "Refresh Semua Harga" yang otomatis mengambil harga terkini Saham IDX (Yahoo Finance) dan Emas (metals.dev) via Supabase Edge Function.

**Architecture:** Supabase Edge Function `fetch-prices` bertindak sebagai proxy — menerima daftar investasi, memanggil API eksternal (Yahoo Finance + metals.dev), dan mengembalikan array harga. Frontend menerima hasil dan menyimpan via `updatePrice()` yang sudah ada.

**Tech Stack:** Supabase Edge Functions (Deno), Yahoo Finance API, metals.dev API, open.er-api.com, React Query mutation, Lucide icons, Sonner toast.

---

## File Map

| File | Status | Tanggung jawab |
|------|--------|----------------|
| `supabase/functions/fetch-prices/index.ts` | Baru | Edge Function: proxy ke Yahoo Finance + metals.dev |
| `src/db/investments.ts` | Modifikasi | Tambah `fetchPrices()` — invoke Edge Function |
| `src/queries/investments.ts` | Modifikasi | Tambah `useRefreshPrices` mutation hook |
| `src/tabs/InvestmentsTab.tsx` | Modifikasi | Tambah tombol Refresh + loading state + toast |

---

## Task 1: Buat struktur Edge Function

**Files:**
- Create: `supabase/functions/fetch-prices/index.ts`

- [ ] **Step 1: Buat direktori dan file Edge Function**

```bash
mkdir -p supabase/functions/fetch-prices
```

Buat file `supabase/functions/fetch-prices/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvestmentInput {
  id: number
  asset_type: string
  asset_name: string
}

interface PriceResult {
  id: number
  price: number
}

interface PriceError {
  id: number
  asset_name: string
  reason: string
}

interface FetchPricesResponse {
  results: PriceResult[]
  errors: PriceError[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { investments }: { investments: InvestmentInput[] } = await req.json()

    const results: PriceResult[] = []
    const errors: PriceError[] = []

    const saham = investments.filter((i) => i.asset_type === 'Saham')
    const emas = investments.filter((i) => i.asset_type === 'Emas')

    // Fetch Saham
    await Promise.all(
      saham.map(async (inv) => {
        try {
          const price = await fetchSahamPrice(inv.asset_name)
          results.push({ id: inv.id, price })
        } catch (e) {
          errors.push({ id: inv.id, asset_name: inv.asset_name, reason: String(e) })
        }
      })
    )

    // Fetch Emas (satu kali untuk semua aset emas)
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

    const response: FetchPricesResponse = { results, errors }
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function fetchSahamPrice(assetName: string): Promise<number> {
  const ticker = `${assetName}.JK`
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`)
  const json = await res.json()
  const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice
  if (!price) throw new Error(`Harga tidak ditemukan untuk ${ticker}`)
  return price
}

async function fetchEmasPrice(): Promise<number> {
  const apiKey = Deno.env.get('METALS_DEV_API_KEY')
  if (!apiKey) throw new Error('METALS_DEV_API_KEY tidak di-set')

  const [goldRes, rateRes] = await Promise.all([
    fetch(`https://api.metals.dev/v1/latest?api_key=${apiKey}&currency=USD&unit=toz`),
    fetch('https://open.er-api.com/v6/latest/USD'),
  ])

  if (!goldRes.ok) throw new Error(`metals.dev error: ${goldRes.status}`)
  if (!rateRes.ok) throw new Error(`exchange rate error: ${rateRes.status}`)

  const goldJson = await goldRes.json()
  const rateJson = await rateRes.json()

  const xauPerOz: number = goldJson?.metals?.gold
  const usdIdr: number = rateJson?.rates?.IDR

  if (!xauPerOz) throw new Error('Harga emas tidak ditemukan dari metals.dev')
  if (!usdIdr) throw new Error('Kurs USD/IDR tidak ditemukan')

  // Konversi: USD per troy oz → IDR per gram
  const pricePerGram = (xauPerOz / 31.1035) * usdIdr
  return Math.round(pricePerGram)
}
```

- [ ] **Step 2: Verifikasi file terbuat**

```bash
ls supabase/functions/fetch-prices/
```
Expected output: `index.ts`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/fetch-prices/index.ts
git commit -m "feat(edge-fn): add fetch-prices Edge Function"
```

---

## Task 2: Tambah `fetchPrices()` ke db layer

**Files:**
- Modify: `src/db/investments.ts`

- [ ] **Step 1: Tambah import supabase dan type di `src/db/investments.ts`**

Tambah interface di bagian atas file, setelah `PriceHistoryEntry`:

```typescript
export interface FetchPriceResult {
  results: { id: number; price: number }[]
  errors: { id: number; asset_name: string; reason: string }[]
}
```

- [ ] **Step 2: Tambah fungsi `fetchPrices()` di akhir `src/db/investments.ts`**

```typescript
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

- [ ] **Step 3: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```
Expected: tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add src/db/investments.ts
git commit -m "feat(db): tambah fetchPrices — invoke fetch-prices Edge Function"
```

---

## Task 3: Tambah `useRefreshPrices` mutation hook

**Files:**
- Modify: `src/queries/investments.ts`

- [ ] **Step 1: Tambah import `fetchPrices` dan `FetchPriceResult` di `src/queries/investments.ts`**

Di baris import dari `@/db/investments`, tambahkan:

```typescript
import {
  // ... existing imports ...
  fetchPrices,
  type FetchPriceResult,
} from '@/db/investments'
```

- [ ] **Step 2: Tambah `useRefreshPrices` di akhir `src/queries/investments.ts`**

```typescript
export function useRefreshPrices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (investments: Investment[]) => {
      const { results, errors } = await fetchPrices(investments)

      const today = new Date().toISOString().slice(0, 10)
      await Promise.all(results.map(({ id, price }) => updatePrice(id, price, today)))

      return { updated: results.length, errors }
    },
    onSuccess: ({ updated, errors }) => {
      qc.invalidateQueries({ queryKey: ['investments'] })
      qc.invalidateQueries({ queryKey: ['price-history'] })

      if (errors.length === 0) {
        toast.success(`${updated} harga diperbarui`)
      } else if (updated > 0) {
        toast.success(`${updated} harga diperbarui`)
        toast.warning(`${errors.length} gagal: ${errors.map((e) => e.asset_name).join(', ')}`)
      } else {
        toast.error('Gagal mengambil harga')
      }
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

- [ ] **Step 3: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```
Expected: tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add src/queries/investments.ts
git commit -m "feat(queries): tambah useRefreshPrices mutation hook"
```

---

## Task 4: Tambah tombol Refresh di InvestmentsTab

**Files:**
- Modify: `src/tabs/InvestmentsTab.tsx`

- [ ] **Step 1: Tambah import `RefreshCw` dan `useRefreshPrices` di `InvestmentsTab.tsx`**

Ubah baris import lucide:
```typescript
import { Plus, Pencil, Trash2, TrendingUp, Upload, Download, RefreshCw } from 'lucide-react'
```

Tambah import hook:
```typescript
import { useInvestments, useDeleteInvestment, useRefreshPrices, costBasis, currentValue, gainLoss, gainLossPercent, type Investment } from '@/queries/investments'
```

- [ ] **Step 2: Inisialisasi hook di dalam komponen `InvestmentsTab`**

Setelah baris `const deleteInvestment = useDeleteInvestment()`, tambahkan:

```typescript
const refreshPrices = useRefreshPrices()
```

- [ ] **Step 3: Tambah tombol Refresh di toolbar**

Di dalam `<div className="flex justify-end gap-2">`, tambahkan tombol baru di antara `[Impor]` dan `[Tambah Investasi]`:

```typescript
<Button
  variant="outline"
  disabled={refreshPrices.isPending || rows.length === 0}
  onClick={() => refreshPrices.mutate(rows)}
>
  <RefreshCw className={`h-4 w-4 ${refreshPrices.isPending ? 'animate-spin' : ''}`} />
  {refreshPrices.isPending ? 'Memperbarui…' : 'Refresh Harga'}
</Button>
```

- [ ] **Step 4: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```
Expected: tidak ada error.

- [ ] **Step 5: Commit**

```bash
git add src/tabs/InvestmentsTab.tsx
git commit -m "feat(InvestmentsTab): tambah tombol Refresh Semua Harga"
```

---

## Task 5: Deploy Edge Function dan konfigurasi API key

> Butuh: akun metals.dev (daftar gratis di metals.dev), Supabase project linked.

- [ ] **Step 1: Daftar metals.dev dan dapatkan API key**

Buka `https://metals.dev` → Sign Up → copy API key dari dashboard.

- [ ] **Step 2: Set API key sebagai Supabase secret**

```bash
npx supabase secrets set METALS_DEV_API_KEY=your_api_key_here
```
Expected output: `Finished supabase secrets set.`

- [ ] **Step 3: Link project Supabase (jika belum)**

```bash
npx supabase login
npx supabase link
```
Ikuti prompt — pilih project `pfm-web`.

- [ ] **Step 4: Deploy Edge Function**

```bash
npx supabase functions deploy fetch-prices
```
Expected: `Deployed Function fetch-prices`

- [ ] **Step 5: Verifikasi deployment**

```bash
npx supabase functions list
```
Expected: `fetch-prices` muncul di daftar.

---

## Task 6: Test end-to-end

- [ ] **Step 1: Jalankan dev server**

```bash
npm run dev
```

- [ ] **Step 2: Buka tab Investasi**

Pastikan ada investasi dengan `asset_type = 'Saham'` (nama = kode IDX, misal `BBCA`) dan/atau `asset_type = 'Emas'`.

- [ ] **Step 3: Klik tombol "Refresh Harga"**

Expected:
- Tombol berubah jadi "Memperbarui…" + spinner
- Setelah selesai: toast hijau "X harga diperbarui"
- Kolom "Harga Kini" di tabel berubah ke harga terbaru

- [ ] **Step 4: Test error case — ticker salah**

Tambah investasi Saham dengan nama `ABCXYZ` (tidak valid). Klik Refresh Harga.

Expected: toast warning "1 gagal: ABCXYZ" — investasi lain tetap berhasil diupdate.

- [ ] **Step 5: Test case — tidak ada Saham/Emas**

Jika hanya ada Reksadana, klik Refresh Harga.

Expected: tombol tidak melakukan apa-apa (disabled jika `rows.length === 0`, atau toast "0 harga diperbarui").

- [ ] **Step 6: Commit final**

```bash
git add .
git commit -m "docs: update GAP_ANALYSIS — Gap 4 selesai"
```

---

## Catatan Deployment

- `METALS_DEV_API_KEY` hanya perlu di-set sekali di Supabase secrets (tidak perlu di `.env`)
- Free tier metals.dev: 100 req/bulan — cukup untuk pemakaian personal
- Yahoo Finance tidak butuh API key, tapi bisa berubah tanpa pemberitahuan
- Reksadana & Obligasi secara otomatis di-skip oleh Edge Function
