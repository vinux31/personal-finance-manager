---
phase: 12-kesehatan-foundation
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - supabase/migrations/0029_protection_checklist.sql
  - supabase/tests/12-protection-checklist.sql
  - src/shell/navConfig.ts
  - src/routes.tsx
  - src/tabs/kesehatan/KesehatanLayout.tsx
  - src/tabs/kesehatan/KesehatanLanding.tsx
  - src/tabs/kesehatan/PiramidaShell.tsx
  - src/tabs/kesehatan/KalkulatorBanner.tsx
  - src/tabs/kesehatan/ModulCard.tsx
  - src/tabs/kesehatan/modulCatalog.ts
  - src/tabs/kesehatan/EmptyStateCTA.tsx
  - src/queries/kesehatan.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-05-08
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 12 foundation shell secara keseluruhan solid. Migrasi SQL, RLS policy, komponen React, dan query layer semuanya mengikuti pola yang sudah ada di codebase. Tidak ada critical security issue ditemukan.

Ada 4 warning dan 3 info item yang perlu diperhatikan:

- **WR-01** (paling signifikan): RLS policy `0029` menggunakan `is_admin()` tanpa wrapper `SELECT`, berbeda dari pola yang sudah di-harden di `0017_tighten_rls.sql`. Ini bukan vulnerability baru karena `is_admin()` sudah `STABLE`, tapi inkonsisten dengan best-practice yang ada.
- **WR-02**: Tombol di `KalkulatorBanner` navigate ke `/kesehatan/kalkulator` yang belum ada sebagai route — akan throw React Router no-match error pada Phase 12 (landing ke wildcard `*` redirect ke `/dashboard`, membingungkan user).
- **WR-03**: Test 1.4 di SQL test file: setelah `SET LOCAL ROLE authenticated` (baris 59), switch JWT ke admin UID (baris 89) tetapi role database masih `authenticated`. `is_admin()` bergantung pada `auth.uid()` yang dibaca dari `request.jwt.claim.sub` via Supabase config, sehingga test kemungkinan masih pass — namun ada potensi false-positive jika environment membaca UID dari role PostgreSQL bukan JWT claim.
- **WR-04**: `KesehatanLanding` tidak handle `countQuery.isError`. Saat query gagal total (network error, RLS deny semua tabel), `data` tetap `undefined`, `isLoading` jadi `false`, sehingga `isEmpty` evaluasi ke `false` — UI render normal state (piramida default) padahal tidak ada data. User tidak mendapat feedback error apapun.

---

## Warnings

### WR-01: RLS Policy `is_admin()` Tanpa Wrapper `SELECT`

**File:** `supabase/migrations/0029_protection_checklist.sql:44`

**Issue:** Policy USING clause memanggil `is_admin()` secara langsung tanpa wrapper `(SELECT is_admin())`. Migration `0017_tighten_rls.sql` sudah menetapkan standard "wrap in SELECT for statement-level caching" untuk semua RLS policies — kutipan dari komentar: *"Per Supabase RLS best practices — wrap auth.uid() and is_admin() in SELECT"*. Inkonsistensi ini tidak menyebabkan incorrect behavior (fungsi `is_admin()` adalah `STABLE` sehingga Postgres bisa cache), tetapi melanggar convention yang sudah ada.

**Fix:**
```sql
CREATE POLICY "Users manage own protection checklist"
  ON protection_checklist FOR ALL
  USING      ((SELECT auth.uid()) = user_id OR (SELECT is_admin()))
  WITH CHECK ((SELECT auth.uid()) = user_id);
```

---

### WR-02: `KalkulatorBanner` Navigate ke Route yang Belum Terdaftar

**File:** `src/tabs/kesehatan/KalkulatorBanner.tsx:28`

**Issue:** `onClick={() => navigate('/kesehatan/kalkulator')}` — route `/kesehatan/kalkulator` belum didefinisikan di `src/routes.tsx`. React Router akan match wildcard `{ path: '*', element: <Navigate to="/dashboard" replace /> }` dan redirect user ke dashboard tanpa pesan error. Ini unexpected UX: user klik "Buka kalkulator", tapi tiba-tiba di dashboard.

Phase 12 spec memang menyatakan kalkulator adalah Phase 15, tapi tanpa guard, link ini sudah bisa diklik di production.

**Fix (pilih salah satu):**

Opsi A — Disable tombol dengan tooltip "Coming soon":
```tsx
<Button
  variant="default"
  size="sm"
  className="shrink-0"
  disabled
  title="Kalkulator tersedia di update berikutnya"
  onClick={() => navigate('/kesehatan/kalkulator')}
>
  Buka kalkulator (segera hadir)
  <ArrowRight className="ml-2 h-4 w-4" />
</Button>
```

Opsi B — Tampilkan toast `info` seperti pola di `PiramidaShell`:
```tsx
onClick={() =>
  toast.info('Kalkulator compound interest akan tersedia di update berikutnya.')
}
```

---

### WR-03: Test 1.4 — Admin RLS Test Mungkin Tidak Memverifikasi `is_admin()` Secara Akurat

**File:** `supabase/tests/12-protection-checklist.sql:88-95`

**Issue:** Setelah `SET LOCAL ROLE authenticated` di baris 59, baris 89 hanya mengubah JWT claim sub menjadi `v_admin_uid` — database role tetap `authenticated`. Jika `auth.uid()` di Supabase dibaca dari `request.jwt.claim.sub` (yang benar untuk self-hosted Supabase), test akan pass. Namun jika environment menggunakan PostgreSQL `current_user` sebagai uid source, `is_admin()` tidak akan mendeteksi admin karena tidak ada `RESET ROLE` dan `SET LOCAL ROLE` kembali ke superuser sebelum switch JWT.

Pola yang lebih eksplisit (sesuai test `05-tighten-rls.sql` baris 122) adalah switch JWT tanpa `RESET ROLE` di antara — yang memang sudah dilakukan. Namun komentar di file tidak menjelaskan asumsi ini, sehingga bisa menyesatkan.

**Fix:** Tambahkan komentar penjelasan di baris 88:
```sql
  -- Test 1.4 — admin bisa SELECT semua rows (View-As precondition)
  -- Note: masih SET LOCAL ROLE authenticated (baris 59) — switch hanya JWT claim.
  -- is_admin() reads auth.uid() dari request.jwt.claim.sub (Supabase behavior),
  -- bukan dari PostgreSQL current_user. Pattern ini konsisten dengan 05-tighten-rls.sql:122.
  PERFORM set_config('request.jwt.claim.sub', v_admin_uid::TEXT, true);
```

---

### WR-04: `KesehatanLanding` Tidak Handle Error State dari `useTotalDataCount`

**File:** `src/tabs/kesehatan/KesehatanLanding.tsx:27-31`

**Issue:** Logic hanya branch antara `isLoading` dan bukan-loading. Saat `countQuery.isError = true`, `isLoading` adalah `false` dan `countQuery.data` adalah `undefined` — sehingga kondisi `isEmpty` evaluasi ke `false` (karena `countQuery.data !== undefined` gagal). Hasilnya: piramida render dalam `variant="default"` (warna abu biasa, bukan grayed) padahal tidak ada data yang dikonfirmasi. User tidak tahu ada error.

Meski `useTotalDataCount` sudah defensive (partial error di-catch dan return 0), `useQuery` sendiri bisa error jika `targetUid` problem atau network failure menyebabkan `Promise.all` throw.

**Fix:**
```tsx
const isLoading = countQuery.isLoading
const isError = countQuery.isError
const isEmpty =
  !isLoading &&
  !isError &&
  countQuery.data !== undefined &&
  countQuery.data.total < EMPTY_STATE_THRESHOLD

// Di JSX, tambahkan guard error state:
{isError && (
  <p className="text-sm text-destructive text-center py-2">
    Gagal memuat data. Coba refresh halaman.
  </p>
)}
```

---

## Info

### IN-01: `modulCatalog.ts` — Slug Modul Belum Punya Route Terdaftar

**File:** `src/tabs/kesehatan/modulCatalog.ts:12-49` dan `src/tabs/kesehatan/ModulCard.tsx:8`

**Issue:** Setiap `ModulCard` navigate ke `/kesehatan/${modul.slug}` (mis. `/kesehatan/arus-kas`). Route-route ini belum terdaftar di `src/routes.tsx` — semua akan jatuh ke wildcard dan redirect ke dashboard. Ini by-design (Phase 15), tetapi tidak ada guard atau indikasi visual apapun di card bahwa ini "belum aktif". Berbeda dengan `PiramidaShell` yang sudah pakai toast "Coming soon", card modul langsung navigate tanpa feedback.

**Suggestion:** Tambahkan prop `comingSoon?: boolean` ke `ModulItem` atau ganti `onClick` dengan toast, konsisten dengan pola `PiramidaShell`. Ini opsional untuk Phase 12 tapi penting sebelum deploy ke production.

---

### IN-02: `PiramidaShell` Import `toast` Tidak Digunakan Saat `variant="default"` tanpa Data Wiring

**File:** `src/tabs/kesehatan/PiramidaShell.tsx:1`

**Issue:** Import `toast` dari `sonner` digunakan untuk kedua variant (empty dan default), jadi tidak ada unused import. Ini bukan bug. Catatan saja: saat Phase 13 mengganti `onClick` dengan slide-down panel, import `toast` perlu dihapus — pertimbangkan meninggalkan TODO comment.

**Suggestion:** Tidak ada aksi yang diperlukan sekarang.

---

### IN-03: `KesehatanLayout` Wrapper `div` Redundan dengan `KesehatanLanding`

**File:** `src/tabs/kesehatan/KesehatanLayout.tsx:10` dan `src/tabs/kesehatan/KesehatanLanding.tsx:34`

**Issue:** `KesehatanLayout` membungkus `Outlet` dalam `<div className="space-y-6">`, dan `KesehatanLanding` juga membungkus kontennya dalam `<div className="space-y-6">`. Ini menyebabkan double `space-y-6` nesting — saat Phase 15 menambahkan sub-routes lain, semua child akan inherit spacing ganda dari Layout.

Karena Phase 12 hanya punya satu child (index route = Landing), ini belum terlihat secara visual. Tapi akan menjadi masalah structural saat sub-routes ditambah.

**Suggestion:** Kosongkan `KesehatanLayout` menjadi bare `<Outlet />` atau pindahkan spacing ke level yang tepat:
```tsx
export default function KesehatanLayout() {
  return <Outlet />
}
```

---

_Reviewed: 2026-05-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
