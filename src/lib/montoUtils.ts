export function parseMonto(value: string): number | null {
  if (!value || value.trim() === "") return null
  const n = Number(value)
  if (isNaN(n) || n < 0) return null
  return n
}

export function parseMontoPositivo(value: string): number | null {
  if (!value || value.trim() === "") return null
  const n = Number(value)
  if (isNaN(n) || n <= 0) return null
  return n
}
