# Migration Playbook — Kantong Pintar

> Last updated: 2026-05-15 | Author: Phase 16 TECHDEBT-01

## 1. Current State Snapshot

**Local migrations:** 0001–0030 (30 total, di `supabase/migrations/`)
**Cloud applied:**
- 0001–0013: Applied via `supabase db push` (terdaftar di `supabase_migrations` table cloud)
- 0014–0030: Applied via Supabase Studio SQL Editor manual paste (TIDAK terdaftar di `supabase_migrations`)

**Result of `supabase migration list --linked`:** 0014–0030 tampil sebagai "Local-only" karena Studio paste tidak otomatis update tabel `supabase_migrations` di cloud.

## 2. Kenapa `supabase db push` Rusak

`db push` mendeteksi mismatch antara local migration history dan cloud `supabase_migrations`. Karena 0014+ tidak tercatat di cloud, CLI menganggap schema cloud dan local diverged dan menolak push untuk mencegah data corruption.

**Keputusan (Path b — Phase 16 D-01):** Tidak diperbaiki. Repair via `supabase migration repair` berisiko jika terjadi drift antara local schema dan cloud schema (tidak ada staging mirror untuk verify). Studio paste sudah menjadi proven workflow sejak migration 0014 tanpa incident.

## 3. Prosedur untuk Future Migrations

Setiap kali perlu tambah migration baru, ikuti langkah ini:

### Step 1 — Tulis SQL file
```
supabase/migrations/NNNN_description.sql
```
Gunakan nomor urut berikutnya (cek `ls supabase/migrations/` untuk nomor terakhir).

### Step 2 — Paste di Studio SQL Editor
1. Buka [Supabase Dashboard](https://supabase.com/dashboard) → pilih project
2. Klik **SQL Editor** di sidebar kiri
3. Paste isi file `.sql` ke editor baru (klik "+ New query")
4. Klik **Run** dan verifikasi output ("Success" atau RAISE NOTICE yang diharapkan)

### Step 3 — Commit SQL file ke git
```bash
git add supabase/migrations/NNNN_description.sql
git commit -m "feat(migration): NNNN description"
```

SQL file di git = source of truth. Cloud schema = applied version (via Studio).

### Step 4 — Verifikasi post-apply
Jalankan query verifikasi di SQL Editor (tergantung migration — biasanya `SELECT` untuk verify table/function exists atau RLS policy aktif).

## 4. CLI Push vs Studio Paste — Kapan Pakai Apa

| Scenario | Method | Alasan |
|----------|--------|--------|
| Migration baru (normal) | **Studio paste** | `db push` broken, Studio proven workflow |
| Rollback / repair history | Manual SQL di Studio | Tidak pakai CLI — terlalu risky tanpa staging |
| Dev local (supabase start) | `supabase db reset` | Local only, tidak affect cloud |
| Staging environment (kalau ada di masa depan) | `supabase db push --linked` | Bisa pakai setelah history disync di staging |

**Catatan:** Kalau project mendapatkan staging environment, pertimbangkan untuk `supabase migration repair` di staging dulu sebelum repair di production. Sampai ada staging, Studio paste tetap default.

## 5. Handling Signature Changes pada PL/pgSQL Functions

Jika perlu mengubah signature (nama parameter, tipe parameter, atau RETURNS) dari function yang sudah ada:

**WAJIB emit `DROP FUNCTION IF EXISTS` dengan signature lama sebelum `CREATE OR REPLACE`.**

Contoh — mengubah `process_due_recurring`:
```sql
-- 1. Drop signature lama DULU
DROP FUNCTION IF EXISTS process_due_recurring(DATE, UUID, INT);

-- 2. Baru create dengan signature baru
CREATE OR REPLACE FUNCTION process_due_recurring(
  p_today    DATE DEFAULT CURRENT_DATE,
  p_uid      UUID DEFAULT NULL,
  p_max_iter INT  DEFAULT 12,
  p_new_param TEXT DEFAULT NULL  -- parameter baru
)
...
```

**Mengapa:** PostgreSQL key function identity berdasarkan `(name, arg_types)`. Tanpa explicit DROP, signature change menghasilkan overload kedua — old version tetap callable via PostgREST → race + IDOR vector. Lesson dari Phase 5 migration 0017→0018.

**Functions yang teraffect oleh rule ini:**
- `process_due_recurring(DATE, UUID, INT)` — migration 0019
- `withdraw_from_goal(BIGINT, NUMERIC)` — migration 0020
- `mark_bill_paid(UUID, DATE)` — migration 0014
- `add_money_to_goal_v2(BIGINT, NUMERIC, NUMERIC)` — migration 0022
- `aggregate_by_period(...)` — migration 0017
- `aggregate_by_category(...)` — migration 0017

## 6. Dummy Schema_migrations Entries (Opsional)

Jika ingin `supabase migration list --linked` menampilkan 0014–0030 sebagai "Applied" (bukan "Local-only"), jalankan di SQL Editor:

```sql
-- Tambah dummy entries untuk migrations yang sudah applied via Studio
-- HANYA jalankan kalau semua migration 0014-0030 SUDAH benar-benar applied di cloud
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES
  ('20240101000014', ARRAY['-- applied via Studio'], '0014_mark_bill_paid'),
  ('20240101000015', ARRAY['-- applied via Studio'], '0015_upcoming_bills_unpaid_view'),
  -- ... dst untuk setiap migration 0014-0030
ON CONFLICT (version) DO NOTHING;
```

**PERINGATAN:** Hanya jalankan ini jika kamu yakin semua SQL sudah applied. Dummy entries tidak execute SQL — mereka hanya update tracking table. Jika schema belum applied tapi dummy entry ditambahkan, `db push` akan anggap schema sudah sync padahal belum.

**Status saat ini (2026-05-15):** Dummy entries BELUM ditambahkan. `supabase migration list --linked` masih menunjukkan 0014–0030 sebagai Local-only. Ini acceptable — Studio paste adalah source of truth, bukan `schema_migrations` table.
