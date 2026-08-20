import { createFileRoute, redirect } from '@tanstack/react-router'
import { ApiDocsPage } from '~/features/apps/api-docs-panel.tsx'
import { getSessionState } from '~/server/session-fn.ts'

/**
 * Session-gated ReDoc, no panel chrome. Opened from the app detail API docs
 * link and Integration — the OpenAPI document is instance-wide.
 */
export const Route = createFileRoute('/docs')({
  beforeLoad: async () => {
    const session = await getSessionState()
    if (!session.initialized) throw redirect({ to: '/setup' })
    if (!session.authenticated) throw redirect({ to: '/login' })
  },
  component: ApiDocsPage,
})
