import { useEffect, useState } from "react"
import { Loader2, CalendarOff } from "lucide-react"

import { supabase } from "../lib/supabase"

import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

      <div className="mb-8">
        <h1 className="text-4xl font-bold">Turnos</h1>
        <p className="text-gray-500 mt-2">Gestión de agenda clínica</p>
      </div>

      <ErrorBanner message={errorMessage} onClose={() => setErrorMessage("")} />

      <Card className="p-4 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex gap-4 flex-wrap">
          <input
            type="text"
            placeholder="Buscar paciente..."
            aria-label="Buscar por nombre de paciente"
            className="border rounded-lg p-3 bg-transparent flex-1 min-w-36"
            value={filterPatient}
            onChange={(e) => {
              setFilterPatient(e.target.value)
              setCurrentPage(1)
            }}
          />

          <select
            aria-label="Filtrar por estado"
            className="border rounded-lg p-3 bg-transparent flex-1 min-w-36"
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
            className="border rounded-lg p-3 bg-transparent flex-1 min-w-36"
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value)
              setCurrentPage(1)
            }}
          />

          {(filterStatus || filterDate || filterPatient) && (
            <Button
              variant="outline"
              onClick={() => {
                setFilterStatus("")
                setFilterDate("")
                setFilterPatient("")
                setCurrentPage(1)
              }}
            >
              Limpiar
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-6 mb-8 dark:bg-zinc-900 dark:border-zinc-800">

        <h2 className="text-2xl font-bold mb-6">Nuevo Turno</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="flex flex-col gap-1">
            <select
              aria-label="Paciente"
              className={`border rounded-lg p-3 bg-transparent focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.patientId ? "border-red-500" : ""}`}
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
            <input
              type="date"
              aria-label="Fecha del turno"
              className={`border rounded-lg p-3 bg-transparent focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.date ? "border-red-500" : ""}`}
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
            <input
              type="time"
              aria-label="Horario del turno"
              className={`border rounded-lg p-3 bg-transparent focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.time ? "border-red-500" : ""}`}
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
            placeholder="Notas"
            aria-label="Notas del turno"
            className="border rounded-lg p-3 bg-transparent focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

        </div>

        <Button className="mt-4" onClick={createAppointment} disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Turno"}
        </Button>

      </Card>

      <div className="grid gap-4">

        {isLoading && (
          <>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-gray-200 dark:bg-zinc-800 animate-pulse" />
            ))}
          </>
        )}

        {!isLoading && appointments.length === 0 && (
          <Card className="p-10 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col items-center text-center gap-3">
            <CalendarOff className="h-10 w-10 text-gray-300 dark:text-zinc-600" />
            <p className="text-gray-500">No hay turnos agendados aún.</p>
            <p className="text-sm text-gray-400">Usá el formulario de arriba para crear el primero.</p>
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
              className={`p-6 dark:bg-zinc-900 dark:border-zinc-800 transition-opacity ${isPast ? "opacity-60" : ""}`}
            >

              <div className="flex justify-between items-start">

                <div>
                  <h2 className="text-xl font-bold">
                    {appointment.patients?.first_name} {appointment.patients?.last_name}
                  </h2>
                  <p className="text-gray-500 mt-1">
                    {formatDate(appointment.appointment_date)}
                    {" - "}
                    {appointment.appointment_time}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 shrink-0">Estado:</span>
                    <select
                      aria-label={`Estado del turno de ${appointment.patients?.first_name} ${appointment.patients?.last_name}`}
                      className={`px-3 py-2 rounded-xl text-sm border font-medium outline-none ${getStatusStyles(appointment.status)} disabled:opacity-50`}
                      value={appointment.status}
                      disabled={updatingStatusId === appointment.id}
                      onChange={(e) => updateStatus(appointment.id, e.target.value)}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Confirmado">Confirmado</option>
                      <option value="Completado">Completado</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </label>

                  <Button
                    variant="outline"
                    className="h-9 px-4 text-sm"
                    onClick={() => openEditForm(appointment)}
                  >
                    Editar
                  </Button>

                  <Button
                    variant="destructive"
                    className="h-9 px-4 text-sm"
                    onClick={() => setDeletingAppointmentId(appointment.id)}
                  >
                    Eliminar
                  </Button>
                </div>

              </div>

              {appointment.notes && (
                <p className="mt-4 text-gray-500 line-clamp-2">{appointment.notes}</p>
              )}

            </Card>
          )
        })}

      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            Anterior
          </Button>

          <span className="text-sm text-gray-500">
            Página {currentPage} de {totalPages}
          </span>

          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

    </div>
  )
}

export default Appointments
