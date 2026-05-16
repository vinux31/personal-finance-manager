---
phase: 12-kesehatan-foundation
plan: "01"
subsystem: database
tags: [postgres, rls, migration, protection-checklist, sql-test]

requires: []
provides:
  - "Migration 0029_protection_checklist.sql: CREATE TABLE protection_checklist dengan user_id PRIMARY KEY + 8 business fields + CHECK constraints + RLS"
  - "SQL test 12-protection-checklist.sql: 8 PASS assertion paths (5 RLS isolation + 3 CHECK constraint)"
affects:
  - "12-kesehatan-foundation (plans 12-02, 12-03 not blocked by schema)"
  - "14 (Phase 14 mutation forms depend on protection_checklist existing in production)"

tech-stack:
  added: []
  patterns:
    - "1:1 user table pattern: user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE (lazy-create via INSERT ... ON CONFLICT DO UPDATE)"
    - "RLS pattern (existing): USING auth.uid()=user_id OR is_admin() + WITH CHECK auth.uid()=user_id"
    - "SQL test convention: BEGIN/ROLLBACK + synthetic UUIDs c01..c03 range + RAISE NOTICE PASS:/FAIL: format"

key-files:
  created:
    - supabase/migrations/0029_protection_checklist.sql
    - supabase/tests/12-protection-checklist.sql
  modified: []

key-decisions:
  - "user_id UUID PRIMARY KEY (bukan BIGINT surrogate) karena 1:1 dengan user — lazy-create pattern INSERT ... ON CONFLICT (user_id) DO UPDATE"
  - "Semua 8 business fields nullable supaya partial-fill valid di Phase 14 (user bisa jawab health_coverage dulu sebelum life/estate)"
  - "Migration applied via Studio SQL Editor manual paste (db push broken — channel yang sama dengan 0025..0028)"

patterns-established:
  - "1:1 user table lazy-create: INSERT ... ON CONFLICT (user_id) DO UPDATE SET ... — Phase 14 harus ikuti ini"
  - "SQL test UUID range: Phase 12 pakai c01..c03/c99/ce1..ce3 (Phase 5 pakai a01..a03) — reserve range per phase untuk avoid collision"

requirements-completed: [SCHEMA-01]

duration: 15min
completed: 2026-05-08
---

# Phase 12 Plan 01: /kesehatan Schema Foundation Summary

**Migration 0029 protection_checklist schema (user_id PK, 8 nullable fields, 3 CHECK enums, RLS) + SQL integration test dengan 8 PASS assertion paths — awaiting Studio SQL Editor apply (Task 3 checkpoint)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-08T03:01:00Z
- **Completed (tasks 1-2):** 2026-05-08T03:16:36Z
- **Tasks:** 2/3 (Task 3 = checkpoint:human-action — awaiting Studio paste)
- **Files modified:** 2

## Accomplishments

- Migration file `0029_protection_checklist.sql` dibuat dengan struktur lengkap: `user_id UUID PRIMARY KEY`, 8 business fields nullable, 3 TEXT enum CHECK constraints, `updated_at`/`created_at` timestamps, RLS enabled, policy `Users manage own protection checklist` (USING `auth.uid()=user_id OR is_admin()` + WITH CHECK `auth.uid()=user_id`)
- SQL test `12-protection-checklist.sql` dibuat mengikuti konvensi `05-tighten-rls.sql`: BEGIN/ROLLBACK wrapper, 5 RLS isolation tests (Section 1) + 3 CHECK constraint tests (Section 2) = 8 PASS assertion paths total
- Task 3 (apply migration ke Supabase Cloud) dihentikan di checkpoint — memerlukan human action via Studio SQL Editor

## Task Commits

1. **Task 1: Tulis migration 0029_protection_checklist.sql** - `70529de` (feat)
2. **Task 2: Tulis SQL test 12-protection-checklist.sql** - `ea34877` (test)
3. **Task 3: Apply migration via Studio SQL Editor** - CHECKPOINT (awaiting human action)

## Files Created/Modified

- `supabase/migrations/0029_protection_checklist.sql` — CREATE TABLE protection_checklist + RLS policy. Apply ke production via Studio SQL Editor.
- `supabase/tests/12-protection-checklist.sql` — SQL integration test: 8 PASS paths, BEGIN/ROLLBACK safe, synthetic UUIDs c01..c03.

## Decisions Made

- **user_id sebagai PRIMARY KEY** (bukan surrogate BIGINT): tabel ini 1:1 dengan user, tidak perlu row ID terpisah. Phase 14 pakai `INSERT ... ON CONFLICT (user_id) DO UPDATE SET ...` untuk lazy-create.
- **Semua business fields nullable**: user bisa jawab hanya Tier 1 #4 (`health_coverage`) tanpa mengisi seluruh Tier 4. Partial fill valid.
- **Studio paste sebagai migration channel**: db push masih broken (history mismatch, sesuai MEMORY `project_supabase_migration_workflow`). Tidak ada perubahan workflow dari Phase 11/prior phases.

## Deviations from Plan

None — Task 1 dan Task 2 dieksekusi persis sesuai plan. Task 3 adalah checkpoint yang memang dirancang sebagai human-action gate.

## Issues Encountered

None — file creation dan git commit berjalan mulus.

## User Setup Required

**Task 3 — Migrate ke Supabase Cloud (blocking):**

1. Buka Supabase Studio Cloud → SQL Editor → New Query
2. Paste isi `supabase/migrations/0029_protection_checklist.sql` (lihat file di repo)
3. Klik "Run" — expected: `Success. No rows returned`
4. Verifikasi 11 kolom exist:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'protection_checklist'
   ORDER BY ordinal_position;
   ```
5. Verifikasi RLS enabled:
   ```sql
   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'protection_checklist';
   ```
   Expected: `relrowsecurity = true`
6. (Opsional) Run SQL test jika psql tersedia:
   ```bash
   psql "$DATABASE_URL" -f supabase/tests/12-protection-checklist.sql
   ```

## Next Phase Readiness

- **Phase 12-02** (sidebar + route + landing) dan **Phase 12-03** (empty state): tidak memerlukan protection_checklist di production — bisa jalan paralel/sequential tanpa blocking
- **Phase 14** (mutation forms): WAJIB tunggu Task 3 selesai (protection_checklist harus exist di production sebelum INSERT pattern bisa live)
- Hand-off note untuk Phase 14: gunakan `INSERT INTO protection_checklist (user_id, ...) VALUES (...) ON CONFLICT (user_id) DO UPDATE SET ...` — lazy-create row pada first interaction

## Known Stubs

None — plan ini hanya schema/test, tidak ada UI atau data wiring.

## Threat Flags

Migration `0029_protection_checklist.sql` menambah tabel baru di trust boundary client → PostgREST. Semua threat T-12-01 s/d T-12-05 sudah dimitigasi di dalam migration (RLS + WITH CHECK + CHECK constraints) — lihat threat_model di PLAN.md.

---
*Phase: 12-kesehatan-foundation*
*Completed: 2026-05-08 (partial — Task 3 checkpoint)*

## Self-Check

- [x] `supabase/migrations/0029_protection_checklist.sql` — FOUND (commit 70529de)
- [x] `supabase/tests/12-protection-checklist.sql` — FOUND (commit ea34877)
- [x] Commit 70529de exists in git log
- [x] Commit ea34877 exists in git log

## Self-Check: PASSED
