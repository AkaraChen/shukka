import { createFileRoute } from '@tanstack/react-router'
import { requireAdmin } from '~/lib/auth.ts'
import { handle, numericParam } from '~/lib/errors.ts'
import { revokeApiKey } from '~/server/apps.ts'

export const Route = createFileRoute('/api/admin/apps/$appId/keys/$keyId')({
  server: {
    handlers: {
      DELETE: handle(async ({ request, params }) => {
        requireAdmin(request)
        revokeApiKey(numericParam(params, 'appId'), numericParam(params, 'keyId'))
        return Response.json({ ok: true })
      }),
    },
  },
})
