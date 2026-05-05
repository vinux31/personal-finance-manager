# Phase 7: UI/Data Consistency - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 07-ui-data-consistency
**Areas discussed:** CONS-03 seed (dedup, backfill, shape, reset flow), CONS-01 goals.status backfill, CONS-02 ESLint rule scope, UX-02 View-As CSV layers (UX-01 inline)

---

## CONS-03 — Seed Mechanism

### Q1: Dedup mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Marker row only (Recommended) | RPC cek `IF EXISTS user_seed_markers WHERE user_id` → fast, single source. Requires migration backfill. | ✓ |
| Name-existence on goals | Cek nama goals user → idempotent tanpa backfill, lebih slow, partial-resume risk. | |
| Both (defensive) | Cek marker AND name → most safe, more code, overkill. | |

**User's choice:** Marker row only
**Notes:** Pairs dengan backfill di Q2 — single source-of-truth, deterministic.

### Q2: Backfill existing users

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — backfill in 0022 (Recommended) | Migration include `INSERT user_seed_markers SELECT DISTINCT user_id FROM goals WHERE name = ANY(...)`. Eager + deterministic. | ✓ |
| No — lazy self-heal | Skip backfill, rely on RPC retry — risk duplicate insert tanpa unique constraint. | |
| Hybrid — unique constraint + lazy | Add UNIQUE(user_id, name) constraint + ON CONFLICT DO NOTHING — breaking domain change. | |

**User's choice:** Yes — backfill in 0022
**Notes:** Existing user (admin awal) langsung ada marker; race aman.

### Q3: RENCANA names source-of-truth

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcode in SQL + sync comment (Recommended) | Hardcode 5 goals + 5 investments di function body. Comment "Synced with rencanaNames.ts and goals.ts:RENCANA_GOALS". | ✓ |
| Pass arrays from TS | RPC signature pakai array params atau JSONB → TS jadi sumber tunggal. Signature panjang, security audit kompleks. | |
| Move RENCANA constants to dedicated config table | Table `rencana_config` populated via migration. Future-flex tapi overkill v1.1. | |

**User's choice:** Hardcode in SQL + sync comment
**Notes:** Drift mitigated via code review.

### Q4: Reset Seed flow + localStorage role

| Option | Description | Selected |
|--------|-------------|----------|
| 1 tombol clear all + localStorage as fast-path cache (Recommended) | Single Reset handler clears semua: rows + marker RPC + localStorage. localStorage stays untuk fast-path. | ✓ |
| 1 tombol + localStorage di-deprecate | Hapus localStorage entirely. DB single source. Cost: 1 RPC roundtrip per Dashboard load. | |
| Split: Reset Cache vs Reset Full | 2 tombol di SettingsTab. Granular tapi membingungkan user awam. | |

**User's choice:** 1 tombol clear all + localStorage as fast-path cache
**Notes:** Hemat 1 RPC roundtrip per session.

---

## CONS-01 — Goals Status Backfill

### Q1: Status flip strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Eager: one-time backfill di migration 0024 (Recommended) | Migration final step UPDATE goals SET status = 'completed' WHERE total >= target. SC#1 visible langsung. | ✓ |
| Lazy: flip baru saat next add_money_to_goal_v2 | No deploy-time UPDATE. Goal stuck 'active' selamanya kalau user tidak nambah cash. | |
| Reactive: status di-derive dari VIEW | Drop status as column. High blast radius, breaking change. | |

**User's choice:** Eager: one-time backfill di migration 0024
**Notes:** Demo case (60% × 18jt vs target 10jt) langsung visible.

### Q2: add_money_to_goal_v2 logic

| Option | Description | Selected |
|--------|-------------|----------|
| Compare new total (cash + investasi) vs target (Recommended) | Setelah UPDATE current_amount, compute total via VIEW formula, set completed jika total >= target. Match REQUIREMENTS CONS-01. | ✓ |
| Compare cash-only (current_amount) vs target | Backward compat tapi tidak match SC. | |
| Set completed conditional pada existing status | Skip kalau paused/completed. Refinement, captured di D-11. | |

**User's choice:** Compare new total (cash + investasi) vs target
**Notes:** Status transition logic mirror Phase 6 D-11 (preserve paused, completed stays).

### Q3: Withdraw error message phrasing

| Option | Description | Selected |
|--------|-------------|----------|
| 'Saldo kas tidak cukup. Tersedia Rp X (terpisah dari Rp Y di investasi)' (Recommended) | Jelas separasi, ringkas. Match REQUIREMENTS CONS-01. | ✓ |
| 'Saldo kas tidak cukup (tersedia Rp X). Investasi Rp Y tidak bisa ditarik tunai.' | Lebih edukatif, tapi panjang di mobile toast. | |
| Pesan ringkas + tooltip di dialog | Cleaner UX tapi butuh perubahan komponen tambahan. | |

**User's choice:** 'Saldo kas tidak cukup. Tersedia Rp X (terpisah dari Rp Y di investasi)'

### Q4: v1 fate (DROP vs keep)

| Option | Description | Selected |
|--------|-------------|----------|
| Drop v1 + replace dengan v2 same name (Recommended) | Migration 0024 `DROP FUNCTION ...; CREATE FUNCTION ...`. Phase 5 lesson 0018. | ✓ |
| Add v2 as new function add_money_to_goal_v2 | Keep v1 untuk back-compat. Legacy code surface. | |
| v2 dengan signature beda | Allow caller pilih flip behavior. Over-engineered. | |

**User's choice:** Drop v1 + replace dengan v2 same name
**Notes:** TS callsite tidak rename (signature identik).

---

## CONS-02 — ESLint Rule Scope

### Q1: Pattern scope

| Option | Description | Selected |
|--------|-------------|----------|
| Block exact `new Date().toISOString().slice(0,X)` only (Recommended) | AST selector tight. Zero false positive. | ✓ |
| Block any `.toISOString()` outside lib/format.ts | Broader. Banyak false positive untuk audit fields. | |
| Block all `new Date()` literals outside helpers | Most strict. Refactor cost tinggi. | |

**User's choice:** Block exact pattern only

### Q2: Severity

| Option | Description | Selected |
|--------|-------------|----------|
| error — CI block (Recommended) | Hard gate. Match Phase 5 hardening. | ✓ |
| warn — visible tapi tidak gagal | Lebih lenient tapi cenderung di-ignore. | |

**User's choice:** error

### Q3: Exception path

| Option | Description | Selected |
|--------|-------------|----------|
| No exceptions — strict global ban (Recommended) | Tidak ada legitimate use case di codebase. eslint-disable inline kalau executor butuh. | ✓ |
| Allow di test files | Test files belum existed. Pre-emptive exception. | |
| Allow di supabase/migrations dan .planning/ | Implicit via lint-config glob, no rule-level needed. | |

**User's choice:** No exceptions — strict global ban

### Q4: todayISO() hardening

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as-is (Recommended) | Local-time = WIB di browser. Tidak ada server-side callsite. | ✓ |
| Harden to explicit Asia/Jakarta TZ | Robust untuk future server-side. Adds dependency. | |
| Add comment + assert at boundary | Documentation only. Cheap insurance. | |

**User's choice:** Keep as-is
**Notes:** Server-side hardening defer ke v1.2.

---

## UX-02 — View-As CSV Defense Layers (UX-01 inline)

### Q1: Defense layer

| Option | Description | Selected |
|--------|-------------|----------|
| UI disabled + handler-level early-return guard (Recommended) | Layer 1 (button disabled + tooltip) + Layer 1.5 (handler guard). Layer 2 RPC defer. | ✓ |
| UI disabled only | Match REQUIREMENTS persis. Lebih pure tapi defense kurang. | |
| UI disabled + handler guard + visual mode banner | Plus persistent banner. Scope creep — banner mungkin sudah ada di Header. | |

**User's choice:** UI disabled + handler-level early-return guard

### Q2: isViewAs source

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing pattern (Recommended) | `useViewAs()` hook + compute `isViewAs = viewingAs !== null` inline. Hook sudah ada. | ✓ |
| Tambah hook useIsViewAs() | DRY tapi abstraction overhead. | |
| Pass via context provider | ViewAsContext sudah ada — implicit choice ini. | |

**User's choice:** Reuse existing pattern
**Notes:** `useViewAs` exported dari `src/auth/useViewAs.ts` — re-export dari ViewAsContext.

### Q3: Tooltip wording

| Option | Description | Selected |
|--------|-------------|----------|
| 'Tidak tersedia saat View-As' (Recommended) | Match ROADMAP SC#5 verbatim. | ✓ |
| 'Impor CSV hanya tersedia untuk akun sendiri' | Lebih edukatif tapi mismatch SC. | |
| Empty/no tooltip | Disabled state confusing tanpa explanation. | |

**User's choice:** 'Tidak tersedia saat View-As'

### Q4: UX-01 standalone or inline

| Option | Description | Selected |
|--------|-------------|----------|
| Inline ke CONS-03 (Recommended) | Fix sederhana — sudah implicit di Reset Seed flow decision. | ✓ |
| Discuss as separate area | Masih ada nuance soal cleanup old global key. | |

**User's choice:** Inline ke CONS-03
**Notes:** Cleanup legacy `'rencana_seeded'` global key handled di Reset handler one-shot.

---

## Claude's Discretion

- pgTAP test naming detail (test_001 vs descriptive)
- Loop body micro-optimization di seed_rencana (single multi-row INSERT vs row-by-row)
- Whether to batch INSERT via WITH ... AS CTE in seed_rencana
- Wave ordering di Phase 7 plans (VIEW first → marker+seed → add_money_v2 → frontend → ESLint + UAT)
- Whether `reset_rencana_marker` perlu admin override (default self-only)
- Backward-compat handling untuk old `'rencana_seeded'` global localStorage key

## Deferred Ideas

- Server-side import RPC dengan p_user_id + is_admin check (UX-02 Layer 2) → v1.2
- todayISO() explicit Asia/Jakarta TZ hardening → v1.2
- Move RENCANA seed data ke dedicated config table → defer
- ESLint rule untuk supabase/functions (Deno) → separate config
- Auto-flip goals.status ke paused untuk stale goal → out of scope
- Toast "balance turun di bawah target" UX nudge → cosmetic, defer
- Pagination/search di NoteDialog dropdown → REQUIREMENTS L-02 v1.2
- Background migration cleanup `'rencana_seeded'` global key di useRencanaInit on every mount → pre-mature optimization
