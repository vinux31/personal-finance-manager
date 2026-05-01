# Phase 9: QA Bug Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 09-phase-09-qa-bug-fix
**Areas discussed:** Auth Refresh Error, Tab State Reset, GoalDialog Label Fix

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Auth Refresh Error | Clock skew menyebabkan Invalid Refresh Token setiap page load | ✓ |
| Tab State Reset | Filter GoalsTab hilang saat switch tab Kekayaan↔Goals | ✓ |
| GoalDialog label fix | Label "Sudah Terkumpul" tidak menjelaskan kas-only | ✓ |
| Scope: tambah item deferred? | Tambah D-14 / View-As bug dari backlog v1.2 | |

---

## Auth Refresh Error

| Option | Description | Selected |
|--------|-------------|----------|
| Force re-login + toast | Catch error → toast "Sesi berakhir" → signOut() langsung | ✓ |
| Biarkan (silent fail) | App lanjut via cached token ~1 jam, tidak ada kode yang diubah | |
| Retry sekali, baru force re-login | Retry 1x dengan delay, kalau masih gagal baru signOut() | |

**User's choice:** Force re-login + toast
**Notes:** UX yang jelas — user tidak kaget logout tiba-tiba. Konsisten dengan app philosophy: transparansi state.

---

## Tab State Reset

| Option | Description | Selected |
|--------|-------------|----------|
| forceMount | Tambah prop `forceMount` ke `<TabsContent value="goals">` — 1 baris perubahan | ✓ |
| Lift state ke URL params | Filter search+status di URLSearchParams, persists saat refresh juga | |
| Lift state ke FinansialTab | Pindahkan useState ke FinansialTab parent, pass sebagai props | |

**User's choice:** forceMount
**Notes:** Solusi paling minimal, 1 baris. GoalsTab data sudah cached di React Query jadi DOM overhead tidak signifikan.

---

## GoalDialog Label Fix

| Option | Description | Selected |
|--------|-------------|----------|
| Ganti label + helper text | Label → "Dana Kas Terkumpul (Rp)" + helper text "Investasi terhubung dihitung otomatis..." | ✓ |
| Ganti label saja | Label → "Dana Kas Terkumpul (Rp)" tanpa helper text | |

**User's choice:** Ganti label + helper text
**Notes:** Lebih informatif untuk user yang pertama kali menggunakan fitur link investasi ke goals.

---

## Claude's Discretion

- Apakah Critical #1 + #2 digabung dalam 1 migration file (0025) atau 2 file terpisah
- Exact wording toast di Auth refresh error
- Exact placement helper text di GoalDialog dalam grid layout

## Deferred Ideas

- D-14 raw NUMERIC formatting di withdraw_from_goal error → tetap v1.2
- net_worth_snapshots View-As bug → tetap v1.2
- Edge Function CORS misconfiguration → tetap v1.2
- Scope Phase 9 tidak diperluas
