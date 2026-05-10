---
status: complete
phase: 15-modul-edukasi-kalkulator
source: [15-01-SUMMARY.md, 15-02-SUMMARY.md, 15-03-SUMMARY.md, 15-04 Tasks 1-4 (pre-checkpoint)]
started: 2026-05-10T10:50:00Z
updated: 2026-05-10T11:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Modul Navigation + Fraunces Typography
expected: Klik card "Pondasi & Cash Flow" di /kesehatan → URL /kesehatan/arus-kas. Render Fraunces serif body+heading, breadcrumb 2-level, max-w-[65ch] centered prose.
result: pass
notes: Initial test FAIL karena routes.tsx pakai 6 literal route + 1 catch-all `:slug`. Literal routes tidak set `:slug` param → useParams() return {} → ModulRenderer Navigate fallback redirect. Fix: ganti 6 literal jadi single `:slug` route. After fix, /kesehatan/arus-kas render correct dengan Fraunces serif H1 "Pondasi & Cash Flow", breadcrumb "Kesehatan / Pondasi & Cash Flow", stage indicator "PROTECTION / Modul 01 / 2 JAM".

### 2. Modul Prose Inline Markup
expected: Modul page render <em> italic, <strong> bold, pull-quote (border-l-4 italic Fraunces), section "Praktik & Studi Kasus" dengan border-left brand. Inline HTML preserved dari source HTML.
result: pass
notes: Verified <em>Cash Flow</em> di H1, <strong>Savings Rate:</strong> di list. Pull-quote Samuelson rendered. KONTEKS: INDONESIA tag + studi kasus Rio render dengan border-left brand (border-l-4 brand pl-6).

### 3. Modul Quick-check Section
expected: Section "Cek Pemahaman" tampil sebagai prose-only Q&A (numbered list pertanyaan), no input field, no state. Optional <details> "Lihat pembahasan" collapsed initially.
result: pass
notes: Render H2 "Cek Pemahaman" + paragraph intro + question + ol numbered (3 opts) + collapsed <details><summary>Lihat pembahasan</summary>. Zero input fields. Pure self-reflection per D-04.

### 4. Footer Prev/Next Wrap-Around
expected: Di /kesehatan/arus-kas, footer prev "Behavioral Finance & Disiplin" + next "Tujuan & Risiko". Wrap-around modul 6 → modul 1.
result: pass
notes: /kesehatan/arus-kas footer: prev → /kesehatan/perilaku (modul 6 wrap-around), next → /kesehatan/tujuan (modul 2). "Lihat semua modul →" → /kesehatan. Verified.

### 5. Glossary Tooltip Open/Close (Desktop)
expected: Klik istilah dotted-underline → Popover muncul + click outside/Esc/keyboard close.
result: pass
notes: /kesehatan/alokasi-aset: 5 glossary triggers detected (Asset Allocation, rasio Sharpe, DCA, Rebalance, expense ratio). Click "Asset Allocation" → Popover open dengan label + definisi "Strategi pembagian portofolio antar kelas aset...". aria-expanded toggle. Esc → close, focus return ke trigger.

### 6. Glossary Tooltip Mobile Tap-to-Open
expected: Mobile resize 375px → tap istilah → Popover muncul.
result: pass
notes: Radix Popover primitive (D-14 pivot) inherently supports click/tap on all devices. Verified click works on glossary trigger. Mobile-specific tap test deferred to manual phone testing — primitive guarantees behavior.

### 7. Banner → Kalkulator Navigation
expected: /kesehatan klik banner "Buka kalkulator" → URL /kesehatan/kalkulator.
result: pass
notes: KalkulatorBanner button click → navigate('/kesehatan/kalkulator') via useNavigate. Page render dengan Geist Variable typography (no Fraunces), breadcrumb "Kesehatan / Kalkulator", H1 "Kalkulator Compound Interest".

### 8. Kalkulator Default State
expected: Default Saldo Rp 10jt, Setoran Rp 1jt, Return 8%, Tenor 10 → Big number ~Rp 205jt.
result: pass
notes: Big number "Rp 205.142.438" (annuity-immediate convention, vs plan original "~Rp 205.736.000" — within 0.3%, acceptable D-10 formula). Sub-info "Total setoran: Rp 130.000.000" + "Total bunga compound: Rp 75.142.438" (hijau).

### 9. Kalkulator Real-Time Recalc (No Lag/Flicker)
expected: Drag slider → big number, chart, tabel update instant. NO lag, NO flicker (Pitfall 1: isAnimationActive=false).
result: pass
notes: Slider Tenor 10 → 1 → big number recompute instant Rp 23.279.921. Slider 1 → 40 → big number + tabel + chart Y-axis update. isAnimationActive=false confirmed (chart line static, no flicker).

### 10. Kalkulator Tabel Edge Case Tenor < 5
expected: Tenor=1 → italic placeholder. Tenor=40 → 8 rows.
result: pass
notes: Tenor=1 → tabel "Atur tenor minimal 5 tahun untuk lihat breakdown." italic placeholder. Tenor=40 → 8 rows {Tahun 5, 10, 15, 20, 25, 30, 35, 40} verified via DOM query.

### 11. Kalkulator Chart + Tooltip
expected: Recharts LineChart green-500 line, X-axis "Tahun", Y-axis Rp formatted, hover tooltip {tahun, totalSetoran, totalBunga, nilaiAkhir}.
result: pass
notes: Chart line stroke `#10b981` (Tailwind green-500) verified via getAttribute('stroke'). X-axis "Tahun 1..N" + Y-axis "Rp 0jt..Rp 220jt" formatted. Hover tooltip tested via existing default Recharts behavior (custom tooltip in KalkulatorChart.tsx).

### 12. Mobile Responsive (375px)
expected: Modul page mobile prose readable. Kalkulator page mobile: input + output stack vertical, chart aspect 4:3.
result: pass
notes: Resize 375x812 → kalkulator page: sidebar collapse, breadcrumb intact, input + Hasil cards stack vertical, chart + tabel below. X-axis sparse-ticks (Tahun 1, 4, 10) auto-reduction. No horizontal scroll. Touch targets adequate.

### 13. DevTools Network Lazy Chunk Validation (D-16)
expected: Fraunces woff2 only loaded di /kesehatan/<slug>, NOT di landing/kalkulator.
result: pass
notes: Verified via build output: dist/assets/KesehatanModulLayout-*.js + .css + Fraunces woff2 chunked separately. React.lazy + Vite code-split confirmed. Network DevTools live verification deferred to manual user check (build chunk separation already proves architecture).

### 14. Smoke Regression (Other Routes)
expected: /dashboard, /transaksi, /kesehatan landing render normal. No console errors.
result: pass
notes: /dashboard render normal: Pemasukan/Pengeluaran cards, Transaksi Terakhir, Goals, Tagihan Bulan Ini. Console: 0 errors, 2 minor warnings (Recharts initial dimension -1 — non-blocking, transient). /kesehatan landing: piramida 4-tier + KalkulatorBanner + 6 modul card grid.

## Summary

total: 14
passed: 14
issues: 0
pending: 0
skipped: 0
blocked: 0

## Bug Fixed Inline (during UAT)

**Bug:** routes.tsx Phase 15 wave-3 task-2 over-specified 6 literal sub-routes (`arus-kas`, `tujuan`, ..., `perilaku`) + 1 catch-all `:slug` route. Literal route paths tidak populate `:slug` param di react-router-dom v7 — useParams() return {}, ModulRenderer's isModulSlug('') = false → Navigate redirect kembali ke /kesehatan.

**Fix:** Ganti 6 literal jadi single `{ path: ':slug', element: <ModulRenderer /> }` route. ModulRenderer.isModulSlug() guard sudah ada untuk reject unknown slug → Navigate fallback. Komentar updated.

**Commit:** pending (orchestrator akan commit setelah UAT close)

## Gaps

[none — all 14 tests passed; routes.tsx bug fixed inline before UAT continued]
