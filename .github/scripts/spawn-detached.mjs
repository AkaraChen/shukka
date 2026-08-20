import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { dirname } from 'node:path'

/** Start a process that outlives this step on Linux and Windows runners. */
export function spawnDetached(command, args, { logPath, env = process.env } = {}) {
  mkdirSync(dirname(logPath), { recursive: true })
  const fd = openSync(logPath, 'a')
  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: ['ignore', fd, fd],
      env,
      windowsHide: true,
    })
    child.unref()
    return child
  } finally {
    closeSync(fd)
  }
}
