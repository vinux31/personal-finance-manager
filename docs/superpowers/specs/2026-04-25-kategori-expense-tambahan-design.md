# Kategori Expense Tambahan — Design Spec

**Tanggal:** 2026-04-25
**Status:** Draft → menunggu review user
**Lingkup:** Tambahan 3 kategori expense (Rokok, Laundry, Kopi) + render emoji di UI

## 1. Tujuan

Menambah 3 kategori expense baru dengan emoji icon untuk memungkinkan user men-track pengeluaran spesifik harian:

- 🚬 Rokok
- 🧺 Laundry
- ☕ Kopi

Sekaligus mengaktifkan rendering kolom `icon` yang sebelumnya tersimpan di DB tapi belum dipakai di UI (5 kategori income Pertamina di migration `0004_kategori_pertamina.sql` punya emoji yang selama ini tidak terlihat).

## 2. Konteks

### Schema saat ini

`categories` adalah tabel global (tanpa `user_id`). Schema dari `0001_init.sql`:

```sql
CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, type)
);
```

### Pattern penambahan kategori

Mengikuti pattern `supabase/migrations/0004_kategori_pertamina.sql`:

```sql
INSERT INTO categories (name, type, icon) VALUES (...)
ON CONFLICT (name, type) DO NOTHING;
```

Idempotent, aman dijalankan ulang.

### Gap UI saat ini

`src/db/categories.ts:9-20` SELECT-nya hanya `id, name, type` — kolom `icon` tidak di-fetch. Tidak ada komponen di `src/` yang membaca `category.icon`. Akibatnya emoji yang sudah ada di DB (kategori Pertamina) tidak pernah tampil.

## 3. Perubahan

### 3.1 Migration baru

**File:** `supabase/migrations/0016_kategori_expense_tambahan.sql`

```sql
-- supabase/migrations/0016_kategori_expense_tambahan.sql
-- Tambah 3 kategori expense untuk tracking pengeluaran harian
INSERT INTO categories (name, type, icon) VALUES
  ('Rokok',   'expense', '🚬'),
  ('Laundry', 'expense', '🧺'),
  ('Kopi',    'expense', '☕')
ON CONFLICT (name, type) DO NOTHING;
```

### 3.2 Update tipe & query

**File:** `src/db/categories.ts`

- Tambah `icon: string | null` di interface `Category`.
- SELECT include `icon`.

```ts
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

### 3.3 Helper format label kategori

**File:** `src/lib/format.ts` (sudah ada — file ini house `formatRupiah`, `parseRupiah`, `todayISO`)

Tambah helper kecil untuk reuse:

```ts
import { type Category } from '@/db/categories'

export function categoryLabel(cat: Pick<Category, 'name' | 'icon'>): string {
  return cat.icon ? `${cat.icon} ${cat.name}` : cat.name
}
```

### 3.4 Render emoji di UI

Update tempat-tempat yang menampilkan nama kategori agar pakai `categoryLabel(cat)`:

| File | Konteks |
|---|---|
| `src/components/TransactionDialog.tsx` | Dropdown pilih kategori (line 124) |
| `src/tabs/TransactionsTab.tsx` | List transaksi (kolom kategori) |
| `src/components/RecurringDialog.tsx` | Dropdown kategori transaksi berulang |
| `src/components/RecurringListDialog.tsx` | List recurring (kalau menampilkan kategori) |

Pattern penggantian:
```tsx
// before
{c.name}
// after
{categoryLabel(c)}
```

Untuk kategori yang `icon`-nya NULL (semua expense default + 4 income default), output tetap `c.name` saja — graceful fallback.

## 4. Yang TIDAK termasuk (YAGNI)

- ❌ Tidak menambahkan emoji ke 7 kategori expense default lama (Makanan, Transportasi, Hiburan, Tagihan, Kesehatan, Belanja, Lainnya). Bisa jadi phase terpisah kalau ingin.
- ❌ Tidak menambah UI "manage categories" (CRUD kategori per-user). Itu fitur besar untuk milestone berikutnya.
- ❌ Tidak mengubah RPC `aggregate_by_category` — hanya return name, icon biarkan di-join di client kalau perlu di laporan (out of scope sekarang).
- ❌ Tidak menambah unit test untuk helper `categoryLabel` (trivial single-expression function).

## 5. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Migration gagal di prod karena duplikat | `ON CONFLICT (name, type) DO NOTHING` |
| Emoji tidak render di Windows old / browser lama | Fallback otomatis ke kotak kosong; tidak crash |
| Komponen lain yang baca `category.name` ketinggalan update | Pakai grep `c\.name` di src setelah implementasi |

## 6. Verifikasi (UAT)

Setelah deploy migration + frontend:

1. Buka tab Transaksi → klik "Tambah".
2. Default Jenis = "Pengeluaran". Buka dropdown Kategori.
3. **Expected:** 3 kategori baru muncul dengan emoji di depan nama (☕ Kopi, 🧺 Laundry, 🚬 Rokok). Urutan alfabet by `name`.
4. Pilih "🚬 Rokok", isi jumlah Rp 25.000, Simpan.
5. **Expected:** transaksi tersimpan, list TransactionsTab menampilkan baris baru dengan label "🚬 Rokok".
6. Ubah Jenis ke "Pemasukan" di dialog Tambah, buka dropdown Kategori.
7. **Expected:** kategori Pertamina (THR, IKI, Jaspro, Gaji ke-13, Tunjangan Cuti) tampil dengan emoji-nya.

## 7. Rollback Plan

Jika ada masalah:
- Frontend: revert commit, redeploy Vercel (~30 detik per memori).
- Migration: tidak perlu rollback — data referensi tambahan tidak merusak baris transaksi existing. Kalau perlu hapus, jalankan `DELETE FROM categories WHERE name IN ('Rokok','Laundry','Kopi') AND type='expense'` (asumsi belum dipakai di transaksi; kalau sudah, biarkan).
