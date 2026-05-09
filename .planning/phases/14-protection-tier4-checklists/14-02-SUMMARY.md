---
phase: 14-protection-tier4-checklists
plan: 02
subsystem: kesehatan-tier1-asuransi-form
tags: [tier1, inline-form, optimistic-mutation, view-as-guard, diag-04, diag-12, radio-group]
dependency_graph:
  requires:
    - "src/queries/protectionChecklist.ts (Plan 14-01) — useProtectionChecklist + useUpdateProtectionChecklist"
    - "src/components/ui/radio-group.tsx (Plan 14-01) — RadioGroup + RadioGroupItem primitives"
    - "src/db/protectionChecklist.ts (Plan 14-01) — ProtectionChecklistRow type"
    - "src/queries/kesehatanTypes.ts (Phase 13) — COLOR_BORDER_CLASS + COLOR_BADGE_CLASS"
    - "src/auth/useViewAs (existing alias) — viewingAs context"
  provides:
    - "src/tabs/kesehatan/AsuransiKesehatanForm.tsx — Tier 1 #4 inline 3-state form (A empty / B editing / C filled)"
    - "Tier1Panel inline View-As amber notice (DIAG-12 Tier 1 portion)"
  affects:
    - "src/tabs/kesehatan/Tier1Panel.tsx — drops indicator #4 from TierPanel array, wires AsuransiKesehatanForm as sibling"
tech_stack:
  added: []
  patterns:
    - "3-state machine via React useState (showEdit / isFilled flags + draft sentinel '')"
    - "Sibling-render pattern (Option A2) — keep IndikatorCard pure, render new form below TierPanel"
    - "View-As guard via conditional !isViewAs render + RadioGroupItem disabled (defense-in-depth)"
    - "Component-local STATE_C_BADGE_TEXT constant — no cross-module label coupling"
    - "Optimistic mutation consumed transparently — no onMutate/onError logic in component"
key_files:
  created:
    - "src/tabs/kesehatan/AsuransiKesehatanForm.tsx (196 lines)"
  modified:
    - "src/tabs/kesehatan/Tier1Panel.tsx (+31 / -39 net = -8 lines: drop indicator #4 entry, add View-As notice + AsuransiKesehatanForm sibling)"
decisions:
  - "STATE_C_BADGE_TEXT defined locally in AsuransiKesehatanForm (NOT imported from kesehatanTier1.ts) — each surface owns its own UI strings per architecture pattern. Acceptance criterion explicitly verifies HEALTH_COVERAGE_LABEL has 0 imports."
  - "Submit button rendered inside !isViewAs guard in State B (defense-in-depth) — even though State B is unreachable in View-As mode (no entry path from State A 'Pilih cover' or State C pencil, both hidden), Simpan button is also gated to prevent any DOM-injection write attempt."
  - "Tier1Panel reads protectionRow independently via useProtectionChecklist() — does NOT add new props. KesehatanLanding signature { indicators, darTotalInfo } preserved (Phase 13 plan 13-01 ownership respected)."
  - "Indicator #4 entry physically removed from TierPanel indicators array — but TIER_INDICATORS map (Phase 13) untouched, so Tier 1 aggregate color in piramida still consumes indicators['4'] from useIndikator → form mutation flips Tier 1 piramida color via existing wiring."
  - "Draft state initialized from current via useState initializer (current ?? '') — re-derived in handleEditClick on every edit-button click rather than via useEffect (avoids stale-closure footgun per plan instruction)."
metrics:
  started: "2026-05-09T15:08:00Z"
  completed: "2026-05-09T15:18:00Z"
  duration_minutes: 10
  tasks_completed: 2
  uat_pending: true
  files_created: 1
  files_modified: 1
  commits: 2
  loc_added: 226
  loc_removed: 39
---

# Phase 14 Plan 02: Tier 1 #4 Asuransi Kesehatan Inline Form Summary

DIAG-04 Tier 1 #4 inline form (3-state machine: empty/editing/filled) shipped as new sibling component below TierPanel. DIAG-12 Tier 1 portion shipped as inline amber View-As notice at top of panel. Optimistic mutation consumed transparently from Plan 14-01 — no local mutation logic. Manual UAT (Task 3) deferred to user post-merge.

## What Shipped

### New file: `src/tabs/kesehatan/AsuransiKesehatanForm.tsx` (196 lines)

3-state machine inline form:

| State | Trigger | UI |
|-------|---------|-----|
| A. empty | row null OR health_coverage NULL | red border-l-4 + "Asuransi Kesehatan" label + threshold hint + "Belum diisi" red badge + "Pilih cover →" outline button (hidden in View-As) |
| B. editing | click "Pilih cover" (State A) OR pencil (State C) | red/green border (kept) + "Kesehatan kamu (& keluarga) tercover?" label + 5 vertical radio options + [Batal | Simpan] buttons |
| C. filled | row.health_coverage non-null | green (or red if 'tidak') border-l-4 + label + threshold hint + colored badge with mapped text + ghost pencil button (hidden in View-As) |

**Key implementation choices:**

- **Component-local `STATE_C_BADGE_TEXT`** map — `kantor → Kantor`, `bpjs → BPJS`, `pribadi → Pribadi`, `kombinasi → Kombinasi`, `tidak → Tidak covered`. NOT imported from `kesehatanTier1.ts` — confirmed via grep `HEALTH_COVERAGE_LABEL` returns 0 import lines (only appears in comment doc string).
- **5 radio options** as `ReadonlyArray` literal — typed via `NonNullable<ProtectionChecklistRow['health_coverage']>` so radio values are narrowed to enum union; non-enum values are unrepresentable at compile time (T-14-02-01 mitigation).
- **Optimistic mutation** delegated entirely to `useUpdateProtectionChecklist` — component just calls `mutation.mutate({ health_coverage: draft })` and uses `onSuccess: () => setEditing(false)` to exit edit mode after flip. No local toast.success / toast.error (would double-fire).
- **View-As guard** appears 3 times via `!isViewAs && (...)`:
  1. State A "Pilih cover →" button (line 186)
  2. State C pencil edit button (line 152)
  3. State B Simpan button (line 119) — defensive even though State B is unreachable in View-As
- **Draft state derivation** via `setDraft(current ?? '')` inside `handleEditClick` — no useEffect (avoids stale-closure footgun per plan).
- **Outer shell** mirrors IndikatorCard exactly: `rounded-lg border border-l-4 bg-card p-3` with `space-y-2` for State B internal layout.

### Modified file: `src/tabs/kesehatan/Tier1Panel.tsx`

Net: +31 / -39 lines.

Changes:

1. **Imports added** (4 new): `Eye` from lucide-react, `useViewAs` from `@/auth/useViewAs`, `useProtectionChecklist` from `@/queries/protectionChecklist`, `AsuransiKesehatanForm` (default).
2. **Component body extended** (3 new lines above existing infoSlot derivation): `const { viewingAs } = useViewAs()`, `const isViewAs = viewingAs !== null`, `const { data: protectionRow } = useProtectionChecklist()`.
3. **Return wrapped in Fragment** (`<> ... </>`) replacing single `<TierPanel ... />` return.
4. **Inline View-As notice** rendered conditionally (`isViewAs && (...)`) at top with amber palette tokens `bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200`, copy "Mode View-As — kamu hanya bisa lihat, tidak bisa simpan.", `role="status" aria-live="polite"`, mx-4 mt-4 panel-aware spacing.
5. **Indicator #4 dropped** from TierPanel `indicators` prop array — array now has 3 entries (Dana Darurat, Savings Rate, DAR Konsumtif). Comment trace explains slot #4 moved to sibling form.
6. **`<AsuransiKesehatanForm row={protectionRow ?? null} />`** rendered as sibling below TierPanel inside `<div className="px-4 pb-4">`.
7. **JSDoc updated** to acknowledge Phase 14 changes (DIAG-04 + DIAG-12).

**Props signature `{ indicators, darTotalInfo }` preserved** — no cascade change to KesehatanLanding (Phase 13 plan 13-01 ownership respected).

## Tier Color Aggregation Regression Analysis

`TIER_INDICATORS[1]` map (Phase 13 in `kesehatanIndikator.ts`) is **untouched** — Tier 1 aggregate still consumes `indicators['4']` from `useIndikator → computeAsuransiShell(protectionRow)`. So:

- Tier 1 piramida color flip on form submission STILL works via Phase 13 wiring.
- The visible representation of #4 just relocates: from `IndikatorCard.compute` (inside TierPanel) → `AsuransiKesehatanForm` (sibling below).
- Optimistic mutation flips `protectionRow` cache → useMemo recomputes → indicators['4'] flips → deriveTierColors reaggregates → tierColors prop change → piramida cell color flip.

## Acceptance Criteria Verification

### Task 1 (AsuransiKesehatanForm)

| Criterion | Result |
|-----------|--------|
| File exists | ✓ |
| `export default function AsuransiKesehatanForm` | 1 ✓ |
| `useUpdateProtectionChecklist` import from `@/queries/protectionChecklist` | 1 ✓ |
| `useViewAs` import from `@/auth/useViewAs` | 1 ✓ |
| `RadioGroup, RadioGroupItem` import from `@/components/ui/radio-group` | 1 ✓ |
| `COLOR_BADGE_CLASS, COLOR_BORDER_CLASS` import from `@/queries/kesehatanTypes` | 1 ✓ |
| `STATE_C_BADGE_TEXT: Record<HealthCoverage, string>` defined locally | 1 ✓ |
| `HEALTH_COVERAGE_LABEL` import (must be 0) | 0 ✓ (only in comment) |
| All 5 enum values `value: '(kantor\|bpjs\|pribadi\|kombinasi\|tidak)'` | 5 ✓ |
| Bahasa Indonesia copy strings present | All ✓ ("Belum diisi", "Pilih cover", "Kesehatan kamu (& keluarga) tercover", "Tidak covered", "Kantor (asuransi grup)", "Kombinasi (kantor + pribadi)") |
| `!isViewAs &&` conditional renders | 3 ✓ (≥2 required) |
| `COLOR_BORDER_CLASS.red` reference | 1 ✓ (State A explicit) |
| Card outer shell `rounded-lg border border-l-4 bg-card p-3` | 3 ✓ (one per state branch) |
| `toast.success` / `toast.error` (must be 0 active calls) | 0 ✓ (only in comment) |
| `mutation.mutate(` invocation | 1 ✓ |

### Task 2 (Tier1Panel)

| Criterion | Result |
|-----------|--------|
| `export default function Tier1Panel` preserved | 1 ✓ |
| `useViewAs` import | 1 ✓ |
| `useProtectionChecklist` import | 1 ✓ |
| `AsuransiKesehatanForm` default import | 1 ✓ |
| `Eye` from lucide-react | 1 ✓ |
| `const isViewAs = viewingAs !== null` | 1 ✓ |
| Inline notice copy "Mode View-As — kamu hanya bisa lihat, tidak bisa simpan." | 1 ✓ |
| `bg-amber-50.*dark:bg-amber-950` | 1 ✓ |
| `role="status"` AND `aria-live="polite"` | 1 / 1 ✓ |
| `<AsuransiKesehatanForm` rendered | 1 ✓ |
| `result: indicators['4']` removed | 0 ✓ |
| `result: indicators['(1\|2\|3)']` retained | 3 ✓ |
| `modulLinks=[{ label: 'Pondasi & Cash Flow', slug: 'arus-kas' }]` preserved | 1 ✓ |

`tsc --noEmit -p .` not runnable in worktree (no `node_modules` in parallel-executor environment) — orchestrator should run full TS + build verification post-merge as in Plan 14-01.

## Threat Model Compliance

| Threat ID | Disposition | Implementation Evidence |
|-----------|-------------|--------------------------|
| T-14-02-01 (Tampering — radio value forge) | mitigate | `HealthCoverage = NonNullable<ProtectionChecklistRow['health_coverage']>` literal-string union narrows draft. RadioGroup options are typed array — non-enum unrepresentable. mutationFn (Plan 14-01) defers to DB CHECK. |
| T-14-02-02 (Information Disclosure — View-As bypass) | mitigate | `isViewAs && (...)` hides "Pilih cover" + pencil. RadioGroupItem `disabled={isViewAs}` + Submit `!isViewAs &&` gate as defense-in-depth even when reached via DevTools. mutationFn throws if `viewingAs !== null` (Plan 14-01 defensive guard). |
| T-14-02-03 (Spoofing — admin write to viewed user) | mitigate | mutationFn (Plan 14-01) takes only Patch (no user_id). uid derived from `useTargetUserId()` inside hook. View-As guard throws before supabase. RLS WITH CHECK as third defense. |
| T-14-02-04 (DoS — rapid Simpan clicks) | mitigate | `Button disabled={!draft \|\| mutation.isPending}` — Simpan disabled while mutation pending. Optimistic update prevents user motivation to spam-click. Server upsert idempotent. |

## Manual UAT (Task 3) — Pending User Execution Post-Merge

Manual UAT was NOT executed in this worktree. The plan defines `<task type="checkpoint:human-verify">` for Task 3 — the parallel-executor harness defers UAT to user-driven verification after wave merge per orchestrator protocol.

### UAT Pre-Condition

User must run BEFORE opening dev server:

```sql
-- supabase/scripts/reset-protection-checklist.sql (Plan 14-01 Task 3)
-- Run via Supabase Studio SQL Editor → paste → Run
-- Resets WHERE user_id = auth.uid() (cannot accidentally clobber another user)
```

Verify final SELECT shows 8 NULL business columns OR 0 rows.

### 8 UAT Verification Points

1. **State A render** — `/kesehatan` → expand Tier 1 → 4th card below 3 IndikatorCards: red border-l-4 + label "Asuransi Kesehatan" + threshold hint + red badge "Belum diisi" + "Pilih cover →" button.
2. **State A → State B transition** — click "Pilih cover →" → card swaps to question + 5 vertical radios + [Batal | Simpan] (Simpan disabled until radio selected).
3. **State B → State C success** — select "Kombinasi (kantor + pribadi)" → Simpan enables → click Simpan → IMMEDIATELY (<50ms optimistic): green border + green "Kombinasi" badge + pencil + sonner toast "Tersimpan". Tier 1 piramida color reflects new aggregate.
4. **State C → State B → success (edit)** — click pencil → State B with "Kombinasi" pre-selected → change to "Tidak / belum tahu" → Simpan → red border + red "Tidak covered" badge + toast "Tersimpan".
5. **Cancel flow** — pencil → Batal → revert to State C (no mutation, DB unchanged).
6. **Network failure rollback** — DevTools Offline → Simpan with "BPJS" → optimistic flip → mutation fails → rollback to previous State C ("Tidak covered" red) + sonner error toast.
7. **View-As guard (DIAG-12)** — admin View-As another user → expand Tier 1 → amber notice at top with eye icon "Mode View-As — kamu hanya bisa lihat, tidak bisa simpan.". State A renders WITHOUT "Pilih cover" button. State C renders WITHOUT pencil. State B unreachable. Existing global ViewAsBanner at AppShell top still visible (no regression).
8. **Console clean** — zero warnings/errors during all flows. No "key" warnings on radios. No double-toast.

UAT outcomes will be recorded by orchestrator post-merge based on user response (approved / blocking issues with screenshots).

## Deviations from Plan

None — plan executed exactly as written. No Rule 1 / Rule 2 / Rule 3 / Rule 4 triggers encountered.

## Out of Scope (Plan 14-03 delivers)

- Tier 4 form (gate question + life coverage + estate sections) — Plan 14-03
- `kesehatanTier4.ts` compute module — Plan 14-03
- `deriveTierColors` signature change to accept `protectionRow` — Plan 14-03 (Tier 1 aggregate already works via existing `indicators['4']` consumption)
- KesehatanLanding modifications — none required (Tier1Panel signature unchanged)

## Self-Check: PASSED

- File `src/tabs/kesehatan/AsuransiKesehatanForm.tsx` exists ✓
- File `src/tabs/kesehatan/Tier1Panel.tsx` modified ✓
- Commit `86c9068` (Task 1 AsuransiKesehatanForm) found in git log ✓
- Commit `615e808` (Task 2 Tier1Panel wiring) found in git log ✓
- No file under `supabase/migrations/` created ✓ (verified via `git diff --name-only base..HEAD`)
- `KesehatanLanding.tsx` not modified ✓ (verified via diff name-only filter)
- `STATE.md` / `ROADMAP.md` not modified ✓ (verified via diff name-only filter)
- `git status --short` clean before SUMMARY commit ✓
- `HEALTH_COVERAGE_LABEL` not imported (single-source-of-truth confirmed) ✓
- Wave 1 artifacts (`src/queries/protectionChecklist.ts`, `radio-group.tsx`, `kesehatanTypes.ts`) imported correctly ✓
