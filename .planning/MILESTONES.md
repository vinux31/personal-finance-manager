# Milestones

## Completed

### v1.0 Financial Foundation (Shipped: 2026-04-25)

**Phases completed:** 4 phases · 14 plans · 17 tasks

**Goal:** Tambahkan Net Worth Tracker dan Upcoming Bills Calendar sebagai fondasi finansial.

**Started:** 2026-04-23 · **Shipped:** 2026-04-25 (3 days)

**Key accomplishments:**

- 4 tabel PostgreSQL (net_worth_accounts, net_worth_liabilities, net_worth_snapshots, bill_payments) dengan RLS cross-user isolation dan computed `net_worth` GENERATED ALWAYS AS STORED
- Atomic `mark_bill_paid` RPC (migration 0014) — single operation creates expense + bill_payment + advances next_due_date dengan FOR UPDATE race safety dan FOUND-01 month-end clamp parity
- First VIEW in project: `upcoming_bills_unpaid` (security_invoker) — projection bill aktif belum dibayar bulan ini, enabling Sisa Aman formula tanpa client changes
- First SQL integration test (`supabase/tests/04-mark-bill-paid.sql`) — 6 sections, BEGIN/ROLLBACK wrapper, RAISE NOTICE PASS/FAIL assertions
- UpcomingBillsPanel wired dengan optimistic mutation + AlertDialog confirmation + Playwright UAT approved on live cloud DB
- nextDueDate month-end overflow bug (FOUND-01) fixed; navigasi restructured (tab Goals → Finansial dengan sub-tab Goals/Kekayaan)

**Audit verdict:** PASS-WITH-NOTES (tech_debt) — 15/15 requirements satisfied, 4/4 phases delivered, 4/4 E2E flows verified. See `.planning/milestones/v1.0-MILESTONE-AUDIT.md`.

**Production deploy:** https://kantongpintar.vercel.app/ (Vercel) · final UAT 2026-04-25 verified 5 PASS (`mapSupabaseError` toast bug found + fixed in same session, commit a1f96eb).

**Known deferred items at close:** 8 (1 HIGH pre-existing bug, 1 MEDIUM blocked-by-env, 2 cosmetic UX, 4 LOW/DOC/INFO) — see `.planning/STATE.md ## Deferred Items`.

**Archive files:**
- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md`
- `.planning/phases/` retained in place (not yet archived to `milestones/v1.0-phases/`)

---

## Active

(no active milestone — `/gsd-new-milestone` to start v1.1)
