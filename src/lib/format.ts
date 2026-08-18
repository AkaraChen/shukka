/** "2.1 MB" style sizes for artifact listings. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes
  let unit = 'B'
  for (const next of units) {
    if (value < 1024) break
    value /= 1024
    unit = next
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${unit}`
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** Relative within a week ("3 hours ago"), plain date beyond that. */
export function formatWhen(unixSeconds: number): string {
  const deltaSeconds = unixSeconds - Math.floor(Date.now() / 1000)
  const absolute = Math.abs(deltaSeconds)
  if (absolute < 60) return 'just now'
  if (absolute < 3600) return relative.format(Math.trunc(deltaSeconds / 60), 'minute')
  if (absolute < 86400) return relative.format(Math.trunc(deltaSeconds / 3600), 'hour')
  if (absolute < 7 * 86400) return relative.format(Math.trunc(deltaSeconds / 86400), 'day')
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
