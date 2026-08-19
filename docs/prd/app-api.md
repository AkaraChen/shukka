# PRD: 程序化 App API——key 覆盖 app 内能力，面板 ReDoc

## Problem

API key 只能 init/finalize 上传。面板能做的设 current、建 channel、写 notes、改 app 设置、删版本，key 都调不了；也没有一份给调用方看的 OpenAPI。数字 id 出现在 URL 里，不便复制，也不便和 feed 的 slug/channel 对齐。

## Users

- **CI / agent / 脚本（API key）**：操作其绑定的那一个 app。
- **管理员（session）**：同一棵 app 资源树，外加实例级操作与 key 生命周期。
- **开发者（面板）**：在面板内打开 ReDoc，对照可调用的契约。

## Goals

1. 单一资源树：`/api/v1/apps/{appSlug}/...`，session cookie 与 Bearer API key 都能打（鉴权工具函数分流）。
2. 对外标识只用自然键：app `slug`、channel `name`、version 字符串。HTTP 与面板路由（`/apps/{appSlug}`、notes 页用 version 字符串）不再暴露数字 id。
3. Channel `name` 为 URL token：小写字母、数字、连字符、下划线，不能是任意文本（与 slug 同族，另允许 `_`；不再允许 `.`）。
4. API key 能做绑定 app 内、面板能点的写/读：**改该 app 设置**、channel / version / note 的 CRUD、设 current、读详情与趋势。
5. API key **不能**：建/列全部 app、删整个 app、改管理员密码、签发/吊销/删除 API key（key 只在面板管理）。
6. 实例级（登录、改密、列/建 app、存储探测）仍走 session 专用路由，不进 key 的能力面。
7. 面板 app 详情增加独立 **API docs** 标签（nuqs `tab=docs`），用 ReDoc 展示 OpenAPI；可见性与 Integration 相同（admin / developer），不公开挂到未登录路由。Integration 的 HTTP API 接入说明里提到该文档，并提供跳转到该标签的按钮。

## Non-goals

- 多租户、key 跨 app。
- UUID 对外标识。
- 把 session 管理或改密暴露给 API key。
- 未登录可打开的 API 浏览器。

## Flows

### 脚本：promote 一个 draft

1. `Authorization: Bearer shk_...`
2. `PATCH /api/v1/apps/{slug}/channels/{channel}` body `{ "currentVersion": "1.4.2" }`
3. 若该 version 是 draft，写入 `releasedAt` 并切 current。

### 开发者：对照文档

1. 打开 app 详情的 API docs 标签，ReDoc 渲染当前服务器的 OpenAPI。
2. 或从 Integration 的 HTTP API 方式点跳转按钮进入该标签。
3. 文档标明哪些操作接受 API key、哪些仅 session。

## Acceptance criteria

- [x] 面板原先走 `/api/admin/apps/:id/...` 的 app 内操作，均可经 `/api/v1/apps/{slug}/...` 用 session 完成。
- [x] 同一组 app 内读写（除 key 管理与删 app）可用该 app 的 API key 完成。
- [x] 用 key 调删 app、管 key、列/建其它 app、改密 → 401/403。
- [x] 路径与面板深链只用 slug / channel 名 / version 字符串。
- [x] 非法 channel 名（含大写、空格、`.` 等）创建失败。
- [x] app 详情有独立 API docs 标签（`?tab=docs`）渲染 ReDoc；content 不可见该标签；未登录被挡在面板认证之后。
- [x] Integration 的 HTTP API 接入方式含指向该标签的跳转按钮。

## Resolved product decisions

- Key 范围只在绑定 app 内，最多改设置 + CRUD 内部实体。
- Key 生命周期只留面板。
- ReDoc 只在面板内，独立标签，不嵌进 Integration。
- 程序化 API 与面板 admin 调用合并为一棵 apps 树，分叉主要是鉴权。
- 不上 UUID。
