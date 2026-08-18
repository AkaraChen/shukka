import type { VersionDetail } from '~/server/dashboard.ts'

/**
 * Platforms covered by a release, read from electron-builder's metadata naming:
 * `latest.yml` targets Windows, `latest-mac.yml` macOS, `latest-linux.yml` Linux
 * (same for custom channel names).
 */
export function platformsOf(version: VersionDetail): string[] {
  const found = new Set<string>()
  for (const artifact of version.artifacts) {
    if (artifact.kind !== 'metadata') continue
    const name = artifact.filename.toLowerCase()
    if (name.includes('-mac')) found.add('macOS')
    else if (name.includes('-linux')) found.add('Linux')
    else found.add('Windows')
  }
  return ['macOS', 'Windows', 'Linux'].filter((platform) => found.has(platform))
}
