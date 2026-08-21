#!/usr/bin/env node
// Asserts the public feed serves the expected version and redirects artifacts to storage.
const base = process.argv[2]
const expectedVersion = process.argv[3]
const metadataNames = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']
const TIMEOUT_MS = 30_000

function get(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
}

let artifact = null
for (const name of metadataNames) {
  process.stdout.write(`GET ${base}/${name}\n`)
  const metadataResponse = await get(`${base}/${name}`)
  if (!metadataResponse.ok) {
    throw new Error(`Feed returned ${metadataResponse.status} for ${name}`)
  }

  const body = await metadataResponse.text()
  const version = body.match(/^version:\s*(.+)$/m)?.[1]?.trim()
  if (version !== expectedVersion) {
    throw new Error(`${name} serves version ${version}, expected ${expectedVersion}`)
  }

  artifact ??= body.match(/^\s+- url:\s*(.+)$/m)?.[1]?.trim()
}

if (!artifact) throw new Error('Feed metadata lists no artifact url')

process.stdout.write(`GET ${base}/${artifact} (expect 302)\n`)
const redirect = await get(`${base}/${artifact}`, { redirect: 'manual' })
if (redirect.status !== 302) {
  throw new Error(`Artifact request returned ${redirect.status}, expected a 302 redirect`)
}

const location = redirect.headers.get('location')
if (!location) throw new Error('Artifact 302 had no Location header')
process.stdout.write(`GET ${location}\n`)
const download = await get(location)
if (!download.ok) throw new Error(`Presigned download failed with ${download.status}`)
await download.arrayBuffer()

process.stdout.write(`Feed serves ${expectedVersion} (${metadataNames.join(', ')}) and redirects ${artifact} to storage\n`)
