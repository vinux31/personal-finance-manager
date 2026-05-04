# Sidebar Vertikal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti navigasi `Tabs` horizontal menjadi sidebar vertikal kiri (shadcn `Sidebar` + custom theming brand) dengan migrasi state navigasi ke React Router v7 (URL-based).

**Architecture:** SPA Vite + React 19. Layout baru: `<RouterProvider>` → `<AppShell>` (`<SidebarProvider>` + `<Sidebar>` + `<SidebarInset>` berisi `<AppTopBar>` + `<Outlet/>`). `OfflineBanner`/`ViewAsBanner` dirender di paling atas `AppShell`. Navigasi single source of truth di `src/shell/navConfig.ts`. Active state pakai `<NavLink>` + `data-active` shadcn. Persistence collapse via cookie default shadcn (`sidebar:state`). Mobile drawer auto-close dengan bind `setOpenMobile(false)` di `onClick` `<NavLink>`.

**Tech Stack:** React 19, React Router v7 (`react-router-dom`), shadcn Sidebar block, Tailwind CSS 4, lucide-react, TypeScript 6.

**Project context:** No test framework (verifikasi via `npm run lint`, `npm run build`, dan manual UAT di browser). Commit per task; pesan commit dalam bahasa Indonesia bergaya conventional commits.

**Spec:** `docs/superpowers/specs/2026-05-04-sidebar-vertical-design.md`

---

## File Structure

### Files to CREATE

| File | Tanggung jawab |
|---|---|
| `src/shell/navConfig.ts` | Single source of truth: nav items + grouping. |
| `src/shell/AppSidebar.tsx` | Sidebar component: header brand gradient + 3 grup menu + footer. |
| `src/shell/AppTopBar.tsx` | Top bar: `<SidebarTrigger>` + badge bulan + `<AccountMenu>`. |
| `src/shell/AppShell.tsx` | Layout wrapper: banners + `<SidebarProvider>` + `<Sidebar>` + `<SidebarInset>` + `<Outlet/>`. |
| `src/routes.tsx` | `createBrowserRouter` definition. |
| `src/components/ui/sidebar.tsx` | shadcn auto-generated. |
| `src/components/ui/sheet.tsx` | shadcn auto-generated (deps Sidebar). |
| `src/components/ui/tooltip.tsx` | shadcn auto-generated (deps Sidebar). |
| `src/components/ui/separator.tsx` | shadcn auto-generated (deps Sidebar). |
| `src/components/ui/skeleton.tsx` | shadcn auto-generated (deps Sidebar). |

### Files to MODIFY

| File | Perubahan |
|---|---|
| `src/App.tsx` | Rewrite total → `<RouterProvider>` setelah auth check. |
| `src/index.css` | Override token `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-primary` ke warna brand di `:root` dan `.dark`. |
| `src/components/PanduanFullPage.tsx` | Ganti `useTabStore` & `usePanduanStore` → React Router (`useNavigate`, `useParams`). |
| `src/components/PanduanWelcomeCard.tsx` | Ganti `usePanduanStore.openPanduan()` → `useNavigate()('/panduan')`. |
| `package.json` | Tambah `react-router-dom`. |

### Files to DELETE

| File | Alasan |
|---|---|
| `src/lib/tabStore.ts` | State tab pindah ke URL. |
| `src/lib/panduanStore.ts` | State open/slug pindah ke URL (`/panduan/:slug?`). |

### Files NOT modified (untuk referensi)

- `src/main.tsx`, `src/auth/*`, `src/tabs/*` (semua tab page), `src/components/OfflineBanner.tsx`, `src/components/ViewAsBanner.tsx`, `src/components/AccountMenu.tsx`, `src/components/LoginScreen.tsx`.

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`, `package-lock.json` (auto)
- Create: `src/components/ui/sidebar.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/tooltip.tsx`, `src/components/ui/separator.tsx`, `src/components/ui/skeleton.tsx` (semua via shadcn CLI)

- [ ] **Step 1: Install React Router v7**

Run:
```bash
npm install react-router-dom
```

Expected: `react-router-dom` ditambahkan ke `dependencies` (versi 7.x atau lebih baru).

- [ ] **Step 2: Verifikasi versi**

Run:
```bash
node -e "console.log(require('./package.json').dependencies['react-router-dom'])"
```

Expected: output versi `^7.x.x` (jika hasil berbeda, beri tahu user; lanjutkan saja jika tetap v7).

- [ ] **Step 3: Tambah komponen shadcn Sidebar (auto-install dependency)**

Run:
```bash
npx shadcn@latest add sidebar
```

Expected:
- Prompt akan muncul kalau ada conflict — pilih default (overwrite tidak diperlukan karena belum ada).
- File baru muncul di `src/components/ui/`: `sidebar.tsx`, `sheet.tsx`, `tooltip.tsx`, `separator.tsx`, `skeleton.tsx`.

- [ ] **Step 4: Verifikasi file shadcn**

Run:
```bash
ls src/components/ui/sidebar.tsx src/components/ui/sheet.tsx src/components/ui/tooltip.tsx src/components/ui/separator.tsx src/components/ui/skeleton.tsx
```

Expected: 5 file ada, tanpa error.

- [ ] **Step 5: Verifikasi build masih hijau**

Run:
```bash
npm run build
```

Expected: build sukses (TypeScript + Vite, tanpa error). Komponen baru belum digunakan, jadi tidak ada masalah.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/ui/sidebar.tsx src/components/ui/sheet.tsx src/components/ui/tooltip.tsx src/components/ui/separator.tsx src/components/ui/skeleton.tsx
git commit -m "chore(deps): install react-router-dom + shadcn sidebar components"
```

---

## Task 2: Override token sidebar shadcn ke warna brand

**Files:**
- Modify: `src/index.css` (di blok `:root` setelah baris ~90, dan `.dark` setelah baris ~137)

- [ ] **Step 1: Tambah override token di `:root`**

Edit `src/index.css`. Cari blok `:root { ... }`. Setelah baris `--sidebar-ring: oklch(0.708 0 0);`, **tambahkan** sebelum penutup `}`:

```css
    /* Sidebar — override ke warna brand */
    --sidebar-accent: var(--brand-light);
    --sidebar-accent-foreground: var(--brand-dark);
    --sidebar-primary: var(--brand);
    --sidebar-primary-foreground: oklch(1 0 0);
```

- [ ] **Step 2: Tambah override token di `.dark`**

Cari blok `.dark { ... }`. Setelah baris `--sidebar-ring: oklch(0.556 0 0);`, **tambahkan** sebelum penutup `}`:

```css
    /* Sidebar — override ke warna brand (dark) */
    --sidebar-accent: oklch(0.488 0.243 264.376 / 0.18);
    --sidebar-accent-foreground: var(--brand);
    --sidebar-primary: var(--brand);
    --sidebar-primary-foreground: oklch(1 0 0);
```

- [ ] **Step 3: Verifikasi build**

Run:
```bash
npm run build
```

Expected: build sukses, tidak ada warning CSS variable.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "style(sidebar): override token shadcn sidebar ke warna brand indigo"
```

---

## Task 3: Buat `navConfig.ts`

**Files:**
- Create: `src/shell/navConfig.ts`

- [ ] **Step 1: Buat direktori `src/shell/`**

Run:
```bash
mkdir -p src/shell
```

Expected: direktori dibuat tanpa error (atau sudah ada).

- [ ] **Step 2: Buat file `src/shell/navConfig.ts` dengan konten lengkap**

Tulis file `src/shell/navConfig.ts`:

```ts
import {
  LayoutDashboard,
  Wallet,
  BarChart3,
  StickyNote,
  TrendingUp,
  PiggyBank,
  Target,
  Settings as SettingsIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

export type NavGroup = {
  label?: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Keuangan',
    items: [
      { to: '/transaksi', label: 'Transaksi', icon: Wallet },
      { to: '/laporan', label: 'Laporan', icon: BarChart3 },
      { to: '/catatan', label: 'Catatan', icon: StickyNote },
    ],
  },
  {
    label: 'Kekayaan',
    items: [
      { to: '/investasi', label: 'Investasi', icon: TrendingUp },
      { to: '/pensiun', label: 'Pensiun', icon: PiggyBank },
      { to: '/finansial', label: 'Finansial', icon: Target },
    ],
  },
  {
    items: [{ to: '/pengaturan', label: 'Pengaturan', icon: SettingsIcon }],
  },
]
```

- [ ] **Step 3: Verifikasi TypeScript**

Run:
```bash
npx tsc --noEmit
```

Expected: clean, tidak ada error type.

- [ ] **Step 4: Commit**

```bash
git add src/shell/navConfig.ts
git commit -m "feat(shell): tambah navConfig — single source of truth menu sidebar"
```

---

## Task 4: Buat `AppTopBar.tsx`

**Files:**
- Create: `src/shell/AppTopBar.tsx`

- [ ] **Step 1: Buat file dengan konten lengkap**

Tulis file `src/shell/AppTopBar.tsx`:

```tsx
import { SidebarTrigger } from '@/components/ui/sidebar'
import AccountMenu from '@/components/AccountMenu'

export default function AppTopBar() {
  const monthLabel = new Date().toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
      <div className="flex items-center gap-3">
        <span
          className="hidden rounded-full px-3 py-1 text-[11px] sm:block"
          style={{
            background: 'rgba(165,180,252,0.15)',
            color: 'var(--brand-muted)',
          }}
        >
          {monthLabel}
        </span>
        <AccountMenu />
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Verifikasi TypeScript**

Run:
```bash
npx tsc --noEmit
```

Expected: clean (komponen ini import `SidebarTrigger` dari `@/components/ui/sidebar` yang sudah dibuat di Task 1).

- [ ] **Step 3: Commit**

```bash
git add src/shell/AppTopBar.tsx
git commit -m "feat(shell): tambah AppTopBar — trigger sidebar + badge bulan + AccountMenu"
```

---

## Task 5: Buat `AppSidebar.tsx`

**Files:**
- Create: `src/shell/AppSidebar.tsx`

**Pendekatan teknis (penting):** kita tidak pakai `<NavLink>` langsung di dalam `<SidebarMenuButton asChild>` karena `data-active` perlu disetel di `SidebarMenuButton` (bukan di anchor). Jadi kita pakai `useLocation()` untuk hitung `isActive` lalu kirim ke prop `isActive` bawaan `SidebarMenuButton`. Anchor pakai `<a href>` + `onClick` `e.preventDefault()` + `navigate(to)` agar tetap menghasilkan link semantik (dengan URL terlihat saat hover) tapi navigasi via React Router (no full page reload).

- [ ] **Step 1: Buat file dengan konten lengkap**

Tulis file `src/shell/AppSidebar.tsx` dengan isi:

```tsx
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
import { NAV_GROUPS } from './navConfig'

function SidebarNavItem({
  to,
  label,
  Icon,
  onNavigate,
}: {
  to: string
  label: string
  Icon: LucideIcon
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
          <SidebarGroup key={idx}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ to, label, icon: Icon }) => (
                  <SidebarNavItem
                    key={to}
                    to={to}
                    label={label}
                    Icon={Icon}
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

- [ ] **Step 2: Verifikasi TypeScript**

Run:
```bash
npx tsc --noEmit
```

Expected: clean. Kalau ada error tentang `isActive` prop pada `SidebarMenuButton`, periksa shadcn versi — beberapa versi pakai prop berbeda. Cara verifikasi cepat:
```bash
grep -n "isActive\|data-active" src/components/ui/sidebar.tsx
```
Kalau prop tidak bernama `isActive`, gunakan `data-active={isActive ? 'true' : undefined}` langsung sebagai props HTML (di-spread ke `<a>`).

- [ ] **Step 3: Commit**

```bash
git add src/shell/AppSidebar.tsx
git commit -m "feat(shell): tambah AppSidebar — header brand + 3 grup menu collapsible"
```

---

## Task 6: Buat `AppShell.tsx`

**Files:**
- Create: `src/shell/AppShell.tsx`

- [ ] **Step 1: Buat file dengan konten lengkap**

Tulis file `src/shell/AppShell.tsx`:

```tsx
import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import AppSidebar from './AppSidebar'
import AppTopBar from './AppTopBar'
import OfflineBanner from '@/components/OfflineBanner'
import ViewAsBanner from '@/components/ViewAsBanner'

export default function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <OfflineBanner />
      <ViewAsBanner />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppTopBar />
          <main className="p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
```

- [ ] **Step 2: Verifikasi TypeScript**

Run:
```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/shell/AppShell.tsx
git commit -m "feat(shell): tambah AppShell — layout wrapper sidebar + top bar + outlet"
```

---

## Task 7: Buat `routes.tsx`

**Files:**
- Create: `src/routes.tsx`

- [ ] **Step 1: Buat file dengan konten lengkap**

Tulis file `src/routes.tsx`:

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppShell from '@/shell/AppShell'
import DashboardTab from '@/tabs/DashboardTab'
import TransactionsTab from '@/tabs/TransactionsTab'
import ReportsTab from '@/tabs/ReportsTab'
import NotesTab from '@/tabs/NotesTab'
import InvestmentsTab from '@/tabs/InvestmentsTab'
import PensiunTab from '@/tabs/PensiunTab'
import FinansialTab from '@/tabs/FinansialTab'
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
      { path: 'laporan', element: <ReportsTab /> },
      { path: 'catatan', element: <NotesTab /> },
      { path: 'investasi', element: <InvestmentsTab /> },
      { path: 'pensiun', element: <PensiunTab /> },
      { path: 'finansial', element: <FinansialTab /> },
      { path: 'pengaturan', element: <SettingsTab /> },
      { path: 'panduan', element: <PanduanFullPage /> },
      { path: 'panduan/:slug', element: <PanduanFullPage /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
```

- [ ] **Step 2: Verifikasi TypeScript**

Run:
```bash
npx tsc --noEmit
```

Expected: clean (semua tab page sudah ada).

- [ ] **Step 3: Commit**

```bash
git add src/routes.tsx
git commit -m "feat(router): tambah routes.tsx — browser router dengan AppShell + 9 child routes"
```

---

## Task 8: Update `PanduanWelcomeCard.tsx` (lepas `usePanduanStore`)

**Files:**
- Modify: `src/components/PanduanWelcomeCard.tsx` (line 3, 6, 25)

- [ ] **Step 1: Replace import + handler**

Edit `src/components/PanduanWelcomeCard.tsx`. Ganti seluruh isi file dengan:

```tsx
import { ArrowRight, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function PanduanWelcomeCard() {
  const navigate = useNavigate()

  return (
    <div className="rounded-xl border border-[var(--brand-muted)] bg-card p-5">
      <div className="flex items-start gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--brand-light)' }}
        >
          <BookOpen className="h-5 w-5 text-[var(--brand)]" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold">Panduan Penggunaan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pelajari cara pakai semua fitur Kantong Pintar lewat tutorial step-by-step.
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => navigate('/panduan')}>
          Lihat Panduan Lengkap
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verifikasi tidak ada importer `usePanduanStore` di file ini**

Run:
```bash
grep -n "usePanduanStore\|panduanStore" src/components/PanduanWelcomeCard.tsx
```

Expected: tidak ada output (zero match).

- [ ] **Step 3: Commit**

```bash
git add src/components/PanduanWelcomeCard.tsx
git commit -m "refactor(panduan): PanduanWelcomeCard pakai useNavigate ganti panduanStore"
```

---

## Task 9: Update `PanduanFullPage.tsx` (lepas `useTabStore` & `usePanduanStore`)

**Files:**
- Modify: `src/components/PanduanFullPage.tsx` (line 13-14, 29-30, 36-39, 41-44)

- [ ] **Step 1: Ganti import & state hooks**

Edit `src/components/PanduanFullPage.tsx`. Ganti baris 13-14:

```diff
- import { usePanduanStore } from '@/lib/panduanStore'
- import { useTabStore } from '@/lib/tabStore'
+ import { useNavigate, useParams } from 'react-router-dom'
```

Ganti baris 29-30 (di dalam `export default function PanduanFullPage()`):

```diff
-   const { activeSlug, setActiveSlug, close } = usePanduanStore()
-   const { setActiveTab } = useTabStore()
+   const { slug: activeSlug = null } = useParams<{ slug?: string }>()
+   const navigate = useNavigate()
```

Ganti `handleBack` (baris 36-39):

```diff
  function handleBack() {
-   close()
-   setActiveTab('settings')
+   navigate('/pengaturan')
  }
```

Ganti `handleSelectSlug` (baris 41-44):

```diff
  function handleSelectSlug(slug: string) {
-   setActiveSlug(slug)
+   navigate(`/panduan/${slug}`)
    contentRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }
```

- [ ] **Step 2: Verifikasi tidak ada importer store lama di file ini**

Run:
```bash
grep -n "usePanduanStore\|useTabStore\|panduanStore\|tabStore" src/components/PanduanFullPage.tsx
```

Expected: tidak ada output.

- [ ] **Step 3: Verifikasi TypeScript**

Run:
```bash
npx tsc --noEmit
```

Expected: clean. Kalau ada error tentang `activeSlug` type, pastikan declared `useParams<{ slug?: string }>()` returns `string | undefined` lalu fallback ke `null` dengan default destructure.

- [ ] **Step 4: Commit**

```bash
git add src/components/PanduanFullPage.tsx
git commit -m "refactor(panduan): PanduanFullPage pakai react-router params ganti store"
```

---

## Task 10: Rewrite `App.tsx` jadi `<RouterProvider>`

**Files:**
- Modify: `src/App.tsx` (rewrite total)

- [ ] **Step 1: Ganti seluruh isi `src/App.tsx`**

Tulis ulang `src/App.tsx`:

```tsx
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { Toaster } from '@/components/ui/sonner'
import LoginScreen from '@/components/LoginScreen'
import { useAuth } from '@/auth/useAuth'

function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-muted-foreground text-sm">Memuat...</span>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <LoginScreen />
        <Toaster richColors position="top-right" />
      </>
    )
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </>
  )
}

export default App
```

- [ ] **Step 2: Verifikasi tidak ada importer store lama di file ini**

Run:
```bash
grep -n "useTabStore\|usePanduanStore\|tabStore\|panduanStore" src/App.tsx
```

Expected: tidak ada output.

- [ ] **Step 3: Verifikasi TypeScript**

Run:
```bash
npx tsc --noEmit
```

Expected: clean. Aplikasi seharusnya sudah bisa di-build sekarang.

- [ ] **Step 4: Verifikasi build**

Run:
```bash
npm run build
```

Expected: build sukses.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): rewrite App.tsx jadi RouterProvider — sidebar layout aktif"
```

---

## Task 11: Hapus `tabStore.ts` & `panduanStore.ts`

**Files:**
- Delete: `src/lib/tabStore.ts`, `src/lib/panduanStore.ts`

- [ ] **Step 1: Verifikasi tidak ada importer tersisa**

Run:
```bash
grep -rn "tabStore\|panduanStore" src/ --include="*.tsx" --include="*.ts"
```

Expected: tidak ada output. Kalau ada, fix dulu importer-nya sebelum lanjut.

- [ ] **Step 2: Hapus file**

Run:
```bash
rm src/lib/tabStore.ts src/lib/panduanStore.ts
```

- [ ] **Step 3: Verifikasi build**

Run:
```bash
npm run build
```

Expected: build sukses (TypeScript akan complain kalau ada importer tersisa — confirmed clean).

- [ ] **Step 4: Verifikasi lint**

Run:
```bash
npm run lint
```

Expected: clean (atau hanya warning yang sudah ada sebelumnya).

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/
git commit -m "chore: hapus tabStore & panduanStore — diganti react-router URL state"
```

---

## Task 12: Manual UAT browser testing

**Files:**
- Test: jalankan dev server, verifikasi di browser

- [ ] **Step 1: Jalankan dev server**

Run:
```bash
npm run dev
```

Expected: Vite dev server jalan di `http://localhost:5173` (atau port lain — perhatikan output).

- [ ] **Step 2: Login & verifikasi redirect**

Browser actions:
1. Buka URL dev server.
2. Login (Google atau email).
3. Setelah login sukses, URL otomatis menjadi `/dashboard` (redirect dari `/`).

Expected: tab Dashboard tampil dengan sidebar di kiri + top bar tipis di atas.

- [ ] **Step 3: Klik setiap menu, cek URL berubah & konten benar**

Klik berurutan: Dashboard → Transaksi → Laporan → Catatan → Investasi → Pensiun → Finansial → Pengaturan.

Expected:
- URL berubah sesuai (mis. `/transaksi`, `/laporan`, dst.).
- Konten tab sesuai.
- Active state (warna brand) di item sidebar yang aktif.

- [ ] **Step 4: Refresh tiap URL — pastikan tetap di tab tsb**

Untuk tiap URL `/transaksi`, `/laporan`, `/pensiun`: refresh browser (F5).

Expected: tetap di tab tersebut, tidak balik ke Dashboard.

- [ ] **Step 5: Browser back/forward**

Klik beberapa menu lalu tekan tombol Back & Forward browser.

Expected: navigasi mundur/maju mengikuti history dengan benar.

- [ ] **Step 6: Toggle sidebar collapse**

Klik tombol `<SidebarTrigger>` di top bar (hamburger icon kiri-atas).

Expected:
- Sidebar collapse jadi rail icon-only (~64px).
- Hover icon → tooltip muncul dengan label menu.
- Klik tombol lagi → expand kembali.

- [ ] **Step 7: Keyboard shortcut `Cmd/Ctrl+B`**

Tekan `Ctrl+B` (Windows/Linux) atau `Cmd+B` (Mac).

Expected: sidebar toggle expand ↔ collapse.

- [ ] **Step 8: Persistence collapse**

Collapse sidebar, lalu refresh browser.

Expected: setelah refresh, sidebar tetap collapsed (cookie `sidebar:state` bekerja).

- [ ] **Step 9: Mobile drawer (resize ke <768px)**

Resize browser ke <768px (atau pakai DevTools mobile view).

Expected:
- Sidebar tidak terlihat secara default.
- Hamburger di top bar tetap visible.
- Klik hamburger → drawer slide in dari kiri (overlay dengan backdrop).
- Klik salah satu menu → drawer auto-close + navigate.
- Tap backdrop → drawer close.

- [ ] **Step 10: Dark mode**

Buka tab Pengaturan → toggle theme ke dark.

Expected:
- Sidebar background pakai token dark sidebar.
- Active item tetap pakai warna brand indigo (translucent).
- Header sidebar tetap gradient brand (tidak ikut tema).

- [ ] **Step 11: Panduan route**

Klik tombol "Lihat Panduan Lengkap" di Pengaturan (kartu PanduanWelcomeCard).

Expected:
- URL menjadi `/panduan`.
- Halaman panduan terbuka, sidebar tetap visible.
- Klik topic di select → URL menjadi `/panduan/<slug>`.
- Klik "Back" → navigate ke `/pengaturan`.
- Tekan Escape di panduan → navigate ke `/pengaturan`.

- [ ] **Step 12: OfflineBanner & ViewAsBanner positioning**

(Kalau memungkinkan) trigger offline mode (DevTools → Network → Offline) → reload.

Expected: `OfflineBanner` muncul di paling atas, di atas sidebar + top bar (full-width).

- [ ] **Step 13: Dokumentasikan hasil UAT**

Catat hasil tiap step di komentar atau notes. Kalau ada step yang gagal, fix dulu sebelum lanjut ke commit final.

- [ ] **Step 14: Stop dev server**

`Ctrl+C` di terminal yang menjalankan `npm run dev`.

- [ ] **Step 15: (Tidak ada commit di task ini — UAT, bukan code change.)**

---

## Task 13: Final verification + cleanup commit

**Files:**
- Verifikasi: build + lint final, no leftover

- [ ] **Step 1: Final build**

Run:
```bash
npm run build
```

Expected: sukses, output di `dist/`.

- [ ] **Step 2: Final lint**

Run:
```bash
npm run lint
```

Expected: clean (atau hanya warning pre-existing).

- [ ] **Step 3: Verifikasi tidak ada import dead-code**

Run:
```bash
grep -rn "useTabStore\|usePanduanStore\|tabStore\|panduanStore" src/ --include="*.tsx" --include="*.ts"
```

Expected: tidak ada output.

- [ ] **Step 4: Lihat git log final**

Run:
```bash
git log --oneline -15
```

Expected: melihat 11 commit dari Task 1-11 berurutan dengan pesan jelas.

- [ ] **Step 5: (Opsional) Update README atau CLAUDE.md kalau ada referensi ke `useTabStore`**

Run:
```bash
grep -rn "useTabStore\|usePanduanStore\|tabStore\|panduanStore" docs/ CLAUDE.md README.md 2>/dev/null
```

Kalau ada referensi, update agar match arsitektur baru. Kalau tidak ada, skip.

- [ ] **Step 6: (Opsional) Update memory note "Radix Tabs Unmount Inactive"**

Memory note `project_radix_tabs_unmount_behavior.md` berisi info tentang `<TabsContent>` yang sudah tidak relevan setelah migrasi ke React Router. Suggest user update memori ini ke arsitektur baru, atau hapus kalau tidak relevan lagi (React Router default unmount, sama perilakunya).

---

## Verifikasi sukses (acceptance criteria)

- [x] URL berubah saat klik menu (mis. `/transaksi`).
- [x] Refresh `/laporan` → tetap di Laporan.
- [x] Browser back/forward bekerja.
- [x] Sidebar collapse via `Cmd/Ctrl+B` & via tombol — preferensi tersimpan setelah refresh.
- [x] Tooltip muncul saat collapsed + hover.
- [x] Mobile drawer auto-close saat navigate.
- [x] Active state warna brand di light & dark mode.
- [x] `/panduan` route + slug param bekerja, "Back" navigate ke `/pengaturan`.
- [x] Tidak ada importer `tabStore` / `panduanStore` tersisa.
- [x] `OfflineBanner` & `ViewAsBanner` muncul di paling atas saat aktif.
- [x] `npm run build` sukses, TypeScript clean, ESLint clean.
