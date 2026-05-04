import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import AppSidebar from './AppSidebar'
import AppTopBar from './AppTopBar'
import OfflineBanner from '@/components/OfflineBanner'
import ViewAsBanner from '@/components/ViewAsBanner'

export default function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <OfflineBanner />
      <ViewAsBanner />
      <TooltipProvider delayDuration={0}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <AppTopBar />
            <main className="p-6">
              <Outlet />
            </main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </div>
  )
}
