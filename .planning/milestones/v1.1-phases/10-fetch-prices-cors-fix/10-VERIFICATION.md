---
status: passed
phase: 10-fetch-prices-cors-fix
verifier: Claude Opus 4.7 (1M context) + user (manual deploy via Supabase Dashboard)
date: 2026-05-02
verdict: PASS
---

# Phase 10 Verification — Fix `fetch-prices` CORS Allowlist

**Verifier:** Claude Opus 4.7 + user (manual Dashboard deploy + Playwright-driven UAT)
**Date:** 2026-05-02 WIB
**Scope:** Tutup gap CORS allowlist yang teridentifikasi di v1.1-MILESTONE-AUDIT.md.
**Verdict:** PASS

---

## Summary

| SC | Description | Verification Method | Status |
|----|-------------|---------------------|--------|
| #1 | ALLOWED_ORIGINS Set berisi 3 entries (incl. kantongpintar.vercel.app) | Static grep (Plan 10-01) + git diff | PASS |
| #2 | Browser "Refresh Harga" dari kantongpintar.vercel.app returns 200, no CORS error | Live UAT-1 via Playwright + Network tab inspection | PASS |
| #3 | Row baru di price_history dengan date = todayISO() WIB (CONS-02 live un-blocked) | Live UAT-3 via PostgREST query | PASS |
| #4 | curl POST tanpa Authorization tetap return 401 (SEC-01 regression intact) | Task 3 curl smoke (2 variants) | PASS |

---

## Evidence per Success Criteria

### SC #1 — ALLOWED_ORIGINS source change

**Commit:** `cdc454f` — `feat(10): add kantongpintar.vercel.app to fetch-prices CORS allowlist`

**Diff applied:**
```diff
 // ---------- CORS allowlist ----------
-// Per-domain CORS. Vercel preview deploys are NOT in this list — test edge functions
-// only via `supabase functions serve` locally OR via production. (Per research integration risk note.)
+// Per-domain CORS. Production domain `kantongpintar.vercel.app` (Vercel) included.
+// Vercel preview deploys (e.g. `<branch>-<hash>.vercel.app`) are NOT in this list — test edge
+// functions only via `supabase functions serve` locally OR via production.
 const ALLOWED_ORIGINS = new Set<string>([
   'https://kantongpintar.app',
   'https://www.kantongpintar.app',
+  'https://kantongpintar.vercel.app',
 ])
```

**Static verification:**
```
$ grep -c "'https://kantongpintar.vercel.app'," supabase/functions/fetch-prices/index.ts
1
```

### SC #2 — Live UAT Refresh Harga (browser via Playwright)

**Steps executed:** Login `kantongpintar.vercel.app` (user UID `546627bd-8441-4193-9263-d7388eac59b3`) → navigate ke tab Investasi → klik tombol "Refresh Harga".

**Network observation (verbatim from Playwright network log):**

```
[POST] https://rqotdjrlswpizgpnznfn.supabase.co/functions/v1/fetch-prices => 200
[PATCH] https://rqotdjrlswpizgpnznfn.supabase.co/rest/v1/investments?id=eq.12 => 204  (BMRI saham price update)
[PATCH] https://rqotdjrlswpizgpnznfn.supabase.co/rest/v1/investments?id=eq.11 => 204  (Emas Pegadaian price update)
[POST] https://rqotdjrlswpizgpnznfn.supabase.co/rest/v1/price_history => 201  (BMRI history insert)
[POST] https://rqotdjrlswpizgpnznfn.supabase.co/rest/v1/price_history => 201  (Emas history insert)
```

**OPTIONS pre-flight smoke (executed sebelum live UAT untuk memastikan deploy active):**

```
$ curl -i -X OPTIONS "https://rqotdjrlswpizgpnznfn.functions.supabase.co/fetch-prices" \
    -H "Origin: https://kantongpintar.vercel.app" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: authorization,content-type"

HTTP/1.1 200 OK
Date: Sat, 02 May 2026 11:39:12 GMT
Content-Type: text/plain;charset=UTF-8
Access-Control-Allow-Origin: https://kantongpintar.vercel.app
Vary: Accept-Encoding, Origin
access-control-allow-headers: authorization, x-client-info, apikey, content-type
access-control-allow-methods: POST, OPTIONS
sb-project-ref: rqotdjrlswpizgpnznfn
x-deno-execution-id: 27979e27-a162-417a-84c6-a93fa7c9d0c2
x-sb-edge-region: ap-southeast-1
x-served-by: supabase-edge-runtime

ok
```

Header **`Access-Control-Allow-Origin: https://kantongpintar.vercel.app`** echo back membuktikan allowlist Set kini berisi entry baru — kalau masih versi lama (2 entries) header akan return fallback `https://kantongpintar.app`.

**Console observation:** 0 errors (1 unrelated `gotrue-js: Session as retrieve` warning — pre-existing, bukan CORS).

**App UI feedback:**
- Toast notification "2 harga diperbarui" muncul.
- Saham BMRI: harga update dari `Rp 4.620` → `Rp 4.390` (Yahoo Finance live).
- Emas Pegadaian: harga update dari `Rp 2.683.000` → `Rp 2.573.515` (metals.dev × kurs USD/IDR live).
- Reksadana: tidak berubah (correct — fetch-prices hanya handle Saham + Emas).
- Total Modal/Nilai/Gain Loss values di header tab updated accordingly.

**Result:** PASS — request `fetch-prices` returns 200; OPTIONS pre-flight echoes correct CORS Origin; downstream PATCH/INSERT operations succeed; UI updates dengan harga baru; no CORS error di Console.

### SC #3 — price_history row baru dengan WIB date (CONS-02 live)

**Query executed (PostgREST via Playwright `page.evaluate`):**
```
GET /rest/v1/price_history?select=*&order=date.desc&limit=5
```

**Result rows (verbatim):**
```json
[
  {
    "id": 31,
    "investment_id": 11,
    "price": 2573515,
    "date": "2026-05-02",
    "created_at": "2026-05-02T11:41:46.880287+00:00",
    "user_id": "546627bd-8441-4193-9263-d7388eac59b3"
  },
  {
    "id": 30,
    "investment_id": 12,
    "price": 4390,
    "date": "2026-05-02",
    "created_at": "2026-05-02T11:41:46.87635+00:00",
    "user_id": "546627bd-8441-4193-9263-d7388eac59b3"
  },
  {
    "id": 27,
    "investment_id": 7,
    "price": 100000000,
    "date": "2026-04-28",
    "created_at": "2026-04-28T08:06:39.667229+00:00",
    "user_id": "4a54608d-00a5-4260-99d1-c46893c8f956"
  }
]
```

**WIB today computed:** `2026-05-02` (via `new Date(Date.now() + 7*3600*1000).toISOString().slice(0,10)`).

**Pass logic:**
- 2 row baru terbaru (id 30, 31) untuk user 546627...59b3 dengan `date = '2026-05-02'` = `wib_today`. ✓
- `created_at = 2026-05-02T11:41:46Z` UTC = 2026-05-02 18:41 WIB — match dengan timestamp klik Refresh Harga. ✓
- Both row insert via Refresh Harga flow (investment_id 11 = Emas, 12 = BMRI saham — sesuai 2 PATCH yang terlihat di network log). ✓
- `date` field populated via `todayISO()` write-path (Phase 7 CONS-02). ✓

**Result:** PASS — CONS-02 live verified end-to-end. Sebelumnya hanya verified static (grep) + pgTAP karena CORS block menghalangi browser flow. Phase 10 un-block live evidence.

### SC #4 — SEC-01 regression curl smokes

**Smoke #1 — Allowed origin (kantongpintar.vercel.app) tanpa JWT (must 401):**
```
$ curl -i -X POST "https://rqotdjrlswpizgpnznfn.functions.supabase.co/fetch-prices" \
    -H "Origin: https://kantongpintar.vercel.app" \
    -H "Content-Type: application/json" \
    -d '{"investments":[]}'

HTTP/1.1 401 Unauthorized
Date: Sat, 02 May 2026 11:43:22 GMT
Content-Type: application/json
Access-Control-Allow-Origin: *
sb-error-code: UNAUTHORIZED_NO_AUTH_HEADER
sb-project-ref: rqotdjrlswpizgpnznfn
x-served-by: supabase-edge-runtime

{"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}
```

Result: **401 PASS** — JWT gate intact.

**Smoke #2 — Disallowed origin (malicious-example.com) tanpa JWT (must 401):**
```
$ curl -i -X POST "https://rqotdjrlswpizgpnznfn.functions.supabase.co/fetch-prices" \
    -H "Origin: https://malicious-example.com" \
    -H "Content-Type: application/json" \
    -d '{"investments":[]}'

HTTP/1.1 401 Unauthorized
Date: Sat, 02 May 2026 11:43:22 GMT
Content-Type: application/json
Access-Control-Allow-Origin: *
sb-error-code: UNAUTHORIZED_NO_AUTH_HEADER
sb-project-ref: rqotdjrlswpizgpnznfn

{"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}
```

Result: **401 PASS**.

**Notable observation:** Response header `sb-error-code: UNAUTHORIZED_NO_AUTH_HEADER` + `Access-Control-Allow-Origin: *` adalah signature **Supabase platform gateway**, bukan dari handler `corsFor()` kita. Karena `verify_jwt = true` di `supabase/config.toml` (Phase 5 SEC-01), gateway menolak request tanpa JWT **sebelum** handler dieksekusi.

**Implication:**
- Plan 10-02 expectation awal ("Smoke #2 should return `access-control-allow-origin: https://kantongpintar.app` fallback") TIDAK match karena gateway-layer reject — handler tidak berjalan, `corsFor()` tidak dipanggil.
- Behavior actual lebih AMAN (defense-in-depth: platform reject + handler reject = double gate).
- Body response tidak expose data sensitif — hanya error code.
- Functional requirement (no auth bypass) fully met. CORS-echo-back assertion moot karena platform yang respond.

**Combined verdict SC #4:** SEC-01 regression intact. CORS allowlist change (Plan 10-01) tidak introduce auth bypass. Both 401 status + `UNAUTHORIZED_NO_AUTH_HEADER` error code prove platform-layer JWT verification working as designed.

---

## Deploy Evidence (Task 1)

**Method:** Manual deploy via Supabase Dashboard → Edge Functions → fetch-prices → Code editor → Deploy (CLI tidak terinstall di mesin user).

**User confirmation:** "successfull update fetch" (deploy notification dari Dashboard).

**Post-deploy OPTIONS smoke:** PASS — `Access-Control-Allow-Origin: https://kantongpintar.vercel.app` echo back, `vary: Origin` present, `access-control-allow-methods: POST, OPTIONS`, `x-served-by: supabase-edge-runtime`, edge region `ap-southeast-1`.

---

## Regression Check

Spot-check skenario non-Phase-10 dilakukan inline saat Playwright UAT — tab Investasi load + render, table 3 row, header summary (Total Modal, Nilai Saat Ini, Gain/Loss) populated correctly:

- [x] Login Google OAuth tetap berfungsi (kantongpintar.vercel.app user 546627...59b3 logged in).
- [x] Tab Investasi load + table render 3 baris (Saham BMRI, Emas Pegadaian, Reksadana Sucorinvest).
- [x] Refresh Harga flow end-to-end working (the test target — covered di SC #2).
- [x] Header summary Total Modal/Nilai/Gain-Loss recalculate setelah price update.
- [x] Tab Dashboard render correctly (saw KPI cards, transaksi terakhir, goals aktif, tagihan bulan ini di initial snapshot).
- [x] Tab Investasi action buttons (Tambah, Edit, Hapus, Update harga, Ekspor, Impor) tetap render dan accessible.

Tidak dilakukan destructive spot-check (add/edit/delete investasi) untuk avoid mengotori data user — Phase 9 fresh UAT (2026-04-28) sudah cover destructive flows comprehensively.

---

## Closes / Un-blocks

- **Closes:** "Edge Function `fetch-prices` CORS misconfiguration" deferred item di STATE.md (v1.1 Deferred Items) — ditandai resolved Phase 10.
- **Un-blocks:** Phase 5 SEC-01 live re-verification dari production domain — sebelumnya hanya verified via curl, sekarang via browser UAT real flow (Refresh Harga → 200 + JWT enforcement still intact via curl smokes).
- **Un-blocks:** Phase 7 CONS-02 live verification — `todayISO()` write-path sebelumnya hanya verified static (grep) + DB-side (pgTAP); sekarang verified end-to-end live (price_history row id 30, 31 dengan `date = '2026-05-02'` WIB).

## Deferred / Out of Scope (carried forward to v1.2)

- D-14 raw NUMERIC formatting di withdraw_from_goal error message — tetap defer ke v1.2.
- net_worth_snapshots auto-insert 42501 saat View-As — tetap defer ke v1.2.
- Migration history reconciliation (`supabase migration list --linked` masih show Local-only 0014..0025) — tetap defer ke v1.2 hygiene phase.
- Supabase CLI installation di dev machine — kandidat v1.2 dev-onboarding doc (saat ini deploy via Dashboard sebagai workaround).

---

## Artifacts

- `supabase/functions/fetch-prices/index.ts` (modified Plan 10-01 commit `cdc454f`, deployed to production via Dashboard 2026-05-02).
- `cdc454f`: feat(10) source change.
- `48c7882`: docs(10-01) — Plan 10-01 SUMMARY + STATE/ROADMAP intermediate update.

---

## Sign-off

- [x] All 4 SC PASS
- [x] No regression (verified inline via Playwright)
- [x] Evidence recorded (verbatim curl + Playwright network/UI/SQL outputs)
- [x] STATE.md updated (Phase 10 complete + deferred CORS item resolved) — see Plan 10-02 Task 5
- [x] ROADMAP.md Phase 10 row marked [x] — see Plan 10-02 Task 5
- [x] Verdict: **PASS**

**Verifier:** Claude Opus 4.7 + Rino (user)
**Date:** 2026-05-02
