import { Link, Outlet, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { LogOut, Package, Settings } from 'lucide-react'
import { PackageIcon } from '~/components/brand.tsx'
import { AppNav } from '~/features/apps/app-nav.tsx'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '~/components/ui/sidebar'
import { api } from '~/lib/api.ts'
import { getSessionState } from '~/server/session-fn.ts'

export const Route = createFileRoute('/_panel')({
  beforeLoad: async () => {
    const session = await getSessionState()
    if (!session.initialized) throw redirect({ to: '/setup' })
    if (!session.authenticated) throw redirect({ to: '/login' })
  },
  component: PanelLayout,
})

function PanelLayout() {
  const router = useRouter()

  async function signOut() {
    await api.post('/api/admin/logout')
    await router.navigate({ to: '/login' })
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-0">
          <Link
            to="/apps"
            aria-label="Shukka — all apps"
            className="flex h-12 w-full items-center gap-2.5 px-4 text-sidebar-foreground outline-hidden transition-colors hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <PackageIcon className="size-5 shrink-0" />
            <span className="text-base group-data-[collapsible=icon]:hidden">Shukka</span>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Apps">
                    <Link to="/apps" activeOptions={{ exact: true }} activeProps={{ 'data-active': true }}>
                      <Package />
                      <span>Apps</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <AppNav />
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Settings">
                <Link to="/settings" activeProps={{ 'data-active': true }}>
                  <Settings />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={signOut} tooltip="Sign out">
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center px-3">
          <SidebarTrigger />
        </header>
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 pt-2 pb-16">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
