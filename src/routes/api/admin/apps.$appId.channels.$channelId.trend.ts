import { createFileRoute } from '@tanstack/react-router'
import { requireAdmin } from '~/lib/auth.ts'
import { handle, numericParam } from '~/lib/errors.ts'
import { channelTrend, parseTrendRange } from '~/server/hits.ts'

export const Route = createFileRoute('/api/admin/apps/$appId/channels/$channelId/trend')({
  server: {
    handlers: {
      GET: handle(async ({ request, params }) => {
        requireAdmin(request)
        const appId = numericParam(params, 'appId')
        const channelId = numericParam(params, 'channelId')
        const range = parseTrendRange(new URL(request.url).searchParams.get('range'))
        return Response.json(channelTrend(appId, channelId, range))
      }),
    },
  },
})
