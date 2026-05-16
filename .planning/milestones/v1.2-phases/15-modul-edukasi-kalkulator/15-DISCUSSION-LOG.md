# Phase 15: Modul Edukasi & Kalkulator — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 15-modul-edukasi-kalkulator
**Areas discussed:** Konten modul (sourcing & format storage), UX kalkulator compound interest, Glossary tooltip wiring, Modul UX detail (footer nav, quick-check, font load)

---

## Konten Modul — Source & Format Storage

| Question | Options | Selected |
|---|---|---|
| Strategi sourcing konten 6 modul dari `docs/financial_framework.html`? | Port verbatim / Adapt-light / Author fresh | **Port verbatim** ✓ |
| Format storage konten modul? | TSX prose hardcoded / MDX + remark plugin / Single content.ts data + renderer | **TSX prose hardcoded** ✓ (user defer "reco kamu") |
| Quick-check questions render? | Prose-only static / Interactive form ungated / Skip total | **Prose-only static** ✓ |
| Footer nav antar modul? | Prev/Next + Semua modul / Grid 5 modul lainnya inline / Link tunggal kembali | **Prev/Next + Semua modul** ✓ |

**Notes:** Storage format user explicitly defer to Claude recommendation. Reasoning: pfm-web no MDX setup, konsisten dgn `PanduanFullPage.tsx` precedent, glossary 8 terms × ~30-50 occurrences manageable manual wrap.

---

## UX Kalkulator Compound Interest

| Question | Options | Selected |
|---|---|---|
| Input control 4 parameter? | Slider + number input combo / Slider only / Number input only | **Slider + number input combo** ✓ |
| Recalculation trigger? | Real-time on change / Debounced 300ms / Apply button explicit | **Real-time on change** ✓ |
| Chart variant? | Line chart simple / Stacked area principal+interest / Line + reference area target | **Line chart simple** ✓ (user "sesuai reco" → first option) |
| Tabel breakdown granularity? | 5-tahunan fix / Adjustable yearly/5-yearly toggle / Yearly fix | **5-tahunan fix** ✓ |

**Notes:** Compound math murah (loop max 40 iterasi), no debounce needed. Spec §5 default chart variant adalah Line — Claude recommendation aligned.

---

## Glossary Tooltip Wiring

| Question | Options | Selected |
|---|---|---|
| Mekanisme rendering glossary tooltip? | Manual `<GlossaryTooltip term>` tag / Auto-detect via JSX walker runtime / First-occurrence only auto | **Manual tag** ✓ (sesuai spec) |
| Lokasi single source of truth 8 definisi? | `src/data/glossary.ts` / Inline di GlossaryTooltip.tsx / JSON file di public/ | **`src/data/glossary.ts`** ✓ |
| Behavior tooltip di mobile (touch)? | Tap to open, tap outside to close / Long-press only / Inline expand | **Tap to open, tap outside to close** ✓ |
| Visual hint istilah glossary di prose? | Dotted underline + cursor-help / Solid underline + bold / Icon ⓘ inline | **Dotted underline + cursor-help** ✓ |

**Notes:** Manual tag selected = author kontrol kapan tooltip muncul (avoid noise istilah berulang). Type-safe glossary dictionary di `src/data/glossary.ts` konsisten dgn pattern `src/queries/*` existing.

---

## Modul UX Detail (Footer Nav, Quick-check, Font Load)

| Question | Options | Selected |
|---|---|---|
| Strategi loading Fraunces serif font? | Route-level lazy via `@fontsource` / Google Fonts `<link>` global / Inline @import CSS only saat mount | **`@fontsource/fraunces` route-level lazy** ✓ |
| Layout modul page? | Centered prose max-width 65ch / Wide max-width 80ch dengan side TOC / Two-column dengan sidebar related | **Centered prose max-w-[65ch]** ✓ (sesuai spec §6) |
| Breadcrumb pattern di header modul? | `Kesehatan / <Modul>` / `Strategi / Kesehatan / <Modul>` / Cuma back arrow + judul | **`Kesehatan / <Modul>`** ✓ (sesuai spec) |
| Header sticky vs static? | Static (scroll dgn page) / Sticky breadcrumb only / Sticky judul + breadcrumb | **Static** ✓ |

**Notes:** Self-hosted Fraunces via `@fontsource` avoid Google Fonts external request + CLS. AppShell topbar/sidebar tetap sticky di luar — pure reading mode.

---

## Claude's Discretion

- Tone of voice prose modul (light-edit if konflik gaya)
- Code/SQL example handling di prose (mono fallback)
- Studi kasus mata uang convert USD→Rp jika ada
- Breakpoint mobile kalkulator
- Test strategy (Vitest math + component + Playwright UAT)
- Glossary trigger element type a11y

## Deferred Ideas

- Modul "Warisan & Estate Planning" (asymmetry acceptable)
- Quiz tracking / score persistence
- Kalkulator suite tambahan (real return, expense drag, retirement gap, IPS Builder)
- Risk tolerance quiz, behavior gap detector
- Adaptasi konten ke user-data
- Asset class normalization
- Modul reading time + completion badge
- Multi-language EN
- Print-friendly styling
