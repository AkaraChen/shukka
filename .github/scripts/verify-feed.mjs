#!/usr/bin/env node
// Asserts the public feed serves the expected version and redirects artifacts to storage.
const base = process.argv[2]
const expectedVersion = process.argv[3]

const metadataResponse = await fetch(`${base}/latest.yml`)
if (!metadataResponse.ok) {
  throw new Error(`Feed returned ${metadataResponse.status} for latest.yml`)
}

const body = await metadataResponse.text()
const version = body.match(/^version:\s*(.+)$/m)?.[1]?.trim()
if (version !== expectedVersion) {
  throw new Error(`Feed serves version ${version}, expected ${expectedVersion}`)
}

const artifact = body.match(/^\s+- url:\s*(.+)$/m)?.[1]?.trim()
if (!artifact) throw new Error('Feed metadata lists no artifact url')

const redirect = await fetch(`${base}/${artifact}`, { redirect: 'manual' })
if (redirect.status !== 302) {
  throw new Error(`Artifact request returned ${redirect.status}, expected a 302 redirect`)
}

const download = await fetch(redirect.headers.get('location'))
if (!download.ok) throw new Error(`Presigned download failed with ${download.status}`)

process.stdout.write(`Feed serves ${version} and redirects ${artifact} to storage\n`)
