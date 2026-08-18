#!/usr/bin/env node
// Sets up a Shukka instance end to end: admin, app on MinIO, and an API key.
import { appendFileSync } from 'node:fs'

const base = process.env.SHUKKA_URL ?? 'http://localhost:3000'
const password = process.env.SHUKKA_PASSWORD ?? 'shukka-test-password'
let cookie = ''

async function call(path, method, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]

  const text = await response.text()
  const payload = text ? JSON.parse(text) : {}
  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${payload.message ?? text}`)
  }
  return payload
}

const state = await call('/api/admin/session', 'GET')
await (state.initialized ? call('/api/admin/login', 'POST', { password }) : call('/api/admin/setup', 'POST', { password }))

const { app } = await call('/api/admin/apps', 'POST', {
  name: 'Demo App',
  slug: 'demo-app',
  s3Endpoint: process.env.MINIO_URL ?? 'http://localhost:9000',
  s3Region: 'us-east-1',
  s3Bucket: process.env.MINIO_BUCKET ?? 'releases',
  s3Prefix: 'demo-app',
  s3AccessKeyId: process.env.MINIO_ACCESS_KEY ?? 'shukka',
  s3SecretAccessKey: process.env.MINIO_SECRET_KEY ?? 'shukkasecret',
  s3ForcePathStyle: true,
})

const { plaintext } = await call(`/api/admin/apps/${app.id}/keys`, 'POST', { name: 'ci' })

process.stdout.write(`Provisioned app ${app.slug} (id ${app.id})\n`)
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `api-key=${plaintext}\napp-id=${app.id}\n`)
} else {
  process.stdout.write(`${plaintext}\n`)
}
