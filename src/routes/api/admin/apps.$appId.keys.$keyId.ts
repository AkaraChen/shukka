import { createFileRoute } from '@tanstack/react-router'
import { requireAdmin } from '~/lib/auth.ts'
import { handle, numericParam } from '~/lib/errors.ts'
import { deleteApiKey, revokeApiKey } from '~/server/apps.ts'

export const Route = createFileRoute('/api/admin/apps/$appId/keys/$keyId')({
  server: {
    handlers: {
      DELETE: handle(async ({ request, params }) => {
        requireAdmin(request)
        const appId = numericParam(params, 'appId')
        const keyId = numericParam(params, 'keyId')
        // Default soft-revokes; ?mode=delete hard-deletes (revoked keys only).
        const mode = new URL(request.url).searchParams.get('mode')
        if (mode === 'delete') deleteApiKey(appId, keyId)
        else revokeApiKey(appId, keyId)
        return Response.json({ ok: true })
      }),
    },
  },
})
