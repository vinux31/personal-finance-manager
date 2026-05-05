import { useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar'
import { NAV_GROUPS, type NavBadge } from './navConfig'
import { useRecurringDueCount } from '@/queries/recurringDueCount'

function BadgeValue({ badge }: { badge: NavBadge }) {
  const recurringDue = useRecurringDueCount()
  if (badge === 'recurring-due') {
    if (recurringDue <= 0) return null
    return (
      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground group-data-[collapsible=icon]:hidden">
        {recurringDue > 99 ? '99+' : recurringDue}
      </span>
    )
  }
  return null
}

function SidebarNavItem({
  to,
  label,
  Icon,
  badge,
  onNavigate,
}: {
  to: string
  label: string
  Icon: LucideIcon
  badge?: NavBadge
  onNavigate: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const isActive =
    location.pathname === to || location.pathname.startsWith(to + '/')

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={label} isActive={isActive}>
        <a
          href={to}
          onClick={(e) => {
            e.preventDefault()
            onNavigate()
            navigate(to)
          }}
        >
          <Icon />
          <span>{label}</span>
          {badge && <BadgeValue badge={badge} />}
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export default function AppSidebar() {
  const { setOpenMobile } = useSidebar()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader
        className="text-white"
        style={{
          background:
            'linear-gradient(135deg, var(--brand-header), var(--brand-header-end))',
        }}
      >
        <div className="flex items-center gap-3 px-2 py-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #818cf8, #6366f1)' }}
          >
            ₱
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-bold tracking-tight">Kantong Pintar</div>
            <div className="text-[10px] opacity-70">Personal Finance</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group, idx) => (
          <SidebarGroup
            key={idx}
            className={group.isFooter ? 'mt-auto border-t border-sidebar-border pt-2' : undefined}
          >
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ to, label, icon: Icon, badge }) => (
                  <SidebarNavItem
                    key={to}
                    to={to}
                    label={label}
                    Icon={Icon}
                    badge={badge}
                    onNavigate={() => setOpenMobile(false)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
