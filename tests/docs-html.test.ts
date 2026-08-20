import { describe, expect, it } from 'vitest'
import { load } from 'cheerio'
import { getDocsHtml } from '~/server/docs-html.ts'

/**
 * Guards the invariants from ADR: docs-renderer. The previous regex-based
 * implementation left eight CDN `<script src>` tags in place, so the redoc
 * bundle executed eight times, styled-components collided, and the page went
 * black. These tests pin the structure: exactly one inlined bundle script,
 * one init script, no CDN, and Redoc.init wired to the same-origin spec URL.
 * They also pin the site-token theming: the `:root`/`.dark` variable blocks
 * and the pre-paint theme resolver must be inlined so the docs page follows
 * the panel's light/dark theme.
 */
describe('docs-html', () => {
  it('assembles a single inlined bundle script with no CDN and a Redoc.init call', async () => {
    const html = await getDocsHtml()
    const $ = load(html)

    // Exactly two redoc scripts (bundle + init); the pre-paint theme resolver
    // is a separate non-redoc script in <head>.
    expect($('#redoc-bundle').length).toBe(1)
    expect($('#redoc-init').length).toBe(1)
    expect($('script').length).toBe(3)

    const bundle = $('#redoc-bundle').text()
    expect(bundle.length).toBeGreaterThan(100_000)
    // The only thing that can break out of an inlined <script> is a literal
    // </script>; substrings like "<script" inside JS string literals are
    // harmless. Assembly asserts this too, but pin it here.
    expect(bundle).not.toContain('</script>')

    const init = $('#redoc-init').text()
    expect(init).toContain('Redoc.init')
    expect(init).toContain('/api/v1/openapi.json')

    expect(html).not.toContain('cdn.redocly.com')
    expect(html).not.toContain('src="http')
    expect($('script[src]').length).toBe(0)

    expect($('div#redoc').length).toBe(1)
    expect($('title').text()).toBe('Shukka API')
  })

  it('inlines the site token CSS so redoc can follow the light/dark theme', async () => {
    const html = await getDocsHtml()
    const $ = load(html)

    const tokens = $('#docs-tokens').text()
    // Light tokens lifted from src/styles.css :root.
    expect(tokens).toContain('--ink: #26251e')
    expect(tokens).toContain('--paper: #f7f7f4')
    expect(tokens).toContain('--sidebar: #f2f1ed')
    // Dark tokens lifted from src/styles.css .dark.
    expect(tokens).toContain('.dark')
    expect(tokens).toContain('--ink: #edecec')
    expect(tokens).toContain('--paper: #14120b')
    // System font stacks (no web fonts in the standalone HTML).
    expect(tokens).toContain('--font-sans:')
    expect(tokens).toContain('--font-mono:')
    expect(tokens).not.toContain('Instrument Sans')
    expect(tokens).not.toContain('Geist Mono')
    // No tailwind/@import/@theme/@layer directives — useless in static HTML.
    expect(tokens).not.toContain('@import')
    expect(tokens).not.toContain('@theme')
    expect(tokens).not.toContain('@layer')
    // Outermost page-level gap is handled by the body margin reset, NOT by a
    // #redoc > div > div override (that selector hits redoc's inner wrappers
    // which carry no padding — a no-op — and zeroing them risks wiping real
    // content padding). Pin both facts.
    expect(tokens).toContain('html, body {')
    expect(tokens).toContain('margin: 0')
    expect(tokens).not.toContain('#redoc > div > div')
    // Main background is set on <body> via tokens (redoc's theme schema has no
    // backgrounds.main field).
    expect(tokens).toContain('background: var(--background)')
  })

  it('inlines the pre-paint theme resolver before the redoc bundle', async () => {
    const html = await getDocsHtml()
    const $ = load(html)

    const theme = $('#docs-theme').text()
    expect(theme).toContain('shukka_theme')
    expect(theme).toContain('prefers-color-scheme')
    expect(theme).toContain("classList.toggle('dark'")

    // The theme script must precede the bundle so .dark is resolved pre-render.
    const headEnd = html.indexOf('id="docs-theme"')
    const bundleStart = html.indexOf('id="redoc-bundle"')
    expect(headEnd).toBeGreaterThan(-1)
    expect(bundleStart).toBeGreaterThan(-1)
    expect(headEnd).toBeLessThan(bundleStart)
  })

  it('maps redoc theme options onto concrete hex tokens (no var() in colors)', async () => {
    const html = await getDocsHtml()
    const $ = load(html)

    const init = $('#redoc-init').text()
    // Theme object present, wired to concrete hex (not CSS vars).
    expect(init).toContain('"theme"')
    expect(init).toContain('ui-sans-serif')
    expect(init).toContain('ui-monospace')
    // Light-theme concrete hex.
    expect(init).toContain('#f54e00') // flare (light)
    expect(init).toContain('#1f8a65') // success (light)
    expect(init).toContain('#cf2d56') // destructive (light)
    // Dark-theme concrete hex.
    expect(init).toContain('#f97316') // flare (dark)
    expect(init).toContain('#34a37e') // success (dark)
    expect(init).toContain('#d24d6e') // destructive (dark)
    // Headings stay font-normal — hierarchy by size, not weight.
    expect(init).toContain('"fontWeight":"400"')
    // Content-area padding is driven by theme.spacing.sectionHorizontal/
    // sectionVertical (applied to MiddlePanel/RightPanel/Section). 24 keeps
    // endpoint text from sitting flush against the panel edges; 0 would wipe
    // the content padding (the outer page gap is handled by body margin:0).
    expect(init).toContain('"sectionHorizontal":24')
    expect(init).toContain('"sectionVertical":24')

    // The colors block must not reference CSS vars — polished cannot parse
    // var() and Redoc.init would fail silently (blank page). Strip everything
    // outside the first "colors":{...} block and assert no var( inside it.
    const colorsStart = init.indexOf('"colors":{')
    expect(colorsStart).toBeGreaterThan(-1)
    // Scan to the matching closing brace of the colors object.
    let depth = 0
    let colorsEnd = -1
    for (let i = colorsStart + '"colors":{'.length - 1; i < init.length; i++) {
      const ch = init[i]
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) { colorsEnd = i; break }
      }
    }
    expect(colorsEnd).toBeGreaterThan(-1)
    const colorsBlock = init.slice(colorsStart, colorsEnd + 1)
    expect(colorsBlock).not.toContain('var(')
  })

  it('re-initialises redoc on theme toggle via MutationObserver', async () => {
    const html = await getDocsHtml()
    const $ = load(html)

    const init = $('#redoc-init').text()
    expect(init).toContain('MutationObserver')
    expect(init).toContain("classList.contains('dark')")
    expect(init).toContain('attributeFilter')
    // Both theme objects are embedded so the toggle can switch between them.
    expect(init).toContain('LIGHT')
    expect(init).toContain('DARK')
  })

  it('returns the same cached string on repeated calls', async () => {
    const a = await getDocsHtml()
    const b = await getDocsHtml()
    expect(a).toBe(b)
  })
})
