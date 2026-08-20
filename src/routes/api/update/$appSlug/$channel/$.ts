import { createFileRoute } from '@tanstack/react-router'
import { handle, textParam } from '~/lib/errors.ts'
import { serveFeedRequest } from '~/server/feed.ts'

/**
 * Public update feed. Document shape follows the app's updater adapter;
 * artifacts 302 to storage. Base URL: /api/update/{appSlug}/{channel}
 */
export const Route = createFileRoute('/api/update/$appSlug/$channel/$')({
  server: {
    handlers: {
      GET: handle(async ({ request, params }) => {
        const filename = decodeURIComponent(params._splat ?? '')
        return serveFeedRequest(request, textParam(params, 'appSlug'), textParam(params, 'channel'), filename)
      }),
    },
  },
})
