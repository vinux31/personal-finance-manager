---
phase: 10-fetch-prices-cors-fix
plan: 01
subsystem: edge-function
tags: [cors, fetch-prices, vercel, infra-fix, sec-01, cons-02]
requires:
  - "supabase/functions/fetch-prices/index.ts existing CORS scaffolding (corsFor() function, Phase 5 SEC-01 JWT gate)"
provides:
  - "ALLOWED_ORIGINS Set yang menerima 3 production domains: kantongpintar.app, www.kantongpintar.app, kantongpintar.vercel.app"
  - "Updated comment block yang akurat membedakan production Vercel domain vs preview deploys"
  - "Source-side fix siap untuk Plan 10-02 deploy + live UAT"
affects:
  - "Production browser CORS pre-flight pada `kantongpintar.vercel.app` setelah deploy (Plan 10-02)"
  - "Live UAT SEC-01 + CONS-02 yang sebelumnya blocked oleh CORS rejection"
tech_stack:
  added: []
  patterns: ["Set-based domain allowlist (no wildcard, no preview branches)"]
key_files:
  created: []
  modified:
    - "supabase/functions/fetch-prices/index.ts (+4 / -2 lines: 1 new origin entry, 3 comment lines reworked)"
decisions:
  - "Hanya tambah 1 domain spesifik (`https://kantongpintar.vercel.app`) — TIDAK pakai wildcard `*.vercel.app`. Vercel preview deploys (per-branch hash URL) tetap excluded untuk mencegah cross-origin attack via expanded allowlist (T-10-01 mitigation)."
  - "Komentar di header CORS block di-update bersamaan dengan ALLOWED_ORIGINS change — eksplisit menyebut 'preview deploys' (bukan 'all Vercel deploys') untuk mencegah stale documentation menyesatkan future reviewer (T-10-04 mitigation)."
  - "Tidak ada `git push` di Plan 10-01 — push diserahkan ke Plan 10-02 setelah deploy + live UAT pass (solo dev verify-before-push pattern, konsisten dengan v1.1 production verify-before-close decision)."
  - "Business logic + JWT auth gate (lines 24+) tidak disentuh sama sekali — fix purely di CORS allowlist + dokumentasi terkait."
metrics:
  duration: "~3 minutes"
  completed: "2026-05-02"
  tasks_completed: 2
  files_modified: 1
  commits: 1
---

# Phase 10 Plan 01: fetch-prices-cors-fix (Source Edit) Summary

CORS allowlist edge function `fetch-prices` di-extend dengan `https://kantongpintar.vercel.app` agar production "Refresh Harga" tidak lagi diblok browser akibat Origin mismatch (`corsFor()` sebelumnya fallback ke `kantongpintar.app`). Komentar header CORS block ikut di-update untuk membedakan production Vercel domain vs preview deploys.

## Outcome

- File `supabase/functions/fetch-prices/index.ts` sekarang punya 3 entries di `ALLOWED_ORIGINS` Set.
- 1 commit lokal `feat(10): add kantongpintar.vercel.app to fetch-prices CORS allowlist` (SHA `cdc454f`).
- Working tree bersih untuk file target; siap untuk Plan 10-02 (deploy + live UAT).
- Belum di-push — push deferred per plan instruksi.

## Exact Diff Applied

### Before (lines 4-10 di `supabase/functions/fetch-prices/index.ts`)

```typescript
// ---------- CORS allowlist ----------
// Per-domain CORS. Vercel preview deploys are NOT in this list — test edge functions
// only via `supabase functions serve` locally OR via production. (Per research integration risk note.)
const ALLOWED_ORIGINS = new Set<string>([
  'https://kantongpintar.app',
  'https://www.kantongpintar.app',
])
```

### After (lines 4-11 di `supabase/functions/fetch-prices/index.ts`)

```typescript
// ---------- CORS allowlist ----------
// Per-domain CORS. Production domain `kantongpintar.vercel.app` (Vercel) included.
// Vercel preview deploys (e.g. `<branch>-<hash>.vercel.app`) are NOT in this list — test edge
// functions only via `supabase functions serve` locally OR via production.
const ALLOWED_ORIGINS = new Set<string>([
  'https://kantongpintar.app',
  'https://www.kantongpintar.app',
  'https://kantongpintar.vercel.app',
])
```

### Lines NOT changed (verified)

- Lines 1-3 (imports) — untouched
- `corsFor()` function (now lines 13-24) — untouched, fallback `'https://kantongpintar.app'` tetap aman karena hanya ditrigger saat origin tidak match
- Vary: Origin header (CDN cache poisoning mitigation, T-10-02) — intact
- All business logic (Handler, fetchSahamPrice, fetchEmasPrice, extractTicker) — untouched
- JWT auth gate (lines 56-82) — untouched (Phase 5 SEC-01 hardening preserved)

## Tasks Executed

| Task | Name                                                | Status | Commit                |
| ---- | --------------------------------------------------- | ------ | --------------------- |
| 1    | Add Vercel production domain ke ALLOWED_ORIGINS Set | done   | `cdc454f` (combined)  |
| 2    | Commit perubahan                                    | done   | `cdc454f`             |

Plan 10-01 strukturnya: Task 1 adalah edit, Task 2 adalah git commit. Karena Task 1 hanya touch 1 file dan Task 2 hanya commit-it-all, hasilnya 1 logical commit yang mencakup kedua tasks (per plan acceptance criteria & action steps di Task 2).

## Verification (Acceptance Criteria)

| Check                                                                          | Expected | Actual | Pass |
| ------------------------------------------------------------------------------ | -------- | ------ | ---- |
| `grep -c "'https://kantongpintar.vercel.app',"`                                | 1        | 1      | ✓    |
| `grep -c "'https://kantongpintar.app',"`                                       | 1        | 1      | ✓    |
| `grep -c "'https://www.kantongpintar.app',"`                                   | 1        | 1      | ✓    |
| `grep -c "ALLOWED_ORIGINS.has(origin) ? origin : 'https://kantongpintar.app'"` | 1        | 1      | ✓    |
| `grep -c "Vercel preview deploys"`                                             | 1        | 1      | ✓    |
| `wc -l` line count                                                             | 179      | 179    | ✓    |
| `git diff HEAD~1 HEAD --stat`                                                  | +4 / -2  | +4 / -2| ✓    |
| `git diff HEAD~1 HEAD --name-only`                                             | 1 file   | 1 file | ✓    |
| Subject `feat(10): add kantongpintar.vercel.app to fetch-prices CORS allowlist`| match    | match  | ✓    |
| Commit body mengandung `SEC-01` + `CONS-02` + `v1.1-MILESTONE-AUDIT.md`        | yes      | yes    | ✓    |
| `git push`                                                                     | NO       | NO     | ✓    |

## Commit SHA

```
cdc454fcee2899f9cce4ee304d07985029ddd737  feat(10): add kantongpintar.vercel.app to fetch-prices CORS allowlist
```

Short SHA: `cdc454f`.

## Push Status

**Tidak ada `git push` di Plan 10-01.** Push akan dilakukan di Plan 10-02 setelah:
1. `supabase functions deploy fetch-prices` (deploy edge function ke cloud)
2. Live UAT pass (Refresh Harga + SEC-01 regression smoke test pakai curl tanpa Authorization header → 401)

## Threat Model Mitigation Status

| Threat ID | Status     | Notes |
| --------- | ---------- | ----- |
| T-10-01   | mitigated  | Hanya 1 domain spesifik ditambah; tidak ada wildcard. Vercel preview deploys tetap excluded. |
| T-10-02   | mitigated  | `Vary: Origin` header intact di `corsFor()` line 21 — TIDAK disentuh. CDN cache poisoning protection preserved. |
| T-10-03   | deferred-to-10-02 | Curl-based SEC-01 regression smoke test (no Authorization header → 401) wajib di-execute oleh Plan 10-02 setelah deploy. |
| T-10-04   | mitigated  | Komentar header CORS block di-update bersamaan dengan ALLOWED_ORIGINS change. Sekarang explicit "preview deploys", bukan "all Vercel deploys". |

## Deviations from Plan

None. Plan 10-01 dieksekusi exact-as-written.

## Authentication Gates Encountered

None.

## Pointer to Next Step

**Plan 10-02 (next)** — `.planning/phases/10-fetch-prices-cors-fix/10-02-PLAN.md`:
1. `supabase functions deploy fetch-prices` (Studio fallback OK — sesuai project workflow per memory note `project_supabase_migration_workflow.md`)
2. SEC-01 regression smoke test (curl tanpa `Authorization` header → expect HTTP 401 + `{"error":"Unauthorized"}` atau platform-level `UNAUTHORIZED_NO_AUTH_HEADER`)
3. CORS pre-flight test (curl `OPTIONS` dengan `Origin: https://kantongpintar.vercel.app` → expect 200 + `Access-Control-Allow-Origin: https://kantongpintar.vercel.app`)
4. Live UAT "Refresh Harga" via browser di production
5. Validate CONS-02 (todayISO write-path) selama investasi tab dipakai
6. `git push origin master` setelah live UAT pass

## Self-Check: PASSED

- File created: `.planning/phases/10-fetch-prices-cors-fix/10-01-SUMMARY.md` (this file) — created
- Commit `cdc454f` exists: verified via `git log -1 --pretty=format:'%H'`
- All acceptance criteria from PLAN.md verified above (10/10 ✓)
