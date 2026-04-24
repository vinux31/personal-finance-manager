# Phase 1: Foundation - Research

**Researched:** 2026-04-24
**Domain:** Supabase SQL migrations, TypeScript Date API, React tab navigation (shadcn/ui)
**Confidence:** HIGH
**Last revised:** 2026-04-24 (checker feedback — const/let canonicalization, open questions resolved)

---

<user_constraints>
## User Constraints (dari CONTEXT.md)

### Locked Decisions

- **D-01:** Tab `value` tetap `'goals'` — hanya label yang berubah menjadi `"Finansial"`. Mencegah tab tersimpan (persisted active tab) pengguna rusak.
- **D-02:** Tab icon tetap `Target` (Lucide) — tidak perlu diubah karena Goals tetap ada sebagai sub-tab.
- **D-03:** Sub-tab `defaultValue` = `'kekayaan'` — Kekayaan tampil pertama saat tab dibuka.
- **D-04:** Sub-tab visual: ikuti pola PensiunTab secara persis — `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` dari shadcn/ui.
- **D-05:** Dua file migrasi terpisah: `0012_net_worth.sql` (3 tabel) dan `0013_bill_payments.sql` (1 tabel).
- **D-06:** RLS mengikuti pola `0010_recurring_transactions.sql` — `auth.uid() = user_id` pada `USING` dan `WITH CHECK`. SELECT juga menyertakan `OR is_admin()`.
- **D-07:** Dua tabel terpisah (`net_worth_accounts` + `net_worth_liabilities`) — bukan satu tabel gabungan.
- **D-08:** Fix month-end overflow dengan clamping menggunakan native Date arithmetic — tanpa library eksternal.
- **D-09:** Implementasi clamping: `new Date(y, targetMonth + 1, 0).getDate()` untuk mendapat hari terakhir bulan target.
- **D-10:** Tidak perlu unit test file di fase ini — verifikasi manual cukup.

### Claude's Discretion

- Tipe kolom SQL dan constraints yang tepat (mengacu migrasi yang sudah ada)
- `net_worth_snapshots.net_worth`: pakai GENERATED ALWAYS AS stored column atau hitung di application layer
- GoalsTab content tidak berubah sama sekali — hanya dibungkus dalam sub-tab container

### Deferred Ideas (OUT OF SCOPE)

Tidak ada — diskusi tetap dalam scope fase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Deskripsi | Dukungan Research |
|----|-----------|-------------------|
| FOUND-01 | Bug `nextDueDate()` month-end overflow diperbaiki (31 Jan + 1 bulan = 28 Feb, bukan 3 Mar) | Bug terkonfirmasi di baris 34 `recurringTransactions.ts`; fix pattern dengan native Date clamping sudah diverifikasi |
| FOUND-02 | Migrasi DB: 4 tabel baru dengan RLS policy `auth.uid() = user_id` | Pattern SQL dari migrasi 0010 dan 0011 sudah diverifikasi; nomor migrasi berikutnya adalah 0012 dan 0013 |
| NAV-01 | Tab "Goals" diganti nama menjadi "Finansial" dengan 2 sub-tab: "Goals" dan "Kekayaan" | Titik integrasi di `src/App.tsx` baris 32 diverifikasi; pola sub-tab dari PensiunTab.tsx diverifikasi |
</phase_requirements>

---

## Summary

Phase 1 adalah fase preparasi murni: tidak ada UI baru yang signifikan, tidak ada fitur baru yang terekspos ke pengguna. Tiga deliverable utama adalah (1) perbaikan bug overflow tanggal di `nextDueDate()`, (2) dua file migrasi SQL yang menciptakan 4 tabel baru dengan RLS, dan (3) restrukturisasi tab navigasi Goals menjadi Finansial dengan 2 sub-tab.

Semua pola yang dibutuhkan sudah tersedia di codebase: pola migrasi SQL dari `0010_recurring_transactions.sql` dan `0011_pension_simulations.sql`, pola sub-tab dari `PensiunTab.tsx`, dan pola modifikasi TABS array dari `App.tsx`. Tidak ada library baru yang perlu diinstal dan tidak ada pola arsitektur baru yang perlu ditemukan.

Risiko utama fase ini adalah regresi — perubahan pada `App.tsx` dan `recurringTransactions.ts` bisa mempengaruhi fitur yang sudah berjalan jika tidak hati-hati. Mitigasinya adalah membuat perubahan sesempit mungkin: hanya dua field di TABS array, hanya satu `case 'monthly'` di `nextDueDate()`.

**Primary recommendation:** Implementasi dalam urutan — bug fix dulu (risiko rendah, terisolasi), lalu migrasi SQL (tidak menyentuh kode), lalu modifikasi navigasi (perubahan UI minimal).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bug fix `nextDueDate()` | Application layer (TypeScript) | — | Logika kalkulasi tanggal ada di `src/db/recurringTransactions.ts`, bukan di DB |
| Migrasi SQL (4 tabel baru) | Database (Supabase/PostgreSQL) | — | Schema dan RLS sepenuhnya dikelola di layer DB via migration files |
| Tab navigation restructure | Frontend (React component) | — | Perubahan hanya pada `src/App.tsx` TABS array dan satu file komponen baru |
| RLS policy enforcement | Database (PostgreSQL RLS) | — | Keamanan data dikendalikan di Supabase, bukan di application layer |

---

## Standard Stack

### Core (sudah ada, tidak perlu install)

| Library | Versi | Tujuan | Status |
|---------|-------|--------|--------|
| shadcn/ui Tabs | terinstall | Sub-tab FinansialTab | Sudah ada di `src/components/ui/tabs.tsx` [VERIFIED: codebase grep] |
| TypeScript native Date | built-in | Fix `nextDueDate()` clamping | Tidak perlu library eksternal (D-08) [VERIFIED: CONTEXT.md] |
| PostgreSQL GENERATED ALWAYS AS | fitur PostgreSQL standar | Computed column `net_worth` di snapshots | Didukung oleh Supabase [ASSUMED] |
| Lucide React | terinstall | Icon `Target` di tab | Sudah diimport di `src/App.tsx` [VERIFIED: codebase read] |

### Tidak Ada Dependency Baru

Fase ini **zero new dependencies**. Semua yang dibutuhkan sudah ada di codebase.

---

## Architecture Patterns

### System Architecture Diagram

```
[Pengguna klik tab "Finansial"]
         │
         ▼
  App.tsx TABS array
  value='goals', label='Finansial', Comp=FinansialTab
         │
         ▼
  FinansialTab.tsx (FILE BARU)
  ┌─────────────────────────────┐
  │ <Tabs defaultValue="kekayaan">│
  │   TabsList                  │
  │   ├── TabsTrigger "Kekayaan"│
  │   └── TabsTrigger "Goals"   │
  │   TabsContent "kekayaan"    │
  │   └── KekayaanPlaceholder   │
  │   TabsContent "goals"       │
  │   └── <GoalsTab /> (UNCHANGED)
  └─────────────────────────────┘

[useProcessRecurring memanggil nextDueDate()]
         │
         ▼
  recurringTransactions.ts
  nextDueDate(current, 'monthly')
  ├── [BUG] setMonth() overflow → 3 Mar
  └── [FIX] clamp ke hari terakhir bulan target → 28 Feb

[Supabase DB Layer]
  0012_net_worth.sql
  ├── net_worth_accounts (user_id, name, type, balance)
  ├── net_worth_liabilities (user_id, name, type, amount)
  └── net_worth_snapshots (user_id, ..., net_worth GENERATED)
  0013_bill_payments.sql
  └── bill_payments (user_id, recurring_template_id, ...)
  Semua tabel: RLS auth.uid() = user_id
```

### Recommended Project Structure (perubahan di fase ini)

```
src/
├── App.tsx                    # MODIFIED — 2 field di TABS entry 'goals'
├── tabs/
│   ├── GoalsTab.tsx           # UNCHANGED — diimport sebagai sub-tab
│   └── FinansialTab.tsx       # NEW — wrapper sub-tab shadcn
supabase/
└── migrations/
    ├── 0012_net_worth.sql     # NEW — 3 tabel net worth
    └── 0013_bill_payments.sql # NEW — 1 tabel bill payments
```

### Pattern 1: nextDueDate Monthly Clamping (Mutation-Only)

**What:** Gunakan pola mutasi berurutan pada object `Date` yang sama: `setDate(1)` → `setMonth(target)` → hitung `lastDay` → `setDate(Math.min(d, lastDay))`. Tidak ada reassignment variabel — `const date` tetap `const`.

**When to use:** Setiap kali advance tanggal monthly dengan original day > 28.

```typescript
// Source: Derived from D-08/D-09 in CONTEXT.md + native JS Date behavior
// Canonical mutation-only approach — const date stays const
case 'monthly': {
  const targetMonth = date.getMonth() + 1
  date.setDate(1)                                                        // prevent setMonth overflow
  date.setMonth(targetMonth)                                             // advance safely (day=1 always valid)
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate()
  date.setDate(Math.min(d, lastDay))                                     // clamp to valid day
  break
}
```

**Catatan implementasi:**
- Gunakan `d` (hari asli hasil parse di line 29) sebagai referensi clamping, bukan `date.getDate()` (nilai `date.getDate()` adalah `1` pada titik ini karena `setDate(1)`).
- `date.getFullYear()` dipanggil SETELAH `setMonth()` agar year rollover Desember→Januari tertangani otomatis (`setMonth(12)` roll ke Januari tahun berikutnya).
- `const date` di line 30 **TIDAK** berubah menjadi `let` — semua operasi adalah mutasi (`setDate`, `setMonth`), tidak ada reassignment.

### Pattern 2: SQL Migration dengan RLS

**What:** Setiap tabel baru harus mengikuti urutan: CREATE TABLE → ENABLE ROW LEVEL SECURITY → CREATE POLICY.

**When to use:** Semua tabel baru di Supabase yang menyimpan data per-user.

```sql
-- Source: 0010_recurring_transactions.sql (VERIFIED codebase read)
-- dan 0011_pension_simulations.sql (VERIFIED codebase read)

CREATE TABLE net_worth_accounts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('tabungan','giro','cash','deposito','dompet_digital','properti','kendaraan')),
  balance     NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE net_worth_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own net worth accounts"
  ON net_worth_accounts FOR ALL
  USING  (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);
```

**Catatan RLS:** Policy SELECT menggunakan `OR is_admin()` (dari D-06) untuk admin view-as. Policy INSERT/UPDATE/DELETE hanya `auth.uid() = user_id`. Implementasi `FOR ALL` mencakup keduanya secara otomatis — pertimbangkan apakah perlu split policy USING vs WITH CHECK per operasi, atau cukup satu FOR ALL seperti 0011.

### Pattern 3: Sub-Tab di Dalam Tab (shadcn Tabs)

**What:** Komponen Tabs dari shadcn/ui bisa di-nest. Top-level Tab (App.tsx) render FinansialTab, yang di dalamnya render Tabs lagi untuk sub-navigasi.

**When to use:** Setiap kali satu tab butuh navigasi internal.

```tsx
// Source: src/tabs/PensiunTab.tsx baris 135-151 (VERIFIED codebase read)
// FinansialTab.tsx — ikuti pola ini secara persis (D-04)

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import GoalsTab from '@/tabs/GoalsTab'

export default function FinansialTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="kekayaan" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="kekayaan">Kekayaan</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>
        <TabsContent value="kekayaan">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-muted-foreground text-sm">
              Fitur Kekayaan (Net Worth) akan hadir di Phase 2.
            </span>
          </div>
        </TabsContent>
        <TabsContent value="goals">
          <GoalsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Mengubah `value` tab dari `'goals'` ke `'finansial'`:** Akan merusak state tab yang sudah tersimpan di `useTabStore` untuk pengguna existing (D-01).
- **Menggunakan `date.setMonth()` tanpa clamping:** Ini adalah bug yang sedang diperbaiki — `date.setMonth(m)` pada tanggal 31 January akan auto-advance ke Maret karena 31 Feb tidak valid.
- **Mengubah `const date` menjadi `let date`:** Tidak perlu. Pola mutation-only (lihat Pattern 1) tidak melakukan reassignment — hanya mutasi method `setDate()` / `setMonth()` pada object yang sama.
- **Menggabungkan `net_worth_accounts` dan `net_worth_liabilities` menjadi satu tabel:** Sudah diputuskan di STATE.md untuk pakai dua tabel terpisah (D-07).
- **Membuat satu migration file untuk semua 4 tabel:** D-05 mewajibkan split menjadi 0012 dan 0013 karena alasan konseptual (net worth vs bills).
- **Memodifikasi GoalsTab.tsx:** Zero changes — hanya diimport ke dalam FinansialTab.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Last day of month | Kalkulator manual (28/29/30/31) | `new Date(y, m+1, 0).getDate()` | Native JS Date handle tahun kabisat otomatis |
| Tab navigation | Custom state management | `useTabStore` (sudah ada) | Sudah menghandle persistence active tab |
| Sub-tab UI | Custom accordion/toggle | shadcn Tabs (sudah ada) | Sudah terinstall, accessible, dan konsisten dengan PensiunTab |
| Row-level access control | Application-layer filtering | PostgreSQL RLS | Lebih aman — enforce di DB layer, bukan bisa di-bypass di client |

**Key insight:** Fase ini sengaja seminimalis mungkin — semua pattern sudah ada, tidak perlu menemukan solusi baru.

---

## Common Pitfalls

### Pitfall 1: setMonth() Overflow pada Tanggal > 28

**What goes wrong:** `date.setMonth(date.getMonth() + 1)` pada tanggal 31 January menghasilkan `new Date(2024, 1, 31)` — JavaScript auto-advance ke 2 Maret (bukan 28 Feb), karena Februari tidak memiliki 31 hari.

**Why it happens:** JavaScript Date API tidak clamp — ia overflow ke bulan berikutnya secara otomatis.

**How to avoid:** Panggil `date.setDate(1)` SEBELUM `setMonth()` agar tidak overflow. Kemudian hitung `lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()` dan panggil `date.setDate(Math.min(d, lastDay))` dengan `d` = hari asli hasil parse string.

**Warning signs:** Test dengan tanggal 29, 30, 31 di bulan Januari, Maret, Mei, Juli, Agustus, Oktober, Desember — semua bulan yang punya hari > 28.

### Pitfall 2: Konflik Nomor Migrasi

**What goes wrong:** Dua developer push migrasi dengan nomor yang sama, atau migrasi lokal sudah ada 0012 yang belum di-push.

**Why it happens:** Supabase migration files harus punya nomor sequential unik.

**How to avoid:** Verifikasi `ls supabase/migrations/` sebelum membuat file baru. File terakhir adalah `0011_pension_simulations.sql` — nomor berikutnya pasti 0012 dan 0013. [VERIFIED: codebase glob]

**Warning signs:** Error Supabase "migration already applied" atau file conflict saat push.

### Pitfall 3: GoalsTab Mendapat Props yang Tidak Diharapkan

**What goes wrong:** `FinansialTab` memanggil `<GoalsTab />` — jika GoalsTab butuh props dari parent (misalnya dari App.tsx), bungkus di sub-tab bisa memutus data flow.

**Why it happens:** React component tree berubah — GoalsTab sekarang child dari FinansialTab bukan langsung dari TABS renderer.

**How to avoid:** Periksa GoalsTab.tsx sebelum implementasi — pastikan ia tidak mengonsumsi props dari parent. Jika GoalsTab menggunakan React Query / hooks internal, ini aman. Jika menerima props, perlu forwarding.

**Warning signs:** TypeScript error "Property X is required" saat merender GoalsTab tanpa props.

### Pitfall 4: RLS `WITH CHECK` Tidak Tepat pada FOR ALL

**What goes wrong:** Policy `FOR ALL USING (auth.uid() = user_id OR is_admin())` tanpa explicit `WITH CHECK` akan inherit USING clause sebagai WITH CHECK — artinya admin bisa INSERT data untuk user lain secara tidak sengaja.

**Why it happens:** PostgreSQL: jika WITH CHECK tidak dispesifikasikan pada FOR ALL, ia menggunakan USING expression.

**How to avoid:** Pisahkan USING (dengan OR is_admin()) untuk read, dan WITH CHECK (auth.uid() = user_id saja) untuk write. Atau: ikuti pola 0011 yang menggunakan `WITH CHECK (auth.uid() = user_id)` secara eksplisit. [VERIFIED: 0011 source read]

**Warning signs:** Admin bisa melakukan INSERT ke tabel milik user lain.

---

## Code Examples

### Verified: nextDueDate Fix (lengkap — mutation-only, `const date` stays const)

```typescript
// Source: Derived from D-08/D-09 CONTEXT.md + src/db/recurringTransactions.ts baris 28-41
// Hanya case 'monthly' yang perlu diubah — kasus lain tidak terpengaruh
// CANONICAL approach: mutation-only, no variable reassignment

export function nextDueDate(current: string, frequency: Frequency): string {
  const [y, m, d] = current.split('-').map(Number)
  const date = new Date(y, m - 1, d)         // const — stays const

  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1)
      break
    case 'weekly':
      date.setDate(date.getDate() + 7)
      break
    case 'monthly': {
      // FIX: mutation-only clamp. setDate(1) first so setMonth() cannot overflow.
      const targetMonth = date.getMonth() + 1
      date.setDate(1)
      date.setMonth(targetMonth)
      const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate()
      date.setDate(Math.min(d, lastDay))
      break
    }
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1)
      break
  }

  const ny = date.getFullYear()
  const nm = String(date.getMonth() + 1).padStart(2, '0')
  const nd = String(date.getDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}
```

### Verified: 0012_net_worth.sql (lengkap)

```sql
-- ============================================================
-- 0012_net_worth: Tabel aset, liabilitas, dan snapshot kekayaan
-- ============================================================

-- Tabel aset/akun
CREATE TABLE net_worth_accounts (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN (
               'tabungan','giro','cash','deposito',
               'dompet_digital','properti','kendaraan'
             )),
  balance    NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE net_worth_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own net worth accounts"
  ON net_worth_accounts FOR ALL
  USING  (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);

-- Tabel liabilitas
CREATE TABLE net_worth_liabilities (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN (
               'kpr','cicilan_kendaraan','kartu_kredit','paylater','kta'
             )),
  amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE net_worth_liabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own net worth liabilities"
  ON net_worth_liabilities FOR ALL
  USING  (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);

-- Tabel snapshot bulanan
CREATE TABLE net_worth_snapshots (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_month     DATE NOT NULL,   -- selalu tanggal 1 bulan bersangkutan
  total_accounts     NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_investments  NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_liabilities  NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_worth          NUMERIC(15,2) GENERATED ALWAYS AS
                       (total_accounts + total_investments - total_liabilities) STORED,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, snapshot_month)
);

ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own net worth snapshots"
  ON net_worth_snapshots FOR ALL
  USING  (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);
```

### Verified: 0013_bill_payments.sql

```sql
-- ============================================================
-- 0013_bill_payments: Tabel rekam jejak pembayaran tagihan
-- ============================================================

CREATE TABLE bill_payments (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurring_template_id BIGINT NOT NULL REFERENCES recurring_templates(id) ON DELETE CASCADE,
  paid_date             DATE NOT NULL,
  amount                NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  transaction_id        BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bill payments"
  ON bill_payments FOR ALL
  USING  (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);
```

### Verified: App.tsx Modification (minimal)

```typescript
// Source: src/App.tsx baris 28-37 (VERIFIED codebase read)
// Hanya dua perubahan: label dan Comp pada entry 'goals'

// SEBELUM:
{ value: 'goals', label: 'Goals', icon: Target, Comp: GoalsTab },

// SESUDAH:
{ value: 'goals', label: 'Finansial', icon: Target, Comp: FinansialTab },

// Juga tambahkan import di bagian atas:
// import FinansialTab from '@/tabs/FinansialTab'
// Hapus atau pertahankan import GoalsTab (masih dibutuhkan oleh FinansialTab)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| `date.setMonth(m+1)` tanpa clamp | Clamp ke last day of target month | Phase 1 fix | Fix bug month-end overflow |
| Tab "Goals" flat | Tab "Finansial" dengan sub-tab Kekayaan + Goals | Phase 1 nav | Siapkan container untuk Phase 2 |
| 11 migration files | 13 migration files (+0012, +0013) | Phase 1 DB | Infrastruktur Net Worth dan Bill Payments siap |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `is_admin()` function sudah ada di Supabase dan bisa dipakai di RLS policy baru | Standard Stack / Code Examples | **RESOLVED** — confirmed di `supabase/migrations/0006_multi_user.sql` lines 37-48 |
| A2 | PostgreSQL GENERATED ALWAYS AS STORED column didukung oleh versi Supabase yang dipakai project | Standard Stack | Column definition gagal — fallback: hitung `net_worth` di application layer |
| A3 | GoalsTab tidak menerima props dari parent (self-contained dengan internal hooks) | Common Pitfalls | **RESOLVED** — confirmed self-contained di PATTERNS.md (no props needed) |

---

## Open Questions

**All open questions resolved as of 2026-04-24.**

1. ~~**Apakah `is_admin()` function sudah ada di database?**~~ **RESOLVED (2026-04-24)**
   - **Finding:** `is_admin()` is defined in `supabase/migrations/0006_multi_user.sql` lines 37-48.
   - **Signature:** `public.is_admin() RETURNS boolean, SECURITY DEFINER, STABLE`.
   - **Behavior:** returns `true` if `auth.uid()` matches a profile row with `is_admin=true`.
   - **Decision:** Proceed with `OR is_admin()` in USING clauses of all 4 new RLS policies as specified by D-06. No fallback needed.

2. ~~**Apakah GoalsTab menerima props?**~~ **RESOLVED (2026-04-24)**
   - **Finding:** `GoalsTab` is fully self-contained — zero props from parent. Uses internal `useState` + React Query hooks only. Confirmed via codebase read and recorded in `01-PATTERNS.md` (FinansialTab section, key constraints).
   - **Decision:** Render as `<GoalsTab />` with no props. No forwarding logic needed.

---

## Environment Availability

Fase ini hanya membutuhkan tools yang sudah ada di development workflow normal — tidak ada external service baru.

| Dependency | Required By | Available | Fallback |
|------------|------------|-----------|---------|
| Supabase CLI (`supabase db push`) | Deploy migrasi SQL | Tidak diverifikasi | Manual apply via Supabase dashboard |
| Node.js / npm | TypeScript build | Assumed tersedia | — |
| shadcn/ui Tabs component | FinansialTab | ✓ (`src/components/ui/tabs.tsx`) [VERIFIED] | — |

---

## Validation Architecture

Tidak ada test framework terdeteksi di codebase (tidak ada `jest.config.*`, `vitest.config.*`, `pytest.ini`). D-10 dari CONTEXT.md secara eksplisit menyatakan: tidak perlu unit test di fase ini — verifikasi manual cukup.

Detail strategi validasi per-plan dan per-task didokumentasikan di `.planning/phases/01-foundation/01-VALIDATION.md` — satu dokumen formal yang merekam keputusan D-10 dan perintah CLI inline untuk setiap task.

### Manual Verification Checklist (pengganti automated tests)

| Req ID | Behavior | Cara Verifikasi |
|--------|----------|-----------------|
| FOUND-01 | `nextDueDate('2024-01-31', 'monthly')` = `'2024-02-29'` (bukan `'2024-03-02'`) | Jalankan inline `npx tsx -e` script di Plan 01-01 Task 1 |
| FOUND-01 | `nextDueDate('2024-03-31', 'monthly')` = `'2024-04-30'` | Sama seperti di atas |
| FOUND-02 | 4 tabel ada di DB dengan RLS aktif | Cek Supabase dashboard → Table Editor (Plan 01-02 Task 3 checkpoint) |
| FOUND-02 | Query dari user lain mengembalikan 0 baris | Test dengan dua akun berbeda (Plan 01-02 Task 3 step 4) |
| NAV-01 | Klik tab "Finansial" → sub-tab "Kekayaan" tampil pertama | Manual klik di browser (Plan 01-03 Task 3 checkpoint) |
| NAV-01 | Klik sub-tab "Goals" → konten Goals tampil normal | Manual klik di browser |
| NAV-01 | Semua tab lain (Dashboard, Transaksi, dll.) tetap berfungsi | Manual klik semua tab |

---

## Security Domain

RLS adalah satu-satunya security concern di fase ini. Tidak ada auth flow baru, tidak ada form input baru, tidak ada API endpoint baru.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Tidak | Tidak ada auth baru |
| V3 Session Management | Tidak | Tidak ada session logic baru |
| V4 Access Control | Ya | PostgreSQL RLS — `auth.uid() = user_id` |
| V5 Input Validation | Tidak | Tidak ada form input baru di fase ini |
| V6 Cryptography | Tidak | Tidak ada crypto baru |

### Threat Pattern

| Pattern | STRIDE | Mitigasi Standar |
|---------|--------|-----------------|
| Cross-user data access | Information Disclosure | RLS `auth.uid() = user_id` pada semua 4 tabel baru |
| Admin privilege escalation | Elevation of Privilege | `OR is_admin()` hanya di USING (read), tidak di WITH CHECK (write) |

---

## Sources

### Primary (HIGH confidence)
- `src/db/recurringTransactions.ts` — bug terkonfirmasi di baris 34, interface `RecurringTemplate` dibaca langsung
- `supabase/migrations/0006_multi_user.sql` lines 37-48 — `is_admin()` function definition [VERIFIED]
- `supabase/migrations/0010_recurring_transactions.sql` — canonical RLS pattern (USING only, tanpa WITH CHECK explicit)
- `supabase/migrations/0011_pension_simulations.sql` — RLS pattern dengan USING + WITH CHECK explicit
- `src/tabs/PensiunTab.tsx` — canonical sub-tab pattern (Tabs inside top-level tab)
- `src/App.tsx` baris 28-37 — TABS array, entry 'goals' dikonfirmasi
- `.planning/phases/01-foundation/01-CONTEXT.md` — semua locked decisions (D-01 s/d D-10)
- `.planning/phases/01-foundation/01-UI-SPEC.md` — FinansialTab JSX structure yang sudah diapprove

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — accumulated decisions (schema dua tabel, bill_payments Option A)
- `.planning/REQUIREMENTS.md` — requirement definitions FOUND-01, FOUND-02, NAV-01

### Tertiary (LOW confidence)
- Tidak ada

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — semua library sudah ada di codebase, diverifikasi langsung
- Architecture: HIGH — semua pattern sudah ada di codebase, diverifikasi langsung
- Pitfalls: HIGH — pitfall 1-3 diverifikasi dari source code; pitfall 4 dari PostgreSQL behavior [ASSUMED untuk edge case admin]
- SQL schema: MEDIUM — tipe kolom dan constraints mengikuti pola existing; GENERATED ALWAYS AS column belum diverifikasi terhadap versi Supabase spesifik

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 hari — stack stabil, tidak ada dependency baru)
**Revision:** 2026-04-24 — Pattern 1 canonicalized to mutation-only approach; Open Questions 1+2 resolved.
