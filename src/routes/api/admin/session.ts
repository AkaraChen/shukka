import { createFileRoute } from '@tanstack/react-router'
import { isInitialized, readSessionCookie, sessionIsValid } from '~/lib/auth.ts'
import { handle } from '~/lib/errors.ts'

export const Route = createFileRoute('/api/admin/session')({
  server: {
    handlers: {
      GET: handle(async ({ request }) =>
        Response.json({
          initialized: isInitialized(),
          authenticated: sessionIsValid(readSessionCookie(request)),
        }),
      ),
    },
  },
})
