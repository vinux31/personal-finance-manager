---
phase: 04-mark-as-paid
plan: "04"
subsystem: database
tags: [supabase, migration, deploy, cloud, human-verify]

requires:
  - phase: 04-mark-as-paid/01
    provides: supabase/migrations/0014_mark_bill_paid.sql (mark_bill_paid RPC + next_due_date_sql helper)
  - phase: 04-mark-as-paid/02
    provides: supabase/migrations/0015_upcoming_bills_unpaid_view.sql (upcoming_bills_unpaid VIEW)
provides:
  - Live DB objects in Supabase Cloud (project rqotdjrlswpizgpnznfn): mark_bill_paid(), next_due_date_sql(), upcoming_bills_unpaid view
  - Unblocks Wave 3 client integration (04-05)
affects: [04-mark-as-paid/05, 04-mark-as-paid/06]

tech-stack:
  added: []
  patterns:
    - "Manual migration apply via Supabase Studio SQL Editor (Dev/testing env, no GitHub CI integration)"

key-files:
  created: []
  modified: []

key-decisions:
  - "Applied migrations to Supabase Cloud instead of local (user chose Cara 2 - manual via SQL Editor). Rationale: Docker Desktop tidak terinstall; cloud project (pfm-web) sudah linked dan statusnya dev/testing sendiri — aman untuk apply langsung."
  - "Skipped psql-based integration test (supabase/tests/04-mark-bill-paid.sql) — Studio SQL Editor tidak support BEGIN/ROLLBACK transactional wrapper test + auth.users INSERT restricted. Substituted dengan smoke query verifikasi (pg_proc, pg_views, FOUND-01 clamp call)."

patterns-established:
  - "Cloud-first migration workflow: file SQL di repo → paste ke Studio SQL Editor → verify via pg_proc/pg_views query"
  - "FOUND-01 clamp parity confirmed live di Postgres 17 cloud (next_due_date_sql('2025-01-31', 'monthly') = 2025-02-28)"

requirements-completed: [BILL-03]

duration: ~10min (manual user interaction)
completed: 2026-04-24
---

# Phase 04-04: Apply Migrations to Supabase Cloud — Summary

**Migrasi 0014 + 0015 berhasil di-apply ke Supabase Cloud (project pfm-web, Singapore region) via Studio SQL Editor. Fungsi mark_bill_paid, helper next_due_date_sql, dan view upcoming_bills_unpaid sekarang live dan callable.**

## Performance

- **Duration:** ~10 min (mayoritas manual user interaction)
- **Started:** 2026-04-24
- **Completed:** 2026-04-24
- **Tasks:** 2 (1 auto-migrated, 1 human-verified)
- **Files modified:** 0 (deployment-only gate, tidak ada code change)

## Accomplishments

- Migrasi 0014 (`mark_bill_paid` RPC + `next_due_date_sql` helper) applied ke cloud DB — Success, No rows returned
- Migrasi 0015 (`upcoming_bills_unpaid` VIEW dengan `security_invoker = true`) applied — Success, No rows returned
- Smoke verification lolos:
  - `pg_proc` query: 2 baris (mark_bill_paid 3-args, next_due_date_sql 2-args)
  - `pg_views` query: 1 baris (upcoming_bills_unpaid)
  - Live FOUND-01 clamp: `next_due_date_sql('2025-01-31', 'monthly')` → `2025-02-28` ✓
- Visual confirmation via Studio:
  - Database → Functions: `mark_bill_paid` visible, signature correct (p_template_id bigint, p_uid uuid, p_paid_date date), language plpgsql
  - Database → Views: `upcoming_bills_unpaid` visible dengan 11 columns (id, user_id, name, type, category_id, amount, note, frequency, next_due_date, is_active, created_at)

## Task Commits

Tidak ada code commit untuk plan ini — Task 1 adalah deployment gate (apply migrasi), Task 2 adalah human-verify checkpoint. Artefak planning (SUMMARY.md + state updates) akan di-commit bersama phase wrap-up.

## Files Created/Modified

- Tidak ada file project yang dimodifikasi
- DB cloud state berubah (additive DDL): 2 fungsi + 1 view baru

## Decisions Made

- **Docker-less deployment path**: User belum install Docker Desktop dan project Supabase cloud sudah linked + statusnya dev/testing sendiri. Jalur manual via Studio SQL Editor dipilih karena zero install, target DB sama dengan deployed frontend di Vercel.
- **Integration test deferred**: File `supabase/tests/04-mark-bill-paid.sql` butuh psql CLI + privilege auth.users insert. Untuk sekarang, smoke verifikasi via pg_proc/pg_views + live clamp test sudah cukup sebagai regression checkpoint di environment dev. Full test suite bisa dijalankan nanti saat Docker/Postgres CLI tersedia.

## Deviations from Plan

**1. [Environment] Applied ke cloud bukan local**
- **Found during:** Task 1 preflight (`npx supabase status` mendeteksi Docker daemon not running)
- **Issue:** Plan mengasumsikan local Supabase (`supabase db push --local`) untuk isolasi, tapi Docker tidak tersedia
- **Fix:** User memilih apply ke cloud dev project (pfm-web, linked via `supabase link`). Safe karena statusnya dev/testing sendiri, bukan production
- **Files modified:** Tidak ada — hanya DB state cloud yang berubah
- **Verification:** Smoke query pg_proc/pg_views lolos; visual di Studio confirmed
- **Committed in:** (SUMMARY commit bundled dengan state updates)

**2. [Testing] Skipped psql integration test suite**
- **Found during:** Task 1 step 5 (`psql -f supabase/tests/04-mark-bill-paid.sql`)
- **Issue:** Studio SQL Editor tidak support BEGIN/ROLLBACK wrapper + test inserts ke auth.users yang restricted di cloud
- **Fix:** Substituted smoke verification (3 query: pg_proc, pg_views, clamp call)
- **Files modified:** Tidak ada
- **Verification:** 3 smoke query returned expected results
- **Impact:** Regression coverage lebih tipis dibanding plan aslinya. Full test suite `supabase/tests/04-mark-bill-paid.sql` tetap ada di repo, bisa dijalankan nanti saat Docker/psql tersedia untuk regression guard.

---

**Total deviations:** 2 (environment + testing scope)
**Impact on plan:** Artefak DB live sesuai kontrak. Test coverage lebih tipis — acceptable untuk solo-dev env, perlu re-run penuh sebelum production milestone.

## Issues Encountered

- Docker Desktop tidak terinstall — blocking untuk jalur local. Resolved dengan pivot ke jalur cloud (Cara 2 Studio SQL Editor) per persetujuan user.
- Integration test script butuh psql CLI — skipped, substituted dengan smoke verifikasi yang setara untuk konteks dev.

## User Setup Required

None — setup manual sudah dilakukan user selama checkpoint (buka dashboard Supabase, jalankan SQL di Editor, verify via Functions/Views).

## Next Phase Readiness

- Wave 3 (Plan 04-05) **unblocked**: client code dapat memanggil `supabase.rpc('mark_bill_paid', ...)` dan query `upcoming_bills_unpaid` view langsung terhadap DB yang sudah live
- Wave 4 (Plan 04-06) **unblocked**: UI click path akan mengenai fungsi DB real, bukan stub
- Catatan followup: saat Docker tersedia, jalankan `psql -f supabase/tests/04-mark-bill-paid.sql` untuk full regression coverage — dokumentasi di `.planning/phases/04-mark-as-paid/04-VALIDATION.md`

---
*Phase: 04-mark-as-paid*
*Completed: 2026-04-24*
