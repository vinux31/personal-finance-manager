# Phase 9 Verification — QA Bug Fix

**Verifier:** Claude Sonnet 4.6 + user (manual UAT)
**Date:** 2026-05-01
**Scope:** Semua 8 bug dari QA-FINDINGS.md (audit 2026-05-01)
**Bundle deployed:** `index-Dh7mdCsN.js` (hash changed dari BgTD-sLd setelah fix TS build error)

## Summary

| Bug | Severity | Verification Method | Status |
|-----|----------|---------------------|--------|
| #1 — Link Investasi (FOR UPDATE+aggregate) | Critical | Studio query + live UAT | PASS |
| #2 — Tambah Uang (ambiguous column) | Critical | Studio query + live UAT | PASS |
| #3 — GoalsTab filter state reset saat tab switch | Medium | Live UAT (Playwright) | PASS |
| #4 — Auth refresh-token failure tanpa feedback | Medium | Live UAT (Playwright) | PASS |
| #5 — AddMoneyDialog "Sisa" ignores invested amount | Medium | Live UAT (Playwright) | PASS |
| #6 — GoalDialog label salah + missing helper text | Medium | Live UAT (Playwright) | PASS |
| #7 — Missing DialogDescription (aria-describedby) | Low | Live UAT (Playwright) | PASS |
| #8 — "Export PDF" seharusnya "Ekspor PDF" | Low | Live UAT (Playwright) | PASS |

**Result: 8/8 PASS — Phase 9 complete.**

---

## Evidence per Bug

### Bug #1 — `enforce_goal_investment_total`: FOR UPDATE illegal with aggregate

**Fix:** `supabase/migrations/0025_fix_goal_bugs.sql` — moved `FOR UPDATE` lock ke subquery terpisah
```sql
SELECT id INTO v_goal_id
FROM (SELECT id FROM goal_investments WHERE goal_id = NEW.goal_id FOR UPDATE) locked
```

**Studio verification (2026-05-01):**
```
critical_1_subquery_pattern: PASS
critical_1_for_update_in_subquery: PASS
```

**Live UAT:** User konfirmasi notifikasi "alokasi berhasil disimpan" — tidak ada error `FOR UPDATE is not allowed with aggregate functions`.

---

### Bug #2 — `add_money_to_goal`: ambiguous column reference

**Fix:** `supabase/migrations/0025_fix_goal_bugs.sql` — alias `g.` pada semua referensi kolom tabel `goals`
```sql
FROM goals g WHERE g.id = p_id AND g.user_id = v_uid
-- all references to current_amount → g.current_amount
```

**Studio verification (2026-05-01):**
```
critical_2_alias_in_select: PASS
critical_2_alias_in_where: PASS
GRANT EXECUTE: authenticated
```

**Live UAT:** Tambah Uang berfungsi tanpa error `column reference "current_amount" is ambiguous`.

---

### Bug #3 — GoalsTab filter state reset saat pindah tab

**Fix:** `src/tabs/FinansialTab.tsx` — lifted `goalFilters` state ke parent, passed sebagai controlled props ke `GoalsTab`:
```tsx
const [goalFilters, setGoalFilters] = useState<GoalFilters>({})
// ...
<GoalsTab filters={goalFilters} onFiltersChange={setGoalFilters} />
```

`src/tabs/GoalsTab.tsx` — accepts controlled props dengan fallback ke local state:
```tsx
const filters = filtersProp ?? localFilters
const setFilters = onFiltersChange ?? setLocalFilters
```

**Live UAT (Playwright):**
1. Buka Goals sub-tab → ketik "Dana" di search filter
2. Pindah ke Kekayaan sub-tab
3. Kembali ke Goals sub-tab
4. Textbox masih menampilkan "Dana", list menampilkan 2 goals (Dana Darurat + Dana Pernikahan) ✓

---

### Bug #4 — Auth refresh-token failure tanpa feedback

**Fix:** `src/auth/AuthProvider.tsx` — added error handler di dua path:

Path 1 (`getSession` error):
```tsx
if (error) {
  toast.error('Sesi berakhir, silakan login kembali')
  supabase.auth.signOut()
  setSession(null)
  // ...
}
```

Path 2 (`TOKEN_REFRESHED` event + null session):
```tsx
if (event === 'TOKEN_REFRESHED' && !session) {
  toast.error('Sesi berakhir, silakan login kembali')
  supabase.auth.signOut()
  // ...
}
```

**Live UAT (Playwright):**
1. Set `localStorage['sb-rqotdjrlswpizgpnznfn-auth-token'].refresh_token = 'uat5-invalid-refresh-token'`
2. Set `expires_at` ke 1 jam yang lalu (agar access_token dianggap expired)
3. Reload halaman
4. Console: `AuthApiError: Refresh token is not valid` ✓
5. Page redirect ke login screen ("Masuk dengan Google") ✓ — signOut dipanggil

---

### Bug #5 — AddMoneyDialog "Sisa" tidak memperhitungkan invested amount

**Fix:** `src/components/AddMoneyDialog.tsx`:
```tsx
const remaining = Math.max(0, goal.target_amount - goal.current_amount - (investedValue ?? 0))
```

**Live UAT (Playwright):**

Dana Darurat (target 24 jt, kas 0, invested 0):
- Dialog menampilkan: `"Sisa yang perlu dikumpulkan: Rp 24.000.000"` ✓

Dana Pernikahan (target 100 jt, kas 0, invested 100 jt):
- Dialog menampilkan: `"Sisa yang perlu dikumpulkan: Rp 0"` ✓
- (100 jt target - 0 kas - 100 jt invested = 0)

---

### Bug #6 — GoalDialog label salah + missing helper text

**Fix:** `src/components/GoalDialog.tsx`:
- Label: `"Dana Kas Terkumpul (Rp)"` (sebelumnya "Dana Terkumpul")
- Helper text: `"Investasi terhubung dihitung otomatis dari portofolio"`

**Live UAT (Playwright):**
- Dialog "Tambah Goal" opened
- Label field: `"Dana Kas Terkumpul (Rp)"` ✓
- Paragraph helper: `"Investasi terhubung dihitung otomatis dari portofolio"` ✓

---

### Bug #7 — Missing DialogDescription (aria-describedby warning)

**Fix:** Added `<DialogDescription>` ke:
- `GoalDialog`: `"Buat atau edit goal keuangan Anda."`
- `LinkInvestmentDialog`: `"Hubungkan investasi ke goal ini dengan menentukan persentase alokasi."`

**Live UAT (Playwright):**

GoalDialog:
- `<paragraph>Buat atau edit goal keuangan Anda.</paragraph>` visible in accessibility tree ✓

LinkInvestmentDialog:
- `<paragraph>Hubungkan investasi ke goal ini dengan menentukan persentase alokasi.</paragraph>` visible ✓
- DOM check: `aria-describedby="radix-_r_2e_"` set (tidak null) ✓

---

### Bug #8 — "Export PDF" seharusnya "Ekspor PDF"

**Fix:** `src/tabs/ReportsTab.tsx` — button text changed.

**Live UAT (Playwright):**
- Laporan tab menampilkan `button "Ekspor PDF"` ✓ (sebelumnya "Export PDF")

---

## Regressions Check

Tidak ada regresi yang ditemukan selama UAT. Flow yang diverifikasi tetap berfungsi:
- Dashboard loading (Rp values)
- Goals listing + filter
- Kekayaan / Net Worth display
- Laporan tab chart
- Investasi linked ke goal

## Additional Fix Applied During Verification

**GoalsTab setFilters TypeScript build error:**
- Root cause: `setFilters((f) => ...)` (functional update form) tidak kompatibel dengan `onFiltersChange: (f: GoalFilters) => void`
- Fix (commit 7d648f2): gunakan closure `setFilters({ ...filters, ... })` — clean, no functional updater needed
- Build sebelum fix: `error TS2560` di GoalsTab.tsx:89,94 → Vercel deploy stuck di hash `BgTD-sLd`
- Build setelah fix: clean, hash `Dh7mdCsN`
