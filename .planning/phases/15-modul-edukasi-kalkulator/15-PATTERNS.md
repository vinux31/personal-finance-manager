# Phase 15: Modul Edukasi & Kalkulator — Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 11 (8 NEW + 3 MODIFY)
**Analogs found:** 9 / 11 (2 partial — Popover & Recharts LineChart not in codebase yet)

## File Classification

| New/Modified File | Status | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `src/data/glossary.ts` | NEW | data | static-const | `src/content/panduan.ts` (PANDUAN_TOPICS const) + `src/tabs/kesehatan/modulCatalog.ts` (MODUL_CATALOG const) | exact (typed const dictionary) |
| `src/data/modulContent.ts` | NEW | data | static-const | `src/content/panduan.ts` (PANDUAN_TOPICS — typed sections array) | exact |
| `src/components/GlossaryTooltip.tsx` | NEW | component | UI overlay (event-driven) | `src/components/ui/tooltip.tsx` (Radix wrapper, swap primitive to Popover) + `src/components/ui/dropdown-menu.tsx` (Portal+Content+Trigger structure for Radix-singular import) | role-match (Tooltip exists; Popover NOT yet — use dropdown-menu as Radix Portal/Content reference) |
| `src/tabs/kesehatan/KesehatanModulLayout.tsx` | NEW | layout | request-response (route-driven) | `src/tabs/kesehatan/KesehatanLayout.tsx` (parent Outlet pattern) + `src/components/PanduanFullPage.tsx` (sticky topbar + article max-width) | exact + role-match |
| `src/tabs/kesehatan/ModulRenderer.tsx` | NEW | component | request-response (param-driven render) | `src/components/PanduanFullPage.tsx` (useParams + resolveActive + section.map prose) | exact |
| `src/tabs/kesehatan/KalkulatorPage.tsx` | NEW | tab/page | request-response (interactive form) | `src/tabs/pensiun/SimulasiPanel.tsx` (slider+input+useMemo+Recharts ResponsiveContainer pattern) | exact |
| `src/tabs/kesehatan/KalkulatorBanner.tsx` | MODIFY | component | event-driven (click → navigate) | self (existing) — replace `toast.info()` with `useNavigate()` like `src/tabs/kesehatan/ModulCard.tsx:6,8,14` | exact |
| `src/tabs/kesehatan/KesehatanLanding.tsx` | NO CHANGE | — | — | already routes correctly via `ModulCard` (verified `to = /kesehatan/${slug}` line 8) | n/a |
| `src/routes.tsx` | MODIFY | config | routing | self lines 32-39 (existing kesehatan parent with `children:[]`) — append 7 entries inside `children` | exact (in-file pattern) |
| `src/index.css` | MODIFY | config | CSS theme | self line 4 (`@import "@fontsource-variable/geist"`) + line 10 (`--font-sans: 'Geist Variable', sans-serif`) — add parallel for Fraunces | exact (in-file pattern) |
| `package.json` | MODIFY | config | dependencies | self line 11 (`@fontsource-variable/geist: ^5.2.8`) — add sibling `@fontsource-variable/fraunces: ^5.2.9` | exact (in-file pattern) |

---

## Pattern Assignments

### `src/data/glossary.ts` (data, static-const)

**Analog:** `src/tabs/kesehatan/modulCatalog.ts` (8-entry typed const) + `src/content/panduan.ts` (Record-shaped typed dictionary alternative)

**Type-safe const export pattern** (`src/tabs/kesehatan/modulCatalog.ts:4-12`):
```typescript
export type ModulItem = {
  slug: string         // sub-route segment, mis. 'arus-kas'
  label: string        // judul card di grid
  description: string  // 1-line teaser di card
  icon: LucideIcon     // lucide icon
}

// Source: design spec §6 + lampiran "Mapping konten file source ke modul React"
export const MODUL_CATALOG: ModulItem[] = [
  {
    slug: 'arus-kas',
    label: 'Pondasi & Cash Flow',
```

**Apply for `glossary.ts`:** Replace array with `Record<GlossaryTerm, …>` per CONTEXT D-13. Keep header comment style (`// Source: …`). Use string-literal union type for `GlossaryTerm` (8 keys: `'asset-allocation' | 'real-return' | …`).

---

### `src/data/modulContent.ts` (data, static-const)

**Analog:** `src/content/panduan.ts:1-22` — closest existing pattern (typed nested sections array as TS const).

**Imports pattern** (`src/content/panduan.ts:1-22`):
```typescript
export type PanduanStep = {
  number: number
  text: string
  detail?: string
}

export type PanduanSection = {
  heading: string
  intro?: string
  steps: PanduanStep[]
  tip?: string
}

export type PanduanTopic = {
  slug: string
  title: string
  category: 'fitur' | 'skenario'
  summary: string
  sections: PanduanSection[]
}

export const PANDUAN_TOPICS: PanduanTopic[] = [
  {
    slug: 'dashboard',
```

**Apply for `modulContent.ts`:** Same shape — typed `ModulData` interface + `MODUL_CONTENT: Record<ModulSlug, ModulData>` (or array). Section variants discriminated union (`kind: 'theory' | 'practice' | 'check'`) per RESEARCH.md Pattern 1. Body strings keep inline `<em>`/`<strong>` markup + `[[term]]` glossary markers. ModulSlug union must match `MODUL_CATALOG` slugs verbatim (re-export type to enforce).

**No file location convention exists for `src/data/`** — `panduan.ts` lives in `src/content/`. Phase 15 introduces `src/data/` per RESEARCH §Recommended Project Structure. Acceptable since both are pure-data folders.

---

### `src/components/GlossaryTooltip.tsx` (component, event-driven)

**Analog:** `src/components/ui/tooltip.tsx` (existing Radix wrapper, full file readable in 57 lines) + `src/components/ui/dropdown-menu.tsx` (Portal/Content/Trigger structure for the singular `radix-ui` import — applies to Popover identically)

**Radix import pattern** (`src/components/ui/tooltip.tsx:3-4`):
```typescript
"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
```

**Project convention (CRITICAL):** Singular `radix-ui` package, NOT split `@radix-ui/*`. Use `import { Popover as PopoverPrimitive } from "radix-ui"` for Phase 15 pivot.

**Provider/Root/Trigger structure** (`src/components/ui/tooltip.tsx:8-31`):
```typescript
function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}
```

**Portal+Content with shadcn animation classes** (`src/components/ui/tooltip.tsx:33-55` and `src/components/ui/dropdown-menu.tsx:34-51`):
```typescript
function TooltipContent({ className, sideOffset = 0, children, ...props }: …) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 inline-flex w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background … data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}
```

**Apply for `GlossaryTooltip.tsx`:** Per CONTEXT D-14 (REVISED) build on **Radix Popover** (NOT Tooltip). Use Popover.Root + Popover.Trigger + Popover.Portal + Popover.Content + Popover.Arrow with the same `data-slot=` + `cn(...)` shadcn animation class pattern from tooltip.tsx. Use `bg-popover text-popover-foreground` (not `bg-foreground` — popover is light not dark like tooltip). Use `data-[state=open]:` instead of `data-[state=delayed-open]:`. Trigger uses `asChild` to wrap the inline `<span>` per UI-SPEC §GlossaryTooltip JSX template.

**No existing Popover wrapper file** — this is the first Popover usage in the codebase. Pattern source for Portal/Content shape = `src/components/ui/dropdown-menu.tsx:34-51` (also uses `radix-ui` singular package + Portal+Content+Arrow). Copy that pattern, swap `DropdownMenu` → `Popover`.

---

### `src/tabs/kesehatan/KesehatanModulLayout.tsx` (layout, route-driven)

**Analog:** `src/tabs/kesehatan/KesehatanLayout.tsx` (parent Outlet — 14 lines total, full pattern reproduced) + `src/components/PanduanFullPage.tsx:58-72,120-129` (sticky topbar + article max-w prose container — closest match for breadcrumb header + centered prose column)

**Outlet wrapper pattern** (`src/tabs/kesehatan/KesehatanLayout.tsx:1-15`):
```typescript
import { Outlet } from 'react-router-dom'

/**
 * Layout untuk route /kesehatan dengan children sub-routes.
 * Phase 12: cukup wrapper minimum + Outlet — sub-route Phase 15 nanti
 * akan tambah breadcrumb di sini.
 */
export default function KesehatanLayout() {
  return (
    <div className="space-y-6">
      <Outlet />
    </div>
  )
}
```

**Centered article + heading focus pattern** (`src/components/PanduanFullPage.tsx:120-129`):
```jsx
<div ref={contentRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
  <article className="mx-auto max-w-3xl">
    <h2
      ref={headingRef}
      tabIndex={-1}
      className="text-2xl font-bold outline-none"
    >
      {active.title}
    </h2>
    <p className="mt-2 text-base text-muted-foreground">{active.summary}</p>
```

**Heading focus on slug change pattern** (`src/components/PanduanFullPage.tsx:30-46`):
```typescript
const headingRef = useRef<HTMLHeadingElement>(null)
const contentRef = useRef<HTMLDivElement>(null)

const active = useMemo(() => resolveActive(activeSlug), [activeSlug])

useEffect(() => {
  headingRef.current?.focus()
}, [active.slug])
```

**Apply for `KesehatanModulLayout.tsx`:**
- Top of file: `import "@fontsource-variable/fraunces"` (per CONTEXT D-16; lazy via `React.lazy(() => import('@/tabs/kesehatan/KesehatanModulLayout'))` in routes.tsx)
- Render breadcrumb (top, `text-sm text-muted-foreground`) + `<Outlet />` (the ModulRenderer) wrapped in `<article className="mx-auto max-w-[65ch] px-4">` (use `65ch` per UI-SPEC, NOT `max-w-3xl`)
- Footer ModulFooterNav at bottom
- Skip the AppShell sticky header (D-19) — AppShell handles topbar already

---

### `src/tabs/kesehatan/ModulRenderer.tsx` (component, param-driven render)

**Analog:** `src/components/PanduanFullPage.tsx:13-33` (useParams + slug resolve + content lookup) + sections.map render at `:131-158`

**useParams + content lookup pattern** (`src/components/PanduanFullPage.tsx:13-33`):
```typescript
import { useNavigate, useParams } from 'react-router-dom'
import { PANDUAN_TOPICS, type PanduanTopic } from '@/content/panduan'

const FITUR_TOPICS = PANDUAN_TOPICS.filter((t) => t.category === 'fitur')

function resolveActive(slug: string | null): PanduanTopic {
  if (slug) {
    const found = PANDUAN_TOPICS.find((t) => t.slug === slug)
    if (found) return found
  }
  return PANDUAN_TOPICS[0]
}

export default function PanduanFullPage() {
  const { slug: activeSlug = null } = useParams<{ slug?: string }>()
  …
  const active = useMemo(() => resolveActive(activeSlug), [activeSlug])
```

**Sections map render pattern** (`src/components/PanduanFullPage.tsx:131-158`):
```jsx
<div className="mt-8 space-y-10">
  {active.sections.map((section, idx) => (
    <section key={idx}>
      <h3 className="text-lg font-semibold">{section.heading}</h3>
      {section.intro && (
        <p className="mt-2 text-sm text-muted-foreground">{section.intro}</p>
      )}
      <ol className="mt-4 list-decimal space-y-3 pl-6 text-sm">
        {section.steps.map((step) => (
          <li key={step.number}>
            <span>{step.text}</span>
```

**Apply for `ModulRenderer.tsx`:**
- `useParams<{ slug: ModulSlug }>()` → `MODUL_CONTENT[slug]` lookup
- Discriminate section.kind ('theory' | 'practice' | 'check') with switch/conditional render
- Wrap H1/H2/H3/p with Fraunces utility classes per UI-SPEC §Typography (e.g. `text-4xl font-semibold leading-tight font-serif`)
- Run `[[term]]X[[/term]]` post-processor on section body strings: regex split → render plain text + `<GlossaryTooltip term="…">X</GlossaryTooltip>` chunks. Use `dangerouslySetInnerHTML` only for inline `<em>`/`<strong>` markup AFTER glossary substitution (per RESEARCH.md §Pattern 1 + D-12 marker convention)
- 404 fallback: `<Navigate to="/kesehatan" replace />` (consistent with `src/routes.tsx:44`)

---

### `src/tabs/kesehatan/KalkulatorPage.tsx` (page, interactive form)

**Analog:** `src/tabs/pensiun/SimulasiPanel.tsx` — closest interactive calculator with slider+input combo + useMemo result + Recharts chart. Read in full (337 lines). KEY excerpts below.

**Imports pattern** (`src/tabs/pensiun/SimulasiPanel.tsx:1-12`):
```typescript
import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { calcDCA } from '@/lib/pensiun-calc'
import { formatRupiah, parseRupiah, shortRupiah } from '@/lib/format'
```

**useMemo recompute pattern** (`src/tabs/pensiun/SimulasiPanel.tsx:30-41`):
```typescript
const result = useMemo(() => calcDCA({
  usia: form.usia,
  usiaPensiun: form.usia_pensiun,
  investasiBulanan: form.sim_investasi_bulanan,
  …
}), [form])
```

**Apply:** Hoist FV math to `src/tabs/kesehatan/kalkulator/computeFV.ts` (pure function, separate file — RESEARCH §Recommended Structure). State = 4 controlled values (saldoAwal, setoranBulanan, returnPct, tenor). `const result = useMemo(() => computeFV(state), [state])` recomputes on every change (D-07 no debounce, < 480 iter).

**Slider+Label+Value combo pattern** (`src/tabs/pensiun/SimulasiPanel.tsx:166-177`):
```jsx
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span className="font-medium text-yellow-600">Emas (10%/thn)</span>
    <span className="font-bold">{form.sim_alokasi_emas}%</span>
  </div>
  <Slider
    value={[form.sim_alokasi_emas]}
    min={0} max={100} step={5}
    onValueChange={([v]) => normalizeAlokasi('emas', v)}
    className="[&_[role=slider]]:border-yellow-500"
  />
</div>
```

**Number input with formatRupiah/parseRupiah pattern** (`src/tabs/pensiun/SimulasiPanel.tsx:108-114`):
```jsx
<div className="space-y-1.5">
  <Label>Investasi per bulan</Label>
  <Input
    value={form.sim_investasi_bulanan === 0 ? '' : formatRupiah(form.sim_investasi_bulanan)}
    placeholder="Rp 500.000"
    onChange={(e) => onChange({ sim_investasi_bulanan: parseRupiah(e.target.value) })}
  />
</div>
```

**Apply for `KalkulatorInputRow.tsx`:** Combine Label + Slider + Input into a single reusable row component. For Rupiah fields use `formatRupiah(v)` / `parseRupiah(e.target.value)` from `src/lib/format.ts:10-29`. For percent + tenor use plain `type="number"` per `SimulasiPanel.tsx:118-126`. Per UI-SPEC §Slider+number combo: label `text-sm font-normal tracking-wide uppercase text-muted-foreground`, value input `text-lg font-normal tabular-nums`.

**Recharts chart pattern (CRITICAL — codebase has NO LineChart, only AreaChart)** — closest analog `src/tabs/pensiun/SimulasiPanel.tsx:285-296`:
```jsx
<ResponsiveContainer width="100%" height={220}>
  <AreaChart data={result.yearlyData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="tahun" tick={{ fontSize: 11 }} label={{ value: 'Tahun ke-', position: 'insideBottom', offset: -2, fontSize: 11 }} />
    <YAxis tickFormatter={(v) => shortRupiah(v)} tick={{ fontSize: 10 }} width={70} />
    <Tooltip formatter={(v: unknown) => formatRupiah(typeof v === 'number' ? v : 0)} />
    <Legend />
    <Area type="monotone" dataKey="emas" name="Emas" stackId="1" stroke="#d97706" fill="#fde68a" />
  </AreaChart>
</ResponsiveContainer>
```

**Alternative AreaChart with linearGradient** (`src/tabs/KekayaanTab.tsx:371-393`):
```jsx
<ResponsiveContainer width="100%" height={220}>
  <AreaChart data={chartData}>
    <defs>
      <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
    <YAxis tickFormatter={shortRupiah} tick={{ fontSize: 12 }} width={70} />
    <Tooltip formatter={(v: unknown) => formatRupiah(typeof v === 'number' ? v : 0)} />
    <Area type="monotone" dataKey="net_worth" stroke="#6366f1" strokeWidth={2} fill="url(#netWorthGradient)" />
  </AreaChart>
</ResponsiveContainer>
```

**Apply for `KalkulatorChart.tsx`:**
- Swap `AreaChart` → `LineChart`, `Area` → `Line` (Recharts API parallel)
- Imports: `import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'`
- Add `isAnimationActive={false}` on `<Line>` per RESEARCH §Pitfall #1 (real-time recalc would otherwise flicker — NEW vs analog SimulasiPanel which is step-based not real-time)
- Y-axis tickFormatter: `(v) => 'Rp ' + (v/1_000_000).toFixed(0) + 'jt'` per UI-SPEC §Recharts palette (or reuse `shortRupiah` from format.ts:47-53)
- Stroke color `#10b981` (green-500) per UI-SPEC growth semantic
- Wrap chart data in `useMemo(() => buildChartData(result), [result])` per RESEARCH §Pitfall #1

**Page outer wrapper pattern** (`src/tabs/kesehatan/KesehatanLanding.tsx:95-102`):
```jsx
<div className="space-y-6">
  <header className="space-y-1">
    <h1 className="text-2xl font-bold tracking-tight">Kesehatan Finansial</h1>
    <p className="text-sm text-muted-foreground">
      Lihat kondisi keuangan kamu lewat piramida 4 tier, lalu pelajari konsep finansial dari modul edukasi.
    </p>
  </header>
```

**Apply:** Use same `space-y-6` outer wrapper + `header` + sectioned cards (input card + output card grid; chart card; table card) per UI-SPEC §Kalkulator page layout.

---

### `src/tabs/kesehatan/KalkulatorBanner.tsx` (component, MODIFY)

**Current state** (lines 1-37, full file):
- Imports `toast` from sonner + `Button`
- Button `onClick` calls `toast.info('Kalkulator compound interest akan tersedia di update berikutnya.')`

**Target state — replace with navigate:**

**Pattern source** (`src/tabs/kesehatan/ModulCard.tsx:1,6,8,14`):
```typescript
import { useNavigate } from 'react-router-dom'
…
export default function ModulCard({ modul }: { modul: ModulItem }) {
  const navigate = useNavigate()
  const Icon = modul.icon
  const to = `/kesehatan/${modul.slug}`

  return (
    <Card
      role="button"
      …
      onClick={() => navigate(to)}
```

**Apply:**
1. Remove `import { toast } from 'sonner'` (line 1)
2. Add `import { useNavigate } from 'react-router-dom'`
3. Inside component: `const navigate = useNavigate()`
4. Replace Button `onClick` (lines 27-29) with `onClick={() => navigate('/kesehatan/kalkulator')}`

---

### `src/routes.tsx` (config, MODIFY)

**Current state** (lines 32-39):
```typescript
// NEW: nested /kesehatan route — Phase 15 akan tambah child routes (kalkulator + 6 modul)
{
  path: 'kesehatan',
  element: <KesehatanLayout />,
  children: [
    { index: true, element: <KesehatanLanding /> },
  ],
},
```

**Target state — nested children + lazy modul layout:**

**Pattern source — same file** (in-file route entry style at lines 23-43, all sibling routes use `{ path, element }` shape).

**Apply (illustrative shape — planner may refine):**
```typescript
const KesehatanModulLayout = React.lazy(() => import('@/tabs/kesehatan/KesehatanModulLayout'))
const ModulRenderer = React.lazy(() => import('@/tabs/kesehatan/ModulRenderer'))
const KalkulatorPage = React.lazy(() => import('@/tabs/kesehatan/KalkulatorPage'))

// inside kesehatan route children:
{
  path: 'kesehatan',
  element: <KesehatanLayout />,
  children: [
    { index: true, element: <KesehatanLanding /> },
    { path: 'kalkulator', element: <Suspense …><KalkulatorPage /></Suspense> },
    {
      element: <Suspense …><KesehatanModulLayout /></Suspense>,
      children: [
        { path: 'arus-kas', element: <ModulRenderer /> },
        { path: 'tujuan', element: <ModulRenderer /> },
        { path: 'alokasi-aset', element: <ModulRenderer /> },
        { path: 'instrumen', element: <ModulRenderer /> },
        { path: 'pajak-biaya-inflasi', element: <ModulRenderer /> },
        { path: 'perilaku', element: <ModulRenderer /> },
      ],
    },
  ],
},
```

**Note on Suspense:** Codebase currently has NO `React.lazy` usage anywhere (verified via Grep — only `routes.tsx` uses static imports). Phase 15 introduces lazy + Suspense. Planner must:
- Add `import React, { Suspense } from 'react'`
- Wrap lazy elements in `<Suspense fallback={<div>Memuat…</div>}>` (style consistent with existing `Memuat…` placeholder, see `src/tabs/KekayaanTab.tsx:200-201`)

---

### `src/index.css` (config, MODIFY)

**Current state — Geist registration** (lines 1-10):
```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";

@custom-variant dark (&:is(.dark *));

@theme inline {
    --font-heading: var(--font-sans);
    --font-sans: 'Geist Variable', sans-serif;
```

**Target state — add Fraunces import + --font-serif token:**

**Apply:**
1. After line 4 add: `@import "@fontsource-variable/fraunces";`
2. After line 10 (`--font-sans` declaration) add: `--font-serif: 'Fraunces Variable', Georgia, serif;`

This enables Tailwind v4 `font-serif` utility (auto-generated from `--font-serif` token in `@theme inline`) per Tailwind v4 convention. Family name `'Fraunces Variable'` matches `@fontsource-variable/fraunces` CSS export per RESEARCH §Standard Stack.

---

### `package.json` (config, MODIFY)

**Current state** (line 11):
```json
"@fontsource-variable/geist": "^5.2.8",
```

**Target state — add sibling:**

**Apply:** Add `"@fontsource-variable/fraunces": "^5.2.9",` adjacent to the geist entry (lexicographic order — `fraunces` comes before `geist` alphabetically). Single command: `npm install @fontsource-variable/fraunces`. Version verified by RESEARCH §Standard Stack.

---

## Shared Patterns

### Cross-cutting: Indonesian Rupiah formatting

**Source:** `src/lib/format.ts:1-29`
**Apply to:** `KalkulatorPage.tsx`, `KalkulatorInputRow.tsx`, `KalkulatorChart.tsx`, `KalkulatorTable.tsx`

```typescript
// src/lib/format.ts:1-13
const rupiahFmt = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatRupiah(n: number): string { return rupiahFmt.format(n) }
export function parseRupiah(s: string): number { … }   // handles "Rp 10.000.000" → 10000000
export function shortRupiah(n: number): string { … }   // 1.5jt / 2.3M abbreviated
```

Use `formatRupiah` for big-number output + table cells, `parseRupiah` for number-input onChange, `shortRupiah` for chart Y-axis tickFormatter (or inline `(v) => 'Rp ' + (v/1e6).toFixed(0) + 'jt'` per UI-SPEC).

### Cross-cutting: cn() utility

**Source:** `src/lib/utils.ts` (used by every shadcn component — verified in `src/components/ui/tooltip.tsx:6`, `src/components/ui/dropdown-menu.tsx:6`)
**Apply to:** `GlossaryTooltip.tsx`, all new shadcn-style class composition

```typescript
import { cn } from "@/lib/utils"
// usage:
className={cn("base-classes", customClass)}
```

### Cross-cutting: shadcn `data-slot` convention

**Source:** Every `src/components/ui/*.tsx` file uses `data-slot="…"` on Radix wrappers (e.g. `tooltip.tsx:14, 24, 30, 42`)
**Apply to:** `GlossaryTooltip.tsx` Popover sub-components — add `data-slot="glossary-tooltip-trigger"`, `data-slot="glossary-tooltip-content"` etc. for design-system consistency.

### Cross-cutting: Page wrapper `space-y-6`

**Source:** `src/tabs/kesehatan/KesehatanLayout.tsx:10` (`<div className="space-y-6">`) + `src/tabs/kesehatan/KesehatanLanding.tsx:95`
**Apply to:** `KesehatanModulLayout.tsx`, `KalkulatorPage.tsx` outer container.

### Cross-cutting: Memuat… loading placeholder

**Source:** `src/tabs/KekayaanTab.tsx:200-201` (text-only, no spinner — `<div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">Memuat…</div>`)
**Apply to:** `<Suspense fallback>` in `routes.tsx` for lazy modul layout / kalkulator. Use Indonesian "Memuat…" not "Loading".

---

## No Analog Found (Partial Matches)

Files where the codebase has no exact analog — planner should use RESEARCH.md patterns + the closest-role analogs above:

| File | Role | Data Flow | Reason | Fallback |
|------|------|-----------|--------|----------|
| `src/components/GlossaryTooltip.tsx` (Popover-based) | UI overlay | event-driven | Codebase has zero Popover usage (`Grep Popover` = 0 hits in src/). Tooltip exists but has wrong UX semantics per RESEARCH §Pitfall #2. | Combine `tooltip.tsx` (wrapper shape) + `dropdown-menu.tsx` (Portal+Content+Arrow Radix-singular pattern) — both verified above. |
| `src/tabs/kesehatan/KalkulatorChart.tsx` (LineChart) | chart | streaming-render | Codebase uses AreaChart + BarChart only — `Grep LineChart` = 0 hits in src/. | Use `SimulasiPanel.tsx:285-296` AreaChart pattern, swap `Area`→`Line`, `AreaChart`→`LineChart`. Recharts API is parallel for these primitives. ADD `isAnimationActive={false}` (RESEARCH §Pitfall #1 — analog doesn't need this because pensiun is step-based not real-time). |

---

## Metadata

**Analog search scope:**
- `src/tabs/kesehatan/**` (all 15 files in directory verified)
- `src/components/ui/*.tsx` (verified all 25 shadcn wrappers; tooltip + dropdown-menu most relevant)
- `src/components/PanduanFullPage.tsx` (closest prose+param-render analog)
- `src/tabs/pensiun/SimulasiPanel.tsx` (closest interactive calculator + Recharts analog)
- `src/tabs/KekayaanTab.tsx` (alternative Recharts AreaChart with linearGradient)
- `src/tabs/ReportsTab.tsx` (BarChart usage — reference for Recharts ResponsiveContainer height conventions)
- `src/lib/format.ts` (Rupiah formatting — single source of truth)
- `src/content/panduan.ts` (closest typed-content data file analog)
- `src/routes.tsx` (current nested-route structure)
- `src/index.css` (Tailwind v4 `@theme inline` token registration)
- `package.json` (dependency reference for fontsource convention)

**Files scanned:** ~30 (focused on Phase 15 footprint — kesehatan tab, ui components, recharts users, route config)

**Pattern extraction date:** 2026-05-10

---

## PATTERN MAPPING COMPLETE
