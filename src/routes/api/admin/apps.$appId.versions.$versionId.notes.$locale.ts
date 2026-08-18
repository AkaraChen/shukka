import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requireAdmin } from '~/lib/auth.ts'
import { ShukkaError, handle, numericParam, textParam } from '~/lib/errors.ts'
import { deleteNote, upsertNote } from '~/server/release-notes.ts'

const noteSchema = z.object({ markdown: z.string().min(1) })

export const Route = createFileRoute('/api/admin/apps/$appId/versions/$versionId/notes/$locale')({
  server: {
    handlers: {
      PUT: handle(async ({ request, params }) => {
        requireAdmin(request)
        const parsed = noteSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) throw new ShukkaError('invalid_request', 'Invalid note payload', parsed.error.issues)
        const note = upsertNote(
          numericParam(params, 'appId'),
          numericParam(params, 'versionId'),
          decodeURIComponent(textParam(params, 'locale')),
          parsed.data.markdown,
        )
        return Response.json({ note })
      }),
      DELETE: handle(async ({ request, params }) => {
        requireAdmin(request)
        deleteNote(
          numericParam(params, 'appId'),
          numericParam(params, 'versionId'),
          decodeURIComponent(textParam(params, 'locale')),
        )
        return Response.json({ ok: true })
      }),
    },
  },
})
