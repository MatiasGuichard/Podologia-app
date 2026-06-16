import { useEffect, useState } from "react"
import {
  Loader2, CalendarOff, Search, Trash2, ChevronLeft, ChevronRight,
  X, Pencil, LayoutList, CalendarDays, Lock,
  Play, UserCheck, XCircle, User, CheckCircle2,
} from "lucide-react"
import { Link } from "react-router-dom"

import { supabase } from "../lib/supabase"
import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog"
import type { Patient, Appointment } from "../types"
import Toast from "../components/Toast"
import ConfirmDialog from "../components/ConfirmDialog"
import ConsultationDialog from "../components/ConsultationDialog"
import ErrorBanner from "../components/ErrorBanner"
import { getStatusStyles } from "../lib/statusStyles"
import { formatDate } from "../lib/dateUtils"
import { useToast } from "../hooks/useToast"
import { useDebounce } from "../hooks/useDebounce"
import { loadSettings } from "./Settings"

const ITEMS_PER_PAGE = 10
const STATUS_OPTIONS = ["Pendiente", "Confirmado", "En atención", "Completado", "Cancelado", "No vino"]

// ── Slot helpers ───────────────────────────────────────────────────────────────

function generateSlots(start: string, end: string): string[] {
  const slots: string[] = []
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  let mins = sh * 60 + sm
  const endMins = eh * 60 + em
  while (mins < endMins) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
    mins += 15
  }
  return slots
}

function getSlotStates(
  slots: string[],
  bookedTimes: string[]
): Record<string, "free" | "occupied" | "blocked"> {
  const states: Record<string, "free" | "occupied" | "blocked"> = {}
  for (const s of slots) states[s] = "free"
  for (const raw of bookedTimes) {
    const t = raw.slice(0, 5)
    if (states[t] !== undefined) states[t] = "occupied"
    const [h, m] = t.split(":").map(Number)
    const base = h * 60 + m
    for (const offset of [15, 30]) {
      const bm = base + offset
      const key = `${String(Math.floor(bm / 60)).padStart(2, "0")}:${String(bm % 60).padStart(2, "0")}`
      if (states[key] === "free") states[key] = "blocked"
    }
  }
  return states
}

// ── SlotPicker ─────────────────────────────────────────────────────────────────

function SlotPicker({
  date,
  appointments,
  value,
  onChange,
  excludeId,
}: {
  date: string
  appointments: Appointment[]
  value: string
  onChange: (t: string) => void
  excludeId?: string
}) {
  const s = loadSettings()
  const workStart = s.workStart || "08:00"
  const workEnd   = s.workEnd   || "20:00"

  if (!date) {
    return (
      <p className="border rounded-lg p-4 text-center text-sm text-gray-400 dark:text-zinc-500 dark:border-zinc-700">
        Seleccioná una fecha para ver los horarios disponibles
      </p>
    )
  }

  const slots = generateSlots(workStart, workEnd)
  const bookedTimes = appointments
    .filter(a => a.appointment_date === date && a.id !== excludeId && a.status !== "Cancelado")
    .map(a => a.appointment_time)
  const states = getSlotStates(slots, bookedTimes)
  const sel = value.slice(0, 5)

  const todayStr = new Date().toISOString().split("T")[0]
  const isToday  = date === todayStr
  const nowMins  = new Date().getHours() * 60 + new Date().getMinutes()

  return (
    <div className="border rounded-lg p-3 dark:border-zinc-700">
      <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto">
        {slots.map(slot => {
          const state = states[slot]
          const isSelected = sel === slot
          const [sh, sm] = slot.split(":").map(Number)
          const isPast = isToday && (sh * 60 + sm) < nowMins
          const disabled = !isSelected && (state !== "free" || isPast)
          return (
            <button
              key={slot}
              type="button"
              disabled={disabled}
              onClick={() => onChange(slot)}
              title={
                isPast           ? "Horario ya pasado" :
                state === "occupied" ? "Turno ocupado" :
                state === "blocked"  ? "Bloqueado — turno en curso" :
                undefined
              }
              className={`flex items-center justify-center gap-0.5 py-2 rounded-lg text-xs font-medium border transition-colors
                ${isSelected
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                  : isPast
                    ? "bg-gray-50 dark:bg-zinc-800/40 text-gray-300 dark:text-zinc-700 border-gray-100 dark:border-zinc-800 cursor-not-allowed line-through"
                    : state === "occupied"
                      ? "bg-gray-100 dark:bg-zinc-700/50 text-gray-400 border-gray-200 dark:border-zinc-700 cursor-not-allowed"
                      : state === "blocked"
                        ? "bg-gray-50 dark:bg-zinc-800 text-gray-300 dark:text-zinc-600 border-gray-100 dark:border-zinc-800 cursor-not-allowed"
                        : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-zinc-500 cursor-pointer"
                }`}
            >
              {slot}{state === "blocked" && !isPast && <Lock className="h-2.5 w-2.5 ml-0.5 shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

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

  const [errors, setErrors] = useState<{ patientId?: string; date?: string; time?: string }>({})

  // ─── Consultation dialog state ────────────────────────────────────────────
  const [consultingAppointment, setConsultingAppointment] = useState<Appointment | null>(null)

  async function getPatients() {
    const { data, error } = await supabase.from("patients").select("*").order("first_name")
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
    if (date && time) {
      const nowDate = new Date().toISOString().split("T")[0]
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
    getAppointments()
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
    getAppointments()
  }

  async function confirmDeleteAppointment() {
    if (!deletingAppointmentId) return
    const idToDelete = deletingAppointmentId
    setDeletingAppointmentId(null)
    setAppointments(prev => prev.filter(a => a.id !== idToDelete))
    const { error } = await supabase.from("appointments").delete().eq("id", idToDelete)
    if (error) {
      showToast("No se pudo eliminar el turno.", "error")
      getAppointments()
    } else {
      showToast("Turno eliminado.", "success")
    }
  }

  async function updateStatus(appointmentId: string, newStatus: string) {
    if (newStatus === "Completado") {
      const appt = appointments.find(a => a.id === appointmentId)
      if (appt && appt.status !== "Completado") { openConsultDialog(appt); return }
      return
    }
    setUpdatingStatusId(appointmentId)
    setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a))
    const { error } = await supabase.from("appointments").update({ status: newStatus }).eq("id", appointmentId)
    setUpdatingStatusId(null)
    if (error) { showToast("No se pudo actualizar el estado.", "error"); getAppointments(); return }
    getAppointments()
  }

  function openConsultDialog(appointment: Appointment) {
    setConsultingAppointment(appointment)
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

      <ConfirmDialog
        open={deletingAppointmentId !== null}
        title="¿Eliminar este turno?"
        description="Esta acción no se puede deshacer."
        onConfirm={confirmDeleteAppointment}
        onCancel={() => setDeletingAppointmentId(null)}
      />

      {/* Edit dialog */}
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
                type="date"
                aria-label="Fecha del turno"
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
                type="text"
                placeholder="Notas adicionales..."
                aria-label="Notas del turno"
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
        onClose={() => setConsultingAppointment(null)}
        onSaved={getAppointments}
      />

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
                    type="date" aria-label="Fecha del turno"
                    min={today}
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

      <ErrorBanner message={errorMessage} onClose={() => setErrorMessage("")} />

      {/* ── CALENDAR VIEW ── */}
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

      {/* ── LIST VIEW ── */}
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
                  <option value="">Todos los estados</option>
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
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        onClick={() => openEditForm(appointment)} aria-label="Editar turno"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
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
              <Button variant="outline" size="icon" className="h-9 w-9" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} aria-label="Página anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-500 min-w-[60px] text-center">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-9 w-9" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} aria-label="Página siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

    </div>
  )
}

// ── WeeklyCalendarView ────────────────────────────────────────────────────────

const SLOT_HEIGHT = 40 // px per 15-min slot
const APT_HEIGHT  = SLOT_HEIGHT * 3 // 45-min appointment spans 3 slots

type WeeklyCalendarViewProps = {
  appointments: Appointment[]
  onEditAppointment: (appointment: Appointment) => void
  onUpdateStatus: (id: string, status: string) => void
  onDeleteAppointment: (id: string) => void
  updatingStatusId: string | null
  onSlotClick: (date: string, time: string) => void
}

function WeeklyCalendarView({ appointments, onEditAppointment, onUpdateStatus, onDeleteAppointment, updatingStatusId, onSlotClick }: WeeklyCalendarViewProps) {
  const today = new Date().toISOString().split("T")[0]
  const nowMinsCalendar = new Date().getHours() * 60 + new Date().getMinutes()

  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    d.setHours(0, 0, 0, 0)
    return d
  })

  const [activeApt, setActiveApt] = useState<Appointment | null>(null)

  const s = loadSettings()
  const workStart = s.workStart || "08:00"
  const workEnd   = s.workEnd   || "20:00"
  const slots = generateSlots(workStart, workEnd)
  const totalHeight = slots.length * SLOT_HEIGHT

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }

  const isCurrentWeek = (() => {
    const now = new Date()
    const day = now.getDay()
    const mon = new Date(now)
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    mon.setHours(0, 0, 0, 0)
    return weekStart.getTime() === mon.getTime()
  })()

  function prevWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d)
  }
  function nextWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d)
  }
  function goToday() {
    const d = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    d.setHours(0, 0, 0, 0)
    setWeekStart(d)
  }

  function slotTop(time: string): number {
    const [th, tm] = time.slice(0, 5).split(":").map(Number)
    const [wh, wm] = workStart.split(":").map(Number)
    return ((th * 60 + tm) - (wh * 60 + wm)) / 15 * SLOT_HEIGHT
  }

  function aptColor(apt: Appointment): string {
    const isPast   = apt.appointment_date < today
    const isMissed = isPast && (apt.status === "Pendiente" || apt.status === "Confirmado")
    if (isMissed)                       return "bg-orange-100 border-l-[3px] border-orange-400 text-orange-900 dark:bg-orange-950/60 dark:text-orange-200"
    if (apt.status === "No vino")       return "bg-orange-100 border-l-[3px] border-orange-400 text-orange-900 dark:bg-orange-950/60 dark:text-orange-200"
    if (apt.status === "Completado")    return "bg-emerald-200 border-l-[3px] border-emerald-600 text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-100"
    if (apt.status === "Confirmado")    return "bg-green-100 border-l-[3px] border-green-400 text-green-900 dark:bg-green-950/60 dark:text-green-200"
    if (apt.status === "En atención")   return "bg-violet-100 border-l-[3px] border-violet-400 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200"
    if (apt.status === "Cancelado")     return "bg-red-100 border-l-[3px] border-red-400 text-red-900 dark:bg-red-950/60 dark:text-red-200 opacity-60"
    return "bg-yellow-100 border-l-[3px] border-yellow-400 text-yellow-900 dark:bg-yellow-950/60 dark:text-yellow-200"
  }

  const weekLabel = (() => {
    const s2 = weekDays[0], e = weekDays[6]
    const same = s2.getMonth() === e.getMonth()
    return `${s2.toLocaleDateString("es-AR", same ? { day: "numeric" } : { day: "numeric", month: "short" })} – ${e.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`
  })()

  const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
  const TIME_COL_W = 52

  function aptStatusBadge(status: string): { label: string; cls: string } {
    switch (status) {
      case "Confirmado":  return { label: "Confirmado",    cls: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" }
      case "En atención": return { label: "En atención",   cls: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" }
      case "Completado":  return { label: "Completado",    cls: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100" }
      case "Cancelado":   return { label: "Cancelado",     cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" }
      case "No vino":     return { label: "No vino",       cls: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" }
      default:            return { label: "Sin confirmar", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300" }
    }
  }

  function fmtPopupDate(date: string, time: string): string {
    const d = new Date(date + "T12:00:00")
    return `${d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })} · ${time.slice(0, 5)}`
  }

  return (
    <Card className="mb-6 dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden">

      {/* Week navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-800">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevWeek} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextWeek} aria-label="Semana siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <button onClick={goToday} className="ml-1 text-xs text-gray-400 hover:text-black dark:hover:text-white border border-gray-200 dark:border-zinc-700 rounded-md px-2 py-1 transition-colors">
              Hoy
            </button>
          )}
        </div>
        <span className="text-sm font-semibold capitalize">{weekLabel}</span>
        <div style={{ width: 80 }} />
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 620 }}>

          {/* Day header row */}
          <div className="flex border-b dark:border-zinc-800">
            <div style={{ width: TIME_COL_W, flexShrink: 0 }} />
            {weekDays.map((d, i) => {
              const ds = toDateStr(d)
              const isToday = ds === today
              return (
                <div key={ds} className={`flex-1 text-center py-2 ${i > 0 ? "border-l dark:border-zinc-800" : ""}`}>
                  <p className="text-xs font-medium text-gray-400 dark:text-zinc-500">{DAY_NAMES[i]}</p>
                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold mt-0.5
                    ${isToday ? "bg-emerald-500 text-white" : "text-gray-700 dark:text-zinc-200"}
                  `}>
                    {d.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Scrollable grid */}
          <div style={{ height: 540, overflowY: "auto" }}>
            <div style={{ display: "flex", height: totalHeight }}>

              {/* Time labels */}
              <div style={{ width: TIME_COL_W, flexShrink: 0, position: "relative" }}>
                {slots.map((slot, i) => (
                  slot.endsWith(":00") ? (
                    <div
                      key={slot}
                      style={{ position: "absolute", top: i * SLOT_HEIGHT, width: "100%", height: SLOT_HEIGHT }}
                      className="flex items-start justify-end pr-2 pt-0.5"
                    >
                      <span className="text-[10px] text-gray-400 dark:text-zinc-600 font-medium select-none leading-none">
                        {slot}
                      </span>
                    </div>
                  ) : null
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((d, colIdx) => {
                const ds = toDateStr(d)
                const allDayApts = appointments.filter(a => a.appointment_date === ds)
                const activeApts = allDayApts.filter(a => a.status !== "Cancelado")
                const states = getSlotStates(slots, activeApts.map(a => a.appointment_time))

                return (
                  <div
                    key={ds}
                    style={{ flex: 1, position: "relative", height: totalHeight }}
                    className={colIdx > 0 ? "border-l dark:border-zinc-800" : ""}
                  >
                    {/* Slot backgrounds */}
                    {slots.map((slot, slotIdx) => {
                      const state = states[slot]
                      const isHour     = slot.endsWith(":00")
                      const isHalfHour = slot.endsWith(":30")
                      const isFree     = state === "free"
                      const isBlocked  = state === "blocked"
                      const [sh, sm]   = slot.split(":").map(Number)
                      const isPastSlot = ds < today || (ds === today && (sh * 60 + sm) < nowMinsCalendar)
                      const canClick   = isFree && !isPastSlot

                      return (
                        <div
                          key={slot}
                          style={{ position: "absolute", top: slotIdx * SLOT_HEIGHT, height: SLOT_HEIGHT, left: 0, right: 0 }}
                          className={[
                            isHour     ? "border-t border-gray-200 dark:border-zinc-700/70" :
                            isHalfHour ? "border-t border-gray-100 dark:border-zinc-800/80" :
                                         "border-t border-gray-50 dark:border-zinc-800/40",
                            canClick  ? "hover:bg-emerald-50 dark:hover:bg-emerald-950/20 cursor-pointer transition-colors" : "",
                            isBlocked ? "bg-gray-100/70 dark:bg-zinc-700/20 cursor-not-allowed" : "",
                            isPastSlot && isFree ? "bg-gray-50/80 dark:bg-zinc-800/20" : "",
                          ].join(" ")}
                          onClick={canClick ? () => onSlotClick(ds, slot) : undefined}
                        />
                      )
                    })}

                    {/* Appointment blocks (all including cancelled) */}
                    {allDayApts.map((apt) => {
                      const top = slotTop(apt.appointment_time)
                      if (top < 0 || top >= totalHeight) return null
                      return (
                        <div
                          key={apt.id}
                          style={{
                            position: "absolute",
                            top: top + 1,
                            height: APT_HEIGHT - 2,
                            left: 2,
                            right: 2,
                            zIndex: 10,
                          }}
                          className={`group rounded-md overflow-hidden cursor-pointer ${aptColor(apt)}`}
                          onClick={() => setActiveApt(apt)}
                        >
                          <div className="px-1.5 py-1">
                            <p className="text-[11px] font-semibold leading-tight truncate">
                              {apt.patients?.first_name} {apt.patients?.last_name}
                            </p>
                            <p className="text-[10px] opacity-60 leading-tight mt-0.5">
                              {apt.appointment_time.slice(0, 5)}
                            </p>
                          </div>
                          {/* Pendiente → Confirmar + No vino */}
                          {apt.status === "Pendiente" && (
                            <div
                              style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
                              className="flex opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <button
                                className="flex-1 flex items-center justify-center py-1 bg-black/8 hover:bg-green-500/25 dark:bg-white/8 dark:hover:bg-green-500/25 transition-colors"
                                onClick={(e) => { e.stopPropagation(); onUpdateStatus(apt.id, "Confirmado") }}
                                title="Confirmar"
                                disabled={updatingStatusId === apt.id}
                              >
                                <UserCheck className="h-3 w-3 text-green-700 dark:text-green-400" />
                              </button>
                              <button
                                className="flex-1 flex items-center justify-center py-1 bg-black/8 hover:bg-gray-500/20 dark:bg-white/8 dark:hover:bg-gray-500/20 border-l border-black/10 dark:border-white/10 transition-colors"
                                onClick={(e) => { e.stopPropagation(); onUpdateStatus(apt.id, "No vino") }}
                                title="No vino"
                                disabled={updatingStatusId === apt.id}
                              >
                                <XCircle className="h-3 w-3 text-gray-600 dark:text-zinc-400" />
                              </button>
                            </div>
                          )}
                          {/* Confirmado → Iniciar + No vino */}
                          {apt.status === "Confirmado" && (
                            <div
                              style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
                              className="flex opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <button
                                className="flex-1 flex items-center justify-center py-1 bg-black/8 hover:bg-violet-500/25 dark:bg-white/8 dark:hover:bg-violet-500/25 transition-colors"
                                onClick={(e) => { e.stopPropagation(); onUpdateStatus(apt.id, "En atención") }}
                                title="Iniciar atención"
                                disabled={updatingStatusId === apt.id}
                              >
                                <Play className="h-3 w-3 text-violet-700 dark:text-violet-400" />
                              </button>
                              <button
                                className="flex-1 flex items-center justify-center py-1 bg-black/8 hover:bg-gray-500/20 dark:bg-white/8 dark:hover:bg-gray-500/20 border-l border-black/10 dark:border-white/10 transition-colors"
                                onClick={(e) => { e.stopPropagation(); onUpdateStatus(apt.id, "No vino") }}
                                title="No vino"
                                disabled={updatingStatusId === apt.id}
                              >
                                <XCircle className="h-3 w-3 text-gray-600 dark:text-zinc-400" />
                              </button>
                            </div>
                          )}
                          {/* En atención → solo Completado */}
                          {apt.status === "En atención" && (
                            <div
                              style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
                              className="flex opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <button
                                className="flex-1 flex items-center justify-center py-1 bg-black/8 hover:bg-emerald-500/25 dark:bg-white/8 dark:hover:bg-emerald-500/25 transition-colors"
                                onClick={(e) => { e.stopPropagation(); onUpdateStatus(apt.id, "Completado") }}
                                title="Completado"
                                disabled={updatingStatusId === apt.id}
                              >
                                <CheckCircle2 className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}

            </div>
          </div>

        </div>
      </div>
      {activeApt && (
        <Dialog open onOpenChange={(v) => { if (!v) setActiveApt(null) }}>
          <DialogContent className="max-w-[280px] p-0 overflow-hidden gap-0">
            <DialogTitle className="sr-only">
              Turno — {activeApt.patients?.first_name} {activeApt.patients?.last_name}
            </DialogTitle>
            <div className="p-4 pb-3">
              <p className="font-bold text-base leading-tight">
                {activeApt.patients?.first_name} {activeApt.patients?.last_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                45m · {fmtPopupDate(activeApt.appointment_date, activeApt.appointment_time)}
              </p>
              <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${aptStatusBadge(activeApt.status).cls}`}>
                {aptStatusBadge(activeApt.status).label}
              </span>
              {activeApt.notes && (
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 leading-relaxed">{activeApt.notes}</p>
              )}
            </div>
            <div className="border-t dark:border-zinc-800 p-3 flex flex-col gap-1.5">
              <button
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-950/60 transition-colors text-left"
                onClick={() => { onUpdateStatus(activeApt.id, "Confirmado"); setActiveApt(null) }}
              >
                <UserCheck className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">Confirmar turno</span>
              </button>
              <button
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-950/60 transition-colors text-left"
                onClick={() => { onUpdateStatus(activeApt.id, "En atención"); setActiveApt(null) }}
              >
                <Play className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">Iniciar atención</span>
              </button>
              <button
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors text-left"
                onClick={() => { onUpdateStatus(activeApt.id, "No vino"); setActiveApt(null) }}
              >
                <XCircle className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">No vino</span>
              </button>
            </div>
            <div className="border-t dark:border-zinc-800 p-3 flex flex-col gap-0.5">
              <Link
                to={`/patients/${activeApt.patient_id}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                onClick={() => setActiveApt(null)}
              >
                <User className="h-4 w-4 shrink-0" />
                <span className="text-sm">Ver ficha del paciente</span>
              </Link>
              <button
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors w-full text-left"
                onClick={() => { setActiveApt(null); onEditAppointment(activeApt) }}
              >
                <Pencil className="h-4 w-4 shrink-0" />
                <span className="text-sm">Editar turno</span>
              </button>
              <button
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors w-full text-left"
                onClick={() => { setActiveApt(null); onDeleteAppointment(activeApt.id) }}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span className="text-sm">Eliminar turno</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}

export default Appointments
