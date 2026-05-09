# Phase 14: Protection & Tier 4 Checklists — Research

**Researched:** 2026-05-09
**Domain:** React form mutations + optimistic updates + View-As read-only enforcement on top of shipped Phase 12 schema + Phase 13 tier panel infra
**Confidence:** HIGH

## Summary

Phase 14 menambahkan dua mutation surface ke `/kesehatan` di atas infrastruktur yang sudah lengkap dari Phase 12 (table `protection_checklist` + RLS) dan Phase 13 (Accordion + IndikatorCard + TierPanel + `useIndikator` + `useProtectionChecklist`). Semua locked decisions sudah ada di CONTEXT.md (lima keputusan A-F). Phase 14 tidak butuh schema change, tidak butuh dependency baru, dan tidak butuh Context7/web research — semua patterns yang dibutuhkan sudah established di codebase: optimistic mutation (`useMarkBillPaid`), upsert lazy-create (`upsertPensionSim`), View-As `isViewAs` guard (`InvestmentsTab` / `TransactionsTab`), shadcn radix-ui umbrella component idiom (`select.tsx`, `accordion.tsx`).

Dua hal yang BELUM ada di codebase: (1) komponen shadcn `RadioGroup` — `radix-ui` umbrella sudah expose `RadioGroup` primitive (verified via `node -e require`), tinggal tambah satu file `src/components/ui/radio-group.tsx` mengikuti pola `select.tsx` / `checkbox.tsx`. (2) `src/db/protectionChecklist.ts` data layer — Phase 13 hanya inline read di `kesehatanIndikator.ts` `useProtectionChecklist`. Phase 14 perlu promote ke db layer untuk co-locate read + upsert.

**Primary recommendation:** Buat 1 wave dengan 3 plans paralel (DIAG-04 Tier 1 form + DIAG-09 Tier 4 checklist + foundations radio-group component & db layer). Tier 4 aggregation update di plan terpisah atau gabung dengan DIAG-09. Jangan introduce `react-hook-form` — overkill untuk 1-question form (Tier 1) dan 7-question form (Tier 4) yang stateless; pakai `useState` + native onChange seperti pattern existing di codebase.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. Tier 1 #4 form layout: Inline replace IndikatorCard**

Klik IndikatorCard #4 (saat variant `cta-fallback` "Belum diisi") → card flip jadi form radio inline (5 opsi sesuai schema enum). Submit → card flip kembali ke `compute` variant warna sesuai jawaban. Zero modal/drawer.

UX flow:
1. Empty state (no row OR `health_coverage IS NULL`): card render "Belum diisi" red badge + button "Pilih cover →"
2. User klik button → card body switch ke radio group 5 opsi + button "Simpan"
3. Submit → optimistic UI (card flip ke compute variant warna baru) + background mutation → sukses confirm (toast "Tersimpan") atau rollback + toast error
4. Compute state (row exists): card render value (e.g., "BPJS" green badge) + small button edit icon → klik → kembali ke radio mode dengan value pre-selected

Files:
- `src/tabs/kesehatan/IndikatorCard.tsx` — extend dengan variant baru `form-radio` atau wrap with internal state `isEditing`
- `src/tabs/kesehatan/Tier1Panel.tsx` — pass `onEditAsuransi` handler atau biarkan IndikatorCard self-contained

**B. Tier 4 form layout: Gate first → conditional sections inline**

Tier4Panel render single panel scroll dengan sections berurutan:
1. **Gate section** (top): "Punya tanggungan finansial (anak, pasangan, ortu)?" → 2 radio Ya/Tidak. Default unanswered.
2. **Asuransi Jiwa section** (conditional, render kalau `has_dependents = true`): 3 questions
   - `life_coverage` 4 opsi radio (kantor/pribadi/keduanya/tidak)
   - `life_coverage_sufficient` 2 radio (Ya/Tidak)
   - `life_coverage_post_employment` 3 radio (Ya/Tidak/Tidak yakin)
3. **Estate section** (universal, always render setelah gate dijawab): 3 questions, masing-masing 3 radio
   - `estate_heirs_documented` (Pewaris terdokumentasi)
   - `estate_assets_documented` (Aset terdokumentasi)
   - `estate_will_exists` (Wasiat sudah ada)

Files:
- `src/tabs/kesehatan/Tier4Panel.tsx` — replace placeholder body dengan checklist component
- New helper component (optional): `src/tabs/kesehatan/Tier4Checklist.tsx`

Trade-off accepted: Single scroll panel = panjang kalau has_dependents=true (3 estate + 3 asuransi jiwa). Mobile fine — accordion sudah expand inline below trapezoid. No nested accordion karena double-accordion confusing per UAT phase 13 feedback.

**C. Mutation pattern: Optimistic update via React Query**

Pakai existing React Query mutation pattern (sama dengan `useMarkBillPaid`):
- `useMutation({ mutationFn, onMutate, onSuccess, onError })`
- `onMutate`: snapshot prev, set optimistic value via `queryClient.setQueryData`
- `onError`: rollback ke snapshot + toast error
- `onSuccess`: invalidate `['kesehatan', 'protection-checklist', userId]` untuk refetch fresh state

Mutation function: Single upsert (PostgreSQL `INSERT ... ON CONFLICT (user_id) DO UPDATE`) — supabase-js syntax: `.upsert({ user_id, ...patch }, { onConflict: 'user_id' })`. Lazy create row di first interaction.

Indicator color update: Indikator hooks (`useIndikator()` dari Phase 13) consume `useProtectionChecklist()` query. Saat `setQueryData` flip jawaban → `useIndikator` recompute dengan data baru → IndikatorCard color flip langsung. Aggregation Tier color via `aggregateTierColor` (Phase 13) auto-update.

Files:
- `src/queries/protectionChecklist.ts` (NEW) — `useProtectionChecklist()` query + `useUpdateHealthCoverage()` + `useUpdateTier4()` mutations
- Reuse `src/queries/kesehatanTier1.ts` `computeAsuransiShell` (already reads `health_coverage`)

**D. Gate toggle behavior: Preserve answers, hide UI**

User toggle "Ya" → isi asuransi jiwa → balik ke "Tidak":
- DB: `has_dependents` UPDATE ke `false` only. `life_coverage`, `life_coverage_sufficient`, `life_coverage_post_employment` STAY (preserve).
- UI: Asuransi Jiwa section hidden saat `has_dependents=false`. Estate section tetap visible (universal).
- Aggregation: Tier 4 color compute SKIP life_coverage* fields kalau `has_dependents=false` — hanya estate counted.

Why: Non-destructive UX. Kalau user toggle "Ya" lagi, jawaban kembali. Schema sudah no-op (allow NULL on all fields). No confirm dialog friction.

**E. Estate input: 3-state radio per item**

Setiap dari 3 estate items: 3 radio inline `Ya / Tidak / Belum diisi`. Default `Belum diisi` (DB NULL). Match pattern `life_coverage_post_employment` enum (3-state).

Storage mapping:
- "Ya" → boolean `true`
- "Tidak" → boolean `false`
- "Belum diisi" → NULL (DB column nullable)

Aggregation:
- "Ya" = green untuk indicator
- "Tidak" = red untuk indicator
- NULL = treat sebagai "Tidak" untuk warna (red) ATAU sebagai "abu-abu" (TBD planner). Recommend RED biar push user fill.

**F. View-As mode: Form visible disabled + banner top**

Saat `viewingAs !== null` (admin View-As mode):
- Form input semua `disabled` prop = true (radio + textarea + button greyed)
- Banner kuning di atas Tier 1 panel & Tier 4 panel: "Mode View-As: read-only — kamu lihat data {viewedUserEmail}, tidak bisa modify"
  - Catatan: `ViewAsBanner` global sudah ditampilkan di `AppShell.tsx`. Phase 14 tetap perlu inline notice di panel agar konteks form jelas.
- Button "Simpan" hidden (atau disabled)
- Mutation function defensive guard: refuse kalau viewingAs aktif (defense-in-depth selain RLS `WITH CHECK auth.uid() = user_id`)

Files:
- `Tier1Panel.tsx` + `Tier4Panel.tsx` — read `useViewAs()` hook (existing pattern: `const { viewingAs } = useViewAs(); const isViewAs = viewingAs !== null`)
- Banner component bisa reuse existing toast/Alert pattern

Why: Konsisten dengan View-As pattern di /pensiun + /goals existing app. RLS sudah enforce di DB level (policy `WITH CHECK auth.uid() = user_id`), tapi UX defensive prevent admin click submit lalu confused.

### Claude's Discretion

(CONTEXT.md tidak mencantumkan section "Claude's Discretion" eksplisit — semua decisions sudah locked. Planner discretion area yang implicit:)

- Whether to introduce `Tier4Checklist.tsx` helper component vs all-in-one Tier4Panel — depends on Tier4Panel size after rewrite
- IndikatorCard variant approach: extend `IndikatorResult` union dengan kind `'form-radio'` vs wrap dengan internal isEditing state — both viable, planner pick
- File location for Tier 4 aggregation compute: extend `kesehatanIndikator.ts` `deriveTierColors` Tier 4 line vs new `kesehatanTier4.ts` — recommend new file untuk consistency dengan Tier 1/2/3 pattern
- DB layer split: keep ProtectionChecklistRow type in `kesehatanTier1.ts` (current Phase 13 export) vs migrate to new `src/db/protectionChecklist.ts` — recommend migrate untuk pattern parity dengan `pension_simulations`
- NULL estate aggregation rule (deferred ideas mention "Recommend RED biar push user fill") — planner final call

### Deferred Ideas (OUT OF SCOPE)

- **Tier 4 indicator: yellow boundary** — Spec §4 hanya mention green/red. Yellow case TBD (e.g., "estate 2/3 ya")? → Defer planner judgment, lean ke green/red binary per spec literal.
- **NULL estate aggregation** — saat user belum fill 3 estate, color bagaimana? Recommend treat NULL = red (push user fill). Planner final call.
- **Edit history audit trail** — `updated_at` exists tapi no per-field history. Defer v1.3+ kalau audit perlu.
- **Bulk fill UX** — "Belum punya tanggungan, semua skip" 1-click? Defer v1.3.
- **Glossary tooltip** untuk istilah "estate"/"wasiat"/"BPJS" — defer Phase 15 (DIAG/STRAT module tooltips).
- **Dependents count input** — schema cuma boolean, tidak count. Defer v1.3.

### Out of Phase Boundary (route ke roadmap backlog kalau muncul)
- Tier 4 sebagai data-driven diagnostic (saat ini self-assessment) — already di PROJECT.md "Out of scope v1.2"
- Modul "Warisan & Estate Planning" konten — Phase 15 deliver modul edukasi
- IPS Builder, risk tolerance quiz — defer v1.3+
- Asset class normalization Tier 3 — already deferred v1.3
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIAG-04 | Tier 1 panel berisi inline checklist Asuransi Kesehatan (single question: kantor/BPJS/pribadi/kombinasi/tidak). Hijau kalau bukan "tidak", merah kalau "tidak". | `protection_checklist.health_coverage` enum sudah exist (migration 0029). `computeAsuransiShell` di `kesehatanTier1.ts:262-289` sudah handle 3 cases (null/tidak/covered). Phase 14 cuma tambah mutation: upsert `{ user_id, health_coverage }` + invalidate query key `['kesehatan', 'protection-checklist', uid]`. RadioGroup primitive tersedia di radix-ui umbrella. |
| DIAG-09 | Tier 4 panel berisi smart-gated checklist — gate question "punya tanggungan?" → kalau Tidak: 3 estate basic; kalau Ya: 3 estate + 3 asuransi jiwa. | 7 kolom sudah exist di table (has_dependents BOOLEAN; life_coverage TEXT enum; life_coverage_sufficient BOOLEAN; life_coverage_post_employment TEXT enum 3-state; 3 estate_* BOOLEAN). Tier4Panel placeholder di Phase 13 tinggal di-replace. `aggregateTierColor` & `deriveTierColors` di `kesehatanIndikator.ts:165-199` sudah accept Tier 4 list — tinggal compute IndikatorResult[] untuk Tier 4 saat data tersedia. |
| DIAG-12 | View-As mode → semua indikator pakai data viewed-user; inline form Tier 1 #4 dan Tier 4 checklist switch ke read-only mode (admin tidak boleh modify data user lain). | `useTargetUserId()` sudah View-As-aware (Phase 13 reads pakai ini). `useViewAs()` alias dari `useViewAsContext` exposes `viewingAs` — pattern di `InvestmentsTab.tsx:30-31` (`const isViewAs = viewingAs !== null`) + `disabled={isViewAs}` di Button. `RLS WITH CHECK auth.uid() = user_id` di migration 0029 sudah enforce DB-level — admin akan dapat 42501 kalau mencoba submit, sehingga mutation defensive guard di JS = double-defense (UX) bukan security. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Form state (selected radio value, isEditing flag) | Browser / Client | — | Per-component ephemeral state; tidak perlu cache di React Query, tidak perlu route URL |
| Persist `health_coverage` / `has_dependents` / `life_*` / `estate_*` | API / Backend (Supabase PostgREST) | Database (RLS) | DB layer enforces ownership via RLS `WITH CHECK auth.uid() = user_id`; client just fires upsert |
| Optimistic UI cache (instant color flip post-submit) | Browser / Client (React Query cache) | — | `qc.setQueryData(['kesehatan', 'protection-checklist', uid], optimisticPatch)` pattern from Phase 13 + `useMarkBillPaid` |
| View-As gating (disable submit when `viewingAs !== null`) | Browser / Client | API/RLS (defense-in-depth) | Client UX guard primary; RLS 42501 reject as fallback |
| Indikator color derivation post-mutation | Browser / Client (`useIndikator` useMemo) | — | Phase 13 already wired auto-recompute when `useProtectionChecklist` query data updates |
| Tier 4 color aggregation (gate-conditional) | Browser / Client | — | New compute function needed (`computeTier4Indicators` or extend `deriveTierColors[4]`); pure function, lives alongside Phase 13 compute family |

## Standard Stack

### Core (already installed, verified `package.json`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5.99.1 | Mutation + cache invalidation + optimistic update | [VERIFIED: package.json] Pattern proven across 9 query files; `useMarkBillPaid` is the canonical optimistic reference |
| `@supabase/supabase-js` | ^2.103.3 | `.upsert(payload, { onConflict: 'user_id' })` for lazy-create | [VERIFIED: package.json + src/db/pensiun.ts:92-100] Identical pattern at `upsertPensionSim` |
| `radix-ui` (umbrella) | ^1.4.3 | Provides `RadioGroup` primitive | [VERIFIED: `node -e "require('radix-ui')"` exposes `RadioGroup`] Same import pattern as `Accordion`, `Select`, `Label` |
| `sonner` | ^2.0.7 | Toast for success/error feedback | [VERIFIED: package.json + src/queries/recurringTransactions.ts] Sudah dipakai di seluruh codebase |
| `tailwind-merge` + `clsx` | ^3.5.0 / ^2.1.1 | `cn()` utility untuk class composition | [VERIFIED: src/lib/utils.ts] Sudah dipakai di semua shadcn components |
| `lucide-react` | ^1.8.0 | Icon (Pencil for edit, Eye for View-As, dll) | [VERIFIED: package.json] Pattern di IndikatorCard / TierPanel |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-router-dom` | ^7.14.2 | `useNavigate` untuk CTA edit (jika perlu link external) | Tidak essential untuk Phase 14 — form inline tanpa nav |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useState` per radio | `react-hook-form` | [ASSUMED] react-hook-form = ~9KB gzipped + new convention. Phase 14 forms sederhana (1 question Tier 1, 1 gate + 6 conditional questions Tier 4). Existing codebase ZERO use react-hook-form (verified via grep). **Tolak.** |
| Native `<input type='radio'>` | shadcn RadioGroup (radix-ui) | Native sudah cukup secara fungsional, tapi shadcn idiom konsisten dengan Accordion/Checkbox/Select existing. **Pakai radix-ui RadioGroup** — sekali tambah `radio-group.tsx` benefit lifetime. |
| Modal/Drawer untuk edit | Inline flip card | Locked decision A — inline flip. Drawer package belum ada. |
| Single mutation `useUpdateProtectionChecklist({ patch })` | Multiple narrow `useUpdateHealthCoverage` + `useUpdateTier4Field` | Single generic upsert lebih sederhana — body schema small (10 columns), partial patch via JS spread `{ user_id, ...patch }`. Recommend single mutation hook + caller pass partial patch object. |

**Installation:** Tidak ada install baru — semua deps sudah tersedia. Hanya **buat file baru** `src/components/ui/radio-group.tsx` (clone pattern dari `accordion.tsx` / `select.tsx`).

**Version verification:** Skip — semua dependency yang relevan sudah locked di package.json sejak Phase 12/13. Tidak ada upgrade required.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  KesehatanLanding.tsx (Phase 13, NOT modified by Phase 14)      │
│  - Renders <Accordion> with 4 <Tier{N}Panel> bodies             │
│  - Reads useIndikator() → IndikatorMap + DARTotalInfo           │
│  - Derives tierColors via deriveTierColors()                    │
└──────┬──────────────────────────────────────────────┬───────────┘
       │ <Tier1Panel indicators darTotalInfo />       │ <Tier4Panel />
       ▼                                              ▼
┌──────────────────────────────┐    ┌─────────────────────────────┐
│  Tier1Panel.tsx (modify)      │    │  Tier4Panel.tsx (rewrite)   │
│  - 4 IndikatorCard via        │    │  - Uses useViewAs() guard   │
│    TierPanel                  │    │  - <ProtectionGateRadio /> │
│  - #4 IndikatorCard variant   │    │  - <Tier4LifeSection      │
│    extended with form-radio   │    │      v-if has_dependents/> │
│    edit mode (Decision A)     │    │  - <Tier4EstateSection />  │
│  - Reads useViewAs → isViewAs │    │  - Submit → upsert mutation │
└──────┬───────────────────────┘    └──────────┬──────────────────┘
       │ user clicks edit                        │ user toggles radio
       ▼                                          ▼
┌────────────────────────────────────────────────────────────────┐
│  src/queries/protectionChecklist.ts (NEW)                      │
│  - useProtectionChecklist()  ← MOVE from kesehatanIndikator.ts │
│  - useUpdateProtectionChecklist({patch}) — optimistic + upsert │
│    onMutate:  qc.setQueryData(['kesehatan','protection-...'])  │
│    onError:   rollback snapshot + toast                        │
│    onSuccess: invalidate query key + toast 'Tersimpan'         │
└──────────────────────────────┬─────────────────────────────────┘
                               │ supabase.from('protection_checklist')
                               ▼
┌────────────────────────────────────────────────────────────────┐
│  src/db/protectionChecklist.ts (NEW — promoted from inline)    │
│  - getProtectionChecklist(uid) — SELECT all columns            │
│  - upsertProtectionChecklist(uid, patch) — UPSERT onConflict   │
│  - ProtectionChecklistRow type (full 10 cols, replaces stub)   │
└──────────────────────────────┬─────────────────────────────────┘
                               │ PostgREST + RLS
                               ▼
┌────────────────────────────────────────────────────────────────┐
│  protection_checklist table (Phase 12, migration 0029)         │
│  RLS: USING auth.uid() = user_id OR is_admin()                 │
│       WITH CHECK auth.uid() = user_id  ← rejects admin write   │
└────────────────────────────────────────────────────────────────┘

╔════════════════════════════════════════════════════════════════╗
║  Cache reactivity loop (Phase 13 already wired):                ║
║    upsert → invalidate ['kesehatan','protection-checklist',uid] ║
║    → useProtectionChecklist refetches                            ║
║    → useIndikator useMemo recomputes ALL 8 indicators            ║
║    → deriveTierColors recomputes Tier 1 + Tier 4 colors          ║
║    → PiramidaShell tierColors prop changes → trapezoid color flip║
║    → Tier1Panel #4 IndikatorCard variant flips back to compute   ║
╚════════════════════════════════════════════════════════════════╝
```

### Component Responsibilities

| File | Status | Responsibility |
|------|--------|----------------|
| `src/components/ui/radio-group.tsx` | **NEW** | shadcn RadioGroup wrapper around `radix-ui.RadioGroup`; exports `RadioGroup`, `RadioGroupItem` |
| `src/db/protectionChecklist.ts` | **NEW** | DB layer: `getProtectionChecklist(uid)`, `upsertProtectionChecklist(uid, patch)`, full `ProtectionChecklistRow` type |
| `src/queries/protectionChecklist.ts` | **NEW** | React Query layer: `useProtectionChecklist()` (move from `kesehatanIndikator.ts`), `useUpdateProtectionChecklist()` mutation with optimistic update |
| `src/queries/kesehatanIndikator.ts` | **MODIFY** | Drop inline `useProtectionChecklist`; import from `@/queries/protectionChecklist`. Update `deriveTierColors[4]` to use `aggregateTierColor` over Tier 4 IndikatorResult[] (gate-conditional). |
| `src/queries/kesehatanTier4.ts` | **NEW** (recommend) | `computeTier4Estate(row)`, `computeTier4Life(row)`, `computeTier4Aggregate(row)` — pure functions, parallel pattern to `kesehatanTier1.ts` |
| `src/queries/kesehatanTier1.ts` | **NO CHANGE** | `computeAsuransiShell` already correct. ProtectionChecklistRow type stays here OR re-export from new `src/db/protectionChecklist.ts` (recommend latter for parity with `pension_simulations`) |
| `src/tabs/kesehatan/IndikatorCard.tsx` | **MODIFY** | Add 4th render variant `form-radio` (or similar) ATAU accept optional `editForm: ReactNode` prop. Recommend: extend `IndikatorResult` union with kind `'form-radio'` containing options + currentValue + onSubmit. **Caveat:** This couples Tier 1 #4 with IndikatorCard — alternative is keep IndikatorCard pure and render custom card at Tier1Panel level |
| `src/tabs/kesehatan/Tier1Panel.tsx` | **MODIFY** | Inject form-edit wrapper around IndikatorCard #4. Read `useViewAs()` for `isViewAs`. Pass `disabled` + `onSubmit` callback. Surface inline View-As notice when `isViewAs`. |
| `src/tabs/kesehatan/Tier4Panel.tsx` | **REWRITE** | Replace placeholderText with full form: ProtectionGateRadio + (conditional) Tier4LifeSection + Tier4EstateSection + Submit button (or per-field auto-save). Read `useViewAs()`. Surface View-As inline notice. |
| `src/tabs/kesehatan/Tier4Checklist.tsx` | **NEW** (optional) | Extract form sub-components if Tier4Panel exceeds ~200 lines |

### Recommended Project Structure

```
src/
├── components/ui/
│   └── radio-group.tsx          # NEW — shadcn RadioGroup
├── db/
│   └── protectionChecklist.ts   # NEW — get/upsert + full type
├── queries/
│   ├── protectionChecklist.ts   # NEW — useProtectionChecklist + useUpdate*
│   ├── kesehatanIndikator.ts    # MODIFY — import useProtectionChecklist
│   ├── kesehatanTier1.ts        # NO CHANGE
│   └── kesehatanTier4.ts        # NEW — Tier 4 compute functions (recommend)
└── tabs/kesehatan/
    ├── IndikatorCard.tsx        # MODIFY — add form-radio variant
    ├── Tier1Panel.tsx           # MODIFY — inject form edit + View-As guard
    ├── Tier4Panel.tsx           # REWRITE — full checklist form
    └── Tier4Checklist.tsx       # NEW (optional) — form sub-components
```

### Pattern 1: Optimistic Upsert Mutation (CANONICAL — copy from `useMarkBillPaid`)

**What:** React Query mutation pattern proven in this codebase. Cancel in-flight queries → snapshot cache → optimistic setQueryData → rollback on error → invalidate on settle.

**When to use:** Any mutation where instant UI feedback matters (form submit, color flip).

**Example** (shipped pattern, Phase 4 v1.0, currently at `src/queries/recurringTransactions.ts:83-124`):
```ts
// Source: src/queries/recurringTransactions.ts:83-124 (CANONICAL)
export function useMarkBillPaid() {
  const qc = useQueryClient()
  const uid = useTargetUserId()
  return useMutation({
    mutationFn: ({ templateId, paidDate }: { templateId: number; paidDate: string }) =>
      markBillPaid(templateId, uid, paidDate),

    onMutate: async ({ templateId }) => {
      await qc.cancelQueries({ queryKey: ['upcoming-bills'] })
      const snapshots = qc.getQueriesData<RecurringTemplate[]>({ queryKey: ['upcoming-bills'] })
      qc.setQueriesData<RecurringTemplate[]>(
        { queryKey: ['upcoming-bills'] },
        (old) => old?.filter((b) => b.id !== templateId) ?? [],
      )
      return { snapshots }
    },

    onError: (err, _vars, context) => {
      context?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data))
      toast.error(mapSupabaseError(err))
    },

    onSuccess: () => { toast.success('✓ Tagihan dilunasi') },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['upcoming-bills'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}
```

**Adaptation for Phase 14** (`useUpdateProtectionChecklist`):
```ts
// Source: derived from useMarkBillPaid pattern
export function useUpdateProtectionChecklist() {
  const qc = useQueryClient()
  const uid = useTargetUserId()
  const { viewingAs } = useViewAs()

  return useMutation({
    mutationFn: async (patch: Partial<ProtectionChecklistPatch>) => {
      // F. View-As defensive guard (defense-in-depth alongside RLS)
      if (viewingAs !== null) throw new Error('Tidak boleh modify data user lain (View-As mode)')
      if (!uid) throw new Error('Unauthenticated')
      return upsertProtectionChecklist(uid, patch)
    },

    onMutate: async (patch) => {
      const queryKey = ['kesehatan', 'protection-checklist', uid]
      await qc.cancelQueries({ queryKey })
      const snapshot = qc.getQueryData<ProtectionChecklistRow | null>(queryKey)
      qc.setQueryData<ProtectionChecklistRow | null>(queryKey, (old) => ({
        ...(old ?? { user_id: uid! }),
        ...patch,
      }) as ProtectionChecklistRow)
      return { snapshot, queryKey }
    },

    onError: (err, _patch, ctx) => {
      if (ctx) qc.setQueryData(ctx.queryKey, ctx.snapshot)
      toast.error(mapSupabaseError(err))
    },

    onSuccess: () => { toast.success('Tersimpan') },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['kesehatan', 'protection-checklist', uid] })
      // No need invalidate other keys — useIndikator depends on this same query
    },
  })
}
```

### Pattern 2: Lazy-Create via Supabase Upsert (CANONICAL)

**What:** Single `.upsert(payload, { onConflict: 'user_id' })` call works for both INSERT (first interaction) and UPDATE (subsequent edits).

**Reference:** `src/db/pensiun.ts:92-100` (verbatim, identical 1:1 user table pattern):
```ts
// Source: src/db/pensiun.ts:92-100
export async function upsertPensionSim(uid: string, input: PensionSimInput): Promise<void> {
  const { error } = await supabase
    .from('pension_simulations')
    .upsert(
      { ...input, user_id: uid, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (error) throw error
}
```

**Phase 14 implementation** (`upsertProtectionChecklist`):
```ts
export async function upsertProtectionChecklist(
  uid: string,
  patch: Partial<Omit<ProtectionChecklistRow, 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('protection_checklist')
    .upsert(
      { ...patch, user_id: uid, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (error) throw error
}
```

**Note:** Partial patch is OK because table allows all business fields nullable (verified migration 0029). On first INSERT, unspecified fields default to NULL. On subsequent UPDATE, unspecified fields stay at their prior value (PostgreSQL upsert merges only specified columns from `EXCLUDED`).

### Pattern 3: View-As Read-Only Guard (CANONICAL — copy from InvestmentsTab)

**What:** Use `useViewAs()` (alias for `useViewAsContext`) to detect View-As mode, then derive `isViewAs` boolean, then prop-drill to disabled state.

**Reference:** `src/tabs/InvestmentsTab.tsx:30-31, 68-70`:
```ts
// Source: src/tabs/InvestmentsTab.tsx:30-31, 68-70
import { useViewAs } from '@/auth/useViewAs'

const { viewingAs } = useViewAs()
const isViewAs = viewingAs !== null

// JSX:
<Button
  variant="outline"
  disabled={isViewAs}
  title={isViewAs ? 'Tidak tersedia saat View-As' : ''}
>
  ...
</Button>
```

**Phase 14 application:**
```tsx
// Tier1Panel.tsx and Tier4Panel.tsx
const { viewingAs } = useViewAs()
const isViewAs = viewingAs !== null

// 1. Inline notice block when isViewAs
{isViewAs && (
  <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-2 text-xs text-amber-800 dark:text-amber-200">
    Mode View-As (read-only) — kamu lihat data {viewingAs.displayName || viewingAs.email}, tidak bisa modify
  </div>
)}

// 2. Disable form controls
<RadioGroupItem value="..." disabled={isViewAs} />
<Button disabled={isViewAs} onClick={handleSubmit}>Simpan</Button>
```

### Pattern 4: shadcn radix-ui Umbrella Component (CANONICAL)

**What:** Wrap radix-ui primitive in shadcn-style component file with Tailwind classes via `cn()`. Pattern proven at `accordion.tsx`, `select.tsx`, `label.tsx`, `checkbox.tsx`.

**Reference for new `radio-group.tsx`** (mirror `accordion.tsx` structure):
```tsx
// Source: derived from src/components/ui/select.tsx:1-6 + radix-ui umbrella export
"use client"
import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"
import { CircleIcon } from "lucide-react"
import { cn } from "@/lib/utils"

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn('grid gap-2', className)} {...props} />
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        'aspect-square h-4 w-4 rounded-full border border-input text-primary',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <CircleIcon className="h-2 w-2 fill-current text-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
```

[VERIFIED: `node -e "const p = require('radix-ui'); console.log(Object.keys(p).filter(k => /radio/i.test(k)))"` returns `[ 'RadioGroup' ]`]

### Pattern 5: IndikatorCard Variant Extension (Decision A — recommended approach)

**Two implementation options for inline form on Tier 1 #4:**

**Option A1 (preferred):** Extend `IndikatorResult` union with `'form-radio'` kind:
```ts
// In src/queries/kesehatanTypes.ts
export type IndikatorResult =
  | { kind: 'compute', value: number, color: IndikatorColor, display: string, staleMonths?: number }
  | { kind: 'placeholder-data-tipis', monthsAvailable: number, ctaTo: string }
  | { kind: 'cta-fallback', message: string, ctaLabel: string, ctaTo: string }
  // NEW Phase 14:
  | { kind: 'form-radio'
      , currentValue: string | null
      , options: Array<{ value: string; label: string }>
      , onSelect: (value: string) => void
      , disabled?: boolean
      , showAsCompute?: { color: IndikatorColor; display: string }  // when row exists, show colored value with edit icon; on edit click, parent flips kind to 'form-radio'
    }
```

Then `computeAsuransiShell` returns either `'compute'` (if row exists & not editing) or `'form-radio'` (if no row OR editing). The `isEditing` toggle lives in Tier1Panel local state.

**Option A2:** Keep IndikatorCard pure (no new variant) — render custom inline form card at Tier1Panel level for slot #4 only:
```tsx
// In Tier1Panel.tsx
{healthRow?.health_coverage && !isEditing ? (
  <IndikatorCardWithEditButton ... onEditClick={() => setEditing(true)} />
) : (
  <AsuransiKesehatanForm currentValue={healthRow?.health_coverage} onSubmit={...} disabled={isViewAs} />
)}
```

**Recommendation:** A2 — keep IndikatorCard variant unchanged. Phase 13 IndikatorCard is generic across all 8 indicators; threading form-specific concerns through it tightly couples the abstraction. Phase 14 gets a sibling component `<AsuransiKesehatanForm>` that mirrors IndikatorCard's outer shell (border-l-4, rounded-lg, p-3) but renders form internals. Plan can reuse `COLOR_BORDER_CLASS.red` / `COLOR_BORDER_CLASS.green` Tailwind utilities exported from `kesehatanTypes.ts`.

### Anti-Patterns to Avoid

- **Don't write to `protection_checklist` while in View-As mode.** Defensive JS guard ON TOP of RLS — RLS will return 42501 but UX should never reach that point. Pattern: `if (viewingAs !== null) throw new Error('...')` inside `mutationFn`.
- **Don't skip optimistic update.** Without optimistic, color flip waits for round-trip → user sees stale red badge for 200-500ms after submit. Phase 13 `useIndikator` recompute is instant once cache updates, leverage it.
- **Don't introduce a separate "isAnswered" view state.** The DB `health_coverage IS NULL` IS the "unanswered" state — single source of truth. Re-derive UI from query data, don't fork local state.
- **Don't validate enum values in JS only.** DB CHECK constraints (migration 0029) reject bad values; JS validation is UX courtesy. RadioGroup options array IS the validation — user can't pick non-enum.
- **Don't auto-submit on radio change for Tier 4 estate fields.** Auto-save per radio leads to confusion when user tab-explores. Recommend explicit "Simpan" button per section ATAU full-form auto-save with `onValueChange={debounced upsert}` — planner pick. **Critical:** Tier 1 #4 (single question) IS a good auto-submit candidate; Tier 4 (multi-field) less so.
- **Don't forget to invalidate `['kesehatan', 'protection-checklist', uid]` query key.** This is the EXACT key used by Phase 13 `useProtectionChecklist` (`kesehatanIndikator.ts:62-63`). Mismatch → indicator stays stale until next mount.
- **Don't bypass `mapSupabaseError`.** Always wrap toast.error: `toast.error(mapSupabaseError(err))`. RLS 42501 already mapped to "Akses ditolak"; UX consistent across app.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Radio group UI with keyboard nav, ARIA roles, focus management | Custom `<input type="radio">` cluster with manual `aria-*` attributes | `radix-ui.RadioGroup` (already in deps) | Radix handles arrow keys, focus rings, screen reader announce; getting it right manually = days of edge cases |
| Optimistic update with rollback | Custom `useState` snapshot + manual rollback in catch | React Query `onMutate` / `onError` / `onSettled` lifecycle | Pattern shipped 5+ times in this codebase; deviating = inconsistent UX + harder review |
| Lazy-create + update merge logic | Two separate `INSERT` and `UPDATE` paths with branch on row exists | Supabase `.upsert(payload, { onConflict: 'user_id' })` | One round-trip; PostgreSQL handles conflict resolution; merges arbitrary partial patches |
| View-As state detection | Prop-drill `isAdmin` and `viewedUserId` everywhere | `useViewAs()` hook (existing) returning `{ viewingAs }` | Single context already mounted at root; trivially testable; `viewingAs?.uid ?? user?.id` already wired in `useTargetUserId` |
| Form validation | Hand-rolled `if (!value || value not in enum) return error` | DB CHECK constraints + RadioGroup options as validation | Database is source of truth (migration 0029 has CHECK); JS validation is UX hint only; RadioGroup options array prevents bad input by construction |
| Toast lifecycle | Custom toast component | `sonner` (already imported) | Consistent app-wide; `toast.success` / `toast.error` used everywhere |
| Banner for View-As state | Inline ad-hoc div per page | `ViewAsBanner` global (already at AppShell.tsx) + minimal inline notice in panel | Global banner shipped Phase 5/7; Phase 14 can ADD inline notice for form-context but should NOT replicate global banner logic |

**Key insight:** Phase 14 is 95% wiring of existing patterns. The ONLY genuinely new code is (1) `radio-group.tsx` shadcn wrapper (~40 lines), (2) Tier 4 compute functions (~80 lines pure functions), (3) form components (~150 lines JSX). Everything else is copy-pattern from `useMarkBillPaid` / `upsertPensionSim` / `InvestmentsTab` View-As guard.

## Common Pitfalls

### Pitfall 1: Query key mismatch breaks indicator reactivity

**What goes wrong:** Phase 14 mutation invalidates `['protection-checklist', uid]` (without `'kesehatan'` prefix), but Phase 13 `useProtectionChecklist` queries `['kesehatan', 'protection-checklist', uid]`. Indicator stays stale; user sees old color until refresh.

**Why it happens:** Easy to copy `useUpsertPensionSim` (which uses `['pension-sim', uid]`) and forget that `useProtectionChecklist` was nested under `'kesehatan'` namespace at Phase 13.

**How to avoid:** Verify against `src/queries/kesehatanIndikator.ts:62` — exact key is `['kesehatan', 'protection-checklist', targetUid]`. Add a unit-of-work comment in mutation hook: `// MUST match queryKey at kesehatanIndikator.ts useProtectionChecklist`.

**Warning signs:** UAT — user submits form, color doesn't flip; only flips after page reload OR after 60s staleTime expires.

### Pitfall 2: `useViewAs` import path confusion

**What goes wrong:** Phase 14 imports `useViewAsContext` directly instead of the `useViewAs` alias. Code works but inconsistent with existing tabs.

**Why it happens:** `useViewAs` lives in `src/auth/useViewAs.ts` (single line re-export), `useViewAsContext` lives in `src/auth/ViewAsContext.tsx`. Both work.

**How to avoid:** **Always use `import { useViewAs } from '@/auth/useViewAs'`** (matches `InvestmentsTab.tsx:19`, `KekayaanTab.tsx:41`, `TransactionsTab.tsx:33`, `SettingsTab.tsx:10`).

**Warning signs:** Code review comment "use the alias".

### Pitfall 3: Tier 4 aggregation forgets gate-conditional skip

**What goes wrong:** When `has_dependents = false`, computing Tier 4 color includes `life_coverage*` fields → user with all estate filled but null life_coverage gets "red" because life_* read as NULL.

**Why it happens:** Naive `aggregateTierColor` over all 6 fields treats NULL == red. Decision D explicitly says skip life_* when has_dependents=false.

**How to avoid:** In `computeTier4Aggregate(row)`:
```ts
const indicators: IndikatorResult[] = []
indicators.push(estateHeirsResult, estateAssetsResult, estateWillResult)
if (row.has_dependents === true) {
  indicators.push(lifeCoverageResult, lifeSufficientResult, lifePostEmploymentResult)
}
return aggregateTierColor(indicators)
```

**Warning signs:** UAT — user toggles "Tidak tanggungan" + answers 3 estate "Ya" → expects green but sees red.

### Pitfall 4: Optimistic patch overwrites unrelated fields

**What goes wrong:** `qc.setQueryData(key, () => patch)` replaces the entire row instead of merging. User edited `health_coverage` but had previously set `has_dependents` — optimistic patch nukes `has_dependents` to undefined.

**Why it happens:** `setQueryData` accepts both updater and replacer signatures; getting the merge logic wrong is a single-character mistake.

**How to avoid:** Always use updater form with explicit spread:
```ts
qc.setQueryData<ProtectionChecklistRow | null>(queryKey, (old) => ({
  ...(old ?? { user_id: uid! }),
  ...patch,
}) as ProtectionChecklistRow)
```

**Warning signs:** UAT — user fills Tier 1 #4, then edits Tier 4, suddenly Tier 1 #4 reset to "Belum diisi" until reload.

### Pitfall 5: View-As admin sees stale data after their own (non-View-As) session edit

**What goes wrong:** Admin first edits own protection_checklist, then switches to View-As another user. React Query cache key includes `targetUid` so should re-fetch... unless admin's protection_checklist row hasn't loaded yet and the query key keys on `undefined` briefly.

**Why it happens:** `useTargetUserId()` returns `viewingAs?.uid ?? user?.id` — when switching, both might be momentarily undefined.

**How to avoid:** Already mitigated by Phase 13 — `useProtectionChecklist` uses `enabled: !!targetUid` (verified `kesehatanIndikator.ts:64`). Don't change this.

**Warning signs:** Brief flash of admin's data while loading view-as user; usually <100ms, acceptable.

### Pitfall 6: Estate radio NULL semantic ambiguity

**What goes wrong:** "Belum diisi" radio option submits `null` to DB, but JS reads `null` and renders "Belum diisi" radio selected? OR doesn't render any selection? Inconsistency confuses user.

**Why it happens:** Radix RadioGroup `value` prop expects string, not null. Need to map null ↔ sentinel string `'__null__'` or treat unselected state.

**How to avoid:** Map at boundary:
```tsx
<RadioGroup
  value={row?.estate_will_exists === true ? 'ya' : row?.estate_will_exists === false ? 'tidak' : ''}
  onValueChange={(v) => mutation.mutate({
    estate_will_exists: v === 'ya' ? true : v === 'tidak' ? false : null,
  })}
>
  <RadioGroupItem value="ya" /> Ya
  <RadioGroupItem value="tidak" /> Tidak
  {/* "Belum diisi" → no item; user selects "Ya" or "Tidak" to set value, can't unselect via UI */}
</RadioGroup>
```

Or include 3rd option per Decision E:
```tsx
<RadioGroupItem value="" /> Belum diisi  {/* explicit clear */}
```

**Warning signs:** User selects "Ya" then tries to clear; selection sticks; can only change by submitting different value. **Recommend** include explicit "Belum diisi" radio option per Decision E.

### Pitfall 7: Spec ambiguity on Tier 4 yellow boundary

**What goes wrong:** Spec §4 mentions yellow (`"ya tapi cuma kantor" / "tidak yakin" pada question transition risk`) but rules are vague. Plan executor might invent thresholds.

**Why it happens:** CONTEXT.md deferred ideas mention "Tier 4 indicator: yellow boundary — Spec §4 hanya mention green/red. Yellow case TBD".

**How to avoid:** Recommend planner LOCK as binary (green/red only) for v1.2, defer yellow nuance to v1.3. Document decision in plan. Specifically: green = all relevant questions positive; red = any negative or missing answer (per Decision E NULL=red recommendation).

**Warning signs:** Verifier asks "what makes this Tier 4 yellow vs green?" — no defensible answer.

## Code Examples

### Example 1: Single-field upsert (DIAG-04)

```ts
// In Tier1Panel.tsx onSubmit handler:
const updateMutation = useUpdateProtectionChecklist()

function handleSubmitHealthCoverage(value: 'kantor' | 'bpjs' | 'pribadi' | 'kombinasi' | 'tidak') {
  updateMutation.mutate({ health_coverage: value })
}
```

### Example 2: Conditional gate field with preserve-on-toggle (DIAG-09 + Decision D)

```tsx
// In Tier4Panel.tsx
const { data: row } = useProtectionChecklist()
const updateMutation = useUpdateProtectionChecklist()
const { viewingAs } = useViewAs()
const isViewAs = viewingAs !== null

// Gate question
<RadioGroup
  value={row?.has_dependents === true ? 'ya' : row?.has_dependents === false ? 'tidak' : ''}
  onValueChange={(v) => updateMutation.mutate({ has_dependents: v === 'ya' })}
  disabled={isViewAs}
>
  <RadioGroupItem value="ya" /> Ya
  <RadioGroupItem value="tidak" /> Tidak
</RadioGroup>

{/* Asuransi Jiwa section — conditionally rendered, fields preserved on hide */}
{row?.has_dependents === true && (
  <Tier4LifeSection row={row} disabled={isViewAs} mutation={updateMutation} />
)}

{/* Estate section — universal, render after gate answered */}
{row?.has_dependents !== null && row?.has_dependents !== undefined && (
  <Tier4EstateSection row={row} disabled={isViewAs} mutation={updateMutation} />
)}
```

### Example 3: Tier 4 aggregation with gate-conditional skip

```ts
// In src/queries/kesehatanTier4.ts (NEW)
import { aggregateTierColor } from './kesehatanIndikator'
import type { IndikatorResult } from './kesehatanTypes'
import type { ProtectionChecklistRow } from '@/db/protectionChecklist'

function booleanToResult(value: boolean | null, label: string): IndikatorResult {
  if (value === true) {
    return { kind: 'compute', value: 1, color: 'green', display: `${label}: Ya` }
  }
  // NULL or false → red per Decision E recommendation
  return { kind: 'compute', value: 0, color: 'red', display: value === false ? `${label}: Tidak` : `${label}: Belum diisi` }
}

export function computeTier4Color(row: ProtectionChecklistRow | null): 'green' | 'yellow' | 'red' | 'gray' {
  if (!row || row.has_dependents === null || row.has_dependents === undefined) {
    return 'gray'  // gate not answered
  }

  const indicators: IndikatorResult[] = [
    booleanToResult(row.estate_heirs_documented, 'Ahli waris'),
    booleanToResult(row.estate_assets_documented, 'Aset terdokumentasi'),
    booleanToResult(row.estate_will_exists, 'Wasiat'),
  ]

  if (row.has_dependents === true) {
    // Life coverage: enum 4-state. Green if !== 'tidak' AND !== null. Red otherwise.
    const lifeCovColor: 'green' | 'red' =
      row.life_coverage && row.life_coverage !== 'tidak' ? 'green' : 'red'
    indicators.push({ kind: 'compute', value: 0, color: lifeCovColor, display: '' })

    indicators.push(booleanToResult(row.life_coverage_sufficient, 'Coverage cukup'))

    // life_coverage_post_employment: 3-state ya/tidak/tidak_yakin
    const postEmpColor: 'green' | 'red' =
      row.life_coverage_post_employment === 'ya' ? 'green' : 'red'
    // Note: 'tidak_yakin' could be yellow per spec §4 mention; planner decides binary v1.2.
    indicators.push({ kind: 'compute', value: 0, color: postEmpColor, display: '' })
  }

  return aggregateTierColor(indicators)
}
```

### Example 4: Updating `deriveTierColors` to consume Tier 4

```ts
// In src/queries/kesehatanIndikator.ts (MODIFY)
import { computeTier4Color } from './kesehatanTier4'

export function deriveTierColors(
  indicators: IndikatorMap | null,
  protectionRow: ProtectionChecklistRow | null,  // NEW PARAM
): TierColors {
  if (!indicators) {
    return { 1: 'gray', 2: 'gray', 3: 'gray', 4: 'gray' }
  }
  return {
    1: aggregateTierColor(TIER_INDICATORS[1].map(id => indicators[id])),
    2: aggregateTierColor(TIER_INDICATORS[2].map(id => indicators[id])),
    3: aggregateTierColor(TIER_INDICATORS[3].map(id => indicators[id])),
    4: computeTier4Color(protectionRow),  // NEW
  }
}
```

**Caveat:** This signature change is breaking for `KesehatanLanding.tsx` line 51-53. Plan must update the call site OR thread `protectionRow` through `useIndikator` return type.

**Recommendation:** Extend `useIndikator` return shape with `protectionRow` for use by `deriveTierColors`:
```ts
// useIndikator already reads protection.data — just expose it
return {
  isLoading,
  indicators,
  darTotalInfo,
  protectionRow: protection.data ?? null,  // NEW
}
```

Then `KesehatanLanding`:
```ts
const tierColors = !isEmpty && !indikator.isLoading
  ? deriveTierColors(indikator.indicators, indikator.protectionRow)
  : undefined
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useState` form + manual fetch | React Query `useMutation` w/ optimistic | v1.0 Phase 4 (`useMarkBillPaid`) | Phase 14 inherits; do not regress |
| Modal for every form interaction | Inline edit / accordion expansion | v1.2 Phase 13 | Decision A inline-flip continues this trend |
| Schema migration for every UI form | Lazy-create row + nullable columns | v1.2 Phase 12 (migration 0029 design) | Phase 14 fully exercises lazy-create pattern; first usage |
| Hand-roll `<input type=radio>` | shadcn `RadioGroup` (radix-ui) | Phase 14 (NEW for this codebase) | Establishes radio-group.tsx component for future forms |

**Deprecated/outdated:**
- `react-hook-form` integration — never adopted; codebase uses `useState` for all forms (Goals, Investments, Pensiun, Net Worth all use plain `useState`). Phase 14 should not introduce.
- `react-query v4` patterns — codebase on v5 (`@tanstack/react-query` 5.99.1). `useMutation({ onMutate, onError, onSettled })` syntax is v5-style. [VERIFIED: package.json + recurringTransactions.ts]

## Project Constraints (from MEMORY.md)

- **response_language: Bahasa Indonesia** — Semua user-facing copy (radio labels, toast, button labels, banner) WAJIB Bahasa Indonesia. Comments + variable names tetap English (project convention).
- **Studio paste de-facto migration channel** — Phase 14 = ZERO migration, jadi N/A. Tapi kalau ada kebutuhan tambahan column (deferred), pakai Studio SQL Editor manual paste, bukan `db push`.
- **DROP FUNCTION before signature change** — N/A Phase 14 (no SQL functions).
- **Verify-before-close discipline** — Phase 14 plan MUST include UAT + Playwright (atau manual visual) verification AND production smoke test post-deploy. Pattern shipped Phase 6/10 v1.1.
- **mapSupabaseError extracts `.message`** — Use `toast.error(mapSupabaseError(err))` always. Don't `toast.error(err.message)` directly.

## Runtime State Inventory

> Phase 14 is purely additive UI + new query/mutation hook; no rename, no refactor, no migration. Section omitted per template guidance.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@tanstack/react-query` | Mutation pattern | ✓ | 5.99.1 | — |
| `radix-ui` (umbrella) | RadioGroup primitive | ✓ | 1.4.3 | — (verified RadioGroup export) |
| `@supabase/supabase-js` | Upsert + RLS round-trip | ✓ | 2.103.3 | — |
| `sonner` | Toast | ✓ | 2.0.7 | — |
| `lucide-react` | Icons (CircleIcon for radio indicator, Pencil for edit) | ✓ | 1.8.0 | — |
| `tw-animate-css` | Accordion enter/leave (Phase 13 inherited) | ✓ | 1.4.0 | — |
| `protection_checklist` table on production Supabase | All mutations | ✓ | n/a | — (verified Phase 12 12-01-SUMMARY Task 3 applied via Studio paste) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Notes:** All required infrastructure shipped. Plan executor only adds NEW files; no install / no migration / no env var change.

## Validation Architecture

**Skip note:** `.planning/config.json` does not set `workflow.nyquist_validation` either way (file only contains `_auto_chain_active: false`). Per template guidance, treat as enabled and include this section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None automated (codebase has no test infrastructure: zero `.test.*` / `.spec.*` files; no `jest.config` / `vitest.config`; package.json has no `test` script) |
| Config file | none |
| Quick run command | `npx tsc --noEmit` (TypeScript verification) |
| Full suite command | `npx tsc --noEmit && npm run build` (TypeScript + production build) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIAG-04 | Tier 1 #4 form submits → row inserted/updated → indicator color flips green/red | manual UAT | n/a (manual: navigate /kesehatan, expand Tier 1, submit form, observe color flip) | n/a |
| DIAG-04 | Repeat submission updates same row (lazy-create idempotency) | manual UAT + SQL verify | n/a | n/a |
| DIAG-04 | TypeScript types compile | unit (compile) | `npx tsc --noEmit` | ✅ existing |
| DIAG-09 | Gate "Tidak tanggungan" → only estate section visible | manual UAT | n/a | n/a |
| DIAG-09 | Gate "Ya tanggungan" → estate + asuransi jiwa section visible | manual UAT | n/a | n/a |
| DIAG-09 | Toggle "Ya"→"Tidak"→"Ya" preserves life_coverage answers (Decision D) | manual UAT + SQL verify | n/a | n/a |
| DIAG-09 | Tier 4 trapezoid color flips per aggregate logic | manual UAT | n/a | n/a |
| DIAG-12 | `viewingAs !== null` → form inputs disabled, submit hidden, banner visible | manual UAT (need 2nd user account + admin role) | n/a | n/a |
| DIAG-12 | Defensive JS guard rejects mutation if View-As (defense-in-depth) | manual UAT (try direct mutation call) | n/a | n/a |
| DIAG-12 | RLS rejects admin write to other user's row (42501 → "Akses ditolak") | SQL verify | n/a (could write supabase/tests/14-protection-checklist.sql) | ❌ Wave 0 (SQL test file already exists from Phase 12 — covers RLS reads/writes; Phase 14 may add INSERT-via-View-As test) |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (must be clean)
- **Per wave merge:** `npx tsc --noEmit && npm run build` (must succeed; bundle delta ≤ +20 KB acceptable since adding RadioGroup component + 2 form sections + 1 mutation hook)
- **Phase gate:** Production deploy + manual UAT 9 steps (covering DIAG-04/09/12 paths) before `/gsd-verify-phase 14`

### Wave 0 Gaps
- [ ] No automated test framework — entirely manual UAT. Acceptable per project history (v1.0/v1.1 also manual UAT). Plan should include explicit UAT script in `<action>` block.
- [ ] (Optional) Extend `supabase/tests/12-protection-checklist.sql` with Phase 14 mutation-specific scenarios (e.g., admin-View-As-write rejected) — defer to planner judgment; Phase 12 SQL test already covers core RLS isolation.

*If gaps are not addressed:* Phase 14 ships with manual UAT only — same risk profile as v1.0/v1.1 phases that shipped successfully.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (existing — `useAuthContext` session) |
| V3 Session Management | yes | Supabase JWT (existing) |
| V4 Access Control | yes | RLS `WITH CHECK auth.uid() = user_id` (migration 0029) + JS `useViewAs` guard (Phase 14 defense-in-depth) |
| V5 Input Validation | yes | DB CHECK constraints (enum: `health_coverage`, `life_coverage`, `life_coverage_post_employment`); RadioGroup options array (UX-level enum enforcement) |
| V6 Cryptography | no | — (no secrets, no PII encryption needed; protection_checklist contains only self-assessed financial flags) |

### Known Threat Patterns for React + Supabase + RLS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Admin View-As writes to other user's row | Elevation | RLS `WITH CHECK auth.uid() = user_id` rejects (42501 → "Akses ditolak"); JS `useViewAs` guard rejects pre-flight |
| Forged enum value via direct DB call | Tampering | DB CHECK constraint rejects (23514 → mapped to user-friendly toast); RadioGroup UI prevents non-enum values |
| XSS via radio label | Tampering | Labels are static literals from JSX; no user input rendered; React auto-escapes if anything threaded through |
| Mutation flood / race | Tampering | `qc.cancelQueries` in `onMutate` handles in-flight cancellation; no rate-limit needed (single-user form, no public-facing API) |
| RLS leak via wrong query key | Information Disclosure | Phase 13 query uses `['kesehatan', 'protection-checklist', targetUid]` — `targetUid` from `useTargetUserId` ensures `viewingAs ?? user.id` proper resolution |
| Stale optimistic data revealed | Information Disclosure | `onError` rollback restores prior cache state; `onSettled` invalidates → refetch authoritative state |
| CSRF on Supabase write | Tampering | Supabase JWT in Authorization header (not cookie); CORS allowlist enforced (Phase 5/10) |

**No new threats introduced by Phase 14** beyond what Phase 12 schema + RLS already mitigate. Defensive client-side guard added (Decision F) is UX-level, not security-critical.

## Sources

### Primary (HIGH confidence)
- `package.json` — dependency versions [VERIFIED: read 2026-05-09]
- `supabase/migrations/0029_protection_checklist.sql` — schema + RLS [VERIFIED: read 2026-05-09]
- `src/queries/kesehatanIndikator.ts` — Phase 13 useProtectionChecklist + query key [VERIFIED: read 2026-05-09]
- `src/queries/kesehatanTier1.ts` — `computeAsuransiShell`, ProtectionChecklistRow type [VERIFIED: read 2026-05-09]
- `src/queries/recurringTransactions.ts` — `useMarkBillPaid` canonical optimistic mutation pattern [VERIFIED: read 2026-05-09]
- `src/db/pensiun.ts` — `upsertPensionSim` canonical lazy-create pattern [VERIFIED: read 2026-05-09]
- `src/auth/useTargetUserId.ts` + `src/auth/ViewAsContext.tsx` + `src/auth/useViewAs.ts` — View-As primitives [VERIFIED: read 2026-05-09]
- `src/tabs/InvestmentsTab.tsx`, `src/tabs/TransactionsTab.tsx`, `src/tabs/KekayaanTab.tsx` — `isViewAs` usage pattern [VERIFIED: grep 2026-05-09]
- `src/components/ViewAsBanner.tsx` + `src/shell/AppShell.tsx` — global banner mounting [VERIFIED: read 2026-05-09]
- `src/components/ui/select.tsx`, `accordion.tsx`, `label.tsx`, `checkbox.tsx` — shadcn radix-ui umbrella component patterns [VERIFIED: read 2026-05-09]
- `src/lib/errors.ts` — `mapSupabaseError` + SQLSTATE 42501/23514 handling [VERIFIED: read 2026-05-09]
- `radix-ui` umbrella package — `RadioGroup` export [VERIFIED: `node -e require` 2026-05-09]
- `docs/superpowers/specs/2026-05-08-framework-page-design.md` §4 — Tier 1 #4 / Tier 4 spec, threshold rules [VERIFIED: read 2026-05-09]
- Phase 12 + Phase 13 SUMMARY files — what shipped, hand-off notes [VERIFIED: read 2026-05-09]
- `.planning/phases/14-protection-tier4-checklists/14-CONTEXT.md` — locked decisions [VERIFIED: read 2026-05-09]
- `.planning/REQUIREMENTS.md` — DIAG-04, DIAG-09, DIAG-12 requirement language [VERIFIED: read 2026-05-09]

### Secondary (MEDIUM confidence)
- None required — entire phase grounds in shipped code.

### Tertiary (LOW confidence)
- None.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Adding ~3 new component/query files + 2 modified files results in bundle delta < 20 KB | Validation Architecture / Sampling Rate | If exceeded, build delta tolerance breached; reviewer flags. Low risk — radio-group.tsx is ~40 lines. |
| A2 | `react-hook-form` adds ~9 KB gzipped | Standard Stack / Alternatives Considered | Used to justify rejecting react-hook-form. Even if value differs, the broader codebase-consistency argument stands. |
| A3 | Spec §4 yellow boundary for Tier 4 is intentionally loose; v1.2 should bind to green/red binary | Common Pitfalls / Pitfall 7 | If user later requests yellow nuance, must add at v1.3. Confirmed by CONTEXT.md deferred ideas list. |

**If this table is empty:** would mean fully verified — but A3 in particular needs planner judgment.

## Open Questions (RESOLVED)

1. **NULL estate aggregation: red or gray?**
   - What we know: CONTEXT.md Decision E says "NULL = treat sebagai 'Tidak' untuk warna (red) ATAU sebagai 'abu-abu' (TBD planner). Recommend RED biar push user fill."
   - What's unclear: Is NULL = red the right UX? Some users prefer gray "not yet answered" over red "negative".
   - **RESOLVED:** Lock to **red** per CONTEXT.md author intent ("push user fill"). Implemented in Plan 14-03 `computeTier4Color`.

2. **Tier 4 yellow boundary: include `tidak_yakin` as yellow?**
   - What we know: Spec §4 mentions yellow case for "ya tapi cuma kantor" / "tidak yakin" — but doesn't formalize. CONTEXT.md deferred ideas: "lean ke green/red binary per spec literal".
   - What's unclear: Whether to ship binary green/red or attempt yellow.
   - **RESOLVED:** Lock to **binary green/red for v1.2** (`life_coverage_post_employment === 'ya'` → green; `'tidak'` and `'tidak_yakin'` → red). Yellow nuance deferred to v1.3. Implemented in Plan 14-03 `computeTier4Color`.

3. **Auto-save on radio change vs explicit Submit button?**
   - What we know: Decision A says Tier 1 has Simpan button; Decision B implicit.
   - What's unclear: Tier 4 form (7 questions) — auto-save per radio change or batch submit?
   - **RESOLVED:** Tier 1 #4 uses explicit Simpan/Batal buttons (CONTEXT.md UX flow #3). Tier 4 uses **auto-save per radio change** (orchestrator additional_context). Implemented in Plan 14-02 (Tier 1) and Plan 14-03 (Tier 4).

4. **Should `computeAsuransiShell` add a 4th IndikatorResult variant `'form-radio'`?**
   - What we know: Decision A mentions "extend dengan variant baru `form-radio` ATAU wrap with internal state `isEditing`".
   - What's unclear: Recommended approach.
   - **RESOLVED:** **Wrap, don't extend.** Keep `IndikatorResult` union 3-variant (Phase 13 invariant); render `<AsuransiKesehatanForm>` sibling component at Tier1Panel level for slot #4 (Option A2). Implemented in Plan 14-02.

5. **Whether to migrate `ProtectionChecklistRow` type to `src/db/protectionChecklist.ts`?**
   - What we know: Phase 13 13-02 Hand-off Notes explicitly suggested two options; current placement is `kesehatanTier1.ts` (Tier 1 #4 minimal subset: 2 fields).
   - What's unclear: Whether to expand in-place or migrate.
   - **RESOLVED:** **Migrate to `src/db/protectionChecklist.ts`** — parity with `pension_simulations` pattern (`src/db/pensiun.ts` owns `PensionSimRow` + `PensionSimInput`). Re-export from `kesehatanTier1.ts` for Phase 13 import compat. Implemented in Plan 14-01.
     ```ts
     // src/queries/kesehatanTier1.ts
     export type { ProtectionChecklistRow } from '@/db/protectionChecklist'
     ```

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dependency verified in package.json + actual file usage
- Architecture: HIGH — all patterns shipped and battle-tested in this codebase (Phase 4/6/10/13)
- Pitfalls: HIGH — derived from actual code paths (query key matching, View-As wiring, optimistic merge); not speculative

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (30 days — codebase stable, dependencies locked, schema frozen)
