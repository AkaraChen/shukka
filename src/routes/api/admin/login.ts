import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { login, sessionCookieHeader } from '~/lib/auth.ts'
import { ShukkaError, handle } from '~/lib/errors.ts'

const bodySchema = z.object({ password: z.string().min(1) })

export const Route = createFileRoute('/api/admin/login')({
  server: {
    handlers: {
      POST: handle(async ({ request }) => {
        const parsed = bodySchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) throw new ShukkaError('invalid_request', 'Password is required')
        const token = login(parsed.data.password)
        return Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookieHeader(token) } })
      }),
    },
  },
})
