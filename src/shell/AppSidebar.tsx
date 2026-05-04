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
import { NAV_GROUPS } from './navConfig'

function SidebarNavItem({
  to,
  label,
  Icon,
  onNavigate,
}: {
  to: string
  label: string
  Icon: LucideIcon
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
          <SidebarGroup key={idx}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ to, label, icon: Icon }) => (
                  <SidebarNavItem
                    key={to}
                    to={to}
                    label={label}
                    Icon={Icon}
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
