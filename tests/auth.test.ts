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
const appsServer = await import('~/server/apps.ts')
const { ShukkaError } = await import('~/lib/errors.ts')

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

function keyFor(appId: number, name = 'ci') {
  const { plaintext, hash, hint } = auth.generateApiKey()
  const row = db.insert(apiKeys).values({ appId, name, hash, hint }).returning().get()
  return { plaintext, row }
}

const bearer = (token: string) => new Request('https://shukka.test/api/v1/upload/init', {
  headers: { authorization: `Bearer ${token}` },
})

describe('admin session', () => {
  beforeEach(() => {
    db.delete(admin).run()
    db.delete(sessions).run()
    db.delete(apps).run()
  })

  it('reports uninitialized until an admin password is set', () => {
    expect(auth.isInitialized()).toBe(false)
    auth.initializeAdmin('correct horse battery')
    expect(auth.isInitialized()).toBe(true)
  })

  it('refuses a second initialization', () => {
    auth.initializeAdmin('correct horse battery')
    expect(() => auth.initializeAdmin('another one')).toThrow(ShukkaError)
  })

  it('rejects short passwords', () => {
    expect(() => auth.initializeAdmin('short')).toThrow(/at least 8/)
  })

  it('issues a session only for the right password', () => {
    auth.initializeAdmin('correct horse battery')
    expect(auth.sessionIsValid(auth.login('correct horse battery'))).toBe(true)
    expect(() => auth.login('wrong')).toThrow(ShukkaError)
  })

  it('invalidates every session when the password changes', () => {
    auth.initializeAdmin('correct horse battery')
    const old = auth.login('correct horse battery')
    const fresh = auth.changePassword('correct horse battery', 'a brand new one')

    expect(auth.sessionIsValid(old)).toBe(false)
    expect(auth.sessionIsValid(fresh)).toBe(true)
  })

  it('drops the session on sign out', () => {
    auth.initializeAdmin('correct horse battery')
    const token = auth.login('correct horse battery')
    auth.destroySession(token)
    expect(auth.sessionIsValid(token)).toBe(false)
  })

  it('reads the session cookie out of a request', () => {
    const request = new Request('https://shukka.test/apps', {
      headers: { cookie: `other=1; ${auth.SESSION_COOKIE}=abc123; trailing=2` },
    })
    expect(auth.readSessionCookie(request)).toBe('abc123')
  })
})

describe('app actor', () => {
  beforeEach(() => {
    db.delete(admin).run()
    db.delete(sessions).run()
    db.delete(apps).run()
  })

  it('resolves a session actor and a matching key, and rejects a foreign key', async () => {
    auth.initializeAdmin('correct horse battery')
    const token = auth.login('correct horse battery')
    const acme = await makeApp('acme')
    const { plaintext } = keyFor(acme.id)

    const session = new Request('https://shukka.test/api/v1/apps/acme', {
      headers: { cookie: `${auth.SESSION_COOKIE}=${token}` },
    })
    expect(auth.requireAppActor(session, 'acme').via).toBe('session')
    expect(auth.requireAppActor(session, 'acme').app.slug).toBe('acme')

    const keyReq = new Request('https://shukka.test/api/v1/apps/acme', {
      headers: { authorization: `Bearer ${plaintext}` },
    })
    expect(auth.requireAppActor(keyReq, 'acme').via).toBe('key')
    expect(() => auth.requireAppActor(keyReq, 'other')).toThrow(/not authorized/)

    expect(() => auth.requireSessionApp(keyReq, 'acme')).toThrow(/admin session/)
    expect(auth.requireSessionApp(session, 'acme').slug).toBe('acme')
    expect(() => auth.requireSessionApp(session, 'missing')).toThrow(/not found/)
  })
})

describe('api keys', () => {
  beforeEach(() => {
    db.delete(apps).run()
  })

  it('authorizes the bound app and rejects any other', async () => {
    const acme = await makeApp('acme')
    const other = await makeApp('other')
    const { plaintext } = keyFor(acme.id)

    expect(auth.authenticateApiKey(bearer(plaintext), 'acme').id).toBe(acme.id)
    expect(() => auth.authenticateApiKey(bearer(plaintext), other.slug)).toThrow(/not authorized/)
  })

  it('never stores the plaintext key', async () => {
    const app = await makeApp('acme')
    const { plaintext, row } = keyFor(app.id)
    expect(row.hash).not.toBe(plaintext)
    expect(row.hint.length).toBeLessThan(plaintext.length)
    expect(db.select().from(apiKeys).all().some((key) => key.hash === plaintext)).toBe(false)
  })

  it('rejects a revoked key immediately', async () => {
    const app = await makeApp('acme')
    const { plaintext, row } = keyFor(app.id)
    db.update(apiKeys).set({ revokedAt: Math.floor(Date.now() / 1000) }).run()
    expect(row.revokedAt).toBeNull()
    expect(() => auth.authenticateApiKey(bearer(plaintext), 'acme')).toThrow(/Invalid or revoked/)
  })

  it('rejects a missing or malformed authorization header', () => {
    expect(() => auth.authenticateApiKey(new Request('https://shukka.test/'))).toThrow(/Missing Bearer/)
    expect(() => auth.authenticateApiKey(bearer('shk_nonsense'))).toThrow(/Invalid or revoked/)
  })

  it('records last use', async () => {
    const app = await makeApp('acme')
    const { plaintext, row } = keyFor(app.id)
    auth.authenticateApiKey(bearer(plaintext), 'acme')
    expect(db.select().from(apiKeys).all().find((key) => key.id === row.id)?.lastUsedAt).toBeTypeOf('number')
  })

  it('deletes only revoked keys', async () => {
    const app = await makeApp('acme')
    const { row } = keyFor(app.id)

    // A live key cannot be hard-deleted.
    expect(() => appsServer.deleteApiKey(app.id, row.id)).toThrow(/Only revoked/)
    expect(db.select().from(apiKeys).all().some((key) => key.id === row.id)).toBe(true)

    // Once revoked, it can be deleted.
    appsServer.revokeApiKey(app.id, row.id)
    appsServer.deleteApiKey(app.id, row.id)
    expect(db.select().from(apiKeys).all().some((key) => key.id === row.id)).toBe(false)
  })
})
