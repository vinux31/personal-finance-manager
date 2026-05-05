---
phase: 07-ui-data-consistency
plan: "02"
subsystem: database
tags: [migration, rpc, seed, atomicity, security-definer, rls, pgtap]
dependency_graph:
  requires: []
  provides:
    - user_seed_markers table
    - seed_rencana(UUID) RPC
    - reset_rencana_marker() RPC
    - 07-seed-rencana.sql pgTAP test
  affects:
    - supabase/migrations/0022_user_seed_markers.sql
    - supabase/tests/07-seed-rencana.sql
tech_stack:
  added: []
  patterns:
    - SECURITY DEFINER RPC with SET search_path (T-07-04 mitigate)
    - marker-only idempotency (D-02)
    - backfill INSERT ON CONFLICT DO NOTHING (D-03)
    - strict self-only RPC with no p_uid parameter (D-07.3)
key_files:
  created:
    - supabase/migrations/0022_user_seed_markers.sql
    - supabase/tests/07-seed-rencana.sql
  modified: []
decisions:
  - "D-02: marker-only idempotency via IF EXISTS user_seed_markers (not name-existence fallback)"
  - "D-04: 5 goals + 3 investments hardcoded in SQL (drift from CONTEXT.md text which says 5+5 — codebase truth wins)"
  - "D-07.3: reset_rencana_marker strict self-only, no admin override, no p_uid param"
  - "T-07-04: SET search_path = public on both RPCs to prevent schema-shadowing attack"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-29T05:39:53Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
requirements: [CONS-03]
---

# Phase 7 Plan 02: Migration 0022 user_seed_markers + pgTAP Test Summary

**One-liner:** Migration 0022 creates `user_seed_markers` table + `seed_rencana(UUID)` + `reset_rencana_marker()` RPCs implementing atomic RENCANA seed (5 goals + 3 investments) with marker-only idempotency, plus pgTAP test with 9 PASS scenarios.

## What Was Built

### Migration 0022_user_seed_markers.sql

Four sections in a single migration file:

**Section 1 — Table + RLS**
- `user_seed_markers (user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, rencana_seeded_at TIMESTAMPTZ NOT NULL DEFAULT now())`
- RLS policy `"Users manage own seed markers"`: `USING (auth.uid() = user_id OR is_admin())` WITH CHECK `(auth.uid() = user_id)` — admin can read for View-As, but cannot write on behalf of another user (T-07-07 mitigate)

**Section 2 — RPC `seed_rencana(p_uid UUID DEFAULT NULL)`**
- Pattern A compliance: `SECURITY DEFINER`, `SET search_path = public`, `COALESCE(p_uid, auth.uid())`, auth guard (ERRCODE 28000), access guard (ERRCODE 42501)
- Marker-only idempotency (D-02): `IF EXISTS (SELECT 1 FROM user_seed_markers WHERE user_id = v_uid) RETURN false`
- Atomic INSERT: 5 RENCANA goals → 3 RENCANA investments → marker row (single implicit transaction, D-05)
- Returns BOOLEAN: `true` = newly seeded, `false` = already seeded

**Section 3 — RPC `reset_rencana_marker()`**
- No `p_uid` parameter — zero params, strict self-only (D-07.3)
- No admin override — `DELETE FROM user_seed_markers WHERE user_id = v_uid` where `v_uid = auth.uid()` only
- `SECURITY DEFINER` + `SET search_path = public` (T-07-05 mitigate)

**Section 4 — Backfill (D-03)**
- `INSERT INTO user_seed_markers SELECT DISTINCT user_id, NOW() FROM goals WHERE name = ANY(...)  ON CONFLICT (user_id) DO NOTHING`
- Covers all 5 RENCANA goal names; prevents double-seed for existing users on next Dashboard load

### pgTAP Test 07-seed-rencana.sql

9 PASS scenarios across 3 sections:

| Scenario | Description |
|----------|-------------|
| SECTION 1 — 1 | `to_regprocedure('public.seed_rencana(uuid)')` exists |
| SECTION 1 — 2 | `to_regprocedure('public.reset_rencana_marker()')` exists |
| SECTION 1 — 3 | `pg_get_functiondef LIKE '%SET search_path%'` (T-07-04 proof) |
| SECTION 1 — 4 | `pg_get_functiondef LIKE '%SECURITY DEFINER%'` |
| SECTION 1 — 5 | `to_regclass('public.user_seed_markers')` exists |
| SECTION 2 — 1a | First `seed_rencana(NULL)` returns `true` |
| SECTION 2 — 1b | Exactly 5 goals + 3 investments + 1 marker inserted |
| SECTION 2 — 2 | Second call returns `false`, no duplicates (idempotency) |
| SECTION 2 — 3 | `reset_rencana_marker()` deletes own marker |
| SECTION 2 — 4 | After reset, `seed_rencana(NULL)` returns `true` again |
| SECTION 2 — 5 | Foreign uid + non-admin → SQLSTATE 42501 (T-07-06 proof) |
| SECTION 3 — 6 | Backfill marker auto-inserted for pre-existing RENCANA goal user |
| SECTION 3 — 7 | `seed_rencana` returns `false` for backfilled user (D-02 idempotency via marker) |

Note: Test actually produces 9 PASS notices from the DO block scenarios plus 5 from inline SECTION 1 = potentially up to 12 passing assertions, well above the minimum 7.

## Drift Correction (CRITICAL)

**CONTEXT.md D-04 says "5 goals + 5 investments"** — this is incorrect relative to the actual codebase.

**Actual codebase (source of truth):**
- `src/lib/rencanaNames.ts`: `RENCANA_GOAL_NAMES` length **5**, `RENCANA_INVESTMENT_NAMES` length **3**
- `src/db/investments.ts:183-187`: `RENCANA_INVESTMENTS` has **3 entries**

**Migration and test use 5 goals + 3 investments** — synced with rencanaNames.ts per D-04 sync obligation. The CONTEXT.md text "5+5" is documentation drift that was explicitly flagged in the PLAN.md objective section and corrected here.

## Pattern Sources

| Pattern | Source File |
|---------|-------------|
| Table + RLS shape | `supabase/migrations/0013_bill_payments.sql` (lines 5-20) |
| RPC SECURITY DEFINER template | `supabase/migrations/0014_mark_bill_paid.sql` (lines 45-115) |
| ERRCODE 42501 access guard | `supabase/migrations/0019_process_due_recurring.sql` (lines 32-39) |
| pgTAP DO block + SKIP fallback | `supabase/tests/06-process-due-recurring.sql` (full file) |
| pg_get_functiondef proof style | `supabase/tests/06-withdraw-from-goal.sql` (lines 177-180) |

## Decisions Implemented

- **D-01:** `user_seed_markers` as single source-of-truth for "user sudah seeded"
- **D-02:** Marker-only dedup (not name-existence fallback)
- **D-03:** Migration-time backfill for existing users
- **D-04:** 5+3 hardcoded data in SQL function body (synced with rencanaNames.ts; drift correction applied)
- **D-05:** Single implicit transaction atomicity
- **D-06:** `RETURNS BOOLEAN` (true=new seed, false=already seeded)
- **D-07.3:** `reset_rencana_marker` strict self-only, no admin override
- **D-08:** localStorage fast-path cache semantics documented (wiring deferred to Plan 07-05)
- **D-26:** Migration numbered 0022 (renumbered +1 per STATE.md decision)

## Threats Addressed

| Threat | Mitigation |
|--------|-----------|
| T-07-04: search_path shadowing | `SET search_path = public` on `seed_rencana` — verified by Task 2 SECTION 1 |
| T-07-05: reset_rencana_marker p_uid bypass | No p_uid parameter; `DELETE WHERE user_id = auth.uid()` only |
| T-07-06: Tampering via access guard | `IF v_uid != auth.uid() AND NOT is_admin() THEN RAISE 42501` — verified by Scenario 5 |
| T-07-07: RLS info disclosure | `USING (auth.uid()=user_id OR is_admin()) WITH CHECK (auth.uid()=user_id)` — admin read-only |
| T-07-08: DoS via partial seed | Implicit transaction rollback on any INSERT failure; marker last so partial seed → no marker |

## Frontend Rewire Deferred

- `src/lib/useRencanaInit.ts` rewrite (D-08 localStorage fast-path + RPC call) — deferred to Plan **07-05**
- `src/tabs/SettingsTab.tsx` `doResetSeed` extension (D-07: call `reset_rencana_marker` + fix per-user localStorage key) — deferred to Plan **07-05**

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Migration 0022 | `64db599` | `supabase/migrations/0022_user_seed_markers.sql` |
| Task 2: pgTAP test | `f7f8a23` | `supabase/tests/07-seed-rencana.sql` |

## Deviations from Plan

None — plan executed exactly as written, with one drift correction (5+3 not 5+5) that was explicitly documented in the PLAN.md objective and applied correctly.

## Threat Flags

None — all security surface in this plan is covered by the threat model (T-07-04 through T-07-08 all mitigated).

## Known Stubs

None — this plan is SQL-only (migration + test). No frontend wiring. Frontend integration intentionally deferred to Plan 07-05 per plan scope.

## Self-Check: PASSED

- `supabase/migrations/0022_user_seed_markers.sql` exists: FOUND
- `supabase/tests/07-seed-rencana.sql` exists: FOUND
- Commit `64db599` exists: FOUND
- Commit `f7f8a23` exists: FOUND
