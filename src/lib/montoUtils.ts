export function parseMonto(value: string): number | null {
  const n = parseFloat(value)
  if (!value || isNaN(n) || n < 0) return null
  return n
}

export function parseMontoPositivo(value: string): number | null {
  const n = parseFloat(value)
  if (!value || isNaN(n) || n <= 0) return null
  return n
}
