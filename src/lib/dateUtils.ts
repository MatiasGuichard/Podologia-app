export function formatDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-AR", options)
}
