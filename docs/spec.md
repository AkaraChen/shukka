# Specification

## Product scope

Shukka 是一个自托管的 Electron 应用发版管理器：管理面板 + 上传 API + 面向 electron-updater 的无鉴权更新 endpoint，制品存储在每个 app 自配的 S3 兼容存储中。

Out of scope until explicitly specified: anything not yet accepted in a PRD.

## Terminology

- **App**: 一个被管理的 Electron 应用，拥有唯一 slug、一套独立 S3 配置、若干 channel 与 API key。
- **Channel**: app 下的发布通道（自由命名，app 创建时默认含 `stable`），任一时刻指向至多一个当前版本。
- **Version**: 一次 finalize 成功的发版记录，属于单个 channel，由制品文件与更新元数据文件组成。
- **Artifact**: 版本内的一个文件（安装包、`*.blockmap`、`latest*.yml` 等），原样透传自 electron-builder 产物。
- **Feed**: 某 app+channel 的无鉴权更新读取面，base URL 为 `/api/update/{appSlug}/{channel}`。
- **API key**: 形如 `shk_<random>` 的上传凭证，绑定单个 app。
- **Pending upload**: init 之后、finalize 之前的上传事务，对 feed 不可见。
- **Feature 质问**: the mandatory product-then-technical clarification loop driven by `$feature-dev` before implementation.
- **PRD / ADR / Spec**: see documentation harness below.

## Observable contracts

### Update feed（无鉴权）

- `GET /api/update/{appSlug}/{channel}/{metadataFile}.yml` 返回该 channel 当前版本中同名 yml 的原文；无当前版本或文件不存在时返回 404。
- `GET /api/update/{appSlug}/{channel}/{artifactName}` 对 channel 内任意版本的制品按文件名解析，302 到短时效 S3 URL。
- Feed 与 electron-updater generic provider 兼容是硬契约：Shukka 永不改写 yml 内容。
- yml 命中与制品 302 分别计入所属版本的下载计数。

### Upload API（Bearer API key）

- `POST /api/v1/upload/init`：body 含 `channel`、`version`、文件清单；返回 pending upload id 与每文件 presigned PUT URL。同 channel 已存在同 version 时拒绝；文件清单必须含至少一个 `.yml` 元数据文件。
- 目标 channel 不存在时默认拒绝；只有显式 `createChannel: true` 才创建，避免拼写错误静默产生新 channel。
- `POST /api/v1/upload/finalize`：校验对象齐全（含声明大小）后创建版本并原子切换 channel 当前版本；任一 yml 的 `version` 与声明版本不一致时拒绝整次发版。
- API key 与 app 不匹配返回 403；key 已吊销或无效返回 401。
- 制品字节永不经过 Shukka 进程（上传直传 S3，下载 302）。
- 错误响应统一为 `{ error, message }`，`error` 取自固定码集：`unauthorized`、`forbidden`、`not_found`、`conflict`、`invalid_request`、`storage_error`、`metadata_error`。

### Panel

- 除 setup/login 外的面板路由与管理 API 均要求 session；未认证重定向到登录（未初始化时重定向到 setup）。
- API key 明文仅在创建响应中出现一次，此后不可再取得。
- S3 secret access key 加密存储，密钥在服务数据目录中自动生成。

### GitHub Action

- 仓库根 `action.yml` 为 composite action，inputs：`server-url`、`api-key`、`app`、`channel`、`version`、`directory`、`create-channel`；将目录内 electron-builder 产物完整发布为一个版本，outputs 为 `version` 与 `channel`。`version` 留空时从目录内 yml 读取。
- `action.yml` 与仓库 workflow 必须通过 actionlint。

## System-wide invariants

- 一个 version 恰属于一个 channel；同 channel 内 version 字符串唯一。
- Channel 当前版本的切换是原子的：feed 读到的要么整套旧版本、要么整套新版本。
- finalize 失败或未发生时，channel 当前版本与 feed 输出不变。
- 版本一经 finalize 不可修改，只可删除（删除会清理 S3 对象并回退/清空 channel 当前版本指向）。
- 数据库中不存任何明文 secret（管理员密码存 hash，API key 存 hash，S3 secret 加密）。
- 元数据在 SQLite（`data/` 目录，可用 `SHUKKA_DATA_DIR` 指定），加密密钥同目录自动生成；`data/` 目录整体即完整备份边界。
- S3 对象键布局固定为 `{prefix}/{channel}/{version}/{filename}`；制品文件名不含路径分隔符。
- 删除 version、channel 或 app 都会同时删除其拥有的 S3 对象；删除 version 还会把 channel 当前版本回退到剩余最新版本（无剩余则清空）。
- `version` 字符串与制品文件名都不得含路径分隔符或 `..`，保证对象键始终落在文档化的布局内。

## Documentation harness

- **PRD**: a product requirements document under `docs/prd/` describing problem, users, goals, non-goals, flows, failure behavior, and acceptance criteria.
- **ADR**: an architecture decision record under `docs/adr/` capturing one material technical choice, alternatives, and consequences.
- **Spec**: this file — the single source of truth for shared terminology, observable contracts, and system-wide invariants.
- New product behavior is defined in `docs/prd/` before feature code lands; material technical choices land in `docs/adr/` before or with the code that depends on them; stable implementation-independent rules merge into this file in the same change set.
- Agents must not implement feature code during 质问; the accepted PRD/ADR/spec set is the source of truth for implementation.

## System-wide constraints

- Repository agent entrypoint is root `AGENTS.md` (`CLAUDE.md` is a symlink to it).
- Feature development workflow skill lives at `.agents/skills/feature-dev/` (also linked from `.claude/skills/`).
- Platform operation skill lives at `.agents/skills/shukka-ops/`; it must stay consistent with the HTTP contracts above.
- Commit attempts should re-check the working tree against this specification and relevant PRDs/ADRs before landing.

## Current implementation status

- Update platform implemented per `docs/prd/update-platform.md` and the ADRs in `docs/adr/`.
- Panel, admin API, upload API and update feed live in one TanStack Start app (`src/routes/`), with domain
  services in `src/server/` and infrastructure in `src/lib/`.
- GitHub Action at repository root `action.yml` + `scripts/shukka-upload.mjs`; agent skill at
  `.agents/skills/shukka-ops/`.
- Verified end to end against MinIO: publish through the action under `act`, feed served to
  `electron-updater`'s generic layout, artifact redirect to presigned storage.
