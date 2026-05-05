# Sidebar Information Architecture Restructure

**Date:** 2026-05-05
**Status:** Design (pending plan)
**Scope:** Restructure sidebar navigation to fix naming collision, surface buried features, and improve information architecture clarity.

---

## Problem Statement

Audit terhadap struktur menu pfm-web saat ini menemukan 5 issue arsitektur informasi yang reproducible dari kode:

1. **Naming collision "Kekayaan"** — `navConfig.ts:37` punya grup label `'Kekayaan'`, sementara `FinansialTab.tsx:14` punya sub-tab juga bernama `'Kekayaan'`. User harus klik grup "Kekayaan" → menu "Finansial" → tab "Kekayaan" untuk akses Net Worth.

2. **`/finansial` adalah container kosong** — `FinansialTab.tsx` cuma wrapper `<Tabs>` untuk `KekayaanTab` (Net Worth) + `GoalsTab`, tanpa logic sendiri. Dua sub-tab ini secara konsep berbeda (aset yang dipunya vs tujuan yang dikejar), tidak punya alasan kuat untuk berbagi route.

3. **Periode Gaji terkubur** — Fitur shipped Phase 11 (sudah memengaruhi Dashboard card + filter Transaksi + Laporan), tapi cuma jadi tab kedua di `/laporan` (`ReportsTab.tsx:133-140`). Discoverability rendah.

4. **Panduan hidden** — Route `/panduan` ada di `routes.tsx:27-28` tapi tidak muncul di `navConfig.ts`. Hanya bisa diakses via Welcome card di Pengaturan.

5. **Recurring transactions tanpa entry point eksplisit** — Hanya dialog dari halaman Transaksi (`RecurringListDialog`). Tidak ada indicator visibility kapan ada recurring jatuh tempo.

---

## Goals

- Hilangkan naming collision di sidebar
- Promote fitur penting yang sehari-hari dipakai (Periode Gaji)
- Surface fitur help (Panduan) tanpa menambah noise
- Tambah lightweight indicator untuk recurring tanpa membuat menu baru
- Pertahankan backward compatibility untuk bookmark user lama

## Non-Goals

- Restrukturisasi internal Settings (admin/user split) — out of scope
- Standardisasi CSV import/export antar entitas — out of scope
- Demote/remove Pensiun — tidak ada justifikasi data

---

## Final Design

### New Sidebar Structure

```
📊 Dashboard

─ Keuangan ─────────────────────────
  💰 Transaksi          [badge: number of recurring due]
  📅 Periode Gaji        ← NEW (promoted from /laporan tab)
  📈 Laporan             ← internal "Periode Gaji" tab dihapus
  📝 Catatan

─ Aset ─────────────────────────────  ← NEW group
  📈 Investasi
  🏦 Kekayaan            ← NEW route /kekayaan (was sub-tab in /finansial)

─ Tujuan ───────────────────────────  ← NEW group
  🎯 Goals               ← NEW route /goals (was sub-tab in /finansial)
  🐷 Pensiun

─ Footer ───────────────────────────
  📖 Panduan             ← NEW (surfaced from hidden route)
  ⚙️ Pengaturan
```

**Grup count:** 4 → 5 (tambah pemisahan Aset vs Tujuan)
**Visible nav items:** 8 → 11 (tambah Periode Gaji, Kekayaan, Goals, Panduan; hapus Finansial)

### Routing Changes

| Route | Before | After |
|---|---|---|
| `/dashboard` | `<DashboardTab />` | unchanged |
| `/transaksi` | `<TransactionsTab />` | unchanged |
| `/periode-gaji` | — | **NEW** → `<PayPeriodList />` |
| `/laporan` | `<ReportsTab />` (with PayPeriod tab) | `<ReportsTab />` (PayPeriod tab removed) |
| `/catatan` | `<NotesTab />` | unchanged |
| `/investasi` | `<InvestmentsTab />` | unchanged |
| `/kekayaan` | — | **NEW** → `<KekayaanTab />` |
| `/goals` | — | **NEW** → `<GoalsTab />` |
| `/pensiun` | `<PensiunTab />` | unchanged |
| `/finansial` | `<FinansialTab />` | **redirect** → `/kekayaan` |
| `/pengaturan` | `<SettingsTab />` | unchanged |
| `/panduan`, `/panduan/:slug` | `<PanduanFullPage />` (hidden) | unchanged route, **surfaced in sidebar** |

### Components Changed

#### 1. `src/shell/navConfig.ts` (MODIFY)

Restructure `NAV_GROUPS`:

```typescript
import {
  LayoutDashboard, Wallet, Calendar, BarChart3, StickyNote,
  TrendingUp, Landmark, Target, PiggyBank,
  BookOpen, Settings as SettingsIcon,
} from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  badge?: 'recurring-due'  // optional badge identifier
}

export const NAV_GROUPS: NavGroup[] = [
  { items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Keuangan',
    items: [
      { to: '/transaksi', label: 'Transaksi', icon: Wallet, badge: 'recurring-due' },
      { to: '/periode-gaji', label: 'Periode Gaji', icon: Calendar },
      { to: '/laporan', label: 'Laporan', icon: BarChart3 },
      { to: '/catatan', label: 'Catatan', icon: StickyNote },
    ],
  },
  {
    label: 'Aset',
    items: [
      { to: '/investasi', label: 'Investasi', icon: TrendingUp },
      { to: '/kekayaan', label: 'Kekayaan', icon: Landmark },
    ],
  },
  {
    label: 'Tujuan',
    items: [
      { to: '/goals', label: 'Goals', icon: Target },
      { to: '/pensiun', label: 'Pensiun', icon: PiggyBank },
    ],
  },
  {
    items: [
      { to: '/panduan', label: 'Panduan', icon: BookOpen },
      { to: '/pengaturan', label: 'Pengaturan', icon: SettingsIcon },
    ],
  },
]
```

#### 2. `src/routes.tsx` (MODIFY)

```typescript
{ path: 'periode-gaji', element: <PayPeriodList /> },
{ path: 'kekayaan', element: <KekayaanTab /> },
{ path: 'goals', element: <GoalsTab /> },
{ path: 'finansial', element: <Navigate to="/kekayaan" replace /> },
// remove: { path: 'finansial', element: <FinansialTab /> }
```

#### 3. `src/tabs/FinansialTab.tsx` (DELETE)

Wrapper kosong, tidak diperlukan setelah Net Worth & Goals jadi route sendiri.

#### 4. `src/tabs/ReportsTab.tsx` (MODIFY)

- Hapus outer `<Tabs defaultValue="laporan">` wrapper di line 133-141
- Hapus `<TabsTrigger value="periode-gaji">` dan `<TabsContent value="periode-gaji">`
- Hapus import `PayPeriodList` (line 3)
- Konten langsung jadi laporan (tidak ada tab di top-level)

Catatan: `useCurrentPayPeriod` (line 25, 40-50) tetap dipertahankan — masih dipakai untuk auto-apply periode gaji aktif sebagai filter range default.

#### 5. `src/tabs/GoalsTab.tsx` (MODIFY)

Hapus props-based filter handling. State `localFilters` tetap, `filtersProp` & `onFiltersChange` dihapus karena sudah tidak ada parent yang inject.

```typescript
// Before
export default function GoalsTab({ filters: filtersProp, onFiltersChange }: GoalsTabProps = {}) {
  const [localFilters, setLocalFilters] = useState<GoalFilters>({})
  const filters = filtersProp ?? localFilters
  const setFilters = onFiltersChange ?? setLocalFilters

// After
export default function GoalsTab() {
  const [filters, setFilters] = useState<GoalFilters>({})
```

#### 6. `src/shell/AppSidebar.tsx` (MODIFY)

- Render NavItem dengan optional badge — query `useRecurringDueCount()` (NEW hook) → render number badge di kanan label "Transaksi" jika count > 0
- Footer grup (last group with no label, containing Panduan + Pengaturan) di-render dengan visual separator (border-top atau spacing) untuk membedakan dari grup utama

#### 7. `src/queries/recurring.ts` atau hook baru (NEW)

```typescript
// useRecurringDueCount — count of recurring transactions yang next_run_date <= today
export function useRecurringDueCount() {
  return useQuery({
    queryKey: ['recurring', 'due-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('recurring_transactions')
        .select('*', { count: 'exact', head: true })
        .lte('next_run_date', todayISO())
      return count ?? 0
    },
    staleTime: 60_000,
  })
}
```

(Asumsi: schema `recurring_transactions` punya kolom `next_run_date`. Plan phase harus verifikasi.)

#### 8. `src/components/PayPeriodList.tsx` (NO CHANGE)

Sudah standalone-ready. Bisa langsung dipakai sebagai route element.

#### 9. `src/tabs/KekayaanTab.tsx` (NO CHANGE)

Sudah self-contained.

---

## Architecture & Boundaries

Setiap unit punya satu purpose yang jelas:

- **`navConfig.ts`** — single source of truth untuk struktur menu (data only, no UI logic)
- **`AppSidebar.tsx`** — render NavConfig + handle badge query (UI only)
- **`routes.tsx`** — route → element mapping (single declarative file)
- **Tab components** (`KekayaanTab`, `GoalsTab`, `PayPeriodList`, dll) — self-contained pages, tidak depend pada parent state

**Dependency directions:**
- `AppSidebar` → `navConfig` (read), `useRecurringDueCount` (read)
- `routes.tsx` → tab components (mount)
- Tab components → queries/db layer (no cross-tab dependencies)

Removal of `FinansialTab` simplifies graph — Goals dan Net Worth tidak lagi dependent pada wrapper untuk routing.

---

## Data Flow

### Badge "Recurring Due" Flow

```
AppSidebar (mount)
  → useRecurringDueCount() [react-query, 60s stale]
    → supabase.from('recurring_transactions').select(count, head:true).lte(next_run_date, today)
  → render <Badge>{count}</Badge> jika count > 0
  → invalidate on: useProcessRecurring success, recurring CRUD mutations
```

### Periode Gaji Auto-Apply (preserved)

`ReportsTab` masih auto-apply `useCurrentPayPeriod()` ke filter range. Tidak berubah.
`TransactionsTab` masih auto-apply periode gaji aktif. Tidak berubah.

---

## Error Handling

- **Badge query fail** — return 0 (no badge), no error toast. Sidebar harus tetap functional walau query gagal.
- **Redirect `/finansial`** — `<Navigate replace />` cukup. Tidak perlu error handling khusus.
- **Bookmark lama ke `/finansial?tab=goals`** — query string dibuang oleh redirect. Acceptable loss; user akan mendarat di `/kekayaan` lalu manual klik Goals.

---

## Testing

### Manual UAT Checklist
- [ ] Sidebar render 5 grup dengan urutan: Dashboard → Keuangan → Aset → Tujuan → Footer
- [ ] Klik tiap menu navigate ke route yang benar
- [ ] `/finansial` redirect ke `/kekayaan`
- [ ] `/finansial/anything` masih redirect (atau fallback ke wildcard `*`)
- [ ] Tab "Periode Gaji" hilang dari `/laporan`
- [ ] Badge muncul di Transaksi jika ada recurring jatuh tempo (count > 0)
- [ ] Badge hilang setelah recurring di-process (`useProcessRecurring` invalidate)
- [ ] Panduan accessible dari sidebar footer
- [ ] Goals filter state behavior unchanged (cuma source-nya internal sekarang)
- [ ] Mobile sidebar collapsed: semua menu accessible

### Regression Check
- [ ] DashboardTab `PayPeriodCard` masih render
- [ ] TransactionsTab auto-apply periode gaji masih jalan
- [ ] ReportsTab auto-apply periode gaji ke range filter masih jalan
- [ ] KekayaanTab self-render OK tanpa parent FinansialTab
- [ ] GoalsTab self-render OK tanpa parent props

---

## Migration & Rollout

1. **Single commit** — semua perubahan IA dalam satu PR (atomic)
2. **No DB migration** — perubahan murni client-side routing
3. **Bookmark preservation** — `/finansial` redirect tetap ada minimal 1 milestone (v1.2 → v1.3 baru hapus)
4. **Deploy** — Vercel auto-deploy 15-30s, tidak butuh blue-green

---

## Risks

| Risk | Mitigation |
|---|---|
| Bookmark user lama ke `/finansial` rusak | Redirect ke `/kekayaan` |
| Query string lama (`?tab=goals`) hilang | Acceptable loss — UX tetap workable |
| Sidebar jadi panjang di mobile | Sudah ada `sidebar-mobile-collapsed` mechanism — verify masih OK setelah +3 item |
| `recurring_transactions.next_run_date` field tidak exist | Plan phase verifikasi schema sebelum implement badge query; fallback dot indicator jika field absent |
| Lucide icon `Landmark` / `BookOpen` not imported elsewhere | Tambah ke import statement, tidak ada conflict |

---

## Out of Scope (followup ideas)

- Settings split admin/user route
- CSV import/export untuk Notes/Goals/Net Worth
- Recurring jadi menu sendiri (jika usage data nanti justify)
- Pensiun demote/restructure
- Notes contextual linking ke goal/investasi/periode gaji
