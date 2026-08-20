# ADR: `/docs` 渲染方式——自建 HTML 模板 + cheerio 内联本地 redoc bundle

## Context

`/docs` 需要整页渲染当前服务器的 OpenAPI，无面板 chrome，会话认证后可见。历史上试过两条路：

1. 客户端页面路由：`import('redoc')` 加载 `RedocStandalone` React 组件，运行时 fetch `/api/v1/openapi.json` 再渲染。问题：旧版 `redoc` React 组件想弃用；运行时 fetch + 客户端水合首屏空白，观感与 redoc 官网 demo 不一致。
2. 服务端 spawn `@redocly/cli build-docs` 预渲染 HTML，再用正则把 CDN `<script src="https://cdn.redocly.com/...">` 替换为内联 bundle。**失败**：redocly 输出的 HTML 里有 **8 个** 指向 `cdn.redocly.com` 的 `<script>` 标签，正则只替换了 1 个，留下 7 个 CDN 标签。结果本地内联 bundle 与 7 个 CDN bundle 都执行，redoc 初始化了 8 次，styled-components 冲突，页面纯黑；bundle 源码文本还泄漏进 `<redoc>` 元素。正则操作 HTML 本质上不可靠——HTML 不是正则语言。

## Decision

**自建一个最小干净的 HTML 模板，用 cheerio（正经的 HTML parser）把本地 `redoc` 包的 `bundles/redoc.standalone.js` 内联进去，`/docs` server route session 闸门后返回。** 不用 `@redocly/cli`，不用任何正则操作 HTML。

1. `/docs` 是 **server route**，`server.handlers.GET` 返回 `text/html`。会话闸门在 handler 内做（未初始化→`/setup`，未登录→`/login`，302），与原 `beforeLoad` 一致。
2. **静态 HTML 模板**：`<!DOCTYPE html>` + `<head>`（charset、viewport、title）+ `<body><div id="redoc"></div></body>`。模板里没有 CDN、没有 placeholder 注释需要正则替换。
3. **cheerio 组装**：`load(template)` 后，向 `<body>` 追加两个 `<script>` 元素：
   - `#redoc-bundle`：textContent = 本地 `redoc/bundles/redoc.standalone.js` 的字节（cheerio 把 `<script>` 内容当 raw text，不会 HTML-escape，bundle 原样保留）。
   - `#redoc-init`：textContent = `Redoc.init("/api/v1/openapi.json", options, document.getElementById("redoc"))`。
4. **spec 注入策略：specUrl（方案 A）**。`/api/v1/openapi.json` 端点用 `requireAdmin(request)` 校验 session cookie；浏览器同源 fetch 默认带 cookie，能通过。所以 HTML 完全静态、与 origin 无关——spec 端点自己按 `request.url.origin` 生成 `servers[0].url`。无需运行时按 origin 组装、无需按 origin 缓存。**不选方案 B（运行时内联 spec）**：会引入按 origin 缓存与组装开销，且 A 已验证可行。
5. **组装时机：进程内 lazy + 模块级 memoize**。HTML 与 origin 无关，全进程只需一个字符串。首次请求触发 cheerio 组装（读 ~1.1 MB bundle + cheerio 插入，毫秒级），之后直接返回缓存字符串，零组装开销。等价于"启动时读一次缓存"，但无需 build-time 生成脚本与 dev/prod 路径差异。**不选 build-time 静态文件**：要把生成文件放进 Nitro 的 public 目录会被静态服务直接暴露（绕过 session 闸门），放进非 public 目录又要解决 dev/prod 路径解析；收益（省一次毫秒级组装）不抵复杂度。
6. **HTTP 缓存**：HTML 静态不可变，`cache-control: private, max-age=3600`（session 闸门每请求仍跑，故 `private`）。spec 的缓存由 `/api/v1/openapi.json` 端点自己控制。
7. **主题**：redoc 的 `theme` 是静态 JS 对象，在 `Redoc.init` 时一次性求值——CSS `var()` 无法驱动它。styled-components/polished 会解析每个颜色字段（`colors.*`、`colors.text.*`、`colors.border.*`、`sidebar.textColor`、`rightPanel.textColor`、`typography.links.*`、`typography.code.color`），遇到 `var()` 或 `color-mix(...)` 就抛 polished #5 "Unable to parse color from string"，`Redoc.init` 静默失败、页面空白。所以从 `src/styles.css` 的 `:root`/`.dark` 取两组具体 hex token（`color-mix(in oklab, ...)` 解析为近似 hex——polished 也无法解析 `color-mix`），构造 `REDOC_LIGHT_OPTIONS`/`REDOC_DARK_OPTIONS` 两个全具体 hex 的 options 对象，init 脚本按 `document.documentElement.classList.contains('dark')` 选一个调用 `Redoc.init`，再用 `MutationObserver` 监听 `<html>` 的 `class`，`.dark` 增删时清空 `#redoc` 重新 `Redoc.init`（重新 fetch + 重新渲染可接受——主题切换是低频动作）。`colors.*.light`/`dark`/`tonalOffset` 故意不设——polished 会用 `tonalOffset` 派生 shade，钉死具体 hex 就不会从 `var()` 派生。`#docs-tokens` 仍内联 `:root`/`.dark` token 块，CSS 变量只驱动 `<body>` 背景与文字色（redoc 外的留白区域），`body { margin:0; background: var(--background); color: var(--foreground); font-family: var(--font-sans) }` 保留。`--font-sans`/`--font-mono` 在 `#docs-tokens` 重定义为系统字体栈——独立 HTML 无法走 Vite 的 `@fontsource` 管线，系统栈自托管、零外部依赖。`<head>` 还内联 `~/lib/theme.ts` 的 `THEME_INLINE_SCRIPT`（读 `shukka_theme` cookie，无则跟随 `prefers-color-scheme`，给 `<html>` 加 `.dark`），必须在 redoc bundle 之前执行，避免主题闪烁。redoc theme schema 没有 `backgrounds.main`/`colors.text.light` 字段（见 `node_modules/redoc/typings/theme.d.ts`），主背景通过 `<body>` 的 CSS 设 `var(--background)`，`text.secondary` 用近似 hex 的 `muted-foreground`。最外层 padding 通过 `html, body { margin: 0 }` 去掉（`<body>` 默认 `margin:8px` 才是页面级留白的来源）。ReDoc 内容区的内边距由 `theme.spacing.sectionHorizontal/sectionVertical` 驱动（作用于 `MiddlePanel`/`RightPanel`/`Section`，见 redoc `common-elements/panels.ts`），设为非零（24）以保留内容区呼吸空间；之前误把它当"最外层 padding"清零，导致端点文字贴边。`#redoc > div > div` 选择器实际命中 `.redoc-wrap` 的直接子节点（侧栏、`.api-content`、`BackgroundStub`），它们本身无 padding，故该覆盖是 no-op，已移除。用正经 JS 对象 + `JSON.stringify`，不做字符串拼接。
8. **依赖**：**移除** `@redocly/cli`（不再 spawn、不再需要其预渲染）。**新增** `cheerio`（唯一新增依赖，正经 HTML parser）。**保留** `redoc`（仅取其 standalone bundle 做内联，不用 React 组件）。已删除的 `api-docs-panel.tsx` 保持删除。
9. **`/api/v1/openapi.json` 保留**：HTML 用 specUrl 让浏览器 fetch 它，该端点对程序化客户端（脚本、agent 读取契约）也有价值，故保留不动。

## Alternatives

- **`@redocly/cli build-docs` + 正则内联 bundle（上一版）**：见 Context 第 2 条，已证明失败（8 个 CDN script、bundle 多次执行、黑屏、源码泄漏）。正则不能可靠操作 HTML。废弃。
- **`@redocly/cli` 程序式 API**：minified 内部 API，跨版本不稳定，仍写文件、仍用 CDN bundle。废弃。
- **build-time 生成静态 `public/docs.html`**：HTML 静态、零运行时组装，但放进 Nitro public 目录会被静态服务直接暴露（`/docs.html` 绕过 session 闸门）；放进非 public 目录要解决 dev/prod 路径解析。组装本身是毫秒级、进程内只做一次，收益不抵复杂度。不采用。
- **运行时按 origin 内联 spec（方案 B）**：A 已可行（同源带 cookie fetch），B 徒增按 origin 缓存与组装，无必要。不采用。
- **移除 `redoc` 依赖、接受 CDN**：离线/内网自托管不可用，违背"自托管"目标。不采用。

## Trade-offs & failure bounds

- 首次请求付一次 cheerio 组装开销（读 ~1.1 MB bundle + cheerio 解析/插入，~10 ms 量级）；之后进程内常驻缓存，零开销。缓存为进程内存，重启清空（可接受：首次请求再组装一次）。
- bundle 内联安全前提：`redoc/bundles/redoc.standalone.js` 不含字面 `</script>`。组装时断言这一点，若未来 redoc 版本违反则组装失败、handler 抛错（顶层错误处理返回 5xx），不污染缓存。`tests/docs-html.test.ts` 钉死该不变量。
- HTML 结构不变量由测试钉死：恰好 2 个 redoc `<script>`（`#redoc-bundle` + `#redoc-init`）+ 1 个 `#docs-theme` 主题脚本，无 `cdn.redocly.com`，无 `<script src>`，`Redoc.init` 指向 `/api/v1/openapi.json`，`<head>` 含 `#docs-tokens`（站点 token CSS）与 `#docs-theme`（pre-paint 主题解析）。防止上一版"8 个 CDN script"回归。
- spec 由浏览器运行时 fetch，首屏有极短加载态（redoc 自带 loading）；可接受，因 session 闸门与 spec 鉴权已保证只有登录用户能拿到 spec，观感跟随站点 light/dark 主题。
- **polished/var() 失败边界**：redoc theme 是静态 JS 对象，styled-components/polished 解析每个颜色字段时遇到 `var()` 或 `color-mix(...)` 会抛 "Unable to parse color from string"，`Redoc.init` 静默失败、页面空白。所以颜色字段全部用具体 hex（两组 light/dark token，`color-mix` 解析为近似 hex），CSS 变量只驱动 `<body>` 背景与文字色。主题切换由 `MutationObserver` 监听 `<html>` 的 `class`，重新 `Redoc.init` 选对应 options。`tests/docs-html.test.ts` 钉死 `#redoc-init` 含具体 hex、`colors` 块内无 `var(`、含 `MutationObserver`。
- `redoc` 依赖保留，仅用于内联 bundle 字节；若未来想彻底自控渲染，可换其它 OpenAPI 渲染器，模板与 cheerio 组装结构不变。
