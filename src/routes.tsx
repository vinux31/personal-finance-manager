/* eslint-disable react-refresh/only-export-components -- this file owns React.lazy + LazyFallback alongside router export; HMR fast-refresh not applicable to router config */
import React, { Suspense } from 'react'
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
import KesehatanLayout from '@/tabs/kesehatan/KesehatanLayout'
import KesehatanLanding from '@/tabs/kesehatan/KesehatanLanding'

// Phase 15 lazy modul + kalkulator. Bundles Fraunces font with KesehatanModulLayout chunk
// so font payload arrives only when user enters /kesehatan/<slug>.
const KesehatanModulLayout = React.lazy(() => import('@/tabs/kesehatan/KesehatanModulLayout'))
const ModulRenderer = React.lazy(() => import('@/tabs/kesehatan/ModulRenderer'))
const KalkulatorPage = React.lazy(() => import('@/tabs/kesehatan/KalkulatorPage'))

function LazyFallback() {
  return (
    <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
      Memuat…
    </div>
  )
}

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
      // Phase 15: nested /kesehatan with kalkulator + 6 modul (lazy-loaded)
      {
        path: 'kesehatan',
        element: <KesehatanLayout />,
        children: [
          { index: true, element: <KesehatanLanding /> },
          {
            path: 'kalkulator',
            element: (
              <Suspense fallback={<LazyFallback />}>
                <KalkulatorPage />
              </Suspense>
            ),
          },
          {
            element: (
              <Suspense fallback={<LazyFallback />}>
                <KesehatanModulLayout />
              </Suspense>
            ),
            children: [
              // Single :slug route — ModulRenderer.isModulSlug() validates against MODUL_CONTENT
              // keys and Navigate-redirects unknown slugs to /kesehatan. Literal routes were
              // omitted because they don't populate the :slug param, breaking useParams().
              { path: ':slug', element: <ModulRenderer /> },
            ],
          },
        ],
      },
      { path: 'finansial', element: <Navigate to="/kekayaan" replace /> },
      { path: 'pengaturan', element: <SettingsTab /> },
      { path: 'panduan', element: <PanduanFullPage /> },
      { path: 'panduan/:slug', element: <PanduanFullPage /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
