import { createFileRoute } from '@tanstack/react-router'
import { requireAdmin } from '~/lib/auth.ts'
import { handle, numericParam } from '~/lib/errors.ts'
import { versionTrend } from '~/server/hits.ts'

export const Route = createFileRoute('/api/admin/apps/$appId/versions/$versionId/trend')({
  server: {
    handlers: {
      GET: handle(async ({ request, params }) => {
        requireAdmin(request)
        const appId = numericParam(params, 'appId')
        const versionId = numericParam(params, 'versionId')
        return Response.json(versionTrend(appId, versionId))
      }),
    },
  },
})
