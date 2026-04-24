# Phase 3: Bills Display - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 menambahkan widget "Tagihan Bulan Ini" ke Dashboard — read-only, sumber data dari `recurring_templates` (is_active=true, type=expense, next_due_date ≤ akhir bulan berjalan), dengan color-coding urgency per tagihan dan proyeksi "Sisa Aman Bulan Ini" di bagian bawah widget.

`useProcessRecurring` tidak dimodifikasi sama sekali di fase ini. Tidak ada tombol mark-as-paid — itu Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Widget Placement

- **D-01:** Bills widget ditempatkan sebagai **full-width panel (row ke-3)** di bawah 2-column panel grid yang sudah ada (Transaksi Terakhir + Goals Aktif). Tidak mengubah posisi atau keberadaan panel yang sudah ada.
- **D-02:** Layout akhir Dashboard:
  - Row 1: 5 MetricCards (grid-cols-2 sm:grid-cols-3 md:grid-cols-5) — tidak berubah
  - Row 2: 2-column grid (Transaksi Terakhir | Goals Aktif) — tidak berubah
  - Row 3: Tagihan Bulan Ini — full width, col-span penuh

### Per-Tagihan Row Design

- **D-03:** Tiap baris tagihan menampilkan:
  - Color dot/badge urgency (merah/kuning/abu) di kiri
  - Nama tagihan
  - Jumlah dalam Rupiah (kanan, tabular-nums)
  - Teks kecil di bawah nama: "jatuh tempo hari ini" / "N hari lagi" / "terlambat N hari"
- **D-04:** Urgency color rules sesuai BILL-02:
  - Merah: next_due_date < today (sudah lewat) atau next_due_date = today
  - Kuning: next_due_date ≤ today + 7 hari
  - Abu (muted): next_due_date > today + 7 hari
- **D-05:** Row style mengikuti pola "Transaksi Terakhir" — `divide-y`, `flex items-center gap-3 py-2.5`, teks muted untuk sub-info.

### Sisa Aman

- **D-06:** Sisa Aman ditampilkan sebagai **summary row di bagian bawah widget** (bukan MetricCard ke-6), dipisahkan oleh divider dari daftar tagihan.
- **D-07:** Formula Phase 3: `Sisa Aman = pemasukan_aktual_bulan_ini − pengeluaran_aktual_bulan_ini − total_tagihan_bulan_ini`
  - Di Phase 3, semua tagihan yang tampil dihitung sebagai "belum lunas" (tidak ada bill_payments tracking yet)
  - Phase 4 akan refine formula ini dengan join ke `bill_payments` untuk exclude tagihan yang sudah lunas
  - Label: "Sisa Aman Bulan Ini" (bukan "Estimasi") — konsisten dengan BILL-04 wording
- **D-08:** pemasukan_aktual dan pengeluaran_aktual diambil dari data yang sudah di-fetch di DashboardTab (`useAggregateByPeriod`) — tidak perlu query baru untuk ini.

### Query Strategy

- **D-09:** Tambah fungsi `listUpcomingBills(uid, endOfMonth)` di `src/db/recurringTransactions.ts` — filter `is_active=true`, `type='expense'`, `next_due_date <= endOfMonth`. Tambah `useUpcomingBills()` di `src/queries/recurringTransactions.ts`.
- **D-10:** Komponen widget: `src/components/UpcomingBillsPanel.tsx` — terpisah dari DashboardTab agar bisa ditest dan di-reuse di Phase 4. DashboardTab mengimport dan me-render komponen ini di row ke-3.

### Admin View-As

- **D-11:** `useUpcomingBills()` menggunakan `useTargetUserId()` — konsisten dengan seluruh codebase.

### Empty State

- **D-12:** Claude's discretion — jika tidak ada tagihan bulan ini, tampilkan empty state message sederhana di dalam panel (misal "Tidak ada tagihan bulan ini 🎉"). Panel tetap muncul (tidak hidden).

### Claude's Discretion

- Exact Tailwind classes untuk color dots/badges urgency
- Max height / scroll behavior jika tagihan sangat banyak
- Apakah Sisa Aman negatif ditampilkan merah (direkomendasikan: ya, konsisten dengan Net pattern)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dashboard Pattern (ikuti persis)
- `src/tabs/DashboardTab.tsx` — struktur layout (MetricCards + Panel grid), komponen Panel inline, pola fetch + useMemo. Tambahkan row ke-3 mengikuti pola Panel yang sudah ada.

### Recurring Templates
- `src/db/recurringTransactions.ts` — `listRecurringTemplates()`, tipe `RecurringTemplate` (field: id, name, type, amount, frequency, next_due_date, is_active)
- `src/queries/recurringTransactions.ts` — `useRecurringTemplates()` — pola query untuk tambah `useUpcomingBills()`

### Pemasukan/Pengeluaran Aktual (untuk formula Sisa Aman)
- `src/queries/reports.ts` — `useAggregateByPeriod()` — sudah dipakai di DashboardTab, tidak perlu query baru

### Row Style Reference
- `src/tabs/DashboardTab.tsx` baris ~141–162 — pola baris "Transaksi Terakhir" (divide-y, flex, py-2.5, tabular-nums)

### RLS Pattern
- `supabase/migrations/0010_recurring_transactions.sql` — canonical RLS (untuk referensi jika ada query baru)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/tabs/DashboardTab.tsx` — komponen `Panel` (inline, baris ~196) sudah wraps title + content + shadow — pakai pola yang sama untuk UpcomingBillsPanel
- `useAggregateByPeriod('month', monthStart, today)` — sudah di-fetch di DashboardTab, data pemasukan/pengeluaran tersedia tanpa query tambahan
- `src/queries/recurringTransactions.ts` — `useRecurringTemplates()` sudah ada; tambah `useUpcomingBills()` sebagai query terpisah dengan filter yang lebih spesifik

### Established Patterns
- Data fetch: `useQuery` di `src/queries/*.ts` dengan `useTargetUserId()`
- Panel wrapper: `function Panel({ title, children })` inline di DashboardTab — extract atau duplikasi untuk UpcomingBillsPanel
- Urgency coloring: tidak ada preseden — buat fresh, ikuti Tailwind color tokens (red-500, yellow-500, muted-foreground)

### Integration Points
- `src/tabs/DashboardTab.tsx` — tambah `<UpcomingBillsPanel />` setelah `div.grid-cols-1.md:grid-cols-2` (baris ~135–193)
- `src/queries/recurringTransactions.ts` — tambah `useUpcomingBills()` dengan filter endOfMonth
- `src/db/recurringTransactions.ts` — tambah `listUpcomingBills(uid, endOfMonth)` dengan Supabase `.lte('next_due_date', endOfMonth)`

</code_context>

<specifics>
## Specific Ideas

- Urgency dot: color-coded circle kecil (h-2 w-2 rounded-full, inline dengan nama tagihan) — bukan badge box, lebih ringan visual
- Sub-teks durasi: "jatuh tempo hari ini", "3 hari lagi", "terlambat 2 hari" — computed dari diff antara next_due_date dan today
- Sisa Aman row: gunakan `border-t mt-2 pt-2` untuk divider, label kiri "Sisa Aman Bulan Ini", angka kanan tabular-nums (merah jika negatif)
- endOfMonth helper: `new Date(year, month + 1, 0)` → format YYYY-MM-DD

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-bills-display*
*Context gathered: 2026-04-24*
