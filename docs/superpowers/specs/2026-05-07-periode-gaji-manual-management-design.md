# Manajemen Manual Periode Gaji di /periode-gaji — Design Spec

**Tanggal:** 2026-05-07
**Status:** Draft → menunggu review user
**Lingkup:** Halaman `/periode-gaji` jadi single source of truth untuk pembuatan, rename, dan hapus periode gaji. Hapus side-effect auto-pembuatan periode dari `TransactionDialog`.

## 1. Tujuan

Saat ini halaman `/periode-gaji` murni read-only — pembuatan periode hanya terjadi sebagai *side-effect* dari input transaksi income kategori "Gaji" lewat dialog konfirmasi yang muncul otomatis. Akibatnya:

- Discovery jelek — user (termasuk pemilik app) tidak tahu di mana cara tambah/kelola periode
- Tidak ada jalur untuk rename atau hapus periode kalau ada salah catat
- Magic auto-trigger membingungkan: kapan dialog muncul, kapan tidak

Setelah perubahan:

- `/periode-gaji` jadi tempat eksplisit untuk **buat, rename, dan hapus** periode
- Input transaksi Gaji di `TransactionDialog` jadi transaksi biasa — tidak ada side-effect
- Header halaman menampilkan **Total Periode Tercatat** dan **Rata-rata Sisa per Periode** sebagai konteks ringkas

## 2. Konteks

### State sekarang

**Route & komponen** (`src/routes.tsx:23`, `src/tabs/PeriodeGajiTab.tsx`):
- `/periode-gaji` → `PeriodeGajiTab` (wrapper tipis) → `<PayPeriodList />`
- `PayPeriodList.tsx` handle dual-state: list view atau detail view (via `useState<selected>`)
- `PayPeriodDetail.tsx` tampilkan transaksi dalam window periode, dikelompok per tanggal
- `PayPeriodCard.tsx` (di Dashboard, bukan halaman ini) — kartu ringkas periode aktif

**Schema DB** (`supabase/migrations/0026_pay_periods.sql`):
```sql
CREATE TABLE pay_periods (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  start_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, start_date)
);
```
RLS `FOR ALL` — owner bisa SELECT/INSERT/UPDATE/DELETE. Tidak ada perubahan schema dibutuhkan.

**Model "periode"**:
- Periode hanya didefinisikan oleh `start_date`; `end_date` dihitung dinamis di client = `start_date` periode berikutnya yang lebih baru, atau `null` untuk periode aktif (`src/queries/payPeriods.ts:43`)
- Transaksi **tidak punya FK** ke `pay_periods` — keanggotaan ditentukan murni oleh window tanggal: `tx.date >= period.start_date && tx.date < end_date`
- Konsekuensi: hapus periode adalah pure DELETE row; transaksi tidak tersentuh, hanya window-nya berubah

**Auto-trigger flow yang akan dihapus** (`src/components/TransactionDialog.tsx:99-110`):
- Setelah submit transaksi, sistem cek `selectedCat?.name === 'Gaji' && type === 'income' && !editing`
- Kalau true & belum ada periode dengan `start_date` sama → muncul `PayPeriodConfirmDialog`
- Kalau user batalkan dialog → transaksi tetap masuk, tapi periode tidak terbuat

**Komponen yang akan dihapus**:
- `src/components/PayPeriodConfirmDialog.tsx` — diganti `PayPeriodFormDialog.tsx` baru (bukan rename, karena logic effect-nya spesifik ke skenario auto-trigger lama)

## 3. Arsitektur Perubahan

### Komponen yang diubah

| File | Perubahan |
|------|-----------|
| `src/components/TransactionDialog.tsx` | Hapus import `PayPeriodConfirmDialog` & `payPeriodExistsOnDate`; hapus state `showPeriodDialog`/`pendingGajiDate`; hapus blok logic deteksi Gaji + render `<PayPeriodConfirmDialog />` |
| `src/components/PayPeriodList.tsx` | Tambah header (judul + tombol "+ Periode Baru" + 2 angka agregat); state untuk dialog create |
| `src/components/PayPeriodDetail.tsx` | Tambah tombol "✏️ Rename" & "🗑️ Hapus" di header detail (sejajar tombol "← Kembali"); state untuk dialog rename & alert hapus |
| `src/db/payPeriods.ts` | Tambah fungsi `updatePayPeriod`, `deletePayPeriod`, `countTransactionsInWindow` |
| `src/queries/payPeriods.ts` | Tambah hook `useUpdatePayPeriod`, `useDeletePayPeriod`, `usePayPeriodTransactionCount` |

### Komponen baru

- `src/components/PayPeriodFormDialog.tsx` — shared dialog dengan dua mode:
  - `mode="create"`: field Label (text) + Tanggal Mulai (date picker, default hari ini); validasi unik
  - `mode="rename"`: field Label saja (date picker hidden); pre-filled dengan label saat ini

### Komponen yang dihapus

- `src/components/PayPeriodConfirmDialog.tsx`

## 4. UX Flow

### Flow 1 — Buat periode baru (manual)

1. User di `/periode-gaji` → klik **"+ Periode Baru"** di kanan atas header
2. `PayPeriodFormDialog` (mode `create`) muncul:
   - Label (default `"Gaji [Bulan ini] [Tahun ini]"`, editable)
   - Tanggal Mulai (date picker, default hari ini)
   - Tombol "Batal" + "Simpan"
3. Validasi saat submit:
   - Label tidak kosong (trim)
   - `start_date` belum dipakai (`payPeriodExistsOnDate`)
   - Duplikat → error inline `"Periode dengan tanggal mulai ini sudah ada"`
4. Sukses → toast `"Periode '[label]' dimulai"` + dialog close + list auto-refresh via React Query invalidation

### Flow 2 — Rename periode

1. User klik card periode → masuk `PayPeriodDetail` view
2. Header detail tampilkan tombol **✏️ Rename** dan **🗑️ Hapus** di kanan, sejajar "← Kembali"
3. Klik Rename → `PayPeriodFormDialog` (mode `rename`) muncul, field Label pre-filled
4. Submit → `useUpdatePayPeriod` → toast `"Periode di-rename"` + dialog close + cache invalidate

### Flow 3 — Hapus periode

1. User klik 🗑️ Hapus → `AlertDialog` konfirmasi muncul
2. Saat dialog buka, jalankan `usePayPeriodTransactionCount(period)` untuk hitung N transaksi dalam window `[start_date, end_date)`
3. Copy konfirmasi **berbeda berdasarkan posisi periode**:

   **Kasus a — periode tengah atau periode paling baru (aktif)**:
   > "Hapus periode '[label]'?"
   > "[N] transaksi tidak akan terhapus, akan melebur ke periode '[label periode sebelumnya]'."

   **Kasus b — periode paling lama (tidak ada periode dengan `start_date` lebih lama)**:
   > "Hapus periode '[label]'?"
   > "[N] transaksi tidak akan terhapus, tapi tidak akan masuk ke periode mana pun (masih bisa dilihat di halaman Transaksi)."

   **Kasus c — fallback (count gagal di-fetch)**:
   > "Hapus periode '[label]'?"
   > "Transaksi tidak akan terhapus, tapi keanggotaan periode-nya akan berubah."

4. Konfirmasi → `useDeletePayPeriod` → toast `"Periode dihapus"` + `setSelected(null)` (kembali ke list view) + cache invalidate

### Flow 4 — Input transaksi Gaji setelah perubahan

1. User input transaksi income kategori "Gaji" lewat `TransactionDialog` seperti biasa
2. Submit → transaksi tersimpan, **tidak ada dialog konfirmasi periode**
3. Untuk buat periode terkait, user harus ke `/periode-gaji` → klik "+ Periode Baru" sendiri

### Header agregat di list view

```
Periode Gaji                                  [+ Periode Baru]
Kelola siklus keuangan dari gajian ke gajian.

┌─────────────────────┬───────────────────────────┐
│ Total Periode       │ Rata-rata Sisa per Periode │
│ 12                  │ Rp 1.250.000              │
└─────────────────────┴───────────────────────────┘
```

**Aturan hitung agregat**:
- **Total Periode**: `summaries.length`
- **Rata-rata Sisa**: rata-rata `remaining` dari periode yang **sudah tutup** (`end_date !== null`); periode aktif dikecualikan karena sisa-nya masih bergerak setiap input transaksi
- **Edge cases**:
  - 0 periode → Total = `0`, Rata-rata = `"—"`
  - 1 periode (yang aktif) → Total = `1`, Rata-rata = `"—"` dengan tooltip `"Akan muncul setelah ada periode tertutup"`

## 5. Error Handling

| Skenario | Penanganan |
|---|---|
| Create dengan tanggal duplikat (lolos UI) | DB constraint `UNIQUE (user_id, start_date)` reject; tangkap error dari `createPayPeriod`, tampilkan toast `"Tanggal mulai sudah dipakai periode lain"` |
| Label kosong | Tombol Submit disabled saat `label.trim() === ''` |
| RLS violation saat UPDATE/DELETE | Catch error dari mutation, toast `"Gagal: [error.message]"` (pattern existing) |
| Hapus periode yang sedang dibuka di detail view | `setSelected(null)` setelah sukses → otomatis kembali ke list |
| Network error saat fetch count untuk konfirmasi hapus | Tampilkan dialog dengan copy fallback (Kasus c di atas) — tidak block aksi |
| Dialog Rename ditutup saat label kosong | Tidak save, tidak error — pattern existing |

## 6. Testing Approach

Project tidak punya test suite formal aktif untuk halaman serupa; verifikasi via UAT manual + verification gates di GSD workflow.

### Manual UAT script (untuk PLAN.md)

1. ✅ Buat periode pertama dari `/periode-gaji` → muncul di list, Total Periode = 1, Rata-rata Sisa = "—"
2. ✅ Buat periode dengan tanggal duplikat → error inline muncul, periode tidak tercipta
3. ✅ Rename periode existing → label update di list, di detail view, dan di `PayPeriodCard` Dashboard
4. ✅ Hapus periode tengah → konfirmasi tampil dengan N transaksi & label periode penampung benar; setelah hapus, transaksi tetap ada di /transaksi & melebur ke periode sebelumnya di /periode-gaji
5. ✅ Hapus periode paling lama → copy konfirmasi berbeda (transaksi tidak masuk periode mana pun); setelah hapus, summary tidak include transaksi tersebut tapi mereka tetap muncul di /transaksi
6. ✅ Hapus periode aktif → periode kedua otomatis jadi aktif (`PayPeriodCard` Dashboard menampilkan label baru, `end_date` jadi null)
7. ✅ Input transaksi income kategori "Gaji" → **tidak muncul** dialog konfirmasi periode (regression check untuk perubahan TransactionDialog)
8. ✅ Buka /periode-gaji dengan 0 periode → empty state muncul, header tetap tampil dengan Total = 0 & Rata-rata = "—"
9. ✅ Buka /periode-gaji dengan ≥2 periode tertutup → Rata-rata Sisa = mean dari periode tertutup saja (verify dengan hitung manual)

### Smoke checks otomatis

- `npm run check` (TypeScript) sebelum commit
- Buka halaman tanpa error console di Dev Tools

## 7. Yang Tidak Dilakukan (out of scope)

- **Geser tanggal mulai (`start_date`)** — keputusan brainstorming: risiko UX terlalu besar (re-window transaksi, urutan vs label jadi misleading); user tetap bisa hapus + buat ulang kalau perlu
- **Tambah field baru** (estimasi gaji, target spending) — tetap minimal, schema DB tidak berubah
- **Filter / sort di list periode** — tidak diminta
- **Visualisasi tren atau budget envelope** — tidak diminta
- **Migrasi data periode existing** — tidak ada perubahan struktural, periode existing tetap kompatibel

## 8. Dampak ke Komponen Lain

- **`PayPeriodCard.tsx` (Dashboard)** — tidak diubah; tetap baca dari `usePayPeriodSummaries()`. Hapus periode aktif → otomatis ganti ke periode kedua tanpa kode tambahan
- **`TransactionDialog.tsx`** — pure removal (no replacement); transaksi income Gaji jadi seperti transaksi income lain
- **Halaman `/transaksi`** — tidak diubah; transaksi yang "lepas" dari periode tertua tetap muncul di sini seperti biasa
- **Tidak ada migrasi DB** dibutuhkan
