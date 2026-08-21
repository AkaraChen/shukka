const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 10

type Window = { count: number; resetAt: number }

const failures = new Map<string, Window>()

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'local'
}

function prune(ip: string, now: number): Window | undefined {
  const entry = failures.get(ip)
  if (entry && entry.resetAt <= now) {
    failures.delete(ip)
    return undefined
  }
  return entry
}

export function isLimited(ip: string): boolean {
  const entry = prune(ip, Date.now())
  return Boolean(entry && entry.count >= MAX_FAILURES)
}

export function recordFailure(ip: string): void {
  const now = Date.now()
  const entry = prune(ip, now)
  if (!entry) {
    failures.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  entry.count += 1
}

export function recordSuccess(ip: string): void {
  failures.delete(ip)
}

export function resetRateLimitForTests(): void {
  failures.clear()
}
