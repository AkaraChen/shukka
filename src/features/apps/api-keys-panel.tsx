import { KeyRound, Plus } from 'lucide-react'
import { useState } from 'react'
import { CopyBlock } from '~/components/copy-block.tsx'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { useCreateApiKey, useRevokeApiKey } from './queries.ts'
import type { AppDetail } from '~/server/dashboard.ts'

export function ApiKeysPanel({ appId, keys }: { appId: number; keys: AppDetail['keys'] }) {
  const revoke = useRevokeApiKey(appId)
  const [plaintext, setPlaintext] = useState<string | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardDescription>Each key can upload versions for this app only.</CardDescription>
        <CardAction>
          <NewKeyDialog appId={appId} onCreated={setPlaintext} />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        {plaintext ? (
          <Alert className="border-flare/40 bg-flare/5">
            <KeyRound className="text-flare" />
            <AlertTitle>Copy this key now</AlertTitle>
            <AlertDescription className="block space-y-2">
              <span>It is shown once and cannot be retrieved again.</span>
              <CopyBlock value={plaintext} className="w-full" />
            </AlertDescription>
          </Alert>
        ) : null}

        {keys.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell>{key.name}</TableCell>
                  <TableCell className="font-mono text-xs">{key.hint}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(key.createdAt * 1000).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {key.lastUsedAt ? new Date(key.lastUsedAt * 1000).toLocaleString() : 'never'}
                  </TableCell>
                  <TableCell className="text-right">
                    {key.revokedAt ? (
                      <Badge variant="outline">revoked</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Revoke "${key.name}"? Uploads using it will fail immediately.`)) {
                            revoke.mutate(key.id)
                          }
                        }}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No keys yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

function NewKeyDialog({ appId, onCreated }: { appId: number; onCreated: (plaintext: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const createKey = useCreateApiKey(appId)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> New key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            const result = await createKey.mutateAsync(name)
            onCreated(result.plaintext)
            setName('')
            setOpen(false)
          }}
        >
          <DialogHeader>
            <KeyRound className="size-5 text-muted-foreground" />
            <DialogTitle>New API key</DialogTitle>
            <DialogDescription>Name it after where it will live, e.g. the CI repository.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="key-name">Name</Label>
            <Input
              id="key-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="github-actions"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createKey.isPending}>
              Create key
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
