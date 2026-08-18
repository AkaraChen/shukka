import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

export function CopyBlock({ value, className, label }: { value: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? <p className="text-xs font-medium text-muted-foreground">{label}</p> : null}
      <div className="relative">
        <pre className="overflow-x-auto rounded-2xl bg-card p-4 pr-12 text-xs leading-relaxed">
          <code>{value}</code>
        </pre>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute top-1.5 right-1.5 size-7"
          onClick={copy}
          aria-label="Copy to clipboard"
        >
          {copied ? <Check className="text-success" /> : <Copy />}
        </Button>
      </div>
    </div>
  )
}
