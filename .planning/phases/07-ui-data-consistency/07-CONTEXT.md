# Phase 7: UI/Data Consistency - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Bridge gap antara UI representation dan DB source-of-truth, plus 2 user-facing bug fix kecil. **Defensive only.** Zero kapabilitas baru.

1. **CONS-01** — VIEW `goals_with_progress` (`security_invoker = true`) sebagai sumber tunggal `total_amount = current_amount + Σ(allocation_pct × investment.current_value)`. RPC `add_money_to_goal` dirombak (drop v1, replace dengan v2 same-name) — flip `status` ke `completed` jika `total_amount >= target_amount`. RPC `withdraw_from_goal` (Phase 6) error message di-extend split kas vs investasi.
2. **CONS-02** — ESLint rule `no-restricted-syntax` block exact pattern `new Date().toISOString().slice(0,X)` (severity `error`). Fix `src/queries/investments.ts:111` callsite. Tidak ada exception path.
3. **CONS-03** — Tabel baru `user_seed_markers (user_id PK, rencana_seeded_at TIMESTAMPTZ)` jadi authoritative source untuk "user sudah seeded". RPC `seed_rencana(p_uid)` atomic — single transaction insert 5 RENCANA goals + 5 RENCANA investments + marker row. Pattern compliance dengan Phase 6 D-19 RPC template.
4. **UX-01** — Tombol "Reset Seed Rencana" di `SettingsTab.tsx:118` ganti dari global key `'rencana_seeded'` jadi per-user `\`rencana_seeded_${user.id}\`` + call delete-marker RPC. Inline ke CONS-03 reset flow.
5. **UX-02** — Button "Impor CSV" di TransactionsTab + InvestmentsTab disabled saat `viewingAs !== null` + tooltip "Tidak tersedia saat View-As" + handler-level early-return guard (defense in depth). Server-side RPC layer 2 deferred ke v1.2.

**Migrations:** `0022_user_seed_markers.sql` + `seed_rencana` RPC, `0023_goals_with_progress.sql` (VIEW), `0024_add_money_to_goal_v2.sql` (DROP v1 + CREATE v2 + one-time backfill `goals.status`).

**Depends on Phase 6:** RPC pattern template kanonis (D-19), `withdraw_from_goal` error message wording forward-compatible (D-10), mapSupabaseError SQLSTATE 42501/23514/P0001 branches (D-20, D-21).

</domain>

<decisions>
## Implementation Decisions

### CONS-03 — Seed Mechanism

- **D-01:** Tabel marker `user_seed_markers (user_id UUID PK REFERENCES auth.users, rencana_seeded_at TIMESTAMPTZ NOT NULL DEFAULT NOW())` jadi single source-of-truth untuk "user sudah seeded". Skema mengikuti pattern `bill_payments`: RLS USING+WITH CHECK auth.uid()=user_id OR is_admin().
- **D-02:** `seed_rencana(p_uid UUID DEFAULT NULL)` RPC dedup mechanism: **marker row only**. Body: `IF EXISTS (SELECT 1 FROM user_seed_markers WHERE user_id = v_uid) THEN RETURN false; END IF;`. Fast, deterministic, single-source semantic. Tidak pakai name-existence fallback.
- **D-03:** Migration 0022 **backfill marker untuk existing users** sebagai final step:
  ```sql
  INSERT INTO user_seed_markers (user_id, rencana_seeded_at)
  SELECT DISTINCT user_id, NOW()
  FROM goals
  WHERE name = ANY(ARRAY['Dana Darurat', '...', '...', '...', '...']::text[])
  ON CONFLICT (user_id) DO NOTHING;
  ```
  Existing users (terutama admin awal) langsung punya marker; tidak ada race "lazy-seed-on-first-Dashboard-load → duplicate insert" karena `goals` tidak punya `UNIQUE(user_id, name)` constraint. Pairs dengan D-02 (marker-only dedup).
- **D-04:** RENCANA seed data hardcoded dalam SQL function body (5 goals + 5 investments dengan target_amount/target_date/quantity/buy_price hardcoded). Comment header WAJIB include sync note: `-- Synced with src/lib/rencanaNames.ts and src/db/goals.ts:RENCANA_GOALS — update both atomically if seed data changes`. Drift risk mitigated via code review.
- **D-05:** `seed_rencana` body atomicity: single function = single implicit transaction. Mid-execution failure (RAISE EXCEPTION) → seluruh INSERT rollback, marker row tidak ter-insert → user akan retry pada next Dashboard load. Match SC#3 ROADMAP.
- **D-06:** RPC return type: `BOOLEAN` (`true` = seeded baru tadi, `false` = sudah pernah seeded). Frontend `useRencanaInit` ignore return value — kalau `false`, no-op. Toast tidak shown (silent).
- **D-07:** Reset Seed flow di `SettingsTab.tsx` (extend handler `doResetSeed`):
  1. `delete RENCANA_GOAL rows` (existing logic)
  2. `delete RENCANA_INVESTMENT rows` (existing logic)
  3. **NEW:** call `supabase.rpc('reset_rencana_marker')` — atomic DELETE FROM user_seed_markers WHERE user_id = auth.uid() (RPC security definer, no admin override — user only resets their own marker)
  4. **FIX (UX-01):** `localStorage.removeItem(\`rencana_seeded_${user.id}\`)` (per-user key, bukan lama `'rencana_seeded'`)
  5. Cleanup legacy: also remove `'rencana_seeded'` global key kalau masih ada (one-shot migration in handler)
- **D-08:** localStorage role POST-CONS-03 = **fast-path cache only**. `useRencanaInit`: cek localStorage dulu (fast path), kalau missing baru call `seed_rencana` RPC. RPC return `false` jika marker exists (DB authoritative). Mengurangi 1 RPC roundtrip per Dashboard load untuk user yang sudah seeded di session ini.

### CONS-01 — Goals Total + Status

- **D-09:** VIEW `goals_with_progress` definition:
  ```sql
  CREATE OR REPLACE VIEW goals_with_progress
  WITH (security_invoker = true) AS
  SELECT
    g.id, g.user_id, g.name, g.target_amount, g.current_amount, g.target_date, g.status,
    g.current_amount + COALESCE(SUM(gi.allocation_pct / 100.0 * COALESCE(i.current_price, i.buy_price) * i.quantity), 0) AS total_amount
  FROM goals g
  LEFT JOIN goal_investments gi ON gi.goal_id = g.id
  LEFT JOIN investments i ON i.id = gi.investment_id
  GROUP BY g.id;
  ```
  `COALESCE(current_price, buy_price)` handle investasi yang belum ada price refresh. `LEFT JOIN` handle goals tanpa linked investasi. `total_amount` adalah cash + market-value of allocated investasi.
- **D-10:** `add_money_to_goal_v2` (REPLACE v1, same name & signature) — body:
  1. Auth guard (Phase 6 D-19 pattern)
  2. `SELECT * FROM goals WHERE id = p_id FOR UPDATE` (lock base table)
  3. `UPDATE goals SET current_amount = current_amount + p_amount WHERE id = p_id`
  4. Compute new `total_amount` dengan inline subquery (mirror VIEW formula) — TIDAK pakai SELECT FROM VIEW (FOR UPDATE pada VIEW tricky, plus lock sudah di base table)
  5. `IF v_new_total >= goals.target_amount AND status = 'active' THEN UPDATE goals SET status = 'completed'`
  6. Return `(current_amount, status)` table row
- **D-11:** Status transition logic match Phase 6 D-11 mirror (withdraw_from_goal):
  - `active` + total >= target → flip ke `completed`
  - `paused` stays `paused` (user explicit pause, jangan auto-flip)
  - `completed` stays `completed`
  - Reverse direction (completed + new_amount < target) sudah handled oleh `withdraw_from_goal` v1 dari Phase 6 — tidak perlu re-implement.
- **D-12:** Migration 0024 final step: **one-time backfill `goals.status`**:
  ```sql
  UPDATE goals SET status = 'completed'
  WHERE status = 'active'
    AND id IN (SELECT id FROM goals_with_progress WHERE total_amount >= target_amount);
  ```
  Eager + deterministic. SC#1 ROADMAP visible langsung post-deploy tanpa user action. Demo case (60% × 18jt = 10.8jt vs target 10jt) langsung "Tercapai".
- **D-13:** `add_money_to_goal_v2` migration order: **DROP v1 → CREATE v2** (Phase 5 lesson 0018 — explicit DROP saat behavior change supaya tidak ada legacy 2-arg version coexist). TS callsite `src/db/goals.ts:96` tidak perlu rename (signature identik).
- **D-14:** Withdraw error message split kas vs investasi: `withdraw_from_goal` body Phase 6 RAISE message di-update (Phase 7 ikut migration patch atau in-RPC string update):
  ```
  RAISE EXCEPTION USING
    MESSAGE = format('Saldo kas tidak cukup. Tersedia Rp %s (terpisah dari Rp %s di investasi)',
                     v_goal.current_amount, v_invested_value),
    ERRCODE = 'P0001';
  ```
  Compute `v_invested_value` dari subquery sama seperti VIEW formula. Backward-compat: SQLSTATE tetap P0001 (sudah di-handle mapSupabaseError Phase 6 D-20).
- **D-15:** AddMoneyDialog (mode withdraw): tampilkan info inline saldo `Saldo kas tersedia: Rp X (terpisah dari investasi Rp Y)` dari VIEW data, supaya user tau angka yang available untuk withdraw SEBELUM submit. Sumber data: query `goals_with_progress` di parent + pass props.

### CONS-02 — ESLint Rule

- **D-16:** ESLint rule (di `eslint.config.js`) — `no-restricted-syntax` dengan AST selector exact-match:
  ```js
  {
    selector: "CallExpression[callee.object.callee.object.callee.name='Date'][callee.property.name='slice']",
    message: 'Pakai todayISO() dari @/lib/format — .toISOString().slice(0,10) returns UTC date, bukan WIB'
  }
  ```
  Match `new Date().toISOString().slice(...)` chain saja. Full ISO timestamp (`new Date().toISOString()`) tetap allowed untuk audit fields.
- **D-17:** Severity `error` (CI block). Match Phase 5 hardening discipline. Pre-existing 23 lint errors (STATE.md) tidak block — rule baru hanya catch new occurrences.
- **D-18:** **No exceptions.** Tidak ada legitimate use case di codebase saat ini. Kalau executor menemukan edge case di plan-phase, pakai `// eslint-disable-next-line no-restricted-syntax` inline + comment justifikasi (visible di code review).
- **D-19:** Fix callsite `src/queries/investments.ts:111`: ganti `const today = new Date().toISOString().slice(0, 10)` → `const today = todayISO()` + add import `import { todayISO } from '@/lib/format'` (sudah pernah ada di file ini? cek import section).
- **D-20:** `todayISO()` kept as-is (local-time-based). Fungsi sudah WIB-correct di browser (typical user TZ Asia/Jakarta). Server-side hardening (explicit Asia/Jakarta TZ) deferred ke v1.2 jika ada server-side callsite future.

### UX-02 — View-As CSV Gate

- **D-21:** Layer 1 (UI) + Layer 1.5 (handler-level guard). Layer 2 (server-side RPC `import_transactions_bulk` dengan `p_user_id` + `is_admin()` check) deferred ke v1.2 per REQUIREMENTS.md "Future Requirements".
- **D-22:** Source `isViewAs` boolean: import `useViewAs` dari `@/auth/useViewAs` → `const { viewingAs } = useViewAs()` → `const isViewAs = viewingAs !== null`. Hook sudah ada di `src/auth/ViewAsContext.tsx:37`. Tidak perlu hook baru.
- **D-23:** Button disabled state: `<Button disabled={isViewAs} title={isViewAs ? 'Tidak tersedia saat View-As' : ''}>Impor CSV</Button>`. Tooltip wording **exact match** ROADMAP SC#5 "Tidak tersedia saat View-As" (verifier akan match string).
- **D-24:** Handler early-return guard (defense in depth):
  ```ts
  function handleImportCsv() {
    if (viewingAs) {
      toast.error('Impor CSV tidak tersedia saat View-As')
      return
    }
    // ...existing import logic
  }
  ```
  Mitigasi keyboard tab + Enter, dev console manual trigger.
- **D-25:** Scope: TransactionsTab + InvestmentsTab. **Audit dulu di plan-phase** apakah ada CSV import callsite lain (mis. PensiunTab, NotesTab). Berdasarkan grep awal: 13 file mention CSV/Impor — banyak hanya export-side. Plan-phase researcher konfirmasi exact callsite list.

### Migration Numbering

- **D-26:** Migrations renumbered (+1 dari plan awal) konsisten dengan Phase 6 STATE.md decision:
  - `0022_user_seed_markers.sql` (table + RLS + seed_rencana RPC + reset_rencana_marker RPC + backfill INSERT)
  - `0023_goals_with_progress.sql` (VIEW only)
  - `0024_add_money_to_goal_v2.sql` (DROP v1 + CREATE v2 + one-time goals.status backfill UPDATE)
  - Update REQUIREMENTS.md migration column references jika perlu (planner check).

### Deploy & Verification (carry-forward dari Phase 6)

- **D-27:** Migration channel: Studio SQL Editor manual paste (Phase 6 D-22). Plan harus include explicit "paste-order" instructions, tidak rely `db push`.
- **D-28:** pgTAP test files mandatory:
  - `supabase/tests/07-seed-rencana.sql` — assert: idempotency (call 2x, second returns false), atomicity (mid-execution failure rollback), backfill correctness (existing user dengan goals → marker auto-inserted).
  - `supabase/tests/07-goals-with-progress.sql` — assert: VIEW total_amount formula correct untuk goal with linked investment, tanpa investment, dengan investment yang current_price NULL.
  - `supabase/tests/07-add-money-v2.sql` — assert: status flip active→completed when total >= target via investment-only contribution; status preserve `paused` and `completed`; concurrent calls FOR UPDATE serialize.
  - Convention: `BEGIN/ROLLBACK` + `RAISE NOTICE PASS:/FAIL:` (Phase 5+6 pattern).
- **D-29:** Browser-MCP UAT mandatory pre-close (Vercel auto-deploy 15-30s):
  - **UAT-1 (CONS-01):** Login user dengan goal target Rp 10jt linked 60% investasi Rp 18jt → assert progress bar 100% + badge "Tercapai" tampil. Klik AddMoneyDialog withdraw → assert tampilan "Saldo kas tersedia: Rp X (terpisah dari investasi Rp Y)". Submit withdraw amount > kas → assert toast "Saldo kas tidak cukup. Tersedia Rp X (terpisah dari Rp Y di investasi)".
  - **UAT-2 (CONS-02):** Buka DevTools Network → klik "Refresh Harga" → assert request ke `price_history` POST body `date` field = today's WIB date string (format YYYY-MM-DD).
  - **UAT-3 (CONS-03):** New user signup → first Dashboard load → assert 5 goals + 5 investments seeded; reload page 5x → assert no duplikat (count tetap 5+5); cek Studio: `user_seed_markers` row exists.
  - **UAT-4 (UX-01):** SettingsTab klik "Reset Seed Rencana" → confirm → assert localStorage `rencana_seeded_${user.id}` cleared, marker row deleted, 5 goals + 5 investments deleted; reload → seeding repeat (kembali ke 5+5).
  - **UAT-5 (UX-02):** Admin login → switch View-As ke user lain → assert TransactionsTab "Impor CSV" disabled + tooltip "Tidak tersedia saat View-As"; assert InvestmentsTab sama; exit View-As → button re-enable.

### Claude's Discretion

- pgTAP test naming detail (test_001 vs descriptive).
- Loop body micro-optimization di `seed_rencana` (single multi-row INSERT vs row-by-row).
- Whether to batch multiple INSERT statements via `WITH ... AS` CTE in seed_rencana — performance vs readability.
- Wave ordering di Phase 7 plans — research/planner pertimbangkan: VIEW first (read-side) → marker+seed (CONS-03) → add_money_v2 (depends on VIEW) → frontend changes → ESLint config + UAT.
- Whether `reset_rencana_marker` RPC perlu admin override (admin reset other user's seed) atau strict self-only — default self-only sampai use case muncul.
- Backward-compat handling untuk user yang masih punya old `'rencana_seeded'` global localStorage key — silently remove pada Reset handler atau tambah one-time migration di useRencanaInit.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pattern source (mandatory read)

- `supabase/migrations/0014_mark_bill_paid.sql` — RPC template kanonis (SECURITY DEFINER + search_path + auth guard + FOR UPDATE + IF EXISTS idempotency). Phase 7 RPCs (`seed_rencana`, `reset_rencana_marker`, `add_money_to_goal_v2`) mirror exactly.
- `supabase/migrations/0006_multi_user.sql` §`add_money_to_goal` (lines ~225-261) — direct mirror untuk v2 rewrite. Status transition logic + RAISE pattern.
- `supabase/migrations/0015_upcoming_bills_unpaid_view.sql` — VIEW `security_invoker = true` pattern. `goals_with_progress` ikuti.
- `supabase/migrations/0018_drop_legacy_aggregates.sql` — Phase 5 lesson "DROP FUNCTION explicit saat behavior change". Migration 0024 wajib `DROP FUNCTION add_money_to_goal(int, numeric)` SEBELUM CREATE v2.
- `supabase/migrations/0019_process_due_recurring.sql` + `0020_withdraw_from_goal.sql` (Phase 6) — pattern compliance reference. SQLSTATE P0001 untuk error user-facing, SQLSTATE 42501 untuk akses ditolak.

### Phase 6 prior decisions (mandatory carry-forward)

- `.planning/phases/06-race-atomicity/06-CONTEXT.md` §D-19 (RPC pattern compliance), §D-22 (Studio fallback), §D-23 (pgTAP convention), §D-24 (Browser-MCP UAT). Phase 7 inherits semua.
- `.planning/phases/06-race-atomicity/06-CONTEXT.md` §D-10 — withdraw error message wording forward-compatible "kas". Phase 7 D-14 extends.
- `.planning/phases/06-race-atomicity/06-CONTEXT.md` §D-20 — mapSupabaseError SQLSTATE 23514/P0001 branches sudah ada. Phase 7 reuse.

### Audit findings (motivasi)

- `.planning/codebase/REVIEW-2026-04-27.md` §C-02 (CONS-01 Goals UI/DB mismatch), §H-01 (CONS-02 timezone), §H-02 (UX-01 reset key), §M-01 (CONS-03 seed atomicity), §M-03 (UX-02 View-As CSV). Verbatim acceptance criteria di REQUIREMENTS.md.

### Requirements & Roadmap

- `.planning/REQUIREMENTS.md` §"UI ↔ DB Consistency" + §"User-Facing Bug Fixes" — CONS-01..03 + UX-01..02 acceptance criteria verbatim.
- `.planning/ROADMAP.md` §"Phase 7: UI/Data Consistency" — Goal + 5 success criteria. Tooltip wording UAT-5 SC#5 "Tidak tersedia saat View-As" verbatim match.

### Project guards

- `.planning/PROJECT.md` §"Constraints" — RLS mandatory, Indonesian copy, mobile-responsive, production verify-before-close.
- `.planning/STATE.md` §"Decisions (v1.1 execution-time, post-Phase-5)" — migration numbering shift +1, Studio fallback de-facto channel, REST/RPC HTTP testing > DevTools console.

### Existing code (callsites yang akan disentuh)

- `src/lib/useRencanaInit.ts` — full rewrite: cek localStorage fast-path, kalau missing call `seed_rencana` RPC.
- `src/db/goals.ts` — `seedRencanaGoals()` di-deprecate (RPC takes over), `addMoneyToGoal()` callsite tidak perlu rename (RPC name same).
- `src/db/investments.ts` — `seedRencanaInvestments()` di-deprecate (RPC takes over).
- `src/queries/investments.ts:111` — replace `new Date().toISOString().slice(0, 10)` dengan `todayISO()`.
- `src/tabs/SettingsTab.tsx:118` — fix localStorage key per-user + add reset_rencana_marker RPC call + delete legacy `'rencana_seeded'` global key.
- `src/tabs/TransactionsTab.tsx` — disable Impor CSV button + handler guard saat `viewingAs !== null`.
- `src/tabs/InvestmentsTab.tsx` — sama seperti TransactionsTab.
- `src/components/AddMoneyDialog.tsx` — withdraw mode tampilkan info "Saldo kas tersedia: Rp X (terpisah dari investasi Rp Y)" dari VIEW.
- `src/auth/useViewAs.ts` + `src/auth/ViewAsContext.tsx` — sumber `viewingAs` boolean (existing primitive, no changes).
- `src/lib/format.ts` §`todayISO()` — keep as-is (decision D-20).
- `eslint.config.js` — add `no-restricted-syntax` rule (decision D-16).
- `src/lib/mapSupabaseError.ts` — already has SQLSTATE 23514/42501/P0001 branches (Phase 5+6). Phase 7 tidak perlu tambah.

### Test infra

- `supabase/tests/04-mark-bill-paid.sql` — pgTAP convention reference.
- `supabase/tests/05-tighten-rls.sql` — Phase 5 reference (14 PASS pattern).
- `supabase/tests/06-process-due-recurring.sql` + `06-withdraw-from-goal.sql` (Phase 6) — most recent reference, identical convention.

### External docs (low priority)

- [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions) — SECURITY DEFINER, search_path
- [PostgreSQL: CREATE VIEW](https://www.postgresql.org/docs/current/sql-createview.html) §security_invoker
- [ESLint: no-restricted-syntax](https://eslint.org/docs/latest/rules/no-restricted-syntax) — AST selector documentation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`mark_bill_paid` RPC pattern (migration 0014)** — copy struktur ke seed_rencana, add_money_to_goal_v2, reset_rencana_marker. Tidak reinvent SECURITY DEFINER + auth guard.
- **`add_money_to_goal` v1 (migration 0006)** — direct mirror untuk v2. Status transition logic langsung adapt.
- **`upcoming_bills_unpaid` VIEW (migration 0015)** — `security_invoker = true` pattern. `goals_with_progress` ikuti exactly.
- **`useTargetUserId()` hook (`src/auth/useTargetUserId.ts`)** — sudah ada, return UUID admin's view-as target. Lewatkan ke `p_uid` parameter di seed_rencana.
- **`useViewAs()` hook (`src/auth/useViewAs.ts`)** — sudah ada, return `{ viewingAs, setViewingAs }`. UX-02 pakai langsung.
- **`useAuth()` hook** — return `user` object dengan `id` field untuk per-user localStorage key.
- **`todayISO()` helper (`src/lib/format.ts:31-34`)** — local-time-based, WIB-correct di browser. Pakai untuk fix CONS-02 callsite.
- **`mapSupabaseError`** (Phase 5+6) — SQLSTATE branches 42501/23514/P0001 sudah ada. Phase 7 tidak perlu tambah cabang.
- **Optimistic mutation + snapshot rollback pattern** (Phase 4) — bisa digunakan untuk add_money_to_goal mutation di GoalsTab kalau perlu UX instant.

### Established Patterns

- **Migration channel:** Studio SQL Editor manual paste (Phase 6 carry-forward).
- **pgTAP convention:** `BEGIN/ROLLBACK` + `RAISE NOTICE PASS:/FAIL:` (Phase 4-6).
- **Indonesia copy:** Semua user-facing message Bahasa Indonesia ("Saldo kas tidak cukup", "Tidak tersedia saat View-As").
- **Production UAT pre-close:** Browser-MCP terhadap Vercel deploy + REST/RPC HTTP test (Phase 5+6).
- **Plan handoff convention:** Plans 07-01..07-NN, masing-masing single-file commit, Wave-based execution.
- **VIEW pattern:** `security_invoker = true` mandatory untuk RLS pass-through (Phase 4 0015).

### Integration Points

- **Vercel auto-deploy** dari `master` — frontend deploy 15-30s post-push. Migration deploy manual via Studio (decoupled).
- **`AuthProvider` + `ViewAsProvider`** — sudah wrap App.tsx; `useViewAs()` callable dari mana saja di tree.
- **`useRencanaInit` hook called from Dashboard mount** — primary trigger untuk seed_rencana RPC. Idempotent cek wajib.
- **`AddMoneyDialog.tsx`** — single dialog handles both add (mode='add') dan withdraw (mode='withdraw'). Phase 7 inline kas/investasi info hanya di mode='withdraw'.

### Constraints / Risk Notes

- **No `UNIQUE(user_id, name)` constraint pada `goals`** — confirmed via schema scan. Itulah kenapa lazy-seed tanpa marker akan duplicate (D-02 reasoning).
- **Migration 0024 DROP FUNCTION wajib explicit** — Phase 5 lesson 0018. Tanpa DROP, `CREATE OR REPLACE` dengan signature identical akan replace; tapi kalau executor accidentally ubah signature, legacy version stays — info-disclosure surface.
- **VIEW `goals_with_progress` GROUP BY g.id** — assumes goals.id PK. Aman.
- **`COALESCE(current_price, buy_price)` di VIEW formula** — handle investasi belum di-refresh harga. Konsisten dengan Net Worth tracker behavior pre-existing.

</code_context>

<specifics>
## Specific Ideas

- "Konvergensi ke single source-of-truth" — frase tema Phase 7. VIEW `goals_with_progress` adalah materi utama (Goals); marker table `user_seed_markers` adalah materi seed. Setiap UI yang display goal progress harus query VIEW, jangan compute total client-side.
- Tooltip wording UX-02 "Tidak tersedia saat View-As" — exact match dengan ROADMAP SC#5 (verifier akan diff string). Plan-phase + executor jangan re-word.
- AddMoneyDialog withdraw mode helper text: "Saldo kas tersedia: Rp X (terpisah dari investasi Rp Y)" — paralel dengan error message phrasing supaya user UX coherent (sama wording sebelum + sesudah submit).
- Eager backfill `goals.status` di migration 0024 — supaya SC#1 demo case (goal target 10jt + investasi 60% × 18jt) langsung visible "Tercapai" tanpa user perlu click add_money lagi. Verifier nanti tinggal load Dashboard, bukan run scenario.
- Migration order saat deploy: 0022 → 0023 → 0024 (idempotent each, but order makes review diff cleaner). Per Phase 6 STATE.md decision pattern.

</specifics>

<deferred>
## Deferred Ideas

- **Server-side import RPC dengan `p_user_id` + `is_admin()` check (UX-02 Layer 2)** — REQUIREMENTS.md "Future Requirements" defer ke v1.2. Layer 1+1.5 cukup untuk reported issue.
- **`todayISO()` explicit Asia/Jakarta TZ hardening** — Defer ke v1.2 jika ada server-side callsite future. Browser-only saat ini, local-time = WIB sudah benar.
- **Move RENCANA seed data ke dedicated config table** — overkill v1.1; seed jarang berubah. Reconsider kalau admin GUI editable seeds dibutuhkan.
- **ESLint rule untuk `supabase/functions` (Deno)** — separate eslint config (atau Deno's own linter); Phase 7 scope frontend lint only.
- **Auto-flip `goals.status` ke `paused` untuk goal yang stale** — out of scope; user explicit pause hanya.
- **Toast "Goal X balance turun di bawah target → status active"** (after withdraw) — cosmetic UX nudge, defer.
- **Pagination/search di NoteDialog dropdown linked transaction** — REQUIREMENTS L-02 (LOW), defer ke v1.2.
- **Cleanup `'rencana_seeded'` global localStorage key untuk semua existing users** — handled inline pada Reset Seed handler (D-07.5). Background migration di useRencanaInit on every mount = pre-mature optimization, defer.

### Reviewed Todos (not folded)

None — no pending todos matched Phase 7 scope (verified via init phase-op output: STATE.md "Pending Todos: None").

</deferred>

---

*Phase: 07-ui-data-consistency*
*Context gathered: 2026-04-29*
