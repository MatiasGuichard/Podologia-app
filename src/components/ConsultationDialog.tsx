import { useEffect, useState } from "react"
import { Loader2, ImagePlus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"
import { supabase } from "../lib/supabase"
import { formatDate } from "../lib/dateUtils"
import Toast from "./Toast"
import { useToast } from "../hooks/useToast"
import type { Appointment } from "../types"

type Props = {
  appointment: Appointment | null
  onClose: () => void
  onSaved: () => void
}

export default function ConsultationDialog({ appointment, onClose, onSaved }: Props) {
  const { toast, showToast, clearToast } = useToast()
  const [consultDate, setConsultDate] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [treatment, setTreatment] = useState("")
  const [observations, setObservations] = useState("")
  const [beforeImage, setBeforeImage] = useState<File | null>(null)
  const [afterImage, setAfterImage] = useState<File | null>(null)
  const [errors, setErrors] = useState<{ diagnosis?: string; treatment?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (appointment) {
      setConsultDate(appointment.appointment_date)
      setDiagnosis(""); setTreatment(""); setObservations("")
      setBeforeImage(null); setAfterImage(null); setErrors({})
    }
  }, [appointment])

  async function uploadImage(file: File | null): Promise<string | null> {
    if (!file) return null
    const fileName = `${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from("clinical-images").upload(fileName, file)
    if (error) { showToast("No se pudo subir la imagen.", "error"); return null }
    const { data } = supabase.storage.from("clinical-images").getPublicUrl(fileName)
    return data.publicUrl
  }

  async function handleSave() {
    if (!appointment) return
    const newErrors: typeof errors = {}
    if (!diagnosis.trim()) newErrors.diagnosis = "El diagnóstico es obligatorio"
    if (!treatment.trim()) newErrors.treatment = "El tratamiento es obligatorio"
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }

    setIsSubmitting(true)
    const [beforeUrl, afterUrl] = await Promise.all([
      uploadImage(beforeImage),
      uploadImage(afterImage),
    ])

    const { error: recordError } = await supabase.from("medical_records").insert({
      patient_id: appointment.patient_id,
      visit_date: consultDate || appointment.appointment_date,
      diagnosis,
      treatment,
      observations,
      before_image_url: beforeUrl,
      after_image_url: afterUrl,
    })

    if (recordError) {
      setIsSubmitting(false)
      showToast("No se pudo guardar la consulta.", "error")
      return
    }

    const { error: apptError } = await supabase.from("appointments")
      .update({ status: "Completado" }).eq("id", appointment.id)
    setIsSubmitting(false)

    if (apptError) {
      showToast("Consulta guardada, pero no se pudo actualizar el turno.", "error")
    } else {
      showToast("Consulta registrada. Turno completado.", "success")
    }
    onClose()
    onSaved()
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}
      <Dialog open={appointment !== null} onOpenChange={(val) => { if (!val) onClose() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar consulta</DialogTitle>
            {appointment && (
              <p className="text-sm text-gray-500 mt-1">
                {appointment.patients?.first_name} {appointment.patients?.last_name}
                {" · "}
                {formatDate(appointment.appointment_date)} — {appointment.appointment_time}
              </p>
            )}
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Fecha de visita</label>
              <input
                type="date" aria-label="Fecha de visita"
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={consultDate}
                onChange={(e) => setConsultDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Diagnóstico <span className="text-red-400">*</span></label>
              <textarea
                placeholder="Describí el diagnóstico..." aria-label="Diagnóstico" autoFocus
                className={`border rounded-lg p-4 min-h-[100px] dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.diagnosis ? "border-red-500" : "dark:border-zinc-700"}`}
                value={diagnosis}
                onChange={(e) => { setDiagnosis(e.target.value); if (errors.diagnosis) setErrors(p => ({ ...p, diagnosis: undefined })) }}
              />
              {errors.diagnosis && <p className="text-red-500 text-sm">{errors.diagnosis}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Tratamiento <span className="text-red-400">*</span></label>
              <textarea
                placeholder="Describí el tratamiento..." aria-label="Tratamiento"
                className={`border rounded-lg p-4 min-h-[100px] dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.treatment ? "border-red-500" : "dark:border-zinc-700"}`}
                value={treatment}
                onChange={(e) => { setTreatment(e.target.value); if (errors.treatment) setErrors(p => ({ ...p, treatment: undefined })) }}
              />
              {errors.treatment && <p className="text-red-500 text-sm">{errors.treatment}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Observaciones</label>
              <textarea
                placeholder="Notas adicionales..." aria-label="Observaciones"
                className="border rounded-lg p-4 min-h-[72px] dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                <input type="file" accept="image/*" aria-label="Foto antes del tratamiento" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; if (!f.type.startsWith("image/")) { showToast("Solo se permiten imágenes.", "error"); return }; setBeforeImage(f) }} />
                <ImagePlus className="h-6 w-6 text-gray-400" />
                <div className="text-center">
                  <p className="text-sm font-medium">Foto ANTES</p>
                  {beforeImage
                    ? <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[110px]">{beforeImage.name}</p>
                    : <p className="text-xs text-gray-400">Seleccionar imagen</p>}
                </div>
              </label>
              <label className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                <input type="file" accept="image/*" aria-label="Foto después del tratamiento" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; if (!f.type.startsWith("image/")) { showToast("Solo se permiten imágenes.", "error"); return }; setAfterImage(f) }} />
                <ImagePlus className="h-6 w-6 text-gray-400" />
                <div className="text-center">
                  <p className="text-sm font-medium">Foto DESPUÉS</p>
                  {afterImage
                    ? <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[110px]">{afterImage.name}</p>
                    : <p className="text-xs text-gray-400">Seleccionar imagen</p>}
                </div>
              </label>
            </div>
            <div className="flex gap-3 mt-1">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Consulta"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
