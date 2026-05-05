---
phase: 07-ui-data-consistency
plan: "07"
subsystem: frontend-ui
tags: [view-as, csv-import, ux-gate, defense-in-depth]
dependency_graph:
  requires: [07-04]
  provides: [UX-02-layer1, UX-02-layer1.5]
  affects: [src/tabs/TransactionsTab.tsx, src/tabs/InvestmentsTab.tsx]
tech_stack:
  added: []
  patterns: [useViewAs-hook, disabled-prop-gate, handler-early-return-guard]
key_files:
  created: []
  modified:
    - src/tabs/TransactionsTab.tsx
    - src/tabs/InvestmentsTab.tsx
decisions:
  - "D-21: Layer 1 + 1.5 UI gate; Layer 2 server-side RPC deferred to v1.2"
  - "D-22: useViewAs() hook from @/auth/useViewAs as source of viewingAs"
  - "D-23: tooltip wording exact-match 'Tidak tersedia saat View-As'"
  - "D-24: handler early-return guard toast 'Impor CSV tidak tersedia saat View-As'"
  - "D-25: scope TransactionsTab + InvestmentsTab only (confirmed no other import callsites)"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-29"
  tasks_completed: 2
  files_modified: 2
---

# Phase 07 Plan 07: UX-02 View-As CSV Import Gate Summary

UX-02: Disabled Impor CSV button in TransactionsTab + InvestmentsTab with Layer 1 (disabled prop + tooltip) and Layer 1.5 (handler early-return guard) when admin is in View-As mode.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add View-As gate to TransactionsTab Impor CSV button | 0c54d62 | src/tabs/TransactionsTab.tsx |
| 2 | Add View-As gate to InvestmentsTab Impor CSV button | 14b6332 | src/tabs/InvestmentsTab.tsx |

## What Was Done

### 2 Files Modified

**src/tabs/TransactionsTab.tsx** and **src/tabs/InvestmentsTab.tsx** — identical pattern applied to both:

1. Added `import { useViewAs } from '@/auth/useViewAs'`
2. Derived `const { viewingAs } = useViewAs()` and `const isViewAs = viewingAs !== null` inside component body
3. Added `disabled={isViewAs}` + `title={isViewAs ? 'Tidak tersedia saat View-As' : ''}` to Impor button (Layer 1 — D-23)
4. Added early-return guard at top of onClick handler: `if (viewingAs) { toast.error('Impor CSV tidak tersedia saat View-As'); return }` (Layer 1.5 — D-24)

### 4 Buttons Audited (only Impor gated)

| Button | Tab | Gated? | Reason |
|--------|-----|--------|--------|
| Ekspor CSV | TransactionsTab | No | Read-side action — admin can export in View-As |
| Impor CSV | TransactionsTab | YES | Write-side — could accidentally write to viewed user |
| Rutin | TransactionsTab | No | Opens recurring list, read-side |
| Tambah Transaksi | TransactionsTab | No | Has its own auth guards |
| Ekspor CSV | InvestmentsTab | No | Read-side action |
| Impor CSV | InvestmentsTab | YES | Write-side — could accidentally write to viewed user |
| Refresh Harga | InvestmentsTab | No | Retained its own `disabled={refreshPrices.isPending || rows.length === 0}` untouched |
| Tambah Investasi | InvestmentsTab | No | Has its own auth guards |

## Decisions Implemented

- **D-21:** Layer 1 + 1.5 only. Layer 2 server-side `import_transactions_bulk` RPC with `p_user_id` + `is_admin()` check is explicitly DEFERRED to v1.2 per CONTEXT.md `<deferred>` and REQUIREMENTS.md "Future Requirements".
- **D-22:** Source `isViewAs` from `useViewAs()` hook at `@/auth/useViewAs` — existing primitive, no new hook needed.
- **D-23:** Tooltip wording `'Tidak tersedia saat View-As'` — exact-match with ROADMAP SC#5 and UAT-5 verifier string.
- **D-24:** Toast wording `'Impor CSV tidak tersedia saat View-As'` — handler-level early-return guard.
- **D-25:** Scope confirmed: only TransactionsTab + InvestmentsTab have CSV import callsites (no other tabs).

## Threats Addressed

| Threat | Category | Status |
|--------|----------|--------|
| T-07-25: Mouse click on Impor button in View-As | Tampering | Mitigated — Layer 1 `disabled={isViewAs}` |
| T-07-26: Keyboard tab+Enter on disabled button | Tampering | Mitigated — Layer 1.5 handler early-return |
| T-07-27: Dev console manual `.click()` | Tampering | Mitigated — Layer 1.5 handler early-return |
| T-07-28: Direct PostgREST POST from console | Tampering | Accepted via Layer 0 RLS (Phase 5 D-06: `WITH CHECK auth.uid() = user_id`) |

## Layer 2 Deferral

Server-side import RPC with admin-aware `p_user_id` + `is_admin()` check is deferred to v1.2. The current RLS posture (Layer 0) is sufficient: even if Layers 1+1.5 are bypassed via direct PostgREST call, RLS `WITH CHECK auth.uid() = user_id` rejects writes where the target `user_id != admin's auth.uid()`.

## Verification Results

- `grep -c "Tidak tersedia saat View-As" TransactionsTab.tsx` = 1 (title prop only)
- `grep -c "Tidak tersedia saat View-As" InvestmentsTab.tsx` = 1
- `grep -c "Impor CSV tidak tersedia saat View-As" TransactionsTab.tsx` = 1
- `grep -c "Impor CSV tidak tersedia saat View-As" InvestmentsTab.tsx` = 1
- `grep -c "useViewAs" TransactionsTab.tsx` = 2 (import + hook call)
- `npx tsc --noEmit` = exit 0
- `vite build` = exit 0 (2772 modules, 2.58s)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no stubs or placeholder data introduced.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Changes are UI-only (disabled prop + handler guard).

## Next Step

Plan 07-08 (Wave 4, UAT) will verify Browser-MCP behavior on live Vercel deploy: UAT-5 — admin switches to View-As, asserts both Impor buttons are disabled with tooltip, exits View-As, asserts buttons re-enable.

## Self-Check

- [x] `src/tabs/TransactionsTab.tsx` — modified, committed at 0c54d62
- [x] `src/tabs/InvestmentsTab.tsx` — modified, committed at 14b6332
- [x] Both commits exist in git log
- [x] `npx tsc --noEmit` exits 0
- [x] `vite build` exits 0

## Self-Check: PASSED
