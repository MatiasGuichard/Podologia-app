import { useState } from "react"
import {
  Loader2, CalendarOff, Search, Trash2, ChevronLeft, ChevronRight,
  X, Pencil, LayoutList, CalendarDays,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"

import { supabase } from "../lib/supabase"
import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog"
import type { Appointment } from "../types"
import Toast from "../components/Toast"
import ConfirmDialog from "../components/ConfirmDialog"
import ConsultationDialog from "../components/ConsultationDialog"
import ErrorBanner from "../components/ErrorBanner"
import { getStatusStyles } from "../lib/statusStyles"
import { formatDate, todayStr } from "../lib/dateUtils"
import { useToast } from "../hooks/useToast"
import { useDebounce } from "../hooks/useDebounce"
import { usePatients } from "../hooks/usePatients"
import { useAppointments } from "../hooks/useAppointments"
import { SlotPicker } from "../components/SlotPicker"
import { WeeklyCalendarView } from "../components/WeeklyCalendarView"

const ITEMS_PER_PAGE = 10
const STATUS_OPTIONS = ["Pendiente", "Confirmado", "En atención", "Completado", "Cancelado", "No vino"]

function Appointments() {

  const { data: patients = [] } = usePatients()
  const { data: appointments = [], isLoading, isError } = useAppointments()
  const queryClient = useQueryClient()

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

  const [errors, setErrors] = useState<{ patientId?: string; date?: string; time?: string }>({})

  const [consultingAppointment, setConsultingAppointment] = useState<Appointment | null>(null)
  const [pendingCompletadoId, setPendingCompletadoId] = useState<string | null>(null)

  const [cancelingAppointment, setCancelingAppointment] = useState<Appointment | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [isCanceling, setIsCanceling] = useState(false)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["appointments"] })
  }

  async function createAppointment() {
    const newErrors: typeof errors = {}
    if (!patientId) newErrors.patientId = "Seleccioná un paciente"
    if (!date)      newErrors.date = "La fecha es obligatoria"
    if (!time)      newErrors.time = "El horario es obligatorio"
    if (date && time) {
      const nowDate = todayStr()
      const now = new Date()
      const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
      if (date < nowDate || (date === nowDate && time <= nowTime)) {
        newErrors.date = "No podés agendar un turno en una fecha u horario pasado."
      }
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    setErrors({})
    setIsSubmitting(true)

    const { data: existing } = await supabase
      .from("appointments").select("id")
      .eq("appointment_date", date).eq("appointment_time", time)
      .neq("status", "Cancelado").limit(1)

    if (existing && existing.length > 0) {
      showToast("Ya hay un turno agendado en ese horario.", "error")
      setIsSubmitting(false)
      return
    }

    const { error } = await supabase.from("appointments").insert({
      patient_id: patientId, appointment_date: date, appointment_time: time, notes,
    })
    setIsSubmitting(false)
    if (error) { showToast("No se pudo guardar el turno.", "error"); return }
    setCreateDialogOpen(false)
    setPatientId(""); setDate(""); setTime(""); setNotes("")
    showToast("Turno guardado.", "success")
    invalidate()
  }

  function openEditForm(appointment: Appointment) {
    setEditingAppointment(appointment)
    setEditDate(appointment.appointment_date)
    setEditTime(appointment.appointment_time)
    setEditNotes(appointment.notes ?? "")
    setEditStatus(appointment.status)
  }

  function handleSlotClick(slotDate: string, slotTime: string) {
    setDate(slotDate)
    setTime(slotTime)
    setCreateDialogOpen(true)
  }

  async function updateAppointment() {
    if (!editingAppointment) return
    setIsSubmitting(true)

    const { data: existing } = await supabase
      .from("appointments").select("id")
      .eq("appointment_date", editDate).eq("appointment_time", editTime)
      .neq("status", "Cancelado").neq("id", editingAppointment.id).limit(1)

    if (existing && existing.length > 0) {
      showToast("Ya hay un turno agendado en ese horario.", "error")
      setIsSubmitting(false)
      return
    }

    const { error } = await supabase.from("appointments")
      .update({ appointment_date: editDate, appointment_time: editTime, notes: editNotes, status: editStatus })
      .eq("id", editingAppointment.id)
    setIsSubmitting(false)
    if (error) { showToast("No se pudo actualizar el turno.", "error"); return }
    setEditingAppointment(null)
    showToast("Turno actualizado.", "success")
    invalidate()
  }

  async function confirmDeleteAppointment() {
    if (!deletingAppointmentId) return
    const idToDelete = deletingAppointmentId
    setDeletingAppointmentId(null)
    queryClient.setQueryData(["appointments"], (old: Appointment[] = []) =>
      old.filter(a => a.id !== idToDelete)
    )
    const { error } = await supabase.from("appointments").delete().eq("id", idToDelete)
    if (error) {
      showToast("No se pudo eliminar el turno.", "error")
      invalidate()
    } else {
      showToast("Turno eliminado.", "success")
    }
  }

  async function updateStatus(appointmentId: string, newStatus: string) {
    if (newStatus === "Completado") {
      const appt = appointments.find(a => a.id === appointmentId)
      if (appt && appt.status !== "Completado") {
        setPendingCompletadoId(appointmentId)
        openConsultDialog(appt);
        return
      }
      return
    }
    if (newStatus === "Cancelado") {
      const appt = appointments.find(a => a.id === appointmentId)
      if (appt) {
        setCancelingAppointment(appt)
        setCancelReason(appt.notes || "")
      }
      return
    }
    setUpdatingStatusId(appointmentId)
    queryClient.setQueryData(["appointments"], (old: Appointment[] = []) =>
      old.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a)
    )
    const { error } = await supabase.from("appointments").update({ status: newStatus }).eq("id", appointmentId)
    setUpdatingStatusId(null)
    if (error) { showToast("No se pudo actualizar el estado.", "error"); invalidate(); return }
    invalidate()
  }

  async function confirmCancel() {
    if (!cancelingAppointment) return
    setIsCanceling(true)
    const id = cancelingAppointment.id
    queryClient.setQueryData(["appointments"], (old: Appointment[] = []) =>
      old.map(a => a.id === id ? { ...a, status: "Cancelado", notes: cancelReason } : a)
    )
    setCancelingAppointment(null)
    const { error } = await supabase.from("appointments")
      .update({ status: "Cancelado", notes: cancelReason })
      .eq("id", id)
    setIsCanceling(false)
    if (error) { showToast("No se pudo cancelar el turno.", "error"); invalidate(); return }
    showToast("Turno cancelado.", "success")
    invalidate()
  }

  function openConsultDialog(appointment: Appointment) {
    setConsultingAppointment(appointment)
  }

  const today = todayStr()

  const filteredAppointments = appointments.filter((a) => {
    const matchesStatus  = filterStatus === "" ? a.status !== "Completado" : a.status === filterStatus
    const matchesDate    = filterDate === "" || a.appointment_date === filterDate
    const matchesPatient = debouncedFilterPatient === "" ||
      `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`.toLowerCase().includes(debouncedFilterPatient.toLowerCase())
    const matchesUpcoming = !filterUpcoming || a.appointment_date >= today
    return matchesStatus && matchesDate && matchesPatient && matchesUpcoming
  })

  const totalPages = Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE)
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const hasActiveFilters = filterStatus || filterDate || filterPatient || filterUpcoming

  return (
    <div className="max-w-6xl mx-auto">

      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}

      <Dialog open={cancelingAppointment !== null} onOpenChange={(v) => { if (!v) setCancelingAppointment(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar turno</DialogTitle>
            {cancelingAppointment && (
              <p className="text-sm text-gray-500 mt-1">
                {cancelingAppointment.patients?.first_name} {cancelingAppointment.patients?.last_name}
                {" · "}
                {formatDate(cancelingAppointment.appointment_date)}
              </p>
            )}
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">
                Motivo de cancelación <span className="text-xs text-gray-400">(opcional)</span>
              </label>
              <textarea
                autoFocus
                rows={3}
                placeholder="Ej: paciente reagendó, emergencia, etc."
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-none"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setCancelingAppointment(null)} disabled={isCanceling}>
                Volver
              </Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
                onClick={confirmCancel}
                disabled={isCanceling}
              >
                {isCanceling
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelando...</>
                  : "Cancelar turno"
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deletingAppointmentId !== null}
        title="¿Eliminar este turno?"
        description="Esta acción no se puede deshacer."
        onConfirm={confirmDeleteAppointment}
        onCancel={() => setDeletingAppointmentId(null)}
      />

      <Dialog open={editingAppointment !== null} onOpenChange={(val) => { if (!val) setEditingAppointment(null) }}>
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
                type="date" aria-label="Fecha del turno"
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Horario <span className="text-red-400">*</span></label>
              <SlotPicker
                date={editDate}
                appointments={appointments}
                value={editTime}
                onChange={setEditTime}
                excludeId={editingAppointment?.id}
              />
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
                type="text" placeholder="Notas adicionales..." aria-label="Notas del turno"
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 border-red-200 dark:border-red-900"
                disabled={isSubmitting}
                onClick={() => { setEditingAppointment(null); setDeletingAppointmentId(editingAppointment!.id) }}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Eliminar
              </Button>
              <Button onClick={updateAppointment} disabled={isSubmitting} className="flex-1">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConsultationDialog
        appointment={consultingAppointment}
        onClose={() => {
          setConsultingAppointment(null)
          setPendingCompletadoId(null)
        }}
        onSaved={() => {
          setPendingCompletadoId(null)
          invalidate()
        }}
      />

      <div className="flex items-start justify-between mb-8 gap-3">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold">Turnos</h1>
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
              <DialogHeader><DialogTitle>Nuevo Turno</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Paciente <span className="text-red-400">*</span></label>
                  <select
                    aria-label="Paciente" autoFocus
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
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Fecha <span className="text-red-400">*</span></label>
                  <input
                    type="date" aria-label="Fecha del turno" min={today}
                    className={`border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.date ? "border-red-500" : ""}`}
                    value={date}
                    onChange={(e) => { setDate(e.target.value); setTime(""); if (errors.date) setErrors(p => ({ ...p, date: undefined })) }}
                  />
                  {errors.date && <p className="text-red-500 text-sm">{errors.date}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Horario <span className="text-red-400">*</span></label>
                  <SlotPicker
                    date={date}
                    appointments={appointments}
                    value={time}
                    onChange={(t) => { setTime(t); if (errors.time) setErrors(p => ({ ...p, time: undefined })) }}
                  />
                  {errors.time && <p className="text-red-500 text-sm">{errors.time}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Notas</label>
                  <input
                    type="text" placeholder="Notas adicionales..." aria-label="Notas del turno"
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

      <ErrorBanner
        message={isError ? "No se pudieron cargar los turnos. Verificá tu conexión." : ""}
        onClose={() => queryClient.resetQueries({ queryKey: ["appointments"] })}
      />

      {view === "calendar" && (
        <WeeklyCalendarView
          appointments={appointments}
          onEditAppointment={openEditForm}
          onUpdateStatus={updateStatus}
          onDeleteAppointment={(id) => setDeletingAppointmentId(id)}
          updatingStatusId={updatingStatusId}
          onSlotClick={handleSlotClick}
        />
      )}

      {view === "list" && (
        <>
          <Card className="p-4 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex gap-3 flex-wrap">

              <div className="flex flex-col gap-1 flex-1 min-w-36">
                <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide px-0.5">Paciente</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text" placeholder="Buscar paciente..." aria-label="Buscar por nombre de paciente"
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
                  <option value="">Todos (sin completados)</option>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1 flex-1 min-w-36">
                <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide px-0.5">Fecha</span>
                <input
                  type="date" aria-label="Filtrar por fecha"
                  className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  value={filterDate}
                  onChange={(e) => { setFilterDate(e.target.value); setCurrentPage(1) }}
                />
              </div>

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
                      variant="ghost" size="icon" className="h-10 w-10 text-gray-400 hover:text-black dark:hover:text-white"
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
              const isPast   = appointment.appointment_date < today
              const isToday  = appointment.appointment_date === today
              const isMissed = isPast && (appointment.status === "Pendiente" || appointment.status === "Confirmado")

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
                        {formatDate(appointment.appointment_date)}{" — "}{appointment.appointment_time}
                      </p>
                    </div>
                    <select
                      aria-label={`Estado del turno de ${appointment.patients?.first_name} ${appointment.patients?.last_name}`}
                      className={`shrink-0 px-3 py-2.5 rounded-xl text-xs border font-medium outline-none ${getStatusStyles(pendingCompletadoId === appointment.id ? "Completado" : appointment.status)} disabled:opacity-50`}
                      value={pendingCompletadoId === appointment.id ? "Completado" : appointment.status}
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
                        variant="ghost" size="icon"
                        className="h-10 w-10 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        onClick={() => openEditForm(appointment)} aria-label="Editar turno"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-10 w-10 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        onClick={() => setDeletingAppointmentId(appointment.id)} aria-label="Eliminar turno"
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
              <Button variant="outline" size="icon" className="h-11 w-11" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} aria-label="Página anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-500 min-w-[60px] text-center">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-11 w-11" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} aria-label="Página siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

    </div>
  )
}

export default Appointments
