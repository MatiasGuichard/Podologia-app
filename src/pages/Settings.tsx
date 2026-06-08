import { useEffect, useState } from "react"
import { Save, Building2, User } from "lucide-react"
import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import Toast from "../components/Toast"
import { useToast } from "../hooks/useToast"

export const SETTINGS_KEY = "clinic-settings"

export type ClinicSettings = {
  clinicName: string
  doctorName: string
  phone: string
  address: string
  email: string
}

export const DEFAULT_SETTINGS: ClinicSettings = {
  clinicName: "Podología",
  doctorName: "",
  phone: "",
  address: "",
  email: "",
}

export function loadSettings(): ClinicSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

function Settings() {
  const [settings, setSettings] = useState<ClinicSettings>(DEFAULT_SETTINGS)
  const { toast, showToast, clearToast } = useToast()

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  function save() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    window.dispatchEvent(new Event("clinic-settings-updated"))
    showToast("Configuración guardada.", "success")
  }

  function update(field: keyof ClinicSettings, value: string) {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const inputClass = "border p-3 rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 w-full"

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}

      <div className="mb-8">
        <h1 className="text-4xl font-bold">Configuración</h1>
        <p className="text-gray-500 mt-2">Datos del consultorio</p>
      </div>

      <div className="max-w-xl flex flex-col gap-6">

        <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            Consultorio
          </h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Nombre del consultorio</label>
              <input
                className={inputClass}
                placeholder="Ej: Podología García"
                value={settings.clinicName}
                onChange={e => update("clinicName", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Dirección</label>
              <input
                className={inputClass}
                placeholder="Ej: Av. Corrientes 1234, CABA"
                value={settings.address}
                onChange={e => update("address", e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            Profesional
          </h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Nombre</label>
              <input
                className={inputClass}
                placeholder="Ej: Dra. Laura García"
                value={settings.doctorName}
                onChange={e => update("doctorName", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Teléfono</label>
              <input
                className={inputClass}
                type="tel"
                placeholder="Ej: 11 5678-1234"
                value={settings.phone}
                onChange={e => update("phone", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Email</label>
              <input
                className={inputClass}
                type="email"
                placeholder="Ej: consulta@podologia.com"
                value={settings.email}
                onChange={e => update("email", e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Button onClick={save} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Guardar cambios
        </Button>

      </div>
    </div>
  )
}

export default Settings
