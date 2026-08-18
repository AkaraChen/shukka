#!/usr/bin/env node
// Polls a URL until it answers (any status) or the timeout elapses.
const url = process.argv[2]
const timeoutMs = Number(process.argv[3] ?? 90_000)
const deadline = Date.now() + timeoutMs

while (Date.now() < deadline) {
  try {
    await fetch(url)
    process.stdout.write(`${url} is up\n`)
    process.exit(0)
  } catch {
    await new Promise((done) => setTimeout(done, 1000))
  }
}

process.stderr.write(`Timed out waiting for ${url}\n`)
process.exit(1)
