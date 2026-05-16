---
phase: 14-protection-tier4-checklists
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/components/ui/radio-group.tsx
  - src/db/protectionChecklist.ts
  - src/queries/kesehatanIndikator.ts
  - src/queries/kesehatanTier1.ts
  - src/queries/kesehatanTier4.ts
  - src/queries/protectionChecklist.ts
  - src/tabs/kesehatan/AsuransiKesehatanForm.tsx
  - src/tabs/kesehatan/KesehatanLanding.tsx
  - src/tabs/kesehatan/Tier1Panel.tsx
  - src/tabs/kesehatan/Tier4LifeSection.tsx
  - src/tabs/kesehatan/Tier4Panel.tsx
  - supabase/scripts/reset-protection-checklist.sql
  - supabase/tests/14-protection-checklist-mutations.sql
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-05-09
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 14 mengirimkan tiga deliverable: (a) inline form Tier 1 #4 Asuransi Kesehatan
(`AsuransiKesehatanForm.tsx`), (b) smart-gated checklist Tier 4 (`Tier4Panel.tsx` +
`Tier4LifeSection.tsx`) dengan auto-save per radio change, dan (c) View-As guard
defensif via `useUpdateProtectionChecklist` mutation hook. Promosi
`ProtectionChecklistRow` ke `src/db/protectionChecklist.ts` rapi, dan re-export
dari `kesehatanTier1.ts` menjaga backward-compat.

Tidak ditemukan issue Critical (tidak ada injection, secret, ataupun bypass auth
di sisi client — RLS WITH CHECK + defensive throw di mutation hook sudah
defense-in-depth).

Issue Warning yang ditemukan terutama di sekitar (1) compute Tier 4 yang inkonsisten
dengan deklarasi return-type `'green' | 'red' | 'gray'` (function signature
declares `'yellow'` tapi codepath tidak pernah produce yellow — bukan bug, tapi
type-deklarasi misleading), (2) auto-save tanpa indikator pending state di
Tier4Panel/Tier4LifeSection (UX rapuh saat network lag — beda dengan
AsuransiKesehatanForm yang gate Submit `disabled={mutation.isPending}`), (3)
test SQL T5 tidak match jalur kode (test pakai bare INSERT tanpa user_id JWT,
seharusnya UPSERT path yang dipakai client), dan (4) `onMutate` membaca `uid`
dari closure yang bisa stale jika sign-out/sign-in di tengah flight.

Info findings adalah peluang konsistensi minor (unused `disabled` di
`RadioGroupItem` Radix tidak forward, file split policy file header berbeda
dengan implementasi, naming konvensi).

## Warnings

### WR-01: Tier 4 color signature claim 'yellow' tapi tidak pernah dihasilkan

**File:** `src/queries/kesehatanTier4.ts:54-56`
**Issue:** Function `computeTier4Color()` deklarasi return type
`'green' | 'yellow' | 'red' | 'gray'` (line 56), tapi file header (line 24)
secara eksplisit menyatakan "Yellow boundary: NOT used in Phase 14 ... Output
color domain = {green, red, gray}". Implementation hanya mengisi
`booleanToResult()` dengan `green`/`red` dan life-coverage indicators dengan
`green`/`red`. Hasil `aggregateTierColor()` atas indikator yang seluruhnya
green/red juga hanya bisa `green` atau `red` (atau `gray` jika array kosong —
tapi itu juga early-return di gate). Type lebih luas dari nilai aktual =
TypeScript tidak help downstream consumer untuk narrow.

**Fix:**
```ts
export function computeTier4Color(
  row: ProtectionChecklistRow | null,
): 'green' | 'red' | 'gray' {
  // ... (body unchanged)
  // CATATAN: aggregateTierColor() return signature lebih luas, jadi narrow
  // result-nya secara eksplisit (atau cast aman karena indicators tidak
  // pernah berisi color='yellow'):
  return aggregateTierColor(indicators) as 'green' | 'red' | 'gray'
}
```
Atau, jika ingin lebih konservatif, biarkan return type tetap (kalau di masa
depan threshold yellow ditambahkan), tapi update file header agar match. Pilih
salah satu — saat ini header dan signature kontradiksi.

---

### WR-02: Auto-save Tier 4 tidak ada feedback pending — risiko double-fire & UX confused

**File:** `src/tabs/kesehatan/Tier4Panel.tsx:122-124,148-150,167-169,186-188`, `src/tabs/kesehatan/Tier4LifeSection.tsx:48-50,61-63,76-78`
**Issue:** Semua RadioGroup di Tier4Panel dan Tier4LifeSection panggil
`mutation.mutate(...)` langsung dari `onValueChange`, tanpa gate
`mutation.isPending` di prop `disabled`. Jika user klik radio cepat berturut-turut
(misalnya gate=Ya → estate-heirs=Tidak → estate-heirs=Ya), beberapa request
bisa in-flight bersamaan. Optimistic update di `onMutate` aman (spread merge),
tapi server response order tidak dijamin — `onSettled` invalidate query setelah
masing-masing mutation, sehingga user bisa lihat flicker. Bandingkan dengan
`AsuransiKesehatanForm.tsx:122` yang gate Submit dengan `disabled={!draft || mutation.isPending}`.

Selain itu, tidak ada visual "saving..." indicator, sehingga user tidak tahu
mutation sedang berlangsung. Jika network lag + click berturut-turut + onError
ke patch lama, snapshot yang di-restore (`ctx.snapshot`) akan re-apply nilai LAMA
ke baris yang sudah di-update oleh mutation lain. Itu corruption visual (DB tetap
benar dari mutation terakhir + invalidate, tapi user lihat "loncat balik").

**Fix:** Tambah `disabled={isViewAs || mutation.isPending}` di semua RadioGroup
yang auto-save. Atau, tambah debounce/queue per-field. Minimal:
```tsx
<RadioGroup
  value={gateValueToString(row?.has_dependents)}
  onValueChange={(v) => mutation.mutate({ has_dependents: v === 'ya' })}
  disabled={isViewAs || mutation.isPending}
  className={HORIZ_CLS}
>
```
Pertimbangkan juga snapshot restore strategy: jika ada mutation in-flight saat
mutation baru di-fire, snapshot yang disimpan oleh mutation kedua sudah
optimistic-result dari mutation pertama — onError akan restore ke optimistic-
intermediate, bukan ke server-confirmed value. React Query default behavior, tapi
worth dicatat untuk follow-up.

---

### WR-03: T5 di test SQL tidak merefleksikan code path mutation hook

**File:** `supabase/tests/14-protection-checklist-mutations.sql:122-132`
**Issue:** T5 melakukan `RESET ROLE` lalu bare `INSERT INTO protection_checklist
(user_id, health_coverage) VALUES ('00000000-...-ce5'::UUID, 'invalid_value')`.
Karena `RESET ROLE` mengubah kembali ke superuser/postgres, RLS bypass dan
WITH CHECK tidak diuji di T5 — yang diuji murni CHECK constraint enum.

Penamaan test dan komentar oke ("CHECK constraint rejects invalid enum"), tapi
tidak match jalur `upsertProtectionChecklist()` (yang selalu UPSERT dengan
`onConflict: 'user_id'`, bukan bare INSERT). Konsekuensi: test passing tidak
menjamin client mutation path benar — hanya menjamin DB CHECK aktif. Ini
acceptable sebagai unit test schema, tapi sebaiknya tambahkan T5b yang
memverifikasi enum check lewat UPSERT path under authenticated JWT, mirror
client behavior.

**Fix:** Tambah test T5b setelah T5:
```sql
-- T5b — UPSERT path with invalid enum also rejected (mirrors client)
SET LOCAL ROLE authenticated;
PERFORM set_config('request.jwt.claim.sub', v_user_uid::TEXT, true);
BEGIN
  INSERT INTO protection_checklist (user_id, life_coverage)
  VALUES (v_user_uid, 'invalid_value')
  ON CONFLICT (user_id) DO UPDATE SET life_coverage = 'invalid_value';
  RAISE NOTICE 'FAIL: T5b UPSERT with invalid enum SUCCEEDED';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS: T5b UPSERT path rejects invalid enum (23514)';
WHEN OTHERS THEN
  RAISE NOTICE 'FAIL: T5b wrong SQLSTATE % -- %', SQLSTATE, SQLERRM;
END;
```

---

### WR-04: `onMutate` dan `onSettled` reference `uid` dari closure — stale jika sign-out/sign-in

**File:** `src/queries/protectionChecklist.ts:55-97`
**Issue:** `useUpdateProtectionChecklist` panggil `useTargetUserId()` di top,
lalu reference `uid` di `mutationFn`, `onMutate`, dan `onSettled` (line 67, 72,
78, 95). Hook React rerender saat `uid` berubah, tapi mutation yang sudah
in-flight ketika sign-out → sign-in akan tetap pakai `uid` lama (closure capture).
Skenario:
1. User A buka halaman, klik radio → `mutation.mutate()` fire dengan `uid = A`.
2. Sebelum mutation selesai, user A sign-out, sign-in sebagai user B.
3. `onSettled` invoke dengan `uid` lama = A → `qc.invalidateQueries(['kesehatan',
   'protection-checklist', A])` invalidate cache user A.
4. Cache user B tidak di-invalidate, tapi mutation `mutationFn` panggil
   `upsertProtectionChecklist(uid_lama=A)` — yang akan ditolak RLS WITH CHECK
   (user B JWT ≠ A) atau, lebih buruk, kalau `uid` user A sempat ter-restore
   sebelum guard, write ke baris orang lain.

Praktis kemungkinan kecil (sign-out membatalkan supabase session, request akan
401), tapi pattern bisa di-harden dengan baca `uid` di dalam `mutationFn`/closure
mutation lifecycle. Pattern serupa di `recurringTransactions.ts` (referenced dalam
docstring) mungkin punya issue yang sama — itu di luar scope review ini.

**Fix:** Jika ingin defensive, bisa snapshot `uid` saat mutation queued:
```ts
return useMutation({
  mutationFn: async (patch: ProtectionChecklistPatch) => {
    const currentUid = uid // read at queue time
    if (viewingAs !== null) throw new Error('...')
    if (!currentUid) throw new Error('Unauthenticated')
    return upsertProtectionChecklist(currentUid, patch)
  },
  // ...
})
```
Atau, terima saja sebagai acceptable risk (RLS WITH CHECK tetap fallback). Jika
diabaikan, tambahkan komentar di hook menjelaskan asumsi (uid stable selama
mutation lifecycle, RLS sebagai backstop).

---

## Info

### IN-01: `RadioGroupItem disabled={isViewAs}` redundant — Radix RadioGroup propagates disabled

**File:** `src/tabs/kesehatan/Tier4Panel.tsx:126,130,152,156,160,171,175,179,189,193,197`, `src/tabs/kesehatan/Tier4LifeSection.tsx:53,65,69,80,84,88`, `src/tabs/kesehatan/AsuransiKesehatanForm.tsx:104`
**Issue:** Semua `RadioGroupItem` mendapat `disabled={isViewAs}` walaupun
parent `RadioGroup` sudah `disabled={isViewAs}`. Radix `RadioGroup.Root` propagates
`disabled` ke children secara otomatis (per Radix docs). Ini noise visual yang
bikin file lebih panjang dari perlu. Defense-in-depth defensible (dokumented di
docstring AsuransiKesehatanForm.tsx:26 "Defensive: RadioGroupItem disabled..."),
tapi kalau memang ingin defensive, sertakan komentar inline supaya next maintainer
tidak menghapus.

**Fix:** Hapus `disabled={isViewAs}` di semua `RadioGroupItem` (Radix akan
propagate). Atau biarkan + tambah comment satu kali per file:
```tsx
{/* disabled={isViewAs} di RadioGroupItem = defense-in-depth (Radix sudah propagate dari Root) */}
```

---

### IN-02: `STATE_C_BADGE_TEXT` dan `HEALTH_COVERAGE_LABEL` punya 5 entries identik secara semantik

**File:** `src/tabs/kesehatan/AsuransiKesehatanForm.tsx:42-48`, `src/queries/kesehatanTier1.ts:249-258`
**Issue:** Komentar di AsuransiKesehatanForm.tsx:39-41 secara eksplisit
mengatakan "Single source of truth for State C badge display in this component.
Component-local — do NOT import HEALTH_COVERAGE_LABEL ... Each surface owns
its own UI strings". Decision ini dihormati, tapi worth catat: kedua map
membawa label "Indonesian" yang berbeda strings ("Kantor" vs "Dari kantor",
"Tidak covered" vs "Tidak covered"). Jika produk ingin konsistensi terminologi
("Pribadi" vs "Asuransi pribadi"), copywriter perlu sinkronkan. Ini info, bukan
bug — sengaja.

**Fix:** Tidak perlu code change. Catat di dokumentasi UI-SPEC bahwa terminologi
boleh beda per surface (Tier 1 panel Indikator vs State C badge inline form).

---

### IN-03: Komentar `Tier 4 = no indicators di Phase 13` di `TIER_INDICATORS` outdated

**File:** `src/queries/kesehatanIndikator.ts:154-160`
**Issue:** Komentar line 154 berkata "Tier 4 = no indicators di Phase 13 (smart-
gated checklist Phase 14)". Phase 14 sudah deliver checklist via
`computeTier4Color(protectionRow)` di `deriveTierColors`. Komentar betul secara
struktur (`TIER_INDICATORS[4]: []` empty array karena Tier 4 tidak ikut
`aggregateTierColor` di `IndikatorMap`-based aggregation), tapi reader baru
mungkin bingung. Tambah klarifikasi.

**Fix:**
```ts
/**
 * Map indikator IDs → tier ID. Per spec §4 struktur 4 tier.
 * Tier 4 = empty array di sini (TIER_INDICATORS[4]: []) karena agregasi
 * Tier 4 TIDAK pakai IndikatorMap[id] (yang sourcing-nya transaksi/akun),
 * melainkan langsung ke ProtectionChecklistRow via computeTier4Color.
 * Lihat deriveTierColors() untuk wiring.
 */
```

---

### IN-04: `mutation` prop di `Tier4LifeSection` typed via `ReturnType<typeof useUpdateProtectionChecklist>` — fragile

**File:** `src/tabs/kesehatan/Tier4LifeSection.tsx:36-40`
**Issue:** Type `mutation: ReturnType<typeof useUpdateProtectionChecklist>`
membuat sub-component dependent pada exact return shape `useMutation`. Jika
hook implementation ditambah selectors/transforms (mis. spread `mutation`), API
seam berubah tanpa breaking compile. Lebih baik define narrow type interface
untuk apa yang di-consume Tier4LifeSection (cuma `.mutate()`).

**Fix:**
```ts
type Tier4LifeSectionProps = {
  row: ProtectionChecklistRow | null | undefined
  mutation: { mutate: (patch: ProtectionChecklistPatch) => void }
  isViewAs: boolean
}
```
Atau, biarkan saja — pattern `ReturnType<typeof hook>` umum dipakai di codebase
ini (verify via grep). Info-level karena bukan bug.

---

### IN-05: `boolToString` di `Tier4LifeSection` duplicate dengan adapter di `Tier4Panel` (`gateValueToString`)

**File:** `src/tabs/kesehatan/Tier4LifeSection.tsx:22-24`, `src/tabs/kesehatan/Tier4Panel.tsx:71-73`
**Issue:** Function body identik:
```ts
function gateValueToString(v: boolean | null | undefined): 'ya' | 'tidak' | '' {
  return v === true ? 'ya' : v === false ? 'tidak' : ''
}
function boolToString(v: boolean | null | undefined): 'ya' | 'tidak' | '' {
  return v === true ? 'ya' : v === false ? 'tidak' : ''
}
```
Sengaja didokumentasikan terpisah (Tier4Panel.tsx:71 "Gate has only 2 options"
vs life_coverage_sufficient di Tier4LifeSection). Tidak ada bug, tapi DRY
violation kecil — calo extract ke `kesehatanAdapters.ts` shared (atau ke
`kesehatanTypes.ts`).

**Fix:**
```ts
// src/tabs/kesehatan/booleanRadioAdapter.ts
export function boolToYaTidak(v: boolean | null | undefined): 'ya' | 'tidak' | '' {
  return v === true ? 'ya' : v === false ? 'tidak' : ''
}
```
Lalu import di Tier4Panel + Tier4LifeSection.

---

_Reviewed: 2026-05-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
