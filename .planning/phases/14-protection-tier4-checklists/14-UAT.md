---
status: testing
phase: 14-protection-tier4-checklists
source: 14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md
started: 2026-05-09T14:50:23Z
updated: 2026-05-09T14:50:23Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Pre-UAT reset state
expected: |
  Dev server running (`npm run dev` → vite :5174), logged in as test user.
  Run `supabase/scripts/reset-protection-checklist.sql` in Supabase Studio SQL Editor.
  Final SELECT shows 0 rows OR all 8 business columns NULL for current user.
awaiting: user response

## Tests

### 1. Pre-UAT reset state
expected: Dev server running, reset SQL ran clean, protection_checklist row all-NULL or absent for current user
result: [pending]

### 2. Tier 1 #4 — State A render
expected: At /kesehatan Tier 1 expanded, card #4 (Asuransi Kesehatan) shows red border + "Belum diisi" badge + "Pilih cover →" button
result: [pending]

### 3. Tier 1 #4 — State A→B (open form)
expected: Click "Pilih cover →" → 5 radio options visible (BPJS / Asuransi Kantor / Asuransi Swasta / Kombinasi / Tidak ada) + [Batal | Simpan] buttons. Simpan disabled until radio selected.
result: [pending]

### 4. Tier 1 #4 — State B→C success path
expected: Select "Kombinasi" → click Simpan → optimistic <50ms green flip + sonner toast "Tersimpan" + Tier 1 piramida color updates to reflect aggregate
result: [pending]

### 5. Tier 1 #4 — State C→B→C edit
expected: Click pencil icon → form re-opens with current value preselected → change to "Tidak ada" → Simpan → red flip + toast
result: [pending]

### 6. Tier 1 #4 — Cancel flow
expected: Click pencil → click Batal → revert to State C with prior value intact, no mutation fired, no toast
result: [pending]

### 7. Tier 1 #4 — Network failure rollback
expected: DevTools Network tab → Offline → click Simpan → optimistic flip → ~3s later rollback to previous state + sonner error toast
result: [pending]

### 8. Tier 1 #4 — View-As guard (DIAG-12)
expected: Enter View-As mode (admin viewing other user) → amber notice "Mode View-As: read-only" at top of Tier1Panel + State A no "Pilih cover" button + State C no pencil + State B unreachable + AppShell ViewAsBanner intact
result: [pending]

### 9. Tier 1 #4 — Console clean
expected: DevTools Console zero warnings/errors during steps 2-8, no React key warnings, no double-toast
result: [pending]

### 10. Tier 4 — Initial gate-not-answered state
expected: Tier 4 trapezoid gray + only gate question "Punya tanggungan finansial?" visible + life and estate sections hidden
result: [pending]

### 11. Tier 4 — Gate=Ya path reveals sections
expected: Select Ya → 3 life coverage questions appear + 3 estate questions appear → trapezoid red (NULL = red rule)
result: [pending]

### 12. Tier 4 — Fill all green
expected: Answer all 6 questions positively (life: Ya/Cukup/Ya, estate: Ya/Ya/Ya) → trapezoid flips green
result: [pending]

### 13. Tier 4 — Decision D: Ya→Tidak preserves life_*
expected: With life cols filled, toggle gate Ya→Tidak. Run SQL `SELECT life_coverage, life_coverage_sufficient, life_coverage_post_employment FROM protection_checklist WHERE user_id = auth.uid();` — life_* columns RETAIN prior values (NOT nulled)
result: [pending]

### 14. Tier 4 — Tidak→Ya restores visual
expected: Toggle gate Tidak→Ya → life section reappears with values intact, no extra mutation fires (Network tab shows zero new requests)
result: [pending]

### 15. Tier 4 — Decision E: "Belum diisi" → DB NULL
expected: Pick estate radio "Belum diisi" → Run SQL `SELECT estate_will_exists FROM protection_checklist WHERE user_id = auth.uid();` returns NULL (not false)
result: [pending]

### 16. Tier 4 — Single red breaks green
expected: With all green, change one estate to "Tidak" → trapezoid flips red
result: [pending]

### 17. Tier 4 — View-As guard (DIAG-12)
expected: Enter View-As → all radios visibly disabled + amber notice "Mode View-As — kamu hanya bisa lihat, tidak bisa simpan." at top + clicks fire no toast/mutation
result: [pending]

### 18. Tier 4 — Network failure rollback
expected: DevTools Offline → click radio → optimistic flip → revert + sonner error toast
result: [pending]

### 19. Tier 4 — Network + console hygiene
expected: Each radio click triggers exactly one PostgREST UPSERT (no duplicate). Console zero warnings/errors during steps 10-18. No double-toast.
result: [pending]

## Summary

total: 19
passed: 0
issues: 0
pending: 19
skipped: 0
blocked: 0

## Gaps

<!-- Append entries when issues reported -->
