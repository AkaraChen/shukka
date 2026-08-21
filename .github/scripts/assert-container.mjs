#!/usr/bin/env node
// Asserts the running image matches the deploy contract: non-root, health, volume.
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const wait = args.includes('--wait')
const data = args.includes('--data')
const fresh = args.includes('--fresh')
const name = args.find((value) => !value.startsWith('--')) ?? 'shukka'
const base = process.env.SHUKKA_URL ?? 'http://localhost:3000'
const timeoutMs = Number(process.env.ASSERT_TIMEOUT_MS ?? 90_000)

function docker(argv) {
  const result = spawnSync('docker', argv, { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`docker ${argv.join(' ')}: ${(result.stderr || result.stdout).trim()}`)
  }
  return result.stdout.trim()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitUntilHealthy() {
  const deadline = Date.now() + timeoutMs
  let last = ''
  while (Date.now() < deadline) {
    const running = docker(['inspect', '--format', '{{.State.Status}}', name])
    if (running !== 'running') throw new Error(`container ${name} is ${running}`)
    last = docker(['inspect', '--format', '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}', name])
    if (last === 'healthy') return
    if (last === 'unhealthy') throw new Error(`container ${name} is unhealthy`)
    if (last === 'none') {
      try {
        await assertHealth()
        return
      } catch {
        // process not listening yet
      }
    }
    await sleep(1000)
  }
  throw new Error(`timed out waiting for ${name} to become healthy (last: ${last || 'unknown'})`)
}

async function assertHealth() {
  const response = await fetch(`${base}/api/health`)
  const body = await response.json()
  if (response.status !== 200 || body.status !== 'ok' || body.db !== 'ok') {
    throw new Error(`/api/health ${response.status} ${JSON.stringify(body)}`)
  }
}

async function assertFresh() {
  const response = await fetch(`${base}/api/admin/session`)
  const body = await response.json()
  if (!response.ok) throw new Error(`/api/admin/session ${response.status} ${JSON.stringify(body)}`)
  if (body.initialized !== false || body.authenticated !== false) {
    throw new Error(`expected a fresh instance, got ${JSON.stringify(body)}`)
  }
}

function assertUid() {
  const uid = docker(['exec', name, 'id', '-u'])
  if (uid !== '1000') throw new Error(`expected uid 1000 (node), got ${uid}`)
}

function assertData() {
  const listing = docker(['exec', name, 'ls', '/data'])
  for (const file of ['shukka.db', 'encryption.key']) {
    if (!listing.includes(file)) throw new Error(`/data missing ${file}: ${listing}`)
  }
}

if (wait) await waitUntilHealthy()
assertUid()
await assertHealth()
if (fresh) await assertFresh()
if (data) assertData()
process.stdout.write('Container contract ok\n')
