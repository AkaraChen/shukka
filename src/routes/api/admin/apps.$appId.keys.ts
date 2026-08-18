import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '~/db/index.ts'
import { apiKeys } from '~/db/schema.ts'
import { generateApiKey, requireAdmin } from '~/lib/auth.ts'
import { ShukkaError, handle, numericParam } from '~/lib/errors.ts'
import { getApp, listApiKeys } from '~/server/apps.ts'

const bodySchema = z.object({ name: z.string().min(1) })

export const Route = createFileRoute('/api/admin/apps/$appId/keys')({
  server: {
    handlers: {
      GET: handle(async ({ request, params }) => {
        requireAdmin(request)
        return Response.json({ keys: listApiKeys(numericParam(params, 'appId')) })
      }),
      POST: handle(async ({ request, params }) => {
        requireAdmin(request)
        const parsed = bodySchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) throw new ShukkaError('invalid_request', 'Key name is required')

        const app = getApp(numericParam(params, 'appId'))
        const { plaintext, hash, hint } = generateApiKey()
        const key = db
          .insert(apiKeys)
          .values({ appId: app.id, name: parsed.data.name, hash, hint })
          .returning()
          .get()

        // The plaintext is returned exactly once and never stored.
        return Response.json(
          { key: { id: key.id, name: key.name, hint: key.hint, createdAt: key.createdAt }, plaintext },
          { status: 201 },
        )
      }),
    },
  },
})
