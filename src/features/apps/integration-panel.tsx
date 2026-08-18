import { CopyBlock } from '~/components/copy-block.tsx'
import type { ChannelDetail, PublicApp } from '~/server/dashboard.ts'

/**
 * Ordered setup guide for the two integration points: the app reading the feed
 * and the CI pipeline publishing to it.
 */
export function IntegrationPanel({ app, channels }: { app: PublicApp; channels: ChannelDetail[] }) {
  // The default channel is what a fresh integration should point at.
  const channel = channels.find((entry) => entry.name === 'stable') ?? channels[0]
  const channelName = channel?.name ?? 'stable'
  const feedUrl = channel?.feedUrl ?? `https://your-shukka-host/api/update/${app.slug}/stable`

  const steps = [
    {
      title: 'Point electron-builder at the feed',
      detail: 'The generic provider writes this URL into the app at build time. No credentials — the feed is public.',
      code: `# electron-builder.yml
publish:
  provider: generic
  url: ${feedUrl}
  channel: ${channelName}`,
    },
    {
      title: 'Check for updates in the main process',
      detail: 'electron-updater reads the feed, compares versions, and downloads through it.',
      code: `import { autoUpdater } from 'electron-updater'

autoUpdater.setFeedURL({
  provider: 'generic',
  url: '${feedUrl}',
  channel: '${channelName}',
})
autoUpdater.checkForUpdatesAndNotify()`,
    },
    {
      title: 'Publish from CI',
      detail:
        'Create an API key in the API keys tab, store it as a repository secret, and publish the electron-builder output directory after the build.',
      code: `- uses: akarachen/shukka@main
  with:
    server-url: \${{ secrets.SHUKKA_URL }}
    api-key: \${{ secrets.SHUKKA_API_KEY }}
    app: ${app.slug}
    channel: ${channelName}
    directory: dist`,
    },
  ]

  return (
    <ol className="max-w-3xl space-y-10">
      {steps.map((step, index) => (
        <li key={step.title} className="grid gap-2.5">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-sm text-muted-foreground">0{index + 1}</span>
            <h3 className="text-base">{step.title}</h3>
          </div>
          <p className="pl-8 text-sm text-muted-foreground">{step.detail}</p>
          <div className="pl-8">
            <CopyBlock value={step.code} />
          </div>
        </li>
      ))}
    </ol>
  )
}
