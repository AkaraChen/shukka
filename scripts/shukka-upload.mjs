#!/usr/bin/env node
/**
 * Publishes an electron-builder output directory to Shukka as one version.
 *
 * Protocol (docs/adr/presigned-direct-upload.md):
 *   init -> presigned PUT per file -> direct upload to S3 -> finalize
 *
 * Zero dependencies so it can run from a composite action without a build step.
 */
import { createReadStream } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const MAX_ATTEMPTS = 3

function fail(message) {
  process.stdout.write(`::error::${message}\n`)
  process.exit(1)
}

function required(name, value) {
  if (!value) fail(`Missing required input: ${name}`)
  return value
}

/** electron-builder emits blockmaps and yml alongside installers; skip nothing else. */
const IGNORED = new Set(['.DS_Store', 'builder-debug.yml', 'builder-effective-config.yaml'])

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (!entry.isFile() || IGNORED.has(entry.name) || entry.name.startsWith('.')) continue
    const path = join(directory, entry.name)
    files.push({ filename: entry.name, path, size: (await stat(path)).size })
  }
  return files.sort((a, b) => a.filename.localeCompare(b.filename))
}

/** electron-builder writes the release version into every latest*.yml it produces. */
async function versionFromMetadata(files) {
  const metadata = files.find((file) => /\.ya?ml$/i.test(file.filename))
  if (!metadata) fail('No electron-updater .yml metadata file found in the directory')
  const match = (await readFile(metadata.path, 'utf8')).match(/^version:\s*(.+)$/m)
  if (!match) fail(`Could not read "version" from ${metadata.filename}`)
  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

async function callApi(serverUrl, path, apiKey, body) {
  const response = await fetch(`${serverUrl.replace(/\/+$/, '')}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : {}
  if (!response.ok) fail(`${path} failed (${response.status}): ${payload.message ?? text}`)
  return payload
}

async function putFile(uploadUrl, file) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        // Node streams need duplex:'half' to send a body without buffering it in memory.
        body: createReadStream(file.path),
        duplex: 'half',
        headers: { 'content-length': String(file.size) },
      })
      if (response.ok) return
      if (attempt === MAX_ATTEMPTS) fail(`Upload of ${file.filename} failed with status ${response.status}`)
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) fail(`Upload of ${file.filename} failed: ${error.message}`)
    }
    await new Promise((done) => setTimeout(done, 2 ** attempt * 500))
  }
}

async function main() {
  const serverUrl = required('server-url', process.env.SHUKKA_SERVER_URL)
  const apiKey = required('api-key', process.env.SHUKKA_API_KEY)
  const app = required('app', process.env.SHUKKA_APP)
  const channel = process.env.SHUKKA_CHANNEL || 'stable'
  const directory = resolve(process.env.SHUKKA_DIRECTORY || 'dist')
  const createChannel = process.env.SHUKKA_CREATE_CHANNEL === 'true'
  const release = process.env.SHUKKA_RELEASE === 'true'

  const files = await collectFiles(directory)
  if (files.length === 0) fail(`No files to publish in ${directory}`)

  const version = process.env.SHUKKA_VERSION || (await versionFromMetadata(files))
  process.stdout.write(`Publishing ${app} ${version} to channel ${channel} (${files.length} files)\n`)

  const init = await callApi(serverUrl, '/api/v1/upload/init', apiKey, {
    app,
    channel,
    version,
    createChannel,
    files: files.map((file) => ({ filename: file.filename, size: file.size })),
  })

  const byName = new Map(files.map((file) => [file.filename, file]))
  for (const target of init.files) {
    const file = byName.get(target.filename)
    process.stdout.write(`  ↑ ${target.filename} (${(file.size / 1024 / 1024).toFixed(1)} MB)\n`)
    await putFile(target.uploadUrl, file)
  }

  const result = await callApi(serverUrl, '/api/v1/upload/finalize', apiKey, { app, uploadId: init.uploadId, release })
  process.stdout.write(`Published ${result.version} to ${result.channel}\n`)

  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs')
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${result.version}\nchannel=${result.channel}\n`)
  }
}

main().catch((error) => fail(error.stack ?? String(error)))
