# Phase 7: UI/Data Consistency - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 14 (3 SQL migrations + 3 pgTAP tests + 7 TS/TSX edits + 1 ESLint config)
**Analogs found:** 14 / 14 (100%)
**Source:** 07-CONTEXT.md (no RESEARCH.md — context is comprehensive)

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0022_user_seed_markers.sql` | migration (DDL + 2 RPC + backfill) | DB write — schema + atomic insert | `supabase/migrations/0014_mark_bill_paid.sql` + `0013_bill_payments.sql` | exact (RPC template + table-with-RLS) |
| `supabase/migrations/0023_goals_with_progress.sql` | migration (VIEW only) | DB read | `supabase/migrations/0015_upcoming_bills_unpaid_view.sql` | exact (security_invoker VIEW) |
| `supabase/migrations/0024_add_money_to_goal_v2.sql` | migration (DROP + CREATE + UPDATE backfill) | DB write — RPC + status flip | `supabase/migrations/0006_multi_user.sql` §`add_money_to_goal` (lines 225-261) + `0018_drop_legacy_aggregates.sql` (DROP discipline) + `0020_withdraw_from_goal.sql` (FOR UPDATE + status logic) | exact (mirror v1 + Phase 6 pattern carry) |
| `supabase/tests/07-seed-rencana.sql` | pgTAP integration | DB read+write (test harness) | `supabase/tests/06-process-due-recurring.sql` | exact (most-recent batch RPC convention) |
| `supabase/tests/07-goals-with-progress.sql` | pgTAP integration | DB read | `supabase/tests/06-withdraw-from-goal.sql` (DO $$ scenario block) + `04-mark-bill-paid.sql` SECTION 1 (CASE WHEN inline) | exact (mixed inline + scenarios) |
| `supabase/tests/07-add-money-v2.sql` | pgTAP integration | DB write — RPC behavior | `supabase/tests/06-withdraw-from-goal.sql` | exact (status-flip RPC test mirror) |
| `src/lib/useRencanaInit.ts` | TS module / React hook | UI → RPC (write) | self (current file) — full rewrite preserving fast-path semantics | role-match |
| `src/db/goals.ts` (`seedRencanaGoals` deprecate) | TS module | UI → DB (deprecated) | `src/db/goals.ts:106-114` `withdrawFromGoal` (RPC call wrapper pattern) | exact |
| `src/db/investments.ts` (`seedRencanaInvestments` deprecate) | TS module | UI → DB (deprecated) | n/a — straight removal/no-op | n/a |
| `src/queries/investments.ts` line 111 | TS module / hook | date helper callsite | `src/db/investments.ts:94` (`todayISO()` already used) | exact (in-file precedent) |
| `src/tabs/SettingsTab.tsx` (`doResetSeed` extension) | TSX component | UI → RPC + localStorage | `src/tabs/SettingsTab.tsx:105-127` (existing handler, extend) + `src/db/goals.ts:106-114` (RPC call) | exact (in-file extension) |
| `src/tabs/TransactionsTab.tsx` (Impor button gate) | TSX component | UI gate | `src/tabs/InvestmentsTab.tsx:81-88` `disabled={refreshPrices.isPending}` (disabled+condition pattern) + existing in-file CSV handler at line 128-143 | role-match |
| `src/tabs/InvestmentsTab.tsx` (Impor button gate) | TSX component | UI gate | self line 81-88 (disabled pattern in adjacent button) | exact (in-file precedent) |
| `src/components/AddMoneyDialog.tsx` (kas/investasi info) | TSX component | UI display | `src/components/AddMoneyDialog.tsx:71-75` (existing `DialogDescription` switch by mode) | exact (extend existing) |
| `eslint.config.js` (no-restricted-syntax) | config | lint config | self — first project rule of this kind; ESLint docs `no-restricted-syntax` AST selector | role-match (no analog) |

## Pattern Assignments

### `supabase/migrations/0022_user_seed_markers.sql` (migration, DDL + 2 RPC + backfill)

**Analogs:**
- Table+RLS shape: `supabase/migrations/0013_bill_payments.sql` (lines 5-20)
- RPC template: `supabase/migrations/0014_mark_bill_paid.sql` (lines 45-115)
- Auth guard ERRCODE convention: `supabase/migrations/0019_process_due_recurring.sql` (lines 32-39) [Phase 6 D-19]
- Backfill `INSERT ... ON CONFLICT DO NOTHING`: `supabase/tests/06-process-due-recurring.sql:68-76`

**Header comment pattern** (mirror 0014:1-8 / 0019:1-11):
```sql
-- ============================================================
-- 0022_user_seed_markers: Tabel marker + RPC seed_rencana + reset_rencana_marker (CONS-03, D-01..D-08)
-- Authoritative source untuk "user sudah seeded". RPC = single transaction:
--   1. Idempotency: IF EXISTS (user_seed_markers) RETURN false (D-02 marker-only dedup)
--   2. INSERT 5 RENCANA goals (hardcoded — synced with src/lib/rencanaNames.ts + src/db/goals.ts:RENCANA_GOALS)
--   3. INSERT 5 RENCANA investments (synced with src/db/investments.ts:RENCANA_INVESTMENTS)
--   4. INSERT user_seed_markers row → marks done (atomic via implicit transaction)
-- Backfill (D-03): existing users yang sudah punya RENCANA goals → INSERT marker ON CONFLICT DO NOTHING.
--
-- NOTE: If you ever change function signature, MUST emit DROP FUNCTION IF EXISTS ... (sig)
--       before CREATE OR REPLACE. Phase 5 lesson — see 0018_drop_legacy_aggregates.sql.
-- ============================================================
```

**Table + RLS pattern** (mirror 0013:5-20 with PK on user_id instead of generated id):
```sql
CREATE TABLE user_seed_markers (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rencana_seeded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_seed_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own seed markers"
  ON user_seed_markers FOR ALL
  USING      (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);
```

**RPC `seed_rencana` body skeleton** (mirror 0014:45-115 + Phase 6 D-19 ERRCODE):
```sql
CREATE OR REPLACE FUNCTION seed_rencana(p_uid UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_uid, auth.uid());
BEGIN
  -- Auth guard (Phase 6 D-19)
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;
  -- Access guard (mirror 0014:67-70 / 0019:36-39)
  IF v_uid != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  -- Idempotency: D-02 marker-only dedup (mirror 0014:84-91 IF EXISTS pattern)
  IF EXISTS (SELECT 1 FROM user_seed_markers WHERE user_id = v_uid) THEN
    RETURN false;
  END IF;

  -- INSERT 5 goals (hardcoded, synced w/ src/db/goals.ts RENCANA_GOALS)
  -- INSERT 5 investments (hardcoded, synced w/ src/db/investments.ts RENCANA_INVESTMENTS)
  -- INSERT marker (final step — atomic implicit transaction; if any prior INSERT fails, rollback)
  INSERT INTO user_seed_markers (user_id) VALUES (v_uid);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION seed_rencana(UUID) TO authenticated;
```

**RPC `reset_rencana_marker` body** (D-07.3 — strict self-only, no admin override):
```sql
CREATE OR REPLACE FUNCTION reset_rencana_marker()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;
  DELETE FROM user_seed_markers WHERE user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_rencana_marker() TO authenticated;
```

**Backfill INSERT pattern** (D-03):
```sql
-- Existing users with RENCANA goals already get marker → no double-seed
INSERT INTO user_seed_markers (user_id, rencana_seeded_at)
SELECT DISTINCT user_id, NOW()
FROM goals
WHERE name = ANY(ARRAY['Dana Darurat','...','...','...','...']::text[])
ON CONFLICT (user_id) DO NOTHING;
```

---

### `supabase/migrations/0023_goals_with_progress.sql` (migration, VIEW)

**Analog:** `supabase/migrations/0015_upcoming_bills_unpaid_view.sql` (lines 1-43)

**Header comment pattern** (mirror 0015:1-12 — preserve security_invoker rationale verbatim):
```sql
-- ============================================================
-- 0023_goals_with_progress: VIEW kompositor goal progress (CONS-01, D-09)
-- Single source-of-truth: total_amount = current_amount + Σ(allocation_pct × investment.current_value).
-- COALESCE(current_price, buy_price) handle investasi belum di-refresh harga.
-- LEFT JOIN handle goals tanpa linked investment (total_amount = current_amount only).
--
-- security_invoker = true (PG 15+) makes the view inherit the CALLER's RLS
-- policies on goals + goal_investments + investments. Mandatory — RESEARCH Pitfall 7.
-- ============================================================
```

**VIEW definition** (mirror 0015:13-38 WITH clause + structural pattern):
```sql
CREATE OR REPLACE VIEW goals_with_progress
WITH (security_invoker = true)
AS
SELECT
  g.id,
  g.user_id,
  g.name,
  g.target_amount,
  g.current_amount,
  g.target_date,
  g.status,
  g.current_amount + COALESCE(
    SUM(gi.allocation_pct / 100.0 * COALESCE(i.current_price, i.buy_price) * i.quantity),
    0
  ) AS total_amount
FROM goals g
LEFT JOIN goal_investments gi ON gi.goal_id = g.id
LEFT JOIN investments i ON i.id = gi.investment_id
GROUP BY g.id;

GRANT SELECT ON goals_with_progress TO authenticated;
```

---

### `supabase/migrations/0024_add_money_to_goal_v2.sql` (migration, DROP + CREATE + UPDATE backfill)

**Analogs:**
- v1 baseline: `supabase/migrations/0006_multi_user.sql` lines 225-261
- DROP discipline: `supabase/migrations/0018_drop_legacy_aggregates.sql` lines 17-18
- FOR UPDATE + status flip: `supabase/migrations/0020_withdraw_from_goal.sql` lines 20-74

**DROP statement first** (Phase 5 lesson — D-13):
```sql
-- ============================================================
-- 0024_add_money_to_goal_v2: REPLACE v1 dengan v2 yang status-aware via VIEW total
-- (CONS-01, D-10..D-13). v1 hanya cek cash; v2 cek cash + investment market value via
-- inline subquery (mirror VIEW formula). Status flip active→completed kalau total >= target.
--
-- Phase 5 lesson 0018: DROP FUNCTION explicit sebelum CREATE — supaya
-- kalau executor accidentally ubah signature, legacy v1 (cash-only) tidak coexist.
-- ============================================================

DROP FUNCTION IF EXISTS public.add_money_to_goal(BIGINT, NUMERIC);
```

**RPC v2 body** (mirror 0006:225-261 base + 0020:30-72 lock+status pattern):
```sql
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
  v_uid          UUID := auth.uid();
  v_goal         RECORD;
  v_invested     NUMERIC;
  v_new_cash     NUMERIC;
  v_new_total    NUMERIC;
  v_new_status   TEXT;
BEGIN
  -- Auth guard (Phase 6 D-19)
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Jumlah harus > 0';
  END IF;

  -- FOR UPDATE on base table (mirror 0020:46-50)
  SELECT id, current_amount, target_amount, status
  INTO v_goal
  FROM goals
  WHERE id = p_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal tidak ditemukan';
  END IF;

  v_new_cash := v_goal.current_amount + p_amount;

  -- Inline subquery — mirror VIEW formula. Tidak SELECT FROM VIEW karena
  -- FOR UPDATE pada VIEW tricky + lock sudah diambil di base table (D-10.4).
  SELECT COALESCE(SUM(gi.allocation_pct / 100.0
                      * COALESCE(i.current_price, i.buy_price) * i.quantity), 0)
  INTO v_invested
  FROM goal_investments gi
  LEFT JOIN investments i ON i.id = gi.investment_id
  WHERE gi.goal_id = p_id;

  v_new_total := v_new_cash + v_invested;

  -- Status transition (D-11): only active → completed; paused/completed preserved
  v_new_status := CASE
    WHEN v_goal.status = 'active' AND v_new_total >= v_goal.target_amount THEN 'completed'
    ELSE v_goal.status
  END;

  UPDATE goals
  SET current_amount = v_new_cash, status = v_new_status
  WHERE id = p_id AND user_id = v_uid;

  RETURN QUERY SELECT v_new_cash, v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION add_money_to_goal(BIGINT, NUMERIC) TO authenticated;
```

**One-time backfill UPDATE** (D-12 — eager, deterministic — mirrors 0018 in-migration cleanup discipline):
```sql
-- D-12: backfill goals.status untuk eligible candidates supaya SC#1 visible post-deploy
UPDATE goals
SET status = 'completed'
WHERE status = 'active'
  AND id IN (SELECT id FROM goals_with_progress WHERE total_amount >= target_amount);
```

**Optional `withdraw_from_goal` MESSAGE update** (D-14 — Phase 7 follow-up patch):
```sql
-- If electing to update withdraw error wording in this migration (vs separate),
-- DROP + CREATE pattern (Phase 5 lesson). Wording mirror 0020:57-59:
RAISE EXCEPTION USING
  MESSAGE = format('Saldo kas tidak cukup. Tersedia Rp %s (terpisah dari Rp %s di investasi)',
                   v_goal.current_amount, v_invested_value),
  ERRCODE = 'P0001';
```

---

### `supabase/tests/07-seed-rencana.sql` (pgTAP)

**Analog:** `supabase/tests/06-process-due-recurring.sql` (whole structure)

**File header + scaffold** (mirror 06-process-due-recurring.sql:1-17):
```sql
-- ============================================================
-- Phase 07 SQL Integration Test: seed_rencana + reset_rencana_marker (CONS-03)
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/07-seed-rencana.sql
--
-- Validates 0022_user_seed_markers.sql.
--
-- Convention (mirrors 06-*.sql):
--   - BEGIN ... ROLLBACK wrapper -> no state ever persists.
--   - SET LOCAL row_security = off for SEEDING (superuser bypass).
--   - Output via RAISE NOTICE 'PASS:' / 'FAIL:' -- humans scan, CI greps for "FAIL:".
--
-- Expected: N PASS notices total
-- ============================================================

BEGIN;
SET LOCAL row_security = off;
```

**Auth seed pattern** (mirror 06-process-due-recurring.sql:48-80 — DO block + auth.users SKIP fallback):
```sql
DO $$
DECLARE
  v_uid    UUID := '00000000-0000-0000-0000-000000000a07';
  v_result BOOLEAN;
  v_count  INT;
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES (v_uid, 'phase7-seed-test@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP: cannot seed auth.users (%)', SQLERRM;
    RETURN;
  END;
  PERFORM set_config('request.jwt.claim.sub', v_uid::TEXT, true);
  -- ... scenarios
END $$;
```

**Required scenarios** (D-28 first bullet):
1. First call: `SELECT seed_rencana(NULL) → true`; assert 5 goals + 5 investments + 1 marker row exist.
2. Second call (idempotency): `SELECT seed_rencana(NULL) → false`; row counts unchanged.
3. Mid-execution failure rollback: simulate by inserting conflicting marker before call → `seed_rencana` should return false (no partial seed).
4. Backfill correctness: insert RENCANA-named goals manually under fresh uid + run backfill INSERT → assert marker auto-inserted.
5. Race serialization proof (mirror 06:37-40): `pg_get_functiondef('seed_rencana(UUID)'::regprocedure) LIKE '%user_seed_markers%'`.

**Footer pattern** (mirror 06-process-due-recurring.sql:280-286):
```sql
\echo '============================================================'
\echo 'Phase 7 seed_rencana test complete. Rolling back all changes.'
\echo 'Review output above for any FAIL: lines.'
\echo '============================================================'

ROLLBACK;
```

---

### `supabase/tests/07-goals-with-progress.sql` (pgTAP)

**Analogs:**
- Inline CASE WHEN style: `supabase/tests/04-mark-bill-paid.sql` SECTION 1 (lines 24-56)
- Scenarios DO block: `supabase/tests/06-withdraw-from-goal.sql` (lines 19-172)

**Required scenarios** (D-28 second bullet):
1. Goal with linked investment: target=10jt, allocation_pct=60, investment current_price=18jt, quantity=1 → assert `total_amount = current_amount + 10.8jt`.
2. Goal without linked investment: assert `total_amount = current_amount` (LEFT JOIN sanity).
3. Goal with investment where current_price IS NULL: assert COALESCE fallback ke buy_price.
4. RLS pass-through proof: caller v_uid SELECT only sees own goals via `goals_with_progress` (security_invoker validation, mirror Phase 5 RLS test).

**Inline assertion style for view-formula sanity** (mirror 04-mark-bill-paid.sql:26-28):
```sql
SELECT CASE WHEN (SELECT total_amount FROM goals_with_progress WHERE id = v_test_goal_id)
            = 10000000 + (60 / 100.0 * 18000000 * 1)
       THEN 'PASS: total_amount formula = cash + 60% × 18jt'
       ELSE 'FAIL: total_amount got ' || (SELECT total_amount FROM goals_with_progress WHERE id = v_test_goal_id)::TEXT END AS r;
```

---

### `supabase/tests/07-add-money-v2.sql` (pgTAP)

**Analog:** `supabase/tests/06-withdraw-from-goal.sql` (whole file — direct mirror; same status-flip pattern, inverse direction)

**Required scenarios** (D-28 third bullet):
1. Status flip `active → completed` when investment alone closes target: cash=0, target=10jt, linked investment 60%×18jt=10.8jt, call `add_money_to_goal(id, 1)` → assert status='completed'.
2. `paused` stays `paused` after add_money (mirror 06-withdraw scenario 3).
3. `completed` stays `completed` (no double-flip).
4. Concurrent serialization proof: `pg_get_functiondef('add_money_to_goal(BIGINT, NUMERIC)') LIKE '%FOR UPDATE%'` (mirror 06-withdraw:177-180).
5. Auth guard 28000 unauthenticated, 42501 access denied (if applicable).
6. `Jumlah harus > 0` raise on amount <= 0 (mirror 06-withdraw scenario 6).

**Footer:** identical RAISE NOTICE convention + ROLLBACK.

---

### `src/lib/useRencanaInit.ts` (TS module / React hook — full rewrite)

**Analog:** Self (current 26-line implementation) — preserve fast-path semantics, swap inner Promise.all for RPC call

**Current pattern to preserve** (from in-file lines 11-25):
```typescript
useEffect(() => {
  if (!user?.id) return
  const seedKey = `rencana_seeded_${user.id}`
  if (localStorage.getItem(seedKey)) return    // FAST PATH — D-08
  // ... call seed_rencana RPC instead of seedRencanaGoals + seedRencanaInvestments
}, [user?.id, qc])
```

**RPC call shape** (mirror `src/db/goals.ts:106-114` `withdrawFromGoal` RPC wrapper):
```typescript
const { data, error } = await supabase.rpc('seed_rencana', { p_uid: null })
if (error) throw error
// data is BOOLEAN per D-06; ignore return value (false = already seeded, no-op)
```

**Rewrite skeleton** (D-08 — fast-path cache + RPC fallback):
```typescript
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/useAuth'

export function useRencanaInit() {
  const qc = useQueryClient()
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return
    const seedKey = `rencana_seeded_${user.id}`
    if (localStorage.getItem(seedKey)) return  // fast path

    supabase.rpc('seed_rencana', { p_uid: null })
      .then(({ error }) => {
        if (error) throw error
        localStorage.setItem(seedKey, '1')
        qc.invalidateQueries({ queryKey: ['goals'] })
        qc.invalidateQueries({ queryKey: ['investments'] })
      })
      .catch(console.error)
  }, [user?.id, qc])
}
```

---

### `src/db/goals.ts` (deprecate `seedRencanaGoals`)

**Analog:** Same file — keep `addMoneyToGoal` callsite (line 96) unchanged because RPC name + signature stays identical post-migration 0024.

**Action:** Remove `seedRencanaGoals` export + `RENCANA_GOALS` constant (lines 116-129) OR keep with `@deprecated` JSDoc comment for one release cycle. Per D-04 the seed data hardcoded in SQL function body — JS constant becomes drift-prone if kept; recommend removal but flag in plan.

**Existing `addMoneyToGoal` shape** (no change — D-13):
```typescript
export async function addMoneyToGoal(id: number, amount: number): Promise<{ current_amount: number; status: GoalStatus }> {
  if (amount <= 0) throw new Error('Jumlah harus > 0')
  const { data, error } = await supabase.rpc('add_money_to_goal', { p_id: id, p_amount: amount })
  if (error) throw error
  return data[0] as { current_amount: number; status: GoalStatus }
}
```

---

### `src/db/investments.ts` (deprecate `seedRencanaInvestments`)

Same approach as `seedRencanaGoals` — remove function body (lines 201-205) + `RENCANA_INVESTMENTS` constant (lines 183-187). Synced via SQL function body (D-04 sync comment).

---

### `src/queries/investments.ts` (line 111 — date helper fix)

**Analog:** `src/db/investments.ts:94` — same file already imports + uses `todayISO()`:
```typescript
date: todayISO(),
```

**Edit (CONS-02, D-19):**
```typescript
// BEFORE (line 109-112)
mutationFn: async (investments: Investment[]) => {
  const { results, errors } = await fetchPrices(investments)
  const today = new Date().toISOString().slice(0, 10)
  await Promise.all(results.map(({ id, price }) => updatePrice(id, price, today)))
  // ...
}

// AFTER
import { todayISO } from '@/lib/format'  // add to import block

mutationFn: async (investments: Investment[]) => {
  const { results, errors } = await fetchPrices(investments)
  const today = todayISO()
  await Promise.all(results.map(({ id, price }) => updatePrice(id, price, today)))
  // ...
}
```

---

### `src/tabs/SettingsTab.tsx` (extend `doResetSeed`)

**Analog:** Self (existing handler lines 105-127)

**Extension points** (D-07):
```typescript
async function doResetSeed() {
  setResetting(true)
  try {
    const goalsToDelete = goals.filter((g) =>
      (RENCANA_GOAL_NAMES as readonly string[]).includes(g.name)
    )
    const invsToDelete = invRows.filter((i) =>
      (RENCANA_INVESTMENT_NAMES as readonly string[]).includes(i.asset_name)
    )
    await Promise.all([
      ...goalsToDelete.map((g) => deleteGoal(g.id)),
      ...invsToDelete.map((i) => deleteInvestment(i.id)),
    ])

    // NEW (D-07.3): atomic DB marker reset via RPC
    const { error: rpcErr } = await supabase.rpc('reset_rencana_marker')
    if (rpcErr) throw rpcErr

    // FIX (UX-01, D-07.4): per-user localStorage key
    if (user?.id) {
      localStorage.removeItem(`rencana_seeded_${user.id}`)
    }
    // Cleanup legacy key (D-07.5 — one-shot inline migration)
    localStorage.removeItem('rencana_seeded')

    qc.invalidateQueries({ queryKey: ['goals'] })
    qc.invalidateQueries({ queryKey: ['investments'] })
    toast.success('Seed direset. Buka Dashboard untuk inisialisasi ulang.')
  } catch (e) {
    toast.error(mapSupabaseError(e))
  } finally {
    setResetting(false)
  }
}
```

**Required imports to add:** `import { supabase } from '@/lib/supabase'` (file already imports `mapSupabaseError`).

---

### `src/tabs/TransactionsTab.tsx` (Impor button gate, UX-02)

**Analogs:**
- `disabled` + tooltip pattern: `src/tabs/InvestmentsTab.tsx:81-88` (existing `disabled` use)
- Existing handler at lines 128-143 (extend with early-return guard)
- `useViewAs()` import precedent: `src/tabs/SettingsTab.tsx:10` already imports `useViewAs`

**Disabled prop pattern** (D-22, D-23 — exact tooltip wording per ROADMAP SC#5):
```tsx
import { useViewAs } from '@/auth/useViewAs'

// inside component
const { viewingAs } = useViewAs()
const isViewAs = viewingAs !== null

// existing button at line 128 — add disabled + title
<Button
  variant="outline" size="sm"
  className="h-7 text-xs text-[var(--brand)] border-[#e0e7ff]"
  disabled={isViewAs}
  title={isViewAs ? 'Tidak tersedia saat View-As' : ''}
  onClick={async () => {
    // D-24 handler-level guard (defense in depth)
    if (viewingAs) {
      toast.error('Impor CSV tidak tersedia saat View-As')
      return
    }
    const text = await pickCsvFile()
    // ...existing logic (lines 129-141 unchanged)
  }}>
  <Upload className="h-3 w-3" />Impor
</Button>
```

**CRITICAL — exact-match wording:** `'Tidak tersedia saat View-As'` (verifier diff-matches; do not re-word).

---

### `src/tabs/InvestmentsTab.tsx` (Impor button gate, UX-02)

Same pattern as TransactionsTab. Existing button at lines 64-80 (handler) → add `disabled={isViewAs}` + `title=...` + early-return guard. Already has `useViewAs` import precedent in sibling file SettingsTab.

---

### `src/components/AddMoneyDialog.tsx` (kas/investasi info, D-15)

**Analog:** Self (lines 71-75 existing `DialogDescription` mode-switch pattern)

**Current** (lines 71-75):
```tsx
<DialogDescription>
  {mode === 'tambah'
    ? `Sisa yang perlu dikumpulkan: ${formatRupiah(remaining)}`
    : `Saldo kas tersedia: ${formatRupiah(goal.current_amount)}`}
</DialogDescription>
```

**Extension (D-15) — withdraw mode shows kas + investasi separately:**
```tsx
// Props addition: pass investedValue (NUMERIC) from parent (queries goals_with_progress)
interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: Goal | null
  investedValue?: number  // NEW: from goals_with_progress.total_amount - goals.current_amount
}

// JSX
<DialogDescription>
  {mode === 'tambah'
    ? `Sisa yang perlu dikumpulkan: ${formatRupiah(remaining)}`
    : `Saldo kas tersedia: ${formatRupiah(goal.current_amount)}${
        investedValue !== undefined && investedValue > 0
          ? ` (terpisah dari investasi ${formatRupiah(investedValue)})`
          : ''
      }`}
</DialogDescription>
```

**CRITICAL — exact-match wording** (D-15 + UAT-1): `'Saldo kas tersedia: Rp X (terpisah dari investasi Rp Y)'` — parallel with withdraw_from_goal RAISE message phrasing (D-14).

**Parent callsite refactor** — wherever `<AddMoneyDialog>` is rendered (likely `GoalsTab.tsx`), query VIEW `goals_with_progress` instead of base `goals`, compute `investedValue = total_amount - current_amount`, pass as prop.

---

### `eslint.config.js` (no-restricted-syntax rule, D-16)

**Analog:** None in project (first AST-selector rule). Pattern reference: ESLint docs `no-restricted-syntax`.

**Edit — add rule block to flat config** (D-16, D-17):
```javascript
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "CallExpression[callee.object.callee.object.callee.name='Date'][callee.property.name='slice']",
        message: 'Pakai todayISO() dari @/lib/format — .toISOString().slice(0,10) returns UTC date, bukan WIB',
      }],
    },
  },
])
```

**Notes:**
- Severity `error` (D-17 — CI block).
- D-18: no exceptions; if executor finds genuine edge case, use `// eslint-disable-next-line no-restricted-syntax` + comment justifikasi.
- Pre-existing 23 lint errors (STATE.md) tidak block — rule baru only catches new occurrences.

---

## Shared Patterns (cross-cutting)

### Pattern A: RPC SECURITY DEFINER + auth guard + ERRCODE
**Source:** `supabase/migrations/0014_mark_bill_paid.sql:51-70` baseline + `0019_process_due_recurring.sql:32-39` Phase 6 ERRCODE upgrade
**Apply to:** `seed_rencana`, `reset_rencana_marker`, `add_money_to_goal_v2` (Phase 7 RPCs)
**Skeleton:**
```sql
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid UUID := COALESCE(p_uid, auth.uid());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000'; END IF;
  IF v_uid != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;
  ...
END;
$$;

GRANT EXECUTE ON FUNCTION xxx(...) TO authenticated;
```

### Pattern B: DROP FUNCTION before CREATE on signature change
**Source:** `supabase/migrations/0018_drop_legacy_aggregates.sql:17-18`
**Apply to:** `0024_add_money_to_goal_v2.sql` (mandatory per D-13)
**Snippet:**
```sql
DROP FUNCTION IF EXISTS public.add_money_to_goal(BIGINT, NUMERIC);
-- then CREATE OR REPLACE ...
```

### Pattern C: VIEW security_invoker = true
**Source:** `supabase/migrations/0015_upcoming_bills_unpaid_view.sql:13-14, 41-42`
**Apply to:** `0023_goals_with_progress.sql`
**Skeleton:**
```sql
CREATE OR REPLACE VIEW xxx WITH (security_invoker = true) AS SELECT ...;
GRANT SELECT ON xxx TO authenticated;
```

### Pattern D: pgTAP test file structure
**Source:** `supabase/tests/06-process-due-recurring.sql` (full file) + `06-withdraw-from-goal.sql`
**Apply to:** All 3 Phase 7 test files (`07-seed-rencana.sql`, `07-goals-with-progress.sql`, `07-add-money-v2.sql`)
**Conventions:**
- `BEGIN; SET LOCAL row_security = off;` opener (line 16-17 reference)
- DO $$ DECLARE ... BEGIN block for scenarios needing auth.users seed (with SKIP fallback EXCEPTION block — 06-process:67-80)
- `set_config('request.jwt.claim.sub', v_uid::TEXT, true)` to set JWT context (06-process:100)
- Inline `SELECT CASE WHEN ... THEN 'PASS: ...' ELSE 'FAIL: ...' END` for simple assertions (04-mark-bill-paid:26-28)
- `RAISE NOTICE 'PASS: ...'` / `'FAIL: ...'` inside DO block (06-process:115-119)
- `pg_get_functiondef(...) LIKE '%FOR UPDATE%'` proof for serialization claims (06-process:37-40, 06-withdraw:177-180)
- `BEGIN ... EXCEPTION WHEN OTHERS THEN ... END` for negative-path SQLSTATE checks (06-process:216-225, 06-withdraw:124-133)
- Footer: `\echo '...'`, ROLLBACK, expected PASS-count comment

### Pattern E: RPC call wrapper (TS)
**Source:** `src/db/goals.ts:106-114` `withdrawFromGoal`
**Apply to:** All Phase 7 TS RPC callsites (`useRencanaInit` seed_rencana, `doResetSeed` reset_rencana_marker)
**Skeleton:**
```typescript
const { data, error } = await supabase.rpc('rpc_name', { p_arg: value })
if (error) throw error
return data[0] as ExpectedShape  // or skip if RETURNS BOOLEAN/VOID
```

### Pattern F: Indonesian user-facing copy
**Source:** Phase 6 `0020_withdraw_from_goal.sql:58` `'Saldo kas tidak cukup ...'` + ROADMAP SC#5 `'Tidak tersedia saat View-As'`
**Apply to:** All RAISE EXCEPTION strings, toast.error/info/success messages, Button title/tooltip, DialogDescription text
**Critical exact-match strings** (verifier checks):
- `'Tidak tersedia saat View-As'` (UX-02 button title — UAT-5)
- `'Saldo kas tersedia: Rp X (terpisah dari investasi Rp Y)'` (AddMoneyDialog withdraw mode — UAT-1)
- `'Saldo kas tidak cukup. Tersedia Rp X (terpisah dari Rp Y di investasi)'` (withdraw_from_goal error — UAT-1)
- `'Impor CSV tidak tersedia saat View-As'` (handler guard toast — D-24)

### Pattern G: mapSupabaseError reuse (no new branches)
**Source:** Phase 5 + Phase 6 `src/lib/errors.ts` (already has SQLSTATE 42501, 23514, P0001 branches per CONTEXT.md "Reusable Assets")
**Apply to:** All Phase 7 toast.error catch blocks
**Usage:**
```typescript
} catch (e) {
  toast.error(mapSupabaseError(e))
}
```
**Do NOT add new branches** — Phase 7 only emits SQLSTATE codes already covered.

### Pattern H: Migration paste-order (Studio SQL Editor manual paste)
**Source:** Phase 6 `06-CONTEXT.md` D-22 + STATE.md "Studio fallback de-facto channel"
**Apply to:** All 3 Phase 7 migrations
**Order:** 0022 (table+RPC) → 0023 (VIEW, depends on goals/goal_investments/investments existing) → 0024 (DROP+CREATE+UPDATE backfill, depends on 0023 VIEW for backfill IN clause).
**Do NOT use** `supabase db push` (broken in this project — STATE.md decision).

---

## Conventions Checklist

For executor + verifier, every Phase 7 plan must satisfy:

- [ ] **RPC pattern compliance** — SECURITY DEFINER + SET search_path = public + auth guard via auth.uid() + COALESCE(p_uid, auth.uid()) for batch-style RPCs.
- [ ] **DROP FUNCTION explicit** — migration 0024 DROPs `add_money_to_goal(BIGINT, NUMERIC)` before CREATE OR REPLACE (Phase 5 lesson).
- [ ] **FOR UPDATE on base table** — `add_money_to_goal_v2` locks `goals` row before status compute.
- [ ] **VIEW security_invoker = true** — `goals_with_progress` mandatory.
- [ ] **GRANT EXECUTE / GRANT SELECT TO authenticated** — every RPC + VIEW.
- [ ] **pgTAP convention** — BEGIN/ROLLBACK + RAISE NOTICE PASS:/FAIL:, no plan/finish helpers, `SET LOCAL row_security = off` for seeding.
- [ ] **Migration channel** — paste in Studio SQL Editor in order 0022 → 0023 → 0024; do NOT use `db push`.
- [ ] **Indonesian copy** — all user-facing strings in Bahasa Indonesia; exact-match wording verbatim.
- [ ] **Tooltip wording UX-02** — `'Tidak tersedia saat View-As'` exact match (verifier diff-checks).
- [ ] **AddMoneyDialog withdraw helper text** — `'Saldo kas tersedia: Rp X (terpisah dari investasi Rp Y)'` parallel with error message.
- [ ] **mapSupabaseError reuse** — no new SQLSTATE branches needed (Phase 5+6 already cover 42501/23514/P0001).
- [ ] **Per-user localStorage key** — `rencana_seeded_${user.id}`, never global `'rencana_seeded'`.
- [ ] **Legacy key cleanup** — Reset handler removes legacy `'rencana_seeded'` (one-shot migration in handler).
- [ ] **Defense-in-depth handler guard** — UX-02 callsites: button disabled + handler early-return.
- [ ] **ESLint `no-restricted-syntax` rule** — severity `error` (CI block); only catch new occurrences (pre-existing 23 errors deferred to Phase 8).
- [ ] **Sync comment on seed function body** — `-- Synced with src/lib/rencanaNames.ts and src/db/goals.ts:RENCANA_GOALS — update both atomically if seed data changes` (D-04).
- [ ] **Vercel auto-deploy timing** — wait 15-30s post-push (not 90s) per memory `project_vercel_deploy_timing.md`.
- [ ] **Browser-MCP UAT pre-close** — 5 UATs (UAT-1..5) per D-29 mandatory.

## No Analog Found

| File | Reason | Fallback |
|------|--------|----------|
| `eslint.config.js` rule addition | First AST-selector `no-restricted-syntax` rule in project | Use ESLint docs reference (CONTEXT.md external docs) + AST selector verbatim per D-16 |

(All other 13 files have at least one in-codebase analog with concrete excerpts above.)

## Metadata

**Analog search scope:**
- `supabase/migrations/` (21 files scanned)
- `supabase/tests/` (5 files scanned)
- `src/lib/`, `src/db/`, `src/queries/`, `src/tabs/`, `src/components/`, `src/auth/` (focused on CONTEXT.md callsites)

**Files Read for excerpts:**
- `supabase/migrations/0006_multi_user.sql` (lines 200-263)
- `supabase/migrations/0013_bill_payments.sql` (full)
- `supabase/migrations/0014_mark_bill_paid.sql` (full)
- `supabase/migrations/0015_upcoming_bills_unpaid_view.sql` (full)
- `supabase/migrations/0018_drop_legacy_aggregates.sql` (full)
- `supabase/migrations/0019_process_due_recurring.sql` (full)
- `supabase/migrations/0020_withdraw_from_goal.sql` (full)
- `supabase/tests/04-mark-bill-paid.sql` (lines 1-60)
- `supabase/tests/06-process-due-recurring.sql` (full)
- `supabase/tests/06-withdraw-from-goal.sql` (full)
- `src/lib/useRencanaInit.ts` (full)
- `src/lib/format.ts` (full)
- `src/db/goals.ts` (full)
- `src/db/investments.ts` (lines 1-100, 175-205)
- `src/queries/investments.ts` (full)
- `src/tabs/SettingsTab.tsx` (full)
- `src/tabs/TransactionsTab.tsx` (lines 115-154)
- `src/tabs/InvestmentsTab.tsx` (lines 55-89)
- `src/components/AddMoneyDialog.tsx` (full)
- `eslint.config.js` (full)

**Pattern extraction date:** 2026-04-29
