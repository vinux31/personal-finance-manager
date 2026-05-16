# Phase 15: Modul Edukasi & Kalkulator — Research

**Researched:** 2026-05-10
**Domain:** React content authoring (TSX prose) + interactive financial calculator (Recharts) + accessibility tooltip (Radix) + custom typography (Tailwind v4 + @fontsource-variable)
**Confidence:** HIGH (stack verified against installed packages + npm registry on date; 1 critical pivot flagged below for Radix Tooltip mobile)

## Summary

Phase 15 sits in **mature greenfield territory**: all heavy lifting (radix-ui ^1.4.3, Recharts ^3.8.1, react-router-dom ^7, Tailwind v4, shadcn radix-nova preset) is already installed and battle-tested across Phases 12–14. The remaining work is wiring + content authoring, with **three technical inflection points** that planner must internalize:

1. **Source content is JS data, not HTML markup.** `docs/financial_framework.html` lines 1167–1383 store all 6 modul as a JavaScript `const modules = [...]` array, *not* as static HTML sections. Port strategy is "parse the JS data structure → JSX render", not "extract HTML chunks." This is 10× faster than tag-by-tag conversion and inherently preserves the `<em>`, `<strong>`, `<p class="pull">` formatting already encoded in the data strings.

2. **Radix Tooltip CANNOT do tap-to-open natively.** UI-SPEC §Interaction states "Tap (mobile) | Tooltip opens immediately on tap, stays open until tap outside or scroll" — but **Radix Tooltip is hover/focus only by W3C-compliant design**. Verified via radix-ui/primitives Discussion #2866 + Issue #1573 + Issue #2589: maintainers explicitly recommend Popover or Toggletip pattern, NOT Tooltip, for click-to-open. Plan must either (a) implement controlled-state hack using `open` prop + `onClick` on TooltipTrigger (risky, fights primitive), or (b) **build `GlossaryTooltip` on Radix Popover under the hood while keeping the `<GlossaryTooltip>` API**. Option (b) is recommended — D-14 contract preserved, mobile UX correct, accessibility better (Popover handles focus + Esc + outside-click natively).

3. **Recharts re-render on slider drag**: with D-07 "real-time recalc, no debounce", the chart will receive new `data` array on every drag tick (~60Hz). Default Recharts animation (1500ms) will visibly interfere. Solution: `isAnimationActive={false}` on the `<Line>` component (NOT on `<LineChart>` parent — animation control is per-shape in Recharts v3). Verified pattern + memoize chart data with `useMemo` to cut React reconciliation cost.

**Primary recommendation:** Build `GlossaryTooltip` on **Radix Popover** (not Radix Tooltip) while keeping the `<GlossaryTooltip term="dca">DCA</GlossaryTooltip>` JSX API. Port modul prose by copying the `modules` JS array verbatim into a new `src/data/modulContent.ts` file, then render via a generic `<ModulRenderer />` component instead of 6 hand-written prose TSX files. This collapses 6 plan tasks into 1 data file + 1 renderer + 6 thin wrappers (slug → content lookup). Document the Radix-Popover-as-Tooltip pivot prominently — the UI-SPEC was written before this constraint surfaced.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Konten Modul — Sourcing & Storage:**
- **D-01 (Sourcing):** Port konten verbatim dari `docs/financial_framework.html` (1515 baris HTML). Minimal edit, replace istilah teknis dengan `<GlossaryTooltip>` wrap manual. Adaptasi konten ke user data = deferred v2.
- **D-02 (Storage format):** TSX prose hardcoded per modul. 6 file komponen di `src/tabs/kesehatan/modul/`:
  - `ArusKasModul.tsx` → `/kesehatan/arus-kas`
  - `TujuanModul.tsx` → `/kesehatan/tujuan`
  - `AlokasiAsetModul.tsx` → `/kesehatan/alokasi-aset`
  - `InstrumenModul.tsx` → `/kesehatan/instrumen`
  - `PajakBiayaInflasiModul.tsx` → `/kesehatan/pajak-biaya-inflasi`
  - `PerilakuModul.tsx` → `/kesehatan/perilaku`
- **D-03 (No MDX):** Tidak install `@mdx-js/rollup` atau remark plugin. Glossary wiring manual dgn `<GlossaryTooltip term="DCA">DCA</GlossaryTooltip>`.
- **D-04 (Quick-check):** Render prose-only static (bullet "Coba jawab: 1. ... 2. ... 3. ..."). No input field, no state, no tracking.
- **D-05 (Footer nav):** Prev/next button (urut catalog `MODUL_CATALOG`) + link "Lihat semua modul → /kesehatan". Wrap-around (modul 6 next = modul 1).

**Kalkulator Compound Interest:**
- **D-06 (Input control):** Slider + number input combo per parameter (saldo awal Rp 0–1M / step 100rb; setoran bulanan Rp 0–50jt / step 50rb; return tahunan 0–25% / step 0.5%; tenor 1–40 thn / step 1).
- **D-07 (Recalc):** Real-time on change. No debounce.
- **D-08 (Chart):** Recharts `<LineChart>` 1 line nilai total per tahun.
- **D-09 (Tabel):** 5-tahunan fix. Row tahun {5,10,15,20,25,30,35,40} filter ≤ tenor.
- **D-10 (Math formula):** FV annuity = `P × (1+r)^n + PMT × ((1+r)^n − 1) / r` per bulan, agg per tahun.
- **D-11 (Output info):** Big number nilai akhir + sub-info Total Setoran + Total Bunga (warna hijau).

**Glossary Tooltip:**
- **D-12 (Mekanisme):** Manual wrap `<GlossaryTooltip term="DCA">DCA</GlossaryTooltip>` di TSX prose. No auto-detect runtime.
- **D-13 (Source dictionary):** `src/data/glossary.ts` — const object 8 entry, type-safe `Record<GlossaryTerm, {label, definition}>`.
- **D-14 (Mobile behavior):** Tap-to-open Radix Tooltip default (tap istilah → tooltip muncul, tap di luar / scroll → close).
- **D-15 (Visual hint):** `border-b border-dotted border-muted-foreground cursor-help` di trigger element.

**Modul UX Detail:**
- **D-16 (Font load):** `@fontsource/fraunces` package (npm install). Dynamic import di `KesehatanModulLayout` parent route. Self-hosted, no Google Fonts external request. Subset weight 400 + 600.
- **D-17 (Layout):** Centered prose `max-w-[65ch] mx-auto px-4`. Body Fraunces serif, Inter (Geist) tetap default untuk breadcrumb + chrome.
- **D-18 (Breadcrumb):** 2-level — `Kesehatan / <Modul>`. "Kesehatan" link, current page no link, top of page above prose body.
- **D-19 (Header sticky):** Static (scroll dgn page). AppShell topbar/sidebar tetap sticky di luar.
- **D-20 (Kalkulator typography):** Inter (Geist) sans (NOT Fraunces). Kalkulator UI = tools, bukan modul prose.

**UI-SPEC final overrides:**
- Type scale: 14/18/28/36 (4 sizes), weights 400+600 only
- Geist Variable (NOT Inter — spec §8 outdated)
- `--font-serif: 'Fraunces Variable'` add to `@theme inline`
- Chart line green-500 semantic, brand indigo for action affordance only

### Claude's Discretion

- **Tone of voice prose modul** — port verbatim; Claude boleh light-edit untuk konsistensi gaya pfm-web. Tidak boleh tambah konten baru.
- **Code/SQL example handling di prose** — pakai `<pre><code>` styled (default mono).
- **Studi kasus mata uang** — convert USD ke Rp wajar tanpa edit substansi pedagogis.
- **Breakpoint kalkulator mobile** — slider dominant + number input collapse ke 2-row di mobile vs single row.
- **Test strategy** — minimum 1 Vitest unit (kalkulator math), 1 component test (GlossaryTooltip), 1 Playwright UAT (navigation + tooltip + slider). Snapshot test optional.
- **Glossary trigger element type** — `<span tabIndex=0 role="button">` recommended.

### Deferred Ideas (OUT OF SCOPE)

- Modul "Warisan & Estate Planning" (Tier 4 cuma checklist)
- Quiz tracking / score persistence
- Kalkulator suite tambahan (real return, expense drag, retirement gap, IPS Builder)
- Risk tolerance quiz interaktif
- Behavior gap detector
- Adaptasi konten modul ke user-data pfm-web (v1 verbatim, v2 inkremental)
- Asset class normalization (DIAG-08 trust user input v1)
- Tier panel "shareable snapshot" / export PDF
- Modul reading time tracking + completion badge
- Multi-language support
- Print-friendly modul styling
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **STRAT-04** | User akses 6 modul edukasi via sub-route `/kesehatan/<slug>` dengan slug Indonesian: `arus-kas`, `tujuan`, `alokasi-aset`, `instrumen`, `pajak-biaya-inflasi`, `perilaku`. Modul prose pakai typography Fraunces serif. | §Standard Stack: `@fontsource-variable/fraunces ^5.2.9`. §Architecture Patterns: ModulRenderer pattern (Pattern 1). §Code Examples: Tailwind v4 `@theme inline --font-serif` registration. §Pitfall #4: FOUT mitigation. |
| **STRAT-05** | User akses kalkulator compound interest via `/kesehatan/kalkulator` (full page) + teaser banner di landing. Kalkulator punya slider + number input + grafik tahun-per-tahun + tabel 5-tahunan. | §Standard Stack: Recharts ^3.8.1 already installed. §Architecture Patterns: Slider+Input combo (Pattern 2), FV annuity reducer (Pattern 3). §Pitfall #1: Recharts animation flicker on real-time recalc. §Code Examples: useMemo pattern for chart data. |
| **STRAT-06** | 8 istilah teknis (Asset Allocation, Real Return, Sharpe Ratio, DCA, Drawdown, Expense Ratio, Rebalancing, Risk Tolerance) tampil sebagai tooltip inline (Radix Tooltip) di angka teknis modul. | §Standard Stack: radix-ui ^1.4.3 already installed. §Pitfall #2 (CRITICAL): Radix Tooltip is NOT click-to-open — must use Popover. §Architecture Patterns: GlossaryTooltip-on-Popover (Pattern 4). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Modul prose rendering | Browser/Client (React route) | — | Static content, hydrated client-side via react-router. No API needed. |
| Glossary tooltip popup | Browser/Client (React + Radix Popover) | — | Pure UI overlay, dictionary is bundled JS const (`src/data/glossary.ts`). |
| Compound interest math | Browser/Client (pure JS function) | — | O(n) where n ≤ 480 iterations, sub-millisecond. No backend needed. D-10 formula deterministic. |
| Recharts visualization | Browser/Client (Recharts SVG) | — | Pure render of in-memory data array. |
| Font asset delivery | CDN/Static (Vite bundler) | Browser/Client | `@fontsource-variable/fraunces` ships woff2 files via `node_modules` → Vite bundles → served from `/assets/`. No CDN external fetch. |
| Routing | Browser/Client (react-router-dom v7) | — | Existing `<Outlet />` pattern in `KesehatanLayout.tsx`. |
| State management (kalkulator) | Browser/Client (React `useState`) | — | Local component state, no global store, no URL persistence (unless planner opts in via Specifics hint). |

**No backend / database / API layer touched in this phase.** Phase 15 is 100% client-side feature work. RLS, Supabase, schema migrations all skipped. View-As mode irrelevant (modul are read-only static content).

## Standard Stack

### Core (already installed — verify-only)

| Library | Version (verified) | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| `recharts` | ^3.8.1 (registry: 3.8.1, current) | Chart `<LineChart>` for compound growth visualization | [VERIFIED: npm view recharts version] Already used in `src/tabs/pensiun/SimulasiPanel.tsx` (AreaChart pattern). Charting library blessed by shadcn ecosystem. |
| `radix-ui` | ^1.4.3 (registry: 1.4.3, current) | Tooltip + Popover primitives. Project uses singular `radix-ui` package (NOT split `@radix-ui/*` packages) — confirmed via `import { Tooltip as TooltipPrimitive } from "radix-ui"` in `src/components/ui/tooltip.tsx`. | [VERIFIED: package.json + src import] |
| `react-router-dom` | ^7.14.2 | Nested `<Outlet />` routing for `/kesehatan/<slug>` sub-routes | [VERIFIED: src/routes.tsx already wires kesehatan parent route at line 33-39] |
| `tailwindcss` | ^4.2.2 (Tailwind v4) | Utility CSS + `@theme inline` font registration | [VERIFIED: `@tailwindcss/vite ^4.2.2` + `@import "tailwindcss"` in src/index.css line 1] |
| `@fontsource-variable/geist` | ^5.2.8 | Geist Variable sans for chrome (existing) | [VERIFIED: package.json + index.css `@import "@fontsource-variable/geist"` line 4 + `--font-sans: 'Geist Variable', sans-serif` line 10] |
| `lucide-react` | ^1.8.0 | Icons (already used in `MODUL_CATALOG`) | [VERIFIED: package.json] |

### Supporting (NEW — install in Phase 15)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fontsource-variable/fraunces` | **^5.2.9** (latest, published 7 months ago) | Self-hosted Fraunces variable font (single woff2 covers weights 100–900) | [VERIFIED: npm view @fontsource-variable/fraunces version on 2026-05-10 → 5.2.9] **Strongly recommend variable variant** over `@fontsource/fraunces` (also 5.2.9): variable = single ~190KB woff2 vs 6 separate static woff2 files (one per weight). Project already uses variable pattern for Geist (`@fontsource-variable/geist`) — consistency. CSS family-name: `"Fraunces Variable"` (must match Geist convention). Weights 400 + 600 used per UI-SPEC; variable axis allows both without extra payload. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@fontsource-variable/fraunces` (recommended) | `@fontsource/fraunces` (static weights, D-16 default) | Static = 6 woff2 files (~30KB each = ~180KB total for weights 400 + 600). Variable = 1 woff2 file (~190KB) covering all weights. Negligible payload diff. **Variable wins on:** consistency with existing `@fontsource-variable/geist`, future-proof if UI-SPEC ever adds weight 700, cleaner Tailwind registration (`'Fraunces Variable'` vs `'Fraunces'`). [CITED: fontsource.org/fonts/fraunces/install] |
| Radix **Tooltip** primitive (D-14 spec assumption) | Radix **Popover** primitive (recommended) | **Tooltip is hover-only by W3C ARIA design and won't open on mobile tap.** Popover handles focus management, outside-click, Esc, and is touch-native. See Pitfall #2 below. The `<GlossaryTooltip>` JSX API stays the same — internal implementation swaps. |
| Recharts default animation | `isAnimationActive={false}` per-`<Line>` | Default 1500ms animation visibly flickers on real-time slider drag (D-07 no debounce). Disable animation on the data line; keep tooltip fade-in animation. See Pitfall #1. |
| 6 hand-written prose TSX files (D-02 literal) | Single `<ModulRenderer/>` + `src/data/modulContent.ts` data file (RECOMMENDED PIVOT) | D-02 says "TSX prose hardcoded per modul" — but the source HTML *already* stores content as a JS `const modules = [...]` array (lines 1167–1383). Porting this array verbatim is 10× faster than 6 hand-typed JSX files. The 6 modul TSX files become 3-line wrappers: `<ModulRenderer slug="arus-kas" />`. Data-driven, easy to glossary-wrap (regex on definition strings), no MDX needed. **Spec compliance:** D-02 wants "no MDX, no remark plugin" — using `dangerouslySetInnerHTML` for the inline `<em>`/`<strong>`/`<p class="pull">` markup in source strings, OR converting to JSX-safe sanitized renderer, satisfies the "no MDX" constraint while still using TSX. Planner discretion D-02 says "or equivalent" file path — equivalent applies. |
| `dangerouslySetInnerHTML` for source HTML strings | DOMParser → React.createElement walker | dangerouslySetInnerHTML is acceptable here because content is **trusted authored prose**, not user input. XSS risk = zero (no template injection, content is hardcoded in repo). Saves 50+ lines of parser logic. Glossary wrap via post-processing regex BEFORE setting innerHTML, OR via React portal that walks rendered DOM (more complex — defer to v2). **Recommended v1:** dangerouslySetInnerHTML + author manually adds `<span data-glossary="dca">DCA</span>` markers in source data file, then a `<ModulRenderer/>` `useEffect` hook scans for these markers and replaces with `<GlossaryTooltip>` portals. |

**Installation:**
```bash
npm install @fontsource-variable/fraunces
```

That is the **only** new dependency for Phase 15.

**Version verification:**
```bash
npm view @fontsource-variable/fraunces version
# → 5.2.9 (verified 2026-05-10, published 7 months ago)
```

## Architecture Patterns

### System Architecture Diagram

```
                  ┌──────────────── User Browser ────────────────┐
                  │                                              │
                  │   /kesehatan         /kesehatan/<slug>       │
                  │   (landing)          (modul or kalkulator)   │
                  │       │                      │               │
                  │       └─────┬────────────────┘               │
                  │             │                                │
                  │     react-router-dom v7                      │
                  │     <Outlet/> in KesehatanLayout             │
                  │             │                                │
                  │   ┌─────────┴──────────────────────┐        │
                  │   │                                │        │
                  │   ▼                                ▼        │
                  │  KesehatanLanding              7 child       │
                  │  (existing, untouched)         routes        │
                  │                                NEW Phase 15  │
                  │   ┌────────────────────────────────────┐    │
                  │   │                                    │    │
                  │   ▼                                    ▼    │
                  │  KesehatanModulLayout              Kalkulator│
                  │  ├─ Breadcrumb                     Compound  │
                  │  ├─ <Outlet/> →                    │         │
                  │  │   ModulRenderer                 ├─ Input   │
                  │  │   ├─ reads modulContent.ts      │  Card    │
                  │  │   ├─ wraps glossary terms       │  (4 row) │
                  │  │   └─ Fraunces serif body        │   ├─ Slider │
                  │  └─ ModulFooterNav                 │   └─ NumInput│
                  │                                    ├─ FV math │
                  │                                    │  reducer │
                  │                                    ├─ Recharts│
                  │                                    │  LineChart│
                  │                                    └─ Table   │
                  │                                       5-yr    │
                  │                                              │
                  │   ┌──────── shared inline ───────┐           │
                  │   │  <GlossaryTooltip term=…>    │           │
                  │   │   reads glossary.ts (const)  │           │
                  │   │   renders Radix POPOVER      │ ← critical │
                  │   │   (NOT Tooltip — see Pf #2)  │   pivot    │
                  │   └──────────────────────────────┘           │
                  │                                              │
                  └──────────────────────────────────────────────┘

  Build-time only:
  Vite bundler ─── @fontsource-variable/fraunces (woff2)
                ─── @fontsource-variable/geist (existing woff2)
                ─── radix-ui (Popover + Tooltip primitives)
                ─── recharts ESM
```

Data flow: route param `slug` → ModulRenderer reads `src/data/modulContent.ts[slug]` → renders prose with glossary markers replaced by `<GlossaryTooltip>` (which reads `src/data/glossary.ts[term]`). Kalkulator: 4 controlled inputs → `useMemo(() => computeFV(state), [state])` → feeds Recharts data + table rows. No async, no fetch, no server.

### Recommended Project Structure

```
src/
├── data/
│   ├── glossary.ts            # NEW — D-13 dictionary (8 entries)
│   └── modulContent.ts        # NEW — port from financial_framework.html lines 1167-1383
├── components/
│   └── GlossaryTooltip.tsx    # NEW — Radix Popover-based (NOT Tooltip)
├── tabs/kesehatan/
│   ├── KesehatanModulLayout.tsx    # NEW — breadcrumb + max-w-[65ch] + Fraunces lazy
│   ├── ModulFooterNav.tsx          # NEW — prev/next from MODUL_CATALOG
│   ├── ModulRenderer.tsx           # NEW — generic renderer reading modulContent.ts
│   ├── modul/
│   │   ├── ArusKasModul.tsx        # NEW — 3-line wrapper: <ModulRenderer slug="arus-kas"/>
│   │   ├── TujuanModul.tsx         # NEW (same pattern)
│   │   ├── AlokasiAsetModul.tsx    # NEW
│   │   ├── InstrumenModul.tsx      # NEW
│   │   ├── PajakBiayaInflasiModul.tsx  # NEW
│   │   └── PerilakuModul.tsx       # NEW
│   ├── kalkulator/
│   │   ├── KalkulatorCompound.tsx  # NEW — page entry
│   │   ├── KalkulatorInputRow.tsx  # NEW — slider + number input combo
│   │   ├── KalkulatorChart.tsx     # NEW — Recharts wrapper
│   │   ├── KalkulatorTable.tsx     # NEW — 5-yearly breakdown
│   │   └── computeFV.ts            # NEW — D-10 formula, pure function
│   ├── KesehatanLayout.tsx         # MODIFY — minimal (already has <Outlet/>)
│   ├── KesehatanLanding.tsx        # UNTOUCHED Phase 15
│   ├── KalkulatorBanner.tsx        # MODIFY — remove toast.info, wire <Link to="/kesehatan/kalkulator">
│   └── modulCatalog.ts             # UNTOUCHED (LOCKED per CONTEXT.md)
├── routes.tsx                      # MODIFY — add 7 child routes under kesehatan parent
└── index.css                       # MODIFY — add @import "@fontsource-variable/fraunces" + --font-serif
```

### Pattern 1: ModulRenderer (data-driven prose)

**What:** Single component that reads modul content from a typed JS data file and renders Fraunces-styled prose with glossary markers expanded.

**When to use:** Any time you have N similar pages whose ONLY difference is text content. Avoids 6× duplication.

**Example:**
```tsx
// src/data/modulContent.ts
export type ModulSlug = 'arus-kas' | 'tujuan' | 'alokasi-aset' | 'instrumen' | 'pajak-biaya-inflasi' | 'perilaku'

export type ModulSection =
  | { kind: 'theory'; head: string; body: string; list?: string[]; pull?: string }
  | { kind: 'practice'; head: string; case: { title: string; body: string; tag: string } }
  | { kind: 'check'; intro: string; questions: string[] }  // D-04 prose-only

export type ModulData = {
  slug: ModulSlug
  number: string         // '01' .. '06'
  title: string          // exact label from MODUL_CATALOG
  stage: string          // 'PROTECTION', 'PLANNING', etc.
  readingTimeMin: number // for optional badge
  sections: ModulSection[]
}

export const MODUL_CONTENT: Record<ModulSlug, ModulData> = {
  'arus-kas': {
    slug: 'arus-kas',
    number: '01',
    title: 'Pondasi & Cash Flow',
    stage: 'PROTECTION',
    readingTimeMin: 8,
    sections: [
      {
        kind: 'theory',
        head: 'Teori Inti',
        body: 'Stabilitas cash flow adalah <em>oksigen</em> untuk semua keputusan finansial selanjutnya. Tanpa surplus bulanan yang konsisten, investasi hanya akan dilikuidasi saat darurat — sering pada timing terburuk.',
        pull: '"Investing should be more like watching paint dry. If you want excitement, take Rp 12 jt and go to Las Vegas." — Paul Samuelson',
        list: [
          '<strong>[[Savings Rate]]</strong>: (Pemasukan − Pengeluaran) / Pemasukan. Target intermediate: 20–30%.',
          '<strong>Emergency Fund Ratio</strong>: Dana likuid / pengeluaran bulanan. Target: 6–12× untuk freelancer, 3–6× untuk karyawan tetap.',
          '<strong>Debt-to-Income</strong>: Cicilan bulanan / take-home. Maksimal 30%, idealnya kurang dari 20%.',
        ],
      },
      // ... practice + check sections
    ],
  },
  // ... 5 more entries
}
```

```tsx
// src/tabs/kesehatan/ModulRenderer.tsx
import { MODUL_CONTENT, type ModulSlug } from '@/data/modulContent'
import GlossaryTooltip from '@/components/GlossaryTooltip'

const GLOSSARY_MARKER = /\[\[(\w[\w\s-]*)\]\]/g  // matches [[term]]

function renderProseHTML(html: string): React.ReactNode {
  // Split on glossary markers, wrap each as <GlossaryTooltip>
  const parts = html.split(GLOSSARY_MARKER)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <GlossaryTooltip key={i} term={termSlug(part)}>{part}</GlossaryTooltip>
    ) : (
      <span key={i} dangerouslySetInnerHTML={{ __html: part }} />
    ),
  )
}

export default function ModulRenderer({ slug }: { slug: ModulSlug }) {
  const data = MODUL_CONTENT[slug]
  return (
    <article className="font-serif">
      <h1 className="text-4xl font-semibold leading-tight">{data.title}</h1>
      {data.sections.map((s, i) => (
        <section key={i} className="mt-12">
          {s.kind === 'theory' && (
            <>
              <h2 className="text-3xl font-semibold mb-4">{s.head}</h2>
              <div className="text-lg leading-relaxed">{renderProseHTML(s.body)}</div>
              {s.pull && (
                <p className="text-lg italic border-l-4 border-muted pl-6 my-8">
                  {renderProseHTML(s.pull)}
                </p>
              )}
              {s.list && (
                <ul className="text-lg leading-relaxed space-y-2 mt-4">
                  {s.list.map((item, j) => <li key={j}>{renderProseHTML(item)}</li>)}
                </ul>
              )}
            </>
          )}
          {/* practice + check rendering similar */}
        </section>
      ))}
    </article>
  )
}
```

**Authoring convention:** In `modulContent.ts`, wrap glossary terms in `[[...]]` markers. Author writes `[[Savings Rate]]` and `[[DCA]]`; the renderer auto-replaces with `<GlossaryTooltip>` (looking up the lowercase-slug version). This satisfies D-12 ("manual wrap") because the marker is hand-placed, but uses regex to do the JSX wiring at render time. No runtime auto-detect on arbitrary text.

**Spec compliance check:** D-02 ("TSX prose hardcoded per modul") — the per-modul TSX file still exists (`ArusKasModul.tsx`), it just delegates to `<ModulRenderer slug="arus-kas"/>`. Each modul TSX is a 3-line wrapper. Not a violation; planner has discretion on file structure. D-03 ("No MDX") respected — no `@mdx-js/*` package, no remark, no compile step.

### Pattern 2: Slider + Number Input combo (controlled, two-way bound)

**What:** Single source of truth in parent state; both slider and number input read+write the same value.

**Example:**
```tsx
// src/tabs/kesehatan/kalkulator/KalkulatorInputRow.tsx
import { Slider } from '@/components/ui/slider'
import { formatRupiah, parseRupiah } from '@/lib/format'
import { useState } from 'react'

type Props = {
  label: string
  helper?: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  format?: 'rupiah' | 'percent' | 'integer'
}

export default function KalkulatorInputRow({ label, helper, value, onChange, min, max, step, format = 'rupiah' }: Props) {
  const [focused, setFocused] = useState(false)

  const display = focused
    ? String(value)  // raw on focus
    : format === 'rupiah'
      ? formatRupiah(value)        // "Rp 10.000.000"
      : format === 'percent'
        ? `${value}%`
        : String(value)

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <label className="text-sm font-normal tracking-wide uppercase text-muted-foreground">{label}</label>
          {helper && <p className="text-sm text-muted-foreground">{helper}</p>}
        </div>
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const parsed = format === 'rupiah' ? parseRupiah(e.target.value) : Number(e.target.value.replace(/[^\d.-]/g, ''))
            const clamped = Math.min(Math.max(parsed, min), max)
            onChange(clamped)
          }}
          className="text-lg font-normal tabular-nums text-right border rounded-md px-3 py-1 w-32 sm:w-40"
        />
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  )
}
```

**Key points:**
- Existing `formatRupiah`/`parseRupiah` from `src/lib/format.ts` already handles `'id-ID'` thousand-separator + decimal — reuse, don't reimplement.
- `focused` state strips formatting on focus (so user can type raw) and re-formats on blur. Standard pattern.
- Number input clamping via `Math.min(Math.max(...))` — silent, no error UI per UI-SPEC.
- Shadcn `Slider` (`src/components/ui/slider.tsx`) is a thin wrapper over HTML range input — no Radix Slider primitive used. Confirmed.

### Pattern 3: FV Annuity Reducer (D-10 formula)

**What:** Pure function that takes `{P, PMT, annualReturnPct, years}` and returns array of `{year, totalContrib, totalInterest, value}` for chart + table.

**Example:**
```ts
// src/tabs/kesehatan/kalkulator/computeFV.ts

export type FVInput = {
  saldoAwal: number       // P
  setoranBulanan: number  // PMT
  returnTahunanPct: number  // 0..25 (will divide by 100)
  tenorTahun: number      // 1..40
}

export type FVYearRow = {
  tahun: number           // 0..tenorTahun
  totalSetoran: number    // P + PMT × 12 × tahun
  totalBunga: number      // value − totalSetoran
  nilaiAkhir: number      // value
}

export function computeFV(input: FVInput): FVYearRow[] {
  const { saldoAwal: P, setoranBulanan: PMT, returnTahunanPct, tenorTahun } = input
  const r = returnTahunanPct / 100 / 12  // monthly rate
  const rows: FVYearRow[] = []

  // Year 0 (start point — render on chart)
  rows.push({ tahun: 0, totalSetoran: P, totalBunga: 0, nilaiAkhir: P })

  for (let y = 1; y <= tenorTahun; y++) {
    const n = y * 12  // months elapsed
    let value: number
    if (r === 0) {
      // Edge case: zero return — pure linear contribution
      value = P + PMT * n
    } else {
      // FV annuity formula per D-10: P × (1+r)^n + PMT × ((1+r)^n − 1) / r
      const compound = Math.pow(1 + r, n)
      value = P * compound + PMT * (compound - 1) / r
    }
    const totalSetoran = P + PMT * n
    const totalBunga = value - totalSetoran
    rows.push({
      tahun: y,
      totalSetoran: Math.round(totalSetoran),
      totalBunga: Math.round(totalBunga),
      nilaiAkhir: Math.round(value),
    })
  }
  return rows
}
```

**Edge cases handled:**
- `r === 0` → pure linear (avoid divide-by-zero).
- `tenorTahun = 1` → 2 rows (year 0 + year 1).
- `tenorTahun = 40, PMT = 50_000_000, returnPct = 25` → max plausible inputs, `value ≈ Rp 4.7 trilliun` — JavaScript Number safely handles up to 2^53 ≈ 9 quadrillion, so no precision loss.
- All values rounded to integer (Rp doesn't use decimals at this scale).

**Performance:** Single loop, max 40 iterations. Sub-millisecond. No memo strictly needed, but use `useMemo(() => computeFV(state), [state])` anyway to skip work on unrelated re-renders.

### Pattern 4: GlossaryTooltip on Radix Popover (CRITICAL PIVOT from spec)

**What:** Component with `<GlossaryTooltip term={X}>{children}</GlossaryTooltip>` API but using Radix **Popover** primitive internally. UI-SPEC API contract preserved; underlying primitive swaps.

**Why:** See Pitfall #2 below — Radix Tooltip is hover/focus only by W3C ARIA design; tap-to-open on mobile is impossible without abandoning the primitive's accessibility guarantees.

**Example:**
```tsx
// src/components/GlossaryTooltip.tsx
import { Popover as PopoverPrimitive } from "radix-ui"
import { GLOSSARY, type GlossaryTerm } from '@/data/glossary'

type Props = {
  term: GlossaryTerm
  children: React.ReactNode
}

export default function GlossaryTooltip({ term, children }: Props) {
  const entry = GLOSSARY[term]
  if (!entry) {
    if (import.meta.env.DEV) console.warn(`[GlossaryTooltip] Unknown term: ${term}`)
    return <>{children}</>  // graceful fallback
  }
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <span
          tabIndex={0}
          role="button"
          aria-label={`Definisi ${entry.label}`}
          className="border-b border-dotted border-muted-foreground cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 rounded-sm"
        >
          {children}
        </span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align="center"
          sideOffset={6}
          collisionPadding={8}
          className="max-w-xs rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md font-sans z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
        >
          <div className="font-semibold mb-0.5">{entry.label}</div>
          <div className="leading-relaxed">{entry.definition}</div>
          <PopoverPrimitive.Arrow className="fill-popover" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
```

**What Popover gives you for free:**
- ✓ Click/tap to open on touch devices (D-14 native, no hack)
- ✓ Click outside to close (`onPointerDownOutside` built-in)
- ✓ Esc to close
- ✓ Focus management (focus moves to popover content)
- ✓ `aria-expanded` on trigger (accessibility)
- ✓ Collision detection (auto-flip side at viewport edge)

**What you lose vs Tooltip:**
- ✗ Hover-to-open on desktop (Popover is click-only)
- → **Mitigation:** Add `onMouseEnter` to Trigger that programmatically opens the Popover, with controlled `open` state. OR accept click-only on desktop too (consistent UX, less code, accessible). UI-SPEC §Interaction implies hover desktop + tap mobile — to honor both, use controlled `open` state with custom hover handler:

```tsx
function GlossaryTooltip({ term, children }: Props) {
  const [open, setOpen] = useState(false)
  const entry = GLOSSARY[term]
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        asChild
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <span /* ... */>{children}</span>
      </PopoverPrimitive.Trigger>
      {/* ... */}
    </PopoverPrimitive.Root>
  )
}
```

**One gotcha:** `onMouseLeave` fires when cursor moves to the Popover content itself; this would auto-close. Standard fix: also listen to mouseenter/leave on the content element with a `setTimeout(setOpen(false), 100)` debounce. Or: only use hover-to-open when `matchMedia('(hover: hover)').matches` (desktop), use click-only on touch. The complexity here is a real cost — alternative is **click-only on all devices**, which is consistent and 50% less code.

**Recommendation:** Click-only on all devices, with focus visible ring as discoverability hint + dotted underline already in spec. UI-SPEC § Interaction states is overspecified relative to what's achievable; planner should align with the popover primitive's strengths.

### Anti-Patterns to Avoid

- **Don't try to make Radix Tooltip work for tap-to-open.** People have tried. Maintainers explicitly say "use Popover instead." Trying controlled `open` + `onClick` on TooltipTrigger fights the primitive's intended W3C-compliant behavior. Several side effects: tooltip dismisses on next pointerdown event (Radix internal), Esc handling conflicts with TooltipProvider scoping, focus return is glitchy. Verified via [GitHub #1573](https://github.com/radix-ui/primitives/issues/1573), [#2589](https://github.com/radix-ui/primitives/issues/2589), [#2866](https://github.com/radix-ui/primitives/discussions/2866).
- **Don't recompute compound interest on every keystroke without `useMemo`.** Even though math is fast, React reconciliation of Recharts SVG can be expensive. Memoize the data array.
- **Don't use Recharts' default animation on a real-time chart.** UX is worse — line "swims" on every drag tick. Disable per-`<Line>` animation; keep tooltip animation.
- **Don't import Fraunces in the global `index.css`.** That defeats D-16 ("lazy at modul route"). But also DON'T over-engineer with React.lazy + Suspense + dynamic import — Vite handles `import "@fontsource-variable/fraunces"` inside a route component as a separate chunk automatically when using code-splitting via `React.lazy()` for the route component. Simpler: import Fraunces in `KesehatanModulLayout.tsx` (the parent of the 6 modul routes) — it loads only when user enters `/kesehatan/<slug>`, and Vite chunks the layout if the layout is `React.lazy`-imported in `routes.tsx`. **Concrete recommendation:** wrap `KesehatanModulLayout` import in `React.lazy(() => import('@/tabs/kesehatan/KesehatanModulLayout'))` and the `@import "@fontsource-variable/fraunces"` will be in that chunk.
- **Don't add Fraunces to landing route or kalkulator route.** UI-SPEC §Typography is explicit: chrome + kalkulator = Geist. Loading Fraunces on `/kesehatan` landing wastes bandwidth.
- **Don't write the kalkulator state as 4 separate `useState` calls.** Use a single state object (or `useReducer`) so memoization keys are stable.
- **Don't `<form onSubmit>` the kalkulator.** No submission needed — D-07 is real-time.
- **Don't skip `tabIndex=0` on `<span>` glossary trigger.** Without it, keyboard users cannot reach the trigger. Spec D-15 implies span; tabIndex=0 + role="button" makes it accessible (planner Discretion confirmed).
- **Don't use Tailwind v3 `tailwind.config.js` patterns.** This project is Tailwind v4 with `@theme inline` in `src/index.css`. Confirmed line 8 of index.css. v3 patterns won't apply.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tap-to-open mobile tooltip | Custom touch handler on hover-only primitive | **Radix Popover** primitive | Built-in focus management, outside-click, Esc, ARIA. 50+ edge cases handled. |
| Rupiah formatting | New `Intl.NumberFormat` instance per render | Existing `formatRupiah` / `parseRupiah` from `src/lib/format.ts` | Already used in 12+ components. Single locale config. |
| Slider component | Custom range input styling | Existing `src/components/ui/slider.tsx` (HTML range thin wrapper) | Already used in `src/tabs/pensiun/SimulasiPanel.tsx`. Project pattern. |
| Compound interest math | Approximation / iterative monthly accrue loop | Closed-form FV annuity formula `P × (1+r)^n + PMT × ((1+r)^n − 1) / r` | D-10 LOCKED. Closed-form is O(1) per year, exact, no rounding error. |
| Font loading optimization | Custom `<link rel="preload">` + FontFace API + flash detection | `@fontsource-variable/fraunces` package + `font-display: swap` (default) | Self-hosted, npm-bundled, Vite chunks it, no network round-trip to fonts.googleapis.com, no privacy/GDPR concern. |
| Radix Popover positioning | Custom viewport-edge collision logic | `collisionPadding={8}` prop on `PopoverContent` | Auto-flip side, viewport boundary respect. |
| Recharts axis Rp formatter | Custom format string parser | `tickFormatter={(v) => shortRupiah(v)}` reusing existing `shortRupiah` from `src/lib/format.ts` | Already returns "Rp 12 jt" / "Rp 1.2 M" pattern matching UI-SPEC `--font-sans` chart labels. |
| Glossary term lookup | Map / state hook / context | Static const `Record<GlossaryTerm, ...>` from `src/data/glossary.ts` | TypeScript exhaustive type-check at compile time. Zero runtime cost. |
| Modul prev/next nav with wrap-around | Custom array navigation logic | `MODUL_CATALOG.findIndex(m => m.slug === currentSlug)` + modulo arithmetic | One-liner. `MODUL_CATALOG` is the locked source of truth. |

**Key insight:** Phase 15 is **almost entirely composition of existing primitives**. The only NEW thing being introduced is `@fontsource-variable/fraunces` package. Everything else is wiring existing tools (radix-ui, recharts, react-router-dom, Tailwind v4, formatRupiah, MODUL_CATALOG) into a new feature. The risk surface is small.

## Common Pitfalls

### Pitfall 1: Recharts animation flicker on real-time data updates

**What goes wrong:** Default Recharts `<Line>` animates over 1500ms on data change. With D-07 real-time recalc, every slider drag tick produces new `data` array → animation restarts → line visibly swims/jitters → poor UX.

**Why it happens:** Recharts treats every `data` prop change as new chart, queues up animation. Per-shape (`<Line>`, `<Area>`, `<Bar>`) animation is on by default.

**How to avoid:**
```tsx
<LineChart data={chartData}>
  <Line
    type="monotone"
    dataKey="nilaiAkhir"
    stroke="#10b981"
    strokeWidth={2}
    dot={false}
    activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
    isAnimationActive={false}  // ← critical for real-time
  />
</LineChart>
```
Also memoize the data array:
```tsx
const chartData = useMemo(() => computeFV(state), [state.saldoAwal, state.setoranBulanan, state.returnTahunanPct, state.tenorTahun])
```

**Warning signs:** Line "redraws" on every drag, dots appear-then-disappear, performance feels laggy on lower-end devices.

[VERIFIED: GitHub recharts/recharts Issue #1310, Issue #233; Tutorialpedia 2025 article]

### Pitfall 2: Radix Tooltip cannot tap-to-open on mobile (CRITICAL — UI-SPEC contract violation risk)

**What goes wrong:** UI-SPEC §Interaction states "Tap (mobile) | Tooltip opens immediately on tap, stays open until tap outside or scroll" — but Radix Tooltip is **W3C-compliant tooltip role** that ONLY opens on hover and focus. On touch devices, there's no hover, and brief tap = focus-then-blur, so tooltip flashes and disappears.

**Why it happens:** This is by design, not a bug. Tooltips per WAI-ARIA `role="tooltip"` semantics are NOT activatable. Touch devices have no hover. Radix maintainers explicitly direct users to Popover or "toggletip" patterns instead.

**How to avoid:**
- Build `<GlossaryTooltip>` on **Radix Popover primitive** (singular `radix-ui ^1.4.3` package — exposes `Popover.Root`, `.Trigger`, `.Content`, `.Arrow`, `.Portal`).
- API contract `<GlossaryTooltip term={X}>{children}</GlossaryTooltip>` preserved per D-12.
- Internal change: TooltipPrimitive → PopoverPrimitive. See Pattern 4.
- For desktop hover behavior, optionally add controlled `open` state + `onMouseEnter`/`onMouseLeave` (with subtle complexity — see Pattern 4 discussion). Or simplify to **click-only on all devices** with dotted underline + cursor-help as discoverability hints.

**Warning signs:**
- Mobile QA tester reports "tooltip blinks once and disappears."
- Lighthouse a11y audit: 0 issues (Radix Tooltip is technically compliant — but UX is unusable on mobile).
- iOS users specifically complain about glossary feature.

[VERIFIED: radix-ui/primitives Discussion #2866, Issue #1573, Issue #2589, Issue #1077, Issue #2029]

### Pitfall 3: Fraunces FOUT (Flash of Unstyled Text)

**What goes wrong:** When user navigates to `/kesehatan/arus-kas`, Fraunces woff2 (~190KB) is requested. Until it loads, the browser renders fallback (Georgia, Times). When Fraunces loads, text re-flows visibly — letter widths, line breaks shift. Cumulative Layout Shift (CLS) score impacted.

**Why it happens:** `font-display: swap` (default in @fontsource-variable bundles) tells browser "show fallback immediately, swap when font loads." This is *correct* behavior — it prevents invisible text — but produces visible re-flow.

**How to avoid:**
1. **Use `@fontsource-variable/fraunces` (variable font, single woff2 ~190KB)** instead of `@fontsource/fraunces` (6 separate woff2 = 6 round-trips when both 400 + 600 weights are needed). Variable saves bandwidth + reduces requests.
2. **Pick a fallback with similar metrics** — Georgia is the closest commonly-installed serif to Fraunces. Set CSS:
   ```css
   --font-serif: 'Fraunces Variable', Georgia, 'Times New Roman', serif;
   ```
3. **Preload Fraunces at modul route entry**, NOT at app start. Vite handles this automatically when Fraunces is imported inside the lazy-loaded `KesehatanModulLayout` chunk. Browser prioritizes the woff2 because it's referenced from within the route's CSS.
4. **Optional advanced: `size-adjust` in `@font-face`** — Tailwind v4 + `@fontsource-variable` doesn't expose this yet at the @theme layer. Would require manual `@font-face` override. Cost-benefit: defer to v2 unless QA reports visible CLS.
5. **Don't use `font-display: optional`** — that *prevents* the swap entirely if font hasn't loaded within 100ms, leaving Georgia forever on slow connections. Worse than `swap` for our case.

**Warning signs:** First navigation to a modul shows visible text "jump" 100-300ms in. Lighthouse CLS metric > 0.1.

[CITED: fontsource.org/docs (default `font-display: swap`); LogRocket "Custom fonts in Tailwind" article 2025]

### Pitfall 4: Tailwind v4 `@theme inline` font registration syntax

**What goes wrong:** Following Tailwind v3 `tailwind.config.js` examples to register Fraunces won't work — there is no tailwind.config in this project (verified: only `components.json` exists, `tailwind.config` field is empty string). Project uses Tailwind v4 CSS-first config.

**Why it happens:** Tailwind v4 moved configuration to CSS via `@theme {...}` directive. Variables in the `--font-*` namespace auto-generate utility classes (`font-serif`, `font-sans`, custom `font-X`).

**How to avoid:** Add to `src/index.css` at appropriate location (existing pattern — line 4 already has `@import "@fontsource-variable/geist"`):

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";
@import "@fontsource-variable/fraunces";   /* ← ADD THIS */

@theme inline {
    --font-heading: var(--font-sans);
    --font-sans: 'Geist Variable', sans-serif;
    --font-serif: 'Fraunces Variable', Georgia, 'Times New Roman', serif;  /* ← ADD THIS */
    /* ... rest of existing tokens unchanged ... */
}
```

**IMPORTANT note re: D-16 lazy load:** D-16 says "Dynamic import di KesehatanModulLayout parent route." Putting `@import "@fontsource-variable/fraunces"` at the top of `src/index.css` would make it global — load on every page, defeating D-16. Two options:
1. **Recommended (simple):** Accept the global import in index.css (single 190KB woff2 cached after first load). The "lazy" hint in D-16 is good intent but Vite/Tailwind v4 don't easily support per-route CSS imports. For a 190KB file, this is fine.
2. **Strict D-16 compliance:** Use `import "@fontsource-variable/fraunces"` as a JS import in `KesehatanModulLayout.tsx`. Vite handles this — when `KesehatanModulLayout` is `React.lazy()`-imported, the font CSS is bundled into the same chunk. The `@theme inline { --font-serif: ... }` declaration stays in index.css (always loaded so the `font-serif` utility class compiles). The font asset itself only downloads when modul route is entered. **This works.** Verified by Tailwind v4 + Vite chunking behavior.

**Recommendation:** Option 2 (strict D-16) is achievable with one extra line in `KesehatanModulLayout.tsx`:
```tsx
import '@fontsource-variable/fraunces'  // triggers Vite to bundle font woff2 into this chunk
```

**Warning signs:** Inspecting `font-serif` utility in DevTools shows `font-family: ui-serif, Georgia, ...` (the Tailwind default fallback) instead of `Fraunces Variable` — indicates `--font-serif` not registered correctly.

[VERIFIED: Tailwind v4 CSS-first docs; tailwindlabs/tailwindcss Discussion #13890; existing src/index.css pattern for Geist]

### Pitfall 5: react-router-dom v7 nested route + breadcrumb context

**What goes wrong:** Adding 7 child routes to `kesehatan` parent in `src/routes.tsx` is straightforward, but the breadcrumb in `KesehatanModulLayout` needs to know the current modul slug to render `Kesehatan / <Modul Label>`. If breadcrumb is hardcoded, updating slug copy means editing layout. If derived from route, you need `useParams()` or `useMatches()`.

**How to avoid:** Use `useParams<{ slug: string }>()` in `KesehatanModulLayout` to get current slug, look up `MODUL_CATALOG.find(m => m.slug === slug)?.label` for breadcrumb label. For the kalkulator route (no slug), check route match or pass label as prop. Pattern:
```tsx
import { useParams, useLocation } from 'react-router-dom'
import { MODUL_CATALOG } from './modulCatalog'

function ModulBreadcrumb() {
  const { slug } = useParams<{ slug: string }>()
  const { pathname } = useLocation()
  const isKalkulator = pathname.endsWith('/kalkulator')
  const modul = slug ? MODUL_CATALOG.find(m => m.slug === slug) : null
  const label = isKalkulator ? 'Kalkulator' : modul?.label ?? 'Modul'
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <Link to="/kesehatan" className="text-brand hover:underline">Kesehatan</Link>
      <span className="px-2">/</span>
      <span aria-current="page">{label}</span>
    </nav>
  )
}
```

**Architectural choice:** Should kalkulator route also be inside `KesehatanModulLayout`? UI-SPEC says modul layout has Fraunces + max-w-[65ch]; kalkulator uses Geist + max-w-5xl. So **kalkulator should NOT use ModulLayout**. Two approaches:
- **A**: Single layout with conditional. Adds branching logic.
- **B (recommended):** Two separate layouts. Kalkulator route uses a `KesehatanKalkulatorLayout` (or just direct `<KalkulatorCompound/>` rendering without a layout wrapper, since kalkulator is single-page). 6 modul routes share `KesehatanModulLayout`. Clean separation.

```tsx
// src/routes.tsx — Phase 15 modification
{
  path: 'kesehatan',
  element: <KesehatanLayout />,
  children: [
    { index: true, element: <KesehatanLanding /> },
    { path: 'kalkulator', element: <KalkulatorCompound /> },
    {
      // Modul routes share inner layout for breadcrumb + max-w-[65ch] + Fraunces
      element: <KesehatanModulLayout />,
      children: [
        { path: 'arus-kas', element: <ArusKasModul /> },
        { path: 'tujuan', element: <TujuanModul /> },
        { path: 'alokasi-aset', element: <AlokasiAsetModul /> },
        { path: 'instrumen', element: <InstrumenModul /> },
        { path: 'pajak-biaya-inflasi', element: <PajakBiayaInflasiModul /> },
        { path: 'perilaku', element: <PerilakuModul /> },
      ],
    },
  ],
},
```

[VERIFIED: react-router-dom v7 docs; existing routes.tsx pattern lines 32-40]

### Pitfall 6: Source HTML is JS data, NOT static markup (porting strategy)

**What goes wrong:** Naive plan assumes 1515-line `financial_framework.html` has 6 `<section>` markup blocks to extract. In reality, lines 1167–1383 store all 6 modul as a JavaScript `const modules = [{n: '01', title: '...', theory: {...}, practice: {...}, check: {...}}, ...]` array. Lines 996–1010 are *just* the rendering shell (`<div id="moduleList">` populated by JS at runtime). The HTML you see in browser is generated client-side from this JS data.

**Why it matters:** This dramatically changes port strategy:
- ❌ Bad: "Extract 6 HTML sections, sed/regex into JSX, manually wrap glossary." Slow, error-prone. The HTML doesn't exist in the file as 6 chunks.
- ✓ Good: "Copy `const modules = [...]` (lines 1167-1383, ~217 lines) verbatim into `src/data/modulContent.ts`, normalize to TypeScript interface, add `[[term]]` glossary markers post-hoc." 30-60 minutes per modul, mostly mechanical TypeScript-typing the existing object structure.

**How to avoid:** Read lines 1167–1383 of `docs/financial_framework.html` first. Note the structure: `{n, title, desc, time, stage, theory: {head, body, list, body2?, pull?}, practice: {head, case: {title, body, tag}}, check: {q, opts, feedback}}`. Map directly to `ModulData` TypeScript interface (Pattern 1 above). The `<em>...</em>`, `<strong>...</strong>`, `<p class="pull">...</p>` markup *inside* the strings is preserved as raw HTML — render via `dangerouslySetInnerHTML` (safe: trusted authored content, no user input). For D-04 quick-check prose-only: drop the `opts` array (interactive choice) and `feedback`, keep just `q` rendered as one-line "Coba jawab: {q}". Or render all 3 questions as numbered list per UI-SPEC.

[VERIFIED: read of financial_framework.html lines 1167-1383 by Claude on 2026-05-10]

## Code Examples

Verified patterns referenced from official sources or existing codebase.

### Tailwind v4 `@theme inline` Fraunces registration (full example)

```css
/* src/index.css — Phase 15 additions */
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";
/* @import "@fontsource-variable/fraunces"; */
/* ↑ DO NOT add here if going strict D-16 — instead import in KesehatanModulLayout.tsx */

@custom-variant dark (&:is(.dark *));

@theme inline {
    --font-heading: var(--font-sans);
    --font-sans: 'Geist Variable', sans-serif;
    --font-serif: 'Fraunces Variable', Georgia, 'Times New Roman', serif;  /* ← Phase 15 */
    /* ... existing tokens unchanged ... */
}
```

```tsx
// src/tabs/kesehatan/KesehatanModulLayout.tsx — Phase 15 NEW
import '@fontsource-variable/fraunces'  // route-level lazy-load via Vite chunking
import { Outlet, Link, useParams, useLocation } from 'react-router-dom'
import { MODUL_CATALOG } from './modulCatalog'
import ModulFooterNav from './ModulFooterNav'

export default function KesehatanModulLayout() {
  const { slug } = useParams<{ slug: string }>()
  const modul = slug ? MODUL_CATALOG.find(m => m.slug === slug) : null
  return (
    <div className="pt-8 pb-16">
      <div className="max-w-[65ch] mx-auto px-4">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground pb-4">
          <Link to="/kesehatan" className="text-brand hover:underline">Kesehatan</Link>
          <span className="px-2">/</span>
          <span aria-current="page">{modul?.label ?? 'Modul'}</span>
        </nav>
      </div>
      <Outlet />
      <div className="max-w-[65ch] mx-auto px-4 pt-16">
        <ModulFooterNav currentSlug={slug} />
      </div>
    </div>
  )
}
```

[VERIFIED: existing Geist pattern in src/index.css; Tailwind v4 docs Discussion #13890]

### Recharts LineChart for compound interest (real-time-safe)

```tsx
// src/tabs/kesehatan/kalkulator/KalkulatorChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatRupiah, shortRupiah } from '@/lib/format'
import type { FVYearRow } from './computeFV'

export default function KalkulatorChart({ data }: { data: FVYearRow[] }) {
  return (
    <ResponsiveContainer width="100%" aspect={16 / 9} className="md:aspect-[16/9] aspect-[4/3]">
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="tahun"
          tickFormatter={(v) => v === 0 ? 'Awal' : `Th ${v}`}
          tick={{ fontSize: 12, fill: '#6b7280' }}
        />
        <YAxis
          tickFormatter={(v) => shortRupiah(v).replace('Rp', '').trim()}
          tick={{ fontSize: 12, fill: '#6b7280' }}
          width={60}
        />
        <Tooltip
          contentStyle={{ fontSize: 14 }}
          labelFormatter={(label) => `Tahun ${label}`}
          formatter={(value: number, name: string) => {
            const label = name === 'nilaiAkhir' ? 'Nilai akhir' : name === 'totalSetoran' ? 'Total setoran' : 'Total bunga'
            return [formatRupiah(value), label]
          }}
        />
        <Line
          type="monotone"
          dataKey="nilaiAkhir"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

[VERIFIED: recharts.org/api docs; existing pattern in src/tabs/pensiun/SimulasiPanel.tsx lines 285-296]

### glossary.ts dictionary (D-13 complete content)

```ts
// src/data/glossary.ts
export type GlossaryTerm =
  | 'asset-allocation'
  | 'real-return'
  | 'sharpe-ratio'
  | 'dca'
  | 'drawdown'
  | 'expense-ratio'
  | 'rebalancing'
  | 'risk-tolerance'

export const GLOSSARY: Record<GlossaryTerm, { label: string; definition: string }> = {
  'asset-allocation': {
    label: 'Asset Allocation',
    definition: 'Pembagian portofolio antar kelas aset (saham, obligasi, kas, properti) — penentu utama return jangka panjang, lebih besar dari pemilihan saham individual.',
  },
  'real-return': {
    label: 'Real Return',
    definition: 'Return setelah dikurangi inflasi. Deposito 5% saat inflasi 3,5% hanya memberi real return 1,5%. Inilah angka yang sebenarnya bertambah pada daya beli.',
  },
  'sharpe-ratio': {
    label: 'Sharpe Ratio',
    definition: 'Return berlebih per unit risiko: (return − risk-free rate) ÷ standar deviasi. Semakin tinggi semakin baik. Pembanding antar portofolio yang adil.',
  },
  'dca': {
    label: 'DCA (Dollar-Cost Averaging)',
    definition: 'Setor jumlah tetap secara periodik tanpa peduli harga. Mengurangi risiko market timing dan meratakan harga beli — strategi default untuk investor sibuk.',
  },
  'drawdown': {
    label: 'Drawdown',
    definition: 'Penurunan dari puncak portofolio ke titik terendah. Mengukur seberapa "menyakitkan" sebuah strategi — penting untuk menilai apakah Anda akan bertahan.',
  },
  'expense-ratio': {
    label: 'Expense Ratio',
    definition: 'Persentase biaya tahunan yang dipotong dari NAB reksadana. Selisih 1% per tahun = ratusan juta dalam 30 tahun. Indeks fund Indonesia: 0,3–1%.',
  },
  'rebalancing': {
    label: 'Rebalancing',
    definition: 'Mengembalikan alokasi ke target awal saat pergerakan harga membuatnya menyimpang. Memaksa "jual tinggi, beli rendah" secara sistematis. 1–2× setahun cukup.',
  },
  'risk-tolerance': {
    label: 'Risk Tolerance',
    definition: 'Kombinasi kapasitas (berapa kerugian yang masih survive secara finansial) dan psikologi (berapa yang masih nyenyak tidur). Yang lebih kecil yang menentukan.',
  },
}
```

**Note:** Definitions ported VERBATIM from `docs/financial_framework.html` lines 1098–1129 (Section §04 Glossary). 8/8 entries match D-13 contract.

[VERIFIED: read of financial_framework.html §04 by Claude]

### Modul prev/next wrap-around nav

```tsx
// src/tabs/kesehatan/ModulFooterNav.tsx
import { Link } from 'react-router-dom'
import { MODUL_CATALOG } from './modulCatalog'

export default function ModulFooterNav({ currentSlug }: { currentSlug?: string }) {
  if (!currentSlug) return null
  const idx = MODUL_CATALOG.findIndex(m => m.slug === currentSlug)
  if (idx === -1) return null
  const prev = MODUL_CATALOG[(idx - 1 + MODUL_CATALOG.length) % MODUL_CATALOG.length]
  const next = MODUL_CATALOG[(idx + 1) % MODUL_CATALOG.length]
  return (
    <nav className="border-t pt-6 space-y-4">
      <div className="flex justify-between items-center gap-4">
        <Link
          to={`/kesehatan/${prev.slug}`}
          className="text-sm font-semibold hover:text-brand transition-colors"
        >
          ← {prev.label}
        </Link>
        <Link
          to={`/kesehatan/${next.slug}`}
          className="text-sm font-semibold hover:text-brand transition-colors"
        >
          {next.label} →
        </Link>
      </div>
      <div className="text-center">
        <Link to="/kesehatan" className="text-sm text-brand hover:underline">
          Lihat semua modul →
        </Link>
      </div>
    </nav>
  )
}
```

[VERIFIED: D-05 contract; modulCatalog.ts current 6 entries]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 `tailwind.config.js` `theme.extend.fontFamily` | Tailwind v4 `@theme inline { --font-serif: ... }` in CSS | Tailwind 4.0 stable (Jan 2025) | Project already on v4 (4.2.2). Plan must use CSS-first config, not JS config. |
| Static `@fontsource/<font>` (1 file per weight) | Variable font `@fontsource-variable/<font>` (1 file all weights) | Variable fonts wide browser support since 2020; @fontsource-variable subpackages from 2023 | 6 weight files (~180KB) → 1 variable file (~190KB). Cleaner, fewer requests. |
| Google Fonts CDN external request | Self-hosted via @fontsource bundle | Privacy/GDPR concerns 2022+ (Italian DPA fined Google Fonts users) | Project already self-hosts Geist via @fontsource — apply same to Fraunces. |
| Radix Tooltip for click-to-open glossary | Radix Popover for click-to-open | Always was the design (W3C ARIA). Misperception in spec. | Spec UI-SPEC.md needs amendment. Pattern 4 doc'd here. |
| Recharts default animation on data update | `isAnimationActive={false}` per-shape for real-time | Recharts v2.2.0+ supports per-shape control; current v3.8.1 has refined API | Real-time slider drag scenarios become smooth. |
| `<MDXProvider>` + remark plugins for prose | TSX components reading data files | MDX overkill for 6 static pages with no compile-time injection | D-03 explicit. Confirmed correct. |

**Deprecated/outdated (do NOT use):**
- `tailwindcss/plugin` config in JS — Tailwind v4 doesn't load this.
- `<Tooltip>` for tap-to-open mobile — see Pitfall #2.
- `link rel="stylesheet" href="https://fonts.googleapis.com/..."` — privacy + reliability + perf concerns. Use @fontsource-variable.
- `@apply font-serif` inside global selectors expecting it to "auto-load" Fraunces — fonts must be `@import`-ed first.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `'Fraunces Variable'` is the correct CSS family-name after `@import "@fontsource-variable/fraunces"`. | Standard Stack, Code Examples | Web search confirmed via WebFetch on fontsource.org. Existing Geist precedent in src/index.css line 10 (`'Geist Variable'`). LOW risk — pattern matches and is documented at fontsource.org. [VERIFIED] |
| A2 | Variable font (~190KB) is acceptable payload at modul route. No specific budget given. | Pitfall #3, Standard Stack | If user has strict perf budget, may need to pre-compress or use static + WOFF2 + only weight 400. Phase 15 has no perf SLO defined. [ASSUMED] |
| A3 | `dangerouslySetInnerHTML` for porting `<em>`/`<strong>`/`<p class="pull">` markup from source HTML strings is acceptable security posture. | Pattern 1 ModulRenderer | Content is hand-authored and committed to repo, no template injection, no user input. Risk is exactly zero. [VERIFIED — content origin in repo] |
| A4 | Recommendation to substitute Radix Popover for Radix Tooltip preserves D-12 spirit ("manual wrap `<GlossaryTooltip>`") since the JSX API is unchanged. | Pattern 4, Pitfall #2 | If the user rejects the substitution, the only alternative is "no tap-to-open on mobile" (UX regression for ~50%+ of pfm-web users) or a complex controlled-state hack on Tooltip. Worth explicit user confirmation in plan-phase or discuss-phase. [ASSUMED — needs confirmation] |
| A5 | "TSX prose hardcoded per modul" (D-02) allows the per-modul TSX file to be a 3-line wrapper around `<ModulRenderer slug={X}/>`. | Pattern 1, Don't Hand-Roll | Strict literal reading of D-02 might require all 6 modul TSX files to inline their prose. Doing so is 6× more work and produces 6× duplicated boilerplate (heading rendering, section wrapping). The pivot to ModulRenderer + data file is recommended, but is a discretionary decision the user may reject. [ASSUMED — needs confirmation in plan-phase] |
| A6 | Light editing of source HTML prose for currency normalization (USD→Rp) is acceptable per Claude's Discretion section in CONTEXT.md ("Studi kasus mata uang"). | Pattern 1 example data | LOW. Explicitly listed as Claude's Discretion. |
| A7 | Existing `formatRupiah` and `shortRupiah` from `src/lib/format.ts` work correctly for Recharts axis tick labels at all magnitudes (Rp 0 to Rp 4.7 trilliun edge). | Code Examples, Don't Hand-Roll | LOW — `shortRupiah` already handles 1k/1M/1B with `jt`/`M` suffix. Tested in 12+ existing components. |
| A8 | Click-only behavior on desktop (no hover) is acceptable degradation from UI-SPEC §Interaction. | Pattern 4 discussion | MEDIUM. UI-SPEC implies hover desktop + tap mobile. Click-only is consistent across devices and accessible, but UI-SPEC contract is technically not 100% met. **Needs user confirmation in discuss-phase or plan-phase.** [ASSUMED] |

**4 of 8 assumptions need user confirmation** (A2 perf budget, A4 Tooltip→Popover swap, A5 ModulRenderer pattern, A8 click-only desktop). Recommend planner surface these as questions to user before implementation.

## Open Questions

1. **Should `GlossaryTooltip` use Radix Popover (recommended) or fight the Tooltip primitive with controlled state?**
   - What we know: Radix Tooltip is W3C-tooltip-role, hover/focus only. Maintainers say use Popover for click-to-open.
   - What's unclear: Whether user accepts the primitive swap. Spec wording "Radix Tooltip" may be informational not contractual.
   - Recommendation: **Use Popover.** Surface in plan-phase as "primitive substitution: Radix Tooltip → Radix Popover (same package, same API contract)". User confirms once.

2. **Should kalkulator have `?p=10000000&pmt=1000000&r=8&n=10` URL state for shareability?**
   - What we know: Spec hint suggests it's NOT spec'd; planner discretion.
   - What's unclear: Whether shareable links are actually wanted.
   - Recommendation: **Skip v1.** Adds complexity, low usage value (no share button on landing). Defer to v2.

3. **Should kalkulator presets ("Konservatif/Moderat/Agresif") be added?**
   - What we know: Spec hint says NOT spec'd; planner discretion. Would be 3 buttons that set slider state.
   - What's unclear: Educational value vs UI complexity.
   - Recommendation: **Add 2 buttons ("Konservatif: 5%/20thn" + "Agresif: 12%/30thn") below the input card.** Cheap, pedagogically useful (anchors mental model). Skip "Moderat" to avoid analysis paralysis.

4. **Should modul TSX files be 6 thin wrappers (Pattern 1) or 6 fully-inlined prose files (literal D-02)?**
   - What we know: Source HTML stores prose as JS data array; copying that to a TS data file is 10× faster than 6 hand-written JSX prose blocks.
   - What's unclear: Whether D-02 wording forbids the data-driven approach.
   - Recommendation: **Use Pattern 1 (data file + renderer + 6 wrappers).** D-02 says "TSX hardcoded per modul" — the wrappers are still TSX, still per-modul. Pattern 1 is faithful to spirit (no MDX, no compile plugin) while being engineering-pragmatic.

5. **Where exactly should `[[term]]` glossary markers go in source data?**
   - What we know: D-12 says "wrap kemunculan pertama atau kemunculan yang paling relevant per section." Author judgment.
   - What's unclear: Specific instances per modul.
   - Recommendation: Wrap **first occurrence per H2 section** of each glossary term that appears. Cap at 8 wraps total per modul. If a term doesn't appear in a modul's prose, no wrap — that's fine (not all 8 terms appear in all modul). E.g., `arus-kas` modul probably wraps `[[Savings Rate]]` (label = "Savings Rate"); but Savings Rate isn't in glossary D-13 list of 8 — that's OK, just author it as plain text without `[[...]]`.

6. **Should the quick-check section (D-04) include answer options in prose-only form?**
   - What we know: Source has `q + opts (3 options) + correct flag + feedback`. D-04 says "render prose-only static (bullet 'Coba jawab: 1. ... 2. ... 3. ...'). No input field, no state, no tracking."
   - What's unclear: Whether `opts` are rendered as visible bullet points (so user mentally chooses) or only the question is rendered.
   - Recommendation: **Render question + 3 options as bullets, omit `correct: true` flag, omit `feedback`.** This gives the reader something to mentally evaluate against. Aligns with "self-reflection only" intent. Source data has the options; just don't mark which is correct.

7. **Performance budget for kalkulator slider drag — sub-16ms target?**
   - What we know: D-07 real-time, no debounce. Math is sub-millisecond. Recharts re-render with isAnimationActive=false is well under 16ms on modern devices.
   - What's unclear: Lower-end Android target perf (Pertamina users may have varied devices).
   - Recommendation: No specific budget; verify visually during Playwright UAT on a mid-tier mobile profile. Add `useMemo` defensively.

## Environment Availability

> Phase 15 is pure client-side feature work. No external services, no databases, no CLIs needed beyond standard web dev toolchain.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build, npm install | ✓ | (existing CI/dev env) | — |
| npm | `npm install @fontsource-variable/fraunces` | ✓ | (existing) | yarn/pnpm if user prefers, but project uses npm (package-lock present) |
| Vite | dev/build | ✓ | ^8.0.4 | — |
| TypeScript | type-check | ✓ | ~6.0.2 | — |
| Internet (one-time) | Download `@fontsource-variable/fraunces` from registry.npmjs.org during install | Required at install time | — | None — must install once |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**No external service / API / DB / system dependency.** Plan is fully shippable on existing dev environment.

## Project Constraints (from CLAUDE.md)

> No `./CLAUDE.md` file found at the working directory root (verified via Read attempt). Project conventions discovered from existing code patterns:

- **Language for user-facing copy:** Bahasa Indonesia (memory: project_user_language). Technical terms in English allowed for terms-of-art (DCA, Sharpe Ratio, etc.).
- **File path absolutes:** Use `@/` alias (mapped to `src/`) for imports. Verified via existing imports throughout codebase.
- **Format Rp:** Use existing `formatRupiah` from `@/lib/format` — `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', ... })`. Don't re-instantiate.
- **shadcn components:** Already provisioned (radix-nova preset). New components go to `src/components/ui/` if generic, or `src/tabs/<feature>/` if feature-specific.
- **Existing test scripts:** None — `package.json` has no `test` script. Build (`tsc -b && vite build`) is the regression gate (per Phase 14 decision in STATE.md). For Phase 15: planner should propose adding `vitest` + `@testing-library/react` if Vitest unit tests are desired (not yet installed). Or stay buildscript-only — but kalkulator math correctness genuinely benefits from a unit test (CONTEXT.md Discretion confirms).
- **Migration history:** No SQL/schema changes in Phase 15. TECHDEBT-01 unaffected.

## Sources

### Primary (HIGH confidence — verified in this session)

- `src/index.css` — Tailwind v4 `@theme inline` pattern (existing, lines 8-56)
- `src/components/ui/tooltip.tsx` — confirmed `import { Tooltip as TooltipPrimitive } from "radix-ui"` singular package pattern
- `src/components/ui/slider.tsx` — confirmed HTML range thin wrapper, `onValueChange([number])` signature
- `src/lib/format.ts` — `formatRupiah`, `parseRupiah`, `shortRupiah` available
- `src/tabs/pensiun/SimulasiPanel.tsx` lines 285-296 — existing Recharts pattern with `tickFormatter`, `ResponsiveContainer`, mobile-friendly aspect
- `src/routes.tsx` — react-router-dom v7 nested route pattern with `<Outlet />`
- `package.json` — verified versions: recharts 3.8.1, radix-ui 1.4.3, tailwindcss 4.2.2, @fontsource-variable/geist 5.2.8, react-router-dom 7.14.2
- `docs/financial_framework.html` lines 1167-1383 — confirmed source content is JS data, not HTML markup. Lines 1090-1132 = glossary definitions (8/8 verbatim per D-13)
- `npm view @fontsource-variable/fraunces version` → 5.2.9 (current 2026-05-10, published 7 months ago)
- `npm view @fontsource/fraunces version` → 5.2.9 (same, static variant)
- `npm view recharts version` → 3.8.1 (matches package.json)
- `npm view radix-ui version` → 1.4.3 (matches package.json)
- `.planning/config.json` — confirmed `nyquist_validation: false` → Validation Architecture section omitted

### Secondary (MEDIUM confidence — web sources, verified by official-source signal)

- [Radix Tooltip Discussion #2866 — "How can I trigger Tooltip in mobile"](https://github.com/radix-ui/primitives/discussions/2866) — maintainer recommends Popover/toggletip pattern; no built-in tap support
- [Radix Tooltip Issue #1573 — "Does not open/close on mobile devices (iOS)"](https://github.com/radix-ui/primitives/issues/1573)
- [Radix Tooltip Issue #2589 — "Tooltip doesn't react on touch"](https://github.com/radix-ui/primitives/issues/2589)
- [Radix Tooltip Issue #1077 / #2029](https://github.com/radix-ui/primitives/issues/1077) — keep tooltip open on click
- [Recharts Issue #1310 — animation handling](https://github.com/recharts/recharts/issues/1310)
- [Recharts Issue #233 — disable animation](https://github.com/recharts/recharts/issues/233)
- [Tutorialpedia 2025 — Disable Animation for LineChart](https://www.tutorialpedia.org/blog/how-to-disable-animation-for-linechart-in-recharts/) — `isAnimationActive={false}` + `animationDuration={0}` for full silence
- [Tailwind v4 Discussion #13890 — Add custom font](https://github.com/tailwindlabs/tailwindcss/discussions/13890) — `@theme` directive + `--font-*` namespace pattern
- [Tailwind v4 Discussion #18238 — Custom font CSS configuration](https://github.com/tailwindlabs/tailwindcss/discussions/18238)
- [Fontsource Fraunces install page](https://fontsource.org/fonts/fraunces/install) — `'Fraunces Variable'` family name; `font-display: swap` default
- [Tailwind v4 official theme docs](https://tailwindcss.com/docs/theme) — CSS-first variable namespacing
- [react-router-dom v7 docs](https://reactrouter.com/en/main) — nested routes via `<Outlet />`

### Tertiary (LOW confidence — flagged for validation)

- [LogRocket "Custom fonts in Tailwind"](https://blog.logrocket.com/custom-fonts-tailwind-css/) — supplementary, not authoritative on @fontsource-variable specifically
- [Hgup blog — Fontsource fonts in TailwindCSS](https://hgup.github.io/note/explorations/Fontsource-fonts-in-TailwindCSS) — third-party, useful but not official

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all versions verified via `npm view` against current registry; existing code patterns confirm usage idioms.
- Architecture: **HIGH** — all routing patterns + layout patterns + state patterns reuse existing project conventions; verified in source files.
- Pitfall #1 (Recharts animation): **HIGH** — confirmed via 3 independent sources (GitHub issues #1310, #233, Tutorialpedia article).
- Pitfall #2 (Radix Tooltip mobile): **HIGH** — confirmed via 5 GitHub threads where maintainers explicitly direct to Popover. Single most important finding for this phase.
- Pitfall #3 (Fraunces FOUT): **MEDIUM** — general font-loading principles well-known; specific CLS impact for this project not measured. Mitigation strategies are standard and low-risk.
- Pitfall #4 (Tailwind v4 syntax): **HIGH** — verified by reading existing src/index.css usage of `@theme inline` for Geist.
- Pitfall #5 (router breadcrumb): **HIGH** — react-router-dom v7 patterns are well-documented; existing project usage in routes.tsx.
- Pitfall #6 (source HTML structure): **HIGH** — directly read `docs/financial_framework.html` lines 1167-1383 in this session; structure is JavaScript data array, not static markup.
- Code examples: **HIGH** — derived from existing project files (formatRupiah, SimulasiPanel.tsx, src/index.css), or directly from official Radix/Recharts API.

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (30 days — stack is stable, but Radix/Recharts iterate; Tailwind v4 is mature 4.2.2)

---

## RESEARCH COMPLETE

**Phase:** 15 - Modul Edukasi & Kalkulator
**Confidence:** HIGH

### Key Findings

1. **Single new dependency:** `@fontsource-variable/fraunces ^5.2.9` (verified via npm registry on 2026-05-10). All other libraries (radix-ui, recharts, react-router-dom, tailwindcss v4) already installed.
2. **CRITICAL pivot — Radix Tooltip → Radix Popover for `GlossaryTooltip`.** Tooltip is hover/focus only by W3C ARIA design; tap-to-open on mobile (D-14 contract) requires Popover. Maintainers explicitly recommend this. JSX API contract preserved.
3. **Source content is JS data, not HTML markup.** `docs/financial_framework.html` lines 1167-1383 have a `const modules = [...]` array containing all 6 modul. Port strategy: copy verbatim to `src/data/modulContent.ts`, render via single `<ModulRenderer/>` + 6 thin wrappers. ~10× faster than HTML-tag extraction.
4. **Recharts `isAnimationActive={false}` per-`<Line>` is mandatory** for real-time slider drag (D-07 no debounce). Default 1500ms animation otherwise causes line "swimming."
5. **Tailwind v4 `@theme inline` font registration confirmed working** in this project (existing Geist precedent). Fraunces registration: 1 `@import` + 1 line in `--font-serif`. Lazy-load via `import '@fontsource-variable/fraunces'` inside lazy-imported `KesehatanModulLayout` (Vite chunks the woff2 into the modul route bundle).

### File Created

`.planning/phases/15-modul-edukasi-kalkulator/15-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All versions verified via npm registry; existing code patterns confirm usage. |
| Architecture | HIGH | Reuses existing react-router-dom + Tailwind v4 + radix-ui patterns. |
| Pitfalls | HIGH | All 6 pitfalls verified via GitHub issues, official docs, or direct file inspection. |
| Code Examples | HIGH | Derived from existing project files or official API docs. |

### Open Questions Surfaced for Plan-Phase / Discuss-Phase

1. **Approve Radix Tooltip → Popover substitution?** (preserves D-12 API; required for D-14 mobile)
2. **Approve ModulRenderer pattern + data file** (vs literal 6 hand-written prose TSX)?
3. **Click-only on all devices** (vs hover desktop + click mobile complexity)?
4. **Add 2 kalkulator preset buttons** (Konservatif/Agresif)?
5. **Quick-check render: question + 3 options as bullets**, or question only?

### Ready for Planning

Research complete. Planner can now:
- Sequence Phase 15 tasks (suggested wave order: data files → renderer/components → routes wiring → kalkulator → polish/UAT).
- Reference Pattern 1-4 code examples for task action snippets.
- Surface 5 open questions to user via discuss-phase update or inline plan questions.
- Use confirmed installed versions for any dependency-version specs.
