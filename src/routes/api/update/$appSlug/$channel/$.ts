import { createFileRoute } from '@tanstack/react-router'
import { handle, textParam } from '~/lib/errors.ts'
import { resolveFeedRequest } from '~/server/feed.ts'

/**
 * Public, unauthenticated update feed for electron-updater's generic provider.
 * Base URL: /api/update/{appSlug}/{channel}
 */
export const Route = createFileRoute('/api/update/$appSlug/$channel/$')({
  server: {
    handlers: {
      GET: handle(async ({ params }) => {
        const filename = decodeURIComponent(params._splat ?? '')
        const result = await resolveFeedRequest(textParam(params, 'appSlug'), textParam(params, 'channel'), filename)

        if (result.kind === 'redirect') {
          return new Response(null, {
            status: 302,
            headers: { location: result.url, 'cache-control': 'no-store' },
          })
        }
        return new Response(result.body, {
          headers: { 'content-type': 'text/yaml; charset=utf-8', 'cache-control': 'no-store' },
        })
      }),
    },
  },
})
