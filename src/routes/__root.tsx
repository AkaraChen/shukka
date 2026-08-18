import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext, useRouteContext } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '~/styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Shukka' },
      { name: 'description', content: 'Self-hosted release manager for electron-updater on S3' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg' },
    ],
    scripts: [
      // Follow the OS theme before first paint; class strategy keeps Tailwind's
      // dark: variant and avoids a flash on load.
      {
        children:
          "(function(){var m=matchMedia('(prefers-color-scheme: dark)');var s=function(){document.documentElement.classList.toggle('dark',m.matches)};s();m.addEventListener('change',s)})()",
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const { queryClient } = useRouteContext({ from: Route.id })
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
