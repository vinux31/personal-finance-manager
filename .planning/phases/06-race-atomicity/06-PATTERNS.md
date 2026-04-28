# Phase 6: Race & Atomicity — Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 11 (6 NEW, 5 MODIFIED)
**Analogs found:** 11 / 11 (100% coverage — semua punya pattern source di codebase)
**Doctrine:** Konvergensi ke `mark_bill_paid` (migration 0014). Setiap RPC baru mirror struktur 0014 secara verbatim untuk auth/access guard, FOR UPDATE, idempotency, GRANT.

---

## File Classification

| File | Kind | Role | Data Flow | Closest Analog | Match Quality |
|------|------|------|-----------|----------------|---------------|
| `supabase/migrations/0019_process_due_recurring.sql` | NEW | RPC migration (set-based loop) | batch + idempotent write | `supabase/migrations/0014_mark_bill_paid.sql` | exact (canonical) |
| `supabase/migrations/0020_withdraw_from_goal.sql` | NEW | RPC migration (atomic mutate) | request-response + lock | `supabase/migrations/0006_multi_user.sql:225-261` (`add_money_to_goal`) | exact (inverse mirror) |
| `supabase/migrations/0021_goal_investments_total_check.sql` | NEW | Trigger + index migration | event-driven validation | `supabase/migrations/0017_tighten_rls.sql:38-58` (`enforce_email_allowlist`) + `0006_multi_user.sql:37-47` (`is_admin`) | role-match (SECURITY DEFINER trigger) |
| `supabase/tests/06-process-due-recurring.sql` | NEW | pgTAP integration test | scenario-based assertion | `supabase/tests/04-mark-bill-paid.sql` | exact |
| `supabase/tests/06-withdraw-from-goal.sql` | NEW | pgTAP integration test | scenario-based assertion | `supabase/tests/04-mark-bill-paid.sql` | exact |
| `supabase/tests/06-goal-investments-cap.sql` | NEW | pgTAP integration test | scenario-based assertion | `supabase/tests/05-tighten-rls.sql` | exact (multi-user fixture pattern) |
| `src/hooks/useProcessRecurring.ts` | MOD (rewrite) | React hook (RPC dispatcher) | request-response | `src/db/recurringTransactions.ts:138-151` (`markBillPaid`) + current `useProcessRecurring.ts` skeleton | role-match |
| `src/db/recurringTransactions.ts` | MOD (delete lines 28-48) | DB module | n/a | n/a (deletion, no analog) | n/a |
| `src/db/goals.ts` | MOD (refactor lines 106-126) | DB module (RPC wrapper) | request-response | `src/db/goals.ts:94-99` (`addMoneyToGoal`) — same file inverse | exact (inverse mirror in same file) |
| `src/queries/goals.ts` | MOD (lines 79-90) | react-query mutation hook | request-response | `src/queries/goals.ts:67-77` (`useAddMoneyToGoal`) — same file | exact (inverse mirror in same file) |
| `src/components/AddMoneyDialog.tsx` | MOD (line 50) | React dialog (callsite) | request-response | self (line 47 `addMoney.mutateAsync({ id, amount })`) | exact |
| `src/lib/errors.ts` | MOD (insert SQLSTATE branches) | error mapper | transform | `src/lib/errors.ts:21-26` (existing 42501/28000 branches) | exact (extension of same module) |

**No analog found:** None.

---

## Pattern Assignments

### `supabase/migrations/0019_process_due_recurring.sql` (NEW — RPC migration)

**Analog:** `supabase/migrations/0014_mark_bill_paid.sql` (THE canonical RPC template).

**Comment-block pattern (mirror 0014:1-8):**
```sql
-- ============================================================
-- 0019_process_due_recurring: Eliminasi race condition di useProcessRecurring (RACE-01)
-- Mirror pattern 0014_mark_bill_paid: SECURITY DEFINER + FOR UPDATE + bill_payments IF EXISTS.
--
-- SEMANTIC NOTE (D-03): bill_payments sekarang stores BOTH expense AND income runs.
-- Nama tabel kept untuk back-compat dengan mark_bill_paid + upcoming_bills_unpaid VIEW.
-- Rename ke recurring_runs jadi v1.2 backlog jika dataset/ambiguity ganggu.
-- ============================================================
```
**Critical:** `SEMANTIC NOTE` block WAJIB ada — Pitfall 2 di RESEARCH.md.

**Function signature pattern (mirror 0014:45-54):**
```sql
CREATE OR REPLACE FUNCTION process_due_recurring(
  p_today    DATE DEFAULT CURRENT_DATE,
  p_uid      UUID DEFAULT NULL,
  p_max_iter INT  DEFAULT 12
)
RETURNS TABLE (processed_count INT, skipped_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_uid, auth.uid());
  -- ...
BEGIN
```

**Auth + Access guard (verbatim copy from 0014:62-70 + Phase 5 0017:84,88 ERRCODE additions):**
```sql
-- Auth guard (mirror 0014:62-65)
IF v_uid IS NULL THEN
  RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
END IF;
-- Access guard (mirror 0014:67-70 + 0017 ERRCODE)
IF v_uid != auth.uid() AND NOT is_admin() THEN
  RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
END IF;
```

> **CALLOUT — auth guard MUST be 4 lines** (sama persis Phase 5 SEC-04 pattern). Copy verbatim. ERRCODE 28000 untuk unauthenticated, 42501 untuk access denied. Jangan reinvent.

**FOR UPDATE row lock pattern (mirror 0014:73-77):**
```sql
FOR v_template IN
  SELECT id, name, type, category_id, amount, note, frequency, next_due_date
  FROM recurring_templates
  WHERE user_id = v_uid AND is_active = true AND next_due_date <= p_today
  FOR UPDATE  -- serializes vs concurrent mark_bill_paid + concurrent process_due_recurring
LOOP
```

**Idempotency guard (verbatim mirror 0014:84-91):**
```sql
IF EXISTS (
  SELECT 1 FROM bill_payments
  WHERE recurring_template_id = v_template.id
    AND user_id = v_uid AND paid_date = v_due
) THEN
  v_skipped := v_skipped + 1;
ELSE
  -- INSERT INTO transactions + bill_payments + advance next_due
END IF;
```

**Atomic 2-write pattern (mirror 0014:93-104):** Pertahankan urutan: INSERT transactions → RETURNING id → INSERT bill_payments dengan transaction_id. Explicit `user_id = v_uid` di kedua INSERT (jangan rely pada DEFAULT auth.uid() — SECURITY DEFINER context owner uid bukan caller uid).

**next_due advance (re-use 0014:14-40 helper):**
```sql
v_due := next_due_date_sql(v_due, v_template.frequency);
```
> **CALLOUT — next_due_date_sql is SHARED.** Jangan port ulang. Function sudah handle FOUND-01 month-end clamping.

**GRANT pattern (mirror 0014:120-121):**
```sql
GRANT EXECUTE ON FUNCTION process_due_recurring(DATE, UUID, INT) TO authenticated;
```
> **CALLOUT — full signature WAJIB di GRANT** (semua DEFAULT params listed). Phase 5 0017:156-157 demonstrasi. Postgres requires this.

**Compliance Checklist:**
- [ ] Comment block dengan SEMANTIC NOTE D-03 di awal file
- [ ] `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`
- [ ] Auth guard 28000 + access guard 42501 (4 baris exactly)
- [ ] `v_uid := COALESCE(p_uid, auth.uid())` declaration
- [ ] `FOR UPDATE` di outer SELECT loop pada `recurring_templates`
- [ ] `IF EXISTS bill_payments` idempotency guard sebelum INSERT
- [ ] Explicit `user_id = v_uid` di kedua INSERT (transactions + bill_payments)
- [ ] `bill_payments.amount` filled (NOT NULL — Pitfall 3 dari Phase 4)
- [ ] `GRANT EXECUTE ... TO authenticated` dengan full signature `(DATE, UUID, INT)`
- [ ] Pakai `next_due_date_sql(...)` helper, jangan port logic baru

---

### `supabase/migrations/0020_withdraw_from_goal.sql` (NEW — RPC migration)

**Analog:** `supabase/migrations/0006_multi_user.sql:225-261` (`add_money_to_goal`) — DIRECT INVERSE MIRROR.

**add_money_to_goal source (lines 225-261), copy struktur, ganti operator + tambah lock:**
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
  v_target     NUMERIC;
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
  -- ...
```

**Differences (WITHDRAW must add):**
1. **`FOR UPDATE` row lock** sebelum mutate — `add_money_to_goal` belum punya lock (boleh karena INSERT pure-additive, withdraw butuh read-modify-write). Pakai pattern 0014:72-77.
2. **`Saldo kas tidak cukup` raise** dengan `SQLSTATE P0001` (D-10) + Indonesian message + saldo eksplisit.
3. **Status flip logic D-11:** `completed AND new < target → active`; `paused stays paused`; `active stays active`. Bukan `add_money_to_goal` style yang flip ke `completed`.

**Auth guard (mirror 0014:62-65 — RPC ini SELF-ONLY, no p_uid):**
```sql
DECLARE
  v_uid UUID := auth.uid();   -- no COALESCE — no admin View-As (D-12 simplicity)
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Jumlah harus > 0';
  END IF;
```
> **CALLOUT — withdraw_from_goal NO p_uid param.** Beda dari `process_due_recurring` (yang punya p_uid). Document di migration COMMENT: `-- No p_uid param: withdraw is always self-action; admin View-As impersonation handled via JWT 'sub' claim switch in client.` Pitfall 3 di RESEARCH.md.

**FOR UPDATE + body skeleton (RESEARCH.md 06-RESEARCH:380-418):**
```sql
SELECT id, current_amount, target_amount, status INTO v_goal
FROM goals WHERE id = p_id AND user_id = v_uid
FOR UPDATE;

IF NOT FOUND THEN RAISE EXCEPTION 'Goal tidak ditemukan'; END IF;

v_new_amount := v_goal.current_amount - p_amount;
IF v_new_amount < 0 THEN
  RAISE EXCEPTION 'Saldo kas tidak cukup (tersedia Rp %)', v_goal.current_amount
    USING ERRCODE = 'P0001';
END IF;

v_new_status := CASE
  WHEN v_goal.status = 'completed' AND v_new_amount < v_goal.target_amount THEN 'active'
  ELSE v_goal.status
END;

UPDATE goals
SET current_amount = v_new_amount, status = v_new_status
WHERE id = p_id AND user_id = v_uid;

RETURN QUERY SELECT v_new_amount, v_new_status;
```

**GRANT pattern (mirror 0006:263 + 0014:121 style):**
```sql
GRANT EXECUTE ON FUNCTION withdraw_from_goal(BIGINT, NUMERIC) TO authenticated;
```

**Compliance Checklist:**
- [ ] `v_uid := auth.uid()` (NO COALESCE — no admin View-As)
- [ ] Auth guard 28000 (1 guard, not 2 — no access guard)
- [ ] `p_amount <= 0` precondition raise (mirror 0006:239-241)
- [ ] `FOR UPDATE` row lock sebelum read goal (NEW — beda dari add_money_to_goal)
- [ ] `IF NOT FOUND THEN RAISE 'Goal tidak ditemukan'` (mirror 0006:249-251)
- [ ] Insufficient saldo raise dengan `SQLSTATE 'P0001'` + Indonesian message + saldo eksplisit `Rp %`
- [ ] Status transition D-11: completed→active, paused stays, active stays
- [ ] RETURN TABLE `(current_amount NUMERIC, status TEXT)` — match `add_money_to_goal` shape
- [ ] `GRANT EXECUTE ... TO authenticated` dengan `(BIGINT, NUMERIC)` signature

---

### `supabase/migrations/0021_goal_investments_total_check.sql` (NEW — trigger + index)

**Analog A (trigger function pattern):** `supabase/migrations/0017_tighten_rls.sql:38-58` (`enforce_email_allowlist`).
**Analog B (SECURITY DEFINER for RLS bypass):** `supabase/migrations/0006_multi_user.sql:37-47` (`is_admin`).

**Trigger function pattern (mirror 0017:38-58):**
```sql
CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ... validation logic with RAISE EXCEPTION if violated
  RETURN NEW;
END;
$$;
```

**Phase 6 application:**
```sql
CREATE OR REPLACE FUNCTION enforce_goal_investment_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER         -- D-14: bypass RLS for SUM aggregate
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(allocation_pct), 0) INTO v_total
  FROM goal_investments
  WHERE investment_id = NEW.investment_id
    AND id IS DISTINCT FROM NEW.id   -- exclude-self for UPDATE
  FOR UPDATE;                         -- serialize concurrent inserts on same investment_id

  IF v_total + NEW.allocation_pct > 100 THEN
    RAISE EXCEPTION 'Total alokasi melebihi 100%% (sudah %, tambah % > 100)',
      v_total, NEW.allocation_pct USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
```

> **CALLOUT — `id IS DISTINCT FROM NEW.id`** (bukan `<>`) untuk benar handle NULL pada INSERT (NEW.id NULL pre-insert) dan UPDATE (NEW.id valid). PostgreSQL `<>` returns NULL with NULL operand — `IS DISTINCT FROM` returns TRUE.

> **CALLOUT — `RAISE EXCEPTION ... USING ERRCODE = '23514'`** (D-13). 23514 = check_violation. Message dengan `%%` literal escape untuk percent sign + 2 placeholders untuk v_total + NEW.allocation_pct.

**Trigger attachment (mirror 0017:59 in-place pattern, idempotent):**
```sql
DROP TRIGGER IF EXISTS goal_investments_total_check ON goal_investments;
CREATE TRIGGER goal_investments_total_check
  BEFORE INSERT OR UPDATE ON goal_investments
  FOR EACH ROW EXECUTE FUNCTION enforce_goal_investment_total();
```
> **CALLOUT — `DROP TRIGGER IF EXISTS` first.** Idempotent re-run safety. Convention dari 0017 SEC-02 lines 17-18 (`DROP POLICY IF EXISTS` then CREATE).

**Index pattern (D-15, mirror existing convention):**
```sql
CREATE INDEX IF NOT EXISTS goal_investments_investment_idx
  ON goal_investments(investment_id);
```
> **CALLOUT — Naming convention `<table>_<column>_idx`** matches existing `transactions_date_idx`, `goal_investments_goal_idx` (kalau ada). Search `*_idx` di codebase untuk verify.

**Compliance Checklist:**
- [ ] Comment block dengan referensi pre-deploy gate D-16 di top
- [ ] Trigger function `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`
- [ ] `id IS DISTINCT FROM NEW.id` (bukan `<>`) untuk exclude-self
- [ ] `FOR UPDATE` di SELECT SUM untuk race serialization
- [ ] `RAISE EXCEPTION ... USING ERRCODE = '23514'` dengan `%%` escape + `v_total, NEW.allocation_pct` placeholders
- [ ] `DROP TRIGGER IF EXISTS ... ON goal_investments;` sebelum CREATE TRIGGER
- [ ] `BEFORE INSERT OR UPDATE ... FOR EACH ROW EXECUTE FUNCTION ...`
- [ ] Index `CREATE INDEX IF NOT EXISTS goal_investments_investment_idx ON goal_investments(investment_id)`
- [ ] No GRANT needed (trigger functions invoked by trigger machinery, not direct calls)

---

### `supabase/tests/06-process-due-recurring.sql` (NEW — pgTAP test)

**Analog:** `supabase/tests/04-mark-bill-paid.sql` (most direct match — same domain RPC).

**Preamble (verbatim mirror 04:1-18):**
```sql
-- ============================================================
-- Phase 06 Wave 1 SQL Integration Test: process_due_recurring (RACE-01)
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/06-process-due-recurring.sql
--
-- Validates migration 0019_process_due_recurring.sql (must be applied to target DB before running).
--
-- Convention (mirrors 04-mark-bill-paid.sql + 05-tighten-rls.sql):
--   - BEGIN ... ROLLBACK wrapper -> no state ever persists.
--   - SET LOCAL row_security = off for SEEDING (superuser bypass).
--   - Output via RAISE NOTICE 'PASS:' / 'FAIL:' -- humans scan, CI greps for "FAIL:".
--
-- Expected: 8-9 PASS notices total
-- ============================================================

BEGIN;
SET LOCAL row_security = off;
```

**Seed pattern with auth.users + SKIP fallback (verbatim 04:88-97):**
```sql
DO $$
DECLARE
  v_uid UUID := '00000000-0000-0000-0000-000000000aaa';
  v_cat_id BIGINT;
  v_template_id BIGINT;
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
    VALUES (v_uid, 'phase6-test@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP SECTION X: cannot seed auth.users (%)', SQLERRM;
    RETURN;
  END;
  -- ...
```
> **CALLOUT — copy SKIP block verbatim** dari 04:88-97. Restricted Supabase environments (some prod-mirror configs) reject `INSERT INTO auth.users` — SKIP fallback prevents false-FAIL. Pitfall 10 di RESEARCH.md.

**JWT claim switching (verbatim 04:116):**
```sql
PERFORM set_config('request.jwt.claim.sub', v_uid::TEXT, true);
```

**PASS/FAIL Style B — DO block + RAISE NOTICE (mirror 04:126-130):**
```sql
SELECT COUNT(*) INTO v_tx_count FROM transactions WHERE ...;
IF v_tx_count = 1 THEN
  RAISE NOTICE 'PASS: <descriptive label>';
ELSE
  RAISE NOTICE 'FAIL: <label> — expected 1, got %', v_tx_count;
END IF;
```

**Race serialization scenario (use logical-proof pattern from RESEARCH.md test_convention §935-947):**
```sql
SELECT CASE WHEN pg_get_functiondef('process_due_recurring(DATE, UUID, INT)'::regprocedure)
              LIKE '%FOR UPDATE%'
       THEN 'PASS: process_due_recurring uses FOR UPDATE row lock'
       ELSE 'FAIL: FOR UPDATE missing from function definition' END AS r;
```

**Closing footer (verbatim 04:247-252):**
```sql
\echo '============================================================'
\echo 'Phase 6 process_due_recurring test complete. Rolling back all changes.'
\echo 'Review output above for any FAIL: lines.'
\echo 'Expected: 8-9 PASS notices.'
\echo '============================================================'

ROLLBACK;
```

**Suggested scenarios (RESEARCH.md §263-275):**
1. PASS: expense template — single iteration, 1 tx + 1 bill_payment
2. PASS: income template (Gaji) — single iteration, 1 tx (type=income) + 1 bill_payment (locks D-01 contract)
3. PASS: idempotency — second call same date returns processed_count=0, skipped_count=1
4. PASS: catch-up — template due 3 months ago, p_max_iter=12, processes 3 iterations
5. PASS: month-end clamping via next_due_date_sql call
6. PASS: access guard — non-admin → SQLSTATE 42501 (mirror 04 SECTION 4)
7. PASS: admin view-as — admin → succeeds (mirror 05 SECTION 4)
8. PASS: unauthenticated — JWT claim sub NULL → SQLSTATE 28000
9. PASS: race serialization — pg_get_functiondef LIKE '%FOR UPDATE%'

**Compliance Checklist:**
- [ ] BEGIN ... ROLLBACK wrapper
- [ ] `SET LOCAL row_security = off` after BEGIN
- [ ] auth.users SEED dalam BEGIN/EXCEPTION block dengan `RAISE NOTICE 'SKIP'` fallback
- [ ] `set_config('request.jwt.claim.sub', uid::TEXT, true)` for JWT context
- [ ] Style B (DO block + RAISE NOTICE) untuk multi-step scenarios
- [ ] Income template scenario (locks D-01 contract per Pitfall 2 RESEARCH)
- [ ] Both same-user AND admin-impersonating scenarios (Pitfall 3)
- [ ] Race serialization via `pg_get_functiondef LIKE '%FOR UPDATE%'` (logical proof)
- [ ] Closing `\echo` block + final `ROLLBACK`
- [ ] Target ≥ 8 PASS notices

---

### `supabase/tests/06-withdraw-from-goal.sql` (NEW — pgTAP test)

**Analog:** `supabase/tests/04-mark-bill-paid.sql` (RPC integration style).

**Same preamble + seed + JWT pattern as 06-process-due-recurring.sql.** No new pattern to mirror.

**Specific scenario for status flip (Style B, multi-step):**
```sql
-- Scenario 2: completed → active flip
INSERT INTO goals (user_id, name, target_amount, current_amount, target_date, status)
VALUES (v_uid, 'Phase6 Goal', 100000, 100000, NULL, 'completed')
RETURNING id INTO v_goal_id;

PERFORM withdraw_from_goal(v_goal_id, 1::NUMERIC);

SELECT current_amount, status INTO v_balance, v_status
FROM goals WHERE id = v_goal_id;

IF v_balance = 99999 AND v_status = 'active' THEN
  RAISE NOTICE 'PASS: completed → active flip when new < target';
ELSE
  RAISE NOTICE 'FAIL: expected (99999, active), got (%, %)', v_balance, v_status;
END IF;
```

**Specific scenario for SQLSTATE P0001 (mirror 04 idempotency-test pattern at lines 162-172):**
```sql
BEGIN
  PERFORM withdraw_from_goal(v_goal_id, 60000::NUMERIC);
  RAISE NOTICE 'FAIL: insufficient saldo did not raise';
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE = 'P0001' AND SQLERRM LIKE '%Saldo kas tidak cukup%' THEN
    RAISE NOTICE 'PASS: SQLSTATE P0001 raised "%".', SQLERRM;
  ELSE
    RAISE NOTICE 'FAIL: unexpected error: SQLSTATE % — %', SQLSTATE, SQLERRM;
  END IF;
END;
```
> **CALLOUT — assert BOTH `SQLSTATE = 'P0001'` AND `SQLERRM LIKE '%Saldo kas tidak cukup%'`.** Locks D-10 contract (state code + Indonesian message both required).

**Compliance Checklist:**
- [ ] Same preamble structure as 06-process-due-recurring
- [ ] Scenario 1: happy path withdraw 30k from 100k, status unchanged
- [ ] Scenario 2: completed → active flip (Style B with verify v_balance + v_status)
- [ ] Scenario 3: paused stays paused (locks D-11)
- [ ] Scenario 4: insufficient saldo with `SQLSTATE = 'P0001'` AND `SQLERRM LIKE '%Saldo kas tidak cukup%'`
- [ ] Scenario 5: amount <= 0 raise
- [ ] Scenario 6: foreign user (RLS-equiv via WHERE user_id = v_uid → "Goal tidak ditemukan")
- [ ] Scenario 7: race serialization logical-proof (`pg_get_functiondef LIKE '%FOR UPDATE%'`)
- [ ] Scenario 8: unauthenticated → SQLSTATE 28000
- [ ] Closing `\echo` + ROLLBACK
- [ ] Target ≥ 7 PASS notices

---

### `supabase/tests/06-goal-investments-cap.sql` (NEW — pgTAP test)

**Analog:** `supabase/tests/05-tighten-rls.sql` (multi-user fixture pattern + section header style).

**Multi-user seed pattern (mirror 05:33-78):**
```sql
DO $$
DECLARE
  v_uid    UUID := '00000000-0000-0000-0000-000000000a0c';
  v_inv_id BIGINT;
  v_goal_a BIGINT;
  v_goal_b BIGINT;
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email, ...) VALUES ...;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP: cannot seed auth.users (%)', SQLERRM;
    RETURN;
  END;

  -- Seed investment + 2 goals
  INSERT INTO investments (...) VALUES (...) RETURNING id INTO v_inv_id;
  INSERT INTO goals (...) VALUES (...) RETURNING id INTO v_goal_a;
  -- ...
```

**Trigger violation assertion (mirror 04:163-172):**
```sql
-- Insert 60% — should succeed
INSERT INTO goal_investments (user_id, goal_id, investment_id, allocation_pct)
VALUES (v_uid, v_goal_a, v_inv_id, 60);
RAISE NOTICE 'PASS: first insert 60%% succeeds';

-- Insert 50% — should fail (total would be 110%)
BEGIN
  INSERT INTO goal_investments (user_id, goal_id, investment_id, allocation_pct)
  VALUES (v_uid, v_goal_b, v_inv_id, 50);
  RAISE NOTICE 'FAIL: second insert 50%% (total 110%%) did NOT raise';
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE = '23514' AND SQLERRM LIKE '%Total alokasi melebihi 100%%%' THEN
    RAISE NOTICE 'PASS: SQLSTATE 23514 raised "%".', SQLERRM;
  ELSE
    RAISE NOTICE 'FAIL: unexpected error: SQLSTATE % — %', SQLSTATE, SQLERRM;
  END IF;
END;
```

**Index existence assertion (Style A inline SELECT CASE):**
```sql
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'goal_investments'
    AND indexname = 'goal_investments_investment_idx'
)
THEN 'PASS: index goal_investments_investment_idx exists'
ELSE 'FAIL: index missing' END AS r;
```

**Compliance Checklist:**
- [ ] Section header `RAISE NOTICE 'SECTION N: ...'` style mirror 05
- [ ] Scenario 1: single insert 60% succeeds (Style B)
- [ ] Scenario 2: total > 100% raises with `SQLSTATE = '23514'` AND message contains "Total alokasi melebihi"
- [ ] Scenario 3: UPDATE existing row (exclude-self via `id IS DISTINCT FROM`) succeeds
- [ ] Scenario 4: index exists (Style A SELECT CASE + pg_indexes lookup)
- [ ] Scenario 5: race serialization logical-proof (`pg_get_functiondef('enforce_goal_investment_total()'::regprocedure) LIKE '%FOR UPDATE%'`)
- [ ] Scenario 6: trigger SECURITY DEFINER bypass RLS (regression guard untuk Phase 5)
- [ ] Closing `\echo` + ROLLBACK
- [ ] Target ≥ 6 PASS notices

---

### `src/hooks/useProcessRecurring.ts` (MOD — full rewrite)

**Analog:** `src/db/recurringTransactions.ts:138-151` (`markBillPaid` — existing TS RPC wrapper) — model for `.rpc()` invocation. **Plus** existing `useProcessRecurring.ts` skeleton (useEffect + useTargetUserId + useQueryClient).

**markBillPaid RPC wrapper pattern (mirror lines 138-151):**
```typescript
export async function markBillPaid(
  templateId: number,
  uid: string | undefined,
  paidDate: string,
): Promise<MarkBillPaidResult> {
  const { data, error } = await supabase.rpc('mark_bill_paid', {
    p_template_id: templateId,
    p_uid: uid ?? null,
    p_paid_date: paidDate,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return row as MarkBillPaidResult
}
```

> **CALLOUT — `Array.isArray(data) ? data[0] : data`.** PostgREST quirk: RETURNS TABLE returns array. `.single()` not chainable on `.rpc()`. Verbatim copy.

**Existing useProcessRecurring shell (lines 1-12 — preserve):**
```typescript
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTargetUserId } from '@/auth/useTargetUserId'
// ... [REPLACE: drop nextDueDate + listRecurringTemplates + updateRecurringTemplate + createTransaction imports]
import { supabase } from '@/lib/supabase'
import { todayISO } from '@/lib/format'
import { mapSupabaseError } from '@/lib/errors'

export function useProcessRecurring() {
  const uid = useTargetUserId()
  const qc = useQueryClient()

  useEffect(() => {
    if (!uid) return
    // ... [REPLACE body with RPC call]
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps
}
```

**Body replacement (RESEARCH.md §232-258, full skeleton):**
```typescript
useEffect(() => {
  if (!uid) return
  supabase.rpc('process_due_recurring', { p_today: todayISO(), p_uid: uid })
    .then(({ data, error }) => {
      if (error) { console.error(mapSupabaseError(error)); return }
      const row = Array.isArray(data) ? data[0] : data
      if (row?.processed_count > 0) {
        qc.invalidateQueries({ queryKey: ['transactions'] })
        qc.invalidateQueries({ queryKey: ['recurring-templates'] })
        toast.success(`${row.processed_count} transaksi rutin diproses`)
      }
    })
}, [uid]) // eslint-disable-line react-hooks/exhaustive-deps
```

> **CALLOUT — preserve `eslint-disable-line react-hooks/exhaustive-deps` comment.** Same as current line 47. `qc` ref is stable across renders, intentional omission.

> **CALLOUT — toast string `${row.processed_count} transaksi rutin diproses`** PRESERVE WORDING. CONTEXT specifics §165 — existing user-facing wording, keep stable. Toast hanya tampil saat `processed_count > 0` (D-18).

**Compliance Checklist:**
- [ ] Drop imports: `listRecurringTemplates`, `updateRecurringTemplate`, `nextDueDate`, `createTransaction`
- [ ] Add imports: `supabase` from `@/lib/supabase`, `mapSupabaseError` from `@/lib/errors`
- [ ] Keep imports: `useEffect`, `useQueryClient`, `toast`, `useTargetUserId`, `todayISO`
- [ ] Preserve `useTargetUserId()` + `useQueryClient()` hooks
- [ ] `if (!uid) return` early-return guard
- [ ] `.rpc('process_due_recurring', { p_today, p_uid })` with both params
- [ ] `Array.isArray(data) ? data[0] : data` row extraction
- [ ] `if (row?.processed_count > 0)` guard before toast (D-18)
- [ ] Invalidate `['transactions']` AND `['recurring-templates']` query keys
- [ ] Preserve toast message `"${row.processed_count} transaksi rutin diproses"`
- [ ] Preserve `eslint-disable-line react-hooks/exhaustive-deps` comment
- [ ] Final tsc clean: `npx tsc --noEmit`

---

### `src/db/recurringTransactions.ts` (MOD — delete lines 28-48)

**No analog needed** — pure deletion of `nextDueDate` function block (lines 28-48 inclusive).

**Boundary preservation:**
- Lines 1-27 (imports + types `Frequency`, `RecurringTemplate`, `RecurringTemplateInput`) — KEEP intact.
- Lines 49-152 (everything from `listRecurringTemplates` onward through `markBillPaid`) — KEEP intact.
- Lines 28-48 — DELETE entirely (the `nextDueDate` function definition).

> **CALLOUT — DO NOT delete `Frequency` type re-export.** Type masih dipakai oleh `RecurringTemplate.frequency: Frequency` (line 12) dan `RecurringTemplateInput.frequency: Frequency` (line 23). RESEARCH.md confidence section confirms grep verified.

**Task ordering (Pitfall 9 di RESEARCH.md):**
1. **FIRST** rewrite `useProcessRecurring.ts` (drops `nextDueDate` import on its line 5).
2. **THEN** delete lines 28-48 from `recurringTransactions.ts`.
3. Verify: `grep -rn "nextDueDate" src/ --include="*.ts" --include="*.tsx" | grep -v "useState(todayISO" | grep -v "setNextDueDate"` returns zero matches.
4. Verify: `npx tsc --noEmit` clean.

**Compliance Checklist:**
- [ ] Hook rewrite happens FIRST, function delete SECOND (per Pitfall 9)
- [ ] Lines 28-48 deleted exactly (boundary check before/after)
- [ ] `Frequency` type definition (line 3) PRESERVED
- [ ] `RecurringTemplate.frequency` + `RecurringTemplateInput.frequency` field types intact
- [ ] All other functions (lines 50-151) UNTOUCHED
- [ ] `markBillPaid` RPC wrapper at lines 138-151 UNTOUCHED
- [ ] Post-delete grep returns zero `nextDueDate` references in `src/` (excluding RecurringDialog local state vars)
- [ ] `npx tsc --noEmit` exits 0

---

### `src/db/goals.ts` (MOD — refactor lines 106-126)

**Analog:** `src/db/goals.ts:94-99` (`addMoneyToGoal`) — INVERSE MIRROR IN SAME FILE.

**addMoneyToGoal pattern (lines 94-99):**
```typescript
export async function addMoneyToGoal(id: number, amount: number): Promise<{ current_amount: number; status: GoalStatus }> {
  if (amount <= 0) throw new Error('Jumlah harus > 0')
  const { data, error } = await supabase.rpc('add_money_to_goal', { p_id: id, p_amount: amount })
  if (error) throw error
  return data[0] as { current_amount: number; status: GoalStatus }
}
```

**Phase 6 application — replace lines 106-126 (RESEARCH.md §425-435):**
```typescript
export async function withdrawFromGoal(
  id: number,
  amount: number,
): Promise<{ current_amount: number; status: GoalStatus }> {
  if (amount <= 0) throw new Error('Jumlah harus > 0')
  const { data, error } = await supabase.rpc('withdraw_from_goal', { p_id: id, p_amount: amount })
  if (error) throw error
  return data[0] as { current_amount: number; status: GoalStatus }
}
```

> **CALLOUT — function signature changes.** OLD: `(id, amount, goal: Goal)`. NEW: `(id, amount)`. Drop 3rd param. Drop `Goal` import dependency from this function.

> **CALLOUT — return type changes from `Promise<void>` to `Promise<{ current_amount, status }>`.** Match `addMoneyToGoal` return shape. Caller (`useWithdrawFromGoal`) accepts wider return without modification.

**Compliance Checklist:**
- [ ] Drop `goal: Goal` parameter from signature
- [ ] Body reduces to 5 lines mirroring `addMoneyToGoal` (lines 94-99)
- [ ] `.rpc('withdraw_from_goal', { p_id, p_amount })` invocation
- [ ] Return type `Promise<{ current_amount: number; status: GoalStatus }>` matches `addMoneyToGoal`
- [ ] Drop existing optimistic-lock logic (lines 112-125) entirely
- [ ] `if (amount <= 0) throw new Error('Jumlah harus > 0')` precondition kept (mirror line 95)
- [ ] No remaining usage of `goal` arg in body
- [ ] `npx tsc --noEmit` clean after

---

### `src/queries/goals.ts` (MOD — lines 79-90)

**Analog:** `src/queries/goals.ts:67-77` (`useAddMoneyToGoal`) — INVERSE MIRROR IN SAME FILE.

**useAddMoneyToGoal pattern (lines 67-77):**
```typescript
export function useAddMoneyToGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) => addMoneyToGoal(id, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Dana berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

**Phase 6 application — replace lines 79-90 (RESEARCH.md §440-451):**
```typescript
export function useWithdrawFromGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      withdrawFromGoal(id, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Dana berhasil ditarik')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

> **CALLOUT — drop `goal: Goal` from mutation input type.** Old: `{ id: number; amount: number; goal: Goal }`. New: `{ id: number; amount: number }`. Match `useAddMoneyToGoal` exactly.

> **CALLOUT — preserve toast wording `'Dana berhasil ditarik'`.** Phase 6 doesn't change UX copy.

**Compliance Checklist:**
- [ ] Mutation input type drops `goal: Goal`: `{ id: number; amount: number }`
- [ ] `mutationFn` calls `withdrawFromGoal(id, amount)` (2 args, not 3)
- [ ] `onSuccess` invalidates `['goals']` query key
- [ ] `onSuccess` toast: `'Dana berhasil ditarik'` (preserved)
- [ ] `onError`: `toast.error(mapSupabaseError(e))` (mirror Phase 5 errors.ts SQLSTATE chain)
- [ ] Body shape identical to `useAddMoneyToGoal` minus the type difference
- [ ] `npx tsc --noEmit` clean after

---

### `src/components/AddMoneyDialog.tsx` (MOD — line 50 callsite)

**Analog:** `src/components/AddMoneyDialog.tsx:47` (existing `addMoney.mutateAsync({ id, amount })`) — same file, sibling callsite.

**Existing addMoney callsite (line 47):**
```typescript
const result = await addMoney.mutateAsync({ id: goal.id, amount })
```

**Phase 6 patch — replace line 50:**
```typescript
// Before:
await withdraw.mutateAsync({ id: goal.id, amount, goal })
// After:
await withdraw.mutateAsync({ id: goal.id, amount })
```

> **CALLOUT — only line 50 changes.** Keep all surrounding code (try/catch on line 45, mode toggle, toast handling on line 53). The `addMoney` callsite on line 47 already follows the target pattern.

> **CALLOUT — `goal` variable still used elsewhere in file** (line 39 `if (!goal) return`, line 58 null check, line 61 `goal.target_amount` calculation). Don't drop `goal: Goal | null` prop.

**Compliance Checklist:**
- [ ] Single line change (line 50): drop `goal` from object literal
- [ ] All other usages of `goal` variable in component PRESERVED
- [ ] Component props type `goal: Goal | null` (line 21) unchanged
- [ ] `useWithdrawFromGoal()` import line 14 unchanged
- [ ] `npx tsc --noEmit` clean after

---

### `src/lib/errors.ts` (MOD — insert SQLSTATE branches)

**Analog:** `src/lib/errors.ts:21-26` (existing 42501 + 28000 branches added by Phase 5).

**Existing pattern (lines 19-26):**
```typescript
// SQLSTATE 42501 = insufficient_privilege — explicit "Akses ditolak" from RPC IDOR guards.
// SQLSTATE 28000 = invalid_authorization — Unauthenticated guard.
if (code === '42501' || msg === 'Akses ditolak') {
  return 'Akses ditolak'
}
if (code === '28000' || msg === 'Unauthenticated') {
  return 'Sesi habis. Silakan login ulang.'
}
```

**Phase 6 extension — insert AFTER line 26, BEFORE line 28 (the `Failed to fetch` substring branch):**
```typescript
// SQLSTATE 23514 = check_violation — RACE-02 trigger raise (Total alokasi > 100%).
// User-facing summary; detail message tetap forward dari RAISE.
if (code === '23514') {
  return 'Total alokasi investasi melebihi 100%'
}
// SQLSTATE P0001 = raise_exception — RPC user-friendly Bahasa Indonesia message
// (e.g. RACE-03 'Saldo kas tidak cukup (tersedia Rp X)').
// Forward msg apa adanya — RPC sudah bertanggung jawab atas wording.
if (code === 'P0001') {
  return msg
}
```

> **CALLOUT — INSERT POSITION CRITICAL (Pitfall 8 di RESEARCH.md).** New branches HARUS sebelum substring-match branches (line 28+). Order: `42501 → 28000 → 23514 (NEW) → P0001 (NEW) → substring branches → fallback`. Reasoning: SQLSTATE matches exact + cheap; substring matches expensive + ambiguous. Cluster all SQLSTATE first.

> **CALLOUT — PROJECT.md path is `src/lib/errors.ts`** (verified per RESEARCH live-code finding, NOT `mapSupabaseError.ts` as some upstream docs say). Function name is `mapSupabaseError`.

> **CALLOUT — comment-block style** mirrors existing 42501/28000 lines 19-20. 1-2 line explanation per branch + RPC origin.

**Compliance Checklist:**
- [ ] Insert AFTER existing 28000 branch (line 26), BEFORE substring branches (line 28+)
- [ ] 23514 branch returns hard-coded `'Total alokasi investasi melebihi 100%'` (D-20 user-facing summary)
- [ ] P0001 branch returns `msg` (RPC's verbatim Indonesian message — D-20)
- [ ] Comment block before each branch explaining SQLSTATE meaning + origin
- [ ] No reordering of existing 42501/28000/substring/fallback branches
- [ ] `npx tsc --noEmit` clean after
- [ ] `grep -n "23514\|P0001" src/lib/errors.ts` returns 2+ matches each

---

## Shared Patterns

### Auth + Access Guard (4-line block)
**Source:** `supabase/migrations/0014_mark_bill_paid.sql:62-70` + Phase 5 `0017_tighten_rls.sql:84,88` ERRCODE addition.
**Apply to:** Both `0019_process_due_recurring.sql` (full 2-guard block — has `p_uid`) and `0020_withdraw_from_goal.sql` (1-guard block only — no `p_uid`).

```sql
-- For RPCs WITH p_uid (process_due_recurring):
IF v_uid IS NULL THEN
  RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
END IF;
IF v_uid != auth.uid() AND NOT is_admin() THEN
  RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
END IF;

-- For RPCs WITHOUT p_uid (withdraw_from_goal):
IF v_uid IS NULL THEN
  RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
END IF;
```

### `FOR UPDATE` Row Lock
**Source:** `supabase/migrations/0014_mark_bill_paid.sql:72-77`.
**Apply to:** `0019` (loop over `recurring_templates`), `0020` (single goal lock), `0021` (trigger SUM subquery).

```sql
SELECT <fields> INTO v_record
FROM <table> WHERE <pk> = <param> AND user_id = v_uid
FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION '<entity> tidak ditemukan'; END IF;
```

### Idempotency Guard (write-side)
**Source:** `supabase/migrations/0014_mark_bill_paid.sql:84-91` (RAISE-on-duplicate variant) → `0019` adapts to **skip-on-duplicate** variant.
**Apply to:** `0019_process_due_recurring.sql` only.

```sql
-- 0014 variant (RAISE on duplicate — single-action API):
IF EXISTS (SELECT 1 FROM bill_payments WHERE ...) THEN
  RAISE EXCEPTION 'Tagihan sudah ditandai lunas untuk tanggal ini';
END IF;

-- 0019 variant (SKIP on duplicate — batch loop):
IF EXISTS (SELECT 1 FROM bill_payments WHERE ...) THEN
  v_skipped := v_skipped + 1;
ELSE
  -- INSERT path
END IF;
```

### GRANT EXECUTE Full-Signature Convention
**Source:** `0014_mark_bill_paid.sql:120-121` + `0017_tighten_rls.sql:156-157`.
**Apply to:** All Phase 6 RPCs (0019 + 0020). Trigger (0021) doesn't need GRANT.

```sql
GRANT EXECUTE ON FUNCTION process_due_recurring(DATE, UUID, INT)   TO authenticated;
GRANT EXECUTE ON FUNCTION withdraw_from_goal(BIGINT, NUMERIC)      TO authenticated;
```

> **CALLOUT — full signature INCLUDING DEFAULT-having params.** Postgres requires this. Phase 5 0017:156-157 demonstrates correct form for 4-arg with 3 DEFAULTs.

### COMMENT Block Style
**Source:** `0014:1-8`, `0017:1-9`, `0018:1-15`. All Phase 4+5 hardening migrations follow.
**Apply to:** 0019, 0020, 0021 first 8-15 lines.

```sql
-- ============================================================
-- <NNNN_name>: <one-line summary> (<REQ-ID>)
-- <2-3 line description: WHY, which audit finding, blast radius>
-- Pattern: mirror 0014_mark_bill_paid (SECURITY DEFINER + FOR UPDATE + idempotency).
-- <SEMANTIC NOTE block if applicable, e.g. for D-03 in 0019>
-- ============================================================
```

### pgTAP Test Preamble + Footer
**Source:** `04-mark-bill-paid.sql:1-18` + `:247-252`.
**Apply to:** All 3 test files.

```sql
-- Preamble:
-- ============================================================
-- Phase 06 Wave 1 SQL Integration Test: <feature> (<REQ-ID>)
-- Run: psql "$DATABASE_URL" -f supabase/tests/06-<feature>.sql
-- Validates migration <NNNN_*.sql> (must be applied to target DB before running).
-- Convention (mirrors 04-mark-bill-paid.sql + 05-tighten-rls.sql):
--   - BEGIN ... ROLLBACK wrapper -> no state ever persists.
--   - Output via RAISE NOTICE 'PASS:' / 'FAIL:'
-- Expected: <N> PASS notices total
-- ============================================================
BEGIN;
SET LOCAL row_security = off;

-- Footer:
\echo '============================================================'
\echo 'Phase 6 <feature> test complete. Rolling back all changes.'
\echo 'Review output above for any FAIL: lines.'
\echo 'Expected: <N> PASS notices.'
\echo '============================================================'
ROLLBACK;
```

### auth.users SEED with SKIP Fallback
**Source:** `04-mark-bill-paid.sql:88-97` + `05-tighten-rls.sql:42-52`.
**Apply to:** All 3 Phase 6 test files (each needs auth.users insertion for JWT claim simulation).

```sql
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
  VALUES (v_uid, 'phase6-test@example.local', '', NOW(), NOW(), 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP SECTION X: cannot seed auth.users (%)', SQLERRM;
  RETURN;
END;
```

### JWT Claim Switching for Test Roles
**Source:** `04-mark-bill-paid.sql:116`, `05-tighten-rls.sql:95,122,192,241`.
**Apply to:** All 3 Phase 6 test files.

```sql
SET LOCAL ROLE authenticated;
PERFORM set_config('request.jwt.claim.sub', v_uid::TEXT, true);
```

### Indonesian User-Facing Error Messages
**Source:** All Phase 4+5 migrations + `errors.ts` Phase 5 additions.
**Apply to:** All Phase 6 RPCs + trigger + tests.

| Surface | Required Indonesian Wording |
|---------|------------------------------|
| Unauthenticated | `'Unauthenticated'` (untranslated, mapped by errors.ts to `'Sesi habis. Silakan login ulang.'`) |
| Access denied | `'Akses ditolak'` |
| Insufficient saldo | `'Saldo kas tidak cukup (tersedia Rp %)'` (D-10) |
| Allocation cap | `'Total alokasi melebihi 100%% (sudah %, tambah % > 100)'` (D-13) |
| Goal not found | `'Goal tidak ditemukan'` |
| Template not found | `'Template tidak ditemukan'` |
| Amount validation | `'Jumlah harus > 0'` |

### Naming Conventions
| Layer | Pattern | Phase 6 Examples |
|-------|---------|-------------------|
| RPC functions | `verb_object_qualifier` snake_case | `process_due_recurring`, `withdraw_from_goal`, `enforce_goal_investment_total` |
| Trigger | `<table>_<topic>_check` | `goal_investments_total_check` |
| Index | `<table>_<column>_idx` | `goal_investments_investment_idx` |
| RPC params | `p_` prefix | `p_today`, `p_uid`, `p_max_iter`, `p_id`, `p_amount` |
| Local plpgsql vars | `v_` prefix | `v_uid`, `v_template`, `v_goal`, `v_total`, `v_new_amount`, `v_new_status`, `v_skipped` |

### react-query Mutation Hook Pattern
**Source:** `src/queries/goals.ts:67-77` (`useAddMoneyToGoal`) — sibling pattern.
**Apply to:** `useWithdrawFromGoal` rewrite.

```typescript
export function use<Action>() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: <InputType>) => <dbFunction>(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['<resource>'] })
      toast.success('<Indonesian success>')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

### TS RPC Wrapper Pattern
**Source:** `src/db/recurringTransactions.ts:138-151` (`markBillPaid`) + `src/db/goals.ts:94-99` (`addMoneyToGoal`).
**Apply to:** `withdrawFromGoal` rewrite.

```typescript
export async function <name>(<args>): Promise<<ReturnType>> {
  if (<precondition>) throw new Error('<Indonesian message>')
  const { data, error } = await supabase.rpc('<rpc_name>', { p_X: X, p_Y: Y })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data   // PostgREST RETURNS TABLE quirk
  return row as <ReturnType>
}
```

---

## No Analog Found

**None.** Setiap file Phase 6 punya analog yang tepat di codebase. Doctrine "konvergensi ke `mark_bill_paid`" terbukti — Phase 6 zero novel architectural decisions.

---

## Per-File Pattern Compliance Roll-Up (Quick Reference for Executor)

| File | Source Lines to Mirror | Critical Compliance Items |
|------|------------------------|----------------------------|
| `0019_process_due_recurring.sql` | 0014:1-122 (all of mark_bill_paid) | SEMANTIC NOTE block; auth+access 4-liner; FOR UPDATE on templates; bill_payments IF EXISTS; explicit user_id; full-sig GRANT |
| `0020_withdraw_from_goal.sql` | 0006:225-261 inverse + 0014:62-77 lock | NO p_uid; FOR UPDATE on goals; SQLSTATE P0001 + Indonesian saldo; status flip D-11 |
| `0021_goal_investments_total_check.sql` | 0017:38-58 trigger fn + 0006:37-47 SECURITY DEFINER | id IS DISTINCT FROM NEW.id; FOR UPDATE in SUM; SQLSTATE 23514 + `%%` escape; DROP TRIGGER IF EXISTS first |
| `06-process-due-recurring.sql` | 04:1-252 verbatim style | SKIP fallback for auth.users; income scenario (locks D-01); admin view-as scenario; `pg_get_functiondef LIKE '%FOR UPDATE%'` |
| `06-withdraw-from-goal.sql` | 04:163-172 EXCEPTION pattern | Both `SQLSTATE='P0001'` AND `SQLERRM LIKE '%Saldo kas tidak cukup%'` assertion; status flip Style B |
| `06-goal-investments-cap.sql` | 05:33-78 multi-user seed | EXCEPTION pattern asserting `SQLSTATE='23514'`; pg_indexes lookup for index existence |
| `useProcessRecurring.ts` | RPC wrapper from `markBillPaid` (recurringTransactions.ts:138-151) | Drop 4 imports, add 3; preserve `eslint-disable-line`; `Array.isArray` row extract; preserve toast wording |
| `recurringTransactions.ts` | n/a (deletion) | Delete 28-48 only; preserve type Frequency; hook rewrite first, delete second |
| `goals.ts` | `addMoneyToGoal` lines 94-99 inverse | Drop `goal: Goal` param; return type `Promise<{ current_amount, status }>`; mirror addMoneyToGoal exactly |
| `queries/goals.ts` | `useAddMoneyToGoal` lines 67-77 inverse | Drop `goal: Goal` from mutation input type; toast `'Dana berhasil ditarik'` preserved |
| `AddMoneyDialog.tsx` | self line 47 (addMoney callsite) | Single-line patch line 50 only; preserve `goal` prop usage elsewhere |
| `errors.ts` | self lines 21-26 (existing 42501/28000) | Insert AFTER 28000, BEFORE substring branches; SQLSTATE branches clustered first |

---

## Metadata

**Analog search scope:**
- `supabase/migrations/*.sql` (0001..0018, 19 files scanned)
- `supabase/tests/*.sql` (04-mark-bill-paid.sql, 05-tighten-rls.sql primary)
- `src/db/*.ts` (goals.ts, recurringTransactions.ts, transactions.ts)
- `src/queries/*.ts` (goals.ts primary)
- `src/hooks/*.ts` (useProcessRecurring.ts)
- `src/components/*.tsx` (AddMoneyDialog.tsx, LinkInvestmentDialog.tsx)
- `src/lib/*.ts` (errors.ts, format.ts)
- `src/auth/*.ts` (useTargetUserId.ts)

**Pattern extraction date:** 2026-04-28

**Key insight:** Phase 6 is **architecturally trivial** because doctrine ("konvergensi ke `mark_bill_paid`") leaves zero novel decisions. Every file has either:
- An exact analog in same-domain migration (0019 ↔ 0014, 0020 ↔ 0006:add_money, 0021 ↔ 0017:enforce_email_allowlist)
- An inverse mirror in same file (`withdrawFromGoal` ↔ `addMoneyToGoal`, `useWithdrawFromGoal` ↔ `useAddMoneyToGoal`)
- A direct sibling extension (errors.ts new branches mirror existing branches)

**Executor instruction (TL;DR):**
1. Mau bikin `0019`? Buka `0014`, copy seluruh struktur, ganti body.
2. Mau bikin `0020`? Buka `0006:225-261`, copy `add_money_to_goal`, balik operator + tambah FOR UPDATE + ganti status logic.
3. Mau bikin `0021`? Buka `0017:38-58` `enforce_email_allowlist`, copy struktur trigger function, ganti body jadi SUM check.
4. Mau bikin test? Buka `04-mark-bill-paid.sql` atau `05-tighten-rls.sql`, copy preamble + seed pattern + EXCEPTION pattern.
5. Mau refactor TS? `withdrawFromGoal` mirror `addMoneyToGoal` di file yang sama. `useWithdrawFromGoal` mirror `useAddMoneyToGoal` di file yang sama.

Tidak ada keputusan kreatif yang perlu diambil — semuanya copy-and-adapt.
