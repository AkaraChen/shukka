import { PackageOpen } from 'lucide-react'
import type { ComponentProps } from 'react'

/** Shukka mark: an opened shipping box, matching the release-delivery metaphor. */
export function PackageIcon(props: ComponentProps<typeof PackageOpen>) {
  return <PackageOpen {...props} />
}
