---
phase: 2
slug: net-worth-tracker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — no test framework installed in project |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` (TypeScript type check only) |
| **Full suite command** | `npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green + manual browser verification
- **Max feedback latency:** 15 seconds (type check only)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | NW-02, NW-03 | T-02-01 | user_id always from useTargetUserId(), never from form input | manual | `npx tsc --noEmit` | ✅ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | NW-04, NW-05 | T-02-01 | same — RLS WITH CHECK enforced | manual | `npx tsc --noEmit` | ✅ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | NW-07 | T-02-02 | snapshot uses UNIQUE constraint + ignoreDuplicates — not idempotent via client guard alone | manual | `npx tsc --noEmit` | ✅ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | NW-02, NW-03, NW-04, NW-05, NW-06 | T-02-03 | investasi read-only row has no edit/delete buttons | manual | `npx tsc --noEmit` | ✅ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | NW-07 | T-02-02 | auto-snapshot guard: !accountsLoading && !liabilitiesLoading before fire | manual | `npx tsc --noEmit` | ✅ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | NW-01 | T-02-04 | MetricCard gradient branch renders trend badge — no silent drop | manual | `npx tsc --noEmit` | ✅ W0 | ⬜ pending |
| 2-03-02 | 03 | 2 | NW-01 | — | Dashboard grid updates to grid-cols-2 sm:grid-cols-3 md:grid-cols-5 | manual | `npx tsc --noEmit` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework setup needed — project uses manual browser testing. TypeScript type checking (`npx tsc --noEmit`) provides automated feedback for type correctness.

*All phases pass type check as baseline automated gate.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Add akun (tabungan, giro, cash, deposito, dompet_digital, properti, kendaraan) | NW-02 | No test framework | Open tab Kekayaan → klik [+ Tambah Akun] → isi nama + pilih tipe + saldo → simpan → cek muncul di list |
| Edit akun — nama, tipe, saldo ter-update | NW-03 | No test framework | Klik edit icon di card akun → ubah nilai → simpan → cek list updated |
| Hapus akun — ConfirmDialog muncul, lalu hilang dari list | NW-03 | No test framework | Klik delete icon → ConfirmDialog muncul → konfirmasi → cek card hilang |
| Add liabilitas (kpr, cicilan_kendaraan, kartu_kredit, paylater, kta) | NW-04 | No test framework | Klik [+ Tambah Liabilitas] → isi nama + tipe + outstanding → simpan |
| Edit & hapus liabilitas | NW-05 | No test framework | Same as akun |
| Investasi read-only row tampil di section Aset (jika ada data investasi) | NW-06 | No test framework | Cek baris "Nilai Investasi (otomatis)" tampil, tidak ada tombol edit/delete |
| MetricCard ke-5 "Net Worth" di Dashboard | NW-01 | No test framework | Buka Dashboard → cek card ke-5 ada label "Net Worth" dengan gradient indigo, nilai live |
| Trend badge MetricCard (% vs bulan lalu) | NW-01 | No test framework | Setelah ada 2 snapshot, buka Dashboard → cek badge trend muncul |
| Auto-snapshot: snapshot terbuat pertama kali tab dibuka | NW-07 | No test framework | Buka tab Kekayaan (dengan akun/liabilitas ada) → query Supabase → cek row `net_worth_snapshots` untuk bulan ini |
| Auto-snapshot: tidak duplikat jika tab dibuka berkali-kali | NW-07 | No test framework | Buka tab Kekayaan 3x dalam satu bulan → cek hanya 1 row snapshot bulan ini di DB |
| AreaChart trend Net Worth tampil dengan gradient fill | NW-07 | No test framework | Dengan ≥ 1 snapshot, buka tab Kekayaan → cek chart AreaChart tampil dengan gradient ungu |
| Summary card menampilkan total Net Worth, Aset, Liabilitas | NW-01 | No test framework | Cek 3 angka di summary card atas konsisten dengan data di list bawah |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
