# Milestone v1.1 — Hardening & Consistency

**Status:** Active
**Started:** 2026-04-27
**Source:** Audit `.planning/codebase/REVIEW-2026-04-27.md` (3 Critical / 6 High / 7 Medium)
**Research:** `.planning/research/SECURITY-HARDENING.md` + `.planning/research/CONCURRENCY-PATTERNS.md`

**Goal:** Tutup 16 finding security/race/data-integrity dari audit pasca-v1.0, tanpa fitur baru. Zero user-facing behavior change kecuali untuk fix bug yang user pernah lapor (UX-01, CONS-01).

---

## v1.1 Requirements

### Security & Access Control (SEC)

- [x] **SEC-01**: Edge function `fetch-prices` menolak request tanpa JWT valid (verify_jwt platform-layer + in-function `auth.getUser(token)`) dan CORS dibatasi per-domain (`Vary: Origin`). _Source: REVIEW C-03._
- [ ] **SEC-02**: User non-admin hanya bisa `SELECT` baris `profiles` miliknya sendiri; `allowed_emails` hanya readable oleh admin. RLS pakai `(SELECT auth.uid()) = id OR (SELECT public.is_admin())` pattern (statement-cached). _Source: REVIEW H-04._
- [ ] **SEC-03**: `enforce_email_allowlist` fail-closed jika `allowed_emails` kosong — hardcoded fallback hanya admin pertama (`rinoadi28@gmail.com`) yang boleh signup, semua email lain ditolak. _Source: REVIEW H-05._
- [ ] **SEC-04**: RPC `aggregate_by_period` & `aggregate_by_category` raise `42501` exception jika `p_user_id != auth.uid() AND NOT is_admin()`. _Source: REVIEW H-06._

### Race Conditions & Atomicity (RACE)

- [ ] **RACE-01**: User tidak bisa membuat duplikat transaksi rutin walaupun pencet "Lunas" lalu cepat pindah tab — `useProcessRecurring` digantikan single SQL RPC `process_due_recurring(p_uid, p_today, p_max_iter)` dengan `FOR UPDATE` lock + `bill_payments` IF EXISTS idempotency guard. Income templates (Gaji) ikut serta. _Source: REVIEW C-01 (resolves M-04 otomatis)._
- [ ] **RACE-02**: Total `goal_investments.allocation_pct` per investasi tidak pernah > 100% walau dua tab race — DB BEFORE INSERT/UPDATE trigger pakai `SUM ... FOR UPDATE` set-based check. Index baru `goal_investments(investment_id)`. _Source: REVIEW H-03._
- [ ] **RACE-03**: User menarik dana dari goal via atomic RPC `withdraw_from_goal(p_id, p_amount)` (mirror pattern `add_money_to_goal`); client-side optimistic lock dihapus. _Source: REVIEW M-02._

### UI ↔ DB Consistency (CONS)

- [x] **CONS-01**: Card Goals dan dialog "Tarik Dana" konsisten dengan source-of-truth — VIEW `goals_with_progress` (`security_invoker = true`) jadi sumber tunggal `total_amount`, `add_money_to_goal` v2 mark `completed` berbasis `total_amount` (cash + investasi), pesan error withdraw eksplisit memisahkan saldo kas vs investasi. _Source: REVIEW C-02._ **Shipped Phase 7 (07-01, 07-03, 07-05).**
- [x] **CONS-02**: Semua tanggal yang ditulis ke DB pakai WIB-aware `todayISO()` — `useRefreshPrices` di `src/queries/investments.ts:111` di-fix; ESLint rule `no-restricted-syntax` melarang `new Date().toISOString().slice(0,10)` di seluruh codebase. _Source: REVIEW H-01._ **Shipped Phase 7 (07-06).**
- [x] **CONS-03**: Seed Rencana berjalan atomic — single SQL function `seed_rencana(p_uid)` dengan implicit transaction; `user_seed_markers` tabel jadi sumber idempotency, bukan localStorage. _Source: REVIEW M-01._ **Shipped Phase 7 (07-02, 07-05).**

### User-Facing Bug Fixes (UX)

- [x] **UX-01**: Tombol "Reset Seed Rencana" di SettingsTab benar-benar memungkinkan user re-seed — `localStorage.removeItem(\`rencana_seeded_${user.id}\`)` (key per-user, bukan key lama global). _Source: REVIEW H-02._ **Shipped Phase 7 (07-05).**
- [x] **UX-02**: Saat admin sedang "View As" user lain, tombol "Impor CSV" di TransactionsTab + InvestmentsTab disabled (UI Layer 1 + Layer 1.5). _Source: REVIEW M-03._ **Shipped Phase 7 (07-07). Note: Layer 2 server-side RPC validation deferred to v1.2.**

### Developer Experience & Hygiene (DEV)

- [ ] **DEV-01**: TS function `nextDueDate` dihapus dari hot path (digantikan RPC RACE-01); jika ada penggunaan TS date math yang tersisa, snapshot test memastikan output sinkron dengan PG `next_due_date_sql`. _Source: REVIEW M-04 (mostly auto-resolved by RACE-01)._
- [ ] **DEV-02**: Recharts pie label di `ReportsTab.tsx:199, 212` pakai built-in `nameKey="category"` atau `PieLabelRenderProps` type (no `as { category?: string }` cast) — survive Recharts major upgrade. _Source: REVIEW M-07._
- [ ] **DEV-03**: `supabase/config.toml:65 sql_paths` konsisten — `supabase/seed.sql` ada (kosong atau dengan dev seed valid) atau baris dihapus. `supabase db reset` lokal tidak warn/fail. _Source: REVIEW M-05._
- [ ] **DEV-04**: Performance note dashboard `recentTx` query di-dokumentasikan di PROJECT.md Context — limit:5 + index `transactions_date_idx` cukup; rencana migrasi materialized view jika dataset > 10k rows tercatat sebagai future trigger. _Source: REVIEW M-06 (verification + docs, no code change)._

---

## Future Requirements (Deferred from v1.1)

Items dari REVIEW yang **tidak** masuk v1.1 (severity LOW), kandidat untuk v1.2:

- [ ] L-01: Cleanup `src/assets/react.svg` + `vite.svg` boilerplate
- [ ] L-02: Pagination/search di NoteDialog dropdown linked transaction (perf saat user > 1000 tx)
- [ ] L-03: RencanaBar tampilkan badge merah saat deadline lewat (`bulanLagi <= 0`)
- [ ] L-04: Pindahkan hard-coded personal data (`rencanaNames.ts`, dll) keluar dari source (bila repo go-public)
- [ ] L-05: `addAllowedEmail` baca uid dari context, hilangkan extra `auth.getUser()` round-trip
- [ ] L-06: Konfirmasi `dist/` ada di `.gitignore` (cek + fix bila perlu)

Plus open questions dari research (defer ke v1.2):
- Migrasi `enforce_email_allowlist` ke Supabase Auth Hook `before_user_created` (butuh dashboard config)
- Pindahkan `is_admin()` ke schema `private` (Supabase best practice)
- M-03 Layer 2: RPC `import_transactions_bulk` dengan p_user_id + admin check (Layer 1 UI block sudah cukup untuk reported issue)

Plus item carried-over dari v1.0 deferred yang **tidak** ditackle di v1.1:
- v1.0 Tech Debt: createRecurringTemplate missing user_id (HIGH) — _kandidat: gabung dengan RACE-01 RPC refactor_
- v1.0 cosmetic: UpcomingBillsPanel AlertDialog tampilkan nominal+tanggal
- v1.0 cosmetic: Net Worth tooltip post-mark-as-paid
- v1.0 INFO: useMarkBillPaid invalidate `['net-worth-snapshots']`
- v1.0 LOW: `mapSupabaseError` plain-object unit test
- v1.0 DOC: VERIFICATION.md untuk Phase 1 + 3 (sudah resolved-on-archive)

---

## Out of Scope

- **Fitur baru** apapun (Budget per kategori, Zakat calculator, dll) — defer ke v1.2+ setelah hardening selesai
- **Migrasi enforce_email_allowlist ke Auth Hook** — butuh Supabase dashboard config, defer
- **`is_admin()` ke schema private** — Supabase best practice, defer ke v1.2 setelah RLS hardening stable
- **Setup Playwright E2E infrastructure** — research merekomendasikan, tapi project belum punya Playwright resmi (sebelumnya pakai mcp playwright server). Kalau perlu, buat phase tersendiri di v1.2
- **CI/CD pipeline + automated tests** — manual psql + manual UAT tetap dipertahankan untuk v1.1
- **Refactor migration history** — `supabase migration repair` workflow tetap rusak per memori, jangan diutak-atik di v1.1

---

## Traceability

Mapped 2026-04-27 by gsd-roadmapper. Coverage: 16/16 requirements (100%).

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| SEC-01 | Phase 5 — Security Hardening (+ Phase 10 CORS gap closure) | 05-02, 10-01 | shipped (live-verified Phase 10) |
| SEC-02 | Phase 5 — Security Hardening | TBD | pending |
| SEC-03 | Phase 5 — Security Hardening | TBD | pending |
| SEC-04 | Phase 5 — Security Hardening | TBD | pending |
| RACE-01 | Phase 6 — Race & Atomicity | TBD | pending |
| RACE-02 | Phase 6 — Race & Atomicity | TBD | pending |
| RACE-03 | Phase 6 — Race & Atomicity | TBD | pending |
| CONS-01 | Phase 7 — UI/Data Consistency | 07-01, 07-03, 07-05 | shipped |
| CONS-02 | Phase 7 — UI/Data Consistency (+ Phase 10 CORS un-block live verify) | 07-06 | shipped |
| CONS-03 | Phase 7 — UI/Data Consistency | 07-02, 07-05 | shipped |
| UX-01 | Phase 7 — UI/Data Consistency | 07-05 | shipped |
| UX-02 | Phase 7 — UI/Data Consistency | 07-07 | shipped |
| DEV-01 | Phase 6 — Race & Atomicity | TBD | pending |
| DEV-02 | Phase 8 — Dev Hygiene | TBD | pending |
| DEV-03 | Phase 8 — Dev Hygiene | TBD | pending |
| DEV-04 | Phase 8 — Dev Hygiene | TBD | pending |

### Phase ↔ Requirements Summary

| Phase | Requirements | Count | Migrations |
|-------|--------------|------:|-----------|
| Phase 5 — Security Hardening | SEC-01, SEC-02, SEC-03, SEC-04 | 4 | `0017_tighten_rls.sql` |
| Phase 6 — Race & Atomicity | RACE-01, RACE-02, RACE-03, DEV-01 | 4 | `0018_process_due_recurring.sql`, `0019_withdraw_from_goal.sql`, `0020_goal_investments_total_check.sql` |
| Phase 7 — UI/Data Consistency | CONS-01, CONS-02, CONS-03, UX-01, UX-02 | 5 | `0021_user_seed_markers.sql` + `seed_rencana`, `0022_goals_with_progress.sql`, `0023_add_money_to_goal_v2.sql` |
| Phase 8 — Dev Hygiene | DEV-02, DEV-03, DEV-04 | 3 | (none — pure code/config) |
| Phase 10 — Fix `fetch-prices` CORS Allowlist | SEC-01 (re-verify), CONS-02 (un-block live) | — | (none — edge function config only) |
| **Total** | — | **16** | — |

> **Phase 10 note:** Gap-closure phase added 2026-05-02 dari `v1.1-MILESTONE-AUDIT.md` (verdict: tech_debt). Tidak menambah requirement baru — hanya un-block live verification SEC-01 + CONS-02 yang sebelumnya blocked oleh CORS allowlist mismatch (`kantongpintar.app` vs `kantongpintar.vercel.app`).

---

*Total: 16 requirements (4 SEC / 3 RACE / 3 CONS / 2 UX / 4 DEV)*
*Created: 2026-04-27*
*Roadmap mapped: 2026-04-27*
