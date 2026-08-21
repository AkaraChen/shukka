#!/usr/bin/env node
// Downloads a pinned MinIO binary and starts it detached (no Docker).
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnDetached } from './spawn-detached.mjs'

const RELEASE = 'RELEASE.2025-09-07T16-13-09Z'
const BINARIES = {
  'win32-x64': {
    url: `https://github.com/minio/minio/releases/download/${RELEASE}/minio.windows-amd64.${RELEASE}.exe`,
    name: 'minio.exe',
  },
  'linux-x64': {
    url: `https://github.com/minio/minio/releases/download/${RELEASE}/minio.linux-amd64.${RELEASE}`,
    name: 'minio',
  },
  'darwin-arm64': {
    url: `https://github.com/minio/minio/releases/download/${RELEASE}/minio.darwin-arm64.${RELEASE}`,
    name: 'minio',
  },
  'darwin-x64': {
    url: `https://github.com/minio/minio/releases/download/${RELEASE}/minio.darwin-amd64.${RELEASE}`,
    name: 'minio',
  },
}

const key = `${process.platform}-${process.arch}`
const binary = BINARIES[key]
if (!binary) {
  process.stderr.write(`No MinIO binary mapped for ${key}\n`)
  process.exit(1)
}

const root = process.env.RUNNER_TEMP || tmpdir()
const binPath = join(root, 'shukka-minio', binary.name)
const dataDir = process.env.MINIO_DATA_DIR || join(root, 'shukka-minio-data')
const logPath = process.env.MINIO_LOG || join(root, 'shukka-minio', 'minio.log')
const bucket = process.env.MINIO_BUCKET || 'releases'
const endpoint = new URL(process.env.MINIO_URL || 'http://localhost:9000')
const address = `${endpoint.hostname === 'localhost' ? '' : endpoint.hostname}:${endpoint.port || '9000'}`

const here = dirname(fileURLToPath(import.meta.url))

process.stdout.write(`Downloading MinIO ${RELEASE} for ${key}\n`)
const response = await fetch(binary.url, { redirect: 'follow' })
if (!response.ok) {
  process.stderr.write(`Failed to download ${binary.url} (${response.status})\n`)
  process.exit(1)
}
await mkdir(dirname(binPath), { recursive: true })
await writeFile(binPath, Buffer.from(await response.arrayBuffer()))
if (process.platform !== 'win32') await chmod(binPath, 0o755)

await mkdir(join(dataDir, bucket), { recursive: true })

const child = spawnDetached(binPath, ['server', dataDir, '--address', address, '--console-address', ':9001'], {
  logPath,
  env: {
    ...process.env,
    MINIO_ROOT_USER: process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY || 'shukka',
    MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY || 'shukkasecret',
  },
})
process.stdout.write(`MinIO pid ${child.pid} log ${logPath}\n`)

await new Promise((resolve, reject) => {
  const wait = spawn(process.execPath, [join(here, 'wait-for.mjs'), `${endpoint.origin}/minio/health/live`], {
    stdio: 'inherit',
  })
  wait.on('exit', (code) => {
    if (code === 0) {
      resolve()
      return
    }
    try {
      process.stderr.write(`${readFileSync(logPath, 'utf8')}\n`)
    } catch {
      // The process may have died before creating a log.
    }
    reject(new Error(`MinIO did not become healthy (exit ${code})`))
  })
})
