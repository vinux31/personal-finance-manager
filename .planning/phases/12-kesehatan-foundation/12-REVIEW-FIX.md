---
phase: 12-kesehatan-foundation
fixed_at: 2026-05-08T00:00:00Z
review_path: .planning/phases/12-kesehatan-foundation/12-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-05-08
**Source review:** `.planning/phases/12-kesehatan-foundation/12-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (Warning only — Info findings excluded per default scope)
- Fixed: 4
- Skipped: 0

---

## Fixed Issues

### WR-01: RLS Policy `is_admin()` Tanpa Wrapper `SELECT`

**Files modified:** `supabase/migrations/0029_protection_checklist.sql`
**Commit:** `5d37f27`
**Applied fix:** Wrapped `auth.uid()` dan `is_admin()` dalam `(SELECT ...)` di USING clause, konsisten dengan pola yang ditetapkan di `0017_tighten_rls.sql`.

**Note produksi:** Migration `0029` sudah di-apply ke production Supabase via Studio sebelum fix ini. Perubahan hanya diterapkan ke file repo (schema drift diterima). `is_admin()` berstatus `STABLE` sehingga Postgres sudah bisa cache tanpa wrapper — drift ini tidak memengaruhi behavior. Akan direkonsiliasi via `0030` jika caching planner Supabase menjadi isu.

---

### WR-02: `KalkulatorBanner` Navigate ke Route yang Belum Terdaftar

**Files modified:** `src/tabs/kesehatan/KalkulatorBanner.tsx`
**Commit:** `aef70ad`
**Applied fix:** Opsi B — mengganti `useNavigate` + `navigate('/kesehatan/kalkulator')` dengan `toast.info('Kalkulator compound interest akan tersedia di update berikutnya.')`. Import `useNavigate` dihapus; import `toast` dari `sonner` ditambahkan. Konsisten dengan pola di `PiramidaShell.tsx`.

---

### WR-03: Test 1.4 — Admin RLS Test Tanpa Komentar Asumsi JWT Claim

**Files modified:** `supabase/tests/12-protection-checklist.sql`
**Commit:** `19b5633`
**Applied fix:** Menambahkan 3-baris komentar penjelasan di atas `set_config('request.jwt.claim.sub', ...)` pada Test 1.4, menjelaskan: (1) database role masih `authenticated`, (2) `is_admin()` membaca dari `request.jwt.claim.sub` bukan `current_user`, (3) referensi ke pattern di `05-tighten-rls.sql:122`.

---

### WR-04: `KesehatanLanding` Tidak Handle Error State

**Files modified:** `src/tabs/kesehatan/KesehatanLanding.tsx`
**Commit:** `e737247`
**Applied fix:** Menambahkan `const isError = countQuery.isError` dan memasukkan `!isError` ke kondisi `isEmpty`. Di JSX, menambahkan `{isError && <p className="text-sm text-destructive ...">Gagal memuat data. Coba refresh halaman.</p>}` di dalam section piramida (ditampilkan di atas PiramidaShell saat error). `npx tsc --noEmit` dan `npm run build` tetap bersih setelah fix.

---

## Skipped Issues

Tidak ada — semua 4 finding berhasil di-fix.

---

## Build Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — no errors |
| `npm run build` | PASS — built in 2.01s (chunk size warning pre-existing, bukan dari fix ini) |

---

_Fixed: 2026-05-08_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
