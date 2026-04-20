# Design Spec: Gap 9 — Manajemen User dari UI

**Tanggal:** 2026-04-20
**Status:** Draft

---

## Ringkasan

Mengubah arsitektur dari single-user menjadi multi-user. Setiap akun punya data keuangan terpisah. Akun utama (admin) bisa mengelola daftar email yang diizinkan login dan bisa melihat data keuangan user lain (read-only).

---

## 1. Perubahan Database

### Tabel Baru

**`profiles`**
```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin    BOOLEAN NOT NULL DEFAULT false,
  display_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
- Satu baris per user, di-upsert otomatis saat pertama login
- Admin pertama di-seed saat migrasi dengan `is_admin = true`

**`allowed_emails`**
```sql
CREATE TABLE allowed_emails (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  added_by   UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
- Menggantikan email hardcode di trigger SQL
- Hanya admin yang bisa INSERT/DELETE (via RLS)

### Kolom `user_id` Ditambahkan

Kolom `user_id UUID NOT NULL REFERENCES auth.users(id)` ditambahkan ke:
- `transactions`
- `investments`
- `price_history`
- `goals`
- `notes`
- `goal_investments`

Tabel `settings`: PK berubah dari `key` menjadi `(user_id, key)`.

Tabel `categories`: tetap global, tidak per-user.

### RLS Diperbarui

Fungsi helper:
```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  );
$$;
```

Policy baru untuk semua tabel data:
```sql
-- READ: user lihat data sendiri, admin lihat semua
USING (auth.uid() = user_id OR is_admin())
-- WRITE: hanya bisa tulis ke data sendiri (admin tidak write atas nama user lain)
WITH CHECK (auth.uid() = user_id)
```

Policy untuk `allowed_emails`:
- SELECT: semua authenticated
- INSERT/DELETE: hanya admin

Policy untuk `profiles`:
- SELECT: semua authenticated
- INSERT/UPDATE: user hanya bisa upsert baris miliknya sendiri

### Trigger Email Allowlist Diperbarui

```sql
CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Jika tabel allowed_emails masih kosong, izinkan (bootstrap)
  IF NOT EXISTS (SELECT 1 FROM allowed_emails) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM allowed_emails WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'Email tidak diizinkan untuk aplikasi ini';
  END IF;
  RETURN NEW;
END;
$$;
```

### Migrasi Data Existing

```sql
-- Seed allowed_emails dengan email admin
INSERT INTO allowed_emails (email) VALUES ('rinoadi28@gmail.com');

-- Seed profiles dengan admin
INSERT INTO profiles (id, is_admin, display_name)
SELECT id, true, raw_user_meta_data->>'full_name'
FROM auth.users WHERE email = 'rinoadi28@gmail.com';

-- Assign semua data existing ke UID admin
UPDATE transactions   SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com');
UPDATE investments    SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com');
UPDATE price_history  SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com');
UPDATE goals          SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com');
UPDATE notes          SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com');
UPDATE goal_investments SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com');
```

**Urutan deployment wajib:** jalankan migrasi SQL dulu, baru deploy frontend baru.

---

## 2. Frontend: ViewAs Context

### `ViewAsContext`

Context baru (atau extend `AuthProvider`) dengan state:

```ts
interface ViewAsState {
  uid: string
  displayName: string
  email: string
}
```

- `viewingAs: ViewAsState | null` — `null` berarti lihat data sendiri
- `setViewingAs(user: ViewAsState | null)` — hanya bisa dipanggil jika `isAdmin = true`
- Di-reset otomatis saat logout
- **Tidak** disimpan ke localStorage (session only)

### Banner "Sedang Melihat Data"

Muncul di atas semua tab ketika `viewingAs !== null`:

```
[avatar] Sedang melihat data Nama User (hanya baca)    [Kembali ke data saya]
```

Semua tombol yang memicu write (tambah transaksi, edit goal, dll) tetap tampil tapi akan gagal di RLS. Untuk UX lebih baik, tombol-tombol tersebut di-disable atau disembunyikan ketika `viewingAs !== null`.

### Perubahan Query

Semua query functions menerima `targetUserId` dan filter eksplisit:
```ts
supabase.from('transactions').select('*').eq('user_id', targetUserId)
```

Default `targetUserId = auth.uid()`. Ketika admin sedang `viewingAs`, pakai `viewingAs.uid`.

RLS tetap sebagai safety net, tapi query harus eksplisit agar admin bisa fetch data user lain.

---

## 3. UI Settings: Manajemen Pengguna

Seksi baru di `SettingsTab`, hanya tampil jika `isAdmin = true`.

### Sub-seksi: Email yang Diizinkan

- Tabel: email | tanggal ditambahkan | tombol Hapus
- Tombol Hapus disabled untuk email sendiri
- Input + tombol "Tambah Email" dengan validasi format email
- Error dari Supabase (email sudah ada, bukan admin) ditampilkan via `toast.error`

### Sub-seksi: Lihat Keuangan User Lain

- Daftar dari tabel `profiles` (exclude diri sendiri)
- Setiap baris: nama + email + tombol "Lihat Keuangan"
- Klik → set `viewingAs` → semua tab load data user tersebut

---

## 4. Edge Cases

| Kondisi | Perilaku |
|---------|----------|
| Admin hapus email dari allowlist yang sudah login | User tetap bisa login (trigger hanya gate sign-up baru) |
| Admin coba hapus emailnya sendiri | Tombol hapus disabled di frontend |
| Admin logout saat sedang `viewingAs` | `viewingAs` di-reset ke `null` |
| User baru login pertama kali | `profiles` row di-upsert via `onAuthStateChange` |
| `allowed_emails` kosong (bootstrap) | Trigger izinkan semua (fallback untuk setup awal) |
| Admin coba write data atas nama user lain | Diblok oleh `WITH CHECK (auth.uid() = user_id)` di RLS |

---

## 5. File yang Berubah

**Baru:**
- `supabase/migrations/0006_multi_user.sql`
- `src/auth/ViewAsContext.tsx`
- `src/auth/useViewAs.ts`

**Diubah:**
- `supabase/migrations/0001_init.sql` — tidak diubah, semua perubahan di migration baru
- `src/auth/AuthProvider.tsx` — tambah `isAdmin`, upsert `profiles` saat login
- `src/tabs/SettingsTab.tsx` — tambah seksi Manajemen Pengguna
- `src/App.tsx` — wrap dengan `ViewAsProvider`, tambah banner
- Semua file di `src/db/` dan `src/queries/` — tambah `user_id` filter
