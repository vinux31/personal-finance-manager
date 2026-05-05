# Phase 6: Race & Atomicity — Research

**Researched:** 2026-04-28
**Domain:** Concurrency / atomicity / DB-side enforcement (PostgreSQL RPC + trigger patterns)
**Confidence:** HIGH (pattern terkunci ke `mark_bill_paid`; semua keputusan teknis sudah di-CONTEXT)
**Upstream:** `.planning/research/CONCURRENCY-PATTERNS.md` (cross-finding research, 2026-04-27)
**Downstream:** `gsd-planner` membaca file ini untuk membentuk 4-5 plan files

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Income Audit Trail (RACE-01)**
- **D-01:** `process_due_recurring` insert income templates (Gaji) ke tabel `bill_payments` yang sama, tidak bikin tabel baru.
- **D-02:** Idempotency guard: `IF EXISTS (SELECT 1 FROM bill_payments WHERE recurring_template_id = X AND user_id = Y AND paid_date = Z)`. Pattern identik `mark_bill_paid`.
- **D-03:** Migration 0019 wajib include comment-block yang explain semantic mismatch: `bill_payments` sekarang stores BOTH expense AND income runs.
- **D-04:** Update PROJECT.md Context section dengan 1 baris dokumentasi tabel `bill_payments`.

**Backfill Strategy (RACE-01)**
- **D-05:** No backfill. Migration 0019 tidak include `INSERT INTO bill_payments` SELECT-from-historical-transactions.
- **D-06:** Edge case "user edit template `next_due_date` mundur" = accepted risk, tidak ada defensive guard.

**DEV-01 Cleanup**
- **D-07:** Hapus function `nextDueDate` dari `src/db/recurringTransactions.ts` setelah `useProcessRecurring` di-refactor jadi RPC call. Hapus juga import di `useProcessRecurring.ts`.
- **D-08:** Zero parity test perlu. Grep verified: zero caller pasca-RACE-01 (`RecurringDialog.tsx` punya local state variable beda nama, bukan import).
- **D-09:** PG `next_due_date_sql` menjadi single source of truth untuk semua date math recurring.

**Withdraw Error Semantics (RACE-03)**
- **D-10:** RPC `withdraw_from_goal` raise `SQLSTATE 'P0001'` dengan MESSAGE: `'Saldo kas tidak cukup (tersedia Rp %)', v_goal.current_amount`.
- **D-11:** Goal status transitions: `completed` AND new_amount < target → flip ke `active`. `paused` stays `paused`. `active` stays `active`.
- **D-12:** Drop `goal: Goal` parameter dari TS `withdrawFromGoal(id, amount)`. Update callsites `AddMoneyDialog.tsx` dan `GoalsTab.tsx`.

**RACE-02 Trigger Implementation**
- **D-13:** Trigger `enforce_goal_investment_total` raise `SQLSTATE '23514'` dengan MESSAGE: `'Total alokasi melebihi 100%% (sudah %, tambah % > 100)', v_total, NEW.allocation_pct`.
- **D-14:** Trigger pakai `SECURITY DEFINER` supaya SUM bypass RLS — aman karena trigger hanya validate.
- **D-15:** Index baru: `goal_investments_investment_idx ON goal_investments(investment_id)`.
- **D-16:** Pre-deploy check: `SELECT investment_id, SUM(allocation_pct) FROM goal_investments GROUP BY investment_id HAVING SUM(allocation_pct) > 100`. Manual fix kalau ada violation.

**RPC Implementation Parameters**
- **D-17:** `process_due_recurring` parameter signature: `(p_today DATE DEFAULT CURRENT_DATE, p_uid UUID DEFAULT NULL, p_max_iter INT DEFAULT 12)`.
- **D-18:** Return type: `TABLE (processed_count INT, skipped_count INT)`. Toast hanya tampil saat `processed_count > 0`.
- **D-19:** Pattern compliance — semua RPC baru mengikuti `mark_bill_paid` template (lihat §"Existing Pattern Distillation" di bawah).

**mapSupabaseError Updates**
- **D-20:** Tambah dua branch ke `src/lib/errors.ts`:
  - SQLSTATE `23514` (check_violation) → `'Total alokasi investasi melebihi 100%'`
  - SQLSTATE `P0001` → forward `error.message` apa adanya
- **D-21:** Konsisten dengan Phase 5 yang udah tambah branch SQLSTATE 42501.

**Deploy + Verification**
- **D-22:** Migration channel: Studio SQL Editor manual paste. Numbering: `0019_process_due_recurring.sql`, `0020_withdraw_from_goal.sql`, `0021_goal_investments_total_check.sql`.
- **D-23:** pgTAP test files mandatory: `supabase/tests/06-process-due-recurring.sql`, `supabase/tests/06-withdraw-from-goal.sql`, `supabase/tests/06-goal-investments-cap.sql`.
- **D-24:** Browser-MCP UAT mandatory pre-close (Vercel auto-deploy 15-30s):
  - UAT-1: Login → buka Transaksi tab → assert Gaji bulan ini muncul tepat 1 row.
  - UAT-2: Klik "Lunas" + switch ke Transaksi tab 5x dalam 1 detik → assert no duplicate.
  - UAT-3: 2 tab simultan, link investment 60% di tab 1, link 50% di tab 2 → second click toast "Total alokasi melebihi 100%".
  - UAT-4: 2 tab simultan, withdraw Rp 50k masing-masing dari goal `current=100k` → satu sukses, satu toast "Saldo kas tidak cukup (tersedia Rp 50.000)".
  - UAT-5: Goal `completed` (current=target), withdraw Rp 1 → balance turun, status flip ke `active`.

### Claude's Discretion
- Loop body micro-optimization di `process_due_recurring` (batch INSERT vs row-by-row).
- pgTAP test naming detail (test_001, test_002 vs descriptive).
- Error message wording untuk edge case Unauthenticated (RPC standard).
- Decision auto-cap vs manual-fix kalau pre-deploy `goal_investments` violation found — defer ke executor.
- Whether to expose `process_due_recurring` debug/log columns (skipped_count breakdown by template).

### Deferred Ideas (OUT OF SCOPE)
- Rename `bill_payments` → `recurring_runs`: Punted ke v1.2 backlog.
- Layer 2 server-side enforce View-As CSV (M-03 Layer 2): Already deferred dari v1.1.
- Backfill `bill_payments` dari historical transactions: No-backfill (D-05).
- One-time UPDATE backfill `goals.status` setelah Phase 7 CONS-01 ship: Out of Phase 6 scope.
- Income recurring (Gaji) audit trail UI: Tidak ada UI display, defer.
- Goal status `completed` → `active` UX nudge toast: Cosmetic, defer.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **RACE-01** | User tidak bisa membuat duplikat transaksi rutin walaupun pencet "Lunas" lalu cepat pindah tab — `useProcessRecurring` digantikan single SQL RPC `process_due_recurring(p_today, p_uid, p_max_iter)` dengan `FOR UPDATE` lock + `bill_payments` IF EXISTS idempotency guard. Income templates (Gaji) ikut serta. | §Plan-Actionable Distillation §RACE-01 + §Existing Pattern Distillation. CONCURRENCY-PATTERNS.md §Finding C-01 (full code sample reusable). |
| **RACE-02** | Total `goal_investments.allocation_pct` per investasi tidak pernah > 100% walau dua tab race — DB BEFORE INSERT/UPDATE trigger pakai `SUM ... FOR UPDATE` set-based check. Index baru `goal_investments(investment_id)`. | §Plan-Actionable Distillation §RACE-02. CONCURRENCY-PATTERNS.md §Finding H-03 (trigger + index pattern). |
| **RACE-03** | User menarik dana dari goal via atomic RPC `withdraw_from_goal(p_id, p_amount)` (mirror pattern `add_money_to_goal`); client-side optimistic lock dihapus. | §Plan-Actionable Distillation §RACE-03. CONCURRENCY-PATTERNS.md §Finding M-02 (full code sample reusable). |
| **DEV-01** | TS function `nextDueDate` dihapus dari hot path. Auto-resolved oleh RACE-01. Tidak butuh parity test (D-08). | §Plan-Actionable Distillation §DEV-01. CONFIRMED via grep: hanya 1 import (`useProcessRecurring.ts:5`); `RecurringDialog.tsx` `nextDueDate` adalah local React state, bukan import. |

</phase_requirements>

---

<executive_summary>

## Executive Summary (½ page)

Phase 6 ships **3 PostgreSQL migrations + 1 hook rewrite + 2 TS callsite updates + 1 mapSupabaseError extension + 3 pgTAP test files** untuk mengeliminasi tiga race conditions yang teridentifikasi di audit `.planning/codebase/REVIEW-2026-04-27.md` (C-01, H-03, M-02) plus cleanup TS date math (M-04 / DEV-01).

**Apa yang ditambahkan:**

| Artifact | Type | Purpose |
|----------|------|---------|
| `0019_process_due_recurring.sql` | New RPC + DDL | Server-side loop replacing TS `useProcessRecurring`. `FOR UPDATE` row lock + `bill_payments IF EXISTS` idempotency. Handle expense + income (Gaji) seragam. |
| `0020_withdraw_from_goal.sql` | New RPC | Atomic withdraw mirror `add_money_to_goal`. `FOR UPDATE` lock + explicit `Saldo kas tidak cukup` error (SQLSTATE P0001) + auto status flip `completed`→`active`. |
| `0021_goal_investments_total_check.sql` | New trigger + index | BEFORE INSERT/UPDATE trigger SUM(allocation_pct) check + new index `goal_investments_investment_idx`. SQLSTATE 23514 raise. |
| `src/hooks/useProcessRecurring.ts` | Full rewrite | Dari 39-line client loop → 1 RPC call `supabase.rpc('process_due_recurring')`. |
| `src/db/recurringTransactions.ts` | Delete + refactor | Hapus `nextDueDate` (lines 28-48) + remove from `useProcessRecurring.ts` import line 5. |
| `src/db/goals.ts` | Refactor `withdrawFromGoal` | Drop `goal: Goal` param + body jadi 1 RPC call. Update callsites di `AddMoneyDialog.tsx` line 50 + `useWithdrawFromGoal` di `src/queries/goals.ts:82-83`. |
| `src/lib/errors.ts` | Extend | Tambah branch SQLSTATE 23514 + P0001. |
| `supabase/tests/06-*.sql` | 3 new test files | pgTAP-style integration tests, BEGIN/ROLLBACK + RAISE NOTICE PASS:/FAIL:. |

**Locked pattern: setiap RPC mirror `mark_bill_paid` (Phase 4, migration 0014).**

Ini bukan keputusan teknis baru — ini doktrin proyek sejak v1.0:
- `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`
- Auth guard 4 baris (`v_uid IS NULL` + `v_uid != auth.uid() AND NOT is_admin()`)
- `FOR UPDATE` row lock pada entitas utama (template/goal)
- Explicit `user_id = v_uid` di INSERT (jangan andalkan DEFAULT auth.uid())
- `GRANT EXECUTE ... TO authenticated`
- COMMENT block menjelaskan kenapa SECURITY DEFINER

**Code reviewer scan diff harus langsung familiar.** Kalau ada deviasi dari pattern, executor harus catat alasan di summary.

**Primary recommendation untuk planner:** Pecah jadi **5 plans dalam 2 waves**: 3 paralel di Wave 1 (RACE-01, RACE-02, RACE-03 — masing-masing isolated DB+code work), 2 sekuensial di Wave 2 (errors.ts cross-cutting + deploy/UAT verification gate). Detail rasional di §Suggested Plan Breakdown.

**Confidence: HIGH** karena (a) pattern locked dari migration 0014 yang sudah verified production di Phase 4, (b) semua keputusan teknis tertutup di CONTEXT D-01..D-24, (c) Phase 5 sudah memvalidasi Studio-paste channel + Browser-MCP UAT flow + REST/RPC HTTP testing, (d) zero novel architectural decisions di phase ini.

</executive_summary>

---

<plan_actionable_distillation>

## Plan-Actionable Distillation

Per requirement, distillation langsung untuk planner — file paths, SQL skeletons, TS skeletons, test scenario titles. Bukan menggantikan §Existing Pattern Distillation (yang menyediakan template skeleton); bagian ini menjelaskan **apa yang spesifik per requirement**.

### RACE-01 — `process_due_recurring` RPC + hook refactor

**Files to create:**
- `supabase/migrations/0019_process_due_recurring.sql` — RPC function + GRANT (~80 lines).
- `supabase/tests/06-process-due-recurring.sql` — pgTAP-style test (~150 lines).

**Files to modify:**
- `src/hooks/useProcessRecurring.ts` — full rewrite (39 lines → ~25 lines).
- `src/db/recurringTransactions.ts` — DELETE lines 28-48 (the `nextDueDate` function); also DELETE the dead `Frequency` type re-export usage if any (verify post-delete via `tsc --noEmit`).

**SQL skeleton (mirror 0014, ~70 lines body):**

```sql
-- supabase/migrations/0019_process_due_recurring.sql
-- ============================================================
-- 0019_process_due_recurring: Eliminasi race condition di useProcessRecurring (RACE-01)
-- Mirror pattern 0014_mark_bill_paid: SECURITY DEFINER + FOR UPDATE + bill_payments IF EXISTS.
--
-- SEMANTIC NOTE (D-03): bill_payments sekarang stores BOTH expense AND income runs.
-- Nama tabel kept untuk back-compat dengan mark_bill_paid + upcoming_bills_unpaid VIEW.
-- Rename ke recurring_runs jadi v1.2 backlog jika dataset/ambiguity ganggu.
-- ============================================================

CREATE OR REPLACE FUNCTION process_due_recurring(
  p_today    DATE DEFAULT CURRENT_DATE,
  p_uid      UUID DEFAULT NULL,
  p_max_iter INT  DEFAULT 12
)
RETURNS TABLE (processed_count INT, skipped_count INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := COALESCE(p_uid, auth.uid());
  v_template  RECORD;
  v_due       DATE;
  v_iter      INT;
  v_processed INT := 0;
  v_skipped   INT := 0;
  v_tx_id     BIGINT;
BEGIN
  -- Auth guard (mirror 0014:62-65)
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000'; END IF;
  -- Access guard (mirror 0014:67-70)
  IF v_uid != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  FOR v_template IN
    SELECT id, name, type, category_id, amount, note, frequency, next_due_date
    FROM recurring_templates
    WHERE user_id = v_uid AND is_active = true AND next_due_date <= p_today
    FOR UPDATE  -- serializes vs concurrent mark_bill_paid + concurrent process_due_recurring
  LOOP
    v_due := v_template.next_due_date;
    v_iter := 0;
    WHILE v_due <= p_today AND v_iter < p_max_iter LOOP
      -- Idempotency guard (mirror 0014:84-91)
      IF EXISTS (
        SELECT 1 FROM bill_payments
        WHERE recurring_template_id = v_template.id
          AND user_id = v_uid AND paid_date = v_due
      ) THEN
        v_skipped := v_skipped + 1;
      ELSE
        INSERT INTO transactions (date, type, category_id, amount, note, user_id)
        VALUES (v_due, v_template.type, v_template.category_id, v_template.amount,
                COALESCE(v_template.note, v_template.name), v_uid)
        RETURNING id INTO v_tx_id;

        -- Audit trail untuk BOTH expense + income (D-01)
        INSERT INTO bill_payments (user_id, recurring_template_id, paid_date, amount, transaction_id)
        VALUES (v_uid, v_template.id, v_due, v_template.amount, v_tx_id);

        v_processed := v_processed + 1;
      END IF;
      v_due := next_due_date_sql(v_due, v_template.frequency);
      v_iter := v_iter + 1;
    END LOOP;

    UPDATE recurring_templates SET next_due_date = v_due
    WHERE id = v_template.id AND user_id = v_uid;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_skipped;
END;
$$;

GRANT EXECUTE ON FUNCTION process_due_recurring(DATE, UUID, INT) TO authenticated;
```

**TS skeleton (full rewrite of `useProcessRecurring.ts`, ~25 lines):**

```typescript
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTargetUserId } from '@/auth/useTargetUserId'
import { supabase } from '@/lib/supabase'
import { todayISO } from '@/lib/format'
import { mapSupabaseError } from '@/lib/errors'

export function useProcessRecurring() {
  const uid = useTargetUserId()
  const qc = useQueryClient()

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
}
```

**Test file: `supabase/tests/06-process-due-recurring.sql`**

Mengikuti convention `04-mark-bill-paid.sql` (BEGIN/ROLLBACK + DO block + RAISE NOTICE PASS/FAIL). Target: minimal **8 PASS notices** (parity dengan 04-mark-bill-paid 7 PASS, plus income-specific case).

Suggested scenario titles:
1. `PASS: process_due_recurring expense template — single iteration, 1 tx + 1 bill_payment`
2. `PASS: process_due_recurring income template (Gaji) — single iteration, 1 tx (type=income) + 1 bill_payment`
3. `PASS: idempotency — second call same date returns processed_count = 0, skipped_count = 1`
4. `PASS: catch-up — template due 3 months ago, p_max_iter = 12, processes 3 iterations, advances next_due to current month`
5. `PASS: month-end clamping — template next_due_date = 2025-01-31, p_today = 2025-04-01, advances 31→28 (Feb)→28 (Mar)→28 (Apr) verified via next_due_date_sql call`
6. `PASS: access guard — non-admin caller passes p_uid of other user → SQLSTATE 42501`
7. `PASS: admin view-as — admin caller passes p_uid of non-admin → succeeds (mirror Phase 5 SEC-04 SECTION 4 pattern)`
8. `PASS: unauthenticated — JWT claim sub NULL → SQLSTATE 28000`
9. `PASS: race serialization — BEGIN tx1 with FOR UPDATE on template, BEGIN tx2 → tx2 blocks until tx1 COMMITs (verified via pg_locks query, optional)`

### RACE-02 — `enforce_goal_investment_total` trigger + index

**Files to create:**
- `supabase/migrations/0021_goal_investments_total_check.sql` — trigger function + trigger + index (~50 lines).
- `supabase/tests/06-goal-investments-cap.sql` — pgTAP-style test (~120 lines).

**Files to modify:**
- `src/lib/errors.ts` — tambah SQLSTATE 23514 branch (D-20). DEFERRED ke plan errors.ts patch (cross-cutting).
- `src/components/LinkInvestmentDialog.tsx` — sebenarnya **tidak perlu modifikasi**. Existing client-side check di lines 81-84 tetap jalan sebagai first-line defense. Trigger jadi second-line. Toast "Total alokasi melebihi 100%" otomatis muncul lewat `mapSupabaseError` ketika race-window slip terjadi. Plan executor harus VERIFY ini saat manual UAT — tidak butuh code edit.

**SQL skeleton:**

```sql
-- supabase/migrations/0021_goal_investments_total_check.sql
-- ============================================================
-- 0021_goal_investments_total_check: Cross-row allocation_pct enforcement (RACE-02)
-- BEFORE INSERT/UPDATE trigger SUM check + new index.
-- SECURITY DEFINER agar SUM bypass RLS — aman karena hanya validate (D-14).
-- Pre-deploy gate (D-16): SELECT investment_id, SUM(allocation_pct) FROM goal_investments
--                          GROUP BY 1 HAVING SUM(allocation_pct) > 100;
--   → Kalau ada row, fix manual SEBELUM apply trigger atau apply akan reject INSERT historis.
--   Karena trigger BEFORE INSERT/UPDATE, existing rows (yang tidak di-touch) tidak kena check.
--   Tapi user pertama yang touch row violating → trigger akan raise. Mitigation: fix sebelum deploy.
-- ============================================================

-- 1. Index untuk performa SUM lookup
CREATE INDEX IF NOT EXISTS goal_investments_investment_idx
  ON goal_investments(investment_id);

-- 2. Trigger function (SECURITY DEFINER for RLS bypass on SUM)
CREATE OR REPLACE FUNCTION enforce_goal_investment_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  -- Sum existing allocations untuk investment yang sama, exclude self pada UPDATE
  -- FOR UPDATE serializes concurrent INSERT/UPDATE pada investment_id sama
  SELECT COALESCE(SUM(allocation_pct), 0) INTO v_total
  FROM goal_investments
  WHERE investment_id = NEW.investment_id
    AND id IS DISTINCT FROM NEW.id
  FOR UPDATE;

  IF v_total + NEW.allocation_pct > 100 THEN
    RAISE EXCEPTION 'Total alokasi melebihi 100%% (sudah %, tambah % > 100)',
      v_total, NEW.allocation_pct USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach trigger
DROP TRIGGER IF EXISTS goal_investments_total_check ON goal_investments;
CREATE TRIGGER goal_investments_total_check
  BEFORE INSERT OR UPDATE ON goal_investments
  FOR EACH ROW EXECUTE FUNCTION enforce_goal_investment_total();
```

**Test file: `supabase/tests/06-goal-investments-cap.sql`**

Suggested scenarios (target ≥ 6 PASS):
1. `PASS: single insert 60% — succeeds, total = 60`
2. `PASS: second insert 50% (total 110%) — raises SQLSTATE 23514`
3. `PASS: update existing row to 80% (was 60%, no other rows) — succeeds, exclude-self via id IS DISTINCT FROM`
4. `PASS: index goal_investments_investment_idx exists — verify via pg_indexes`
5. `PASS: race serialization — BEGIN tx1 INSERT 60%, BEGIN tx2 INSERT 50% → tx2 blocks (verify pg_locks), then tx1 COMMIT, tx2 receives 23514`
6. `PASS: trigger respects RLS bypass — SECURITY DEFINER lets trigger SUM see all rows even if calling user has narrow RLS view (regression guard for Phase 5 RLS narrowing)`

### RACE-03 — `withdraw_from_goal` RPC + TS callsite refactor

**Files to create:**
- `supabase/migrations/0020_withdraw_from_goal.sql` — RPC function + GRANT (~50 lines).
- `supabase/tests/06-withdraw-from-goal.sql` — pgTAP-style test (~120 lines).

**Files to modify:**
- `src/db/goals.ts` — refactor `withdrawFromGoal` lines 106-126: drop `goal: Goal` param + replace body dengan RPC call (~10 lines new).
- `src/queries/goals.ts` — line 82-83: drop `goal` dari mutation input type.
- `src/components/AddMoneyDialog.tsx` — line 50: drop `goal` dari `withdraw.mutateAsync({ id, amount, goal })` call (jadi `{ id, amount }`).

**Note:** `GoalsTab.tsx` (correct path: `src/tabs/GoalsTab.tsx`) **tidak panggil `withdrawFromGoal`** — verified via grep (`withdrawFromGoal` muncul di `src/db/goals.ts` dan `src/queries/goals.ts` saja). CONTEXT.md menyebut "GoalsTab.tsx callsite" tapi ini stale dari draft research; actual callsite hanya di `AddMoneyDialog.tsx` lewat `useWithdrawFromGoal`. Planner harus document pivot ini di plan file.

**SQL skeleton:**

```sql
-- supabase/migrations/0020_withdraw_from_goal.sql
-- ============================================================
-- 0020_withdraw_from_goal: Atomic withdraw RPC (RACE-03)
-- Direct mirror dari add_money_to_goal (0006:225-261) dengan inverse logic + status flip.
-- Status transitions (D-11):
--   - completed AND new_amount < target_amount → flip ke active
--   - paused stays paused
--   - active stays active
-- Error semantics (D-10): SQLSTATE P0001 + Indonesian message dengan saldo eksplisit.
-- Forward-compatible dengan Phase 7 CONS-01 yang akan split kas vs investasi.
-- ============================================================

CREATE OR REPLACE FUNCTION withdraw_from_goal(
  p_id     BIGINT,
  p_amount NUMERIC
)
RETURNS TABLE (current_amount NUMERIC, status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_goal       RECORD;
  v_new_amount NUMERIC;
  v_new_status TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Jumlah harus > 0'; END IF;

  -- Fetch + lock the goal row (serializes concurrent withdraws)
  SELECT id, current_amount, target_amount, status INTO v_goal
  FROM goals WHERE id = p_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal tidak ditemukan';
  END IF;

  v_new_amount := v_goal.current_amount - p_amount;
  IF v_new_amount < 0 THEN
    RAISE EXCEPTION 'Saldo kas tidak cukup (tersedia Rp %)', v_goal.current_amount
      USING ERRCODE = 'P0001';
  END IF;

  -- Status transition logic (D-11)
  v_new_status := CASE
    WHEN v_goal.status = 'completed' AND v_new_amount < v_goal.target_amount THEN 'active'
    ELSE v_goal.status
  END;

  UPDATE goals
  SET current_amount = v_new_amount, status = v_new_status
  WHERE id = p_id AND user_id = v_uid;

  RETURN QUERY SELECT v_new_amount, v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION withdraw_from_goal(BIGINT, NUMERIC) TO authenticated;
```

**TS skeleton — `src/db/goals.ts:106-126` replacement:**

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

**TS — `src/queries/goals.ts:79-90` `useWithdrawFromGoal` patch (drop `goal` param):**

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

**TS — `src/components/AddMoneyDialog.tsx:50` patch:**

```typescript
// Before:
await withdraw.mutateAsync({ id: goal.id, amount, goal })
// After:
await withdraw.mutateAsync({ id: goal.id, amount })
```

**Test file: `supabase/tests/06-withdraw-from-goal.sql`**

Suggested scenarios (target ≥ 7 PASS):
1. `PASS: happy path — withdraw 30k from current=100k, current=70k, status unchanged (was active)`
2. `PASS: completed → active flip — goal target=100k current=100k status=completed, withdraw 1, current=99999 < target → status=active`
3. `PASS: paused stays paused — goal status=paused, withdraw 10k, status remains paused`
4. `PASS: insufficient funds — withdraw 60k from current=50k → SQLSTATE P0001 with message containing "Saldo kas tidak cukup"`
5. `PASS: amount <= 0 — withdraw -5k → raises (mirror precondition)`
6. `PASS: goal not owned by caller — non-admin tries withdraw goal of another user → "Goal tidak ditemukan" (RLS-equiv via WHERE user_id = v_uid)`
7. `PASS: race serialization — BEGIN tx1 lock goal, BEGIN tx2 withdraw → tx2 blocks; after tx1 COMMIT, tx2 reads new state and either succeeds or raises P0001 deterministically`
8. `PASS: unauthenticated — JWT claim sub NULL → SQLSTATE 28000`

### DEV-01 — Hapus `nextDueDate` TS

**Files to delete (in-place edit, not rm):**
- `src/db/recurringTransactions.ts` lines 28-48 — DELETE the `nextDueDate` function block.
- `src/hooks/useProcessRecurring.ts` line 5 — REMOVE `nextDueDate` from the import list (handled inline by RACE-01 rewrite).

**Verification step (mandatory in plan):** After deletion, planner harus include verifikasi:

```bash
# Should return zero matches
grep -rn "nextDueDate" src/ --include="*.ts" --include="*.tsx"

# Should compile clean
npx tsc --noEmit
```

**Note:** `RecurringDialog.tsx` line 41 (`useState(todayISO())`) declares a **local React state variable named `nextDueDate`** — `const [nextDueDate, setNextDueDate] = useState(todayISO())`. This is NOT an import of the TS function. Verified by reading the file (lines 41, 57, 65, 84, 156). Grep on import statements confirms zero non-hook callers.

DEV-01 acceptance from REQUIREMENTS.md: "TS function `nextDueDate` tidak lagi dipanggil dari `useProcessRecurring`" — auto-satisfied. Clause "snapshot test atau parity test" only triggers if TS retention needed. Per D-08, **TS deleted entirely → no parity test needed → DEV-01 auto-resolved by RACE-01 plan**.

**Recommendation:** Fold DEV-01 ke dalam RACE-01 plan sebagai final task ("Cleanup: delete nextDueDate TS function"). Tidak butuh standalone plan.

</plan_actionable_distillation>

---

<suggested_plan_breakdown>

## Suggested Plan Breakdown

Recommendation: **5 plans dalam 2 waves**. Planner punya final say.

### Wave 1 — Parallel DB+code work (3 plans)

Setiap plan isolated: 1 migration + 1 hook/RPC integration + 1 pgTAP test file. Tidak ada cross-dependency selama bekerja di file berbeda.

| Plan | Title | Files | Wave | Why parallel-safe |
|------|-------|-------|------|-------------------|
| **06-01** | RACE-01 + DEV-01 — process_due_recurring RPC + hook rewrite + TS cleanup | `0019_*.sql`, `06-process-due-recurring.sql`, `useProcessRecurring.ts` (rewrite), `recurringTransactions.ts` (delete `nextDueDate`) | 1 | Self-contained: only touches recurring path. |
| **06-02** | RACE-02 — goal_investments trigger + index | `0021_*.sql`, `06-goal-investments-cap.sql` | 1 | Pure DB-side; no TS code change required. (`LinkInvestmentDialog.tsx` existing client check sufficient as first-line defense.) |
| **06-03** | RACE-03 — withdraw_from_goal RPC + callsite refactor | `0020_*.sql`, `06-withdraw-from-goal.sql`, `goals.ts` (refactor `withdrawFromGoal`), `queries/goals.ts` (drop `goal` from mutation), `AddMoneyDialog.tsx` (line 50 callsite) | 1 | Self-contained: only touches goal withdraw path. |

**Why migration numbers 0019/0020/0021 rather than 0019/0020/0019** when plans run parallel?
- Migration files are written to disk in parallel branches BUT applied sequentially via Studio paste at deploy time (D-22).
- Number assignment is by feature, not write order. RACE-01 takes 0019, RACE-03 takes 0020, RACE-02 takes 0021. Order within Studio paste is determined at deploy time (see Pitfall §"Migration paste order" below).

**Plan size estimate:**
- 06-01: ~200 lines (longest — 80 SQL + 25 TS + 150 pgTAP + cleanup task)
- 06-02: ~120 lines (50 SQL + 120 pgTAP, no TS)
- 06-03: ~180 lines (50 SQL + 30 TS across 3 files + 120 pgTAP + 1 callsite update)

### Wave 1.5 — Cross-cutting errors.ts (1 plan, optional standalone OR fold into 06-01)

| Plan | Title | Files |
|------|-------|-------|
| **06-04** | mapSupabaseError SQLSTATE 23514 + P0001 branches | `src/lib/errors.ts` |

**Why standalone?** errors.ts is touched by both RACE-02 (23514) and RACE-03 (P0001). Splitting risk: cross-plan merge conflict on the same file. Two options:

| Option | Trade-off |
|--------|-----------|
| **A. Standalone 06-04 in Wave 1.5** | Clean — no merge conflict. Wave 1.5 sequential after Wave 1. errors.ts plan tiny (~15 lines). |
| **B. Fold into 06-01 (RACE-01 owner adds both branches)** | Saves a plan slot. Risk: 06-02 and 06-03 each verify their toast wording in UAT — if 06-01 not yet merged, UAT-3/UAT-4 toast assertions fail. |

**Recommended: Option A.** Phase 5 had similar pattern — errors.ts SQLSTATE 42501 was added in Plan 05-01 then verified deployed before Plan 05-04 deploy task ran. Following same precedent: 06-04 small standalone, runs in Wave 1.5 after Wave 1 plans merge but before Wave 2 deploy.

### Wave 2 — Deploy + UAT verification gate (1 plan)

Mirror 05-04-PLAN.md model — single deploy+UAT plan that:
1. Confirms Vercel deploy green (curl smoke kantongpintar.app + grep bundle for "23514" or "P0001").
2. Pastes 0019 → 0020 → 0021 to Supabase Studio in order (decoupled from Vercel).
3. Runs 3 pgTAP tests via psql against live cloud DB.
4. Executes 5 Browser-MCP UAT scenarios from D-24.
5. Writes `06-VERIFICATION.md` mapping all 5 ROADMAP success criteria + DEV-01 to PASS/FAIL evidence.

| Plan | Title | Files |
|------|-------|-------|
| **06-05** | Deploy + Browser-MCP UAT verification | `06-04-UAT.md` (test log) + `06-VERIFICATION.md` (verdict) |

### Total

**5 plans, 3 waves (effectively 2.5):**
- Wave 1 (parallel): 06-01, 06-02, 06-03
- Wave 1.5 (sequential): 06-04
- Wave 2 (sequential, gate): 06-05

This mirrors the Phase 5 split (4 plans, 2 waves) with one extra plan for the cross-cutting errors.ts. Acceptable scope expansion.

**Alternative (4 plans):** Fold 06-04 into 06-01 (Option B above). Saves orchestration overhead at cost of slight cross-plan dependency risk. Planner judgment.

</suggested_plan_breakdown>

---

<validation_architecture>

## Validation Architecture

> Mandatory section per Nyquist validation gate (workflow step 5.5). Phase 6 honors `nyquist_validation` enabled (default — config.json doesn't disable it).

### Test Framework

| Property | Value |
|----------|-------|
| Framework (DB) | psql + raw SQL with `RAISE NOTICE` PASS/FAIL conventions (NOT pgTAP package — project uses `BEGIN/ROLLBACK + DO block` style established in `04-mark-bill-paid.sql`) |
| Framework (TS unit) | Vitest 1.x (configured but not heavily used — see `package.json`) |
| Framework (E2E) | Browser-MCP via `mcp playwright server` (no resident Playwright installation; spec'd as "manual UAT script") |
| Quick run command | `psql "$DATABASE_URL" -f supabase/tests/06-process-due-recurring.sql` (per test file) |
| Full suite command | `for f in supabase/tests/06-*.sql; do psql "$DATABASE_URL" -f "$f"; done` |
| Phase gate | All 3 SQL test files emit zero `FAIL:` lines + 5 Browser-MCP UAT scenarios PASS + `06-VERIFICATION.md` written with all criteria GREEN |

**Per Phase 5 STATE.md decision:** REST/RPC HTTP testing > DevTools console for RLS/auth UAT. Phase 6 inherits this. UAT-3 (RACE-02 race) and UAT-4 (RACE-03 race) MUST be done via 2 actual browser tabs with separate sessions, NOT 2 console calls — race window only meaningful via real PostgREST round-trips.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Test File / Scenario | Coverage Status |
|--------|----------|-----------|----------------------|-----------------|
| RACE-01 | RPC processes due recurring atomically, idempotent on replay | pgTAP | `06-process-due-recurring.sql` scenarios 1-3 | Wave 0 gap (file doesn't exist) |
| RACE-01 | Income templates (Gaji) processed identically to expense | pgTAP | `06-process-due-recurring.sql` scenario 2 | Wave 0 gap |
| RACE-01 | Catch-up multi-month works with `p_max_iter` | pgTAP | `06-process-due-recurring.sql` scenario 4 | Wave 0 gap |
| RACE-01 | Race window vs `mark_bill_paid` serializes via `FOR UPDATE` | pgTAP | `06-process-due-recurring.sql` scenario 9 | Wave 0 gap |
| RACE-01 | UAT — Lunas → switch tab 5x, no duplicate | Browser-MCP | UAT-2 manual script | Wave 0 gap (no Playwright code) |
| RACE-01 | UAT — Gaji muncul tepat 1 row | Browser-MCP | UAT-1 manual script | Wave 0 gap |
| RACE-02 | Trigger raises 23514 when total > 100% | pgTAP | `06-goal-investments-cap.sql` scenario 2 | Wave 0 gap |
| RACE-02 | Index `goal_investments_investment_idx` exists | pgTAP | `06-goal-investments-cap.sql` scenario 4 | Wave 0 gap |
| RACE-02 | Race serialization via FOR UPDATE in trigger SUM subquery | pgTAP | `06-goal-investments-cap.sql` scenario 5 | Wave 0 gap |
| RACE-02 | UAT — 2 tabs link 60% + 50% → second tab toast | Browser-MCP | UAT-3 manual script | Wave 0 gap |
| RACE-03 | RPC withdraw atomic with FOR UPDATE | pgTAP | `06-withdraw-from-goal.sql` scenario 1 | Wave 0 gap |
| RACE-03 | Status flip completed → active | pgTAP | `06-withdraw-from-goal.sql` scenario 2 | Wave 0 gap |
| RACE-03 | SQLSTATE P0001 with explicit saldo message | pgTAP | `06-withdraw-from-goal.sql` scenario 4 | Wave 0 gap |
| RACE-03 | UAT — 2 tabs withdraw 50k each from 100k | Browser-MCP | UAT-4 manual script | Wave 0 gap |
| RACE-03 | UAT — completed goal withdraw → flip active | Browser-MCP | UAT-5 manual script | Wave 0 gap |
| DEV-01 | TS `nextDueDate` removed; tsc clean | Static | `npx tsc --noEmit` + `grep -r nextDueDate src/` | Already passes (currently 1 import to remove); auto-validated by RACE-01 plan |

### Sampling Rate Justification

Each race scenario MUST be tested **deterministically** AND **under load**:

- **Deterministic (pgTAP):** BEGIN + lock + verify SQLSTATE inside DO block. Reproducible from CI/shell.
- **Concurrent (Browser-MCP):** 2 actual browser tabs hitting PostgREST simultaneously. Captures real-world latency + react-query cache interactions + toast UX.

**Why both:** pgTAP proves the SQL logic is correct in isolation. Browser-MCP proves the SQL → PostgREST → react-query → toast pipeline correctly surfaces the race outcome to the user. Either alone is insufficient — Phase 5 caught a "DB-side fix correct, frontend toast empty" bug because UAT-1 mismatched DB-side test.

### Wave 0 Gaps

All test infrastructure gaps must be filled DURING the implementing plan (06-01/02/03), not punted to Wave 2:

- [ ] `supabase/tests/06-process-due-recurring.sql` — Wave 0 gap, created by Plan 06-01
- [ ] `supabase/tests/06-goal-investments-cap.sql` — Wave 0 gap, created by Plan 06-02
- [ ] `supabase/tests/06-withdraw-from-goal.sql` — Wave 0 gap, created by Plan 06-03
- [ ] Browser-MCP UAT scripts (`06-04-UAT.md` action steps) — Wave 0 gap, authored by Plan 06-05
- [ ] No Vitest unit tests required for Phase 6 (no parity test per D-08; RPC behavior covered by pgTAP not unit-test mockable)
- [ ] No new framework installs needed — `psql` already used in Phase 4+5; `mcp playwright` already used in Phase 5 UAT

</validation_architecture>

---

<implementation_pitfalls>

## Implementation Pitfalls + Mitigations (Phase-Specific)

### Pitfall 1: Function signature change without explicit DROP (CRITICAL — Phase 5 lesson)

**What goes wrong:** PostgreSQL keys function identity on `(name, argument_types)`. `CREATE OR REPLACE FUNCTION foo(a INT, b INT)` does NOT replace `foo(a INT)` — it creates a second overload. Phase 5's 0017 changed `aggregate_by_period` from `sql→plpgsql + p_user_id` and accidentally left the legacy 3-arg version as a SECURITY DEFINER global-aggregate IDOR vector. Required in-flight 0018 patch.

**Why it happens in Phase 6:**
- Phase 6 RPCs are NEW (`process_due_recurring`, `withdraw_from_goal`) — no existing signature to overlap. **Safe by default.**
- BUT: if any future patch ever changes the signature (e.g., adds `p_dry_run BOOLEAN` to `process_due_recurring`), the same trap awaits.

**How to avoid (planner instruction):**
- Phase 6 plans don't need explicit DROP on first deploy.
- Document at top of each migration SQL: `-- NOTE: If you ever change this signature, MUST emit DROP FUNCTION IF EXISTS ... (sig) before CREATE OR REPLACE. Phase 5 lesson.`
- Make this a code-review checklist item in `06-VERIFICATION.md`.

### Pitfall 2: `bill_payments` semantic mismatch (D-01/D-03 hazard)

**What goes wrong:** Code reviewer reads "income transaction inserted to bill_payments" and assumes bug. Files an issue. Fix gets reverted.

**Why it happens:** Naming. `bill_payments` traditionally implies expense. D-03 acknowledges the mismatch.

**How to avoid:**
- Migration 0019 SQL **MUST start** with the COMMENT block in §RACE-01 SQL skeleton. Block must be unmissable (separator ===, capital "SEMANTIC NOTE").
- Update `.planning/PROJECT.md` Context section per D-04: 1 line "`bill_payments` table audit trail untuk semua recurring runs (expense via `mark_bill_paid`, expense+income via `process_due_recurring`)".
- pgTAP test scenario 2 (income template processed) explicitly asserts `bill_payments.amount` row exists for income — locks the contract.

### Pitfall 3: View-as admin scenario for new RPCs (Phase 5 SEC-04 pattern)

**What goes wrong:** New RPC works for self-call but breaks admin View-As (admin calling with `p_uid = non-admin-uid`). Phase 5 SEC-04 specifically guarded against this with the `v_uid != auth.uid() AND NOT is_admin()` pattern.

**Why it happens:** Easy to write `IF v_uid != auth.uid() THEN RAISE ...` and forget the admin escape hatch. Or test only same-user scenario.

**How to avoid:**
- Every RPC in Phase 6 MUST use the canonical 2-line auth+access guard:
  ```sql
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000'; END IF;
  IF v_uid != auth.uid() AND NOT is_admin() THEN RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501'; END IF;
  ```
  (Same as 0014:62-70 + 0017's improved ERRCODE additions.)
- Each pgTAP test MUST include both same-user case AND admin-impersonating-user case (mirror Phase 5 `05-tighten-rls.sql` SECTION 4).
- Note for `withdraw_from_goal`: this RPC does NOT take `p_uid` parameter (per D-12 simplicity — caller is always self). So View-As scenario doesn't apply. Document in migration COMMENT: `-- No p_uid param: withdraw is always self-action; admin View-As impersonation is via JWT claim 'sub' switch in client.` This is a **deviation** from `process_due_recurring` (which has `p_uid`) — planner must flag as intentional, not oversight.

### Pitfall 4: Migration paste order in Studio (D-22 + D-16 gate)

**What goes wrong:** Executor pastes 0021 (the trigger) BEFORE running pre-deploy check D-16 (`SELECT investment_id, SUM(allocation_pct) HAVING SUM > 100`). Trigger applies. Some user with existing 110% allocation tries to ADD a new goal_investment → trigger raises 23514 unexpectedly even though they didn't cause the violation.

**Why it happens:** Plan execution mode skips the pre-deploy gate text in the rush to deploy.

**How to avoid:**
- Plan 06-05 deploy task MUST list paste order EXPLICITLY:
  1. Run D-16 pre-check query first. If violations exist, STOP. Either auto-cap (UPDATE goal_investments SET allocation_pct = ... WHERE ... — case-by-case) or escalate to user. Do not paste 0021 with violations live.
  2. Paste 0019 (no pre-deploy gate; idempotent via `CREATE OR REPLACE`).
  3. Paste 0020 (no pre-deploy gate; new function).
  4. Paste 0021 (after D-16 gate clears).
- Each migration is idempotent (`CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` + `CREATE INDEX IF NOT EXISTS`). Re-running same SQL safe.
- Order: 0019 → 0020 → 0021 mainly for review-diff cleanliness, not correctness. Trigger 0021 last is convention; functions 0019/0020 in numerical order.

### Pitfall 5: SQL-first vs code-first deploy ordering

**What goes wrong:** Deploy code first → useProcessRecurring tries to call `process_due_recurring` RPC → RPC doesn't exist yet (migration 0019 not pasted) → 30-second window of console errors + toasts.

**Or:** Deploy SQL first → migration 0019 creates RPC → existing production frontend (without rewrite) keeps using TS client loop. Old loop's `createTransaction` + `bill_payments` audit trail is missing (only `mark_bill_paid` writes there). After migration 0019 deploys, when frontend re-deploys, RPC sees mismatched state because audit trail wasn't built up. **Wait — actually NO,** because RACE-01 RPC doesn't read prior `bill_payments` to determine "has this run before?" — it only checks `paid_date = v_due` for THE specific date being processed. Existing TS-loop transactions for past dates won't have `bill_payments` rows, but RPC won't try to re-process those dates either (next_due_date already advanced past them). Verified safe.

**How to avoid:**
- **Recommended order: SQL first, then code.** SQL is purely additive (new RPCs, new trigger, new index). Old code keeps working. After SQL applies, push frontend → frontend immediately uses new RPCs.
- Plan 06-05 task sequence:
  1. Verify Vercel green for current commit (errors.ts SQLSTATE branches) — BLOCKING gate (mirror 05-04 Task 0).
  2. Paste migrations 0019, 0020, 0021 to Studio.
  3. Run pgTAP tests against cloud (first verification).
  4. Push frontend code that uses new RPCs (commit triggers Vercel auto-deploy 15-30s).
  5. Browser-MCP UAT 1-5 against deployed kantongpintar.app.
- Note: `errors.ts` SQLSTATE branches (Plan 06-04) MUST land in master + Vercel green BEFORE Wave 2 deploy task runs. Mirror Phase 5 ordering: SQLSTATE 42501 branch was in 05-01 Task 2, verified green at start of 05-04 Task 0.

### Pitfall 6: Browser-MCP UAT stale auth state

**What goes wrong:** Phase 5 UAT left admin signed in with View-As user X active. Phase 6 UAT-2 ("Lunas → switch tab") runs as admin-View-As-X, but the test fixture template was seeded for X. Result looks "passing" but doesn't exercise the real user-flow path.

**How to avoid:**
- Plan 06-05 UAT preamble MUST instruct executor: "Open kantongpintar.app in **Incognito** OR after explicit logout. Login as admin (rinoadi28@gmail.com). Do NOT use View-As for UAT-1, UAT-2, UAT-4, UAT-5. UAT-3 (race scenario) explicitly opens 2 tabs in same admin session — admin's own goals/investments."

### Pitfall 7: Vercel auto-deploy timing (per memori)

**What goes wrong:** Plan tells executor "wait 90 seconds for Vercel deploy" → executor sleeps → wastes time + creates pause where user thinks something stuck.

**How to avoid:**
- Plan 06-05 deploy task MUST cite memori `project_vercel_deploy_timing.md`: "Vercel auto-deploy from master finishes in 15-30s, NOT 90s. Use `curl -fsS -o /dev/null -w "%{http_code}\n" https://kantongpintar.app/` polling at 5s intervals max 60s."
- Plan 05-04 Task 0 has the working snippet — copy verbatim into 06-05.

### Pitfall 8: `mapSupabaseError` SQLSTATE branch order

**Live state of `src/lib/errors.ts` (verified by Read at 2026-04-28):**
- Lines 21-23: `code === '42501' || msg === 'Akses ditolak'` → 'Akses ditolak' (Phase 5)
- Lines 24-26: `code === '28000' || msg === 'Unauthenticated'` → 'Sesi habis' (Phase 5)
- Lines 28-30: `Failed to fetch / NetworkError` → connectivity message
- Lines 31-33: `JWT expired` → session message
- Lines 34-36: `violates row-level security` → 'Akses ditolak.'
- Lines 37-39: `unique constraint / duplicate key` → 'Data sudah ada'
- Lines 40-42: `foreign key` → 'Data terkait tidak ditemukan'
- Line 43: fallback `return msg`

**What goes wrong:** Plan 06-04 adds 23514 + P0001 branches but appends them AFTER the fallback `return msg` line. New branches never reached.

**How to avoid:**
- Plan 06-04 MUST instruct: insert new SQLSTATE branches BEFORE the substring-match branches (line 28+). Order: `42501 → 28000 → 23514 (NEW) → P0001 (NEW) → substring branches → fallback`.
- Reasoning: SQLSTATE matches are exact + cheap; substring matches are expensive + ambiguous. Cluster all SQLSTATE branches first.

### Pitfall 9: Deletion of `nextDueDate` and TypeScript cleanup

**What goes wrong:** Delete the function from `recurringTransactions.ts` lines 28-48 but forget to update import on line 5 of `useProcessRecurring.ts`. TypeScript compile fails: `Module '"@/db/recurringTransactions"' has no exported member 'nextDueDate'.`

**How to avoid:**
- Plan 06-01 task order: (1) rewrite `useProcessRecurring.ts` first (drops the import), (2) THEN delete `nextDueDate` from `recurringTransactions.ts`. This way `tsc --noEmit` stays green at every step.
- Final verification step: `grep -rn "nextDueDate" src/ --include="*.ts" --include="*.tsx" | grep -v "useState(todayISO" | grep -v "setNextDueDate"` should return zero matches. (Pipe-filter excludes `RecurringDialog.tsx` local state variable.)

### Pitfall 10: pgTAP test seed needs `auth.users` insert

**What goes wrong:** Test file does `INSERT INTO auth.users` directly. In restricted Supabase environments (some prod-mirror configs), this raises permission error. Phase 4 + 5 tests handled this with try/catch + `RAISE NOTICE 'SKIP SECTION X'`. Phase 6 tests must do same.

**How to avoid:**
- Copy verbatim the `SKIP ... cannot seed auth.users (...)` pattern from `04-mark-bill-paid.sql:88-97` and `05-tighten-rls.sql:42-52`. Don't reinvent.
- Local dev (Supabase CLI on port 54322) allows `INSERT INTO auth.users` — tests pass. Cloud psql via service-role connection string also allows. Restricted environments will SKIP gracefully without false-FAIL.

</implementation_pitfalls>

---

<existing_pattern_distillation>

## Existing Pattern Distillation (canonical RPC template)

Per CONTEXT D-19 + D-22, every Phase 6 RPC mirrors `mark_bill_paid` (migration 0014) structurally. Template extracted for planner copy-paste convenience:

### Function signature template

```sql
CREATE OR REPLACE FUNCTION <name>(
  <required_params>,
  p_uid UUID DEFAULT NULL    -- only if RPC supports admin View-As; omit for self-only RPCs (e.g. withdraw_from_goal)
)
RETURNS <TABLE | scalar | VOID>
LANGUAGE plpgsql
SECURITY DEFINER             -- bypass RLS deliberately; explicit user_id filter compensates
SET search_path = public     -- mandatory: prevents schema-injection via search_path manipulation
AS $$
```

### Standard auth+access guard (4-line block)

Verbatim from `0014_mark_bill_paid.sql:62-70` + Phase 5 ERRCODE additions (`0017_tighten_rls.sql:84, 88`):

```sql
IF v_uid IS NULL THEN
  RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
END IF;
IF v_uid != auth.uid() AND NOT is_admin() THEN
  RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
END IF;
```

For RPCs without `p_uid` (e.g., `withdraw_from_goal`), only the first guard applies — `auth.uid()` is the implicit subject.

### `FOR UPDATE` row lock pattern

```sql
SELECT <fields> INTO v_record
FROM <table> WHERE <pk> = <param> AND user_id = v_uid
FOR UPDATE;     -- serializes vs concurrent calls; releases at COMMIT/ROLLBACK
IF NOT FOUND THEN RAISE EXCEPTION '<entity> tidak ditemukan'; END IF;
```

### GRANT statement template

```sql
GRANT EXECUTE ON FUNCTION <name>(<full signature with default-having params>) TO authenticated;
```

**Critical:** Full signature including default-valued params. Postgres requires this. Phase 5 0017:156-157 demonstrates correct form: `GRANT EXECUTE ON FUNCTION public.aggregate_by_period(TEXT, DATE, DATE, UUID) TO authenticated;` — 4 args with DEFAULT NULL on 3 of them, all listed.

### Comment block style

```sql
-- ============================================================
-- <migration_id>: <one-line summary> (<requirement_id>)
-- <2-3 line description of WHY: which audit finding, which race, what blast radius>
-- Pattern: mirror 0014_mark_bill_paid (SECURITY DEFINER + FOR UPDATE + idempotency).
-- <SEMANTIC NOTE block if applicable, e.g. for D-03>
-- ============================================================
```

Reference: 0014:1-8 + 0017:1-8 + 0018:1-15. All three current "Phase N hardening" migrations follow this style exactly.

### Naming convention used in production

| Pattern | Examples |
|---------|----------|
| Verb_object_qualifier | `mark_bill_paid`, `add_money_to_goal`, `next_due_date_sql`, `is_admin` |
| Lowercase snake_case | All function names |
| `_sql` suffix for ports of TS helpers | `next_due_date_sql` (port of TS `nextDueDate`) |
| RPC params prefixed `p_` | `p_template_id`, `p_uid`, `p_paid_date`, `p_amount`, `p_today`, `p_max_iter` |
| Local plpgsql vars prefixed `v_` | `v_uid`, `v_template`, `v_tx_id`, `v_new_amount`, `v_total` |

Phase 6 RPCs comply: `process_due_recurring`, `withdraw_from_goal`, `enforce_goal_investment_total`. Triggers: `goal_investments_total_check`. Index: `goal_investments_investment_idx`.

</existing_pattern_distillation>

---

<test_convention_distillation>

## Test Convention Distillation

Reading `04-mark-bill-paid.sql` (256 lines, 7 PASS expected) and `05-tighten-rls.sql` (276 lines, 14 PASS expected) reveals consistent style. Phase 6 plans inherit identical conventions.

### File naming

`supabase/tests/<phase_padded>-<feature_kebab>.sql`. Phase 6:
- `supabase/tests/06-process-due-recurring.sql`
- `supabase/tests/06-withdraw-from-goal.sql`
- `supabase/tests/06-goal-investments-cap.sql`

### Standard preamble

```sql
-- ============================================================
-- Phase 06 Wave <N> SQL Integration Test: <feature> (<REQ-ID>)
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/06-<feature>.sql
-- (for local dev: psql "postgresql://postgres:postgres@localhost:54322/postgres" -f ...)
--
-- Validates migration <NNNN_*.sql> (must be applied to target DB before running).
--
-- Convention (mirrors 04-mark-bill-paid.sql + 05-tighten-rls.sql):
--   - BEGIN ... ROLLBACK wrapper -> no state ever persists.
--   - SET LOCAL row_security = off for SEEDING (superuser bypass), then
--     SET LOCAL ROLE authenticated + set_config('request.jwt.claim.sub', uid, true)
--     for ASSERTIONS that need RLS to be enforced.
--   - Output via RAISE NOTICE 'PASS:' / 'FAIL:' -- humans scan, CI greps for "FAIL:".
--
-- Expected: <N> PASS notices total
--   Section 1 (<topic>): <count>
--   Section 2 (<topic>): <count>
--   ...
-- ============================================================

BEGIN;
SET LOCAL row_security = off;
```

### PASS/FAIL output format

Two equivalent styles in use:

**Style A — inline SELECT CASE (used for parameter-free assertions):**
```sql
SELECT CASE WHEN <predicate>
       THEN 'PASS: <descriptive label>'
       ELSE 'FAIL: <descriptive label> got ' || <actual>::TEXT END AS r;
```
Reference: `04-mark-bill-paid.sql:26-56`.

**Style B — DO block + RAISE NOTICE (used when seeding + multi-step assertion):**
```sql
DO $$
DECLARE v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM <table> WHERE <criteria>;
  IF v_count = <expected> THEN
    RAISE NOTICE 'PASS: <label>';
  ELSE
    RAISE NOTICE 'FAIL: <label> — expected <X>, got %', v_count;
  END IF;
END $$;
```
Reference: `05-tighten-rls.sql:97-103`.

**Use Style A for pure SQL assertions (RACE-02 trigger output, `next_due_date_sql` parity).**
**Use Style B for multi-step scenarios (RACE-01 catch-up, RACE-03 status flip).**

### Closing footer

```sql
\echo '============================================================'
\echo 'Phase 6 <feature> test complete. Rolling back all changes.'
\echo 'Review output above for any FAIL: lines.'
\echo 'Expected: <N> PASS notices.'
\echo '============================================================'

ROLLBACK;
```

### Phase 5 test target: 14 PASS

Phase 6 doesn't have a single big consolidated test — 3 separate files. Targets per file:
- `06-process-due-recurring.sql`: 8-9 PASS (largest, covers 3 sections)
- `06-goal-investments-cap.sql`: 6 PASS
- `06-withdraw-from-goal.sql`: 7-8 PASS
- **Phase 6 total: ~21-23 PASS** (greater than Phase 5 due to feature surface)

### Race scenario test pattern (advanced)

For race serialization tests (RACE-01 scenario 9, RACE-02 scenario 5, RACE-03 scenario 7), verifying actual blocking behavior in pgTAP-style is hard within a single psql session because both transactions need to be live simultaneously.

**Pragmatic approach for Phase 6 tests:** Document the race scenario in a comment block within the test file but verify race-safety **logically** rather than empirically:

```sql
-- SCENARIO 9: Race serialization (verified by FOR UPDATE in source, not by test).
-- Empirical race verification handled by Browser-MCP UAT-2 (D-24) with 2 actual tabs.
-- This test only verifies the lock mechanism is present in the function definition:
SELECT CASE WHEN pg_get_functiondef('process_due_recurring(DATE, UUID, INT)'::regprocedure)
              LIKE '%FOR UPDATE%'
       THEN 'PASS: process_due_recurring uses FOR UPDATE row lock'
       ELSE 'FAIL: FOR UPDATE missing from function definition' END AS r;
```

This is **acceptable** — Phase 4 + 5 didn't empirically test race windows in pgTAP either (relied on Playwright/Browser-MCP for the actual concurrent verification). Phase 6 follows precedent.

</test_convention_distillation>

---

<references>

## References

### PostgreSQL official docs
- [PostgreSQL: SQL CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html) — `LANGUAGE plpgsql SECURITY DEFINER` semantics, `SET search_path` parameter
- [PostgreSQL: SELECT — The Locking Clause (FOR UPDATE)](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE) — row-level locking in `FOR UPDATE`, blocking semantics
- [PostgreSQL: CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html) — BEFORE INSERT OR UPDATE FOR EACH ROW pattern
- [PostgreSQL: GRANT](https://www.postgresql.org/docs/current/sql-grant.html) — full-signature requirement for functions with default args
- [PostgreSQL: Errors and Messages — RAISE](https://www.postgresql.org/docs/current/plpgsql-errors-and-messages.html) — `RAISE EXCEPTION USING ERRCODE = '23514'` syntax
- [PostgreSQL: Error Codes — Class 23 Integrity Constraint Violation](https://www.postgresql.org/docs/current/errcodes-appendix.html) — 23514 = check_violation (used for RACE-02), P0001 = raise_exception (used for RACE-03)

### Supabase official docs
- [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions) — RPC + SECURITY DEFINER patterns, search_path hardening
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — security_invoker views vs SECURITY DEFINER functions
- [Supabase: Postgres Triggers](https://supabase.com/docs/guides/database/postgres/triggers) — recommended trigger patterns

### Third-party (consulted in CONCURRENCY-PATTERNS.md, low priority unless executor blocked)
- [Cybertec: Triggers to enforce constraints](https://www.cybertec-postgresql.com/en/triggers-to-enforce-constraints/) — race-safe trigger SUM with `FOR UPDATE`
- [Vlad Mihalcea: PostgreSQL trigger consistency check](https://vladmihalcea.com/postgresql-trigger-consistency-check/) — supplementary
- [TheLinuxCode: PostgreSQL Triggers in 2026](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/) — perf benchmarks for insert-only triggers (~2.7% latency overhead)

### Existing project files (canonical references)
- `supabase/migrations/0014_mark_bill_paid.sql` — **THE** canonical RPC pattern. Every Phase 6 RPC mirrors this exactly.
- `supabase/migrations/0006_multi_user.sql:225-261` — `add_money_to_goal` (mirror target for `withdraw_from_goal`)
- `supabase/migrations/0017_tighten_rls.sql:84, 88` — improved `USING ERRCODE = '...'` pattern (Phase 5 added this)
- `supabase/migrations/0018_drop_legacy_aggregates.sql` — Phase 5 lesson: explicit DROP FUNCTION when signature changes
- `supabase/migrations/0015_upcoming_bills_unpaid_view.sql` — security_invoker VIEW pattern (reference for future debug)
- `supabase/tests/04-mark-bill-paid.sql` — pgTAP test convention reference
- `supabase/tests/05-tighten-rls.sql` — Phase 5 14-PASS pattern reference
- `.planning/research/CONCURRENCY-PATTERNS.md` — full upstream research with code samples + trade-offs (this RESEARCH.md is its plan-actionable distillation, not replacement)
- `.planning/phases/05-security-hardening/05-04-PLAN.md` — Wave 2 deploy+UAT plan template (model for 06-05)

### Memori references (project context)
- `project_supabase_migration_workflow.md` — Studio fallback channel (D-22)
- `project_vercel_deploy_timing.md` — 15-30s deploy timing (D-24)
- `project_v1_1_phase5_state.md` — Phase 5 lessons: explicit DROP FUNCTION + Studio fallback pattern proven
- `project_radix_tabs_unmount_behavior.md` — relevant for UAT-1 (Transaksi tab mount triggers `useProcessRecurring`)

</references>

---

<confidence_assessment>

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | **HIGH** | No new libraries. PostgreSQL 15 + Supabase + React 19 + react-query stack unchanged from Phase 5. Pattern source `mark_bill_paid` (Phase 4) production-validated. |
| RPC Architecture (RACE-01, RACE-03) | **HIGH** | Direct mirror of `mark_bill_paid` (verified by reading 0014). Code skeletons in §Plan-Actionable Distillation are derivative copies. |
| Trigger Architecture (RACE-02) | **HIGH** | Pattern endorsed by Cybertec + Vlad Mihalcea. Existing `enforce_email_allowlist` trigger (0006) demonstrates SECURITY DEFINER trigger works in this project. SUM + FOR UPDATE race-safe. |
| TS callsite refactor (RACE-03) | **HIGH** | Verified live code at 2026-04-28: only 2 callsites for `withdrawFromGoal` (db/goals.ts + queries/goals.ts). `AddMoneyDialog.tsx` line 50 is the only React-component caller. `GoalsTab.tsx` (correct path `src/tabs/GoalsTab.tsx`) does NOT call withdrawFromGoal — CONTEXT statement is stale; planner must adjust. |
| DEV-01 cleanup (`nextDueDate` removal) | **HIGH** | Grep verified 2026-04-28: 1 import (`useProcessRecurring.ts:5`), 1 definition (`recurringTransactions.ts:28-48`). `RecurringDialog.tsx` `nextDueDate` is local React state variable, not import. D-08 confirmed. |
| Pitfall: function signature change | **HIGH** | Phase 5 0017→0018 patch is documented. Lesson clear. Phase 6 doesn't trigger same hazard but risk recurs on future patches. |
| pgTAP test scope | **HIGH** | 04-mark-bill-paid + 05-tighten-rls demonstrate working convention. Race serialization tests acceptable as "logical proof + Browser-MCP empirical" per Phase 4/5 precedent. |
| Browser-MCP UAT scenarios (D-24) | **HIGH** | 5 scenarios fully specified in CONTEXT. Phase 5 UAT-1/2/3 ran similar pattern successfully via `mcp playwright`. |
| Migration paste order (D-22) | **HIGH** | Studio paste channel verified Phase 5. D-16 pre-deploy gate explicit. Reverse risk: if any user has existing 110% allocation and we forget D-16 gate. Mitigation: pre-deploy SELECT mandatory in plan. |
| `mapSupabaseError` SQLSTATE branching | **HIGH** | File read at 2026-04-28: existing branches verified. Insert position before substring branches is technically straightforward. |
| `bill_payments` semantic mismatch (D-03) | **MEDIUM-HIGH** | Decision documented + accepted. Future code reviewer confusion possible — mitigated by mandatory COMMENT block + PROJECT.md update (D-04). Long-term v1.2 rename is escape hatch. |
| Vercel auto-deploy timing | **HIGH** | Memori `project_vercel_deploy_timing.md` + Phase 5 05-04 Task 0 working snippet. |
| Goal status `paused` interaction with withdraw (D-11) | **MEDIUM** | "paused stays paused" decision is product-policy. Test scenario 3 (`06-withdraw-from-goal.sql`) locks the behavior. Edge case "user pauses goal then withdraws to negative-going" handled by `v_new_amount < 0` raise — independent of status. |
| RACE-01 race vs concurrent `mark_bill_paid` | **HIGH** | Both functions hold `FOR UPDATE` on same `recurring_templates` row → serialized. Idempotency `bill_payments IF EXISTS` guards same-date double-write. Verified by reading both function bodies. Empirically validated in Phase 4 mark_bill_paid Section 3 idempotency test. |
| Concurrent `process_due_recurring` invocations | **HIGH** | 2 tabs both calling RPC: tx1 acquires FOR UPDATE on template row, tx2 blocks until tx1 COMMITs, then tx2 reads advanced `next_due_date` and processes nothing (or different dates). UAT-2 in D-24 verifies. |
| Wave assignment (3 parallel + 1.5 sequential + 1 sequential) | **MEDIUM-HIGH** | Suggested split is reasonable but planner has discretion. Risk: errors.ts conflict between 06-02 and 06-03 if both touched simultaneously without 06-04 mediation — recommended 06-04 standalone mitigates. |

**Anything LOW that planner should investigate further:** None. All decisions tertutup di CONTEXT D-01..D-24. Open question (auto-cap vs manual-fix on pre-deploy `goal_investments` violation per D-16) only triggers IF the SELECT query returns rows — defer to executor at plan-execute time, not plan-phase time.

</confidence_assessment>

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, PostgreSQL/Supabase/React unchanged from Phase 5
- Architecture: HIGH — pattern locked to `mark_bill_paid` (canonical), three RPCs are direct mirrors
- Pitfalls: HIGH — Phase 5 lessons documented, Phase 6 hazards mapped to specific mitigations
- Test conventions: HIGH — copying verbatim from `04-mark-bill-paid.sql` + `05-tighten-rls.sql`
- Plan-actionability: HIGH — every requirement has SQL skeleton + TS skeleton + test scenario titles + file paths

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30 days for stable hardening domain) or until Phase 7 starts (whichever sooner)
**Source provenance:** All claims traceable to either (a) `[VERIFIED:` reading specific files at this session, (b) `[CITED:` `.planning/research/CONCURRENCY-PATTERNS.md` upstream research, or (c) `[VERIFIED:` `.planning/phases/06-race-atomicity/06-CONTEXT.md` user decisions D-01..D-24. Zero `[ASSUMED:` claims — all training-knowledge-only inferences flagged or eliminated.

---

*Research scope honors CONTEXT.md as locked. Pattern selection skipped per "konvergensi ke `mark_bill_paid`" doctrine. Planner consumes this file together with CONCURRENCY-PATTERNS.md (the upstream); this distillation prioritizes plan-actionability over re-debate.*
