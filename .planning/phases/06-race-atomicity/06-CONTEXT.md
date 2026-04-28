# Phase 6: Race & Atomicity - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminasi race condition di tiga write-path utama dengan konvergensi ke pattern kanonis `mark_bill_paid`:

1. **RACE-01** — Replace TS `useProcessRecurring` loop dengan single SQL RPC `process_due_recurring(p_today, p_uid, p_max_iter)`. `FOR UPDATE` row lock pada `recurring_templates` + `bill_payments` IF EXISTS idempotency. Income templates (Gaji) handled bersama expense.
2. **RACE-02** — BEFORE INSERT/UPDATE trigger pada `goal_investments` mencegah `SUM(allocation_pct) > 100` per investasi. Index baru `goal_investments_investment_idx`.
3. **RACE-03** — Replace client-side optimistic lock di `withdrawFromGoal` dengan atomic RPC `withdraw_from_goal(p_id, p_amount)` (mirror `add_money_to_goal`). `FOR UPDATE` row lock + explicit error.
4. **DEV-01** — Hapus TS `nextDueDate` dari `src/db/recurringTransactions.ts` (zero caller post-RACE-01). PG `next_due_date_sql` jadi single source of truth.

**Migrations:** `0019_process_due_recurring.sql`, `0020_withdraw_from_goal.sql`, `0021_goal_investments_total_check.sql` (renumbered +1 dari plan awal karena Phase 5 menggunakan slot 0017+0018).

**Defensive only.** Zero user-facing behavior change kecuali pesan error lebih jelas. Tidak menambah fitur baru.

</domain>

<decisions>
## Implementation Decisions

### Income Audit Trail (RACE-01)
- **D-01:** `process_due_recurring` insert income templates (Gaji) ke tabel **`bill_payments` yang sama**, tidak bikin tabel baru.
- **D-02:** Idempotency guard: `IF EXISTS (SELECT 1 FROM bill_payments WHERE recurring_template_id = X AND user_id = Y AND paid_date = Z)`. Pattern identik `mark_bill_paid` — single source of truth untuk "did this template run on this date?", race-safe lewat shared row lock.
- **D-03:** Migration 0019 wajib include comment-block yang explain semantic mismatch: `bill_payments` sekarang stores BOTH expense AND income runs. Nama tabel kept untuk back-compat dengan Phase 4 RPC + `upcoming_bills_unpaid` VIEW. Rename ke `recurring_runs` jadi v1.2 backlog kalau dataset/ambiguity ganggu.
- **D-04:** Update PROJECT.md Context section dengan 1 baris yang dokumentasikan: "`bill_payments` table audit trail untuk semua recurring runs (expense via `mark_bill_paid`, expense+income via `process_due_recurring`)".

### Backfill Strategy (RACE-01)
- **D-05:** **No backfill.** Migration 0019 tidak include `INSERT INTO bill_payments` SELECT-from-historical-transactions. Trust integrity dari `next_due_date` advance — RPC tidak akan duplikat selama next_due_date ≥ today.
- **D-06:** Edge case "user edit template `next_due_date` mundur" = accepted risk. Behavior aneh, defensive guard tidak worth complexity. Catat di SUMMARY post-execution kalau ada user lapor.

### DEV-01 Cleanup
- **D-07:** Hapus function `nextDueDate` dari `src/db/recurringTransactions.ts` setelah `useProcessRecurring` di-refactor jadi RPC call. Hapus juga import statement di `useProcessRecurring.ts`.
- **D-08:** **Zero parity test perlu.** Grep verified: zero caller pasca-RACE-01 (`RecurringDialog.tsx` punya local state variable beda nama, bukan import). REQUIREMENTS.md DEV-01 satisfied karena clause "jika ada penggunaan TS date math yang tersisa" tidak triggered.
- **D-09:** PG `next_due_date_sql` menjadi single source of truth untuk semua date math recurring.

### Withdraw Error Semantics (RACE-03)
- **D-10:** RPC `withdraw_from_goal` raise `SQLSTATE 'P0001'` dengan MESSAGE: `'Saldo kas tidak cukup (tersedia Rp %)', v_goal.current_amount`. Forward-compatible dengan Phase 7 CONS-01 yang akan split kas vs investasi.
- **D-11:** Goal status transitions: `completed` AND new_amount < target → flip ke `active`. `paused` stays `paused`. `active` stays `active`. Match research recommendation.
- **D-12:** Drop `goal: Goal` parameter dari TS `withdrawFromGoal(id, amount)`. RPC fetch + lock sendiri. Update callsites `AddMoneyDialog.tsx` dan `GoalsTab.tsx`.

### RACE-02 Trigger Implementation
- **D-13:** Trigger `enforce_goal_investment_total` raise `SQLSTATE '23514'` (check_violation) dengan MESSAGE detail: `'Total alokasi melebihi 100%% (sudah %, tambah % > 100)', v_total, NEW.allocation_pct`. Memberi user actionable info (existing total + input mereka).
- **D-14:** Trigger pakai `SECURITY DEFINER` supaya SUM bypass RLS — aman karena trigger hanya validate (no data leak ke caller). Mitigasi RLS narrowing future-proof.
- **D-15:** Index baru: `goal_investments_investment_idx ON goal_investments(investment_id)`. Naming match existing `transactions_date_idx` convention.
- **D-16:** Pre-deploy check: `SELECT investment_id, SUM(allocation_pct) FROM goal_investments GROUP BY investment_id HAVING SUM(allocation_pct) > 100`. Kalau ada row yang sudah violate, fix manual SEBELUM apply trigger (atau auto-cap dengan UPDATE — keputusan ditahan ke planner kalau violation ditemukan saat plan-phase).

### RPC Implementation Parameters
- **D-17:** `process_due_recurring` parameter signature: `(p_today DATE DEFAULT CURRENT_DATE, p_uid UUID DEFAULT NULL, p_max_iter INT DEFAULT 12)`.
- **D-18:** Return type: `TABLE (processed_count INT, skipped_count INT)`. Toast hanya tampil saat `processed_count > 0`.
- **D-19:** Pattern compliance — semua RPC baru mengikuti `mark_bill_paid` template:
  - `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`
  - Auth guard: `IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated'; END IF;`
  - Access guard: `IF v_uid != auth.uid() AND NOT is_admin() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;`
  - Explicit `user_id = v_uid` di INSERT (jangan rely pada DEFAULT auth.uid())
  - `GRANT EXECUTE ON FUNCTION ... TO authenticated`

### mapSupabaseError Updates
- **D-20:** Tambah dua branch baru ke `src/lib/mapSupabaseError.ts`:
  - SQLSTATE `23514` (check_violation) → `'Total alokasi investasi melebihi 100%'` (toast user-facing summary; detail tetap dari RPC RAISE).
  - SQLSTATE `P0001` → forward `error.message` apa adanya (RPC sudah RAISE dengan pesan user-friendly Bahasa Indonesia).
- **D-21:** Konsisten dengan Phase 5 yang udah tambah branch SQLSTATE 42501 (`Akses ditolak`).

### Deploy + Verification (carry-forward dari Phase 5)
- **D-22:** Migration channel: **Studio SQL Editor manual paste** (memori `project_supabase_migration_workflow.md` — `db push` rusak, `migration repair` broken). Dokumentasikan paste-order di plan.
- **D-23:** pgTAP test files mandatory: `supabase/tests/06-process-due-recurring.sql`, `supabase/tests/06-withdraw-from-goal.sql`, `supabase/tests/06-goal-investments-cap.sql`. Convention: `BEGIN/ROLLBACK` + `RAISE NOTICE PASS:/FAIL:` (Phase 5 pattern).
- **D-24:** Browser-MCP UAT mandatory pre-close (Vercel auto-deploy 15-30s per memori `project_vercel_deploy_timing.md`):
  - UAT-1: Login → buka Transaksi tab → assert Gaji bulan ini muncul tepat 1 row (income recurring works).
  - UAT-2: Klik "Lunas" pada UpcomingBillsPanel → switch ke Transaksi tab 5x dalam 1 detik → assert no duplicate (RACE-01).
  - UAT-3: 2 tab simultan, link investment 60% di tab 1, link 50% di tab 2 → second click toast "Total alokasi melebihi 100%" (RACE-02).
  - UAT-4: 2 tab simultan, withdraw Rp 50k masing-masing dari goal `current=100k` → satu sukses, satu toast "Saldo kas tidak cukup (tersedia Rp 50.000)" (RACE-03).
  - UAT-5: Goal `completed` (current=target), withdraw Rp 1 → balance turun, status flip ke `active` (RACE-03).

### Claude's Discretion
- Loop body micro-optimization di `process_due_recurring` (e.g., batch INSERT vs row-by-row).
- pgTAP test naming detail (e.g., test_001, test_002 vs descriptive).
- Error message wording untuk edge case Unauthenticated (RPC standard).
- Decision auto-cap vs manual-fix kalau pre-deploy `goal_investments` violation found — defer ke executor saat plan-phase research.
- Whether to expose `process_due_recurring` debug/log columns (skipped_count breakdown by template).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pattern source (mandatory read)
- `supabase/migrations/0014_mark_bill_paid.sql` — canonical pattern: SECURITY DEFINER + search_path + COALESCE(p_uid, auth.uid()) + is_admin() guard + FOR UPDATE row lock + IF EXISTS idempotency. **All Phase 6 RPCs mirror this exactly.**
- `supabase/migrations/0006_multi_user.sql` §`add_money_to_goal` (lines ~225-261) — direct mirror target untuk `withdraw_from_goal`. Pelajari status transition logic.
- `supabase/migrations/0015_upcoming_bills_unpaid_view.sql` — security_invoker VIEW pattern, half-open window `[start, +1 month)` semantics. Reference kalau VIEW perlu untuk debug.
- `supabase/migrations/0017_tighten_rls.sql` + `0018_drop_legacy_aggregates.sql` — Phase 5 RLS hardening + lesson "DROP FUNCTION explicit saat signature change".

### Research (mandatory read)
- `.planning/research/CONCURRENCY-PATTERNS.md` — Full research dengan code samples, trade-offs, integration risk + mitigation per finding. Section relevant: C-01 (RACE-01), H-03 (RACE-02), M-02 (RACE-03), M-04 (DEV-01).
- `.planning/codebase/REVIEW-2026-04-27.md` — Audit findings yang motivate Phase 6. Bagian C-01, H-03, M-02, M-04.

### Requirements
- `.planning/REQUIREMENTS.md` §"Race Conditions & Atomicity" — RACE-01..03 + DEV-01 acceptance criteria verbatim.
- `.planning/ROADMAP.md` §"Phase 6: Race & Atomicity" — Goal + 5 success criteria yang harus pass sebelum verdict.

### Project guards
- `.planning/PROJECT.md` §"Constraints" — RLS mandatory, Indonesian copy, mobile-responsive, production verify-before-close.
- `.planning/STATE.md` §"Decisions (v1.1 execution-time, post-Phase-5)" — migration numbering shift +1, Studio fallback de-facto channel, REST/RPC HTTP testing > DevTools console.

### Existing code (callsites yang akan disentuh)
- `src/hooks/useProcessRecurring.ts` — full file rewrite jadi 1 RPC call.
- `src/db/recurringTransactions.ts` — hapus `nextDueDate` function (lines 28-48).
- `src/db/goals.ts` — refactor `withdrawFromGoal` jadi RPC call, drop `goal: Goal` parameter (lines 106-126).
- `src/components/AddMoneyDialog.tsx` — update callsite (drop goal param dari withdrawFromGoal).
- `src/components/GoalsTab.tsx` — update callsite (drop goal param dari withdrawFromGoal).
- `src/components/LinkInvestmentDialog.tsx` — error path baru untuk SQLSTATE 23514 (mapSupabaseError handle).
- `src/lib/mapSupabaseError.ts` — tambah branch SQLSTATE 23514 + P0001.
- `src/lib/format.ts` §`todayISO()` — confirm masih di-export, dipakai oleh `useProcessRecurring` invocation.

### Test infra
- `supabase/tests/04-mark-bill-paid.sql` — pgTAP test style reference. Phase 6 tests follow same convention.
- `supabase/tests/05-tighten-rls.sql` — Phase 5 test reference, 14 PASS pattern.

### External docs (low priority unless executor blocked)
- [PostgreSQL: CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html)
- [Cybertec: Triggers to enforce constraints](https://www.cybertec-postgresql.com/en/triggers-to-enforce-constraints/) — race-safe trigger pattern
- [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`mark_bill_paid` RPC** (migration 0014) — canonical template untuk SEMUA RPC baru di Phase 6. Copy struktur, ganti nama + body. Tidak perlu reinvent SECURITY DEFINER + auth guard pattern.
- **`next_due_date_sql` PG function** (migration 0014) — sudah handle FOUND-01 month-end clamping (31 Jan → 28/29 Feb). Re-use as-is di `process_due_recurring`. **Jangan** port ulang.
- **`is_admin()` SECURITY DEFINER function** (migration 0006) — view-as guard sudah verified di Phase 5. Pakai langsung di Phase 6 access guards.
- **`add_money_to_goal` RPC** (migration 0006) — direct mirror untuk `withdraw_from_goal`. Status transition logic ada di sana untuk dipelajari.
- **`bill_payments` table** (migration 0013) — schema sudah siap untuk income runs. `transaction_id` nullable + ON DELETE SET NULL. Tidak perlu schema change.
- **`useTargetUserId()` hook** — already returns admin's view-as target. Lewatkan ke `p_uid` parameter.
- **`todayISO()` helper** (`src/lib/format.ts`) — WIB-aware date string. Pakai untuk `p_today` parameter dari client.

### Established Patterns
- **Migration channel:** Studio SQL Editor manual paste — `db push` rusak. Plan harus include explicit "paste this SQL ke Studio" step, bukan asumsi `db push`.
- **pgTAP convention:** `BEGIN/ROLLBACK` + `RAISE NOTICE PASS:/FAIL:` — Phase 4+5 sudah pakai. Phase 6 tests ikuti.
- **Optimistic mutation rollback:** First di Phase 4 untuk mark_bill_paid. Phase 6 RPC calls bisa pakai pattern sama untuk UX instant + safe rollback.
- **Production UAT pre-close:** Browser-MCP terhadap Vercel deploy + REST/RPC HTTP test terhadap Supabase Cloud. Memori `project_vercel_deploy_timing.md`: deploy selesai 15-30s, jangan wait 90s.
- **mapSupabaseError SQLSTATE branching:** Phase 5 udah ada cabang 42501. Phase 6 tambah 23514 + P0001 — konsisten.
- **Indonesia copy:** Semua pesan error user-facing dalam Bahasa Indonesia (`Saldo kas tidak cukup`, `Total alokasi melebihi 100%`, `Akses ditolak`).
- **Plan handoff convention:** Plans 06-01..06-NN, masing-masing single-file commit, Wave-based execution.

### Integration Points
- **Vercel auto-deploy** dari `master` — setelah commit + push, frontend deploy 15-30s. Migration deploy manual via Studio (decoupled).
- **`upcoming_bills_unpaid` VIEW** (`security_invoker = true`) tetap filter `type = 'expense'`. Income (Gaji) tidak muncul di UpcomingBillsPanel — itu by-design untuk display side. Process side (Phase 6) handle keduanya.
- **`AddMoneyDialog` + `GoalsTab` callsite** — refactor TS `withdrawFromGoal` API breaking change tapi internal-only. Risk LOW.

### Race Window Reference
- `mark_bill_paid` (existing) ↔ `process_due_recurring` (new) compete on same `recurring_templates` row via `FOR UPDATE`. PostgreSQL serialize → tidak ada double-write. Idempotency `bill_payments IF EXISTS` covers post-lock-release replay.

</code_context>

<specifics>
## Specific Ideas

- "Konvergensi ke pattern `mark_bill_paid`" — frase dari research. Setiap RPC baru harus visually structurally similar dengan `0014_mark_bill_paid.sql`. Code reviewer scan diff harus langsung familiar, bukan reinventing.
- Toast Bahasa Indonesia: "X transaksi rutin diproses" untuk `process_due_recurring` (existing wording dari `useProcessRecurring`, preserve).
- Withdraw dialog UX direction (akan di-improve di Phase 7 CONS-01): pesan error udah forward-compatible mention "kas". User Phase 6 langsung tau ini cash-only.
- Migration order saat deploy: 0019 → 0020 → 0021 (idempotent each, but order makes review diff cleaner).

</specifics>

<deferred>
## Deferred Ideas

- **Rename `bill_payments` → `recurring_runs`**: Punted ke v1.2 backlog. Trigger: kalau dataset growth atau code reviewer kebingungan dengan semantic mismatch.
- **Layer 2 server-side enforce View-As CSV (M-03 Layer 2)**: Already deferred dari v1.1 (UI block layer 1 di Phase 7 sufficient untuk reported issue).
- **Backfill `bill_payments` dari historical transactions**: Decided no-backfill (D-05). Kalau user lapor edge case, file sebagai v1.2.
- **One-time UPDATE backfill `goals.status` setelah Phase 7 CONS-01 ship** (`add_money_to_goal_v2`): Out of Phase 6 scope, akan di-handle di Phase 7 CONS-01 plan.
- **Income recurring (Gaji) audit trail UI**: Tidak ada UI yang display `bill_payments` untuk income. UpcomingBillsPanel filter expense only. Kalau user ingin "history runs" view, defer.
- **Goal status `completed` → `active` UX nudge** (toast "Goal X balance turun di bawah target"): Cosmetic, defer.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 6 scope (verified via `gsd-tools todo match-phase 6`).

</deferred>

---

*Phase: 06-race-atomicity*
*Context gathered: 2026-04-28*
