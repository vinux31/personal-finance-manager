---
phase: 14
slug: protection-tier4-checklists
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-09
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- --run <file>` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command on touched file
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DIAG-04, DIAG-09, DIAG-12 | TBD | TBD | unit/integration | TBD | ❌ W0 | ⬜ pending |

*Planner fills this table during plan creation. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/queries/protectionChecklist.test.ts` — mutation hook + cache invalidation tests for `['kesehatan', 'protection-checklist', uid]`
- [ ] `src/lib/kesehatan/kesehatanTier4.test.ts` — Tier 4 aggregation logic (NULL→red, binary green/red, dependents gate)
- [ ] `src/lib/kesehatan/kesehatanTier1.test.ts` — extend existing for #4 indikator color logic
- [ ] vitest already installed — no framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| View-As read-only enforcement (UI disabled state) | DIAG-12 | RLS already covered via DB; UI disabled state needs visual confirmation | Login admin → enable View-As user → expand Tier 1 / Tier 4 → verify radio inputs disabled, no submit handler fires |
| Optimistic update rollback on Supabase error | A2/Decision C | Failure path needs network mock or live failure | Toggle Wi-Fi off mid-save → verify toast "Gagal simpan" + revert UI |
| Smart-gate Tier 4 conditional render | DIAG-09 | Visual flow easier to confirm by hand | Set has_dependents=Ya → 6 items render; toggle Tidak → only 3 estate items render; preserve life_* values on toggle |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
