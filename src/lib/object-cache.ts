const cache = new Map<string, string>()

export function cachedText(key: string, load: () => Promise<string>): Promise<string> {
  const hit = cache.get(key)
  if (hit !== undefined) return Promise.resolve(hit)
  return load().then((value) => {
    cache.set(key, value)
    return value
  })
}

export function clearObjectCache(): void {
  cache.clear()
}
