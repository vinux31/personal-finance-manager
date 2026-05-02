# Roadmap: Kantong Pintar

## Milestones

- ✅ **v1.0 Financial Foundation** — Phases 1-4 (shipped 2026-04-25) — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Hardening & Consistency** — Phases 5-10 (shipped 2026-05-02) — see [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- 📋 **v1.2** — Planned (TBD via `/gsd-new-milestone`)

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

### 🚧 v1.2 (In Progress)

**Shipped:**
- [x] Phase 11: Periode Gaji — `pay_periods` table + PayPeriodCard Dashboard + tab Laporan Periode Gaji + PayPeriodConfirmDialog (migration 0026) — 2026-05-02 PASS

**Backlog kandidat (per `project_v1_2_verification_backlog.md` + audit `deferred_to_next_milestone`):**

- D-14 raw NUMERIC formatting di withdraw_from_goal MESSAGE (cosmetic LOW)
- net_worth_snapshots auto-insert 42501 saat View-As aktif (LOW)
- Phase 6 deferred UATs: Gaji recurring, mark-paid 5x rapid, 2-tab withdraw race, completed→active flip (5 items, MEDIUM-LOW)
- AuthProvider .catch() gap (corrupt-localStorage path raw TypeError) (LOW-MEDIUM, fresh UAT 2026-05-02)
- Migration history reconciliation (`0014..0025` Local-only, db push broken)
- SEC-01 SC#3 destructive variant (TRUNCATE allowed_emails + signup) — perlu staging mirror
- DEV-04 wording reconcile (REQUIREMENTS.md "10k" vs PROJECT.md/plan "50k")

Define v1.2 scope dengan: `/gsd-new-milestone`

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
