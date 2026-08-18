#!/usr/bin/env node
// Produces an electron-builder-shaped release directory for integration tests.
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const directory = process.argv[2] ?? 'out'
const version = process.argv[3] ?? '1.0.0'

await mkdir(directory, { recursive: true })

const installer = `demo-app-setup-${version}.exe`
const payload = randomBytes(64 * 1024)
await writeFile(join(directory, installer), payload)

const sha512 = createHash('sha512').update(payload).digest('base64')
const yml = `version: ${version}
files:
  - url: ${installer}
    sha512: ${sha512}
    size: ${payload.length}
path: ${installer}
sha512: ${sha512}
releaseDate: '${new Date().toISOString()}'
`
await writeFile(join(directory, 'latest.yml'), yml)

process.stdout.write(`Wrote ${directory}/${installer} and ${directory}/latest.yml (v${version})\n`)
