# Bug Scan Report — PFM Web (React/TypeScript)

**Tanggal Review:** 2026-04-19  
**Reviewer:** Claude (gsd-code-reviewer)  
**Scope:** Logika bisnis, State Management (TanStack Query), UI/Form handling  
**Files Reviewed:** 21 file

---

## Ringkasan Temuan

| Severity | Jumlah |
|----------|--------|
| CRITICAL | 2      |
| HIGH     | 6      |
| MEDIUM   | 6      |
| LOW      | 4      |
| **Total**| **18** |

---

## CRITICAL

### CR-01: Race Condition pada `addMoneyToGoal` — Potensi Data Corruption

**File:** `src/db/goals.ts` — baris 82–93  
**Dampak:** Jika dua request `addMoneyToGoal` dieksekusi hampir bersamaan untuk goal yang sama, keduanya membaca `current_amount` yang belum diperbarui, lalu masing-masing menulis hasil penjumlahan yang salah. Dana yang seharusnya bertambah dua kali hanya bertambah sekali (lost write).

**Kode bermasalah:**
```ts
export async function addMoneyToGoal(id: number, amount: number): Promise<void> {
  const goal = await getGoal(id)           // READ
  const newAmount = goal.current_amount + amount
  await supabase.from('goals').update({ current_amount: newAmount }) // WRITE
  // Antara READ dan WRITE, request lain bisa membaca nilai lama
}
```

**Fix:** Gunakan SQL increment atomik via RPC atau Supabase `.rpc()` untuk menghindari read-modify-write race:
```ts
// Opsi 1: Supabase increment (jika tersedia di schema)
const { error } = await supabase.rpc('increment_goal_amount', {
  p_id: id,
  p_amount: amount,
})

// Opsi 2: Raw SQL increment (aman secara atomik)
const { error } = await supabase
  .from('goals')
  .update({ current_amount: supabase.raw('current_amount + ?', [amount]) })
  .eq('id', id)
```
Minimal, tambahkan optimistic locking atau gunakan transaction di level Postgres.

---

### CR-02: `parseRupiah` Membuang Tanda Minus — Kalkulasi Salah pada Nilai Negatif

**File:** `src/lib/format.ts` — baris 12–15  
**Dampak:** Regex `[^\d-]` seharusnya sudah mengizinkan tanda minus, **tetapi** tanda minus di tengah string (misal hasil copy-paste `"Rp -1.500.000"` atau `"-1,500"`) tetap diparse dengan benar. Namun, kalau user mengetik nilai negatif seperti `-500` pada field amount investasi yang `current_price`-nya bisa negatif secara teori, `parseRupiah("-500")` menghasilkan `-500` — value negatif ini **lolos validasi `price <= 0`** di `PriceUpdateDialog` (baris 41: `if (price <= 0)`).

Lebih kritis: di `InvestmentDialog` baris 77, `currentPriceStr` yang berisi `-100` menghasilkan `current_price = -100`. Validasi di `createInvestment` hanya mengecek `buy_price < 0` dan `quantity < 0`, **tidak mengecek `current_price < 0`** (src/db/investments.ts baris 51–53).

**Kode bermasalah:**
```ts
// src/lib/format.ts:13
const cleaned = s.replace(/[^\d-]/g, '')
// "-100" → -100, lolos ke DB sebagai current_price negatif

// src/db/investments.ts:51-53
if (i.quantity < 0) throw new Error(...)
if (i.buy_price < 0) throw new Error(...)
// TIDAK ada validasi current_price < 0
```

**Fix:**
```ts
// src/db/investments.ts — createInvestment & updateInvestment
if (i.current_price !== null && i.current_price < 0)
  throw new Error('Harga saat ini tidak boleh negatif')

// src/lib/format.ts — parseRupiah harus strip tanda minus untuk field amount
export function parseRupiah(s: string): number {
  const cleaned = s.replace(/[^\d]/g, '') // hilangkan semua non-digit untuk field positif
  return cleaned === '' ? 0 : Number(cleaned)
}
// Catatan: jika tanda minus memang diperlukan, buat fungsi terpisah parseRupiahSigned()
```

---

## HIGH

### H-01: Filter `categoryId` Mengabaikan Nilai `0` — Category dengan ID=0 Tidak Bisa Difilter

**File:** `src/db/transactions.ts` — baris 38  
**Dampak:** Jika database pernah memiliki kategori dengan `id = 0` (atau jika ID auto-increment mulai dari 0), filter kategori tidak akan diterapkan karena `0` adalah falsy di JavaScript.

**Kode bermasalah:**
```ts
if (f.categoryId) query = query.eq('category_id', f.categoryId)
//  ^^^^^^^^^^^ 0 adalah falsy, kondisi tidak terpenuhi
```

**Fix:**
```ts
if (f.categoryId != null) query = query.eq('category_id', f.categoryId)
```

---

### H-02: Import CSV Transaksi Tidak Invalidasi TanStack Query Cache

**File:** `src/tabs/TransactionsTab.tsx` — baris 106–116  
**Dampak:** Setelah `importTransactionsCsv()` berhasil memasukkan data baru, halaman **tidak otomatis refresh**. User melihat tabel lama sampai reload manual. Ini terjadi karena `importTransactionsCsv` memanggil `createTransaction` langsung (bukan via mutation hook), sehingga cache `['transactions']` tidak diinvalidasi.

**Kode bermasalah:**
```ts
// TransactionsTab.tsx:110-111
const r = await importTransactionsCsv(text)
if (r.inserted > 0) toast.success(...)
// Cache ['transactions'] TIDAK diinvalidasi, UI tidak update
```

**Fix:**
```ts
// Tambahkan invalidasi setelah import berhasil
const qc = useQueryClient()
// ...
const r = await importTransactionsCsv(text)
if (r.inserted > 0) {
  qc.invalidateQueries({ queryKey: ['transactions'] })
  toast.success(...)
}
```

---

### H-03: Import CSV Investasi Tidak Invalidasi TanStack Query Cache

**File:** `src/tabs/InvestmentsTab.tsx` — baris 54–64  
**Dampak:** Sama dengan H-02 tetapi untuk investasi. Setelah `importInvestmentsCsv()` memasukkan data, cache `['investments']` dan `['asset-types']` tidak diinvalidasi. Tabel investasi tidak update secara otomatis.

**Fix:**
```ts
const r = await importInvestmentsCsv(text)
if (r.inserted > 0) {
  qc.invalidateQueries({ queryKey: ['investments'] })
  qc.invalidateQueries({ queryKey: ['asset-types'] })
  toast.success(...)
}
```

---

### H-04: `usePriceHistory` Dipanggil dengan ID `0` — Query Tidak Perlu ke DB

**File:** `src/components/PriceUpdateDialog.tsx` — baris 28  
**Dampak:** Ketika `investment` adalah `null`, `usePriceHistory(0)` tetap dieksekusi dan mengirim request ke Supabase dengan `investment_id = 0`. Ini menyebabkan network request yang tidak perlu dan bisa mengembalikan data yang tidak diinginkan jika ada baris dengan `investment_id = 0`.

**Kode bermasalah:**
```ts
const { data: history = [] } = usePriceHistory(investment?.id ?? 0)
// Ketika investment=null, query berjalan dengan id=0
```

**Fix:**
```ts
const { data: history = [] } = usePriceHistory(investment?.id ?? 0, {
  enabled: investment != null,
})
// Perlu update signature usePriceHistory untuk terima options

// Atau di queries/investments.ts:
export function usePriceHistory(investmentId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['price-history', investmentId],
    queryFn: () => getPriceHistory(investmentId),
    enabled: options?.enabled !== false && investmentId > 0,
  })
}
```

---

### H-05: `GoalDialog` — `currentStr` Diinisialisasi `'0'` saat Create, Tapi Parsing Bisa Rusak

**File:** `src/components/GoalDialog.tsx` — baris 61  
**Dampak:** `parseRupiah('0')` menghasilkan `0` dengan benar. Namun, ketika edit mode, `setCurrentStr(String(editing.current_amount))` menghasilkan string seperti `"5000000"` — format angka biasa tanpa separator. Ketika ditampilkan di field input tanpa `formatRupiah`, user tidak mendapat feedback visual. Lebih penting: jika `editing.current_amount` adalah float (misal `5000000.50` dari DB), `parseRupiah("5000000.50")` dengan regex `[^\d-]` akan menghasilkan `500000050` (titik desimal dihapus, digit bergabung) — **nilai 100x lebih besar dari yang benar**.

**Kode bermasalah:**
```ts
// GoalDialog.tsx:45
setCurrentStr(String(editing.current_amount)) // e.g. "5000000.5"
// ...
const current = parseRupiah(currentStr || '0')
// parseRupiah("5000000.5") → remove non-digit → "50000005" → 50000005 ✗
```

**Fix:**
```ts
// Gunakan Math.round untuk memastikan integer sebelum stringify
setCurrentStr(String(Math.round(editing.current_amount)))
setTargetStr(String(Math.round(editing.target_amount)))
```
Dan lakukan hal yang sama di `GoalDialog` untuk `targetStr`, serta di `InvestmentDialog` untuk `buyPriceStr` dan `currentPriceStr`.

---

### H-06: `formatDateID` Menggunakan Local `new Date(iso)` — Off-by-One-Day karena Timezone

**File:** `src/lib/format.ts` — baris 25–33  
**Dampak:** `new Date('2025-01-15')` diparse sebagai **UTC midnight** (`2025-01-15T00:00:00Z`). Ketika `toLocaleDateString('id-ID')` dipanggil di timezone UTC+7 (WIB), hasilnya tetap benar. **Tetapi** di timezone yang lebih barat dari UTC (misalnya UTC-5), hasilnya menjadi `14 Jan 2025` (satu hari sebelumnya). Ini adalah bug timezone klasik pada ISO date string tanpa time component.

**Kode bermasalah:**
```ts
export function formatDateID(iso: string): string {
  const d = new Date(iso) // "2025-01-15" → UTC midnight → bisa jadi 14 Jan di timezone negatif
  return d.toLocaleDateString('id-ID', ...)
}
```

**Fix:**
```ts
export function formatDateID(iso: string): string {
  if (!iso) return ''
  // Parse manual untuk menghindari timezone interpretation
  const [year, month, day] = iso.split('-').map(Number)
  const d = new Date(year, month - 1, day) // Local date, bukan UTC
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
```

---

## MEDIUM

### M-01: `DashboardTab` Menggunakan `useTransactions()` Tanpa Filter — Fetch Seluruh History

**File:** `src/tabs/DashboardTab.tsx` — baris 23  
**Dampak:** `useTransactions()` dipanggil tanpa filter untuk mengambil 5 transaksi terakhir. Ini memuat **seluruh** riwayat transaksi dari DB hanya untuk menampilkan 5 baris. Pada user dengan ratusan/ribuan transaksi, ini menyebabkan query lambat dan payload besar yang tidak diperlukan.

**Kode bermasalah:**
```ts
const { data: allTransactions = [] } = useTransactions()
// ...
const recentTx = useMemo(() => allTransactions.slice(0, 5), [allTransactions])
```

**Catatan:** Ini juga berarti cache `['transactions', {}]` terpisah dari `['transactions', filters]` yang digunakan di `TransactionsTab`, sehingga ada duplikasi data di cache.

**Fix:** Tambahkan limit query, atau buat fungsi `listRecentTransactions(limit: number)` yang khusus menggunakan `.limit(5)` di Supabase query.

---

### M-02: `ReportsTab` — Pie Chart Label Accessor Salah Type

**File:** `src/tabs/ReportsTab.tsx` — baris 115  
**Dampak:** Label pada Pie chart menggunakan accessor `(e) => String((e as { name?: string }).name ?? '')`. Namun Recharts meneruskan object berbeda ke fungsi label — properti yang benar adalah `e.name` (dari `nameKey="category"`) atau `e.value`. Type assertion manual ini rapuh dan kemungkinan besar mengembalikan string kosong karena properti yang diakses salah, sehingga label pie chart **tidak muncul**.

**Kode bermasalah:**
```ts
<Pie ... label={(e) => String((e as { name?: string }).name ?? '')}>
// Recharts label prop menerima PieLabelRenderProps, bukan {name}
// Properti yang tepat adalah e.name (sudah ada) atau gunakan renderCustomizedLabel
```

**Fix:**
```ts
// Recharts meneruskan {name, value, percent, ...} ke label function
<Pie ... label={(entry) => entry.name}>
```

---

### M-03: `InvestmentDialog` — `parseRupiah` Digunakan untuk `buyPrice` tapi `qtyStr` Menggunakan `Number()`

**File:** `src/components/InvestmentDialog.tsx` — baris 75–77  
**Dampak:** Inkonsistensi parsing. `qty` diparse dengan `Number(qtyStr)` yang menerima format desimal (`"1.5"` → `1.5`). Namun `buyPrice` diparse dengan `parseRupiah(buyPriceStr)` yang menghapus semua karakter non-digit kecuali minus — sehingga `"1.500"` menjadi `1500` (benar untuk Rupiah), tetapi `"1500.50"` menjadi `150050` (salah). Jika user mengetik harga dengan desimal, nilai tersimpan akan salah.

Lebih jauh, `qtyStr` pada baris 148 juga menggunakan `Number(qtyStr) || 0` untuk kalkulasi preview "Total modal", tapi validasi di baris 78 menggunakan `qty <= 0` dimana `qty = Number(qtyStr)`. Jika user mengetik `"1,5"` (koma sebagai desimal, umum di Indonesia), `Number("1,5")` menghasilkan `NaN`, validasi `NaN <= 0` adalah `false`, sehingga nilai `NaN` lolos ke DB.

**Fix:**
```ts
// Normalisasi input sebelum Number()
const qty = Number(qtyStr.replace(',', '.'))
if (isNaN(qty) || qty <= 0) {
  toast.error('Kuantitas tidak valid')
  return
}
```

---

### M-04: `csvTransactions.ts` — Import Berurutan (Sequential) Sangat Lambat

**File:** `src/db/csvTransactions.ts` — baris 49–74  
**Dampak:** Setiap baris CSV diimport satu per satu dengan `await createTransaction(...)` dalam loop. Untuk 1000 baris, ini berarti 1000 round-trips ke Supabase secara berurutan. Dengan latency 100ms per request, ini memakan waktu ~100 detik.

**Kode bermasalah:**
```ts
for (let i = 1; i < rows.length; i++) {
  // ...
  await createTransaction({...}) // Sequential, SANGAT lambat untuk banyak baris
}
```

**Fix:** Gunakan batch insert. Kumpulkan semua valid rows terlebih dahulu, kemudian insert dalam satu atau beberapa batch:
```ts
const validRows = []
for (let i = 1; i < rows.length; i++) {
  // validasi...
  validRows.push({ date, type, category_id: catId, amount, note: note || null })
}
// Batch insert
const { error } = await supabase.from('transactions').insert(validRows)
```

---

### M-05: `addMoneyToGoal` — Toast "Goal Tercapai" Menggunakan Data Stale

**File:** `src/components/AddMoneyDialog.tsx` — baris 42–43  
**Dampak:** Setelah `mutateAsync` selesai, kode mengecek `goal.target_amount - (goal.current_amount + amount)` menggunakan nilai `goal` dari prop (data lama sebelum mutation). Ini berarti pesan "Selamat! Goal tercapai" bisa muncul bahkan jika sebenarnya belum tercapai (misalnya jika ada penambahan dana sebelumnya yang belum terupdate di UI), atau tidak muncul jika seharusnya muncul.

**Kode bermasalah:**
```ts
await addMoney.mutateAsync({ id: goal.id, amount })
const remaining = goal.target_amount - (goal.current_amount + amount)
// goal.current_amount adalah nilai SEBELUM mutation, bisa stale
if (remaining <= 0) toast.success('Selamat! Goal tercapai 🎉')
```

**Fix:** Cek kondisi tercapai berdasarkan response dari server, atau pindahkan toast ke dalam `onSuccess` di mutation hook dengan data yang direturn dari server:
```ts
// Di queries/goals.ts, update addMoneyToGoal untuk return goal baru
// Atau di AddMoneyDialog, baca dari cache yang sudah diinvalidasi via onSuccess callback
```

---

### M-06: `parseCsv` — Trailing Whitespace / Empty Lines Ditengah File Tidak Ditangani

**File:** `src/lib/csv.ts` — baris 63–70  
**Dampak:** Fungsi `parseCsv` hanya menghapus **satu** baris kosong di akhir file (baris 68–70). Jika file CSV memiliki baris kosong di tengah (baris yang hanya berisi `\n` atau spasi), baris tersebut tetap diproses dan akan menghasilkan error "Format tanggal harus YYYY-MM-DD" di `importTransactionsCsv` karena field-nya kosong. Error ini akan di-log sebagai baris bermasalah, membingungkan user.

**Fix:**
```ts
// Di importTransactionsCsv, tambahkan filter baris kosong
for (let i = 1; i < rows.length; i++) {
  const r = rows[i]
  if (r.every(cell => cell.trim() === '')) { result.skipped++; continue } // skip empty rows
  // ... rest of processing
}
```

---

## LOW

### L-01: `TransactionDialog` — Tidak Ada Validasi Format Tanggal

**File:** `src/components/TransactionDialog.tsx` — baris 65  
**Dampak:** Validasi `if (!date ...)` hanya mengecek string kosong. Jika browser tidak mendukung `type="date"` input (misalnya browser lama) dan user mengetik format tanggal yang salah (misal `"15-01-2025"`), tanggal yang tidak valid akan tersimpan ke DB dan akan menyebabkan masalah pada query/filter.

**Fix:**
```ts
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  toast.error('Format tanggal tidak valid')
  return
}
```

---

### L-02: `GoalDialog` — `current_amount > target_amount` Tidak Divalidasi di Form

**File:** `src/components/GoalDialog.tsx` — baris 58–82  
**Dampak:** User bisa membuat/edit goal dengan `current_amount` lebih besar dari `target_amount` (misalnya target 1jt, terkumpul 5jt). Ini menyebabkan `goalProgress()` mengembalikan `100%` (karena `Math.min(100, ...)`) yang menyembunyikan data tidak konsisten. Status juga tidak otomatis diset ke `'completed'` meskipun dana sudah melebihi target.

**Fix:**
```ts
if (current > target) {
  toast.error('Dana terkumpul tidak boleh melebihi target')
  return
}
```

---

### L-03: `DashboardTab` — Icon Pemasukan/Pengeluaran Terbalik

**File:** `src/tabs/DashboardTab.tsx` — baris 91–93  
**Dampak:** Icon `ArrowDownCircle` digunakan untuk pemasukan (income) dan `ArrowUpCircle` untuk pengeluaran (expense). Secara semantik finansial, pemasukan biasanya direpresentasikan dengan panah ke atas (uang masuk ke akun). Ini juga inkonsisten dengan ikon yang sama di `TransactionsTab.tsx` baris 150 yang menggunakan konvensi yang sama (terbalik).

Catatan: Ini mungkin desain yang disengaja (uang turun = masuk ke kantong). Namun perlu dikonfirmasi konsistensinya.

---

### L-04: `ReportsTab` — Kinerja Investasi Menggunakan LineChart, Bukan BarChart

**File:** `src/tabs/ReportsTab.tsx` — baris 141–151  
**Dampak:** Data investasi `investments` adalah array per-aset (statis, bukan time series). `LineChart` dengan data ini akan menggambar garis yang menghubungkan aset-aset berbeda secara berurutan — ini tidak bermakna secara visual karena urutan aset tidak memiliki signifikansi urutan. BarChart lebih tepat untuk perbandingan nilai antar aset.

**Fix:** Ganti `LineChart` dan `Line` dengan `BarChart` dan `Bar` untuk chart "Kinerja Investasi":
```tsx
<BarChart data={investments}>
  <Bar dataKey="modal" name="Modal" fill="#64748b" />
  <Bar dataKey="nilai" name="Nilai Kini" fill="#0ea5e9" />
</BarChart>
```

---

## Catatan Tambahan — Tidak Bug, Tapi Perlu Perhatian

### updateInvestment Tidak Mencatat Riwayat Harga

**File:** `src/db/investments.ts` — baris 79–95  
Ketika investasi diedit dan `current_price` berubah, perubahan harga ini **tidak** dicatat ke tabel `price_history`. Hanya `updatePrice()` yang mencatat riwayat. Ini berarti jika user mengedit harga melalui form edit (bukan tombol "Update Harga"), riwayat harga tidak terbentuk. Ini mungkin desain yang disengaja, tetapi sebaiknya dikonfirmasi.

### createInvestment Error pada price_history Tidak Roll Back investasi

**File:** `src/db/investments.ts` — baris 69–75  
Jika insert ke `price_history` gagal setelah investasi berhasil dibuat (baris 70–74), investment sudah tersimpan di DB tetapi price_history tidak ada. Tidak ada try-catch atau rollback. Ini menyebabkan data tidak konsisten.

```ts
// Tidak ada error handling untuk insert price_history
if (i.current_price != null) {
  await supabase.from('price_history').insert({...}) // error di sini tidak di-throw ke caller
  // Error dari .insert() diabaikan karena tidak ada: if (error) throw error
}
```

**Fix:**
```ts
if (i.current_price != null) {
  const { error: phError } = await supabase.from('price_history').insert({...})
  if (phError) throw phError // Lempar error agar caller tahu
}
```

---

*Report generated: 2026-04-19*  
*Reviewer: Claude (gsd-code-reviewer)*
