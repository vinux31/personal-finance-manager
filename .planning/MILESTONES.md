# Milestones

## v1.2 Strategic Layer & Verification Closure (Shipped: 2026-05-15)

**Phases completed:** 6 phases · 17 plans · all complete
**Git range:** v1.1 → 83b8484 (191 commits, 303 files changed, +49k/-4.9k)
**Timeline:** 2026-05-02 → 2026-05-15 (~13 days)

**Goal:** Tambahkan halaman `/kesehatan` (piramida diagnostic 4-tier + 6 modul edukasi + kalkulator) sebagai strategic layer, sekaligus tutup sisa verification debt v1.1 (B1-B5 live UAT).

**Delivered:** Halaman `/kesehatan` live dengan 8 data-driven financial indicators, 6 modul edukasi sub-route, kalkulator compound interest, dan Tier 1/4 protection checklists — plus B1-B5 live UAT semua PASS di production.

**Key accomplishments:**

- Phase 11 — Periode Gaji: `pay_periods` table + PayPeriodCard Dashboard + tab Laporan Periode Gaji + manual management di `/periode-gaji` (migration 0026).
- Phase 12 — /kesehatan Foundation: sidebar grup Strategi + route `/kesehatan` + landing shell (piramida 4-tier trapezoid + banner kalkulator + grid 6 modul card) + `protection_checklist` table RLS (migration 0029) + DIAG-11 empty state dengan grayed piramida + 3 CTA.
- Phase 13 — Diagnostic Data Indicators: 8 data-driven indikator finansial live (Dana Darurat, Savings Rate, DAR Konsumtif, Goals On-track, Pensiun, Rasio Investasi, Diversifikasi, Asuransi shell) dengan threshold warna hijau/kuning/merah + smart fallback CTA + edge case data tipis placeholder.
- Phase 14 — Protection & Tier 4 Checklists: Tier 1 inline form Asuransi Kesehatan (3-state machine, optimistic mutation) + Tier 4 smart-gated checklist estate/asuransi jiwa + View-As 3-layer read-only guard (DIAG-04, DIAG-09, DIAG-12).
- Phase 15 — Modul Edukasi & Kalkulator: 6 modul edukasi sub-route `/kesehatan/<slug>` + kalkulator compound interest (Recharts, 4 sliders, tabel 5-tahunan) + GlossaryTooltip Radix Popover (8 istilah) + Fraunces variable font + vitest infrastruktur pertama di project.
- Phase 16 — v1.1 Closure & Ops Cleanup: B1-B5 live UAT semua PASS (process_due_recurring idempotency, mark-paid 5x race, 2-tab withdraw pessimistic lock, completed→active flip, todayISO WIB date) + migration playbook docs + 0028 hotfix applied to production cloud.

**Audit verdict:** tech_debt — 26/26 requirements satisfied, 6/6 E2E flows verified, 21/21 requirements wired. Deferred: 37 human visual UAT items, DIAG-12 admin-role visual UAT blocked, 2 missing VERIFICATION.md (process gap). See `.planning/milestones/v1.2-MILESTONE-AUDIT.md`.

**Production deploy:** https://kantongpintar.vercel.app/ — live UAT B1-B5 PASS 2026-05-15, production cloud.

**Known deferred items at close:** 37 human visual UAT + DIAG-12 View-As visual (admin seed needed) + WR-02 isPending gate + circular import documented + Nyquist VALIDATION.md missing all phases (process gap).

**Archive files:**

- `.planning/milestones/v1.2-ROADMAP.md`
- `.planning/milestones/v1.2-REQUIREMENTS.md`
- `.planning/milestones/v1.2-MILESTONE-AUDIT.md`

---

## Completed

### v1.1 Hardening & Consistency (Shipped: 2026-05-02)

**Phases completed:** 6 phases · 25 plans · 24 tasks

**Goal:** Tutup 16 finding security/race/data-integrity dari audit pasca-v1.0 (REVIEW-2026-04-27.md). Zero user-facing behavior change kecuali fix bug yang user pernah lapor (UX-01, CONS-01).

**Started:** 2026-04-27 · **Shipped:** 2026-05-02 (~6 days)

**Delivered:** Tutup 16 finding security/race/data-integrity dari audit pasca-v1.0 dengan zero user-facing regression. Production end-to-end verified live di kantongpintar.vercel.app.

**Key accomplishments:**

- Phase 5 — Security Hardening: Edge function JWT enforcement (`verify_jwt` + `auth.getUser`), per-domain CORS, RLS info-disclosure fixes (profiles + allowed_emails), allowlist bootstrap protection, RPC IDOR guards (`aggregate_by_period`/`aggregate_by_category`). 4 SEC requirements shipped. Migrations `0017_tighten_rls.sql` + in-flight patch `0018_drop_legacy_aggregates.sql`.
- Phase 6 — Race & Atomicity: `process_due_recurring` + `withdraw_from_goal` RPCs (FOR UPDATE race-safe), `goal_investments_total_check` trigger (cross-row cap enforcement), TS `nextDueDate` dihapus dari hot path. 4 RACE+DEV requirements shipped. Migrations `0019`+`0020`+`0021`.
- Phase 7 — UI/Data Consistency: `goals_with_progress` VIEW (cash + investasi total), atomic `seed_rencana` RPC + `user_seed_markers`, `todayISO` ESLint rule, View-As CSV gate, Reset Seed key per-user. 5 CONS+UX requirements shipped. Migrations `0022`-`0024`.
- Phase 8 — Dev Hygiene: Recharts label type cleanup, `supabase/seed.sql` aligned, performance note recentTx documented. 3 DEV requirements shipped.
- Phase 9 — QA Bug Fix: 8 bug dari `QA-FINDINGS.md` (2 Critical DB, 4 Medium frontend, 2 Low a11y/i18n) — migration `0025_fix_goal_bugs.sql` (trigger FOR UPDATE+aggregate fix + `add_money_to_goal` alias guard) + 6 frontend file fixes.
- Phase 10 — fetch-prices CORS fix: Tambah `kantongpintar.vercel.app` ke `ALLOWED_ORIGINS` edge function, deploy via Supabase Dashboard, live UAT "Refresh Harga" Playwright PASS, SEC-01 regression curl smoke confirmed JWT enforcement intact.

**Audit verdict:** tech_debt → resolved Phase 10 — 16/16 requirements satisfied, 6/6 phases delivered, fetch-prices CORS gap closed live. See `.planning/milestones/v1.1-MILESTONE-AUDIT.md`.

**Production deploy:** https://kantongpintar.vercel.app/ — verified live via Playwright UAT 2026-05-02 (Refresh Harga end-to-end).

**Known deferred items at close:** 9 (3 code fix LOW/MEDIUM cosmetic + 5 live UAT deferred MEDIUM-LOW + 1 AuthProvider .catch gap LOW-MEDIUM) — kandidat v1.2 scope per `project_v1_2_verification_backlog.md`. Plus migration history reconciliation (0014..0025 Local-only, db push broken).

**Archive files:**

- `.planning/milestones/v1.1-ROADMAP.md`
- `.planning/milestones/v1.1-REQUIREMENTS.md`
- `.planning/milestones/v1.1-MILESTONE-AUDIT.md`
- `.planning/milestones/v1.1-phases/` (phase directories 05-10 archived 2026-05-05)

---

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

(no active milestone — `/gsd-new-milestone` to start v1.2)
