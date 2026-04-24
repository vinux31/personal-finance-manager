# Phase 2: Net Worth Tracker - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the Net Worth Tracker feature: user dapat mengelola daftar akun/aset dan liabilitas secara CRUD, melihat total Net Worth (aset + investasi − liabilitas) sebagai metric card ke-5 di Dashboard, dan melihat trend bulanan via area chart di sub-tab Kekayaan. Investasi dari tab Investasi masuk otomatis sebagai baris read-only — tidak ada input manual untuk aset investasi. Snapshot bulan ini tercatat otomatis saat tab Kekayaan dibuka (sekali per bulan kalender).

Tidak ada fitur bills/tagihan di fase ini — itu Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Layout Sub-tab Kekayaan

- **D-01:** Struktur: 2 section terpisah — (1) summary card Net Worth di paling atas menampilkan total Net Worth, subtotal Aset, subtotal Liabilitas; (2) section "Aset & Rekening" dengan tombol [+ Tambah Akun] dan list akun; (3) section "Liabilitas" dengan tombol [+ Tambah Liabilitas] dan list liabilitas.
- **D-02:** Investasi dari tab Investasi tampil sebagai baris read-only di section "Aset & Rekening" (tidak bisa diedit/dihapus — label jelas seperti "Nilai Investasi (otomatis)").
- **D-03:** Mobile layout: tiap akun/liabilitas ditampilkan sebagai card stack vertikal — konsisten dengan pola GoalsTab dan TransactionsTab.

### CRUD Form

- **D-04:** Tambah/edit akun dan liabilitas menggunakan dialog popup — mengikuti pola GoalDialog dan InvestmentDialog yang sudah ada di codebase.
- **D-05:** Dua dialog terpisah:
  - `NetWorthAccountDialog` — untuk akun/aset dengan tipe: tabungan, giro, cash, deposito, dompet digital, properti, kendaraan
  - `NetWorthLiabilityDialog` — untuk liabilitas dengan tipe: KPR, cicilan kendaraan, kartu kredit, paylater, KTA
  - Field berbeda antar keduanya, cleaner daripada satu dialog dengan toggle.

### Dashboard Net Worth Card

- **D-06:** Metric card ke-5 di Dashboard menampilkan: label "Net Worth", nilai total (aset + investasi − liabilitas), dan badge trend % naik/turun vs bulan lalu. Jika belum ada snapshot bulan lalu, trend tidak ditampilkan (null → badge disembunyikan). Menggunakan prop `trend` yang sudah ada di komponen MetricCard.
- **D-07:** Warna card: gradient indigo `linear-gradient(135deg, #6366f1, #818cf8)` — sama persis dengan card "Net Bulan Ini". Net Worth adalah metrik kekayaan paling penting, layak mendapat visual yang sama menonjolnya.

### Trend Chart

- **D-08:** Tipe chart: Recharts AreaChart dengan gradient fill di bawah garis (bukan bar chart, bukan line chart). Memberikan kesan pertumbuhan kekayaan yang visual.
- **D-09:** Rentang default: 6 bulan terakhir dari snapshot yang tersedia. Jika data kurang dari 6 bulan, tampilkan semua yang ada tanpa placeholder kosong.

### Auto-Snapshot Logic

- **D-10:** Snapshot dipicu saat tab Kekayaan dibuka. Cek apakah sudah ada snapshot bulan kalender berjalan (tahun+bulan) — jika belum, insert snapshot baru ke `net_worth_snapshots`. Ini sesuai NW-07.

### Admin View-As

- **D-11:** Semua query dan mutation menggunakan `useTargetUserId()` — konsisten dengan seluruh codebase untuk mendukung fitur admin view-as.

### Claude's Discretion

- Exact file/component naming selain yang disebutkan di D-05 (ikuti pola codebase)
- Query key naming untuk TanStack Query (ikuti pola `['net-worth-accounts', uid]`)
- Exact column layout di desktop untuk card list (1 atau 2 kolom)
- Loading skeleton vs spinner (ikuti pola yang dominan di GoalsTab)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing CRUD Pattern (ikuti persis)
- `src/tabs/GoalsTab.tsx` — pola CRUD tab: useQuery, filter bar, grid card, dialog, confirm delete
- `src/components/GoalDialog.tsx` — pola dialog form: controlled inputs, useMutation, toast, validation
- `src/queries/goals.ts` — pola query layer: useQuery + useTargetUserId + useMutation + invalidation

### Dashboard MetricCard
- `src/tabs/DashboardTab.tsx` — MetricCard component (line ~175), prop `trend` (number | null), gradient card pattern

### DB Schema (sudah ada, siap pakai)
- `supabase/migrations/0012_net_worth.sql` — schema net_worth_accounts, net_worth_liabilities, net_worth_snapshots dengan RLS
- `supabase/migrations/0013_bill_payments.sql` — schema bill_payments (untuk referensi RLS pattern, bukan untuk Phase 2)

### Chart Pattern
- `src/tabs/ReportsTab.tsx` — Recharts usage pattern (AreaChart/BarChart, ResponsiveContainer, formatting)

### Navigation
- `src/tabs/FinansialTab.tsx` — sub-tab Kekayaan placeholder yang akan digantikan oleh KekayaanTab di fase ini

### Investment Total (read-only row)
- `src/queries/investments.ts` — `useInvestments()` + `currentValue()` — dipakai untuk fetch total investasi sebagai baris read-only

### RLS Pattern
- `supabase/migrations/0010_recurring_transactions.sql` — canonical RLS pattern (USING auth.uid()=user_id OR is_admin(), WITH CHECK auth.uid()=user_id)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/card.tsx` — Card component untuk summary card Net Worth di atas
- `src/components/ui/tabs.tsx` — shadcn Tabs sudah dipakai di FinansialTab dan PensiunTab
- `src/components/ui/dialog.tsx` — Dialog component untuk NetWorthAccountDialog + NetWorthLiabilityDialog
- `src/components/ui/empty-state.tsx` — EmptyState component untuk state kosong (belum ada akun/liabilitas)
- `src/components/ui/confirm-dialog.tsx` — ConfirmDialog untuk delete confirmation
- `src/components/ui/select.tsx` — Select untuk tipe akun/liabilitas di dialog form
- `src/queries/investments.ts` — `useInvestments()` dan `currentValue()` untuk row investasi read-only

### Established Patterns
- Data fetching: `useQuery` di `src/queries/*.ts` dengan `useTargetUserId()` — semua query ikut pola ini
- DB operations: `src/db/*.ts` files dengan Supabase client — pisah dari query layer
- CRUD dialogs: controlled state di parent tab, dialog menerima `open`, `onOpenChange`, `editing` props
- Delete: selalu ada ConfirmDialog sebelum delete, bukan langsung eksekusi
- Toast: `toast.success` / `toast.error` via sonner setelah mutation

### Integration Points
- `src/tabs/FinansialTab.tsx` — sub-tab `value="kekayaan"` akan me-render `<KekayaanTab />` (gantikan placeholder)
- `src/tabs/DashboardTab.tsx` — tambah MetricCard ke-5 (Net Worth) di grid cards (line ~78, grid `grid-cols-2 sm:grid-cols-4` perlu dijadikan `sm:grid-cols-5` atau diatur ulang)
- `src/queries/` — tambah `netWorth.ts` untuk semua queries Net Worth
- `src/db/` — tambah `netWorth.ts` untuk Supabase operations

</code_context>

<specifics>
## Specific Ideas

- Summary card Net Worth: tampilkan 3 angka — "Net Worth: Rp X", "Aset: Rp Y", "Liabilitas: Rp Z" — dalam satu gradient card di atas, seperti summary bar di GoalsTab
- Baris investasi read-only di section Aset: beri label italic atau badge "otomatis" agar jelas tidak bisa diedit
- Dashboard MetricCard ke-5: gradient sama dengan "Net Bulan Ini" — text putih, no border-top accent
- Area chart: x-axis = nama bulan (Jan, Feb, dst), y-axis = nilai net worth, tooltip menampilkan angka lengkap dalam Rupiah

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-net-worth-tracker*
*Context gathered: 2026-04-24*
