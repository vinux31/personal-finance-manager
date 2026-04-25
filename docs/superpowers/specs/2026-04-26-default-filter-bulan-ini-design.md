# Default Filter "Bulan Ini" di TransactionsTab — Design Spec

**Tanggal:** 2026-04-26
**Status:** Draft → menunggu review user
**Lingkup:** Tab Transaksi auto-set filter Dari/Sampai ke rentang bulan berjalan saat session pertama load

## 1. Tujuan

Saat tab Transaksi pertama kali di-render dalam session, filter Dari otomatis = tanggal 1 bulan berjalan dan Sampai = tanggal terakhir bulan berjalan. Akibatnya:

- Summary card Pemasukan/Pengeluaran/Net menampilkan angka bulan ini (bukan all-time akumulasi)
- List transaksi hanya berisi transaksi bulan ini
- User tetap bisa hapus/ganti filter manual untuk lihat all-time atau bulan lain

Konsisten dengan tab Dashboard yang summary-nya juga scope bulan ini.

## 2. Konteks

### State sekarang

`src/tabs/TransactionsTab.tsx:37`:
```tsx
const [filters, setFilters] = useState<TransactionFilters>({})
```

Filter kosong → `useTransactions({})` query Supabase tanpa `dateFrom`/`dateTo` → kembalikan seluruh history. Summary card line 51-58 hitung totals dari `rows` ter-filter, jadi default = total all-time. Field input Dari/Sampai juga kosong di UI.

### Mount lifecycle

`src/App.tsx:103-124` pakai Radix `<Tabs>` tanpa `forceMount` di `<TabsContent>`. **Verified via UAT 2026-04-26:** Radix unmount tab inactive secara default. Artinya:

- Setiap kali user pindah tab dan balik ke Transaksi → component di-mount ulang
- `useState` initializer dipanggil fresh setiap re-mount → filter selalu = bulan berjalan saat itu
- Auto-rolling bulan: bahkan kalau user biarkan aplikasi terbuka semalam, cukup pindah tab + balik untuk dapat filter bulan baru

**Konsekuensi:** Filter user yang custom (mis. set ke Maret) akan ter-reset setiap kali pindah tab dan balik. User yang ingin lihat bulan non-current harus set ulang. Ini tradeoff acceptable mengingat goal "default = bulan ini" terpenuhi konsisten.

### Helper `format.ts` existing

`src/lib/format.ts` punya `formatRupiah`, `parseRupiah`, `todayISO`, `formatDateID`, `shortRupiah`, `categoryLabel`. Belum ada helper untuk "first/last day of month".

## 3. Perubahan

### 3.1 Tambah helper `currentMonthRange()`

**File:** `src/lib/format.ts` (append setelah `categoryLabel`)

```ts
export function currentMonthRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateFrom = `${y}-${pad(m + 1)}-01`
  const last = new Date(y, m + 1, 0).getDate()
  const dateTo = `${y}-${pad(m + 1)}-${pad(last)}`
  return { dateFrom, dateTo }
}
```

Pakai `new Date(y, m+1, 0)` untuk dapat hari terakhir bulan saat ini (handle 28/29/30/31 otomatis).

### 3.2 Set default filter di TransactionsTab

**File:** `src/tabs/TransactionsTab.tsx:25` (import) dan `:37` (initializer)

Update import baris 25:
```tsx
import { formatRupiah, formatDateID, todayISO, categoryLabel, currentMonthRange } from '@/lib/format'
```

Update line 37:
```tsx
// before
const [filters, setFilters] = useState<TransactionFilters>({})

// after
const [filters, setFilters] = useState<TransactionFilters>(() => currentMonthRange())
```

Pakai initializer function (`() => ...`) supaya `currentMonthRange()` dipanggil sekali saat mount, bukan setiap render.

## 4. Yang TIDAK termasuk (YAGNI)

- ❌ Tidak menambah preset toggle "Bulan Lalu / 3 Bulan / Tahun Ini"
- ❌ Tidak persist filter ke localStorage atau Zustand store — filter selalu fresh per session
- ❌ Tidak ubah default filter NotesTab atau tab lain
- ❌ Tidak update `exportTransactionsCsv` agar respect filter — meskipun setelah perubahan Ekspor akan inkonsisten dengan tampilan UI (Ekspor selalu all-time, tampilan = bulan ini), itu di-flag sebagai catatan untuk fix terpisah jika diperlukan
- ❌ Tidak menambah unit test (proyek ini tidak punya unit test framework)

## 5. Risiko

| Risiko | Mitigasi |
|---|---|
| User existing kaget angka summary tiba-tiba berbeda | Behavior baru intuitif, sejalan dengan tab Dashboard. User clear filter Dari → kembali all-time |
| Ekspor CSV tidak ikut filter (existing) | Out of scope, sudah ada di section 4. Flag worth diketahui |
| Edge case bulan Februari | `new Date(y, m+1, 0).getDate()` handle leap year benar (2024-02 = 29, 2025-02 = 28) |
| User biarkan tab terbuka melewati tengah malam akhir bulan | Filter tetap bulan lama sampai reload — acceptable, bukan fungsi kritis |

## 6. Verifikasi (UAT)

Setelah deploy:

1. Reload halaman → buka tab Transaksi.
2. **Expected:** Field Dari = `2026-04-01`, Sampai = `2026-04-30`. Summary card menampilkan angka April saja. List berisi transaksi April saja.
3. Klik field Dari → kosongkan → tab keluar field.
4. **Expected:** List menampilkan seluruh history (kembali ke all-time). Summary card update mengikuti.
5. Set Dari = `2026-03-01`, Sampai = `2026-03-31`.
6. **Expected:** Filter ke Maret. List hanya transaksi Maret.
7. Pindah ke tab Dashboard, lalu balik ke Transaksi.
8. **Expected:** Filter ter-reset ke bulan berjalan (`2026-04-01`/`2026-04-30`) karena Radix unmount tab inactive. Behavior ini desired untuk goal "default = bulan ini".
9. Klik tombol Ekspor.
10. **Expected:** CSV berisi seluruh history (existing behavior unchanged) — flag.

## 7. Rollback Plan

Jika ada masalah: revert commit, redeploy Vercel (~30 detik). Tidak ada perubahan DB, tidak ada migration. Sepenuhnya client-side.
