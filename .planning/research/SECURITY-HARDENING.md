# Security Hardening Research — pfm-web v1.1

**Date:** 2026-04-27
**Mode:** Feasibility + canonical-pattern lookup (4 specific findings)
**Overall confidence:** HIGH (3 of 4 findings have direct Supabase doc citations + already-shipped reference pattern in codebase)
**Stack assumed:** Supabase (Postgres 15 + RLS + Auth + Edge Functions Deno) + React 19 + Vercel

> Note on terminology: "canonical pattern" = recommended by Supabase official docs **and** consistent with what already shipped in `0014_mark_bill_paid.sql` (the codebase's own reference implementation).

---

## Finding C-03: Edge Function `fetch-prices` Unauthenticated + CORS `*`

### Anti-pattern (current state of `supabase/functions/fetch-prices/index.ts`)

```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',                    // Anti-pattern 1: wildcard
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  // Anti-pattern 2: NO auth check anywhere — function runs for any caller who knows the URL
  const { investments } = await req.json()
  // ...calls Yahoo Finance + paid metals.dev API
})
```

**Why it's wrong:**
1. `Access-Control-Allow-Origin: '*'` permits any browser origin to invoke the function
2. No `Authorization` header verification → any holder of the project's anon key (which is shipped in the JS bundle, public by design) can drain quota
3. `metals.dev` is a paid API — every unauthenticated call costs money
4. Yahoo Finance has no published rate limit but will start returning 429s after abuse, breaking legit users

### Canonical pattern (per Supabase 2026 docs)

Two layers — **platform-level** (`config.toml`) **+ in-function** (`auth.getUser()`):

**Layer 1 — `supabase/config.toml`:**

```toml
[functions.fetch-prices]
verify_jwt = true        # Default is true; make it explicit so future maintainers don't disable it
```

`verify_jwt = true` is the **platform default** — Supabase Edge Runtime rejects requests lacking a valid JWT in `Authorization` before your handler ever runs. (Source: [Function Configuration | Supabase Docs](https://supabase.com/docs/guides/functions/function-configuration).)

**However** — platform `verify_jwt` only confirms a JWT is well-formed and signed; it does **not** give you the user object. For business logic ("is this user banned?", "is this user the owner of investment X?"), you still call `auth.getUser(token)` inside the function.

**Layer 2 — in-function code:**

```ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Per-domain CORS (no wildcard)
const ALLOWED_ORIGINS = new Set([
  'https://kantongpintar.app',
  'https://www.kantongpintar.app',
  // Add Vercel preview pattern only if needed; otherwise omit
])

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://kantongpintar.app'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',                          // Critical: prevents CDN cross-origin cache poisoning
  }
}

Deno.serve(async (req) => {
  const cors = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Defense-in-depth: even though verify_jwt = true blocks the request before us,
  // we still extract user identity for logging / future ownership checks.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  const token = authHeader.slice('Bearer '.length)

  // Use anon key — the SDK uses it only to call /auth/v1/user with the user's token.
  // DO NOT use SERVICE_ROLE here — that would let one bug bypass all RLS.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { investments } = await req.json()
    // ... existing logic ...
    return new Response(JSON.stringify({ results, errors }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
```

**Notes on key choice:**
- `SUPABASE_ANON_KEY` is correct here. Newer Supabase docs reference `SB_PUBLISHABLE_KEY` (the renamed anon key in the 2026 API key migration). Pick whichever your project is using; functionally identical.
- **Never** use `SUPABASE_SERVICE_ROLE_KEY` for `auth.getUser()` — service role bypasses RLS, so any logic bug after auth becomes a privilege escalation.

**Notes on `--no-verify-jwt`:**
The 2026 API key migration introduced a corner case: when invoking edge functions from the client SDK with the new publishable key, you may need `--no-verify-jwt` because the platform check expects the legacy anon key signature. If this happens, **do NOT remove the in-function `auth.getUser` check** — that becomes your only line of defense. (Source: [GitHub Discussion #41834](https://github.com/orgs/supabase/discussions/41834).)

### Integration risk

- **Vercel preview deploys** generate dynamic URLs (`pfm-web-git-branch-asistensme.vercel.app`). If the team relies on preview deploys to test edge functions, those origins won't be in `ALLOWED_ORIGINS` and CORS will block them.
  - **Mitigation:** Test edge functions only via `supabase functions serve` locally OR via production. Don't run live price-refresh on preview.
- **Existing client code** (`src/queries/investments.ts:useRefreshPrices`) already passes the auth header automatically via `supabase.functions.invoke()` — no client-side change required.

### Migration ordering

- Edge function changes are deployed via `supabase functions deploy fetch-prices` — independent of SQL migrations.
- `config.toml` change is committed alongside; takes effect on next deploy.

### References
- [Securing Edge Functions | Supabase Docs](https://supabase.com/docs/guides/functions/auth) — HIGH confidence
- [Function Configuration | Supabase Docs](https://supabase.com/docs/guides/functions/function-configuration) — `verify_jwt` default & syntax — HIGH
- [GitHub Discussion #41834 — 2026 API key migration corner case](https://github.com/orgs/supabase/discussions/41834) — MEDIUM

---

## Finding H-04: RLS Info-Disclosure on `profiles` & `allowed_emails`

### Anti-pattern (current `0006_multi_user.sql:15, 29`)

```sql
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (true);                                              -- ← any authenticated user reads ALL rows

CREATE POLICY allowed_emails_select ON allowed_emails FOR SELECT TO authenticated
  USING (true);                                              -- ← same problem
```

**Why it's wrong:**
- `USING (true)` is reserved by Supabase docs for "genuinely public data" only ([RLS Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)). Profile rows contain `is_admin` boolean — which leaks who can do privileged operations. `allowed_emails` is the entire signup whitelist — leaks future invitee identities.
- Any authenticated user can `supabase.from('profiles').select('*')` from the browser console and enumerate.

### Canonical pattern

Per Supabase RLS docs, the recommended idiom for "owner-or-admin SELECT":

```sql
-- Migration 0017_tighten_rls.sql
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = id              -- own row
    OR (SELECT public.is_admin())         -- admins see everything
  );

DROP POLICY IF EXISTS allowed_emails_select ON allowed_emails;
CREATE POLICY allowed_emails_select ON allowed_emails
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));     -- admin-only — non-admins have zero need to see allowlist
```

**Three details that matter:**

1. **`(SELECT auth.uid())` not bare `auth.uid()`** — wrapping in SELECT lets Postgres cache the value per statement instead of re-running the function per row. Documented as "99.97% performance improvement" by Supabase. (Source: [RLS Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security).)

2. **`(SELECT public.is_admin())`** — same caching benefit; also schema-qualified to avoid `search_path` ambiguity.

3. **Naming + multi-policy strategy** — Postgres ORs together all permissive policies for the same operation. Keep one named policy per operation (`profiles_select`, `profiles_insert`, `profiles_update`) rather than combining. Already what migration 0006 does for `profiles_upsert` and `profiles_update` — extend that consistency to SELECT.

### Integration risk

**Risk #1: "View As" admin feature breaks.**
The codebase has `src/auth/ViewAsContext.tsx` that lets admins impersonate users. Currently `useTargetUserId()` returns the impersonated UID and the app queries with that UID. After this change:
- ✅ `is_admin()` still returns `true` for the actual session user (admin) — so policy `id = auth.uid() OR is_admin()` lets the admin SELECT any profile row.
- ✅ Tables that already have `auth.uid() = user_id OR is_admin()` (transactions, goals, etc. in 0006) — unchanged behavior.
- ⚠️ `allowed_emails_select` becomes admin-only. If non-admin client code anywhere calls `listAllowedEmails()`, it will now return empty array. Audit: `src/db/allowedEmails.ts` is only invoked from `SettingsTab` admin section — verified safe, but **add Playwright E2E** to catch regression.

**Risk #2: `is_admin()` is itself `SECURITY DEFINER` — recursion safe?**
`is_admin()` queries `profiles WHERE id = auth.uid()`. As `SECURITY DEFINER` it runs as the function owner (postgres) which **bypasses** the new `profiles_select` policy. ✅ No recursion. ✅ Already correct in 0006:37-47.

**Risk #3: Are there any client `select('*').from('profiles')` calls used by non-admin users?**
Quick audit needed via Grep before applying. If a non-admin tab reads `profiles` for, e.g., display name lookup of other users, those calls will return empty. Likely **no** — display names are only shown for own profile in current UI.

### Migration ordering

**New migration 0017** (do NOT edit 0006 — it's already deployed).

```sql
-- supabase/migrations/0017_tighten_rls.sql
-- Tightens RLS on profiles and allowed_emails (closes H-04).
-- Idempotent: uses IF EXISTS for safe re-runs.

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS allowed_emails_select ON public.allowed_emails;
CREATE POLICY allowed_emails_select ON public.allowed_emails
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));
```

Apply via `supabase db push`. Per Supabase migration best practices, never modify deployed migrations — always add new ones with monotonic prefix. (Source: [Database Migrations | Supabase Docs](https://supabase.com/docs/guides/deployment/database-migrations).)

### References
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH (canonical owner-or-admin pattern)
- [RLS Performance Tips — auth.uid() wrapped in SELECT](https://supabase.com/docs/guides/database/postgres/row-level-security#use-functions-wrapped-in-select) — HIGH

---

## Finding H-05: Allowlist Bootstrap Bypass

### Anti-pattern (current `0006_multi_user.sql:148-164`)

```sql
CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Bootstrap: jika tabel masih kosong, izinkan (setup awal)
  IF NOT EXISTS (SELECT 1 FROM allowed_emails) THEN
    RETURN NEW;        -- ← Unconditional bypass!
  END IF;
  IF NOT EXISTS (SELECT 1 FROM allowed_emails WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'Email tidak diizinkan untuk aplikasi ini';
  END IF;
  RETURN NEW;
END;
$$;
```

**Why it's wrong:**
- The bootstrap branch was a one-time onboarding convenience. Migration 0006 itself populates `allowed_emails` at line 66-68, so by the time this trigger could be called, the table is non-empty.
- But: `DELETE FROM allowed_emails` (admin misclick, future bug, or attacker with another foothold) re-arms the bypass silently. App becomes open-signup with no audit trail.
- Defense-in-depth principle: the empty-table branch is **never reachable in normal operation**, so it should not exist as a code path. Dead code = silent failure mode.

### Canonical pattern

**Two options, ranked by safety:**

#### Option A (recommended): Hard-coded admin fallback

```sql
CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- If allowlist somehow empty (DELETE went rogue), allow ONLY the bootstrap admin.
  -- This invariant matches the seed in migration 0006:66-68.
  IF NOT EXISTS (SELECT 1 FROM public.allowed_emails) THEN
    IF NEW.email IS DISTINCT FROM 'rinoadi28@gmail.com' THEN
      RAISE EXCEPTION 'Allowlist kosong — hanya admin awal yang dapat sign up';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.allowed_emails WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'Email tidak diizinkan untuk aplikasi ini';
  END IF;
  RETURN NEW;
END;
$$;
```

**Why this is best for v1.1:**
- Closed-fail: even if the table is wiped, only one specific email can pass.
- Zero schema changes — just a function body update.
- Mirrors what is already seeded in 0006, so it's not introducing new policy magic.

#### Option B: Switch to Auth Hook (`before_user_created`) — defer to v1.2

Supabase has a first-class "Before User Created Hook" that runs as a Postgres function during signup, with a JSON payload, returning HTTP error codes. (Source: [Auth Hooks | Supabase Docs](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook).)

Pros: officially supported, retry semantics, payload includes IP for rate-limiting.
Cons: requires changing trigger architecture + dashboard config + new migration. Not worth the risk for a hardening milestone.

**Recommendation: Ship Option A in v1.1; document Option B as v1.2 follow-up.**

#### Option C (mentioned for completeness; rejected): Trigger guard against DELETE

```sql
CREATE TRIGGER prevent_empty_allowlist
  BEFORE DELETE ON allowed_emails
  FOR EACH STATEMENT
  EXECUTE FUNCTION ...check that count > 1...;
```

Rejected because it doesn't help against `TRUNCATE` and adds maintenance burden. Hard-coded fallback is simpler and has the same property (failsafe to admin-only).

### Integration risk

- **None for happy path.** The new code only differs from current behavior in the (never-occurring) empty-table branch.
- **One test case to add:** pgTAP test that simulates `TRUNCATE allowed_emails` and verifies that `INSERT INTO auth.users (email) VALUES ('attacker@evil.com')` raises the new exception while `'rinoadi28@gmail.com'` passes.

### Migration ordering

Same migration 0017 (or 0018) — `CREATE OR REPLACE FUNCTION` is idempotent. Recommend bundling with H-04 since both are RLS/auth concerns:

```sql
-- supabase/migrations/0017_tighten_rls.sql (continued)
CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.allowed_emails) THEN
    IF NEW.email IS DISTINCT FROM 'rinoadi28@gmail.com' THEN
      RAISE EXCEPTION 'Allowlist kosong — hanya admin awal yang dapat sign up';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.allowed_emails WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'Email tidak diizinkan untuk aplikasi ini';
  END IF;
  RETURN NEW;
END;
$$;
```

The trigger itself (created in migration 0001) does not need re-creation — `CREATE OR REPLACE FUNCTION` updates the body in place.

### References
- [Auth Hooks: Before User Created | Supabase Docs](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook) — MEDIUM (alternative approach)
- [PostgreSQL SECURITY DEFINER best practices — search_path](https://wiki.postgresql.org/wiki/A_Guide_to_CVE-2018-1058:_Protect_Your_Search_Path) — HIGH (function already follows this with `SET search_path = public`)

---

## Finding H-06: SECURITY DEFINER RPCs IDOR

### Anti-pattern (current `0006_multi_user.sql:169-222`)

```sql
CREATE OR REPLACE FUNCTION aggregate_by_period(
  p_granularity TEXT, p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL, p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (period TEXT, income NUMERIC, expense NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ...
  FROM transactions
  WHERE
    user_id = COALESCE(p_user_id, auth.uid()) AND   -- ← caller picks ANY user_id, no check
    (p_date_from IS NULL OR date >= p_date_from) AND ...
$$;
```

**Why it's wrong:**
- `SECURITY DEFINER` runs as function owner → bypasses RLS on `transactions`.
- The `COALESCE(p_user_id, auth.uid())` lets the caller substitute any UUID. If `p_user_id = '<admin's uuid>'`, function returns admin's monthly income/expense to any authenticated user.
- This is a textbook IDOR (Insecure Direct Object Reference) — an authenticated user enumerates someone else's data via parameter manipulation.

### Canonical pattern

The codebase already has the right reference: **`mark_bill_paid` in 0014 (line 56-70)**:

```sql
DECLARE
  v_uid UUID := COALESCE(p_uid, auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF v_uid != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;
  -- ... rest of function uses v_uid ...
```

This is exactly the idiomatic Supabase pattern: explicit guard at function entry, checking that either (a) caller is the owner, or (b) caller is admin.

**Apply the same to both aggregate functions:**

```sql
-- Migration 0017_tighten_rls.sql (continued)
CREATE OR REPLACE FUNCTION public.aggregate_by_period(
  p_granularity TEXT,
  p_date_from   DATE DEFAULT NULL,
  p_date_to     DATE DEFAULT NULL,
  p_user_id     UUID DEFAULT NULL
)
RETURNS TABLE (period TEXT, income NUMERIC, expense NUMERIC)
LANGUAGE plpgsql                            -- ← plpgsql (not sql) so we can RAISE EXCEPTION
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog        -- ← include pg_catalog to be safe
AS $$
DECLARE
  v_target_uid UUID := COALESCE(p_user_id, auth.uid());
BEGIN
  -- Auth guard
  IF v_target_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;
  -- Access guard: own data, or admin
  IF v_target_uid <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    CASE p_granularity
      WHEN 'day'   THEN to_char(t.date, 'YYYY-MM-DD')
      WHEN 'week'  THEN to_char(date_trunc('week', t.date), 'YYYY-"W"IW')
      WHEN 'month' THEN to_char(t.date, 'YYYY-MM')
      ELSE              to_char(t.date, 'YYYY')
    END AS period,
    COALESCE(SUM(CASE WHEN t.type = 'income'  THEN t.amount ELSE 0 END), 0) AS income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS expense
  FROM public.transactions t
  WHERE
    t.user_id = v_target_uid AND
    (p_date_from IS NULL OR t.date >= p_date_from) AND
    (p_date_to   IS NULL OR t.date <= p_date_to)
  GROUP BY 1
  ORDER BY 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.aggregate_by_category(
  p_type      TEXT,
  p_date_from DATE DEFAULT NULL,
  p_date_to   DATE DEFAULT NULL,
  p_user_id   UUID DEFAULT NULL
)
RETURNS TABLE (category TEXT, total NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_target_uid UUID := COALESCE(p_user_id, auth.uid());
BEGIN
  IF v_target_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF v_target_uid <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.name AS category, COALESCE(SUM(t.amount), 0) AS total
  FROM public.transactions t
  JOIN public.categories c ON t.category_id = c.id
  WHERE
    t.user_id = v_target_uid AND
    t.type = p_type AND
    (p_date_from IS NULL OR t.date >= p_date_from) AND
    (p_date_to   IS NULL OR t.date <= p_date_to)
  GROUP BY c.id, c.name
  HAVING COALESCE(SUM(t.amount), 0) > 0
  ORDER BY total DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aggregate_by_period(TEXT, DATE, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aggregate_by_category(TEXT, DATE, DATE, UUID) TO authenticated;
```

**Detail explanations:**

1. **`LANGUAGE plpgsql` (not `sql`)** — required to use `RAISE EXCEPTION` and local variables. `sql` functions cannot have control flow. The current 0006 functions are `LANGUAGE sql`; rewriting to `plpgsql` is the structural change.

2. **`STABLE`** — kept. The functions read but don't modify; multiple calls in same statement give same result. Allows query planner optimizations (function inlining is impossible across language boundaries anyway, but `STABLE` still helps planner reasoning).

3. **`SET search_path = public, pg_catalog`** — explicit + safe. `pg_catalog` is implicitly first regardless, but stating it satisfies static analyzers like Supadabase Advisor. Empty string (`SET search_path = ''`) would be even safer but requires schema-qualifying *every* identifier in the body — not worth the ergonomic cost here since the body is short.
   - Source: [PostgreSQL CVE-2018-1058 Guide](https://wiki.postgresql.org/wiki/A_Guide_to_CVE-2018-1058:_Protect_Your_Search_Path).

4. **`USING ERRCODE = ...`** — gives clients structured SQLSTATE codes (`28000` = invalid_authorization, `42501` = insufficient_privilege) instead of just the generic `P0001`. Lets `mapSupabaseError` (already in `src/lib/errors.ts`) discriminate between auth failures and other errors. Also matches what `mark_bill_paid` would benefit from (a future improvement, out of scope here).

5. **Function signature in GRANT must match exactly** — including default-having parameters. Otherwise `GRANT` will fail. Use the full `(TEXT, DATE, DATE, UUID)` form.

### Integration risk

- **Client code** in `src/queries/reports.ts` (or wherever `aggregate_by_period` is called) currently passes `p_user_id` from `useTargetUserId()` (which is the impersonated user UID for admins, own UID for non-admins).
  - Before fix: any user can pass any UUID → IDOR.
  - After fix: non-admin user passing someone else's UUID → `42501` exception → React Query throws → mapSupabaseError shows "Akses ditolak". Admin passing impersonated UUID → `is_admin()` returns true → continues as before.
  - ✅ View-As feature continues to work.
  - ⚠️ Verify `mapSupabaseError` translates `42501` cleanly. Check `src/lib/errors.ts` — currently it has plain-object branch (recently added per commit history); ensure SQLSTATE-aware branch exists or add one.

- **Performance:** `is_admin()` is `SECURITY DEFINER STABLE` — Postgres caches per-statement. Adding the `IF ... NOT public.is_admin()` check adds ~one tiny `SELECT EXISTS` on `profiles` per RPC call. Negligible.

### Migration ordering

Same migration 0017 — bundled with H-04 + H-05. All four findings are auth/RLS-adjacent and `CREATE OR REPLACE FUNCTION` + `DROP POLICY IF EXISTS` make the migration idempotent and safely re-runnable.

### References
- [Database Functions | Supabase Docs](https://supabase.com/docs/guides/database/functions) — HIGH (SECURITY DEFINER + search_path requirement)
- Codebase reference: `supabase/migrations/0014_mark_bill_paid.sql:56-70` — already-shipped pattern in this repo
- [PostgreSQL CVE-2018-1058](https://wiki.postgresql.org/wiki/A_Guide_to_CVE-2018-1058:_Protect_Your_Search_Path) — HIGH (search_path discipline)
- [Abusing SECURITY DEFINER functions in PostgreSQL — Cybertec](https://www.cybertec-postgresql.com/en/abusing-security-definer-functions/) — MEDIUM (motivation for explicit search_path)

---

## Cross-cutting Recommendations

### Should all 4 findings ship in 1 phase?

**Yes — single phase "Security Hardening v1.1".** Justification:

- **C-03** (edge function) is independent of the 3 SQL findings — it deploys via `supabase functions deploy` not `db push`.
- **H-04, H-05, H-06** all converge into a single migration `0017_tighten_rls.sql`. Splitting them into separate migrations would:
  - Risk incomplete rollouts (e.g., H-04 deployed but not H-06 → IDOR still open).
  - Triple the test ceremony.
- All four are defensive changes with **no new user-facing behavior**, so users shouldn't notice anything except possibly a slight latency increase on edge-function calls (the extra `auth.getUser` round-trip). They can be tested and shipped together.

**Phase 1 single phase. Phase deliverable:**

| File | Type | Lines (est) |
|------|------|------------:|
| `supabase/migrations/0017_tighten_rls.sql` | NEW | ~80 |
| `supabase/functions/fetch-prices/index.ts` | MODIFY | +30 −5 |
| `supabase/config.toml` | MODIFY | +3 |
| `supabase/tests/05-tighten-rls.sql` (pgTAP) | NEW | ~120 |
| `tests/e2e/security-hardening.spec.ts` (Playwright) | NEW | ~80 |

### Migration order (concrete)

1. **Pre-flight (local):**
   ```bash
   supabase db reset                                # rebuild local DB
   supabase test db                                 # run pgTAP suite including new 05-tighten-rls.sql
   supabase functions serve fetch-prices --env-file .env.local
   ```

2. **Staging (Supabase Dashboard preview branch, if available, or a separate project):**
   ```bash
   supabase db push --db-url <staging-url>
   supabase functions deploy fetch-prices --project-ref <staging-ref>
   ```

3. **Production:**
   ```bash
   git push origin master                           # triggers Vercel deploy of frontend
   supabase db push                                 # apply migration 0017
   supabase functions deploy fetch-prices           # deploy auth-protected edge function
   ```

   Order matters: deploy frontend FIRST (no behavior change for non-admins, admins still work), THEN migration, THEN edge function. This ordering ensures users never see a broken UI between deploys. Edge function last because old clients with cached JS will still send auth headers (the SDK already does this) — the new auth check is permissive of legitimate JWTs.

### Test strategy

**Three layers:**

#### Layer 1 — pgTAP for SQL findings (H-04, H-05, H-06)

`supabase/tests/05-tighten-rls.sql` — covers:

```sql
BEGIN;
SELECT plan(12);

-- H-04: profiles SELECT
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '<non-admin-uuid>';
SELECT is_empty(
  $$ SELECT * FROM profiles WHERE id = '<admin-uuid>' $$,
  'non-admin cannot SELECT admin profile row'
);
SELECT results_eq(
  $$ SELECT count(*) FROM profiles $$, ARRAY[1::bigint],
  'non-admin sees only own profile row'
);

-- H-04: allowed_emails SELECT
SELECT is_empty($$ SELECT * FROM allowed_emails $$, 'non-admin cannot SELECT allowed_emails');

-- H-05: allowlist bootstrap with empty table
TRUNCATE allowed_emails;
SELECT throws_ok(
  $$ INSERT INTO auth.users (email) VALUES ('attacker@evil.com') $$,
  'Allowlist kosong — hanya admin awal yang dapat sign up'
);
SELECT lives_ok(
  $$ INSERT INTO auth.users (email) VALUES ('rinoadi28@gmail.com') $$,
  'bootstrap admin can still sign up when allowlist empty'
);

-- H-06: aggregate_by_period IDOR guard
SET LOCAL request.jwt.claim.sub = '<non-admin-uuid>';
SELECT throws_ok(
  $$ SELECT * FROM aggregate_by_period('month', NULL, NULL, '<admin-uuid>') $$,
  'Akses ditolak'
);
SELECT lives_ok(
  $$ SELECT * FROM aggregate_by_period('month', NULL, NULL, NULL) $$,
  'non-admin can call without p_user_id'
);

-- H-06: aggregate_by_category IDOR guard
SELECT throws_ok(
  $$ SELECT * FROM aggregate_by_category('expense', NULL, NULL, '<admin-uuid>') $$,
  'Akses ditolak'
);

-- Admin can still impersonate
SET LOCAL request.jwt.claim.sub = '<admin-uuid>';
SELECT lives_ok(
  $$ SELECT * FROM aggregate_by_period('month', NULL, NULL, '<other-user-uuid>') $$,
  'admin can call with arbitrary p_user_id'
);

SELECT * FROM finish();
ROLLBACK;
```

This is the highest-value test layer — fast, deterministic, runs in CI via `supabase test db`.

#### Layer 2 — Manual psql smoke test for C-03

```bash
# Should fail without auth header
curl -X POST https://<project>.functions.supabase.co/fetch-prices \
  -H 'Content-Type: application/json' \
  -d '{"investments":[]}'
# Expect: 401 Unauthorized

# Should fail with bogus token
curl -X POST https://<project>.functions.supabase.co/fetch-prices \
  -H 'Authorization: Bearer not-a-real-jwt' \
  -H 'Content-Type: application/json' \
  -d '{"investments":[]}'
# Expect: 401 Unauthorized

# Should fail with wrong origin
curl -X POST https://<project>.functions.supabase.co/fetch-prices \
  -H 'Origin: https://evil.example.com' \
  -H 'Authorization: Bearer <real-user-jwt>' \
  -d '{"investments":[]}'
# Expect: response without matching CORS — browser would block; curl shows the hardcoded fallback origin
```

Document these in milestone notes as "before merge" gates.

#### Layer 3 — Playwright E2E for app-level integration

Single test that:
1. Sign in as non-admin user
2. Open Reports tab → expect data renders (regression guard for H-06)
3. Open Settings → Allowed Emails section → expect empty list (regression guard for H-04 — if admin section exposed to non-admin by accident, this catches it)
4. Sign in as admin, switch to View As → non-admin user → expect Reports renders THEIR data (regression guard for is_admin() override of H-06)

### Open questions / out-of-scope for v1.1

1. Switching `enforce_email_allowlist` from a `BEFORE INSERT ON auth.users` trigger to a Supabase **Auth Hook (before-user-created)** — better long-term, but requires dashboard config + new migration architecture. Defer to v1.2.
2. Introducing a `private` schema for `is_admin()` and similar — Supabase docs recommend "Security-definer functions should never be created in 'Exposed schemas'." Currently `is_admin()` is in `public`. For v1.1 we accept this; for v1.2 consider moving to `private` + revoking PUBLIC EXECUTE.
3. Audit any other RPCs with `p_user_id` that may have the same IDOR pattern. Beyond `aggregate_by_period`/`aggregate_by_category`/`mark_bill_paid` (already fixed), Grep for `p_user_id` in `supabase/migrations/` to ensure full coverage. Quick check: only those three appear in the migrations reviewed.

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| C-03 fix pattern | HIGH | Direct Supabase docs citation + simple in-function code |
| H-04 fix pattern | HIGH | Direct RLS best-practices doc citation; pattern matches existing `transactions_select` policy in same migration |
| H-05 fix pattern | MEDIUM | Hard-coded fallback is a judgment call vs auth-hook approach; both viable, recommend hard-coded for v1.1 simplicity |
| H-06 fix pattern | HIGH | Identical pattern to already-shipped `mark_bill_paid` (0014) — proven in production, just port to two more functions |
| Migration ordering | HIGH | Standard Supabase practice — never edit deployed migrations |
| Test strategy | MEDIUM | pgTAP coverage well-established (existing `04-mark-bill-paid.sql`); Playwright RLS tests are newer — may discover surprises |

## References (consolidated)

- [Securing Edge Functions | Supabase Docs](https://supabase.com/docs/guides/functions/auth)
- [Function Configuration (verify_jwt) | Supabase Docs](https://supabase.com/docs/guides/functions/function-configuration)
- [CORS for Edge Functions | Supabase Docs](https://supabase.com/docs/guides/functions/cors)
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database Functions | Supabase Docs](https://supabase.com/docs/guides/database/functions)
- [Auth Hooks: Before User Created | Supabase Docs](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Database Migrations | Supabase Docs](https://supabase.com/docs/guides/deployment/database-migrations)
- [PostgreSQL CVE-2018-1058 Guide — search_path security](https://wiki.postgresql.org/wiki/A_Guide_to_CVE-2018-1058:_Protect_Your_Search_Path)
- [Abusing SECURITY DEFINER functions — Cybertec](https://www.cybertec-postgresql.com/en/abusing-security-definer-functions/)
- [GitHub Discussion #41834 — 2026 API key migration](https://github.com/orgs/supabase/discussions/41834)
- Codebase reference: `supabase/migrations/0014_mark_bill_paid.sql:56-70` (in-repo canonical pattern)

_Researched: 2026-04-27_
