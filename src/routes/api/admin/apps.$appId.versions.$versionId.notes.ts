import { createFileRoute } from '@tanstack/react-router'
import { requireAdmin } from '~/lib/auth.ts'
import { handle, numericParam } from '~/lib/errors.ts'
import { listNotes } from '~/server/release-notes.ts'

/** Every locale's note for one version — the editing dialog's read model. */
export const Route = createFileRoute('/api/admin/apps/$appId/versions/$versionId/notes')({
  server: {
    handlers: {
      GET: handle(async ({ request, params }) => {
        requireAdmin(request)
        return Response.json({ notes: listNotes(numericParam(params, 'appId'), numericParam(params, 'versionId')) })
      }),
    },
  },
})
