import { createFileRoute } from '@tanstack/react-router'
import { isInitialized, readSessionCookie, sessionIsValid } from '~/lib/auth.ts'
import { getDocsHtml } from '~/server/docs-html.ts'

/**
 * Session-gated, server-rendered ReDoc. Returns the self-hosted HTML produced
 * by cheerio-assembly of the local redoc bundle (ADR: docs-renderer); no panel
 * chrome. The HTML is static and origin-independent — the spec is fetched
 * client-side from the same-origin `/api/v1/openapi.json` endpoint with the
 * session cookie. Unauthenticated requests redirect, matching the previous
 * `beforeLoad` gate. The HTML body is immutable, so it is cached aggressively;
 * the session gate still runs on every request.
 */
export const Route = createFileRoute('/docs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isInitialized()) return redirect(request, '/setup')
        if (!sessionIsValid(readSessionCookie(request))) return redirect(request, '/login')
        const html = await getDocsHtml()
        return new Response(html, {
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, max-age=3600' },
        })
      },
    },
  },
})

function redirect(request: Request, to: string): Response {
  const base = new URL(request.url)
  const location = new URL(to, base.origin).toString()
  return new Response(null, { status: 302, headers: { location } })
}
