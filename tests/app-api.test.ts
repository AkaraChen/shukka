import './setup-db.ts'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/lib/storage.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/lib/storage.ts')>()
  return { ...actual, verifyWritable: vi.fn(async () => undefined) }
})

const { db } = await import('~/db/index.ts')
const { admin, apiKeys, apps, sessions } = await import('~/db/schema.ts')
const auth = await import('~/lib/auth.ts')
const { createApp } = await import('~/server/apps.ts')
const appRoute = await import('~/routes/api/v1/apps.$appSlug.ts')
const keysRoute = await import('~/routes/api/v1/apps.$appSlug.keys.ts')
const keyIdRoute = await import('~/routes/api/v1/apps.$appSlug.keys.$keyId.ts')

type ServerRoute = {
  options: {
    server?: {
      handlers?: Record<string, (ctx: { request: Request; params: Record<string, string | undefined> }) => Promise<Response>>
    }
  }
}

function routeHandler(route: unknown, method: string) {
  const handler = (route as ServerRoute).options.server?.handlers?.[method]
  if (!handler) throw new Error(`Route has no ${method} handler`)
  return handler
}

function makeApp(slug: string) {
  return createApp({
    name: slug,
    slug,
    s3Endpoint: null,
    s3Region: 'us-east-1',
    s3Bucket: 'releases',
    s3Prefix: slug,
    s3AccessKeyId: 'key',
    s3SecretAccessKey: 'secret',
    s3ForcePathStyle: false,
  })
}

describe('app API auth matrix', () => {
  beforeEach(() => {
    db.delete(admin).run()
    db.delete(sessions).run()
    db.delete(apps).run()
    auth.initializeAdmin('correct horse battery')
  })

  it('lets a bound API key read and patch the app, but not delete it or manage keys', async () => {
    const app = await makeApp('acme')
    const { plaintext, hash, hint } = auth.generateApiKey()
    const key = db.insert(apiKeys).values({ appId: app.id, name: 'ci', hash, hint }).returning().get()

    const GET = routeHandler(appRoute.Route, 'GET')
    const ok = await GET({
      request: new Request('https://shukka.test/api/v1/apps/acme', {
        headers: { authorization: `Bearer ${plaintext}` },
      }),
      params: { appSlug: 'acme' },
    })
    expect(ok.status).toBe(200)
    expect(((await ok.json()) as { app: { slug: string } }).app.slug).toBe('acme')

    const PATCH = routeHandler(appRoute.Route, 'PATCH')
    const patched = await PATCH({
      request: new Request('https://shukka.test/api/v1/apps/acme', {
        method: 'PATCH',
        headers: { authorization: `Bearer ${plaintext}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Acme',
          slug: 'acme',
          s3Endpoint: null,
          s3Region: 'us-east-1',
          s3Bucket: 'releases',
          s3Prefix: 'acme',
          s3AccessKeyId: 'key',
          s3SecretAccessKey: 'secret',
          s3ForcePathStyle: false,
        }),
      }),
      params: { appSlug: 'acme' },
    })
    expect(patched.status).toBe(200)
    expect(((await patched.json()) as { app: { name: string } }).app.name).toBe('Acme')

    const DELETE = routeHandler(appRoute.Route, 'DELETE')
    const forbidden = await DELETE({
      request: new Request('https://shukka.test/api/v1/apps/acme', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${plaintext}` },
      }),
      params: { appSlug: 'acme' },
    })
    expect(forbidden.status).toBe(403)

    const GET_KEYS = routeHandler(keysRoute.Route, 'GET')
    const keysDenied = await GET_KEYS({
      request: new Request('https://shukka.test/api/v1/apps/acme/keys', {
        headers: { authorization: `Bearer ${plaintext}` },
      }),
      params: { appSlug: 'acme' },
    })
    expect(keysDenied.status).toBe(403)

    const DELETE_KEY = routeHandler(keyIdRoute.Route, 'DELETE')
    const keyDeleteDenied = await DELETE_KEY({
      request: new Request(`https://shukka.test/api/v1/apps/acme/keys/${key.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${plaintext}` },
      }),
      params: { appSlug: 'acme', keyId: String(key.id) },
    })
    expect(keyDeleteDenied.status).toBe(403)

    const POST_KEY = routeHandler(keysRoute.Route, 'POST')
    const keyDenied = await POST_KEY({
      request: new Request('https://shukka.test/api/v1/apps/acme/keys', {
        method: 'POST',
        headers: { authorization: `Bearer ${plaintext}`, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'stolen' }),
      }),
      params: { appSlug: 'acme' },
    })
    expect(keyDenied.status).toBe(403)
  })

  it('lets a session list keys', async () => {
    await makeApp('acme')
    const token = auth.login('correct horse battery')
    const GET_KEYS = routeHandler(keysRoute.Route, 'GET')
    const listed = await GET_KEYS({
      request: new Request('https://shukka.test/api/v1/apps/acme/keys', {
        headers: { cookie: `${auth.SESSION_COOKIE}=${token}` },
      }),
      params: { appSlug: 'acme' },
    })
    expect(listed.status).toBe(200)
    expect(((await listed.json()) as { keys: unknown[] }).keys).toEqual([])
  })

  it('rejects an unauthenticated app read', async () => {
    await makeApp('acme')
    const GET = routeHandler(appRoute.Route, 'GET')
    const denied = await GET({
      request: new Request('https://shukka.test/api/v1/apps/acme'),
      params: { appSlug: 'acme' },
    })
    expect(denied.status).toBe(401)
    expect(((await denied.json()) as { error: string }).error).toBe('unauthorized')
  })

  it('lets a session issue a key', async () => {
    const app = await makeApp('acme')
    const token = auth.login('correct horse battery')
    const POST_KEY = routeHandler(keysRoute.Route, 'POST')
    const created = await POST_KEY({
      request: new Request('https://shukka.test/api/v1/apps/acme/keys', {
        method: 'POST',
        headers: { cookie: `${auth.SESSION_COOKIE}=${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'ci' }),
      }),
      params: { appSlug: 'acme' },
    })
    expect(created.status).toBe(201)
    const body = (await created.json()) as { plaintext: string }
    expect(body.plaintext.startsWith('shk_')).toBe(true)
    expect(app.id).toBeTypeOf('number')
  })
})
