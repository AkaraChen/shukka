import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { PackageIcon } from '~/components/brand.tsx'
import { PageHeader } from '~/components/page-header.tsx'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'
import { useApps } from '~/features/apps/queries.ts'
import { formatWhen } from '~/lib/format.ts'

export const Route = createFileRoute('/_panel/apps/')({ component: AppsPage })

function AppsPage() {
  const { data: apps, isPending } = useApps()

  return (
    <>
      <PageHeader title="Apps">
        <Button asChild>
          <Link to="/apps/new">
            <Plus /> New app
          </Link>
        </Button>
      </PageHeader>

      {isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : apps?.length ? (
        <div className="overflow-hidden rounded-2xl bg-card">
          <ul className="divide-y">
            {apps.map((app) => (
              <li key={app.id}>
                <Link
                  to="/apps/$appId"
                  params={{ appId: String(app.id) }}
                  className="flex items-center gap-6 px-5 py-4 transition-colors hover:bg-accent/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{app.name}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{app.slug}</p>
                  </div>

                  <div className="hidden max-w-72 flex-wrap justify-end gap-1.5 md:flex">
                    {app.channels.map((channel) => (
                      <Badge key={channel.id} variant="secondary" className="font-mono font-normal">
                        {channel.currentVersion ? `${channel.name} v${channel.currentVersion}` : channel.name}
                      </Badge>
                    ))}
                  </div>

                  <div className="hidden w-24 text-right sm:block">
                    <p className="text-sm tabular-nums">{app.totalDownloads}</p>
                    <p className="text-xs text-muted-foreground">downloads</p>
                  </div>

                  <div className="hidden w-32 text-right lg:block">
                    {app.lastReleasedAt ? (
                      <>
                        <p className="text-sm">{formatWhen(app.lastReleasedAt)}</p>
                        <p className="text-xs text-muted-foreground">last release</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">no releases</p>
                    )}
                  </div>

                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <FirstRun />
      )}
    </>
  )
}

function FirstRun() {
  const steps = [
    ['Create an app', 'Name it and point it at an S3 bucket — AWS, R2, and MinIO all work.'],
    ['Create an API key', 'One key per repository; it can only publish to its own app.'],
    ['Publish from CI', 'One workflow step uploads the electron-builder output as a release.'],
  ] as const

  return (
    <div className="rounded-2xl bg-card px-8 py-12">
      <PackageIcon className="size-8 text-muted-foreground" />
      <h2 className="mt-5 text-lg">Ship your first update</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Shukka serves electron-updater feeds straight from your own storage. Three steps to a working update
        pipeline:
      </p>
      <ol className="mt-8 max-w-lg space-y-5">
        {steps.map(([title, detail], index) => (
          <li key={title} className="flex gap-4">
            <span className="font-mono text-sm text-muted-foreground">0{index + 1}</span>
            <div>
              <p className="text-sm">{title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <Button asChild className="mt-8">
        <Link to="/apps/new">
          <Plus /> Create your first app
        </Link>
      </Button>
    </div>
  )
}
