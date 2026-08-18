import { db } from '~/db/index.ts'
import { apps } from '~/db/schema.ts'
import { getApp, listApiKeys } from './apps.ts'
import { listChannels, listVersions } from './channels.ts'
import { feedBaseUrl } from './feed.ts'
import { listArtifacts } from './releases.ts'
import type { App } from '~/db/schema.ts'

/** Storage settings without the secret, safe to send to the panel. */
export function publicApp(app: App) {
  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    s3Endpoint: app.s3Endpoint,
    s3Region: app.s3Region,
    s3Bucket: app.s3Bucket,
    s3Prefix: app.s3Prefix,
    s3AccessKeyId: app.s3AccessKeyId,
    s3ForcePathStyle: app.s3ForcePathStyle,
    createdAt: app.createdAt,
  }
}

export type PublicApp = ReturnType<typeof publicApp>

export function appSummaries() {
  return db
    .select()
    .from(apps)
    .orderBy(apps.name)
    .all()
    .map((app) => {
      const channelVersions = listChannels(app.id).map((channel) => ({
        channel,
        versions: listVersions(channel.id),
      }))
      const allVersions = channelVersions.flatMap((entry) => entry.versions)

      const channels = channelVersions.map(({ channel, versions }) => ({
        id: channel.id,
        name: channel.name,
        currentVersion: versions.find((version) => version.id === channel.currentVersionId)?.version ?? null,
      }))

      return {
        ...publicApp(app),
        channels,
        totalDownloads: allVersions.reduce((sum, version) => sum + version.artifactHits, 0),
        lastReleasedAt: allVersions.length > 0 ? Math.max(...allVersions.map((v) => v.releasedAt)) : null,
      }
    })
}

export type AppSummary = ReturnType<typeof appSummaries>[number]

export function appDetail(appId: number, origin: string) {
  const app = getApp(appId)
  const channels = listChannels(app.id).map((channel) => {
    const versions = listVersions(channel.id).map((version) => ({
      ...version,
      isCurrent: version.id === channel.currentVersionId,
      artifacts: listArtifacts(version.id),
    }))
    return {
      id: channel.id,
      name: channel.name,
      currentVersionId: channel.currentVersionId,
      feedUrl: feedBaseUrl(origin, app.slug, channel.name),
      versions,
    }
  })

  const keys = listApiKeys(app.id).map((key) => ({
    id: key.id,
    name: key.name,
    hint: key.hint,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
  }))

  return { app: publicApp(app), channels, keys }
}

export type AppDetail = ReturnType<typeof appDetail>
export type ChannelDetail = AppDetail['channels'][number]
export type VersionDetail = ChannelDetail['versions'][number]
