# Data Integrity Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perbaiki dua masalah data integrity: (1) duplikat di `price_history` akibat tidak ada UNIQUE constraint, dan (2) schema orphan dari tab Dividen yang sudah dihapus.

**Architecture:** Dua migration SQL terpisah — satu untuk `price_history` (UNIQUE + UPSERT), satu untuk cleanup schema dividen — plus satu perubahan TypeScript untuk pakai `upsert` di `updatePrice()`.

**Tech Stack:** Supabase (PostgreSQL), TypeScript, Vite

---

## File Map

| File | Action | Keterangan |
|------|--------|-----------|
| `supabase/migrations/0008_price_history_unique.sql` | Create | Deduplicate + tambah UNIQUE constraint |
| `supabase/migrations/0009_drop_dividend_schema.sql` | Create | Drop tabel, fungsi, kolom dividen |
| `src/db/investments.ts` | Modify (line 123–126) | Ganti INSERT → upsert di `updatePrice()` |

---

## Task 1: Deduplicate price_history dan tambah UNIQUE constraint

**Files:**
- Create: `supabase/migrations/0008_price_history_unique.sql`

**Latar belakang:** Tabel `price_history` tidak punya UNIQUE constraint pada `(investment_id, date)`. Setiap klik "Refresh Harga" membuat baris duplikat. Sebelum tambah constraint, baris duplikat yang sudah ada harus dibersihkan dulu — kalau langsung `ADD CONSTRAINT` saat ada duplikat, migration akan gagal.

- [ ] **Step 1: Buat file migration**

Buat file `supabase/migrations/0008_price_history_unique.sql` dengan isi berikut:

```sql
-- ============================================================
-- 0008_price_history_unique: Deduplicate + UNIQUE constraint
-- ============================================================

-- Step 1: Hapus baris duplikat, pertahankan hanya yang id-nya terbesar
-- (asumsi: baris terbaru = harga terkini yang paling valid)
DELETE FROM price_history
WHERE id NOT IN (
  SELECT MAX(id)
  FROM price_history
  GROUP BY investment_id, date
);

-- Step 2: Tambah UNIQUE constraint
ALTER TABLE price_history
  ADD CONSTRAINT price_history_investment_date_unique
  UNIQUE (investment_id, date);
```

- [ ] **Step 2: Verifikasi isi file sudah benar**

Baca kembali file dan pastikan:
- DELETE hanya menghapus duplikat (bukan semua baris)
- UNIQUE constraint nama-nya `price_history_investment_date_unique`
- Tidak ada typo pada nama tabel/kolom

- [ ] **Step 3: Commit migration file**

```bash
git add supabase/migrations/0008_price_history_unique.sql
git commit -m "fix: tambah UNIQUE constraint (investment_id, date) di price_history"
```

---

## Task 2: Update updatePrice() pakai upsert

**Files:**
- Modify: `src/db/investments.ts` (sekitar line 123–126)

**Latar belakang:** Setelah migration Task 1 dijalankan, jika `updatePrice()` masih pakai `.insert()`, maka klik "Refresh Harga" dua kali pada hari yang sama akan menghasilkan error DB (unique violation). Solusinya: ganti ke `.upsert()` dengan `onConflict: 'investment_id,date'` — kalau sudah ada baris untuk hari itu, update harganya saja.

- [ ] **Step 1: Baca fungsi updatePrice() di investments.ts**

Temukan blok ini (sekitar line 115–127):

```ts
export async function updatePrice(investmentId: number, price: number, date: string): Promise<void> {
  if (price < 0) throw new Error('Harga tidak boleh negatif')
  const { error: e1 } = await supabase
    .from('investments')
    .update({ current_price: price })
    .eq('id', investmentId)
  if (e1) throw e1

  const { error: e2 } = await supabase
    .from('price_history')
    .insert({ investment_id: investmentId, price, date })
  if (e2) throw e2
}
```

- [ ] **Step 2: Ganti .insert() → .upsert()**

Ubah bagian `price_history` dari:

```ts
  const { error: e2 } = await supabase
    .from('price_history')
    .insert({ investment_id: investmentId, price, date })
  if (e2) throw e2
```

Menjadi:

```ts
  const { error: e2 } = await supabase
    .from('price_history')
    .upsert(
      { investment_id: investmentId, price, date },
      { onConflict: 'investment_id,date' }
    )
  if (e2) throw e2
```

**Catatan:** `onConflict` harus sesuai persis nama constraint column yang ada di migration Task 1, yaitu kolom `investment_id` dan `date`.

- [ ] **Step 3: Verifikasi build TypeScript tidak error**

```bash
npm run build
```

Expected output: `✓ built in X.XXs` tanpa TypeScript error.

- [ ] **Step 4: Commit perubahan**

```bash
git add src/db/investments.ts
git commit -m "fix: ganti insert ke upsert di updatePrice untuk cegah duplikat price_history"
```

---

## Task 3: Drop orphan schema dividen

**Files:**
- Create: `supabase/migrations/0009_drop_dividend_schema.sql`

**Latar belakang:** Migration `0007_dividends.sql` membuat tabel `bei_stocks`, `dividend_transactions`, dua RPC, dan kolom `bei_stock_id` di `investments`. Seluruh UI tab Dividen sudah dihapus (commit `7d4d7ad`). Schema ini orphan — tidak dipakai, membuang space, dan membingungkan siapapun yang membaca schema DB.

Urutan DROP penting:
1. DROP function dulu (keduanya pakai tabel dividen)
2. DROP tabel `dividend_transactions` (ada FK ke `bei_stocks`)
3. DROP kolom `bei_stock_id` dari `investments` (ada FK ke `bei_stocks`)
4. DROP index `idx_investments_bei_stock` (akan otomatis drop bersama kolom, tapi eksplisit lebih aman)
5. DROP tabel `bei_stocks` (harus setelah semua FK yang merujuknya dihapus)

- [ ] **Step 1: Buat file migration**

Buat file `supabase/migrations/0009_drop_dividend_schema.sql` dengan isi berikut:

```sql
-- ============================================================
-- 0009_drop_dividend_schema: Hapus seluruh schema tab Dividen
-- Tab Dividen dihapus pada commit 7d4d7ad. Schema ini orphan.
-- ============================================================

-- 1. Drop RPCs yang bergantung pada tabel dividen
DROP FUNCTION IF EXISTS create_dividend_transaction(BIGINT, TEXT, INTEGER, BIGINT, DATE, TEXT);
DROP FUNCTION IF EXISTS get_dividend_holdings(UUID);

-- 2. Drop tabel dividend_transactions (FK ke bei_stocks)
DROP TABLE IF EXISTS dividend_transactions;

-- 3. Drop kolom bei_stock_id dari investments (FK ke bei_stocks)
--    Index idx_investments_bei_stock otomatis terhapus bersama kolom
ALTER TABLE investments DROP COLUMN IF EXISTS bei_stock_id;

-- 4. Drop tabel bei_stocks (harus setelah semua FK dihapus)
DROP TABLE IF EXISTS bei_stocks;
```

- [ ] **Step 2: Verifikasi urutan DROP sudah benar**

Baca kembali file. Pastikan:
- `DROP FUNCTION` sebelum `DROP TABLE dividend_transactions`
- `DROP TABLE dividend_transactions` sebelum `DROP TABLE bei_stocks`
- `ALTER TABLE investments DROP COLUMN bei_stock_id` sebelum `DROP TABLE bei_stocks`
- Semua statement pakai `IF EXISTS` (aman jika dijalankan ulang)

- [ ] **Step 3: Commit migration file**

```bash
git add supabase/migrations/0009_drop_dividend_schema.sql
git commit -m "fix: hapus schema orphan dividen (bei_stocks, dividend_transactions, RPCs, bei_stock_id)"
```

---

## Task 4: Apply migrations ke Supabase dan verifikasi

**Catatan penting:** Migration Supabase tidak dijalankan otomatis — harus di-push via Supabase CLI atau dijalankan manual lewat SQL Editor di Supabase Dashboard.

- [ ] **Step 1: Push migrations via Supabase CLI (jika tersedia)**

Jalankan dari root project:

```bash
npx supabase db push
```

Jika Supabase CLI belum login:
```bash
npx supabase login
npx supabase link --project-ref rqotdjrlswpizgpnznfn
npx supabase db push
```

**Alternatif (jika tidak mau pakai CLI):** Buka [Supabase Dashboard → SQL Editor](https://supabase.com/dashboard/project/rqotdjrlswpizgpnznfn/sql) dan jalankan isi kedua migration secara manual.

- [ ] **Step 2: Verifikasi migration 0008 berhasil**

Di Supabase SQL Editor, jalankan:

```sql
-- Cek constraint sudah ada
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'price_history' 
  AND constraint_name = 'price_history_investment_date_unique';
```

Expected: 1 baris dengan `price_history_investment_date_unique`.

- [ ] **Step 3: Verifikasi migration 0009 berhasil**

Di Supabase SQL Editor, jalankan:

```sql
-- Cek tabel bei_stocks sudah tidak ada
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('bei_stocks', 'dividend_transactions');

-- Cek kolom bei_stock_id sudah tidak ada
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'investments' AND column_name = 'bei_stock_id';
```

Expected: kedua query mengembalikan 0 baris.

- [ ] **Step 4: Verifikasi upsert berfungsi di app**

Buka app → tab Investasi → klik "Refresh Harga" dua kali berturut-turut.
Expected: tidak ada error toast, harga terupdate normal, tidak ada duplikat di chart harga.

- [ ] **Step 5: Push ke GitHub dan deploy Vercel**

```bash
git push origin master
```

Vercel akan auto-deploy. Tunggu ~1 menit lalu verifikasi app production berjalan normal.
