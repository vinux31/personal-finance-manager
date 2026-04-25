# Kategori Expense Tambahan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah 3 kategori expense (🚬 Rokok, 🧺 Laundry, ☕ Kopi) ke tabel `categories` Supabase, plus aktifkan rendering kolom `icon` di seluruh UI yang menampilkan kategori.

**Architecture:** Satu migration SQL idempotent + update tipe `Category` agar include `icon` + helper `categoryLabel(cat)` di `src/lib/format.ts` + replace render `{c.name}` → `categoryLabel(c)` di 4 file UI. Tidak ada perubahan RPC/server.

**Tech Stack:** PostgreSQL (Supabase), TypeScript, React 19, Tailwind, shadcn/ui, @tanstack/react-query, Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-04-25-kategori-expense-tambahan-design.md`

**Catatan TDD:** Repo ini tidak punya unit test framework (cek `package.json` — tidak ada `vitest`/`jest`). Verifikasi pakai `tsc -b` (type check), `eslint .` (lint), dan UAT manual di browser. Pattern ini konsisten dengan commit terbaru `c8b7a74 test(panduan): UAT manual semua PASS`.

---

## File Structure

| File | Aksi | Tanggung jawab |
|---|---|---|
| `supabase/migrations/0016_kategori_expense_tambahan.sql` | Create | INSERT 3 kategori expense baru |
| `src/db/categories.ts` | Modify | Tambah `icon` di interface & SELECT |
| `src/lib/format.ts` | Modify | Tambah helper `categoryLabel(cat)` |
| `src/components/TransactionDialog.tsx` | Modify | Render emoji di dropdown kategori |
| `src/tabs/TransactionsTab.tsx` | Modify | Render emoji di filter dropdown + kolom kategori list |
| `src/components/RecurringDialog.tsx` | Modify | Render emoji di dropdown kategori |
| `src/components/RecurringListDialog.tsx` | Modify | Render emoji via `getCategoryName` → `getCategoryLabel` |

---

### Task 1: Buat SQL migration

**Files:**
- Create: `supabase/migrations/0016_kategori_expense_tambahan.sql`

- [ ] **Step 1: Tulis migration**

File: `supabase/migrations/0016_kategori_expense_tambahan.sql`

```sql
-- supabase/migrations/0016_kategori_expense_tambahan.sql
-- Tambah 3 kategori expense untuk tracking pengeluaran harian
INSERT INTO categories (name, type, icon) VALUES
  ('Rokok',   'expense', '🚬'),
  ('Laundry', 'expense', '🧺'),
  ('Kopi',    'expense', '☕')
ON CONFLICT (name, type) DO NOTHING;
```

- [ ] **Step 2: Commit migration**

```bash
git add supabase/migrations/0016_kategori_expense_tambahan.sql
git commit -m "feat(db): tambah kategori expense Rokok, Laundry, Kopi (migration 0016)"
```

---

### Task 2: Update interface `Category` & SELECT include `icon`

**Files:**
- Modify: `src/db/categories.ts:3-20`

- [ ] **Step 1: Update interface dan query**

File: `src/db/categories.ts` — replace seluruh isi dengan:

```ts
import { supabase } from '@/lib/supabase'

export interface Category {
  id: number
  name: string
  type: 'income' | 'expense'
  icon: string | null
}

export async function listCategories(type?: 'income' | 'expense'): Promise<Category[]> {
  let query = supabase
    .from('categories')
    .select('id, name, type, icon')
    .order('name')

  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) throw error
  return data as Category[]
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS (no type errors). Akan ada warning di TransactionDialog/TransactionsTab/dst karena belum render icon — itu wajar, bukan error.

- [ ] **Step 3: Commit**

```bash
git add src/db/categories.ts
git commit -m "feat(categories): include icon di interface Category dan SELECT"
```

---

### Task 3: Tambah helper `categoryLabel` di `src/lib/format.ts`

**Files:**
- Modify: `src/lib/format.ts` (append at end of file)

- [ ] **Step 1: Append helper**

Tambahkan di akhir file `src/lib/format.ts` (setelah fungsi `shortRupiah`):

```ts
export function categoryLabel(cat: { name: string; icon: string | null }): string {
  return cat.icon ? `${cat.icon} ${cat.name}` : cat.name
}
```

Catatan signature: pakai structural type `{ name; icon }` (bukan import `Category`) untuk hindari circular import dan agar bisa dipanggil dengan partial object.

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat(format): helper categoryLabel(cat) untuk render emoji + name"
```

---

### Task 4: Render emoji di `TransactionDialog`

**Files:**
- Modify: `src/components/TransactionDialog.tsx:24` (import) dan `:124` (render)

- [ ] **Step 1: Tambahkan import `categoryLabel`**

Di `src/components/TransactionDialog.tsx` baris 24, ubah:

```tsx
import { todayISO, parseRupiah, formatRupiah } from '@/lib/format'
```

menjadi:

```tsx
import { todayISO, parseRupiah, formatRupiah, categoryLabel } from '@/lib/format'
```

- [ ] **Step 2: Replace render kategori**

Di `src/components/TransactionDialog.tsx` baris 124, ubah:

```tsx
<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
```

menjadi:

```tsx
<SelectItem key={c.id} value={String(c.id)}>{categoryLabel(c)}</SelectItem>
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/TransactionDialog.tsx
git commit -m "feat(transactions): render emoji kategori di dialog tambah transaksi"
```

---

### Task 5: Render emoji di `TransactionsTab` (filter dropdown + kolom list)

**Files:**
- Modify: `src/tabs/TransactionsTab.tsx:25` (import), `:106` (filter dropdown), `:188` (kolom list)

- [ ] **Step 1: Import `categoryLabel`**

Di `src/tabs/TransactionsTab.tsx` baris 25, ubah:

```tsx
import { formatRupiah, formatDateID, todayISO } from '@/lib/format'
```

menjadi:

```tsx
import { formatRupiah, formatDateID, todayISO, categoryLabel } from '@/lib/format'
```

- [ ] **Step 2: Update filter dropdown kategori**

Di `src/tabs/TransactionsTab.tsx` baris 105-107, ubah:

```tsx
{filteredCategories.map((c) => (
  <SelectItem key={`${c.type}-${c.id}`} value={String(c.id)}>{c.name} ({c.type === 'income' ? 'masuk' : 'keluar'})</SelectItem>
))}
```

menjadi:

```tsx
{filteredCategories.map((c) => (
  <SelectItem key={`${c.type}-${c.id}`} value={String(c.id)}>{categoryLabel(c)} ({c.type === 'income' ? 'masuk' : 'keluar'})</SelectItem>
))}
```

- [ ] **Step 3: Tambah lookup `iconById` & update kolom kategori list**

`Transaction.category_name` (dari `src/db/transactions.ts`) hanya ambil nama via join. Untuk emoji, lakukan client-side lookup dari `categories` yang sudah di-fetch (line 48).

Di `src/tabs/TransactionsTab.tsx`, setelah baris 65 (`const filteredCategories = ...`) tambahkan:

```tsx
const iconById = useMemo(() => {
  const m = new Map<number, string | null>()
  for (const c of categories) m.set(c.id, c.icon)
  return m
}, [categories])
```

Pastikan `useMemo` sudah di-import di baris 1 (sudah ada — `import { useMemo, useState } from 'react'`).

Lalu di baris 188, ubah:

```tsx
<TableCell className="font-medium">{r.category_name}</TableCell>
```

menjadi:

```tsx
<TableCell className="font-medium">{categoryLabel({ name: r.category_name, icon: iconById.get(r.category_id) ?? null })}</TableCell>
```

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tabs/TransactionsTab.tsx
git commit -m "feat(transactions): render emoji kategori di filter dan list TransactionsTab"
```

---

### Task 6: Render emoji di `RecurringDialog`

**Files:**
- Modify: `src/components/RecurringDialog.tsx:17` (import), `:130` (render)

- [ ] **Step 1: Tambahkan import**

Di `src/components/RecurringDialog.tsx` baris 17, ubah:

```tsx
import { todayISO, parseRupiah, formatRupiah } from '@/lib/format'
```

menjadi:

```tsx
import { todayISO, parseRupiah, formatRupiah, categoryLabel } from '@/lib/format'
```

- [ ] **Step 2: Replace render**

Di `src/components/RecurringDialog.tsx` baris 130, ubah:

```tsx
<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
```

menjadi:

```tsx
<SelectItem key={c.id} value={String(c.id)}>{categoryLabel(c)}</SelectItem>
```

- [ ] **Step 3: Type-check & commit**

Run: `npm run build`

```bash
git add src/components/RecurringDialog.tsx
git commit -m "feat(recurring): render emoji kategori di dialog template rutin"
```

---

### Task 7: Update `RecurringListDialog` lookup helper

**Files:**
- Modify: `src/components/RecurringListDialog.tsx:14` (import), `:40-42` (helper), `:91` (render)

- [ ] **Step 1: Import `categoryLabel`**

Di `src/components/RecurringListDialog.tsx` baris 14, ubah:

```tsx
import { formatRupiah, formatDateID } from '@/lib/format'
```

menjadi:

```tsx
import { formatRupiah, formatDateID, categoryLabel } from '@/lib/format'
```

- [ ] **Step 2: Replace `getCategoryName` → `getCategoryLabel`**

Di `src/components/RecurringListDialog.tsx` baris 40-42, ubah:

```tsx
function getCategoryName(id: number) {
  return categories.find((c) => c.id === id)?.name ?? String(id)
}
```

menjadi:

```tsx
function getCategoryLabel(id: number) {
  const c = categories.find((c) => c.id === id)
  return c ? categoryLabel(c) : String(id)
}
```

- [ ] **Step 3: Update call site**

Di `src/components/RecurringListDialog.tsx` baris 91, ubah:

```tsx
{getCategoryName(t.category_id)} · {formatRupiah(t.amount)}
```

menjadi:

```tsx
{getCategoryLabel(t.category_id)} · {formatRupiah(t.amount)}
```

- [ ] **Step 4: Type-check & lint**

Run: `npm run build && npm run lint`
Expected: PASS keduanya.

- [ ] **Step 5: Commit**

```bash
git add src/components/RecurringListDialog.tsx
git commit -m "feat(recurring): render emoji kategori di list template rutin"
```

---

### Task 8: Apply migration ke Supabase remote

**Files:** (no file edits)

- [ ] **Step 1: Push migration**

Run dari root project:
```bash
npx supabase db push
```

Expected: Output menunjukkan `0016_kategori_expense_tambahan.sql` applied.

- [ ] **Step 2: Verify di Supabase Studio (manual)**

Buka Supabase Studio → Table Editor → `categories`. Cari row dengan `name='Rokok'`, `'Laundry'`, `'Kopi'`. Pastikan `type='expense'` dan `icon` berisi emoji.

Atau via SQL Editor:
```sql
SELECT name, type, icon FROM categories
WHERE name IN ('Rokok','Laundry','Kopi');
```

Expected: 3 baris, masing-masing punya emoji.

---

### Task 9: UAT Manual

**Files:** (no file edits)

- [ ] **Step 1: Jalankan dev server**

```bash
npm run dev
```

Buka URL yang ditampilkan (biasanya http://localhost:5173).

- [ ] **Step 2: UAT — Tambah Transaksi Pengeluaran (golden path)**

1. Login ke aplikasi.
2. Navigasi ke tab **Transaksi**.
3. Klik tombol **Tambah Transaksi**.
4. **Expected:** Default Jenis = "Pengeluaran", dropdown Kategori dibuka.
5. Buka dropdown Kategori.
6. **Expected:** Tampil daftar kategori expense urut alfabet:
   - Belanja
   - Hiburan
   - Kesehatan
   - ☕ Kopi
   - 🧺 Laundry
   - Lainnya
   - Makanan
   - 🚬 Rokok
   - Tagihan
   - Transportasi
7. Pilih "🚬 Rokok", isi Jumlah `25000`, klik **Simpan**.
8. **Expected:** Toast sukses, dialog tertutup, list TransactionsTab menampilkan baris baru dengan kolom Kategori = "🚬 Rokok".

- [ ] **Step 3: UAT — Filter dropdown kategori**

1. Di toolbar TransactionsTab, set Jenis = "Pengeluaran".
2. Buka dropdown filter Kategori.
3. **Expected:** Tampil "🚬 Rokok (keluar)", "🧺 Laundry (keluar)", "☕ Kopi (keluar)" dan kategori expense lain.
4. Pilih "🚬 Rokok".
5. **Expected:** List ter-filter hanya transaksi Rokok.

- [ ] **Step 4: UAT — Pemasukan Pertamina (verifikasi side effect positif)**

1. Klik **Tambah Transaksi**, ubah Jenis = "Pemasukan".
2. Buka dropdown Kategori.
3. **Expected:** Kategori income Pertamina tampil dengan emoji yang sebelumnya tersembunyi:
   - 💵 Gaji ke-13
   - 📈 IKI (Insentif Kinerja)
   - 🏭 Jaspro / Tantiem
   - 💰 THR Keagamaan
   - 🏖️ Tunjangan Cuti
   - dan kategori income tanpa icon (Bonus, Dividen, Gaji, Lainnya) tampil polos.

- [ ] **Step 5: UAT — Recurring template**

1. Di TransactionsTab, klik tombol **Rutin** di toolbar.
2. Klik **Tambah Template**, pilih Jenis "Pengeluaran".
3. Buka dropdown Kategori.
4. **Expected:** Daftar kategori sama dengan dialog Transaksi, emoji muncul di Rokok/Laundry/Kopi.
5. Pilih "☕ Kopi", isi nama "Kopi Harian", jumlah 20000, frekuensi Harian, simpan.
6. **Expected:** Di list Rutin, baris baru menampilkan "☕ Kopi · Rp 20.000".

- [ ] **Step 6: UAT — Kategori expense lama (regresi)**

1. Tambah transaksi pengeluaran kategori "Makanan", jumlah 50000, simpan.
2. **Expected:** List menampilkan "Makanan" tanpa emoji (icon NULL → graceful fallback).

- [ ] **Step 7: Push hasil**

Setelah semua UAT pass:

```bash
git push origin master
```

Tunggu Vercel auto-deploy ~30 detik (per memori `project_vercel_deploy_timing.md`).

---

## Self-Review

✅ **Spec coverage:**
- Migration → Task 1
- Update interface/SELECT → Task 2
- Helper `categoryLabel` → Task 3
- TransactionDialog → Task 4
- TransactionsTab dropdown filter + list → Task 5
- RecurringDialog → Task 6
- RecurringListDialog → Task 7
- Apply migration → Task 8
- UAT → Task 9

✅ **Placeholder scan:** Tidak ada TBD/TODO/"add error handling". Semua step punya kode konkret atau perintah eksak.

✅ **Type consistency:** `Category.icon: string | null`. Helper signature `{ name: string; icon: string | null }` accepts `Category`. `iconById.get(id) ?? null` returns `string | null` — match. Semua call site konsisten.
