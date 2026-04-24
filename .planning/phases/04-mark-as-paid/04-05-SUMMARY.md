---
phase: 04-mark-as-paid
plan: "05"
subsystem: client-integration
tags: [react, tanstack-query, shadcn, radix, supabase-rpc, optimistic-update]

# Dependency graph
requires:
  - phase: 04-mark-as-paid/01
    provides: "mark_bill_paid RPC (signature p_template_id/p_uid/p_paid_date → transaction_id/bill_payment_id/new_next_due)"
  - phase: 04-mark-as-paid/02
    provides: "upcoming_bills_unpaid VIEW (projects RecurringTemplate columns, filters active expense bills unpaid this month)"
  - phase: 04-mark-as-paid/04
    provides: "Migrations 0014+0015 live in Supabase Cloud — client can call RPC + view against real DB"
provides:
  - "src/components/ui/alert-dialog.tsx — shadcn AlertDialog wrapper (12 named components, radix-ui meta barrel idiom)"
  - "markBillPaid(templateId, uid, paidDate) DB wrapper calling supabase.rpc('mark_bill_paid', ...)"
  - "MarkBillPaidResult type (transaction_id, bill_payment_id, new_next_due)"
  - "listUpcomingBills refactored to query upcoming_bills_unpaid view — signature unchanged, drops is_active + type filters"
  - "useMarkBillPaid mutation hook with optimistic update + snapshot rollback + full invalidation set"
  - "First optimistic TanStack mutation in the project — pattern set for future phases"
affects: [04-mark-as-paid/06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "shadcn AlertDialog generated via CLI (radix-nova style) — uses radix-ui meta barrel import matching existing dialog.tsx"
    - "Supabase RPC wrapper at DB layer throws raw error; mapping to user-facing Bahasa via mapSupabaseError happens in hook layer (addMoneyToGoal precedent)"
    - "Optimistic cache update pattern: cancelQueries + getQueriesData snapshot + setQueriesData optimistic filter → onError rollback via forEach setQueryData"
    - "View swap without signature change: listUpcomingBills query source moved from .from('recurring_templates') to .from('upcoming_bills_unpaid'); view's column list matches RecurringTemplate interface so callers untouched"
    - "Admin view-as plumbing: useTargetUserId() supplies uid to mutation; uid ?? null (not ||) preserves undefined semantics to let RPC resolve COALESCE(p_uid, auth.uid())"

key-files:
  created:
    - "src/components/ui/alert-dialog.tsx"
  modified:
    - "src/db/recurringTransactions.ts"
    - "src/queries/recurringTransactions.ts"

key-decisions:
  - "Used shadcn CLI (npx shadcn add alert-dialog) — zero hand-authoring; generated file already uses radix-ui meta barrel matching dialog.tsx convention"
  - "listUpcomingBills signature kept IDENTICAL to Phase 3 — only the .from() source and redundant filters changed. useUpcomingBills and all Plan 06 callers need no updates."
  - "Invalidation keys = ['upcoming-bills','transactions','reports','recurring-templates'] — CONTEXT D-02 said 'aggregate' but actual query key in src/queries/reports.ts is ['reports', ...] per research; used actual key"
  - "Optimistic update via qc.setQueriesData (plural) — one mutation can correspond to multiple cache entries (different uid × endOfMonth combos); single setQueryData would miss some"
  - "uid ?? null preserves the 'undefined = caller uid' semantic from DB wrapper; did not use `|| null` because empty string is not a valid UUID and should not coerce silently"
  - "Raw error throw in markBillPaid (not mapped) — mirrors addMoneyToGoal precedent; mapping to Bahasa happens at hook onError using mapSupabaseError"

patterns-established:
  - "Pattern: shadcn AlertDialog wrapper — destructive confirmation UX with correct a11y semantics (role='alertdialog'), first in project"
  - "Pattern: TanStack v5 optimistic mutation — cancelQueries + getQueriesData snapshot + setQueriesData optimistic update + onError forEach rollback + onSettled full invalidation"
  - "Pattern: View-swap at query layer — DB migration introduces a VIEW with same column shape as the underlying table, client swaps .from() target without touching signature or callers"

requirements-completed: [BILL-03]

# Metrics
duration: ~12min
completed: 2026-04-24
---

# Phase 04 Plan 05: Client Integration Wave Summary

**Shadcn AlertDialog installed; markBillPaid DB wrapper + MarkBillPaidResult type added; listUpcomingBills silently swapped to upcoming_bills_unpaid view; useMarkBillPaid mutation hook with optimistic update + full invalidation set — all ready for Plan 06 UI wiring.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-24
- **Completed:** 2026-04-24
- **Tasks:** 3
- **Files modified/created:** 3 (1 created, 2 modified)

## Accomplishments

- **Task 1**: Generated `src/components/ui/alert-dialog.tsx` via `npx shadcn add alert-dialog --yes`. CLI output included 12 components (AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogOverlay, AlertDialogPortal, AlertDialogTitle, AlertDialogTrigger) using the `radix-ui` meta barrel import that matches the project's `dialog.tsx` convention. No hand-editing required; file was usable as-generated. No npm packages added.
- **Task 2**: Appended `markBillPaid` + `MarkBillPaidResult` exports to `src/db/recurringTransactions.ts` using the `addMoneyToGoal` RPC-wrapper pattern. Simultaneously refactored `listUpcomingBills` to SELECT from the `upcoming_bills_unpaid` view (dropping the now-redundant `.eq('is_active', true)` and `.eq('type', 'expense')` filters). All other exports in the file untouched.
- **Task 3**: Appended `useMarkBillPaid` hook to `src/queries/recurringTransactions.ts`. Imports updated to include `markBillPaid` + `MarkBillPaidResult`. Re-export line updated. Hook implements the full optimistic-update pattern: `onMutate` cancels refetches + snapshots + optimistically filters; `onError` rolls back all snapshots + toasts mapped error; `onSuccess` toasts '✓ Tagihan dilunasi'; `onSettled` invalidates 4 prefixes.
- TypeScript type-check clean for all three files (`npx tsc --noEmit` exits 0).
- Vite production build succeeds (`npm run build` exit 0, 2768 modules transformed, 2.78s).

## Task Commits

Each task committed atomically:

1. **Task 1: Install shadcn AlertDialog component via CLI** — `cc3950d` (feat)
2. **Task 2: Append markBillPaid + refactor listUpcomingBills to view** — `ebc070e` (feat)
3. **Task 3: Append useMarkBillPaid mutation hook with optimistic update** — `55d10f4` (feat)

## Files Created/Modified

- **src/components/ui/alert-dialog.tsx** (created) — shadcn wrapper, radix-ui meta barrel import, 12 named exports, uses `cn()` for className merging. Not yet consumed — Plan 06 imports it for the per-row confirmation dialog.
- **src/db/recurringTransactions.ts** (modified) — +33/-3 lines. Added `MarkBillPaidResult` interface, `markBillPaid()` async function with RPC call using exact param names `p_template_id`/`p_uid`/`p_paid_date`. Refactored `listUpcomingBills` to query `upcoming_bills_unpaid` view; signature preserved so existing callers work unchanged.
- **src/queries/recurringTransactions.ts** (modified) — +46/-1 lines. Imports updated to include `markBillPaid` + `MarkBillPaidResult`. Re-export line extended. `useMarkBillPaid()` appended with full optimistic-update lifecycle: onMutate / onError / onSuccess / onSettled. Uses `useTargetUserId()` for admin view-as support. All 4 invalidation prefixes correct (`upcoming-bills`, `transactions`, `reports`, `recurring-templates`).

## Decisions Made

See frontmatter `key-decisions`. Most consequential:
- **Invalidation prefix `['reports']` not `['aggregate']`** — CONTEXT.md D-02 prose referred to "aggregate" but RESEARCH discovered the actual query key in `src/queries/reports.ts` is `['reports', 'period', ...]`. Used the actual key. Plan acceptance criterion explicitly mandated `['reports']`.
- **Signature preservation on listUpcomingBills** — the view projects the same columns as the underlying table, so the TS interface and caller signature could stay identical. This is why the swap is silent — Plan 06 and the existing `useUpcomingBills` need zero updates.
- **`uid ?? null` in RPC call** — chose `??` over `||` so that `undefined` → `null` (letting the RPC resolve via `COALESCE(p_uid, auth.uid())`) while empty-string or 0 are NOT coerced (neither is valid UUID anyway). Plan mandated this exact form.

## Verification

All 3 × verify blocks passed without deviation:

### Task 1 (6/6)
| Check | Expected | Actual |
|-------|----------|--------|
| File exists | 0 | 0 (OK) |
| `AlertDialog ` count | ≥1 | 1 |
| AlertDialog subcomponent names | ≥8 | 16 |
| AlertDialogPrimitive references | ≥5 | 19 |
| cn() usage | ≥2 | 9 |
| tsc --noEmit for this file | 0 errors | 0 |

### Task 2 (12/12)
| Check | Expected | Actual |
|-------|----------|--------|
| `export async function markBillPaid` | 1 | 1 |
| `export interface MarkBillPaidResult` | 1 | 1 |
| `supabase.rpc('mark_bill_paid'` | 1 | 1 |
| `p_template_id: templateId` | 1 | 1 |
| `p_uid: uid ?? null` | 1 | 1 |
| `p_paid_date: paidDate` | 1 | 1 |
| `from('upcoming_bills_unpaid')` | 1 | 1 |
| `from('recurring_templates')` | ≥3 | 4 (listRecurringTemplates, create, update, delete) |
| `.eq('is_active', true)` | 0 | 0 |
| `.eq('type', 'expense')` | 0 | 0 |
| tsc clean for this file | 0 errors | 0 |
| `export function nextDueDate` | 1 | 1 (untouched) |

### Task 3 (16/16)
| Check | Expected | Actual |
|-------|----------|--------|
| `export function useMarkBillPaid` | 1 | 1 |
| `markBillPaid,` in import | 1 | 1 |
| `type MarkBillPaidResult` | 2 (import + re-export) | 2 |
| `onMutate: async` | 1 | 1 |
| `qc.cancelQueries` | 1 | 1 |
| `qc.getQueriesData` | 1 | 1 |
| `qc.setQueriesData` | 1 | 1 |
| `queryKey: ['upcoming-bills']` | ≥3 | 4 (cancel + get + set + invalidate) |
| `queryKey: ['transactions']` | 1 | 1 |
| `queryKey: ['reports']` | 1 | 1 |
| `queryKey: ['recurring-templates']` | ≥4 | 4 (3 existing + 1 new) |
| `'✓ Tagihan dilunasi'` | 1 | 1 |
| `mapSupabaseError(err)` | 1 | 1 |
| `useTargetUserId()` | ≥2 | 3 (useRecurringTemplates + useUpcomingBills + useMarkBillPaid) |
| tsc clean | 0 errors | 0 |
| npm run build | exit 0 | exit 0 (2.78s) |

## Deviations from Plan

None — plan executed exactly as written. All three task actions were applied verbatim from the `<action>` blocks; no Rule 1/2/3 auto-fixes were needed. No architectural decisions required (no Rule 4).

## Issues Encountered

**Read-before-edit hook reminders:** After each `Edit` call on `src/db/recurringTransactions.ts` and `src/queries/recurringTransactions.ts`, the environment emitted `PreToolUse:Edit` reminders to re-read the file despite having read both files at execution start. The edits had already been applied successfully in each case (confirmed via follow-up Read). This is a harness-level reminder pattern, not a code issue — no work lost, no retries needed.

## Known Stubs

None. The three artefacts are production-ready:
- `alert-dialog.tsx` is complete shadcn output ready for UI import
- `markBillPaid` is wired to the live cloud RPC (verified live per 04-04 summary)
- `useMarkBillPaid` is wired to the live view-based query

Bills can be marked paid end-to-end once Plan 06 wires the UI trigger.

## Threat Flags

None. All files align with the plan's threat model:
- **T-04-14 (error leak)**: `onError` path uses `mapSupabaseError(err)` before `toast.error` — DB errors translated to user-safe Bahasa
- **T-04-15 (optimistic drift)**: `onMutate` snapshots cache; `onError` rolls back via `forEach setQueryData`; `onSettled` invalidates regardless of success/failure to reconcile with server
- **T-04-16 (EoP)**: client passes templateId to RPC; RPC enforces ownership via `WHERE user_id = v_uid` guard per Plan 01 migration — no client-side escalation possible
- **T-04-17 (tz mismatch)**: `markBillPaid` jsdoc explicitly documents "use todayISO() from @/lib/format — never new Date().toISOString()" (Plan 06 will consume this)

No new trust boundaries introduced; no new endpoints, auth paths, or schema changes beyond what Plans 01/02/04 already delivered.

## User Setup Required

None. Alt-dialog CLI ran autonomously with `--yes`. No packages added (Radix primitive already bundled via `radix-ui@1.4.3`). DB already deployed per Plan 04. Plan 06 can import `useMarkBillPaid` and `AlertDialog*` components directly.

## Next Phase Readiness

- **Plan 06 (UI integration) unblocked**: can import `useMarkBillPaid` from `@/queries/recurringTransactions` and all `AlertDialog*` components from `@/components/ui/alert-dialog`. Pattern to wire in `UpcomingBillsPanel.tsx`:
  ```typescript
  const markPaid = useMarkBillPaid()
  // onClick:
  markPaid.mutate(
    { templateId: selectedBill.id, paidDate: todayISO() },
    { onSuccess: () => setSelectedBill(null) }
  )
  ```
- **Sisa Aman D-03 auto-fix**: since `listUpcomingBills` now returns only unpaid bills, the existing client-side `sum(bills.amount)` in `UpcomingBillsPanel` automatically satisfies the D-03 formula — no arithmetic change needed in Plan 06.

## Self-Check: PASSED

- FOUND: src/components/ui/alert-dialog.tsx
- FOUND: src/db/recurringTransactions.ts (with markBillPaid + MarkBillPaidResult + refactored listUpcomingBills)
- FOUND: src/queries/recurringTransactions.ts (with useMarkBillPaid + updated imports/re-exports)
- FOUND: commit cc3950d
- FOUND: commit ebc070e
- FOUND: commit 55d10f4

---
*Phase: 04-mark-as-paid*
*Plan: 05*
*Completed: 2026-04-24*
