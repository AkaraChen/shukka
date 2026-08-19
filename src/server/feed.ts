import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '~/db/index.ts'
import { artifacts, versions } from '~/db/schema.ts'
import { ShukkaError } from '~/lib/errors.ts'
import { getObjectText, presignGet, settingsFromApp } from '~/lib/storage.ts'
import { isMetadataFile } from '~/lib/update-metadata.ts'
import { getAppBySlug } from './apps.ts'
import { getChannel } from './channels.ts'
import { recordHit } from './hits.ts'

/**
 * Serves the update feed consumed by electron-updater's generic provider.
 * Metadata resolves against the channel's current version; artifacts resolve
 * by filename across the channel so a version switch mid-download stays valid
 * (ADR: update-feed-proxy).
 */
export async function resolveFeedRequest(
  appSlug: string,
  channelName: string,
  filename: string,
): Promise<{ kind: 'metadata'; body: string } | { kind: 'redirect'; url: string }> {
  const app = getAppBySlug(appSlug)
  const channel = getChannel(app.id, channelName)
  const s3 = settingsFromApp(app)

  if (isMetadataFile(filename)) {
    if (!channel.currentVersionId) {
      throw new ShukkaError('not_found', `Channel "${channelName}" has no published version`)
    }
    const artifact = db
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.versionId, channel.currentVersionId), eq(artifacts.filename, filename)))
      .get()
    if (!artifact) throw new ShukkaError('not_found', `${filename} is not part of the current release`)

    const body = await getObjectText(s3, artifact.s3Key)
    recordHit(channel.currentVersionId, 'metadata')
    return { kind: 'metadata', body }
  }

  const artifact = db
    .select({ s3Key: artifacts.s3Key, versionId: artifacts.versionId })
    .from(artifacts)
    .innerJoin(versions, eq(artifacts.versionId, versions.id))
    .where(and(eq(versions.channelId, channel.id), eq(artifacts.filename, filename), isNotNull(versions.releasedAt)))
    .get()
  if (!artifact) throw new ShukkaError('not_found', `${filename} not found on channel "${channelName}"`)

  recordHit(artifact.versionId, 'artifact')
  return { kind: 'redirect', url: await presignGet(s3, artifact.s3Key) }
}

export function feedBaseUrl(origin: string, appSlug: string, channelName: string): string {
  return `${origin.replace(/\/+$/, '')}/api/update/${appSlug}/${channelName}`
}
