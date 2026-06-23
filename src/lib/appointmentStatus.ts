export const APPOINTMENT_STATUSES = [
  "Pendiente",
  "Confirmado",
  "En atención",
  "Completado",
  "Cancelado",
  "No vino",
] as const

export type AppointmentStatus = typeof APPOINTMENT_STATUSES[number]
