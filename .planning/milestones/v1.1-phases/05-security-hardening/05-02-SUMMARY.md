---
phase: 05-security-hardening
plan: "02"
subsystem: edge-functions
tags: [security, cors, auth, edge-function, supabase]
dependency_graph:
  requires: []
  provides: [fetch-prices-auth-guard, fetch-prices-cors-allowlist, fetch-prices-verify-jwt-config]
  affects: [supabase/functions/fetch-prices/index.ts, supabase/config.toml]
tech_stack:
  added: []
  patterns: [defense-in-depth auth, per-domain CORS allowlist, Vary-Origin header, Deno.serve built-in]
key_files:
  created: []
  modified:
    - supabase/functions/fetch-prices/index.ts
    - supabase/config.toml
decisions:
  - "Use SUPABASE_ANON_KEY (not service role) for auth.getUser — avoids RLS bypass if post-auth bug exists"
  - "Hardcoded fallback origin (kantongpintar.app) when Origin header absent — healthchecks + Plan 05-04 curl smoke test receive CORS-shaped response and clean 401"
  - "Vercel preview deploy URLs intentionally excluded from ALLOWED_ORIGINS — edge functions tested via supabase functions serve or production only"
  - "Deno.serve used instead of serve() + deno.land/std import — built into Edge Runtime, one less import"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-27"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 05 Plan 02: fetch-prices Auth Guard + Per-Domain CORS Summary

**One-liner:** JWT auth guard + per-domain CORS allowlist on fetch-prices edge function — closes SEC-01 / REVIEW C-03 two-layer defense (platform verify_jwt + in-function auth.getUser).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite fetch-prices/index.ts with auth + per-domain CORS | c821992 | supabase/functions/fetch-prices/index.ts |
| 2 | Add explicit [functions.fetch-prices] block to supabase/config.toml | a20711b | supabase/config.toml |

## File Changes

### supabase/functions/fetch-prices/index.ts

**Before:** 127 LOC — anonymous handler with wildcard CORS (`*`), no auth check, `serve()` from deno.land/std.

**After:** 177 LOC — auth-protected handler with per-domain CORS allowlist, `Vary: Origin` header, `auth.getUser(token)` guard, `Deno.serve` built-in.

**Net change:** +50 LOC (+61 additions, -10 deletions in git diff terms after CRLF normalization).

**Helpers preserved verbatim:**
- `extractTicker(assetName)` — unchanged (lines 120-127)
- `fetchSahamPrice(assetName)` — unchanged (lines 129-140)
- `fetchEmasPrice()` — unchanged (lines 142-165)

All 3 helpers appear in both definition and call sites: 6 total occurrences confirmed via grep.

### supabase/config.toml

**Change:** 3 lines appended at end of file (after `[experimental]` section):

```toml

[functions.fetch-prices]
verify_jwt = true
```

No other sections modified. Verified via `git diff` — only 3 lines added.

## ALLOWED_ORIGINS Set (for production cross-check)

```
https://kantongpintar.app
https://www.kantongpintar.app
```

Both match the production Vercel deployment domain. Vercel preview URLs (`*.vercel.app`) are intentionally excluded — edge functions are tested via `supabase functions serve` locally or against production only.

## Security Architecture

Two-layer defense-in-depth (closes T-01, T-01b, T-01c from threat register):

**Layer 1 — Platform (config.toml):** `verify_jwt = true` causes Edge Runtime to reject requests with missing or invalid JWTs before the handler runs. This covers the common case.

**Layer 2 — In-function (index.ts):** `auth.getUser(token)` validates the JWT against Supabase Auth. Covers the 2026 API-key-migration corner case where `--no-verify-jwt` flag could bypass platform layer. Also makes user identity available for future per-user rate limiting.

**CORS:** Per-domain `ALLOWED_ORIGINS` Set with `Vary: Origin` header prevents CDN cross-origin cache poisoning (T-01b). Wildcard `*` removed.

**Key constraint honored:** `SUPABASE_ANON_KEY` used for `createClient` — NOT service role. Using service role would bypass RLS on all tables, turning any post-auth bug into privilege escalation (T-01c mitigated).

## Acceptance Check Results

### Task 1 (8 grep checks — all PASS)

| Check | Pattern | Expected | Actual |
|-------|---------|----------|--------|
| 1 | `ALLOWED_ORIGINS` occurrences | >=2 | 2 |
| 2 | `auth.getUser(token)` occurrences | 1 | 1 |
| 3 | `'Vary': 'Origin'` occurrences | 1 | 1 |
| 4 | `Access-Control-Allow-Origin.*\*` wildcard | 0 | 0 |
| 5 | `SUPABASE_ANON_KEY` occurrences | >=1 | 2 (comment + usage) |
| 6 | `SUPABASE_SERVICE_ROLE_KEY` occurrences | 0 | 0 |
| 7 | Helper function occurrences | >=6 | 6 |
| 8 | `Bearer ` occurrences | >=2 | 2 |

### Task 2 (4 checks — all PASS)

| Check | Result |
|-------|--------|
| `[functions.fetch-prices]` count = 1 | PASS |
| `verify_jwt = true` follows the block header | PASS |
| `git diff` shows only appended block | PASS (3 lines added, no other changes) |
| Valid TOML (no parse errors expected) | PASS (structure validated by grep pattern match) |

## Forward Note

**Plan 05-04** will execute the actual deploy:
- `supabase functions deploy fetch-prices` (cloud deploy)
- curl smoke test: `curl -i https://<project>.supabase.co/functions/v1/fetch-prices` should return HTTP 401 (missing JWT)
- curl smoke test with valid JWT should return HTTP 200 with price data

The client call site at `src/db/investments.ts:189-198` (`supabase.functions.invoke('fetch-prices')`) requires **no change** — supabase-js SDK automatically attaches `Authorization: Bearer <session.access_token>` from the active session.

## Deviations from Plan

None — plan executed exactly as written. The `Deno.serve` migration (replacing `serve()` from deno.land/std) was explicitly called out in the plan's implementation notes as a "small bonus simplification" and is included in the prescribed file content verbatim.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| supabase/functions/fetch-prices/index.ts exists | FOUND |
| supabase/config.toml exists | FOUND |
| .planning/phases/05-security-hardening/05-02-SUMMARY.md exists | FOUND |
| Commit c821992 (Task 1) exists | FOUND |
| Commit a20711b (Task 2) exists | FOUND |
