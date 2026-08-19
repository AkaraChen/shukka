# Shukka

Self-hosted release manager for Electron apps that update through `electron-updater` and S3.

Create an app, point it at a bucket, and Shukka gives you a public update feed per channel,
API keys for CI, and a record of every version you have shipped.

## What it does

- **Panel** — apps, channels, versions and download counts behind a single admin password.
- **Storage per app** — each app carries its own S3 settings, so AWS, Cloudflare R2 and MinIO can coexist.
- **Uploads over presigned URLs** — installers go straight from CI to S3; Shukka never proxies the bytes.
- **Public feed** — `electron-updater` reads `/api/update/{app}/{channel}` with no credentials, exactly as
  it reads a generic provider. Metadata is served byte-for-byte as `electron-builder` wrote it.
- **GitHub Action** — one step publishes an `electron-builder` output directory.
- **Agent skill** — `.agents/skills/shukka-ops/` teaches an agent to drive the API.

## Run it

```bash
docker run -d --name shukka -p 3000:3000 -v shukka-data:/data ghcr.io/akarachen/shukka
```

Or from source:

```bash
npm ci
npm run build
npm start          # http://localhost:3000
```

Open the panel and set the admin password on first visit. Everything Shukka persists —
the SQLite database and the key that encrypts stored S3 secrets — lives in `/data`
(`SHUKKA_DATA_DIR`, default `./data`). Back up that directory and nothing else.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP port |
| `SHUKKA_DATA_DIR` | `./data` | Database and encryption key location |
| `SHUKKA_DB_PATH` | `{data}/shukka.db` | Override the database file |

## Publish a release

Create an app in the panel, then an API key on its **API keys** tab. In CI:

```yaml
- uses: akarachen/shukka@main
  with:
    server-url: ${{ secrets.SHUKKA_URL }}
    api-key: ${{ secrets.SHUKKA_API_KEY }}
    app: my-app
    channel: stable
    directory: dist
```

Point the whole `electron-builder` output directory at it — installers, `.blockmap` files
and every `latest*.yml`. The version is read from the metadata unless you pass `version`.

Outside GitHub Actions, the same uploader runs standalone:

```bash
SHUKKA_SERVER_URL=https://updates.example.com \
SHUKKA_API_KEY=shk_… \
SHUKKA_APP=my-app \
SHUKKA_DIRECTORY=dist \
node scripts/shukka-upload.mjs
```

## Point the app at the feed

The **Integration** tab prints these with your real URLs filled in:

```yaml
# electron-builder.yml
publish:
  provider: generic
  url: https://updates.example.com/api/update/my-app/stable
```

Uploads are atomic: until `finalize` succeeds — and, by default, until the version is
promoted or finalized with `release: true` — the channel keeps serving the previous
release, so a half-finished upload never reaches a user.

## Develop

```bash
npm run dev        # panel + API on :3000
npm run check      # lint, typecheck, tests
npm run db:generate # regenerate migrations after editing src/db/schema.ts
```

The GitHub Action is linted with [actionlint](https://github.com/rhysd/actionlint) and
exercised end to end with [act](https://github.com/nektos/act) against a local MinIO —
see the comment at the top of `.github/workflows/action-test.yml`.

## Documentation

| Path | Contents |
|------|----------|
| `docs/prd/` | Product requirements |
| `docs/adr/` | Architecture decisions and their trade-offs |
| `docs/spec.md` | Terminology, HTTP contracts, system invariants |
| `.agents/skills/shukka-ops/references/api.md` | Full API reference |

## License

MIT
