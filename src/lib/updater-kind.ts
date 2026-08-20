export const UPDATER_KINDS = ['electron', 'tauri'] as const

export type UpdaterKind = (typeof UPDATER_KINDS)[number]

export function isUpdaterKind(value: unknown): value is UpdaterKind {
  return value === 'electron' || value === 'tauri'
}
