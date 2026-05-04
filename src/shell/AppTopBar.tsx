import { SidebarTrigger } from '@/components/ui/sidebar'
import AccountMenu from '@/components/AccountMenu'

export default function AppTopBar() {
  const monthLabel = new Date().toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
      <div className="flex items-center gap-3">
        <span
          className="hidden rounded-full px-3 py-1 text-[11px] sm:block"
          style={{
            background: 'rgba(165,180,252,0.15)',
            color: 'var(--brand-muted)',
          }}
        >
          {monthLabel}
        </span>
        <AccountMenu />
      </div>
    </header>
  )
}
