import { useEffect, useState } from "react"
import { Loader2, CalendarOff, Search, Trash2, ChevronLeft, ChevronRight, X, Pencil } from "lucide-react"

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

const ITEMS_PER_PAGE = 10

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

  const [patientId, setPatientId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [notes, setNotes] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterDate, setFilterDate] = useState("")
  const [filterPatient, setFilterPatient] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const [errors, setErrors] = useState<{
    patientId?: string
    date?: string
    time?: string
  }>({})

  async function getPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("first_name")

    if (error) {
      setErrorMessage("No se pudo cargar la lista de pacientes.")
      return
    }

    setPatients(data || [])
  }

  async function getAppointments() {
    const { data, error } = await supabase
      .from("appointments")
      .select(`*, patients(first_name, last_name)`)
      .order("appointment_date", { ascending: true })

    if (error) {
      setErrorMessage("No se pudieron cargar los turnos. Verificá tu conexión.")
      return
    }

    setAppointments(data || [])
  }

  async function createAppointment() {
    const newErrors: typeof errors = {}

    if (!patientId)
      newErrors.patientId = "Seleccioná un paciente"

    if (!date)
      newErrors.date = "La fecha es obligatoria"

    if (!time)
      newErrors.time = "El horario es obligatorio"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setIsSubmitting(true)

    const { error } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientId,
        appointment_date: date,
        appointment_time: time,
        notes,
      })
    setIsSubmitting(false)

    if (error) {
      showToast("No se pudo guardar el turno.", "error")
      return
    }

    setCreateDialogOpen(false)
    setPatientId("")
    setDate("")
    setTime("")
    setNotes("")

    showToast("Turno guardado.", "success")
    getAppointments()
  }

  function openEditForm(appointment: Appointment) {
    setEditingAppointment(appointment)
    setEditDate(appointment.appointment_date)
    setEditTime(appointment.appointment_time)
    setEditNotes(appointment.notes ?? "")
  }

  async function updateAppointment() {
    if (!editingAppointment) return
    setIsSubmitting(true)

    const { error } = await supabase
      .from("appointments")
      .update({
        appointment_date: editDate,
        appointment_time: editTime,
        notes: editNotes,
      })
      .eq("id", editingAppointment.id)
    setIsSubmitting(false)

    if (error) {
      showToast("No se pudo actualizar el turno.", "error")
      return
    }

    setEditingAppointment(null)
    showToast("Turno actualizado.", "success")
    getAppointments()
  }

  async function confirmDeleteAppointment() {
    if (!deletingAppointmentId) return

    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", deletingAppointmentId)

    setDeletingAppointmentId(null)

    if (error) {
      showToast("No se pudo eliminar el turno.", "error")
      return
    }

    showToast("Turno eliminado.", "success")
    getAppointments()
  }

  async function updateStatus(appointmentId: string, status: string) {
    setUpdatingStatusId(appointmentId)

    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", appointmentId)

    setUpdatingStatusId(null)

    if (error) {
      showToast("No se pudo actualizar el estado.", "error")
      return
    }

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
    const matchesStatus = filterStatus === "" || a.status === filterStatus
    const matchesDate = filterDate === "" || a.appointment_date === filterDate
    const matchesPatient = filterPatient === "" ||
      `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`.toLowerCase().includes(filterPatient.toLowerCase())
    return matchesStatus && matchesDate && matchesPatient
  })

  const totalPages = Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE)
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  return (
    <div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={clearToast} />
      )}

      <ConfirmDialog
        open={deletingAppointmentId !== null}
        title="¿Eliminar este turno?"
        description="Esta acción no se puede deshacer."
        onConfirm={confirmDeleteAppointment}
        onCancel={() => setDeletingAppointmentId(null)}
      />

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
            <input
              type="text"
              placeholder="Notas (opcional)"
              aria-label="Notas del turno"
              className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
            <Button onClick={updateAppointment} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Cambios"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Turnos</h1>
          <p className="text-gray-500 mt-2">
            {isLoading
              ? "Cargando..."
              : (filterStatus || filterDate || filterPatient) && filteredAppointments.length !== appointments.length
                ? `${filteredAppointments.length} de ${appointments.length} turnos`
                : `${appointments.length} turno${appointments.length !== 1 ? "s" : ""} agendado${appointments.length !== 1 ? "s" : ""}`
            }
          </p>
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
                <select
                  aria-label="Paciente"
                  autoFocus
                  className={`border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.patientId ? "border-red-500" : ""}`}
                  value={patientId}
                  onChange={(e) => {
                    setPatientId(e.target.value)
                    if (errors.patientId) setErrors((prev) => ({ ...prev, patientId: undefined }))
                  }}
                >
                  <option value="">Seleccionar paciente</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name}
                    </option>
                  ))}
                </select>
                {errors.patientId && (
                  <p className="text-red-500 text-sm">{errors.patientId}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Fecha <span className="text-red-400">*</span></label>
                <input
                  type="date"
                  aria-label="Fecha del turno"
                  className={`border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.date ? "border-red-500" : ""}`}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value)
                    if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }))
                  }}
                />
                {errors.date && (
                  <p className="text-red-500 text-sm">{errors.date}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Horario <span className="text-red-400">*</span></label>
                <input
                  type="time"
                  aria-label="Horario del turno"
                  className={`border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.time ? "border-red-500" : ""}`}
                  value={time}
                  onChange={(e) => {
                    setTime(e.target.value)
                    if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }))
                  }}
                />
                {errors.time && (
                  <p className="text-red-500 text-sm">{errors.time}</p>
                )}
              </div>
              <input
                type="text"
                placeholder="Notas (opcional)"
                aria-label="Notas del turno"
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button onClick={createAppointment} disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Turno"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ErrorBanner message={errorMessage} onClose={() => setErrorMessage("")} />

      <Card className="p-4 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex gap-4 flex-wrap">
          <div className="relative flex-1 min-w-36">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar paciente..."
              aria-label="Buscar por nombre de paciente"
              className="border rounded-lg p-3 pl-9 w-full dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              value={filterPatient}
              onChange={(e) => {
                setFilterPatient(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>

          <select
            aria-label="Filtrar por estado"
            className="border rounded-lg p-3 flex-1 min-w-36 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="">Todos los estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Confirmado">Confirmado</option>
            <option value="Completado">Completado</option>
            <option value="Cancelado">Cancelado</option>
          </select>

          <input
            type="date"
            aria-label="Filtrar por fecha"
            className="border rounded-lg p-3 flex-1 min-w-36 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value)
              setCurrentPage(1)
            }}
          />

          {(filterStatus || filterDate || filterPatient) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-gray-400 hover:text-black dark:hover:text-white"
              aria-label="Limpiar filtros"
              onClick={() => {
                setFilterStatus("")
                setFilterDate("")
                setFilterPatient("")
                setCurrentPage(1)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4">

        {isLoading && (
          <>
            {[...Array(4)].map((_, i) => (
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
            ))}
          </>
        )}

        {!isLoading && appointments.length === 0 && (
          <Card className="p-10 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col items-center text-center gap-3">
            <CalendarOff className="h-10 w-10 text-gray-300 dark:text-zinc-600" />
            <p className="text-gray-500">No hay turnos agendados aún.</p>
            <p className="text-sm text-gray-400">Usá el botón "Nuevo Turno" para crear el primero.</p>
          </Card>
        )}

        {!isLoading && appointments.length > 0 && filteredAppointments.length === 0 && (
          <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">
            <p className="text-gray-500">No hay turnos que coincidan con los filtros.</p>
          </Card>
        )}

        {!isLoading && paginatedAppointments.map((appointment) => {
          const isPast = appointment.appointment_date < today

          return (
            <Card
              key={appointment.id}
              className={`p-4 dark:bg-zinc-900 dark:border-zinc-800 transition-opacity ${isPast ? "opacity-60" : ""}`}
            >

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-base font-semibold truncate">
                      {appointment.patients?.first_name} {appointment.patients?.last_name}
                    </h2>
                    {isPast && (
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
                  <option value="Pendiente">Pendiente</option>
                  <option value="Confirmado">Confirmado</option>
                  <option value="Completado">Completado</option>
                  <option value="Cancelado">Cancelado</option>
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

      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm text-gray-500 min-w-[60px] text-center">
            {currentPage} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

    </div>
  )
}

export default Appointments
