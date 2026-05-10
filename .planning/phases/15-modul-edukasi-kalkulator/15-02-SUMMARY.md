---
phase: 15-modul-edukasi-kalkulator
plan: 02
subsystem: kesehatan-modul-reading-experience
tags: [component, ui, radix-popover, glossary, prose, fraunces, a11y, tdd, wave-2]
requires:
  - 15-01 GLOSSARY + isGlossaryTerm (consumed by GlossaryTooltip)
  - 15-01 MODUL_CONTENT + ModulSlug + ModulData (consumed by ModulRenderer)
  - 15-01 MODUL_ORDER (consumed by KesehatanModulLayout for wrap-around)
  - 15-01 Tailwind font-serif token resolving Fraunces Variable
  - phase-12 modulCatalog.ts (label lookup for breadcrumb + footer)
provides:
  - 'GlossaryTooltip component (Radix Popover, click-only, T-15-07 fallback)'
  - 'ModulRenderer (slug → MODUL_CONTENT lookup → Fraunces prose with [[term]] parser)'
  - 'KesehatanModulLayout (breadcrumb + Outlet + Fraunces lazy chunk + footer prev/next)'
  - 'Vitest jsdom test setup (ResizeObserver + pointer-capture polyfills)'
  - 'Ambient type shim for @fontsource-variable side-effect imports'
affects:
  - vitest.config.ts (added — first vitest config in repo, jsdom env + setup file)
  - package.json (added @testing-library/react, @testing-library/dom, jsdom dev deps)
tech-stack:
  added:
    - '@testing-library/react ^16 (component test framework)'
    - '@testing-library/dom (peer for testing-library/react)'
    - 'jsdom (vitest DOM environment for component tests)'
  patterns:
    - 'Radix Popover (NOT Tooltip) — D-14 revised — click-only all devices'
    - 'Singular `radix-ui` package import: import { Popover as PopoverPrimitive }'
    - 'parseProse fragment-array — type-safe inline glossary marker substitution (no DOM walking)'
    - 'Side-effect font import + // eslint-disable-next-line import/order for Vite chunk grouping'
    - 'Ambient .d.ts module declaration for CSS-only npm packages'
key-files:
  created:
    - 'src/components/GlossaryTooltip.tsx (84 lines)'
    - 'src/components/GlossaryTooltip.test.tsx (37 lines, 3 cases)'
    - 'src/tabs/kesehatan/ModulRenderer.tsx (196 lines)'
    - 'src/tabs/kesehatan/KesehatanModulLayout.tsx (101 lines)'
    - 'src/test/setup.ts (33 lines — vitest jsdom polyfills)'
    - 'src/types/fontsource.d.ts (6 lines — ambient module shim)'
    - 'vitest.config.ts (18 lines — first vitest config)'
  modified:
    - 'package.json + package-lock.json (dev deps added: @testing-library/react, @testing-library/dom, jsdom)'
decisions:
  - 'Radix Popover preserved over Tooltip per D-14 revised — Tooltip W3C ARIA hover-only cannot tap-mobile'
  - 'parseProse fragment-array (vs createPortal/DOM walking) — type-safe and React-idiomatic'
  - 'jsdom polyfills isolated to src/test/setup.ts — not applied at runtime'
  - 'Test #3 assertion adjusted: trigger children may differ from popover label (e.g. <Tooltip>Rebalance</> shows full label \"Rebalancing\" inside popover)'
metrics:
  duration: '~10 minutes'
  completed: '2026-05-10'
  tasks_completed: 3
  commits: 4
  files_created: 7
  files_modified: 2
  tests_passing: 3
---

# Phase 15 Plan 02: Modul Reading Experience Summary

Wave 2 shipped the modul reading layer — Radix Popover-based `GlossaryTooltip` (D-14 revised pivot away from Tooltip), `ModulRenderer` that consumes `MODUL_CONTENT[slug]` and parses `[[term]]X[[/term]]` markers into typed React fragments, and `KesehatanModulLayout` that lazy-bundles Fraunces with the modul chunk and renders breadcrumb + footer prev/next wrap-around. Plan 15-04 (Wave 3) can now `React.lazy(() => import('@/tabs/kesehatan/KesehatanModulLayout'))` to wire 6 modul sub-routes.

## Tasks Executed

| Task | Name | Commit | Status |
| ---- | ---- | ------ | ------ |
| 1 RED | Failing GlossaryTooltip test (3 cases) + jsdom env setup | `1acc55a` | done |
| 1 GREEN | Implement GlossaryTooltip on Radix Popover + jsdom polyfills | `3df459f` | done |
| 2 | Implement ModulRenderer with glossary marker parser | `f3ad2a6` | done |
| 3 | Implement KesehatanModulLayout with Fraunces lazy chunk | `605d60b` | done |

## Truths Verified

- `<GlossaryTooltip term="dca">DCA</GlossaryTooltip>` renders Radix Popover trigger with dotted underline + cursor-help + role=button + aria-label="Definisi: DCA (Dollar-Cost Averaging)"
- Click on trigger opens popover with `{label}` (font-semibold) + `{definition}` (leading-relaxed) — verified via fireEvent.click + screen.findByText
- Term not in GLOSSARY (e.g. `"not-a-real-term"`) renders plain `<span>` children, NO role=button, NO data-slot — verified via querySelector null assertion
- `ModulRenderer` reads `useParams<{slug}>()`, looks up `MODUL_CONTENT[slug]`, renders Fraunces 65ch prose; invalid slug → `<Navigate to="/kesehatan" replace />`
- `parseProse()` regex `/\[\[([a-z-]+)\]\]([\s\S]*?)\[\[\/\1\]\]/g` splits markers correctly with backreference for matched closing tag
- 8 dangerouslySetInnerHTML usages in ModulRenderer (theory body, list items, practice body, title, fallback HTML chunks) — meets ≥4 threshold
- `KesehatanModulLayout` first import is `@fontsource-variable/fraunces` (side-effect) preceded by `// eslint-disable-next-line import/order` directive
- Wrap-around prev/next: `(idx - 1 + total) % total` and `(idx + 1) % total` — modul 6 next = modul 1, modul 1 prev = modul 6
- Indonesian copy: "Kesehatan", "Lihat semua modul →", "Cek Pemahaman", "Coba jawab pertanyaan ini sebelum lanjut ke modul berikutnya:"
- Component name "Tooltip" appears only as part of "GlossaryTooltip" component label; ZERO `TooltipPrimitive` references — D-14 pivot honored

## Acceptance Criteria

- `npx vitest run src/components/GlossaryTooltip.test.tsx` exit 0 with 3/3 PASS
- `grep -F "from \"radix-ui\"" src/components/GlossaryTooltip.tsx` → present (singular)
- `grep -F "Popover as PopoverPrimitive" src/components/GlossaryTooltip.tsx` → present
- `grep -F "isGlossaryTerm(term)" src/components/GlossaryTooltip.tsx` → present
- `grep -F "border-dotted"`, `"cursor-help"`, `'role="button"'`, `"glossary-tooltip-trigger"` → all present
- `grep -F "useParams" src/tabs/kesehatan/ModulRenderer.tsx` → 3 matches
- `grep -F "MODUL_CONTENT" src/tabs/kesehatan/ModulRenderer.tsx` → 6 matches
- `grep -F 'Navigate to="/kesehatan"' src/tabs/kesehatan/ModulRenderer.tsx` → present
- `grep -F "max-w-[65ch]" src/tabs/kesehatan/ModulRenderer.tsx` → present
- `grep -c "font-serif" src/tabs/kesehatan/ModulRenderer.tsx` → 12 (≥3 required)
- `grep -c "dangerouslySetInnerHTML" src/tabs/kesehatan/ModulRenderer.tsx` → 8 (≥4 required)
- `grep -F "tabIndex={-1}" src/tabs/kesehatan/ModulRenderer.tsx` → present (H1 a11y focus target)
- `grep -F "@fontsource-variable/fraunces" src/tabs/kesehatan/KesehatanModulLayout.tsx` → present
- `grep -F "eslint-disable-next-line import/order" src/tabs/kesehatan/KesehatanModulLayout.tsx` → present
- `grep -F "Outlet"`, `"MODUL_ORDER"`, `"MODUL_CATALOG"`, `"Lihat semua modul"`, `"ChevronLeft"` → all present
- `grep -c "max-w-\[65ch\]" src/tabs/kesehatan/KesehatanModulLayout.tsx` → 2 (breadcrumb + footer)
- `npm run build` exit 0 (full type check + Vite build)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @testing-library/react + jsdom (component test infra missing)**

- **Found during:** Task 1 RED gate
- **Issue:** Plan said to install `@testing-library/react @testing-library/dom @testing-library/jest-dom jsdom` if missing. None present.
- **Fix:** `npm install -D @testing-library/react @testing-library/dom jsdom` (skipped jest-dom — not needed since tests use plain `expect(x).toBeDefined()`)
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** `1acc55a` (bundled with RED gate)
- **Justification:** Plan 15-01 added vitest as the first test framework, but only for unit-test (math) — no DOM testing infra existed. Component tests blocked without testing-library + jsdom env.

**2. [Rule 3 - Blocking] Created vitest.config.ts with jsdom environment**

- **Found during:** Task 1 RED gate
- **Issue:** Repo had no `vitest.config.*` file. Vitest defaulted to `node` environment which can't render React components.
- **Fix:** Created `vitest.config.ts` with `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }`. Re-verified Plan 15-01's `CompoundInterestMath.test.ts` still passes under jsdom (10/10 OK).
- **Commit:** `1acc55a`

**3. [Rule 3 - Blocking] jsdom polyfills for Radix Popover internals**

- **Found during:** Task 1 GREEN gate (test #3 click flow)
- **Issue:** `ResizeObserver is not defined` thrown by `@radix-ui/react-use-size` during Popover content positioning. jsdom does not implement ResizeObserver / hasPointerCapture / setPointerCapture / scrollIntoView.
- **Fix:** Created `src/test/setup.ts` with conditional polyfills (only attach if undefined). Wired via `vitest.config.ts setupFiles`.
- **Files modified:** `src/test/setup.ts` (new), `vitest.config.ts`
- **Commit:** `3df459f`
- **Justification:** Standard practice for testing Radix primitives in jsdom — polyfills are environment shims, not production code.

**4. [Rule 3 - Blocking] Ambient module declaration for @fontsource-variable side-effect imports**

- **Found during:** Task 3 build
- **Issue:** TS bundler resolution emitted `TS2882: Cannot find module or type declarations for side-effect import of '@fontsource-variable/fraunces'`. The package only exports CSS files, no `.d.ts`.
- **Fix:** Created `src/types/fontsource.d.ts` declaring both `@fontsource-variable/fraunces` and `@fontsource-variable/geist` as ambient modules. Plan 15-01 used the geist import only inside CSS (`@import` in `index.css`), so the issue surfaced first at Plan 15-02 task 3 when the TS-compiled file added the side-effect import.
- **Commit:** `605d60b`

**5. [Rule 1 - Test assertion correction] Test #3 assertion narrowed**

- **Found during:** Task 1 GREEN run
- **Issue:** Plan's draft test asserted `screen.findAllByText('Rebalancing').length >= 2`, expecting trigger text + popover label both to match. But trigger children was `Rebalance` (different text from full GLOSSARY label `Rebalancing`). The test failed because only the popover label rendered "Rebalancing" exactly.
- **Fix:** Changed to `findByText('Rebalancing')` (single match) + retain definition snippet check. Functional intent preserved: confirms popover opens with full label + definition.
- **Files modified:** `src/components/GlossaryTooltip.test.tsx` (test #3 only)
- **Commit:** `3df459f` (bundled with GREEN gate)
- **Note:** This is a test-design refinement, not an implementation change. The component behaves correctly; the original assertion was over-constrained relative to the test fixture (trigger children ≠ label).

### Skipped jest-dom

Plan suggested installing `@testing-library/jest-dom`. Tests use plain `expect(x).toBeDefined()` / `.toContain()` / `.toBeNull()` — no jest-dom matchers required (`.toBeInTheDocument()` etc. unused). Skipped to keep the dev-dep surface minimal.

## Authentication Gates

None — fully autonomous component-layer work, no auth required.

## Threat Surface Scan

All threats from plan's `<threat_model>` mitigated as designed:

- **T-15-05** (Tampering — dangerouslySetInnerHTML feeds body strings): mitigated. Source = `MODUL_CONTENT` hardcoded in repo (Plan 15-01 added security comment header). `parseProse` splits on `[[term]]` markers BEFORE dangerouslySetInnerHTML so glossary markers can't break out of HTML context. Inline `<em>`, `<strong>`, `<p class="pull">` are the only authored HTML elements.
- **T-15-06** (Tampering — URL slug param → MODUL_CONTENT lookup): mitigated. `isModulSlug()` type guard validates slug; invalid slug → `<Navigate to="/kesehatan" replace />`. Defense-in-depth: even if guard bypassed, `Record` key access returns undefined → `!data` early return.
- **T-15-07** (Information Disclosure — arbitrary marker terms): mitigated. `parseProse` calls `isGlossaryTerm(term)` BEFORE rendering GlossaryTooltip; unknown terms render as plain HTML span. GlossaryTooltip itself ALSO checks via isGlossaryTerm — defense-in-depth verified by Test #1 (sentinel "not-a-real-term" → no Popover, no console error).
- **T-15-08** (Spoofing — breadcrumb shows raw slug): accepted as designed. `current?.label ?? slug ?? 'Modul'` renders raw slug briefly before ModulRenderer's `<Navigate>` redirects. Cosmetic-only flash, no exploit surface.

No new threat surface introduced beyond plan's threat model.

## Known Stubs

None. All 3 components are fully wired to their data sources (GLOSSARY, MODUL_CONTENT, MODUL_ORDER, MODUL_CATALOG). Wave 3 (Plan 15-04) consumes them via React.lazy in routes.tsx — no stub data, no mock providers needed.

## Files Created / Modified

**Created (7):**
- `src/components/GlossaryTooltip.tsx` — Radix Popover-based inline glossary tooltip (84 lines)
- `src/components/GlossaryTooltip.test.tsx` — 3 vitest cases (37 lines)
- `src/tabs/kesehatan/ModulRenderer.tsx` — slug-driven Fraunces prose renderer with [[term]] parser (196 lines)
- `src/tabs/kesehatan/KesehatanModulLayout.tsx` — breadcrumb + Outlet + Fraunces lazy chunk + footer prev/next (101 lines)
- `src/test/setup.ts` — vitest jsdom polyfills for Radix internals (33 lines)
- `src/types/fontsource.d.ts` — ambient module shim for CSS-only fontsource packages (6 lines)
- `vitest.config.ts` — first vitest config in repo, jsdom env + setupFiles (18 lines)

**Modified (2):**
- `package.json` (+ `package-lock.json`) — added 3 dev deps: @testing-library/react, @testing-library/dom, jsdom

## Build & Test Status

- `npm run build` → exit 0 (tsc -b + vite build, ~2.5s)
- `npx vitest run src/components/GlossaryTooltip.test.tsx` → 3/3 pass, exit 0
- `npx vitest run src/tabs/kesehatan/CompoundInterestMath.test.ts` → 10/10 still pass under jsdom env (regression check OK)

## Commits Sequence

```
605d60b feat(15-02): implement KesehatanModulLayout with Fraunces lazy chunk
f3ad2a6 feat(15-02): implement ModulRenderer with glossary marker parser
3df459f feat(15-02): implement GlossaryTooltip on Radix Popover (GREEN gate)
1acc55a test(15-02): add failing GlossaryTooltip test (RED gate)
```

TDD gate compliance for Task 1: RED commit `1acc55a` precedes GREEN commit `3df459f` — verifiable in `git log --oneline 2579e8e..HEAD`.

## TDD Gate Compliance

- Task 1 (`tdd="true"`, plan-level): RED `1acc55a` (test only, file imports module that doesn't exist) → GREEN `3df459f` (implement + tests pass) — sequence verified
- Task 2 (`tdd="true"` per plan): No new tests written (plan's behavior block did not require unit tests for ModulRenderer — Wave 3 UAT tests via Playwright will exercise the parser. Plan acceptance criteria are static greps + build, all green). Treated as feat-only commit since plan's `<verify>` block is build + grep, not vitest.
- Task 3 (`tdd="true"` per plan): Same as Task 2 — plan's `<verify>` is build + grep. No vitest required.

Note: only Task 1 had explicit test cases declared in `<action>`. Tasks 2 and 3 acceptance is grep-based + build-based per plan; treated as TDD-compatible (verify before commit) without forcing redundant unit tests on stateless rendering components whose UAT is Playwright-bound in Wave 3.

## Wave 3 Readiness (Plan 15-04)

The following imports are now resolvable for routes.tsx:

```typescript
const KesehatanModulLayout = React.lazy(
  () => import('@/tabs/kesehatan/KesehatanModulLayout'),
)
const ModulRenderer = React.lazy(
  () => import('@/tabs/kesehatan/ModulRenderer'),
)
// 6 child routes share ModulRenderer; layout owns Fraunces chunk + breadcrumb + footer
```

Vite chunk-split confirmed in `dist/assets/`: Fraunces woff2 files lazy-grouped with the layout chunk per D-16 (lazy-load font on /kesehatan/<slug> entry).

## Self-Check: PASSED

- `src/components/GlossaryTooltip.tsx` → FOUND
- `src/components/GlossaryTooltip.test.tsx` → FOUND
- `src/tabs/kesehatan/ModulRenderer.tsx` → FOUND
- `src/tabs/kesehatan/KesehatanModulLayout.tsx` → FOUND
- `src/test/setup.ts` → FOUND
- `src/types/fontsource.d.ts` → FOUND
- `vitest.config.ts` → FOUND
- Commits `1acc55a`, `3df459f`, `f3ad2a6`, `605d60b` → ALL FOUND in git log
- 3/3 vitest GlossaryTooltip cases pass
- 10/10 vitest CompoundInterestMath cases still pass (regression OK)
- `npm run build` exit 0
- D-14 Popover pivot honored (no TooltipPrimitive usage)
- ESLint disable directive present above Fraunces import
