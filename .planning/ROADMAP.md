# Roadmap: Kantong Pintar

## Milestones

- ✅ **v1.0 Financial Foundation** — Phases 1-4 (shipped 2026-04-25) — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Hardening & Consistency** — Phases 5-10 (shipped 2026-05-02) — see [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Strategic Layer & Verification Closure** — Phases 11-16 (shipped 2026-05-15) — see [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

## Phases

<details>
<summary>✅ v1.0 Financial Foundation (Phases 1-4) — SHIPPED 2026-04-25</summary>

- [x] Phase 1: Foundation (3/3 plans) — DB infrastructure, FOUND-01 nextDueDate fix, navigasi restructure
- [x] Phase 2: Net Worth Tracker (3/3 plans) — CRUD akun/liabilitas, tab Kekayaan, metric card Dashboard
- [x] Phase 3: Bills Display (2/2 plans) — daftar tagihan + color urgency + Sisa Aman
- [x] Phase 4: Mark-as-Paid (6/6 plans) — atomic mark_bill_paid RPC + AlertDialog + Playwright UAT

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
Audit verdict (PASS-WITH-NOTES): [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.1 Hardening & Consistency (Phases 5-10) — SHIPPED 2026-05-02</summary>

- [x] Phase 5: Security Hardening (4/4 plans) — Edge function auth + CORS + RLS + RPC IDOR (migrations 0017+0018) — 2026-04-28 PASS-WITH-NOTES
- [x] Phase 6: Race & Atomicity (5/5 plans) — process_due_recurring/withdraw_from_goal RPCs + goal_investments trigger (migrations 0019+0020+0021) — 2026-04-29 PASS-WITH-NOTES
- [x] Phase 7: UI/Data Consistency (8/8 plans) — goals_with_progress VIEW, atomic seed_rencana, todayISO ESLint rule, View-As CSV gate (migrations 0022-0024) — 2026-04-29 PASS-WITH-NOTES
- [x] Phase 8: Dev Hygiene (2/2 plans) — Recharts type cleanup, seed.sql config, perf doc note — PASS
- [x] Phase 9: QA Bug Fix (4/4 plans) — Fix 8 bug dari QA-FINDINGS.md (migration 0025) — 2026-05-01 PASS
- [x] Phase 10: fetch-prices CORS fix (2/2 plans) — Tambah kantongpintar.vercel.app ke ALLOWED_ORIGINS + live UAT — 2026-05-02 PASS

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
Audit verdict (tech_debt → resolved Phase 10): [milestones/v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.2 Strategic Layer & Verification Closure (Phases 11-16) — SHIPPED 2026-05-15</summary>

- [x] Phase 11: Periode Gaji (1/1 plan) — `pay_periods` table + PayPeriodCard Dashboard + tab Laporan Periode Gaji + manual management `/periode-gaji` — 2026-05-02 PASS
- [x] Phase 12: /kesehatan Foundation (3/3 plans) — sidebar grup Strategi + route `/kesehatan` + landing shell + `protection_checklist` schema (migration 0029) + DIAG-11 empty state — 2026-05-08
- [x] Phase 13: Diagnostic Data Indicators (4/4 plans) — 8 data-driven indikator Tier 1-3 + accordion panel + smart fallback CTA + edge case data tipis — 2026-05-08
- [x] Phase 14: Protection & Tier 4 Checklists (3/3 plans) — Tier 1 Asuransi Kesehatan inline form + Tier 4 smart-gated estate/life checklist + View-As 3-layer read-only — 2026-05-09
- [x] Phase 15: Modul Edukasi & Kalkulator (4/4 plans) — 6 modul sub-route + kalkulator compound interest Recharts + GlossaryTooltip Radix Popover + Fraunces font + vitest — 2026-05-10
- [x] Phase 16: v1.1 Closure & Ops Cleanup (2/2 plans) — B1-B5 live UAT PASS + migration playbook + 0028 hotfix applied to cloud — 2026-05-15

Full details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
Audit verdict (tech_debt, no blockers): [milestones/v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md)

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | ✅ Complete | 2026-04-23 |
| 2. Net Worth Tracker | v1.0 | 3/3 | ✅ Complete | 2026-04-23 |
| 3. Bills Display | v1.0 | 2/2 | ✅ Complete | 2026-04-24 |
| 4. Mark-as-Paid | v1.0 | 6/6 | ✅ Complete | 2026-04-25 |
| 5. Security Hardening | v1.1 | 4/4 | ✅ Complete (PASS-WITH-NOTES) | 2026-04-28 |
| 6. Race & Atomicity | v1.1 | 5/5 | ✅ Complete (PASS-WITH-NOTES) | 2026-04-29 |
| 7. UI/Data Consistency | v1.1 | 8/8 | ✅ Complete (PASS-WITH-NOTES) | 2026-04-29 |
| 8. Dev Hygiene | v1.1 | 2/2 | ✅ Complete | 2026-04-29 |
| 9. QA Bug Fix | v1.1 | 4/4 | ✅ Complete | 2026-05-01 |
| 10. fetch-prices CORS fix | v1.1 | 2/2 | ✅ Complete (PASS) | 2026-05-02 |
| 11. Periode Gaji | v1.2 | 1/1 | ✅ Complete (PASS) | 2026-05-02 |
| 12. /kesehatan Foundation | v1.2 | 3/3 | ✅ Complete | 2026-05-08 |
| 13. Diagnostic Data Indicators | v1.2 | 4/4 | ✅ Complete | 2026-05-08 |
| 14. Protection & Tier 4 Checklists | v1.2 | 3/3 | ✅ Complete | 2026-05-09 |
| 15. Modul Edukasi & Kalkulator | v1.2 | 4/4 | ✅ Complete | 2026-05-10 |
| 16. v1.1 Closure & Ops Cleanup | v1.2 | 2/2 | ✅ Complete (PASS) | 2026-05-15 |
