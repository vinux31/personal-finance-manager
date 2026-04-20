# Gap 9 — Manajemen User dari UI: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah PFM dari single-user menjadi multi-user: setiap akun punya data terpisah, akun admin bisa kelola daftar email yang diizinkan login dan bisa melihat data keuangan user lain (read-only).

**Architecture:** Tambah kolom `user_id` ke semua tabel data dengan `DEFAULT auth.uid()`, update RLS ke per-user. Tabel `profiles` menyimpan flag `is_admin`. Tabel `allowed_emails` menggantikan email hardcode di trigger. Frontend memiliki `ViewAsContext` yang query hooks konsumsi via `useTargetUserId()`.

**Tech Stack:** Supabase (PostgreSQL RLS, Edge Auth), React, TanStack Query, TypeScript

---

## File Map

**Baru:**
- `supabase/migrations/0006_multi_user.sql`
- `src/auth/ViewAsContext.tsx`
- `src/auth/useViewAs.ts`
- `src/auth/useTargetUserId.ts`
- `src/components/ViewAsBanner.tsx`
- `src/db/allowedEmails.ts`
- `src/db/profiles.ts`

**Diubah:**
- `src/auth/AuthProvider.tsx` — tambah `isAdmin`, upsert profiles on login
- `src/main.tsx` — wrap dengan `ViewAsProvider`
- `src/App.tsx` — tambah `ViewAsBanner`
- `src/db/transactions.ts` — add optional `uid` param ke list functions
- `src/db/investments.ts` — add optional `uid` param ke list functions
- `src/db/goals.ts` — add optional `uid` param ke list functions
- `src/db/notes.ts` — add optional `uid` param ke list functions
- `src/db/goalInvestments.ts` — add optional `uid` param
- `src/db/reports.ts` — pass `p_user_id` ke RPCs
- `src/queries/transactions.ts` — gunakan `useTargetUserId()`
- `src/queries/investments.ts` — gunakan `useTargetUserId()`
- `src/queries/goals.ts` — gunakan `useTargetUserId()`
- `src/queries/notes.ts` — gunakan `useTargetUserId()`
- `src/queries/goalInvestments.ts` — gunakan `useTargetUserId()`
- `src/queries/reports.ts` — gunakan `useTargetUserId()`
- `src/tabs/SettingsTab.tsx` — tambah seksi Manajemen Pengguna

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/0006_multi_user.sql`

- [ ] **Step 1: Buat file migration**

```sql
-- ============================================================
-- 0006_multi_user: Multi-user support
-- ============================================================

-- ----- Tabel baru: profiles --------------------------------

CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin     BOOLEAN NOT NULL DEFAULT false,
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_upsert ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ----- Tabel baru: allowed_emails --------------------------

CREATE TABLE allowed_emails (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  added_by   UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY allowed_emails_select ON allowed_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY allowed_emails_insert ON allowed_emails FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY allowed_emails_delete ON allowed_emails FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ----- Helper function is_admin() --------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- ----- Tambah kolom user_id ke semua tabel data ------------

ALTER TABLE transactions   ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE investments    ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE price_history  ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE goals          ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE notes          ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE goal_investments ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- settings: ubah PK menjadi (user_id, key)
ALTER TABLE settings DROP CONSTRAINT settings_pkey;
ALTER TABLE settings ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE settings ADD PRIMARY KEY (user_id, key);

-- ----- Seed data: admin + allowed_emails -------------------
-- (dijalankan sebelum SET NOT NULL agar baris existing mendapat user_id)

INSERT INTO allowed_emails (email)
  SELECT email FROM auth.users WHERE email = 'rinoadi28@gmail.com'
  ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, is_admin, display_name)
  SELECT id, true, raw_user_meta_data->>'full_name'
  FROM auth.users WHERE email = 'rinoadi28@gmail.com'
  ON CONFLICT (id) DO UPDATE SET is_admin = true;

-- Assign semua data existing ke UID admin
UPDATE transactions     SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com') WHERE user_id IS NULL;
UPDATE investments      SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com') WHERE user_id IS NULL;
UPDATE price_history    SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com') WHERE user_id IS NULL;
UPDATE goals            SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com') WHERE user_id IS NULL;
UPDATE notes            SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com') WHERE user_id IS NULL;
UPDATE goal_investments SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com') WHERE user_id IS NULL;
UPDATE settings         SET user_id = (SELECT id FROM auth.users WHERE email = 'rinoadi28@gmail.com') WHERE user_id IS NULL;

-- SET NOT NULL setelah semua baris ter-assign
ALTER TABLE transactions     ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE investments       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE price_history     ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE goals              ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE notes              ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE goal_investments   ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE settings           ALTER COLUMN user_id SET NOT NULL;

-- ----- Update RLS policies ---------------------------------

-- transactions
DROP POLICY auth_all_transactions ON transactions;
CREATE POLICY transactions_select ON transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY transactions_write ON transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- investments
DROP POLICY auth_all_investments ON investments;
CREATE POLICY investments_select ON investments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY investments_write ON investments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- price_history
DROP POLICY auth_all_price_history ON price_history;
CREATE POLICY price_history_select ON price_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY price_history_write ON price_history FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- goals
DROP POLICY auth_all_goals ON goals;
CREATE POLICY goals_select ON goals FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY goals_write ON goals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- notes
DROP POLICY auth_all_notes ON notes;
CREATE POLICY notes_select ON notes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY notes_write ON notes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- goal_investments
DROP POLICY auth_all_goal_investments ON goal_investments;
CREATE POLICY goal_investments_select ON goal_investments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY goal_investments_write ON goal_investments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- settings
DROP POLICY auth_all_settings ON settings;
CREATE POLICY settings_select ON settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY settings_write ON settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- categories tetap global
-- (tidak ada perubahan pada policy auth_all_categories)

-- ----- Update trigger email allowlist ---------------------

CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bootstrap: jika tabel masih kosong, izinkan (setup awal)
  IF NOT EXISTS (SELECT 1 FROM allowed_emails) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM allowed_emails WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'Email tidak diizinkan untuk aplikasi ini';
  END IF;
  RETURN NEW;
END;
$$;
-- Trigger sudah ada dari migration 0001, fungsi saja yang diupdate.

-- ----- Update RPCs untuk support view-as admin ------------

CREATE OR REPLACE FUNCTION aggregate_by_period(
  p_granularity TEXT,
  p_date_from   DATE    DEFAULT NULL,
  p_date_to     DATE    DEFAULT NULL,
  p_user_id     UUID    DEFAULT NULL
)
RETURNS TABLE (period TEXT, income NUMERIC, expense NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE p_granularity
      WHEN 'day'   THEN to_char(date, 'YYYY-MM-DD')
      WHEN 'week'  THEN to_char(date_trunc('week', date), 'YYYY-"W"IW')
      WHEN 'month' THEN to_char(date, 'YYYY-MM')
      ELSE              to_char(date, 'YYYY')
    END AS period,
    COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS income,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
  FROM transactions
  WHERE
    user_id = COALESCE(p_user_id, auth.uid()) AND
    (p_date_from IS NULL OR date >= p_date_from) AND
    (p_date_to   IS NULL OR date <= p_date_to)
  GROUP BY period
  ORDER BY period;
$$;

CREATE OR REPLACE FUNCTION aggregate_by_category(
  p_type      TEXT,
  p_date_from DATE    DEFAULT NULL,
  p_date_to   DATE    DEFAULT NULL,
  p_user_id   UUID    DEFAULT NULL
)
RETURNS TABLE (category TEXT, total NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.name AS category, COALESCE(SUM(t.amount), 0) AS total
  FROM transactions t
  JOIN categories c ON t.category_id = c.id
  WHERE
    t.user_id = COALESCE(p_user_id, auth.uid()) AND
    t.type = p_type AND
    (p_date_from IS NULL OR t.date >= p_date_from) AND
    (p_date_to   IS NULL OR t.date <= p_date_to)
  GROUP BY c.id, c.name
  HAVING COALESCE(SUM(t.amount), 0) > 0
  ORDER BY total DESC;
$$;

-- Update add_money_to_goal: pastikan goal milik pemanggil
CREATE OR REPLACE FUNCTION add_money_to_goal(
  p_id     BIGINT,
  p_amount NUMERIC
)
RETURNS TABLE (current_amount NUMERIC, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target NUMERIC;
  v_new_amount NUMERIC;
  v_new_status TEXT;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Jumlah harus > 0';
  END IF;

  UPDATE goals
  SET current_amount = goals.current_amount + p_amount
  WHERE id = p_id AND user_id = auth.uid()
  RETURNING goals.current_amount, goals.target_amount
  INTO v_new_amount, v_target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal tidak ditemukan';
  END IF;

  v_new_status := CASE WHEN v_new_amount >= v_target THEN 'completed' ELSE NULL END;

  IF v_new_status IS NOT NULL THEN
    UPDATE goals SET status = v_new_status WHERE id = p_id AND user_id = auth.uid();
  END IF;

  RETURN QUERY SELECT v_new_amount, COALESCE(v_new_status, (SELECT goals.status FROM goals WHERE id = p_id));
END;
$$;

GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0006_multi_user.sql
git commit -m "feat(db): add multi-user migration — profiles, allowed_emails, user_id columns, updated RLS"
```

---

## Task 2: AuthProvider — isAdmin + upsert profiles

**Files:**
- Modify: `src/auth/AuthProvider.tsx`

- [ ] **Step 1: Baca file saat ini**

Baca `src/auth/AuthProvider.tsx` sebelum mengedit.

- [ ] **Step 2: Update AuthProvider**

Ganti seluruh isi file:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { type Session, type User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  isAdmin: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  async function upsertProfile(userId: string, meta: Record<string, any>) {
    await supabase.from('profiles').upsert(
      { id: userId, display_name: meta?.full_name ?? null },
      { onConflict: 'id', ignoreDuplicates: false }
    )
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()
    setIsAdmin(data?.is_admin ?? false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user) {
        upsertProfile(data.session.user.id, data.session.user.user_metadata)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        upsertProfile(session.user.id, session.user.user_metadata)
      } else {
        setIsAdmin(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 3: Commit**

```bash
git add src/auth/AuthProvider.tsx
git commit -m "feat(auth): tambah isAdmin state dan upsert profiles saat login"
```

---

## Task 3: ViewAsContext + hooks

**Files:**
- Create: `src/auth/ViewAsContext.tsx`
- Create: `src/auth/useViewAs.ts`
- Create: `src/auth/useTargetUserId.ts`

- [ ] **Step 1: Buat ViewAsContext.tsx**

```tsx
// src/auth/ViewAsContext.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useAuthContext } from './AuthProvider'

export interface ViewAsUser {
  uid: string
  displayName: string
  email: string
}

interface ViewAsContextValue {
  viewingAs: ViewAsUser | null
  setViewingAs: (user: ViewAsUser | null) => void
}

const ViewAsContext = createContext<ViewAsContextValue | null>(null)

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const { isAdmin, session } = useAuthContext()
  const [viewingAs, setViewingAsState] = useState<ViewAsUser | null>(null)

  // Reset saat logout
  useEffect(() => {
    if (!session) setViewingAsState(null)
  }, [session])

  function setViewingAs(user: ViewAsUser | null) {
    if (!isAdmin) return
    setViewingAsState(user)
  }

  return (
    <ViewAsContext.Provider value={{ viewingAs, setViewingAs }}>
      {children}
    </ViewAsContext.Provider>
  )
}

export function useViewAsContext() {
  const ctx = useContext(ViewAsContext)
  if (!ctx) throw new Error('useViewAsContext must be used within ViewAsProvider')
  return ctx
}
```

- [ ] **Step 2: Buat useViewAs.ts**

```ts
// src/auth/useViewAs.ts
export { useViewAsContext as useViewAs } from './ViewAsContext'
export type { ViewAsUser } from './ViewAsContext'
```

- [ ] **Step 3: Buat useTargetUserId.ts**

```ts
// src/auth/useTargetUserId.ts
import { useAuthContext } from './AuthProvider'
import { useViewAsContext } from './ViewAsContext'

export function useTargetUserId(): string | undefined {
  const { user } = useAuthContext()
  const { viewingAs } = useViewAsContext()
  return viewingAs?.uid ?? user?.id
}
```

- [ ] **Step 4: Commit**

```bash
git add src/auth/ViewAsContext.tsx src/auth/useViewAs.ts src/auth/useTargetUserId.ts
git commit -m "feat(auth): tambah ViewAsContext dan useTargetUserId hook"
```

---

## Task 4: ViewAsBanner + update App.tsx dan main.tsx

**Files:**
- Create: `src/components/ViewAsBanner.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Buat ViewAsBanner.tsx**

```tsx
// src/components/ViewAsBanner.tsx
import { useViewAsContext } from '@/auth/ViewAsContext'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'

export default function ViewAsBanner() {
  const { viewingAs, setViewingAs } = useViewAsContext()
  if (!viewingAs) return null

  return (
    <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-6 py-2 text-sm">
      <span className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
        <Eye className="h-4 w-4" />
        Sedang melihat data <strong>{viewingAs.displayName || viewingAs.email}</strong> (hanya baca)
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setViewingAs(null)}
      >
        Kembali ke data saya
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Baca main.tsx**

Baca `src/main.tsx`.

- [ ] **Step 3: Update main.tsx — wrap dengan ViewAsProvider**

Tambahkan `ViewAsProvider` di dalam `AuthProvider`. Contoh perubahan (sesuaikan dengan isi file yang dibaca):

```tsx
import { ViewAsProvider } from '@/auth/ViewAsContext'
// ...
<AuthProvider>
  <ViewAsProvider>
    <App />
  </ViewAsProvider>
</AuthProvider>
```

- [ ] **Step 4: Baca App.tsx**

Baca `src/App.tsx`.

- [ ] **Step 5: Update App.tsx — tambah ViewAsBanner**

Tambahkan `ViewAsBanner` tepat setelah `<OfflineBanner />`:

```tsx
import ViewAsBanner from '@/components/ViewAsBanner'
// ...
<OfflineBanner />
<ViewAsBanner />
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ViewAsBanner.tsx src/main.tsx src/App.tsx
git commit -m "feat(ui): tambah ViewAsBanner dan wrap app dengan ViewAsProvider"
```

---

## Task 5: Update db/ layer — tambah uid filter ke list functions

**Files:**
- Modify: `src/db/transactions.ts`
- Modify: `src/db/investments.ts`
- Modify: `src/db/goals.ts`
- Modify: `src/db/notes.ts`
- Modify: `src/db/goalInvestments.ts`
- Modify: `src/db/reports.ts`

- [ ] **Step 1: Baca semua file db yang akan diubah**

Baca: `src/db/transactions.ts`, `src/db/investments.ts`, `src/db/goals.ts`, `src/db/notes.ts`, `src/db/goalInvestments.ts`, `src/db/reports.ts`

- [ ] **Step 2: Update listTransactions — tambah uid parameter**

Di `src/db/transactions.ts`, ubah signature `listTransactions`:

```ts
export async function listTransactions(f: TransactionFilters = {}, uid?: string): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('id, date, type, category_id, amount, note, categories(name)')
    .order('date', { ascending: false })
    .order('id', { ascending: false })

  if (uid) query = query.eq('user_id', uid)
  if (f.dateFrom) query = query.gte('date', f.dateFrom)
  if (f.dateTo) query = query.lte('date', f.dateTo)
  if (f.type) query = query.eq('type', f.type)
  if (f.categoryId != null) query = query.eq('category_id', f.categoryId)
  if (f.limit) query = query.limit(f.limit)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row: any) => ({
    ...row,
    category_name: row.categories?.name ?? '',
  }))
}
```

- [ ] **Step 3: Update listInvestments, getInvestment, getPriceHistory, listAssetTypes**

Di `src/db/investments.ts`, tambah `uid?: string` ke list functions:

```ts
export async function listInvestments(uid?: string): Promise<Investment[]> {
  let query = supabase
    .from('investments')
    .select('id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note')
    .order('buy_date', { ascending: false })
    .order('id', { ascending: false })
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data as Investment[]
}

export async function listAssetTypes(uid?: string): Promise<string[]> {
  let query = supabase.from('investments').select('asset_type')
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  const existing = [...new Set((data ?? []).map((r: any) => r.asset_type as string))]
  const defaults = ['Saham', 'Reksadana', 'Emas', 'Kripto', 'Obligasi']
  return [...new Set([...defaults, ...existing])].sort()
}
```

`getInvestment` dan `getPriceHistory` tidak perlu `uid` — mereka query by ID yang sudah unik.

- [ ] **Step 4: Update listGoals, getGoal**

Di `src/db/goals.ts`, tambah `uid?: string`:

```ts
export async function listGoals(uid?: string): Promise<Goal[]> {
  let query = supabase
    .from('goals')
    .select('id, name, target_amount, current_amount, target_date, status')
    .order('status')
    .order('target_date', { ascending: true, nullsFirst: false })
    .order('id', { ascending: false })
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data as Goal[]
}
```

`getGoal` tidak perlu — query by ID.

- [ ] **Step 5: Update listNotes**

Di `src/db/notes.ts`, tambah `uid?: string`:

```ts
export async function listNotes(uid?: string): Promise<Note[]> {
  let query = supabase
    .from('notes')
    .select('id, title, content, date, linked_transaction_id')
    .order('date', { ascending: false })
    .order('id', { ascending: false })
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data as Note[]
}
```

- [ ] **Step 6: Update listGoalInvestments**

Di `src/db/goalInvestments.ts`, tambah `uid?: string`:

```ts
export async function listGoalInvestments(uid?: string): Promise<GoalInvestment[]> {
  let query = supabase
    .from('goal_investments')
    .select('id, goal_id, investment_id, allocation_pct')
    .order('id')
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data as GoalInvestment[]
}
```

- [ ] **Step 7: Update aggregateByPeriod dan aggregateByCategory**

Di `src/db/reports.ts`, tambah `uid?: string` dan pass ke RPC sebagai `p_user_id`:

```ts
export async function aggregateByPeriod(
  granularity: PeriodGranularity,
  dateFrom?: string,
  dateTo?: string,
  uid?: string,
): Promise<PeriodAgg[]> {
  const { data, error } = await supabase.rpc('aggregate_by_period', {
    p_granularity: granularity,
    p_date_from: dateFrom ?? null,
    p_date_to: dateTo ?? null,
    p_user_id: uid ?? null,
  })
  if (error) throw error
  return (data ?? []) as PeriodAgg[]
}

export async function aggregateByCategory(
  type: 'income' | 'expense',
  dateFrom?: string,
  dateTo?: string,
  uid?: string,
): Promise<CategoryAgg[]> {
  const { data, error } = await supabase.rpc('aggregate_by_category', {
    p_type: type,
    p_date_from: dateFrom ?? null,
    p_date_to: dateTo ?? null,
    p_user_id: uid ?? null,
  })
  if (error) throw error
  return (data ?? []) as CategoryAgg[]
}
```

- [ ] **Step 8: Commit**

```bash
git add src/db/transactions.ts src/db/investments.ts src/db/goals.ts src/db/notes.ts src/db/goalInvestments.ts src/db/reports.ts
git commit -m "feat(db): tambah optional uid filter ke semua list functions untuk view-as support"
```

---

## Task 6: Update queries/ hooks — gunakan useTargetUserId

**Files:**
- Modify: `src/queries/transactions.ts`
- Modify: `src/queries/investments.ts`
- Modify: `src/queries/goals.ts`
- Modify: `src/queries/notes.ts`
- Modify: `src/queries/goalInvestments.ts`
- Modify: `src/queries/reports.ts`

- [ ] **Step 1: Baca semua file queries yang akan diubah**

Baca: `src/queries/transactions.ts`, `src/queries/investments.ts`, `src/queries/goals.ts`, `src/queries/notes.ts`, `src/queries/goalInvestments.ts`, `src/queries/reports.ts`

- [ ] **Step 2: Update useTransactions**

Di `src/queries/transactions.ts`, tambah import dan gunakan `useTargetUserId`:

```ts
import { useTargetUserId } from '@/auth/useTargetUserId'

export function useTransactions(filters: TransactionFilters = {}) {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['transactions', filters, uid],
    queryFn: () => listTransactions(filters, uid),
    enabled: !!uid,
  })
}
```

- [ ] **Step 3: Update useInvestments dan useAssetTypes**

Di `src/queries/investments.ts`:

```ts
import { useTargetUserId } from '@/auth/useTargetUserId'

export function useInvestments() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['investments', uid],
    queryFn: () => listInvestments(uid),
    enabled: !!uid,
  })
}

export function useAssetTypes() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['asset-types', uid],
    queryFn: () => listAssetTypes(uid),
    enabled: !!uid,
  })
}
```

`usePriceHistory` tidak perlu diubah — query by investment ID.

- [ ] **Step 4: Update useGoals**

Di `src/queries/goals.ts`:

```ts
import { useTargetUserId } from '@/auth/useTargetUserId'

export function useGoals() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['goals', uid],
    queryFn: () => listGoals(uid),
    enabled: !!uid,
  })
}
```

- [ ] **Step 5: Update useNotes**

Di `src/queries/notes.ts`:

```ts
import { useTargetUserId } from '@/auth/useTargetUserId'

export function useNotes() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['notes', uid],
    queryFn: () => listNotes(uid),
    enabled: !!uid,
  })
}
```

- [ ] **Step 6: Update useGoalInvestments**

Di `src/queries/goalInvestments.ts`:

```ts
import { useTargetUserId } from '@/auth/useTargetUserId'

export function useGoalInvestments() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['goal-investments', uid],
    queryFn: () => listGoalInvestments(uid),
    enabled: !!uid,
  })
}
```

- [ ] **Step 7: Update useAggregateByPeriod dan useAggregateByCategory**

Di `src/queries/reports.ts`:

```ts
import { useTargetUserId } from '@/auth/useTargetUserId'

export function useAggregateByPeriod(
  granularity: PeriodGranularity,
  dateFrom?: string,
  dateTo?: string,
) {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['reports', 'period', granularity, dateFrom, dateTo, uid],
    queryFn: () => aggregateByPeriod(granularity, dateFrom, dateTo, uid),
    enabled: !!uid,
  })
}

export function useAggregateByCategory(
  type: 'income' | 'expense',
  dateFrom?: string,
  dateTo?: string,
) {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['reports', 'category', type, dateFrom, dateTo, uid],
    queryFn: () => aggregateByCategory(type, dateFrom, dateTo, uid),
    enabled: !!uid,
  })
}
```

- [ ] **Step 8: Commit**

```bash
git add src/queries/transactions.ts src/queries/investments.ts src/queries/goals.ts src/queries/notes.ts src/queries/goalInvestments.ts src/queries/reports.ts
git commit -m "feat(queries): semua hooks gunakan useTargetUserId untuk support view-as admin"
```

---

## Task 7: db/allowedEmails.ts + db/profiles.ts + SettingsTab

**Files:**
- Create: `src/db/allowedEmails.ts`
- Create: `src/db/profiles.ts`
- Modify: `src/tabs/SettingsTab.tsx`

- [ ] **Step 1: Buat src/db/allowedEmails.ts**

```ts
// src/db/allowedEmails.ts
import { supabase } from '@/lib/supabase'

export interface AllowedEmail {
  id: number
  email: string
  added_by: string | null
  created_at: string
}

export async function listAllowedEmails(): Promise<AllowedEmail[]> {
  const { data, error } = await supabase
    .from('allowed_emails')
    .select('id, email, added_by, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as AllowedEmail[]
}

export async function addAllowedEmail(email: string): Promise<void> {
  const { error } = await supabase
    .from('allowed_emails')
    .insert({ email: email.trim().toLowerCase(), added_by: (await supabase.auth.getUser()).data.user?.id })
  if (error) throw error
}

export async function removeAllowedEmail(id: number): Promise<void> {
  const { error } = await supabase.from('allowed_emails').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Buat src/db/profiles.ts**

```ts
// src/db/profiles.ts
import { supabase } from '@/lib/supabase'

export interface Profile {
  id: string
  is_admin: boolean
  display_name: string | null
  created_at: string
  email?: string
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, is_admin, display_name, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error

  // Ambil email dari auth session context (hanya data yang bisa diakses)
  // Email tiap profile diambil dari allowed_emails berdasarkan display_name
  // atau tampilkan display_name saja
  return data as Profile[]
}
```

- [ ] **Step 3: Baca SettingsTab.tsx**

Baca `src/tabs/SettingsTab.tsx`.

- [ ] **Step 4: Update SettingsTab — tambah seksi Manajemen Pengguna**

Di `src/tabs/SettingsTab.tsx`, tambah seksi baru setelah seksi "Akun". Tambahkan state, query hooks, dan handler berikut:

Import baru yang perlu ditambahkan:
```tsx
import { useState } from 'react'  // sudah ada
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'  // sudah ada
import { Input } from '@/components/ui/input'
import { Users, Eye } from 'lucide-react'
import { useAuthContext } from '@/auth/AuthProvider'
import { useViewAs } from '@/auth/useViewAs'
import {
  listAllowedEmails,
  addAllowedEmail,
  removeAllowedEmail,
} from '@/db/allowedEmails'
import { listProfiles } from '@/db/profiles'
import { mapSupabaseError } from '@/lib/errors'
```

State baru di dalam komponen:
```tsx
const { isAdmin, user } = useAuthContext()  // ganti const { user, signOut } = useAuth()
const { signOut } = useAuthContext()  // ambil signOut dari sini juga
const { setViewingAs } = useViewAs()
const [newEmail, setNewEmail] = useState('')

const qc = useQueryClient()

const { data: allowedEmails = [] } = useQuery({
  queryKey: ['allowed-emails'],
  queryFn: listAllowedEmails,
  enabled: isAdmin,
})

const { data: profiles = [] } = useQuery({
  queryKey: ['profiles'],
  queryFn: listProfiles,
  enabled: isAdmin,
})

const addEmailMutation = useMutation({
  mutationFn: addAllowedEmail,
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['allowed-emails'] })
    setNewEmail('')
    toast.success('Email ditambahkan')
  },
  onError: (e) => toast.error(mapSupabaseError(e)),
})

const removeEmailMutation = useMutation({
  mutationFn: removeAllowedEmail,
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['allowed-emails'] })
    toast.success('Email dihapus')
  },
  onError: (e) => toast.error(mapSupabaseError(e)),
})

function handleAddEmail(e: React.FormEvent) {
  e.preventDefault()
  const trimmed = newEmail.trim().toLowerCase()
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    toast.error('Format email tidak valid')
    return
  }
  addEmailMutation.mutate(trimmed)
}
```

Seksi JSX yang ditambahkan (setelah seksi Akun):
```tsx
{isAdmin && (
  <section>
    <h2 className="mb-3 text-lg font-semibold">Manajemen Pengguna</h2>

    {/* Email yang diizinkan */}
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <h3 className="font-medium flex items-center gap-2">
        <Users className="h-4 w-4" />
        Email yang Diizinkan Login
      </h3>
      <div className="space-y-2">
        {allowedEmails.map((ae) => (
          <div key={ae.id} className="flex items-center justify-between text-sm">
            <span>{ae.email}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-destructive hover:text-destructive"
              disabled={ae.email === user?.email || removeEmailMutation.isPending}
              onClick={() => {
                if (!confirm(`Hapus ${ae.email}?`)) return
                removeEmailMutation.mutate(ae.id)
              }}
            >
              Hapus
            </Button>
          </div>
        ))}
      </div>
      <form onSubmit={handleAddEmail} className="flex gap-2">
        <Input
          type="email"
          placeholder="email@contoh.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="h-8 text-sm"
        />
        <Button type="submit" size="sm" disabled={addEmailMutation.isPending}>
          Tambah
        </Button>
      </form>
    </div>

    {/* Lihat keuangan user lain */}
    {profiles.filter((p) => p.id !== user?.id).length > 0 && (
      <div className="mt-4 rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-medium flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Lihat Keuangan Pengguna Lain
        </h3>
        <div className="space-y-2">
          {profiles
            .filter((p) => p.id !== user?.id)
            .map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.display_name ?? p.id.slice(0, 8)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setViewingAs({
                      uid: p.id,
                      displayName: p.display_name ?? '',
                      email: '',
                    })
                    toast.info(`Beralih ke data ${p.display_name ?? 'pengguna'}`)
                  }}
                >
                  Lihat Keuangan
                </Button>
              </div>
            ))}
        </div>
      </div>
    )}
  </section>
)}
```

Perhatian: hapus `const { user, signOut } = useAuth()` yang ada dan ganti dengan `const { isAdmin, user, signOut } = useAuthContext()`.

- [ ] **Step 5: Commit**

```bash
git add src/db/allowedEmails.ts src/db/profiles.ts src/tabs/SettingsTab.tsx
git commit -m "feat(settings): tambah manajemen pengguna — allowed emails dan view-as user"
```

---

## Task 8: Verifikasi TypeScript dan build

**Files:**
- Tidak ada perubahan file baru

- [ ] **Step 1: Jalankan TypeScript check**

```bash
npx tsc --noEmit
```

Expected: tidak ada error. Jika ada error, perbaiki type mismatch sebelum lanjut.

- [ ] **Step 2: Jalankan build**

```bash
npm run build
```

Expected: build sukses tanpa error.

- [ ] **Step 3: Jalankan dev server dan verifikasi manual**

```bash
npm run dev
```

Checklist verifikasi:
- [ ] Login dengan akun admin → tab Pengaturan menampilkan seksi "Manajemen Pengguna"
- [ ] Login dengan akun non-admin → seksi "Manajemen Pengguna" tidak muncul
- [ ] Admin bisa tambah email baru ke allowed_emails
- [ ] Admin bisa hapus email (kecuali email sendiri — tombol disabled)
- [ ] Data transaksi/goals/investasi masih tampil normal
- [ ] Jika ada user lain di profiles, tombol "Lihat Keuangan" muncul
- [ ] Klik "Lihat Keuangan" → banner amber muncul di atas header
- [ ] Klik "Kembali ke data saya" → banner hilang, data kembali ke milik admin

- [ ] **Step 4: Commit final jika ada fix**

```bash
git add -p
git commit -m "fix: perbaikan type errors dan build issues"
```
