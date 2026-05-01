---
phase: 09-phase-09-qa-bug-fix-fix-semua-bug-dari-qa-findings-md
plan: "02"
subsystem: frontend
tags: [bug-fix, a11y, auth, goals, reports, radix-tabs]
dependency_graph:
  requires: []
  provides: [QA-MEDIUM-3, QA-MEDIUM-4, QA-MEDIUM-5, QA-MEDIUM-6, QA-LOW-7, QA-LOW-8]
  affects:
    - src/tabs/FinansialTab.tsx
    - src/auth/AuthProvider.tsx
    - src/components/AddMoneyDialog.tsx
    - src/components/GoalDialog.tsx
    - src/components/LinkInvestmentDialog.tsx
    - src/tabs/ReportsTab.tsx
tech_stack:
  added: []
  patterns:
    - forceMount on Radix TabsContent to preserve React subtree state
    - AuthProvider error path: getSession error + TOKEN_REFRESHED null session guard
    - DialogDescription for ARIA accessibility on all dialogs
key_files:
  created: []
  modified:
    - path: src/tabs/FinansialTab.tsx
      lines: "16"
      change: "forceMount added to TabsContent value=goals"
    - path: src/auth/AuthProvider.tsx
      lines: "34-72"
      change: "useEffect expanded with error path + TOKEN_REFRESHED guard + toast import"
    - path: src/components/AddMoneyDialog.tsx
      lines: "62"
      change: "remaining calculation includes (investedValue ?? 0)"
    - path: src/components/GoalDialog.tsx
      lines: "2-8 import, 93-95 header, 109-113 label block"
      change: "DialogDescription + renamed label + helper text"
    - path: src/components/LinkInvestmentDialog.tsx
      lines: "2-8 import, 110-113 header"
      change: "DialogDescription added"
    - path: src/tabs/ReportsTab.tsx
      lines: "168"
      change: "Export PDF -> Ekspor PDF"
decisions:
  - "Pre-existing lint errors (any, react-refresh, set-state-in-effect) in all 6 files are deferred — they existed before Phase 9 and are out of scope per STATE.md"
  - "sonner INEFFECTIVE_DYNAMIC_IMPORT build warning is benign — AuthProvider now statically imports sonner which prevents dynamic split, no functional impact"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-05-01"
  tasks_completed: 7
  files_modified: 6
---

# Phase 09 Plan 02: Fix 6 Frontend Bugs (QA Medium + Low) Summary

Fix 6 bug frontend QA-FINDINGS.md (Bug #3-#8): forceMount GoalsTab, AuthProvider refresh-token error handler, AddMoneyDialog remaining formula, GoalDialog label+helper+aria, LinkInvestmentDialog aria, ReportsTab bahasa Indonesia.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix Bug #3 — forceMount GoalsTab | 24edbbd | src/tabs/FinansialTab.tsx |
| 2 | Fix Bug #4 — AuthProvider refresh-token toast | 8beea9c | src/auth/AuthProvider.tsx |
| 3 | Fix Bug #5 — AddMoneyDialog remaining + investedValue | ee8bd4e | src/components/AddMoneyDialog.tsx |
| 4 | Fix Bug #6 + #7 — GoalDialog label + DialogDescription | 2d1cdb9 | src/components/GoalDialog.tsx |
| 5 | Fix Bug #7 — LinkInvestmentDialog DialogDescription | 79b4f95 | src/components/LinkInvestmentDialog.tsx |
| 6 | Fix Bug #8 — ReportsTab Ekspor PDF | 3f492ff | src/tabs/ReportsTab.tsx |
| 7 | Final build + lint sweep | (no new files) | — |

## Bug Fixes Detail

### Bug #3 — GoalsTab filter state reset (QA-MEDIUM-3)
**File:** `src/tabs/FinansialTab.tsx` line 16  
**Fix:** `<TabsContent value="goals" forceMount>` — GoalsTab subtree tetap mounted saat user pindah ke tab Kekayaan, sehingga search filter dan status filter tidak di-reset.  
**Constraint terpenuhi:** TabsContent value="kekayaan" TIDAK mendapat forceMount (chart tetap bisa unmount).

### Bug #4 — Refresh token failure tanpa feedback (QA-MEDIUM-4)
**File:** `src/auth/AuthProvider.tsx` lines 34-72  
**Fix:** 
- Tambah `import { toast } from 'sonner'`
- `getSession()` error path: `toast.error('Sesi berakhir, silakan login kembali')` + `signOut()` + reset state
- `onAuthStateChange` TOKEN_REFRESHED guard: `if (event === 'TOKEN_REFRESHED' && !session)` → same toast + signOut
- `console.error('[AuthProvider]...')` di kedua path (D-12 preserved)

### Bug #5 — AddMoneyDialog "Sisa" tidak akurat (QA-MEDIUM-5)
**File:** `src/components/AddMoneyDialog.tsx` line 62  
**Fix:** `const remaining = Math.max(0, goal.target_amount - goal.current_amount - (investedValue ?? 0))`  
**Prop `investedValue` sudah ada** — hanya formula yang dikoreksi.

### Bug #6 — GoalDialog label kas-only tidak jelas (QA-MEDIUM-6)
**File:** `src/components/GoalDialog.tsx` lines 109-113  
**Fix:**
- Label: `'Sudah Terkumpul (Rp)'` → `'Dana Kas Terkumpul (Rp)'`
- Helper text: `<p className="text-xs text-muted-foreground">Investasi terhubung dihitung otomatis dari portofolio</p>`

### Bug #7 — Missing aria-describedby console warning (QA-LOW-7)
**Files:** `src/components/GoalDialog.tsx` + `src/components/LinkInvestmentDialog.tsx`  
**Fix:** Tambah `DialogDescription` ke import dan JSX DialogHeader di kedua file:
- GoalDialog: `Buat atau edit goal keuangan Anda.`
- LinkInvestmentDialog: `Hubungkan investasi ke goal ini dengan menentukan persentase alokasi.`

### Bug #8 — Export PDF tidak bahasa Indonesia (QA-LOW-8)
**File:** `src/tabs/ReportsTab.tsx` line 168  
**Fix:** `Export PDF` → `Ekspor PDF` (konsisten dengan Transaksi/Investasi tabs)

## Build + Lint Results

```
npx tsc --noEmit     → EXIT 0 (zero TypeScript errors)
npm run build        → EXIT 0 (Vite build success, dist/ artifacts generated)
```

**ESLint 6 file Phase 9:** 6 errors reported — semua **pre-existing** sebelum Phase 9 perubahan:
- `AuthProvider.tsx` line 22: `@typescript-eslint/no-explicit-any` (function parameter `meta: Record<string, any>`) — pre-existing
- `AuthProvider.tsx` line 93: `react-refresh/only-export-components` — pre-existing (`useAuthContext` exported alongside component)
- `AddMoneyDialog.tsx` line 33: `react-hooks/set-state-in-effect` — pre-existing
- `GoalDialog.tsx` line 45: `react-hooks/set-state-in-effect` — pre-existing
- `LinkInvestmentDialog.tsx` lines 57+65: `react-hooks/set-state-in-effect` (2x) — pre-existing

Dikonfirmasi dengan `git stash` + lint pada original files — errors identik sebelum perubahan Phase 9.

**Build warning** `INEFFECTIVE_DYNAMIC_IMPORT` untuk sonner — benign, karena AuthProvider.tsx sekarang mengimport sonner secara statis (benar), bukan regression.

## Deviations from Plan

None — plan executed exactly as written. Semua 6 file dimodifikasi sesuai action verbatim. Pre-existing lint errors tidak di-fix sesuai scope boundary (STATE.md: "23 lint errors pre-existing").

## Known Stubs

None. Semua perubahan menyambungkan logic nyata (investedValue sudah di-pass dari caller, DialogDescription menggunakan string literal, toast memanggil supabase.auth.signOut).

## Threat Flags

Tidak ada surface baru di luar threat model. T-09-07 sampai T-09-11 sudah dianalisis di plan frontmatter — semua disposition `accept` atau `mitigate` dengan justifikasi lengkap.

## Self-Check: PASSED

Files exist:
- src/tabs/FinansialTab.tsx — FOUND
- src/auth/AuthProvider.tsx — FOUND
- src/components/AddMoneyDialog.tsx — FOUND
- src/components/GoalDialog.tsx — FOUND
- src/components/LinkInvestmentDialog.tsx — FOUND
- src/tabs/ReportsTab.tsx — FOUND

Commits exist:
- 24edbbd — fix(09-02): add forceMount to GoalsTab TabsContent — bug #3
- 8beea9c — fix(09-02): AuthProvider toast + signOut on refresh-token failure — bug #4
- ee8bd4e — fix(09-02): AddMoneyDialog remaining subtracts investedValue — bug #5
- 2d1cdb9 — fix(09-02): GoalDialog DialogDescription + label + helper text — bug #6 + #7
- 79b4f95 — fix(09-02): LinkInvestmentDialog add DialogDescription — bug #7
- 3f492ff — fix(09-02): ReportsTab button text Export PDF -> Ekspor PDF — bug #8
