import { Suspense, lazy } from 'react'
import { Skeleton } from '~/components/ui/skeleton'
import type { TrendPoint } from '~/lib/trends.ts'
import type { TrendSeries } from './trend-series.ts'

/**
 * Generic trend chart shell: empty-state detection, lazy boundary for the
 * recharts chunk (never loaded server-side), and accessibility. Deliberately
 * free of recharts and i18n imports — callers pass formatted strings in.
 */
const TrendChartInner = lazy(() => import('./trend-chart-inner.tsx'))

type TrendChartProps = {
  points: TrendPoint[]
  series: TrendSeries[]
  formatTick: (unixSeconds: number) => string
  formatValue: (value: number) => string
  ariaLabel: string
  emptyHint: string
  height?: number
}

export function TrendChart({ points, series, formatTick, formatValue, ariaLabel, emptyHint, height = 160 }: TrendChartProps) {
  const isEmpty = points.every((point) => series.every((entry) => point[entry.key] === 0))

  return (
    <div role="img" aria-label={ariaLabel} className="w-full" style={{ height }}>
      {isEmpty ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-xs text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <Suspense fallback={<Skeleton className="h-full w-full rounded-xl" />}>
          <TrendChartInner points={points} series={series} formatTick={formatTick} formatValue={formatValue} />
        </Suspense>
      )}
    </div>
  )
}
