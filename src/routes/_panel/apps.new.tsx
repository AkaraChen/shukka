import { createFileRoute, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { PageHeader } from '~/components/page-header.tsx'
import { AppWizard } from '~/features/apps/app-wizard.tsx'
import { useCreateApp } from '~/features/apps/queries.ts'

const searchSchema = z.object({
  step: z.coerce.number().int().min(1).max(2).optional().catch(undefined),
})

export const Route = createFileRoute('/_panel/apps/new')({
  component: NewAppPage,
  validateSearch: searchSchema,
})

function NewAppPage() {
  const router = useRouter()
  const createApp = useCreateApp()
  const { step: rawStep } = Route.useSearch()
  const navigate = Route.useNavigate()
  const step = (rawStep === 2 ? 2 : 1) as 1 | 2

  return (
    <>
      <PageHeader title="New app" />
      <AppWizard
        step={step}
        onStepChange={(next) => navigate({ search: { step: next } })}
        onSubmit={async (values) => {
          const { app } = await createApp.mutateAsync(values)
          await router.navigate({ to: '/apps/$appId', params: { appId: String(app.id) } })
        }}
      />
    </>
  )
}
