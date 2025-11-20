export const generateProviderColor = (providerId: string): string => {
  let hash = 0
  for (let i = 0; i < providerId.length; i++) {
    hash = providerId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = hash % 360
  return `hsl(${hue}, 70%, 60%)`
}

export const generateProviderColors = (providerIds: string[]): Record<string, string> => {
  return providerIds.reduce((acc, id) => {
    acc[id] = generateProviderColor(id)
    return acc
  }, {} as Record<string, string>)
}
