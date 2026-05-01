# Phase 9: QA Bug Fix - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix semua 8 bug yang ditemukan di QA-FINDINGS.md (audit 2026-05-01). Tidak ada fitur baru, tidak ada refactor di luar scope bug. Urutan eksekusi: Critical dulu, lalu Medium, lalu Low.

Bug list per severity:
- **Critical #1** — Goals: Link Investasi gagal (`FOR UPDATE` + aggregate di trigger `enforce_goal_investment_total`)
- **Critical #2** — Goals: Tambah Uang gagal (`current_amount` ambiguous column di `add_money_to_goal`)
- **Medium #3** — Finansial: GoalsTab filter state hilang saat switch tab
- **Medium #4** — Dashboard: Auth refresh token gagal di startup (clock skew)
- **Medium #5** — Goals: AddMoneyDialog "Sisa" overstated (pakai `current_amount` bukan total)
- **Medium #6** — Goals: GoalDialog label "Sudah Terkumpul" tidak menjelaskan kas-only
- **Low #7** — Goals dialogs: Missing `aria-describedby` / DialogDescription di GoalDialog + LinkInvestmentDialog
- **Low #8** — Laporan: Tombol "Export PDF" inkonsisten bahasa (harusnya "Ekspor PDF")

</domain>

<decisions>
## Implementation Decisions

### Critical #1 — enforce_goal_investment_total trigger (0021)

- **D-01:** Buat migration baru `0025_fix_goal_investments_trigger.sql` via Studio SQL Editor (mengikuti convention project: Studio adalah de-facto migration channel karena `db push` broken).
- **D-02:** Fix: pisahkan `FOR UPDATE` dari aggregate. Gunakan subquery: lock rows dulu dengan `SELECT ... FOR UPDATE`, lalu aggregate di luar:
  ```sql
  SELECT COALESCE(SUM(sub.allocation_pct), 0) INTO v_total
  FROM (
    SELECT allocation_pct
    FROM goal_investments
    WHERE investment_id = NEW.investment_id
      AND id IS DISTINCT FROM NEW.id
    FOR UPDATE
  ) sub;
  ```
  Ini valid di PostgreSQL — `FOR UPDATE` di subquery OK karena aggregate ada di outer query.
- **D-03:** Fungsi `enforce_goal_investment_total()` di-replace menggunakan `CREATE OR REPLACE FUNCTION` (idempotent, konsisten dengan pattern Phase 5/6).

### Critical #2 — add_money_to_goal ambiguous column (0024)

- **D-04:** Buat migration `0025` yang sama sekaligus (atau migration terpisah jika lebih clean) — fix `add_money_to_goal` RPC dengan menambah table alias `g` ke semua column reference base table.
- **D-05:** Fix exact (mirror pattern dari `withdraw_from_goal` Section 4, line 147):
  ```sql
  -- Before (0024:54):
  SELECT id, current_amount, target_amount, status
  INTO v_goal FROM goals WHERE id = p_id AND user_id = v_uid FOR UPDATE;

  -- After:
  SELECT g.id, g.current_amount, g.target_amount, g.status
  INTO v_goal FROM goals g WHERE g.id = p_id AND g.user_id = v_uid FOR UPDATE;
  ```
- **D-06:** Gunakan `CREATE OR REPLACE FUNCTION` (idempotent).

### Medium #3 — GoalsTab tab state reset (FinansialTab)

- **D-07:** Fix: tambah prop `forceMount` ke `<TabsContent value="goals">` di `src/tabs/FinansialTab.tsx`.
- **D-08:** 1 baris perubahan: `<TabsContent value="goals" forceMount>`. Tab goals tetap di-mount di DOM meski tidak aktif. GoalsTab state (search, status filter) preserved.
- **D-09:** TabsContent "kekayaan" TIDAK diberi `forceMount` — KekayaanTab boleh unmount (lebih hemat karena ada snapshot chart). Hanya Goals yang perlu preserve filter state.

### Medium #4 — Auth refresh token error (AuthProvider)

- **D-10:** Behavior yang diinginkan: tangkap refresh error → tampilkan toast "Sesi berakhir, silakan login kembali" → panggil `supabase.auth.signOut()` → user di-redirect ke halaman login.
- **D-11:** Implementasi di `src/auth/AuthProvider.tsx`: tambah error handler di `onAuthStateChange` event, atau wrap initial session check dengan try/catch yang menangani `AuthApiError` dengan pesan "Refresh Token Not Found".
- **D-12:** Jangan suppress error ke console — tetap log untuk debug. Yang ditambah adalah UX response (toast + signOut).

### Medium #5 — AddMoneyDialog "Sisa" overstated

- **D-13:** Fix kalkulasi `remaining` di `src/components/AddMoneyDialog.tsx:62`:
  ```tsx
  // Before:
  const remaining = Math.max(0, goal.target_amount - goal.current_amount)

  // After:
  const remaining = Math.max(0, goal.target_amount - goal.current_amount - (investedValue ?? 0))
  ```
  `investedValue` sudah dipass sebagai prop dari GoalsTab (line 220). Tidak perlu perubahan di GoalsTab.
- **D-14:** Label di `DialogDescription` sudah benar menampilkan remaining — hanya value yang fix.

### Medium #6 — GoalDialog label "Sudah Terkumpul"

- **D-15:** Label field di `src/components/GoalDialog.tsx:110` ganti dari `"Sudah Terkumpul (Rp)"` → `"Dana Kas Terkumpul (Rp)"`.
- **D-16:** Tambah helper text di bawah input (konsisten dengan pattern ReportsTab):
  ```tsx
  <p className="text-xs text-muted-foreground">Investasi terhubung dihitung otomatis dari portofolio</p>
  ```

### Low #7 — Missing aria-describedby di dialogs

- **D-17:** Tambah `<DialogDescription>` ke **GoalDialog** dan **LinkInvestmentDialog** (AddMoneyDialog sudah punya sejak Phase 7 rewrite).
- **D-18:** GoalDialog: description contextual singkat, e.g., `"Buat atau edit goal keuangan Anda"`.
- **D-19:** LinkInvestmentDialog: `"Hubungkan investasi ke goal ini dengan menentukan persentase alokasi"`.
- **D-20:** Import `DialogDescription` yang mungkin belum ada di masing-masing file.

### Low #8 — "Export PDF" inkonsisten bahasa

- **D-21:** Ganti text tombol di `src/tabs/ReportsTab.tsx:168` dari `"Export PDF"` → `"Ekspor PDF"` (konsisten dengan "Ekspor"/"Impor" di tab Transaksi dan Investasi).

### Claude's Discretion

- Apakah Critical #1 dan #2 digabung dalam 1 migration file (0025) atau 2 file terpisah.
- Exact wording toast di Auth refresh error.
- Exact placement helper text di GoalDialog (before/after input dalam grid gap-2).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug Source
- `QA-FINDINGS.md` — Tabel lengkap semua 8 bug dengan root cause, severity, dan file reference

### Database Migrations (Critical #1 dan #2)
- `supabase/migrations/0021_goal_investments_total_check.sql` — Trigger yang broken (line 44-48: `FOR UPDATE` + aggregate)
- `supabase/migrations/0024_add_money_to_goal_v2.sql` — RPC yang broken (line 54: ambiguous column) + `withdraw_from_goal` Section 4 (reference untuk pattern `g.` alias yang benar)
- `supabase/migrations/0020_withdraw_from_goal.sql` — Reference pattern FOR UPDATE yang benar di RPC

### Frontend Source Files
- `src/tabs/FinansialTab.tsx` — TabsContent tanpa forceMount (Bug #3)
- `src/auth/AuthProvider.tsx` — Auth refresh error handling (Bug #4)
- `src/components/AddMoneyDialog.tsx` — remaining calculation + investedValue prop (Bug #5)
- `src/components/GoalDialog.tsx` — label "Sudah Terkumpul" + missing DialogDescription (Bug #6, #7)
- `src/components/LinkInvestmentDialog.tsx` — missing DialogDescription (Bug #7)
- `src/tabs/ReportsTab.tsx` — "Export PDF" button text (Bug #8)

### Project Patterns
- `src/components/TransactionDialog.tsx:98` — Contoh DialogDescription yang benar (reference untuk Bug #7)
- `.planning/STATE.md` §"Studio fallback" — Studio SQL Editor adalah migration channel (confirm approach untuk Critical #1 dan #2)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `toast` dari `sonner` — dipakai untuk Auth error toast (D-12), consistent dengan pattern seluruh app
- `supabase.auth.signOut()` — sudah available di AuthProvider context
- `DialogDescription` dari `@/components/ui/dialog` — ada di AddMoneyDialog, tinggal tambahkan ke GoalDialog + LinkInvestmentDialog

### Established Patterns
- `CREATE OR REPLACE FUNCTION` — pattern idempotent untuk migration DB (Phase 5/6)
- `g.` table alias pada `SELECT ... FROM goals g` — pattern dari withdraw_from_goal (mirror ke add_money_to_goal)
- `text-xs text-muted-foreground` — className untuk helper text di form fields
- `investedValue` prop sudah dipass dari GoalsTab ke AddMoneyDialog — tidak perlu ubah GoalsTab

### Integration Points
- Studio SQL Editor paste — channel untuk 0025 migration (sama seperti 0022-0024)
- `onAuthStateChange` event di AuthProvider — point untuk intercept refresh errors
- `forceMount` prop di Radix `TabsContent` — 1 prop, tidak perlu setup apapun

</code_context>

<specifics>
## Specific Ideas

- Auth toast: wording bahasa Indonesia konsisten → "Sesi berakhir, silakan login kembali"
- GoalDialog helper text exact: "Investasi terhubung dihitung otomatis dari portofolio"
- Migration naming: `0025_fix_goal_bugs.sql` (bundle Critical #1 + #2 dalam 1 file untuk mengurangi Studio paste overhead)

</specifics>

<deferred>
## Deferred Ideas

- D-14 raw NUMERIC formatting di `withdraw_from_goal` error message (menampilkan `100000000.000...` bukan `Rp 100.000.000`) — tetap defer ke v1.2, di luar scope Phase 9
- `net_worth_snapshots` auto-insert fails 42501 saat View-As aktif — tetap defer ke v1.2
- Edge Function `fetch-prices` CORS misconfiguration (`kantongpintar.app` vs `kantongpintar.vercel.app`) — tetap defer ke v1.2
- Scope Phase 9 tidak diperluas ke backlog deferred items

</deferred>

---

*Phase: 09-phase-09-qa-bug-fix-fix-semua-bug-dari-qa-findings-md*
*Context gathered: 2026-05-01*
