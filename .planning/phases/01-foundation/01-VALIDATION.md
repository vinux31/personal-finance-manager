---
phase: 1
slug: foundation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — no test framework detected in codebase |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~10-30 seconds |

**D-10 decision (from CONTEXT.md):** Tidak perlu unit test file di fase ini — verifikasi manual cukup. Phase 1 hanya mengubah 1 fungsi utilitas, 2 file migrasi SQL baru (tidak dieksekusi), dan 1 komponen wrapper navigasi. Risiko regresi ditangani dengan grep assertions dan inline CLI scripts per-task.

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green + human verification checkpoints (Plan 02 Task 3, Plan 03 Task 3) passed
- **Max feedback latency:** ~30 seconds (TypeScript check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 01-01-T1 | 01 | 1 | FOUND-01 | T-01-02 | nextDueDate clamping does not infinite-loop | inline script | `npx tsx -e "import('./src/db/recurringTransactions.ts').then(m => { const cases = [['2024-01-31','2024-02-29'],['2025-01-31','2025-02-28'],['2024-03-31','2024-04-30'],['2024-05-31','2024-06-30'],['2024-12-31','2025-01-31'],['2024-01-15','2024-02-15']]; let ok=true; for (const [i,e] of cases) { const a = m.nextDueDate(i,'monthly'); if (a!==e) { console.error('FAIL',i,'->',a,'expected',e); ok=false } else { console.log('PASS',i,'->',a) } } if (!ok) process.exit(1) })"` | ⬜ pending |
| 01-02-T1 | 02 | 1 | FOUND-02 | T-02-01 | 3 tables with RLS created | grep | `grep -c "CREATE TABLE" supabase/migrations/0012_net_worth.sql \| grep -q "^3$" && grep -c "ENABLE ROW LEVEL SECURITY" supabase/migrations/0012_net_worth.sql \| grep -q "^3$" && echo OK` | ⬜ pending |
| 01-02-T2 | 02 | 1 | FOUND-02 | T-02-01 | bill_payments RLS + FK created | grep | `grep -c "CREATE TABLE" supabase/migrations/0013_bill_payments.sql \| grep -q "^1$" && grep -q "REFERENCES recurring_templates(id) ON DELETE CASCADE" supabase/migrations/0013_bill_payments.sql && echo OK` | ⬜ pending |
| 01-02-T3 | 02 | 1 | FOUND-02 | T-02-01, T-02-02 | cross-user isolation verified | manual | see Plan 02 Task 3 how-to-verify | ⬜ pending |
| 01-03-T1 | 03 | 1 | NAV-01 | T-03-01 | FinansialTab renders, TS clean | grep + tsc | `test -f src/tabs/FinansialTab.tsx && grep -q 'defaultValue="kekayaan"' src/tabs/FinansialTab.tsx && npx tsc --noEmit && echo OK` | ⬜ pending |
| 01-03-T2 | 03 | 1 | NAV-01 | T-03-02 | App.tsx updated, unused import removed | grep + tsc | `grep -q "import FinansialTab" src/App.tsx && ! grep -q "import GoalsTab" src/App.tsx && grep -q "label: 'Finansial'" src/App.tsx && npx tsc --noEmit && echo OK` | ⬜ pending |
| 01-03-T3 | 03 | 1 | NAV-01 | T-03-01 | end-to-end nav works in browser | manual | see Plan 03 Task 3 how-to-verify | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Tidak ada Wave 0 — tidak ada test framework yang perlu di-install. TypeScript (`npx tsc --noEmit`) sudah tersedia sebagai fast feedback loop.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RLS cross-user isolation: query dari User B tidak melihat data User A | FOUND-02 | Membutuhkan 2 akun aktif di Supabase dan akses SQL editor | Ikuti Plan 02 Task 3 steps 1-7 |
| Admin dapat read semua data tapi tidak bisa write sebagai user lain | FOUND-02 | Membutuhkan akun admin dan non-admin | Plan 02 Task 3 steps 5-6 |
| Tab "Finansial" tampil dengan 2 sub-tab, navigasi berjalan normal | NAV-01 | Membutuhkan browser + dev server | Plan 03 Task 3 steps 1-9 |
| Semua tab lain (Dashboard, Transaksi, dll.) tidak ada regresi | NAV-01 (scope: no regressions) | Hanya bisa diverifikasi di browser | Plan 03 Task 3 step 7 |

---

## Validation Sign-Off

- [x] Semua tasks punya `<automated>` verify atau manual checkpoint (tidak ada task tanpa verifikasi)
- [x] Sampling continuity: TypeScript check runs after every task
- [x] Tidak ada Wave 0 dependencies (no framework to install)
- [x] Tidak ada watch-mode flags
- [x] Feedback latency < 30s (`npx tsc --noEmit`)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
