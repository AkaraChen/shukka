import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChartColumn, Check, Copy, FileText, GitBranch, Plus, Trash2 } from 'lucide-react'
import { parseAsString, useQueryState } from 'nuqs'
import { useState } from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useFormatters, useT } from '~/lib/i18n/index.ts'
import { useViewRole } from '~/lib/role-context.ts'
import { canEditReleaseNotes, canSeeTrafficStats } from '~/lib/role.ts'
import { cn } from '~/lib/utils.ts'
import { ChannelTrend } from './channel-trend.tsx'
import { platformsOf } from './platforms.ts'
import { VersionTrend } from './version-trend.tsx'
import {
  createChannelMutationOptions,
  deleteVersionMutationOptions,
  setCurrentVersionMutationOptions,
} from './requests/apps.ts'
import type { ChannelDetail, PublicApp, VersionDetail } from '~/server/dashboard.ts'

/**
 * One channel at a time: a single toolbar row holds the switcher (URL-driven
 * via the `channel` query param), the active channel's feed URL, and the
 * new-channel action. The content below sits directly on the page — no card
 * wrapper.
 */
export function ChannelsPanel({ appId, app, channels }: { appId: number; app: PublicApp; channels: ChannelDetail[] }) {
  const role = useViewRole()
  const t = useT()
  const [channelName, setChannelName] = useQueryState('channel', parseAsString)
  // The URL may name a channel that no longer exists; fall back to the first.
  const activeChannel = channels.find((channel) => channel.name === channelName) ?? channels[0]
  // First channel is the default, so keep the URL clean by clearing the param for it.
  const selectChannel = (name: string) => void setChannelName(name === channels[0]?.name ? null : name)

  if (!activeChannel) {
    return (
      <section className="max-w-3xl">
        <div className="grid justify-items-center gap-3 rounded-2xl bg-card px-6 py-8">
          <GitBranch className="size-5 text-foreground/30" />
          <p className="text-sm text-muted-foreground">{t.channels.none}</p>
          {role !== 'content' ? (
            <NewChannelDialog appId={appId} onCreated={(name) => void setChannelName(name)} />
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        {channels.length <= 2 ? (
          <Tabs value={activeChannel.name} onValueChange={selectChannel}>
            <TabsList aria-label={t.apps.detail.channels}>
              {channels.map((channel) => (
                <TabsTrigger key={channel.id} value={channel.name}>
                  {channel.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <Select value={activeChannel.name} onValueChange={selectChannel}>
            <SelectTrigger size="sm" aria-label={t.apps.detail.channels} className="shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="shadow-none">
              {channels.map((channel) => (
                <SelectItem key={channel.id} value={channel.name}>
                  {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {role !== 'content' ? (
          <>
            <FeedUrlRow url={activeChannel.feedUrl} className="min-w-0 flex-1" />
            <NewChannelDialog appId={appId} onCreated={(name) => void setChannelName(name)} />
          </>
        ) : null}
      </div>

      <ChannelView appId={appId} app={app} channel={activeChannel} />
    </section>
  )
}

/**
 * Compact composition: the live release reads as one baseline row — mono
 * version, release meta, then a tight inline metric group — with the history
 * table below on a deeper tonal step. Hierarchy comes from size and the
 * ink-opacity ladder, never from weight.
 */
function ChannelView({ appId, app, channel }: { appId: number; app: PublicApp; channel: ChannelDetail }) {
  const current = channel.versions.find((version) => version.isCurrent)
  const t = useT()
  const format = useFormatters()
  const role = useViewRole()

  return (
    <>
      {current ? (
        <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="font-mono text-2xl tracking-tight tabular-nums">v{current.version}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
            <span>{t.channels.released(format.when(current.releasedAt))}</span>
            {platformsOf(current).map((platform) => (
              <Badge key={platform} variant="outline" className="text-muted-foreground">
                {platform}
              </Badge>
            ))}
          </div>
          <dl className="ml-auto flex flex-wrap gap-x-5 gap-y-1">
            <div className="flex items-baseline gap-1.5">
              <dd className="font-mono text-sm tabular-nums">{current.metadataHits}</dd>
              <dt className="text-xs text-foreground/40">{t.channels.updateChecks}</dt>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dd className="font-mono text-sm tabular-nums">{current.artifactHits}</dd>
              <dt className="text-xs text-foreground/40">{t.channels.downloads}</dt>
            </div>
          </dl>
        </div>
      ) : (
        <div className="mt-6 grid justify-items-center gap-3 rounded-2xl bg-card px-6 py-8">
          <GitBranch className="size-5 text-foreground/30" />
          <p className="max-w-md text-center text-sm text-muted-foreground">
            {t.channels.emptyPre}
            {role !== 'content' ? (
              <Link
                to="/apps/$appId"
                params={{ appId: String(appId) }}
                search={(prev) => ({ ...prev, tab: 'integration' })}
                className="text-foreground/70 underline decoration-foreground/30 underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground/60"
              >
                {t.channels.emptyLink}
              </Link>
            ) : (
              t.channels.emptyLink
            )}
            {t.channels.emptyPost}
          </p>
        </div>
      )}

      {canSeeTrafficStats(role) && channel.versions.length > 0 ? <ChannelTrend appId={appId} channelId={channel.id} /> : null}

      {channel.versions.length > 0 ? <HistoryTable appId={appId} app={app} channel={channel} /> : null}
    </>
  )
}

function FeedUrlRow({ url, className }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const t = useT()

  return (
    <div className={cn('flex h-9 items-center gap-2.5 rounded-xl bg-card pr-1 pl-3', className)}>
      <span className="shrink-0 text-xs text-foreground/40">{t.channels.feed}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-xs">{url}</code>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-7 shrink-0 text-muted-foreground"
        aria-label={t.channels.copyFeed}
        onClick={async () => {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </Button>
    </div>
  )
}

function HistoryTable({ appId, app, channel }: { appId: number; app: PublicApp; channel: ChannelDetail }) {
  const queryClient = useQueryClient()
  const setCurrent = useMutation(setCurrentVersionMutationOptions({ appId, queryClient }))
  const deleteVersion = useMutation(deleteVersionMutationOptions({ appId, queryClient }))
  const t = useT()
  const format = useFormatters()
  const role = useViewRole()

  return (
    <div className="mt-6">
      <div className="overflow-hidden rounded-2xl bg-card px-4">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-normal text-muted-foreground">{t.channels.version}</TableHead>
              <TableHead className="text-xs font-normal text-muted-foreground">{t.channels.releasedColumn}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {channel.versions.map((version) => (
              <TableRow key={version.id}>
                <TableCell className="font-mono text-xs">
                  <span className="flex items-center gap-2">
                    {version.version}
                    {version.isCurrent ? (
                      <Badge className="border-flare/30 bg-flare/10 font-sans text-flare">{t.channels.current}</Badge>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="text-foreground/40">{format.when(version.releasedAt)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    {version.isCurrent ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => setCurrent.mutate({ channelId: channel.id, versionId: version.id })}
                      >
                        {t.channels.makeCurrent}
                      </Button>
                    )}
                    {app.releaseLogEnabled && canEditReleaseNotes(role) ? (
                      <Button
                        size="sm"
                        className="h-7"
                        aria-label={t.releaseLog.editNotes(version.version)}
                        asChild
                      >
                        <Link to="/apps/$appId/notes/$versionId" params={{ appId: String(appId), versionId: String(version.id) }}>
                          <FileText />
                          {t.releaseLog.notes}
                        </Link>
                      </Button>
                    ) : null}
                    {canSeeTrafficStats(role) ? <VersionStatsDialog version={version} /> : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      aria-label={t.channels.deleteVersion(version.version)}
                      onClick={() => {
                        if (confirm(t.channels.deleteVersionConfirm(version.version))) {
                          deleteVersion.mutate(version.id)
                        }
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/** Per-version counters live behind a dialog so the table stays scannable. */
function VersionStatsDialog({ version }: { version: VersionDetail }) {
  const t = useT()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-muted-foreground"
          aria-label={t.channels.viewStats(version.version)}
        >
          <ChartColumn />
          {t.channels.stats}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader className="flex-row items-center gap-2.5">
          <ChartColumn className="size-5 text-muted-foreground" />
          <DialogTitle className="font-mono">v{version.version}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-10">
          <div>
            <p className="font-mono text-2xl tabular-nums">{version.metadataHits}</p>
            <p className="mt-1 text-xs text-foreground/40">{t.channels.updateChecks}</p>
          </div>
          <div>
            <p className="font-mono text-2xl tabular-nums">{version.artifactHits}</p>
            <p className="mt-1 text-xs text-foreground/40">{t.channels.downloads}</p>
          </div>
        </div>
        <VersionTrend version={version} />
      </DialogContent>
    </Dialog>
  )
}

function NewChannelDialog({ appId, onCreated }: { appId: number; onCreated: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const queryClient = useQueryClient()
  const createChannel = useMutation(createChannelMutationOptions({ appId, queryClient }))
  const t = useT()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> {t.channels.newChannel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            await createChannel.mutateAsync(name)
            onCreated(name)
            setName('')
            setOpen(false)
          }}
        >
          <DialogHeader>
            <GitBranch className="size-5 text-muted-foreground" />
            <DialogTitle>{t.channels.newChannel}</DialogTitle>
            <DialogDescription>
              {t.channels.newDescriptionPre}
              <code>channel</code>
              {t.channels.newDescriptionPost}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="channel-name">{t.channels.name}</Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="beta"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createChannel.isPending}>
              {t.channels.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
