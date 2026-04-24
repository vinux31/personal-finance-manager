# Phase 2: Net Worth Tracker - Research

**Researched:** 2026-04-24
**Domain:** React/TypeScript CRUD UI — Supabase, TanStack Query v5, Recharts v3, shadcn/Radix UI
**Confidence:** HIGH (all findings verified against live codebase and installed packages)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 3-section layout in KekayaanTab: summary card (Net Worth/Aset/Liabilitas) → "Aset & Rekening" section → "Liabilitas" section.
- **D-02:** Investasi masuk sebagai baris read-only di section "Aset & Rekening" — tidak bisa diedit/dihapus.
- **D-03:** Mobile: card stack vertikal — konsisten dengan GoalsTab.
- **D-04:** Tambah/edit via dialog popup — ikuti pola GoalDialog.
- **D-05:** Dua dialog terpisah: `NetWorthAccountDialog` dan `NetWorthLiabilityDialog`.
- **D-06:** MetricCard ke-5 di Dashboard: label "Net Worth", nilai total, badge trend % vs bulan lalu (null → badge disembunyikan).
- **D-07:** Gradient card: `linear-gradient(135deg, #6366f1, #818cf8)` — sama dengan "Net Bulan Ini".
- **D-08:** Recharts AreaChart dengan gradient fill — bukan bar, bukan line.
- **D-09:** Rentang default 6 bulan terakhir dari snapshot tersedia; tidak ada placeholder kosong jika data < 6 bulan.
- **D-10:** Auto-snapshot dipicu saat tab Kekayaan dibuka — cek bulan kalender berjalan, insert jika belum ada.
- **D-11:** Semua query/mutation menggunakan `useTargetUserId()`.

### Claude's Discretion
- Exact file/component naming selain D-05 (ikuti pola codebase)
- Query key naming untuk TanStack Query (ikuti pola `['net-worth-accounts', uid]`)
- Exact column layout di desktop untuk card list (1 atau 2 kolom)
- Loading skeleton vs spinner (ikuti pola dominan di GoalsTab: inline text "Memuat…")

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NW-01 | Total Net Worth metric card di Dashboard | MetricCard component + gradient prop verified in DashboardTab.tsx; grid update from `sm:grid-cols-4` to `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` |
| NW-02 | Tambah akun/aset (nama, tipe, saldo) | `net_worth_accounts` table ready in migration 0012; Supabase insert pattern from db/goals.ts |
| NW-03 | Edit dan hapus akun/aset | Same CRUD pattern; ConfirmDialog sebelum delete; invalidateQueries pattern verified |
| NW-04 | Tambah liabilitas (nama, tipe, outstanding) | `net_worth_liabilities` table ready in migration 0012 |
| NW-05 | Edit dan hapus liabilitas | Same CRUD pattern as NW-03 |
| NW-06 | Investasi otomatis masuk Net Worth (read-only) | `useInvestments()` + `currentValue()` available from src/queries/investments.ts |
| NW-07 | Trend chart bulanan + auto-snapshot | `net_worth_snapshots` table with UNIQUE(user_id, snapshot_month) ready; AreaChart pattern in SimulasiPanel.tsx |

</phase_requirements>

---

## Summary

Phase 2 adalah fase UI-only additive — semua skema database sudah tersedia (migrated di Phase 1, migration `0012_net_worth.sql`). Tidak ada schema change yang diperlukan. Pekerjaan utama adalah: (1) membuat layer `src/db/netWorth.ts` dan `src/queries/netWorth.ts` mengikuti pola established goals/investments, (2) membuat `KekayaanTab` menggantikan placeholder di `FinansialTab`, (3) membuat dua dialog CRUD, (4) menambah MetricCard ke-5 di DashboardTab.

Seluruh stack library sudah terpasang: Recharts v3.8.1, TanStack Query v5.99.1, shadcn/Radix UI, Lucide React v1.8.0, Sonner v2.0.7. Tidak ada npm install baru yang dibutuhkan.

Pola implementasi sangat konsisten di codebase ini. Implementor tinggal mengikuti template dari GoalsTab + GoalDialog + goals.ts (db) + goals.ts (queries) secara mekanis, dengan adaptasi field.

**Primary recommendation:** Buat 5 file baru (db, queries, KekayaanTab, AccountDialog, LiabilityDialog) + modifikasi 2 file existing (FinansialTab, DashboardTab). Ikuti pola GoalsTab secara struktural.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CRUD akun/aset/liabilitas | Frontend (KekayaanTab) | Supabase DB via RLS | Semua logic di client layer, RLS enforce kepemilikan |
| Net Worth calculation | Frontend (computed) | — | Total dihitung dari 3 sumber data client-side: accounts, investments, liabilities |
| Auto-snapshot | Frontend (useEffect on mount) | Supabase DB | Insert dipicu dari client; UNIQUE constraint di DB cegah duplikat |
| Dashboard MetricCard | Frontend (DashboardTab) | Supabase DB (snapshots) | Card baca snapshot bulan lalu untuk trend, baca live data untuk nilai saat ini |
| Investment read-only row | Frontend (KekayaanTab) | src/queries/investments.ts | Fetch existing investments data, tampil read-only — zero new DB query |
| Area chart trend | Frontend (KekayaanTab) | Supabase DB (snapshots) | Baca snapshot history, render dengan Recharts |
| Auth/admin view-as | Frontend (useTargetUserId) | Supabase RLS | Hook returns viewingAs uid or own uid; RLS enforces on server |

---

## Standard Stack

### Core (sudah terpasang — verified via package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.103.3 | DB operations, RLS auth | [VERIFIED: package.json] Satu-satunya DB client di project |
| @tanstack/react-query | ^5.99.1 | Server state management | [VERIFIED: package.json] Dipakai di semua query files |
| recharts | ^3.8.1 | Charts (AreaChart) | [VERIFIED: package.json] Sudah dipakai di ReportsTab dan SimulasiPanel |
| lucide-react | ^1.8.0 | Icons | [VERIFIED: package.json] Dipakai di seluruh codebase |
| sonner | ^2.0.7 | Toast notifications | [VERIFIED: package.json] `toast.success`/`toast.error` di semua mutations |

### Supporting (sudah terpasang)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn (radix-ui) | ^4.3.0 | UI components (Dialog, Select, Badge, Card) | Semua UI primitives |
| tailwindcss | ^4.2.2 | Styling | Semua styling via Tailwind v4 (no tailwind.config.ts) |
| class-variance-authority | ^0.7.1 | Component variants | Via shadcn components |

**Installation:** Tidak ada package baru yang perlu diinstall untuk Phase 2.

---

## Architecture Patterns

### System Architecture Diagram

```
User Opens Tab Kekayaan
         │
         ▼
  KekayaanTab (mounts)
         │
         ├─── useEffect [] ──────────────────► insertSnapshotIfNeeded(uid, monthKey)
         │                                              │
         │                                    UNIQUE(user_id, snapshot_month) constraint
         │                                    → INSERT if no row for this month
         │
         ├─── useNetWorthAccounts(uid) ─────► Supabase: SELECT net_worth_accounts
         │
         ├─── useNetWorthLiabilities(uid) ──► Supabase: SELECT net_worth_liabilities
         │
         ├─── useInvestments() ─────────────► Supabase: SELECT investments (EXISTING query)
         │         │ currentValue(inv)         summed client-side for read-only row
         │
         ├─── useNetWorthSnapshots(uid) ────► Supabase: SELECT net_worth_snapshots ORDER BY snapshot_month
         │
         └─── Computed client-side:
               totalAccounts = sum(accounts.balance)
               totalInvestments = sum(currentValue(inv))
               totalLiabilities = sum(liabilities.amount)
               netWorth = totalAccounts + totalInvestments - totalLiabilities

DashboardTab (separate)
         │
         ├─── useNetWorthAccounts(uid) ─────► (same query, TanStack Query caches)
         ├─── useNetWorthLiabilities(uid) ──►
         ├─── useInvestments() ─────────────►
         ├─── useNetWorthSnapshots(uid) ────► last 2 snapshots for trend %
         └─── Renders MetricCard #5 (gradient, trend badge)
```

### Recommended Project Structure

```
src/
├── db/
│   └── netWorth.ts          # Supabase operations (listAccounts, createAccount, updateAccount,
│                            #   deleteAccount, listLiabilities, createLiability, updateLiability,
│                            #   deleteLiability, listSnapshots, insertSnapshotIfNeeded)
├── queries/
│   └── netWorth.ts          # TanStack Query hooks (useNetWorthAccounts, useCreateNetWorthAccount,
│                            #   useUpdateNetWorthAccount, useDeleteNetWorthAccount,
│                            #   useNetWorthLiabilities, useCreateNetWorthLiability, …,
│                            #   useNetWorthSnapshots)
├── tabs/
│   └── KekayaanTab.tsx      # Main tab component (replaces placeholder in FinansialTab)
└── components/
    ├── NetWorthAccountDialog.tsx    # Dialog for account CRUD
    └── NetWorthLiabilityDialog.tsx  # Dialog for liability CRUD
```

**Modified files:**
- `src/tabs/FinansialTab.tsx` — replace `<div>placeholder</div>` dengan `<KekayaanTab />`
- `src/tabs/DashboardTab.tsx` — tambah MetricCard #5, update grid breakpoints

### Pattern 1: DB Layer (src/db/netWorth.ts)

Ikuti persis pola `src/db/goals.ts` — Supabase client call, typed interfaces, no query hooks.

```typescript
// Source: src/db/goals.ts (verified)
import { supabase } from '@/lib/supabase'

export type AccountType = 'tabungan' | 'giro' | 'cash' | 'deposito' | 'dompet_digital' | 'properti' | 'kendaraan'
export type LiabilityType = 'kpr' | 'cicilan_kendaraan' | 'kartu_kredit' | 'paylater' | 'kta'

export interface NetWorthAccount {
  id: number
  user_id: string
  name: string
  type: AccountType
  balance: number
  created_at: string
}

export interface NetWorthAccountInput {
  name: string
  type: AccountType
  balance: number
}

export async function listAccounts(uid: string): Promise<NetWorthAccount[]> {
  const { data, error } = await supabase
    .from('net_worth_accounts')
    .select('id, user_id, name, type, balance, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as NetWorthAccount[]
}

export async function createAccount(uid: string, input: NetWorthAccountInput): Promise<number> {
  const { data, error } = await supabase
    .from('net_worth_accounts')
    .insert({ user_id: uid, ...input })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateAccount(id: number, input: NetWorthAccountInput): Promise<void> {
  const { error } = await supabase
    .from('net_worth_accounts')
    .update(input)
    .eq('id', id)
  if (error) throw error
}

export async function deleteAccount(id: number): Promise<void> {
  const { error } = await supabase.from('net_worth_accounts').delete().eq('id', id)
  if (error) throw error
}
```

### Pattern 2: Query Layer (src/queries/netWorth.ts)

```typescript
// Source: src/queries/goals.ts (verified)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { listAccounts, createAccount, updateAccount, deleteAccount, /* liabilities, snapshots */ } from '@/db/netWorth'
import { mapSupabaseError } from '@/lib/errors'
import { useTargetUserId } from '@/auth/useTargetUserId'

export function useNetWorthAccounts() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['net-worth-accounts', uid],
    queryFn: () => listAccounts(uid!),
    enabled: !!uid,
  })
}

export function useCreateNetWorthAccount() {
  const qc = useQueryClient()
  const uid = useTargetUserId()
  return useMutation({
    mutationFn: (input: NetWorthAccountInput) => createAccount(uid!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['net-worth-accounts'] })
      toast.success('Akun berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
// … updateAccount, deleteAccount, liabilities, snapshots — semua pola sama
```

### Pattern 3: KekayaanTab Structure

```typescript
// Source: src/tabs/GoalsTab.tsx (verified — replicate structure)
export default function KekayaanTab() {
  // State: dialog open/close, editing item, confirm delete
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<NetWorthAccount | null>(null)
  const [liabilityDialogOpen, setLiabilityDialogOpen] = useState(false)
  const [editingLiability, setEditingLiability] = useState<NetWorthLiability | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<{ type: 'account'|'liability', id: number, name: string } | null>(null)

  // Queries
  const { data: accounts = [], isLoading: accountsLoading } = useNetWorthAccounts()
  const { data: liabilities = [], isLoading: liabilitiesLoading } = useNetWorthLiabilities()
  const { data: investments = [] } = useInvestments()  // existing hook
  const { data: snapshots = [] } = useNetWorthSnapshots()
  const deleteAccount = useDeleteNetWorthAccount()
  const deleteLiability = useDeleteNetWorthLiability()

  // Auto-snapshot on mount (D-10)
  const uid = useTargetUserId()
  useEffect(() => {
    if (!uid) return
    const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
    insertSnapshotIfNeeded(uid, monthKey, totalAccounts, totalInvestments, totalLiabilities)
  }, [uid]) // [] equivalent — uid stable after mount

  // Computed totals
  const totalAccounts = accounts.reduce((s, a) => s + a.balance, 0)
  const totalInvestments = investments.reduce((s, i) => s + currentValue(i), 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0)
  const netWorth = totalAccounts + totalInvestments - totalLiabilities

  return (/* 3 sections + chart */)
}
```

### Pattern 4: AreaChart dengan Gradient Fill

Recharts v3 AreaChart tidak berubah fundamental dari v2 untuk fitur ini. SVG `<defs>` inline di dalam chart untuk gradient fill — pola standar Recharts.

```typescript
// Source: verified from recharts v3.8.1 + SimulasiPanel.tsx pattern
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Di dalam JSX KekayaanTab:
<ResponsiveContainer width="100%" height={220}>
  <AreaChart data={chartData}>
    <defs>
      <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
    <YAxis tickFormatter={shortRupiah} tick={{ fontSize: 12 }} width={70} />
    <Tooltip formatter={(v: unknown) => formatRupiah(typeof v === 'number' ? v : 0)} />
    <Area
      type="monotone"
      dataKey="net_worth"
      stroke="#6366f1"
      strokeWidth={2}
      fill="url(#netWorthGradient)"
    />
  </AreaChart>
</ResponsiveContainer>
```

**Chart data shape:**
```typescript
// Dari useNetWorthSnapshots(), transform untuk chart:
const chartData = snapshots
  .sort((a, b) => a.snapshot_month.localeCompare(b.snapshot_month))
  .slice(-6)  // D-09: 6 bulan terakhir
  .map(s => ({
    month: new Date(s.snapshot_month).toLocaleDateString('id-ID', { month: 'short' }),
    net_worth: s.net_worth,  // GENERATED ALWAYS AS column dari DB
  }))
```

### Pattern 5: insertSnapshotIfNeeded (auto-snapshot D-10)

```typescript
// src/db/netWorth.ts
export async function insertSnapshotIfNeeded(
  uid: string,
  snapshotMonth: string,  // format: 'YYYY-MM-01'
  totalAccounts: number,
  totalInvestments: number,
  totalLiabilities: number
): Promise<void> {
  // UNIQUE(user_id, snapshot_month) handles idempotency at DB level
  // Use upsert with ignoreDuplicates to avoid error on repeat calls
  const { error } = await supabase
    .from('net_worth_snapshots')
    .upsert(
      { user_id: uid, snapshot_month: snapshotMonth, total_accounts: totalAccounts, total_investments: totalInvestments, total_liabilities: totalLiabilities },
      { onConflict: 'user_id,snapshot_month', ignoreDuplicates: true }
    )
  if (error) throw error
}
```

**Catatan penting:** Column `net_worth` di `net_worth_snapshots` adalah `GENERATED ALWAYS AS (total_accounts + total_investments - total_liabilities) STORED` — tidak perlu dikirim saat insert.

### Pattern 6: Dashboard MetricCard #5

```typescript
// Source: src/tabs/DashboardTab.tsx line 78+ (verified)
// Grid update dari:
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
// Menjadi:
<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">

// MetricCard ke-5 (setelah card Nilai Investasi):
<MetricCard
  label="Net Worth"
  value={shortRupiah(netWorth)}
  gradient
  trend={netWorthTrend}  // number | null — dari snapshot comparison
/>
```

**Trend calculation untuk Dashboard:**
```typescript
// Ambil 2 snapshot terakhir dari useNetWorthSnapshots()
// snapshot[-1] = bulan ini (atau bulan terakhir ada)
// snapshot[-2] = bulan sebelumnya
const lastTwo = snapshots.slice(-2)
const netWorthTrend = lastTwo.length === 2
  ? trendPct(lastTwo[1].net_worth, lastTwo[0].net_worth)
  : null
```

**PERHATIAN:** MetricCard gradient saat ini tidak render trend badge (lihat DashboardTab.tsx baris 197-201: gradient branch hanya render label + value, tidak ada trend). Implementor perlu menambahkan trend rendering ke dalam gradient branch MetricCard.

### Pattern 7: Type Check untuk DB Enum

Schema DB menggunakan `CHECK` constraint untuk type enum:
- `net_worth_accounts.type`: `'tabungan' | 'giro' | 'cash' | 'deposito' | 'dompet_digital' | 'properti' | 'kendaraan'`
- `net_worth_liabilities.type`: `'kpr' | 'cicilan_kendaraan' | 'kartu_kredit' | 'paylater' | 'kta'`

TypeScript types harus cocok dengan nilai DB — gunakan underscore (misal `dompet_digital`, bukan `dompet digital`). Label display di UI bisa berbeda (gunakan mapping).

```typescript
// Mapping display label untuk Select dropdown
const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  tabungan: 'Tabungan',
  giro: 'Giro',
  cash: 'Cash',
  deposito: 'Deposito',
  dompet_digital: 'Dompet Digital',
  properti: 'Properti',
  kendaraan: 'Kendaraan',
}
```

### Anti-Patterns to Avoid

- **Jangan buat field user_id sebagai input form:** `user_id` diisi dari `useTargetUserId()` di mutation layer, bukan dari dialog form — sama dengan pola investments.ts.
- **Jangan query snapshots dengan `maybeSingle()`:** Snapshot history perlu array — gunakan `.select()` tanpa `.single()`.
- **Jangan calculate net_worth di client untuk snapshot insert:** Biarkan DB compute via `GENERATED ALWAYS AS`. Hanya kirim `total_accounts`, `total_investments`, `total_liabilities`.
- **Jangan render trend badge di MetricCard gradient tanpa modifikasi:** Gradient branch saat ini tidak merender trend. Perlu extend MetricCard atau inline di DashboardTab.
- **Jangan gunakan `invalidateQueries` terlalu spesifik:** Gunakan `{ queryKey: ['net-worth-accounts'] }` (tanpa uid) agar semua varian query ter-invalidate.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialog state management | Custom modal | shadcn Dialog (`src/components/ui/dialog.tsx`) | Sudah ada, accessible, keyboard-handled |
| Delete confirmation | `window.confirm()` | `ConfirmDialog` (`src/components/ui/confirm-dialog.tsx`) | Sudah ada, konsisten dengan GoalsTab |
| Number formatting | Custom formatter | `formatRupiah()` dan `shortRupiah()` dari `src/lib/format.ts` | Sudah ada, handles IDR locale |
| Number parsing from input | Custom parser | `parseRupiah()` dari `src/lib/format.ts` | Handles Indonesian number format (dot=thousand) |
| Error message mapping | Custom error handler | `mapSupabaseError()` dari `src/lib/errors.ts` | Sudah ada, dipakai di semua mutations |
| Toast notifications | Custom toast | `toast.success()` / `toast.error()` dari sonner | Sudah ada, styling konsisten |
| Empty state UI | Custom empty div | `EmptyState` dari `src/components/ui/empty-state.tsx` | Sudah ada, prop-driven |
| Duplicate snapshot prevention | Client-side check | Supabase `upsert` + `ignoreDuplicates: true` | UNIQUE constraint di DB, atomic |

**Key insight:** Phase 2 adalah assembling existing pieces. Hampir tidak ada logic custom yang perlu ditulis dari scratch — semua patterns, utils, dan components sudah ada.

---

## Runtime State Inventory

> Phase 2 adalah additive UI feature — bukan rename/refactor. Tidak ada runtime state inventory yang relevan.

**Not applicable** — Phase 2 tidak memodifikasi existing data, tidak menarget string rename, dan tidak memerlukan data migration. Schema DB sudah dibuat di Phase 1.

---

## Common Pitfalls

### Pitfall 1: MetricCard gradient branch tidak render trend

**What goes wrong:** Developer menambah `trend={netWorthTrend}` ke MetricCard dengan `gradient={true}`, tapi tidak ada trend yang tampil. Membingungkan karena props diterima tapi tidak dirender.

**Why it happens:** Gradient branch di MetricCard (`DashboardTab.tsx` lines 193-201) early-return hanya dengan label + value, tanpa memeriksa `trend` prop. Non-gradient branch punya trend rendering, tapi gradient branch tidak.

**How to avoid:** Extend gradient branch untuk merender trend badge jika `trend != null`. Sesuai D-06 dan UI-SPEC: badge emerald/red di bawah value.

**Warning signs:** Net Worth card tampil tapi tanpa trend badge meski snapshot 2 bulan sudah ada.

---

### Pitfall 2: Auto-snapshot menggunakan nilai 0 sebelum data loaded

**What goes wrong:** `useEffect` dipanggil saat mount, tapi `accounts`, `liabilities`, dan `investments` masih loading. Snapshot terinsert dengan nilai 0/0/0.

**Why it happens:** `useEffect` dengan deps `[uid]` jalan saat komponen mount. Query data baru tersedia setelah beberapa render cycle.

**How to avoid:** Tambahkan guard di `useEffect`: hanya call `insertSnapshotIfNeeded` setelah semua 3 queries selesai loading (`!accountsLoading && !liabilitiesLoading && investmentsLoaded`). Atau gunakan semua 3 sebagai deps tapi dengan `isSuccess` flag.

```typescript
useEffect(() => {
  if (!uid || accountsLoading || liabilitiesLoading) return
  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
  insertSnapshotIfNeeded(uid, monthKey, totalAccounts, totalInvestments, totalLiabilities)
    .catch(console.error)
}, [uid, accountsLoading, liabilitiesLoading, totalAccounts, totalInvestments, totalLiabilities])
```

**Warning signs:** Snapshot month record ada di DB tapi dengan net_worth = 0.

---

### Pitfall 3: Dashboard tidak memiliki Net Worth data saat pertama dibuka

**What goes wrong:** Dashboard MetricCard Net Worth tampil Rp 0 atau loading tanpa penjelasan — karena Dashboard tidak auto-snapshot dan queries ke `net_worth_accounts` mungkin return empty.

**Why it happens:** Dashboard hanya display, tidak trigger auto-snapshot. Jika user belum pernah buka tab Kekayaan, tidak ada snapshot tapi akun mungkin sudah ada.

**How to avoid:** Untuk MetricCard Net Worth di Dashboard, gunakan live data (bukan snapshot): fetch accounts + liabilities + investments, compute netWorth client-side. Snapshot hanya untuk trend comparison (last month vs this month). Ini konsisten dengan D-06.

---

### Pitfall 4: `snapshot_month` format mismatch

**What goes wrong:** Snapshot query atau insert gagal karena format tanggal tidak cocok dengan DB.

**Why it happens:** Column `snapshot_month DATE NOT NULL` — Supabase expects `'YYYY-MM-DD'`. Jika dikirim `'YYYY-MM'` tanpa day, Supabase error.

**How to avoid:** Selalu format sebagai `'YYYY-MM-01'` (first of month). Gunakan: `new Date(s.snapshot_month)` untuk display akan auto-handle.

---

### Pitfall 5: Dashboard grid layout rusak dengan 5 cards

**What goes wrong:** Cards di Dashboard tidak fit — 5 cards di `sm:grid-cols-4` membuat wrap tidak rata (4 + 1).

**Why it happens:** Existing grid hanya plan untuk 4 cards.

**How to avoid:** Update class ke `grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5`. Di mobile (2 col): 5 cards = 3 baris (2+2+1). Di sm (3 col): 2 baris (3+2). Di md (5 col): 1 baris. Sesuai UI-SPEC.

---

### Pitfall 6: RLS blocking mutation karena user_id tidak di-pass

**What goes wrong:** Insert gagal dengan RLS violation meski user sudah login.

**Why it happens:** Supabase anon client enforces RLS. Policy: `WITH CHECK (auth.uid() = user_id)`. Jika `user_id` tidak disertakan dalam insert payload, DB tidak bisa check.

**How to avoid:** Selalu pass `user_id: uid` dari `useTargetUserId()` di setiap insert. Supabase tidak auto-inject user_id ke rows. Verified dari db/goals.ts pattern — goals tidak pass user_id (karena goals pakai RLS function yang inject), tapi net_worth tables butuh explicit. **Konfirmasi dari migration:** policy is `auth.uid() = user_id` — harus eksplisit.

**Catatan penting:** Di `db/goals.ts`, `createGoal()` tidak pass `user_id` ke insert — namun goals tabel mungkin punya trigger atau policy yang berbeda. Untuk net_worth, pass `user_id` eksplisit karena migration tidak ada trigger auto-inject.

---

## Code Examples

### Complete insertSnapshotIfNeeded pattern

```typescript
// Source: 0012_net_worth.sql schema (verified) + Supabase upsert docs [ASSUMED: upsert API]
export async function insertSnapshotIfNeeded(
  uid: string,
  snapshotMonth: string,  // 'YYYY-MM-01'
  totalAccounts: number,
  totalInvestments: number,
  totalLiabilities: number
): Promise<void> {
  const { error } = await supabase
    .from('net_worth_snapshots')
    .upsert(
      {
        user_id: uid,
        snapshot_month: snapshotMonth,
        total_accounts: totalAccounts,
        total_investments: totalInvestments,
        total_liabilities: totalLiabilities,
        // net_worth omitted — GENERATED ALWAYS AS column
      },
      { onConflict: 'user_id,snapshot_month', ignoreDuplicates: true }
    )
  if (error) throw error
}
```

### Dialog pattern (NetWorthAccountDialog)

```typescript
// Source: src/components/GoalDialog.tsx (verified)
interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: NetWorthAccount | null
}

export default function NetWorthAccountDialog({ open, onOpenChange, editing }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('tabungan')
  const [balanceStr, setBalanceStr] = useState('')

  const create = useCreateNetWorthAccount()
  const update = useUpdateNetWorthAccount()
  const saving = create.isPending || update.isPending

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setType(editing.type)
      setBalanceStr(String(Math.round(editing.balance)))
    } else {
      setName(''); setType('tabungan'); setBalanceStr('')
    }
  }, [open, editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const balance = parseRupiah(balanceStr)
    if (!name.trim() || balance <= 0) {
      toast.error('Nama dan saldo (> 0) wajib diisi')
      return
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input: { name, type, balance } })
      } else {
        await create.mutateAsync({ name, type, balance })
      }
      onOpenChange(false)
    } catch { /* toast handled in mutation */ }
  }
  // ... Dialog JSX
}
```

### Investasi read-only row

```typescript
// Source: D-02, UI-SPEC layout contract (verified)
// Ditempatkan di dalam section "Aset & Rekening", setelah editable account cards
const totalInvestments = investments.reduce((s, i) => s + currentValue(i), 0)

{totalInvestments > 0 && (
  <div className="rounded-xl border bg-card p-4">
    {/* No borderLeft accent — visually distinct from editable rows */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm italic text-muted-foreground">Nilai Investasi</span>
        <Badge variant="secondary">otomatis</Badge>
      </div>
      {/* No edit/delete buttons */}
    </div>
    <div className="text-[10px] text-muted-foreground mt-1">{formatRupiah(totalInvestments)}</div>
  </div>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TanStack Query v4 queryKey arrays | v5 — same syntax, `enabled` still supported | v5 | No change needed, patterns identical |
| Recharts v2 AreaChart | v3 — same component API for Area/AreaChart | v3 | No breaking change for our usage pattern |
| shadcn v0.x global install | shadcn v4 (project-scoped) | 2024 | Components already installed, no `npx shadcn add` needed |

**Deprecated/outdated:**
- `@tanstack/react-query` `cacheTime` → renamed `gcTime` in v5, but we don't use custom cacheTime so no impact.
- Recharts `<defs>` linearGradient: still valid in v3, not deprecated.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase JS v2 client `upsert` dengan `ignoreDuplicates: true` menggunakan `onConflict` string tidak berubah dari known API | Code Examples: insertSnapshotIfNeeded | Insert snapshot bisa throw error instead of silently skip; fallback: check existence first then insert |
| A2 | `goals` insert di db/goals.ts tidak pass `user_id` tapi masih berhasil — kemungkinan ada RLS policy yang inject atau ada trigger | Pitfall 6 | Jika net_worth juga tidak perlu pass user_id, code bisa disederhanakan; tapi pass eksplisit lebih safe |

**Note A1 mitigation:** Jika `ignoreDuplicates` bermasalah, alternatif aman: query dulu apakah row bulan ini ada, insert hanya jika tidak ada.

---

## Open Questions

1. **Goals insert tanpa explicit user_id**
   - What we know: `db/goals.ts` `createGoal()` tidak pass `user_id` ke insert payload, tapi RLS policy `WITH CHECK (auth.uid() = user_id)` ada.
   - What's unclear: Ada RLS bypass via session claim, atau Supabase auto-inject dari auth.uid() via trigger?
   - Recommendation: Untuk net_worth, pass `user_id` eksplisit. Ini safe dalam semua skenario karena `auth.uid() = user_id` akan match.

2. **Dashboard MetricCard Net Worth — live atau snapshot?**
   - What we know: D-06 menyebut "nilai total (aset + investasi − liabilitas)" dan "badge trend % vs bulan lalu".
   - What's unclear: "nilai total" = live computed atau ambil dari latest snapshot?
   - Recommendation: Live computed (fetch accounts + liabilities + investments di DashboardTab) untuk nilai saat ini. Snapshot untuk trend comparison only. Ini konsisten dengan cards lain di Dashboard yang semua live.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 2 adalah pure frontend UI. Semua external dependencies (Supabase, npm packages) sudah tersedia dan diverifikasi di package.json dan src/lib/supabase.ts.

**Blocker pre-Phase 2 dari STATE.md:** Cek `src/lib/supabase.ts` untuk confirm anon vs service_role key.
**Status:** RESOLVED — verified supabase.ts menggunakan `VITE_SUPABASE_ANON_KEY`. RLS adalah enforced (bukan advisory).

---

## Validation Architecture

> `workflow.nyquist_validation` tidak di-set di config.json (hanya `_auto_chain_active: false`). Treat as enabled.

**Assessment:** Project ini tidak memiliki test framework yang terinstall. Tidak ada `jest.config.*`, `vitest.config.*`, `pytest.ini`, atau `__tests__/` directory yang terdeteksi. Tidak ada `test` script di package.json yang terlihat.

**Recommendation untuk Wave 0:** Tidak perlu setup test infrastructure untuk Phase 2 — ini adalah project personal finance app yang sedang dibangun dengan manual testing via browser. Menambah test framework sekarang di luar scope Phase 2.

**Manual validation approach:**
- Buka tab Kekayaan → cek summary card, add account, edit, delete, konfirmasi ConfirmDialog
- Cek investasi read-only row muncul jika ada data investments
- Buka Dashboard → cek MetricCard ke-5 tampil
- Buka tab Kekayaan bulan depan (atau manipulasi tanggal) → cek snapshot baru terbuat
- Cek chart AreaChart render dengan gradient fill

---

## Security Domain

### Supabase client: ANON KEY (RLS ENFORCED)

`src/lib/supabase.ts` menggunakan `VITE_SUPABASE_ANON_KEY` — bukan service_role. Semua operasi melewati RLS.

### RLS Policy Review (dari migration 0012)

```sql
-- net_worth_accounts + net_worth_liabilities + net_worth_snapshots:
-- USING: auth.uid() = user_id OR is_admin()   (admin can read)
-- WITH CHECK: auth.uid() = user_id             (admin CANNOT write other users' data)
```

Ini adalah canonical RLS pattern dari project ini — konsisten dengan STATE.md decisions. Admin dapat melihat data user lain (untuk view-as feature) tapi tidak dapat memodifikasi.

### ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 2 tidak implement auth — auth sudah ada |
| V3 Session Management | No | TanStack Query + Supabase session — sudah handled |
| V4 Access Control | YES | RLS di Supabase: `auth.uid() = user_id` — verified in migration |
| V5 Input Validation | YES | Validation di dialog form: required fields, balance > 0 |
| V6 Cryptography | No | Tidak ada crypto baru di phase ini |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User A membaca data User B | Information Disclosure | RLS USING clause: `auth.uid() = user_id OR is_admin()` |
| User A menulis ke akun User B | Tampering | RLS WITH CHECK: `auth.uid() = user_id` — admin excluded |
| Inject nilai negatif sebagai saldo | Tampering | Client validation: `balance <= 0` → toast.error; DB: `DEFAULT 0` |
| XSS via account name | Tampering | React escapes by default; tidak ada dangerouslySetInnerHTML |

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/0012_net_worth.sql` — exact schema: tables, columns, types, RLS policies
- `src/tabs/GoalsTab.tsx` — CRUD tab pattern yang akan direplikasi
- `src/components/GoalDialog.tsx` — dialog form pattern
- `src/queries/goals.ts` — query layer pattern
- `src/db/goals.ts` — db layer pattern
- `src/tabs/DashboardTab.tsx` — MetricCard component implementation (lines 175-226)
- `src/queries/investments.ts` — useInvestments() + currentValue() API
- `src/tabs/FinansialTab.tsx` — placeholder yang akan digantikan
- `src/tabs/pensiun/SimulasiPanel.tsx` — AreaChart pattern yang sudah dipakai
- `src/lib/format.ts` — formatRupiah, parseRupiah, shortRupiah utilities
- `src/lib/supabase.ts` — confirmed anon key, RLS enforced
- `src/auth/useTargetUserId.ts` — hook returns viewingAs?.uid ?? user?.id
- `package.json` — all library versions verified

### Secondary (MEDIUM confidence)
- Recharts v3.8.1 AreaChart + linearGradient pattern — verified via installed package version, consistent with SimulasiPanel pattern in codebase

### Tertiary (LOW confidence)
- Supabase upsert `ignoreDuplicates` option behavior [A1 in Assumptions Log]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all verified via package.json
- Architecture: HIGH — all patterns verified in live codebase
- DB schema: HIGH — migration file read directly
- Pitfalls: HIGH — derived from direct code inspection
- Chart gradient: MEDIUM — recharts v3 API inferred from v2 knowledge + existing codebase usage (SimulasiPanel doesn't use gradient fill, only solid colors)

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (stable stack, 30-day window)
