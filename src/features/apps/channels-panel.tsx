import { Check, Copy, GitBranch, Plus, Trash2 } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { formatWhen } from '~/lib/format.ts'
import { platformsOf } from './platforms.ts'
import { useCreateChannel, useDeleteChannel, useDeleteVersion, useSetCurrentVersion } from './queries.ts'
import type { ChannelDetail } from '~/server/dashboard.ts'

export function ChannelsPanel({ appId, channels }: { appId: number; channels: ChannelDetail[] }) {
  return (
    <div className="space-y-6">
      {channels.map((channel) => (
        <ChannelCard key={channel.id} appId={appId} channel={channel} />
      ))}
      <NewChannelDialog appId={appId} />
    </div>
  )
}

function ChannelCard({ appId, channel }: { appId: number; channel: ChannelDetail }) {
  const deleteChannel = useDeleteChannel(appId)
  const current = channel.versions.find((version) => version.isCurrent)

  return (
    <section className="overflow-hidden rounded-2xl bg-card">
      <header className="flex items-center gap-3 border-b px-5 py-3.5">
        <GitBranch className="size-4 text-muted-foreground" />
        <h3 className="text-base">{channel.name}</h3>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-muted-foreground"
          onClick={() => {
            if (confirm(`Delete channel "${channel.name}", its version records, and their files in S3?`)) {
              deleteChannel.mutate(channel.id)
            }
          }}
        >
          <Trash2 /> Delete
        </Button>
      </header>

      {current ? (
        <div className="flex flex-wrap items-end justify-between gap-6 px-5 py-5">
          <div>
            <p className="text-3xl tracking-tight">v{current.version}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
              <span>released {formatWhen(current.releasedAt)}</span>
              {platformsOf(current).map((platform) => (
                <Badge key={platform} variant="outline" className="text-muted-foreground">
                  {platform}
                </Badge>
              ))}
            </div>
          </div>
          <dl className="flex gap-8 text-right">
            <div>
              <dd className="text-lg tabular-nums">{current.metadataHits}</dd>
              <dt className="text-xs text-muted-foreground">update checks</dt>
            </div>
            <div>
              <dd className="text-lg tabular-nums">{current.artifactHits}</dd>
              <dt className="text-xs text-muted-foreground">downloads</dt>
            </div>
          </dl>
        </div>
      ) : (
        <div className="px-5 py-8">
          <p className="text-sm text-muted-foreground">
            Nothing published yet. The first upload to this channel becomes the live release — see the Integration
            tab for the one-step workflow.
          </p>
        </div>
      )}

      <FeedUrlRow url={channel.feedUrl} />

      {channel.versions.length > 0 ? <HistoryTable appId={appId} channel={channel} /> : null}
    </section>
  )
}

function FeedUrlRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex items-center gap-3 border-t bg-muted/40 px-5 py-2.5">
      <span className="shrink-0 text-xs text-muted-foreground">Feed</span>
      <code className="truncate font-mono text-xs text-muted-foreground">{url}</code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="ml-auto size-7 shrink-0"
        aria-label="Copy feed URL"
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

function HistoryTable({ appId, channel }: { appId: number; channel: ChannelDetail }) {
  const setCurrent = useSetCurrentVersion(appId)
  const deleteVersion = useDeleteVersion(appId)

  return (
    <div className="border-t">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">Version</TableHead>
            <TableHead>Released</TableHead>
            <TableHead className="text-right">Checks</TableHead>
            <TableHead className="text-right">Downloads</TableHead>
            <TableHead className="pr-5" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {channel.versions.map((version) => (
            <TableRow key={version.id}>
              <TableCell className="pl-5 font-mono text-xs">
                <span className="flex items-center gap-2">
                  {version.version}
                  {version.isCurrent ? (
                    <Badge className="border-flare/30 bg-flare/10 font-sans text-flare">current</Badge>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatWhen(version.releasedAt)}</TableCell>
              <TableCell className="text-right tabular-nums">{version.metadataHits}</TableCell>
              <TableCell className="text-right tabular-nums">{version.artifactHits}</TableCell>
              <TableCell className="pr-4 text-right whitespace-nowrap">
                {version.isCurrent ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setCurrent.mutate({ channelId: channel.id, versionId: version.id })}
                  >
                    Make current
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  aria-label={`Delete version ${version.version}`}
                  onClick={() => {
                    if (confirm(`Delete version ${version.version} and its files from S3?`)) {
                      deleteVersion.mutate(version.id)
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function NewChannelDialog({ appId }: { appId: number }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const createChannel = useCreateChannel(appId)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> New channel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            await createChannel.mutateAsync(name)
            setName('')
            setOpen(false)
          }}
        >
          <DialogHeader>
            <GitBranch className="size-5 text-muted-foreground" />
            <DialogTitle>New channel</DialogTitle>
            <DialogDescription>
              Channels are free-form. electron-builder's <code>channel</code> option must match this name.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="channel-name">Name</Label>
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
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
