import type { PublicApp } from '~/server/dashboard.ts'
import type { HighlightLang } from '~/server/highlight.ts'

/**
 * The publish skill installs from the Shukka repo, pinned to the commit this
 * server was built from (`__GIT_SHA__` is inlined by vite at build time). The
 * CLI can't check out a bare commit, so the URL is the commit's tarball, which
 * it downloads and searches for skills. The 'dev' fallback (no git metadata
 * at build time) tracks main instead of a dead URL.
 */
const skillRef = /^[0-9a-f]{40}$/.test(__GIT_SHA__) ? __GIT_SHA__ : 'main'

export type Snippet = { code: string; lang: HighlightLang; html: string }

export type IntegrationSnippets = {
  builderConfig: Snippet
  mainProcess: Snippet
  githubAction: Snippet
  httpApi: Snippet
  agentCli: Snippet
}

/** The four snippets the integration guide shows; the route loader highlights them. */
export function buildIntegrationSnippets({
  app,
  channelName,
  feedUrl,
  serverUrl,
}: {
  app: PublicApp
  channelName: string
  feedUrl: string
  serverUrl: string
}): Record<keyof IntegrationSnippets, { code: string; lang: HighlightLang }> {
  return {
    builderConfig: {
      lang: 'yaml',
      code: `# electron-builder.yml
publish:
  provider: generic
  url: ${feedUrl}
  channel: ${channelName}`,
    },
    mainProcess: {
      lang: 'ts',
      code: `import { autoUpdater } from 'electron-updater'

autoUpdater.setFeedURL({
  provider: 'generic',
  url: '${feedUrl}',
  channel: '${channelName}',
})
autoUpdater.checkForUpdatesAndNotify()`,
    },
    githubAction: {
      lang: 'yaml',
      code: `- uses: akarachen/shukka@main
  with:
    server-url: \${{ secrets.SHUKKA_URL }}
    api-key: \${{ secrets.SHUKKA_API_KEY }}
    app: ${app.slug}
    channel: ${channelName}
    directory: dist`,
    },
    httpApi: {
      lang: 'bash',
      code: `# 1. Init — returns uploadId + a presigned PUT URL per file
curl -X POST ${serverUrl}/api/v1/upload/init \\
  -H "Authorization: Bearer $SHUKKA_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{"app":"${app.slug}","channel":"${channelName}","version":"1.4.2","files":[{"filename":"latest.yml","size":412}]}'

# 2. Upload each file's bytes straight to S3
curl -X PUT --data-binary @latest.yml "<uploadUrl from init>"

# 3. Finalize — verifies objects, parses yml, flips the channel
curl -X POST ${serverUrl}/api/v1/upload/finalize \\
  -H "Authorization: Bearer $SHUKKA_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{"uploadId":"<uploadId>","app":"${app.slug}"}'`,
    },
    agentCli: {
      lang: 'bash',
      code: `# Installs the Shukka publish skill into your coding agent (Claude Code, Cursor, Codex, ...)
npx skills add https://github.com/akarachen/shukka/archive/${skillRef}.tar.gz --skill shukka-publish`,
    },
  }
}
