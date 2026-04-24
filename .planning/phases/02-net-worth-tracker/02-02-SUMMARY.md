---
phase: 02-net-worth-tracker
plan: "02"
subsystem: net-worth-ui
tags: [react, dialog, recharts, ui, tab, crud]
dependency_graph:
  requires: [02-01]
  provides: [KekayaanTab, NetWorthAccountDialog, NetWorthLiabilityDialog]
  affects: [FinansialTab]
tech_stack:
  added: []
  patterns:
    - GoalDialog pattern for controlled dialog state with useEffect populate
    - ConfirmDialog with discriminant confirmTarget for multi-entity routing
    - Auto-snapshot useEffect with loading guard (Pitfall 2 from RESEARCH.md)
    - Recharts AreaChart with linearGradient defs fill
key_files:
  created:
    - src/components/NetWorthAccountDialog.tsx
    - src/components/NetWorthLiabilityDialog.tsx
    - src/tabs/KekayaanTab.tsx
  modified:
    - src/tabs/FinansialTab.tsx
decisions:
  - KekayaanTab uses single ConfirmDialog with `confirmTarget.type` discriminant to route account vs liability deletes — avoids two separate confirm state pairs
  - investasi row rendered only when `totalInvestments > 0`; shown inside accounts section space-y-3 after editable cards
  - Auto-snapshot deps array includes all 5 totals plus loading flags so snapshot fires once after data resolves and re-fires if totals change within same session
metrics:
  duration_minutes: 15
  completed_date: "2026-04-24"
  tasks_completed: 2
  files_changed: 4
  loc_added: 757
---

# Phase 02 Plan 02: Net Worth UI — Dialogs + KekayaanTab Summary

**One-liner:** Full KekayaanTab with summary gradient card, 2 CRUD sections, read-only investasi row, AreaChart tren, auto-snapshot — plus 2 dialogs following GoalDialog pattern.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create NetWorthAccountDialog + NetWorthLiabilityDialog | b8dcfc3 | src/components/NetWorthAccountDialog.tsx (162 LOC), src/components/NetWorthLiabilityDialog.tsx (158 LOC) |
| 2 | Create KekayaanTab + wire FinansialTab | 517a079 | src/tabs/KekayaanTab.tsx (415 LOC), src/tabs/FinansialTab.tsx (22 LOC, +2 lines) |

---

## Files Created / Modified

| File | Action | LOC | Description |
|------|--------|-----|-------------|
| `src/components/NetWorthAccountDialog.tsx` | Created | 162 | Add/edit dialog for accounts; 7 AccountType options via Select; follows GoalDialog pattern |
| `src/components/NetWorthLiabilityDialog.tsx` | Created | 158 | Add/edit dialog for liabilities; 5 LiabilityType options; identical structure |
| `src/tabs/KekayaanTab.tsx` | Created | 415 | Full net worth tab: summary card, accounts CRUD, liabilities CRUD, investasi read-only row, AreaChart tren, auto-snapshot |
| `src/tabs/FinansialTab.tsx` | Modified | 22 | Added `import KekayaanTab` + replaced placeholder TabsContent with `<KekayaanTab />` |

---

## Acceptance Criteria Verification

### Task 1 — Dialogs

- [x] `src/components/NetWorthAccountDialog.tsx` exists with `export default function NetWorthAccountDialog`
- [x] `src/components/NetWorthLiabilityDialog.tsx` exists with `export default function NetWorthLiabilityDialog`
- [x] Account dialog contains: `'Tambah Akun'`, `'Edit Akun'`, `ACCOUNT_TYPE_LABELS`, `parseRupiah(balanceStr)`, `useCreateNetWorthAccount`, `useUpdateNetWorthAccount`
- [x] Account dialog contains all 7 AccountType keys (16 grep matches)
- [x] Liability dialog contains: `'Tambah Liabilitas'`, `'Edit Liabilitas'`, `LIABILITY_TYPE_LABELS`, `useCreateNetWorthLiability`, `useUpdateNetWorthLiability`, `parseRupiah(amountStr)`
- [x] Liability dialog contains all 5 LiabilityType keys (12 grep matches)
- [x] Neither dialog references `user_id` (0 matches in both files)
- [x] `npx tsc --noEmit` exits 0

### Task 2 — KekayaanTab + FinansialTab

- [x] `src/tabs/KekayaanTab.tsx` exists with `export default function KekayaanTab`
- [x] Contains all required literal strings: gradient, 'Net Worth', 'Aset & Rekening', 'Liabilitas', 'Tren Net Worth', 'Tambah Akun', 'Tambah Liabilitas', 'otomatis', 'Nilai Investasi', 'Belum ada data tren'
- [x] `insertSnapshotIfNeeded(uid` called (2 matches — import + call)
- [x] `accountsLoading` and `liabilitiesLoading` both present as guards (6 total refs: 2 declarations + 2 useEffect + 2 loading state JSX)
- [x] `linearGradient id="netWorthGradient"` and `fill="url(#netWorthGradient)"` present
- [x] `.slice(-6)` present
- [x] `padStart(2, '0')` present, month key ends with `-01`
- [x] investasi row guarded by `totalInvestments > 0`, has `<Badge variant="secondary"` with `otomatis`, NO Pencil/Trash2 in that block
- [x] All 4 aria-labels present (Edit akun, Hapus akun, Edit liabilitas, Hapus liabilitas)
- [x] `src/tabs/FinansialTab.tsx` contains `import KekayaanTab from '@/tabs/KekayaanTab'`
- [x] `src/tabs/FinansialTab.tsx` contains `<KekayaanTab />`
- [x] Placeholder string `Fitur Kekayaan (Net Worth) akan hadir di Phase 2` removed
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run build` exits 0

---

## Deviations from Plan

None — plan executed exactly as written.

All UI-SPEC contracts followed:
- Summary card uses `linear-gradient(135deg, #6366f1, #818cf8)` per D-07
- Account/liability card left border `4px solid var(--brand)` per GoalCard pattern
- Month key `YYYY-MM-01` format per Pitfall 4
- Loading guard `!uid || accountsLoading || liabilitiesLoading` per Pitfall 2 / T-02-08

---

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-02-06 | Mitigated — client validation `parseRupiah > 0` + `name.trim()` in both dialogs before mutation |
| T-02-07 | Mitigated — queries use `useTargetUserId()`, RLS enforces per-user filtering |
| T-02-08 | Mitigated — loading guard in useEffect: `if (!uid || accountsLoading || liabilitiesLoading) return` |
| T-02-09 | Mitigated — React JSX escapes all `{a.name}` interpolations; no `dangerouslySetInnerHTML` |
| T-02-10 | Accepted — no audit log, ConfirmDialog provides friction |
| T-02-11 | Mitigated — DB UNIQUE + `ignoreDuplicates: true` makes auto-snapshot idempotent |

---

## Known Stubs

None — all data sources are wired. The investasi row shows real data from `useInvestments()` + `currentValue()`. The summary card totals are computed from live query data. The chart renders real snapshots from `useNetWorthSnapshots()`.

---

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. All surface was accounted for in the plan's threat model.

---

## Notes for Plan 03 Implementer (DashboardTab)

- Snapshot row format: `{ snapshot_month: 'YYYY-MM-01', total_accounts: number, total_investments: number, total_liabilities: number, net_worth: number }` where `net_worth` is a GENERATED ALWAYS AS column (computed by DB, not sent in upsert payload).
- `useNetWorthSnapshots()` returns rows sorted ASC by `snapshot_month` from the DB layer — safe to use `.slice(-2)` for trend calculation without re-sorting.
- `useNetWorthAccounts()` queryKey is `['net-worth-accounts', uid]` — use same key for cache invalidation from DashboardTab if needed (though Dashboard only reads, not mutates).
- Dashboard MetricCard gradient branch needs to render `trend` badge — see PATTERNS.md section `DashboardTab.tsx` for the extended `if (gradient)` branch with `trendColor`/`trendArrow` logic.

---

## Browser Checkpoint (Task 3)

Status: PENDING — awaiting user verification of 14 browser steps.

---

## Self-Check

- [x] `src/components/NetWorthAccountDialog.tsx` exists
- [x] `src/components/NetWorthLiabilityDialog.tsx` exists
- [x] `src/tabs/KekayaanTab.tsx` exists
- [x] `src/tabs/FinansialTab.tsx` modified
- [x] Commit b8dcfc3 exists (Task 1)
- [x] Commit 517a079 exists (Task 2)

## Self-Check: PASSED
