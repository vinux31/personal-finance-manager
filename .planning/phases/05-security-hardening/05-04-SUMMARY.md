---
phase: 05-security-hardening
plan: 04
status: complete
verdict: PASS-WITH-NOTES
completed_at: 2026-04-28
---

# Plan 05-04 — Deploy & Verify (Phase 5 Security Hardening Gate)

## What this plan accomplished

Wave 1 (plans 05-01/02/03) only authored files. This plan was the gate that:
1. Pushed the Wave 1 commits to production (Vercel + Supabase Cloud)
2. Verified each security guarantee actually holds against the live deployment
3. Caught and fixed an in-flight defect that Wave 1 had missed
4. Produced the verdict file mapping all ROADMAP success criteria to evidence

## Deploy timeline

| Step | Action | Channel | Outcome |
|------|--------|---------|---------|
| Task 0 | `git push origin master` (20 unpushed commits) → Vercel auto-deploy | git + Vercel | bundle hash rotated `twgtXJry` → `CY8TMNvn`, `42501`/`Akses ditolak` strings present in main bundle, HTTP 200 from kantongpintar.vercel.app |
| Task 1 | Apply `0017_tighten_rls.sql` to cloud DB | **Studio fallback** (per memory `project_supabase_migration_workflow.md`) | `Success. No rows returned.` ✓ |
| Task 1 patch | Apply `0018_drop_legacy_aggregates.sql` to cloud DB (in-flight defect fix — see below) | Studio fallback | `Success. No rows returned.` ✓ |
| Task 2 | `supabase functions deploy fetch-prices --project-ref rqotdjrlswpizgpnznfn` | Supabase CLI | version 4 ACTIVE, updated 2026-04-28 06:54:16 UTC |
| Task 3 | Run `supabase/tests/05-tighten-rls.sql` against live cloud DB | Studio fallback (via custom runner that converts NOTICE-FAIL → EXCEPTION-FAIL because Management API does not forward NOTICE) | `Success. No rows returned.` ⇒ 0 FAIL across 17 EXCEPTION gates ⇒ 14 PASS implicit |
| Task 4 | 3 curl smoke tests against deployed edge function | shell + curl | 2× HTTP 401 (no-auth + bogus token) + 1× HTTP 200 (valid admin JWT, body `{"results":[],"errors":[]}`) |
| Task 5 | UAT 1-3 via REST/RPC, UAT 4-5 via Playwright MCP | mixed | 5/5 PASS (see `05-04-UAT.md` Task 5 section for breakdown) |

## In-flight defect found and fixed

**Defect.** Migration `0017_tighten_rls.sql` used `CREATE OR REPLACE FUNCTION` to "swap" `aggregate_by_period`/`aggregate_by_category` from `LANGUAGE sql` to `LANGUAGE plpgsql` while *also* adding a new arg `p_user_id UUID DEFAULT NULL`. Because PostgreSQL keys function identity by argument signature, the new 4-arg plpgsql versions were created **alongside** (not replacing) the legacy 3-arg `sql` versions.

**Vulnerability scope.** Legacy 3-arg versions were `SECURITY DEFINER` with no user filter at all. Any authenticated user could POST to `/rest/v1/rpc/aggregate_by_period` with 3 args and obtain global aggregates of ALL users' transactions. Frontend (`src/db/reports.ts`) was unaffected because it always passes 4 named args (resolves to plpgsql), but PostgREST is still publicly callable directly with 3 args.

**Patch.** Authored `supabase/migrations/0018_drop_legacy_aggregates.sql` containing:
```sql
DROP FUNCTION IF EXISTS public.aggregate_by_period(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.aggregate_by_category(TEXT, DATE, DATE);
```

Pre-DROP safety scan: 0 dependencies in `pg_depend`, 0 callers using 3-arg form in repo, behavior post-DROP for any future 3-arg caller falls back to plpgsql via `p_user_id DEFAULT NULL` → `COALESCE(p_user_id, auth.uid())` → safe own-data scope. No regression risk.

Post-patch verification confirmed only the 2 plpgsql functions remain.

**Carry into Phase 6 retro.** Planner should require explicit `DROP FUNCTION` whenever a function signature changes (`CREATE OR REPLACE FUNCTION` is not a real swap).

## Verdict

**PASS-WITH-NOTES.** All 5 ROADMAP success criteria evidenced (SC #3 DB-side only, by design). All 6 STRIDE threats (T-01..T-05 + T-02b) mitigated and verified live. See `.planning/phases/05-security-hardening/05-VERIFICATION.md` for the verdict matrix.

## Files Produced (this plan)

- `supabase/migrations/0018_drop_legacy_aggregates.sql` (in-flight defect fix)
- `.planning/phases/05-security-hardening/05-04-UAT.md`
- `.planning/phases/05-security-hardening/05-04-pgtest-output.txt`
- `.planning/phases/05-security-hardening/05-04-pgtest-runner.sql`
- `.planning/phases/05-security-hardening/05-04-curl-output.txt`
- `.planning/phases/05-security-hardening/05-04-uat-rest.txt`
- `.planning/phases/05-security-hardening/uat-05-04-uat4-goals-viewas.png`
- `.planning/phases/05-security-hardening/uat-05-04-uat5-laporan-tahun.png`
- `.planning/phases/05-security-hardening/uat-05-04-console-errors.txt`
- `.planning/phases/05-security-hardening/05-VERIFICATION.md`

## Forward note

STATE.md update is the orchestrator's responsibility. Phase 5 is ready to be marked complete and the project to advance to Phase 6 (Race & Atomicity).
