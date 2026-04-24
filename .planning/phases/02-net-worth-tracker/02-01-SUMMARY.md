---
phase: 02-net-worth-tracker
plan: "01"
subsystem: data-layer
tags: [supabase, tanstack-query, db, queries, net-worth]
completed: "2026-04-24"
duration_minutes: 6
tasks_completed: 2
tasks_total: 2
files_created: 2
files_modified: 0

dependency_graph:
  requires:
    - supabase/migrations/0012_net_worth.sql
    - src/lib/supabase.ts
    - src/lib/errors.ts
    - src/auth/useTargetUserId.ts
  provides:
    - src/db/netWorth.ts
    - src/queries/netWorth.ts
  affects:
    - src/tabs/KekayaanTab.tsx (Plan 02 — imports hooks + insertSnapshotIfNeeded)
    - src/tabs/DashboardTab.tsx (Plan 03 — imports hooks for MetricCard #5)

tech_stack:
  added: []
  patterns:
    - Supabase CRUD with explicit user_id (RLS WITH CHECK pattern)
    - TanStack Query v5 useQuery + useMutation with useTargetUserId
    - Upsert with ignoreDuplicates for idempotent snapshot insertion

key_files:
  created:
    - src/db/netWorth.ts
    - src/queries/netWorth.ts
  modified: []

decisions:
  - "Pass user_id: uid explicitly in all net_worth inserts — no auto-inject trigger unlike goals table"
  - "insertSnapshotIfNeeded uses upsert+ignoreDuplicates (not check-then-insert) for atomic idempotency"
  - "net_worth column excluded from upsert payload — GENERATED ALWAYS AS STORED column"
  - "invalidateQueries uses prefix-only key (no uid) to invalidate all user variants"
  - "No insertSnapshotIfNeeded hook exported — caller (KekayaanTab) calls db function directly in useEffect"

commits:
  - hash: "69c945a"
    task: "Task 1"
    message: "feat(02-01): create src/db/netWorth.ts with full CRUD + snapshot upsert"
  - hash: "7e18b8c"
    task: "Task 2"
    message: "feat(02-01): create src/queries/netWorth.ts with all 9 TanStack Query hooks"
---

# Phase 02 Plan 01: Net Worth Data Layer Summary

**One-liner:** Supabase CRUD + TanStack Query v5 hooks for net_worth_accounts, net_worth_liabilities, and net_worth_snapshots — with explicit user_id injection and idempotent snapshot upsert.

## What Was Built

Two new files providing the complete data layer for the Net Worth feature:

### `src/db/netWorth.ts` (~172 LOC)

**Types exported:**
- `AccountType` — union of 7 values matching DB CHECK constraint: `'tabungan' | 'giro' | 'cash' | 'deposito' | 'dompet_digital' | 'properti' | 'kendaraan'`
- `LiabilityType` — union of 5 values: `'kpr' | 'cicilan_kendaraan' | 'kartu_kredit' | 'paylater' | 'kta'`

**Interfaces exported:**
- `NetWorthAccount` — id, user_id, name, type, balance, created_at
- `NetWorthAccountInput` — name, type, balance
- `NetWorthLiability` — id, user_id, name, type, amount, created_at
- `NetWorthLiabilityInput` — name, type, amount
- `NetWorthSnapshot` — id, user_id, snapshot_month, total_accounts, total_investments, total_liabilities, net_worth, created_at

**Functions exported:**
- Account CRUD: `listAccounts`, `createAccount`, `updateAccount`, `deleteAccount`
- Liability CRUD: `listLiabilities`, `createLiability`, `updateLiability`, `deleteLiability`
- Snapshots: `listSnapshots`, `insertSnapshotIfNeeded`

**Key implementation details:**
- `createAccount` and `createLiability` validate `balance/amount > 0` and `name.trim() nonempty` before hitting Supabase — throws Error pre-flight
- All insert/upsert calls pass `user_id: uid` explicitly (RLS `WITH CHECK (auth.uid() = user_id)` requirement)
- `insertSnapshotIfNeeded` uses `upsert({ onConflict: 'user_id,snapshot_month', ignoreDuplicates: true })` — atomic at DB level, no duplicate can be inserted even under race
- `net_worth` column NOT included in upsert payload (GENERATED ALWAYS AS STORED)
- `snapshot_month` formatted as `'YYYY-MM-01'` (DATE column requires day component)

### `src/queries/netWorth.ts` (~141 LOC)

**9 hooks exported:**
- Account hooks: `useNetWorthAccounts`, `useCreateNetWorthAccount`, `useUpdateNetWorthAccount`, `useDeleteNetWorthAccount`
- Liability hooks: `useNetWorthLiabilities`, `useCreateNetWorthLiability`, `useUpdateNetWorthLiability`, `useDeleteNetWorthLiability`
- Snapshot hook: `useNetWorthSnapshots` (read-only)

**All types re-exported** for downstream consumers (Plan 02/03 can import from `@/queries/netWorth` instead of `@/db/netWorth`).

**Key implementation details:**
- Every `useQuery` hook uses `useTargetUserId()` with `enabled: !!uid` guard (admin view-as support, D-11)
- Create mutations acquire `uid` at hook scope and pass `uid!` to db functions
- All mutations use `onError: (e) => toast.error(mapSupabaseError(e))` for user-facing error display
- `invalidateQueries` uses prefix-only keys (`['net-worth-accounts']`, `['net-worth-liabilities']`) — no uid — ensuring all user variants are invalidated (TanStack Query v5 prefix matching)
- `insertSnapshotIfNeeded` is NOT wrapped in a hook — Plan 02 calls it directly from `useEffect` to avoid render-cycle coupling

## Import Paths for Downstream Plans

```typescript
// Plan 02 (KekayaanTab) — import hooks and db function:
import {
  useNetWorthAccounts, useCreateNetWorthAccount, useUpdateNetWorthAccount, useDeleteNetWorthAccount,
  useNetWorthLiabilities, useCreateNetWorthLiability, useUpdateNetWorthLiability, useDeleteNetWorthLiability,
  useNetWorthSnapshots,
  type NetWorthAccount, type NetWorthAccountInput,
  type NetWorthLiability, type NetWorthLiabilityInput,
  type AccountType, type LiabilityType,
} from '@/queries/netWorth'
import { insertSnapshotIfNeeded } from '@/db/netWorth'  // called directly in useEffect

// Plan 03 (DashboardTab MetricCard #5) — import subset:
import { useNetWorthAccounts, useNetWorthLiabilities, useNetWorthSnapshots } from '@/queries/netWorth'
```

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` exit code | 0 (PASSED) |
| Export count in db file (`grep -E "^export (type\|interface\|async function)"`) | 17 |
| Hook count in queries file (`grep -c "^export function use"`) | 9 |
| `useTargetUserId()` calls in queries | 5 |
| `enabled: !!uid` guards | 3 |
| `mapSupabaseError` usages in mutations | 7 |
| `user_id: uid` in insert/upsert calls | 3 |
| `ignoreDuplicates: true` present | Yes |
| `net_worth:` in upsert payload | No (only in interface definition) |
| `invalidateQueries` uses prefix-only keys | Yes (all 6 calls) |

## Deviations from Plan

None — plan executed exactly as written.

The plan specified an exact list of exports with exact signatures. All were implemented verbatim. The only minor note: the `mapSupabaseError` count is 7 (not 6) — because `useCreateNetWorthAccount` and `useCreateNetWorthLiability` each have their own `onError` plus the 4 update/delete mutations each have one. The minimum of 6 was exceeded, not violated.

## Threat Model Compliance

All T-02-01 through T-02-05 mitigations implemented as specified:

| Threat | Mitigation Status |
|--------|------------------|
| T-02-01 Tampering (user_id injection) | `user_id: uid` passed explicitly; no user_id in *Input interfaces |
| T-02-02 Tampering (negative values) | `balance > 0` / `amount > 0` validation in db layer before Supabase call |
| T-02-03 Information Disclosure (list reads) | `.eq('user_id', uid)` filter on all reads; RLS enforces server-side |
| T-02-04 Tampering (snapshot duplication) | `upsert({ ignoreDuplicates: true, onConflict: 'user_id,snapshot_month' })` |
| T-02-05 Information Disclosure (error display) | `mapSupabaseError` sanitizes errors before toast — no PII/stack traces |

## Known Stubs

None — this plan creates a pure data layer with no UI rendering and no hardcoded placeholder values.

## Threat Flags

None — no new network endpoints beyond what is documented in the threat model. All Supabase operations use the anon key (RLS enforced).

## Self-Check: PASSED

- `src/db/netWorth.ts` exists: FOUND
- `src/queries/netWorth.ts` exists: FOUND
- Commit `69c945a` exists: FOUND
- Commit `7e18b8c` exists: FOUND
- `npx tsc --noEmit` exits 0: CONFIRMED
