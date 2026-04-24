---
phase: 4
slug: mark-as-paid
status: ready
created: 2026-04-24
---

<domain>
Phase 4 menambahkan interaksi "Lunas" ke tiap baris tagihan di `UpcomingBillsPanel` — satu operasi atomik via Supabase RPC: buat expense transaction, catat bill_payment, majukan next_due_date ke siklus berikutnya. `useProcessRecurring` tidak dimodifikasi. Sisa Aman di-refine agar hanya mengurangi tagihan yang belum lunas.
</domain>

<decisions>
## Implementation Decisions

### Tombol "Lunas"

- **D-01:** Button ditampilkan sebagai **teks "Lunas"** di kanan baris, setelah amount.
  - Layout baris: `[dot] [nama + sub-teks] [amount] [Lunas]`
  - Tombol kecil (variant outline atau ghost), tidak menggeser layout yang sudah ada
  - Ukuran button proporsional dengan baris — gunakan `h-auto py-0.5 px-2 text-xs` atau setara

### Konfirmasi & Feedback

- **D-02:** Klik "Lunas" memunculkan **dialog konfirmasi singkat** sebelum proses:
  - Dialog: "Tandai [nama tagihan] sebagai lunas?"
  - Tombol: [Batalkan] dan [Ya, Lunas]
  - Setelah konfirmasi: proses atomik → dialog tutup → baris hilang (remove dari list) → toast sukses
  - Toast message: "✓ Tagihan dilunasi" (atau "{nama} ditandai lunas")
  - Query invalidation setelah sukses: `upcoming-bills`, `transactions`, `aggregate`

### Sisa Aman Formula (update dari Phase 3)

- **D-03:** Sisa Aman **hanya mengurangi tagihan yang BELUM lunas** bulan ini.
  - Formula baru: `Sisa Aman = pemasukan_aktual − pengeluaran_aktual − sum(tagihan_belum_lunas)`
  - Implementasi: `listUpcomingBills` (atau hook baru) perlu exclude template yang sudah ada record di `bill_payments` untuk bulan berjalan
  - Pendekatan: join/filter di DB query — `NOT EXISTS (SELECT 1 FROM bill_payments WHERE template_id = t.id AND paid_date >= awal_bulan AND paid_date <= akhir_bulan)`
  - Ini mengubah `listUpcomingBills` atau membutuhkan query baru `listUnpaidBills`

### Dedup Guard Strategy

- **D-04:** Gunakan **RPC atomik** — satu Supabase DB function yang mengerjakan tiga operasi dalam satu transaction:
  1. `INSERT INTO transactions (date, type, category_id, amount, note, user_id)`
  2. `INSERT INTO bill_payments (template_id, user_id, paid_date, transaction_id)`
  3. `UPDATE recurring_templates SET next_due_date = nextDueDate(current, frequency) WHERE id = template_id`
  - `useProcessRecurring` **tidak diubah** — guard via `next_due_date` yang sudah maju (bukan <= today setelah paid)
  - RPC name suggestion: `mark_bill_paid(p_template_id, p_uid, p_paid_date)`
  - Migration baru diperlukan untuk mendaftarkan fungsi PL/pgSQL ini di Supabase

### Yang Tidak Berubah (inherited dari Phase 3)

- Layout baris tagihan: dot urgency + nama + sub-teks + amount — TETAP sama
- Panel title "Tagihan Bulan Ini" dan posisi full-width row 3 — TETAP
- `useProcessRecurring` — TIDAK dimodifikasi (D-04)
- Urgency coloring rules (merah/kuning/abu) — TETAP
- Empty state, loading state, error state di UpcomingBillsPanel — TETAP (kecuali ketika setelah paid baris hilang, bisa trigger empty state)
</decisions>

<canonical_refs>
## Canonical References

### Files yang Dimodifikasi/Dibuat

- `src/components/UpcomingBillsPanel.tsx` — tambah tombol Lunas per baris + dialog konfirmasi
- `src/db/recurringTransactions.ts` — tambah fungsi `markBillPaid(templateId, uid, paidDate)` yang memanggil RPC
- `src/queries/recurringTransactions.ts` — tambah `useMarkBillPaid()` mutation hook + update `listUpcomingBills` atau tambah `listUnpaidBills`
- `supabase/migrations/` — migration baru untuk DB function `mark_bill_paid` (PL/pgSQL)

### Files yang Dibaca (Bukan Diubah)

- `src/hooks/useProcessRecurring.ts` — referensi untuk memahami guard logic (tidak diubah)
- `src/components/UpcomingBillsPanel.tsx` — existing layout sebagai base untuk modifikasi
- `src/queries/recurringTransactions.ts` — existing `useUpcomingBills` pattern
- `.planning/phases/03-bills-display/03-CONTEXT.md` — D-07 Sisa Aman formula (Phase 4 refinement)
- `supabase/migrations/` — existing migration pattern untuk reference numbering

### DB Tables Relevant

- `recurring_templates` — template tagihan (next_due_date akan diupdate oleh RPC)
- `bill_payments` — record pembayaran (insert baru per mark-as-paid)
- `transactions` — transaksi expense (insert baru per mark-as-paid)
</canonical_refs>

<specifics>
## Specific Details

- Dialog component: gunakan `AlertDialog` dari shadcn/ui (sudah ada dari Phase 2 atau tersedia via shadcn) — "AlertDialog" sesuai karena ini destructive-ish action
- Tombol Lunas style: `variant="outline"` atau `size="sm"` — tidak terlalu mencolok, tidak bersaing dengan amount
- Setelah confirmed: optimistic remove baris dari list (atau invalidate `upcoming-bills` query → re-fetch)
- nextDueDate logic di RPC harus mirror `nextDueDate()` dari `src/db/recurringTransactions.ts` (weekly/monthly/yearly) — researcher perlu verifikasi apakah logic ini sudah ada sebagai DB function atau perlu diport ke PL/pgSQL
- `paid_date` di `bill_payments`: gunakan tanggal hari ini (ISO date), bukan next_due_date
- Migration number: cek migration terbaru di `supabase/migrations/` dan gunakan nomor berikutnya
</specifics>

<deferred>
## Deferred Ideas

- Undo "Lunas" — batalkan pembayaran jika klik salah (scope creep — Phase 5 atau future)
- History pembayaran per tagihan — lihat riwayat bulan-bulan lalu (future)
- Bulk mark-as-paid — tandai beberapa tagihan sekaligus (future)
- Notifikasi tagihan jatuh tempo hari ini (push notification) — future milestone
</deferred>
