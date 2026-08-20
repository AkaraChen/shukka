import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { load, type CheerioAPI } from 'cheerio'
import { THEME_INLINE_SCRIPT } from '~/lib/theme.ts'

/**
 * Self-hosted ReDoc HTML for `/docs` (ADR: docs-renderer).
 *
 * A minimal HTML document is assembled with cheerio (a real HTML parser, not
 * regex): the local `redoc` standalone bundle is inlined as a `<script>`
 * element and a second `<script>` calls `Redoc.init` with a `specUrl` pointing
 * at the same-origin `/api/v1/openapi.json` endpoint. The browser fetches the
 * spec at runtime with the session cookie (same-origin), so the HTML itself is
 * fully static and origin-independent — one assembled string serves every
 * request. Assembly happens once per process (lazy, memoised); afterwards the
 * cached string is returned with zero overhead.
 *
 * Theming: redoc's `theme` option is a static JS object computed once at
 * `Redoc.init` time — CSS `var()` cannot drive it. styled-components/polished
 * parses every color field (`colors.*`, `colors.text.*`, `colors.border.*`,
 * `sidebar.textColor`, `rightPanel.textColor`, `typography.links.*`,
 * `typography.code.color`) and throws "Unable to parse color from string" on
 * `var()` (or `color-mix(...)`), which makes `Redoc.init` fail silently and
 * renders the page blank. So two concrete-hex theme objects are built from the
 * site tokens (light and dark values from `src/styles.css`, with
 * `color-mix(...)` resolved to approximate hex), the init script picks one by
 * `document.documentElement.classList.contains('dark')`, and a
 * `MutationObserver` on `<html>`'s `class` re-initialises redoc when `.dark` is
 * toggled. The `:root`/`.dark` token blocks are still inlined into
 * `#docs-tokens` so the `<body>` backdrop (outside redoc) follows the theme via
 * `var(--background)`/`var(--foreground)`. Web fonts are not reachable in this
 * standalone HTML, so `--font-sans`/`--font-mono` are redefined as system
 * stacks — self-hosted, zero external dependencies.
 *
 * Previous attempt used `@redocly/cli build-docs` + a regex to inline the
 * bundle. The regex only replaced one of eight CDN `<script src>` tags, so the
 * bundle executed eight times, styled-components collided, and the page went
 * black; bundle source also leaked into the `<redoc>` element. That approach
 * is gone (no `@redocly/cli`, no regex on HTML).
 */

const require = createRequire(import.meta.url)
const REDOC_BUNDLE_PATH = require.resolve('redoc/bundles/redoc.standalone.js')

const SPEC_URL = '/api/v1/openapi.json'

const FONT_SANS = 'ui-sans-serif, system-ui, -apple-system, \'Segoe UI\', Roboto, sans-serif'
const FONT_MONO = 'ui-monospace, \'SF Mono\', \'Cascadia Code\', \'Roboto Mono\', monospace'

/**
 * Site design tokens copied from `src/styles.css`. Only the variable
 * definitions are lifted — `@import`/`@theme`/`@layer`/tailwind directives do
 * nothing in a standalone HTML document. `--font-sans`/`--font-mono` are
 * redefined here as system stacks because the Vite-owned web fonts are not
 * reachable from this static HTML. The CSS vars here drive only the `<body>`
 * backdrop (the area outside redoc); redoc's own colors come from the
 * concrete-hex theme objects in `REDOC_LIGHT_OPTIONS`/`REDOC_DARK_OPTIONS`.
 */
const TOKEN_CSS = `
:root {
  --ink: #26251e;
  --paper: #f7f7f4;

  --background: var(--paper);
  --foreground: var(--ink);
  --card: #f2f1ed;
  --card-foreground: var(--ink);
  --popover: #f7f7f4;
  --popover-foreground: var(--ink);
  --primary: var(--ink);
  --primary-foreground: var(--paper);
  --secondary: #ebeae5;
  --secondary-foreground: var(--ink);
  --muted: #efeeea;
  --muted-foreground: color-mix(in oklab, var(--ink) 60%, transparent);
  --accent: #e6e5e0;
  --accent-foreground: var(--ink);
  --flare: #f54e00;
  --destructive: #cf2d56;
  --destructive-foreground: #f7f7f4;
  --success: #1f8a65;
  --border: color-mix(in oklab, var(--ink) 10%, transparent);
  --input: color-mix(in oklab, var(--ink) 12%, transparent);
  --ring: var(--flare);
  --radius: 0.375rem;
  --sidebar: #f2f1ed;
  --sidebar-foreground: var(--ink);
  --sidebar-primary: var(--ink);
  --sidebar-primary-foreground: var(--paper);
  --sidebar-accent: #e6e5e0;
  --sidebar-accent-foreground: var(--ink);
  --sidebar-border: color-mix(in oklab, var(--ink) 10%, transparent);
  --sidebar-ring: var(--flare);

  --font-sans: ${FONT_SANS};
  --font-mono: ${FONT_MONO};
}

.dark {
  --ink: #edecec;
  --paper: #14120b;

  --background: var(--paper);
  --foreground: var(--ink);
  --card: #1b1913;
  --card-foreground: var(--ink);
  --popover: #1d1b15;
  --popover-foreground: var(--ink);
  --primary: var(--ink);
  --primary-foreground: #1b1913;
  --secondary: #26241e;
  --secondary-foreground: var(--ink);
  --muted: #201e18;
  --muted-foreground: color-mix(in oklab, var(--ink) 60%, transparent);
  --accent: #26241e;
  --accent-foreground: var(--ink);
  --flare: #f97316;
  --destructive: #d24d6e;
  --destructive-foreground: #edecec;
  --success: #34a37e;
  --border: color-mix(in oklab, var(--ink) 12%, transparent);
  --input: color-mix(in oklab, var(--ink) 18%, transparent);
  --ring: var(--flare);
  --sidebar: #1b1913;
  --sidebar-foreground: var(--ink);
  --sidebar-primary: var(--ink);
  --sidebar-primary-foreground: #1b1913;
  --sidebar-accent: #26241e;
  --sidebar-accent-foreground: var(--ink);
  --sidebar-border: color-mix(in oklab, var(--ink) 12%, transparent);
  --sidebar-ring: var(--flare);
}

html, body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}
`

/**
 * Build a redoc `options` object from concrete hex tokens. All color fields
 * are concrete hex — `var()`/`color-mix(...)` would make styled-components /
 * polished throw "Unable to parse color from string" and `Redoc.init` would
 * fail silently (blank page). Field paths follow redoc 2.5.3's
 * `ResolvedThemeInterface` (`node_modules/redoc/typings/theme.d.ts`).
 *
 * `colors.text.light` and `backgrounds.main` from the task brief do not exist
 * in that schema, so the main background is set on `<body>` via TOKEN_CSS
 * instead, and `text.light` is dropped (the schema only exposes
 * `primary`/`secondary`). `colors.*.light`/`dark`/`tonalOffset` are
 * intentionally omitted — polished derives shades via `tonalOffset`, but we
 * pin concrete hex so no shade is ever derived from a `var()`.
 */
function buildRedocOptions(tokens: {
  foreground: string
  card: string
  sidebar: string
  sidebarForeground: string
  flare: string
  paper: string
  destructive: string
  success: string
  border: string
  mutedForeground: string
}) {
  return {
    scrollYOffset: 0,
    hideLoading: false,
    hideHostname: false,
    hideSingleRequestSampleTab: false,
    theme: {
      spacing: {
        unit: 8,
        // ReDoc's content-area padding is driven by these two fields:
        // MiddlePanel/RightPanel get `padding: 0 ${sectionHorizontal}px`
        // and Section gets `padding: ${sectionVertical}px 0` (see redoc's
        // common-elements/panels.ts). Setting them to 0 makes endpoint text
        // flush against the sidebar/panel edges. 24px restores reasonable
        // internal breathing room. The OUTER page-level gap is handled by
        // `html,body { margin:0 }` in TOKEN_CSS — NOT by these fields.
        sectionHorizontal: 24,
        sectionVertical: 24,
      },
      typography: {
        fontFamily: FONT_SANS,
        fontSize: '14px',
        lineHeight: '1.5',
        headings: {
          fontFamily: FONT_SANS,
          fontWeight: '400',
          lineHeight: '1.2',
        },
        code: {
          fontFamily: FONT_MONO,
          fontSize: '13px',
          lineHeight: '1.5',
          color: tokens.foreground,
          fontWeight: '400',
          backgroundColor: tokens.card,
          wrap: false,
        },
        links: {
          color: tokens.flare,
          visited: tokens.flare,
          hover: tokens.flare,
          textDecoration: 'underline',
          hoverTextDecoration: 'underline',
        },
      },
      sidebar: {
        backgroundColor: tokens.sidebar,
        textColor: tokens.sidebarForeground,
        activeTextColor: tokens.flare,
      },
      rightPanel: {
        backgroundColor: tokens.card,
        textColor: tokens.foreground,
      },
      codeBlock: {
        backgroundColor: tokens.card,
      },
      fab: {
        backgroundColor: tokens.flare,
        color: tokens.paper,
      },
      colors: {
        primary: { main: tokens.flare, contrastText: tokens.paper },
        success: { main: tokens.success, contrastText: tokens.paper },
        error: { main: tokens.destructive, contrastText: tokens.paper },
        warning: { main: tokens.flare, contrastText: tokens.paper },
        border: { light: tokens.border, dark: tokens.border },
        text: {
          primary: tokens.foreground,
          secondary: tokens.mutedForeground,
        },
      },
    },
  }
}

/**
 * Light-theme redoc options. Hex values lifted from `src/styles.css` `:root`.
 * `--muted-foreground` and `--border` are `color-mix(in oklab, ...)` in the
 * source; resolved to approximate hex here because polished cannot parse
 * `color-mix(...)` either.
 */
const REDOC_LIGHT_OPTIONS = buildRedocOptions({
  foreground: '#26251e',
  card: '#f2f1ed',
  sidebar: '#f2f1ed',
  sidebarForeground: '#26251e',
  flare: '#f54e00',
  paper: '#f7f7f4',
  destructive: '#cf2d56',
  success: '#1f8a65',
  // color-mix(in oklab, #26251e 60%, transparent) over #f7f7f4 ≈ #8a8a7e
  mutedForeground: '#8a8a7e',
  // color-mix(in oklab, #26251e 10%, transparent) over #f7f7f4 ≈ #e8e8e3
  border: '#e8e8e3',
})

/**
 * Dark-theme redoc options. Hex values lifted from `src/styles.css` `.dark`.
 * Same `color-mix(...)` approximations as the light theme.
 */
const REDOC_DARK_OPTIONS = buildRedocOptions({
  foreground: '#edecec',
  card: '#1b1913',
  sidebar: '#1b1913',
  sidebarForeground: '#edecec',
  flare: '#f97316',
  paper: '#14120b',
  destructive: '#d24d6e',
  success: '#34a37e',
  // color-mix(in oklab, #edecec 60%, transparent) over #14120b ≈ #6a6a64
  mutedForeground: '#6a6a64',
  // color-mix(in oklab, #edecec 12%, transparent) over #14120b ≈ #2a2820
  border: '#2a2820',
})

/**
 * Init + theme-toggle re-init script. Both theme option objects are embedded
 * as JSON literals; the script picks one by `<html>.classList` and boots
 * redoc. A `MutationObserver` on `<html>`'s `class` attribute re-initialises
 * redoc when `.dark` is added/removed (clears `#redoc` and re-calls
 * `Redoc.init` with the matching options). Re-fetch + re-render on toggle is
 * acceptable — theme toggle is a rare action.
 */
const INIT_SCRIPT = `(function(){
  var LIGHT = ${JSON.stringify(REDOC_LIGHT_OPTIONS)};
  var DARK = ${JSON.stringify(REDOC_DARK_OPTIONS)};
  var SPEC = ${JSON.stringify(SPEC_URL)};
  var el = document.getElementById('redoc');
  function options() {
    return document.documentElement.classList.contains('dark') ? DARK : LIGHT;
  }
  function init() {
    el.innerHTML = '';
    Redoc.init(SPEC, options(), el);
  }
  init();
  new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === 'class') { init(); return; }
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
})();`

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Shukka API</title>
  <style id="docs-tokens"></style>
  <script id="docs-theme">${THEME_INLINE_SCRIPT}</script>
</head>
<body>
  <div id="redoc"></div>
</body>
</html>`

let htmlCache: string | null = null

/** Returns the static, self-hosted ReDoc HTML. Origin-independent; assembled once. */
export async function getDocsHtml(): Promise<string> {
  if (htmlCache !== null) return htmlCache
  htmlCache = await assembleDocsHtml()
  return htmlCache
}

async function assembleDocsHtml(): Promise<string> {
  const bundle = await readFile(REDOC_BUNDLE_PATH, 'utf8')
  if (bundle.includes('</script>')) {
    throw new Error('redoc bundle contains literal </script>; cannot safely inline')
  }
  const $: CheerioAPI = load(HTML_TEMPLATE)
  // Inline the site token CSS (variables + system fonts + padding override)
  // as raw text so nothing inside it is HTML-parsed.
  $('#docs-tokens').text(TOKEN_CSS)
  // Append the bundle as a script element with raw text content. cheerio
  // treats <script> content as raw text (not HTML-escaped), so the bundle is
  // preserved verbatim.
  $('body').append('<script id="redoc-bundle"></script>')
  $('#redoc-bundle').text(bundle)
  // Append the init script that boots ReDoc against the same-origin spec URL.
  $('body').append('<script id="redoc-init"></script>')
  $('#redoc-init').text(INIT_SCRIPT)
  return $.html()
}
