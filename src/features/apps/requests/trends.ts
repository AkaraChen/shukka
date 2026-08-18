import { queryOptions } from '@tanstack/react-query'
import type { ChannelTrend, TrendRange, VersionTrend } from '~/lib/trends.ts'
import { apiGet } from './apps.ts'

/**
 * Trend queries are never SSR-primed (the chart sits behind a lazy boundary)
 * and no mutation invalidates them — buckets only grow, so a 30s staleTime is
 * the only freshness knob (ADR: hit-trends).
 */
export const trendKeys = {
  all: () => ['trends'] as const,
  channel: (appId: number, channelId: number, range: TrendRange) =>
    [...trendKeys.all(), 'channel', appId, channelId, range] as const,
  version: (appId: number, versionId: number) => [...trendKeys.all(), 'version', appId, versionId] as const,
}

export function channelTrendQueryOptions({
  appId,
  channelId,
  range,
}: {
  appId: number
  channelId: number
  range: TrendRange
}) {
  return queryOptions({
    queryKey: trendKeys.channel(appId, channelId, range),
    queryFn: () => apiGet<ChannelTrend>(`/api/admin/apps/${appId}/channels/${channelId}/trend?range=${range}`),
    staleTime: 30_000,
  })
}

export function versionTrendQueryOptions({ appId, versionId }: { appId: number; versionId: number }) {
  return queryOptions({
    queryKey: trendKeys.version(appId, versionId),
    queryFn: () => apiGet<VersionTrend>(`/api/admin/apps/${appId}/versions/${versionId}/trend`),
    staleTime: 30_000,
  })
}
