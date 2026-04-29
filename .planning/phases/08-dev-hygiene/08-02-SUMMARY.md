---
phase: 08-dev-hygiene
plan: "02"
subsystem: config-and-docs
tags: [seed, config, documentation, performance]
dependency_graph:
  requires: []
  provides: [supabase/seed.sql, PROJECT.md-performance-note]
  affects: [supabase/config.toml-sql_paths]
tech_stack:
  added: []
  patterns: []
key_files:
  created:
    - supabase/seed.sql
  modified:
    - .planning/PROJECT.md
decisions:
  - "seed.sql intentionally empty (single comment only) per T-08-02: no credentials, no PII, dev-only"
  - "Performance bullet wording exact per DEV-04 spec — not paraphrased, to preserve future-maintainer decision baseline"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-04-29"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
requirements_closed:
  - DEV-03
  - DEV-04
---

# Phase 8 Plan 02: Seed Placeholder + Performance Note Summary

**One-liner:** Created empty supabase/seed.sql to silence db reset warning (DEV-03) and added transactions_date_idx performance threshold note to PROJECT.md (DEV-04).

## What Was Built

### Task 1 — supabase/seed.sql (DEV-03)

Created `supabase/seed.sql` at the path already referenced by `supabase/config.toml:65` (`sql_paths = ["./seed.sql"]`). The file was missing, causing `supabase db reset` to warn/fail. File contains a single dev comment with no sensitive data per the T-08-02 threat mitigation.

### Task 2 — PROJECT.md Performance Bullet (DEV-04)

Added `**Performance:**` bullet to the `## Context` section of `.planning/PROJECT.md`, inserted after the `**Migrations:**` bullet and before `## Constraints`. Documents that the dashboard `recentTx` query uses `useTransactions({ limit: 5 })` + `transactions_date_idx` index, sufficient for < 50k rows, and flags materialized view migration as the threshold trigger for future maintainers.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 1eac892 | chore(08-02): add supabase/seed.sql placeholder (DEV-03) |
| 2 | c462e2a | docs(08-02): add performance note for recentTx query to PROJECT.md (DEV-04) |

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| seed.sql exists | `test -f supabase/seed.sql` | EXISTS |
| seed.sql content | `grep "Dev seed (empty)" supabase/seed.sql` | PASS |
| config.toml unchanged | `grep -c "sql_paths" supabase/config.toml` | 1 (unchanged) |
| transactions_date_idx | `grep "transactions_date_idx" .planning/PROJECT.md` | PASS |
| 50k rows | `grep "50k rows" .planning/PROJECT.md` | PASS |

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. `supabase/seed.sql` is a local-only dev file containing no credentials, PII, or executable logic — consistent with T-08-02 mitigation (Information Disclosure: accept via empty file).

## Self-Check: PASSED

- `supabase/seed.sql` exists: CONFIRMED
- `.planning/PROJECT.md` contains `transactions_date_idx`: CONFIRMED
- Task 1 commit 1eac892: CONFIRMED (git log)
- Task 2 commit c462e2a: CONFIRMED (git log)
