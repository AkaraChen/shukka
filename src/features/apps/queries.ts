import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '~/lib/api.ts'
import type { AppDetail, AppSummary, PublicApp } from '~/server/dashboard.ts'

export const appKeys = {
  list: ['apps'] as const,
  detail: (appId: number) => ['apps', appId] as const,
}

export function useApps() {
  return useQuery({
    queryKey: appKeys.list,
    queryFn: () => api.get<{ apps: AppSummary[] }>('/api/admin/apps').then((data) => data.apps),
  })
}

export function useAppDetail(appId: number) {
  return useQuery({
    queryKey: appKeys.detail(appId),
    queryFn: () => api.get<AppDetail>(`/api/admin/apps/${appId}`),
  })
}

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

export function useCreateApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: AppFormValues) => api.post<{ app: PublicApp }>('/api/admin/apps', values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appKeys.list }),
  })
}

export function useUpdateApp(appId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: AppFormValues) => api.patch<{ app: PublicApp }>(`/api/admin/apps/${appId}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appKeys.list })
      queryClient.invalidateQueries({ queryKey: appKeys.detail(appId) })
    },
  })
}

export function useDeleteApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (appId: number) => api.delete(`/api/admin/apps/${appId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appKeys.list }),
  })
}

function useAppMutation<TVariables>(appId: number, fn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appKeys.detail(appId) }),
  })
}

export function useCreateChannel(appId: number) {
  return useAppMutation(appId, (name: string) => api.post(`/api/admin/apps/${appId}/channels`, { name }))
}

export function useDeleteChannel(appId: number) {
  return useAppMutation(appId, (channelId: number) => api.delete(`/api/admin/apps/${appId}/channels/${channelId}`))
}

export function useSetCurrentVersion(appId: number) {
  return useAppMutation(appId, ({ channelId, versionId }: { channelId: number; versionId: number | null }) =>
    api.patch(`/api/admin/apps/${appId}/channels/${channelId}`, { currentVersionId: versionId }),
  )
}

export function useDeleteVersion(appId: number) {
  return useAppMutation(appId, (versionId: number) => api.delete(`/api/admin/apps/${appId}/versions/${versionId}`))
}

export function useCreateApiKey(appId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      api.post<{ key: { id: number; hint: string }; plaintext: string }>(`/api/admin/apps/${appId}/keys`, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appKeys.detail(appId) }),
  })
}

export function useRevokeApiKey(appId: number) {
  return useAppMutation(appId, (keyId: number) => api.delete(`/api/admin/apps/${appId}/keys/${keyId}`))
}
