---
phase: 4
slug: mark-as-paid
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | PL/pgSQL SQL test script (RPC correctness) + manual UAT (UI flow) |
| **Config file** | `supabase/tests/04-mark-bill-paid.sql` — Wave 0 creates |
| **Quick run command** | `supabase db reset && psql "$DATABASE_URL" -f supabase/tests/04-mark-bill-paid.sql` |
| **Full suite command** | Same + manual UAT checklist in `.planning/phases/04-mark-as-paid/04-UAT.md` |
| **Estimated runtime** | ~20s (SQL) + ~5 min (manual UAT) |

*Note: Per research, no JS unit test framework is installed. Phase 3 precedent is manual UAT for UI behavior. Phase 4 adds an SQL test script specifically because the RPC logic (nextDueDate port with month-end clamping) is too risky to verify manually.*

---

## Sampling Rate

- **After every task commit:** Run type-check + build (`npm run build`) for code tasks, `psql -f` for migration tasks
- **After every plan wave:** Run SQL test script
- **Before `/gsd-verify-work`:** SQL tests pass + manual UAT pass
- **Max feedback latency:** 30 seconds for SQL tests

---

## Per-Task Verification Map

*Populated by planner — each plan task produces rows here. Checker validates coverage before execution.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | BILL-03 | — | RPC is atomic + idempotent | sql | `psql -f supabase/tests/04-mark-bill-paid.sql` | ❌ W0 | ⬜ pending |
| TBD | | | | | | | | | |

---

## Wave 0 Requirements

- [ ] `supabase/tests/04-mark-bill-paid.sql` — test cases for mark_bill_paid RPC (atomicity, idempotency, nextDueDate edge cases incl. 31 Jan → 28/29 Feb, leap year, weekly/monthly/yearly)
- [ ] Reset script snippet documented in plan for local verification

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AlertDialog confirmation flow | BILL-03 | UI behavior; no headless test infra in project | Phase 3 UAT precedent. Click Lunas → verify dialog opens → click Batalkan (no mutation) → click Lunas again → Ya → toast appears, row disappears |
| Toast message appears | BILL-03 | Sonner toast rendering | Verify "✓ Tagihan dilunasi" visible ≤3s after confirm |
| Sisa Aman recalculation | BILL-03 | Cross-widget calculation | Note pre-mark value, mark a bill paid, verify Sisa Aman increases by that bill's amount |
| useProcessRecurring no-duplicate | BILL-03 | Requires remount of useProcessRecurring hook in browser | Mark paid → immediately navigate away and back to dashboard → verify no new transaction created |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s for SQL path
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
