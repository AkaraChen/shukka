import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requireAdmin } from '~/lib/auth.ts'
import { ShukkaError, handle, numericParam } from '~/lib/errors.ts'
import { createChannel, listChannels } from '~/server/channels.ts'

const bodySchema = z.object({ name: z.string().min(1) })

export const Route = createFileRoute('/api/admin/apps/$appId/channels')({
  server: {
    handlers: {
      GET: handle(async ({ request, params }) => {
        requireAdmin(request)
        return Response.json({ channels: listChannels(numericParam(params, 'appId')) })
      }),
      POST: handle(async ({ request, params }) => {
        requireAdmin(request)
        const parsed = bodySchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) throw new ShukkaError('invalid_request', 'Channel name is required')
        return Response.json({ channel: createChannel(numericParam(params, 'appId'), parsed.data.name) }, { status: 201 })
      }),
    },
  },
})
