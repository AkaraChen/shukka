import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthCard } from '~/components/auth-card.tsx'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ApiError, api } from '~/lib/api.ts'
import { getSessionState } from '~/server/session-fn.ts'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const session = await getSessionState()
    if (!session.initialized) throw redirect({ to: '/setup' })
    if (session.authenticated) throw redirect({ to: '/apps' })
  },
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await api.post('/api/admin/login', { password })
      await router.navigate({ to: '/apps' })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Login failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthCard title="Sign in to Shukka" description="Enter the admin password." error={error} onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </AuthCard>
  )
}
