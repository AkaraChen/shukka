export const appKeys = {
  all: () => ['apps'] as const,
  list: () => [...appKeys.all(), 'list'] as const,
  detail: (slug: string) => [...appKeys.all(), 'detail', slug] as const,
}
