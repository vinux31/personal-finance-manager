# QA Findings — pfm-web (Kantong Pintar)

**Audit Date:** 2026-05-01  
**Metode:** Static Code Audit + Live Browser Testing (Playwright)  
**Auditor:** Claude Sonnet 4.6  
**Branch:** master

---

## Goals Tab

| # | Fitur | Bug/Issue | Root Cause | Severity | Status |
|---|-------|-----------|------------|----------|--------|
| 1 | Link Investasi ke Goal | Toast error: `FOR UPDATE is not allowed with aggregate functions` — link selalu gagal, tidak bisa connect investasi ke goal apapun | `supabase/migrations/0021_goal_investments_total_check.sql:44-48` — Trigger `enforce_goal_investment_total()` menggunakan `FOR UPDATE` bersamaan dengan aggregate `SUM(allocation_pct)` — PostgreSQL melarang kombinasi ini | Critical | Found |
| 2 | Tambah Uang ke Goal | Toast error: `column reference "current_amount" is ambiguous` — tidak bisa menambah uang ke goal apapun | `supabase/migrations/0024_add_money_to_goal_v2.sql:54` — Fungsi `add_money_to_goal` SELECT tanpa table alias (`SELECT id, current_amount, ...`) padahal `RETURNS TABLE (current_amount NUMERIC, ...)` juga mendefinisikan nama yang sama — PostgreSQL lihat ambigu. Fix sudah diapply ke `withdraw_from_goal` di Section 4 baris 147 tapi terlewat di `add_money_to_goal` Section 2 | Critical | Found |
| 3 | Tambah Uang — kalkulasi "Sisa" | Dialog menampilkan "Sisa yang perlu dikumpulkan" yang overstated jika ada investasi terhubung | `src/components/AddMoneyDialog.tsx:62` — `remaining = goal.target_amount - goal.current_amount` pakai `current_amount` (kas only), bukan `total_amount` (kas + investasi dari VIEW) | Medium | Found |
| 4 | GoalDialog — label "Sudah Terkumpul" | Field "Sudah Terkumpul (Rp)" hanya mengubah `current_amount` (kas), tapi progress bar di list pakai `total_amount` (kas + investasi) — user bisa bingung | `src/components/GoalDialog.tsx:110-111` — Tidak ada penjelasan bahwa field ini hanya untuk kas, bukan total termasuk investasi | Medium | Found |
| 5 | Semua dialog Goals | Console warning `Missing Description or aria-describedby` setiap GoalDialog, LinkInvestmentDialog, AddMoneyDialog dibuka | `src/components/GoalDialog.tsx`, `LinkInvestmentDialog.tsx`, `AddMoneyDialog.tsx` — tidak ada `<DialogDescription>` atau `aria-describedby`. Bandingkan: `TransactionDialog.tsx:98` sudah ada | Low | Found |

### Summary Goals
- Critical: 2 | Medium: 2 | Low: 1

---

## Finansial Tab

| # | Fitur | Bug/Issue | Root Cause | Severity | Status |
|---|-------|-----------|------------|----------|--------|
| 6 | State Goals/Kekayaan saat switch tab | Local state GoalsTab (filter search, status filter) ter-reset ke default setiap kali user pindah ke tab Kekayaan lalu kembali ke Goals | `src/tabs/FinansialTab.tsx:13-19` — Radix Tabs tanpa prop `forceMount` → tab yang tidak aktif di-unmount, semua `useState` di dalamnya hilang. Confirmed live: ketik "Dana" di search, switch ke Kekayaan, balik ke Goals → search kosong kembali | Medium | Found |

### Summary Finansial
- Critical: 0 | Medium: 1 | Low: 0

---

## Investasi Tab

| # | Fitur | Bug/Issue | Root Cause | Severity | Status |
|---|-------|-----------|------------|----------|--------|
| - | Semua fitur | Tidak ditemukan bug — data loading, kalkulasi G/L, filter, tabel bekerja benar | — | — | Pass |

### Summary Investasi
- Critical: 0 | Medium: 0 | Low: 0

---

## Transaksi Tab

| # | Fitur | Bug/Issue | Root Cause | Severity | Status |
|---|-------|-----------|------------|----------|--------|
| - | Semua fitur | Tidak ditemukan bug — filter tanggal, CRUD, Rutin button, validasi form bekerja benar | — | — | Pass |

### Summary Transaksi
- Critical: 0 | Medium: 0 | Low: 0

---

## Kekayaan Tab

| # | Fitur | Bug/Issue | Root Cause | Severity | Status |
|---|-------|-----------|------------|----------|--------|
| - | Semua fitur | Tidak ditemukan bug — Net Worth calculation, chart tren, empty state liabilitas tampil benar | — | — | Pass |

### Summary Kekayaan
- Critical: 0 | Medium: 0 | Low: 0

---

## Dashboard Tab

| # | Fitur | Bug/Issue | Root Cause | Severity | Status |
|---|-------|-----------|------------|----------|--------|
| 7 | Auth session refresh | Console error `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` setiap page load. App masih berjalan via cached access token, tapi setelah access token expired (~1 jam) user akan di-redirect login tanpa pesan error yang jelas di UI | `src/auth/AuthProvider.tsx` — Supabase client gagal refresh token (kemungkinan clock skew antara device dan server ~1 jam, lihat warning `Session issued in the future 1777619390 vs 1777615788`). Tidak ada explicit UI feedback ketika refresh gagal | Medium | Found |

### Summary Dashboard
- Critical: 0 | Medium: 1 | Low: 0

---

## Laporan Tab

| # | Fitur | Bug/Issue | Root Cause | Severity | Status |
|---|-------|-----------|------------|----------|--------|
| 8 | Tombol Export PDF | Label "Export PDF" dalam bahasa Inggris, inkonsisten dengan label lain yang menggunakan Bahasa Indonesia ("Ekspor", "Impor") | `src/tabs/ReportsTab.tsx` — tombol menggunakan text "Export PDF" sedangkan tab Transaksi dan Investasi menggunakan "Ekspor" | Low | Found |

### Summary Laporan
- Critical: 0 | Medium: 0 | Low: 1

---

## Pensiun Tab

| # | Fitur | Bug/Issue | Root Cause | Severity | Status |
|---|-------|-----------|------------|----------|--------|
| - | Semua fitur | Tidak ditemukan bug — profil pensiun, simulasi, kalkulasi lama investasi tampil benar | — | — | Pass |

### Summary Pensiun
- Critical: 0 | Medium: 0 | Low: 0

---

## Catatan Tab

| # | Fitur | Bug/Issue | Root Cause | Severity | Status |
|---|-------|-----------|------------|----------|--------|
| - | Semua fitur | Tidak ditemukan bug — empty state tampil benar, filter search tersedia | — | — | Pass |

### Summary Catatan
- Critical: 0 | Medium: 0 | Low: 0

---

## Pengaturan Tab

| # | Fitur | Bug/Issue | Root Cause | Severity | Status |
|---|-------|-----------|------------|----------|--------|
| - | Semua fitur | Tidak ditemukan bug — tema, logout confirmation, admin email management, View-As semua tampil benar | — | — | Pass |

### Summary Pengaturan
- Critical: 0 | Medium: 0 | Low: 0

---

## Master Summary

**Audit selesai:** 2026-05-01  
**Total halaman diaudit:** 10  
**Total temuan:** 8

| Severity | Jumlah |
|----------|--------|
| Critical | 2 |
| Medium | 4 |
| Low | 2 |

### Top Priority Fixes

1. **[Critical #1] Goals — Link Investasi** — `FOR UPDATE` + `SUM()` di trigger `enforce_goal_investment_total()` → fix: pakai subquery `SELECT ... FOR UPDATE` terpisah, lalu aggregate di luar
2. **[Critical #2] Goals — Tambah Uang** — column `current_amount` ambigu di `add_money_to_goal` → fix: tambahkan table alias `g.` seperti yang sudah dilakukan di `withdraw_from_goal` Section 4
3. **[Medium #3] Finansial — Tab State Reset** — GoalsTab filter hilang setiap switch tab → fix: tambah `forceMount` pada `<TabsContent>` di `FinansialTab.tsx`, atau pindahkan state filter ke URL params
4. **[Medium #4] Dashboard — Auth Refresh Error** — token refresh gagal di startup → investigasi clock skew antara device dan Supabase server
5. **[Medium #5] Goals — AddMoneyDialog "Sisa"** — kalkulasi remaining pakai `current_amount` bukan `total_amount` → fix: gunakan `goal.total_amount` jika tersedia (GoalWithProgress)
6. **[Medium #6] Goals — GoalDialog Label** — field "Sudah Terkumpul" tidak menjelaskan kas-only → fix: update label menjadi "Dana Kas Terkumpul (Rp)" atau tambah helper text

### Next Step
Buat GSD Phase 09 — QA Bug Fix menggunakan `/gsd-add-phase` dengan task per bug di atas, urutan Critical → Medium → Low.
