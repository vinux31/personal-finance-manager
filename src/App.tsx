import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Target,
  StickyNote,
  BarChart3,
  Settings as SettingsIcon,
  PiggyBank,
} from 'lucide-react'
import DashboardTab from '@/tabs/DashboardTab'
import TransactionsTab from '@/tabs/TransactionsTab'
import InvestmentsTab from '@/tabs/InvestmentsTab'
import GoalsTab from '@/tabs/GoalsTab'
import NotesTab from '@/tabs/NotesTab'
import ReportsTab from '@/tabs/ReportsTab'
import SettingsTab from '@/tabs/SettingsTab'
import PensiunTab from '@/tabs/PensiunTab'
import LoginScreen from '@/components/LoginScreen'
import OfflineBanner from '@/components/OfflineBanner'
import ViewAsBanner from '@/components/ViewAsBanner'
import AccountMenu from '@/components/AccountMenu'
import { useAuth } from '@/auth/useAuth'
import { useTabStore } from '@/lib/tabStore'

const TABS = [
  { value: 'dashboard',    label: 'Dashboard',  icon: LayoutDashboard, Comp: DashboardTab },
  { value: 'transactions', label: 'Transaksi',  icon: Wallet,          Comp: TransactionsTab },
  { value: 'investments',  label: 'Investasi',  icon: TrendingUp,      Comp: InvestmentsTab },
  { value: 'goals',        label: 'Goals',      icon: Target,          Comp: GoalsTab },
  { value: 'pensiun',      label: 'Pensiun',    icon: PiggyBank,       Comp: PensiunTab },
  { value: 'reports',      label: 'Laporan',    icon: BarChart3,       Comp: ReportsTab },
  { value: 'notes',        label: 'Catatan',    icon: StickyNote,      Comp: NotesTab },
  { value: 'settings',     label: 'Pengaturan', icon: SettingsIcon,    Comp: SettingsTab },
] as const

function App() {
  const { session, loading } = useAuth()
  const { activeTab, setActiveTab } = useTabStore()

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
    <div className="min-h-screen bg-background text-foreground">
      <OfflineBanner />
      <ViewAsBanner />

      {/* Header — selalu dark, tidak ikut tema */}
      <header
        className="flex items-center justify-between px-6 py-3"
        style={{ background: 'linear-gradient(135deg, var(--brand-header), var(--brand-header-end))' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #818cf8, #6366f1)' }}
          >
            ₱
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white">Kantong Pintar</div>
            <div className="text-[10px]" style={{ color: 'var(--brand-muted)' }}>Personal Finance</div>
          </div>
        </div>

        {/* Kanan: bulan + avatar */}
        <div className="flex items-center gap-3">
          <span
            className="hidden rounded-full px-3 py-1 text-[11px] sm:block"
            style={{ background: 'rgba(165,180,252,0.15)', color: 'var(--brand-muted)' }}
          >
            {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </span>
          <AccountMenu />
        </div>
      </header>

      <main className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab list — scrollable horizontal di mobile */}
          <div className="mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            <TabsList className="inline-flex w-max min-w-full rounded-none border-b border-border bg-transparent p-0 [&>button:not([role='tab'])]:hidden">
              {TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:border-[var(--brand)] data-[state=active]:text-[var(--brand)] data-[state=active]:shadow-none"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {TABS.map(({ value, Comp }) => (
            <TabsContent key={value} value={value}>
              <Comp />
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <Toaster richColors position="top-right" />
    </div>
  )
}

export default App
