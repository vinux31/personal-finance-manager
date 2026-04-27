# Concurrency, Race & Consistency Research — pfm-web v1.1

**Domain:** PFM web app (React 19 + Supabase Postgres + react-query)
**Researched:** 2026-04-27
**Overall confidence:** HIGH — most recommendations grounded in existing codebase patterns (`mark_bill_paid` is the canonical model)
**Downstream:** REQUIREMENTS.md + ROADMAP.md for v1.1 hardening milestone

---

## Executive Summary

Codebase sudah punya **satu pattern kanonis yang benar**: `mark_bill_paid` RPC di `0014_mark_bill_paid.sql`. Pattern ini memenuhi:

1. **Atomicity** — single SQL function, semua DML dalam 1 implicit transaction
2. **Idempotency** — `IF EXISTS (SELECT 1 FROM bill_payments WHERE ... paid_date = p_paid_date)` guard
3. **Concurrency safety** — `FOR UPDATE` row lock pada template (serialize concurrent callers)
4. **Auth correctness** — `SECURITY DEFINER` + `SET search_path = public` + explicit `is_admin()` check + `COALESCE(p_uid, auth.uid())` untuk view-as
5. **Single source of truth** — pakai `next_due_date_sql` PG function, bukan TS

**Strategi v1.1 = "konvergensi ke pattern `mark_bill_paid`":**
- C-01 → konsumsi `mark_bill_paid` dari `useProcessRecurring` (atau fork untuk income)
- M-02 → migrasi `withdrawFromGoal` ke RPC dengan signature mirip `add_money_to_goal`
- H-03 → BEFORE INSERT/UPDATE trigger untuk `goal_investments` (set-based, < 1ms overhead per insert untuk small N)
- M-03 → block UI saat View-As, bukan refactor seluruh CSV path (lower risk)

Tidak semua finding cocok dengan pattern yang sama. Beberapa lebih murah dengan **client-side discipline** (H-01 timezone, M-07 Recharts cast). Pattern selection-nya didokumentasikan per finding di bawah.

---

## Finding C-01: useProcessRecurring race vs mark_bill_paid

### Pattern recommended: **Refactor ke RPC tunggal `process_due_recurring(p_uid, p_today, p_max_iter)`**

Pattern terbaik adalah _eliminating_ jalur duplikat (TS `nextDueDate` + manual `createTransaction`). Buat satu RPC server-side yang:

1. Loop semua `recurring_templates` dengan `is_active AND next_due_date <= p_today AND user_id = v_uid` dengan `FOR UPDATE` lock
2. Untuk setiap template + setiap due date dalam window:
   - `IF EXISTS bill_payments WHERE recurring_template_id, paid_date, user_id` → skip (idempotency, sama dengan `mark_bill_paid`)
   - Insert `transactions` (income atau expense, beda dari `mark_bill_paid` yang expense-only)
   - Insert `bill_payments` (extend audit trail ke income juga — atau buat tabel paralel `recurring_runs` untuk income)
   - Advance `next_due_date` via `next_due_date_sql`
3. Return `(processed_count, skipped_count)` untuk toast

Hook `useProcessRecurring` jadi 1 baris: `await supabase.rpc('process_due_recurring', { p_today: todayISO() })`.

### Trade-offs (correctness | performance | maintainability)

- **Correctness:** HIGH. Single source of truth (PG `next_due_date_sql`), idempotency dijamin oleh `bill_payments` UNIQUE-like guard, row lock mencegah double-process saat 2 tab dibuka.
- **Performance:** NEUTRAL → marginal gain. 1 round-trip vs N+M (N templates × M iterations). Untuk Pertamina admin dengan ~10 templates, payload kecil.
- **Maintainability:** HIGH after migration; ada **transition cost** karena harus extend `bill_payments` schema atau buat `recurring_runs` tabel paralel untuk income.

### Code sample

```sql
-- supabase/migrations/0017_process_due_recurring.sql
CREATE OR REPLACE FUNCTION process_due_recurring(
  p_today    DATE DEFAULT CURRENT_DATE,
  p_uid      UUID DEFAULT NULL,
  p_max_iter INT  DEFAULT 12
)
RETURNS TABLE (processed_count INT, skipped_count INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := COALESCE(p_uid, auth.uid());
  v_template RECORD;
  v_due DATE;
  v_iter INT;
  v_processed INT := 0;
  v_skipped INT := 0;
  v_tx_id BIGINT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated'; END IF;
  IF v_uid != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  FOR v_template IN
    SELECT id, name, type, category_id, amount, note, frequency, next_due_date
    FROM recurring_templates
    WHERE user_id = v_uid AND is_active = true AND next_due_date <= p_today
    FOR UPDATE
  LOOP
    v_due := v_template.next_due_date;
    v_iter := 0;
    WHILE v_due <= p_today AND v_iter < p_max_iter LOOP
      -- Idempotency guard (mirror mark_bill_paid)
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

```ts
// src/hooks/useProcessRecurring.ts
export function useProcessRecurring() {
  const uid = useTargetUserId()
  const qc = useQueryClient()
  useEffect(() => {
    if (!uid) return
    supabase.rpc('process_due_recurring', { p_today: todayISO(), p_uid: uid })
      .then(({ data, error }) => {
        if (error) { console.error(error); return }
        const row = Array.isArray(data) ? data[0] : data
        if (row?.processed_count > 0) {
          qc.invalidateQueries({ queryKey: ['transactions'] })
          qc.invalidateQueries({ queryKey: ['recurring-templates'] })
          toast.success(`${row.processed_count} transaksi rutin diproses`)
        }
      })
  }, [uid]) // eslint-disable-line
}
```

### Integration risk + mitigation

- **Income templates (Gaji) tidak ada di `upcoming_bills_unpaid` view** → view itu filter `type = 'expense'`. Tapi `bill_payments` table itu sendiri tidak punya constraint `type` — refactor ini bisa pakai `bill_payments` untuk income juga. Risk: konseptual "bill payment" ambigu. **Mitigasi:** rename ke `recurring_runs` di schema baru, atau extend `bill_payments` dengan kolom dokumentasi (CHECK opsional `amount > 0` cukup, kolom `type` bisa di-derive dari template via JOIN). Untuk minimalisasi blast radius v1.1, tetap pakai `bill_payments` dan dokumentasikan.
- **Backfill issue:** templates yang sudah pernah di-process oleh `useProcessRecurring` (versi lama) **tidak punya `bill_payments` row** untuk historical date. RPC baru tidak akan duplikat (next_due_date sudah advance). Tapi jika user ubah `next_due_date` mundur secara manual lewat dialog Edit, RPC akan _re-create_ tx → solusi: di RPC tambah guard `IF EXISTS (SELECT 1 FROM transactions WHERE date = v_due AND category_id = v_template.category_id AND amount = v_template.amount AND user_id = v_uid)` sebagai second-line idempotency (heuristic). Atau lakukan one-time backfill `bill_payments` untuk semua `transactions` yang category-nya match recurring_templates.
- **Behavior change:** versi sekarang di-trigger oleh `useEffect` setiap kali `TransactionsTab` mount. RPC baru sama. Tapi jika user buka 3 tab simultan, 3 RPC call akan run paralel — `FOR UPDATE` mengantrikan mereka, tapi 2nd dan 3rd akan return `processed_count = 0` (sudah di-handle oleh idempotency). Pastikan toast tidak spam: `if (processed_count > 0)` guard.

### Test strategy

- **pgTAP integration test** (lanjutkan style `04-mark-bill-paid.sql`): `tests/05-process-due-recurring.sql`
  - Seed 2 templates (1 monthly bill 2026-04-01 expense, 1 monthly Gaji 2026-04-25 income), `p_today = 2026-04-27`
  - Assert: 2 transactions created, 2 bill_payments rows, both `next_due_date` advanced to 2026-05
  - Idempotency: jalankan RPC 2x → second call processed_count = 0
  - Race simulation: BEGIN tx1, lock template, BEGIN tx2 di session lain → tx2 blocks until tx1 commits
- **Playwright E2E** (lanjutkan setup E2E project):
  - Scenario: user klik "Lunas" di UpcomingBills, immediately switch ke Transaksi tab — verify hanya 1 row transaksi (bukan 2)
  - Scenario: 2 tab buka, user klik "Lunas" di tab 1, switch ke tab 2 — tidak duplikat

### References

- [PostgreSQL: Documentation 18: 37.1 Trigger Behavior](https://www.postgresql.org/docs/current/trigger-definition.html) — FOR UPDATE locking semantics
- [TanStack Query Mutations Guide](https://tanstack.com/query/v5/docs/framework/react/guides/mutations) — mutations are NOT idempotent by default
- [TanStack/query Discussion #4131 — Deduplicate identical mutations](https://github.com/TanStack/query/discussions/4131) — community pattern: idempotency token in payload
- Existing: `supabase/migrations/0014_mark_bill_paid.sql` — canonical pattern source

---

## Finding C-02: Goal cash/investasi UI vs DB consistency

### Pattern recommended: **Pilihan keputusan produk — bukan teknis murni. Pilihan recommended: View Layer Computed + Database stays cash-only**

Tiga pattern yang dievaluasi:

| Pattern | Pros | Cons |
|---------|------|------|
| **A. DB GENERATED ALWAYS AS** column `total_current` | Single source of truth | Postgres `GENERATED ALWAYS AS` STORED **tidak boleh reference tabel lain** (cross-row subquery dilarang). VIRTUAL juga tidak boleh. Tidak applicable. |
| **B. Materialized view + trigger refresh** | Akurat, query cepat | Overhead refresh; race window saat materialized view stale; complexity tinggi untuk small dataset |
| **C. View `goals_with_total` (security_invoker)** | Konsisten, tanpa storage | Tetap server-side computation tapi cheap query |
| **D. Client-side derivation, DB tetap cash-only, dokumentasikan semantik** | Simple, tidak break existing RPC | Risiko devs lain re-introduce inconsistency |
| **E. Hybrid: DB stays cash-only + non-blocking VIEW for read** | Simple add, no migration risk | Need discipline di UI (always derive, never read raw) |

**Recommended: kombinasi C + E** — tetapkan `goals.current_amount` SEBAGAI cash-only source of truth (sesuai `add_money_to_goal` saat ini), buat VIEW `goals_with_progress` untuk reads:

```sql
CREATE OR REPLACE VIEW goals_with_progress
WITH (security_invoker = true)
AS
SELECT
  g.id, g.user_id, g.name, g.target_amount, g.current_amount,
  g.target_date, g.status,
  g.current_amount AS cash_amount,
  COALESCE(SUM(
    (i.quantity * COALESCE(i.current_price, i.buy_price))
    * gi.allocation_pct / 100.0
  ), 0)::NUMERIC(15,2) AS investment_amount,
  g.current_amount + COALESCE(SUM(
    (i.quantity * COALESCE(i.current_price, i.buy_price))
    * gi.allocation_pct / 100.0
  ), 0)::NUMERIC(15,2) AS total_amount
FROM goals g
LEFT JOIN goal_investments gi ON gi.goal_id = g.id
LEFT JOIN investments i        ON i.id = gi.investment_id
GROUP BY g.id;
```

Lalu update `addMoneyToGoal` RPC untuk `completed` decision pakai `total_amount`, BUKAN cash-only:

```sql
-- Patch add_money_to_goal: gunakan total dari goals_with_progress
v_total := (SELECT total_amount FROM goals_with_progress WHERE id = p_id);
v_new_status := CASE WHEN v_total >= v_target THEN 'completed' ELSE NULL END;
```

UI behaviour:
- "Saldo kas tersedia: Rp X (terpisah dari investasi Rp Y)" di dialog Tarik Dana
- Withdraw masih cash-only (clamp `amount <= cash_amount`)
- Bar progress dan badge "Tercapai" pakai `total_amount`

### Trade-offs

- **Correctness:** HIGH untuk consistency UI vs DB. View dievaluasi at-read-time, tidak ada stale state.
- **Performance:** Subquery aggregate per goal — untuk 5-10 goals × ≤20 investments per user, sub-millisecond. Index `goal_investments(goal_id)` ada (PK BIGSERIAL otomatis indexed via UNIQUE(goal_id, investment_id)).
- **Maintainability:** MEDIUM — semantik "cash vs total" perlu didokumentasikan eksplisit di README/Panduan, dan UI labeling konsisten.

### Integration risk + mitigation

- **`add_money_to_goal` RPC change** — meningkatkan kemungkinan goal jadi `completed` lebih cepat (good). Tapi user yang punya goal "Aktif" dengan investasi sudah lewat target → setelah deploy, status bisa jadi auto-flip ke `completed` di add berikutnya. **Mitigasi:** jalankan one-time UPDATE backfill setelah deploy: `UPDATE goals SET status = 'completed' FROM goals_with_progress gp WHERE goals.id = gp.id AND gp.total_amount >= goals.target_amount AND goals.status = 'active'`
- **`withdrawFromGoal` semantic ambiguity** — user lihat 100% bar tapi dialog Tarik bilang "saldo kas Rp 0". UX harus eksplisit menjelaskan "investasi tidak bisa ditarik dari sini, jual investasi dulu di tab Investasi".

### Test strategy

- pgTAP test untuk `goals_with_progress` view: assert join logic, allocation_pct math
- E2E: create goal target 10jt, link investment 50% allocation worth 12jt → assert bar 100%, badge "Aktif" → tambah 1 rb cash → badge flip ke "Tercapai"

### References

- [PostgreSQL: Generated Columns](https://www.postgresql.org/docs/current/ddl-generated-columns.html) — VIRTUAL/STORED limitation
- [Supabase: Views with security_invoker](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS inheritance for views
- Existing: `supabase/migrations/0015_upcoming_bills_unpaid_view.sql` — VIEW pattern with `security_invoker`

---

## Finding H-01: Timezone safety

### Pattern recommended: **ESLint `no-restricted-syntax` rule + branded type optional**

Codebase sudah punya `todayISO()` di `src/lib/format.ts:31-34`. Discipline issue, bukan API issue. Cheapest enforcement:

**Layer 1 — ESLint custom rule (HIGH ROI, mandatory):**

```js
// eslint.config.js — tambah ke rules
{
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.callee.name='Date'] > Identifier[name='toISOString']",
        message: "Don't use new Date().toISOString() for dates — use todayISO() from @/lib/format (timezone-aware)",
      },
      {
        // catches: new Date().toISOString().slice(0, 10)
        selector: "CallExpression[callee.property.name='slice'][callee.object.callee.property.name='toISOString']",
        message: "Don't slice toISOString() for dates — use todayISO() from @/lib/format",
      },
    ],
  },
}
```

**Layer 2 — Branded type (MEDIUM ROI, optional):**

```ts
// src/lib/format.ts
export type WIBDateString = string & { __brand: 'WIBDate' }
export function todayISO(): WIBDateString {
  // ...
  return `${y}-${m}-${d}` as WIBDateString
}

// recurringTransactions.ts
export async function markBillPaid(
  templateId: number,
  uid: string | undefined,
  paidDate: WIBDateString,  // ← compile-error if user passes raw new Date().toISOString().slice(0,10)
): Promise<MarkBillPaidResult> { ... }
```

Branded types catch cases where user pulls raw ISO from elsewhere. Tradeoff: every callsite must pass through `todayISO()` or explicit cast — slight friction, but appropriate for a financial app.

### Trade-offs

- **Correctness:** HIGH (ESLint catches at lint time; branded type catches at compile time)
- **Performance:** ZERO runtime overhead
- **Maintainability:** HIGH — ESLint rule is self-documenting; branded type adds 5 lines

### Code sample (immediate fix for H-01)

```ts
// src/queries/investments.ts:111
import { todayISO } from '@/lib/format'
// ...
const today = todayISO()
await Promise.all(results.map(({ id, price }) => updatePrice(id, price, today)))
```

### Integration risk + mitigation

- ESLint rule added → existing violations fail CI. Run `eslint --fix` won't auto-fix; manual sweep needed. **Mitigasi:** grep all `new Date().toISOString()` first (`Grep pattern: "new Date\(\)\.toISOString"`), fix one-by-one before enabling rule.
- Branded type → opt-in per-API. Migrasi bertahap, mulai dari `markBillPaid`, `updatePrice`, `createTransaction.date`.

### Test strategy

- Unit test `todayISO()` dengan `vi.useFakeTimers()` di multiple TZ (mock `process.env.TZ` atau `Intl`).
- ESLint rule sendiri tidak butuh test — fail-fast di CI.

### References

- [TheLinuxCode: PostgreSQL Triggers in 2026](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/) — general perf considerations
- ESLint `no-restricted-syntax` docs

---

## Finding H-03: Cross-row allocation_pct enforcement

### Pattern recommended: **BEFORE INSERT/UPDATE trigger pakai SUM subquery (set-based)**

Issue spec snippet di REVIEW-2026-04-27.md (line 178-198) sudah benar. Mari validasi pattern ini.

```sql
CREATE OR REPLACE FUNCTION enforce_goal_investment_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(allocation_pct), 0) INTO v_total
  FROM goal_investments
  WHERE investment_id = NEW.investment_id
    AND id IS DISTINCT FROM NEW.id;  -- exclude self on UPDATE
  IF v_total + NEW.allocation_pct > 100 THEN
    RAISE EXCEPTION 'Total alokasi investasi melebihi 100%% (sudah %, tambah % > 100)',
      v_total, NEW.allocation_pct USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER goal_investments_total_check
  BEFORE INSERT OR UPDATE ON goal_investments
  FOR EACH ROW EXECUTE FUNCTION enforce_goal_investment_total();
```

**Note:** Use `id IS DISTINCT FROM NEW.id` instead of `id != COALESCE(NEW.id, -1)` — handles NULL.id correctly on INSERT.

### Trade-offs

- **Correctness:** HIGH. Race-safe karena trigger dijalankan dengan implicit per-statement lock pada row baru. Concurrent INSERT/UPDATE pada SAMA `investment_id` akan serial via `FOR UPDATE` semantic implicit di trigger jika dipasang explicit; tanpa explicit lock, race window theoretical exists tapi sangat sempit (microsecond) — untuk extra safety, tambah `FOR UPDATE` di SELECT subquery.
- **Performance:** Per-insert cost = 1 indexed query (jika `goal_investments(investment_id)` index ada — saat ini hanya UNIQUE(goal_id, investment_id), perlu CREATE INDEX). Untuk N rows per investment ≤ 5, sub-millisecond. Recent benchmarks (2025) menunjukkan insert-only triggers menambah ~2.7% latency, negligible.
- **Maintainability:** HIGH — pure SQL, no client-side coordination needed.

### Code sample (race-safe variant)

```sql
-- Index needed for trigger query performance
CREATE INDEX IF NOT EXISTS goal_investments_investment_idx
  ON goal_investments(investment_id);

-- Race-safe trigger with explicit row lock on existing rows
CREATE OR REPLACE FUNCTION enforce_goal_investment_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(allocation_pct), 0) INTO v_total
  FROM goal_investments
  WHERE investment_id = NEW.investment_id
    AND id IS DISTINCT FROM NEW.id
  FOR UPDATE;  -- serializes concurrent INSERT/UPDATE on same investment
  IF v_total + NEW.allocation_pct > 100 THEN
    RAISE EXCEPTION 'Total alokasi investasi melebihi 100%% (sudah %, tambah % > 100)',
      v_total, NEW.allocation_pct USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
```

### Integration risk + mitigation

- **Existing data may already violate.** Sebelum apply trigger, run `SELECT investment_id, SUM(allocation_pct) FROM goal_investments GROUP BY investment_id HAVING SUM(allocation_pct) > 100` untuk cek. Jika ada, fix manual atau auto-cap.
- **RLS interaction:** Trigger function tidak `SECURITY DEFINER` — runs as caller. Subquery to `goal_investments` akan apply RLS yang ada (`USING (true)` dari migration 0005), jadi tidak ada hidden bypass. Jika RLS dipersempit di v1.1 (mirroring fix H-04 pattern), trigger SUM mungkin miss rows dari user lain. **Mitigasi:** trigger function pakai `SECURITY DEFINER` untuk SUM bypass RLS — aman karena trigger hanya validate (no data leak ke caller).
- **Client error handling:** `LinkInvestmentDialog.tsx` saat ini pakai client check; setelah trigger ditambah, server akan throw `check_violation`. Update `mapSupabaseError` untuk recognize ERRCODE `23514` dengan pesan "Total alokasi investasi melebihi 100%%".

### Test strategy

- pgTAP: `tests/06-goal-investments-cap.sql`
  - Seed: 2 goals, 1 investment, link goal1 = 60% → expect success
  - Try link goal2 = 50% (total 110%) → expect raise check_violation
  - Try update goal1 to 80% (total 60+ that, but wait, change to 80, new total 80 alone) → ok
  - Concurrent: BEGIN tx1, INSERT 60%; tx2, INSERT 50% — second blocks/fails
- E2E: open 2 tabs, allocate 60% then 50% → second click shows "Total alokasi melebihi 100%"

### References

- [Cybertec: Triggers to enforce constraints](https://www.cybertec-postgresql.com/en/triggers-to-enforce-constraints/) — definitive guide on this exact pattern
- [Vlad Mihalcea: PostgreSQL trigger consistency check](https://vladmihalcea.com/postgresql-trigger-consistency-check/) — race-safe trigger discussion (FOR UPDATE in SELECT)
- [PostgreSQL Docs: CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html)

---

## Finding M-01: Seed atomicity

### Pattern recommended: **Single SQL function `seed_rencana(p_uid)` dengan implicit transaction + idempotency flag in DB**

Saat ini `useRencanaInit` panggil `seedRencanaGoals()` dan `seedRencanaInvestments()` secara `Promise.all` — masing-masing iterate `for (const g of toInsert) await createGoal(g)`. Idempotency hanya via `existingNames` Set client-side.

**Pattern: `seed_rencana(p_uid)` SQL function + `is_seeded` flag column ATAU `user_seed_marker` table.**

Dua sub-pattern:

**A. Marker table (recommended):**

```sql
CREATE TABLE user_seed_markers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rencana_seeded_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION seed_rencana(p_uid UUID DEFAULT NULL)
RETURNS BOOLEAN  -- true if newly seeded, false if already done
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := COALESCE(p_uid, auth.uid());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated'; END IF;
  IF v_uid != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  -- Lock the marker row; if exists with timestamp, skip
  INSERT INTO user_seed_markers (user_id) VALUES (v_uid) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM user_seed_markers WHERE user_id = v_uid AND rencana_seeded_at IS NOT NULL FOR UPDATE;
  IF FOUND THEN RETURN false; END IF;

  -- All inserts inside one implicit transaction (auto-rollback on any error)
  INSERT INTO goals (user_id, name, target_amount, current_amount, target_date, status)
  VALUES
    (v_uid, 'DP Rumah Pertama',     100000000, 0, '2027-01-01', 'active'),
    (v_uid, 'Pendidikan Anak (S1)', 118000000, 0, '2027-01-01', 'active'),
    -- ... (RENCANA_GOALS data, hard-coded di SQL)
  ON CONFLICT DO NOTHING;  -- idempotent

  -- Investments seed (similar)
  INSERT INTO investments (user_id, asset_type, ...) VALUES (...) ON CONFLICT DO NOTHING;

  UPDATE user_seed_markers SET rencana_seeded_at = now() WHERE user_id = v_uid;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION seed_rencana(UUID) TO authenticated;
```

Hook menjadi:

```ts
// src/lib/useRencanaInit.ts
export function useRencanaInit() {
  const { user } = useAuth()
  const qc = useQueryClient()
  useEffect(() => {
    if (!user?.id) return
    supabase.rpc('seed_rencana', { p_uid: user.id }).then(({ data, error }) => {
      if (!error && data === true) {
        qc.invalidateQueries({ queryKey: ['goals'] })
        qc.invalidateQueries({ queryKey: ['investments'] })
      }
    })
  }, [user?.id, qc])
}
```

**B. `is_seeded BOOLEAN` di tabel goals/investments** — sederhana tapi smudge schema dengan flag yang hanya relevan untuk seed.

### Trade-offs

- **Correctness:** HIGH — atomic (single SQL function = single tx), idempotent (marker + ON CONFLICT), survives partial failure
- **Performance:** Marginal improvement (1 RPC vs 2 client functions × N rows)
- **Maintainability:** **MEDIUM** — RENCANA_GOALS data hard-coded duplicated antara TS (`src/lib/rencanaNames.ts`, `src/db/goals.ts`) dan SQL. **Mitigasi:** generate SQL VALUES list dari single TS source via codegen, atau accept duplikasi (small list, rarely changes).

### Integration risk + mitigation

- **localStorage migration:** Existing users punya `rencana_seeded_${uid}` di localStorage. Setelah deploy v1.1, marker row di DB belum ada — RPC akan re-seed → ON CONFLICT DO NOTHING save us. **Mitigasi:** migration 0017 backfill: `INSERT INTO user_seed_markers (user_id, rencana_seeded_at) SELECT user_id, now() FROM goals WHERE name IN ('DP Rumah Pertama', ...) GROUP BY user_id`
- **Auto-fix H-02:** `localStorage.removeItem('rencana_seeded')` di SettingsTab → ganti jadi RPC `DELETE FROM user_seed_markers WHERE user_id = auth.uid()` plus DELETE goals/investments seeded. Atau dokumentasikan flag-only reset (delete marker tapi keep data).

### Test strategy

- pgTAP: seed twice → second call returns false, no duplicate rows
- pgTAP: simulate failure mid-INSERT (raise inside DO block) → assert rollback (no goals, no marker timestamp)

### References

- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- Existing: `supabase/migrations/0014_mark_bill_paid.sql` — pattern source

---

## Finding M-02: withdrawFromGoal RPC migration

### Pattern recommended: **Mirror `add_money_to_goal` exactly — RPC `withdraw_from_goal(p_id, p_amount)`**

Saat ini `withdrawFromGoal` di `src/db/goals.ts:106-126` pakai client-side optimistic lock (`.eq('current_amount', goal.current_amount)`). Optimistic lock works tapi:
1. Two-roundtrip-implied: client must read goal first, pass through state
2. Fail mode "Dana tidak cukup atau data sudah berubah" — user can't tell which
3. Inconsistent dengan add path (RPC) — code reviewers must remember this asymmetry

**Pattern:**

```sql
CREATE OR REPLACE FUNCTION withdraw_from_goal(
  p_id     BIGINT,
  p_amount NUMERIC
)
RETURNS TABLE (current_amount NUMERIC, status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_goal      RECORD;
  v_new_amount NUMERIC;
  v_new_status TEXT;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Jumlah harus > 0'; END IF;

  SELECT id, current_amount, target_amount, status INTO v_goal
  FROM goals WHERE id = p_id AND user_id = auth.uid()
  FOR UPDATE;  -- serializes concurrent withdraws

  IF NOT FOUND THEN RAISE EXCEPTION 'Goal tidak ditemukan'; END IF;

  v_new_amount := v_goal.current_amount - p_amount;
  IF v_new_amount < 0 THEN
    RAISE EXCEPTION 'Saldo kas tidak cukup (tersedia Rp%)', v_goal.current_amount
      USING ERRCODE = 'P0001';  -- or custom
  END IF;

  -- Status transitions:
  --   completed → active (if dropped below target)
  --   paused stays paused
  --   active stays active
  v_new_status := CASE
    WHEN v_goal.status = 'completed' AND v_new_amount < v_goal.target_amount THEN 'active'
    ELSE v_goal.status
  END;

  UPDATE goals
  SET current_amount = v_new_amount, status = v_new_status
  WHERE id = p_id AND user_id = auth.uid();

  RETURN QUERY SELECT v_new_amount, v_new_status;
END;
$$;
GRANT EXECUTE ON FUNCTION withdraw_from_goal(BIGINT, NUMERIC) TO authenticated;
```

```ts
// src/db/goals.ts:106-126 — replacement
export async function withdrawFromGoal(id: number, amount: number): Promise<{ current_amount: number; status: GoalStatus }> {
  if (amount <= 0) throw new Error('Jumlah harus > 0')
  const { data, error } = await supabase.rpc('withdraw_from_goal', { p_id: id, p_amount: amount })
  if (error) throw error
  return data[0] as { current_amount: number; status: GoalStatus }
}
```

### Trade-offs

- **Correctness:** HIGH (FOR UPDATE eliminates optimistic lock failure mode)
- **Performance:** Slight improvement (single round-trip vs read+update with lock check)
- **Maintainability:** HIGH — pattern symmetric dengan add path

### Integration risk + mitigation

- **Callers must drop the `goal: Goal` parameter** — `AddMoneyDialog.tsx:73-74` and `GoalsTab.tsx:121-125`. Easy refactor.
- **Error message changes** — currently "Dana tidak cukup atau data sudah berubah", new RPC says "Saldo kas tidak cukup (tersedia Rp X)". Better UX.
- **Combine with C-02 fix** — saat goal punya investasi linked, withdraw dari _kas_ saja makes sense (investment tidak bisa di-withdraw via dialog ini). RPC error message harus jelas: "Saldo kas tidak cukup; investasi tidak bisa ditarik dari sini".

### Test strategy

- pgTAP: happy path, completed → active transition, paused tetap paused, insufficient funds raise
- E2E: 2 tab buka, klik withdraw 50 di tab 1 dan 60 di tab 2 secara bersamaan (current = 100) → satu success, satu error

### References

- Existing: `add_money_to_goal` in `supabase/migrations/0006_multi_user.sql:225-261`

---

## Finding M-03: View-As mode CSV import

### Pattern recommended: **UI block + RPC dengan p_user_id (defense in depth)**

Two-layer approach:

**Layer 1 (immediate, low risk):** UI disable Impor button saat View-As active.

```tsx
// TransactionsTab.tsx, InvestmentsTab.tsx
const { viewingAs } = useViewAsContext()
// ...
<Button disabled={viewingAs !== null} onClick={handleImport}>
  {viewingAs ? 'Impor (nonaktif saat View-As)' : 'Impor CSV'}
</Button>
```

**Layer 2 (proper fix, higher trust):** server-side enforce.

```sql
CREATE OR REPLACE FUNCTION import_transactions_bulk(
  p_rows JSONB,  -- array of {date, type, category_id, amount, note}
  p_uid  UUID DEFAULT NULL
)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := COALESCE(p_uid, auth.uid());
  v_count INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated'; END IF;
  IF v_uid != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;
  INSERT INTO transactions (date, type, category_id, amount, note, user_id)
  SELECT (r->>'date')::DATE, r->>'type', (r->>'category_id')::BIGINT,
         (r->>'amount')::NUMERIC, r->>'note', v_uid
  FROM jsonb_array_elements(p_rows) AS r;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
```

```ts
// src/db/csvTransactions.ts:78
const { data, error } = await supabase.rpc('import_transactions_bulk', {
  p_rows: valid,
  p_uid: uid,  // pass from useTargetUserId() at call site
})
```

### Trade-offs

- **Correctness:** Layer 1 alone fixes the immediate bug (admin can't accidentally pollute own data). Layer 2 enables future "import as user X" admin operations cleanly.
- **Performance:** Layer 1 zero. Layer 2 marginal improvement (single bulk insert vs `from('transactions').insert(valid)` already bulk).
- **Maintainability:** Layer 1 = 1-line fix. Layer 2 = new RPC + refactor csvTransactions.ts AND csvInvestments.ts.

### Integration risk + mitigation

- **v1.1 scope question:** Layer 1 mandatory; Layer 2 nice-to-have. Recommend Layer 1 only unless time allows.
- **Pattern alignment:** RPC pattern aligns with `mark_bill_paid` (explicit `user_id = v_uid` in INSERT, not relying on DEFAULT auth.uid()). Comment in `0014_mark_bill_paid.sql:94-95` explicitly notes this.

### Test strategy

- E2E: admin login, switch to View-As user X, navigate to Transaksi tab — Impor button disabled with tooltip
- (If Layer 2) E2E: admin View-As user X, RPC import — verify rows appear under user X, not admin

### References

- [Supabase Securing Your API](https://supabase.com/docs/guides/api/securing-your-api)

---

## Finding M-04: Client-DB function parity (nextDueDate)

### Pattern recommended: **Eliminate via C-01 fix (single SQL source) — fallback: snapshot test**

Best long-term solution = **kill the duplicate**. C-01 refactor menghilangkan TS `nextDueDate` dari hot path; jika tetap ada untuk preview/UI hint, treat as DB-mirror only.

Jika kedua implementasi tetap diperlukan (e.g., TS untuk preview "Tagihan berikutnya: 28 Feb 2026" tanpa round-trip), gunakan **parity test** di Vitest:

```ts
// src/db/recurringTransactions.parity.test.ts
import { nextDueDate } from './recurringTransactions'
import { supabase } from '@/lib/supabase'

const cases: Array<[string, 'monthly' | 'weekly' | 'daily' | 'yearly', string]> = [
  ['2025-01-15', 'monthly', '2025-02-15'],
  ['2025-01-31', 'monthly', '2025-02-28'],  // FOUND-01
  ['2024-01-31', 'monthly', '2024-02-29'],  // leap
  ['2025-03-31', 'monthly', '2025-04-30'],
  ['2025-02-28', 'monthly', '2025-03-28'],
  ['2025-02-14', 'weekly',  '2025-02-21'],
  ['2025-12-31', 'daily',   '2026-01-01'],
  ['2025-06-15', 'yearly',  '2026-06-15'],
]

describe.each(cases)('nextDueDate parity %s %s', (input, freq, expected) => {
  it('matches TS implementation', () => {
    expect(nextDueDate(input, freq)).toBe(expected)
  })
  it('matches PG implementation', async () => {
    const { data } = await supabase.rpc('next_due_date_sql', { p_current: input, p_freq: freq })
    expect(data).toBe(expected)
  })
})
```

CI menjalankan ini terhadap local Supabase (via `supabase db start` step). Test **fail jika divergen**.

### Trade-offs

- **Correctness:** HIGH — parity guaranteed at CI time
- **Performance:** N/A (test only)
- **Maintainability:** Test list duplicates pgTAP test cases. Ada DRY violation tapi small list.

### Integration risk + mitigation

- **CI requires Supabase running** — already pgTAP test exists; CI workflow needs `supabase db start` step. **Mitigasi:** if CI doesn't have Supabase, skip parity test in CI but run lokal via `pnpm test:parity` script.
- **Eliminating TS nextDueDate** — preferred path; only blockers are UI preview hints (could swap to optimistic display "~next month" without exact date).

### Test strategy

- See above — `parity.test.ts` is the strategy itself

### References

- [Vitest fixtures](https://vitest.dev/api/expect.html#tobe)
- pgTAP test exists at `supabase/tests/04-mark-bill-paid.sql:24-65`

---

## Finding M-07: Recharts label type-safety

### Pattern recommended: **Use Recharts' `PieLabelRenderProps` type + cast through `unknown`**

Recharts v3 exports `PieLabelRenderProps` from `recharts` — but the runtime payload includes `payload` field with original data. Issue is the type definition is incomplete (per recharts/recharts#2372 still open as of 2026).

Two approaches:

**A. Type-safe with explicit shape:**

```tsx
import type { PieLabelRenderProps } from 'recharts'

interface CategoryDatum {
  category: string
  total: number
}

const renderLabel = (props: PieLabelRenderProps & { payload?: CategoryDatum }) =>
  props.payload?.category ?? ''

// Usage
<Pie
  data={data}
  dataKey="total"
  nameKey="category"
  label={renderLabel}
/>
```

**B. Drop custom label, use built-in `nameKey`:**

```tsx
<Pie
  data={data}
  dataKey="total"
  nameKey="category"
  label  // boolean → uses nameKey automatically
/>
```

Recommended: **B for simplicity unless custom format needed.** A documented if format truly custom.

### Trade-offs

- **Correctness:** B = HIGH (uses official prop). A = HIGH but tied to internal payload shape.
- **Performance:** Identical
- **Maintainability:** B requires zero maintenance on Recharts upgrade. A requires re-checking on major version bumps.

### Integration risk + mitigation

- **Visual change:** B uses default styling; if current cast version was rendering differently, B may shift label style. Verify visual match before merge.
- **Recharts v4+ outlook:** issue 2372 unresolved → assume continued imperfection in label types. Branded interface cast through `unknown` is acceptable: `as unknown as PieLabelRenderProps & { payload: CategoryDatum }`.

### Test strategy

- Visual regression (Playwright screenshot) on ReportsTab pie chart
- TS `tsc --noEmit` — should not error on `as unknown as ...` pattern

### References

- [recharts/recharts#2372 — TypeScript errors with Pie label prop](https://github.com/recharts/recharts/issues/2372)
- [recharts/recharts#5223 — Types for Custom Label props](https://github.com/recharts/recharts/discussions/5223)
- [Recharts API: Label](https://recharts.github.io/en-US/api/Label/)

---

## Cross-cutting Recommendations

### Bundling strategy

**Recommend: 3 phases, NOT 1 monolithic milestone.**

| Phase | Findings | Theme | Deploy risk |
|-------|----------|-------|------------|
| **v1.1.0 — Race + Atomicity** | C-01, M-02, H-03 | DB writes converge to RPC pattern | MEDIUM — new RPCs, backfill needed for `bill_payments` |
| **v1.1.1 — UI/Data Consistency** | C-02, M-01, M-03 (Layer 1) | Read-side correctness, seed | LOW — additive view + UI gating |
| **v1.1.2 — Dev Hygiene** | H-01, M-04, M-07 | ESLint, parity test, type cleanup | LOW — no DB changes |

Rationale:
- v1.1.0 has the highest-blast-radius DB changes — isolate so rollback is meaningful
- v1.1.1 builds on v1.1.0 (M-02 already shipped, allows clean C-02 status logic)
- v1.1.2 is non-blocking polish

### Migration order (within v1.1.0)

```
0017_process_due_recurring.sql        — C-01 RPC
0018_withdraw_from_goal.sql           — M-02 RPC
0019_goal_investments_total_check.sql — H-03 trigger + index
0020_user_seed_markers.sql            — M-01 setup (safe to deploy early)
0021_seed_rencana.sql                 — M-01 RPC
0022_goals_with_progress_view.sql     — C-02 view
0023_add_money_to_goal_v2.sql         — C-02 update existing RPC to use view
0024_aggregate_admin_check.sql        — H-06 (separate finding) — auth tightening
0025_tighten_rls.sql                  — H-04 (separate finding) — auth tightening
```

### Downgrade plan

Each migration must include `-- DOWNGRADE` comment block. For DDL:
- New table → `DROP TABLE IF EXISTS user_seed_markers;`
- New RPC → `DROP FUNCTION IF EXISTS process_due_recurring(...);`
- New trigger → `DROP TRIGGER IF EXISTS goal_investments_total_check ON goal_investments;`
- Modified RPC (e.g., `add_money_to_goal_v2`) → keep old version under `add_money_to_goal_v1` name for 1 release; switch back via `ALTER FUNCTION` if rollback needed.

For data backfills (e.g., `user_seed_markers` populated from existing goals): include reverse INSERT-from-snapshot if downgrade triggered; document at top of migration file.

If RPC fails production data (e.g., `process_due_recurring` produces unexpected duplicates due to edge case): revert by `DROP FUNCTION` + redeploy old `useProcessRecurring` hook in app code. Hot-fix path = 5 minutes.

### E2E test approach

**Mandatory Playwright scenarios for v1.1:**

1. **Recurring race (C-01):**
   - Login, fixture: 1 monthly bill due 2026-04-01
   - Open 2 tabs: tab1 = UpcomingBills, tab2 = TransactionsTab
   - Tab1 click "Lunas" + immediately tab2 refocus
   - Assert: only 1 transaction exists for 2026-04-01

2. **Withdraw race (M-02):**
   - Goal `current_amount = 100000`
   - Two parallel API calls `withdraw_from_goal(p_amount: 60000)`
   - Assert: only one succeeds, other gets "Saldo tidak cukup"; final `current_amount = 40000`

3. **Goal status with investment (C-02):**
   - Goal target 10jt, link investment 60% × 18jt = 10.8jt
   - Click "Tambah Dana" Rp 1
   - Assert: status flips to "Tercapai" (was "Aktif")

4. **Allocation cap (H-03):**
   - Allocate goal A = 60%, then attempt goal B = 50%
   - Assert: error "Total alokasi melebihi 100%"

5. **View-As CSV (M-03):**
   - Admin login → View-As user X → Transaksi tab
   - Assert: Impor button disabled with tooltip

6. **Seed atomicity (M-01):**
   - Login fresh user → assert 5 goals + 5 investments seeded
   - Reload page → assert no duplicate seed (RPC returns false)

**pgTAP tests (mandatory, in `supabase/tests/`):**
- `05-process-due-recurring.sql`
- `06-withdraw-from-goal.sql`
- `07-goal-investments-cap.sql`
- `08-seed-rencana.sql`
- `09-goals-with-progress.sql`

CI workflow harus run pgTAP setiap PR (existing `04-mark-bill-paid.sql` proves this is set up — extend it).

### Quality gate summary

- [x] Setiap rekomendasi ada trade-off trinity (correctness/performance/maintainability)
- [x] Reference Postgres docs (CREATE TRIGGER, GENERATED ALWAYS AS limitation)
- [x] Reference TanStack Query (mutation idempotency, deduplication)
- [x] Reference Supabase RPC patterns (SECURITY DEFINER + search_path + admin check)
- [x] Integration risk + mitigation per finding
- [x] Migration ordering + downgrade plan
- [x] Test strategy (pgTAP + Playwright per finding)
- [x] Income recurring (Gaji) integration risk addressed di C-01

---

## Confidence Assessment

| Finding | Pattern Confidence | Reason |
|---------|---------------------|--------|
| C-01 | HIGH | Mirrors proven `mark_bill_paid` pattern; only novel piece is income loop |
| C-02 | MEDIUM-HIGH | View pattern proven (0015 `upcoming_bills_unpaid`); decision is product-semantic, technical clear |
| H-01 | HIGH | ESLint patterns standard; branded type optional with low cost |
| H-03 | HIGH | Cybertec article + Vlad Mihalcea blog both endorse this exact pattern; benchmarks confirm low overhead |
| M-01 | HIGH | Marker table pattern standard for "run-once-per-user" semantics |
| M-02 | HIGH | Direct mirror of `add_money_to_goal` |
| M-03 | HIGH (Layer 1) / MEDIUM (Layer 2) | UI block trivial; RPC layer 2 is project-scope decision |
| M-04 | MEDIUM | Parity test viable; long-term elimination preferred via C-01 |
| M-07 | HIGH | Documented Recharts type quirks; option B is canonical |

---

## Sources

- [PostgreSQL: Documentation 18: Trigger Behavior](https://www.postgresql.org/docs/current/trigger-definition.html)
- [PostgreSQL: Generated Columns](https://www.postgresql.org/docs/current/ddl-generated-columns.html)
- [PostgreSQL: CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html)
- [Cybertec: Triggers to enforce constraints](https://www.cybertec-postgresql.com/en/triggers-to-enforce-constraints/)
- [Vlad Mihalcea: PostgreSQL trigger consistency check](https://vladmihalcea.com/postgresql-trigger-consistency-check/)
- [TheLinuxCode: PostgreSQL Triggers in 2026](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase: Securing Your API](https://supabase.com/docs/guides/api/securing-your-api)
- [TanStack Query: Mutations Guide](https://tanstack.com/query/v5/docs/framework/react/guides/mutations)
- [TanStack/query Discussion #4131 — Deduplicate identical mutations](https://github.com/TanStack/query/discussions/4131)
- [TanStack/query Discussion #608 — Deduplicate requests](https://github.com/TanStack/query/discussions/608)
- [recharts/recharts#2372 — TypeScript errors with Pie label prop](https://github.com/recharts/recharts/issues/2372)
- [recharts/recharts Discussion #5223 — Types for Custom Label props](https://github.com/recharts/recharts/discussions/5223)
- [Blog Entrostat: Supabase RLS Functions Security Definers](https://blog.entrostat.com/supabase-rls-functions/)

Existing codebase references:
- `supabase/migrations/0014_mark_bill_paid.sql` (canonical pattern source)
- `supabase/migrations/0015_upcoming_bills_unpaid_view.sql` (security_invoker view pattern)
- `supabase/migrations/0006_multi_user.sql:225-261` (`add_money_to_goal` mirror target for M-02)
- `supabase/tests/04-mark-bill-paid.sql` (pgTAP test style)
- `src/lib/format.ts:31-34` (`todayISO` source-of-truth helper)
