# Phase 14: Protection & Tier 4 Checklists — Pattern Map

**Mapped:** 2026-05-09
**Files analyzed:** 9 (6 NEW, 3 MODIFY)
**Analogs found:** 9 / 9 (100% — all internal canonical references)

> **Path note:** CONTEXT/RESEARCH abstrak menyebut `src/components/kesehatan/` dan `src/lib/kesehatan/`, tapi **actual codebase** pakai `src/tabs/kesehatan/` (UI) + `src/queries/` (compute) + `src/db/` (data layer). Pattern map di bawah ini pakai actual paths supaya planner bisa langsung match.

---

## File Classification

| New/Modified File | Status | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `src/components/ui/radio-group.tsx` | NEW | UI primitive (shadcn wrapper) | request-response (controlled component) | `src/components/ui/select.tsx` (radix-ui umbrella idiom) + `src/components/ui/accordion.tsx` (closer scale) | exact (pattern-identical wrapper) |
| `src/db/protectionChecklist.ts` | NEW | data layer | CRUD (lazy-create upsert) | `src/db/pensiun.ts` (1:1 user table, upsert onConflict user_id) | exact |
| `src/queries/protectionChecklist.ts` | NEW | React Query hook (read + mutation) | request-response w/ optimistic | `src/queries/recurringTransactions.ts` `useMarkBillPaid` (optimistic) + Phase 13 inline `useProtectionChecklist` (read) | exact |
| `src/queries/kesehatanTier4.ts` | NEW (recommend) | pure compute | transform | `src/queries/kesehatanTier1.ts` `computeAsuransiShell` + `kesehatanTier3.ts` (pure compute family) | exact |
| `src/tabs/kesehatan/AsuransiKesehatanForm.tsx` | NEW (recommend per CONTEXT.md) | form component | event-driven (radio onChange → optimistic mutate) | `src/tabs/kesehatan/IndikatorCard.tsx` (compute variant shell) + InvestmentsTab `disabled={isViewAs}` pattern | role-match (no inline radio form exists yet) |
| `src/tabs/kesehatan/Tier4Checklist.tsx` (or extend `Tier4Panel.tsx`) | NEW (optional) | form component | event-driven | same as above | role-match |
| `src/tabs/kesehatan/Tier1Panel.tsx` | MODIFY | tier panel (sibling-render new form) | request-response | self-reference (current shipped state) | exact |
| `src/tabs/kesehatan/Tier4Panel.tsx` | MODIFY (full rewrite) | tier panel (form host) | event-driven | `src/tabs/kesehatan/Tier1Panel.tsx` (sibling tier panel pattern) | exact |
| `src/queries/kesehatanIndikator.ts` | MODIFY | compute orchestrator (extend `deriveTierColors[4]` + expose `protectionRow`) | transform | self-reference (current `deriveTierColors`) | exact |
| `src/queries/kesehatanTier1.ts` | NO CHANGE (or re-export `ProtectionChecklistRow`) | data layer (legacy type host) | — | — | n/a |

---

## Pattern Assignments

### `src/components/ui/radio-group.tsx` (NEW — UI primitive)

**Analog 1 (preferred — closest scale):** `src/components/ui/accordion.tsx` lines 1-66
**Analog 2 (preset details):** `src/components/ui/select.tsx` lines 1-12 (radix-ui umbrella import + `data-slot` + `cn`)

**Imports pattern** (from `accordion.tsx:1-7`):
```tsx
"use client"

import * as React from "react"
import { Accordion as AccordionPrimitive } from "radix-ui"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
```

**Phase 14 adaptation:**
```tsx
"use client"

import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"
import { CircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"
```

**Component shell pattern** (mirror `accordion.tsx:9-26` style):
```tsx
function RadioGroup({
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid gap-2", className)} {...props} />
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="relative flex items-center justify-center">
        <CircleIcon className="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
```

**Match quality:** Pattern dari `accordion.tsx`/`select.tsx` 100% transferable — sama-sama radix-ui umbrella import, `data-slot`, `cn()` composition, `React.ComponentProps<typeof X.Root>` typing.

---

### `src/db/protectionChecklist.ts` (NEW — data layer)

**Analog:** `src/db/pensiun.ts:1-100` (verified lines 92-100 = identical 1:1 user table upsert)

**Imports pattern** (from `pensiun.ts:1-2`):
```ts
// src/db/pensiun.ts
import { supabase } from '@/lib/supabase'
```

**Type definition pattern** (from `pensiun.ts:4-44`):
```ts
export interface PensionSimRow {
  id: string
  user_id: string
  updated_at: string
  created_at: string
  // ... all business columns
}

export type PensionSimInput = Omit<PensionSimRow, 'id' | 'user_id' | 'updated_at' | 'created_at'>
```

**Read pattern** (`pensiun.ts:82-90`):
```ts
export async function getPensionSim(uid: string): Promise<PensionSimRow | null> {
  const { data, error } = await supabase
    .from('pension_simulations')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle()
  if (error) throw error
  return data as PensionSimRow | null
}
```

**Upsert pattern (CANONICAL — copy verbatim) `pensiun.ts:92-100`:**
```ts
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

**Phase 14 adaptation (note: Phase 14 uses Partial patch, not full input):**
```ts
import { supabase } from '@/lib/supabase'

export type ProtectionChecklistRow = {
  user_id: string
  health_coverage: 'kantor' | 'bpjs' | 'pribadi' | 'kombinasi' | 'tidak' | null
  has_dependents: boolean | null
  life_coverage: 'kantor' | 'pribadi' | 'keduanya' | 'tidak' | null
  life_coverage_sufficient: boolean | null
  life_coverage_post_employment: 'ya' | 'tidak' | 'tidak_yakin' | null
  estate_heirs_documented: boolean | null
  estate_assets_documented: boolean | null
  estate_will_exists: boolean | null
  updated_at: string
  created_at: string
}

export type ProtectionChecklistPatch = Partial<
  Omit<ProtectionChecklistRow, 'user_id' | 'created_at' | 'updated_at'>
>

export async function getProtectionChecklist(uid: string): Promise<ProtectionChecklistRow | null> {
  const { data, error } = await supabase
    .from('protection_checklist')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle()
  if (error) throw error
  return data as ProtectionChecklistRow | null
}

export async function upsertProtectionChecklist(
  uid: string,
  patch: ProtectionChecklistPatch,
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

**Schema reference (locked, no change Phase 14):** `supabase/migrations/0029_protection_checklist.sql:14-46` — column types + CHECK constraints + RLS `WITH CHECK auth.uid() = user_id`.

---

### `src/queries/protectionChecklist.ts` (NEW — React Query layer)

**Analog 1 (mutation pattern CANONICAL):** `src/queries/recurringTransactions.ts:83-124` `useMarkBillPaid`
**Analog 2 (read pattern):** `src/queries/kesehatanIndikator.ts:60-80` `useProtectionChecklist` (Phase 13 inline — MOVE here)

**Imports pattern** (from `recurringTransactions.ts:1-16`):
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { mapSupabaseError } from '@/lib/errors'
import { useTargetUserId } from '@/auth/useTargetUserId'
```

**Read hook pattern (from current `kesehatanIndikator.ts:60-80` — MOVE verbatim):**
```ts
export function useProtectionChecklist() {
  const targetUid = useTargetUserId()
  return useQuery<ProtectionChecklistRow | null>({
    queryKey: ['kesehatan', 'protection-checklist', targetUid],
    enabled: !!targetUid,
    queryFn: async () => {
      if (!targetUid) return null
      // Phase 14 widen select * (was: 'user_id, health_coverage')
      return getProtectionChecklist(targetUid)
    },
    staleTime: 60_000,
  })
}
```

**Optimistic mutation CANONICAL pattern (`recurringTransactions.ts:83-124`):**
```ts
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

    onSuccess: () => {
      toast.success('✓ Tagihan dilunasi')
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['upcoming-bills'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      qc.invalidateQueries({ queryKey: ['recurring-templates'] })
    },
  })
}
```

**Phase 14 adaptation (single-row partial patch + View-As guard):**
```ts
export function useUpdateProtectionChecklist() {
  const qc = useQueryClient()
  const uid = useTargetUserId()
  const { viewingAs } = useViewAs()

  return useMutation({
    mutationFn: async (patch: ProtectionChecklistPatch) => {
      // F. View-As defensive guard (defense-in-depth alongside RLS WITH CHECK)
      if (viewingAs !== null) throw new Error('Tidak boleh modify data user lain (View-As mode)')
      if (!uid) throw new Error('Unauthenticated')
      return upsertProtectionChecklist(uid, patch)
    },

    onMutate: async (patch) => {
      // CRITICAL: query key MUST match kesehatanIndikator.ts useProtectionChecklist line 63
      const queryKey = ['kesehatan', 'protection-checklist', uid]
      await qc.cancelQueries({ queryKey })
      const snapshot = qc.getQueryData<ProtectionChecklistRow | null>(queryKey)

      // Pitfall 4 mitigation: ALWAYS spread old + patch (don't replace whole row)
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
    },
  })
}
```

**Critical query key match:** `['kesehatan', 'protection-checklist', uid]` — verified at `kesehatanIndikator.ts:63`. Mismatch = stale indicator.

---

### `src/queries/kesehatanTier4.ts` (NEW — pure compute)

**Analog 1 (compute family pattern):** `src/queries/kesehatanTier1.ts` (full file)
**Analog 2 (boolean → IndikatorResult):** `src/queries/kesehatanTier1.ts:262-289` `computeAsuransiShell`
**Analog 3 (aggregateTierColor consumption):** `src/queries/kesehatanIndikator.ts:165-175` + `189-199`

**Imports pattern** (from `kesehatanTier3.ts:1-9`):
```ts
import {
  THRESHOLDS,
  type IndikatorColor,
  type IndikatorResult,
} from './kesehatanTypes'
import { totalAsetFinansial } from './kesehatanTier1'
```

**Phase 14 imports adaptation:**
```ts
import { aggregateTierColor } from './kesehatanIndikator'
import type { IndikatorResult } from './kesehatanTypes'
import type { ProtectionChecklistRow } from '@/db/protectionChecklist'
```

**Pure compute pattern reference** (`kesehatanTier1.ts:262-289`):
```ts
export function computeAsuransiShell(
  row: ProtectionChecklistRow | null | undefined,
): IndikatorResult {
  if (!row || row.health_coverage == null) {
    return { kind: 'compute', value: 0, color: 'red', display: 'Belum diisi' }
  }
  if (row.health_coverage === 'tidak') {
    return { kind: 'compute', value: 0, color: 'red', display: 'Tidak covered' }
  }
  return { kind: 'compute', value: 1, color: 'green', display: HEALTH_COVERAGE_LABEL[row.health_coverage] }
}
```

**Phase 14 adaptation (with gate-conditional skip per Pitfall 3):**
```ts
function booleanToResult(value: boolean | null, label: string): IndikatorResult {
  if (value === true) {
    return { kind: 'compute', value: 1, color: 'green', display: `${label}: Ya` }
  }
  // NULL or false → red per CONTEXT.md decision E (push fill)
  return {
    kind: 'compute',
    value: 0,
    color: 'red',
    display: value === false ? `${label}: Tidak` : `${label}: Belum diisi`,
  }
}

export function computeTier4Color(
  row: ProtectionChecklistRow | null,
): 'green' | 'yellow' | 'red' | 'gray' {
  // Gate not answered → gray (per CONTEXT.md decision: row !exist OR has_dependents NULL)
  if (!row || row.has_dependents === null || row.has_dependents === undefined) {
    return 'gray'
  }

  const indicators: IndikatorResult[] = [
    booleanToResult(row.estate_heirs_documented, 'Ahli waris'),
    booleanToResult(row.estate_assets_documented, 'Aset terdokumentasi'),
    booleanToResult(row.estate_will_exists, 'Wasiat'),
  ]

  // Decision D: skip life_coverage* aggregation when has_dependents=false
  if (row.has_dependents === true) {
    const lifeCovColor: 'green' | 'red' =
      row.life_coverage && row.life_coverage !== 'tidak' ? 'green' : 'red'
    indicators.push({ kind: 'compute', value: 0, color: lifeCovColor, display: '' })
    indicators.push(booleanToResult(row.life_coverage_sufficient, 'Coverage cukup'))
    const postEmpColor: 'green' | 'red' =
      row.life_coverage_post_employment === 'ya' ? 'green' : 'red'
    indicators.push({ kind: 'compute', value: 0, color: postEmpColor, display: '' })
  }

  return aggregateTierColor(indicators)
}
```

**File header convention** (from all `kesehatanTier{1,2,3}.ts`):
```ts
// ============================================================
// Tier 4 — WARISAN & ASURANSI JIWA compute logic
// ============================================================
//
// Smart-gated:
// - Gate: has_dependents NULL → gray
// - Universal: 3 estate_* fields counted always
// - Conditional: 3 life_* fields counted only when has_dependents=true (Decision D)
// ============================================================
```

---

### `src/tabs/kesehatan/AsuransiKesehatanForm.tsx` (NEW — Tier 1 #4 inline form)

**Analog 1 (card outer shell):** `src/tabs/kesehatan/IndikatorCard.tsx:88-117` (compute variant)
**Analog 2 (View-As disabled pattern):** `src/tabs/InvestmentsTab.tsx:30-31, 67-93`
**Analog 3 (Phase 14 RESEARCH §A2 recommended approach):** keep IndikatorCard pure, render sibling component

**Card outer shell pattern (CANONICAL — `IndikatorCard.tsx:88-117`):**
```tsx
return (
  <div
    className={`rounded-lg border border-l-4 bg-card p-3 ${COLOR_BORDER_CLASS[result.color]}`}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
        </div>
        {thresholdHint && (
          <p className="text-[10px] text-muted-foreground">{thresholdHint}</p>
        )}
      </div>
      <span className={`rounded px-2 py-1 text-sm font-semibold ${COLOR_BADGE_CLASS[result.color]}`}>
        {result.display}
      </span>
    </div>
  </div>
)
```

**View-As guard pattern (CANONICAL — `InvestmentsTab.tsx:30-31, 67-93`):**
```tsx
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

**Phase 14 adaptation (3-state machine: empty / editing / filled):**
```tsx
import { useState } from 'react'
import { Pencil, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useViewAs } from '@/auth/useViewAs'
import {
  COLOR_BADGE_CLASS,
  COLOR_BORDER_CLASS,
} from '@/queries/kesehatan'
import { useUpdateProtectionChecklist } from '@/queries/protectionChecklist'
import type { ProtectionChecklistRow } from '@/db/protectionChecklist'

const HEALTH_OPTIONS: Array<{ value: NonNullable<ProtectionChecklistRow['health_coverage']>; label: string }> = [
  { value: 'kantor', label: 'Kantor (asuransi grup)' },
  { value: 'bpjs', label: 'BPJS' },
  { value: 'pribadi', label: 'Pribadi (beli sendiri)' },
  { value: 'kombinasi', label: 'Kombinasi (kantor + pribadi)' },
  { value: 'tidak', label: 'Tidak / belum tahu' },
]

type Props = { row: ProtectionChecklistRow | null }

export default function AsuransiKesehatanForm({ row }: Props) {
  const { viewingAs } = useViewAs()
  const isViewAs = viewingAs !== null
  const [isEditing, setEditing] = useState(false)
  const [pending, setPending] = useState<string | null>(row?.health_coverage ?? null)
  const mutation = useUpdateProtectionChecklist()

  const current = row?.health_coverage ?? null
  const showEdit = !current || isEditing  // State A or State B

  // ... render 3-state shell using COLOR_BORDER_CLASS + COLOR_BADGE_CLASS
}
```

**Critical reuses:**
- `COLOR_BORDER_CLASS` + `COLOR_BADGE_CLASS` from `kesehatanTypes.ts:93-105`
- Card shell `rounded-lg border border-l-4 bg-card p-3` from `IndikatorCard.tsx:91`
- `space-y-2` per UI-SPEC.md spacing scale

---

### `src/tabs/kesehatan/Tier1Panel.tsx` (MODIFY — sibling-render new form)

**Self-analog (current shipped state):** `src/tabs/kesehatan/Tier1Panel.tsx:22-73`

**Current TierPanel call pattern (lines 39-72):**
```tsx
return (
  <TierPanel
    tierId={1}
    indicators={[
      { label: 'Dana Darurat', thresholdHint: '...', result: indicators['1'] },
      { label: 'Savings Rate', ..., result: indicators['2'] },
      { label: 'DAR Konsumtif', ..., result: indicators['3'] },
      { label: 'Asuransi Kesehatan', ..., result: indicators['4'] },  // <- replace this slot
    ]}
    infoSlot={infoSlot}
    ctas={[...]}
    modulLinks={[...]}
  />
)
```

**Phase 14 modification approach (per RESEARCH §Pattern 5 Option A2):**
1. Pass first 3 indicators (1, 2, 3) to TierPanel as-is
2. Below TierPanel (or as 4th custom slot), render `<AsuransiKesehatanForm row={protectionRow} />` — sibling element instead of `IndikatorCard` for slot #4
3. Read `protectionRow` from `useIndikator()` extended return (see kesehatanIndikator.ts modification below)

**Example modification:**
```tsx
type Props = {
  indicators: IndikatorMap
  darTotalInfo: DARTotalInfo | null
  protectionRow: ProtectionChecklistRow | null  // NEW
}

export default function Tier1Panel({ indicators, darTotalInfo, protectionRow }: Props) {
  // ... existing infoSlot
  return (
    <>
      <TierPanel
        tierId={1}
        indicators={[
          { label: 'Dana Darurat', ..., result: indicators['1'] },
          { label: 'Savings Rate', ..., result: indicators['2'] },
          { label: 'DAR Konsumtif', ..., result: indicators['3'] },
          // NOTE: indicator #4 dirender custom di luar TierPanel — sibling form
        ]}
        infoSlot={infoSlot}
        ctas={[...]}
        modulLinks={[...]}
      />
      {/* Tier 1 #4 inline form (Phase 14) */}
      <div className="px-4 pb-4">
        <AsuransiKesehatanForm row={protectionRow} />
      </div>
    </>
  )
}
```

**Trade-off:** TierPanel children compose top-to-bottom; injection di parent level keep IndikatorCard variant pure (Phase 14 RESEARCH §Pattern 5 A2 recommendation).

---

### `src/tabs/kesehatan/Tier4Panel.tsx` (REWRITE — full checklist)

**Analog 1 (file structure & imports):** `src/tabs/kesehatan/Tier1Panel.tsx`
**Analog 2 (TierPanel placeholder usage):** current `Tier4Panel.tsx:9-16` (will be replaced)
**Analog 3 (View-As inline notice):** `src/components/ViewAsBanner.tsx:9-23` (amber banner palette to mirror inline)

**Current placeholder shipped (`Tier4Panel.tsx:9-16` — to be replaced):**
```tsx
export default function Tier4Panel() {
  return (
    <TierPanel
      tierId={4}
      placeholderText="Smart-gated checklist (Tier 4 — Warisan & Asuransi Jiwa) akan tersedia di update berikutnya."
    />
  )
}
```

**Inline View-As notice pattern (CANONICAL `ViewAsBanner.tsx:10-13`):**
```tsx
<div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-6 py-2 text-sm">
  <span className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
    <Eye className="h-4 w-4" />
    Sedang melihat data <strong>{viewingAs.displayName || viewingAs.email}</strong> (hanya baca)
  </span>
</div>
```

**Phase 14 adaptation (rounded-md, no px-6 / py-2 — match panel padding):**
```tsx
{isViewAs && (
  <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
    <Eye className="h-4 w-4" />
    Mode View-As — kamu hanya bisa lihat, tidak bisa simpan.
  </div>
)}
```

**Full rewrite skeleton:**
```tsx
import { Eye } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useViewAs } from '@/auth/useViewAs'
import { useProtectionChecklist, useUpdateProtectionChecklist } from '@/queries/protectionChecklist'
import TierPanel from './TierPanel'

export default function Tier4Panel() {
  const { viewingAs } = useViewAs()
  const isViewAs = viewingAs !== null
  const { data: row } = useProtectionChecklist()
  const mutation = useUpdateProtectionChecklist()

  return (
    <div className="space-y-4 p-4">
      {isViewAs && (
        <div className="rounded-md bg-amber-50 ...">...</div>
      )}

      {/* Gate section */}
      <ProtectionGateRadio row={row} disabled={isViewAs} mutation={mutation} />

      {/* Asuransi Jiwa section (conditional has_dependents=true) */}
      {row?.has_dependents === true && (
        <Tier4LifeSection row={row} disabled={isViewAs} mutation={mutation} />
      )}

      {/* Estate section (universal after gate answered) */}
      {row?.has_dependents !== null && row?.has_dependents !== undefined && (
        <Tier4EstateSection row={row} disabled={isViewAs} mutation={mutation} />
      )}
    </div>
  )
}
```

---

### `src/queries/kesehatanIndikator.ts` (MODIFY — extend `deriveTierColors[4]` + expose `protectionRow`)

**Self-analog (current shipped):** lines 60-80 (move out), 116-153 (extend return), 189-199 (`deriveTierColors`)

**Current `deriveTierColors` (lines 189-199 — to extend):**
```ts
export function deriveTierColors(indicators: IndikatorMap | null): TierColors {
  if (!indicators) {
    return { 1: 'gray', 2: 'gray', 3: 'gray', 4: 'gray' }
  }
  return {
    1: aggregateTierColor(TIER_INDICATORS[1].map(id => indicators[id])),
    2: aggregateTierColor(TIER_INDICATORS[2].map(id => indicators[id])),
    3: aggregateTierColor(TIER_INDICATORS[3].map(id => indicators[id])),
    4: 'gray', // Phase 14 deliver Tier 4 content  ← UPDATE THIS
  }
}
```

**Phase 14 modification:**
```ts
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

**Current `useIndikator` return shape (lines 116-153):**
```ts
return useMemo(() => {
  if (isLoading) {
    return { isLoading: true as const, indicators: null, darTotalInfo: null }
  }
  // ...
  return { isLoading: false as const, indicators, darTotalInfo }
}, [...])
```

**Phase 14 modification — expose `protectionRow`:**
```ts
return useMemo(() => {
  if (isLoading) {
    return { isLoading: true as const, indicators: null, darTotalInfo: null, protectionRow: null }
  }
  const protData = protection.data ?? null
  // ...
  return { isLoading: false as const, indicators, darTotalInfo, protectionRow: protData }
}, [...])
```

**MOVE `useProtectionChecklist` (lines 60-80)** → `src/queries/protectionChecklist.ts`. Replace inline def with import.

---

## Shared Patterns

### Authentication / View-As Guard (CANONICAL pattern)

**Source:** `src/tabs/InvestmentsTab.tsx:19, 30-31, 67-70` (verbatim copy at `KekayaanTab.tsx:41`, `TransactionsTab.tsx:33`)

**Apply to:**
- `src/tabs/kesehatan/AsuransiKesehatanForm.tsx` (NEW)
- `src/tabs/kesehatan/Tier4Panel.tsx` (REWRITE)
- `src/queries/protectionChecklist.ts` `useUpdateProtectionChecklist` (defensive guard di `mutationFn`)

**Pattern excerpt (`InvestmentsTab.tsx:19, 30-31`):**
```tsx
import { useViewAs } from '@/auth/useViewAs'

const { viewingAs } = useViewAs()
const isViewAs = viewingAs !== null

// Disable form controls
<Button disabled={isViewAs} title={isViewAs ? 'Tidak tersedia saat View-As' : ''}>
  ...
</Button>
```

**Pitfall to avoid (from RESEARCH Pitfall 2):** Always import `useViewAs` (alias) from `@/auth/useViewAs`, NEVER `useViewAsContext` directly.

---

### Error Handling (CANONICAL — `mapSupabaseError` + `sonner.error`)

**Source:** `src/lib/errors.ts:1` `mapSupabaseError` + `src/queries/recurringTransactions.ts:33-37, 109` (used app-wide)

**Apply to:** All mutations in `src/queries/protectionChecklist.ts`

**Pattern excerpt (`recurringTransactions.ts:31-38`):**
```ts
import { toast } from 'sonner'
import { mapSupabaseError } from '@/lib/errors'

return useMutation({
  mutationFn: ...,
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: [...] })
    toast.success('Template berhasil ditambahkan')
  },
  onError: (e) => toast.error(mapSupabaseError(e)),
})
```

**Pitfall to avoid (from RESEARCH common pitfalls):** NEVER `toast.error(err.message)` directly. Always `toast.error(mapSupabaseError(err))`. RLS 42501 is mapped to "Akses ditolak" — UX consistent.

---

### Optimistic Update Protocol (CANONICAL — `useMarkBillPaid`)

**Source:** `src/queries/recurringTransactions.ts:83-124`

**Apply to:** `useUpdateProtectionChecklist` in `src/queries/protectionChecklist.ts`

**Pattern signature:**
```ts
useMutation({
  mutationFn: ...,
  onMutate: async (vars) => {
    await qc.cancelQueries({ queryKey })
    const snapshot = qc.getQueryData(queryKey)  // snapshot for rollback
    qc.setQueryData(queryKey, (old) => optimistic_value)  // optimistic update
    return { snapshot, queryKey }
  },
  onError: (err, _vars, ctx) => {
    if (ctx) qc.setQueryData(ctx.queryKey, ctx.snapshot)  // rollback
    toast.error(mapSupabaseError(err))
  },
  onSuccess: () => { toast.success('...') },
  onSettled: () => {
    qc.invalidateQueries({ queryKey })  // reconcile w/ server
  },
})
```

**Pitfall (from RESEARCH Pitfall 4):** Always use updater form `(old) => ({ ...old, ...patch })` — never `qc.setQueryData(key, patch)` directly (replaces whole row).

---

### Lazy-Create Upsert (CANONICAL — `upsertPensionSim`)

**Source:** `src/db/pensiun.ts:92-100`

**Apply to:** `upsertProtectionChecklist` in `src/db/protectionChecklist.ts`

**Pattern excerpt:**
```ts
const { error } = await supabase
  .from('TABLE_NAME')
  .upsert(
    { ...input, user_id: uid, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
if (error) throw error
```

**Why this works:** PostgreSQL `INSERT ... ON CONFLICT (user_id) DO UPDATE SET ...` — first interaction INSERTs new row, subsequent calls UPDATE. Partial patch works because all business columns NULLable per migration 0029.

---

### Pure Compute Function Family (CANONICAL — `computeXxx` family)

**Source:** `src/queries/kesehatanTier1.ts`, `kesehatanTier2.ts`, `kesehatanTier3.ts`

**Apply to:** `src/queries/kesehatanTier4.ts` (NEW)

**Pattern conventions:**
- Pure functions, no side effects, no React hooks
- Take primitives/rows in, return `IndikatorResult` or `'green'|'yellow'|'red'|'gray'`
- File-level header comment block explaining formula + threshold + edge cases
- Reuse `THRESHOLDS` from `kesehatanTypes.ts` for tunable constants
- Reuse `aggregateTierColor` from `kesehatanIndikator.ts` for tier-level rollup

---

### radix-ui Umbrella Component (CANONICAL — accordion/select/label/checkbox)

**Source:** `src/components/ui/accordion.tsx:1-66`, `src/components/ui/select.tsx:1-12`, `src/components/ui/label.tsx:1-22`

**Apply to:** `src/components/ui/radio-group.tsx` (NEW)

**Pattern conventions:**
- `"use client"` directive at top
- `import * as React from "react"` first
- `import { X as XPrimitive } from "radix-ui"` (umbrella, NOT individual `@radix-ui/react-X` packages)
- `import { cn } from "@/lib/utils"`
- Functional components with `data-slot="x"` for styling hooks
- Class composition via `cn(<base classes>, className)`
- Type via `React.ComponentProps<typeof XPrimitive.Root>`
- Named exports at bottom: `export { RadioGroup, RadioGroupItem }`

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All Phase 14 files have direct internal analogs. |

**Coverage commentary:** Phase 14 is 95% pattern-reuse (per RESEARCH §"Don't Hand-Roll" key insight). The only "new" code is JSX composition in form components — every primitive (radio-group, optimistic mutation, upsert, View-As guard, pure compute, IndikatorCard shell, amber View-As notice) has a direct in-codebase canonical reference.

---

## Cross-Reference: Locked Decisions → Pattern Source

| Decision | Pattern | Canonical Source |
|----------|---------|------------------|
| A. Tier 1 #4 inline replace IndikatorCard | sibling card component (Option A2) reusing `COLOR_BORDER_CLASS` + `bg-card p-3` shell | `IndikatorCard.tsx:88-117` + `kesehatanTypes.ts:100-105` |
| B. Tier 4 gate-first conditional sections | `{row?.has_dependents === true && <Tier4LifeSection ... />}` JSX conditional | RESEARCH Code Example 2 (no direct analog — JSX idiom) |
| C. Optimistic mutation via React Query | `useMutation({ onMutate, onError, onSuccess, onSettled })` | `recurringTransactions.ts:83-124` `useMarkBillPaid` |
| D. Gate toggle preserve answers | DB UPDATE only `has_dependents` field via `Partial<Patch>`; UI hide via `&&` JSX guard | `pensiun.ts:92-100` upsert (idempotent partial) |
| E. Estate 3-state radio (Ya/Tidak/Belum diisi) | Map `null ↔ ''` sentinel at boundary in `value` prop | RESEARCH Pitfall 6 (no direct analog — pattern documented in research) |
| F. View-As disabled + banner + JS guard | `disabled={isViewAs}`, inline amber notice, defensive throw in `mutationFn` | `InvestmentsTab.tsx:30-31, 67-93` + `ViewAsBanner.tsx:10-13` |

---

## Metadata

**Analog search scope:**
- `src/components/ui/` (shadcn primitives)
- `src/db/` (data layer)
- `src/queries/` (React Query hooks + compute functions)
- `src/tabs/` (UI layout, View-As patterns)
- `src/auth/` (View-As context primitives)
- `src/lib/` (errors, utils)
- `supabase/migrations/` (schema reference 0029)

**Files scanned:** ~25 (source files referenced; full repo glob filtered to relevant dirs)

**Pattern extraction date:** 2026-05-09

**Files NOT modified by Phase 14 (per RESEARCH):**
- `src/tabs/kesehatan/KesehatanLanding.tsx` — only call-site update for `deriveTierColors` signature change (1-2 line edit, keep in same plan as `kesehatanIndikator.ts`)
- `src/tabs/kesehatan/Tier2Panel.tsx`, `Tier3Panel.tsx` — out of scope
- `src/queries/kesehatanTier1.ts` — `computeAsuransiShell` already reads `health_coverage`, no change needed (Phase 13 wired correctly)
