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
