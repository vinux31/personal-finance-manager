# Default Filter "Bulan Ini" di TransactionsTab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tab Transaksi auto-set filter Dari/Sampai ke rentang bulan berjalan saat session pertama load, agar summary card dan list konsisten dengan tab Dashboard.

**Architecture:** Tambah helper `currentMonthRange()` di `src/lib/format.ts`. Ubah initializer `useState<TransactionFilters>` di `src/tabs/TransactionsTab.tsx` agar memanggil helper. Tidak ada perubahan DB, RPC, atau komponen lain.

**Tech Stack:** TypeScript, React 19, @tanstack/react-query (existing).

**Spec:** `docs/superpowers/specs/2026-04-26-default-filter-bulan-ini-design.md`

**Catatan TDD:** Repo ini tidak punya unit test framework. Verifikasi pakai `tsc -b` (type check) dan UAT manual di browser, konsisten dengan plan sebelumnya.

---

## File Structure

| File | Aksi | Tanggung jawab |
|---|---|---|
| `src/lib/format.ts` | Modify | Tambah helper `currentMonthRange()` |
| `src/tabs/TransactionsTab.tsx` | Modify | Import helper + ubah initializer `useState` |

---

### Task 1: Tambah helper `currentMonthRange()` di `format.ts`

**Files:**
- Modify: `src/lib/format.ts` (append setelah `categoryLabel`)

- [ ] **Step 1: Append helper**

Tambahkan di akhir file `src/lib/format.ts`, setelah fungsi `categoryLabel`:

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

Catatan: `new Date(y, m+1, 0)` mengembalikan hari terakhir bulan saat ini (handle 28/29/30/31 otomatis termasuk leap year).

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS, output `✓ built in ...s`. Tidak ada error TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat(format): helper currentMonthRange untuk default filter bulan berjalan"
```

---

### Task 2: Update import dan initializer di `TransactionsTab.tsx`

**Files:**
- Modify: `src/tabs/TransactionsTab.tsx:25` (import) dan `:37` (initializer)

- [ ] **Step 1: Tambah `currentMonthRange` ke import baris 25**

Di `src/tabs/TransactionsTab.tsx`, ubah:

```tsx
import { formatRupiah, formatDateID, todayISO, categoryLabel } from '@/lib/format'
```

menjadi:

```tsx
import { formatRupiah, formatDateID, todayISO, categoryLabel, currentMonthRange } from '@/lib/format'
```

- [ ] **Step 2: Ganti initializer `useState`**

Di `src/tabs/TransactionsTab.tsx`, ubah baris 37:

```tsx
const [filters, setFilters] = useState<TransactionFilters>({})
```

menjadi:

```tsx
const [filters, setFilters] = useState<TransactionFilters>(() => currentMonthRange())
```

Pakai initializer function (`() => ...`) agar `currentMonthRange()` dipanggil sekali saat mount, bukan setiap render.

- [ ] **Step 3: Type-check & lint**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/tabs/TransactionsTab.tsx
git commit -m "feat(transactions): default filter Dari/Sampai ke bulan berjalan"
```

---

### Task 3: UAT Manual + Push

**Files:** (no file edits)

- [ ] **Step 1: Jalankan dev server**

```bash
cd "C:/Users/Administrator/OneDrive - PT Pertamina (Persero)/Desktop/pfm-web"
npm run dev
```

Buka URL yang ditampilkan (biasanya http://localhost:5173).

- [ ] **Step 2: UAT — Default filter on first load**

1. Login (kalau belum), pindah ke tab **Transaksi**.
2. **Expected:** Field Dari = `2026-04-01`, Sampai = `2026-04-30`. Summary card menampilkan angka April. List berisi transaksi April saja.

- [ ] **Step 3: UAT — Clear filter Dari**

1. Klik field Dari, hapus tanggal sampai kosong, Tab/blur out.
2. **Expected:** List update menampilkan seluruh history (kembali ke all-time). Summary card recompute mengikuti.

- [ ] **Step 4: UAT — Ganti ke bulan lain**

1. Set Dari = `2026-03-01`, Sampai = `2026-03-31`.
2. **Expected:** List dan summary scope ke Maret saja.

- [ ] **Step 5: UAT — Switch tab persist state**

1. Pindah ke tab Dashboard.
2. Balik ke tab Transaksi.
3. **Expected:** Filter Maret tetap aktif (Radix Tabs tidak unmount, state persist).

- [ ] **Step 6: UAT — Reload halaman**

1. Refresh browser (F5 atau Ctrl+R).
2. **Expected:** Filter kembali ke bulan berjalan (`2026-04-01` s/d `2026-04-30`) — initializer di-call ulang saat re-mount.

- [ ] **Step 7: UAT — Ekspor CSV (regression check)**

1. Klik tombol Ekspor di toolbar.
2. **Expected:** CSV berisi seluruh history (Ekspor tidak respect filter — existing behavior unchanged, sesuai catatan di spec section 4).

- [ ] **Step 8: Push ke production**

Setelah semua UAT pass:

```bash
git push origin master
```

Tunggu ~30 detik untuk Vercel auto-deploy. Cek production URL untuk konfirmasi default filter benar di sana juga.

---

## Self-Review

✅ **Spec coverage:**
- Section 3.1 helper `currentMonthRange()` → Task 1
- Section 3.2 import + initializer → Task 2
- Section 6 UAT 10 langkah → Task 3 step 2-7 (7 step UAT, 3 step UAT spec asli digabung karena saling related)

✅ **Placeholder scan:** Tidak ada TBD/TODO. Semua kode konkret, semua perintah eksak.

✅ **Type consistency:** `currentMonthRange()` return `{ dateFrom: string; dateTo: string }` cocok dengan `TransactionFilters` interface di `src/db/transactions.ts:13-19` (`dateFrom?: string`, `dateTo?: string`). Initializer return type sesuai.
