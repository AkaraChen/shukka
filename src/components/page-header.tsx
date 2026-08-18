import type { ReactNode } from 'react'

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl tracking-tight text-balance">{title}</h1>
      {children ? <div className="flex gap-2">{children}</div> : null}
    </div>
  )
}
