import { useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronRight, CircleHelp, Server } from 'lucide-react'
import { siCloudflare, siMinio } from 'simple-icons'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ApiError } from '~/lib/api.ts'
import { cn } from '~/lib/utils'
import type { AppFormValues } from './queries.ts'

/**
 * Two-step creation wizard for /apps/new: identity (name + slug), then storage
 * (provider selector with a tailored S3 field set). Provider presets are a pure
 * presentation mapping — hidden fields are filled with conventional defaults at
 * submit time and provider is never persisted. Settings keeps using AppForm.
 */

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/
const SLUG_HINT = 'Slug must be lowercase letters, digits and dashes, starting with a letter or digit'

function SimpleIcon({ path, hex, className }: { path: string; hex: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={`#${hex}`} aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

/** Full AWS logo (text + arrow), from the official AWS logo (Apache 2.0). Uses currentColor for text so it works on light and dark. */
function AWSIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 304 182" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M86.4,66.4c0,3.7,0.4,6.7,1.1,8.9c0.8,2.2,1.8,4.6,3.2,7.2c0.5,0.8,0.7,1.6,0.7,2.3c0,1-0.6,2-1.9,3l-6.3,4.2 c-0.9,0.6-1.8,0.9-2.6,0.9c-1,0-2-0.5-3-1.4C76.2,90,75,88.4,74,86.8c-1-1.7-2-3.6-3.1-5.9c-7.8,9.2-17.6,13.8-29.4,13.8 c-8.4,0-15.1-2.4-20-7.2c-4.9-4.8-7.4-11.2-7.4-19.2c0-8.5,3-15.4,9.1-20.6c6.1-5.2,14.2-7.8,24.5-7.8c3.4,0,6.9,0.3,10.6,0.8 c3.7,0.5,7.5,1.3,11.5,2.2v-7.3c0-7.6-1.6-12.9-4.7-16c-3.2-3.1-8.6-4.6-16.3-4.6c-3.5,0-7.1,0.4-10.8,1.3c-3.7,0.9-7.3,2-10.8,3.4 c-1.6,0.7-2.8,1.1-3.5,1.3c-0.7,0.2-1.2,0.3-1.6,0.3c-1.4,0-2.1-1-2.1-3.1v-4.9c0-1.6,0.2-2.8,0.7-3.5c0.5-0.7,1.4-1.4,2.8-2.1 c3.5-1.8,7.7-3.3,12.6-4.5c4.9-1.3,10.1-1.9,15.6-1.9c11.9,0,20.6,2.7,26.2,8.1c5.5,5.4,8.3,13.6,8.3,24.6V66.4z M45.8,81.6 c3.3,0,6.7-0.6,10.3-1.8c3.6-1.2,6.8-3.4,9.5-6.4c1.6-1.9,2.8-4,3.4-6.4c0.6-2.4,1-5.3,1-8.7v-4.2c-2.9-0.7-6-1.3-9.2-1.7 c-3.2-0.4-6.3-0.6-9.4-0.6c-6.7,0-11.6,1.3-14.9,4c-3.3,2.7-4.9,6.5-4.9,11.5c0,4.7,1.2,8.2,3.7,10.6 C37.7,80.4,41.2,81.6,45.8,81.6z M126.1,92.4c-1.8,0-3-0.3-3.8-1c-0.8-0.6-1.5-2-2.1-3.9L96.7,10.2c-0.6-2-0.9-3.3-0.9-4 c0-1.6,0.8-2.5,2.4-2.5h9.8c1.9,0,3.2,0.3,3.9,1c0.8,0.6,1.4,2,2,3.9l16.8,66.2l15.6-66.2c0.5-2,1.1-3.3,1.9-3.9c0.8-0.6,2.2-1,4-1 h8c1.9,0,3.2,0.3,4,1c0.8,0.6,1.5,2,1.9,3.9l15.8,67l17.3-67c0.6-2,1.3-3.3,2-3.9c0.8-0.6,2.1-1,3.9-1h9.3c1.6,0,2.5,0.8,2.5,2.5 c0,0.5-0.1,1-0.2,1.6c-0.1,0.6-0.3,1.4-0.7,2.5l-24.1,77.3c-0.6,2-1.3,3.3-2.1,3.9c-0.8,0.6-2.1,1-3.8,1h-8.6c-1.9,0-3.2-0.3-4-1 c-0.8-0.7-1.5-2-1.9-4L156,23l-15.4,64.4c-0.5,2-1.1,3.3-1.9,4c-0.8,0.7-2.2,1-4,1H126.1z M254.6,95.1c-5.2,0-10.4-0.6-15.4-1.8 c-5-1.2-8.9-2.5-11.5-4c-1.6-0.9-2.7-1.9-3.1-2.8c-0.4-0.9-0.6-1.9-0.6-2.8v-5.1c0-2.1,0.8-3.1,2.3-3.1c0.6,0,1.2,0.1,1.8,0.3 c0.6,0.2,1.5,0.6,2.5,1c3.4,1.5,7.1,2.7,11,3.5c4,0.8,7.9,1.2,11.9,1.2c6.3,0,11.2-1.1,14.6-3.3c3.4-2.2,5.2-5.4,5.2-9.5 c0-2.8-0.9-5.1-2.7-7c-1.8-1.9-5.2-3.6-10.1-5.2L246,52c-7.3-2.3-12.7-5.7-16-10.2c-3.3-4.4-5-9.3-5-14.5c0-4.2,0.9-7.9,2.7-11.1 c1.8-3.2,4.2-6,7.2-8.2c3-2.3,6.4-4,10.4-5.2c4-1.2,8.2-1.7,12.6-1.7c2.2,0,4.5,0.1,6.7,0.4c2.3,0.3,4.4,0.7,6.5,1.1 c2,0.5,3.9,1,5.7,1.6c1.8,0.6,3.2,1.2,4.2,1.8c1.4,0.8,2.4,1.6,3,2.5c0.6,0.8,0.9,1.9,0.9,3.3v4.7c0,2.1-0.8,3.2-2.3,3.2 c-0.8,0-2.1-0.4-3.8-1.2c-5.7-2.6-12.1-3.9-19.2-3.9c-5.7,0-10.2,0.9-13.3,2.8c-3.1,1.9-4.7,4.8-4.7,8.9c0,2.8,1,5.2,3,7.1 c2,1.9,5.7,3.8,11,5.5l14.2,4.5c7.2,2.3,12.4,5.5,15.5,9.6c3.1,4.1,4.6,8.8,4.6,14c0,4.3-0.9,8.2-2.6,11.6 c-1.8,3.4-4.2,6.4-7.3,8.8c-3.1,2.5-6.8,4.3-11.1,5.6C264.4,94.4,259.7,95.1,254.6,95.1z"
      />
      <path
        fill="#FF9900"
        d="M273.5,143.7c-32.9,24.3-80.7,37.2-121.8,37.2c-57.6,0-109.5-21.3-148.7-56.7c-3.1-2.8-0.3-6.6,3.4-4.4 c42.4,24.6,94.7,39.5,148.8,39.5c36.5,0,76.6-7.6,113.5-23.2C274.2,133.6,278.9,139.7,273.5,143.7z"
      />
      <path
        fill="#FF9900"
        d="M287.2,128.1c-4.2-5.4-27.8-2.6-38.5-1.3c-3.2,0.4-3.7-2.4-0.8-4.5c18.8-13.2,49.7-9.4,53.3-5 c3.6,4.5-1,35.4-18.6,50.2c-2.7,2.3-5.3,1.1-4.1-1.9C282.5,155.7,291.4,133.4,287.2,128.1z"
      />
    </svg>
  )
}

const PROVIDERS = [
  {
    id: 'aws',
    label: 'AWS S3',
    icon: <AWSIcon className="h-4 w-auto" />,
    hint: 'Region-based; no endpoint to fill in.',
    showRegion: true,
    showEndpoint: false,
    showPathStyle: false,
    endpointRequired: false,
  },
  {
    id: 'r2',
    label: 'Cloudflare R2',
    icon: <SimpleIcon path={siCloudflare.path} hex={siCloudflare.hex} className="size-5" />,
    hint: 'Account endpoint; region is fixed to auto.',
    showRegion: false,
    showEndpoint: true,
    showPathStyle: false,
    endpointRequired: true,
  },
  {
    id: 'minio',
    label: 'MinIO',
    icon: <SimpleIcon path={siMinio.path} hex={siMinio.hex} className="size-5" />,
    hint: 'Path-style addressing; region us-east-1.',
    showRegion: false,
    showEndpoint: true,
    showPathStyle: false,
    endpointRequired: true,
  },
  {
    id: 'other',
    label: 'S3-compatible',
    icon: <Server className="size-4" />,
    hint: 'The full field set, nothing hidden.',
    showRegion: true,
    showEndpoint: true,
    showPathStyle: true,
    endpointRequired: false,
  },
] as const

type ProviderId = (typeof PROVIDERS)[number]['id']

type StorageFields = {
  bucket: string
  region: string
  endpoint: string
  prefix: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
}

const EMPTY_STORAGE: StorageFields = {
  bucket: '',
  region: '',
  endpoint: '',
  prefix: '',
  accessKeyId: '',
  secretAccessKey: '',
  forcePathStyle: false,
}

type IdentityErrors = { name?: string; slug?: string }
type StorageErrors = Partial<Record<keyof StorageFields, string>>

const ENDPOINT_PLACEHOLDER: Record<ProviderId, string> = {
  aws: '',
  r2: 'https://<account>.r2.cloudflarestorage.com',
  minio: 'https://minio.example.com:9000',
  other: 'https://s3.example.com',
}

export function AppWizard({
  step,
  onStepChange,
  onSubmit,
}: {
  step: 1 | 2
  onStepChange: (step: 1 | 2) => void
  onSubmit: (values: AppFormValues) => Promise<unknown>
}) {

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [identityErrors, setIdentityErrors] = useState<IdentityErrors>({})

  const [provider, setProvider] = useState<ProviderId | null>(null)
  const [storage, setStorage] = useState<StorageFields>(EMPTY_STORAGE)
  const [storageErrors, setStorageErrors] = useState<StorageErrors>({})

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const preset = provider ? PROVIDERS.find((entry) => entry.id === provider) : null

  function updateStorage(key: keyof StorageFields, value: string | boolean) {
    setStorage((prev) => ({ ...prev, [key]: value }))
    setStorageErrors((prev) => ({ ...prev, [key]: undefined }))
    setSubmitError(null)
  }

  function continueToStorage() {
    const errors: IdentityErrors = {}
    if (!name.trim()) errors.name = 'Name is required'
    if (!SLUG_PATTERN.test(slug.trim())) errors.slug = SLUG_HINT
    setIdentityErrors(errors)
    if (Object.keys(errors).length === 0) onStepChange(2)
  }

  function validateStorage(): StorageErrors {
    const errors: StorageErrors = {}
    if (!preset) return errors
    if (!storage.bucket.trim()) errors.bucket = 'Bucket is required'
    if (preset.showRegion && !storage.region.trim()) errors.region = 'Region is required'
    if (preset.endpointRequired && !storage.endpoint.trim()) errors.endpoint = 'Endpoint is required'
    if (!storage.accessKeyId.trim()) errors.accessKeyId = 'Access key ID is required'
    if (!storage.secretAccessKey) errors.secretAccessKey = 'Secret access key is required'
    return errors
  }

  function buildValues(): AppFormValues {
    const base = {
      name: name.trim(),
      slug: slug.trim(),
      s3Bucket: storage.bucket.trim(),
      s3Prefix: storage.prefix.trim(),
      s3AccessKeyId: storage.accessKeyId.trim(),
      s3SecretAccessKey: storage.secretAccessKey,
    }
    switch (provider) {
      case 'aws':
        return { ...base, s3Endpoint: null, s3Region: storage.region.trim(), s3ForcePathStyle: false }
      case 'r2':
        return { ...base, s3Endpoint: storage.endpoint.trim(), s3Region: 'auto', s3ForcePathStyle: false }
      case 'minio':
        return { ...base, s3Endpoint: storage.endpoint.trim(), s3Region: 'us-east-1', s3ForcePathStyle: true }
      default:
        return {
          ...base,
          s3Endpoint: storage.endpoint.trim() || null,
          s3Region: storage.region.trim(),
          s3ForcePathStyle: storage.forcePathStyle,
        }
    }
  }

  /** Server failures route back to the step that owns the field. */
  function mapSubmitError(cause: unknown) {
    if (cause instanceof ApiError) {
      if (cause.code === 'conflict' || (cause.code === 'invalid_request' && /slug/i.test(cause.message))) {
        setIdentityErrors((prev) => ({ ...prev, slug: cause.message }))
        onStepChange(1)
        return
      }
      if (cause.code === 'invalid_request' && /name/i.test(cause.message)) {
        setIdentityErrors((prev) => ({ ...prev, name: cause.message }))
        onStepChange(1)
        return
      }
      setSubmitError(cause.message)
      return
    }
    setSubmitError('Request failed')
  }

  async function submit() {
    if (!preset) return
    const errors = validateStorage()
    setStorageErrors(errors)
    if (Object.keys(errors).length > 0) return

    setPending(true)
    setSubmitError(null)
    try {
      await onSubmit(buildValues())
    } catch (cause) {
      mapSubmitError(cause)
    } finally {
      setPending(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step === 1) continueToStorage()
    else void submit()
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <StepIndicator step={step} />

      {step === 1 ? (
        <section className="mt-8">
          <p className="text-sm text-muted-foreground">How the app appears in the panel and in feed URLs.</p>
          <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <Field
              name="name"
              label="App name"
              required
              placeholder="Acme Desktop"
              hint="Display name in the panel."
              value={name}
              error={identityErrors.name}
              onChange={(event) => {
                setName(event.target.value)
                setIdentityErrors((prev) => ({ ...prev, name: undefined }))
              }}
            />
            <Field
              name="slug"
              label="Slug"
              required
              placeholder="acme-desktop"
              hint="Used in feed URLs: /api/update/{slug}/{channel}"
              value={slug}
              error={identityErrors.slug}
              onChange={(event) => {
                setSlug(event.target.value)
                setIdentityErrors((prev) => ({ ...prev, slug: undefined }))
              }}
            />
          </div>
        </section>
      ) : (
        <section className="mt-8">
          <p className="text-sm text-muted-foreground">
            Artifacts upload straight to this bucket and download from it — Shukka never proxies the bytes.
          </p>
          <div className="mt-5 flex gap-3" role="radiogroup" aria-label="Storage provider">
            {PROVIDERS.map((entry) => {
              const selected = provider === entry.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setProvider(entry.id)
                    setStorageErrors({})
                    setSubmitError(null)
                  }}
                  className={cn(
                    'flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl bg-background px-4 py-3 text-sm outline outline-1 -outline-offset-1 outline-input transition-colors',
                    selected ? '-outline-offset-2 outline-2 outline-foreground' : 'hover:bg-accent/50',
                  )}
                >
                  {entry.icon}
                  {entry.label}
                </button>
              )
            })}
          </div>

          {preset ? (
            <div className="mt-6 grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <Field
                name="s3Bucket"
                label="Bucket"
                required
                placeholder="releases"
                tooltip="The S3 bucket name where release artifacts are stored. Find it in your cloud console under object storage / buckets."
                value={storage.bucket}
                error={storageErrors.bucket}
                onChange={(event) => updateStorage('bucket', event.target.value)}
              />
              {preset.showRegion ? (
                <Field
                  name="s3Region"
                  label="Region"
                  required
                  placeholder="us-east-1"
                  tooltip="The AWS region your bucket lives in, e.g. us-east-1 or ap-southeast-2. Shown in the bucket details in the AWS console."
                  value={storage.region}
                  error={storageErrors.region}
                  onChange={(event) => updateStorage('region', event.target.value)}
                />
              ) : null}
              {preset.showEndpoint ? (
                <Field
                  name="s3Endpoint"
                  label="Endpoint"
                  required={preset.endpointRequired}
                  placeholder={ENDPOINT_PLACEHOLDER[preset.id]}
                  hint={preset.id === 'other' ? 'Leave empty for AWS S3.' : undefined}
                  tooltip={
                    preset.id === 'r2'
                      ? 'Your Cloudflare account endpoint. Find it in the R2 dashboard under your bucket settings — it looks like https://<account-id>.r2.cloudflarestorage.com.'
                      : preset.id === 'minio'
                        ? 'The URL of your MinIO server, e.g. https://minio.example.com:9000.'
                        : 'The S3-compatible endpoint URL. Leave empty for AWS S3.'
                  }
                  className="sm:col-span-2"
                  value={storage.endpoint}
                  error={storageErrors.endpoint}
                  onChange={(event) => updateStorage('endpoint', event.target.value)}
                />
              ) : null}
              <Field
                name="s3Prefix"
                label="Key prefix"
                placeholder="acme-desktop"
                hint="Objects land at {prefix}/{channel}/{version}/{file}."
                tooltip="A folder-like prefix inside the bucket to keep this app's artifacts organized. Usually the app name in kebab-case."
                className="sm:col-span-2"
                value={storage.prefix}
                onChange={(event) => updateStorage('prefix', event.target.value)}
              />
              <Field
                name="s3AccessKeyId"
                label="Access key ID"
                required
                autoComplete="off"
                tooltip="An access key with read/write permission on the bucket. Create one in your cloud provider's IAM or API tokens page."
                value={storage.accessKeyId}
                error={storageErrors.accessKeyId}
                onChange={(event) => updateStorage('accessKeyId', event.target.value)}
              />
              <Field
                name="s3SecretAccessKey"
                label="Secret access key"
                type="password"
                required
                autoComplete="new-password"
                tooltip="The secret paired with the access key ID. Shown once when you create the key — if lost, generate a new pair."
                value={storage.secretAccessKey}
                error={storageErrors.secretAccessKey}
                onChange={(event) => updateStorage('secretAccessKey', event.target.value)}
              />
              {preset.showPathStyle ? (
                <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    name="s3ForcePathStyle"
                    checked={storage.forcePathStyle}
                    onChange={(event) => updateStorage('forcePathStyle', event.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Force path-style addressing
                  <span className="text-muted-foreground">— MinIO, some S3-compatibles</span>
                </label>
              ) : null}
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">Pick a provider to see just the fields it needs.</p>
          )}
        </section>
      )}

      <div className="mt-8 flex items-center gap-4">
        {step === 2 ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              onStepChange(1)
              setSubmitError(null)
            }}
          >
            Back
          </Button>
        ) : null}
        <Button type="submit" disabled={pending || (step === 2 && !provider)}>
          {pending ? 'Verifying bucket…' : step === 1 ? 'Continue' : 'Create app'}
        </Button>
        {step === 2 ? (
          <p className={submitError ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'}>
            {submitError ?? 'Saving writes and deletes a probe object to confirm the credentials work.'}
          </p>
        ) : null}
      </div>
    </form>
  )
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  const steps = ['Identity', 'Storage']
  return (
    <ol className="flex items-center gap-2.5 text-sm">
      {steps.map((label, index) => (
        <li key={label} className="flex items-center gap-2.5">
          {index > 0 ? <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden /> : null}
          <span className={index + 1 === step ? 'text-foreground' : 'text-muted-foreground'}>
            <span className="mr-2 font-mono text-xs">{index + 1}</span>
            {label}
          </span>
        </li>
      ))}
    </ol>
  )
}

type FieldProps = {
  name: string
  label: string
  error?: string
  hint?: string
  tooltip?: string
  className?: string
} & React.ComponentProps<typeof Input>

function Field({ name, label, error, hint, tooltip, className, ...props }: FieldProps) {
  return (
    <div className={className ? `grid gap-2 ${className}` : 'grid gap-2'}>
      <span className="flex items-center gap-1.5">
        <Label htmlFor={name}>{label}</Label>
        {tooltip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger type="button" className="text-muted-foreground/60 hover:text-muted-foreground">
                <CircleHelp className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-64">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </span>
      <Input id={name} name={name} aria-invalid={error ? true : undefined} {...props} />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
