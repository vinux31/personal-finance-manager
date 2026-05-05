# Phase 8: Dev Hygiene - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure code/config cleanup — tidak ada migrasi DB, tidak ada fitur baru, tidak ada user-facing behavior change.

1. **DEV-02** — Fix type cast `(e as { category?: string }).category` di dua Pie chart label handler `src/tabs/ReportsTab.tsx`. Ganti ke `PieLabelRenderProps` properly-typed handler.
2. **DEV-03** — Buat file `supabase/seed.sql` (kosong dengan dev comment) supaya `supabase db reset` lokal tidak warn/fail. `config.toml:65` referensi file ini tetap dipertahankan.
3. **DEV-04** — Tambah performance note `recentTx` ke section Context di `.planning/PROJECT.md` sebagai dokumentasi future-trigger.

**Depends on:** Nothing (Phase 8 parallel-safe; ship last per roadmap order).

</domain>

<decisions>
## Implementation Decisions

### DEV-02: Recharts Pie Label Type Fix

- **D-01:** Import `PieLabelRenderProps` dari `'recharts'` (sudah di-export di `recharts/types/index.d.ts`).
- **D-02:** Ganti kedua label handler di `src/tabs/ReportsTab.tsx`:
  ```tsx
  // Before:
  label={(e) => String((e as { category?: string }).category ?? '')}
  
  // After:
  label={(e: PieLabelRenderProps) => String(e.name ?? '')}
  ```
  `e.name` berisi value dari `nameKey="category"` yang sudah terpasang di kedua Pie — no extra mapping needed.
- **D-03:** Visual output tidak berubah — `e.name` menghasilkan string yang sama dengan `e.category` sebelumnya (Recharts maps `nameKey` field → `.name` di label callback).
- **D-04:** Verifikasi: `tsc --noEmit` pass setelah perubahan + visual check pie chart label tetap tampil (nama kategori).

### DEV-03: seed.sql Config Fix

- **D-05:** **Buat file baru** `supabase/seed.sql` dengan isi:
  ```sql
  -- Dev seed (empty). Add sample data here for local development.
  ```
  Minimal comment, tidak perlu data seed karena tidak ada kebutuhan local dev seed saat ini.
- **D-06:** `supabase/config.toml:65` baris `sql_paths = ["./seed.sql"]` **tetap tidak diubah** — file yang dibuat sudah memenuhi referensi.
- **D-07:** Verifikasi: jalankan (atau dokumentasikan) bahwa `supabase db reset` tidak menghasilkan "seed.sql not found" warning setelah file ada.

### DEV-04: Performance Note PROJECT.md

- **D-08:** Tambah entry ke section `## Context` di `.planning/PROJECT.md`, di bagian yang relevan dengan DB/query patterns. Wording exact:
  > "Dashboard `recentTx` query pakai `useTransactions({ limit: 5 })` + index `transactions_date_idx` — sufficient untuk dataset < 50k rows; pertimbangkan migrasi ke materialized view jika dataset user aktif melewati threshold tersebut."
- **D-09:** Threshold 50k rows dipilih karena: dengan 5-20 tx/minggu, ini setara ≈5-10 tahun data aktif. Index range scan tetap sub-millisecond di bawah threshold tersebut.
- **D-10:** Ini documentation-only change — tidak ada kode yang perlu diubah.

### Claude's Discretion

- Exact placement entry di PROJECT.md Context section (sebelum/sesudah baris mana).
- Format comment di seed.sql (single-line vs multi-line).
- Urutan plan dalam phase (bisa 1 plan untuk semua 3 DEV items, atau split per item).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Relevant Source Files
- `src/tabs/ReportsTab.tsx` — File yang di-edit untuk DEV-02 (dua Pie chart label handlers)
- `supabase/seed.sql` — File yang dibuat untuk DEV-03 (tidak ada sebelumnya)
- `supabase/config.toml` — Config yang referensi seed.sql (tidak diubah, line 65)
- `.planning/PROJECT.md` — File yang di-edit untuk DEV-04 (tambah entry di Context section)

### Relevant Requirements
- `.planning/REQUIREMENTS.md` §DEV-02, §DEV-03, §DEV-04 — Acceptance criteria dan source audit findings

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PieLabelRenderProps` — type di-export dari `'recharts'` package (verified: `node_modules/recharts/types/index.d.ts`)
- `PieSectorData.name` — field `string | number | undefined`, di-populate dari `nameKey` prop

### Established Patterns
- Recharts imports: semua di-import dari `'recharts'` langsung (lihat pattern di `KekayaanTab.tsx`, `SimulasiPanel.tsx`)
- TypeScript strict mode aktif — no `as` cast kecuali terpaksa
- PROJECT.md Context section: inline facts dengan bullet point atau em-dash style

### Integration Points
- `src/tabs/ReportsTab.tsx`: kedua Pie components (Pengeluaran per Kategori + Pemasukan per Kategori) — keduanya sudah punya `nameKey="category"`, hanya `label` prop yang perlu diupdate
- `supabase/config.toml:65`: referensi ke `./seed.sql` (relative path dari `supabase/` directory, bukan project root)

</code_context>

<specifics>
## Specific Ideas

- DEV-02: `e.name` (bukan `e.category` atau `e.payload.category`) karena Recharts mapped `nameKey="category"` ke `.name` di label callback — ini yang bikin `PieLabelRenderProps` proper type bisa dipakai langsung.
- DEV-03: File seed.sql minimal, tidak perlu isi data — tujuan hanya suppres warning `supabase db reset`. Future developer bisa isi sendiri kalau butuh local seed.
- DEV-04: Wording "50k rows" lebih actionable dari "significant growth" karena memberi future maintainer angka konkret untuk decide kapan act.

</specifics>

<deferred>
## Deferred Ideas

Dari STATE.md deferred items yang relevan dengan Phase 8 tapi **tidak dimasukkan** karena di luar scope:

- `L-01`: Cleanup `src/assets/react.svg` + `vite.svg` boilerplate — v1.2 backlog
- `L-06`: Konfirmasi `dist/` ada di `.gitignore` — v1.2 backlog
- **23 lint errors pre-existing** di `src/` (badge/button/tabs fast-refresh, csvInvestments/investments `any`, PensiunTab refs-during-render) — Phase 8 hanya fix DEV-02 yang in-scope. Lint errors lain tidak disentuh agar scope tidak creep.
- **D-14 cosmetic**: raw NUMERIC formatting di `withdraw_from_goal` error message — deferred to v1.2, bukan Phase 8 scope.

</deferred>

---

*Phase: 08-dev-hygiene*
*Context gathered: 2026-04-29*
