# Design Spec: Gap 4 — Refresh Harga Investasi Otomatis

**Tanggal:** 2026-04-20
**Status:** Approved

---

## Ringkasan

Tambah tombol "Refresh Semua Harga" di tab Investasi yang secara otomatis mengambil harga terkini untuk aset **Saham IDX** dan **Emas**. Reksadana dan Obligasi tetap diupdate manual.

---

## Arsitektur

```
InvestmentsTab
    → tombol "Refresh Semua Harga" diklik
    → panggil Supabase Edge Function: fetch-prices
        → untuk setiap Saham: Yahoo Finance (BBCA.JK, TLKM.JK, dll)
        → untuk Emas: metals.dev (XAU/USD) × open.er-api.com (USD/IDR)
        → return: [{ id, price }] atau error per aset
    → frontend loop: updatePrice(id, price, today) per aset
    → toast: "X harga diperbarui" + warning untuk yang gagal
```

---

## Sumber Data

| Asset Type | Sumber | Endpoint | API Key |
|------------|--------|----------|---------|
| Saham IDX | Yahoo Finance | `https://query1.finance.yahoo.com/v8/finance/chart/{asset_name}.JK` | Tidak perlu |
| Emas | metals.dev | `https://api.metals.dev/v1/latest?api_key={KEY}&currency=USD&unit=toz` | Ya (Supabase secret) |
| Kurs USD/IDR | open.er-api.com | `https://open.er-api.com/v6/latest/USD` | Tidak perlu |
| Reksadana | — | Tetap manual | — |
| Obligasi | — | Tetap manual | — |

**Ticker mapping Saham:** `asset_name` + `.JK` → Yahoo Finance ticker.
Contoh: `BBCA` → `BBCA.JK`, `regularMarketPrice` diambil dari response (dalam IDR).

**Harga Emas:**
```
harga_per_gram = (XAU_per_troy_oz / 31.1035) × USD_IDR
```
Ini adalah harga spot internasional — bisa berbeda dari harga Antam.

**Limit metals.dev free tier:** 100 req/bulan. Cukup untuk pemakaian personal (≤ 3 fetch/hari).

---

## UI

Tombol ditambahkan di toolbar yang sudah ada di `InvestmentsTab`:

```
[Ekspor] [Impor] [Refresh Semua Harga ↻] [Tambah Investasi]
```

**States tombol:**
- Default: `RefreshCw` icon + teks "Refresh Harga"
- Loading: disabled + spinner + teks "Memperbarui…"
- Selesai: kembali ke default

**Toast feedback:**
- Sukses: `"3 harga diperbarui"` (hijau)
- Partial: `"2 diperbarui, 1 gagal: TLKM (market tutup)"` (warning)
- Semua gagal: `"Gagal mengambil harga"` (merah)

---

## Perubahan File

| File | Perubahan |
|------|-----------|
| `supabase/functions/fetch-prices/index.ts` | Edge Function baru — proxy ke Yahoo Finance + metals.dev |
| `src/db/investments.ts` | Tambah `fetchPrices(investments[])` — memanggil Edge Function |
| `src/queries/investments.ts` | Tambah `useFetchPrices` mutation hook |
| `src/tabs/InvestmentsTab.tsx` | Tambah tombol Refresh Semua Harga + loading state + toast |

---

## Perubahan Database

Tidak ada. Schema tetap. Hasil fetch disimpan via fungsi `updatePrice()` yang sudah ada.

---

## Error Handling

- Saham tidak ditemukan (ticker salah): skip, tampilkan di toast warning
- Market tutup / data stale: tetap simpan harga terakhir yang tersedia dari Yahoo Finance
- metals.dev limit tercapai: tampilkan error spesifik "Kuota API emas habis"
- Network error: toast error keseluruhan

---

## Tidak Termasuk Scope

- Auto-refresh terjadwal (tidak ada cron)
- Notifikasi harga naik/turun
- Integrasi Reksadana (tetap manual)
- Harga Antam resmi (pakai spot internasional)
