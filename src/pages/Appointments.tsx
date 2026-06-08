import { useEffect, useState } from "react"
import { Loader2, CalendarOff, Search, Trash2, ChevronLeft, ChevronRight, X, Pencil, LayoutList, CalendarDays, ImagePlus } from "lucide-react"
import { Link } from "react-router-dom"

import { supabase } from "../lib/supabase"

import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog"
import type { Patient, Appointment } from "../types"
import Toast from "../components/Toast"
import ConfirmDialog from "../components/ConfirmDialog"
import ErrorBanner from "../components/ErrorBanner"
import { getStatusStyles } from "../lib/statusStyles"
import { formatDate } from "../lib/dateUtils"
import { useToast } from "../hooks/useToast"
import { useDebounce } from "../hooks/useDebounce"

const ITEMS_PER_PAGE = 10

const STATUS_OPTIONS = ["Pendiente", "Confirmado", "Completado", "Cancelado"]

function Appointments() {

  const [patients, setPatients] = useState<Patient[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const { toast, showToast, clearToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)
  const [deletingAppointmentId, setDeletingAppointmentId] = useState<string | null>(null)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [editDate, setEditDate] = useState("")
  const [editTime, setEditTime] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editStatus, setEditStatus] = useState("")

  const [view, setView] = useState<"list" | "calendar">("list")
  const [filterUpcoming, setFilterUpcoming] = useState(false)

  const [patientId, setPatientId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [notes, setNotes] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterDate, setFilterDate] = useState("")
  const [filterPatient, setFilterPatient] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const debouncedFilterPatient = useDebounce(filterPatient, 300)

  const [errors, setErrors] = useState<{
    patientId?: string
    date?: string
    time?: string
  }>({})

  // ─── Consultation dialog state ──────────────────────────────────────────────
  const [consultingAppointment, setConsultingAppointment] = useState<Appointment | null>(null)
  const [consultDate, setConsultDate] = useState("")
  const [consultDiagnosis, setConsultDiagnosis] = useState("")
  const [consultTreatment, setConsultTreatment] = useState("")
  const [consultObservations, setConsultObservations] = useState("")
  const [consultBeforeImage, setConsultBeforeImage] = useState<File | null>(null)
  const [consultAfterImage, setConsultAfterImage] = useState<File | null>(null)
  const [consultErrors, setConsultErrors] = useState<{ diagnosis?: string; treatment?: string }>({})
  const [isSubmittingConsult, setIsSubmittingConsult] = useState(false)

  async function getPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("first_name")
    if (error) { setErrorMessage("No se pudo cargar la lista de pacientes."); return }
    setPatients(data || [])
  }

  async function getAppointments() {
    const { data, error } = await supabase
      .from("appointments")
      .select(`*, patients(first_name, last_name)`)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true })
    if (error) { setErrorMessage("No se pudieron cargar los turnos. Verificá tu conexión."); return }
    setAppointments(data || [])
  }

  async function createAppointment() {
    const newErrors: typeof errors = {}
    if (!patientId) newErrors.patientId = "Seleccioná un paciente"
    if (!date)      newErrors.date = "La fecha es obligatoria"
    if (!time)      newErrors.time = "El horario es obligatorio"

    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }

    setErrors({})
    setIsSubmitting(true)

    const { data: existing } = await supabase
      .from("appointments")
      .select("id")
      .eq("appointment_date", date)
      .eq("appointment_time", time)
      .neq("status", "Cancelado")
      .limit(1)

    if (existing && existing.length > 0) {
      showToast("Ya hay un turno agendado en ese horario.", "error")
      setIsSubmitting(false)
      return
    }

    const { error } = await supabase.from("appointments").insert({
      patient_id: patientId,
      appointment_date: date,
      appointment_time: time,
      notes,
    })
    setIsSubmitting(false)

    if (error) { showToast("No se pudo guardar el turno.", "error"); return }

    setCreateDialogOpen(false)
    setPatientId(""); setDate(""); setTime(""); setNotes("")
    showToast("Turno guardado.", "success")
    getAppointments()
  }

  function openEditForm(appointment: Appointment) {
    setEditingAppointment(appointment)
    setEditDate(appointment.appointment_date)
    setEditTime(appointment.appointment_time)
    setEditNotes(appointment.notes ?? "")
    setEditStatus(appointment.status)
  }

  async function updateAppointment() {
    if (!editingAppointment) return
    setIsSubmitting(true)

    const { data: existing } = await supabase
      .from("appointments")
      .select("id")
      .eq("appointment_date", editDate)
      .eq("appointment_time", editTime)
      .neq("status", "Cancelado")
      .neq("id", editingAppointment.id)
      .limit(1)

    if (existing && existing.length > 0) {
      showToast("Ya hay un turno agendado en ese horario.", "error")
      setIsSubmitting(false)
      return
    }

    const { error } = await supabase
      .from("appointments")
      .update({ appointment_date: editDate, appointment_time: editTime, notes: editNotes, status: editStatus })
      .eq("id", editingAppointment.id)
    setIsSubmitting(false)

    if (error) { showToast("No se pudo actualizar el turno.", "error"); return }

    setEditingAppointment(null)
    showToast("Turno actualizado.", "success")
    getAppointments()
  }

  async function confirmDeleteAppointment() {
    if (!deletingAppointmentId) return
    const { error } = await supabase.from("appointments").delete().eq("id", deletingAppointmentId)
    setDeletingAppointmentId(null)
    if (error) { showToast("No se pudo eliminar el turno.", "error"); return }
    showToast("Turno eliminado.", "success")
    getAppointments()
  }

  // Opens consultation dialog when user selects "Completado" from the inline select.
  // Other status changes update immediately as before.
  async function updateStatus(appointmentId: string, newStatus: string) {
    if (newStatus === "Completado") {
      const appt = appointments.find(a => a.id === appointmentId)
      if (appt && appt.status !== "Completado") {
        openConsultDialog(appt)
        return
      }
      return
    }
    setUpdatingStatusId(appointmentId)
    const { error } = await supabase.from("appointments").update({ status: newStatus }).eq("id", appointmentId)
    setUpdatingStatusId(null)
    if (error) { showToast("No se pudo actualizar el estado.", "error"); return }
    getAppointments()
  }

  // ─── Consultation dialog helpers ─────────────────────────────────────────────

  function openConsultDialog(appointment: Appointment) {
    setConsultingAppointment(appointment)
    setConsultDate(appointment.appointment_date)
    setConsultDiagnosis("")
    setConsultTreatment("")
    setConsultObservations("")
    setConsultBeforeImage(null)
    setConsultAfterImage(null)
    setConsultErrors({})
  }

  function closeConsultDialog() {
    setConsultingAppointment(null)
  }

  async function uploadConsultImage(file: File | null): Promise<string | null> {
    if (!file) return null
    const fileName = `${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from("clinical-images").upload(fileName, file)
    if (error) { showToast("No se pudo subir la imagen.", "error"); return null }
    const { data } = supabase.storage.from("clinical-images").getPublicUrl(fileName)
    return data.publicUrl
  }

  async function saveConsultation() {
    if (!consultingAppointment) return

    const newErrors: typeof consultErrors = {}
    if (!consultDiagnosis.trim()) newErrors.diagnosis = "El diagnóstico es obligatorio"
    if (!consultTreatment.trim()) newErrors.treatment = "El tratamiento es obligatorio"
    if (Object.keys(newErrors).length > 0) { setConsultErrors(newErrors); return }

    setIsSubmittingConsult(true)

    const [beforeUrl, afterUrl] = await Promise.all([
      uploadConsultImage(consultBeforeImage),
      uploadConsultImage(consultAfterImage),
    ])

    const { error: recordError } = await supabase.from("medical_records").insert({
      patient_id: consultingAppointment.patient_id,
      visit_date: consultDate || consultingAppointment.appointment_date,
      diagnosis: consultDiagnosis,
      treatment: consultTreatment,
      observations: consultObservations,
      before_image_url: beforeUrl,
      after_image_url: afterUrl,
    })

    if (recordError) {
      setIsSubmittingConsult(false)
      showToast("No se pudo guardar la consulta.", "error")
      return
    }

    const { error: apptError } = await supabase
      .from("appointments")
      .update({ status: "Completado" })
      .eq("id", consultingAppointment.id)

    setIsSubmittingConsult(false)

    if (apptError) {
      showToast("Consulta guardada, pero no se pudo actualizar el turno.", "error")
    } else {
      showToast("Consulta registrada. Turno completado.", "success")
    }

    setConsultingAppointment(null)
    getAppointments()
  }

  useEffect(() => {
    async function loadAll() {
      setIsLoading(true)
      await Promise.all([getPatients(), getAppointments()])
      setIsLoading(false)
    }
    loadAll()
  }, [])

  const today = new Date().toISOString().split("T")[0]

  const filteredAppointments = appointments.filter((a) => {
    const matchesStatus   = filterStatus === ""
      ? a.status !== "Completado"
      : a.status === filterStatus
    const matchesDate     = filterDate === "" || a.appointment_date === filterDate
    const matchesPatient  = debouncedFilterPatient === "" ||
      `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`.toLowerCase().includes(debouncedFilterPatient.toLowerCase())
    const matchesUpcoming = !filterUpcoming || a.appointment_date >= today
    return matchesStatus && matchesDate && matchesPatient && matchesUpcoming
  })

  const totalPages = Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE)

  const paginatedAppointments = view === "calendar"
    ? filterDate
      ? filteredAppointments
      : filteredAppointments.slice(0, ITEMS_PER_PAGE)
    : filteredAppointments.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
      )

  const hasActiveFilters = filterStatus || filterDate || filterPatient || filterUpcoming

  return (
    <div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}

      <ConfirmDialog
        open={deletingAppointmentId !== null}
        title="¿Eliminar este turno?"
        description="Esta acción no se puede deshacer."
        onConfirm={confirmDeleteAppointment}
        onCancel={() => setDeletingAppointmentId(null)}
      />

      {/* Edit dialog */}
      <Dialog
        open={editingAppointment !== null}
        onOpenChange={(val) => { if (!val) setEditingAppointment(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar turno — {editingAppointment?.patients?.first_name} {editingAppointment?.patients?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Fecha <span className="text-red-400">*</span></label>
                <input
                  type="date"
                  aria-label="Fecha del turno"
                  className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Horario <span className="text-red-400">*</span></label>
                <input
                  type="time"
                  aria-label="Horario del turno"
                  className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Estado</label>
              <select
                aria-label="Estado del turno"
                className={`border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-medium ${getStatusStyles(editStatus)}`}
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Notas</label>
              <input
                type="text"
                placeholder="Notas adicionales..."
                aria-label="Notas del turno"
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
            <Button onClick={updateAppointment} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Cambios"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Consultation dialog — triggered when marking an appointment as Completado */}
      <Dialog open={consultingAppointment !== null} onOpenChange={(val) => { if (!val) closeConsultDialog() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar consulta</DialogTitle>
            {consultingAppointment && (
              <p className="text-sm text-gray-500 mt-1">
                {consultingAppointment.patients?.first_name} {consultingAppointment.patients?.last_name}
                {" · "}
                {formatDate(consultingAppointment.appointment_date)} — {consultingAppointment.appointment_time}
              </p>
            )}
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-2">

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Fecha de visita</label>
              <input
                type="date"
                aria-label="Fecha de visita"
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={consultDate}
                onChange={(e) => setConsultDate(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Diagnóstico <span className="text-red-400">*</span></label>
              <textarea
                placeholder="Describí el diagnóstico..."
                aria-label="Diagnóstico"
                autoFocus
                className={`border rounded-lg p-4 min-h-[100px] dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${consultErrors.diagnosis ? "border-red-500" : "dark:border-zinc-700"}`}
                value={consultDiagnosis}
                onChange={(e) => {
                  setConsultDiagnosis(e.target.value)
                  if (consultErrors.diagnosis) setConsultErrors(p => ({ ...p, diagnosis: undefined }))
                }}
              />
              {consultErrors.diagnosis && <p className="text-red-500 text-sm">{consultErrors.diagnosis}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Tratamiento <span className="text-red-400">*</span></label>
              <textarea
                placeholder="Describí el tratamiento..."
                aria-label="Tratamiento"
                className={`border rounded-lg p-4 min-h-[100px] dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${consultErrors.treatment ? "border-red-500" : "dark:border-zinc-700"}`}
                value={consultTreatment}
                onChange={(e) => {
                  setConsultTreatment(e.target.value)
                  if (consultErrors.treatment) setConsultErrors(p => ({ ...p, treatment: undefined }))
                }}
              />
              {consultErrors.treatment && <p className="text-red-500 text-sm">{consultErrors.treatment}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Observaciones</label>
              <textarea
                placeholder="Notas adicionales..."
                aria-label="Observaciones"
                className="border rounded-lg p-4 min-h-[72px] dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={consultObservations}
                onChange={(e) => setConsultObservations(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  aria-label="Foto antes del tratamiento"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (!file.type.startsWith("image/")) { showToast("Solo se permiten imágenes.", "error"); return }
                    setConsultBeforeImage(file)
                  }}
                />
                <ImagePlus className="h-6 w-6 text-gray-400" />
                <div className="text-center">
                  <p className="text-sm font-medium">Foto ANTES</p>
                  {consultBeforeImage
                    ? <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[110px]">{consultBeforeImage.name}</p>
                    : <p className="text-xs text-gray-400">Seleccionar imagen</p>
                  }
                </div>
              </label>

              <label className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  aria-label="Foto después del tratamiento"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (!file.type.startsWith("image/")) { showToast("Solo se permiten imágenes.", "error"); return }
                    setConsultAfterImage(file)
                  }}
                />
                <ImagePlus className="h-6 w-6 text-gray-400" />
                <div className="text-center">
                  <p className="text-sm font-medium">Foto DESPUÉS</p>
                  {consultAfterImage
                    ? <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[110px]">{consultAfterImage.name}</p>
                    : <p className="text-xs text-gray-400">Seleccionar imagen</p>
                  }
                </div>
              </label>
            </div>

            <div className="flex gap-3 mt-1">
              <Button variant="outline" className="flex-1" onClick={closeConsultDialog} disabled={isSubmittingConsult}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={saveConsultation} disabled={isSubmittingConsult}>
                {isSubmittingConsult
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                  : "Guardar Consulta"
                }
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Turnos</h1>
          <p className="text-gray-500 mt-2">
            {isLoading
              ? "Cargando..."
              : hasActiveFilters && filteredAppointments.length !== appointments.length
                ? `${filteredAppointments.length} de ${appointments.length} turnos`
                : `${appointments.length} turno${appointments.length !== 1 ? "s" : ""} agendado${appointments.length !== 1 ? "s" : ""}`
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border dark:border-zinc-700 overflow-hidden">
            <button
              onClick={() => setView("list")}
              className={`p-2 transition-colors ${view === "list" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500"}`}
              aria-label="Vista lista"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`p-2 transition-colors ${view === "calendar" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500"}`}
              aria-label="Vista calendario"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>

          <Dialog
            open={createDialogOpen}
            onOpenChange={(val) => {
              setCreateDialogOpen(val)
              if (!val) { setPatientId(""); setDate(""); setTime(""); setNotes(""); setErrors({}) }
            }}
          >
            <DialogTrigger asChild>
              <Button>Nuevo Turno</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo Turno</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Paciente <span className="text-red-400">*</span></label>
                  <select
                    aria-label="Paciente"
                    autoFocus
                    className={`border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.patientId ? "border-red-500" : ""}`}
                    value={patientId}
                    onChange={(e) => { setPatientId(e.target.value); if (errors.patientId) setErrors(p => ({ ...p, patientId: undefined })) }}
                  >
                    <option value="">Seleccionar paciente</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                    ))}
                  </select>
                  {errors.patientId && <p className="text-red-500 text-sm">{errors.patientId}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-500">Fecha <span className="text-red-400">*</span></label>
                    <input
                      type="date"
                      aria-label="Fecha del turno"
                      className={`border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.date ? "border-red-500" : ""}`}
                      value={date}
                      onChange={(e) => { setDate(e.target.value); if (errors.date) setErrors(p => ({ ...p, date: undefined })) }}
                    />
                    {errors.date && <p className="text-red-500 text-sm">{errors.date}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-500">Horario <span className="text-red-400">*</span></label>
                    <input
                      type="time"
                      aria-label="Horario del turno"
                      className={`border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.time ? "border-red-500" : ""}`}
                      value={time}
                      onChange={(e) => { setTime(e.target.value); if (errors.time) setErrors(p => ({ ...p, time: undefined })) }}
                    />
                    {errors.time && <p className="text-red-500 text-sm">{errors.time}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Notas</label>
                  <input
                    type="text"
                    placeholder="Notas adicionales..."
                    aria-label="Notas del turno"
                    className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <Button onClick={createAppointment} disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Turno"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ErrorBanner message={errorMessage} onClose={() => setErrorMessage("")} />

      {view === "calendar" && (
        <CalendarView
          appointments={filteredAppointments}
          selectedDate={filterDate}
          onSelectDate={(d) => { setFilterDate(d); setCurrentPage(1) }}
        />
      )}

      {/* Filters */}
      <Card className="p-4 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex gap-3 flex-wrap">

          <div className="flex flex-col gap-1 flex-1 min-w-36">
            <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide px-0.5">Paciente</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar paciente..."
                aria-label="Buscar por nombre de paciente"
                className="border rounded-lg p-3 pl-9 w-full dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={filterPatient}
                onChange={(e) => { setFilterPatient(e.target.value); setCurrentPage(1) }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-36">
            <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide px-0.5">Estado</span>
            <select
              aria-label="Filtrar por estado"
              className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1) }}
            >
              <option value="">Todos los estados</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {view === "list" && (
            <div className="flex flex-col gap-1 flex-1 min-w-36">
              <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide px-0.5">Fecha</span>
              <input
                type="date"
                aria-label="Filtrar por fecha"
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={filterDate}
                onChange={(e) => { setFilterDate(e.target.value); setCurrentPage(1) }}
              />
            </div>
          )}

          <div className="flex flex-col gap-1 justify-end">
            <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide px-0.5 invisible select-none">·</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setFilterUpcoming(!filterUpcoming); setCurrentPage(1) }}
                className={`px-3 py-3 rounded-lg text-sm border transition-colors whitespace-nowrap ${
                  filterUpcoming
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                    : "border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500"
                }`}
              >
                Solo próximos
              </button>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-gray-400 hover:text-black dark:hover:text-white"
                  aria-label="Limpiar filtros"
                  onClick={() => { setFilterStatus(""); setFilterDate(""); setFilterPatient(""); setFilterUpcoming(false); setCurrentPage(1) }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

        </div>
      </Card>

      {/* List */}
      <div className="grid gap-4">

        {isLoading && (
          [...Array(4)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
                  <div className="h-3 w-1/4 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
                </div>
                <div className="h-7 w-24 rounded-xl bg-gray-200 dark:bg-zinc-700 animate-pulse shrink-0" />
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="h-3 w-2/5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-8 w-16 rounded-lg bg-gray-200 dark:bg-zinc-700 animate-pulse" />
                  <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-zinc-700 animate-pulse" />
                </div>
              </div>
            </div>
          ))
        )}

        {!isLoading && appointments.length === 0 && (
          <Card className="p-10 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col items-center text-center gap-3">
            <CalendarOff className="h-10 w-10 text-gray-300 dark:text-zinc-600" />
            <p className="text-gray-500">No hay turnos agendados aún.</p>
            <p className="text-sm text-gray-400">Usá el botón "Nuevo Turno" para crear el primero.</p>
          </Card>
        )}

        {!isLoading && appointments.length > 0 && filteredAppointments.length === 0 && (
          <Card className="p-10 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col items-center text-center gap-3">
            <CalendarOff className="h-10 w-10 text-gray-300 dark:text-zinc-600" />
            <p className="text-gray-500">No hay turnos que coincidan con los filtros.</p>
            <Button variant="outline" onClick={() => { setFilterStatus(""); setFilterDate(""); setFilterPatient(""); setFilterUpcoming(false); setCurrentPage(1) }}>
              Limpiar filtros
            </Button>
          </Card>
        )}

        {!isLoading && paginatedAppointments.map((appointment) => {
          const isPast    = appointment.appointment_date < today
          const isToday   = appointment.appointment_date === today
          const isMissed  = isPast && (appointment.status === "Pendiente" || appointment.status === "Confirmado")

          return (
            <Card
              key={appointment.id}
              className={`p-4 dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden transition-opacity
                ${isPast ? "opacity-60" : ""}
                ${isToday ? "border-l-4 border-l-emerald-400 dark:border-l-emerald-500" : ""}
                ${isMissed && !isToday ? "border-l-4 border-l-amber-400 dark:border-l-amber-500" : ""}
              `}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/patients/${appointment.patient_id}`}
                      className="text-base font-semibold hover:underline underline-offset-2 truncate"
                    >
                      {appointment.patients?.first_name} {appointment.patients?.last_name}
                    </Link>
                    {isMissed && (
                      <span className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-full px-2 py-0.5">
                        Faltó
                      </span>
                    )}
                    {isPast && !isMissed && (
                      <span className="shrink-0 text-xs font-medium text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 rounded-full px-2 py-0.5">
                        Pasado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {formatDate(appointment.appointment_date)}
                    {" — "}
                    {appointment.appointment_time}
                  </p>
                </div>
                <select
                  aria-label={`Estado del turno de ${appointment.patients?.first_name} ${appointment.patients?.last_name}`}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs border font-medium outline-none ${getStatusStyles(appointment.status)} disabled:opacity-50`}
                  value={appointment.status}
                  disabled={updatingStatusId === appointment.id}
                  onChange={(e) => updateStatus(appointment.id, e.target.value)}
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex items-center justify-between mt-3">
                {appointment.notes
                  ? <p className="text-sm text-gray-500 line-clamp-1 min-w-0 mr-4">{appointment.notes}</p>
                  : <span />
                }
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    onClick={() => openEditForm(appointment)}
                    aria-label="Editar turno"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    onClick={() => setDeletingAppointmentId(appointment.id)}
                    aria-label="Eliminar turno"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}

        {!isLoading && view === "calendar" && !filterDate && filteredAppointments.length > ITEMS_PER_PAGE && (
          <p className="text-center text-sm text-gray-400 dark:text-zinc-500 py-2">
            Mostrando los primeros {ITEMS_PER_PAGE} de {filteredAppointments.length} turnos. Seleccioná un día para ver los de esa fecha.
          </p>
        )}

      </div>

      {view === "list" && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button variant="outline" size="icon" className="h-9 w-9" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} aria-label="Página anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-500 min-w-[60px] text-center">{currentPage} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-9 w-9" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} aria-label="Página siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

    </div>
  )
}

// ─── Calendar sub-component ────────────────────────────────────────────────

type CalendarViewProps = {
  appointments: Appointment[]
  selectedDate: string
  onSelectDate: (date: string) => void
}

function CalendarView({ appointments, selectedDate, onSelectDate }: CalendarViewProps) {
  const today = new Date().toISOString().split("T")[0]
  const [viewDate, setViewDate] = useState(() => new Date())

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth     = new Date(year, month + 1, 0).getDate()
  const startOffset     = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1

  const monthName = viewDate.toLocaleDateString("es-AR", { month: "long", year: "numeric" })

  const isCurrentMonth = (() => {
    const now = new Date()
    return viewDate.getFullYear() === now.getFullYear() && viewDate.getMonth() === now.getMonth()
  })()

  const appointmentsByDate = appointments.reduce<Record<string, Appointment[]>>((acc, apt) => {
    if (!acc[apt.appointment_date]) acc[apt.appointment_date] = []
    acc[apt.appointment_date].push(apt)
    return acc
  }, {})

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function dotColor(status: string) {
    if (status === "Completado") return "bg-emerald-400"
    if (status === "Confirmado") return "bg-blue-400"
    if (status === "Cancelado")  return "bg-red-400"
    return "bg-yellow-400"
  }

  return (
    <Card className="p-4 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(new Date(year, month - 1, 1))} aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <h3 className="font-semibold capitalize text-sm">{monthName}</h3>
          {!isCurrentMonth && (
            <button
              onClick={() => setViewDate(new Date())}
              className="text-xs text-gray-400 hover:text-black dark:hover:text-white border border-gray-200 dark:border-zinc-700 rounded-md px-2 py-0.5 transition-colors"
            >
              Hoy
            </button>
          )}
        </div>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(new Date(year, month + 1, 1))} aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 dark:text-zinc-500 py-1 font-medium">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />

          const dateStr  = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          const dayApts  = appointmentsByDate[dateStr] || []
          const isToday    = dateStr === today
          const isSelected = dateStr === selectedDate
          const isPast     = dateStr < today

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(isSelected ? "" : dateStr)}
              title={dayApts.length > 0 ? `${dayApts.length} turno${dayApts.length !== 1 ? "s" : ""}` : undefined}
              className={`
                flex flex-col items-center justify-start pt-1.5 pb-1 rounded-lg text-sm transition-colors min-h-[48px]
                ${isSelected
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                  : isToday
                    ? "ring-2 ring-emerald-400 font-semibold text-emerald-700 dark:text-emerald-300"
                    : isPast
                      ? "text-gray-400 dark:text-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-800"
                      : "hover:bg-gray-100 dark:hover:bg-zinc-800"
                }
              `}
            >
              <span>{day}</span>
              {dayApts.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center px-1">
                  {dayApts.slice(0, 4).map((apt, j) => (
                    <span key={j} className={`w-1.5 h-1.5 rounded-full ${dotColor(apt.status)}`} />
                  ))}
                  {dayApts.length > 4 && (
                    <span className="text-[9px] text-gray-400 leading-none">+{dayApts.length - 4}</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <div className="mt-3 pt-3 border-t dark:border-zinc-800 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-zinc-400 capitalize">
            {formatDate(selectedDate, { weekday: "long", day: "numeric", month: "long" })}
            {" · "}
            <span className="font-medium">
              {(appointmentsByDate[selectedDate] || []).length} turno{(appointmentsByDate[selectedDate] || []).length !== 1 ? "s" : ""}
            </span>
          </p>
          <button onClick={() => onSelectDate("")} className="text-xs text-gray-400 hover:text-black dark:hover:text-white transition-colors">
            Ver todos
          </button>
        </div>
      )}
    </Card>
  )
}

export default Appointments
