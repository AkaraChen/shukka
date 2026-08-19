import { createFileRoute } from '@tanstack/react-router'
import { requireAppActor } from '~/lib/auth.ts'
import { handle, textParam } from '~/lib/errors.ts'
import { getChannel } from '~/server/channels.ts'
import { channelTrend, parseTrendRange } from '~/server/hits.ts'

export const Route = createFileRoute('/api/v1/apps/$appSlug/channels/$channel/trend')({
  server: {
    handlers: {
      GET: handle(async ({ request, params }) => {
        const { app } = requireAppActor(request, textParam(params, 'appSlug'))
        const channel = getChannel(app.id, textParam(params, 'channel'))
        const range = parseTrendRange(new URL(request.url).searchParams.get('range'))
        return Response.json(channelTrend(app.id, channel.id, range))
      }),
    },
  },
})
