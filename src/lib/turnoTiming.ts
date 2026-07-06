import type { Appointment } from "../types"

export function isBeforeScheduledTime(apt: Appointment): boolean {
  const scheduled = new Date(`${apt.appointment_date}T${apt.appointment_time}`)
  return Date.now() < scheduled.getTime()
}

export function nowTimeLabel(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
}
