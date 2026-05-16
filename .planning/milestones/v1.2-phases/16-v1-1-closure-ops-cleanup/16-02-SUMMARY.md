# Plan 16-02 Summary — Live UAT B1-B5

**Status:** COMPLETE
**Date:** 2026-05-15

## UAT Results

| ID | Skenario | Status | Catatan |
|----|----------|--------|---------|
| B1 | Idempotency recurring income (process_due_recurring) | ✅ PASS | 3x mount /transaksi → 83 transaksi, Pemasukan Rp 23.009.000, no duplicate |
| B2 | Idempotency mark-bill-paid (bill_payments) | ✅ PASS | 5x mount /transaksi → bill_payments count=1 untuk template_id=8 |
| B3 | Pessimistic lock concurrent withdraw (withdraw_from_goal) | ✅ PASS | Tab 1 berhasil (100k→0k), Tab 2 gagal "Saldo kas tidak cukup. Tersedia Rp 0" |
| B4 | Completed→active flip saat withdraw | ✅ PASS | withdraw Rp 1 → badge "Tercapai" → "Aktif", current_amount 10.000→9.999 |
| B5 | Date WIB (todayISO) di price_history | ✅ PASS | todayISO() = "2026-05-15" = WIB date, match di DB |

## Bug Ditemukan & Diperbaiki

**B4 Production Bug:** `withdraw_from_goal` di production cloud masih versi 0020 (tanpa alias `g.`).
- Error: `column reference "current_amount" is ambiguous`
- Root cause: Migration 0024 Section 4 + 0028 tidak diapply ke cloud via Studio paste
- Fix: Applied migration 0028 SQL ke Supabase Studio → SUCCESS
- Lesson: Studio paste workflow gap — 0028 ada di local git tapi belum diapply ke cloud

## Catatan Teknis

- **B3 stale UI**: Dialog tab 2 menampilkan "Saldo: Rp 100.000" (stale dari saat dialog dibuka), tapi RPC `withdraw_from_goal` membaca current DB value via `FOR UPDATE` lock → reject dengan P0001 → UI error toast benar
- **B2 column name**: `bill_payments.recurring_template_id` (bukan `template_id`) — dokumentasi SQL di plan perlu update kalau dipakai ulang
- **B1 data**: Recurring income template_id=7 sudah processed sejak sebelum UAT, tidak double-process
