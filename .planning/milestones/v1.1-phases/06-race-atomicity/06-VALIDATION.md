---
phase: 6
slug: race-atomicity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `.planning/phases/06-race-atomicity/06-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (DB)** | psql + raw SQL with `RAISE NOTICE` PASS/FAIL conventions (project style — `BEGIN/ROLLBACK + DO block`, established in `supabase/tests/04-mark-bill-paid.sql` and `05-tighten-rls.sql`. NOT pgTAP package.) |
| **Framework (TS unit)** | Vitest 1.x (configured but not heavily used — no Phase 6 unit tests required per D-08) |
| **Framework (E2E)** | Browser-MCP via `mcp playwright` server (no resident Playwright install; spec'd as manual UAT script per `06-04-UAT.md` model dari Phase 5) |
| **Config file** | `vitest.config.ts` (TS), no separate config for SQL tests (psql + env `DATABASE_URL`) |
| **Quick run command** | `psql "$DATABASE_URL" -f supabase/tests/06-process-due-recurring.sql` (per test file) |
| **Full suite command** | `for f in supabase/tests/06-*.sql; do echo "=== $f ==="; psql "$DATABASE_URL" -f "$f"; done` |
| **Estimated runtime** | ~30s for 3 SQL files; ~5 min for 5 Browser-MCP UAT scenarios |
| **Phase gate** | All 3 SQL test files emit zero `FAIL:` lines + 5 Browser-MCP UAT scenarios PASS + `06-VERIFICATION.md` written with all criteria GREEN |

---

## Sampling Rate

- **After every task commit:** Run the relevant per-RPC SQL test file (e.g., after `0019_*.sql` migration task → `06-process-due-recurring.sql`)
- **After every plan wave:** Run full suite `for f in supabase/tests/06-*.sql; do …; done`
- **Before `/gsd-verify-work`:** Full SQL suite green + 5 Browser-MCP UAT scenarios PASS
- **Max feedback latency:** ~30s SQL suite; manual UAT cycle ~5 min per round

**Per Phase 5 STATE.md decision (carry-forward):** REST/RPC HTTP testing > DevTools console for RLS/auth UAT. Phase 6 inherits — UAT-3 (RACE-02 race) and UAT-4 (RACE-03 race) MUST be done via 2 actual browser tabs with separate sessions, NOT 2 console calls. Race window only meaningful via real PostgREST round-trips.

---

## Per-Task Verification Map

> Task IDs follow `{phase}-{plan}-{task}` convention. Plan numbering matches research §Suggested Plan Breakdown (06-01..06-05). Adjust if planner produces different breakdown.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 06-01 | 1 | RACE-01 | T-6-01 | Migration `0019_process_due_recurring.sql` valid syntax; loads via Studio paste | sql-static | `psql -f supabase/migrations/0019_process_due_recurring.sql` (dry-run via local supabase, OR Studio paste verification) | ❌ W0 | ⬜ pending |
| 6-01-02 | 06-01 | 1 | RACE-01 | T-6-01 | RPC processes due recurring atomically; idempotent on replay (skipped_count = N on second run) | sql-integration | `psql -f supabase/tests/06-process-due-recurring.sql` (scenario 1: happy path, scenario 3: replay) | ❌ W0 | ⬜ pending |
| 6-01-03 | 06-01 | 1 | RACE-01 | T-6-02 | Income templates (Gaji) processed identically to expense; bill_payments row inserted | sql-integration | `psql -f supabase/tests/06-process-due-recurring.sql` (scenario 2) | ❌ W0 | ⬜ pending |
| 6-01-04 | 06-01 | 1 | RACE-01 | T-6-03 | Catch-up multi-month works with `p_max_iter=12`; loop terminates | sql-integration | `psql -f supabase/tests/06-process-due-recurring.sql` (scenario 4) | ❌ W0 | ⬜ pending |
| 6-01-05 | 06-01 | 1 | RACE-01 | T-6-04 | Race vs `mark_bill_paid` serializes via FOR UPDATE on `recurring_templates` row lock | sql-integration | `psql -f supabase/tests/06-process-due-recurring.sql` (scenario 9 — concurrent) | ❌ W0 | ⬜ pending |
| 6-01-06 | 06-01 | 1 | RACE-01 / DEV-01 | — | `useProcessRecurring` calls RPC; TS `nextDueDate` removed from `src/db/recurringTransactions.ts` | static | `npx tsc --noEmit && grep -r "function nextDueDate" src/db/ \| wc -l` (must be 0) | ✅ | ⬜ pending |
| 6-01-07 | 06-01 | 1 | RACE-01 | — | View-as admin scenario: admin calling RPC with non-admin p_uid succeeds; non-admin calling with arbitrary p_uid raises 42501 | sql-integration | `psql -f supabase/tests/06-process-due-recurring.sql` (scenario 6 — admin path, scenario 7 — non-admin denied) | ❌ W0 | ⬜ pending |
| 6-02-01 | 06-02 | 1 | RACE-02 | T-6-05 | Migration `0021_goal_investments_total_check.sql` creates trigger + function + index | sql-static | Studio paste verification + `\d goal_investments` shows trigger | ❌ W0 | ⬜ pending |
| 6-02-02 | 06-02 | 1 | RACE-02 | T-6-06 | Trigger raises SQLSTATE 23514 with message `Total alokasi melebihi 100%% (sudah X%, tambah Y% > 100)` when total exceeds 100% | sql-integration | `psql -f supabase/tests/06-goal-investments-cap.sql` (scenario 2) | ❌ W0 | ⬜ pending |
| 6-02-03 | 06-02 | 1 | RACE-02 | T-6-06 | Index `goal_investments_investment_idx` exists on `goal_investments(investment_id)` | sql-integration | `psql -f supabase/tests/06-goal-investments-cap.sql` (scenario 4) | ❌ W0 | ⬜ pending |
| 6-02-04 | 06-02 | 1 | RACE-02 | T-6-07 | Race serialization via FOR UPDATE in trigger SUM subquery (concurrent INSERT same investment_id) | sql-integration | `psql -f supabase/tests/06-goal-investments-cap.sql` (scenario 5 — concurrent) | ❌ W0 | ⬜ pending |
| 6-02-05 | 06-02 | 1 | RACE-02 | — | UPDATE goal_investments to lower allocation works (self-row excluded via `id IS DISTINCT FROM NEW.id`) | sql-integration | `psql -f supabase/tests/06-goal-investments-cap.sql` (scenario 3) | ❌ W0 | ⬜ pending |
| 6-03-01 | 06-03 | 1 | RACE-03 | T-6-08 | Migration `0020_withdraw_from_goal.sql` creates function with FOR UPDATE row lock | sql-static | Studio paste verification + `\df+ withdraw_from_goal` | ❌ W0 | ⬜ pending |
| 6-03-02 | 06-03 | 1 | RACE-03 | T-6-09 | RPC withdraws atomically; status flip `completed → active` when balance < target | sql-integration | `psql -f supabase/tests/06-withdraw-from-goal.sql` (scenario 1, 2) | ❌ W0 | ⬜ pending |
| 6-03-03 | 06-03 | 1 | RACE-03 | T-6-10 | Insufficient balance → SQLSTATE P0001 with message `Saldo kas tidak cukup (tersedia Rp X)` | sql-integration | `psql -f supabase/tests/06-withdraw-from-goal.sql` (scenario 4) | ❌ W0 | ⬜ pending |
| 6-03-04 | 06-03 | 1 | RACE-03 | — | TS `withdrawFromGoal(id, amount)` signature drops `goal: Goal` param; callsite `AddMoneyDialog.tsx:50` updated; tsc clean | static | `npx tsc --noEmit && grep -n "withdrawFromGoal" src/` (verify single signature) | ❌ W0 | ⬜ pending |
| 6-03-05 | 06-03 | 1 | RACE-03 | — | `paused` status stays `paused` (no flip); `active` stays `active` | sql-integration | `psql -f supabase/tests/06-withdraw-from-goal.sql` (scenario 5, 6) | ❌ W0 | ⬜ pending |
| 6-04-01 | 06-04 | 1 | RACE-02 / RACE-03 | — | `mapSupabaseError` (in `src/lib/errors.ts` per research live-code finding) gains SQLSTATE 23514 + P0001 branches | static | `grep -n "23514\|P0001" src/lib/errors.ts` (must show both branches) | ✅ | ⬜ pending |
| 6-04-02 | 06-04 | 1 | RACE-02 | — | `LinkInvestmentDialog.tsx` toast surfaces "Total alokasi investasi melebihi 100%" on 23514 error | manual+static | grep import of mapSupabaseError + manual UAT-3 | ✅ | ⬜ pending |
| 6-05-01 | 06-05 | 2 | All | — | Pre-deploy gate: `SELECT investment_id, SUM(allocation_pct) FROM goal_investments GROUP BY 1 HAVING SUM > 100` returns zero rows BEFORE pasting 0021 | sql-static | Pre-deploy psql query (D-16 gate) | ✅ | ⬜ pending |
| 6-05-02 | 06-05 | 2 | All | — | Migration paste order in Studio: 0019 → 0020 → 0021 (after D-16 cleared) | manual | Studio SQL Editor history | ✅ | ⬜ pending |
| 6-05-03 | 06-05 | 2 | RACE-01 | T-6-01 | UAT-1: Login → Transaksi tab → Gaji bulan ini muncul tepat 1 row | manual-e2e | Browser-MCP UAT script (06-05-UAT.md) | ❌ W0 | ⬜ pending |
| 6-05-04 | 06-05 | 2 | RACE-01 | T-6-04 | UAT-2: Klik "Lunas" + switch ke Transaksi 5x dalam 1s → no duplicate | manual-e2e | Browser-MCP UAT script | ❌ W0 | ⬜ pending |
| 6-05-05 | 06-05 | 2 | RACE-02 | T-6-06 | UAT-3: 2 tabs link 60% + 50% → second tab toast "Total alokasi melebihi 100%" | manual-e2e | Browser-MCP UAT script (2 tab session) | ❌ W0 | ⬜ pending |
| 6-05-06 | 06-05 | 2 | RACE-03 | T-6-09 | UAT-4: 2 tabs withdraw 50k each from 100k → satu sukses, satu toast "Saldo kas tidak cukup (tersedia Rp 50.000)" | manual-e2e | Browser-MCP UAT script (2 tab session) | ❌ W0 | ⬜ pending |
| 6-05-07 | 06-05 | 2 | RACE-03 | — | UAT-5: Goal `completed` (current=target), withdraw Rp 1 → balance turun, status flip `active` | manual-e2e | Browser-MCP UAT script | ❌ W0 | ⬜ pending |
| 6-05-08 | 06-05 | 2 | All | — | `06-VERIFICATION.md` written with all 5 ROADMAP success criteria mapped to evidence | docs | File exists + grep all 5 criteria | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*File Exists column: ✅ if file already in repo, ❌ W0 if must be created during this phase (Wave 0 gap)*

---

## Wave 0 Requirements

Test infrastructure gaps must be filled DURING the implementing plan, not punted to a separate Wave 0:

- [ ] `supabase/tests/06-process-due-recurring.sql` — Wave 0 gap, created by Plan 06-01 task 6-01-02
- [ ] `supabase/tests/06-goal-investments-cap.sql` — Wave 0 gap, created by Plan 06-02 task 6-02-02
- [ ] `supabase/tests/06-withdraw-from-goal.sql` — Wave 0 gap, created by Plan 06-03 task 6-03-02
- [ ] Browser-MCP UAT script — `06-05-UAT.md` action steps, authored by Plan 06-05 (mirror Phase 5's `05-04-UAT.md` model)
- [ ] No new framework installs needed — `psql` already used in Phase 4+5 deploy gate; `mcp playwright` already used in Phase 5 UAT
- [ ] No Vitest unit tests required for Phase 6 (per D-08: zero TS callers post-RACE-01 = no parity test; RPC behavior covered by SQL not unit-mockable)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Race window UAT-3 (2 tabs link investment 60% + 50%) | RACE-02 | Concurrent browser sessions cannot be simulated by single-process pgTAP. SQL test simulates via two transactions, but full UI race needs real PostgREST RTT + react-query cache + toast wiring. | 1. Open Goals tab di tab 1, login as user with ≥2 goals + ≥1 unallocated investment. 2. Click "Tautkan Investasi" → goal A → 60%. 3. **Don't submit yet.** 4. Open new browser tab (same session OK). 5. Click "Tautkan Investasi" → goal B → 50%, submit. 6. Return to tab 1, submit. 7. Assert: tab 1 shows toast "Total alokasi investasi melebihi 100%" (or detail variant); investment total in DB stays ≤ 100%. |
| Race window UAT-4 (2 tabs withdraw from same goal) | RACE-03 | Same as above — needs real two-tab concurrency. | 1. Login as user with goal `current_amount = 100000`. 2. Open 2 tabs side-by-side. 3. In each tab: open Goal detail → "Tarik Dana" dialog → fill Rp 50000 → don't submit yet. 4. Submit tab 1, then immediately submit tab 2. 5. Assert: one tab succeeds (goal balance now 50000), other tab shows toast "Saldo kas tidak cukup (tersedia Rp 50.000)". |
| UAT-1 (Gaji muncul tepat 1 row) | RACE-01 | Behavior depends on full app boot + useProcessRecurring useEffect + react-query invalidate + Transaksi tab render. SQL test proves DB-side correctness; UAT proves frontend toast + tab refresh wire correctly. | 1. Pre-condition: user has active income recurring template "Gaji" with `next_due_date` in current month. 2. Logout, login. 3. Wait for `useProcessRecurring` toast "X transaksi rutin diproses". 4. Navigate to Transaksi tab. 5. Filter by current month + income type. 6. Assert: exactly 1 row for "Gaji". 7. Reload page. 8. Re-assert: still exactly 1 row (idempotency). |
| UAT-2 (Lunas → switch tab 5x no duplicate) | RACE-01 | Same as UAT-1 plus race vs mark_bill_paid. Browser-MCP needed to observe toast + react-query state. | 1. Pre-condition: ≥1 expense recurring with `next_due_date <= today`. 2. Open UpcomingBillsPanel. 3. Click "Lunas" untuk satu bill. 4. Within 1 second: click Transaksi tab → reload → click UpcomingBills → reload (5x rapid). 5. Assert: bill's expense transaction count for that paid_date in transactions table = 1, NOT >1. SQL: `SELECT COUNT(*) FROM transactions WHERE date = ? AND category_id = ? AND amount = ? AND user_id = auth.uid()`. |
| UAT-5 (completed → active flip on withdraw) | RACE-03 | Status badge UI re-render after RPC returns new status. SQL test proves DB-side flip; UAT proves badge changes from "Tercapai" to "Aktif". | 1. Pre-condition: goal with `status='completed'`, `current_amount >= target_amount`. 2. Open Goal detail → "Tarik Dana" → Rp 1 → submit. 3. Assert: balance decreased by 1, badge changed from "Tercapai" to "Aktif" (visible in Goals tab list). 4. SQL verify: `SELECT status FROM goals WHERE id = ?` returns 'active'. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (✅ — every task in map has command or Wave 0 link)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (✅ — every plan has at least 1 SQL test + static check)
- [ ] Wave 0 covers all MISSING references (✅ — 4 SQL test files + UAT script all marked Wave 0 gap)
- [ ] No watch-mode flags (✅ — psql + npx tsc --noEmit are oneshot)
- [ ] Feedback latency < 60s SQL / < 5 min UAT (✅ — within constraint)
- [ ] `nyquist_compliant: true` set in frontmatter (⏳ — flip to true after planner produces final task IDs and this map is reconciled)

**Approval:** pending — flips to approved after Plan 06-05 deploy + UAT all 5 GREEN and `06-VERIFICATION.md` written.
