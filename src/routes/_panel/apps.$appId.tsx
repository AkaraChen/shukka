import { createFileRoute, useRouter } from '@tanstack/react-router'
import { GitBranch, KeyRound, Plug, Settings2 } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { ApiKeysPanel } from '~/features/apps/api-keys-panel.tsx'
import { AppForm } from '~/features/apps/app-form.tsx'
import { ChannelsPanel } from '~/features/apps/channels-panel.tsx'
import { IntegrationPanel } from '~/features/apps/integration-panel.tsx'
import { useAppDetail, useDeleteApp, useUpdateApp } from '~/features/apps/queries.ts'
import type { PublicApp } from '~/server/dashboard.ts'

export const Route = createFileRoute('/_panel/apps/$appId')({ component: AppDetailPage })

function AppDetailPage() {
  const { appId } = Route.useParams()
  const id = Number(appId)
  const { data, isPending, error } = useAppDetail(id)

  if (isPending) return <Skeleton className="h-64 rounded-xl" />
  if (error || !data) {
    return (
      <div className="rounded-2xl bg-card px-6 py-10">
        <h2 className="text-lg">App not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">It may have been deleted.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-1.5">
        <h1 className="text-2xl tracking-tight">{data.app.name}</h1>
        <p className="font-mono text-xs text-muted-foreground">
          {data.app.slug} · s3://{data.app.s3Bucket}
          {data.app.s3Prefix ? `/${data.app.s3Prefix}` : ''}
        </p>
      </div>

      <Tabs defaultValue="channels">
        <TabsList variant="line" className="w-full justify-start gap-5 border-b">
          <TabsTrigger value="channels" className="flex-none px-0">
            <GitBranch /> Channels
          </TabsTrigger>
          <TabsTrigger value="keys" className="flex-none px-0">
            <KeyRound /> API keys
          </TabsTrigger>
          <TabsTrigger value="integration" className="flex-none px-0">
            <Plug /> Integration
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex-none px-0">
            <Settings2 /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="mt-6">
          <ChannelsPanel appId={id} channels={data.channels} />
        </TabsContent>
        <TabsContent value="keys" className="mt-6">
          <ApiKeysPanel appId={id} keys={data.keys} />
        </TabsContent>
        <TabsContent value="integration" className="mt-6">
          <IntegrationPanel app={data.app} channels={data.channels} />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <AppSettings appId={id} app={data.app} />
        </TabsContent>
      </Tabs>
    </>
  )
}

function AppSettings({ appId, app }: { appId: number; app: PublicApp }) {
  const router = useRouter()
  const updateApp = useUpdateApp(appId)
  const deleteApp = useDeleteApp()

  return (
    <div className="space-y-12">
      <AppForm
        initial={app}
        submitLabel="Save changes"
        secretOptional
        onSubmit={(values) => updateApp.mutateAsync(values)}
      />

      <section className="max-w-2xl rounded-2xl bg-card px-6 py-5">
        <h3 className="text-base text-destructive">Delete app</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Removes every channel, version record, API key, and the stored objects in S3. Update feeds stop
          responding immediately.
        </p>
        <Button
          variant="destructive"
          className="mt-4"
          onClick={async () => {
            if (!confirm(`Delete "${app.name}" and all its releases? This cannot be undone.`)) return
            await deleteApp.mutateAsync(appId)
            await router.navigate({ to: '/apps' })
          }}
        >
          Delete this app
        </Button>
      </section>
    </div>
  )
}
