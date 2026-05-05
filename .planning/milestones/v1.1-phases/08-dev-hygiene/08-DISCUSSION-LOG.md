# Phase 8: Dev Hygiene - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 08-dev-hygiene
**Areas discussed:** DEV-02 (Recharts label fix), DEV-03 (seed.sql config), DEV-04 (performance note)

---

## DEV-02: Recharts Label Fix

| Option | Description | Selected |
|--------|-------------|----------|
| PieLabelRenderProps + e.name | Import type dari recharts, ganti cast ke proper type. `e.name` mapped dari `nameKey="category"`. | ✓ |
| label={true} — built-in default | Hapus custom label function, pakai built-in label rendering. Mungkin perbedaan visual. | |

**User's choice:** PieLabelRenderProps + e.name
**Notes:** Proper type import, survive major Recharts upgrade, visual output sama karena `nameKey="category"` sudah terpasang.

---

## DEV-03: seed.sql Config Fix

| Option | Description | Selected |
|--------|-------------|----------|
| Buat supabase/seed.sql kosong | Create file dengan dev comment. config.toml tidak diubah. | ✓ |
| Hapus baris config.toml | Delete `sql_paths = ["./seed.sql"]` dari config.toml:65. Cleaner jika tidak butuh seed. | |

**User's choice:** Buat supabase/seed.sql kosong
**Notes:** Preserves config intent (future developer bisa isi seed data lokal), minimal change.

---

## DEV-04: Performance Note PROJECT.md

| Option | Description | Selected |
|--------|-------------|----------|
| Wording ROADMAP SC#3 as-is | Pakai wording dari ROADMAP sukses criteria langsung. | |
| Claude's suggestion (50k threshold) | Wording dengan threshold konkret 50k rows. User delegated decision. | ✓ |
| Threshold 10k rows | Conservative, sesuai wording awal REQUIREMENTS.md. | |
| Hapus angka — 'significant growth' | Tanpa angka, lebih fleksibel tapi less actionable. | |

**User's choice:** Claude's discretion ("ur suggest")
**Notes:** Threshold 50k rows dipilih — setara ≈5-10 tahun data aktif (5-20 tx/week). Lebih actionable dari "significant growth".

---

## Claude's Discretion

- Threshold materialized view trigger: 50k rows per user
- Exact placement entry di PROJECT.md Context section
- Format comment di seed.sql

## Deferred Ideas

- 23 pre-existing lint errors — kandidat v1.2, diluar scope DEV-02
- L-01, L-06 boilerplate cleanup — v1.2 backlog
- D-14 NUMERIC formatting cosmetic — v1.2 backlog
