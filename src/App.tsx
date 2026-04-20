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
} from 'lucide-react'
import DashboardTab from '@/tabs/DashboardTab'
import TransactionsTab from '@/tabs/TransactionsTab'
import InvestmentsTab from '@/tabs/InvestmentsTab'
import GoalsTab from '@/tabs/GoalsTab'
import NotesTab from '@/tabs/NotesTab'
import ReportsTab from '@/tabs/ReportsTab'
import SettingsTab from '@/tabs/SettingsTab'
import LoginScreen from '@/components/LoginScreen'
import OfflineBanner from '@/components/OfflineBanner'
import ViewAsBanner from '@/components/ViewAsBanner'
import AccountMenu from '@/components/AccountMenu'
import { useAuth } from '@/auth/useAuth'

const TABS = [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, Comp: DashboardTab },
  { value: 'transactions', label: 'Transaksi', icon: Wallet, Comp: TransactionsTab },
  { value: 'investments', label: 'Investasi', icon: TrendingUp, Comp: InvestmentsTab },
  { value: 'goals', label: 'Goals', icon: Target, Comp: GoalsTab },
  { value: 'notes', label: 'Catatan', icon: StickyNote, Comp: NotesTab },
  { value: 'reports', label: 'Laporan', icon: BarChart3, Comp: ReportsTab },
  { value: 'settings', label: 'Pengaturan', icon: SettingsIcon, Comp: SettingsTab },
] as const

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
    <div className="min-h-screen bg-background text-foreground">
      <OfflineBanner />
      <ViewAsBanner />
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Personal Finance Manager
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola keuangan pribadi Anda
          </p>
        </div>
        <AccountMenu />
      </header>

      <main className="p-6">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="mb-6">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

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
