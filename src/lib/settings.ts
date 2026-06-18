export const SETTINGS_KEY = "clinic-settings"

export type ClinicSettings = {
  clinicName: string
  doctorName: string
  phone: string
  address: string
  email: string
  workStart: string
  workEnd: string
}

export const DEFAULT_SETTINGS: ClinicSettings = {
  clinicName: "Podología",
  doctorName: "",
  phone: "",
  address: "",
  email: "",
  workStart: "08:00",
  workEnd: "20:00",
}

export function loadSettings(): ClinicSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}
