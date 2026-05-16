---
phase: 13-diagnostic-data-indicators
plan: 03
subsystem: kesehatan-tier2-indicators
tags: [phase-13, plan-03, tier2, goals-on-track, pensiun, smart-fallback-cta, life-expectancy-75, stale-notice, formula-deviation]
requires:
  - Plan 13-01 TierPanelInfra (Tier2Panel stub, IndikatorMap type, useIndikator skeleton, TierPanel generic shell, IndikatorResult.compute.staleMonths extension)
  - Plan 13-01 kesehatanTypes.ts constants (THRESHOLDS.goalsOnTrack, THRESHOLDS.pensiun, LIFE_EXPECTANCY_YEARS = 75)
  - src/lib/pensiun-calc.ts (calcBPJS / calcDPPK / calcDPLK / calcTaspen / calcPesangon / calcInvestasiMandiri)
  - src/db/pensiun.ts PensionSimRow + usePensionSim hook (View-As-aware)
  - src/db/goals.ts Goal + listGoals (extended dengan created_at)
provides:
  - computeGoalsOnTrack (DIAG-05) — long-term goal filter (target_date > now+1y AND status='active'), linear progress check pakai created_at, smart fallback CTA "Belum punya tujuan jangka panjang" → /goals
  - computePensiun (DIAG-06) — proyeksi total via 6 calc helpers (BPJS/DPPK/DPLK/Taspen/Pesangon/Invest) reuse HitungTotalPanel pattern, target_total formula deviates dari spec §4 literal (years-remaining-post-retirement semantics), smart fallback CTA + stale 6+ bulan notice
  - computeProjectionTotal (private helper) — 6-source SUM matching HitungTotalPanel.tsx lines 50-59
  - Goal.created_at field + listGoals SELECT extension (additive, backward compat)
  - Tier2Panel real wrapper (TierPanel + 2 indikator config + 2 CTA + 1 modul link)
affects:
  - src/db/goals.ts (Goal interface + listGoals + getGoal SELECT include created_at; backward compat additive)
  - src/queries/kesehatanTier2.ts (replaced Wave 1 stub 24 lines with real implementation 252 lines)
  - src/tabs/kesehatan/Tier2Panel.tsx (replaced placeholder body with real wrapper, 22→48 lines)
  - src/queries/goals.ts (Rule 3 cascade fix — synthesize created_at for GoalWithProgress mapper)
  - src/tabs/kesehatan/KesehatanLanding.tsx — NOT modified (file ownership exclusive Plan 13-01)
tech-stack:
  added:
    - (none — pure compute logic + JSX wrapping; reuse Plan 13-01 infra + existing pensiun-calc helpers)
  patterns:
    - Reuse HitungTotalPanel.tsx 6-source SUM pattern (BPJS jht + jpBulanan×12×20, Taspen tht + bulanan×12×20, others .total)
    - Linear progress check (current/target ≥ time_elapsed/total_duration) dengan created_at fallback ke 1 Jan tahun ini
    - Smart fallback CTA card pattern via cta-fallback IndikatorResult variant
    - Stale notice via spread `...(isStale && { staleMonths })` extension dari Plan 13-01
    - Edge case guard Math.max(yearsRemaining, 1) prevent divide-by-zero
    - Synthesize-then-cast pattern untuk VIEW yang tidak expose field baru (cascade fix)
key-files:
  modified:
    - src/db/goals.ts
    - src/queries/kesehatanTier2.ts
    - src/tabs/kesehatan/Tier2Panel.tsx
    - src/queries/goals.ts
decisions:
  - "Goal.created_at extension (CONTEXT.md Open Question 3): additive change, no schema migration needed (column exists since migration 0001 NOT NULL DEFAULT now()). Goal interface tambah field, listGoals + getGoal SELECT include created_at. Backward compat verified — existing consumers (GoalsTab, DashboardTab, RencanaBar) hanya destructure existing fields."
  - "LIFE_EXPECTANCY_YEARS = 75 imported dari kesehatanTypes.ts (Plan 13-01 lock). BPS Indonesia 2024 angka harapan hidup ~74 tahun, rounded ke 75 untuk simplicity dan konservatif (kasih buffer 1 tahun)."
  - "Formula deviation locked (computePensiun): spec §4 literal 'proyeksi ÷ (target_bulanan × 12 × usia_harapan)' DEVIATES intentionally ke 'proyeksi ÷ (target_bulanan × 12 × (LIFE_EXPECTANCY_YEARS − usia_pensiun))'. Rationale: financial semantics 'years remaining post-retirement' (user pensiun usia 55 butuh dana untuk 20 tahun pasca-pensiun, bukan 75 tahun total). Decision locked Phase 13 plan-checker iteration 2. Code comment block dokumentasi rationale di computePensiun body."
  - "Edge case guard yearsRemaining = Math.max(LIFE_EXPECTANCY_YEARS - usia_pensiun, 1). Kalau usia_pensiun ≥ 75, yearsRemaining floored ke 1 untuk avoid divide-by-zero. Treat sebagai 'sudah cover sisa hidup' — render compute (acceptable: edge case rare)."
  - "Stale threshold 6 bulan (STALE_THRESHOLD_MONTHS = 6) — kalau pension_simulations.updated_at > 6 bulan, set staleMonths field (Math.floor(monthsStale)). IndikatorCard render badge 'Stale Xbln' (Plan 13-01 sudah handle UI rendering)."
  - "computeProjectionTotal field signatures verified langsung dari src/db/pensiun.ts PensionSimRow + src/lib/pensiun-calc.ts signatures (TIDAK pakai Record<string, unknown> blind cast yang plan skeleton sarankan). Semua 6 source field-typed correctly. calcPesangon pakai positional args (gajiPokok, masaKerja), calcTaspen pakai object {gajiTerakhir, golongan, masaKerja}."
  - "Cascade fix queries/goals.ts (Rule 3): goals_with_progress VIEW migration 0023 tidak expose g.created_at. GoalWithProgress extends Goal jadi require created_at, tapi consumers (GoalsTab/DashboardTab) substitute GoalWithProgress untuk Goal — type narrowing breaks. Solution: synthesize empty-string created_at di mapper VIEW result. Consumer GoalWithProgress tidak baca field ini; computeGoalsOnTrack (DIAG-05) pakai useGoals() direct table query yang include real created_at. Phase berikutnya butuh real value → migration 0030_goals_with_progress_v2.sql include g.created_at."
  - "View-As pension_simulations RLS policy 'auth.uid() = user_id' (no is_admin() OR clause) — admin View-As ke user lain → usePensionSim returns null → DIAG-06 cta-fallback 'Belum simulasi pensiun'. Acceptable per CONTEXT.md (informative, no crash). Document untuk Phase 14 backlog (kandidat fix RLS atau accept)."
metrics:
  duration: ~7 minutes
  completed: 2026-05-08
  tasks_completed: 3 (Tasks 1-3 fully executed; Task 4 visual UAT handed off to user)
  files_created: 0
  files_modified: 4
  bundle_js_kb: 1788.15
---

# Phase 13 Plan 03: Tier 2 Indicators (TUJUAN) Summary

**One-liner:** Replace Wave 1 stubs dengan real compute logic untuk DIAG-05 (Goals on-track long-term + linear progress + smart fallback CTA) + DIAG-06 (Pensiun proyeksi reuse 6 calc helpers + smart fallback + stale 6+ bulan notice + formula deviation locked) + Tier2Panel wrapper rendering 2 IndikatorCard + 2 CTA + 1 modul link — Goal interface extended dengan created_at additive (backward compat preserved via cascade fix di queries/goals.ts).

## What Shipped

### 1. Goal Interface Extension (Task 1 — `src/db/goals.ts`)

- **Goal interface** tambah field `created_at: string` (required, NOT NULL DEFAULT now() di DB sejak migration 0001).
- **listGoals SELECT** + **getGoal SELECT** include `created_at` ke select clause.
- JSDoc dokumentasi added untuk jelaskan rationale (Phase 13 DIAG-05 total_duration calculation).
- **Backward compat verified:** existing consumers (GoalsTab.tsx, DashboardTab.tsx, RencanaBar.tsx, useGoals/useGoalsWithProgress hooks) hanya destructure existing fields — additional field tidak break.
- **No schema migration needed** — column sudah exist sejak migration 0001.

### 2. Tier 2 Compute Logic (Task 2 — `src/queries/kesehatanTier2.ts`)

Replaced Wave 1 stub (24 lines, both returning hardcoded cta-fallback) dengan real implementation (252 lines, 2 compute functions + 1 helper).

**Two compute functions + 1 helper:**

| Function | Spec ID | Formula | Threshold | Smart Fallback |
|----------|---------|---------|-----------|----------------|
| `computeGoalsOnTrack` | DIAG-05 | onTrack count / longTerm count × 100% (linear progress: current/target ≥ time_elapsed/total_duration) | ≥75% hijau · 50-74% kuning · <50% merah | longTerm.length === 0 → cta-fallback "Belum punya tujuan jangka panjang" → /goals |
| `computePensiun` | DIAG-06 | totalLumpSum / (target_bulanan × 12 × max(LIFE_EXPECTANCY − usia_pensiun, 1)) × 100% | ≥100% hijau · 70-99% kuning · <70% merah | sim === null → cta-fallback "Belum simulasi pensiun" → /pensiun; totalLumpSum === 0 → cta-fallback "Simulasi pensiun belum punya source aktif" → /pensiun |
| `computeProjectionTotal` (private) | (helper) | SUM 6 sources matching HitungTotalPanel.tsx pattern | (no threshold — pure SUM) | (no fallback — caller checks 0) |

**Long-term filter (DIAG-05):** `g.status === 'active' && g.target_date !== null && new Date(g.target_date) > new Date(now + 1 year)`.

**Linear progress check:**
- `start = g.created_at ? new Date(g.created_at) : new Date(now.getFullYear(), 0, 1)` (fallback 1 Jan tahun ini)
- `totalMs = end - start`; if `totalMs <= 0` → treat as on-track (data invalid edge case)
- `timeElapsedFrac = min(1, max(0, now - start) / totalMs)`
- `progressFrac = target_amount > 0 ? current/target : 0`
- on-track = `progressFrac >= timeElapsedFrac`

**Stale check (DIAG-06):**
- `monthsStale = (Date.now() - updatedAt) / (1000 * 60 * 60 * 24 * 30)`
- `isStale = monthsStale > STALE_THRESHOLD_MONTHS` (6)
- spread `...(isStale && { staleMonths: Math.floor(monthsStale) })` ke compute variant

**Edge case guards:**
- `usia_pensiun ≥ LIFE_EXPECTANCY_YEARS` → `yearsRemaining = Math.max(75 - usia_pensiun, 1)` (prevent divide-by-zero, render compute green for rare case)
- `target_bulanan ≤ 0` → render compute red dengan display `— (set target bulanan)` + staleMonths preserved
- `target_amount = 0` di Goal → progressFrac = 0, off-track (tidak crash)

### 3. Pension Source Compute Coverage

Per W5 advisory dari plan, explicit per-source compute outcome:

| Source | ht_en_* gate | Compute | Field signature match | Notes |
|--------|--------------|---------|----------------------|-------|
| BPJS | `ht_en_bpjs` | SUCCESS — `calcBPJS({ upahBulanan, masaKerja })` returns `{ jht, jpBulanan }`; total += jht + jpBulanan × 12 × 20 | ✓ Direct match (HitungTotalPanel pattern) | `upahBulanan = ht_bpjs_upah \|\| gaji_pokok \|\| 0` |
| DPPK | `ht_en_dppk` | SUCCESS — `calcDPPK({ type, phdp, faktor, iuranBulanan, masaKerja })` returns `{ total }` | ✓ Direct match | type fallback `'ppmp'` if missing |
| DPLK | `ht_en_dplk` | SUCCESS — `calcDPLK({ iuranBulanan, returnPct, saldoAwal, masaKerja })` returns `{ total }` | ✓ Direct match | All fields present in PensionSimRow (no nullable) |
| Taspen | `ht_en_taspen` | SUCCESS — `calcTaspen({ gajiTerakhir, golongan, masaKerja })` returns `{ bulanan, tht }`; total += tht + bulanan × 12 × 20 | ✓ Direct match | `gajiTerakhir = ht_taspen_gaji \|\| gaji_pokok \|\| 0`; golongan fallback `'IIIa'` |
| Pesangon | `ht_en_pesangon` | SUCCESS — `calcPesangon(gajiPokok, masaKerja)` (POSITIONAL ARGS not object!) returns `{ total }` | ✓ Verified — adjusted from plan skeleton (object form) ke positional form | gajiPokok = `sim.gaji_pokok \|\| 0` |
| Investasi Mandiri | `ht_en_invest` | SUCCESS — `calcInvestasiMandiri({ iuranBulanan, returnPct, saldoAwal, kenaikanPct, masaKerja })` returns `{ total }` | ✓ Direct match | All 5 input fields in PensionSimRow |

**ALL 6 sources SUCCESS** — no fallback paths, no Record<string, unknown> blind cast needed (plan skeleton was overly defensive). PensionSimRow di src/db/pensiun.ts has all fields typed direct (no nullable boolean/number), so simple truthy gate `if (sim.ht_en_*)` works.

**Pragmatic fallback path NOT taken** — plan offered minimal BPJS+Invest only fallback if signatures mismatch, but verification showed all 6 signatures match exactly. Full coverage delivered.

### 4. Tier2Panel Real Wrapper (Task 3 — `src/tabs/kesehatan/Tier2Panel.tsx`)

Replaced Wave 1 stub body (placeholderText only) dengan TierPanel wrapper consuming `IndikatorMap`. Props signature unchanged.

**Configuration passed to TierPanel:**

- `tierId={2}`
- `indicators` array (2 entries):
  - Goals Long-term on-track — hint "≥ 75% on-track hijau · 50-74% kuning · < 50% merah" → indicators['5']
  - Kesiapan Pensiun — hint "≥ 100% target hijau · 70-99% kuning · < 70% merah" → indicators['6']
- `ctas` array:
  - { label: 'Kelola Goals', to: '/goals', variant: 'default' }
  - { label: 'Simulasi pensiun', to: '/pensiun', variant: 'outline' }
- `modulLinks`:
  - { label: 'Tujuan & Risiko', slug: 'tujuan' } → /kesehatan/tujuan

**File ownership preserved:** `KesehatanLanding.tsx` zero diff verified (`git diff --stat src/tabs/kesehatan/KesehatanLanding.tsx` empty post-task-3).

### 5. Visual UAT (Task 4 — handed off to user)

Task 4 adalah `checkpoint:human-verify` — Steps 1-9 (Tier 2 trapezoid color, DIAG-05 scenarios A/B/C, DIAG-06 scenarios A/B/C, threshold hint, CTA navigation, View-As compatibility, edge cases, mobile responsive, build success) documented in 13-03-PLAN.md `<action>`. Build automation prerequisite already satisfied:

- `npx tsc --noEmit` → zero errors
- `npm run build` → success in ~2.0s
- Bundle main JS: 1788.15 kB (delta +5.37 kB vs Plan 13-02 baseline 1785.70 kB; well within <15 kB tolerance)

User to run `npm run dev` + visual checks per Plan steps. UAT outcomes feed into Phase 13 closure verification by verifier agent.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✓ Zero errors |
| `npm run build` | ✓ Success (~2.0s) |
| Bundle main JS | 1788.15 kB (+5.37 kB vs Plan 13-02; +5.37 kB total Phase 13 Wave 2 delta vs 13-01 baseline) |
| `function computeGoalsOnTrack` exported | ✓ Present |
| `function computePensiun` exported | ✓ Present |
| `longTerm.length === 0` smart fallback | ✓ Present |
| `Belum punya tujuan jangka panjang` message | ✓ Present |
| `Belum simulasi pensiun` message | ✓ Present |
| `LIFE_EXPECTANCY_YEARS` import | ✓ Present |
| `staleMonths` field set | ✓ Present (2 sites: target_total≤0 path + main return) |
| `calcInvestasiMandiri` reuse | ✓ Present |
| `created_at` field di Goal interface | ✓ Present |
| `created_at` di listGoals SELECT | ✓ Present |
| Tier2Panel grep `Tujuan & Risiko` | ✓ Present |
| Tier2Panel grep `/goals` + `/pensiun` + `tujuan` | ✓ All present |
| Tier2Panel "STUB Wave 1" removed | ✓ Confirmed (grep returns no match) |
| KesehatanLanding.tsx unchanged | ✓ `git diff --stat` empty |
| `computeProjectionTotal` reuse HitungTotalPanel pattern | ✓ All 6 sources match |

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `5ff42c3` | feat(13-03): extend Goal interface + listGoals SELECT include created_at |
| 2 | `146314e` | feat(13-03): implement Tier 2 compute logic (DIAG-05 Goals on-track + DIAG-06 Pensiun) |
| 3 | `5ec2ef2` | feat(13-03): wire Tier2Panel real implementation (2 indikator + 2 CTA + modul link) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] queries/goals.ts cascade type error**

- **Found during:** Task 3 build verification (`npm run build` after Tier2Panel.tsx edit)
- **Issue:** `GoalWithProgress` di `src/queries/goals.ts` extends `Goal`. Setelah Task 1 add `created_at: string` ke Goal interface, `useGoalsWithProgress` query SELECT (`from goals_with_progress VIEW`) tidak include `created_at` (VIEW migration 0023 tidak expose). TS error TS2352 "Property 'created_at' is missing". Cascade ke 5 type errors di GoalsTab.tsx + DashboardTab.tsx (substitute GoalWithProgress untuk Goal).
- **Fix attempt 1:** `GoalWithProgress extends Omit<Goal, 'created_at'>` — broke 5 consumers di GoalsTab/DashboardTab yang substitute GoalWithProgress untuk Goal type.
- **Fix attempt 2 (taken):** Synthesize empty-string `created_at` di mapper hasil VIEW: `(data ?? []).map(row => ({ ...row, created_at: '' }))`. JSDoc dokumentasi strategi untuk Phase berikutnya — kalau butuh real value → migration 00XX_goals_with_progress_v2.sql include `g.created_at` ke SELECT + GROUP BY.
- **Files modified:** `src/queries/goals.ts` (1 type doc + 1 mapper line)
- **Commit:** `5ec2ef2` (combined dengan Task 3)
- **Rationale:** consumers GoalWithProgress (GoalsTab, DashboardTab) hanya destructure existing fields (id, name, target_amount, etc.) — empty-string created_at tidak diobservasi. computeGoalsOnTrack (DIAG-05) pakai `useGoals()` direct table query, bukan `useGoalsWithProgress()`. Acceptable workaround tanpa schema migration.

### Non-deviation: Plan Skeleton Improvement

**Plan offered Record<string, unknown> blind cast pattern (line 553) untuk computeProjectionTotal field signatures** — verification langsung di src/db/pensiun.ts + src/lib/pensiun-calc.ts confirmed semua 6 field signatures match exactly. PensionSimRow has all fields typed direct (no nullable boolean/number). Implementation USES TYPE-SAFE direct field access (e.g., `sim.ht_dplk_iuran || 0`) instead of `(sim as Record<string, unknown>).ht_dplk_iuran as number`. Cleaner, no defensive type erasure.

**Adjustment from plan skeleton:** `calcPesangon(gajiPokok, masaKerja)` is POSITIONAL args (not object form `{ gajiPokok, masaKerja }`). Plan skeleton wrote object form — verified actual signature in pensiun-calc.ts line 230: `export function calcPesangon(gajiPokok: number, masaKerja: number)`. Implementation uses correct positional form.

## Threat Flags

None — all threats from plan threat register satisfied:

- T-13-13 (created_at fallback): JSDoc documented, fallback ke 1 Jan tahun ini di compute body
- T-13-14 (created_at expose): not sensitive (own user timestamp), RLS unchanged
- T-13-15 (field signature mismatch): verified all 6 signatures match — no fallback path needed
- T-13-16 (View-As pension_simulations RLS leak): graceful cta-fallback (no crash) — documented untuk Phase 14 backlog
- T-13-17 (LIFE_EXPECTANCY hardcode): konstanta exported di Plan 13-01, gampang adjust pasca-rilis
- T-13-17b (formula deviation): code comment block + plan-checker iteration 2 sign-off + edge case guard Math.max(yearsRemaining, 1)
- T-13-18 (stale notice false positive): RESEARCH.md pitfall #6 acceptable (rare admin SQL edge)

## Hand-off Notes

### For Wave 2 Plan 13-04 (Tier 3 Indicators)

Plan 13-03 owns `kesehatanTier2.ts` + `Tier2Panel.tsx` exclusively. Plan 13-04 (Tier 3 indicators DIAG-07/08) targets separate files (`kesehatanTier3.ts`/`Tier3Panel.tsx`) per file-ownership matrix locked in Plan 13-01 SUMMARY. **Zero file conflict** dengan 13-02 dan 13-03.

**Pattern established for Tier3Panel:** Wrap `<TierPanel tierId={3} indicators={[...]} ctas={[...]} modulLinks={[...]} />`. Props shape `{ indicators: IndikatorMap }` (Tier 3 tidak butuh `darTotalInfo` atau `infoSlot`).

### For Phase 14 (DIAG-12 View-As read-only forms)

- **pension_simulations RLS policy** currently `auth.uid() = user_id` (no `OR is_admin()` clause). Admin View-As ke user lain → `usePensionSim()` returns null → DIAG-06 cta-fallback "Belum simulasi pensiun".
- **Acceptable v1.2** per CONTEXT.md (informative, no crash). Phase 14 candidate fix:
  - Option A: Patch migration `00XX_pension_simulations_rls_admin.sql` adding `OR is_admin()` ke USING clause (read-only) — pattern parity dengan goals/transactions/etc.
  - Option B: Accept current state, document di v1.3 backlog.
- **Goal type extension** (Plan 13-03 Task 1) — Phase 14 mutation forms (DIAG-04 Tier 1 inline checklist + DIAG-09 Tier 4 smart-gated) tidak affected (mutation pakai GoalInput, bukan Goal). created_at field assigned by DB DEFAULT.

### For Migration Backlog

**Migration 00XX_goals_with_progress_v2.sql** (LOW priority, deferred):
- Extend `goals_with_progress` VIEW SELECT untuk include `g.created_at` di SELECT clause + GROUP BY g.id, g.created_at.
- Allow GoalWithProgress consumers (GoalsTab/DashboardTab) untuk akses real created_at (e.g., sort by creation date).
- Phase 13 cascade fix (synthesize empty-string) acceptable interim.

### For User UAT (Task 4 handoff)

Run UAT steps from Plan 13-03 Task 4 `<action>`:
- **Test 1:** Tier 2 trapezoid aggregate color
- **Test 2:** DIAG-05 scenarios A (no long-term goal → cta-fallback), B (1 goal long-term active on-track → green), C (smart fallback transition saat hapus goal)
- **Test 3:** DIAG-06 scenarios A (no pension_simulations row), B (sim aktif dengan ht_en_invest → compute ratio %), C (stale notice 6+ bulan → badge "Stale Xbln")
- **Test 4:** Threshold hint visible ("≥ 75% on-track hijau · 50-74% kuning · < 50% merah", "≥ 100% target hijau · 70-99% kuning · < 70% merah")
- **Test 5:** CTA navigate (Kelola Goals → /goals, Simulasi pensiun → /pensiun, Pelajari: Tujuan & Risiko → /kesehatan/tujuan)
- **Test 6:** View-As compatibility (admin View-As → DIAG-06 cta-fallback "Belum simulasi pensiun" expected karena RLS leak)
- **Test 7:** Edge cases (target_date null exclude, status paused exclude, target_amount=0, target_bulanan=0, no source enabled)
- **Test 8:** Mobile responsive ≤640px (2 IndikatorCard stacked + 2 CTA + 1 modul link)
- **Test 9:** Build success + bundle delta (already verified — 1788.15 kB)

Issues to flag: smart fallback bypass, stale notice missing, created_at fallback bocor, pensiun ratio terlalu tinggi/rendah (LIFE_EXPECTANCY assumption), DPPK/DPLK/Taspen field signature mismatch (verified at compile time, not runtime — flag if data shape differs).

## Self-Check: PASSED

**Files verified:**
- ✓ `src/db/goals.ts` (modified, Goal interface + listGoals + getGoal SELECT include created_at, 116 lines)
- ✓ `src/queries/kesehatanTier2.ts` (modified, 252 lines — replaces 24-line Wave 1 stub)
- ✓ `src/tabs/kesehatan/Tier2Panel.tsx` (modified, 48 lines, 2 indikator config + 2 CTA + 1 modul link)
- ✓ `src/queries/goals.ts` (modified, GoalWithProgress JSDoc + synthesize created_at mapper)
- ✓ `src/tabs/kesehatan/KesehatanLanding.tsx` UNCHANGED (`git diff --stat` empty post-task-3)

**Commits verified:**
- ✓ `5ff42c3` (Task 1 — Goal extension)
- ✓ `146314e` (Task 2 — compute logic)
- ✓ `5ec2ef2` (Task 3 — Tier2Panel wrapper + Rule 3 cascade fix)
