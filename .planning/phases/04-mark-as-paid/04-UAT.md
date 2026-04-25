---
status: testing
phase: 04-mark-as-paid
source:
  - .planning/phases/04-mark-as-paid/04-01-SUMMARY.md
  - .planning/phases/04-mark-as-paid/04-02-SUMMARY.md
  - .planning/phases/04-mark-as-paid/04-03-SUMMARY.md
  - .planning/phases/04-mark-as-paid/04-04-SUMMARY.md
  - .planning/phases/04-mark-as-paid/04-05-SUMMARY.md
  - .planning/phases/04-mark-as-paid/04-06-SUMMARY.md
  - .planning/v1.0-MILESTONE-AUDIT.md (deferred tech-debt items)
started: "2026-04-25T00:00:00Z"
updated: "2026-04-25T05:30:00Z"
target: production (https://kantongpintar.vercel.app/)
note_dev_server: Test 1 awal di localhost:5173 PASS, lalu pivoted ke production setelah user request — production verify lebih representatif untuk milestone close.
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete — 4 pass, 1 issue, 2 blocked]

## Tests

### 1. Cold Start Smoke Test
expected: |
  1. Hentikan dev server jika sedang berjalan.
  2. Hapus state ephemeral: clear browser cache + sign out.
  3. Jalankan `pnpm dev` dari nol.
  4. Pastikan server boot tanpa error di terminal.
  5. Login ke aplikasi.
  6. Dashboard load dengan 5 metric card + UpcomingBillsPanel terisi (atau empty state).
  7. Buka DevTools Console — tidak ada error 500 / RLS / migration.
result: pass
verified_via: Playwright (browser_navigate + browser_snapshot + browser_console_messages, 2026-04-25). Server di localhost:5173 boot tanpa error, Dashboard render 5 metric card (Pemasukan 2.9jt / Pengeluaran 1.3jt / Net Bulan Ini 1.6jt / Nilai Investasi 120.1jt / Net Worth 120.1jt), UpcomingBillsPanel render dengan empty state ("Tidak ada tagihan bulan ini"), 0 error/warning di console.

### 2. Mark a Bill as Paid — Happy Path
expected: AlertDialog muncul, klik Konfirmasi → bill hilang, toast sukses, expense entry baru di Transaksi Terakhir.
result: pass
verified_via: Playwright di production (https://kantongpintar.vercel.app/) setelah seed "Tagihan UAT Test" Rp 100k. Klik Lunas → AlertDialog "Tandai sebagai lunas?" → klik "Ya, Lunas" → bill hilang dari panel, toast "✓ Tagihan dilunasi", entry baru "Makanan / 25 Apr 2026 · Tagihan UAT Test · −Rp 100.000" di Transaksi Terakhir, Pengeluaran 1.3jt → 1.4jt.
minor_cosmetic: AlertDialog body hanya menampilkan **nama** bill ("Tandai Tagihan UAT Test sebagai lunas?"), tidak menampilkan **nominal** dan **tanggal** seperti yang disebut di test expected. Cosmetic gap, bukan blocker. Severity: cosmetic.

### 3. Same-Day Dedup Guard (Tech Debt #4)
expected: Klik Lunas dua kali pada same-day bill → second click reject dengan toast error, no duplicate transaction.
result: blocked
blocked_by: design
reason: |
  UI flow tidak expose race ini secara natural. Setelah Lunas berhasil, mark_bill_paid RPC advance next_due_date dari template ke bulan berikut, dan view upcoming_bills_unpaid otomatis exclude bill yang punya bill_payment di bulan ini. Akibatnya bill langsung hilang dari panel — tidak ada cara click "Lunas" lagi pada bill yang sama dari UI tanpa SQL reset di DB.
  Dedup guard sudah diverify di level DB via supabase/tests/04-mark-bill-paid.sql Section 3 (idempotency check) — tapi script itu sendiri masih BLOCKED-BY-ENV (lihat Test 7).
  Coverage gap acceptable: design intent adalah "user tidak akan punya kesempatan double-click" (defensive guard), dan code path RPC raises 'Tagihan sudah ditandai lunas untuk tanggal ini' jika dipanggil ulang.

### 4. Network Failure During Mark-as-Paid (Tech Debt #3)
expected: Optimistic rollback + toast error muncul saat fetch fail.
result: issue
reported: "Toast error render literal '[object Object]' alih-alih pesan error yang manusiawi seperti 'Tidak ada koneksi internet. Periksa jaringan Anda.'"
severity: medium
verified_via: Playwright di production. Override window.fetch untuk reject pada path /rest/v1/rpc/mark_bill_paid dengan TypeError('Failed to fetch (simulated offline)'). Seed "Tagihan UAT Network Test" Rp 77k. Click Lunas → konfirmasi → hasil:
  - ✓ Bill TETAP di panel (rollback bekerja)
  - ✓ Pengeluaran tetap 1.4jt (DB tidak ter-mutate)
  - ✗ Toast text: "[object Object]" — error object tidak ter-serialize jadi string yang berarti
  - ⚠ AlertDialog tetap terbuka (intentional per Pitfall 5 di kode untuk allow retry, tapi kombinasi dengan toast bug bikin user confused)
artifacts:
  - uat-test4-network-failure-bug.png
root_cause: |
  src/lib/errors.ts:3 — `mapSupabaseError(error)` menggunakan `error instanceof Error ? error.message : String(error)`. Supabase RPC error adalah plain object (PostgrestError-like), bukan Error instance. Akibatnya `String(error)` jatuh ke "[object Object]". String "[object Object]" tidak match keyword "Failed to fetch" atau lainnya → mapSupabaseError return literal "[object Object]" → toast.error render "[object Object]".
fix_proposal: |
  Ubah ekstraksi message di src/lib/errors.ts:
    const msg = (error as { message?: unknown })?.message
      ? String((error as { message: unknown }).message)
      : (error instanceof Error ? error.message : String(error))
  Atau lebih bersih:
    const msg = (error as any)?.message ?? (error instanceof Error ? error.message : String(error))
missing:
  - Add unit test untuk mapSupabaseError(non-Error object with message) — deferred ke v1.1
fix_applied: |
  2026-04-25 commit a1f96eb — src/lib/errors.ts now extracts `.message` dari plain-object errors before fallback ke String(error).
  Re-tested via Playwright pada deploy fresh: toast text correctly renders "Tidak ada koneksi internet. Periksa jaringan Anda." instead of "[object Object]". Rollback masih bekerja (bill tetap di panel, DB tidak ter-mutate).
  Artifacts: uat-test4-fix-verified.png

### 5. useProcessRecurring No-Duplicate Post-Mark (Tech Debt #5)
expected: Setelah Lunas, refresh page → no duplicate expense dari auto-recurring processor.
result: pass
verified_via: Playwright di production. Setelah Test 2 sukses untuk "Tagihan UAT Test", navigate ke / 2x lebih (refresh) yang trigger useProcessRecurring. Buka Transaksi page list — hanya 1 entry "Tagihan UAT Test 25 Apr 2026 Rp 100.000". View upcoming_bills_unpaid filtering bekerja: template yang sudah punya bill_payment di bulan ini di-exclude.

### 6. Net Worth Card UX After Mark-as-Paid (Tech Debt #6)
expected: Net Worth card TIDAK berubah (by design — balance manual input).
result: pass
verified_via: Playwright di production. Sebelum Test 2: Net Worth = 120.1 jt. Setelah Test 2 + 2 refresh: Net Worth tetap 120.1 jt walaupun Pengeluaran naik dari 1.3jt → 1.4jt. Confirms by-design: net_worth_accounts.balance adalah manual input, bukan derived dari transactions.
ux_note: Dari sisi UAT, behavior cukup jelas via context (badge "otomatis" di Nilai Investasi, sedangkan saldo akun manual). User tidak komplain di sesi ini, tapi audit Tech Debt #6 menyebut "user bisa bingung kenapa Pengeluaran naik tapi Net Worth tetap" — perlu tooltip atau helper text di milestone berikutnya. Severity: cosmetic / DOC-ONLY.

### 7. Full psql Regression — supabase/tests/04-mark-bill-paid.sql (Tech Debt #2)
expected: Run psql terhadap supabase/tests/04-mark-bill-paid.sql, semua 6 section PASS dengan BEGIN/ROLLBACK.
result: blocked
blocked_by: server
reason: Docker Desktop belum terinstall di workstation; supabase CLI butuh Docker untuk start local stack (port 54322). Tech Debt #2 dari audit v1.0. Workaround historis: Phase 4-04 sudah apply migration 0014+0015 ke Supabase Cloud + smoke query manual; Phase 4-06 Playwright UAT cover happy path live cloud. Full regression test (semua 6 section termasuk leap-year, unknown frequency, idempotency) tetap belum dieksekusi end-to-end.

## Summary

total: 7
passed: 5  # Test 4 fix verified post-deploy
issues: 0  # Test 4 issue resolved via commit a1f96eb
pending: 0
skipped: 0
blocked: 2

## Gaps

- truth: "Toast error render pesan manusiawi (mis. 'Tidak ada koneksi internet') saat fetch fail"
  status: resolved  # was: failed
  reason: "Initial bug: Toast renders '[object Object]' alih-alih pesan readable. Fixed via commit a1f96eb (mapSupabaseError now extracts .message from plain-object errors)."
  severity: medium
  test: 4
  artifacts:
    - uat-test4-network-failure-bug.png  # bug evidence
    - uat-test4-fix-verified.png         # fix evidence
  fix_commit: a1f96eb
  missing:
    - Add unit test mapSupabaseError(plain-object-with-message) — deferred ke v1.1 (test infrastructure investment)
  root_cause: "src/lib/errors.ts:3 — `error instanceof Error ? error.message : String(error)` jatuh ke `String(plainObject)` = '[object Object]'. Supabase RPC errors bukan Error instance. Fix: extract `.message` dari objek apa pun yang expose-nya, baru fallback ke instanceof Error / String(error)."

- truth: "AlertDialog body show ringkasan lengkap (nama + nominal + tanggal)"
  status: partial
  reason: "Dialog body hanya menampilkan nama bill, tanpa nominal dan tanggal. Cosmetic minor — bukan blocker fungsional."
  severity: cosmetic
  test: 2
  missing:
    - Update AlertDialogDescription di src/components/UpcomingBillsPanel.tsx untuk include amount + tanggal next_due
  defer_to: milestone berikutnya (UX polish)

## Blockers

- Test 3 (dedup click-twice): blocked-by-design. Coverage move ke DB-level test 04-mark-bill-paid.sql Section 3 (yang sendiri di-blocked Test 7). Acceptable risk: low — UI hide bill setelah Lunas, dan RPC raises explicit error jika dipanggil ulang dengan same-day bill_payment existing.
- Test 7 (psql regression): blocked-by-environment. Docker Desktop absent di workstation. Mitigation existing: Phase 4-04 cloud smoke + Phase 4-06 Playwright UAT covers happy path. Full regression deferred ke production milestone (Tech Debt #2 dari audit v1.0).

## Test Data Cleanup

Seeded test rows yang masih ada di production DB:
- recurring_templates id=4 "Tagihan UAT Test" (sudah next_due_date advance ke May 2026 — innocuous, akan jadi recurring di May)
- recurring_templates id=? "Tagihan UAT Network Test" (next_due_date 2026-04-29 — masih akan muncul di panel)
- bill_payments untuk "Tagihan UAT Test" payment_date 2026-04-25 → real expense transaction Rp 100k (Makanan kategori)

User decision needed: cleanup atau biarkan? Recommended cleanup SQL ada di section "Cleanup Plan" di bawah.

## Cleanup Plan (manual via Supabase Studio)

```sql
-- Hapus bill_payment + transaksi expense yang ter-create dari UAT Test 2
DELETE FROM transactions
WHERE note = 'Tagihan UAT Test' AND date = '2026-04-25';

DELETE FROM bill_payments
WHERE template_id IN (
  SELECT id FROM recurring_templates WHERE name LIKE 'Tagihan UAT%'
);

-- Hapus 2 template UAT
DELETE FROM recurring_templates WHERE name LIKE 'Tagihan UAT%';
```

Jalankan di Supabase Studio kalau mau bersih sebelum close milestone.
