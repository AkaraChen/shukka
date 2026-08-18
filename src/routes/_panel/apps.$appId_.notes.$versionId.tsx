import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { FileText } from 'lucide-react'
import { useQueryState } from 'nuqs'
import { lazy, Suspense, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '~/components/page-header.tsx'
import { Button } from '~/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { appDetailQueryOptions, primeAppDetailQuery } from '~/features/apps/requests/apps.ts'
import {
  deleteNoteMutationOptions,
  upsertNoteMutationOptions,
  versionNotesQueryOptions,
} from '~/features/apps/requests/notes.ts'
import { translateError, useFormatters, useT } from '~/lib/i18n/index.ts'

const NotesEditor = lazy(() => import('~/features/apps/notes-editor.tsx').then((m) => ({ default: m.NotesEditor })))

export const Route = createFileRoute('/_panel/apps/$appId_/notes/$versionId')({
  loader: async ({ context, params }) => {
    const appId = Number(params.appId)
    const versionId = Number(params.versionId)
    const detail = await primeAppDetailQuery(context.queryClient, appId)
    const notes = await context.queryClient
      .ensureQueryData(versionNotesQueryOptions({ appId, versionId }))
      .catch(() => undefined)
    return { detail, notes }
  },
  component: VersionNotesPage,
})

/**
 * Dedicated per-version notes editor (ADR: release-log) — a full page instead
 * of a dialog so writing long-form notes has room. Edits save manually per
 * locale via the save button (success is toasted, failures stay inline and
 * the draft is kept); unsaved drafts survive locale switches. Locale switches
 * via URL; the editor remounts per locale (Crepe has no setMarkdown).
 * Clearing the editor never deletes the stored note — the delete button does
 * that explicitly.
 */
function VersionNotesPage() {
  const { appId, versionId } = Route.useParams()
  const id = Number(appId)
  const vid = Number(versionId)
  const { detail: initialDetail, notes: initialNotes } = Route.useLoaderData()
  const { data } = useQuery({ ...appDetailQueryOptions({ appId: id }), initialData: initialDetail })
  const { data: notes } = useQuery({
    ...versionNotesQueryOptions({ appId: id, versionId: vid }),
    initialData: initialNotes,
  })
  const t = useT()
  const format = useFormatters()
  const queryClient = useQueryClient()
  const [localeParam, setLocaleParam] = useQueryState('locale')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const upsertNote = useMutation(upsertNoteMutationOptions({ appId: id, queryClient }))
  const deleteNote = useMutation(deleteNoteMutationOptions({ appId: id, queryClient }))

  const version = data?.channels.flatMap((channel) => channel.versions).find((entry) => entry.id === vid)

  if (!data || !version) {
    return (
      <div className="rounded-2xl bg-card px-6 py-10">
        <h2 className="text-lg">{t.releaseLog.versionMissing}</h2>
      </div>
    )
  }

  if (!data.app.releaseLogEnabled) {
    return (
      <div className="grid max-w-xl justify-items-start gap-3 rounded-2xl bg-card px-6 py-8">
        <FileText className="size-5 text-foreground/30" />
        <p className="text-sm text-muted-foreground">{t.releaseLog.notEnabled}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/apps/$appId" params={{ appId }} search={{ tab: 'settings', section: 'release-log' }}>
            {t.releaseLog.openSettings}
          </Link>
        </Button>
      </div>
    )
  }

  // Configured locales first, then any locale that already carries a note.
  const configured = data.app.releaseLogLocales
  const extras = (notes ?? []).map((note) => note.locale).filter((tag) => !configured.includes(tag))
  const locales = [...configured, ...extras]
  const fallback = locales.includes(data.app.releaseLogFallbackLocale)
    ? data.app.releaseLogFallbackLocale
    : (locales[0] ?? data.app.releaseLogFallbackLocale)
  const locale = localeParam && locales.includes(localeParam) ? localeParam : fallback

  const existing = notes?.find((note) => note.locale === locale)
  const markdown = drafts[locale] ?? existing?.markdown ?? ''
  const dirty = drafts[locale] !== undefined && drafts[locale] !== (existing?.markdown ?? '')

  function edit(value: string) {
    setDrafts((prev) => ({ ...prev, [locale]: value }))
    setError(null)
  }

  function switchLocale(tag: string) {
    void setLocaleParam(tag)
  }

  async function save() {
    setError(null)
    try {
      await upsertNote.mutateAsync({ versionId: vid, locale, markdown })
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[locale]
        return next
      })
      toast.success(t.releaseLog.saved)
    } catch (cause) {
      setError(translateError(t, cause, t.common.requestFailed))
    }
  }

  async function remove() {
    setError(null)
    try {
      await deleteNote.mutateAsync({ versionId: vid, locale })
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[locale]
        return next
      })
    } catch (cause) {
      setError(translateError(t, cause, t.common.requestFailed))
    }
  }

  return (
    <>
      <PageHeader
        title={t.releaseLog.notesTitle(version.version)}
        back={
          <Link to="/apps/$appId" params={{ appId }} className="transition-colors hover:text-foreground">
            {data.app.name}
          </Link>
        }
      />

      <section className="max-w-3xl">
        <div className="flex">
          {locales.length <= 2 ? (
            <Tabs value={locale} onValueChange={switchLocale}>
              <TabsList aria-label={t.releaseLog.noteLocale}>
                {locales.map((tag) => (
                  <TabsTrigger key={tag} value={tag}>
                    {format.localeName(tag)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <Select value={locale} onValueChange={switchLocale}>
              <SelectTrigger size="sm" aria-label={t.releaseLog.noteLocale} className="shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="shadow-none">
                {locales.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {format.localeName(tag)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-card px-6 py-5">
          <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
            <NotesEditor key={locale} defaultValue={markdown} placeholder={t.releaseLog.noteEmpty} onChange={edit} />
          </Suspense>
        </div>

        <div className="mt-4 space-y-3">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex items-center gap-3">
            <Button disabled={upsertNote.isPending || !dirty || !markdown.trim()} onClick={() => void save()}>
              {t.releaseLog.saveNote}
            </Button>
            {existing ? (
              <Button
                variant="outline"
                disabled={deleteNote.isPending}
                onClick={() => {
                  if (confirm(t.releaseLog.deleteNoteConfirm(locale))) void remove()
                }}
              >
                {t.releaseLog.deleteNote}
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </>
  )
}
