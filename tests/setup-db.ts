import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Point the app at a throwaway data directory before any module reads it. */
const dir = mkdtempSync(join(tmpdir(), 'shukka-test-'))
process.env.SHUKKA_DATA_DIR = dir
process.env.SHUKKA_DB_PATH = join(dir, 'test.db')
process.env.SHUKKA_KEY_PATH = join(dir, 'test.key')

export const testDataDir = dir
