import { mutationOptions, queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { api } from '~/lib/api.ts'
import type { AppDetail, AppSummary, PublicApp } from '~/server/dashboard.ts'
import { appKeys } from './keys.ts'

export type AppFormValues = {
  name: string
  slug: string
  s3Endpoint: string | null
  s3Region: string
  s3Bucket: string
  s3Prefix: string
  s3AccessKeyId: string
  s3SecretAccessKey?: string
  s3ForcePathStyle: boolean
}

export type StorageTestValues = Omit<AppFormValues, 'name' | 'slug'>

export type SetCurrentVersionVariables = {
  channelId: number
  versionId: number | null
}

export type CreatedApiKey = { key: { id: number; hint: string }; plaintext: string }

/**
 * Query functions also run on the server during SSR, where route loaders prime
 * the cache. There a relative fetch needs an absolute origin and the incoming
 * request's session cookie forwarded; in the browser both are implicit.
 */
export async function apiGet<T>(path: string): Promise<T> {
  if (import.meta.env.SSR) {
    const { getRequest } = await import('@tanstack/react-start/server')
    const request = getRequest()
    return api.get<T>(new URL(path, request.url).toString(), {
      headers: { cookie: request.headers.get('cookie') ?? '' },
    })
  }
  return api.get<T>(path)
}

export function appsQueryOptions() {
  return queryOptions({
    queryKey: appKeys.list(),
    queryFn: () => apiGet<{ apps: AppSummary[] }>('/api/admin/apps').then((data) => data.apps),
    staleTime: 30_000,
  })
}

export function appDetailQueryOptions({ appId }: { appId: number }) {
  return queryOptions({
    queryKey: appKeys.detail(appId),
    queryFn: () => apiGet<AppDetail>(`/api/admin/apps/${appId}`),
    staleTime: 30_000,
  })
}

/**
 * Best-effort SSR prefetch for route loaders. A failed prime (e.g. unknown
 * app) is removed from the cache so server and client both render the pending
 * state and the mounted query refetches — preserving the client-only flow.
 */
export async function primeAppsQuery(queryClient: QueryClient) {
  try {
    return await queryClient.ensureQueryData(appsQueryOptions())
  } catch {
    queryClient.removeQueries({ queryKey: appKeys.list() })
    return undefined
  }
}

export async function primeAppDetailQuery(queryClient: QueryClient, appId: number) {
  try {
    return await queryClient.ensureQueryData(appDetailQueryOptions({ appId }))
  } catch {
    queryClient.removeQueries({ queryKey: appKeys.detail(appId) })
    return undefined
  }
}

type MutationParams<TData, TVariables> = {
  queryClient: QueryClient
  onSuccess?: (data: TData, variables: TVariables) => void
}

export function createAppMutationOptions({
  queryClient,
  onSuccess,
}: MutationParams<{ app: PublicApp }, AppFormValues>) {
  return mutationOptions({
    mutationFn: (values: AppFormValues) => api.post<{ app: PublicApp }>('/api/admin/apps', values),
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: appKeys.all() })
      onSuccess?.(data, variables)
    },
  })
}

export function updateAppMutationOptions({
  appId,
  queryClient,
  onSuccess,
}: MutationParams<{ app: PublicApp }, AppFormValues> & { appId: number }) {
  return mutationOptions({
    mutationFn: (values: AppFormValues) => api.patch<{ app: PublicApp }>(`/api/admin/apps/${appId}`, values),
    onSuccess: async (data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appKeys.list() }),
        queryClient.invalidateQueries({ queryKey: appKeys.detail(appId) }),
      ])
      onSuccess?.(data, variables)
    },
  })
}

export function deleteAppMutationOptions({ queryClient, onSuccess }: MutationParams<unknown, number>) {
  return mutationOptions({
    mutationFn: (appId: number) => api.delete(`/api/admin/apps/${appId}`),
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: appKeys.all() })
      onSuccess?.(data, variables)
    },
  })
}

export function testStorageMutationOptions() {
  return mutationOptions({
    mutationFn: (values: StorageTestValues) => api.post<{ ok: boolean }>('/api/admin/storage/test', values),
  })
}

/** Every app-scoped change refreshes that app's detail view, nothing else. */
function appScopedMutationOptions<TData, TVariables>({
  appId,
  queryClient,
  mutationFn,
  onSuccess,
}: MutationParams<TData, TVariables> & {
  appId: number
  mutationFn: (variables: TVariables) => Promise<TData>
}) {
  return mutationOptions({
    mutationFn,
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: appKeys.detail(appId) })
      onSuccess?.(data, variables)
    },
  })
}

export function createChannelMutationOptions({
  appId,
  queryClient,
  onSuccess,
}: MutationParams<unknown, string> & { appId: number }) {
  return appScopedMutationOptions({
    appId,
    queryClient,
    onSuccess,
    mutationFn: (name: string) => api.post(`/api/admin/apps/${appId}/channels`, { name }),
  })
}

export function deleteChannelMutationOptions({
  appId,
  queryClient,
  onSuccess,
}: MutationParams<unknown, number> & { appId: number }) {
  return appScopedMutationOptions({
    appId,
    queryClient,
    onSuccess,
    mutationFn: (channelId: number) => api.delete(`/api/admin/apps/${appId}/channels/${channelId}`),
  })
}

export function setCurrentVersionMutationOptions({
  appId,
  queryClient,
  onSuccess,
}: MutationParams<unknown, SetCurrentVersionVariables> & { appId: number }) {
  return appScopedMutationOptions({
    appId,
    queryClient,
    onSuccess,
    mutationFn: ({ channelId, versionId }: SetCurrentVersionVariables) =>
      api.patch(`/api/admin/apps/${appId}/channels/${channelId}`, { currentVersionId: versionId }),
  })
}

export function deleteVersionMutationOptions({
  appId,
  queryClient,
  onSuccess,
}: MutationParams<unknown, number> & { appId: number }) {
  return appScopedMutationOptions({
    appId,
    queryClient,
    onSuccess,
    mutationFn: (versionId: number) => api.delete(`/api/admin/apps/${appId}/versions/${versionId}`),
  })
}

export function createApiKeyMutationOptions({
  appId,
  queryClient,
  onSuccess,
}: MutationParams<CreatedApiKey, string> & { appId: number }) {
  return appScopedMutationOptions({
    appId,
    queryClient,
    onSuccess,
    mutationFn: (name: string) => api.post<CreatedApiKey>(`/api/admin/apps/${appId}/keys`, { name }),
  })
}

export function revokeApiKeyMutationOptions({
  appId,
  queryClient,
  onSuccess,
}: MutationParams<unknown, number> & { appId: number }) {
  return appScopedMutationOptions({
    appId,
    queryClient,
    onSuccess,
    mutationFn: (keyId: number) => api.delete(`/api/admin/apps/${appId}/keys/${keyId}`),
  })
}

export function deleteApiKeyMutationOptions({
  appId,
  queryClient,
  onSuccess,
}: MutationParams<unknown, number> & { appId: number }) {
  return appScopedMutationOptions({
    appId,
    queryClient,
    onSuccess,
    mutationFn: (keyId: number) => api.delete(`/api/admin/apps/${appId}/keys/${keyId}?mode=delete`),
  })
}
