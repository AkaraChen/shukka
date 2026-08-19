# ADR: 统一 `/api/v1/apps/{slug}` + 鉴权工具函数；自然键；面板 ReDoc

## Context

上传已在 `/api/v1`，面板在 `/api/admin/apps/:numericId`。要让 API key 覆盖 app 内能力并给出 OpenAPI，继续维持两棵树会双份路由。数字 id 不适合复制，也不对齐 feed。

## Decision

1. **一棵 app 资源树**：`/api/v1/apps/{appSlug}/channels/{channelName}/...`、`.../versions/{version}`、notes、趋势、PATCH 设置。面板前端改打这棵树。
2. **鉴权**：抽出 `requireSession`、`authenticateApiKey`、`requireAppActor(request, slug)`（session 可操作该 slug；key 必须绑定该 slug）。Handler 内再拒绝 key 的删 app / 管 key。
3. **实例级仍分离**（仅 session）：setup / login / logout / session / password、列与创建 app、存储探测、该 app 的 API key CRUD。
4. **对外标识**：slug、channel name、version 字符串。表内整数 PK 仅作 FK。面板路由改为 `/apps/{appSlug}`。
5. **Channel name**：`^[a-z0-9][a-z0-9_-]{0,62}$`（收紧既有规则：去掉 `.`，保留数字与 `_`）。非法名 `invalid_request`。
6. **OpenAPI** 描述 v1 契约（含公开 feed/notes 与 key/session 差异）；面板 app 详情独立 **API docs** 标签用 ReDoc 渲染，不嵌进 Integration；Integration 的 HTTP API 方式只引用并跳转。不单独做未登录站点。

## Alternatives

- **`/api/admin` 兼收 Bearer**：文档混进 cookie 与数字 id，拒绝。
- **对外 UUID**：改名更稳，但 channel 不能改名、version 不可变，额外列无收益，拒绝。

## Trade-offs & failure bounds

- 改 app slug 后旧 `/apps/{old}` 与旧 API 路径 404；调用方需用新 slug。
- Key 与 session 打同一 URL，授权矩阵必须单测，避免 key 摸到管 key / 删 app。
- OpenAPI 与实现漂移由测试（契约或路由表）兜住，不另做代码生成框架（实现期可选用 zod → OpenAPI）。
