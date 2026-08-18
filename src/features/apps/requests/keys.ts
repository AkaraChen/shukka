export const appKeys = {
  all: () => ['apps'] as const,
  list: () => [...appKeys.all(), 'list'] as const,
  detail: (appId: number) => [...appKeys.all(), 'detail', appId] as const,
}
