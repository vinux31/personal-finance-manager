---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Strategic Layer & Verification Closure
status: archived
stopped_at: v1.2 milestone archived 2026-05-16 — 6 phases, 17 plans, all PASS
last_updated: "2026-05-16T00:00:00.000Z"
last_activity: 2026-05-16 -- v1.2 milestone closed and archived, git tag pending
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 17
  completed_plans: 17
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-16)

**Core value:** Pengguna bisa melihat gambaran lengkap kondisi keuangan mereka dalam satu tempat, dengan kalkulasi yang relevan untuk konteks Indonesia.
**Current focus:** v1.2 archived — planning v1.3 (`/gsd-new-milestone`)

## Current Position

Phase: 16 (v1-1-closure-ops-cleanup) — COMPLETE
Plan: 2 of 2
Status: Milestone v1.2 closed
Last activity: 2026-05-16

## v1.2 Phase Summary

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 11 | Periode Gaji | (pre-defined v1.2 scope) | **Complete (PASS)** — 2026-05-02 |
| 12 | /kesehatan Foundation | SCHEMA-01, STRAT-01, STRAT-02, DIAG-11 | **Complete** — 2026-05-08 |
| 13 | Diagnostic Data Indicators | DIAG-01, 02, 03, 05, 06, 07, 08, 10, STRAT-03 | **Complete** — 2026-05-08 |
| 14 | Protection & Tier 4 Checklists | DIAG-04, 09, 12 | **Complete (verified)** — 2026-05-09 |
| 15 | Modul Edukasi & Kalkulator | STRAT-04, 05, 06 | **Complete** — 2026-05-10 |
| 16 | v1.1 Closure & Ops Cleanup | VERIF-01..06, TECHDEBT-01 | **Complete (PASS)** — 2026-05-15 |

## Accumulated Context

### Decisions (carried from v1.0)

- Build order: Foundation (DB + bug fix + nav) → Net Worth Tracker (additive UI) → Bills Display (display-only) → Mark-as-Paid (riskiest, isolated last)
- Investasi auto-included di Net Worth sebagai baris read-only dari tabel investments — block manual investasi account untuk cegah double-count
- bill_payments table (Option A): mark-as-paid atomik buat transaction + catat payment + advance next_due_date sekaligus
- Schema: dua tabel terpisah (net_worth_accounts + net_worth_liabilities) — cleaner untuk query semantics
- Mutation-only Date clamping for nextDueDate monthly: setDate(1)+setMonth+Math.min(d,lastDay)
- RLS D-06: dua tabel terpisah (accounts + liabilities), bill_payments.transaction_id nullable + SET NULL
- mark_bill_paid RPC uses SECURITY DEFINER + explicit user_id=v_uid (cannot rely on DEFAULT auth.uid()); idempotency via FOR UPDATE row lock + IF EXISTS on bill_payments
- upcoming_bills_unpaid VIEW security_invoker=true; half-open month window [start, +1 month)
- SQL tests convention: supabase/tests/<phase>-<feature>.sql, BEGIN/ROLLBACK, RAISE NOTICE PASS:/FAIL:
- Optimistic mutation + snapshot rollback (first di project) — pattern verified
- Production verify-before-close (Playwright + Supabase Cloud) — caught 1 deploy gap + 1 toast bug
- mapSupabaseError extract `.message` dari plain-object errors (Supabase RPC errors bukan Error instance)

### Decisions (carried from v1.1)

- Phase 5 in-flight patch 0018: PG keys function identity on (name, arg_types). Future signature changes WAJIB emit `DROP FUNCTION IF EXISTS sig` sebelum CREATE OR REPLACE.
- Studio paste de-facto migration channel — `db push` broken (history mismatch), Studio SQL Editor manual paste tetap default sampai TECHDEBT-01 di Phase 16 resolves.
- RETURNS TABLE plpgsql output variables shadowing — qualify base-table refs dengan alias (lesson 0024 hot-fix).
- Edge Function deploy via Supabase Dashboard sebagai workaround saat CLI tidak terinstall.
- Gateway-layer JWT reject (verify_jwt=true) > handler-layer reject (defense-in-depth).
- CORS allowlist drift saat domain baru — domain decision = ALLOWED_ORIGINS update di same plan/PR.

### Decisions (v1.2 roadmap-time, 2026-05-08)

- **Phase 11 already shipped (2026-05-02)** — Periode Gaji kept as part of v1.2 milestone numbering; v1.2 active phases = 12-16.
- **Phase order rationale:**
  - Phase 12 first — sidebar route + landing shell + SCHEMA-01 are foundation; DIAG-11 empty state lives here karena landing-level fallback.
  - Phase 13 (Indicators) depends on 12 — tier panel infrastructure + landing route harus ada dulu.
  - Phase 14 (Checklists) depends on 12 (SCHEMA-01) + 13 (tier panel infra). Split dari Phase 13 karena: (a) different data layer (mutation form vs read-only query), (b) View-As guard logic specific ke checklist, (c) protection_checklist write-path butuh atensi terpisah.
  - Phase 15 (Modul + Kalkulator) parallel-able dengan 13/14 — tidak share state. Bisa juga jalan setelah 12. Default: jalankan setelah 14 untuk linear momentum, tapi plan-phase boleh re-order.
  - Phase 16 (v1.1 Closure & Ops Cleanup — VERIF + TECHDEBT merged) **independent** — bisa parallel dengan 12-15 atau di akhir. Default akhir biar fokus. Ops phase tanpa UI baru.
- **DIAG-11 (empty state full) dimasukkan ke Phase 12** karena ini behavior landing route, bukan indikator data layer.
- **DIAG-12 (View-As compatibility) dimasukkan ke Phase 14** karena guard yang paling sensitif adalah inline form + checklist mutations; indikator read-only di Phase 13 inherit pattern existing (`viewingAs ?? userId`).
- **STRAT-03 (tier expand panel) dimasukkan ke Phase 13** bukan 12 karena panel content butuh indicator queries; landing tanpa expand di Phase 12 acceptable interim.
- **Phase 16 merge (VERIF + TECHDEBT)** — keduanya ops-focused, tying up v1.1 loose ends, no UI. Coherent narrative "v1.1 Closure & Ops Cleanup" daripada 2 phase kecil terpisah.

### Decisions (Phase 13 plan-time, 2026-05-08)

- **LIFE_EXPECTANCY_YEARS = 75** locked di `src/queries/kesehatanTypes.ts` (BPS Indonesia 2024 ~74y rounded). Simpan sebagai konstanta supaya gampang adjust pasca-rilis tanpa rebuild compute logic.
- **useTransactions filtered dengan `dateFrom = today - 3 months`** di `useIndikator()` — hindari full-table scan untuk user dengan ribuan transaksi (RESEARCH.md pitfall #2).
- **Hybrid compute strategy** (CONTEXT.md decision B): client-side derivation reuse existing query hook cache. Migration path ke server-side RPC `compute_indicators(uid)` preserved tanpa break consumer interface.
- **Single-open Accordion** (CONTEXT.md decision A): shadcn Accordion `type='single' collapsible`. Klik tier baru auto-close tier lama. tw-animate-css sudah imported di `src/index.css`.
- **File-ownership matrix locked** untuk Wave 2 zero-conflict parallelism: 13-02 owns `Tier1Panel.tsx` + `kesehatanTier1.ts`; 13-03 owns `Tier2Panel.tsx` + `kesehatanTier2.ts`; 13-04 owns `Tier3Panel.tsx` + `kesehatanTier3.ts`. `KesehatanLanding.tsx` TIDAK dimodifikasi di Wave 2.
- **`IndikatorResult.compute.staleMonths?: number`** extension menjawab CONTEXT.md Open Question 2 (DIAG-06 stale pension notice — IndikatorCard render amber badge "Stale Xbln" jika set).

### Decisions (Phase 13 execute-time, Plan 13-03, 2026-05-08)

- **Formula deviation locked (computePensiun DIAG-06):** spec §4 literal "× usia_harapan" diganti dengan `(LIFE_EXPECTANCY_YEARS − usia_pensiun)` untuk years-remaining-post-retirement semantics. Rationale: user pensiun usia 55 butuh dana 20 tahun pasca-pensiun, bukan 75 tahun total. Edge case guard `Math.max(yearsRemaining, 1)` prevent divide-by-zero. Code comment block dokumentasi rationale di kesehatanTier2.ts.
- **Goal interface extension (Plan 13-03 Task 1):** `created_at: string` field added (additive backward compat — column exist sejak migration 0001). `listGoals` + `getGoal` SELECT include created_at. **Cascade fix queries/goals.ts:** `goals_with_progress` VIEW (migration 0023) tidak expose created_at. GoalWithProgress consumers (GoalsTab/DashboardTab) substitute untuk Goal type → cascade type errors. Workaround: synthesize empty-string created_at di mapper VIEW result. Migration `00XX_goals_with_progress_v2.sql` backlog kalau Phase berikutnya butuh real value di GoalWithProgress.
- **Pension source compute coverage:** ALL 6 sources SUCCESS (BPJS / DPPK / DPLK / Taspen / Pesangon / Investasi Mandiri). PensionSimRow di `src/db/pensiun.ts` tidak ada nullable boolean/number — simple truthy gate `if (sim.ht_en_*)` works. Pragmatic minimal-fallback path (BPJS+Invest only) yang plan offered TIDAK dibutuhkan.
- **calcPesangon positional args** (correction dari plan skeleton): signature aktual `calcPesangon(gajiPokok: number, masaKerja: number)` — bukan object form `{ gajiPokok, masaKerja }`. Verified di `src/lib/pensiun-calc.ts` line 230.
- **View-As pension_simulations RLS leak** (carried, untuk Phase 14 backlog): policy `auth.uid() = user_id` (no `OR is_admin()`) → admin View-As → null → DIAG-06 cta-fallback "Belum simulasi pensiun". Acceptable v1.2 (graceful degradation, no crash). Phase 14 candidate fix migration `00XX_pension_simulations_rls_admin.sql`.

### Decisions (Phase 13 execute-time, Plan 13-04, 2026-05-08)

- **`totalAsetFinansial` helper PROMOTED ke exported function** dari internal kesehatanTier1.ts. Plan 13-04 `computeRasioInvestasi` import langsung — denominator konsisten antara Tier 1 #3 (DAR Konsumtif), DAR Total info, dan Tier 3 #7 (Rasio Investasi). Alternative (duplicate helper di kesehatanTier3.ts yang plan skeleton sarankan) ditolak karena risk drift cross-tier.
- **asset_type normalization (DIAG-08 Diversifikasi):** lowercase + trim sebelum `Set` DISTINCT — partial Risk 5 mitigation. "Saham BBCA" + "saham bbca" + "  Saham BBCA  " → 1 distinct ✓. Synonym dedup ("Reksadana" vs "reksa dana") TIDAK handled — defer ke v1.3 (kandidat: enum constraint migration / frontend dropdown picker / server-side synonym dictionary).
- **Edge case aset finansial=0 → red 'compute' kind degraded display** (computeRasioInvestasi). Konsisten dengan T-13-08 pattern Plan 13-02 (DAR Konsumtif). User 0 aset masuk tier aggregation as red, BUKAN placeholder/cta-fallback (high-risk default).
- **Closed positions skip + empty asset_type filter** (defense-in-depth): listInvestments() server-side `.gt('quantity', 0)` sebagai layer pertama; client compute layer `.filter(inv => currentValue(inv) > 0)` + `.filter(t => t.length > 0)` defensive guard.
- **Phase 13 Wave 2 COMPLETE:** 4 plans / 2 waves shipped (13-01 infra + 13-02 Tier1 + 13-03 Tier2 + 13-04 Tier3). 8 indikator data-driven live. Helper reuse pattern (totalAsetFinansial cross-tier export) established. Tier 4 placeholder (Plan 13-01 Tier4Panel) ready untuk Phase 14 swap.

### Pending Todos

None.

### Blockers/Concerns

- **Threshold belum tervalidasi empiris** (design spec Risk 1) — semua threshold indikator pakai rule-of-thumb. Mitigasi: simpan threshold sebagai konstanta di `src/queries/kesehatan.ts` (bukan inline) supaya gampang adjust pasca-rilis.
- **`investments.asset_type` TEXT bebas** (design spec Risk 5) — DIAG-08 Diversifikasi pakai DISTINCT count yang bisa di-game oleh user. Trust-user di v1.2; normalize ke v1.3 backlog.
- **Modul content authoring** (design spec Open Question) — port apa adanya dari `financial_framework.html` direkomendasikan untuk v1.2; adaptasi inkremental v1.3.

## Deferred Items (carried from v1.1, candidate for resolution di v1.2)

| Category | Item | Status | Severity | Mapped To |
|----------|------|--------|----------|-----------|
| bug | net_worth_snapshots auto-insert 42501 saat View-As aktif | candidate | LOW | (carry to v1.3 — out of scope v1.2) |
| test | SC #3 destructive variant (TRUNCATE allowed_emails + signup) — needs staging mirror | candidate | LOW | out of scope v1.2 (PROJECT.md confirmed) |
| infra | Migration history reconciliation 0014..0028 Local-only | **closed** | LOW | Phase 16 TECHDEBT-01 — Path b: docs/migration-playbook.md |
| cosmetic | D-14 raw NUMERIC formatting di withdraw_from_goal MESSAGE | candidate | LOW | (carry to v1.3 — defer micro polish) |
| live UAT | B1 Gaji idempotency | **closed** | MEDIUM | Phase 16 VERIF-02 — PASS 2026-05-15 |
| live UAT | B2 mark-paid 5x rapid race | **closed** | MEDIUM | Phase 16 VERIF-03 — PASS 2026-05-15 |
| live UAT | B3 2-tab withdraw | **closed** | MEDIUM | Phase 16 VERIF-04 — PASS 2026-05-15 |
| live UAT | B4 completed→active flip | **closed** | MEDIUM | Phase 16 VERIF-05 — PASS 2026-05-15 (0028 hotfix applied) |
| live UAT | B5 Refresh Harga WIB date | **closed** | LOW | Phase 16 VERIF-06 — PASS 2026-05-15 |
| code | AuthProvider .catch() gap (corrupt-localStorage path raw TypeError) | candidate | LOW-MEDIUM | (carry to v1.3 — small frontend fix, no v1.2 home) |
| docs | DEV-04 wording reconcile ("10k" vs "50k") | candidate | LOW | (carry to v1.3) |

## Session Continuity

Last session: 2026-05-16
Stopped at: v1.2 milestone archived — git tag + RETROSPECTIVE.md pending
Resume options:

  - **Start v1.3: `/gsd-new-milestone`** — questioning → research → requirements → roadmap

### Decisions (Phase 14 execute-time, 2026-05-09)

- **Mutation pattern** — `useUpdateProtectionChecklist` ships single optimistic mutation hook (onMutate snapshot setQueryData → onError rollback + mapSupabaseError toast → onSuccess "Tersimpan" toast → onSettled invalidate). Single source of truth, consumed by Tier 1 form + Tier 4 panel + life section. Auto-save per radio click for Tier 4; explicit Simpan for Tier 1 form (different UX).
- **3-state radio for estate fields** (Decision E) — `Ya/Tidak/Belum diisi` maps to boolean `true/false/NULL` via gateValueToString/boolToString adapters. NULL semantics preserved through round-trip. UAT verified via supabase REST GET.
- **Gate toggle preserves life_*** (Decision D) — has_dependents Ya→Tidak retains life_coverage* columns in DB; Tidak→Ya restores visual without re-mutation. UAT confirmed via DB SELECT post-toggle.
- **View-As 3-layer defense** (DIAG-12) — UI conditional render (`!isViewAs`) + mutation hook defensive throw (`if viewingAs !== null`) + RLS WITH CHECK auth.uid() = user_id. Visual UAT for Tests 8 + 17 deferred to admin-seed cycle; RLS backstop sufficient for v1.2 ship.
- **Zero schema change** — Migration 0029 (Phase 12) shipped all 10 columns. Phase 14 strictly UI + mutation hooks. ProtectionChecklistRow widened from 2-col Phase 13 shell to full 10-col shape via re-export from new `src/db/protectionChecklist.ts`.
- **File ownership preserved** — `KesehatanLanding.tsx` edit limited to single-line `deriveTierColors` call-site update (Plan 14-03 Task 2). Phase 13 plan 13-01 ownership respected for all other landing modifications.
- **Build serves as regression gate** — `npm run build` (tsc -b + vite build) passes. No `npm test` script — build catches type + bundle integrity. Post-merge build PASS for both waves.
- **Code review advisories** (4 warnings, non-blocking, deferred): WR-01 unused `'yellow'` return type in computeTier4Color; WR-02 auto-save lacks `disabled={mutation.isPending}` gate (UX hardening, candidate Phase 15 polish or v1.3); WR-03 SQL test T5 bare INSERT instead of UPSERT (test coverage); WR-04 closure `uid` stale on sign-out mid-flight (RLS backstop sufficient).
