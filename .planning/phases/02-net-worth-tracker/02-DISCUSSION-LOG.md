# Phase 2: Net Worth Tracker - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 02-net-worth-tracker
**Areas discussed:** Layout Kekayaan Tab, CRUD form style, Dashboard Net Worth card, Trend chart

---

## Layout Kekayaan Tab

| Option | Description | Selected |
|--------|-------------|----------|
| 2 section terpisah | Summary card Net Worth di atas, section Aset & Rekening, section Liabilitas masing-masing dengan subtotal | ✓ |
| Unified breakdown table | Satu tabel dengan baris aset/investasi/liabilitas dan total di bawah | |

**User's choice:** 2 section terpisah

---

| Option | Description | Selected |
|--------|-------------|----------|
| Card stack | Setiap akun/liabilitas jadi card terpisah di mobile | ✓ |
| List row kompak | Baris tipis dengan nama + jumlah di satu baris | |

**User's choice:** Card stack

---

## CRUD form style

| Option | Description | Selected |
|--------|-------------|----------|
| Dialog popup | Modal seperti GoalDialog dan InvestmentDialog | ✓ |
| Sheet/drawer dari sisi | Slide-in panel dari kanan/bawah | |

**User's choice:** Dialog popup

---

| Option | Description | Selected |
|--------|-------------|----------|
| Dialog terpisah | NetWorthAccountDialog + NetWorthLiabilityDialog | ✓ |
| Satu dialog universal | Satu dialog dengan toggle Aset/Liabilitas | |

**User's choice:** Dialog terpisah

---

## Dashboard Net Worth card

| Option | Description | Selected |
|--------|-------------|----------|
| Total + trend % | Net Worth + badge % vs bulan lalu | ✓ |
| Total saja | Hanya angka Net Worth | |

**User's choice:** Total + trend %

---

| Option | Description | Selected |
|--------|-------------|----------|
| Hijau (#10b981) | Sama dengan card Pemasukan | |
| Indigo/ungu (#6366f1) | Sama dengan card Nilai Investasi | |
| Gradient (seperti Net Bulan Ini) | Gradient indigo — paling menonjol | ✓ |

**User's choice:** Gradient (linear-gradient(135deg, #6366f1, #818cf8))

---

## Trend chart

| Option | Description | Selected |
|--------|-------------|----------|
| Area chart | AreaChart Recharts dengan gradient fill | ✓ |
| Bar chart | Bar per bulan | |
| Line chart | Garis tanpa fill | |

**User's choice:** Area chart

---

| Option | Description | Selected |
|--------|-------------|----------|
| 6 bulan terakhir | Default 6 snapshot bulan terakhir | ✓ |
| 12 bulan terakhir | Satu tahun penuh | |
| Semua history | Semua snapshot yang ada | |

**User's choice:** 6 bulan terakhir

---

## Claude's Discretion

- Exact file/component naming (selain NetWorthAccountDialog, NetWorthLiabilityDialog, KekayaanTab)
- Query key naming untuk TanStack Query
- Desktop column layout untuk card list (1 atau 2 kolom)
- Loading skeleton vs spinner

## Deferred Ideas

None — discussion stayed within phase scope.
