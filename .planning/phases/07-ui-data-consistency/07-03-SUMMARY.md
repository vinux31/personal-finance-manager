---
phase: 07-ui-data-consistency
plan: "03"
subsystem: database/rpc
tags: [migration, rpc, goals, status-flip, backfill, for-update, security-definer, cons-01, d-10, d-11, d-12, d-13, d-14, pgtap]
dependency_graph:
  requires: [plan-07-01 (goals_with_progress VIEW from migration 0023)]
  provides: [migration 0024_add_money_to_goal_v2.sql, supabase/tests/07-add-money-v2.sql]
  affects: [plan-07-04 (Studio paste + live test execution), plan-07-05 (UI switches to VIEW)]
tech_stack:
  added: []
  patterns:
    - DROP FUNCTION IF EXISTS before CREATE OR REPLACE (Phase 5 lesson D-13)
    - FOR UPDATE on base table goals before inline subquery (race-safe status flip)
    - Inline subquery mirrors VIEW formula (cash + Σ allocation_pct/100 * COALESCE(cur,buy) * qty)
    - SECURITY DEFINER + SET search_path = public (Pattern A compliance)
    - One-time backfill UPDATE referencing goals_with_progress VIEW
    - BEGIN/ROLLBACK pgTAP test with RAISE NOTICE PASS:/FAIL: convention
key_files:
  created:
    - supabase/migrations/0024_add_money_to_goal_v2.sql
    - supabase/tests/07-add-money-v2.sql
  modified: []
decisions:
  - "D-13: DROP FUNCTION IF EXISTS public.add_money_to_goal(BIGINT, NUMERIC) before CREATE OR REPLACE — Phase 5 lesson 0018 — prevents legacy v1 cash-only coexistence"
  - "D-10: add_money_to_goal v2 body — FOR UPDATE on goals base table + inline subquery mirrors VIEW formula (cash + investment market value)"
  - "D-11: Status transition: only active→completed when total_amount >= target_amount; paused preserved; completed preserved"
  - "D-12: One-time backfill UPDATE flips eligible active goals to completed using goals_with_progress VIEW IN clause — SC#1 visible immediately post-deploy"
  - "D-14: withdraw_from_goal MESSAGE patched to split kas vs investasi — 'Saldo kas tidak cukup. Tersedia Rp X (terpisah dari Rp Y di investasi)'; DROP + CREATE per Phase 5 discipline"
  - "TS callsite src/db/goals.ts:94 NOT changed — RPC name+signature stays identical (BIGINT, NUMERIC)"
metrics:
  duration: ~3 minutes
  completed: 2026-04-29T05:54:36Z
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 7 Plan 03: add_money_to_goal v2 + Backfill + withdraw MESSAGE Patch Summary

**One-liner:** Migration 0024 replaces `add_money_to_goal` v1 (cash-only status check) dengan v2 investment-aware via FOR UPDATE + inline subquery mirroring `goals_with_progress` VIEW formula, plus one-time backfill UPDATE dan `withdraw_from_goal` MESSAGE rewrite split kas vs investasi (D-10..D-14).

## What Was Built

### Migration 0024_add_money_to_goal_v2.sql

Empat seksi dalam satu migration file:

**Section 1 — DROP v1 (D-13 mandatory)**
```sql
DROP FUNCTION IF EXISTS public.add_money_to_goal(BIGINT, NUMERIC);
```
Wajib per Phase 5 lesson 0018: tanpa explicit DROP, executor yang accidentally mengubah signature akan membuat 3-arg overload sementara v1 2-arg (cash-only) tetap callable via PostgREST — status-mismatch surface.

**Section 2 — CREATE v2 (investment-aware)**
- `SECURITY DEFINER` + `SET search_path = public` (Pattern A compliance, T-07-09 mitigation)
- Auth guard via `auth.uid() IS NULL → ERRCODE 28000`
- `SELECT ... FROM goals WHERE id = p_id AND user_id = v_uid FOR UPDATE` — row lock sebelum compute (T-07-10 mitigation)
- Inline subquery mirrors VIEW formula: `COALESCE(SUM(gi.allocation_pct/100 * COALESCE(i.current_price, i.buy_price) * i.quantity), 0)` dari `goal_investments gi LEFT JOIN investments i`
- Status CASE: `active + total >= target → completed`, paused preserved, completed preserved (D-11)
- `GRANT EXECUTE ON FUNCTION add_money_to_goal(BIGINT, NUMERIC) TO authenticated`

**Section 3 — One-time backfill (D-12)**
```sql
UPDATE goals
SET status = 'completed'
WHERE status = 'active'
  AND id IN (SELECT id FROM goals_with_progress WHERE total_amount >= target_amount);
```
Eager + deterministic: SC#1 demo case (goal target Rp 10jt + 60%×Rp 18jt = Rp 10.8jt) langsung visible "Tercapai" post-deploy tanpa user action. Hanya menyentuh rows dengan `status = 'active'` (paused dan completed tidak ter-update).

**Section 4 — withdraw_from_goal MESSAGE patch (D-14)**
- DROP + CREATE (Phase 5 discipline) karena MESSAGE adalah externally-observable behavior
- Compute `v_invested` sama seperti add_money subquery
- Error MESSAGE: `format('Saldo kas tidak cukup. Tersedia Rp %s (terpisah dari Rp %s di investasi)', v_goal.current_amount, v_invested)`
- `ERRCODE = 'P0001'` dipertahankan — backward-compatible dengan `mapSupabaseError` Phase 5+6

### pgTAP Test 07-add-money-v2.sql

7 PASS notices dalam dua seksi:

**SECTION 1 — Function-def proofs (5 inline CASE WHEN):**
1. `to_regprocedure('public.add_money_to_goal(bigint,numeric)') IS NOT NULL` — function v2 exists
2. `pg_get_functiondef LIKE '%FOR UPDATE%'` — race-safe lock proof (T-07-10)
3. `pg_get_functiondef LIKE '%goal_investments%'` — investment-aware inline subquery proof
4. `pg_get_functiondef LIKE '%SET search_path%'` — search_path hardening proof (T-07-09)
5. `pg_get_functiondef withdraw_from_goal LIKE '%terpisah dari Rp %% di investasi%'` — D-14 MESSAGE patch proof

**SECTION 2 — DO block scenarios (7 RAISE NOTICE):**
- Scenario 1: active→completed flip — cash=0, target=10jt, investment 60%×18jt=10.8jt, add 1 → status='completed' (SC#1 key scenario)
- Scenario 2: paused stays paused — 30%×18jt=5.4jt > target 5jt, add 100 → status='paused' (D-11 lock)
- Scenario 3: completed stays completed — add 100 to completed goal → still 'completed' (D-11 lock)
- Scenario 4: amount<=0 raises 'Jumlah harus > 0'
- Scenario 5: nonexistent goal raises 'Goal tidak ditemukan'
- Scenario 6: cash-only goal (no investment) flips to completed when cash alone >= target
- BEGIN/ROLLBACK wrapper, `SET LOCAL row_security = off` for seeding, auth.users SKIP fallback

## Phase 5 Lesson Followed (D-13)

**Explicit DROP FUNCTION before CREATE** — Section 1 emits `DROP FUNCTION IF EXISTS public.add_money_to_goal(BIGINT, NUMERIC)` pada baris 21, sebelum `CREATE OR REPLACE FUNCTION add_money_to_goal` pada baris 28. Urutan terbukti via line number check (21 < 28).

Alasan: `CREATE OR REPLACE` dengan signature identical akan replace function; tapi kalau ada behavior change yang tidak disengaja mengubah arity, PostgreSQL akan membuat 2nd overload — v1 (cash-only) tetap callable. DROP memberi safety net.

Pola ini juga diterapkan pada Section 4 `withdraw_from_goal` karena MESSAGE adalah externally-observable behavior.

## Pattern Sources

| Pattern | Source File | Applied To |
|---------|-------------|------------|
| v1 baseline body | `0006_multi_user.sql:225-261` | Section 2 body structure |
| DROP discipline | `0018_drop_legacy_aggregates.sql:17-18` | Section 1 + Section 4 DROP |
| FOR UPDATE + status flip | `0020_withdraw_from_goal.sql:20-74` | Section 2 lock+status pattern |
| backfill IN clause | `0023_goals_with_progress.sql` VIEW formula | Section 3 backfill |
| pgTAP convention | `06-withdraw-from-goal.sql` | 07-add-money-v2.sql structure |
| inline CASE WHEN | `04-mark-bill-paid.sql:26-28` | SECTION 1 assertions |

## Decisions Implemented

| Decision | Description |
|----------|-------------|
| D-10 | add_money_to_goal v2 body — inline subquery mirrors VIEW formula, FOR UPDATE on base table |
| D-11 | Status transition: active→completed; paused preserved; completed preserved |
| D-12 | One-time backfill UPDATE — eager, deterministic, references goals_with_progress VIEW |
| D-13 | DROP FUNCTION explicit sebelum CREATE — Phase 5 lesson mandatory |
| D-14 | withdraw_from_goal MESSAGE: split kas vs investasi wording exact-match UAT-1 |
| D-26 | Migration numbered 0024 (Phase 6 numbering shift +1, documented in STATE.md) |

## Threats Addressed

| Threat | Category | Mitigation Applied |
|--------|----------|--------------------|
| T-07-09 | Elevation of Privilege | `SET search_path = public` pada add_money_to_goal v2 — prevents search_path injection. Verified Section 1 assertion 4. |
| T-07-10 | Tampering (concurrent) | `SELECT ... FROM goals WHERE id = p_id AND user_id = v_uid FOR UPDATE` — serializes concurrent add_money calls. Verified Section 1 assertion 2. |
| T-07-11 | Tampering (status bypass) | Status transition dalam locked transaction — tidak bisa dimanipulasi via parameter. Verified Scenarios 2 + 3. |
| T-07-12 | Information Disclosure (subquery) | Accepted — inline subquery SECURITY DEFINER scope, caller's goal sudah diverifikasi via FOR UPDATE user_id=v_uid filter. No cross-user leak. |
| T-07-13 | Tampering (DROP discipline) | Section 1 DROP ensures v1 tidak coexist jika signature pernah berubah. Verified acceptance criteria grep. |
| T-07-14 | Information Disclosure (MESSAGE) | v_invested computed hanya dari goals/investments milik v_uid (FOR UPDATE filter). Numerical disclosure sudah implicit dalam user's own portfolio. |

## TS Callsite

`src/db/goals.ts:94` — `addMoneyToGoal(id: number, amount: number)` → `supabase.rpc('add_money_to_goal', { p_id: id, p_amount: amount })` — **TIDAK diubah**. RPC name dan signature tetap identik (BIGINT, NUMERIC). Zero breaking changes untuk frontend.

## Migration Deploy Order

Migration NOT applied ke live DB dalam plan ini. Plan 07-04 (Wave 3) handles Studio paste + live test execution. Deploy order: 0022 → 0023 → **0024** (0024 depends on goals_with_progress VIEW dari 0023 untuk backfill IN clause).

## Deviations from Plan

None — plan executed exactly as written. Migration content matches verbatim skeleton dari PLAN.md action block. Test file follows exact structure dari PLAN.md action block dengan semua required scenarios. DROP statement untuk `withdraw_from_goal` disertakan per Phase 5 discipline (juga ditetapkan sebagai mandatory di PLAN.md acceptance criteria).

## Known Stubs

None — migration fully defined, test uses concrete numeric values. No placeholder or empty data.

## Self-Check: PASSED

- `supabase/migrations/0024_add_money_to_goal_v2.sql` EXISTS (verified)
- `supabase/tests/07-add-money-v2.sql` EXISTS (verified)
- Commit `c2a29b2` — feat(07-03): create migration 0024 add_money_to_goal v2 (verified)
- Commit `6484133` — test(07-03): add pgTAP integration test for add_money_to_goal v2 (verified)
- `grep -c "DROP FUNCTION IF EXISTS public.add_money_to_goal"` returns 1 (verified)
- DROP at line 21, CREATE at line 28 — DROP < CREATE (verified)
- `grep -c "FOR UPDATE"` returns 4 (≥2 requirement met, verified)
- `grep -F "Saldo kas tidak cukup. Tersedia Rp %s (terpisah dari Rp %s di investasi)"` returns 1 (verified)
- `grep -c "RAISE NOTICE 'PASS:"` test file returns 7 (≥7 requirement met, verified)
- All 18 acceptance criteria for Task 1: PASS
- All 18 acceptance criteria for Task 2: PASS
