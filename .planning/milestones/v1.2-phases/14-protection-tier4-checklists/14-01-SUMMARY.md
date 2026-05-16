---
phase: 14-protection-tier4-checklists
plan: 01
subsystem: kesehatan-protection-foundation
tags: [foundation, db-layer, react-query, optimistic-mutation, view-as-guard, sql-test]
dependency_graph:
  requires:
    - "supabase/migrations/0029_protection_checklist.sql (Phase 12, shipped)"
    - "src/db/pensiun.ts upsertPensionSim canonical pattern"
    - "src/queries/recurringTransactions.ts useMarkBillPaid optimistic mutation pattern"
    - "src/auth/useTargetUserId + useViewAs (existing View-As pattern)"
  provides:
    - "src/components/ui/radio-group.tsx — RadioGroup + RadioGroupItem primitives"
    - "src/db/protectionChecklist.ts — full 10-column ProtectionChecklistRow + getProtectionChecklist + upsertProtectionChecklist + ProtectionChecklistPatch"
    - "src/queries/protectionChecklist.ts — useProtectionChecklist (read) + useUpdateProtectionChecklist (optimistic mutation with View-As guard)"
    - "supabase/scripts/reset-protection-checklist.sql — UAT pre-condition helper for Plans 14-02 + 14-03"
  affects:
    - "src/queries/kesehatanIndikator.ts — dropped inline useProtectionChecklist, imports from new module"
    - "src/queries/kesehatanTier1.ts — narrow 2-column type replaced by widened re-export from db/protectionChecklist (10 columns)"
tech_stack:
  added: []
  patterns:
    - "shadcn-style radix-ui umbrella primitive wrapper (mirrors checkbox/select)"
    - "DB layer co-located read + upsert per pension_simulations canonical (src/db/pensiun.ts)"
    - "Optimistic mutation snapshot/rollback per useMarkBillPaid canonical"
    - "View-As defensive guard (Decision F) — JS throw before supabase call, RLS WITH CHECK as fallback"
    - "TypeScript dual import + export to keep type identifier in scope (export-only re-export does not bind locally)"
key_files:
  created:
    - "src/components/ui/radio-group.tsx (42 lines)"
    - "src/db/protectionChecklist.ts (57 lines)"
    - "src/queries/protectionChecklist.ts (101 lines)"
    - "supabase/tests/14-protection-checklist-mutations.sql (160 lines)"
    - "supabase/scripts/reset-protection-checklist.sql (48 lines)"
  modified:
    - "src/queries/kesehatanIndikator.ts (-28 net lines: dropped inline 27-line hook + supabase/useQuery imports + ProtectionChecklistRow type-import; added 1-line import from new module)"
    - "src/queries/kesehatanTier1.ts (-8 net lines: replaced 4-line inline narrow type with 2-line dual import + re-export)"
decisions:
  - "Dual 'import type' + 'export type' instead of single 'export type {} from' in kesehatanTier1.ts — required because computeAsuransiShell at line 258 still references ProtectionChecklistRow by name, and TypeScript export-only re-export does NOT bind identifier in local scope."
  - "Query key preserved verbatim from Phase 13 inline hook: ['kesehatan', 'protection-checklist', targetUid] — single source of truth shared between read hook + mutation invalidation, and consumed by useIndikator (Phase 13). Mismatch would silently break post-mutation indicator color flip."
  - "View-As defensive guard (Decision F per CONTEXT.md): mutationFn throws plain Error BEFORE supabase call. Defense-in-depth: RLS WITH CHECK auth.uid() = user_id is fallback (would 42501). SQL test T4 verifies RLS still enforces if guard ever bypassed."
  - "ProtectionChecklistPatch typed as Partial<Omit<ProtectionChecklistRow, 'user_id' | 'created_at' | 'updated_at'>> — TypeScript prevents callers from passing user_id (T-14-06 Spoofing mitigation). uid is always derived from useTargetUserId() inside hook."
  - "console.warn from Phase 13 inline hook NOT carried over — useUpdateProtectionChecklist mutation hook surfaces errors via onError → toast.error(mapSupabaseError) per useMarkBillPaid canonical."
metrics:
  started: "2026-05-09T14:02:45Z"
  completed: "2026-05-09T14:12:08Z"
  duration_minutes: 10
  tasks_completed: 3
  files_created: 5
  files_modified: 2
  commits: 3
  loc_added: 416
  loc_removed: 42
---

# Phase 14 Plan 01: Protection Foundation Layer Summary

Three new modules (radio-group UI primitive + DB layer + React Query hook layer) plus refactor of two Phase 13 files establish the contract surface for Plans 14-02 and 14-03 — `ProtectionChecklistRow` widened from 2 columns to all 10 columns from migration 0029, optimistic mutation hook with View-As guard ready, and SQL test + UAT reset helper land alongside.

## What Shipped

### New files

- **`src/components/ui/radio-group.tsx`** (42 lines) — shadcn-style `RadioGroup` + `RadioGroupItem` wrapping `radix-ui` umbrella primitive. Mirrors `checkbox.tsx` / `select.tsx` idiom (`data-slot` attributes, `cn()` className merge, `CircleIcon` indicator from lucide-react).
- **`src/db/protectionChecklist.ts`** (57 lines) — full 10-column `ProtectionChecklistRow` type, `ProtectionChecklistPatch = Partial<Omit<...>>`, `getProtectionChecklist(uid)` read, `upsertProtectionChecklist(uid, patch)` UPSERT ON CONFLICT (user_id) per canonical `src/db/pensiun.ts:92-100` pattern.
- **`src/queries/protectionChecklist.ts`** (101 lines) — `useProtectionChecklist()` read hook (PROMOTED from `kesehatanIndikator.ts`) + `useUpdateProtectionChecklist()` optimistic mutation. Pattern verbatim from `useMarkBillPaid` (`src/queries/recurringTransactions.ts:83-124`): `onMutate` snapshots prev state via spread merge (Pitfall 4), `onError` rolls back + `toast.error(mapSupabaseError(err))`, `onSuccess` toast 'Tersimpan', `onSettled` invalidates same query key. Re-exports `ProtectionChecklistRow` + `ProtectionChecklistPatch` for downstream Plans 14-02/14-03.
- **`supabase/tests/14-protection-checklist-mutations.sql`** (160 lines) — 6 PASS/FAIL test cases (T1 lazy-create / T2 update merge / T3 owner UPSERT allowed / T4 admin cross-user 42501 / T5 CHECK 23514 invalid enum / T6 NULL reset 3-state radio). Setup pattern verbatim from `supabase/tests/12-protection-checklist.sql` (auth.users seed with `ON CONFLICT (id) DO NOTHING` + EXCEPTION graceful skip + `SET LOCAL ROLE authenticated` + `PERFORM set_config('request.jwt.claim.sub', ..., true)`). BEGIN/ROLLBACK isolation.
- **`supabase/scripts/reset-protection-checklist.sql`** (48 lines) — UAT pre-condition helper. UPDATE current user's row (`WHERE user_id = auth.uid()`) setting all 8 business columns to NULL + `updated_at = NOW()`. Idempotent (no-op if row absent). Verify SELECT trails the UPDATE. Used by Plans 14-02 + 14-03 manual UAT cycles.

### Modified files

- **`src/queries/kesehatanIndikator.ts`** — dropped inline `useProtectionChecklist` (27-line function block at original lines 53-80), `supabase` import, `useQuery` import, `ProtectionChecklistRow` type-import from `./kesehatanTier1`. Added single `import { useProtectionChecklist } from '@/queries/protectionChecklist'`. Call site at `useIndikator()` line 105 (now relocated) unchanged — function signature identical. All 8 indikator + DAR Total still computed; Phase 13 behavior preserved.
- **`src/queries/kesehatanTier1.ts`** — replaced inline narrow `ProtectionChecklistRow` type (2 columns: user_id + health_coverage) with widened re-export from `@/db/protectionChecklist` (10 columns). Used dual `import type` + `export type` (single `export type {} from` would NOT bind identifier locally — `computeAsuransiShell` at line 258 still references `ProtectionChecklistRow` by name in `Record<NonNullable<...['health_coverage']>, ...>`). Backward-compat: `computeAsuransiShell` continues to work — wider type is a structural superset of narrow type, `health_coverage` field identical.

## Query Key Preservation Verification

Phase 13 inline hook at `kesehatanIndikator.ts:63` (pre-edit):
```ts
queryKey: ['kesehatan', 'protection-checklist', targetUid]
```

Phase 14 read hook at `src/queries/protectionChecklist.ts:30`:
```ts
queryKey: ['kesehatan', 'protection-checklist', targetUid]
```

Phase 14 mutation hook at `src/queries/protectionChecklist.ts:73` (onMutate cancelQueries) + line 96 (onSettled invalidateQueries):
```ts
['kesehatan', 'protection-checklist', uid]
```

Verbatim match — useIndikator's auto-recompute via useMemo dependency on `protection.data` will trigger correctly post-mutation.

## View-As Defensive Guard Implementation

`src/queries/protectionChecklist.ts:65-67`:
```ts
if (viewingAs !== null) {
  throw new Error('Tidak boleh modify data user lain (View-As mode)')
}
```

Throws BEFORE `upsertProtectionChecklist(uid, patch)` call. Caught by `onError` → `toast.error(mapSupabaseError(err))`. RLS WITH CHECK `auth.uid() = user_id` is fallback (would surface 42501 if guard removed in future regression). SQL test T4 verifies RLS still enforces.

## Type Widening Evidence

Phase 13 narrow type (2 columns):
```ts
export type ProtectionChecklistRow = {
  user_id: string
  health_coverage: 'kantor' | 'bpjs' | 'pribadi' | 'kombinasi' | 'tidak' | null
}
```

Phase 14 widened type (10 columns) at `src/db/protectionChecklist.ts:9-21`:
```ts
export type ProtectionChecklistRow = {
  user_id: string
  health_coverage: 'kantor' | 'bpjs' | 'pribadi' | 'kombinasi' | 'tidak' | null
  has_dependents: boolean | null
  life_coverage: 'kantor' | 'pribadi' | 'keduanya' | 'tidak' | null
  life_coverage_sufficient: boolean | null
  life_coverage_post_employment: 'ya' | 'tidak' | 'tidak_yakin' | null
  estate_heirs_documented: boolean | null
  estate_assets_documented: boolean | null
  estate_will_exists: boolean | null
  updated_at: string
  created_at: string
}
```

All enum literals match migration 0029 CHECK constraints exactly. All business columns nullable for lazy-fill semantics. `ProtectionChecklistPatch` = `Partial<Omit<ProtectionChecklistRow, 'user_id' | 'created_at' | 'updated_at'>>` — TypeScript prevents user_id spoofing (T-14-06 mitigation).

## SQL Test Outcomes

**Developer-run pending** — file structure verified via grep (acceptance criteria all satisfied):

| Acceptance criterion | Result |
|----------------------|--------|
| ≥6 `RAISE NOTICE 'PASS:` | 6 (T1..T6) ✓ |
| ≥6 `RAISE NOTICE 'FAIL:` | 7 (T1..T6 fail branches + extra) ✓ |
| `BEGIN;` / `ROLLBACK;` | 1 each ✓ |
| `SET LOCAL row_security = off` | 2 (initial + after RESET ROLE for T5) ✓ |
| `PERFORM set_config('request.jwt.claim.sub'` | 3 (user / admin / re-user for T6) ✓ |
| `SET LOCAL ROLE authenticated` | 2 (T1-T4 + T6 re-entry) ✓ |
| `ON CONFLICT (id) DO NOTHING` | 1 (auth.users seed mirror) ✓ |
| `ON CONFLICT (user_id)` | 6 (UPSERT verifications) ✓ |
| `SQLSTATE = '42501'` | 1 (T4) ✓ |
| `EXCEPTION WHEN check_violation` | 1 (T5) ✓ |
| `estate_will_exists IS NULL` | 1 (T6 verify clause) ✓ |

Expected behavior on `psql -f`:
```
SECTION: protection_checklist mutations
PASS: T1 lazy-create — health_coverage=bpjs, has_dependents=NULL
PASS: T2 update merge preserves health_coverage
PASS: T3 owner UPSERT allowed (T1+T2 succeeded under JWT claim sub=v_user_uid)
PASS: T4 admin cross-user UPSERT raised 42501 (WITH CHECK enforced)
PASS: T5 CHECK rejects invalid health_coverage enum (23514)
PASS: T6 NULL reset works for 3-state radio (estate_will_exists IS NULL)
============================================================
Phase 14 protection_checklist mutations test complete.
Expected: 6 PASS notices total (T1..T6).
============================================================
ROLLBACK
```

## Reset Script Smoke Test Result

**Developer-run pending** — file structure verified via grep:

| Acceptance criterion | Result |
|----------------------|--------|
| `UPDATE protection_checklist` | 1 ✓ |
| `WHERE user_id = auth.uid()` | 2 (UPDATE + verify SELECT) ✓ |
| 8 business columns set NULL | 8 ✓ (health_coverage, has_dependents, life_coverage, life_coverage_sufficient, life_coverage_post_employment, estate_heirs_documented, estate_assets_documented, estate_will_exists) |

Expected behavior on `psql -f` against authenticated session:
- If row never existed: `UPDATE 0`, then verify SELECT returns 0 rows.
- If row exists: `UPDATE 1`, then verify SELECT returns 1 row with all 8 business columns NULL + new `updated_at`.

## Backward Compat Confirmation

- **`computeAsuransiShell`** (`src/queries/kesehatanTier1.ts:258`) — unchanged. Wider 10-column type is a structural superset of the original narrow 2-column type. Function only reads `row.health_coverage`, which exists on both shapes with identical literal-union enum.
- **`useIndikator()` consumers** — `KesehatanLanding.tsx`, `Tier1Panel.tsx`, `TierPanel.tsx` (Phase 13 wired) consume via `protection.data` which is now `ProtectionChecklistRow | null` (widened). Excess fields (has_dependents, life_*, estate_*) are simply not read by Phase 13 compute layer — TypeScript structural subtyping holds. No cascade type errors expected.
- **Phase 13 indicator behavior** — `computeAsuransiShell(protData)` invocation at `kesehatanIndikator.ts:132` (relocated post-edit) unchanged. Tier 1 #4 IndikatorCard renders identically until Plan 14-02 swaps to `form-radio` variant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Single `export type {} from` would have broken `computeAsuransiShell`**

- **Found during:** Task 2 sub-task C (kesehatanTier1.ts refactor)
- **Issue:** Plan instructed `export type { ProtectionChecklistRow } from '@/db/protectionChecklist'` as a one-line replacement of the inline type. However, `computeAsuransiShell` at line 258 of the same file references `ProtectionChecklistRow` by name in both `Record<NonNullable<ProtectionChecklistRow['health_coverage']>, string>` (line 248) and parameter type `row: ProtectionChecklistRow | null | undefined` (line 259). TypeScript export-only re-export does NOT bind the identifier in the local module scope — these references would have failed to resolve, breaking compile.
- **Fix:** Used dual `import type { ProtectionChecklistRow } from '@/db/protectionChecklist'` + `export type { ProtectionChecklistRow } from '@/db/protectionChecklist'`. Local import binds identifier in scope; re-export preserves backward-compat for kesehatanIndikator.ts and any other downstream consumer importing from `./kesehatanTier1`.
- **Files modified:** `src/queries/kesehatanTier1.ts`
- **Commit:** 39e6f06

No other deviations. Plan executed as written.

## Out of Scope (Plans 14-02 / 14-03 deliver)

- `AsuransiKesehatanForm` component (Tier 1 #4 inline form) — Plan 14-02
- `Tier4Panel.tsx` rewrite (smart-gated checklist) — Plan 14-03
- `kesehatanTier4.ts` compute module (DIAG-09) — Plan 14-03
- `deriveTierColors` signature change to include Tier 4 — Plan 14-03
- `KesehatanLanding.tsx` call-site updates — Plans 14-02/14-03 (NOT this plan; KesehatanLanding owned by Phase 13 plan 13-01 and untouched here)

## Verification Checks (Developer-Pending)

`tsc --noEmit -p .` and `npm run build` could not be executed in worktree (no `node_modules` — parallel-executor environment). File-structure verification via grep is complete and all acceptance criteria satisfied. Recommend orchestrator run full TS + build verification after worktree merge.

## Self-Check: PASSED

- File `src/components/ui/radio-group.tsx` exists ✓
- File `src/db/protectionChecklist.ts` exists ✓
- File `src/queries/protectionChecklist.ts` exists ✓
- File `supabase/tests/14-protection-checklist-mutations.sql` exists ✓
- File `supabase/scripts/reset-protection-checklist.sql` exists ✓
- Commit `8b6beda` (Task 1) found in git log ✓
- Commit `39e6f06` (Task 2) found in git log ✓
- Commit `cdeb82c` (Task 3) found in git log ✓
- No file under `supabase/migrations/` created (Phase 14 zero-schema-change rule) ✓
- `KesehatanLanding.tsx` not modified (Phase 13 plan 13-01 ownership respected) ✓
- `STATE.md` / `ROADMAP.md` not modified (orchestrator owns these post-wave) ✓
- Mutation hook includes `onMutate` (snapshot + spread merge) + `onError` (rollback + mapSupabaseError toast) + `onSuccess` (toast 'Tersimpan') + `onSettled` (invalidateQueries) ✓
