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
