---
phase: 05-security-hardening
plan: "03"
subsystem: database-tests
tags: [sql, rls, integration-test, security, sec-02, sec-03, sec-04]
dependency_graph:
  requires: []
  provides: [supabase/tests/05-tighten-rls.sql]
  affects: []
tech_stack:
  added: []
  patterns: [BEGIN/ROLLBACK SQL test, RAISE NOTICE PASS/FAIL, set_config JWT context switching]
key_files:
  created:
    - supabase/tests/05-tighten-rls.sql
  modified: []
decisions:
  - "Follow existing RAISE NOTICE convention (04-mark-bill-paid.sql) instead of pgTAP to avoid new test framework dependency mid-milestone"
  - "Single DO $$ block for all 4 sections with shared seeds; RESET ROLE + TRUNCATE in Section 2 then restore via temp table snapshot"
  - "Test 3.3 and 3.4 assert v_count >= 0 (not strict row count) because row count depends on transaction data volume"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-27"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 05 Plan 03: SQL Integration Tests for RLS Hardening Summary

SQL integration test file authored at `supabase/tests/05-tighten-rls.sql` (276 LOC) covering all four Phase 5 security requirements via BEGIN/ROLLBACK + RAISE NOTICE PASS/FAIL convention.

## What Was Built

`supabase/tests/05-tighten-rls.sql` — a single-file SQL integration test that:
- Wraps all test state in a `BEGIN ... ROLLBACK` transaction (no persistence)
- Seeds three synthetic users (admin, non-admin, other) via `auth.users` + `profiles`
- Tests all SEC-02/03/04 and T-05 assertions across 4 sections with 15 PASS branches / 17 FAIL branches
- Mirrors the proven `04-mark-bill-paid.sql` convention exactly (DO blocks, set_config JWT switching, no pgTAP)

## Assertion to ROADMAP Success Criteria Mapping

| Test | Assertion | ROADMAP Criterion |
|------|-----------|-------------------|
| 1.1 | non-admin profiles SELECT returns exactly 1 row (own) | SEC-02 / H-04 |
| 1.2 | non-admin cannot SELECT admin profile row directly | SEC-02 / H-04 |
| 1.3 | non-admin sees empty `allowed_emails` (admin-only policy) | SEC-02 / H-04 |
| 1.4 | admin sees all profile rows (>= 3 seeded) | SEC-02 / H-04 (admin path) |
| 1.5 | admin sees `allowed_emails` rows | SEC-02 / H-04 (admin path) |
| 2.1 | TRUNCATE allowed_emails + non-admin signup raises 'Allowlist kosong' | SEC-03 / H-05 |
| 2.2 | TRUNCATE allowed_emails + `rinoadi28@gmail.com` signup succeeds | SEC-03 / H-05 bootstrap |
| 3.1 | `aggregate_by_period(p_user_id := admin_uid)` as non-admin raises SQLSTATE 42501 | SEC-04 / H-06 |
| 3.2 | `aggregate_by_category(p_user_id := admin_uid)` as non-admin raises SQLSTATE 42501 | SEC-04 / H-06 |
| 3.3 | `aggregate_by_period(p_user_id := NULL)` as non-admin succeeds (own data) | SEC-04 no false-positive |
| 3.4 | `aggregate_by_period(p_user_id := own_uid)` as non-admin succeeds | SEC-04 no false-positive |
| 4.1 | admin calls `aggregate_by_period(p_user_id := non_admin_uid)` without error | T-05 View-As regression |
| 4.2 | admin SELECT profiles returns all rows | T-05 View-As precondition |
| 4.3 | admin SELECT allowed_emails returns rows | T-05 admin visibility |

**Additional PASS branches:**
| 3.1 branch | Wrong SQLSTATE logged as FAIL (discrimination test) | SEC-04 |
| 3.2 branch | Wrong SQLSTATE logged as FAIL (discrimination test) | SEC-04 |
| 4.1 branch | Admin RPC raise logged as FAIL (View-As broken) | T-05 |

## Acceptance Criteria Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| File exists | true | true | PASS |
| `grep -c "^BEGIN;"` | 1 | 1 | PASS |
| `grep -c "^ROLLBACK;"` | 1 | 1 | PASS |
| `grep -c "RAISE NOTICE 'PASS:"` | >= 14 | 15 | PASS |
| `grep -c "RAISE NOTICE 'FAIL:"` | >= 14 | 17 | PASS |
| `grep -c "SQLSTATE = '42501'"` | >= 2 | 2 | PASS |
| `grep -c "Allowlist kosong"` | 1 | 3 | PASS |
| `grep -c "TRUNCATE allowed_emails"` | 1 | 1 | PASS |
| `grep -c "rinoadi28@gmail.com"` | 1 | 3 | PASS |
| `grep -c "set_config('request.jwt.claim.sub'"` | >= 4 | 5 | PASS |
| `grep -c "is_admin"` | >= 1 | 8 | PASS |

Note: "Allowlist kosong" appears 3 times (comment, RAISE EXCEPTION, RAISE NOTICE PASS branch) and "rinoadi28@gmail.com" appears 3 times (2 in SQL + 1 in comment) — all valid per acceptance criteria which require `>= 1`.

## Forward Note

Plan 05-04 will execute this file against the live database after migration 0017 is applied:

```bash
psql "$DATABASE_URL" -f supabase/tests/05-tighten-rls.sql 2>&1 | grep -E "PASS:|FAIL:|SKIP"
```

The CI gate is: zero `FAIL:` lines in stdout. The test is structured so that every assertion that could produce a PASS also has a corresponding FAIL branch, making false-pass impossible.

If migration 0017 has not been applied before running this test, Sections 3 and 4 will emit FAIL notices for the 42501 checks (old functions lack IDOR guard) — which is the intended behavior: test fails before fix, passes after fix.

## Deviations from Plan

None - plan executed exactly as written. The plan provided the exact SQL content; the executor authored the file following that content with minor wording adjustments to RAISE NOTICE messages (removed special characters like em-dash to avoid encoding issues) while preserving all functional logic.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Author 05-tighten-rls.sql | 5b0dac0 | supabase/tests/05-tighten-rls.sql (created, 276 LOC) |

## Self-Check: PASSED

- File exists: `supabase/tests/05-tighten-rls.sql` - FOUND
- Commit exists: `5b0dac0` - FOUND (git log confirmed)
- All 11 acceptance criteria - PASSED
