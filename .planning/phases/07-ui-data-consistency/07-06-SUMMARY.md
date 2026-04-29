---
phase: 07-ui-data-consistency
plan: "06"
subsystem: lint-config + investment-queries
tags: [eslint, timezone, bug-fix, no-restricted-syntax, WIB]
dependency_graph:
  requires: [07-04]
  provides: [CONS-02]
  affects: [eslint.config.js, src/queries/investments.ts]
tech_stack:
  added: []
  patterns: [no-restricted-syntax AST selector, todayISO() helper]
key_files:
  created: []
  modified:
    - eslint.config.js
    - src/queries/investments.ts
decisions:
  - "D-16: AST selector exact-match CallExpression[callee.object.callee.object.callee.name='Date'][callee.property.name='slice']"
  - "D-17: Severity error (CI block)"
  - "D-18: No exceptions — no eslint-disable inline in any existing file needed"
  - "D-19: Fix callsite investments.ts:111 dengan todayISO() dari @/lib/format"
  - "D-20: todayISO() kept as-is (local-time-based, WIB-correct di browser)"
metrics:
  duration_minutes: 10
  completed_date: "2026-04-29"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 07 Plan 06: ESLint no-restricted-syntax + WIB timezone fix (CONS-02) Summary

**One-liner:** ESLint AST-selector rule blocks `new Date().toISOString().slice()` chain codebase-wide; single callsite at `investments.ts:111` fixed to `todayISO()` eliminating WIB off-by-one date bug.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add no-restricted-syntax rule to eslint.config.js | 7bf93b2 | eslint.config.js |
| 2 | Replace new Date().toISOString().slice with todayISO() at investments.ts:111 | 36fbccf | src/queries/investments.ts |

## Changes Made

### Task 1 — eslint.config.js

Added `rules` block to the existing flat config object (the one with `files: ['**/*.{ts,tsx}']`):

```javascript
rules: {
  'no-restricted-syntax': ['error', {
    selector: "CallExpression[callee.object.callee.object.callee.name='Date'][callee.property.name='slice']",
    message: 'Pakai todayISO() dari @/lib/format — .toISOString().slice(0,10) returns UTC date, bukan WIB',
  }],
},
```

- AST selector matches only the `.toISOString().slice(...)` chain on `new Date()` — full ISO timestamp `new Date().toISOString()` tetap allowed
- Severity `error` (D-17 — CI block)
- Bahasa Indonesia per project constraint Pattern F (D-16)
- Single rule entry, no exceptions (D-18)

### Task 2 — src/queries/investments.ts

**Before (line 111):**
```typescript
const today = new Date().toISOString().slice(0, 10)
```

**After (line 112):**
```typescript
const today = todayISO()
```

**Import added (line 22):**
```typescript
import { todayISO } from '@/lib/format'
```

`todayISO()` uses `new Date().getFullYear()/.getMonth()/.getDate()` — local-time based, WIB-correct di browser (D-19). Variable name `today` preserved; `updatePrice(id, price, today)` downstream unchanged.

## Verification Results

- `grep -rn "new Date().toISOString().slice" src/` → **ZERO MATCHES** (codebase-wide audit clean)
- `grep -F "'no-restricted-syntax'" eslint.config.js` → 1 line (rule present)
- `grep -F "callee.object.callee.object.callee.name='Date'" eslint.config.js` → 1 line (exact D-16 selector)
- `node -e "import('./eslint.config.js').then(() => console.log('ok'))"` → **ok** (file parses)
- `pnpm lint` → exits 1 with **23 pre-existing errors** (deferred Phase 8, STATE.md documented). **Zero `no-restricted-syntax` violations** — confirms no other callsites exist and the fix is clean.
- `npx tsc --noEmit` → **exits 0**
- `npx vite build` → **✓ built in 3.19s** (exits 0)

## Decisions Implemented

| Decision | Description | Status |
|----------|-------------|--------|
| D-16 | AST selector exact: `CallExpression[callee.object.callee.object.callee.name='Date'][callee.property.name='slice']` | Implemented |
| D-17 | Severity `error` (CI block) | Implemented |
| D-18 | No exceptions — no inline eslint-disable needed | Confirmed (zero edge cases) |
| D-19 | Fix investments.ts:111 callsite → todayISO() | Implemented |
| D-20 | todayISO() kept as-is (local-time, WIB-correct browser) | Confirmed |

## Threats Addressed

| Threat | Category | Disposition | Notes |
|--------|----------|-------------|-------|
| T-07-23 | Tampering (client-supplied `date`) | Accepted | Off-by-one TZ bug fixed; client-supplied date validation deferred to v1.2 per D-20 |
| T-07-24 | Tampering (ESLint rule bypass via inline disable) | Mitigated | D-18 no-exceptions policy; if future dev needs bypass must add explicit inline disable + comment — visible in code review |

## Pre-existing Lint Errors (Unrelated — Deferred Phase 8)

The 23 pre-existing errors in STATE.md are unrelated to this plan's rule:
- `react-refresh/only-export-components` in badge.tsx, button.tsx, tabs.tsx, AuthProvider.tsx, ViewAsContext.tsx
- `react-hooks/set-state-in-effect` in ViewAsContext.tsx, AddMoneyDialog.tsx, GoalDialog.tsx, RecurringDialog.tsx, TransactionDialog.tsx
- `@typescript-eslint/no-explicit-any` in AuthProvider.tsx, csvInvestments.ts, investments.ts (db layer)
- `react-hooks/refs` in PensiunTab.tsx
- `react-hooks/exhaustive-deps` warnings in UpcomingBillsPanel.tsx, HitungTotalPanel.tsx

None of these match `no-restricted-syntax`. Rule fire = zero.

## Plan 07-08 UAT Reference

**UAT-2 (CONS-02):** Buka DevTools Network → klik "Refresh Harga" → assert request ke `price_history` POST body `date` field = today's WIB date string (format YYYY-MM-DD). Verifiable after Wave 4 deploy via plan 07-08.

## Deviations from Plan

None — plan executed exactly as written. Pre-existing 23 lint errors confirmed unrelated (per plan objective note). No new violations introduced.

## Self-Check: PASSED

- `eslint.config.js` modified and committed (7bf93b2) — file exists: YES
- `src/queries/investments.ts` modified and committed (36fbccf) — file exists: YES
- Commit 7bf93b2 exists: YES
- Commit 36fbccf exists: YES
- Zero `no-restricted-syntax` violations in lint output: CONFIRMED
- Build exits 0: CONFIRMED
- tsc --noEmit exits 0: CONFIRMED
