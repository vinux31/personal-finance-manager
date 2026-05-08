---
status: partial
phase: 13-diagnostic-data-indicators
source: [13-VERIFICATION.md]
started: 2026-05-08T09:07:27Z
updated: 2026-05-08T09:07:27Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Visual UAT — Accordion expand/collapse interaction (Tier 1/2/3)
expected: Klik trapezoid Tier N → panel slide-down smooth (tw-animate-css). Klik Tier lain → tier sebelumnya auto-close (single-open). Klik Tier yang sama → collapse. Mobile ≤640px tetap responsive.
result: [pending]

### 2. Tier color aggregation correctness pada real user data
expected: Warna trapezoid match dengan aggregate panel — red kalau ada minimal 1 indikator merah, kuning kalau ada kuning tanpa merah, hijau kalau semua hijau, abu-abu kalau semua placeholder/cta-fallback.
result: [pending]

### 3. Empty-state CTA fallback render — DIAG-05 (no long-term goal)
expected: User tanpa goal `target_date > now+1y AND status='active'` → Tier 2 #5 render cta-fallback "Belum punya tujuan jangka panjang" + tombol "Buat Goals →" navigate /goals.
result: [pending]

### 4. Empty-state CTA fallback render — DIAG-06 (no pension simulation)
expected: User tanpa pension_simulations row → Tier 2 #6 render cta-fallback "Belum simulasi pensiun" + "Hitung di sini →" navigate /pensiun. View-As admin ke user lain juga graceful.
result: [pending]

### 5. Stale notice badge — DIAG-06 (updated_at > 6 bulan)
expected: Tier 2 #6 render compute variant + badge "Stale Xbln" kuning. Seed via SQL: `UPDATE pension_simulations SET updated_at = NOW() - INTERVAL '7 months'`.
result: [pending]

### 6. DAR Total info row contextualization (kprFraction display)
expected: Tier 1 info row — kprFraction>0.5 → "mayoritas KPR — beban rumah"; 0<kprFraction≤0.5 → "campuran KPR & utang konsumtif"; kprFraction=0 → "tanpa KPR". Total liab 0 atau aset 0 → info row tidak render.
result: [pending]

### 7. Asset type normalization spot-check — DIAG-08
expected: Investment dengan asset_type "Saham BBCA" + "saham bbca" + "  Saham BBCA  " (3 rows) → distinct count = 1.
result: [pending]

### 8. Properti/kendaraan EXCLUDE dari denominator Rasio Investasi — DIAG-07 (CRITICAL)
expected: User dengan properti Rp 1M + tabungan Rp 50jt + investments Rp 50jt → Rasio = 50% hijau (BUKAN 4.5% red).
result: [pending]

### 9. CTA navigation routes work end-to-end
expected: "Kelola akun" → /kekayaan, "Catat transaksi" → /transaksi, "Kelola Goals" → /goals, "Simulasi pensiun" → /pensiun, "Kelola investasi" → /investasi. Modul links → /kesehatan/{slug} (wildcard redirect /dashboard sampai Phase 15).
result: [pending]

### 10. Code review medium findings (MD-01 kprFraction 0.5 boundary, MD-02 30-day month drift)
expected: Confirm acceptable untuk v1.2 atau perlu fix. Both low-impact + acknowledged di REVIEW.md.
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps
