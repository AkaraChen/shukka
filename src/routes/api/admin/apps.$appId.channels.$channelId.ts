import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requireAdmin } from '~/lib/auth.ts'
import { ShukkaError, handle, numericParam } from '~/lib/errors.ts'
import { getApp } from '~/server/apps.ts'
import { deleteChannel, setCurrentVersion } from '~/server/channels.ts'

const patchSchema = z.object({ currentVersionId: z.number().int().positive().nullable() })

export const Route = createFileRoute('/api/admin/apps/$appId/channels/$channelId')({
  server: {
    handlers: {
      PATCH: handle(async ({ request, params }) => {
        requireAdmin(request)
        const parsed = patchSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) throw new ShukkaError('invalid_request', 'currentVersionId is required')
        setCurrentVersion(numericParam(params, 'appId'), numericParam(params, 'channelId'), parsed.data.currentVersionId)
        return Response.json({ ok: true })
      }),
      DELETE: handle(async ({ request, params }) => {
        requireAdmin(request)
        await deleteChannel(getApp(numericParam(params, 'appId')), numericParam(params, 'channelId'))
        return Response.json({ ok: true })
      }),
    },
  },
})
