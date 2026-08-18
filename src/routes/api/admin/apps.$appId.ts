import { createFileRoute } from '@tanstack/react-router'
import { requireAdmin } from '~/lib/auth.ts'
import { ShukkaError, handle, numericParam } from '~/lib/errors.ts'
import { deleteApp, updateApp } from '~/server/apps.ts'
import { appDetail, publicApp } from '~/server/dashboard.ts'
import { appInputSchema } from './apps.ts'

export const Route = createFileRoute('/api/admin/apps/$appId')({
  server: {
    handlers: {
      GET: handle(async ({ request, params }) => {
        requireAdmin(request)
        return Response.json(appDetail(numericParam(params, 'appId'), new URL(request.url).origin))
      }),
      PATCH: handle(async ({ request, params }) => {
        requireAdmin(request)
        const parsed = appInputSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) throw new ShukkaError('invalid_request', 'Invalid app payload', parsed.error.issues)
        return Response.json({ app: publicApp(await updateApp(numericParam(params, 'appId'), parsed.data)) })
      }),
      DELETE: handle(async ({ request, params }) => {
        requireAdmin(request)
        await deleteApp(numericParam(params, 'appId'))
        return Response.json({ ok: true })
      }),
    },
  },
})
