# Sidebar Vertikal — Desain

**Tanggal:** 2026-05-04
**Status:** Draft
**Motivasi utama:** Estetika & modernitas (A) + Skalabilitas menu (B)

---

## Ringkasan

Mengganti navigasi dari **Radix `Tabs` horizontal di bawah header** menjadi **sidebar vertikal di kiri** dengan top bar tipis di kanan. Implementasi menggunakan shadcn `Sidebar` block + custom theming brand. Sekaligus migrasi state navigasi dari Zustand (`useTabStore`) ke React Router v7 untuk mendapat URL deep-link, browser back/forward, dan kesiapan nested routes.

## Tujuan

1. Layout modern setara aplikasi PFM modern (YNAB, Monarch, Empower, Copilot).
2. Skalabilitas menu — siap menampung penambahan menu (Hutang, Aset, dll.) dengan grouping yang jelas.
3. URL-based navigation — bookmark/share-able tab, browser back/forward bekerja.

## Non-tujuan

- **Tidak** mengubah konten internal tab manapun (Dashboard, Transaksi, dst. tetap apa adanya).
- **Tidak** memperbaiki state-reset behavior saat pindah tab (Routes default unmount, sama dengan Radix Tabs sekarang). Kalau di masa depan butuh keep-alive, itu perubahan terpisah.
- **Tidak** menambah skip-to-content link (private app, bukan public site).

---

## Keputusan utama (rangkuman brainstorming)

| Aspek | Keputusan | Alasan |
|---|---|---|
| Mobile (<768px) | Hamburger drawer kiri (Sheet overlay) | Pola standar SaaS desktop-first |
| Desktop perilaku | Collapsible: expanded ~240px ↔ rail icon-only ~64px, persisted | Sesuai motivasi B + fleksibilitas user |
| Header brand & AccountMenu | Brand pindah ke atas sidebar (gradient), top bar tipis di area konten berisi badge bulan + AccountMenu | Pola modern SaaS (Linear/Notion/Vercel) |
| Grouping | Section label uppercase, non-collapsible: Dashboard / **KEUANGAN** (Transaksi, Laporan, Catatan) / **KEKAYAAN** (Investasi, Pensiun, Finansial) / Pengaturan | Siap tambah menu, tidak overengineering |
| URL/routing | Migrasi ke React Router v7 (`/dashboard`, `/transaksi`, dst.) | Deep-link, back/forward, nested routes future-proof |
| Implementasi | shadcn `Sidebar` block + custom theming brand | Mature, konsisten dengan pola shadcn existing |
| Panduan | Route `/panduan` di dalam shell (sidebar tetap visible) | Konsisten dengan menu, deep-link-able |
| Persistence collapse | Cookie `sidebar:state` (default shadcn) | Zero config, no FOUC di SPA |
| Token sidebar shadcn | Override ke warna brand di `index.css` | Active/hover otomatis brand-colored, no ad-hoc Tailwind |

---

## Arsitektur layout

```
┌─────────────────────────────────────────────────────────────┐
│ OfflineBanner (conditional)                                 │
│ ViewAsBanner (conditional)                                  │
├─────────────────────────────────────────────────────────────┤
│ Sidebar (240px / 64px)  │  Top bar (h-12, sticky, border-b)│
│ ─────────────────────   │  ──────────────────────────────  │
│ ₱ Kantong Pintar        │  [☰] [Apr 2026]          [👤▾]  │
│ Personal Finance        │ ─────────────────────────────────│
│                         │                                  │
│ 🏠 Dashboard            │                                  │
│                         │                                  │
│ KEUANGAN                │     <Outlet />                   │
│ 💼 Transaksi            │     (page tab aktif)             │
│ 📊 Laporan              │                                  │
│ 📝 Catatan              │                                  │
│                         │                                  │
│ KEKAYAAN                │                                  │
│ 📈 Investasi            │                                  │
│ 🏦 Pensiun              │                                  │
│ 🎯 Finansial            │                                  │
│                         │                                  │
│ ⚙ Pengaturan            │                                  │
└─────────────────────────────────────────────────────────────┘
```

### Komponen utama (baru)

| File | Tanggung jawab |
|---|---|
| `src/App.tsx` (rewrite) | Auth gate + `<RouterProvider>` |
| `src/routes.tsx` | Definisi route tree (browser router) |
| `src/shell/AppShell.tsx` | `<SidebarProvider>` + `<Sidebar>` + `<SidebarInset>` (berisi `<AppTopBar>` + `<Outlet />`); juga render `<OfflineBanner>` & `<ViewAsBanner>` di paling atas |
| `src/shell/AppSidebar.tsx` | Header brand + grup menu (3 grup) + footer Pengaturan |
| `src/shell/AppTopBar.tsx` | `<SidebarTrigger>` + badge bulan + `<AccountMenu>` |
| `src/shell/navConfig.ts` | Single source of truth nav items + grouping |

### Komponen shadcn baru (via `npx shadcn add sidebar`)

- `src/components/ui/sidebar.tsx`
- `src/components/ui/sheet.tsx` (auto)
- `src/components/ui/tooltip.tsx` (auto)
- `src/components/ui/separator.tsx` (auto)
- `src/components/ui/skeleton.tsx` (auto)

### Komponen yang berubah / dihapus

| File | Aksi |
|---|---|
| `src/lib/tabStore.ts` | **HAPUS** (digantikan URL via React Router) |
| `src/lib/panduanStore.ts` | **HAPUS** (digantikan route `/panduan`) |
| `src/components/PanduanFullPage.tsx` | **EDIT** — `useTabStore.setActiveTab('settings')` → `useNavigate()('/pengaturan')` |
| `src/index.css` | **EDIT** — override token `--sidebar-accent` / `--sidebar-accent-foreground` / `--sidebar-primary` ke warna brand di `:root` & `.dark` |
| `src/components/OfflineBanner.tsx` | Tetap (dipindah lokasi render ke `AppShell`) |
| `src/components/ViewAsBanner.tsx` | Tetap (dipindah lokasi render ke `AppShell`) |
| `src/components/AccountMenu.tsx` | Tetap |
| `src/tabs/*.tsx` | **Tidak diubah** — semua tab dipakai sebagai page components |

### Dependency baru

- `react-router-dom` (v7+) — belum terpasang.
- shadcn auto-install komponen di atas (lewat `npx shadcn add sidebar`).

---

## Route map

```
/                    → redirect ke /dashboard
/dashboard           → DashboardTab
/transaksi           → TransactionsTab
/laporan             → ReportsTab
/catatan             → NotesTab
/investasi           → InvestmentsTab
/pensiun             → PensiunTab
/finansial           → FinansialTab
/pengaturan          → SettingsTab
/panduan             → PanduanFullPage (di dalam AppShell)
*                    → redirect ke /dashboard
```

Semua route di atas **di dalam `AppShell`** (sidebar + top bar selalu visible).

---

## `navConfig.ts` (single source of truth)

```ts
import {
  LayoutDashboard, Wallet, BarChart3, StickyNote,
  TrendingUp, PiggyBank, Target, Settings as SettingsIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = { to: string; label: string; icon: LucideIcon }
export type NavGroup = { label?: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  { items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'Keuangan', items: [
    { to: '/transaksi', label: 'Transaksi', icon: Wallet },
    { to: '/laporan',   label: 'Laporan',   icon: BarChart3 },
    { to: '/catatan',   label: 'Catatan',   icon: StickyNote },
  ]},
  { label: 'Kekayaan', items: [
    { to: '/investasi', label: 'Investasi', icon: TrendingUp },
    { to: '/pensiun',   label: 'Pensiun',   icon: PiggyBank },
    { to: '/finansial', label: 'Finansial', icon: Target },
  ]},
  { items: [{ to: '/pengaturan', label: 'Pengaturan', icon: SettingsIcon }] },
]
```

Sumber kebenaran tunggal — `AppSidebar` me-loop array ini, route table ikut menyusun page yang sama.

---

## Perilaku detail

### Active state

- `<NavLink>` dari React Router membungkus `<SidebarMenuButton asChild>`.
- Active ditandai `data-active="true"` (otomatis dari `NavLink` saat `isActive`).
- Warna active mengambil `--sidebar-accent` / `--sidebar-accent-foreground` (sudah dioverride ke brand di `index.css`).

### Sidebar header brand (gradient)

- **Expanded (240px):** `<SidebarHeader>` pakai `background: linear-gradient(135deg, var(--brand-header), var(--brand-header-end))`, berisi logo mark `₱` (8×8, indigo gradient) + "Kantong Pintar" + tagline "Personal Finance" warna putih.
- **Collapsed (64px / icon rail):** hanya logo mark `₱` di tengah, nama & tagline disembunyikan via `group-data-[collapsible=icon]:hidden`.

### Top bar (`AppTopBar`)

- `h-12 sticky top-0 z-30 border-b border-border bg-background`.
- Kiri: `<SidebarTrigger>` (hamburger di mobile, toggle di desktop).
- Kanan: badge bulan `{new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}` (`hidden sm:block`) + `<AccountMenu>`.

### Mobile drawer

- Otomatis aktif `<md` (768px) via shadcn default (`useIsMobile`).
- `<SidebarTrigger>` di top bar membuka `<Sheet>` overlay.
- Auto-close saat navigate: setiap `<NavLink>` punya `onClick={() => setOpenMobile(false)}` (dari `useSidebar()` hook). **Wajib** — shadcn Sidebar tidak otomatis close drawer saat navigate, hanya saat tap backdrop / swipe.

### Tooltip saat collapsed

- `<SidebarMenuButton tooltip="Transaksi">` — built-in shadcn, hover icon menampilkan label.

### Persistence

- Cookie `sidebar:state` (default shadcn). Dibaca saat mount via `document.cookie` — sinkron, tidak ada FOUC.

### Keyboard shortcut

- `Cmd/Ctrl+B` toggle sidebar (built-in shadcn). **Tidak konflik** dengan `Ctrl+N` existing di `TransactionsTab.tsx:77` (modal tambah transaksi).

### Theming dark/light

Override di `src/index.css`:

```css
/* :root */
--sidebar-accent: var(--brand-light);
--sidebar-accent-foreground: var(--brand-dark);
--sidebar-primary: var(--brand);

/* .dark */
--sidebar-accent: oklch(0.488 0.243 264.376 / 0.15);
--sidebar-accent-foreground: var(--brand);
--sidebar-primary: var(--brand);
```

Header sidebar **selalu gradient brand** (tidak ikut tema), konsisten dengan header existing.

---

## Sketsa kode kunci

### `src/App.tsx` (baru)

```tsx
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { useAuth } from '@/auth/useAuth'
import LoginScreen from '@/components/LoginScreen'
import { Toaster } from '@/components/ui/sonner'

export default function App() {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-muted-foreground text-sm">Memuat...</span>
      </div>
    )
  }
  if (!session) {
    return <><LoginScreen /><Toaster richColors position="top-right" /></>
  }
  return <><RouterProvider router={router} /><Toaster richColors position="top-right" /></>
}
```

### `src/routes.tsx` (baru)

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
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
```

### `src/shell/AppShell.tsx` (sketsa)

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

### `src/shell/AppSidebar.tsx` (sketsa)

```tsx
import { NavLink } from 'react-router-dom'
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar,
} from '@/components/ui/sidebar'
import { NAV_GROUPS } from './navConfig'

export default function AppSidebar() {
  const { setOpenMobile } = useSidebar()
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader
        className="text-white"
        style={{ background: 'linear-gradient(135deg, var(--brand-header), var(--brand-header-end))' }}
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
        {NAV_GROUPS.map((group, i) => (
          <SidebarGroup key={i}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarMenu>
              {group.items.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton asChild tooltip={label}>
                    <NavLink to={to} onClick={() => setOpenMobile(false)}>
                      <Icon />
                      <span>{label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
```

### `src/components/PanduanFullPage.tsx` (edit ringkas)

```diff
- import { useTabStore } from '@/lib/tabStore'
+ import { useNavigate } from 'react-router-dom'
...
- const { setActiveTab } = useTabStore()
+ const navigate = useNavigate()
...
- setActiveTab('settings')
+ navigate('/pengaturan')
```

---

## Migrasi & dampak

### Backward compatibility

- **Tidak ada bookmark eksternal** ke pola tab lama (state Zustand, bukan URL). Migrasi tidak memutus link yang sudah dibagikan user.
- **`localStorage` keys** Zustand `useTabStore` & `usePanduanStore` (jika ada) dapat dibiarkan — tidak akan dibaca lagi setelah store dihapus, akan tergusur sendiri.

### Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| State internal tab reset saat navigate (Routes unmount default) | Sama dengan perilaku Radix Tabs sekarang — **tidak ada regresi**. Diakui di non-tujuan. |
| Sidebar mobile tidak auto-close saat navigate | Bind `setOpenMobile(false)` di `onClick` `<NavLink>` (didokumentasikan). |
| Token `--sidebar-*` override mempengaruhi komponen shadcn lain | Tidak ada komponen lain yang pakai token sidebar — verifikasi grep `--sidebar-` di `src/` saat implementasi. |
| Lebar konten berkurang ~240px di tabel padat (Laporan) | Collapsible toggle (rail 64px) tersedia; user dapat collapse manual. |
| `/panduan` punya layout sendiri yang tidak cocok dengan `<main className="p-6">` | Saat implementasi, cek ulang `PanduanFullPage` — kalau perlu padding 0, ekspos prop atau wrap conditional di `AppShell` per route. |

### Ordering implementasi (gambaran kasar — detail di plan)

1. Install `react-router-dom`.
2. `npx shadcn add sidebar` (auto-install sheet/tooltip/separator/skeleton).
3. Override token `--sidebar-*` di `index.css`.
4. Buat `navConfig.ts`, `AppSidebar.tsx`, `AppTopBar.tsx`, `AppShell.tsx`.
5. Buat `routes.tsx`.
6. Rewrite `App.tsx` jadi `<RouterProvider>`.
7. Edit `PanduanFullPage.tsx` (ganti `useTabStore` → `useNavigate`).
8. Hapus `src/lib/tabStore.ts` dan `src/lib/panduanStore.ts` (verifikasi tidak ada importer tersisa).
9. Manual test: navigate semua menu, refresh tiap URL, browser back/forward, mobile drawer, collapsed rail tooltip, dark/light mode, login → redirect ke `/dashboard`, logout.

---

## Verifikasi sukses

- [ ] URL berubah saat klik menu (mis. `/transaksi`).
- [ ] Refresh `/laporan` → tetap di Laporan, tidak balik ke Dashboard.
- [ ] Browser back/forward berpindah antar menu sesuai history.
- [ ] Sidebar collapse via `Cmd/Ctrl+B` dan via tombol — preferensi tersimpan setelah refresh.
- [ ] Saat collapsed, hover icon menampilkan tooltip label.
- [ ] Mobile (<768px): hamburger membuka drawer, tap menu → drawer close + navigate.
- [ ] Active state berwarna brand di light & dark mode.
- [ ] `/panduan` route bekerja, link "Buka Pengaturan" di dalam panduan navigate ke `/pengaturan`.
- [ ] Tidak ada importer tersisa untuk `tabStore` / `panduanStore`.
- [ ] `OfflineBanner` & `ViewAsBanner` tetap muncul di paling atas saat aktif.
- [ ] Build (`npm run build`) sukses, TypeScript clean.
