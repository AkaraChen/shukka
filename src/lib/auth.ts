import { and, eq, isNull, lt } from 'drizzle-orm'
import { db } from '~/db/index.ts'
import { admin, apiKeys, apps, sessions } from '~/db/schema.ts'
import { hashPassword, randomToken, sha256, verifyPassword } from './crypto.ts'
import { ShukkaError } from './errors.ts'
import type { App } from '~/db/schema.ts'

export const SESSION_COOKIE = 'shukka_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14

const nowSeconds = () => Math.floor(Date.now() / 1000)

export function isInitialized(): boolean {
  return db.select().from(admin).limit(1).all().length > 0
}

export function initializeAdmin(password: string): string {
  if (isInitialized()) throw new ShukkaError('conflict', 'Shukka is already initialized')
  assertPasswordStrength(password)
  db.insert(admin).values({ id: 1, passwordHash: hashPassword(password) }).run()
  return createSession()
}

export function login(password: string): string {
  const row = db.select().from(admin).limit(1).get()
  if (!row || !verifyPassword(password, row.passwordHash)) {
    throw new ShukkaError('unauthorized', 'Incorrect password')
  }
  return createSession()
}

/** Changing the password invalidates every existing session (ADR: auth-model). */
export function changePassword(currentPassword: string, newPassword: string): string {
  const row = db.select().from(admin).limit(1).get()
  if (!row || !verifyPassword(currentPassword, row.passwordHash)) {
    throw new ShukkaError('unauthorized', 'Incorrect current password')
  }
  assertPasswordStrength(newPassword)
  db.update(admin).set({ passwordHash: hashPassword(newPassword), updatedAt: nowSeconds() }).run()
  db.delete(sessions).run()
  return createSession()
}

function assertPasswordStrength(password: string): void {
  if (password.length < 8) {
    throw new ShukkaError('invalid_request', 'Password must be at least 8 characters')
  }
}

export function createSession(): string {
  db.delete(sessions).where(lt(sessions.expiresAt, nowSeconds())).run()
  const token = randomToken()
  db.insert(sessions)
    .values({ tokenHash: sha256(token), expiresAt: nowSeconds() + SESSION_TTL_SECONDS })
    .run()
  return token
}

export function destroySession(token: string | null): void {
  if (token) db.delete(sessions).where(eq(sessions.tokenHash, sha256(token))).run()
}

export function sessionIsValid(token: string | null): boolean {
  if (!token) return false
  const row = db.select().from(sessions).where(eq(sessions.tokenHash, sha256(token))).get()
  return Boolean(row && row.expiresAt > nowSeconds())
}

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function sessionCookieHeader(token: string, maxAge = SESSION_TTL_SECONDS): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

/** Throws unless the request carries a valid admin session. */
export function requireAdmin(request: Request): void {
  if (!sessionIsValid(readSessionCookie(request))) {
    throw new ShukkaError('unauthorized', 'Admin session required')
  }
}

export const API_KEY_PREFIX = 'shk_'

export function generateApiKey(): { plaintext: string; hash: string; hint: string } {
  const plaintext = `${API_KEY_PREFIX}${randomToken(24)}`
  return { plaintext, hash: sha256(plaintext), hint: `${plaintext.slice(0, 10)}…` }
}

/** Resolves the app an upload request is authorized for; 401 unknown/revoked, 403 wrong app. */
export function authenticateApiKey(request: Request, appSlug?: string): App {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) throw new ShukkaError('unauthorized', 'Missing Bearer API key')

  const key = db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.hash, sha256(token)), isNull(apiKeys.revokedAt)))
    .get()
  if (!key) throw new ShukkaError('unauthorized', 'Invalid or revoked API key')

  const app = db.select().from(apps).where(eq(apps.id, key.appId)).get()
  if (!app) throw new ShukkaError('unauthorized', 'API key references a deleted app')
  if (appSlug && app.slug !== appSlug) {
    throw new ShukkaError('forbidden', `API key is not authorized for app "${appSlug}"`)
  }

  db.update(apiKeys).set({ lastUsedAt: nowSeconds() }).where(eq(apiKeys.id, key.id)).run()
  return app
}

export type AppActor = { app: App; via: 'session' | 'key' }

/**
 * App-scoped actor: Bearer key if `Authorization` is present, otherwise the
 * admin session. The key must be bound to `slug`.
 */
function appBySlug(slug: string): App {
  const app = db.select().from(apps).where(eq(apps.slug, slug)).get()
  if (!app) throw new ShukkaError('not_found', `App "${slug}" not found`)
  return app
}

export function requireAppActor(request: Request, slug: string): AppActor {
  if (request.headers.get('authorization')) {
    return { app: authenticateApiKey(request, slug), via: 'key' }
  }
  requireAdmin(request)
  return { app: appBySlug(slug), via: 'session' }
}

/** Session-only app ops (delete app, API key CRUD). Keys are rejected even if valid. */
export function requireSessionApp(request: Request, slug: string): App {
  if (request.headers.get('authorization')) {
    throw new ShukkaError('forbidden', 'This operation requires an admin session')
  }
  requireAdmin(request)
  return appBySlug(slug)
}
