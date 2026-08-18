import { createFileRoute } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '~/components/page-header.tsx'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ApiError, api } from '~/lib/api.ts'

export const Route = createFileRoute('/_panel/settings')({ component: SettingsPage })

function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <PasswordCard />
    </>
  )
}

const passwordFormId = 'change-password'

function PasswordCard() {
  const [status, setStatus] = useState<{ kind: 'error' | 'success'; message: string } | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setPending(true)
    setStatus(null)
    try {
      await api.post('/api/admin/password', {
        currentPassword: String(data.get('currentPassword') ?? ''),
        newPassword: String(data.get('newPassword') ?? ''),
      })
      form.reset()
      setStatus({ kind: 'success', message: "Password updated — you're still signed in on this session." })
    } catch (cause) {
      setStatus({ kind: 'error', message: cause instanceof ApiError ? cause.message : 'Update failed' })
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="max-w-2xl">
      <h2 className="text-base">Change password</h2>
      <p className="mt-1 text-sm text-muted-foreground">Changing it signs out every other session.</p>

      <form id={passwordFormId} onSubmit={onSubmit} className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
      </form>

      <div className="mt-5 flex items-center justify-between gap-4">
        {status ? (
          <p className={status.kind === 'error' ? 'text-sm text-destructive' : 'flex items-center gap-1.5 text-sm text-success'}>
            {status.kind === 'success' ? <Check className="size-3.5" /> : null}
            {status.message}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">At least 8 characters.</p>
        )}
        <Button type="submit" form={passwordFormId} disabled={pending}>
          {pending ? 'Changing…' : 'Change password'}
        </Button>
      </div>
    </section>
  )
}
