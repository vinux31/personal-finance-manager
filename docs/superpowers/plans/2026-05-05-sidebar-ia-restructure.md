# Sidebar IA Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrukturisasi sidebar — bubarkan `/finansial`, promote Periode Gaji jadi menu sendiri, surface Panduan, tambah badge recurring due di Transaksi.

**Architecture:** Menu config (`navConfig.ts`) tetap jadi single source of truth, di-extend dengan optional `badge` field. AppSidebar render badge dengan query react-query (reuse `useUpcomingBills` yang sudah ada, filter `next_due_date <= today`). FinansialTab dibubarkan, KekayaanTab & GoalsTab jadi route element langsung. Backward compat via `<Navigate>` redirect dari `/finansial` ke `/kekayaan`.

**Tech Stack:** React 19, react-router-dom@7, @tanstack/react-query@5, lucide-react, shadcn sidebar primitives, Supabase. **No test framework** — manual UAT per task, verifikasi via dev server (`npm run dev`).

**Spec:** `docs/superpowers/specs/2026-05-05-sidebar-ia-restructure-design.md`

---

## File Map

**Create:**
- `src/queries/recurringDueCount.ts` — thin wrapper hook untuk count recurring due today
- `src/tabs/PeriodeGajiTab.tsx` — minimal route element untuk `/periode-gaji`

**Modify:**
- `src/shell/navConfig.ts` — restructure NAV_GROUPS, tambah optional `badge` field
- `src/shell/AppSidebar.tsx` — render badge + footer separator
- `src/routes.tsx` — tambah route baru, redirect `/finansial`
- `src/tabs/ReportsTab.tsx` — hapus tab Periode Gaji
- `src/tabs/GoalsTab.tsx` — hapus props-based filter (jadi self-contained)

**Delete:**
- `src/tabs/FinansialTab.tsx` — wrapper kosong

---

## Task 1: Hook `useRecurringDueCount`

**Files:**
- Create: `src/queries/recurringDueCount.ts`

- [ ] **Step 1: Create hook file**

Reuse data flow dari `useUpcomingBills` (yang return bills `next_due_date <= endOfMonth`). Untuk "due", filter `next_due_date <= today`.

`src/queries/recurringDueCount.ts`:

```typescript
import { useUpcomingBills } from '@/queries/recurringTransactions'
import { todayISO } from '@/lib/format'

export function useRecurringDueCount(): number {
  const { data } = useUpcomingBills()
  if (!data) return 0
  const today = todayISO()
  return data.filter((b) => b.next_due_date <= today).length
}
```

- [ ] **Step 2: Verify TypeScript compile**

Run: `npm run build`
Expected: build succeeds (atau eslint-only warning, tidak ada error). Kalau error, baca pesan dan fix.

- [ ] **Step 3: Commit**

```bash
git add src/queries/recurringDueCount.ts
git commit -m "feat(sidebar): add useRecurringDueCount hook for badge count"
```

---

## Task 2: Update `NavItem` type and restructure `NAV_GROUPS`

**Files:**
- Modify: `src/shell/navConfig.ts`

- [ ] **Step 1: Replace navConfig.ts entirely**

`src/shell/navConfig.ts`:

```typescript
import {
  LayoutDashboard,
  Wallet,
  Calendar,
  BarChart3,
  StickyNote,
  TrendingUp,
  Landmark,
  Target,
  PiggyBank,
  BookOpen,
  Settings as SettingsIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavBadge = 'recurring-due'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  badge?: NavBadge
}

export type NavGroup = {
  label?: string
  items: NavItem[]
  isFooter?: boolean
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
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
    isFooter: true,
    items: [
      { to: '/panduan', label: 'Panduan', icon: BookOpen },
      { to: '/pengaturan', label: 'Pengaturan', icon: SettingsIcon },
    ],
  },
]
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds. Kalau ada error import (Calendar/Landmark/BookOpen tidak exist di lucide-react versi terinstall) — verifikasi `node_modules/lucide-react/dist/lucide-react.d.ts` punya icon-icon ini. Lucide-react umum punya semuanya. Jika `Landmark` tidak ada, fallback ke `Building2`.

- [ ] **Step 3: Commit**

```bash
git add src/shell/navConfig.ts
git commit -m "feat(sidebar): restructure nav groups — Aset/Tujuan, footer, badges"
```

---

## Task 3: Update `AppSidebar` to render badges and footer separator

**Files:**
- Modify: `src/shell/AppSidebar.tsx`

- [ ] **Step 1: Replace AppSidebar.tsx entirely**

`src/shell/AppSidebar.tsx`:

```typescript
import { useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar'
import { NAV_GROUPS, type NavBadge } from './navConfig'
import { useRecurringDueCount } from '@/queries/recurringDueCount'

function BadgeValue({ badge }: { badge: NavBadge }) {
  const recurringDue = useRecurringDueCount()
  if (badge === 'recurring-due') {
    if (recurringDue <= 0) return null
    return (
      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground group-data-[collapsible=icon]:hidden">
        {recurringDue > 99 ? '99+' : recurringDue}
      </span>
    )
  }
  return null
}

function SidebarNavItem({
  to,
  label,
  Icon,
  badge,
  onNavigate,
}: {
  to: string
  label: string
  Icon: LucideIcon
  badge?: NavBadge
  onNavigate: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const isActive =
    location.pathname === to || location.pathname.startsWith(to + '/')

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={label} isActive={isActive}>
        <a
          href={to}
          onClick={(e) => {
            e.preventDefault()
            onNavigate()
            navigate(to)
          }}
        >
          <Icon />
          <span>{label}</span>
          {badge && <BadgeValue badge={badge} />}
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export default function AppSidebar() {
  const { setOpenMobile } = useSidebar()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader
        className="text-white"
        style={{
          background:
            'linear-gradient(135deg, var(--brand-header), var(--brand-header-end))',
        }}
      >
        <div className="flex items-center gap-3 px-2 py-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #818cf8, #6366f1)' }}
          >
            ₱
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-bold tracking-tight">Kantong Pintar</div>
            <div className="text-[10px] opacity-70">Personal Finance</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group, idx) => (
          <SidebarGroup
            key={idx}
            className={group.isFooter ? 'mt-auto border-t border-sidebar-border pt-2' : undefined}
          >
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ to, label, icon: Icon, badge }) => (
                  <SidebarNavItem
                    key={to}
                    to={to}
                    label={label}
                    Icon={Icon}
                    badge={badge}
                    onNavigate={() => setOpenMobile(false)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
```

Catatan: `mt-auto` di footer group push grup terakhir ke bottom. `border-t border-sidebar-border pt-2` kasih visual separator. Hidden saat collapsed via existing `group-data-[collapsible=icon]:hidden` di komponen badge.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/shell/AppSidebar.tsx
git commit -m "feat(sidebar): render badge + footer separator"
```

---

## Task 4: Create `PeriodeGajiTab` route element

**Files:**
- Create: `src/tabs/PeriodeGajiTab.tsx`

- [ ] **Step 1: Write file**

`src/tabs/PeriodeGajiTab.tsx`:

```typescript
import { PayPeriodList } from '@/components/PayPeriodList'

export default function PeriodeGajiTab() {
  return (
    <div className="space-y-6">
      <PayPeriodList />
    </div>
  )
}
```

Wrapper minimal — preserve consistent spacing dengan tab lain (`space-y-6`).

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/tabs/PeriodeGajiTab.tsx
git commit -m "feat(periode-gaji): add standalone tab component"
```

---

## Task 5: Make `GoalsTab` self-contained (remove props)

**Files:**
- Modify: `src/tabs/GoalsTab.tsx`

- [ ] **Step 1: Edit lines 17-31**

Open `src/tabs/GoalsTab.tsx`. Replace:

```typescript
type GoalsTabProps = {
  filters?: GoalFilters
  onFiltersChange?: (f: GoalFilters) => void
}

export default function GoalsTab({ filters: filtersProp, onFiltersChange }: GoalsTabProps = {}) {
  const [editing, setEditing] = useState<Goal | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addMoneyFor, setAddMoneyFor] = useState<GoalWithProgress | null>(null)
  const [addMoneyOpen, setAddMoneyOpen] = useState(false)
  const [linkFor, setLinkFor] = useState<Goal | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<GoalFilters>({})
  const filters = filtersProp ?? localFilters
  const setFilters = onFiltersChange ?? setLocalFilters
```

With:

```typescript
export default function GoalsTab() {
  const [editing, setEditing] = useState<Goal | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addMoneyFor, setAddMoneyFor] = useState<GoalWithProgress | null>(null)
  const [addMoneyOpen, setAddMoneyOpen] = useState(false)
  const [linkFor, setLinkFor] = useState<Goal | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [filters, setFilters] = useState<GoalFilters>({})
```

Hapus juga import `GoalFilters` jika hanya dipakai di props (cek line 2 — `type GoalFilters` tetap dipakai untuk `useState`, jangan dihapus).

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds. Jika error "GoalFilters used as type but only imported", verifikasi import line tetap include `GoalFilters`.

- [ ] **Step 3: Commit**

```bash
git add src/tabs/GoalsTab.tsx
git commit -m "refactor(goals): self-contained filter state, drop parent props"
```

---

## Task 6: Strip Periode Gaji tab from `ReportsTab`

**Files:**
- Modify: `src/tabs/ReportsTab.tsx`

- [ ] **Step 1: Remove PayPeriodList import**

Edit line 3 (`import { PayPeriodList } from '@/components/PayPeriodList'`). Hapus baris itu.

- [ ] **Step 2: Remove outer Tabs wrapper**

Edit lines 132-141. Replace:

```typescript
  return (
    <Tabs defaultValue="laporan">
      <TabsList className="mb-4">
        <TabsTrigger value="laporan">Laporan</TabsTrigger>
        <TabsTrigger value="periode-gaji">Periode Gaji</TabsTrigger>
      </TabsList>
      <TabsContent value="periode-gaji">
        <PayPeriodList />
      </TabsContent>
      <TabsContent value="laporan">
    <div className="space-y-6">
```

With:

```typescript
  return (
    <div className="space-y-6">
```

- [ ] **Step 3: Find matching closing tags**

Cari closing `</TabsContent>` dan `</Tabs>` yang match outer wrapper di akhir return statement. Hapus keduanya. Wajib match indentation supaya `<div className="space-y-6">` jadi root return.

Run grep dulu untuk confirm jumlah `</TabsContent>` dan `</Tabs>`:
Run: `grep -n "</TabsContent>\|</Tabs>" src/tabs/ReportsTab.tsx`
Expected: hanya yang inner (untuk tab nested di dalam laporan, kalau ada). Jika hanya outer wrapper yang punya, sisakan yang berkaitan dengan content laporan saja.

- [ ] **Step 4: Verify import `Tabs/TabsList/TabsTrigger/TabsContent`**

Cek line 2 — kalau import-nya tidak dipakai lagi setelah strip, hapus. Kalau masih dipakai di inner tabs (misal pie/bar chart tabs), biarkan. Run grep:
Run: `grep -n "TabsTrigger\|TabsList\|TabsContent\|<Tabs " src/tabs/ReportsTab.tsx`

Jika count = 0, hapus import. Jika > 0, biarkan.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/tabs/ReportsTab.tsx
git commit -m "refactor(laporan): hapus tab Periode Gaji — pindah ke menu sendiri"
```

---

## Task 7: Update routes — add new, redirect `/finansial`

**Files:**
- Modify: `src/routes.tsx`

- [ ] **Step 1: Replace routes.tsx entirely**

`src/routes.tsx`:

```typescript
import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppShell from '@/shell/AppShell'
import DashboardTab from '@/tabs/DashboardTab'
import TransactionsTab from '@/tabs/TransactionsTab'
import ReportsTab from '@/tabs/ReportsTab'
import NotesTab from '@/tabs/NotesTab'
import InvestmentsTab from '@/tabs/InvestmentsTab'
import PensiunTab from '@/tabs/PensiunTab'
import KekayaanTab from '@/tabs/KekayaanTab'
import GoalsTab from '@/tabs/GoalsTab'
import PeriodeGajiTab from '@/tabs/PeriodeGajiTab'
import SettingsTab from '@/tabs/SettingsTab'
import PanduanFullPage from '@/components/PanduanFullPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardTab /> },
      { path: 'transaksi', element: <TransactionsTab /> },
      { path: 'periode-gaji', element: <PeriodeGajiTab /> },
      { path: 'laporan', element: <ReportsTab /> },
      { path: 'catatan', element: <NotesTab /> },
      { path: 'investasi', element: <InvestmentsTab /> },
      { path: 'kekayaan', element: <KekayaanTab /> },
      { path: 'goals', element: <GoalsTab /> },
      { path: 'pensiun', element: <PensiunTab /> },
      { path: 'finansial', element: <Navigate to="/kekayaan" replace /> },
      { path: 'pengaturan', element: <SettingsTab /> },
      { path: 'panduan', element: <PanduanFullPage /> },
      { path: 'panduan/:slug', element: <PanduanFullPage /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds. Jika error "Cannot find module '@/tabs/FinansialTab'", lanjut Task 8 yang akan delete file. Tapi karena kita SUDAH hapus import-nya, error tidak akan muncul.

- [ ] **Step 3: Commit**

```bash
git add src/routes.tsx
git commit -m "feat(router): tambah /kekayaan /goals /periode-gaji, redirect /finansial"
```

---

## Task 8: Delete `FinansialTab.tsx`

**Files:**
- Delete: `src/tabs/FinansialTab.tsx`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -rn "FinansialTab" src/`
Expected: tidak ada hasil. Kalau masih ada, fix dulu sebelum hapus.

- [ ] **Step 2: Delete file**

Run: `git rm src/tabs/FinansialTab.tsx`

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: hapus FinansialTab — wrapper kosong tidak lagi dipakai"
```

---

## Task 9: Manual UAT

**Files:** N/A (verifikasi visual + interaksi)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: vite running di `http://localhost:5173`. Buka di browser.

- [ ] **Step 2: Verify sidebar structure**

Login, lihat sidebar. Konfirmasi:
- [ ] Dashboard (no group label) di paling atas
- [ ] Grup "Keuangan": Transaksi, Periode Gaji, Laporan, Catatan
- [ ] Grup "Aset": Investasi, Kekayaan
- [ ] Grup "Tujuan": Goals, Pensiun
- [ ] Footer (no label, dengan border separator atas, di bottom): Panduan, Pengaturan
- [ ] Tidak ada menu "Finansial"

- [ ] **Step 3: Verify navigation**

Klik tiap menu, konfirmasi URL & content:
- [ ] `/dashboard` — Dashboard
- [ ] `/transaksi` — Transaksi
- [ ] `/periode-gaji` — PayPeriodList (standalone)
- [ ] `/laporan` — Laporan **tanpa tab "Periode Gaji"**
- [ ] `/catatan` — Notes
- [ ] `/investasi` — Investments
- [ ] `/kekayaan` — Net Worth (eks-sub-tab)
- [ ] `/goals` — Goals (eks-sub-tab)
- [ ] `/pensiun` — Pensiun (3 sub-tab tetap)
- [ ] `/panduan` — PanduanFullPage
- [ ] `/pengaturan` — Settings

- [ ] **Step 4: Verify redirect**

Manual ketik URL `/finansial` di browser address bar.
Expected: redirect otomatis ke `/kekayaan`.

- [ ] **Step 5: Verify wildcard fallback**

Manual ketik URL `/halaman-tidak-ada`.
Expected: redirect ke `/dashboard`.

- [ ] **Step 6: Verify recurring badge**

Buka Pengaturan atau Transaksi, gunakan tombol Recurring → tambah 1 template recurring dengan `next_due_date` = hari ini atau lebih lama.
Reload halaman. Lihat sidebar item Transaksi.
Expected: badge merah di kanan label "Transaksi" dengan angka >= 1.

Kalau tidak punya data recurring due, ini OK — verifikasi badge tidak render saat count = 0.

- [ ] **Step 7: Verify mobile collapsed sidebar**

Resize browser window ke <768px atau pakai DevTools mobile emulation.
Expected: sidebar collapse jadi hamburger; klik membuka drawer; semua menu accessible; footer tetap di bottom.

- [ ] **Step 8: Verify icon-collapsed mode (desktop)**

Pakai tombol toggle sidebar untuk masuk ke icon-only mode.
Expected: hanya icon yang terlihat, label & badge hidden, tooltip muncul saat hover.

- [ ] **Step 9: Regression check**

- [ ] Dashboard `PayPeriodCard` masih render dengan periode aktif
- [ ] `/transaksi` filter periode gaji aktif masih auto-applied (kalau ada periode aktif)
- [ ] `/laporan` range filter masih auto-apply periode aktif (kalau ada)
- [ ] `KekayaanTab` render dengan summary aset, liabilitas, snapshot chart
- [ ] `GoalsTab` filter status select masih jalan, CRUD goal masih jalan

- [ ] **Step 10: If any issue found**

Catat issue, kembali ke task yang relevan, fix dengan commit terpisah `fix(uat): <description>`. Jangan amend.

---

## Self-Review Checklist (untuk reviewer plan)

**Spec coverage:**
- ✅ Issue 1 (naming collision) — Task 2 (rename grup) + Task 8 (hapus FinansialTab)
- ✅ Issue 2 (`/finansial` container kosong) — Task 7 (redirect) + Task 8 (delete)
- ✅ Issue 3 (Periode Gaji terkubur) — Task 4 + Task 6 + Task 7
- ✅ Issue 4 (Panduan hidden) — Task 2 (footer entry)
- ✅ Issue 5 (Recurring tanpa entry) — Task 1 + Task 3 (badge)
- ✅ Backward compat redirect — Task 7

**Type consistency:** `NavItem.badge` (Task 2) → `BadgeValue badge` prop (Task 3) → `useRecurringDueCount` return number (Task 1). Match.

**Schema correction:** Spec menyebut `next_run_date` — actual schema `next_due_date` (verified `src/db/recurringTransactions.ts:13, 84-97`). Plan pakai field yang benar.

**No test framework:** Project tidak punya vitest/jest. UAT manual via dev server (Task 9) — konsisten dengan pattern existing plans di repo ini.
