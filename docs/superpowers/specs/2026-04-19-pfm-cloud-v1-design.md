# PFM Cloud v1.0 — Migration MVP — Design

**Date:** 2026-04-19
**Status:** Approved (sections 1–5)
**Owner:** Rino
**Sub-project:** A + B (Cloud Foundation + Functional Parity)

## Context

Personal Finance Manager (`pfm-web`) saat ini adalah aplikasi React 19 + Vite + Tailwind 4 + shadcn yang menyimpan data via sql.js + File System Access API ke file `.db` lokal di laptop. Visi telah diperbarui (lihat `memory/project_vision.md`) menjadi **financial cockpit pribadi cloud-first multi-device** dengan stack **Supabase + Vercel + Google OAuth**.

Sub-project ini melakukan **migrasi engine data dari sql.js lokal ke Supabase cloud**, sambil mempertahankan **functional parity** — semua fitur yang sudah ada (Transaksi, Investasi, Goals, Catatan, Laporan, Pengaturan + CSV import/export + theme) tetap berfungsi setelah migrasi.

## Goal

Setelah MVP ini selesai:

- Aplikasi live di URL Vercel publik.
- Login via Google OAuth; hanya email `asistensme@gmail.com` yang diizinkan sign-up (allowlist).
- Semua 6 tab CRUD jalan setara versi lokal sekarang.
- Data tersimpan di Supabase Postgres (bukan file lokal).
- Repo bersih dari kode sql.js / FileHandle.
- Dapat dibuka & dipakai dari device manapun (HP, laptop kantor, dll).

Setelah MVP ini, sub-project lain (Net Worth dashboard, Auto-fetch harga, Budgeting, dll) dibrainstorm & dibangun terpisah.

## Non-goals

- Migrasi data lama dari `pfm-data.db` (mulai fresh).
- Schema redesign (tambah accounts/assets/liabilities) — itu sub-project C.
- Auto-fetch harga investasi — itu sub-project D.
- Budgeting fitur — itu sub-project E.
- Automated tests (manual smoke test only di MVP).
- Offline mode / sync layer (cloud-first, butuh koneksi).
- PWA / mobile native.
- Multi-user / kolaborasi.
- Realtime subscriptions / optimistic updates.

## Key Decisions

| Topik | Keputusan |
|---|---|
| Stack | Supabase (Postgres + Auth + Storage) + Vercel + Google OAuth |
| Region Supabase | Singapore (`ap-southeast-1`) |
| Auth model | Single-user + email allowlist (no `user_id` column) |
| Schema scope | Lift-and-shift dari sql.js — tidak ada redesign struktur |
| Environment | 1 Supabase project (production-only) |
| Schema migration | Supabase CLI, file SQL versioned di repo |
| Frontend data layer | TanStack Query di atas db functions |
| Domain | Default `*.vercel.app` (custom domain nanti) |
| Testing | Manual smoke test (checklist tertulis) |
| Data lama | Buang, tidak migrasi |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (multi-device)                                 │
│  ┌──────────────────────────────────────────────────┐   │
│  │  React + Vite SPA (deployed di Vercel)           │   │
│  │  ┌────────────────────────────────────────────┐  │   │
│  │  │  Tabs (Transaksi, Investasi, ...)          │  │   │
│  │  └──────────────┬─────────────────────────────┘  │   │
│  │                 │ useQuery / useMutation         │   │
│  │  ┌──────────────▼─────────────────────────────┐  │   │
│  │  │  TanStack Query (cache + state)            │  │   │
│  │  └──────────────┬─────────────────────────────┘  │   │
│  │                 │ async functions                │   │
│  │  ┌──────────────▼─────────────────────────────┐  │   │
│  │  │  src/db/* (signature dipertahankan)        │  │   │
│  │  └──────────────┬─────────────────────────────┘  │   │
│  │                 │ supabase-js                    │   │
│  │  ┌──────────────▼─────────────────────────────┐  │   │
│  │  │  Auth Provider (Google OAuth)              │  │   │
│  │  └──────────────┬─────────────────────────────┘  │   │
│  └─────────────────┼──────────────────────────────────┘ │
└────────────────────┼────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase Cloud (Singapore)                             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Auth    │──│  PostgREST   │──│  Postgres        │  │
│  │  +       │  │  + RLS       │  │  (lift & shift   │  │
│  │  hook    │  │              │  │   schema)        │  │
│  └──────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Properti kunci:**

1. Tidak ada backend custom — semua via Supabase managed service.
2. Frontend bicara langsung ke Supabase via `@supabase/supabase-js`.
3. Tabel diproteksi RLS: hanya user terotentikasi yang boleh akses.
4. Email allowlist via Auth Hook (database trigger pada sign-up).
5. Lapisan `src/db/*` jadi tipis — wrapper di atas Supabase client, signature lama dipertahankan.

## Components & file changes

### NEW

| File | Tujuan |
|---|---|
| `src/lib/supabase.ts` | Inisialisasi Supabase client (singleton). Baca env. |
| `src/lib/queryClient.ts` | Inisialisasi TanStack QueryClient. Default: `staleTime: 30s`, `retry: 1`, `refetchOnReconnect: true`. |
| `src/lib/errors.ts` | Helper `mapSupabaseError(err)` → string Indonesia. |
| `src/auth/AuthProvider.tsx` | Context provider, subscribe `onAuthStateChange`, expose `{ user, loading, signIn, signOut }`. |
| `src/auth/useAuth.ts` | Hook konsumsi context. |
| `src/components/LoginScreen.tsx` | UI login: tombol "Masuk dengan Google" + tagline + footer. |
| `src/components/AccountMenu.tsx` | Dropdown header: avatar Google + email + tombol "Keluar". |
| `src/components/OfflineBanner.tsx` | Banner saat `navigator.onLine === false`. |
| `src/queries/transactions.ts` | Hooks `useTransactions(filters)`, `useCreateTransaction()`, `useUpdateTransaction()`, `useDeleteTransaction()`. |
| `src/queries/investments.ts` | Idem investments + `useUpdatePrice`. |
| `src/queries/goals.ts` | Idem goals + `useAddMoneyToGoal`. |
| `src/queries/notes.ts` | Idem notes. |
| `src/queries/categories.ts` | Hook `useCategories()`. |
| `src/queries/reports.ts` | `useAggregateByPeriod(...)`, `useAggregateByCategory(...)`. |
| `supabase/migrations/0001_init.sql` | Schema Postgres + seed kategori default + RLS + Auth Hook allowlist. |
| `supabase/config.toml` | Supabase CLI project config. |
| `.env.example` | Template env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). |
| `docs/SMOKE_TEST.md` | Checklist manual smoke test (lihat di bawah). |

### REWRITE (signature dipertahankan, body diganti)

| File | Perubahan |
|---|---|
| `src/db/transactions.ts` | Body pakai `supabase.from('transactions').select(...)`. Reads jadi `Promise<...>`. |
| `src/db/investments.ts` | Idem. |
| `src/db/goals.ts` | Idem. |
| `src/db/notes.ts` | Idem. |
| `src/db/categories.ts` | Idem. |
| `src/db/reports.ts` | Aggregations pindah ke RPC function di Postgres. |
| `src/db/csvTransactions.ts` | Parsing tetap, sink batch insert via Supabase. |
| `src/db/csvInvestments.ts` | Idem. |
| `src/App.tsx` | Wrap dengan `<QueryClientProvider>` + `<AuthProvider>`. Conditional render `<LoginScreen>` vs app. Header dapat `<AccountMenu>` + `<OfflineBanner>`. |
| `src/tabs/SettingsTab.tsx` | Hapus seksi "File Data". Tambah seksi "Akun" (info user + tombol logout). Tema & panduan tetap. |
| Semua `src/tabs/*.tsx` | Swap import dari `@/db/*` ke `@/queries/*`. Ganti `useState + useEffect + refresh()` ke `useXxxQuery()`. |

### DELETE

| File | Alasan |
|---|---|
| `src/db/database.ts` | sql.js init tidak relevan |
| `src/db/fileHandle.ts` | FS Access API tidak relevan |
| `src/db/store.ts` | Diganti AuthProvider |
| `src/db/repo.ts` | Diganti supabase client |
| `src/db/schema.ts` | Pindah ke `supabase/migrations/0001_init.sql` |
| `src/components/FirstRunDialog.tsx` | Diganti `LoginScreen.tsx` |
| `public/sql-wasm.wasm` | Tidak dipakai |
| `pfm-data.db` (root) | Fresh start |

### Dependencies

**Tambah:** `@supabase/supabase-js`, `@tanstack/react-query`
**Hapus:** `sql.js`, `@types/sql.js`

## Schema (Postgres lift-and-shift)

`supabase/migrations/0001_init.sql` berisi (sketsa, detail final saat implementasi):

```sql
-- Tables (lift dari src/db/schema.ts, ubah ke tipe Postgres)
CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, type)
);

CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category_id BIGINT NOT NULL REFERENCES categories(id),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- (investments, price_history, goals, notes, settings — sama pola)

-- Seed default categories
INSERT INTO categories (name, type) VALUES
  ('Makanan', 'expense'), ('Transportasi', 'expense'), ...;

-- RLS: hanya authenticated user
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- (sama untuk semua tabel)

-- Email allowlist via Auth Hook (function dipanggil saat sign-up)
CREATE FUNCTION public.enforce_email_allowlist()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email NOT IN ('asistensme@gmail.com') THEN
    RAISE EXCEPTION 'Email tidak diizinkan';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_email_allowlist_trg
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_email_allowlist();

-- RPC untuk reports aggregation
CREATE FUNCTION aggregate_by_period(
  granularity TEXT, from_date DATE, to_date DATE
) RETURNS TABLE(period TEXT, income NUMERIC, expense NUMERIC) AS $$ ... $$ LANGUAGE SQL STABLE;

CREATE FUNCTION aggregate_by_category(
  txn_type TEXT, from_date DATE, to_date DATE
) RETURNS TABLE(category TEXT, total NUMERIC) AS $$ ... $$ LANGUAGE SQL STABLE;
```

Penyesuaian tipe Postgres: `INTEGER PRIMARY KEY AUTOINCREMENT` → `BIGSERIAL PRIMARY KEY`; `REAL` → `NUMERIC(15,2)`; `TIMESTAMP` → `TIMESTAMPTZ`.

## Data flow

### Auth flow

- Cold start: `AuthProvider` panggil `supabase.auth.getSession()`. Jika ada → render app; jika tidak → render `<LoginScreen>`.
- Login: klik "Masuk dengan Google" → `supabase.auth.signInWithOAuth({ provider: 'google' })` → redirect Google → callback → token disimpan otomatis di localStorage oleh supabase-js → `onAuthStateChange` fire → app render.
- Email allowlist enforcement di sisi Postgres (Auth Hook trigger). Email lain ditolak saat sign-up.
- Token refresh: built-in oleh supabase-js, tidak perlu code tambahan.
- Logout: `supabase.auth.signOut()` → render `<LoginScreen>`.

### Read flow (contoh: transactions)

```
Tab mount → useTransactions(filters)
  → queryKey: ['transactions', filters]
  → cache hit fresh? return cached
  → else queryFn: listTransactions(filters)
       → supabase.from('transactions')
           .select('*, categories(name)')
           .order('date', { ascending: false })
  → return { data, isLoading, error } ke tab
```

### Write flow (contoh: create)

```
Submit form → useCreateTransaction().mutate(input)
  → mutationFn: createTransaction(input)
       → supabase.from('transactions').insert([input])
  → onSuccess:
       → invalidateQueries(['transactions'])
       → invalidateQueries(['reports'])
       → toast.success(...)
       → close dialog
  → onError:
       → toast.error(mapSupabaseError(err))
```

### Reports flow

Aggregations via Postgres RPC (`supabase.rpc('aggregate_by_period', {...})`) — bukan fetch-all-then-aggregate-di-client. Lebih cepat dan hemat bandwidth.

### CSV import

Parse di browser (kode `lib/csv.ts` existing), validasi tiap row, batch insert via `supabase.from('transactions').insert(rows)`, invalidate queries terkait, toast hasil ("X diimpor, Y gagal").

## Error handling

### Layered

1. `db/*` validations throw `Error('pesan ID')`.
2. Mutation `onError` → toast.error via `mapSupabaseError()`.
3. Query `isError` → empty state + retry button di tab.
4. ErrorBoundary existing menangkap render errors.

### `mapSupabaseError(err)` → bahasa Indonesia

| Code | Pesan |
|---|---|
| `PGRST116` | "Data tidak ditemukan" |
| `23505` | "Data sudah ada" |
| `23503` | "Data masih dipakai di tempat lain" |
| 401/403 | "Sesi habis, silakan login ulang" + auto signOut |
| Network | "Koneksi bermasalah, coba lagi" |
| default | `err.message` |

### Loading states

- App boot: full-screen spinner saat `AuthProvider` cek session.
- Tab first load: skeleton rows.
- Refetch: subtle indicator (tidak block UI).
- Mutation: tombol disabled + spinner kecil.

### Network failure

- `navigator.onLine` listener → `<OfflineBanner>` saat offline.
- TanStack Query `retry: 1` (bukan default 3) supaya tidak hang lama.
- `refetchOnReconnect: true` (default) — auto refetch saat online lagi.
- Tidak ada mutation queue (cloud-first, YAGNI).

### Edge cases

| Case | Handling |
|---|---|
| Session expired | 401 → toast "Sesi habis" → auto signOut |
| Email di-revoke | Existing session jalan sampai logout; sign-up baru ditolak |
| Concurrent edit (2 tab) | Last-write-wins. Single-user, risiko rendah. |
| OAuth callback gagal | Tetap di LoginScreen. Optional: toast "Login dibatalkan". |
| RLS bug → empty data | Empty state UI existing. Verifikasi via smoke test. |
| Migration belum jalan | First query 42P01 → toast "Schema belum siap". Migration jalan sebelum deploy. |

### Env & secret management

- `.env.local` tidak di-commit (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- `.env.example` di-commit sebagai template.
- Vercel env vars di-set via dashboard.
- Anon key aman public; keamanan dari RLS.
- Service role key TIDAK dipakai di frontend.

## Deployment

```
Local dev: npm run dev → localhost:5173, .env.local → Supabase production
Schema:    npx supabase db push → apply migration baru
Git push:  master → Vercel auto build & deploy ke pfm-web.vercel.app
```

Vercel preview deployments untuk branch non-master (gratis, otomatis).

## Testing

**MVP: manual smoke test only**, ditulis di `docs/SMOKE_TEST.md`. Checklist:

- LoginScreen muncul di incognito; Google OAuth jalan.
- Email lain ditolak.
- Header tampil avatar + email + Keluar.
- 6 tab CRUD lengkap.
- CSV import/export.
- Tema light/dark/system.
- Multi-device: data sama saat dibuka di HP.
- Offline banner muncul saat WiFi off.

(Detail langkah lengkap di `docs/SMOKE_TEST.md` saat implementasi.)

Automated tests ditambahkan di sub-project terpisah jika diperlukan kemudian.

## Implementation milestones

| # | Milestone | Output | Estimasi |
|---|---|---|---|
| M1 | Supabase project + schema migration + RLS + email allowlist | Project live, tabel siap, allowlist aktif | 2–3 jam |
| M2 | Auth integration (Provider, LoginScreen, AccountMenu) | Login Google jalan di local dev, conditional render | 3–4 jam |
| M3 | Swap db layer ke Supabase client | Reads/writes jalan via Supabase, signature lama tetap | 4–6 jam |
| M4 | Tambah TanStack Query + queries layer + adopt di tabs | Tabs pakai useQuery/useMutation | 4–6 jam |
| M5 | Reports RPC functions + integrasi | Charts laporan jalan via RPC | 2–3 jam |
| M6 | CSV import/export adaptasi | CSV bolak-balik jalan | 2 jam |
| M7 | Cleanup (hapus sql.js, fileHandle, dll) + SettingsTab refactor | Repo bersih | 1–2 jam |
| M8 | Deploy ke Vercel + smoke test + bugfix | Live, smoke test passed | 2–3 jam |

**Total kasar:** 20–30 jam (3–5 hari kerja efektif solo).

## Definition of Done

- ✅ URL Vercel publik dapat diakses.
- ✅ Google OAuth login berfungsi; email selain `asistensme@gmail.com` ditolak.
- ✅ 6 tab CRUD jalan setara versi lokal sekarang.
- ✅ CSV import/export jalan.
- ✅ Theme dark/light/system jalan.
- ✅ `docs/SMOKE_TEST.md` checklist semua centang.
- ✅ Repo bersih dari kode sql.js / FileHandle.
- ✅ Migration SQL versioned di `supabase/migrations/`.
- ✅ README di-update dengan setup instructions (env vars, migration, deploy).

## Risks & mitigations

| Risiko | Mitigasi |
|---|---|
| Free tier limit | Sangat tidak mungkin untuk single-user. Monitor dashboard. |
| OAuth callback URL salah | Test di M2, dokumentasi callback URL di README. |
| RLS policy salah → leak | Smoke test wajib coba akses tanpa login → harus 401. |
| Migration salah → data hilang | Fresh start, risiko data loss = 0. Test di Supabase dashboard sebelum push. |
| TanStack Query learning curve | Mulai 1 hook, copy pola. Dokumentasi resmi sangat baik. |

## Open questions (untuk sub-project berikut, bukan MVP ini)

- Custom domain Vercel — kapan?
- PWA (installable) — kapan?
- API mana untuk auto-fetch harga IDX/emas/reksadana? (sub-project D research)
- Backup otomatis ke Google Drive di samping data Supabase?
