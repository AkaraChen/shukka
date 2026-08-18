import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthCard } from '~/components/auth-card.tsx'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ApiError, api } from '~/lib/api.ts'
import { getSessionState } from '~/server/session-fn.ts'

export const Route = createFileRoute('/setup')({
  beforeLoad: async () => {
    const session = await getSessionState()
    if (session.initialized) throw redirect({ to: session.authenticated ? '/apps' : '/login' })
  },
  component: SetupPage,
})

function SetupPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      setError('The two passwords do not match')
      return
    }
    setPending(true)
    setError(null)
    try {
      await api.post('/api/admin/setup', { password })
      await router.navigate({ to: '/apps' })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Setup failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthCard
      title="Set up Shukka"
      description="Choose the admin password for this instance. It is the only credential for the panel."
      error={error}
      onSubmit={onSubmit}
    >
      <div className="grid gap-2">
        <Label htmlFor="password">Admin password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Creating…' : 'Create admin account'}
      </Button>
    </AuthCard>
  )
}
