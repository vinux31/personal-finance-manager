---
phase: 01-foundation
plan: 02
subsystem: database
tags: [supabase, postgresql, rls, migration, net-worth, bill-payments]

# Dependency graph
requires:
  - phase: 01-foundation-01
    provides: bug fix untuk nextDueDate clamping di recurring_templates
provides:
  - net_worth_accounts table dengan RLS dan type allowlist (7 tipe)
  - net_worth_liabilities table dengan RLS dan type allowlist (5 tipe)
  - net_worth_snapshots table dengan computed net_worth (GENERATED ALWAYS AS STORED)
  - bill_payments table dengan FK ke recurring_templates (CASCADE) dan transactions (SET NULL)
affects: [phase-02-net-worth, phase-04-mark-as-paid]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RLS pattern D-06: USING (auth.uid() = user_id OR is_admin()) + WITH CHECK (auth.uid() = user_id) — admin dapat READ semua, tapi TIDAK BISA WRITE atas nama user lain"
    - "GENERATED ALWAYS AS ... STORED untuk computed column di PostgreSQL (net_worth = total_accounts + total_investments - total_liabilities)"
    - "BIGINT GENERATED ALWAYS AS IDENTITY sebagai PK (bukan BIGSERIAL) — konsisten dengan 0011_pension_simulations"

key-files:
  created:
    - supabase/migrations/0012_net_worth.sql
    - supabase/migrations/0013_bill_payments.sql
  modified: []

key-decisions:
  - "Dua tabel terpisah (net_worth_accounts + net_worth_liabilities) per D-07 — cleaner query semantics, tidak pakai discriminator column"
  - "bill_payments.transaction_id nullable + ON DELETE SET NULL — payment bisa exist tanpa transaction terkait (atomic create flow)"
  - "bill_payments.recurring_template_id NOT NULL + ON DELETE CASCADE — payment history tidak relevan tanpa template konteks"
  - "Admin write restriction: WITH CHECK tidak punya OR is_admin() — admin diblokir menulis atas nama user lain (T-02-02)"

patterns-established:
  - "RLS D-06: pisah USING (read, boleh admin) dari WITH CHECK (write, hanya owner)"
  - "Migration split D-05: tabel yang conceptually berbeda dipisah ke file berbeda"

requirements-completed: [FOUND-02]

# Metrics
duration: 8min
completed: 2026-04-24
---

# Phase 01 Plan 02: Net Worth + Bill Payments DB Schema Summary

**4 tabel PostgreSQL (net_worth_accounts, net_worth_liabilities, net_worth_snapshots, bill_payments) dengan RLS cross-user isolation dan computed net_worth GENERATED ALWAYS AS STORED**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-24T00:41:00Z
- **Completed:** 2026-04-24T00:49:57Z
- **Tasks:** 2 of 3 (Task 3 adalah checkpoint:human-verify — menunggu konfirmasi user)
- **Files modified:** 2

## Accomplishments
- `0012_net_worth.sql`: 3 tabel aset/liabilitas/snapshot dengan RLS + computed column net_worth
- `0013_bill_payments.sql`: 1 tabel payment history dengan FK semantics yang tepat (CASCADE vs SET NULL)
- Semua 4 tabel menerapkan pola RLS D-06: admin dapat READ tapi tidak dapat WRITE atas nama user lain
- Threat mitigations T-02-01 sampai T-02-04, T-02-07 semua terimplementasi

## Task Commits

1. **Task 1: Create 0012_net_worth.sql** - `be82118` (feat)
2. **Task 2: Create 0013_bill_payments.sql** - `84a4ca0` (feat)
3. **Task 3: Human verification** - PENDING (checkpoint:human-verify)

## Files Created/Modified
- `supabase/migrations/0012_net_worth.sql` - 3 tabel Net Worth dengan RLS dan computed column
- `supabase/migrations/0013_bill_payments.sql` - 1 tabel Bill Payments dengan FK ke recurring_templates + transactions

## Decisions Made
- Dua file migrasi terpisah (D-05): net worth dan bill payments conceptually berbeda
- Dua tabel terpisah accounts vs liabilities (D-07): tidak pakai discriminator column
- `transaction_id` nullable karena mark-as-paid bisa create payment dulu, transaction setelahnya
- `recurring_template_id` NOT NULL + CASCADE: kalau template dihapus, history payment juga dihapus

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Task 3 (checkpoint:human-verify) memerlukan konfirmasi manual:**
1. Jalankan `supabase db push` untuk apply kedua migrasi ke Supabase project
2. Verifikasi 4 tabel muncul di Table Editor dengan RLS toggle ON
3. Test cross-user isolation (User B tidak bisa lihat data User A)
4. Test admin read works, admin write-as-other blocked
5. Test computed column net_worth = total_accounts + total_investments - total_liabilities

Lihat detail langkah verifikasi di Task 3 dalam PLAN.md.

## Next Phase Readiness
- Phase 2 (Net Worth Tracker): `net_worth_accounts`, `net_worth_liabilities`, `net_worth_snapshots` siap untuk CRUD
- Phase 4 (Mark-as-Paid): `bill_payments` siap untuk atomic mark-as-paid RPC
- Blocker tetap aktif: cek `src/lib/supabase.ts` pakai anon key bukan service_role (jika service_role, RLS bersifat advisory)

## Threat Surface Scan

Tidak ada surface baru di luar threat model yang sudah didokumentasikan di PLAN.md. Semua 7 threat IDs (T-02-01 sampai T-02-07) telah ditangani sesuai disposisi di plan.

## Self-Check: PASSED

- `supabase/migrations/0012_net_worth.sql`: FOUND, 3 CREATE TABLE, 3 RLS, 3 policies
- `supabase/migrations/0013_bill_payments.sql`: FOUND, 1 CREATE TABLE, 1 RLS, 1 policy
- Commit `be82118`: EXISTS
- Commit `84a4ca0`: EXISTS

---
*Phase: 01-foundation*
*Completed: 2026-04-24*
