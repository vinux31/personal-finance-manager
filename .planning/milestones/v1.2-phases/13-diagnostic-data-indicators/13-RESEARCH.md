# Phase 13: Diagnostic Data Indicators — Research

**Researched:** 2026-05-08
**Domain:** React + react-query + Supabase — client-side diagnostic compute layer di atas existing query hooks
**Confidence:** HIGH — semua temuan verified langsung dari codebase

---

<user_constraints>
## User Constraints (dari CONTEXT.md)

### Locked Decisions
- **Compute strategy:** Hybrid — extend existing hooks + `useMemo` derive. Zero schema change. Reuse cache + auto-invalidation.
- **Tier Panel UX:** `shadcn/ui Accordion` dengan `type="single" collapsible`. Single-open, klik tier baru auto-close tier lama.
- **Plan breakdown:** 4 plans, 2 waves — Wave 1: 13-01 TierPanelInfra; Wave 2 parallel: 13-02 Tier1 || 13-03 Tier2 || 13-04 Tier3.
- **File:** `src/queries/kesehatan.ts` (existing dari Phase 12) diperluas dengan `useIndikator()` + 8 compute functions.
- **shadcn Accordion:** Tidak perlu dependency baru — `radix-ui ^1.4.3` sudah terinstall dan export `Accordion` dari `@radix-ui/react-accordion`.
- **View-As:** `useIndikator()` consume `useTargetUserId()` — semua compute pakai data viewed-user.

### Claude's Discretion
- Loading skeleton style: per-IndikatorCard skeleton vs whole-tier skeleton.
- Error fallback per indikator: "—" placeholder, error message, atau hide.
- IndikatorCard visual layout: number-first vs label-first; threshold legend reveal mode (always/hover/click info icon); color treatment (badge/dot/border-left).
- Animation tuning Accordion (default radix OK).
- Real-time invalidation keys untuk `['kesehatan', ...]` — planner pilih exact keys.
- Colocate panel components di `src/tabs/kesehatan/` flat atau sub-folder `src/tabs/kesehatan/tiers/`.

### Deferred Ideas (OUT OF SCOPE)
- Indikator history chart.
- Indikator goal-setting (user set personal target).
- Threshold customization oleh user.
- Server-side compute migration ke RPC `compute_indicators`.
- Tier 4 panel functional content (Phase 14).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIAG-01 | Dana Darurat: `SUM(likuid) ÷ avg(expense 3bln)`. Threshold ≥6 hijau, 3-5 kuning, <3 merah. | Hook `useNetWorthAccounts()`, `useTransactions()` — shape verified. Akun likuid enum verified. |
| DIAG-02 | Savings Rate: `(income−expense)÷income` avg 3 bulan kalender. Threshold ≥20% hijau, 10-19% kuning, <10% merah. | Hook `useTransactions()` — `type: 'income'|'expense'`, `date: string` — calendar grouping feasible. |
| DIAG-03 | DAR Konsumtif: `SUM(liabilities WHERE type≠'kpr') ÷ aset finansial`. Threshold <20% hijau, 20-40% kuning, >40% merah. + DAR Total info. | Hook `useNetWorthLiabilities()` + `useNetWorthAccounts()` + `useInvestments()`. LiabilityType enum verified. |
| DIAG-05 | Goals on-track: % long-term goals linear on-track. Threshold ≥75% hijau, 50-74% kuning, <50% merah. Smart fallback kalau no long-term goal. | Hook `useGoals()` — field `target_date`, `current_amount`, `target_amount`, `status` verified. |
| DIAG-06 | Pensiun readiness: `proyeksi ÷ target_bulanan × 12 × usia_harapan`. Threshold ≥100% hijau, 70-99% kuning, <70% merah. Smart fallback + stale notice >6mo. | Hook `usePensionSim()` — field `target_bulanan`, `usia`, `usia_pensiun`, `updated_at` verified. Projection harus dihitung via `pensiun-calc.ts`. |
| DIAG-07 | Rasio Investasi: `(investments + deposito) ÷ aset finansial`. Threshold ≥40% hijau, 20-39% kuning, <20% merah. | Hook `useInvestments()` + `useNetWorthAccounts()`. `currentValue(inv)` helper sudah ada. |
| DIAG-08 | Diversifikasi: `COUNT(DISTINCT asset_type) + (1 if deposito>0)`. Threshold ≥3 hijau, 2 kuning, ≤1 merah. | Hook `useInvestments()` — `asset_type: string` TEXT bebas. `useNetWorthAccounts()` untuk deposito. |
| DIAG-10 | Edge case data tipis — <3 bulan kalender berbeda → placeholder "Butuh 3 bulan data, sudah X/3". Placeholder tidak ikut agregasi warna. | `useTransactions()` data sudah ada — calendar month grouping via `date.substring(0,7)`. |
| STRAT-03 | Tier expand panel inline (Accordion) + indikator hidup + CTA mapping + link modul. | PiramidaShell.tsx structure verified. Accordion import pattern verified. |
</phase_requirements>

---

## Summary

Phase 13 membangun compute layer diagnostik di atas existing Supabase query hooks yang sudah View-As-aware. Semua data yang dibutuhkan tersedia dari hooks existing — tidak ada schema change, tidak ada endpoint baru. Core challenge adalah: (1) transformasi client-side dari raw transaction list jadi 3-month calendar aggregates, (2) derivation pension projection via `pensiun-calc.ts` yang sudah ada tapi belum pernah di-call dari `kesehatan.ts`, dan (3) mitigasi file conflict untuk 3 plan paralel di Wave 2 yang semuanya akan menulis ke `src/queries/kesehatan.ts`.

**Primary recommendation:** Gunakan per-tier file split (`kesehatanTier1.ts`, `kesehatanTier2.ts`, `kesehatanTier3.ts`) re-exported dari `kesehatan.ts` untuk menghilangkan Wave 2 conflict. File `src/queries/kesehatan.ts` hanya mengeksport — tidak menerima diff dari 3 plan paralel.

**Tidak ada dependency baru yang perlu diinstall.** `radix-ui ^1.4.3` sudah terinstall dan mengekspos `Accordion` (verified dari `node_modules/radix-ui/dist/index.d.ts`: `export { reactAccordion as Accordion }`). Pattern import accordion: `import { Accordion } from "radix-ui"` — konsisten dengan `Dialog`, `Progress`, `Select`, dll. di codebase.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Compute 8 indikator | Client (hook/useMemo) | — | Zero schema change, data sudah di cache react-query |
| Tier color aggregation | Client (pure function) | — | Derive dari compute result, no server needed |
| Accordion panel UX | Frontend component | — | Pure UI interaction, no backend |
| View-As data scoping | Hook layer (useTargetUserId) | — | Pattern sudah ada di semua hooks existing |
| Protection checklist read (DIAG-04 shell) | Client (Supabase query) | — | Tabel `protection_checklist` sudah ada dari Phase 12 |
| Mutation cache invalidation | react-query (onSuccess) | — | Extend existing mutations bukan buat baru |

---

## Existing Query Hooks — Shapes yang Relevan

### 1. `useTransactions(filters?: TransactionFilters)` — `src/queries/transactions.ts`

**Import:** `from '@/queries/transactions'`
**View-As:** sudah via `useTargetUserId()` internal

```ts
// Return shape
{
  data: Transaction[],  // [] jika loading
  total: number,
  isLoading: boolean,
  isError: boolean,
  // ...rest useQuery
}

// Transaction fields yang dipakai Phase 13
interface Transaction {
  id: number
  date: string           // 'YYYY-MM-DD'
  type: 'income' | 'expense'
  category_id: number
  category_name: string
  amount: number
  note: string | null
}
```

**Untuk DIAG-01, DIAG-02, DIAG-10:** Panggil tanpa filter (ambil all) — untuk 3-month calendar averaging.
**Pitfall:** Default `useTransactions()` tanpa filter tidak ada server-side limit (CONCERNS.md mendeteksi ini sebagai L-04). Untuk user tipikal (<500 tx) fine. Alternatif: pass `filters: { dateFrom: threeMonthsAgo }`.

**Rekomendasi:** Panggil `useTransactions({ dateFrom: ninetyDaysISOStr })` untuk DIAG-01/02 agar batas data fetch jelas, bukan ambil semua transaksi sejak awal zaman.

### 2. `useNetWorthAccounts()` — `src/queries/netWorth.ts`

**Import:** `from '@/queries/netWorth'`
**View-As:** sudah via `useTargetUserId()`

```ts
// Return shape (useQuery standard)
{
  data: NetWorthAccount[] | undefined,
  isLoading: boolean,
  // ...
}

interface NetWorthAccount {
  id: number
  user_id: string
  name: string
  type: AccountType   // enum verified (lihat Schema Reference)
  balance: number     // NUMERIC(15,2) dari DB — JS number, bukan string
  created_at: string
}
```

**Untuk DIAG-01:** Filter `type IN ('tabungan','giro','cash','dompet_digital')` client-side.
**Untuk DIAG-03, DIAG-07:** Aset finansial = likuid + deposito + investasi.
**Untuk DIAG-08:** `accounts.some(a => a.type === 'deposito' && a.balance > 0)`.

### 3. `useNetWorthLiabilities()` — `src/queries/netWorth.ts`

```ts
{
  data: NetWorthLiability[] | undefined,
  isLoading: boolean,
}

interface NetWorthLiability {
  id: number
  user_id: string
  name: string
  type: LiabilityType  // enum verified (lihat Schema Reference)
  amount: number       // NUMERIC(15,2)
  created_at: string
}
```

**Untuk DIAG-03:** Filter `type !== 'kpr'` untuk liabilitas konsumtif.
**Untuk DAR Total info:** SUM semua liabilitas.

### 4. `useGoals(filters?: GoalFilters)` — `src/queries/goals.ts`

```ts
{
  data: Goal[] | undefined,
  isLoading: boolean,
}

interface Goal {
  id: number
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null  // 'YYYY-MM-DD' atau null kalau no deadline
  status: GoalStatus          // 'active' | 'completed' | 'paused'
}
```

**PENTING:** `Goal` tidak punya `created_at` atau `start_date` di return shape dari `listGoals()`. Kolom DB mungkin ada tapi tidak di-select. Untuk `time_elapsed` calculation di DIAG-05 kita tidak bisa pakai `created_at`. **Solusi:** Gunakan `target_date` saja — linear progress = `current_amount / target_amount >= time_elapsed / total_duration`. Total duration bisa di-proxy ke `target_date - created_at`, tapi karena `created_at` tidak ada, pendekatan alternatif:

**Pendekatan yang feasible:** Karena `created_at` tidak tersedia, gunakan pendekatan sederhana: goal dianggap "on-track" kalau `current_amount / target_amount >= elapsed_fraction` di mana `elapsed_fraction` dihitung dari "sekarang vs target_date, asumsi start = 1 tahun sebelum target_date jika tidak ada data start". Atau lebih praktis: bandingkan progres saja — goal on-track kalau progress >= 25% dari target (minimal ada effort).

**Pilihan rekomendasi (planner decide):** Gunakan progres absolut sebagai proxy — goal "on-track" kalau `current_amount / target_amount` melewati threshold proporsional terhadap waktu tersisa. Formula: `timeToTarget = daysBetween(now, target_date)`, `totalDuration = 365 (1 tahun minimal)`, `elapsed = 365 - timeToTarget`. Kalau `elapsed < 0` artinya goal punya > 1 tahun — bandingkan dengan asumsi mulai sekarang.

**Atau tambah `created_at` ke select:** Modifikasi `listGoals()` query untuk include `created_at`. Ini aman (backward-compat, hanya tambah field) dan memberikan data akurat untuk time_elapsed. **Recommended path** — tambah `created_at` ke `Goal` interface dan `listGoals()` select.

### 5. `useInvestments(filters?: InvestmentFilters)` — `src/queries/investments.ts`

```ts
{
  data: Investment[] | undefined,
  isLoading: boolean,
}

interface Investment {
  id: number
  asset_type: string        // TEXT bebas (Risk 5 — user-controlled string)
  asset_name: string
  quantity: number
  buy_price: number
  current_price: number | null
  buy_date: string
  note: string | null
  gold_source: GoldSource | null
}
```

**Helper `currentValue(inv: Investment): number`** sudah ada di `src/db/investments.ts`:
```ts
export function currentValue(inv: Investment): number {
  const price = inv.current_price ?? inv.buy_price
  return inv.quantity * price
}
```

**Untuk DIAG-07:** `investments.reduce((sum, inv) => sum + currentValue(inv), 0)` — sudah di-export dari `src/queries/investments.ts`.
**Untuk DIAG-08:** `new Set(investments.map(i => i.asset_type)).size`.
**Filter aktif:** `listInvestments()` sudah pakai `.gt('quantity', 0)` — data yang dikembalikan hanya active positions.

### 6. `usePensionSim()` — `src/queries/pensiun.ts`

```ts
{
  data: PensionSimRow | null | undefined,
  isLoading: boolean,
}

interface PensionSimRow {
  id: string
  user_id: string
  updated_at: string    // ISO timestamp — dipakai untuk stale notice >6 bulan
  created_at: string
  usia: number
  usia_pensiun: number
  target_bulanan: number  // BIGINT — target pengeluaran bulanan saat pensiun
  // ... 40+ fields lainnya (simulasi DCA + hitung total sources)
}
```

**Untuk DIAG-06:** Proyeksi total perlu dihitung via `pensiun-calc.ts`. Formula spec: `proyeksi ÷ (target_bulanan × 12 × usia_harapan)`.

**Penting:** Proyeksi BUKAN field di DB — ini adalah computed value dari `pensiun-calc.ts` functions (`calcBPJS`, `calcDPPK`, `calcInvestasiMandiri`, dll.). Logic sudah ada di `HitungTotalPanel.tsx` — Phase 13 perlu extract/reuse logic tersebut.

**`totalLumpSum` dari `HitungTotalPanel.tsx`:**
```ts
// Pattern yang sudah ada (HitungTotalPanel.tsx line 50-59)
const totalLumpSum = useMemo(() => {
  let t = 0
  if (sumber.bpjs) t += sumber.bpjs.jht + sumber.bpjs.jpBulanan * 12 * 20
  if (sumber.dppk) t += sumber.dppk.total
  if (sumber.dplk) t += sumber.dplk.total
  if (sumber.taspen) t += sumber.taspen.tht + sumber.taspen.bulanan * 12 * 20
  if (sumber.pesangon) t += sumber.pesangon.total
  if (sumber.invest) t += sumber.invest.total
  return t
}, [sumber])
```

**Usia harapan hidup:** Spec menyebutkan `usia_harapan` tapi tidak ada field ini di `pension_simulations`. Asumsi standar: gunakan 75 tahun (usia harapan hidup Indonesia ~73-75 tahun) atau `usia_pensiun + 20`. Planner harus resolve ini — `[ASSUMED]`.

**Stale notice:** `updated_at` ada di `PensionSimRow`. Check: `daysBetween(now, sim.updated_at) > 180`.

---

## Schema Reference

### `net_worth_accounts.type` — AccountType enum

**Verified dari:** `src/db/netWorth.ts` + `supabase/migrations/0012_net_worth.sql`

```ts
type AccountType =
  | 'tabungan'        // akun likuid
  | 'giro'            // akun likuid
  | 'cash'            // akun likuid
  | 'deposito'        // BUKAN likuid, tapi masuk "aset finansial"
  | 'dompet_digital'  // akun likuid
  | 'properti'        // EXCLUDE dari semua rasio finansial
  | 'kendaraan'       // EXCLUDE dari semua rasio finansial
```

**Akun likuid** (DIAG-01 dana darurat, denominator rasio):
```ts
const LIQUID_TYPES: AccountType[] = ['tabungan', 'giro', 'cash', 'dompet_digital']
```

**Aset finansial** (DIAG-03, DIAG-07 denominator):
```ts
const FINANCIAL_TYPES: AccountType[] = ['tabungan', 'giro', 'cash', 'dompet_digital', 'deposito']
// EXCLUDE: 'properti', 'kendaraan'
```

**Deposito** (DIAG-07 numerator, DIAG-08 bonus count):
```ts
const DEPOSITO_TYPES: AccountType[] = ['deposito']
```

### `net_worth_liabilities.type` — LiabilityType enum

**Verified dari:** `src/db/netWorth.ts` + `supabase/migrations/0012_net_worth.sql`

```ts
type LiabilityType =
  | 'kpr'                 // EXCLUDE dari DAR Konsumtif (housing debt)
  | 'cicilan_kendaraan'   // masuk DAR Konsumtif
  | 'kartu_kredit'        // masuk DAR Konsumtif
  | 'paylater'            // masuk DAR Konsumtif
  | 'kta'                 // masuk DAR Konsumtif
```

### `goals` table fields yang tersedia

**Verified dari:** `src/db/goals.ts` `listGoals()` SELECT

Fields yang di-select saat ini:
```
id, name, target_amount, current_amount, target_date, status
```

**`created_at` TIDAK di-select** saat ini. Untuk DIAG-05 `time_elapsed`, planner harus memutuskan:
- **Option A (rekomendasi):** Extend `listGoals()` tambah `created_at` ke SELECT + `Goal` interface. Simple, backward-compat.
- **Option B:** Proxy duration dari `target_date` saja (asumsikan goal baru dibuat, total duration dari sekarang ke target).

**Long-term goal filter:** `target_date > (today + 365 days) AND status = 'active'`

### `investments.asset_type` — TEXT bebas

**Verified dari:** `src/db/investments.ts` — field type `string`, bukan enum.

Risk 5 dari spec: user bisa ketik "Saham BBCA" dan "Saham BCA" sebagai 2 distinct types → false diversification count. Untuk v1.2: trust user input, `COUNT(DISTINCT asset_type)`.

**DIAG-08 compute:**
```ts
const distinctTypes = new Set(investments.map(i => i.asset_type)).size
const hasDeposito = accounts.some(a => a.type === 'deposito' && a.balance > 0)
const diversScore = distinctTypes + (hasDeposito ? 1 : 0)
```

### `pension_simulations` table

**Verified dari:** `supabase/migrations/0011_pension_simulations.sql` + `src/db/pensiun.ts`

Fields relevan untuk DIAG-06:
- `target_bulanan BIGINT` — target pengeluaran bulanan saat pensiun
- `usia INT` — usia saat ini
- `usia_pensiun INT` — target usia pensiun
- `updated_at TIMESTAMPTZ` — untuk stale notice
- Semua `ht_*` fields — untuk menghitung proyeksi lump sum via `pensiun-calc.ts`

RLS: `auth.uid() = user_id` (tanpa `OR is_admin()` — berbeda dari tabel lain!). Admin View-As **tidak** bisa baca pension_simulations user lain via RLS policy ini.

**BLOCKER untuk View-As + Pensiun:** RLS `pension_simulations` hanya `auth.uid() = user_id` tanpa `is_admin()` fallback. Admin yang View-As user lain akan dapat 0 rows untuk `usePensionSim()`. `useTargetUserId()` return viewed-user UID, tapi RLS menolak karena `auth.uid() != user_id`. Hasil: `usePensionSim()` return `null` → DIAG-06 show smart fallback CTA (acceptable behavior untuk admin View-As).

### `protection_checklist` table

**Verified dari:** `supabase/migrations/0029_protection_checklist.sql`

```ts
interface ProtectionChecklist {
  user_id: string           // PRIMARY KEY
  health_coverage: 'kantor' | 'bpjs' | 'pribadi' | 'kombinasi' | 'tidak' | null
  has_dependents: boolean | null
  life_coverage: 'kantor' | 'pribadi' | 'keduanya' | 'tidak' | null
  life_coverage_sufficient: boolean | null
  life_coverage_post_employment: 'ya' | 'tidak' | 'tidak_yakin' | null
  estate_heirs_documented: boolean | null
  estate_assets_documented: boolean | null
  estate_will_exists: boolean | null
  updated_at: string
  created_at: string
}
```

RLS: `auth.uid() = user_id OR is_admin()` (WITH CHECK auth.uid() = user_id). Admin dapat baca untuk View-As.

**DIAG-04 shell (Phase 13 scope):** Read `health_coverage` dari `protection_checklist`. Row mungkin tidak ada (lazy-create di Phase 14). `maybeSingle()` return null → tampil sebagai "belum diisi" placeholder (merah per spec — sama seperti 'tidak').

---

## Compute Function Skeletons

### Definisi Helper Konstanta

```ts
// src/queries/kesehatanTier1.ts (atau kesehatan.ts)
const LIQUID_TYPES = ['tabungan', 'giro', 'cash', 'dompet_digital'] as const
const FINANCIAL_TYPES = ['tabungan', 'giro', 'cash', 'dompet_digital', 'deposito'] as const
const KONSUMTIF_LIAB_TYPES = ['cicilan_kendaraan', 'kartu_kredit', 'paylater', 'kta'] as const

// Threshold constants (per spec — expose sebagai konstanta, gampang tune)
export const THRESHOLDS = {
  danaDarurat: { green: 6, yellow: 3 },          // bulan
  savingsRate: { green: 20, yellow: 10 },          // persen
  darKonsumtif: { green: 20, yellow: 40 },         // persen (inverted: <20 hijau)
  goalsOnTrack: { green: 75, yellow: 50 },         // persen goals on-track
  pensiun: { green: 100, yellow: 70 },             // persen kesiapan
  rasioInvestasi: { green: 40, yellow: 20 },       // persen
  diversifikasi: { green: 3, yellow: 2 },          // jumlah distinct asset class
} as const
```

### IndikatorResult type (dari CONTEXT.md)

```ts
export type IndikatorColor = 'green' | 'yellow' | 'red'

export type IndikatorResult =
  | { kind: 'compute'; value: number; color: IndikatorColor; display: string }
  | { kind: 'placeholder-data-tipis'; monthsAvailable: number; ctaTo: string }
  | { kind: 'cta-fallback'; message: string; ctaLabel: string; ctaTo: string }
```

### #1 computeDanaDarurat (DIAG-01)

```ts
// Data sources: NetWorthAccount[], Transaction[]
function computeDanaDarurat(
  accounts: NetWorthAccount[],
  transactions: Transaction[],
): IndikatorResult {
  // 1. Cek distinct calendar months
  const months = new Set(
    transactions
      .filter(t => t.type === 'expense')
      .map(t => t.date.substring(0, 7))  // 'YYYY-MM'
  )
  if (months.size < 3) {
    return { kind: 'placeholder-data-tipis', monthsAvailable: months.size, ctaTo: '/transaksi' }
  }

  // 2. Hitung avg expense 3 bulan kalender terakhir
  const sortedMonths = [...months].sort().slice(-3)
  const recentExpenses = transactions.filter(
    t => t.type === 'expense' && sortedMonths.includes(t.date.substring(0, 7))
  )
  const totalExpense3mo = recentExpenses.reduce((s, t) => s + t.amount, 0)
  const avgExpenseBulanan = totalExpense3mo / 3

  if (avgExpenseBulanan === 0) {
    return { kind: 'placeholder-data-tipis', monthsAvailable: months.size, ctaTo: '/transaksi' }
  }

  // 3. SUM akun likuid
  const totalLikuid = accounts
    .filter(a => LIQUID_TYPES.includes(a.type as typeof LIQUID_TYPES[number]))
    .reduce((s, a) => s + a.balance, 0)

  const bulan = totalLikuid / avgExpenseBulanan
  const color: IndikatorColor =
    bulan >= THRESHOLDS.danaDarurat.green ? 'green' :
    bulan >= THRESHOLDS.danaDarurat.yellow ? 'yellow' : 'red'

  return {
    kind: 'compute',
    value: bulan,
    color,
    display: `${bulan.toFixed(1)} bulan`,
  }
}
```

### #2 computeSavingsRate (DIAG-02)

```ts
function computeSavingsRate(transactions: Transaction[]): IndikatorResult {
  const months = new Set(transactions.map(t => t.date.substring(0, 7)))
  if (months.size < 3) {
    return { kind: 'placeholder-data-tipis', monthsAvailable: months.size, ctaTo: '/transaksi' }
  }

  const sortedMonths = [...months].sort().slice(-3)
  const recent = transactions.filter(t => sortedMonths.includes(t.date.substring(0, 7)))

  // Per-bulan savings rate, lalu average
  const rates = sortedMonths.map(m => {
    const mTx = recent.filter(t => t.date.startsWith(m))
    const income = mTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = mTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return income > 0 ? (income - expense) / income : 0
  })

  const avgRate = rates.reduce((s, r) => s + r, 0) / rates.length
  const pct = avgRate * 100
  const color: IndikatorColor =
    pct >= THRESHOLDS.savingsRate.green ? 'green' :
    pct >= THRESHOLDS.savingsRate.yellow ? 'yellow' : 'red'

  return { kind: 'compute', value: pct, color, display: `${pct.toFixed(0)}%` }
}
```

### #3 computeDARKonsumtif (DIAG-03) + computeDARTotal

```ts
function computeDARKonsumtif(
  accounts: NetWorthAccount[],
  liabilities: NetWorthLiability[],
  investments: Investment[],
): IndikatorResult {
  const asetFinansial =
    accounts.filter(a => FINANCIAL_TYPES.includes(a.type as any)).reduce((s, a) => s + a.balance, 0) +
    investments.reduce((s, inv) => s + currentValue(inv), 0)

  if (asetFinansial === 0) {
    return { kind: 'compute', value: 0, color: 'gray' as any, display: '—' }
  }

  const konsumtif = liabilities
    .filter(l => KONSUMTIF_LIAB_TYPES.includes(l.type as any))
    .reduce((s, l) => s + l.amount, 0)

  const pct = (konsumtif / asetFinansial) * 100
  const color: IndikatorColor =
    pct < THRESHOLDS.darKonsumtif.green ? 'green' :
    pct <= THRESHOLDS.darKonsumtif.yellow ? 'yellow' : 'red'

  return { kind: 'compute', value: pct, color, display: `${pct.toFixed(0)}%` }
}

// DAR Total — info-only, bukan indikator warna
function computeDARTotal(
  accounts: NetWorthAccount[],
  liabilities: NetWorthLiability[],
  investments: Investment[],
): { value: number; display: string; kprFraction: number } | null {
  const asetFinansial =
    accounts.filter(a => FINANCIAL_TYPES.includes(a.type as any)).reduce((s, a) => s + a.balance, 0) +
    investments.reduce((s, inv) => s + currentValue(inv), 0)
  if (asetFinansial === 0) return null
  const total = liabilities.reduce((s, l) => s + l.amount, 0)
  const kpr = liabilities.filter(l => l.type === 'kpr').reduce((s, l) => s + l.amount, 0)
  return {
    value: (total / asetFinansial) * 100,
    display: `${((total / asetFinansial) * 100).toFixed(0)}%`,
    kprFraction: total > 0 ? kpr / total : 0,
  }
}
```

### #5 computeGoalsOnTrack (DIAG-05)

```ts
// CATATAN: Goal interface perlu created_at (lihat Schema Reference — Option A: extend listGoals)
function computeGoalsOnTrack(goals: Goal[]): IndikatorResult {
  const now = new Date()
  const oneYearFromNow = new Date(now)
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)

  const longTerm = goals.filter(g =>
    g.status === 'active' &&
    g.target_date !== null &&
    new Date(g.target_date) > oneYearFromNow
  )

  if (longTerm.length === 0) {
    return {
      kind: 'cta-fallback',
      message: 'Belum punya tujuan jangka panjang',
      ctaLabel: 'Buat Goals →',
      ctaTo: '/goals',
    }
  }

  // On-track: current/target >= time_elapsed/total_duration
  // Butuh created_at untuk total_duration akurat
  // Fallback tanpa created_at: asumsikan mulai 1 Jan tahun ini jika created_at tidak ada
  const onTrack = longTerm.filter(g => {
    const start = (g as any).created_at ? new Date((g as any).created_at) : new Date(now.getFullYear(), 0, 1)
    const end = new Date(g.target_date!)
    const totalMs = end.getTime() - start.getTime()
    const elapsedMs = now.getTime() - start.getTime()
    if (totalMs <= 0) return true
    const timeElapsedFrac = Math.min(1, elapsedMs / totalMs)
    const progressFrac = g.target_amount > 0 ? g.current_amount / g.target_amount : 0
    return progressFrac >= timeElapsedFrac
  })

  const pct = (onTrack.length / longTerm.length) * 100
  const color: IndikatorColor =
    pct >= THRESHOLDS.goalsOnTrack.green ? 'green' :
    pct >= THRESHOLDS.goalsOnTrack.yellow ? 'yellow' : 'red'

  return {
    kind: 'compute',
    value: pct,
    color,
    display: `${onTrack.length}/${longTerm.length} on-track`,
  }
}
```

### #6 computePensiun (DIAG-06)

```ts
// Import dari src/lib/pensiun-calc.ts
import { calcBPJS, calcDPPK, calcDPLK, calcTaspen, calcPesangon, calcInvestasiMandiri } from '@/lib/pensiun-calc'

function computePensiun(sim: PensionSimRow | null | undefined): IndikatorResult {
  if (!sim) {
    return {
      kind: 'cta-fallback',
      message: 'Belum simulasi pensiun',
      ctaLabel: 'Hitung di sini →',
      ctaTo: '/pensiun',
    }
  }

  // Stale check
  const monthsStale = (Date.now() - new Date(sim.updated_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
  const isStale = monthsStale > 6

  // Hitung proyeksi total (reuse HitungTotalPanel logic)
  const masaKerja = sim.masa_kerja
  let totalLumpSum = 0
  if (sim.ht_en_bpjs) {
    const r = calcBPJS({ upahBulanan: sim.ht_bpjs_upah || sim.gaji_pokok, masaKerja })
    totalLumpSum += r.jht + r.jpBulanan * 12 * 20
  }
  if (sim.ht_en_dppk) {
    const r = calcDPPK({ type: sim.ht_dppk_type as 'ppmp'|'ppip', phdp: sim.ht_dppk_phdp, faktor: sim.ht_dppk_faktor, iuranBulanan: sim.ht_dppk_iuran, masaKerja })
    totalLumpSum += r.total
  }
  // ... (kalau ht_en_dplk, taspen, pesangon, invest — sama)
  if (sim.ht_en_invest) {
    const r = calcInvestasiMandiri({ iuranBulanan: sim.ht_inv_bulanan, returnPct: sim.ht_inv_return, saldoAwal: sim.ht_inv_saldo, kenaikanPct: sim.ht_inv_kenaikan, masaKerja })
    totalLumpSum += r.total
  }

  // Usia harapan: ASSUMED 75 tahun, atau usia_pensiun + 20
  // [ASSUMED] — tidak ada field usia_harapan di DB; planner perlu resolve
  const usiaHarapan = 75
  const yearsPensiun = Math.max(1, usiaHarapan - sim.usia_pensiun)
  const targetTotal = sim.target_bulanan * 12 * yearsPensiun

  const ratio = targetTotal > 0 ? (totalLumpSum / targetTotal) * 100 : 0
  const color: IndikatorColor =
    ratio >= THRESHOLDS.pensiun.green ? 'green' :
    ratio >= THRESHOLDS.pensiun.yellow ? 'yellow' : 'red'

  return {
    kind: 'compute',
    value: ratio,
    color,
    display: `${ratio.toFixed(0)}%`,
    // isStale exposed via compute variant extension atau separate field
    ...(isStale && { staleMonths: Math.floor(monthsStale) }),
  }
}
```

**CATATAN:** `IndikatorResult` compute variant mungkin perlu extend dengan optional `staleMonths?: number` untuk stale pension notice. Planner tentukan apakah tambah field ke type atau handle di component layer.

### #7 computeRasioInvestasi (DIAG-07)

```ts
function computeRasioInvestasi(
  accounts: NetWorthAccount[],
  investments: Investment[],
): IndikatorResult {
  const asetFinansial =
    accounts.filter(a => FINANCIAL_TYPES.includes(a.type as any)).reduce((s, a) => s + a.balance, 0) +
    investments.reduce((s, inv) => s + currentValue(inv), 0)

  if (asetFinansial === 0) {
    return { kind: 'compute', value: 0, color: 'red', display: '0%' }
  }

  const deposito = accounts.filter(a => a.type === 'deposito').reduce((s, a) => s + a.balance, 0)
  const invValue = investments.reduce((s, inv) => s + currentValue(inv), 0)
  const numerator = invValue + deposito

  const pct = (numerator / asetFinansial) * 100
  const color: IndikatorColor =
    pct >= THRESHOLDS.rasioInvestasi.green ? 'green' :
    pct >= THRESHOLDS.rasioInvestasi.yellow ? 'yellow' : 'red'

  return { kind: 'compute', value: pct, color, display: `${pct.toFixed(0)}%` }
}
```

### #8 computeDiversifikasi (DIAG-08)

```ts
function computeDiversifikasi(
  investments: Investment[],
  accounts: NetWorthAccount[],
): IndikatorResult {
  const distinctTypes = new Set(
    investments.filter(inv => currentValue(inv) > 0).map(i => i.asset_type)
  ).size
  const hasDeposito = accounts.some(a => a.type === 'deposito' && a.balance > 0)
  const score = distinctTypes + (hasDeposito ? 1 : 0)

  const color: IndikatorColor =
    score >= THRESHOLDS.diversifikasi.green ? 'green' :
    score >= THRESHOLDS.diversifikasi.yellow ? 'yellow' : 'red'

  return {
    kind: 'compute',
    value: score,
    color,
    display: `${score} kelas aset`,
  }
}
```

---

## Tier Color Aggregation Logic

```ts
// Dari CONTEXT.md — exact signature locked
function aggregateTierColor(
  indicators: IndikatorResult[]
): 'green' | 'yellow' | 'red' | 'gray' {
  const computed = indicators.filter(i => i.kind === 'compute') as Extract<IndikatorResult, { kind: 'compute' }>[]
  if (computed.length === 0) return 'gray'
  if (computed.some(i => i.color === 'red')) return 'red'
  if (computed.some(i => i.color === 'yellow')) return 'yellow'
  return 'green'
}

// Badge sekunder — count placeholder/fallback untuk info badge
function countNonComputed(indicators: IndikatorResult[]): number {
  return indicators.filter(i => i.kind !== 'compute').length
}
```

**Color CSS mapping** (dari spec §8 — Warna):
```ts
const TIER_COLOR_CLASS: Record<'green' | 'yellow' | 'red' | 'gray', string> = {
  green: 'bg-green-500 text-white',
  yellow: 'bg-amber-500 text-white',
  red: 'bg-red-500 text-white',
  gray: 'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200',
}
```

---

## shadcn Accordion Setup

### Dependency Status

**VERIFIED:** `radix-ui ^1.4.3` sudah di `package.json` dependencies dan sudah terinstall di `node_modules`. Package `radix-ui` adalah umbrella yang include `@radix-ui/react-accordion` (verified dari `node_modules/radix-ui/dist/index.d.ts`):

```ts
import * as reactAccordion from '@radix-ui/react-accordion';
export { reactAccordion as Accordion };
```

**Tidak perlu install package apapun.** Tidak perlu `npm install`.

### Import Pattern (konsisten dengan codebase)

```ts
import { Accordion } from "radix-ui"
// Kemudian akses via Accordion.Root, Accordion.Item, Accordion.Trigger, Accordion.Content
```

Semua komponen shadcn existing menggunakan pattern yang sama: `import { Dialog as DialogPrimitive } from "radix-ui"`.

### File Template: `src/components/ui/accordion.tsx`

```tsx
"use client"

import * as React from "react"
import { Accordion as AccordionPrimitive } from "radix-ui"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Accordion({
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "flex flex-1 items-center justify-between py-4 text-left text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm"
      {...props}
    >
      <div className={cn("pb-4 pt-0", className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }
```

**Catatan animasi:** `animate-accordion-up` dan `animate-accordion-down` adalah utility dari `tw-animate-css` yang sudah ada di dependencies (`"tw-animate-css": "^1.4.0"`). Verify apakah sudah dikonfigurasi di `tailwind.config.ts` atau `src/index.css`.

**Penggunaan di PiramidaShell (setelah refactor ke Accordion):**
```tsx
// Tier dirender dari bawah ke atas (Tier 1 terbawah di piramida = bottom of page)
// Tapi render order di HTML tetap dari atas: Tier 4 → Tier 1
// Phase 13 scope: wrapper Accordion di KesehatanLanding, PiramidaShell jadi AccordionTrigger
<Accordion type="single" collapsible value={openTier} onValueChange={setOpenTier}>
  {[4, 3, 2, 1].map(tierId => (
    <AccordionItem key={tierId} value={`tier-${tierId}`}>
      <AccordionTrigger asChild>
        {/* trapezoid button dari PiramidaShell — no chevron icon (ganti dengan custom) */}
      </AccordionTrigger>
      <AccordionContent>
        <TierPanel tier={tierId} indicators={indicators} />
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

---

## View-As Pattern Reference

### Pattern Hook

```ts
// src/auth/useTargetUserId.ts — sudah ada, tidak perlu diubah
export function useTargetUserId(): string | undefined {
  const { user } = useAuthContext()
  const { viewingAs } = useViewAsContext()
  return viewingAs?.uid ?? user?.id
}
```

**Bagaimana hooks existing sudah View-As-aware:**
- `useTransactions()` → `const uid = useTargetUserId()` → `queryKey: ['transactions', filters, uid]` → `queryFn: () => listTransactions(filters, uid)` → Supabase `.eq('user_id', uid)`.
- `useNetWorthAccounts()`, `useNetWorthLiabilities()` → sama persis.
- `useGoals()` → `const uid = useTargetUserId()` → `listGoals(filters, uid)`.
- `useInvestments()` → sama.
- `usePensionSim()` → sama, tapi RLS pension_simulations tidak punya `OR is_admin()` → admin View-As akan dapat null.

**`useIndikator()` tidak perlu logic View-As tambahan** — cukup compose dari hooks yang sudah View-As-aware. Query key sudah include `uid` dari masing-masing hook.

**KekayaanTab pattern untuk skip side-effects saat View-As:**
```ts
const { viewingAs } = useViewAs()
// Skip snapshot insert saat View-As
if (viewingAs !== null) return
```

---

## Mutation Invalidation Strategy

### Query Keys di Codebase Saat Ini

| Query | Key Pattern |
|-------|-------------|
| transactions | `['transactions', filters, uid]` |
| net-worth-accounts | `['net-worth-accounts', uid]` |
| net-worth-liabilities | `['net-worth-liabilities', uid]` |
| goals | `['goals', uid, filters]` |
| goals-with-progress | `['goals-with-progress', uid, filters]` |
| investments | `['investments', uid, filters]` |
| pension-sim | `['pension-sim', uid]` |
| kesehatan (existing) | `['kesehatan', 'totalDataCount', targetUid]` |

### Strategy untuk `useIndikator()`

Karena `useIndikator()` adalah **derived via `useMemo`** dari hooks existing (bukan `useQuery` baru), tidak ada query key baru yang perlu diinvalidasi. Ketika:
- User tambah transaksi → `['transactions', ...]` invalidated → `useTransactions()` refetch → `useMemo` re-derive → `useIndikator()` update otomatis.
- User update net worth account → `['net-worth-accounts', ...]` invalidated → auto-propagate.

**Tidak perlu menambah invalidation keys** di existing mutations untuk basic flow.

**Exception:** Jika Phase 13 menambah `useQuery` baru di `kesehatan.ts` (misalnya untuk `protection_checklist`), maka mutations di Phase 14 perlu invalidate key tersebut. Contoh:

```ts
// Di useProtectionChecklist mutation (Phase 14):
qc.invalidateQueries({ queryKey: ['kesehatan', 'protection-checklist', uid] })
```

**Recommendation untuk Phase 13:** Gunakan key pattern `['kesehatan', 'protection-checklist', targetUid]` untuk konsistensi dengan `useTotalDataCount` yang sudah pakai prefix `['kesehatan', ...]`.

---

## Wave 2 File Conflict Mitigation

### Problem

3 plan paralel di Wave 2 (13-02, 13-03, 13-04) semua perlu menulis ke `src/queries/kesehatan.ts` (tambah compute functions). Jika ketiganya menulis ke file yang sama, merge conflict dijamin.

### Rekomendasi: Per-Tier File Split (Option A dari CONTEXT.md)

```
src/queries/
├── kesehatan.ts           # existing — HANYA export re-export + useTotalDataCount (tidak disentuh Wave 2)
├── kesehatanTier1.ts      # 13-02 owns this (computeDanaDarurat, computeSavingsRate, computeDARKonsumtif, computeDARTotal, computeAsuransiShell)
├── kesehatanTier2.ts      # 13-03 owns this (computeGoalsOnTrack, computePensiun)
└── kesehatanTier3.ts      # 13-04 owns this (computeRasioInvestasi, computeDiversifikasi)
```

**`kesehatan.ts` setelah Wave 1 (13-01 modifikasi):**
```ts
// Wave 1 (13-01) menambah ini ke kesehatan.ts:
export { useTotalDataCount, EMPTY_STATE_THRESHOLD } from './kesehatan'  // existing tetap
export { useIndikator, aggregateTierColor, type IndikatorResult, type IndikatorColor, THRESHOLDS } from './kesehatanIndikator'
// useIndikator.ts adalah file baru Wave 1 yang import dari kesehatanTier1/2/3
```

**Struktur lengkap yang disarankan:**
```
src/queries/
├── kesehatan.ts              # existing (Phase 12) — useTotalDataCount, EMPTY_STATE_THRESHOLD
├── kesehatanTypes.ts         # 13-01 buat — IndikatorResult type, THRESHOLDS constants
├── kesehatanIndikator.ts     # 13-01 buat — useIndikator() skeleton + aggregateTierColor
├── kesehatanTier1.ts         # 13-02 buat — 5 compute functions Tier 1
├── kesehatanTier2.ts         # 13-03 buat — 2 compute functions Tier 2
└── kesehatanTier3.ts         # 13-04 buat — 2 compute functions Tier 3
```

**Wave 1 (13-01)** membuat:
- `kesehatanTypes.ts` (types + constants)
- `kesehatanIndikator.ts` (skeleton `useIndikator()` + `aggregateTierColor`)
- Import placeholders dari `kesehatanTier1/2/3.ts` yang belum ada → gunakan stub functions

**Wave 2 paralel** menulis masing-masing ke file tier sendiri. Zero overlap. Merge di Wave 2 end = trivial.

**Import di `kesehatanIndikator.ts` (Wave 1 creates skeleton):**
```ts
// kesehatanIndikator.ts
import { computeDanaDarurat, computeSavingsRate, computeDARKonsumtif, computeDARTotal, computeAsuransiShell } from './kesehatanTier1'
import { computeGoalsOnTrack, computePensiun } from './kesehatanTier2'
import { computeRasioInvestasi, computeDiversifikasi } from './kesehatanTier3'
```

Wave 1 creates these files with stub implementations. Wave 2 replaces stubs with real logic.

---

## UI Patterns dari Codebase

### Color Treatment yang Ada (Badge)

`src/components/ui/badge.tsx` — variants: `default` (primary), `secondary`, `destructive` (red), `outline`, `ghost`, `link`.

**Tidak ada built-in green/yellow/amber variant.** Phase 13 perlu salah satu dari:
1. Custom inline className (simpler): `className="bg-green-100 text-green-700 ..."` — konsisten dengan spec §8.
2. Extend `badgeVariants` di `badge.tsx` dengan variant baru.

**Rekomendasi (planner decide):** Gunakan custom className di `IndikatorCard.tsx` dengan helper function:
```ts
const colorClass = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}
```

### Card Layout Pattern (dari KekayaanTab)

```tsx
<div className="rounded-xl border bg-card p-4" style={{ borderLeft: '4px solid var(--brand)' }}>
  <div className="flex items-start justify-between gap-2">
    {/* label kiri, value kanan */}
  </div>
</div>
```

**IndikatorCard** bisa follow pattern ini dengan `borderLeft` dinamis sesuai warna indikator.

### Progress Bar (dari GoalsTab)

`src/components/ui/progress.tsx` — Radix Progress primitive, `value` prop 0-100.

### Skeleton (loading state)

`src/components/ui/skeleton.tsx` — `<Skeleton className="h-14 w-full" />` sudah dipakai di `KesehatanLanding.tsx`.

### EmptyState

`src/components/ui/empty-state.tsx` — sudah ada untuk empty list states.

### View-As Guard Pattern (KekayaanTab)

```tsx
// Pattern untuk disable edit actions saat View-As
const { viewingAs } = useViewAs()
const isViewingAs = viewingAs !== null

// Gunakan di IndikatorCard / TierPanel untuk disable CTA mutations
// (Phase 13 read-only by nature — tidak ada mutations di Phase 13 kecuali protection_checklist yang Phase 14)
```

---

## Pitfalls + Known Issues yang Relevan

### 1. React Router Unmount Inactive Routes (MEMORY)

**Issue:** Sejak sidebar migration (commit aa0ccd3), React Router unmount route inactive. `/kesehatan` akan unmount ketika user navigasi ke `/transaksi`.

**Impact untuk Phase 13:** `useIndikator()` state dan semua 5 sub-hooks akan di-teardown saat pindah halaman. Tidak ada persistent state issue karena react-query cache akan preserve data — ketika kembali ke `/kesehatan`, hooks re-mount dan data langsung tersedia dari cache (tidak perlu refetch jika dalam stale window).

**Mitigasi:** Tidak perlu tambahan code — ini behavior normal react-query. `staleTime` di existing hooks cukup.

**Accordion open state** (`openTier` local state) akan reset ke undefined saat navigate away dan kembali. Acceptable behavior. Kalau ingin persist → gunakan `sessionStorage` atau URL param, tapi itu deferred (tidak wajib Phase 13).

### 2. `useTransactions()` tanpa filter — Full Table Scan (CONCERNS.md L-04)

**Issue:** `useTransactions()` tanpa filter bisa return semua transaksi (tidak ada server-side limit default). Untuk user dengan ratusan transaksi, ini heavy.

**Mitigasi untuk Phase 13:** Panggil `useTransactions({ dateFrom: threeMonthsAgoISO })` — hanya ambil 3 bulan terakhir untuk DIAG-01/02/10. Hitung `threeMonthsAgoISO` sekali:
```ts
const threeMonthsAgo = new Date()
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
const dateFrom = threeMonthsAgo.toISOString().substring(0, 10)
```

**CATATAN:** Kalau component lain sudah memanggil `useTransactions()` (tanpa filter) — react-query cache key berbeda (`['transactions', {}, uid]` vs `['transactions', { dateFrom: '...' }, uid]`) — jadi ini adalah network request TAMBAHAN, bukan shared cache. Trade-off: sedikit extra fetch vs full-table scan. Untuk Phase 13 pilih explicit dateFrom.

### 3. `pension_simulations` RLS tidak include `is_admin()`

**Issue:** Policy `ON pension_simulations FOR ALL USING (auth.uid() = user_id)` — tidak ada `OR is_admin()`. Admin yang View-As user lain akan dapat `null` dari `usePensionSim()`.

**Impact untuk Phase 13:** DIAG-06 akan selalu show `cta-fallback` saat admin View-As. Acceptable — tidak crash, informative.

**Tidak perlu fix di Phase 13** — ini behavior yang sudah ada dan dokumentasikan saja. Fix (tambah `OR is_admin()` ke RLS) adalah kandidat patch di Phase 14 atau terpisah.

### 4. `goals` table tidak include `created_at` di `listGoals()` SELECT

**Issue:** `listGoals()` hanya select `id, name, target_amount, current_amount, target_date, status`. Tidak ada `created_at` atau `start_date`.

**Impact untuk Phase 13:** `computeGoalsOnTrack()` butuh duration untuk time-elapsed calculation. Tanpa `created_at`, harus pakai fallback/assumption.

**Fix rekomendasi:** Extend `listGoals()` untuk include `created_at`:
```ts
.select('id, name, target_amount, current_amount, target_date, status, created_at')
```
dan extend `Goal` interface. Ini backward-compat (field tambahan tidak break existing consumers). Perlu dikerjakan di **13-03 plan** (Tier 2 indicators).

### 5. `investments.asset_type` TEXT bebas — False Diversification

**Issue:** User bisa ketik "Saham BBCA" dan "Saham BCA" → diversifikasi count 2 padahal seharusnya 1.

**Impact untuk Phase 13:** DIAG-08 count bisa over-inflate. Per spec, accepted di v1.2 — trust user.

**Tidak ada fix Phase 13.** Document saja sebagai known limitation.

### 6. `PensionSimRow.updated_at` di-set oleh aplikasi, bukan DB trigger

**Issue:** `updated_at` di-set explicitly oleh `upsertPensionSim()`: `updated_at: new Date().toISOString()`. Tidak ada DB trigger. Jika data di-update via SQL Editor tanpa set `updated_at`, nilai bisa stale.

**Impact untuk Phase 13:** Stale notice 6+ bulan di DIAG-06 mungkin false positive kalau admin update langsung via SQL. Acceptable untuk v1.2.

### 7. Accordion animation — `tw-animate-css` perlu keyframes

**Issue:** Template `accordion.tsx` menggunakan `data-[state=open]:animate-accordion-down` dan `data-[state=closed]:animate-accordion-up`. Keyframes ini dari `tw-animate-css` yang sudah di dependencies (`^1.4.0`).

**Verify:** Cek apakah `tw-animate-css` sudah di-import di `src/index.css` atau `tailwind.config.ts`. Kalau belum → accordion open/close tidak akan animate (tapi masih functional). Planner perlu add import jika belum ada.

---

## Plan-by-Plan File Breakdown

| File | 13-01 TierPanelInfra | 13-02 Tier 1 | 13-03 Tier 2 | 13-04 Tier 3 |
|------|---------------------|--------------|--------------|--------------|
| `src/components/ui/accordion.tsx` | CREATE | — | — | — |
| `src/queries/kesehatanTypes.ts` | CREATE | — | — | — |
| `src/queries/kesehatanIndikator.ts` | CREATE (skeleton) | — | — | — |
| `src/queries/kesehatanTier1.ts` | CREATE (stubs) | FILL real logic | — | — |
| `src/queries/kesehatanTier2.ts` | CREATE (stubs) | — | FILL real logic | — |
| `src/queries/kesehatanTier3.ts` | CREATE (stubs) | — | — | FILL real logic |
| `src/queries/kesehatan.ts` | MODIFY (add re-exports) | — | MODIFY (`created_at` ke Goal) | — |
| `src/db/goals.ts` | — | — | MODIFY (extend listGoals SELECT + Goal interface) | — |
| `src/tabs/kesehatan/PiramidaShell.tsx` | MODIFY (Accordion integration, tierColors prop) | — | — | — |
| `src/tabs/kesehatan/KesehatanLanding.tsx` | MODIFY (wire Accordion + useIndikator) | — | — | — |
| `src/tabs/kesehatan/IndikatorCard.tsx` | CREATE | — | — | — |
| `src/tabs/kesehatan/TierPanel.tsx` | CREATE (shell + Tier 4 placeholder) | — | — | — |
| `src/tabs/kesehatan/Tier1Panel.tsx` | — | CREATE | — | — |
| `src/tabs/kesehatan/Tier2Panel.tsx` | — | — | CREATE | — |
| `src/tabs/kesehatan/Tier3Panel.tsx` | — | — | — | CREATE |

**Zero overlap di Wave 2** — setiap plan owns exclusive files.

**13-01 sole responsibility untuk `kesehatan.ts`:** Wave 2 plans tidak touch `kesehatan.ts` kecuali 13-03 yang perlu modify `src/db/goals.ts` untuk `created_at`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Usia harapan hidup untuk DIAG-06 diasumsikan 75 tahun (atau `usia_pensiun + 20`). Tidak ada field `usia_harapan` di DB. | Compute Skeletons #6 | Indikator pensiun kurang akurat — terlalu optimis atau pesimis |
| A2 | `tw-animate-css` keyframes `accordion-down`/`accordion-up` sudah available di CSS global. | shadcn Accordion Setup | Accordion tidak animate (fungsional tapi jerky) |
| A3 | `listGoals()` kolom `created_at` tersedia di DB `goals` table meski tidak di-select saat ini. | Schema Reference goals | `created_at` harus di-select dalam plan 13-03 |
| A4 | Default `useTransactions({ dateFrom: 3bulan lalu })` cukup untuk cover semua kalender months yang needed untuk DIAG-01/02/10. Edge case: user punya transaksi di bulan ini tapi tidak ada 3 bulan penuh → placeholder muncul. | Compute Skeletons #1, #2 | Benar — edge case ini adalah intended behavior per DIAG-10 spec |

---

## Open Questions

1. **Usia harapan hidup untuk DIAG-06**
   - Yang diketahui: `pension_simulations` tidak punya field `usia_harapan`.
   - Unclear: Apakah pakai hardcode 75, atau derive dari `usia_pensiun + 20`, atau tambah field baru?
   - Rekomendasi: Gunakan konstanta `USIA_HARAPAN_DEFAULT = 75` di `kesehatanTier2.ts`. Gampang ganti tanpa schema change.

2. **`IndikatorResult` compute variant extend untuk `staleMonths`?**
   - Yang diketahui: DIAG-06 perlu tampil stale notice kalau `updated_at > 6 bulan`.
   - Unclear: Apakah extend type `IndikatorResult` compute dengan optional `staleMonths?: number`, atau handle di component dengan terpisah dari `IndikatorResult`.
   - Rekomendasi: Extend type — `{ kind: 'compute'; value: number; color: IndikatorColor; display: string; staleMonths?: number }`. Component `IndikatorCard` render notice kalau field ini ada.

3. **Accordion trigger shape — `asChild` atau custom button?**
   - PiramidaShell saat ini render `<button>` dengan trapezoid clip-path. Accordion trigger perlu merge dengan ini.
   - Radix `AccordionTrigger` support `asChild` pattern (dari `Slot`). Tapi `Slot` dari `radix-ui` mungkin perlu import terpisah.
   - Rekomendasi: Wrapper approach — buat `PiramidaTierTrigger` yang wraps `AccordionTrigger` + render trapezoid div di dalamnya. Hindari `asChild` komplex.

---

## Environment Availability

Skipped — Phase 13 adalah pure code/component changes. Tidak ada external CLI tools, services, atau database migrations baru yang diperlukan. Stack sudah tersedia (Vercel auto-deploy dari master, Supabase live).

---

## Validation Architecture

Skipped — `workflow.nyquist_validation` tidak dikonfigurasi di `.planning/config.json` dan tidak ada framework test (Playwright, Vitest, Jest) yang dikonfigurasi di project ini. Project menggunakan production UAT manual pattern (via `kantongpintar.vercel.app`). Setiap plan di Phase 13 harus diverifikasi via browser manual test di `/kesehatan` post-deploy.

**Manual verification checkpoints per plan:**

| Plan | Verification |
|------|-------------|
| 13-01 | `/kesehatan` → klik tier → accordion slide-down → tier 4 placeholder visible |
| 13-02 | Tier 1 panel → 4 indikator cards visible dengan warna; <3 bulan data → placeholder muncul |
| 13-03 | Tier 2 panel → goals on-track + pensiun cards; no long-term goal → CTA fallback |
| 13-04 | Tier 3 panel → rasio + diversifikasi cards dengan warna |

---

## Sources

### Primary (VERIFIED — langsung dari codebase)

- `src/queries/transactions.ts` — `useTransactions()` signature dan return shape
- `src/queries/netWorth.ts` — `useNetWorthAccounts()` dan `useNetWorthLiabilities()`
- `src/queries/goals.ts` — `useGoals()` dan `useGoalsWithProgress()` shape
- `src/queries/investments.ts` — `useInvestments()`, `currentValue()` helper
- `src/queries/pensiun.ts` — `usePensionSim()` return `PensionSimRow | null`
- `src/db/netWorth.ts` — `AccountType`, `LiabilityType` enums
- `src/db/goals.ts` — `Goal` interface fields, `listGoals()` SELECT
- `src/db/pensiun.ts` — `PensionSimRow` full interface, `DEFAULT_PENSION_SIM`
- `src/db/investments.ts` — `Investment` interface, `currentValue()` pure function
- `src/db/transactions.ts` — `Transaction` interface, `listTransactions()` filters
- `src/auth/useTargetUserId.ts` — View-As pattern (`viewingAs?.uid ?? user?.id`)
- `supabase/migrations/0012_net_worth.sql` — DB CHECK constraint AccountType dan LiabilityType
- `supabase/migrations/0011_pension_simulations.sql` — pension_simulations schema + RLS
- `supabase/migrations/0029_protection_checklist.sql` — protection_checklist schema + RLS
- `src/tabs/kesehatan/PiramidaShell.tsx` — TIERS constant, clip-path, width formula, variant prop
- `src/tabs/kesehatan/KesehatanLanding.tsx` — composition, loading/empty/normal branching
- `src/queries/kesehatan.ts` — existing `useTotalDataCount()`, query key pattern `['kesehatan', ...]`
- `src/tabs/pensiun/HitungTotalPanel.tsx` — `totalLumpSum` computation pattern
- `src/lib/pensiun-calc.ts` — `calcBPJS`, `calcInvestasiMandiri` signatures
- `src/tabs/KekayaanTab.tsx` — View-As guard pattern, `useViewAs()` usage
- `src/components/ui/badge.tsx` — existing variants (tidak ada green/yellow variant)
- `src/components/ui/progress.tsx`, `skeleton.tsx` — existing UI primitives
- `package.json` — `radix-ui: ^1.4.3`, `tw-animate-css: ^1.4.0`
- `node_modules/radix-ui/dist/index.d.ts` — verifikasi `Accordion` re-exported dari `@radix-ui/react-accordion`
- `node_modules/radix-ui/` subdirectory listing — konfirmasi `react-accordion` terinstall

### Secondary (CITED — design spec)

- `docs/superpowers/specs/2026-05-08-framework-page-design.md` — §4 tabel indikator, threshold, CTA mapping, edge cases, color spec
- `.planning/phases/13-diagnostic-data-indicators/13-CONTEXT.md` — locked decisions, type definitions

---

## Metadata

**Confidence breakdown:**
- Existing query hooks shapes: HIGH — dibaca langsung dari source files
- Schema (AccountType, LiabilityType, pension fields): HIGH — verified dari DB migrations
- Compute function skeletons: HIGH — derived dari verified data shapes + spec formulas
- shadcn Accordion setup: HIGH — verified dependency terinstall + import pattern dari node_modules
- Wave 2 file split feasibility: HIGH — tidak ada precedent issue, pattern clean
- `created_at` tersedia di `goals` table: MEDIUM — tidak ada migration verify untuk field ini di `listGoals`, tapi DB schema almost certainly includes it (standard pattern)
- Pension `usia_harapan` constant: LOW (ASSUMED) — perlu user/planner decision

**Research date:** 2026-05-08
**Valid until:** 2026-06-07 (30 hari — stack stable, tidak ada fast-moving deps)
