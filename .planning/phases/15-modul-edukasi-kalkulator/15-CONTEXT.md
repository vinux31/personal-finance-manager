# Phase 15: Modul Edukasi & Kalkulator — Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Source:** Design spec `docs/superpowers/specs/2026-05-08-framework-page-design.md` (commit `b219fc3`) — sections relevan untuk Phase 15 di-extract sebagai locked decisions.

<domain>
## Phase Boundary

**This phase delivers:**
- 6 modul edukasi prose di sub-route `/kesehatan/<slug>` (`arus-kas`, `tujuan`, `alokasi-aset`, `instrumen`, `pajak-biaya-inflasi`, `perilaku`) dengan typography Fraunces serif + breadcrumb + footer prev/next nav
- Kalkulator compound interest interaktif di `/kesehatan/kalkulator` dengan slider+input combo, real-time recalc, Recharts line chart year-by-year, tabel breakdown 5-tahunan
- Glossary tooltip inline untuk 8 istilah teknis (Asset Allocation, Real Return, Sharpe Ratio, DCA, Drawdown, Expense Ratio, Rebalancing, Risk Tolerance) via Radix Tooltip dengan dotted underline visual hint
- Sub-route children Phase 12 stub di `src/routes.tsx` di-replace dengan komponen modul + kalkulator real

**This phase does NOT deliver:**
- Modul "Warisan & Estate Planning" (Tier 4 cuma checklist, no link modul — asimetri acceptable, spec §9)
- Quiz tracking / score persistence (quick-check render prose-only, tidak disimpan, spec §6 + §9)
- Kalkulator suite tambahan: real return, expense drag, retirement gap (cuma compound v1, spec §9)
- IPS Builder, risk tolerance quiz, behavior gap detector (spec §9)
- Adaptasi konten modul ke contoh user-data pfm-web (port verbatim v1, adaptasi inkremental v2 — spec §10 Open Question)
- Asset class normalization (trust user input, spec §9)

**Why this is final landing-experience phase v1.2:** Phase 12 shell + Phase 13 indikator + Phase 14 protection checklist sudah live. Phase 15 isi konten edukasi + tools, melengkapi value prop `/kesehatan` end-to-end. Setelah Phase 15: milestone v1.2 closeable (sisa verification debt B1-B5 lewat /gsd-audit-uat).

</domain>

<decisions>
## Implementation Decisions (Locked)

### Konten Modul — Sourcing & Storage

- **D-01 (Sourcing):** Port konten verbatim dari `docs/financial_framework.html` (1515 baris HTML). Minimal edit, replace istilah teknis dengan `<GlossaryTooltip>` wrap manual. Adaptasi konten ke user data = deferred v2.
- **D-02 (Storage format) — REVISED 2026-05-10 post-research:** Data-array + ModulRenderer pattern. Source `docs/financial_framework.html` lines 1167-1383 sudah berupa JS const array `modules = [{n, title, theory, practice, check}, ...]` (HTML render runtime dari JS data). Port strategy: copy array verbatim ke `src/data/modulContent.ts` (TypeScript interface `ModulData`), single `<ModulRenderer />` component baca slug dari URL params, render dari array. Glossary marker `[[term]]` post-hoc replace dgn `<GlossaryTooltip term="...">term</GlossaryTooltip>` via simple parser. Files:
  - `src/data/modulContent.ts` — array of 6 ModulData entries (theory/practice/check structure)
  - `src/tabs/kesehatan/ModulRenderer.tsx` — generic component, useParams() slug → lookup → render Fraunces prose
  - Routes: 6 sub-route `/kesehatan/<slug>` → `<ModulRenderer />` (single element, slug discriminates)
- **D-03 (No MDX) — REVISED:** Tidak install `@mdx-js/rollup`. Glossary wiring tetap manual via `[[term]]` marker → ModulRenderer parses + wraps `<GlossaryTooltip term="dca">DCA</GlossaryTooltip>`. Source HTML inline markup (`<em>`, `<strong>`, `<p class="pull">`) preserved sebagai raw string + render via `dangerouslySetInnerHTML` (safe: trusted authored content, no user input).
- **D-04 (Quick-check):** Render prose-only static (bullet "Coba jawab: 1. ... 2. ... 3. ..."). No input field, no state, no tracking. Self-reflection only.
- **D-05 (Footer nav):** Prev/next button (urut catalog `MODUL_CATALOG`) + link "Lihat semua modul → /kesehatan". Pattern: `← {prev.label}` di kiri, `{next.label} →` di kanan; wrap-around (modul 6 next = modul 1).

### Kalkulator Compound Interest

- **D-06 (Input control):** Slider + number input combo per parameter:
  - Saldo awal: slider Rp 0–1M (step Rp 100rb) + number input untuk presisi
  - Setoran bulanan: slider Rp 0–50jt (step Rp 50rb) + number input
  - Return tahunan %: slider 0–25% (step 0.5%) + number input
  - Tenor tahun: slider 1–40 (step 1) + number input
  - Format Rp: thousand-separator titik (id-ID locale), prefix "Rp "
- **D-07 (Recalc):** Real-time on change (tiap drag slider / blur input). Compound math murah (loop max 40 iter), no debounce.
- **D-08 (Chart):** Recharts `<LineChart>` 1 line nilai total per tahun. X-axis tahun (0–N), Y-axis Rp formatted. Tooltip hover show {tahun, totalSetoran, totalBunga, nilaiAkhir}.
- **D-09 (Tabel):** 5-tahunan fix. Row tahun 5, 10, 15, 20, 25, 30, 35, 40 (filter ≤ tenor). Kolom: Tahun, Total Setoran, Total Bunga Compound, Nilai Akhir.
- **D-10 (Math formula):** Future Value of annuity = `P × (1+r)^n + PMT × ((1+r)^n − 1) / r` per bulan, di-aggregate per tahun. P = saldo awal, PMT = setoran bulanan, r = return tahunan/12, n = tenor × 12.
- **D-11 (Output info):** Big number nilai akhir, sub-info "Total setoran: Rp X" + "Total bunga compound: Rp Y" (dgn warna hijau untuk compound effect highlight).

### Glossary Tooltip

- **D-12 (Mekanisme) — REVISED 2026-05-10 post-research:** Manual wrap `<GlossaryTooltip term="dca">DCA</GlossaryTooltip>` di prose data string sebagai marker `[[dca]]DCA[[/dca]]` (parser-friendly). ModulRenderer parses markers + injects `<GlossaryTooltip>` component runtime. No auto-detect of arbitrary text. Author kontrol kapan marker muncul (avoid noise istilah berulang — mark kemunculan pertama atau paling relevant per H2 section).
- **D-13 (Source dictionary):** `src/data/glossary.ts` — const object 8 entry, type-safe:
  ```ts
  export const GLOSSARY: Record<GlossaryTerm, { label: string; definition: string }> = {
    'asset-allocation': { label: 'Asset Allocation', definition: '...' },
    'real-return': { label: 'Real Return', definition: '...' },
    'sharpe-ratio': { label: 'Sharpe Ratio', definition: '...' },
    'dca': { label: 'DCA (Dollar-Cost Averaging)', definition: '...' },
    'drawdown': { label: 'Drawdown', definition: '...' },
    'expense-ratio': { label: 'Expense Ratio', definition: '...' },
    'rebalancing': { label: 'Rebalancing', definition: '...' },
    'risk-tolerance': { label: 'Risk Tolerance', definition: '...' },
  }
  ```
- **D-14 (Primitive + interaction) — REVISED 2026-05-10 post-research:** Pivot Radix Tooltip → **Radix Popover** (same `radix-ui` ^1.4.3 package, same JSX import pattern). Reason: Radix Tooltip W3C ARIA hover/focus only — tap-to-open mobile IMPOSSIBLE without abandoning primitive guarantees (verified GitHub #1573, #2589, #2866 — maintainers say "use Popover"). **Behavior:** click-only on all devices (desktop click + mobile tap), click-outside / Esc / focus-out closes. Konsisten UX across devices, accessible (Radix Popover gives focus management + `aria-expanded` free). Component file `src/components/GlossaryTooltip.tsx` (API name preserved for clarity in modul prose).
- **D-15 (Visual hint):** `border-b border-dotted border-muted-foreground cursor-help` di trigger element. Subtle web-standard "ada definisi", tidak intrusive ke flow baca.

### Modul UX Detail

- **D-16 (Font load) — REVISED 2026-05-10 post-research:** `@fontsource-variable/fraunces ^5.2.9` (variable font, NOT static — konsisten dgn existing `@fontsource-variable/geist`). Single payload covers weight 100-900. Import statement di `src/tabs/kesehatan/KesehatanModulLayout.tsx` (NEW parent layout for 6 modul routes — `import "@fontsource-variable/fraunces"`). Combined dgn `React.lazy(() => import('@/tabs/kesehatan/KesehatanModulLayout'))` di `src/routes.tsx` → Vite chunks layout + font separately, loads only saat user enter `/kesehatan/<slug>`. Tailwind v4 `@theme inline { --font-serif: 'Fraunces Variable', Georgia, serif }` di `src/index.css` (CSS family value `'Fraunces Variable'` matches @fontsource-variable convention). Georgia fallback for FOUT (`font-display: swap` default).
- **D-17 (Layout) — REVISED 2026-05-10 post-research:** Centered prose `max-w-[65ch] mx-auto px-4`. Optimal reading width. Body Fraunces serif `font-serif` (Tailwind v4 utility), heading Fraunces weight 600. **Geist Variable** (NOT Inter — project default per `@fontsource-variable/geist` already in `src/index.css`; spec §8 said "Inter" tapi outdated) tetap default untuk breadcrumb + chrome. UI-SPEC final type scale: 14/18/28/36 (4 sizes), weights 400+600 only, H3 sub-section distinction via weight + `mt-8`/`mb-3` spacing.
- **D-18 (Breadcrumb):** 2-level — `Kesehatan / <Modul>`. "Kesehatan" link ke `/kesehatan` (Inter sans), `<Modul>` current page (no link, Inter sans). Top of page above prose body.
- **D-19 (Header sticky):** Static (scroll dgn page). Breadcrumb + heading H1 modul scroll bareng konten. AppShell topbar/sidebar tetap sticky di luar.
- **D-20 (Kalkulator typography) — REVISED 2026-05-10 post-research:** **Geist Variable** sans (NOT Inter — spec §8 outdated). Kalkulator UI = tools, bukan modul prose. Sizes 14/18/28/36 (UI-SPEC final cap), weights 400+600 only. Number input value: 18px / 400 / `tabular-nums`. Slider label: 14px / 400 / `tracking-wide uppercase` / `text-muted-foreground`. Big number "Nilai Akhir": 36px / 600 / `tabular-nums`.

### Claude's Discretion

- **Tone of voice prose modul** — port verbatim dari source HTML, jika ada konflik gaya pfm-web (mis. terlalu formal) Claude boleh light-edit untuk konsistensi. Tidak boleh tambah konten baru.
- **Code/SQL example handling di prose** — kalau source HTML punya code block, render dgn `<pre><code>` styled (Fraunces tidak dipakai untuk monospace; pakai default mono).
- **Studi kasus mata uang** — source pakai contoh hardcoded Rp; kalau ada angka USD/asing, convert ke Rp wajar (mis. $1000 → Rp 15jt) tanpa edit substansi pedagogis.
- **Breakpoint kalkulator mobile** — slider dominant + number input collapse ke 2-row di mobile vs single row, planner pilih sesuai existing breakpoint pattern (`sm:`, `md:` Tailwind).
- **Test strategy** — minimum: 1 test untuk kalkulator math correctness (Vitest unit), 1 component test untuk GlossaryTooltip render & dictionary lookup, 1 Playwright UAT untuk navigation /kesehatan/<slug> + tooltip interaction. Planner boleh tambah snapshot test prose modul.
- **Glossary trigger element type** — `<span>` vs `<button>` untuk a11y. Recommended `<span tabIndex=0 role="button">` agar keyboard accessible tapi tidak break inline flow. Planner finalize.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Spec (Primary)
- `docs/superpowers/specs/2026-05-08-framework-page-design.md` §3 (Arsitektur — sub-routes & komponen baru), §5 (Kalkulator: input/output/discoverability), §6 (Modul: layout/konten/glossary), §8 (Visual: typography Inter vs Fraunces), §9 (Out of scope), §10 Open Question (modul authoring), Lampiran (mapping konten → modul React)

### Source Konten
- `docs/financial_framework.html` — 1515 baris HTML, source untuk port verbatim 6 modul. Section §02 Modul 01-06.

### Existing Code Patterns
- `src/tabs/kesehatan/modulCatalog.ts` — 6 modul slug+label+icon LOCKED, jangan diubah
- `src/tabs/kesehatan/KesehatanLayout.tsx` — parent layout `<Outlet />` pattern
- `src/tabs/kesehatan/KesehatanLanding.tsx` — landing card grid `MODUL_CATALOG.map()`
- `src/components/PanduanFullPage.tsx` — closest pattern: prose hardcoded JSX di TSX
- `src/components/ui/tooltip.tsx` — Radix Tooltip wrapper (existing dependency `radix-ui ^1.4.3`)
- `src/components/ui/slider.tsx` — custom HTML range slider (existing)
- `src/routes.tsx:32-40` — kesehatan nested route, child sub-routes Phase 15 add di sini

### Phase 12-14 Decisions (carry-forward)
- `.planning/phases/12-kesehatan-foundation/12-CONTEXT.md` — landing shell + sidebar grup Strategi + DIAG-11 empty state pattern
- `.planning/phases/13-diagnostic-data-indicators/13-CONTEXT.md` — tier panel + indikator data layer (Phase 15 NOT touch)
- `.planning/phases/14-protection-tier4-checklists/14-CONTEXT.md` — protection_checklist + View-As mode (Phase 15 modul read-only, no mutation)

### External (referenced di spec)
- Recharts v3.8.1 (already installed) — `<LineChart>` API for kalkulator
- `@fontsource/fraunces` — npm package untuk install di Phase 15 (NOT yet installed)

### Project Memory
- `project_supabase_migration_workflow.md` — N/A Phase 15 (no schema change)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`MODUL_CATALOG`** (`src/tabs/kesehatan/modulCatalog.ts`): 6 modul slug+label+icon source of truth — pakai di footer nav prev/next + landing grid (sudah).
- **`<Tooltip>` shadcn wrapper** (`src/components/ui/tooltip.tsx`): Radix Tooltip primitive ready — wrap untuk build `GlossaryTooltip`.
- **`<Slider>` custom** (`src/components/ui/slider.tsx`): HTML range, dipakai untuk 4 input kalkulator.
- **Recharts ^3.8.1**: `<LineChart>`, `<XAxis>`, `<YAxis>`, `<Tooltip>` — kalkulator chart.
- **Inter font**: configured Tailwind default; Fraunces ditambah sebagai `font-serif` variant.

### Established Patterns
- **Hardcoded TSX prose**: `PanduanFullPage.tsx` precedent — section JSX dengan heading h2/h3 + paragraph p + tooltip wrap.
- **Sub-route layout via `<Outlet />`**: `KesehatanLayout.tsx` already wraps children. Phase 15 add 7 child routes (6 modul + kalkulator).
- **Catalog-driven nav**: `MODUL_CATALOG.map()` sudah dipakai di landing grid; reuse untuk footer prev/next dgn `findIndex` + wrap-around.
- **Format Rp Indonesia**: search `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })` di src/lib — konsisten dgn pattern existing transaksi/dashboard.

### Integration Points
- `src/routes.tsx` line 32-40: tambah 7 child route ke `kesehatan` parent (`kalkulator`, `arus-kas`, `tujuan`, `alokasi-aset`, `instrumen`, `pajak-biaya-inflasi`, `perilaku`).
- `src/tabs/kesehatan/KesehatanLanding.tsx`: card link `/kesehatan/<slug>` sudah point ke route ini — Phase 15 isi target route.
- `src/tabs/kesehatan/KalkulatorBanner.tsx`: banner sudah ada — Phase 15 wire button ke `/kesehatan/kalkulator` real.
- `tailwind.config*`: belum ada (build via shadcn config). Cek `vite.config.ts` atau `app.config` untuk Fraunces font-family registration; mungkin via CSS variable di `src/index.css` atau equivalent.

</code_context>

<specifics>
## Specific Ideas (Hints, Not Requirements)

- **Kalkulator preset scenarios**: pertimbangkan tambah 2-3 button "Skenario": "Konservatif (5% return, 20 thn)", "Moderat (8%, 20)", "Agresif (12%, 30)" — preset slider. NOT spec'd, defer planner discretion. Kalau add, label Indonesian.
- **Glossary kemunculan strategi**: untuk 8 istilah, wrap kemunculan pertama per section H2 (bukan per modul) — balance antara discoverability dan noise. Author judgment per modul.
- **Modul reading time estimate**: optional badge "5 menit baca" di header modul — simple word-count ÷ 200 wpm. Defer planner discretion.
- **Kalkulator URL state**: pertimbangkan sync slider state ke URL query param (`?p=10000000&pmt=1000000&r=8&n=10`) untuk shareability — not spec'd, optional planner discretion.
- **Performance prose modul**: 6 file TSX prose ~5-10KB each setelah port. Total ~50KB JS payload setelah minify. Acceptable, no lazy-load split needed di v1.

</specifics>

<deferred>
## Deferred Ideas (Out of Scope Phase 15 — masuk v2 / future phases)

- Modul "Warisan & Estate Planning" (Tier 4 cuma checklist, no modul link — spec §9 acceptable asymmetry)
- Quiz tracking / score persistence (quick-check tracked di v2)
- Kalkulator suite tambahan: real return calculator, expense drag, retirement gap calculator, IPS Builder
- Risk tolerance quiz interaktif
- Behavior gap detector
- Adaptasi konten modul ke user-data pfm-web (port verbatim v1, adaptasi inkremental v2)
- Asset class normalization untuk DIAG-08 (trust user input v1)
- Tier panel "shareable snapshot" / export PDF
- Modul reading time tracking + completion badge
- Multi-language support (English version modul)
- Print-friendly modul styling

### Reviewed Todos (not folded)
None — todo match-phase 15 returned 0 matches.

</deferred>

---

*Phase: 15-modul-edukasi-kalkulator*
*Context gathered: 2026-05-10*
