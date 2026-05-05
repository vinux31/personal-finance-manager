# Phase 5 Verification — Security Hardening

**Date completed:** 2026-04-28
**Verifier:** Rino (operated via Claude Code orchestrated by /gsd-execute-phase 5)
**Verdict:** **PASS-WITH-NOTES**

Notes summary:
- One in-flight defect found and fixed during verification: legacy 3-arg `sql` `aggregate_by_period`/`aggregate_by_category` left orphaned by 0017's signature change. Closed via ad-hoc migration `0018_drop_legacy_aggregates.sql`.
- Migrations applied via Studio SQL Editor fallback (not `supabase db push`) — known limitation per memory `project_supabase_migration_workflow.md`. Migration history in `supabase_migrations.schema_migrations` may show 0017/0018 as "Local-only" until a future repair; functional state on cloud DB is correct.
- ROADMAP success criterion #3 (TRUNCATE allowed_emails + signup) verified DB-side ONLY (Task 3 Section 2). The destructive end-to-end signup variant intentionally not run against production to avoid data loss; would require a staging mirror to upgrade to clean PASS.
- One pre-existing frontend bug (not Phase 5 scope) surfaced during UAT-4: app attempts `INSERT INTO net_worth_snapshots` while View-As is active → RLS correctly rejects with 42501. Should be filed as a v1.2 ticket "Skip net_worth_snapshots auto-insert when ViewAs is active".

## ROADMAP Success Criteria Mapping

| # | Criterion (verbatim from ROADMAP) | Evidence | Verdict |
|---|----------------------------------|----------|---------|
| 1 | curl POST /fetch-prices without Authorization → HTTP 401 | Task 4 Smoke #1 + #2 — `05-04-curl-output.txt`. Two HTTP 401 responses, one HTTP 200 with valid admin JWT. | **PASS** |
| 2 | Non-admin SELECT profiles returns 1 row; SELECT allowed_emails returns empty | UAT-1 (`row_count=1`, own profile only, `is_admin=false`) + UAT-2 (`[]` empty array) — `05-04-uat-rest.txt`. Plus DB-side Task 3 Section 1 (5 PASS gates). | **PASS** |
| 3 | TRUNCATE allowed_emails + signup non-admin → 'Allowlist kosong'; signup rinoadi28 → success | Task 3 Section 2 — runner returned `Success. No rows returned.`, proving 0 FAIL across 17 EXCEPTION-converted gates including the bootstrap fail-closed assertions. The destructive TRUNCATE+signup end-to-end variant intentionally NOT run via UAT against production data; would require a staging mirror. | **PASS-WITH-NOTES (DB-side only)** |
| 4 | Non-admin RPC aggregate_by_period(p_user_id := admin) → SQLSTATE 42501 | UAT-3a (`code=42501, "Akses ditolak"`) + UAT-3c (same for aggregate_by_category) + Task 3 Section 3 + post-DROP confirmation that only the guarded plpgsql versions remain (`05-04-uat-rest.txt`, `05-04-pgtest-output.txt`, `05-04-UAT.md` Task 1 round-2 verification). | **PASS** |
| 5 | Admin View-As → Reports/Goals/aggregate work with arbitrary p_user_id | UAT-4 — Playwright walkthrough proved admin View-As → Reports tab + Goals sub-tab render with impersonated user's data, exit View-As → admin's own data renders again. Plus Task 3 Section 4 (3 PASS gates DB-side). UAT-5 also exercised all 4 granularity tabs without aggregate-RPC errors. Screenshots: `uat-05-04-uat4-goals-viewas.png`, `uat-05-04-uat5-laporan-tahun.png`. | **PASS** |

## STRIDE Threat Mitigation Status

| Threat | Disposition | Evidence |
|--------|-------------|----------|
| T-01 (edge fn DoS / quota drain) | **mitigate** | Task 4 Smoke #1 + #2 returned 401 from Supabase runtime auth gateway (`verify_jwt = true`). Defense-in-depth even stronger than plan-time — request never reaches handler code. |
| T-02 (profiles info disclosure) | **mitigate** | UAT-1 returned only own profile row (`row_count=1`). Tightened `profiles_select` policy `((SELECT auth.uid()) = id OR (SELECT public.is_admin()))` works. |
| T-02b (allowed_emails info disclosure) | **mitigate** | UAT-2 returned `[]` for non-admin. Tightened `allowed_emails_select` policy `((SELECT public.is_admin()))` works. |
| T-03 (allowlist bootstrap bypass) | **mitigate** | Task 3 Section 2 PASS — `enforce_email_allowlist` hard-coded `'rinoadi28@gmail.com'` fallback fires when `allowed_emails` is empty. DB-side only. |
| T-04 (aggregate IDOR) | **mitigate** | UAT-3a/c returned `42501 "Akses ditolak"`. UAT-3b (no `p_user_id`) returned safely-scoped empty array. After patch 0018 dropped legacy 3-arg `sql` versions, only guarded plpgsql remains. |
| T-05 (View-As regression) | **mitigate** | UAT-4 — admin View-As impersonation switched data context for Reports + Goals + then back to own data, all without aggregate-RPC errors. UAT-5 also covered all 4 granularity options. |

## Deferred / Notes

- **Migration history mismatch.** 0014..0018 all show as Local-only in `supabase migration list --linked` because the project policy is to apply via Studio SQL Editor (per memory `project_supabase_migration_workflow.md` — `supabase migration repair` is broken in this project). Functional state on cloud DB is correct; reconciling history is a separate hygiene task.
- **Phase 5 patch 0018.** `supabase/migrations/0018_drop_legacy_aggregates.sql` was authored *during* 05-04 verification to close a defense-in-depth gap that 0017 alone left open (`CREATE OR REPLACE FUNCTION` does not replace functions of different signature; the legacy 3-arg `sql` `aggregate_by_period`/`aggregate_by_category` with `SECURITY DEFINER` and no user filter remained reachable). Carry into Phase 6 retro: planner should require explicit `DROP FUNCTION` whenever a function signature changes.
- **net_worth_snapshots / View-As frontend bug.** Console shows `42501` errors when View-As active — frontend auto-snapshot tries to INSERT with impersonated user_id while admin JWT cannot satisfy that table's RLS write policy. RLS behavior is correct (defense holds); frontend should skip the snapshot job in View-As mode. File as v1.2 ticket.
- **SC #3 destructive variant.** TRUNCATE allowed_emails + then attempt signup is intentionally not exercised against production. Recommend setting up a staging mirror in v1.2 to upgrade SC #3 to clean PASS.
- **Smoke body wording deviation.** Task 4 smoke #1/#2 returned `{"code":"UNAUTHORIZED_NO_AUTH_HEADER",...}` / `{"code":"UNAUTHORIZED_INVALID_JWT_FORMAT",...}` instead of plan-stated `{"error":"Unauthorized"}` because runtime gateway rejects pre-handler when `verify_jwt = true`. This is stronger defense-in-depth — accepted as-is.

## Files Produced

- `supabase/migrations/0017_tighten_rls.sql` (authored Wave 1, applied Studio fallback)
- `supabase/migrations/0018_drop_legacy_aggregates.sql` (authored during 05-04, applied Studio fallback)
- `supabase/functions/fetch-prices/index.ts` (rewritten Wave 1, deployed via `supabase functions deploy`)
- `supabase/config.toml` (added `[functions.fetch-prices] verify_jwt = true`)
- `src/lib/errors.ts` (SQLSTATE 42501/28000 branches added Wave 1)
- `supabase/tests/05-tighten-rls.sql` (Wave 1 test file, 276 lines)
- `.planning/phases/05-security-hardening/05-04-UAT.md` (full UAT log)
- `.planning/phases/05-security-hardening/05-04-pgtest-output.txt` (Task 3 evidence)
- `.planning/phases/05-security-hardening/05-04-pgtest-runner.sql` (Task 3 runner — NOTICE FAIL → EXCEPTION FAIL transformation)
- `.planning/phases/05-security-hardening/05-04-curl-output.txt` (Task 4 evidence)
- `.planning/phases/05-security-hardening/05-04-uat-rest.txt` (Task 5 UAT-1/2/3 REST evidence)
- `.planning/phases/05-security-hardening/uat-05-04-uat4-goals-viewas.png` (screenshot)
- `.planning/phases/05-security-hardening/uat-05-04-uat5-laporan-tahun.png` (screenshot)
- `.planning/phases/05-security-hardening/uat-05-04-console-errors.txt` (final console state)
- `.planning/phases/05-security-hardening/05-VERIFICATION.md` (this file)
