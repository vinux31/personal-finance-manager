import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import {
  Wallet,
  TrendingUp,
  Target,
  StickyNote,
  BarChart3,
  Settings as SettingsIcon,
} from 'lucide-react'
import TransactionsTab from '@/tabs/TransactionsTab'
import InvestmentsTab from '@/tabs/InvestmentsTab'
import GoalsTab from '@/tabs/GoalsTab'
import NotesTab from '@/tabs/NotesTab'
import ReportsTab from '@/tabs/ReportsTab'
import SettingsTab from '@/tabs/SettingsTab'
import FirstRunDialog from '@/components/FirstRunDialog'
import { useDbStore } from '@/db/store'

const TABS = [
  { value: 'transactions', label: 'Transaksi', icon: Wallet, Comp: TransactionsTab },
  { value: 'investments', label: 'Investasi', icon: TrendingUp, Comp: InvestmentsTab },
  { value: 'goals', label: 'Goals', icon: Target, Comp: GoalsTab },
  { value: 'notes', label: 'Catatan', icon: StickyNote, Comp: NotesTab },
  { value: 'reports', label: 'Laporan', icon: BarChart3, Comp: ReportsTab },
  { value: 'settings', label: 'Pengaturan', icon: SettingsIcon, Comp: SettingsTab },
] as const

function App() {
  const status = useDbStore((s) => s.status)

  if (status !== 'ready') {
    return (
      <>
        <FirstRunDialog />
        <Toaster richColors position="top-right" />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Personal Finance Manager
        </h1>
        <p className="text-sm text-muted-foreground">
          Kelola keuangan pribadi — offline, data tersimpan di laptop Anda
        </p>
      </header>

      <main className="p-6">
        <Tabs defaultValue="transactions" className="w-full">
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
