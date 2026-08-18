import { mutationOptions, queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { api } from '~/lib/api.ts'
import type { NoteContent, NotesConfig } from '~/lib/release-log.ts'
import { apiGet } from './apps.ts'
import { appKeys } from './keys.ts'

export const noteKeys = {
  all: () => ['release-notes'] as const,
  version: (appId: number, versionId: number) => [...noteKeys.all(), 'version', appId, versionId] as const,
}

export type NotesConfigVariables = { appId: number } & NotesConfig
export type UpsertNoteVariables = { versionId: number; locale: string; markdown: string }
export type DeleteNoteVariables = { versionId: number; locale: string }

type MutationParams<TData, TVariables> = {
  queryClient: QueryClient
  onSuccess?: (data: TData, variables: TVariables) => void
}

/** The notes dialog's read model; fetched lazily when the dialog opens. */
export function versionNotesQueryOptions({ appId, versionId }: { appId: number; versionId: number }) {
  return queryOptions({
    queryKey: noteKeys.version(appId, versionId),
    queryFn: () => apiGet<{ notes: NoteContent[] }>(`/api/admin/apps/${appId}/versions/${versionId}/notes`).then((data) => data.notes),
    staleTime: 30_000,
  })
}

/** Dedicated config endpoint — deliberately not the app PATCH, so no storage probe fires. */
export function updateNotesConfigMutationOptions({
  queryClient,
  onSuccess,
}: MutationParams<{ releaseLog: NotesConfig }, NotesConfigVariables>) {
  return mutationOptions({
    mutationFn: ({ appId, ...values }: NotesConfigVariables) =>
      api.put<{ releaseLog: NotesConfig }>(`/api/admin/apps/${appId}/notes-config`, values),
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: appKeys.detail(variables.appId) })
      onSuccess?.(data, variables)
    },
  })
}

export function upsertNoteMutationOptions({
  appId,
  queryClient,
  onSuccess,
}: MutationParams<{ note: NoteContent }, UpsertNoteVariables> & { appId: number }) {
  return mutationOptions({
    mutationFn: ({ versionId, locale, markdown }: UpsertNoteVariables) =>
      api.put<{ note: NoteContent }>(
        `/api/admin/apps/${appId}/versions/${versionId}/notes/${encodeURIComponent(locale)}`,
        { markdown },
      ),
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: noteKeys.version(appId, variables.versionId) })
      onSuccess?.(data, variables)
    },
  })
}

export function deleteNoteMutationOptions({
  appId,
  queryClient,
  onSuccess,
}: MutationParams<unknown, DeleteNoteVariables> & { appId: number }) {
  return mutationOptions({
    mutationFn: ({ versionId, locale }: DeleteNoteVariables) =>
      api.delete(`/api/admin/apps/${appId}/versions/${versionId}/notes/${encodeURIComponent(locale)}`),
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: noteKeys.version(appId, variables.versionId) })
      onSuccess?.(data, variables)
    },
  })
}
