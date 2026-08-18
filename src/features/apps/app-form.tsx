import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ApiError } from '~/lib/api.ts'
import type { AppFormValues } from './queries.ts'

type AppFormProps = {
  initial?: Partial<AppFormValues>
  submitLabel: string
  /** Editing keeps the stored secret when the field is left blank. */
  secretOptional?: boolean
  onSubmit: (values: AppFormValues) => Promise<unknown>
}

export function AppForm({ initial, submitLabel, secretOptional, onSubmit }: AppFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const secret = String(form.get('s3SecretAccessKey') ?? '')
    const endpoint = String(form.get('s3Endpoint') ?? '').trim()

    setPending(true)
    setError(null)
    try {
      await onSubmit({
        name: String(form.get('name') ?? ''),
        slug: String(form.get('slug') ?? ''),
        s3Endpoint: endpoint || null,
        s3Region: String(form.get('s3Region') ?? ''),
        s3Bucket: String(form.get('s3Bucket') ?? ''),
        s3Prefix: String(form.get('s3Prefix') ?? ''),
        s3AccessKeyId: String(form.get('s3AccessKeyId') ?? ''),
        s3SecretAccessKey: secret || undefined,
        s3ForcePathStyle: form.get('s3ForcePathStyle') === 'on',
      })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Request failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl rounded-2xl bg-card p-6 md:p-8">
      <FormSection title="General" detail="How the app appears in the panel and in feed URLs." first>
        <Field name="name" label="App name" defaultValue={initial?.name} required placeholder="Acme Desktop" />
        <Field
          name="slug"
          label="Slug"
          defaultValue={initial?.slug}
          required
          placeholder="acme-desktop"
          hint="Used in feed URLs: /api/update/{slug}/{channel}"
        />
      </FormSection>

      <FormSection
        title="Storage"
        detail="Artifacts upload straight to this bucket and download from it — Shukka never proxies the bytes."
      >
        <Field name="s3Bucket" label="Bucket" defaultValue={initial?.s3Bucket} required placeholder="releases" />
        <Field name="s3Region" label="Region" defaultValue={initial?.s3Region ?? 'auto'} required placeholder="auto" />
        <Field
          name="s3Endpoint"
          label="Endpoint"
          defaultValue={initial?.s3Endpoint ?? ''}
          placeholder="https://<account>.r2.cloudflarestorage.com"
          hint="Leave empty for AWS S3."
          className="sm:col-span-2"
        />
        <Field
          name="s3Prefix"
          label="Key prefix"
          defaultValue={initial?.s3Prefix ?? ''}
          placeholder="acme-desktop"
          hint="Objects land at {prefix}/{channel}/{version}/{file}."
          className="sm:col-span-2"
        />
        <Field
          name="s3AccessKeyId"
          label="Access key ID"
          defaultValue={initial?.s3AccessKeyId}
          required
          autoComplete="off"
        />
        <Field
          name="s3SecretAccessKey"
          label="Secret access key"
          type="password"
          required={!secretOptional}
          autoComplete="new-password"
          hint={secretOptional ? 'Leave blank to keep the stored secret.' : undefined}
        />
        <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="s3ForcePathStyle"
            defaultChecked={initial?.s3ForcePathStyle}
            className="size-4 accent-primary"
          />
          Force path-style addressing
          <span className="text-muted-foreground">— MinIO, some S3-compatibles</span>
        </label>
      </FormSection>

      <div className="mt-8 flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? 'Verifying bucket…' : submitLabel}
        </Button>
        <p className={error ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'}>
          {error ?? 'Saving writes and deletes a probe object to confirm the credentials work.'}
        </p>
      </div>
    </form>
  )
}

/** Whitespace-separated group: quiet heading, then a two-column field grid. */
function FormSection({
  title,
  detail,
  first,
  children,
}: {
  title: string
  detail: string
  first?: boolean
  children: ReactNode
}) {
  return (
    <section className={first ? undefined : 'mt-10'}>
      <h3 className="text-base">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2">{children}</div>
    </section>
  )
}

type FieldProps = {
  name: string
  label: string
  hint?: string
  className?: string
} & React.ComponentProps<typeof Input>

function Field({ name, label, hint, className, ...props }: FieldProps) {
  return (
    <div className={className ? `grid gap-2 ${className}` : 'grid gap-2'}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
