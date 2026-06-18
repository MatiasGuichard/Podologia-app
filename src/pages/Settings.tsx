import { useEffect, useState } from "react"
import { Save, Building2, User, Clock, Loader2 } from "lucide-react"
import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import Toast from "../components/Toast"
import { useToast } from "../hooks/useToast"
import { supabase } from "../lib/supabase"
import { SETTINGS_KEY, DEFAULT_SETTINGS, loadSettings } from "../lib/settings"
import type { ClinicSettings } from "../lib/settings"

export { SETTINGS_KEY, DEFAULT_SETTINGS, loadSettings }
export type { ClinicSettings }

function Settings() {
  const [settings, setSettings] = useState<ClinicSettings>(DEFAULT_SETTINGS)
  const [isSaving, setIsSaving] = useState(false)
  const { toast, showToast, clearToast } = useToast()

  useEffect(() => {
    setSettings(loadSettings())

    async function loadFromSupabase() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single()
      if (!data) return
      const remote: ClinicSettings = {
        clinicName: data.clinic_name,
        doctorName: data.doctor_name,
        phone: data.phone,
        address: data.address,
        email: data.email,
        workStart: data.work_start,
        workEnd: data.work_end,
      }
      setSettings(remote)
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(remote))
    }
    loadFromSupabase()
  }, [])

  async function save() {
    setIsSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase.from("profiles").upsert({
        id: session.user.id,
        clinic_name: settings.clinicName,
        doctor_name: settings.doctorName,
        phone: settings.phone,
        address: settings.address,
        email: settings.email,
        work_start: settings.workStart,
        work_end: settings.workEnd,
        updated_at: new Date().toISOString(),
      })
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    window.dispatchEvent(new Event("clinic-settings-updated"))
    setIsSaving(false)
    showToast("Configuración guardada.", "success")
  }

  function update(field: keyof ClinicSettings, value: string) {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const inputClass = "border p-3 rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 w-full"

  return (
    <div className="max-w-6xl mx-auto">
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

        <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            Horario de atención
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Hora de inicio</label>
              <input
                type="time"
                className={inputClass}
                value={settings.workStart}
                onChange={e => update("workStart", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Hora de fin</label>
              <input
                type="time"
                className={inputClass}
                value={settings.workEnd}
                onChange={e => update("workEnd", e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Los turnos se generan cada 15 min. dentro de este rango con duración de 45 min.
          </p>
        </Card>

        <Button onClick={save} className="w-full" disabled={isSaving}>
          {isSaving
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
            : <><Save className="h-4 w-4 mr-2" />Guardar cambios</>
          }
        </Button>

      </div>
    </div>
  )
}

export default Settings
