# Roadmap: Kantong Pintar

## Milestones

- ✅ **v1.0 Financial Foundation** — Phases 1-4 (shipped 2026-04-25) — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Hardening & Consistency** — Phases 5-8 (in progress, started 2026-04-27)

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

### 🚧 v1.1 Hardening & Consistency (In Progress)

**Milestone Goal:** Tutup 16 finding security/race/data-integrity dari audit pasca-v1.0 (REVIEW-2026-04-27.md). Zero user-facing behavior change kecuali fix bug yang user pernah lapor (UX-01, CONS-01).

- [x] **Phase 5: Security Hardening** — Edge function auth + CORS, RLS info-disclosure, allowlist bootstrap, RPC IDOR (migrations 0017+0018) — shipped 2026-04-28 (PASS-WITH-NOTES)
- [x] **Phase 6: Race & Atomicity** — Refactor recurring/withdraw ke RPC + cross-row allocation trigger (migrations 0019+0020+0021) — shipped 2026-04-29 (PASS-WITH-NOTES)
- [ ] **Phase 7: UI/Data Consistency** — Goals total view, atomic seed, timezone ESLint rule, UX-01 + UX-02 fixes (migrations 0022-0024)
- [ ] **Phase 8: Dev Hygiene** — Recharts type cleanup, seed.sql config, perf doc note (no DB changes)
- [ ] **Phase 10: Fix `fetch-prices` CORS Allowlist** — Tambah `kantongpintar.vercel.app` ke `ALLOWED_ORIGINS` edge function + redeploy + live UAT Refresh Harga (gap closure dari v1.1-MILESTONE-AUDIT.md)

## Phase Details

### Phase 5: Security Hardening
**Goal**: Tutup 4 finding security (1 Critical + 3 High) — defensive only, zero user-facing behavior change. Ship FIRST karena blast radius paling rendah dan independen dari work race/UI.
**Depends on**: Nothing (independent of Phases 6-8; can deploy in parallel but ship first per research recommendation)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. `curl -X POST https://<project>.functions.supabase.co/fetch-prices -H 'Content-Type: application/json' -d '{"investments":[]}'` (tanpa Authorization header) returns HTTP 401 Unauthorized — bukan 200 dengan price data.
  2. User non-admin yang call `supabase.from('profiles').select('*')` via REST hanya menerima 1 row (miliknya sendiri); call `supabase.from('allowed_emails').select('*')` returns empty array.
  3. Setelah `TRUNCATE allowed_emails`, signup attempt via OAuth dengan email selain `rinoadi28@gmail.com` raise exception "Allowlist kosong — hanya admin awal yang dapat sign up"; signup `rinoadi28@gmail.com` tetap berhasil.
  4. User non-admin call `supabase.rpc('aggregate_by_period', { p_user_id: '<admin_uuid>' })` raise exception SQLSTATE `42501` "Akses ditolak"; admin call dengan UUID user lain returns aggregated data.
  5. Admin "View As" feature tetap berfungsi — admin dapat SELECT profiles, allowed_emails, dan call aggregate RPCs dengan UUID arbitrary tanpa error.
**Plans**: 4 plans
  - [x] 05-01-PLAN.md — Migration 0017_tighten_rls.sql (RLS profiles+allowed_emails, enforce_email_allowlist hardening, aggregate RPC IDOR guards) + mapSupabaseError SQLSTATE branches
  - [x] 05-02-PLAN.md — Edge function fetch-prices auth (Authorization Bearer + auth.getUser) + per-domain CORS + config.toml verify_jwt
  - [x] 05-03-PLAN.md — Test file supabase/tests/05-tighten-rls.sql (BEGIN/ROLLBACK + RAISE NOTICE PASS/FAIL convention, 14 assertions)
  - [x] 05-04-PLAN.md — Deploy gate: db push (with Studio fallback), functions deploy, run pgTAP, curl smokes, 5 browser-MCP UAT, write 05-VERIFICATION.md

### Phase 6: Race & Atomicity
**Goal**: Eliminasi race conditions di tulis-paths utama (recurring transactions, withdraw goal, goal_investments allocation). Konvergensi ke pattern kanonis `mark_bill_paid` — 3 migration baru + refactor 2 hooks. Highest-blast-radius DB changes — isolate dari Phase 7/8 untuk rollback meaningful.
**Depends on**: Nothing (Phase 5 dan Phase 6 independent — research recommends ship Phase 5 first per blast-radius hierarchy, tapi tidak ada hard dep)
**Requirements**: RACE-01, RACE-02, RACE-03, DEV-01
**Success Criteria** (what must be TRUE):
  1. User pencet "Lunas" pada UpcomingBillsPanel lalu refresh tab Transaksi 5x dalam 1 detik tidak menghasilkan duplikat baris di `transactions` untuk tanggal yang sama (verifikasi via `SELECT date, category_id, amount, COUNT(*) FROM transactions GROUP BY 1,2,3 HAVING COUNT(*) > 1` — empty result).
  2. User buka 2 tab simultan, masing-masing mencoba `INSERT INTO goal_investments (allocation_pct = 60)` dan `(allocation_pct = 50)` untuk investasi yang sama → satu sukses, satu raise SQLSTATE `23514` "Total alokasi investasi melebihi 100%". Index `goal_investments_investment_idx` ada.
  3. User klik "Tarik Dana" Rp 50.000 dari goal dengan `current_amount = 100.000` dari 2 tab simultan → satu sukses (final balance 50.000), satu raise "Saldo kas tidak cukup (tersedia Rp 50.000)" dengan SQLSTATE eksplisit. Status goal `completed` → `active` jika balance turun di bawah target.
  4. TS function `nextDueDate` di `src/db/recurringTransactions.ts` tidak lagi dipanggil dari `useProcessRecurring` (hot path). Snapshot test atau parity test memastikan output TS `nextDueDate` (jika masih ada untuk preview) konsisten dengan PG `next_due_date_sql` untuk minimal 8 case (termasuk 31 Jan → 28/29 Feb, leap year).
  5. Income templates (Gaji) tetap diproses oleh RPC `process_due_recurring` baru — manual UAT login → buka Transaksi tab → assert Gaji untuk bulan ini muncul satu kali.
**Plans**: 5 plans
  - [x] 06-01-PLAN.md — RACE-01 + DEV-01: process_due_recurring RPC + useProcessRecurring rewrite + delete TS nextDueDate + pgTAP test
  - [x] 06-02-PLAN.md — RACE-02: goal_investments BEFORE INSERT/UPDATE trigger SUM check + index + pgTAP test
  - [x] 06-03-PLAN.md — RACE-03: withdraw_from_goal RPC + TS callsite refactor (db/queries/AddMoneyDialog) + pgTAP test
  - [x] 06-04-PLAN.md — Cross-cutting: errors.ts SQLSTATE 23514 + P0001 branches
  - [x] 06-05-PLAN.md — Wave 2 deploy + UAT gate (Studio paste 0019/0020/0021 with D-16 pre-deploy check, pgTAP suite, 5 Browser-MCP UAT, write 06-VERIFICATION.md)

### Phase 7: UI/Data Consistency
**Goal**: Bridge gap antara UI representation dan DB source-of-truth (Goals total cash+investasi), atomic seed via DB function, timezone discipline via ESLint, dan 2 UX bug user-facing (Reset Seed Rencana key, View-As CSV gate). Additive — VIEW + ESLint config + UI gates, low risk.
**Depends on**: Phase 6 (CONS-01 `add_money_to_goal_v2` reuses pattern `withdraw_from_goal` dari RACE-03; CONS-03 `seed_rencana` RPC reuses `is_admin()` guard pattern verified di Phase 6 RPCs)
**Requirements**: CONS-01, CONS-02, CONS-03, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. Goal dengan target Rp 10.000.000, linked investment 60% × Rp 18.000.000 = Rp 10.800.000 → bar progress 100%, badge auto-flip ke "Tercapai" setelah `add_money_to_goal` terbaru triggered (sebelumnya tetap "Aktif" karena RPC pakai cash-only). Dialog "Tarik Dana" tampilkan "Saldo kas tersedia: Rp X (terpisah dari investasi Rp Y)".
  2. Codebase pass `eslint .` tanpa error untuk rule `no-restricted-syntax` yang melarang `new Date().toISOString().slice(0,10)`. `useRefreshPrices` dan semua callsite date-write pakai `todayISO()` dari `@/lib/format`. After 07:00 WIB, klik "Refresh Harga" → row `price_history` tersimpan dengan tanggal hari ini WIB (bukan kemarin UTC).
  3. User baru login pertama kali → 5 goals + 5 investments seeded atomically; reload page 5x → tidak ada duplikat row, RPC `seed_rencana` returns `false` setelah call pertama. Tabel `user_seed_markers` punya 1 row dengan `rencana_seeded_at` filled. Mid-execution failure (simulated via raise) → seluruh transaction rollback, tidak ada partial seed.
  4. User klik "Reset Seed Rencana" di SettingsTab → `localStorage` key `rencana_seeded_${user.id}` dihapus (bukan key lama global `rencana_seeded`); reload Dashboard → `useRencanaInit` re-trigger `seed_rencana` RPC.
  5. Admin login → switch View-As ke user X → tab Transaksi + tab Investasi: tombol "Impor CSV" disabled dengan tooltip "Tidak tersedia saat View-As"; admin keluar dari View-As → tombol re-enable.
**Plans**: 8 plans
  - [x] 07-01-PLAN.md — Migration 0023_goals_with_progress.sql (VIEW + GRANT) + pgTAP test (CONS-01 read-side, Wave 1)
  - [x] 07-02-PLAN.md — Migration 0022_user_seed_markers.sql (table + seed_rencana + reset_rencana_marker RPCs + backfill) + pgTAP test (CONS-03, Wave 1)
  - [x] 07-03-PLAN.md — Migration 0024_add_money_to_goal_v2.sql (DROP v1 + CREATE v2 + status backfill + withdraw MESSAGE patch) + pgTAP test (CONS-01 write-side, Wave 2)
  - [x] 07-04-PLAN.md — [BLOCKING] Apply migrations 0022-0024 + tests via Supabase Studio SQL Editor (Wave 3, autonomous: false)
  - [x] 07-05-PLAN.md — Frontend wiring: useRencanaInit RPC + SettingsTab reset handler + AddMoneyDialog withdraw helper + GoalsTab VIEW (CONS-01, CONS-03, UX-01, Wave 4)
  - [x] 07-06-PLAN.md — ESLint no-restricted-syntax rule + fix investments.ts:111 todayISO() callsite (CONS-02, Wave 4)
  - [x] 07-07-PLAN.md — View-As CSV gate (TransactionsTab + InvestmentsTab disabled + handler guard) (UX-02, Wave 4)
  - [ ] 07-08-PLAN.md — [BLOCKING] Browser-MCP UAT (5 scenarios) + 07-VERIFICATION.md + STATE.md update (All, Wave 5, autonomous: false)

### Phase 8: Dev Hygiene
**Goal**: Pure code/config cleanup tanpa DB migration. Recharts label survive major upgrade, seed.sql ada/dihapus konsisten, performance note `recentTx` dashboard didokumentasikan untuk future-trigger materialized view migration.
**Depends on**: Nothing (parallel-safe with Phase 5/6/7; ship last karena lowest priority)
**Requirements**: DEV-02, DEV-03, DEV-04
**Success Criteria** (what must be TRUE):
  1. `ReportsTab.tsx` pie chart label rendering pakai built-in `nameKey="category"` atau `PieLabelRenderProps` typed handler — tidak ada `as { category?: string }` cast. `tsc --noEmit` pass; visual regression: pie label tetap menampilkan nama kategori.
  2. `supabase db reset` lokal jalan tanpa warning "seed.sql not found" — file `supabase/seed.sql` exists (kosong dengan comment, atau dengan dev seed valid) ATAU baris `sql_paths = ["./seed.sql"]` di `supabase/config.toml:65` dihapus.
  3. PROJECT.md "Context" section punya entry baru yang dokumentasi: "Dashboard `recentTx` query pakai `useTransactions({ limit: 5 })` + index `transactions_date_idx` — sufficient untuk dataset < 10k rows; future trigger untuk migrasi materialized view jika dataset growth melebihi threshold."
**Plans**: 2 plans
  - [x] 08-01-PLAN.md — DEV-02: Recharts PieLabelRenderProps type fix di ReportsTab.tsx (Wave 1)
  - [x] 08-02-PLAN.md — DEV-03 + DEV-04: buat supabase/seed.sql + tambah Performance bullet ke PROJECT.md (Wave 1)

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8 (Phase 5 first per blast-radius hierarchy; Phase 6/7/8 can theoretically parallel, but execute sequentially for verification clarity).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | ✅ Complete | 2026-04-23 |
| 2. Net Worth Tracker | v1.0 | 3/3 | ✅ Complete | 2026-04-23 |
| 3. Bills Display | v1.0 | 2/2 | ✅ Complete | 2026-04-24 |
| 4. Mark-as-Paid | v1.0 | 6/6 | ✅ Complete | 2026-04-25 |
| 5. Security Hardening | v1.1 | 0/4 | Not started | - |
| 6. Race & Atomicity | v1.1 | 0/5 | Not started | - |
| 7. UI/Data Consistency | v1.1 | 0/8 | Not started | - |
| 8. Dev Hygiene | v1.1 | 0/2 | Not started | - |

### Phase 9: QA Bug Fix — Fix semua bug dari QA-FINDINGS.md

**Goal**: Fix semua 8 bug dari QA-FINDINGS.md (audit 2026-05-01). 2 Critical (DB triggers/RPC), 4 Medium (frontend tab state, auth refresh, dialog calc, label kas), 2 Low (a11y aria-describedby + i18n Ekspor PDF). Tidak ada fitur baru, tidak ada refactor di luar scope bug.
**Requirements**: QA-CRITICAL-1, QA-CRITICAL-2, QA-MEDIUM-3, QA-MEDIUM-4, QA-MEDIUM-5, QA-MEDIUM-6, QA-LOW-7, QA-LOW-8
**Depends on:** Phase 8
**Plans:** 4 plans

Plans:
- [x] 09-01-PLAN.md — Create migration 0025_fix_goal_bugs.sql (Critical #1 trigger FOR UPDATE+aggregate fix + Critical #2 add_money_to_goal alias g.)
- [x] 09-02-PLAN.md — Frontend fixes 6 files (Bug #3 forceMount, #4 auth toast, #5 remaining calc, #6 label, #7 DialogDescription, #8 Ekspor PDF)
- [x] 09-03-PLAN.md — [BLOCKING] Studio paste 0025 to production Supabase
- [x] 09-04-PLAN.md — [BLOCKING] Verification + UAT + write 09-VERIFICATION.md + update STATE.md/ROADMAP.md

### Phase 10: Fix `fetch-prices` CORS Allowlist

**Goal**: Tutup gap integrasi + flow "Refresh Harga" yang teridentifikasi di `v1.1-MILESTONE-AUDIT.md`. Edge function `fetch-prices` menolak request browser dari `kantongpintar.vercel.app` (production domain) karena `ALLOWED_ORIGINS` hanya berisi `kantongpintar.app` / `www.kantongpintar.app`. Source-side code (Phase 5 SEC-01 JWT enforcement, Phase 7 CONS-02 todayISO write-path) sudah benar — fix purely infra/config.

**Depends on:** Phase 5 (SEC-01 JWT enforcement), Phase 7 (CONS-02 todayISO + useRefreshPrices wiring)

**Requirements:** SEC-01 (live verification re-confirm), CONS-02 (live verification un-block) — keduanya sudah satisfied di code, ini un-block production live UAT.

**Success Criteria** (what must be TRUE):
  1. `supabase/functions/fetch-prices/index.ts` `ALLOWED_ORIGINS` set berisi `https://kantongpintar.vercel.app` (next to existing `kantongpintar.app` + `www.kantongpintar.app`).
  2. After `supabase functions deploy fetch-prices`, browser request dari `https://kantongpintar.vercel.app` tab Investasi → "Refresh Harga" returns HTTP 200 dengan response berisi prices array; tidak ada CORS rejection di Network tab.
  3. Row baru di `price_history` table dengan `date = todayISO()` (WIB date), confirming CONS-02 todayISO write-path live.
  4. JWT enforcement tetap intact — `curl -X POST https://<project>.functions.supabase.co/fetch-prices -H 'Origin: https://kantongpintar.vercel.app' -H 'Content-Type: application/json' -d '{"investments":[]}'` (tanpa Authorization) tetap return 401 (SEC-01 regression check).

**Plans:** 2 plans
- [ ] 10-01-PLAN.md — Update `ALLOWED_ORIGINS` di `supabase/functions/fetch-prices/index.ts` + commit
- [ ] 10-02-PLAN.md — [BLOCKING] `supabase functions deploy fetch-prices` + live UAT Refresh Harga di `kantongpintar.vercel.app` + curl SEC-01 regression smoke + write 10-VERIFICATION.md
