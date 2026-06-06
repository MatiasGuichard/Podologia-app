import { useEffect, useState } from "react"

import { supabase } from "../lib/supabase"

import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import type { Patient, Appointment } from "../types"
import Toast from "../components/Toast"
import ConfirmDialog from "../components/ConfirmDialog"
import { getStatusStyles } from "../lib/statusStyles"
import { formatDate } from "../lib/dateUtils"

function Appointments() {

  const [patients, setPatients] = useState<Patient[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [deletingAppointmentId, setDeletingAppointmentId] = useState<string | null>(null)

  const [patientId, setPatientId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [notes, setNotes] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterDate, setFilterDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const [errors, setErrors] = useState<{
    patientId?: string
    date?: string
    time?: string
  }>({})

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type })
  }

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

    const { error } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientId,
        appointment_date: date,
        appointment_time: time,
        notes,
      })

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
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", appointmentId)

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
    return matchesStatus && matchesDate
  })

  const totalPages = Math.ceil(filteredAppointments.length / 10)
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * 10,
    currentPage * 10
  )

  return (
    <div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <ConfirmDialog
        open={deletingAppointmentId !== null}
        title="¿Eliminar este turno?"
        description="Esta acción no se puede deshacer."
        onConfirm={confirmDeleteAppointment}
        onCancel={() => setDeletingAppointmentId(null)}
      />

      <div className="mb-8">
        <h1 className="text-4xl font-bold">Turnos</h1>
        <p className="text-gray-500 mt-2">Gestión de agenda clínica</p>
      </div>

      {errorMessage && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage("")} className="shrink-0 font-bold hover:opacity-70">✕</button>
        </div>
      )}

      <Card className="p-4 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex gap-4">
          <select
            aria-label="Filtrar por estado"
            className="border rounded-lg p-3 bg-transparent flex-1"
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
            className="border rounded-lg p-3 bg-transparent flex-1"
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value)
              setCurrentPage(1)
            }}
          />

          {(filterStatus || filterDate) && (
            <Button
              variant="outline"
              onClick={() => {
                setFilterStatus("")
                setFilterDate("")
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

        <div className="grid grid-cols-2 gap-4">

          <div className="flex flex-col gap-1">
            <select
              aria-label="Paciente"
              className={`border rounded-lg p-3 bg-transparent ${errors.patientId ? "border-red-500" : ""}`}
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
              className={`border rounded-lg p-3 bg-transparent ${errors.date ? "border-red-500" : ""}`}
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
              className={`border rounded-lg p-3 bg-transparent ${errors.time ? "border-red-500" : ""}`}
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
            className="border rounded-lg p-3 bg-transparent"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

        </div>

        <Button className="mt-4" onClick={createAppointment}>
          Guardar Turno
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
                      className={`px-3 py-2 rounded-xl text-sm border font-medium outline-none ${getStatusStyles(appointment.status)}`}
                      value={appointment.status}
                      onChange={(e) => updateStatus(appointment.id, e.target.value)}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Confirmado">Confirmado</option>
                      <option value="Completado">Completado</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </label>

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
                <p className="mt-4 text-gray-500">{appointment.notes}</p>
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
