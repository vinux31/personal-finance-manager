# Design: Hapus Tab Dividen

**Tanggal:** 2026-04-21
**Status:** Approved

## Latar Belakang

Tab Dividen dinilai terlalu kompleks dan belum pernah digunakan (tidak ada data yang diinput). Tab Investasi sudah cukup untuk kebutuhan tracking aset saham. Keputusan: hapus tab Dividen beserta seluruh kode terkait.

## Pendekatan

Opsi A — Hapus Total: hapus tab, semua komponen, hooks, dan DB layer dividen. Bersihkan referensi di file yang masih dipakai. Tabel di Supabase dibiarkan (tidak perlu drop).

## Files yang Dihapus (7 file)

```
src/tabs/DividenTab.tsx
src/components/DividenSummaryCards.tsx
src/components/DividenHoldingsTable.tsx
src/components/DividenTransactionDialog.tsx
src/components/SectorPieChart.tsx
src/db/dividends.ts
src/queries/dividends.ts
```

## Perubahan di File Existing

### `src/App.tsx`
- Hapus `import DividenTab from '@/tabs/DividenTab'`
- Hapus `Banknote` dari lucide-react imports
- Hapus entry `{ value: 'dividen', label: 'Dividen', icon: Banknote, Comp: DividenTab }` dari array `TABS`

### `src/tabs/InvestmentsTab.tsx`
- Hapus `ExternalLink` dari lucide-react imports (baris 9)
- Hapus `import { useTabStore } from '@/lib/tabStore'` (baris 11)
- Hapus `const { setActiveTab } = useTabStore()` (baris 28)
- Hapus block baris 130-133: tombol ExternalLink yang navigasi ke tab Dividen

### `src/db/investments.ts`
- Hapus field `bei_stock_id: number | null` dari interface `Investment`
- Hapus `bei_stock_id` dari string `.select(...)` di `listInvestments` dan `getInvestment`
- Sederhanakan filter `.or('bei_stock_id.is.null,quantity.gt.0')` menjadi `.gt('quantity', 0)`

## Yang Tidak Disentuh

- Tabel Supabase: `bei_stocks`, `dividend_transactions`, kolom `bei_stock_id` di tabel `investments` — dibiarkan di database
- Semua tab lain tidak terpengaruh

## Hasil yang Diharapkan

- Tidak ada dead code
- Tab bar berkurang dari 8 menjadi 7 tab
- InvestmentsTab lebih bersih tanpa dependency ke tabStore
- Build tidak ada error TypeScript
