import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { GitBranch, KeyRound, Plug, Settings2 } from 'lucide-react'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { useEffect, useState } from 'react'
import { PageHeader, PageTabBar } from '~/components/page-header.tsx'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { ApiKeysPanel } from '~/features/apps/api-keys-panel.tsx'
import { AppForm } from '~/features/apps/app-form.tsx'
import { ChannelsPanel } from '~/features/apps/channels-panel.tsx'
import { IntegrationPanel } from '~/features/apps/integration-panel.tsx'
import { ReleaseLogSection } from '~/features/apps/release-log-section.tsx'
import type { IntegrationSnippets } from '~/features/apps/integration-snippets.ts'
import { buildIntegrationSnippets } from '~/features/apps/integration-snippets.ts'
import {
  appDetailQueryOptions,
  deleteAppMutationOptions,
  deleteChannelMutationOptions,
  primeAppDetailQuery,
  updateAppMutationOptions,
} from '~/features/apps/requests/apps.ts'
import { useT } from '~/lib/i18n/index.ts'
import { useViewRole } from '~/lib/role-context.ts'
import type { AppDetail, ChannelDetail, PublicApp } from '~/server/dashboard.ts'
import { highlightSnippet } from '~/server/highlight.ts'

const TAB_VALUES = ['channels', 'keys', 'integration', 'settings'] as const

/** Highlight the integration snippets during SSR so the first paint is colored. */
async function highlightIntegrationSnippets(detail: AppDetail | undefined): Promise<IntegrationSnippets | null> {
  if (!detail) return null
  const channel = detail.channels.find((entry) => entry.name === 'stable') ?? detail.channels[0]
  const channelName = channel?.name ?? 'stable'
  const feedUrl = channel?.feedUrl ?? `https://your-shukka-host/api/update/${detail.app.slug}/stable`
  const serverUrl = feedUrl.replace(/\/api\/update\/.*$/, '')
  const raw = buildIntegrationSnippets({ app: detail.app, channelName, feedUrl, serverUrl })
  const entries = await Promise.all(
    Object.entries(raw).map(async ([key, snippet]) => [
      key,
      { ...snippet, html: await highlightSnippet(snippet.code, snippet.lang) },
    ]),
  )
  return Object.fromEntries(entries) as IntegrationSnippets
}

export const Route = createFileRoute('/_panel/apps/$appId')({
  loader: async ({ context, params }) => {
    const detail = await primeAppDetailQuery(context.queryClient, Number(params.appId))
    const snippets = await highlightIntegrationSnippets(detail)
    return { detail, snippets }
  },
  component: AppDetailPage,
})

function AppDetailPage() {
  const { appId } = Route.useParams()
  const id = Number(appId)
  const { detail: initialData, snippets } = Route.useLoaderData()
  const { data, isPending, error } = useQuery({ ...appDetailQueryOptions({ appId: id }), initialData })
  const t = useT()
  const role = useViewRole()
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(TAB_VALUES).withDefault('channels'))
  // The URL may name a tab the current role can't see; fall back to channels.
  const activeTab =
    tab === 'channels' || tab === 'settings' || (role !== 'content' && (tab === 'keys' || tab === 'integration'))
      ? tab
      : 'channels'

  if (isPending) return <Skeleton className="h-64 rounded-xl" />
  if (error || !data) {
    return (
      <div className="rounded-2xl bg-card px-6 py-10">
        <h2 className="text-lg">{t.apps.notFound}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.apps.notFoundDetail}</p>
      </div>
    )
  }

  return (
    <>
      <PageHeader title={data.app.name} />

      <Tabs value={activeTab} onValueChange={(value) => void setTab(value as (typeof TAB_VALUES)[number])}>
        <PageTabBar>
          <TabsList variant="line" className="w-full justify-start gap-5">
            <TabsTrigger value="channels" className="flex-none px-0">
              <GitBranch /> {t.apps.detail.channels}
            </TabsTrigger>
            {role !== 'content' ? (
              <>
                <TabsTrigger value="keys" className="flex-none px-0">
                  <KeyRound /> {t.apps.detail.apiKeys}
                </TabsTrigger>
                <TabsTrigger value="integration" className="flex-none px-0">
                  <Plug /> {t.apps.detail.integration}
                </TabsTrigger>
              </>
            ) : null}
            <TabsTrigger value="settings" className="flex-none px-0">
              <Settings2 /> {t.apps.detail.settings}
            </TabsTrigger>
          </TabsList>
        </PageTabBar>

        <TabsContent value="channels" className="mt-6">
          <ChannelsPanel appId={id} app={data.app} channels={data.channels} />
        </TabsContent>
        {role !== 'content' ? (
          <>
            <TabsContent value="keys" className="mt-6">
              <ApiKeysPanel appId={id} keys={data.keys} />
            </TabsContent>
            <TabsContent value="integration" className="mt-6">
              {snippets ? (
                <IntegrationPanel app={data.app} channels={data.channels} snippets={snippets} />
              ) : (
                <IntegrationPanelLoader app={data.app} channels={data.channels} />
              )}
            </TabsContent>
          </>
        ) : null}
        <TabsContent value="settings" className="mt-6">
          <AppSettings appId={id} app={data.app} channels={data.channels} />
        </TabsContent>
      </Tabs>
    </>
  )
}

/**
 * Client-side fallback when the loader had no snippets (e.g. the prefetch
 * failed and the query refetched after mount): highlight once in the browser.
 */
function IntegrationPanelLoader({ app, channels }: { app: PublicApp; channels: AppDetail['channels'] }) {
  const [snippets, setSnippets] = useState<IntegrationSnippets | null>(null)

  useEffect(() => {
    let cancelled = false
    const channel = channels.find((entry) => entry.name === 'stable') ?? channels[0]
    const channelName = channel?.name ?? 'stable'
    const feedUrl = channel?.feedUrl ?? `https://your-shukka-host/api/update/${app.slug}/stable`
    const serverUrl = feedUrl.replace(/\/api\/update\/.*$/, '')
    const raw = buildIntegrationSnippets({ app, channelName, feedUrl, serverUrl })
    void Promise.all(
      Object.entries(raw).map(async ([key, snippet]) => {
        const { codeToHtml } = await import('shiki')
        const html = await codeToHtml(snippet.code, {
          lang: snippet.lang,
          themes: { light: 'github-light-default', dark: 'github-dark-default' },
        })
        return [key, { ...snippet, html }]
      }),
    ).then((entries) => {
      if (!cancelled) setSnippets(Object.fromEntries(entries) as IntegrationSnippets)
    })
    return () => {
      cancelled = true
    }
  }, [app, channels])

  if (!snippets) return <Skeleton className="h-64 rounded-xl" />
  return <IntegrationPanel app={app} channels={channels} snippets={snippets} />
}

const SETTINGS_SECTIONS = ['general', 'storage', 'release-log', 'danger'] as const
type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

function AppSettings({ appId, app, channels }: { appId: number; app: PublicApp; channels: ChannelDetail[] }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const updateApp = useMutation(updateAppMutationOptions({ appId, queryClient }))
  const deleteApp = useMutation(deleteAppMutationOptions({ queryClient }))
  const t = useT()
  const role = useViewRole()
  const [section, setSection] = useQueryState(
    'section',
    parseAsStringLiteral(SETTINGS_SECTIONS).withDefault('general'),
  )
  // The URL may name a section the current role can't see: content only gets
  // the release-log section, and danger stays admin-only.
  const activeSection: SettingsSection =
    role === 'content' ? 'release-log' : section === 'danger' && role !== 'admin' ? 'general' : section

  const sections: { id: SettingsSection; label: string }[] =
    role === 'content'
      ? [{ id: 'release-log', label: t.releaseLog.title }]
      : [
          { id: 'general', label: t.form.general },
          { id: 'storage', label: t.form.storage },
          { id: 'release-log', label: t.releaseLog.title },
          ...(role === 'admin' ? [{ id: 'danger' as const, label: t.apps.detail.dangerZone }] : []),
        ]

  return (
    <div className="flex gap-10">
      {sections.length > 1 ? (
        <nav aria-label={t.apps.detail.settings} className="hidden w-36 flex-none md:block">
          <ul className="sticky top-6 space-y-1">
            {sections.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-current={activeSection === entry.id ? 'page' : undefined}
                  onClick={() => void setSection(entry.id)}
                  className={
                    activeSection === entry.id
                      ? 'block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-foreground'
                      : 'block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground'
                  }
                >
                  {entry.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="min-w-0 max-w-2xl flex-1">
        {activeSection === 'release-log' ? (
          <ReleaseLogSection appId={appId} app={app} />
        ) : activeSection === 'danger' ? (
          <div className="space-y-10">
            <section>
              <h3 className="text-base text-destructive">{t.apps.detail.deleteTitle}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.apps.detail.deleteDetail}</p>
              <Button
                variant="destructive"
                className="mt-4"
                onClick={async () => {
                  if (!confirm(t.apps.detail.deleteConfirm(app.name))) return
                  await deleteApp.mutateAsync(appId)
                  await router.navigate({ to: '/apps' })
                }}
              >
                {t.apps.detail.deleteButton}
              </Button>
            </section>
            <DeleteChannelSection appId={appId} channels={channels} />
          </div>
        ) : (
          <AppForm
            initial={app}
            submitLabel={t.apps.detail.saveChanges}
            secretOptional
            section={activeSection}
            onSubmit={(values) => updateApp.mutateAsync(values)}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Channel deletion lives in the danger zone rather than the channel view: it
 * is rare and irreversible, and a footer button under the versions table was
 * too easy to misclick.
 */
function DeleteChannelSection({ appId, channels }: { appId: number; channels: ChannelDetail[] }) {
  const queryClient = useQueryClient()
  const deleteChannel = useMutation(deleteChannelMutationOptions({ appId, queryClient }))
  const [channelId, setChannelId] = useState<string | null>(null)
  // The channel pending deletion is captured so the dialog content stays
  // stable while it closes after a successful delete.
  const [pendingDelete, setPendingDelete] = useState<ChannelDetail | null>(null)
  const t = useT()

  const selected = channels.find((channel) => String(channel.id) === channelId)

  if (channels.length === 0) return null

  return (
    <section>
      <h3 className="text-base text-destructive">{t.apps.detail.deleteChannelTitle}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t.apps.detail.deleteChannelDetail}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Select value={channelId ?? ''} onValueChange={setChannelId}>
          <SelectTrigger className="w-44 shadow-none" aria-label={t.apps.detail.deleteChannelLabel}>
            <SelectValue placeholder={t.apps.detail.deleteChannelLabel} />
          </SelectTrigger>
          <SelectContent className="shadow-none">
            {channels.map((channel) => (
              <SelectItem key={channel.id} value={String(channel.id)}>
                {channel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="destructive" disabled={!selected} onClick={() => setPendingDelete(selected ?? null)}>
          {t.apps.detail.deleteChannelButton}
        </Button>
      </div>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingDelete ? t.apps.detail.deleteChannelDialogTitle(pendingDelete.name) : null}</DialogTitle>
            <DialogDescription>{t.apps.detail.deleteChannelDialogDetail}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t.apps.detail.deleteChannelCancel}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteChannel.isPending}
              onClick={async () => {
                if (!pendingDelete) return
                await deleteChannel.mutateAsync(pendingDelete.id)
                setPendingDelete(null)
                setChannelId(null)
              }}
            >
              {t.apps.detail.deleteChannelConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
