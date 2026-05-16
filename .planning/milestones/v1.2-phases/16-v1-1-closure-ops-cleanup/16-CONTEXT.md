# Phase 16: v1.1 Closure & Ops Cleanup - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning
**Mode:** auto (all decisions auto-selected)

<domain>
## Phase Boundary

Phase 16 adalah **ops verification phase** — tidak ada UI baru, tidak ada schema baru, tidak ada migrasi baru. Dua deliverable:

1. **Live UAT B1-B5** — jalankan 5 verifikasi skenario yang di-defer dari v1.1 di production (Supabase Cloud + kantongpintar.vercel.app). Semua code sudah shipped di prior phases.
2. **TECHDEBT-01** — buat keputusan migration history reconciliation, dokumentasikan di PROJECT.md Key Decisions, tulis future-migration playbook.

Phase ini TIDAK termasuk:
- Fix code (semua B1-B5 sudah ada implementasinya)
- UI changes
- New migrations
- View-As UAT untuk Phase 13/14 VERIFICATION.md (defer ke dedicated admin-seed cycle)

</domain>

<decisions>
## Implementation Decisions

### D-01: TECHDEBT-01 Strategy — Path (b) Document Procedural Alternative

**Decision:** Pilih **Path (b)** — jangan repair migration history, cukup:
1. Dokumentasikan procedural alternative (Studio SQL Editor paste tetap default workflow)
2. Tambahkan "dummy applied" entry di `supabase_migrations.version` table via SQL Editor jika diperlukan untuk `supabase migration list --linked` consistency
3. Tulis future-migration playbook: kapan Studio paste vs CLI push, cara handle signature changes

**Rationale:**
- Memory: "jangan repair tanpa diagnosis" — repair history tanpa diagnosis bisa break lebih banyak hal
- Studio paste sudah proven workflow sejak 0014; tidak ada incident
- Path (a) repair butuh `supabase migration repair` + `supabase db push` — risky jika terjadi drift antara local schema dan cloud
- Goal TECHDEBT-01 adalah "keputusan dipilih dan didokumentasikan" — path (b) memenuhi kriteria itu

**Output:** Entry baru di PROJECT.md Key Decisions table + section baru "Migration Playbook" di PROJECT.md atau separate `docs/migration-playbook.md`.

### D-02: Pre-condition Data Setup Method — SQL Editor

**Decision:** Gunakan **Supabase Studio SQL Editor** untuk setup pre-condition data B1-B5:
- Insert/update recurring templates (next_due_date = bulan ini)
- Set goal state (cash > 0, status='completed' dengan cash ≥ target)
- Insert expense recurring template dengan bill due ≤ today

**Rationale:** Reproducible, idempotent, faster than UI for complex state. Actual UAT verification steps dilakukan via browser UI (sesuai skenario).

**SQL scripts:** Tulis sebagai inline SQL di plan (tidak perlu file terpisah — state production-specific, tidak masuk version control).

### D-03: Plan Structure — Two Plans

**Decision:** Split ke **dua plans**:
- **16-01:** Pre-condition data setup (VERIF-01) + TECHDEBT-01 decision + documentation
- **16-02:** Live UAT execution B1-B5 (VERIF-02 through VERIF-06) + verification sign-off

**Rationale:** Clean separation — 16-01 adalah ops setup yang bisa async, 16-02 adalah interactive browser testing. Kalau 16-01 gagal/blocked, 16-02 tidak perlu dijalankan.

### D-04: No New Migrations

**Decision:** Phase 16 **tidak butuh migrations baru**. Semua code sudah ada:
- B1: `process_due_recurring` RPC (migration 0019, Phase 6) — idempotency via FOR UPDATE + IF EXISTS
- B2: `mark_bill_paid` RPC (migration 0013, Phase 4) — FOR UPDATE row lock
- B3: `withdraw_from_goal` RPC (migration 0020, Phase 6) — P0001 + saldo message
- B4: `withdraw_from_goal` status flip completed→active (migration 0020)
- B5: `todayISO()` WIB-aware (migration 0022, Phase 7) + CORS unblock (Phase 10)

### D-05: UAT Verification Method — Manual Browser + SQL Post-checks

**Decision:** B1-B5 dilakukan dengan:
- **Browser steps:** Manual click flow sesuai success criteria di ROADMAP.md
- **SQL post-condition checks:** `SELECT` query di SQL Editor untuk verify DB state setelah UAT
- **Network DevTools:** Untuk B5 — inspect request payload `date` field

**No Playwright specs:** Skenario B2 (rapid 5x tab switch), B3 (2-tab quick succession) tidak bisa diotomasi reliably dengan Playwright untuk race conditions di production.

### Claude's Discretion

- Format dokumentasi future-migration playbook (inline PROJECT.md vs separate doc) — Claude pilih sesuai panjang konten; kalau > 200 kata sebaiknya separate `docs/migration-playbook.md`
- Exact SQL untuk pre-condition setup — Claude tulis berdasarkan schema yang ada
- Order B1-B5 execution dalam 16-02 — Claude sequence dari yang paling mudah ke paling complex (B5→B1→B4→B2→B3)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### ROADMAP.md Phase 16 Success Criteria
- `.planning/ROADMAP.md` §"Phase 16: v1.1 Closure & Ops Cleanup" — 7 success criteria (pre-condition setup + B1-B5 individual criteria + TECHDEBT-01 documentation)

### REQUIREMENTS.md
- `.planning/REQUIREMENTS.md` §"Verification Closure dari v1.1 (VERIF)" — VERIF-01 through VERIF-06
- `.planning/REQUIREMENTS.md` §"Tech Debt Minor (TECHDEBT)" — TECHDEBT-01 migration history reconciliation

### State Context
- `.planning/STATE.md` §"Deferred Items (carried from v1.1)" — B1-B5 original deferred items + severity
- `.planning/STATE.md` §"Decisions (carried from v1.1)" — Studio paste de-facto channel + db push broken history

### Project Context
- `.planning/PROJECT.md` §"Key Decisions" — table untuk lokasi output TECHDEBT-01 decision
- `.planning/PROJECT.md` §"Context" — migration history note: "0001 → 0025 applied to cloud" (UPDATE: sebenarnya 0001-0013 applied awal, 0014-0030 Local-only per `supabase migration list --linked`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/date.ts` — `todayISO()` WIB-aware date utility (CONS-02, migration 0022). B5 akan verify ini di live request payload.
- `supabase/migrations/0019_process_due_recurring.sql` — RPC `process_due_recurring` dengan FOR UPDATE row lock + IF EXISTS idempotency (B1 verification subject)
- `supabase/migrations/0020_withdraw_from_goal.sql` — RPC `withdraw_from_goal` atomic + P0001 insufficient saldo message (B3, B4 verification subject)
- `supabase/migrations/0013_bill_payments.sql` + `supabase/migrations/0014_mark_bill_paid.sql` — `mark_bill_paid` RPC FOR UPDATE lock (B2 verification subject)

### Migration State
- **Local migrations:** 0001-0030 (30 total)
- **Cloud applied:** ~0001-0013 + 0014-0030 via Studio paste (no `supabase db push` since history mismatch)
- **TECHDEBT-01 context:** `supabase migration list --linked` shows 0014..0030 as "Local-only" karena schema_migrations table di cloud tidak punya entries for these (Studio paste doesn't update schema_migrations)

### Integration Points
- Phase 16 tidak touch application code — hanya: (1) SQL pre-condition scripts via Studio, (2) manual browser UAT, (3) PROJECT.md + playbook documentation

</code_context>

<specifics>
## Specific Ideas

- **B3 2-tab concurrent withdraw:** Buka 2 browser tab di `/goals`, pilih goal sama, withdraw Rp 50k dari total Rp 100k di kedua tab. Submit keduanya rapid succession (< 2 detik). Expected: satu sukses (saldo ≥ Rp 50k pada saat RPC hit), satu P0001 toast "Saldo kas tidak cukup (tersedia Rp 50.000)". SQL verify: `SELECT current_amount FROM goals WHERE id = '<goal_id>'` = Rp 50k (bukan 0 atau negatif).
- **B5 network inspection method:** Chrome DevTools → Network tab → filter "edge-functions" atau "fetch-prices" → inspect request payload JSON body → field `date` harus berformat "YYYY-MM-DD" based on WIB (UTC+7), bukan UTC. Test saat crossing midnight Jakarta time (21:00 UTC = 04:00 WIB next day) optional.
- **TECHDEBT-01 playbook minimum viable content:** (1) Current state snapshot, (2) why `db push` broken + resolution decision, (3) procedure for future migrations: write .sql file → paste in Studio SQL Editor → commit .sql to git, (4) when to use CLI push vs Studio paste, (5) handling signature changes (always DROP FUNCTION IF EXISTS first).

</specifics>

<deferred>
## Deferred Ideas

- **View-As UAT Phase 13/14** (VERIFICATION.md human_needed items) — butuh admin role + target user_id seed. Defer ke dedicated UAT cycle v1.3 atau ketika admin test seed tersedia.
- **`goals_with_progress` VIEW v2** (add created_at column) — noted Phase 13 execute-time decision. Backlog migration `00XX_goals_with_progress_v2.sql`. Not Phase 16 scope.
- **`recurring_runs` rename** (bill_payments semantic rename) — PROJECT.md backlog, tidak disentuh Phase 16.
- **AuthProvider .catch() gap** — carry v1.3.

None — discussion stayed within phase scope (ops + verification only).

</deferred>

---

*Phase: 16-v1-1-closure-ops-cleanup*
*Context gathered: 2026-05-15*
