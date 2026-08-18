import { Link } from '@tanstack/react-router'
import { Boxes } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '~/components/ui/sidebar'
import { Skeleton } from '~/components/ui/skeleton'
import { useApps } from './queries.ts'

/** Live list of managed apps, so switching between them stays one click away. */
export function AppNav() {
  const { data: apps, isPending } = useApps()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Your apps</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {isPending ? (
            <div className="space-y-2 px-2 py-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          ) : apps?.length ? (
            apps.map((app) => (
              <SidebarMenuItem key={app.id}>
                <SidebarMenuButton asChild>
                  <Link to="/apps/$appId" params={{ appId: String(app.id) }} activeProps={{ 'data-active': true }}>
                    <Boxes />
                    <span className="truncate">{app.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))
          ) : (
            <p className="px-2 py-1 text-xs text-muted-foreground">No apps yet.</p>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
