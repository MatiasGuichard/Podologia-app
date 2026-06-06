export function getStoragePath(url: string | null): string | null {
  if (!url) return null
  const parts = url.split("clinical-images/")
  return parts.length > 1 ? parts[1] : null
}
