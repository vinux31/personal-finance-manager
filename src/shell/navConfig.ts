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
  HeartPulse,
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
    label: 'Strategi',
    items: [
      { to: '/kesehatan', label: 'Kesehatan', icon: HeartPulse },
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
