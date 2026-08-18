import { and, desc, eq } from 'drizzle-orm'
import { db } from '~/db/index.ts'
import { artifacts, channels, versions } from '~/db/schema.ts'
import { ShukkaError } from '~/lib/errors.ts'
import { deleteObjects, settingsFromApp } from '~/lib/storage.ts'
import type { App, Channel } from '~/db/schema.ts'

const CHANNEL_PATTERN = /^[a-z0-9][a-z0-9._-]{0,62}$/

export function assertChannelName(name: string): void {
  if (!CHANNEL_PATTERN.test(name)) {
    throw new ShukkaError('invalid_request', 'Channel name must be lowercase letters, digits, dot, dash or underscore')
  }
}

export function listChannels(appId: number): Channel[] {
  // Creation order keeps the default channel first.
  return db.select().from(channels).where(eq(channels.appId, appId)).orderBy(channels.createdAt, channels.id).all()
}

export function getChannel(appId: number, name: string): Channel {
  const channel = db
    .select()
    .from(channels)
    .where(and(eq(channels.appId, appId), eq(channels.name, name)))
    .get()
  if (!channel) throw new ShukkaError('not_found', `Channel "${name}" not found`)
  return channel
}

export function createChannel(appId: number, name: string): Channel {
  assertChannelName(name)
  const existing = db
    .select()
    .from(channels)
    .where(and(eq(channels.appId, appId), eq(channels.name, name)))
    .get()
  if (existing) throw new ShukkaError('conflict', `Channel "${name}" already exists`)
  return db.insert(channels).values({ appId, name }).returning().get()
}

/** Removes the channel, its version records, and every object those versions own. */
export async function deleteChannel(app: App, channelId: number): Promise<void> {
  const channel = db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.appId, app.id)))
    .get()
  if (!channel) throw new ShukkaError('not_found', 'Channel not found')

  const keys = db
    .select({ s3Key: artifacts.s3Key })
    .from(artifacts)
    .innerJoin(versions, eq(artifacts.versionId, versions.id))
    .where(eq(versions.channelId, channelId))
    .all()
    .map((row) => row.s3Key)

  if (keys.length > 0) await deleteObjects(settingsFromApp(app), keys)
  db.delete(channels).where(eq(channels.id, channelId)).run()
}

export function listVersions(channelId: number) {
  return db
    .select()
    .from(versions)
    .where(eq(versions.channelId, channelId))
    .orderBy(desc(versions.releasedAt), desc(versions.id))
    .all()
}

/** Repoints the channel at an existing version; the feed switches atomically. */
export function setCurrentVersion(appId: number, channelId: number, versionId: number | null): void {
  const channel = db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.appId, appId)))
    .get()
  if (!channel) throw new ShukkaError('not_found', 'Channel not found')

  if (versionId !== null) {
    const version = db
      .select()
      .from(versions)
      .where(and(eq(versions.id, versionId), eq(versions.channelId, channelId)))
      .get()
    if (!version) throw new ShukkaError('not_found', 'Version does not belong to this channel')
  }

  db.update(channels).set({ currentVersionId: versionId }).where(eq(channels.id, channelId)).run()
}
