import type { UpdaterKind } from '~/lib/updater-kind.ts'
import { inferTauriTarget } from '~/lib/tauri-target.ts'
import type { VersionDetail } from '~/server/dashboard.ts'

/**
 * Platforms covered by a release. Electron reads builder metadata names
 * (`latest.yml` / `latest-mac.yml` / `latest-linux.yml`); Tauri infers from
 * updater artifact filenames.
 */
export function platformsOf(version: VersionDetail, kind: UpdaterKind = 'electron'): string[] {
  const found = new Set<string>()
  if (kind === 'tauri') {
    for (const artifact of version.artifacts) {
      const target = inferTauriTarget(artifact.filename)
      if (!target) continue
      if (target.startsWith('darwin')) found.add('macOS')
      else if (target.startsWith('linux')) found.add('Linux')
      else if (target.startsWith('windows')) found.add('Windows')
    }
  } else {
    for (const artifact of version.artifacts) {
      if (artifact.kind !== 'metadata') continue
      const name = artifact.filename.toLowerCase()
      if (name.includes('-mac')) found.add('macOS')
      else if (name.includes('-linux')) found.add('Linux')
      else if (/\.ya?ml$/i.test(name)) found.add('Windows')
    }
  }
  return ['macOS', 'Windows', 'Linux'].filter((platform) => found.has(platform))
}
