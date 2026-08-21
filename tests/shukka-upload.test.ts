import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

type CollectedFile = { filename: string; path: string; size: number }

// The action script is plain ESM with no .d.ts; keep the contract local to this file.
const { collectFiles, readInput, versionFromMetadata } = (await import(
  // @ts-expect-error — scripts/shukka-upload.mjs has no declaration file
  '../scripts/shukka-upload.mjs'
)) as {
  collectFiles: (directory: string) => Promise<CollectedFile[]>
  versionFromMetadata: (files: { filename: string; path: string }[]) => Promise<string>
  readInput: (actionInput: string, envName: string, fallback?: string) => string
}

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'shukka-upload-'))
}

describe('collectFiles', () => {
  it('includes latest.yml and App.exe and skips dotfiles', async () => {
    const directory = tempDir()
    writeFileSync(join(directory, 'latest.yml'), 'version: 1.2.3\n')
    writeFileSync(join(directory, 'App.exe'), 'binary')
    writeFileSync(join(directory, '.DS_Store'), 'junk')
    writeFileSync(join(directory, '.hidden'), 'secret')

    const files = await collectFiles(directory)
    expect(files.map((file) => file.filename)).toEqual(['App.exe', 'latest.yml'])
  })
})

function mockExit() {
  const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
    throw new Error(`process.exit(${code})`)
  }) as never)
  const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  return {
    write,
    restore() {
      exit.mockRestore()
      write.mockRestore()
    },
  }
}

describe('versionFromMetadata', () => {
  it('reads version: 2.0.0 from yml', async () => {
    const directory = tempDir()
    const path = join(directory, 'latest.yml')
    writeFileSync(path, 'version: 2.0.0\nfiles:\n  - url: App.exe\n')

    await expect(versionFromMetadata([{ filename: 'latest.yml', path }])).resolves.toBe('2.0.0')
  })

  it('reads version from latest.json when no yml is present', async () => {
    const directory = tempDir()
    const path = join(directory, 'latest.json')
    writeFileSync(path, '{"version":"1.4.2","platforms":{}}')

    await expect(versionFromMetadata([{ filename: 'latest.json', path }])).resolves.toBe('1.4.2')
  })

  it('fails with a clear message when the directory has no metadata', async () => {
    const exit = mockExit()

    await expect(versionFromMetadata([{ filename: 'App.exe', path: '/tmp/App.exe' }])).rejects.toThrow(
      /process\.exit\(1\)/,
    )
    expect(exit.write).toHaveBeenCalledWith(
      expect.stringMatching(/latest\*\.yml.*latest\.json|latest\.json.*latest\*\.yml/),
    )

    exit.restore()
  })
})

describe('readInput', () => {
  const previous: Record<string, string | undefined> = {}

  afterEach(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    for (const name of Object.keys(previous)) delete previous[name]
  })

  function setEnv(name: string, value: string | undefined) {
    previous[name] = process.env[name]
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }

  it('prefers SHUKKA_* over INPUT_* over the fallback', () => {
    setEnv('SHUKKA_APP', undefined)
    setEnv('INPUT_APP', undefined)
    expect(readInput('app', 'SHUKKA_APP', 'fallback')).toBe('fallback')

    setEnv('INPUT_APP', 'from-action')
    expect(readInput('app', 'SHUKKA_APP', 'fallback')).toBe('from-action')

    setEnv('SHUKKA_APP', 'from-env')
    expect(readInput('app', 'SHUKKA_APP', 'fallback')).toBe('from-env')
  })

  it('maps hyphenated action inputs to INPUT_* with the hyphen kept', () => {
    setEnv('SHUKKA_SERVER_URL', undefined)
    setEnv('INPUT_SERVER-URL', 'https://updates.example.test')
    expect(readInput('server-url', 'SHUKKA_SERVER_URL')).toBe('https://updates.example.test')
  })
})
