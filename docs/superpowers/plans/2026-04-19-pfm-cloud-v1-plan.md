# PFM Cloud v1.0 — Migration MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot Personal Finance Manager dari aplikasi sql.js lokal ke aplikasi cloud-first multi-device dengan Supabase + Vercel + Google OAuth, mempertahankan seluruh functional parity dari versi lokal.

**Architecture:** SPA React 19 + Vite di Vercel bicara langsung ke Supabase (Postgres + Auth + PostgREST) via `@supabase/supabase-js`. State data dikelola TanStack Query di atas lapisan tipis `src/db/*` yang membungkus Supabase client. Auth via Google OAuth dengan email allowlist enforced via Postgres trigger pada `auth.users`. Single-user — tidak ada `user_id` column, RLS hanya cek "must be authenticated".

**Tech Stack:** React 19, Vite 8, TypeScript 6, Tailwind 4, shadcn-ui, `@supabase/supabase-js`, `@tanstack/react-query`, Supabase CLI, Vercel.

**Spec reference:** `docs/superpowers/specs/2026-04-19-pfm-cloud-v1-design.md`

**Testing approach:** Manual smoke test (no automated tests in MVP per user decision). Each task ends with verification: TypeScript compile (`npm run build`) + manual click-through where applicable.

**Conventions:**
- Commit message format: `<scope>(<area>): <short description>` mengikuti commit history existing (mis. `feat:`, `refactor:`, `chore:`).
- Setiap task selesai → commit (frequent commits).
- Branch: kerjakan di `master` (single-dev project, no PRs needed).

---

## Milestone overview

| # | Milestone | Tasks |
|---|---|---|
| M1 | External setup + DB schema | 1.1 – 1.7 |
| M2 | Auth integration | 2.1 – 2.10 |
| M3 | Swap db layer | 3.1 – 3.6 |
| M4 | TanStack Query layer + adopt di tabs | 4.1 – 4.10 |
| M5 | Reports RPC + integration | 5.1 – 5.5 |
| M6 | CSV adaptation | 6.1 – 6.3 |
| M7 | Cleanup | 7.1 – 7.6 |
| M8 | Deploy + smoke test | 8.1 – 8.6 |

---

## File Structure (after MVP complete)

```
pfm-web/
├── supabase/
│   ├── config.toml                  # CLI config (M1)
│   └── migrations/
│       ├── 0001_init.sql            # Schema + RLS + allowlist (M1)
│       └── 0002_reports_rpc.sql     # Aggregation RPC functions (M5)
├── src/
│   ├── lib/
│   │   ├── supabase.ts              # Client singleton (M2)
│   │   ├── queryClient.ts           # TanStack QueryClient (M2)
│   │   ├── errors.ts                # mapSupabaseError() (M2)
│   │   ├── format.ts                # KEEP existing
│   │   ├── theme.ts                 # KEEP existing
│   │   ├── csv.ts                   # KEEP existing
│   │   └── utils.ts                 # KEEP existing
│   ├── auth/
│   │   ├── AuthProvider.tsx         # Context + onAuthStateChange (M2)
│   │   └── useAuth.ts               # Hook (M2)
│   ├── components/
│   │   ├── LoginScreen.tsx          # NEW (M2)
│   │   ├── AccountMenu.tsx          # NEW (M2)
│   │   ├── OfflineBanner.tsx        # NEW (M2)
│   │   ├── ErrorBoundary.tsx        # KEEP
│   │   ├── TransactionDialog.tsx    # MODIFY (M4)
│   │   ├── InvestmentDialog.tsx     # MODIFY (M4)
│   │   ├── PriceUpdateDialog.tsx    # MODIFY (M4)
│   │   ├── GoalDialog.tsx           # MODIFY (M4)
│   │   ├── AddMoneyDialog.tsx       # MODIFY (M4)
│   │   ├── NoteDialog.tsx           # MODIFY (M4)
│   │   ├── PanduanDialog.tsx        # KEEP
│   │   ├── TentangDialog.tsx        # KEEP
│   │   └── ui/                      # KEEP shadcn components
│   ├── db/
│   │   ├── categories.ts            # REWRITE (M3)
│   │   ├── transactions.ts          # REWRITE (M3)
│   │   ├── investments.ts           # REWRITE (M3)
│   │   ├── goals.ts                 # REWRITE (M3)
│   │   ├── notes.ts                 # REWRITE (M3)
│   │   ├── reports.ts               # REWRITE (M5)
│   │   ├── csvTransactions.ts       # MODIFY (M6)
│   │   └── csvInvestments.ts        # MODIFY (M6)
│   ├── queries/
│   │   ├── categories.ts            # NEW (M4)
│   │   ├── transactions.ts          # NEW (M4)
│   │   ├── investments.ts           # NEW (M4)
│   │   ├── goals.ts                 # NEW (M4)
│   │   ├── notes.ts                 # NEW (M4)
│   │   └── reports.ts               # NEW (M5)
│   ├── tabs/                        # MODIFY all (M4, M5)
│   ├── App.tsx                      # MODIFY (M2)
│   └── main.tsx                     # MODIFY (M2 — wrap providers)
├── docs/
│   └── SMOKE_TEST.md                # NEW (M8)
├── .env.example                     # NEW (M2)
├── .env.local                       # NEW (M1, gitignored)
└── package.json                     # MODIFY (M2, M7)
```

**Deleted:** `src/db/database.ts`, `src/db/fileHandle.ts`, `src/db/store.ts`, `src/db/repo.ts`, `src/db/schema.ts`, `src/components/FirstRunDialog.tsx`, `public/sql-wasm.wasm`.

---

# Milestone 1 — External setup + DB schema

## Task 1.1: Setup Google Cloud OAuth client

**Files:** None (manual setup di Google Cloud Console).

- [ ] **Step 1:** Buka `https://console.cloud.google.com/`. Buat project baru bernama `pfm-web` (atau gunakan project existing).

- [ ] **Step 2:** Sidebar → APIs & Services → OAuth consent screen.
  - User type: **External**
  - App name: `Personal Finance Manager`
  - User support email: `asistensme@gmail.com`
  - Developer contact: `asistensme@gmail.com`
  - Scopes: tambah `email`, `profile`, `openid`
  - Test users: tambah `asistensme@gmail.com`
  - Save & continue.

- [ ] **Step 3:** APIs & Services → Credentials → Create Credentials → OAuth client ID.
  - Application type: **Web application**
  - Name: `pfm-web client`
  - Authorized JavaScript origins:
    - `http://localhost:5173`
    - `https://pfm-web.vercel.app` (placeholder; Vercel URL final dipasang di M8)
  - Authorized redirect URIs: KOSONGKAN dulu — akan diisi di Task 1.3 setelah dapat Supabase project ref.
  - Create.

- [ ] **Step 4:** Catat **Client ID** dan **Client Secret** dari modal yang muncul. Simpan sementara di tempat aman (akan dimasukkan ke Supabase di Task 1.3).

- [ ] **Step 5:** Tidak ada commit — manual setup di luar repo.

---

## Task 1.2: Buat Supabase project

**Files:** None (manual setup di Supabase dashboard).

- [ ] **Step 1:** Buka `https://app.supabase.com/`. Login (gunakan akun GitHub atau Google).

- [ ] **Step 2:** New project.
  - Organization: pilih atau buat baru.
  - Name: `pfm-web`
  - Database password: generate strong password, **simpan di password manager** (jarang dipakai tapi penting).
  - Region: **Southeast Asia (Singapore)** — `ap-southeast-1`.
  - Pricing plan: Free.
  - Create new project. Tunggu provisioning (~2 menit).

- [ ] **Step 3:** Setelah project ready, buka Project Settings → API.
  - Catat **Project URL** (format: `https://xxxxx.supabase.co`).
  - Catat **anon public** key (akan masuk `.env.local` di Task 1.7).
  - Project ref = bagian `xxxxx` dari URL.

- [ ] **Step 4:** Tidak ada commit.

---

## Task 1.3: Konfigurasi Supabase Auth → Google provider + URL allowlist

**Files:** None (manual setup di Supabase dashboard + Google Cloud Console).

- [ ] **Step 1:** Supabase dashboard → Authentication → Providers → Google → Enable.
  - Client ID: paste dari Task 1.1 Step 4
  - Client Secret: paste dari Task 1.1 Step 4
  - Authorized Client IDs: kosongkan
  - Save.

- [ ] **Step 2:** Setelah save, Supabase tampilkan callback URL berbentuk `https://<project-ref>.supabase.co/auth/v1/callback`. Copy URL ini.

- [ ] **Step 3:** Balik ke Google Cloud Console → Credentials → klik OAuth client `pfm-web client` → tambahkan callback URL dari Step 2 ke **Authorized redirect URIs**. Save.

- [ ] **Step 4:** Supabase dashboard → Authentication → URL Configuration:
  - **Site URL:** `https://pfm-web.vercel.app` (placeholder, akan di-update di M8 setelah deploy actual)
  - **Redirect URLs (allowlist):** tambahkan dua entry:
    - `http://localhost:5173/**`
    - `https://pfm-web.vercel.app/**`
  - Save.

- [ ] **Step 5:** Tidak ada commit.

---

## Task 1.4: Inisialisasi Supabase CLI di repo

**Files:**
- Create: `supabase/config.toml`
- Modify: `.gitignore` (tambah Supabase artifacts)

- [ ] **Step 1:** Install Supabase CLI (kalau belum ada secara global).

```bash
npm install -D supabase
```

- [ ] **Step 2:** Init Supabase di repo.

```bash
npx supabase init
```

Output: membuat folder `supabase/` dengan `config.toml`. Saat ditanya "Generate VS Code settings": pilih **No** (atau Yes sesuai preferensi).

- [ ] **Step 3:** Link ke project remote (gunakan project ref dari Task 1.2 Step 3).

```bash
npx supabase link --project-ref <project-ref>
```

Saat diminta database password: paste password dari Task 1.2 Step 2.

- [ ] **Step 4:** Update `.gitignore` — tambahkan baris:

```
# Supabase CLI
supabase/.branches
supabase/.temp
```

- [ ] **Step 5:** Commit.

```bash
git add .gitignore supabase/
git commit -m "chore: init supabase CLI + link to project"
```

---

## Task 1.5: Tulis migration awal (schema + seed + RLS + allowlist trigger)

**Files:**
- Create: `supabase/migrations/0001_init.sql`

- [ ] **Step 1:** Buat file migration.

```bash
npx supabase migration new init
```

Ini buat file `supabase/migrations/<timestamp>_init.sql`. Rename file ke `0001_init.sql` untuk konsistensi:

```bash
# (ganti <timestamp> dengan timestamp aktual yang dihasilkan)
mv supabase/migrations/<timestamp>_init.sql supabase/migrations/0001_init.sql
```

- [ ] **Step 2:** Tulis isi migration. Buka `supabase/migrations/0001_init.sql` dan isi:

```sql
-- ============================================================
-- 0001_init: PFM Cloud v1.0 schema (lift-and-shift dari sql.js)
-- ============================================================

-- ----- Tables ------------------------------------------------

CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, type)
);

CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category_id BIGINT NOT NULL REFERENCES categories(id),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transactions_date_idx ON transactions(date DESC);
CREATE INDEX transactions_category_idx ON transactions(category_id);

CREATE TABLE investments (
  id BIGSERIAL PRIMARY KEY,
  asset_type TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  quantity NUMERIC(20, 8) NOT NULL CHECK (quantity >= 0),
  buy_price NUMERIC(20, 8) NOT NULL CHECK (buy_price >= 0),
  current_price NUMERIC(20, 8) CHECK (current_price >= 0),
  buy_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE price_history (
  id BIGSERIAL PRIMARY KEY,
  investment_id BIGINT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  price NUMERIC(20, 8) NOT NULL CHECK (price >= 0),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX price_history_investment_idx ON price_history(investment_id, date DESC);

CREATE TABLE goals (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  target_amount NUMERIC(15, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notes (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  date DATE NOT NULL,
  linked_transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- settings table dipertahankan untuk parity (belum dipakai aktif di MVP)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ----- Seed default categories -------------------------------

INSERT INTO categories (name, type) VALUES
  ('Makanan', 'expense'),
  ('Transportasi', 'expense'),
  ('Hiburan', 'expense'),
  ('Tagihan', 'expense'),
  ('Kesehatan', 'expense'),
  ('Belanja', 'expense'),
  ('Lainnya', 'expense'),
  ('Gaji', 'income'),
  ('Bonus', 'income'),
  ('Dividen', 'income'),
  ('Lainnya', 'income');

-- ----- Row Level Security ------------------------------------
-- Single-user model: any authenticated user has full access.
-- Email allowlist enforced via auth.users trigger below.

ALTER TABLE categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings       ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_all_categories    ON categories    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_transactions  ON transactions  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_investments   ON investments   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_price_history ON price_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_goals         ON goals         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_notes         ON notes         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_settings      ON settings      FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----- Email allowlist (sign-up gate) ------------------------

CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email NOT IN ('asistensme@gmail.com') THEN
    RAISE EXCEPTION 'Email tidak diizinkan untuk aplikasi ini';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_email_allowlist_trg
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_email_allowlist();
```

- [ ] **Step 3:** Push migration ke Supabase production.

```bash
npx supabase db push
```

Output yang diharapkan: `Applying migration 0001_init.sql...` → `Finished supabase db push.`

- [ ] **Step 4:** Verifikasi di Supabase dashboard → Table Editor: 7 tabel (`categories`, `transactions`, `investments`, `price_history`, `goals`, `notes`, `settings`) muncul. Kategori default ada 11 baris di tabel `categories`.

- [ ] **Step 5:** Commit.

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat(db): initial Postgres schema + seed + RLS + email allowlist"
```

---

## Task 1.6: Verifikasi RLS & allowlist secara manual

**Files:** None (testing).

- [ ] **Step 1:** Di Supabase dashboard → SQL Editor, jalankan tanpa auth (anon role default):

```sql
SELECT * FROM transactions;
```

Expected: error `new row violates row-level security policy` atau result kosong tergantung context. Untuk verifikasi paling jelas, gunakan Authentication → Users (Step 2).

- [ ] **Step 2:** Test allowlist via SQL Editor:

```sql
-- Simulasi insert user dengan email tidak diizinkan (akan di-reject)
INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'random@example.com');
```

Expected: `ERROR: Email tidak diizinkan untuk aplikasi ini`. Ini membuktikan trigger jalan.

- [ ] **Step 3:** Tidak ada commit (verifikasi saja).

---

## Task 1.7: Setup `.env.local` & `.env.example`

**Files:**
- Create: `.env.local` (gitignored)
- Create: `.env.example` (committed)

- [ ] **Step 1:** Buat `.env.example`:

```
# Supabase project credentials
# Dapat dari: Supabase dashboard → Project Settings → API
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

- [ ] **Step 2:** Buat `.env.local` (TIDAK di-commit; covered by `*.local` di `.gitignore`):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key-dari-task-1.2>
```

Ganti `<project-ref>` dan `<anon-public-key-dari-task-1.2>` dengan nilai aktual.

- [ ] **Step 3:** Verifikasi `.env.local` tidak masuk staging:

```bash
git status
```

Expected: `.env.local` tidak muncul (ignored). Jika muncul, periksa `.gitignore` punya `*.local`.

- [ ] **Step 4:** Commit `.env.example` saja.

```bash
git add .env.example
git commit -m "chore(env): add .env.example template"
```

---

# Milestone 2 — Auth integration

## Task 2.1: Install dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1:** Install Supabase JS client + TanStack Query:

```bash
npm install @supabase/supabase-js @tanstack/react-query
```

- [ ] **Step 2:** Verifikasi versi terpasang:

```bash
npm list @supabase/supabase-js @tanstack/react-query
```

- [ ] **Step 3:** Commit.

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add @supabase/supabase-js + @tanstack/react-query"
```

---

## Task 2.2: Buat Supabase client singleton

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] **Step 1:** Tulis `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Supabase env vars missing. Cek .env.local: VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY harus terisi.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
```

- [ ] **Step 2:** Verifikasi build TypeScript jalan:

```bash
npm run build
```

Expected: tidak ada error. (Build mungkin gagal di tempat lain karena belum ganti db layer — itu ditangani di M3. Tapi error import `@/lib/supabase` saja seharusnya tidak ada.)

- [ ] **Step 3:** Commit.

```bash
git add src/lib/supabase.ts
git commit -m "feat(lib): add supabase client singleton"
```

---

## Task 2.3: Buat TanStack QueryClient

**Files:**
- Create: `src/lib/queryClient.ts`

- [ ] **Step 1:** Tulis `src/lib/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30 detik fresh
      retry: 1,                    // jangan retry 3x default — UX lebih cepat fail
      refetchOnWindowFocus: false, // hindari refetch agresif
      refetchOnReconnect: true,    // auto refetch saat online lagi
    },
    mutations: {
      retry: 0,
    },
  },
})
```

- [ ] **Step 2:** Commit.

```bash
git add src/lib/queryClient.ts
git commit -m "feat(lib): add TanStack QueryClient with sensible defaults"
```

---

## Task 2.4: Buat error mapper

**Files:**
- Create: `src/lib/errors.ts`

- [ ] **Step 1:** Tulis `src/lib/errors.ts`:

```ts
import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Translate Supabase / Postgres / network errors ke pesan bahasa Indonesia
 * yang aman ditampilkan ke user via toast.
 */
export function mapSupabaseError(err: unknown): string {
  if (!err) return 'Terjadi kesalahan'

  // PostgrestError punya field code + message
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const e = err as PostgrestError
    switch (e.code) {
      case 'PGRST116':
        return 'Data tidak ditemukan'
      case '23505':
        return 'Data sudah ada (duplikat)'
      case '23503':
        return 'Data masih dipakai di tempat lain — hapus referensi dulu'
      case '42P01':
        return 'Skema database belum siap. Hubungi admin.'
    }
    // Auth errors biasanya pakai status 401/403
    if ('status' in e && (e.status === 401 || e.status === 403)) {
      return 'Sesi habis, silakan login ulang'
    }
  }

  // Network / fetch errors
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return 'Koneksi bermasalah, coba lagi'
  }

  // Fallback ke pesan asli
  if (err instanceof Error) return err.message
  return String(err)
}

/** Cek apakah error mengindikasikan sesi habis (untuk auto-signOut). */
export function isAuthError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  if ('status' in err) {
    const status = (err as { status: unknown }).status
    return status === 401 || status === 403
  }
  return false
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/lib/errors.ts
git commit -m "feat(lib): add Supabase error mapper to Indonesian messages"
```

---

## Task 2.5: Buat AuthProvider + useAuth hook

**Files:**
- Create: `src/auth/AuthProvider.tsx`
- Create: `src/auth/useAuth.ts`

- [ ] **Step 1:** Tulis `src/auth/AuthProvider.tsx`:

```tsx
import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initial check
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // Subscribe perubahan
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    signInWithGoogle,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
```

- [ ] **Step 2:** Tulis `src/auth/useAuth.ts`:

```ts
import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './AuthProvider'

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
```

- [ ] **Step 3:** Commit.

```bash
git add src/auth/
git commit -m "feat(auth): add AuthProvider context + useAuth hook"
```

---

## Task 2.6: Buat LoginScreen

**Files:**
- Create: `src/components/LoginScreen.tsx`

- [ ] **Step 1:** Tulis `src/components/LoginScreen.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/auth/useAuth'
import { toast } from 'sonner'
import { mapSupabaseError } from '@/lib/errors'

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  // Tangkap error dari OAuth callback URL (mis. ?error=access_denied atau ?error_description=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
    const errDesc = params.get('error_description') || params.get('error')
    if (errDesc) {
      if (/email/i.test(errDesc) || /not allowed/i.test(errDesc) || /tidak diizinkan/i.test(errDesc)) {
        toast.error('Email tidak diizinkan untuk aplikasi ini')
      } else if (/access.denied|cancel/i.test(errDesc)) {
        toast.info('Login dibatalkan')
      } else {
        toast.error(`Login gagal: ${errDesc}`)
      }
      // Bersihkan URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function handleLogin() {
    try {
      setSubmitting(true)
      await signInWithGoogle()
      // Redirect ke Google — code di bawah ini tidak akan jalan
    } catch (e) {
      toast.error(mapSupabaseError(e))
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Personal Finance Manager
          </h1>
          <p className="text-sm text-muted-foreground">
            Financial cockpit pribadi — multi-device, aman, gratis.
          </p>
        </div>
        <Button
          onClick={handleLogin}
          disabled={submitting}
          size="lg"
          className="w-full"
        >
          {submitting ? 'Mengalihkan ke Google…' : 'Masuk dengan Google'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Hanya akun yang diizinkan yang dapat masuk.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/components/LoginScreen.tsx
git commit -m "feat(auth): add LoginScreen with Google sign-in + callback error handling"
```

---

## Task 2.7: Buat AccountMenu

**Files:**
- Create: `src/components/AccountMenu.tsx`

- [ ] **Step 1:** Tulis `src/components/AccountMenu.tsx`:

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { LogOut, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { toast } from 'sonner'

export default function AccountMenu() {
  const { user, signOut } = useAuth()

  if (!user) return null

  const avatar = user.user_metadata?.avatar_url as string | undefined
  const name =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'User'
  const email = user.email ?? ''

  async function handleLogout() {
    await signOut()
    toast.success('Berhasil keluar')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          {avatar ? (
            <img src={avatar} alt={name} className="h-7 w-7 rounded-full" />
          ) : (
            <UserIcon className="h-5 w-5" />
          )}
          <span className="hidden sm:inline text-sm">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{name}</p>
            <p className="text-xs leading-none text-muted-foreground">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 2:** Cek apakah `dropdown-menu` shadcn sudah ada di `src/components/ui/`. Kalau belum, install:

```bash
npx shadcn@latest add dropdown-menu
```

- [ ] **Step 3:** Commit.

```bash
git add src/components/AccountMenu.tsx src/components/ui/dropdown-menu.tsx 2>/dev/null || git add src/components/AccountMenu.tsx
git commit -m "feat(auth): add AccountMenu dropdown for user profile + logout"
```

---

## Task 2.8: Buat OfflineBanner

**Files:**
- Create: `src/components/OfflineBanner.tsx`

- [ ] **Step 1:** Tulis `src/components/OfflineBanner.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export default function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    function handleOnline() { setOnline(true) }
    function handleOffline() { setOnline(false) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online) return null

  return (
    <div className="bg-destructive text-destructive-foreground px-4 py-2 text-sm flex items-center gap-2 justify-center">
      <WifiOff className="h-4 w-4" />
      <span>Offline — beberapa fitur tidak tersedia.</span>
    </div>
  )
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/components/OfflineBanner.tsx
git commit -m "feat(ui): add OfflineBanner for navigator.onLine state"
```

---

## Task 2.9: Wire App.tsx + main.tsx dengan providers + conditional render

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1:** Update `src/main.tsx` — wrap dengan QueryClientProvider + AuthProvider:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/auth/AuthProvider'
import { queryClient } from '@/lib/queryClient'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
```

(Catatan: kalau `main.tsx` existing punya import lain mis. theme provider, pertahankan & tambahkan saja yang baru.)

- [ ] **Step 2:** Update `src/App.tsx` — ganti FirstRunDialog dengan LoginScreen + AccountMenu + OfflineBanner:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import {
  Wallet,
  TrendingUp,
  Target,
  StickyNote,
  BarChart3,
  Settings as SettingsIcon,
} from 'lucide-react'
import TransactionsTab from '@/tabs/TransactionsTab'
import InvestmentsTab from '@/tabs/InvestmentsTab'
import GoalsTab from '@/tabs/GoalsTab'
import NotesTab from '@/tabs/NotesTab'
import ReportsTab from '@/tabs/ReportsTab'
import SettingsTab from '@/tabs/SettingsTab'
import LoginScreen from '@/components/LoginScreen'
import AccountMenu from '@/components/AccountMenu'
import OfflineBanner from '@/components/OfflineBanner'
import { useAuth } from '@/auth/useAuth'

const TABS = [
  { value: 'transactions', label: 'Transaksi', icon: Wallet, Comp: TransactionsTab },
  { value: 'investments', label: 'Investasi', icon: TrendingUp, Comp: InvestmentsTab },
  { value: 'goals', label: 'Goals', icon: Target, Comp: GoalsTab },
  { value: 'notes', label: 'Catatan', icon: StickyNote, Comp: NotesTab },
  { value: 'reports', label: 'Laporan', icon: BarChart3, Comp: ReportsTab },
  { value: 'settings', label: 'Pengaturan', icon: SettingsIcon, Comp: SettingsTab },
] as const

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Memuat…
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <LoginScreen />
        <Toaster richColors position="top-right" />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <OfflineBanner />
      <header className="border-b px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Personal Finance Manager
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola keuangan pribadi — multi-device
          </p>
        </div>
        <AccountMenu />
      </header>

      <main className="p-6">
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="mb-6">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map(({ value, Comp }) => (
            <TabsContent key={value} value={value}>
              <Comp />
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <Toaster richColors position="top-right" />
    </div>
  )
}

export default App
```

- [ ] **Step 3:** Build & cek error:

```bash
npm run build
```

Expected: kemungkinan masih ada error di tabs/dialogs karena db layer belum diganti (M3). Itu OK — yang penting App.tsx & main.tsx sendiri tidak ada error import. Kalau build error karena `db/store` masih dipakai di tab, abaikan dulu (akan diperbaiki di M3-M4).

- [ ] **Step 4:** Commit.

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat(app): wire AuthProvider + QueryClient + conditional LoginScreen"
```

---

## Task 2.10: Smoke test login flow di local dev

**Files:** None (testing).

- [ ] **Step 1:** Jalankan dev server:

```bash
npm run dev
```

(Jika build error karena db layer belum diganti, smoke test login bisa ditunda sampai setelah M3. Lompat ke M3 dulu, lalu kembali ke task ini.)

- [ ] **Step 2:** Buka `http://localhost:5173` di browser. Expected: LoginScreen muncul.

- [ ] **Step 3:** Klik "Masuk dengan Google" → redirect ke Google → pilih akun `asistensme@gmail.com` → consent → balik ke `localhost:5173/auth/callback#access_token=...`. Expected: app render (atau jika tabs masih error, header dengan AccountMenu muncul).

- [ ] **Step 4:** Klik avatar → dropdown muncul → klik "Keluar". Expected: balik ke LoginScreen + toast "Berhasil keluar".

- [ ] **Step 5:** (Optional) Test dengan Google account lain. Expected: redirect balik ke localhost dengan `?error_description=...` → toast "Email tidak diizinkan".

- [ ] **Step 6:** Tidak ada commit — verifikasi saja.

---

# Milestone 3 — Swap db layer ke Supabase client

## Task 3.1: Rewrite `src/db/categories.ts`

**Files:**
- Modify: `src/db/categories.ts`

- [ ] **Step 1:** Ganti seluruh isi `src/db/categories.ts`:

```ts
import { supabase } from '@/lib/supabase'

export interface Category {
  id: number
  name: string
  type: 'income' | 'expense'
  icon: string | null
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, type, icon')
    .order('type', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/db/categories.ts
git commit -m "refactor(db): swap categories to Supabase client"
```

---

## Task 3.2: Rewrite `src/db/transactions.ts`

**Files:**
- Modify: `src/db/transactions.ts`

- [ ] **Step 1:** Ganti seluruh isi `src/db/transactions.ts`:

```ts
import { supabase } from '@/lib/supabase'

export interface Transaction {
  id: number
  date: string
  type: 'income' | 'expense'
  category_id: number
  category_name: string
  amount: number
  note: string | null
}

export interface TransactionFilters {
  dateFrom?: string
  dateTo?: string
  type?: 'income' | 'expense' | ''
  categoryId?: number | null
}

export interface TransactionInput {
  date: string
  type: 'income' | 'expense'
  category_id: number
  amount: number
  note: string | null
}

interface RawRow {
  id: number
  date: string
  type: 'income' | 'expense'
  category_id: number
  amount: number
  note: string | null
  categories: { name: string } | null
}

export async function listTransactions(
  f: TransactionFilters = {},
): Promise<Transaction[]> {
  let q = supabase
    .from('transactions')
    .select('id, date, type, category_id, amount, note, categories(name)')
    .order('date', { ascending: false })
    .order('id', { ascending: false })

  if (f.dateFrom) q = q.gte('date', f.dateFrom)
  if (f.dateTo) q = q.lte('date', f.dateTo)
  if (f.type) q = q.eq('type', f.type)
  if (f.categoryId) q = q.eq('category_id', f.categoryId)

  const { data, error } = await q
  if (error) throw error

  return (data as unknown as RawRow[]).map((r) => ({
    id: r.id,
    date: r.date,
    type: r.type,
    category_id: r.category_id,
    category_name: r.categories?.name ?? '(tanpa kategori)',
    amount: Number(r.amount),
    note: r.note,
  }))
}

export async function createTransaction(t: TransactionInput): Promise<number> {
  if (t.amount <= 0) throw new Error('Jumlah harus lebih dari 0')
  const { data, error } = await supabase
    .from('transactions')
    .insert([t])
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateTransaction(
  id: number,
  t: TransactionInput,
): Promise<void> {
  if (t.amount <= 0) throw new Error('Jumlah harus lebih dari 0')
  const { error } = await supabase.from('transactions').update(t).eq('id', id)
  if (error) throw error
}

export async function deleteTransaction(id: number): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/db/transactions.ts
git commit -m "refactor(db): swap transactions to Supabase client"
```

---

## Task 3.3: Rewrite `src/db/investments.ts`

**Files:**
- Modify: `src/db/investments.ts`

- [ ] **Step 1:** Ganti seluruh isi `src/db/investments.ts`:

```ts
import { supabase } from '@/lib/supabase'

export interface Investment {
  id: number
  asset_type: string
  asset_name: string
  quantity: number
  buy_price: number
  current_price: number | null
  buy_date: string
  note: string | null
}

export interface InvestmentInput {
  asset_type: string
  asset_name: string
  quantity: number
  buy_price: number
  current_price: number | null
  buy_date: string
  note: string | null
}

export interface PriceHistoryEntry {
  id: number
  investment_id: number
  price: number
  date: string
}

const SELECT_FIELDS =
  'id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note'

export async function listInvestments(): Promise<Investment[]> {
  const { data, error } = await supabase
    .from('investments')
    .select(SELECT_FIELDS)
    .order('buy_date', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return (data ?? []).map(coerce)
}

export async function getInvestment(id: number): Promise<Investment | null> {
  const { data, error } = await supabase
    .from('investments')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? coerce(data) : null
}

export async function createInvestment(i: InvestmentInput): Promise<number> {
  if (i.quantity < 0) throw new Error('Kuantitas tidak boleh negatif')
  if (i.buy_price < 0) throw new Error('Harga beli tidak boleh negatif')
  const { data, error } = await supabase
    .from('investments')
    .insert([i])
    .select('id')
    .single()
  if (error) throw error
  if (i.current_price != null) {
    const { error: phErr } = await supabase
      .from('price_history')
      .insert([{ investment_id: data.id, price: i.current_price, date: i.buy_date }])
    if (phErr) throw phErr
  }
  return data.id
}

export async function updateInvestment(
  id: number,
  i: InvestmentInput,
): Promise<void> {
  if (i.quantity < 0) throw new Error('Kuantitas tidak boleh negatif')
  if (i.buy_price < 0) throw new Error('Harga beli tidak boleh negatif')
  const { error } = await supabase.from('investments').update(i).eq('id', id)
  if (error) throw error
}

export async function deleteInvestment(id: number): Promise<void> {
  // price_history dihapus cascade via FK ON DELETE CASCADE
  const { error } = await supabase.from('investments').delete().eq('id', id)
  if (error) throw error
}

export async function updatePrice(
  investmentId: number,
  price: number,
  date: string,
): Promise<void> {
  if (price < 0) throw new Error('Harga tidak boleh negatif')
  const { error: e1 } = await supabase
    .from('investments')
    .update({ current_price: price })
    .eq('id', investmentId)
  if (e1) throw e1
  const { error: e2 } = await supabase
    .from('price_history')
    .insert([{ investment_id: investmentId, price, date }])
  if (e2) throw e2
}

export async function getPriceHistory(
  investmentId: number,
): Promise<PriceHistoryEntry[]> {
  const { data, error } = await supabase
    .from('price_history')
    .select('id, investment_id, price, date')
    .eq('investment_id', investmentId)
    .order('date', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({ ...r, price: Number(r.price) }))
}

export async function listAssetTypes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('investments')
    .select('asset_type')
  if (error) throw error
  const existing = (data ?? []).map((r) => r.asset_type)
  const defaults = ['Saham', 'Reksadana', 'Emas', 'Kripto', 'Obligasi']
  return [...new Set([...defaults, ...existing])].sort()
}

// ----- Computation helpers (pure, tetap sama) ----------------

export function costBasis(inv: Investment): number {
  return inv.quantity * inv.buy_price
}

export function currentValue(inv: Investment): number {
  const price = inv.current_price ?? inv.buy_price
  return inv.quantity * price
}

export function gainLoss(inv: Investment): number {
  return currentValue(inv) - costBasis(inv)
}

export function gainLossPercent(inv: Investment): number {
  const cb = costBasis(inv)
  if (cb === 0) return 0
  return (gainLoss(inv) / cb) * 100
}

// ----- Internal ----------------------------------------------

function coerce(r: Record<string, unknown>): Investment {
  return {
    id: r.id as number,
    asset_type: r.asset_type as string,
    asset_name: r.asset_name as string,
    quantity: Number(r.quantity),
    buy_price: Number(r.buy_price),
    current_price: r.current_price == null ? null : Number(r.current_price),
    buy_date: r.buy_date as string,
    note: r.note as string | null,
  }
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/db/investments.ts
git commit -m "refactor(db): swap investments to Supabase client"
```

---

## Task 3.4: Rewrite `src/db/goals.ts`

**Files:**
- Modify: `src/db/goals.ts`

- [ ] **Step 1:** Ganti seluruh isi `src/db/goals.ts`:

```ts
import { supabase } from '@/lib/supabase'

export type GoalStatus = 'active' | 'completed' | 'paused'

export interface Goal {
  id: number
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  status: GoalStatus
}

export interface GoalInput {
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  status: GoalStatus
}

const SELECT_FIELDS = 'id, name, target_amount, current_amount, target_date, status'

export async function listGoals(): Promise<Goal[]> {
  // Sort: active dulu (status='active' = 0), paused (1), completed (2);
  // dalam status sama, target_date ASC NULLS LAST, lalu id DESC.
  // Postgres tidak punya CASE di REST query — sort di client.
  const { data, error } = await supabase
    .from('goals')
    .select(SELECT_FIELDS)
  if (error) throw error
  const order = (s: GoalStatus) => (s === 'active' ? 0 : s === 'paused' ? 1 : 2)
  return [...(data ?? [])]
    .map(coerce)
    .sort((a, b) => {
      const so = order(a.status) - order(b.status)
      if (so !== 0) return so
      const ad = a.target_date ?? '\uffff'
      const bd = b.target_date ?? '\uffff'
      if (ad !== bd) return ad < bd ? -1 : 1
      return b.id - a.id
    })
}

export async function getGoal(id: number): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? coerce(data) : null
}

export async function createGoal(g: GoalInput): Promise<number> {
  if (g.target_amount <= 0) throw new Error('Target harus > 0')
  if (g.current_amount < 0) throw new Error('Terkumpul tidak boleh negatif')
  const { data, error } = await supabase
    .from('goals')
    .insert([g])
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateGoal(id: number, g: GoalInput): Promise<void> {
  if (g.target_amount <= 0) throw new Error('Target harus > 0')
  if (g.current_amount < 0) throw new Error('Terkumpul tidak boleh negatif')
  const { error } = await supabase.from('goals').update(g).eq('id', id)
  if (error) throw error
}

export async function deleteGoal(id: number): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw error
}

export async function addMoneyToGoal(id: number, amount: number): Promise<void> {
  if (amount <= 0) throw new Error('Jumlah harus > 0')
  const goal = await getGoal(id)
  if (!goal) throw new Error('Goal tidak ditemukan')
  const newAmount = goal.current_amount + amount
  const newStatus: GoalStatus =
    newAmount >= goal.target_amount ? 'completed' : goal.status
  const { error } = await supabase
    .from('goals')
    .update({ current_amount: newAmount, status: newStatus })
    .eq('id', id)
  if (error) throw error
}

export function goalProgress(g: Goal): number {
  if (g.target_amount <= 0) return 0
  return Math.min(100, (g.current_amount / g.target_amount) * 100)
}

function coerce(r: Record<string, unknown>): Goal {
  return {
    id: r.id as number,
    name: r.name as string,
    target_amount: Number(r.target_amount),
    current_amount: Number(r.current_amount),
    target_date: (r.target_date as string | null) ?? null,
    status: r.status as GoalStatus,
  }
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/db/goals.ts
git commit -m "refactor(db): swap goals to Supabase client"
```

---

## Task 3.5: Rewrite `src/db/notes.ts`

**Files:**
- Modify: `src/db/notes.ts`

- [ ] **Step 1:** Baca file existing untuk lihat shape interface (kalau berbeda dari spec, ikuti existing). Lalu ganti seluruh isi dengan:

```ts
import { supabase } from '@/lib/supabase'

export interface Note {
  id: number
  title: string
  content: string
  date: string
  linked_transaction_id: number | null
}

export interface NoteInput {
  title: string
  content: string
  date: string
  linked_transaction_id: number | null
}

const SELECT_FIELDS = 'id, title, content, date, linked_transaction_id'

export async function listNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select(SELECT_FIELDS)
    .order('date', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getNote(id: number): Promise<Note | null> {
  const { data, error } = await supabase
    .from('notes')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createNote(n: NoteInput): Promise<number> {
  if (!n.title.trim()) throw new Error('Judul wajib diisi')
  if (!n.content.trim()) throw new Error('Isi catatan wajib diisi')
  const { data, error } = await supabase
    .from('notes')
    .insert([n])
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateNote(id: number, n: NoteInput): Promise<void> {
  if (!n.title.trim()) throw new Error('Judul wajib diisi')
  if (!n.content.trim()) throw new Error('Isi catatan wajib diisi')
  const { error } = await supabase.from('notes').update(n).eq('id', id)
  if (error) throw error
}

export async function deleteNote(id: number): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/db/notes.ts
git commit -m "refactor(db): swap notes to Supabase client"
```

---

## Task 3.6: Build verifikasi seluruh swap M3

**Files:** None (verification).

- [ ] **Step 1:** Coba build:

```bash
npm run build
```

Expected error: tabs masih impor `useDbStore` dari `@/db/store` (yang akan dihapus di M7) atau pemanggilan synchronous (mis. `setRows(listTransactions(filters))` tanpa await). Catat semua call site yang error.

- [ ] **Step 2:** Buat sticky note temporer — semua callsite yang break akan diperbaiki saat M4 (adopt useQuery di tabs). Untuk lulus build sementara, **belum bisa** — itu OK; M4 berikutnya akan menyelesaikan.

- [ ] **Step 3:** Tidak commit (verifikasi).

---

# Milestone 4 — TanStack Query layer + adopt di tabs

## Task 4.1: Buat `src/queries/categories.ts`

**Files:**
- Create: `src/queries/categories.ts`

- [ ] **Step 1:** Tulis:

```ts
import { useQuery } from '@tanstack/react-query'
import { listCategories } from '@/db/categories'

export const categoriesKey = ['categories'] as const

export function useCategories() {
  return useQuery({
    queryKey: categoriesKey,
    queryFn: listCategories,
    staleTime: 5 * 60_000, // 5 menit — kategori jarang berubah
  })
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/queries/categories.ts
git commit -m "feat(queries): add useCategories hook"
```

---

## Task 4.2: Buat `src/queries/transactions.ts`

**Files:**
- Create: `src/queries/transactions.ts`

- [ ] **Step 1:** Tulis:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
  type TransactionFilters,
  type TransactionInput,
} from '@/db/transactions'
import { toast } from 'sonner'
import { mapSupabaseError } from '@/lib/errors'

export const transactionsKey = (f: TransactionFilters = {}) =>
  ['transactions', f] as const

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['transactions'] })
  qc.invalidateQueries({ queryKey: ['reports'] })
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: transactionsKey(filters),
    queryFn: () => listTransactions(filters),
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TransactionInput) => createTransaction(input),
    onSuccess: () => {
      invalidateAll(qc)
      toast.success('Transaksi disimpan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number; input: TransactionInput }) =>
      updateTransaction(args.id, args.input),
    onSuccess: () => {
      invalidateAll(qc)
      toast.success('Transaksi diperbarui')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteTransaction(id),
    onSuccess: () => {
      invalidateAll(qc)
      toast.success('Transaksi dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/queries/transactions.ts
git commit -m "feat(queries): add transaction hooks (list/create/update/delete)"
```

---

## Task 4.3: Buat `src/queries/investments.ts`

**Files:**
- Create: `src/queries/investments.ts`

- [ ] **Step 1:** Tulis:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createInvestment,
  deleteInvestment,
  getPriceHistory,
  listAssetTypes,
  listInvestments,
  updateInvestment,
  updatePrice,
  type InvestmentInput,
} from '@/db/investments'
import { toast } from 'sonner'
import { mapSupabaseError } from '@/lib/errors'

export const investmentsKey = ['investments'] as const
export const priceHistoryKey = (id: number) => ['investments', id, 'history'] as const
export const assetTypesKey = ['investments', 'assetTypes'] as const

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: investmentsKey })
  qc.invalidateQueries({ queryKey: assetTypesKey })
}

export function useInvestments() {
  return useQuery({ queryKey: investmentsKey, queryFn: listInvestments })
}

export function useAssetTypes() {
  return useQuery({
    queryKey: assetTypesKey,
    queryFn: listAssetTypes,
    staleTime: 5 * 60_000,
  })
}

export function usePriceHistory(id: number | null) {
  return useQuery({
    queryKey: id == null ? ['investments', 'noop'] : priceHistoryKey(id),
    queryFn: () => getPriceHistory(id as number),
    enabled: id != null,
  })
}

export function useCreateInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InvestmentInput) => createInvestment(input),
    onSuccess: () => {
      invalidateAll(qc)
      toast.success('Investasi ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useUpdateInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number; input: InvestmentInput }) =>
      updateInvestment(args.id, args.input),
    onSuccess: () => {
      invalidateAll(qc)
      toast.success('Investasi diperbarui')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useDeleteInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteInvestment(id),
    onSuccess: () => {
      invalidateAll(qc)
      toast.success('Investasi dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useUpdatePrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { investmentId: number; price: number; date: string }) =>
      updatePrice(args.investmentId, args.price, args.date),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: investmentsKey })
      qc.invalidateQueries({ queryKey: priceHistoryKey(vars.investmentId) })
      toast.success('Harga diperbarui')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/queries/investments.ts
git commit -m "feat(queries): add investment hooks + price history + asset types"
```

---

## Task 4.4: Buat `src/queries/goals.ts`

**Files:**
- Create: `src/queries/goals.ts`

- [ ] **Step 1:** Tulis:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addMoneyToGoal,
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal,
  type GoalInput,
} from '@/db/goals'
import { toast } from 'sonner'
import { mapSupabaseError } from '@/lib/errors'

export const goalsKey = ['goals'] as const

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: goalsKey })
}

export function useGoals() {
  return useQuery({ queryKey: goalsKey, queryFn: listGoals })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GoalInput) => createGoal(input),
    onSuccess: () => {
      invalidate(qc)
      toast.success('Goal ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number; input: GoalInput }) =>
      updateGoal(args.id, args.input),
    onSuccess: () => {
      invalidate(qc)
      toast.success('Goal diperbarui')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteGoal(id),
    onSuccess: () => {
      invalidate(qc)
      toast.success('Goal dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useAddMoneyToGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number; amount: number }) =>
      addMoneyToGoal(args.id, args.amount),
    onSuccess: () => {
      invalidate(qc)
      toast.success('Dana ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/queries/goals.ts
git commit -m "feat(queries): add goal hooks + addMoney"
```

---

## Task 4.5: Buat `src/queries/notes.ts`

**Files:**
- Create: `src/queries/notes.ts`

- [ ] **Step 1:** Tulis:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createNote,
  deleteNote,
  listNotes,
  updateNote,
  type NoteInput,
} from '@/db/notes'
import { toast } from 'sonner'
import { mapSupabaseError } from '@/lib/errors'

export const notesKey = ['notes'] as const

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: notesKey })
}

export function useNotes() {
  return useQuery({ queryKey: notesKey, queryFn: listNotes })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NoteInput) => createNote(input),
    onSuccess: () => {
      invalidate(qc)
      toast.success('Catatan disimpan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number; input: NoteInput }) =>
      updateNote(args.id, args.input),
    onSuccess: () => {
      invalidate(qc)
      toast.success('Catatan diperbarui')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteNote(id),
    onSuccess: () => {
      invalidate(qc)
      toast.success('Catatan dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/queries/notes.ts
git commit -m "feat(queries): add note hooks"
```

---

## Task 4.6: Refactor `TransactionsTab.tsx` ke useQuery/useMutation

**Files:**
- Modify: `src/tabs/TransactionsTab.tsx`

- [ ] **Step 1:** Baca `src/tabs/TransactionsTab.tsx` (apa yang sekarang ada — sudah di-audit sebelumnya). Lakukan perubahan ini di file:

  - Hapus state `rows`, `categories` lokal, useEffect refresh.
  - Ganti dengan:

```tsx
const { data: rows = [], isLoading } = useTransactions(filters)
const { data: categories = [] } = useCategories()
const deleteMut = useDeleteTransaction()
```

  - Ganti import:

```tsx
import { useTransactions, useDeleteTransaction } from '@/queries/transactions'
import { useCategories } from '@/queries/categories'
```

  - Hapus import `listTransactions`, `deleteTransaction`, `listCategories` (tidak dipakai langsung lagi — TransactionDialog tetap impor `db/transactions` untuk type `Transaction`/`TransactionFilters`).
  - Ganti pemanggilan `await deleteTransaction(id)` → `deleteMut.mutate(id)`.
  - Hapus fungsi `refresh()` dan callsite-nya. Setelah dialog close, query di-invalidate otomatis oleh mutation onSuccess.
  - Tambah loading state: kalau `isLoading`, tampilkan placeholder skeleton sederhana di table (mis. "Memuat…").
  - Total income/expense (`useMemo` existing) tetap, sumbernya `rows` dari useQuery.

- [ ] **Step 2:** Untuk dialog, propagate callback `onSaved` tetap ada (existing pattern). TransactionDialog akan diadaptasi di Task 4.10.

- [ ] **Step 3:** Build cek error:

```bash
npm run build
```

Expected: TransactionsTab error berkurang. Sisa error mungkin di dialog & tab lain — itu task berikutnya.

- [ ] **Step 4:** Commit.

```bash
git add src/tabs/TransactionsTab.tsx
git commit -m "refactor(tabs): TransactionsTab to use TanStack Query hooks"
```

---

## Task 4.7: Refactor `InvestmentsTab.tsx`

**Files:**
- Modify: `src/tabs/InvestmentsTab.tsx`

- [ ] **Step 1:** Update imports — tambah:

```tsx
import { useInvestments, useAssetTypes, useDeleteInvestment } from '@/queries/investments'
// Pertahankan import pure functions dari @/db/investments:
import { costBasis, currentValue, gainLoss, gainLossPercent } from '@/db/investments'
```

  Hapus import `listInvestments`, `deleteInvestment`, `listAssetTypes` dari `@/db/investments` (sudah dibungkus hook).

- [ ] **Step 2:** Ganti state lokal & useEffect dengan hook:

```tsx
const { data: investments = [], isLoading } = useInvestments()
const { data: assetTypes = [] } = useAssetTypes()
const deleteMut = useDeleteInvestment()
```

Hapus fungsi `refresh()` dan callsite-nya.

- [ ] **Step 3:** Ganti pemanggilan delete:

```tsx
// Lama: await deleteInvestment(id); refresh();
// Baru:
deleteMut.mutate(id)
```

- [ ] **Step 4:** Tambah loading state placeholder di table.

- [ ] **Step 2:** Tambah loading state di tab.

- [ ] **Step 3:** Commit.

```bash
git add src/tabs/InvestmentsTab.tsx
git commit -m "refactor(tabs): InvestmentsTab to use TanStack Query hooks"
```

---

## Task 4.8: Refactor `GoalsTab.tsx`

**Files:**
- Modify: `src/tabs/GoalsTab.tsx`

- [ ] **Step 1:** Update imports:

```tsx
import { useGoals, useDeleteGoal } from '@/queries/goals'
import { goalProgress } from '@/db/goals' // pure function, tetap
```

Hapus import `listGoals`, `deleteGoal` dari `@/db/goals`.

- [ ] **Step 2:** Ganti state + useEffect dengan hook:

```tsx
const { data: goals = [], isLoading } = useGoals()
const deleteMut = useDeleteGoal()
```

Hapus `refresh()`.

- [ ] **Step 3:** Ganti delete callsite: `deleteMut.mutate(id)`.

- [ ] **Step 2:** Commit.

```bash
git add src/tabs/GoalsTab.tsx
git commit -m "refactor(tabs): GoalsTab to use TanStack Query hooks"
```

---

## Task 4.9: Refactor `NotesTab.tsx`

**Files:**
- Modify: `src/tabs/NotesTab.tsx`

- [ ] **Step 1:** Update imports:

```tsx
import { useNotes, useDeleteNote } from '@/queries/notes'
```

Hapus import `listNotes`, `deleteNote` dari `@/db/notes`.

- [ ] **Step 2:** Ganti state + useEffect dengan hook:

```tsx
const { data: notes = [], isLoading } = useNotes()
const deleteMut = useDeleteNote()
```

Hapus `refresh()`.

- [ ] **Step 3:** Ganti delete callsite: `deleteMut.mutate(id)`.

- [ ] **Step 2:** Commit.

```bash
git add src/tabs/NotesTab.tsx
git commit -m "refactor(tabs): NotesTab to use TanStack Query hooks"
```

---

## Task 4.10: Refactor dialogs (`TransactionDialog`, `InvestmentDialog`, `GoalDialog`, `NoteDialog`, `AddMoneyDialog`, `PriceUpdateDialog`)

**Files:**
- Modify: `src/components/TransactionDialog.tsx`
- Modify: `src/components/InvestmentDialog.tsx`
- Modify: `src/components/GoalDialog.tsx`
- Modify: `src/components/NoteDialog.tsx`
- Modify: `src/components/AddMoneyDialog.tsx`
- Modify: `src/components/PriceUpdateDialog.tsx`

Semua dialog mengikuti pola sama: ganti pemanggilan `await createX()/updateX()` ke mutation hook.

- [ ] **Step 1: TransactionDialog**

Ganti pemanggilan submit:

```tsx
import { useCreateTransaction, useUpdateTransaction } from '@/queries/transactions'
// ...
const createMut = useCreateTransaction()
const updateMut = useUpdateTransaction()

async function handleSubmit() {
  const input: TransactionInput = { /* ... existing */ }
  if (editing) {
    await updateMut.mutateAsync({ id: editing.id, input })
  } else {
    await createMut.mutateAsync(input)
  }
  onOpenChange(false)
  // Hapus pemanggilan onSaved manual — tidak perlu lagi (auto invalidate)
}
```

Disable tombol submit saat `createMut.isPending || updateMut.isPending`.

- [ ] **Step 2: InvestmentDialog** — pola sama dengan `useCreateInvestment` / `useUpdateInvestment`.

- [ ] **Step 3: GoalDialog** — pola sama dengan `useCreateGoal` / `useUpdateGoal`.

- [ ] **Step 4: NoteDialog** — pola sama dengan `useCreateNote` / `useUpdateNote`.

- [ ] **Step 5: AddMoneyDialog** — pakai `useAddMoneyToGoal`:

```tsx
const addMut = useAddMoneyToGoal()
async function handleSubmit() {
  await addMut.mutateAsync({ id: goal.id, amount: parsedAmount })
  onOpenChange(false)
}
```

- [ ] **Step 6: PriceUpdateDialog** — pakai `useUpdatePrice`:

```tsx
const priceMut = useUpdatePrice()
async function handleSubmit() {
  await priceMut.mutateAsync({ investmentId: inv.id, price, date })
  onOpenChange(false)
}
```

- [ ] **Step 7: Build cek:**

```bash
npm run build
```

Sisa error sekarang seharusnya hanya di:
- `src/tabs/SettingsTab.tsx` (masih impor `useDbStore`)
- `src/tabs/ReportsTab.tsx` (M5 berikutnya)
- `src/db/csvTransactions.ts` & `csvInvestments.ts` (M6)

- [ ] **Step 8: Commit (per dialog atau batch — bebas):**

```bash
git add src/components/TransactionDialog.tsx src/components/InvestmentDialog.tsx \
  src/components/GoalDialog.tsx src/components/NoteDialog.tsx \
  src/components/AddMoneyDialog.tsx src/components/PriceUpdateDialog.tsx
git commit -m "refactor(dialogs): swap to mutation hooks (auto-invalidate, no manual onSaved)"
```

---

# Milestone 5 — Reports RPC + integration

## Task 5.1: Buat migration `0002_reports_rpc.sql`

**Files:**
- Create: `supabase/migrations/0002_reports_rpc.sql`

- [ ] **Step 1:** Generate file:

```bash
npx supabase migration new reports_rpc
```

Rename ke `0002_reports_rpc.sql`.

- [ ] **Step 2:** Tulis isi:

```sql
-- ============================================================
-- 0002_reports_rpc: aggregation functions for ReportsTab
-- ============================================================

CREATE OR REPLACE FUNCTION public.aggregate_by_period(
  p_granularity TEXT,
  p_from        DATE,
  p_to          DATE
)
RETURNS TABLE(period TEXT, income NUMERIC, expense NUMERIC)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    CASE p_granularity
      WHEN 'day'   THEN to_char(date, 'YYYY-MM-DD')
      WHEN 'week'  THEN to_char(date, 'IYYY-"W"IW')
      WHEN 'month' THEN to_char(date, 'YYYY-MM')
      WHEN 'year'  THEN to_char(date, 'YYYY')
      ELSE to_char(date, 'YYYY-MM')
    END                                                                AS period,
    COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0)::NUMERIC  AS income,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0)::NUMERIC  AS expense
  FROM transactions
  WHERE (p_from IS NULL OR date >= p_from)
    AND (p_to   IS NULL OR date <= p_to)
  GROUP BY period
  ORDER BY period;
$$;

CREATE OR REPLACE FUNCTION public.aggregate_by_category(
  p_type TEXT,
  p_from DATE,
  p_to   DATE
)
RETURNS TABLE(category TEXT, total NUMERIC)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    c.name AS category,
    COALESCE(SUM(t.amount), 0)::NUMERIC AS total
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  WHERE t.type = p_type
    AND (p_from IS NULL OR t.date >= p_from)
    AND (p_to   IS NULL OR t.date <= p_to)
  GROUP BY c.id, c.name
  HAVING COALESCE(SUM(t.amount), 0) > 0
  ORDER BY total DESC;
$$;

-- Grant execute ke role authenticated agar dapat dipanggil via PostgREST RPC
GRANT EXECUTE ON FUNCTION public.aggregate_by_period(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aggregate_by_category(TEXT, DATE, DATE) TO authenticated;
```

- [ ] **Step 3:** Push:

```bash
npx supabase db push
```

- [ ] **Step 4:** Verifikasi di Supabase dashboard → Database → Functions: dua function muncul.

- [ ] **Step 5:** Commit.

```bash
git add supabase/migrations/0002_reports_rpc.sql
git commit -m "feat(db): add aggregate_by_period & aggregate_by_category RPC"
```

---

## Task 5.2: Rewrite `src/db/reports.ts`

**Files:**
- Modify: `src/db/reports.ts`

- [ ] **Step 1:** Ganti seluruh isi:

```ts
import { supabase } from '@/lib/supabase'

export interface PeriodAgg {
  period: string
  income: number
  expense: number
}

export interface CategoryAgg {
  category: string
  total: number
}

export type PeriodGranularity = 'day' | 'week' | 'month' | 'year'

export async function aggregateByPeriod(
  granularity: PeriodGranularity,
  dateFrom?: string,
  dateTo?: string,
): Promise<PeriodAgg[]> {
  const { data, error } = await supabase.rpc('aggregate_by_period', {
    p_granularity: granularity,
    p_from: dateFrom ?? null,
    p_to: dateTo ?? null,
  })
  if (error) throw error
  return (data ?? []).map((r: { period: string; income: string | number; expense: string | number }) => ({
    period: r.period,
    income: Number(r.income),
    expense: Number(r.expense),
  }))
}

export async function aggregateByCategory(
  type: 'income' | 'expense',
  dateFrom?: string,
  dateTo?: string,
): Promise<CategoryAgg[]> {
  const { data, error } = await supabase.rpc('aggregate_by_category', {
    p_type: type,
    p_from: dateFrom ?? null,
    p_to: dateTo ?? null,
  })
  if (error) throw error
  return (data ?? []).map((r: { category: string; total: string | number }) => ({
    category: r.category,
    total: Number(r.total),
  }))
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/db/reports.ts
git commit -m "refactor(db): swap reports to Supabase RPC calls"
```

---

## Task 5.3: Buat `src/queries/reports.ts`

**Files:**
- Create: `src/queries/reports.ts`

- [ ] **Step 1:** Tulis:

```ts
import { useQuery } from '@tanstack/react-query'
import {
  aggregateByCategory,
  aggregateByPeriod,
  type PeriodGranularity,
} from '@/db/reports'

export function useAggregateByPeriod(
  granularity: PeriodGranularity,
  dateFrom?: string,
  dateTo?: string,
) {
  return useQuery({
    queryKey: ['reports', 'period', granularity, dateFrom ?? null, dateTo ?? null],
    queryFn: () => aggregateByPeriod(granularity, dateFrom, dateTo),
  })
}

export function useAggregateByCategory(
  type: 'income' | 'expense',
  dateFrom?: string,
  dateTo?: string,
) {
  return useQuery({
    queryKey: ['reports', 'category', type, dateFrom ?? null, dateTo ?? null],
    queryFn: () => aggregateByCategory(type, dateFrom, dateTo),
  })
}
```

- [ ] **Step 2:** Commit.

```bash
git add src/queries/reports.ts
git commit -m "feat(queries): add report aggregation hooks"
```

---

## Task 5.4: Refactor `ReportsTab.tsx`

**Files:**
- Modify: `src/tabs/ReportsTab.tsx`

- [ ] **Step 1:** Ganti panggilan langsung `aggregateByPeriod()/aggregateByCategory()` (synchronous) ke hook:

```tsx
import { useAggregateByPeriod, useAggregateByCategory } from '@/queries/reports'
// ...
const { data: periodData = [], isLoading: pLoading } = useAggregateByPeriod(granularity, dateFrom, dateTo)
const { data: incomeByCat = [], isLoading: iLoading } = useAggregateByCategory('income', dateFrom, dateTo)
const { data: expenseByCat = [], isLoading: eLoading } = useAggregateByCategory('expense', dateFrom, dateTo)
```

Hapus useEffect refresh dan state lokal yang menyimpan hasil agregasi. Tampilkan loading state sederhana saat fetching.

- [ ] **Step 2:** Build:

```bash
npm run build
```

ReportsTab error harusnya hilang. Sisa: SettingsTab + csvX. Lanjut M6.

- [ ] **Step 3:** Commit.

```bash
git add src/tabs/ReportsTab.tsx
git commit -m "refactor(tabs): ReportsTab uses RPC-backed query hooks"
```

---

## Task 5.5: Smoke test reports di local dev

**Files:** None.

- [ ] **Step 1:** Buat beberapa transaksi test (income + expense, beberapa kategori, beberapa tanggal) lewat TransactionsTab di local dev.

- [ ] **Step 2:** Buka ReportsTab. Coba semua granularity (day/week/month/year). Verifikasi chart muncul dan angka cocok dengan transaksi yang baru dibuat.

- [ ] **Step 3:** Tidak commit.

---

# Milestone 6 — CSV adaptation

## Task 6.1: Adapt `src/db/csvTransactions.ts`

**Files:**
- Modify: `src/db/csvTransactions.ts`

- [ ] **Step 1:** Baca file existing untuk lihat shape `exportTransactionsCsv()` & `importTransactionsCsv()`. Sesuaikan body:

  - Untuk **export**: panggil `listTransactions(filters)` async dan lakukan `await` sebelum render CSV.
  - Untuk **import**: setelah parse CSV → array of `TransactionInput`, gunakan batch insert via `supabase.from('transactions').insert(batch)`. Lakukan dalam chunk 100 untuk hindari payload terlalu besar:

```ts
import { supabase } from '@/lib/supabase'
import { listCategories } from './categories'
import type { TransactionInput } from './transactions'
import { listTransactions, type TransactionFilters } from './transactions'

const CHUNK = 100

export async function exportTransactionsCsv(
  filters: TransactionFilters = {},
): Promise<string> {
  const rows = await listTransactions(filters)
  const header = 'date,type,category,amount,note'
  const body = rows
    .map((r) =>
      [
        r.date,
        r.type,
        csvEscape(r.category_name),
        r.amount,
        csvEscape(r.note ?? ''),
      ].join(','),
    )
    .join('\n')
  return `${header}\n${body}\n`
}

export interface ImportResult {
  inserted: number
  failed: number
  errors: string[]
}

export async function importTransactionsCsv(text: string): Promise<ImportResult> {
  const cats = await listCategories()
  const catMap = new Map(cats.map((c) => [`${c.type}:${c.name.toLowerCase()}`, c.id]))

  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const header = lines.shift()
  if (!header) return { inserted: 0, failed: 0, errors: ['CSV kosong'] }

  const rows: TransactionInput[] = []
  const errors: string[] = []

  lines.forEach((line, idx) => {
    const cells = parseCsvLine(line)
    if (cells.length < 4) {
      errors.push(`Baris ${idx + 2}: kolom kurang`)
      return
    }
    const [date, type, category, amountStr, note = ''] = cells
    if (type !== 'income' && type !== 'expense') {
      errors.push(`Baris ${idx + 2}: type tidak valid`)
      return
    }
    const cid = catMap.get(`${type}:${category.toLowerCase()}`)
    if (!cid) {
      errors.push(`Baris ${idx + 2}: kategori "${category}" tidak ditemukan`)
      return
    }
    const amount = Number(amountStr)
    if (!isFinite(amount) || amount <= 0) {
      errors.push(`Baris ${idx + 2}: amount tidak valid`)
      return
    }
    rows.push({ date, type, category_id: cid, amount, note: note || null })
  })

  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK)
    const { error } = await supabase.from('transactions').insert(batch)
    if (error) {
      errors.push(`Batch ${i}-${i + batch.length}: ${error.message}`)
    } else {
      inserted += batch.length
    }
  }

  return { inserted, failed: rows.length - inserted, errors }
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQ = false
      else cur += ch
    } else {
      if (ch === ',') { out.push(cur); cur = '' }
      else if (ch === '"') inQ = true
      else cur += ch
    }
  }
  out.push(cur)
  return out
}
```

(Catatan: kalau file existing punya shape function/return berbeda, sesuaikan dengan callsite di TransactionsTab.)

- [ ] **Step 2:** Commit.

```bash
git add src/db/csvTransactions.ts
git commit -m "refactor(csv): adapt transactions CSV import/export to Supabase batch insert"
```

---

## Task 6.2: Adapt `src/db/csvInvestments.ts`

**Files:**
- Modify: `src/db/csvInvestments.ts`

- [ ] **Step 1:** Pola sama. Baca file existing, lalu:
  - Export: `await listInvestments()` lalu render CSV.
  - Import: parse → array `InvestmentInput[]`, batch insert via `supabase.from('investments').insert(batch)` (chunk 100). Skip price_history seed di import (kalau perlu, tambah loop terpisah panggil `updatePrice` per row — tapi untuk MVP, buy_price sudah cukup; current_price = null).

- [ ] **Step 2:** Commit.

```bash
git add src/db/csvInvestments.ts
git commit -m "refactor(csv): adapt investments CSV to Supabase batch insert"
```

---

## Task 6.3: Smoke test CSV di local dev

**Files:** None.

- [ ] **Step 1:** TransactionsTab → klik Export CSV → file ter-download. Buka di text editor, cek format.

- [ ] **Step 2:** Hapus 1-2 transaksi → klik Import CSV → pilih file yang baru di-export → cek transaksi kembali muncul.

- [ ] **Step 3:** Sama untuk InvestmentsTab.

- [ ] **Step 4:** Tidak commit.

---

# Milestone 7 — Cleanup

## Task 7.1: Hapus file lapisan sql.js + FirstRunDialog

**Files:**
- Delete: `src/db/database.ts`, `src/db/fileHandle.ts`, `src/db/store.ts`, `src/db/repo.ts`, `src/db/schema.ts`, `src/components/FirstRunDialog.tsx`

- [ ] **Step 1:** Hapus file:

```bash
rm src/db/database.ts src/db/fileHandle.ts src/db/store.ts src/db/repo.ts src/db/schema.ts src/components/FirstRunDialog.tsx
```

- [ ] **Step 2:** Build cek:

```bash
npm run build
```

Sisa error harusnya hanya di SettingsTab (masih impor `useDbStore`). Itu Task 7.3.

- [ ] **Step 3:** Commit.

```bash
git add -A
git commit -m "chore: remove sql.js layer + FirstRunDialog (no longer needed)"
```

---

## Task 7.2: Hapus `public/sql-wasm.wasm` (tracked file)

**Files:**
- Delete (git rm): `public/sql-wasm.wasm`

- [ ] **Step 1:**

```bash
git rm public/sql-wasm.wasm
```

- [ ] **Step 2:** Commit.

```bash
git commit -m "chore: remove sql.js WASM artifact"
```

---

## Task 7.3: Refactor `SettingsTab.tsx`

**Files:**
- Modify: `src/tabs/SettingsTab.tsx`

- [ ] **Step 1:** Ganti seluruh isi `src/tabs/SettingsTab.tsx`:

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useThemeStore, type Theme } from '@/lib/theme'
import { useAuth } from '@/auth/useAuth'
import { BookOpen, Info, LogOut, User as UserIcon } from 'lucide-react'
import PanduanDialog from '@/components/PanduanDialog'
import TentangDialog from '@/components/TentangDialog'
import { toast } from 'sonner'

export default function SettingsTab() {
  const { theme, setTheme } = useThemeStore()
  const { user, signOut } = useAuth()
  const [panduanOpen, setPanduanOpen] = useState(false)
  const [tentangOpen, setTentangOpen] = useState(false)

  return (
    <div className="max-w-2xl space-y-8">
      {/* Akun */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Akun</h2>
        <div className="rounded-lg border bg-card p-4 text-sm space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <UserIcon className="h-4 w-4" />
            <span>Masuk sebagai</span>
          </div>
          <div className="font-medium">
            {(user?.user_metadata?.full_name as string | undefined) ?? user?.email}
          </div>
          <div className="text-xs text-muted-foreground">{user?.email}</div>
        </div>
        <div className="mt-3">
          <Button
            variant="outline"
            onClick={async () => {
              await signOut()
              toast.success('Berhasil keluar')
            }}
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </Button>
        </div>
      </section>

      {/* Tampilan */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Tampilan</h2>
        <div className="grid max-w-sm gap-2">
          <Label>Tema</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Terang</SelectItem>
              <SelectItem value="dark">Gelap</SelectItem>
              <SelectItem value="system">Ikuti sistem</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Bantuan */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Bantuan</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPanduanOpen(true)}>
            <BookOpen className="h-4 w-4" />
            Panduan Pengguna
          </Button>
          <Button variant="outline" onClick={() => setTentangOpen(true)}>
            <Info className="h-4 w-4" />
            Tentang
          </Button>
        </div>
      </section>

      <PanduanDialog open={panduanOpen} onOpenChange={setPanduanOpen} />
      <TentangDialog open={tentangOpen} onOpenChange={setTentangOpen} />
    </div>
  )
}
```

- [ ] **Step 2:** Build:

```bash
npm run build
```

Expected: SUCCESS (tidak ada error). Kalau ada error tertinggal, fix sebelum commit.

- [ ] **Step 3:** Commit.

```bash
git add src/tabs/SettingsTab.tsx
git commit -m "refactor(settings): replace File Data section with Akun (login info + logout)"
```

---

## Task 7.4: Uninstall sql.js dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1:**

```bash
npm uninstall sql.js @types/sql.js
```

- [ ] **Step 2:** Build cek:

```bash
npm run build
```

Expected: SUCCESS.

- [ ] **Step 3:** Commit.

```bash
git add package.json package-lock.json
git commit -m "chore(deps): uninstall sql.js + @types/sql.js"
```

---

## Task 7.5: Update PanduanDialog & TentangDialog content

**Files:**
- Modify: `src/components/PanduanDialog.tsx`
- Modify: `src/components/TentangDialog.tsx`

- [ ] **Step 1:** Baca kedua file. Update teks yang menyebutkan "file lokal", "File Data", "buka file `.db`", dll → ganti dengan deskripsi cloud:
  - Panduan: hapus instruksi "buka file data lalu mulai", ganti dengan "login dengan Google → langsung pakai".
  - Tentang: update tagline kalau menyebut "data tersimpan di laptop", ganti "data tersimpan di cloud Supabase".

(Karena saya tidak baca isi dialog ini, edit minimal: cari kata "file data", "lokal", "laptop" dan adapt — kalau tidak ada referensi seperti ini, skip.)

- [ ] **Step 2:** Commit kalau ada perubahan.

```bash
git add src/components/PanduanDialog.tsx src/components/TentangDialog.tsx
git commit -m "docs(ui): update help dialogs to reflect cloud architecture"
```

---

## Task 7.6: Update `README.md` dengan setup instructions

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** Ganti README.md (yang sekarang generic Vite template) dengan:

```markdown
# Personal Finance Manager (pfm-web)

Financial cockpit pribadi cloud-first multi-device.

**Live:** https://pfm-web.vercel.app

## Tech stack

- React 19 + Vite + TypeScript + Tailwind 4 + shadcn-ui
- Supabase (Postgres + Auth + PostgREST)
- TanStack Query
- Vercel hosting
- Google OAuth (single-user, email allowlist)

## Local development

### Prereq

1. Node 20+ dan npm.
2. Supabase project sudah di-setup (lihat spec `docs/superpowers/specs/2026-04-19-pfm-cloud-v1-design.md` bagian "External setup prerequisites" untuk langkah Google Cloud + Supabase config).
3. `.env.local` berisi:
   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-public-key>
   ```
   (template di `.env.example`)

### Run

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`. Login dengan akun Google yang ada di allowlist.

## Schema migrations

Migrations versioned di `supabase/migrations/`.

```bash
# Apply pending migrations ke project Supabase
npx supabase db push

# Buat migration baru
npx supabase migration new <name>
```

## Deploy

Push ke `master` branch → Vercel auto-deploy. Pastikan env vars sudah di-set di Vercel dashboard (Settings → Environment Variables): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Smoke test

Lihat `docs/SMOKE_TEST.md`.

## Documents

- Vision: `memory/project_vision.md`
- Spec MVP cloud: `docs/superpowers/specs/2026-04-19-pfm-cloud-v1-design.md`
- Plan MVP cloud: `docs/superpowers/plans/2026-04-19-pfm-cloud-v1-plan.md`
```

- [ ] **Step 2:** Commit.

```bash
git add README.md
git commit -m "docs(readme): rewrite for cloud architecture setup & deploy"
```

---

# Milestone 8 — Deploy + smoke test

## Task 8.1: Push ke GitHub

**Files:** None.

- [ ] **Step 1:** Pastikan semua commit sudah di local:

```bash
git log --oneline -20
git status
```

Expected: working tree clean.

- [ ] **Step 2:** Push:

```bash
git push origin master
```

Kalau remote belum di-set: `git remote add origin <url>` lalu push.

---

## Task 8.2: Connect repo ke Vercel + set env vars

**Files:** None (manual setup).

- [ ] **Step 1:** Buka `https://vercel.com/`. Login (Google).

- [ ] **Step 2:** Add New → Project → Import Git Repository → pilih `pfm-web`.

- [ ] **Step 3:** Configure:
  - Framework preset: Vite (auto-detected).
  - Root directory: `./`
  - Build command: `npm run build` (default)
  - Output directory: `dist` (default)
  - **Environment Variables:**
    - `VITE_SUPABASE_URL` = `https://<project-ref>.supabase.co`
    - `VITE_SUPABASE_ANON_KEY` = `<anon-public-key>`

- [ ] **Step 4:** Deploy. Tunggu ~2 menit. Catat URL Vercel yang dihasilkan (mungkin `pfm-web.vercel.app` atau `pfm-web-<hash>.vercel.app`).

---

## Task 8.3: Update Supabase + Google Cloud allowlist dengan URL Vercel actual

**Files:** None (manual setup).

- [ ] **Step 1:** Kalau URL Vercel berbeda dari placeholder `pfm-web.vercel.app`, update di:
  - **Supabase dashboard** → Authentication → URL Configuration:
    - Site URL: ganti ke URL Vercel actual.
    - Redirect URLs: update entry production ke `<vercel-url>/**`.
  - **Google Cloud Console** → Credentials → OAuth client `pfm-web client`:
    - Authorized JavaScript origins: ganti URL production.
    - (Authorized redirect URIs tetap pakai Supabase callback URL.)

- [ ] **Step 2:** Tidak commit.

---

## Task 8.4: Tulis `docs/SMOKE_TEST.md`

**Files:**
- Create: `docs/SMOKE_TEST.md`

- [ ] **Step 1:** Tulis:

```markdown
# Smoke Test — PFM Cloud v1.0

Jalankan checklist ini setelah setiap rilis production.

**URL production:** https://pfm-web.vercel.app

## Auth

- [ ] Buka URL di incognito → LoginScreen muncul.
- [ ] Klik "Masuk dengan Google" → redirect Google → pilih akun `asistensme@gmail.com` → consent → balik ke app, header tampil avatar + email + tombol Keluar.
- [ ] Coba login dengan email Google LAIN → toast "Email tidak diizinkan" muncul, tetap di LoginScreen.
- [ ] Klik avatar → "Keluar" → balik ke LoginScreen + toast "Berhasil keluar".
- [ ] Refresh halaman setelah login → tetap login (session persisted).

## Tab Transaksi

- [ ] Tambah 1 income & 1 expense (dialog tampil, simpan, toast sukses, table update).
- [ ] Edit transaksi → perubahan tersimpan & table update.
- [ ] Hapus transaksi → row hilang.
- [ ] Filter dateFrom/dateTo/type/kategori → table ter-filter dengan benar.
- [ ] Export CSV → file ter-download, isi sesuai data.
- [ ] Import CSV (file yang baru di-export) → row tertambah, toast hasil.

## Tab Investasi

- [ ] Tambah investasi (mis. Saham BBCA, 100 lembar @ 9000) → muncul di list.
- [ ] Update harga (PriceUpdateDialog) → harga & gain/loss berubah, history bertambah.
- [ ] Edit & delete investasi.
- [ ] Export & import CSV investasi.

## Tab Goals

- [ ] Tambah goal (mis. Dana Darurat, target 10jt).
- [ ] AddMoneyDialog → tambah Rp 1.000.000 → progress bar update.
- [ ] Tambah hingga ≥ target → status berubah ke 'completed'.
- [ ] Edit & delete goal.

## Tab Catatan

- [ ] Tambah catatan dengan & tanpa link ke transaksi.
- [ ] Edit & delete catatan.

## Tab Laporan

- [ ] Pilih granularity day/week/month/year → chart muncul.
- [ ] Filter dateFrom/dateTo → chart update.
- [ ] Income & expense by category chart muncul.

## Tab Pengaturan

- [ ] Ganti tema light/dark/system → langsung berubah.
- [ ] Info akun tampil benar.
- [ ] Tombol Keluar berfungsi.

## Multi-device

- [ ] Buka URL di HP (browser mobile) → login → data sama persis dengan desktop.
- [ ] Tambah transaksi di HP → buka di desktop → langsung muncul (mungkin perlu refresh).

## Network

- [ ] Matikan WiFi (atau dev tools → Network → Offline) → banner "Offline" muncul.
- [ ] Nyalakan kembali → banner hilang, data refetch otomatis.

## Negative

- [ ] Coba akses tanpa login (clear localStorage, refresh) → LoginScreen muncul, tidak bisa lihat data.
```

- [ ] **Step 2:** Commit & push.

```bash
git add docs/SMOKE_TEST.md
git commit -m "docs: add smoke test checklist"
git push
```

---

## Task 8.5: Jalankan smoke test di production

**Files:** None.

- [ ] **Step 1:** Buka URL Vercel production di incognito.

- [ ] **Step 2:** Eksekusi `docs/SMOKE_TEST.md` checklist baris per baris. Centang semua.

- [ ] **Step 3:** Kalau ada item yang gagal:
  - Identifikasi penyebab (cek browser console, Supabase logs, Vercel logs).
  - Fix di code → commit → push → Vercel auto-deploy → test ulang.
  - Ulangi sampai semua centang.

- [ ] **Step 4:** Tidak commit kalau semua jalan.

---

## Task 8.6: Tag rilis v1.0.0

**Files:** None.

- [ ] **Step 1:** Setelah semua smoke test centang, tag rilis:

```bash
git tag -a v1.0.0 -m "PFM Cloud v1.0 — Migration MVP"
git push origin v1.0.0
```

- [ ] **Step 2:** 🎉 MVP done. Update `memory/project_vision.md` jika ada perubahan kecil di realitas implementasi. Lalu siap brainstorming sub-project C (Net Worth Dashboard).

---

# Self-review checklist

Untuk dieksekusi setelah plan ini selesai dijalankan (oleh executor):

- [ ] Semua 8 milestone tasks completed.
- [ ] Build production sukses tanpa warning.
- [ ] Smoke test 100% centang.
- [ ] Repo bersih: tidak ada referensi ke `sql.js`, `FileHandle`, `useDbStore`, `pfm-data.db`.
- [ ] Memory `project_vision.md` masih akurat dengan realitas implementasi.

---

# Open items untuk sub-project berikutnya (di luar scope MVP ini)

- Custom domain Vercel.
- PWA (installable di home screen).
- Auto-fetch harga IDX/emas/reksadana (riset API).
- Backup otomatis ke Google Drive.
- Sub-project C: Net Worth Dashboard (accounts + assets + liabilities).
- Sub-project E: Budgeting (per-category + warning).
- Sub-project F: Goals forecasting.
- Sub-project G: Notes search/tag/monthly review.
