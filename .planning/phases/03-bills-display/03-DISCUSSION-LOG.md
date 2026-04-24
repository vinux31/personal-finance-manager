# Phase 3: Bills Display - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 03-bills-display
**Areas discussed:** Widget placement, Per-tagihan row design, Sisa Aman formula & placement

---

## Widget Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Full-width row ke-3 | Panel baru full-width di bawah 2 panel yang ada | ✓ |
| 3rd item dalam 2-col grid | Bills muncul di kolom kiri bawah, Goals tetap di kanan | |
| Ganti Goals Aktif panel | Bills menggantikan Goals Aktif di dashboard | |

**User's choice:** Full-width row ke-3
**Notes:** Paling natural untuk content yang vary jumlahnya. Tidak mengubah panel yang sudah ada.

---

## Per-Tagihan Row Design

| Option | Description | Selected |
|--------|-------------|----------|
| Standar: nama + amount + urgency badge | Color dot + nama + amount + sub-teks durasi | ✓ |
| Kompak: nama + urgency color bar saja | Left color bar, nama + amount + tanggal dalam satu baris | |
| Detail: nama + amount + due date + kategori | Tambah nama kategori di bawah nama tagihan | |

**User's choice:** Standar
**Notes:** Konsisten dengan style Transaksi Terakhir panel.

---

## Sisa Aman Formula & Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Summary row di bawah bills list | Divider + "Sisa Aman Bulan Ini: Rp X" di dalam widget | ✓ |
| MetricCard ke-6 di header | Card baru di baris MetricCard | |

**Formula question:**

| Option | Description | Selected |
|--------|-------------|----------|
| Ya — semua tagihan = belum lunas | Sisa Aman = income − expense − total_tagihan_bulan_ini | ✓ |
| Tidak — label 'estimasi' | Sama secara angka, tapi label berbeda | |

**User's choice:** Summary row dalam widget + semua tagihan = belum lunas
**Notes:** Phase 4 akan refine dengan join ke bill_payments untuk exclude yang sudah lunas.

---

## Claude's Discretion

- Max height / scroll behavior jika tagihan banyak
- Exact Tailwind classes untuk color urgency
- Warna merah untuk Sisa Aman negatif

## Deferred Ideas

None.
