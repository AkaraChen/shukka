import { useEffect, useState } from 'react'
import { Skeleton } from '~/components/ui/skeleton'
import { apiGet } from './requests/apps.ts'
import { useT } from '~/lib/i18n/index.ts'

/**
 * Full-viewport ReDoc for `/docs`. The spec is session-gated; the route
 * mounts this only after the same auth check as the panel.
 */
export function ApiDocsPage() {
  const t = useT()
  const [spec, setSpec] = useState<object | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void apiGet<object>('/api/v1/openapi.json')
      .then((document) => {
        if (!cancelled) setSpec(document)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return <p className="p-6 text-sm text-muted-foreground">{t.apps.detail.apiDocsError}</p>
  }
  if (!spec) return <Skeleton className="h-svh rounded-none" />
  return <RedocView spec={spec} />
}

function RedocView({ spec }: { spec: object }) {
  const [Viewer, setViewer] = useState<typeof import('redoc').RedocStandalone | null>(null)

  useEffect(() => {
    let cancelled = false
    void import('redoc').then((mod) => {
      if (!cancelled) setViewer(() => mod.RedocStandalone)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!Viewer) return <Skeleton className="h-svh rounded-none" />
  return (
    <div className="min-h-svh bg-background">
      <Viewer
        spec={spec}
        options={{
          hideDownloadButton: true,
          hideHostname: true,
          expandResponses: '200,201',
          theme: {
            typography: { fontFamily: 'inherit', headings: { fontFamily: 'inherit', fontWeight: '400' } },
            sidebar: { backgroundColor: 'transparent' },
            rightPanel: { backgroundColor: 'transparent' },
          },
        }}
      />
    </div>
  )
}
