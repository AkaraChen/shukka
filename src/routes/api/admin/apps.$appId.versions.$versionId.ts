import { createFileRoute } from '@tanstack/react-router'
import { requireAdmin } from '~/lib/auth.ts'
import { handle, numericParam } from '~/lib/errors.ts'
import { getApp } from '~/server/apps.ts'
import { deleteVersion } from '~/server/releases.ts'

export const Route = createFileRoute('/api/admin/apps/$appId/versions/$versionId')({
  server: {
    handlers: {
      DELETE: handle(async ({ request, params }) => {
        requireAdmin(request)
        await deleteVersion(getApp(numericParam(params, 'appId')), numericParam(params, 'versionId'))
        return Response.json({ ok: true })
      }),
    },
  },
})
