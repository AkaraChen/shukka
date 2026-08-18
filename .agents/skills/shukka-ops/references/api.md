# Shukka HTTP API

All request and response bodies are JSON. Errors carry a stable machine-readable code:

```json
{ "error": "forbidden", "message": "API key is not authorized for app \"other\"" }
```

| Code | Status | Meaning |
|------|--------|---------|
| `unauthorized` | 401 | Missing/invalid session or API key |
| `forbidden` | 403 | Key is valid but bound to a different app |
| `not_found` | 404 | App, channel, version or key does not exist |
| `conflict` | 409 | Duplicate version, missing artifact, expired upload |
| `invalid_request` | 400 | Malformed payload |
| `storage_error` | 502 | S3 rejected the request |
| `metadata_error` | 422 | Unparseable or contradictory `latest*.yml` |

## Upload API — `Authorization: Bearer shk_…`

### `POST /api/v1/upload/init`

```json
{
  "app": "my-app",
  "channel": "stable",
  "version": "1.4.2",
  "createChannel": false,
  "files": [
    { "filename": "latest.yml", "size": 412 },
    { "filename": "MyApp-Setup-1.4.2.exe", "size": 78123456 }
  ]
}
```

`app` is optional; when present it must match the key's app. `size` is optional but
checked at finalize when provided. At least one `.yml` file is required. `version` and each
`filename` must not contain path separators or `..`.

```json
{
  "uploadId": "…",
  "expiresAt": 1767225600,
  "files": [{ "filename": "latest.yml", "key": "my-app/stable/1.4.2/latest.yml", "uploadUrl": "https://…" }]
}
```

Upload each file with `PUT <uploadUrl>` and the raw bytes as the body. Presigned
URLs expire an hour after `init`.

### `POST /api/v1/upload/finalize`

```json
{ "uploadId": "…", "app": "my-app" }
```

Verifies every object exists (and matches any declared size), parses each yml, and
requires its `version` to equal the declared version. On success:

```json
{
  "versionId": 12,
  "version": "1.4.2",
  "channel": "stable",
  "artifacts": [{ "filename": "latest.yml", "size": 412, "kind": "metadata" }]
}
```

## Admin API — session cookie

| Method & path | Purpose |
|---------------|---------|
| `GET /api/admin/session` | `{ initialized, authenticated }`; no auth required |
| `POST /api/admin/setup` | `{ password }` — first run only, returns a session cookie |
| `POST /api/admin/login` | `{ password }` — returns a session cookie |
| `POST /api/admin/logout` | Drops the current session |
| `POST /api/admin/password` | `{ currentPassword, newPassword }` — invalidates all sessions |
| `GET /api/admin/apps` | App summaries with channel and version counts |
| `POST /api/admin/apps` | Create an app (see payload below) |
| `GET /api/admin/apps/{appId}` | Full detail: channels, versions, artifacts, keys, feed URLs |
| `PATCH /api/admin/apps/{appId}` | Same payload as create; omit `s3SecretAccessKey` to keep it |
| `DELETE /api/admin/apps/{appId}` | Deletes the app and every stored object |
| `GET /api/admin/apps/{appId}/channels` | List channels |
| `POST /api/admin/apps/{appId}/channels` | `{ name }` |
| `PATCH /api/admin/apps/{appId}/channels/{channelId}` | `{ currentVersionId }` — `null` clears the feed |
| `DELETE /api/admin/apps/{appId}/channels/{channelId}` | Delete a channel, its version records, and their S3 objects |
| `DELETE /api/admin/apps/{appId}/versions/{versionId}` | Delete a version and its S3 objects |
| `GET /api/admin/apps/{appId}/keys` | List keys (hints only) |
| `POST /api/admin/apps/{appId}/keys` | `{ name }` — response contains `plaintext` exactly once |
| `DELETE /api/admin/apps/{appId}/keys/{keyId}` | Revoke a key |

### App payload

```json
{
  "name": "My App",
  "slug": "my-app",
  "s3Endpoint": "https://<account>.r2.cloudflarestorage.com",
  "s3Region": "auto",
  "s3Bucket": "releases",
  "s3Prefix": "my-app",
  "s3AccessKeyId": "…",
  "s3SecretAccessKey": "…",
  "s3ForcePathStyle": false
}
```

`s3Endpoint` is `null` for AWS S3. Set `s3ForcePathStyle` for MinIO. Objects land at
`{s3Prefix}/{channel}/{version}/{filename}`.

## Update feed — no auth

| Request | Response |
|---------|----------|
| `GET /api/update/{app}/{channel}/{name}.yml` | The current version's metadata, byte-for-byte |
| `GET /api/update/{app}/{channel}/{artifact}` | `302` to a presigned S3 URL, valid for an hour |

Metadata resolves against the channel's current version. Artifacts resolve by
filename across every version on the channel, so a download that started before a
release switch still completes.
