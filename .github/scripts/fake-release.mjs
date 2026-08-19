#!/usr/bin/env node
// Produces an electron-builder-shaped multi-platform release directory.
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const directory = process.argv[2] ?? 'out'
const version = process.argv[3] ?? '1.0.0'
const releaseDate = new Date().toISOString()

await mkdir(directory, { recursive: true })

const platforms = [
  { yml: 'latest.yml', artifact: `demo-app-setup-${version}.exe` },
  { yml: 'latest-mac.yml', artifact: `demo-app-${version}-mac.zip` },
  { yml: 'latest-linux.yml', artifact: `demo-app-${version}.AppImage` },
]

const written = []
for (const platform of platforms) {
  const payload = randomBytes(64 * 1024)
  await writeFile(join(directory, platform.artifact), payload)
  const sha512 = createHash('sha512').update(payload).digest('base64')
  const yml = `version: ${version}
files:
  - url: ${platform.artifact}
    sha512: ${sha512}
    size: ${payload.length}
path: ${platform.artifact}
sha512: ${sha512}
releaseDate: '${releaseDate}'
`
  await writeFile(join(directory, platform.yml), yml)
  written.push(platform.yml, platform.artifact)
}

process.stdout.write(`Wrote ${directory}/ {${written.join(', ')}} (v${version})\n`)
