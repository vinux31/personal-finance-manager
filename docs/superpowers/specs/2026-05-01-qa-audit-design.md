# QA Audit Design — pfm-web
Date: 2026-05-01

## Tujuan

Temukan semua bug, error, dan broken feature di aplikasi pfm-web sebelum dibuat fase perbaikan. Tidak ada kode yang diubah selama audit — hanya temukan, catat, dokumentasikan.

## Metode Audit

Dua lapisan per halaman:

1. **Static code audit** — baca source code setiap halaman: cari bug logic, SQL/RPC yang salah, missing error handling, edge case yang tidak ditangani
2. **Live browser testing** — jalankan dev server, buka setiap halaman, klik semua fitur utama untuk konfirmasi bug dan temukan issue yang tidak terlihat dari kode saja

Batasan scope: tidak termasuk performance optimization, refactoring, atau fitur baru.

## Urutan Halaman

Berdasarkan risiko DB mutation tertinggi ke terendah:

| # | Tab | File | Alasan Prioritas |
|---|-----|------|-----------------|
| 1 | Goals | `src/tabs/GoalsTab.tsx` | Bug sudah ditemukan (FOR UPDATE + aggregate); banyak mutasi: add money, link investasi, withdraw |
| 2 | Finansial | `src/tabs/FinansialTab.tsx` | RPC kompleks, transaksi finansial inti |
| 3 | Investasi | `src/tabs/InvestmentsTab.tsx` | Price update, CSV import, link ke goals |
| 4 | Transaksi | `src/tabs/TransactionsTab.tsx` | CRUD transaksi, recurring, kategori |
| 5 | Kekayaan | `src/tabs/KekayaanTab.tsx` | Net worth accounts + liabilities |
| 6 | Dashboard | `src/tabs/DashboardTab.tsx` | Aggregate data dari banyak tabel |
| 7 | Laporan | `src/tabs/ReportsTab.tsx` | RPC laporan kompleks (0002_reports_rpc.sql) |
| 8 | Pensiun | `src/tabs/PensiunTab.tsx` | Simulasi + 3 sub-panel |
| 9 | Catatan | `src/tabs/NotesTab.tsx` | Notes CRUD |
| 10 | Pengaturan | `src/tabs/SettingsTab.tsx` | User settings, data management |

## Checklist Per Halaman

Untuk setiap halaman, audit mencakup:
- Semua dialog dan form (open, submit, cancel, validasi)
- Semua tombol aksi (create, update, delete, link)
- Semua query dan mutation (error handling, loading state)
- Edge case: data kosong, nilai 0, data duplikat, input ekstrem

## Format Output

File: `QA-FINDINGS.md` di root project.

Struktur:

```
## [Nama Tab]

| # | Fitur | Bug/Issue | Root Cause | Severity | Status |
|---|-------|-----------|------------|----------|--------|
| 1 | ...   | ...       | file:baris | Critical | Found  |

### Summary
- Critical: X | High: X | Medium: X | Low: X

---

## Master Summary
Total temuan: X
- Critical: X
- High: X
- Medium: X
- Low: X
```

### Klasifikasi Severity

| Level | Kriteria |
|-------|----------|
| Critical | Fitur utama tidak bisa digunakan sama sekali / data corruption |
| High | Fitur tidak berjalan benar tapi ada workaround |
| Medium | UI/UX bermasalah atau edge case tidak ditangani |
| Low | Cosmetic, minor typo, improvement kecil |

## Bug Pertama yang Sudah Dikonfirmasi

| Fitur | Bug | Root Cause | Severity |
|-------|-----|------------|----------|
| Goals → Link Investasi ke Goal | "FOR UPDATE is not allowed with aggregate functions" | `supabase/migrations/0021_goal_investments_total_check.sql` baris 44-48: trigger `enforce_goal_investment_total()` menggunakan `FOR UPDATE` bersamaan dengan `SUM()` aggregate — tidak valid di PostgreSQL | Critical |

## Deliverable

1. `QA-FINDINGS.md` — file temuan lengkap di root project, di-commit ke git
2. GSD fase baru `Phase 09 — QA Bug Fix` dengan task per bug (Critical/High diprioritaskan, Medium/Low dijadwalkan)

## Tidak Termasuk

- Fix kode apapun
- Refactoring
- Fitur baru
- Performance optimization
