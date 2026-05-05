---
phase: 05-security-hardening
plan: 01
subsystem: database
tags: [postgres, rls, supabase, plpgsql, security, rpc, idor]

# Dependency graph
requires:
  - phase: 04-mark-bill-paid
    provides: "aggregate_by_period / aggregate_by_category RPCs (LANGUAGE sql, no IDOR guard)"
  - phase: 01-foundation
    provides: "0006_multi_user.sql — is_admin(), enforce_email_allowlist(), profiles_select USING (true), allowed_emails_select USING (true)"
provides:
  - "0017_tighten_rls.sql — idempotent migration closing SEC-02/03/04 (H-04/H-05/H-06)"
  - "profiles_select restricted to own row + is_admin() — closes info-disclosure"
  - "allowed_emails_select admin-only — closes info-disclosure on allowlist"
  - "enforce_email_allowlist hard-coded bootstrap fallback — closes empty-table bypass"
  - "aggregate_by_period + aggregate_by_category IDOR guards with ERRCODE 42501"
  - "mapSupabaseError SQLSTATE 42501/28000 branches — surfaces 'Akses ditolak' in UI"
affects:
  - 05-security-hardening/05-04 (DB push applies 0017; Playwright tests verify all 4 blocks)
  - src/db/reports.ts (RPC callers receive structured SQLSTATE via mapSupabaseError)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IDOR guard pattern: v_target_uid <> auth.uid() AND NOT is_admin() RAISE EXCEPTION ERRCODE 42501"
    - "RLS SELECT caching: USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()))"
    - "SQLSTATE extraction in mapSupabaseError: objCode branch before message-based chain"

key-files:
  created:
    - supabase/migrations/0017_tighten_rls.sql
  modified:
    - src/lib/errors.ts

key-decisions:
  - "Single migration bundles SEC-02+03+04 — splitting risks incomplete rollout (H-04 fixed but H-06 open)"
  - "SQLSTATE branches before message branches in mapSupabaseError — more specific, deterministic"
  - "Hard-coded rinoadi28@gmail.com in enforce_email_allowlist empty-table branch — defense-in-depth only, allowlist remains source of truth when non-empty"
  - "aggregate_by_period/category: LANGUAGE changed sql → plpgsql (Postgres allows in-place with CREATE OR REPLACE)"

patterns-established:
  - "IDOR guard in SECURITY DEFINER RPCs: COALESCE(p_user_id, auth.uid()) + guard v_target_uid <> auth.uid() AND NOT is_admin()"
  - "search_path = public, pg_catalog in aggregate RPCs (CVE-2018-1058 defense)"
  - "SQLSTATE-aware mapSupabaseError: extract code field alongside message, branch on code first"

requirements-completed: [SEC-02, SEC-03, SEC-04]

# Metrics
duration: 15min
completed: 2026-04-27
---

# Phase 05 Plan 01: Security Hardening — RLS + RPC IDOR Summary

**Idempotent migration 0017_tighten_rls.sql (157 LOC) closes three IDOR/info-disclosure findings: tightened profiles/allowlist RLS SELECT policies, hardened allowlist bootstrap fallback, and added ERRCODE-42501 guards to both aggregate RPCs; companion mapSupabaseError update surfaces 'Akses ditolak' instead of raw Postgres text.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-27T10:10:00Z
- **Completed:** 2026-04-27T10:25:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Authored `supabase/migrations/0017_tighten_rls.sql` (157 LOC) — four idempotent blocks covering all SEC findings in one deploy gate
- Replaced `profiles_select USING (true)` with `(SELECT auth.uid()) = id OR (SELECT public.is_admin())` — closes H-04 info-disclosure
- Replaced `allowed_emails_select USING (true)` with `(SELECT public.is_admin())` only — non-admin reads return empty set
- Hardened `enforce_email_allowlist` empty-table branch to only allow hard-coded bootstrap admin — closes H-05 bypass
- Switched both aggregate RPCs from `LANGUAGE sql` to `LANGUAGE plpgsql` with IDOR guard (`ERRCODE 42501`) and unauthenticated guard (`ERRCODE 28000`) — closes H-06
- Extended `mapSupabaseError` to extract `.code` (SQLSTATE) and branch on 42501 → 'Akses ditolak', 28000 → 'Sesi habis' before message chain

## Task Commits

Each task was committed atomically:

1. **Task 1: Author migration 0017_tighten_rls.sql** - `218746b` (feat)
2. **Task 2: Extend mapSupabaseError with SQLSTATE 42501/28000** - `7f8a45b` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `supabase/migrations/0017_tighten_rls.sql` — New idempotent migration, 157 LOC, 4 hardening blocks (SEC-02+03+04)
- `src/lib/errors.ts` — Added objCode extraction + SQLSTATE 42501/28000 branches before message-based chain (+14 LOC)

## 0006_multi_user.sql — NOT EDITED

Confirmed: `git diff --name-only HEAD~2 HEAD` shows only `supabase/migrations/0017_tighten_rls.sql` and `src/lib/errors.ts`. Migration 0006 (deployed) was not touched.

## mapSupabaseError Diff (lines added)

```ts
// NEW: extract .code (SQLSTATE) from Supabase error objects
const objCode =
  typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code: unknown }).code
    : undefined
// ...
const code = typeof objCode === 'string' ? objCode : ''

// NEW: SQLSTATE branches (before message-based chain)
if (code === '42501' || msg === 'Akses ditolak') {
  return 'Akses ditolak'
}
if (code === '28000' || msg === 'Unauthenticated') {
  return 'Sesi habis. Silakan login ulang.'
}
```

## Decisions Made

- **Single migration for SEC-02/03/04:** Bundling avoids incomplete rollouts (H-04 tightened but H-06 IDOR still open). `DROP POLICY IF EXISTS` + `CREATE OR REPLACE FUNCTION` make it safely re-runnable.
- **Comment de-duplication:** Plan's verbatim SQL included `rinoadi28@gmail.com` in both a comment line and the hard-coded fallback. Acceptance criterion required exactly 1 grep match → removed email from comment, kept functional hard-code. No functional change.
- **SQLSTATE branch ordering:** 42501/28000 branches placed before message-based chain — SQLSTATE is unambiguous while message strings can overlap with other errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed email from comment to satisfy acceptance grep count**
- **Found during:** Task 1 (post-write acceptance check)
- **Issue:** Plan's verbatim SQL block included `rinoadi28@gmail.com` in both a comment (`-- Mirrors invariant from 0006:66-68 (initial seed = rinoadi28@gmail.com)`) and the functional hard-code (`IF NEW.email IS DISTINCT FROM 'rinoadi28@gmail.com'`). Acceptance criterion says `grep -c "rinoadi28@gmail.com"` returns `1`. The comment created a 2nd match.
- **Fix:** Changed comment to `-- Mirrors invariant from 0006:66-68 (initial seed = bootstrap admin email).` — preserves intent, satisfies acceptance criterion, functional code unchanged.
- **Files modified:** `supabase/migrations/0017_tighten_rls.sql`
- **Verification:** `grep -c "rinoadi28@gmail.com" supabase/migrations/0017_tighten_rls.sql` returns `1`
- **Committed in:** `218746b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — plan acceptance criterion conflict with verbatim SQL)
**Impact on plan:** Zero functional impact. Comment wording adjusted only; hard-coded fallback is identical.

## Issues Encountered

None — both tasks completed without blocking issues.

## Forward Note: Plan 05-04

Plan 05-04 will run `supabase db push --linked` to apply migration 0017 to production Supabase Cloud. Playwright tests in 05-04 will verify all four hardening blocks are active:
- profiles_select restricts non-admin cross-user reads
- allowed_emails_select returns empty for non-admin
- enforce_email_allowlist rejects non-admin on empty table
- aggregate RPCs reject cross-user calls with ERRCODE 42501

## User Setup Required

None — no external service configuration required. DB push deferred to Plan 05-04.

## Next Phase Readiness

- Migration file authored and committed; ready for DB push in Plan 05-04
- mapSupabaseError updated; all RPC 42501 rejections will surface as 'Akses ditolak' in UI
- No blockers — Plan 05-02 (Edge Function auth + CORS) can proceed in parallel (Wave 1)

---
*Phase: 05-security-hardening*
*Completed: 2026-04-27*
