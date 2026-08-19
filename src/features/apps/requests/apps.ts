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
  channel: string
  version: string | null
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

function appPath(slug: string, suffix = '') {
  return `/api/v1/apps/${encodeURIComponent(slug)}${suffix}`
}

export function appsQueryOptions() {
  return queryOptions({
    queryKey: appKeys.list(),
    queryFn: () => apiGet<{ apps: AppSummary[] }>('/api/admin/apps').then((data) => data.apps),
    staleTime: 30_000,
  })
}

export function appDetailQueryOptions({ slug }: { slug: string }) {
  return queryOptions({
    queryKey: appKeys.detail(slug),
    queryFn: () => apiGet<AppDetail>(appPath(slug)),
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

export async function primeAppDetailQuery(queryClient: QueryClient, slug: string) {
  try {
    return await queryClient.ensureQueryData(appDetailQueryOptions({ slug }))
  } catch {
    queryClient.removeQueries({ queryKey: appKeys.detail(slug) })
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
  slug,
  queryClient,
  onSuccess,
}: MutationParams<{ app: PublicApp }, AppFormValues> & { slug: string }) {
  return mutationOptions({
    mutationFn: (values: AppFormValues) => api.patch<{ app: PublicApp }>(appPath(slug), values),
    onSuccess: async (data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appKeys.list() }),
        queryClient.invalidateQueries({ queryKey: appKeys.detail(slug) }),
        queryClient.invalidateQueries({ queryKey: appKeys.detail(data.app.slug) }),
      ])
      onSuccess?.(data, variables)
    },
  })
}

export function deleteAppMutationOptions({ queryClient, onSuccess }: MutationParams<unknown, string>) {
  return mutationOptions({
    mutationFn: (slug: string) => api.delete(appPath(slug)),
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
  slug,
  queryClient,
  mutationFn,
  onSuccess,
}: MutationParams<TData, TVariables> & {
  slug: string
  mutationFn: (variables: TVariables) => Promise<TData>
}) {
  return mutationOptions({
    mutationFn,
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: appKeys.detail(slug) })
      onSuccess?.(data, variables)
    },
  })
}

export function createChannelMutationOptions({
  slug,
  queryClient,
  onSuccess,
}: MutationParams<unknown, string> & { slug: string }) {
  return appScopedMutationOptions({
    slug,
    queryClient,
    onSuccess,
    mutationFn: (name: string) => api.post(appPath(slug, '/channels'), { name }),
  })
}

export function deleteChannelMutationOptions({
  slug,
  queryClient,
  onSuccess,
}: MutationParams<unknown, string> & { slug: string }) {
  return appScopedMutationOptions({
    slug,
    queryClient,
    onSuccess,
    mutationFn: (channel: string) => api.delete(appPath(slug, `/channels/${encodeURIComponent(channel)}`)),
  })
}

export function setCurrentVersionMutationOptions({
  slug,
  queryClient,
  onSuccess,
}: MutationParams<unknown, SetCurrentVersionVariables> & { slug: string }) {
  return appScopedMutationOptions({
    slug,
    queryClient,
    onSuccess,
    mutationFn: ({ channel, version }: SetCurrentVersionVariables) =>
      api.patch(appPath(slug, `/channels/${encodeURIComponent(channel)}`), { currentVersion: version }),
  })
}

export function deleteVersionMutationOptions({
  slug,
  queryClient,
  onSuccess,
}: MutationParams<unknown, { channel: string; version: string }> & { slug: string }) {
  return appScopedMutationOptions({
    slug,
    queryClient,
    onSuccess,
    mutationFn: ({ channel, version }) =>
      api.delete(appPath(slug, `/channels/${encodeURIComponent(channel)}/versions/${encodeURIComponent(version)}`)),
  })
}

export function createApiKeyMutationOptions({
  slug,
  queryClient,
  onSuccess,
}: MutationParams<CreatedApiKey, string> & { slug: string }) {
  return appScopedMutationOptions({
    slug,
    queryClient,
    onSuccess,
    mutationFn: (name: string) => api.post<CreatedApiKey>(appPath(slug, '/keys'), { name }),
  })
}

export function revokeApiKeyMutationOptions({
  slug,
  queryClient,
  onSuccess,
}: MutationParams<unknown, number> & { slug: string }) {
  return appScopedMutationOptions({
    slug,
    queryClient,
    onSuccess,
    mutationFn: (keyId: number) => api.delete(appPath(slug, `/keys/${keyId}`)),
  })
}

export function deleteApiKeyMutationOptions({
  slug,
  queryClient,
  onSuccess,
}: MutationParams<unknown, number> & { slug: string }) {
  return appScopedMutationOptions({
    slug,
    queryClient,
    onSuccess,
    mutationFn: (keyId: number) => api.delete(appPath(slug, `/keys/${keyId}?mode=delete`)),
  })
}
