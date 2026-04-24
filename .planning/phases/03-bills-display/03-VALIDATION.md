---
phase: 3
slug: bills-display
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library/react |
| **Config file** | `vitest.config.ts` (if present) or `vite.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | BILL-01 | — | Query only returns is_active=true, type=expense for current user | unit | `npx vitest run` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | BILL-02 | — | Color-coding computed correctly from dayDiff | unit | `npx vitest run` | ✅ | ⬜ pending |
| 03-01-03 | 01 | 1 | BILL-04 | — | Sisa Aman formula: income − expense − unpaid bills | unit | `npx vitest run` | ✅ | ⬜ pending |
| 03-01-04 | 01 | 1 | NAV-02 | — | Widget renders in Dashboard without breaking existing layout | manual | visual inspect | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/__tests__/UpcomingBillsPanel.test.tsx` — unit stubs for BILL-01, BILL-02, BILL-04
- [ ] `src/hooks/__tests__/useUpcomingBills.test.ts` — stubs for query logic

*If testing infrastructure already exists (vitest/jest), these are new test files only — no install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Widget renders correctly in Dashboard | NAV-02 | Visual layout, responsive behavior | Open Dashboard, verify Bills widget appears below existing panels |
| Color-coding visual correctness | BILL-02 | Color rendering depends on browser/Tailwind | Inspect overdue=red, ≤7d=yellow, >7d=gray tags in widget |
| Sisa Aman updates on data change | BILL-04 | Reactive UI behavior | Add/remove a recurring template, verify Sisa Aman recalculates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
