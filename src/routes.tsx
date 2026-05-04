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
