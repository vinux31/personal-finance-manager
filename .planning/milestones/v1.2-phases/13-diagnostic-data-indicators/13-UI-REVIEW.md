---
status: complete
phase: 13-diagnostic-data-indicators
overall_score: 20/24
audited: 2026-05-08
auditor: gsd-ui-reviewer (claude-opus-4-7-1m)
baseline: abstract 6-pillar standards (UI-SPEC.md tidak ada untuk Phase 13)
screenshots: pre-fix UAT screenshots tersedia (root); production gated (auth-redirect)
---

# Phase 13 — UI Review: Diagnostic Data Indicators

Audit terhadap implementasi Phase 13 (Accordion + 4 trapezoid piramida + IndikatorCard 3-variant + 8 indikator data-driven + DAR Total info row + smart fallback CTA + tier color aggregation). Tidak ada UI-SPEC.md untuk Phase 13 — audit pakai standar 6 pillar abstrak. Source spec: `docs/superpowers/specs/2026-05-08-framework-page-design.md` §4 (formula + threshold + CTA mapping).

Production URL `https://kantongpintar.vercel.app/kesehatan` auth-gated (Google login required) → screenshot otomatis dapat halaman login. Audit pakai 3 screenshot UAT yang sudah ada di root project (`phase13-uat-01..03.png`, dibuat 17:48–17:50 sebelum F-01 round 4 fix shipped) + analisis kode lengkap.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Bahasa Indonesia konsisten, tone tepat (kamu/kasual), CTA spesifik dan kontekstual; threshold hint memakai separator unicode `·` rapi |
| 2. Visuals | 3/4 | Iconography dipakai tepat (AlertCircle/Lightbulb/BookOpen/ArrowRight); piramida trapezoid clip-path identitas kuat; tapi Tier 4 placeholder kurang ada visual hint (cuma teks abu) |
| 3. Color | 3/4 | Skema 4-state hijau/kuning/merah/abu konsisten, dark-mode sudah di-cover, border-l-4 + badge 60/40 split bagus; minor: amber/yellow naming konsep beda di code (`yellow` key → `bg-amber-*` class) bisa membingungkan refactor mendatang |
| 4. Typography | 3/4 | Skala tersusun (text-2xl > text-lg > text-sm > text-xs > text-[10px] > text-[9px]) — terlalu banyak step (6) untuk kontainer kecil; threshold hint 10px sangat kecil di mobile |
| 5. Spacing | 3/4 | Memakai skala Tailwind standar (p-3/p-4, space-y-1/2/4, gap-2/3) — konsisten; minor: Accordion `pb-4 pt-0` di shadcn default + `p-4` di TierPanel = 16px+16px stack inconsistent dengan space-y-4 (32px) di parent |
| 6. Experience Design | 4/4 | Loading skeleton ada, error state ada, smart fallback CTA pattern excellent (3 variant: compute/placeholder-data-tipis/cta-fallback), single-open accordion, ARIA proper (aria-label, aria-labelledby, sr-only headings), keyboard nav via Radix |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Threshold hint `text-[10px]` terlalu kecil di mobile** (IndikatorCard.tsx:107) — User dengan vision normal saja sulit baca legend pada viewport 375px (deviasi WCAG 2.1 SC 1.4.4 jika tidak bisa di-zoom). Fix: naikkan ke `text-xs` (12px) dan biarkan thresholdHint wrap ke 2 baris jika perlu — atau pindah hint ke tooltip on-hover/ikon Info untuk hemat vertical space.

2. **Tier 4 placeholder visual ambigu** (Tier4Panel.tsx → TierPanel.tsx:58) — Saat user expand Tier 4, hanya muncul kotak abu dengan satu kalimat. Tidak ada lock icon, tidak ada timeline ("akan tersedia di Phase 14"), tidak ada CTA alternatif. User bisa kira ini bug. Fix: tambahkan `<Lock />` icon dari lucide + heading kecil "Coming soon" + sub-text estimasi kapan + (optional) CTA "Lihat Tier 1-3 dulu" yang trigger setOpenTier('tier-1').

3. **Mobile trapezoid label history truncation** (PiramidaShell.tsx + UAT screenshot phase13-uat-03 dibuat 17:50 yaitu SEBELUM commit f08949d round-4 fix) — Screenshot UAT mobile yang masih live di repo menunjukkan "WA" dan "PERTUMBU" terpotong; HUMAN-UAT mengklaim post-fix verified production tapi tidak ada screenshot post-fix yang di-update. Risk: regression bisa terjadi tanpa visual baseline. Fix: capture screenshot mobile post-fix baru (375x812) ke `.planning/ui-reviews/13-*` sebagai baseline. Jika masih ada truncation di tier 4 sangat sempit (50% width × 375px = 187px ÷ clip-path inset 5% × 2 = 169px effective), pertimbangkan singkat label "WARISAN" → "WARIS" / shorten subtitle hide threshold lebih agresif.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Audit sumber: 4 file tier panel + IndikatorCard + KesehatanLanding + spec mapping.

**Strengths:**
- Tidak ada generic label (`Submit`, `OK`, `Cancel`) — grep verified zero match di `src/tabs/kesehatan/`.
- CTA labels spesifik dengan verb + objek + arrow:
  - Tier1Panel.tsx:67-68: "Kelola akun & utang" + "Catat transaksi"
  - Tier2Panel.tsx:42-43: "Kelola Goals" + "Simulasi pensiun"
  - Tier3Panel.tsx:40: "Kelola investasi"
  - IndikatorCard.tsx:50: "Catat transaksi" (placeholder-data-tipis)
- Smart fallback message kontekstual:
  - kesehatanTier2.ts:340 "Belum punya tujuan jangka panjang" (bukan "No data" generic)
  - kesehatanTier2.ts:472 "Belum simulasi pensiun"
  - kesehatanTier2.ts:491 "Simulasi pensiun belum punya source aktif"
- Empty state berbeda untuk tiap konteks (data-tipis vs no-row vs stale) — 3 variant terpisah di IndikatorCard.tsx:27/59/89.
- Tone "kamu" konsisten (KesehatanLanding.tsx:99 "Lihat kondisi keuangan **kamu**", Tier1Panel.tsx:30 "DAR Total **kamu**") — sesuai user_language.md preference Bahasa Indonesia kasual.
- DAR Total kontekstualisasi (Tier1Panel.tsx:31-35): "(mayoritas KPR — beban rumah)" / "(campuran KPR & utang konsumtif)" / "(tanpa KPR)" — informative, bukan cuma angka kering.
- Threshold hint format konsisten dengan separator unicode `·`: "≥ 6 bulan hijau · 3-5 kuning · < 3 merah".
- Stale notice tooltip (IndikatorCard.tsx:101): `title="Simulasi terakhir: ${result.staleMonths} bulan lalu"` — accessible context.

**Minor:**
- Trapezoid `aria-label="Tier ${tier.id} ${tier.label}"` (PiramidaShell.tsx:79) — bagus tapi tidak menyebut warna/state. Untuk screen reader user, "Tier 1 PROTEKSI: merah, 1 dari 4 indikator butuh perhatian" lebih informatif. Defer (low impact).

### Pillar 2: Visuals (3/4)

**Strengths:**
- Iconography dari lucide-react konsisten:
  - `AlertCircle` untuk placeholder-data-tipis (IndikatorCard.tsx:33) — semantic warning
  - `Lightbulb` untuk cta-fallback (IndikatorCard.tsx:65) — semantic suggestion/idea
  - `BookOpen` untuk modul edukasi (TierPanel.tsx:111)
  - `ArrowRight` konsisten di setiap CTA (IndikatorCard.tsx:50/80, TierPanel.tsx:95)
  - `ChevronDownIcon` di Accordion (accordion.tsx:44) hidden via `[&>svg]:hidden` di KesehatanLanding.tsx:138 — disengaja agar trapezoid jadi pure visual trigger
- Piramida trapezoid identity strong: `clip-path: polygon(5% 0, 95% 0, 100% 100%, 0 100%)` (PiramidaShell.tsx:68) — visual hierarchy dari width 50% → 65% → 80% → 95%.
- Hover affordance: `hover:-translate-y-0.5 transition-transform` (PiramidaShell.tsx:77) — subtle micro-interaction.
- Border-left-4 colored (`border-l-4 ${COLOR_BORDER_CLASS[result.color]}`) di IndikatorCard.tsx:91 = scan-friendly state strip.

**Findings:**
- **Tier 4 placeholder kurang visual cue** (Tier4Panel.tsx → TierPanel.tsx:58 — kotak abu polos): Tidak ada lock icon, tidak ada illustration, tidak ada warna. User bisa misinterpret sebagai bug atau missing data. (→ Top 3 #2)
- **Empty state piramida** (PiramidaShell.tsx:117-121) — sudah punya muted text "Yuk mulai isi data..." bagus, tapi 4 trapezoid abu identik tanpa cue interactivitas (cursor-pointer tetap aktif walau tidak click-able informative). Klik trigger toast (PiramidaShell.tsx:102), informational only — minor concern.
- **Accordion trigger styling**: KesehatanLanding.tsx:138 `[&>svg]:hidden` menghapus chevron Radix default — disengaja karena piramida adalah visual cue. Tapi konsekuensinya tidak ada visual indicator state (open/closed) selain warna trapezoid. Pertimbangkan subtle `[data-state=open]:opacity-90` atau slight scale untuk feedback state.

### Pillar 3: Color (3/4)

Audit: `kesehatanTypes.ts` lines 93-105.

**Color usage pattern:**
- 4-state palette: `green | yellow | red | gray` (kesehatanTypes.ts:93)
- Light + dark mode coverage:
  - Badge: `bg-{color}-100 text-{color}-700 dark:bg-{color}-900/30 dark:text-{color}-400`
  - Border: `border-l-{color}-500`
- Semantic mapping correct: hijau = sehat, kuning = perhatian, merah = action needed, abu = no data.
- Trapezoid solid color (PiramidaShell.tsx:60-63) `bg-green-500/bg-amber-500/bg-red-500 text-white` — high contrast, scan-friendly.
- 60/30/10 informal split: dominant neutral (card/muted), 30% structural color (border-l-4 strip), 10% accent (badge fill).

**Findings:**
- **Naming inconsistency `yellow` vs `amber`** (kesehatanTypes.ts:95, PiramidaShell.tsx:61): Type system pakai `yellow` sebagai key, tapi class real adalah `bg-amber-*`. Refactor di masa depan (mis. ganti palette) developer baru bisa miss. Fix kecil: rename type key ke `amber` ATAU comment di types file: `// 'yellow' = amber (Tailwind palette), nama kept for spec parity`.
- **Badge contrast Hijau-100/700** AA-compliant (~7:1) — OK. Red-100/700 ~6.5:1 — OK. Amber-100/700 ~4.5:1 — borderline AA untuk small text 10px (threshold hint), gabung dengan finding Pillar 4 #1.
- **Trapezoid bg-amber-500 + text-white** kontras ~3.1:1 — fail AA untuk text small, tapi label trapezoid font-semibold 12px+ (text-xs sm:text-sm) → masuk WCAG large-text exception (≥14pt bold ~3:1 OK). Acceptable tapi marginal.
- **Hardcoded color check:** Zero `#xxxxxx` hex literal di `src/tabs/kesehatan/` — semua via Tailwind tokens. Bagus.
- **Dark-mode coverage 100%** untuk indicator cards (kesehatanTypes.ts:93-104). Tapi PiramidaShell.tsx:62-63 trapezoid colored TIDAK punya `dark:` variant — `bg-green-500 text-white` sama-sama kontras di dark mode tapi mungkin clash dengan dark background. Spot check perlu visual UAT dark-mode.

### Pillar 4: Typography (3/4)

Audit: text-* class distribution.

**Sizes in use (in src/tabs/kesehatan/):**
- `text-2xl` (24px) — h1 page header (KesehatanLanding.tsx:97)
- `text-xl` (20px) — EmptyStateCTA card title
- `text-lg` (18px) — h2 section "Modul Edukasi" (KesehatanLanding.tsx:167)
- `text-base` (16px) — ModulCard title
- `text-sm` (14px) — body, subtitle, CTA button
- `text-xs` (12px) — meta, modul links, button-sm content
- `text-[10px]` arbitrary — staleMonths badge (IndikatorCard.tsx:99) + threshold hint (IndikatorCard.tsx:107)
- `text-[9px]` arbitrary — tier subtitle "Tier N" mobile (PiramidaShell.tsx:70, sm:text-[10px])

**Weights in use:**
- `font-bold` — h1 only
- `font-semibold` — h2, badge, EmptyStateCTA labels, trapezoid label
- `font-medium` — IndikatorCard label, KalkulatorBanner copy

**Findings:**
- **6 distinct sizes** dalam 1 phase (text-2xl/xl/lg/base/sm/xs) + 2 arbitrary (text-[9px], text-[10px]) = 8 total. Threshold "<4 ideal" → finding. Konteks Phase 13: 6 size masih reasonable untuk landing dengan multiple sections (header/section/card/badge/meta), tapi `text-[9px]` dan `text-[10px]` dipakai khusus untuk visual constraint (clip-path narrow + threshold hint). Ke depan: consolidate `text-[10px]` ke `text-xs` (12px) wherever possible.
- **`text-[10px]` threshold hint** (IndikatorCard.tsx:107) — terlalu kecil. Mobile Pixel test 375px: legend "≥ 6 bulan hijau · 3-5 kuning · < 3 merah" dapat <300px width karena layout sidebar absent → wrap ke 2 baris OK, tapi 10px font fail WCAG 2.1 SC 1.4.12 (text spacing user override). (→ Top 3 #1)
- **`text-[9px] sm:text-[10px]`** subtitle "Tier N" (PiramidaShell.tsx:70) — sangat kecil, tapi `sm:inline` (≥640px only) dan hidden mobile (`hidden`). Acceptable karena ini metadata redundant (tier id) sudah encoded di label "PROTEKSI/AKUMULASI/PERTUMBUHAN/WARISAN". Mobile hide intentional.
- **Weight hierarchy clean:** bold (1 use) > semibold (4 use) > medium (3 use) > normal (rest). Konsisten 3-tier hierarchy.
- **Truncate strategy** (PiramidaShell.tsx:71 `min-w-0 flex-1 truncate text-center`) — bagus untuk overflow protection, tapi tidak ideal untuk label yang TIDAK boleh terpotong (label adalah fokus visual). HUMAN-UAT confirms post-fix verified, tapi UAT-03 screenshot di repo (pre-fix) masih show "WA"/"PERTUMBU" truncation → false negative risk untuk reviewer baru. (→ Top 3 #3)

### Pillar 5: Spacing (3/4)

**Spacing classes dominan:**
- `space-y-{1|2|3|4|6}` — vertical rhythm konsisten
- `gap-{1|2|3|4}` — flex/grid spacing
- `p-{2|3|4}`, `px-{2|3|5}`, `py-{0.5|1|2|4|5}` — padding
- `pt-{0|2|3}`, `pb-4` — directional

**Findings:**
- **Skala konsisten Tailwind default** (4px/8px/12px/16px/24px) — tidak ada arbitrary spacing seperti `p-[7px]` atau `mt-[13px]`. Verified via grep: zero `\[\d+px\]` arbitrary spacing match in `src/tabs/kesehatan/`.
- **Stack rhythm divergence**: 
  - KesehatanLanding parent `space-y-6` (24px) — section spacing
  - TierPanel `space-y-4 p-4` (16px+16px) — panel spacing
  - IndikatorCard `space-y-1` (4px) — atom spacing
  - 6 → 4 → 2 → 1 — geometric, OK rasanya konsisten.
- **Accordion stacking**: shadcn AccordionContent default `pb-4 pt-0` (accordion.tsx:61) + TierPanel `p-4` (TierPanel.tsx:56) → `pb-4` accordion + `pt-4` panel = double padding 32px bottom-of-content + top-of-panel. Minor visual. Fix: `<TierPanel>` set `p-4 pt-0` ATAU AccordionContent override `pb-0` di shell. Low priority.
- **Density mobile**: `flex flex-wrap gap-2 pt-2` di CTA row (TierPanel.tsx:86) — wrap acceptable di mobile (2 button stack), gap-2 = 8px tight. OK.
- **Modul links border-t pt-3 space-y-1** (TierPanel.tsx:103) — visual divider + tight stack. OK.
- **PiramidaShell `gap-1 py-4`** (PiramidaShell.tsx:45) — 4px gap antar trapezoid + 16px vertical container = visual continuity stack pyramid. Bagus.

### Pillar 6: Experience Design (4/4)

**State coverage:**
- ✅ **Loading state**: KesehatanLanding.tsx:107-114 skeleton 4 trapezoid mock-up, IndikatorCard skeleton ada di KesehatanLanding.tsx:69-76 saat indikator.isLoading.
- ✅ **Error state**: KesehatanLanding.tsx:116-120 `<p className="text-sm text-destructive">` "Gagal memuat data. Coba refresh halaman." Plus countQuery error path (line 117).
- ✅ **Empty state**: 3 variant terpisah:
  - Whole-page empty (count<3): PiramidaShell variant="grayed-empty" + EmptyStateCTA (KesehatanLanding.tsx:122-124)
  - Per-indicator data-tipis: IndikatorCard placeholder-data-tipis variant (IndikatorCard.tsx:27)
  - Per-indicator no-source: IndikatorCard cta-fallback variant (IndikatorCard.tsx:59)
- ✅ **Stale state**: IndikatorCard staleMonths badge (line 97-104), tooltip via title attr.
- ✅ **Disabled state**: N/A — Phase 13 tidak punya destructive action di tier panel (semua navigate, bukan mutate).
- ✅ **Confirmation**: N/A — Phase 13 read-only.

**Accessibility:**
- ✅ ARIA labels: `aria-label="Tier ${tier.id} ${tier.label}"` (PiramidaShell.tsx:79), `aria-labelledby="piramida-heading"` etc.
- ✅ Semantic headings: `<h1>` page, `<h2>` sections (sr-only kalau tidak visible).
- ✅ Focus ring: `focus:outline-none focus:ring-2 focus:ring-ring` (PiramidaShell.tsx:77, 110).
- ✅ Keyboard nav: Radix Accordion built-in (Tab/Enter/Space/Arrow keys).
- ✅ Screen reader text: `sr-only` headings di setiap section (KesehatanLanding.tsx:105, 154, 162).
- ⚠️ Trapezoid `<div role="..."?` — PiramidaShell.tsx:76-83 `<div>` dengan cursor-pointer + tabindex absent (Radix Accordion handle via AccordionTrigger wrap di KesehatanLanding.tsx:138). Saat empty/no-renderTrigger, falls back ke `<button>` (line 99). OK.

**Interaction patterns:**
- ✅ Single-open Accordion (KesehatanLanding.tsx:128 `type="single" collapsible`) — verified Item 1 HUMAN-UAT.
- ✅ React Router navigate (TierPanel.tsx:53/91, IndikatorCard.tsx:24/49/78) bukan `<a href>` — preserve SPA state.
- ✅ Mobile responsive: `flex-wrap` pada CTA, `space-y-2` stack indikator, max-w-md container.

**View-As compatibility** (Tier 13 scope only — read-only):
- ✅ `useTargetUserId()` di useProtectionChecklist (kesehatanIndikator.ts:61) + existing hooks (useTransactions/useGoals/useInvestments/usePensionSim) sudah View-As-aware. Indikator render pakai data viewed-user.

**Phase 13 specific UX wins:**
- 3-variant IndikatorCard pattern (compute / placeholder-data-tipis / cta-fallback) — UX excellence, tiap variant mengarahkan user ke action berbeda yang sesuai konteks.
- Smart fallback: bukan render "—" / "N/A" generik tapi memberi kontekstual message + CTA spesifik yang aktionable.
- Tier color aggregation (kesehatanIndikator.ts:165-175): pure function, deterministic, sesuai spec §4 — visual feedback langsung dari data state.

---

## Registry Safety

`components.json` exists. Phase 13 mengaktifkan **shadcn Accordion** (`src/components/ui/accordion.tsx`) — checked: pure Radix wrapper, tidak ada `fetch()`/`process.env`/`eval()`. Tidak ada third-party registries declared di Phase 13. Registry audit: 1 shadcn-official block (Accordion) checked, no flags.

---

## Files Audited

**Source files (Phase 13 deliverables):**
- `src/tabs/kesehatan/KesehatanLanding.tsx` (entry route, Accordion wrapper, branching loading/empty/normal)
- `src/tabs/kesehatan/PiramidaShell.tsx` (4-tier trapezoid + tierColors + renderTrigger hook)
- `src/tabs/kesehatan/IndikatorCard.tsx` (3 variants: compute/placeholder/cta-fallback)
- `src/tabs/kesehatan/TierPanel.tsx` (generic shell — indicators + infoSlot + ctas + modulLinks)
- `src/tabs/kesehatan/Tier1Panel.tsx` (4 indicators + DAR Total info + 2 CTA + 1 modul link)
- `src/tabs/kesehatan/Tier2Panel.tsx` (Goals + Pensiun + 2 CTA + 1 modul link)
- `src/tabs/kesehatan/Tier3Panel.tsx` (Rasio Investasi + Diversifikasi + 1 CTA + 2 modul links)
- `src/tabs/kesehatan/Tier4Panel.tsx` (placeholder text — Phase 14 deliver)
- `src/components/ui/accordion.tsx` (shadcn-official wrapper)
- `src/queries/kesehatanTypes.ts` (color tokens + thresholds)
- `src/queries/kesehatanIndikator.ts` (useIndikator + deriveTierColors + aggregateTierColor)

**Planning context:**
- `.planning/phases/13-diagnostic-data-indicators/13-CONTEXT.md` (decisions locked)
- `.planning/phases/13-diagnostic-data-indicators/13-HUMAN-UAT.md` (7 PASS / 2 SKIP / 1 PENDING; F-01/F-02 RESOLVED)
- `.planning/phases/13-diagnostic-data-indicators/13-02-PLAN.md`, `13-03-PLAN.md`, `13-04-PLAN.md`
- `docs/superpowers/specs/2026-05-08-framework-page-design.md` (formula + threshold + CTA mapping spec)

**Visual references:**
- `phase13-uat-01-piramida-collapsed.png` — desktop, full sidebar visible, Tier 1 RED + Tier 2/3 GREEN + Tier 4 GRAY (matches HUMAN-UAT Item 2)
- `phase13-uat-02-tier1-expanded.png` — Tier 1 expanded showing 4 IndikatorCard (Dana Darurat placeholder, Savings Rate placeholder, DAR Konsumtif 0%, Asuransi Kesehatan "Belum diisi") + 2 CTA + modul link "Pondasi & Cash Flow"
- `phase13-uat-03-mobile-piramida.png` — mobile 375px **PRE-FIX** (timestamp 17:50 vs F-01 round 4 commit f08949d after); shows truncation regression; needs re-capture post-fix as baseline

---

## Recommendation Count

- **Priority fixes:** 3 (text-[10px] readability, Tier 4 visual cue, mobile baseline screenshot stale)
- **Minor recommendations:** 5
  1. `yellow` vs `amber` naming inconsistency in COLOR_BADGE_CLASS — add inline comment
  2. Trapezoid colored bg lacks `dark:` variant in PiramidaShell.tsx:62-63 — verify dark mode
  3. AccordionContent + TierPanel double padding 32px stack — set `pt-0` on TierPanel inner
  4. Trapezoid aria-label could include state ("Tier 1 PROTEKSI: merah, perlu perhatian")
  5. Accordion trigger lacks visual state indicator (chevron hidden by design) — consider subtle `[data-state=open]:opacity-90` or scale feedback
- **No-fix observations:** 4
  1. Hardcoded color check — zero hex literals (clean)
  2. Arbitrary spacing check — zero `[Npx]` patterns (clean)
  3. ARIA + keyboard nav — comprehensive
  4. Smart fallback CTA pattern — exemplary, recommend extracting as reusable design pattern for other phases
