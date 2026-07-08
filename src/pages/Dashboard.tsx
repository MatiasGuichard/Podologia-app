import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Users, ClipboardList, CalendarDays, CalendarCheck2, DollarSign, Loader2, Play } from "lucide-react"
import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog"
import { supabase } from "../lib/supabase"
import { parseMontoPositivo, parseMonto } from "../lib/montoUtils"
import { calcularEstadoCobro } from "../lib/cobroUtils"
import { loadSettings } from "../lib/settings"
import { fmt } from "../lib/currencyUtils"
import type { Appointment, Cobro } from "../types"
import { formatDate, todayStr } from "../lib/dateUtils"
import ErrorBanner from "../components/ErrorBanner"
import ConsultationDialog from "../components/ConsultationDialog"
import ConfirmDialog from "../components/ConfirmDialog"
import { completarTurnoSiCorresponde, finalizarTurnoSinCompletar } from "../lib/turnoCompletion"
import { isBeforeScheduledTime, nowTimeLabel } from "../lib/turnoTiming"
import { usePatients } from "../hooks/usePatients"
import { useAppointments } from "../hooks/useAppointments"
import { SlotPicker } from "../components/SlotPicker"
import { useToast } from "../hooks/useToast"
import Toast from "../components/Toast"

async function fetchDashboardStats() {
  const today = todayStr()
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

  const [patientsRes, todayRes, inAttentionRes, completedMonthRes, pastUnresolvedRes] =
    await Promise.all([
      supabase.from("patients").select("*", { count: "exact", head: true }),
      supabase
        .from("appointments")
        .select("*, patients(first_name, last_name)")
        .eq("appointment_date", today)
        .order("appointment_time", { ascending: true }),
      supabase
        .from("appointments")
        .select("*, patients(first_name, last_name)")
        .eq("appointment_date", today)
        .eq("status", "En atención")
        .order("appointment_time", { ascending: true })
        .limit(1),
      supabase
        .from("appointments")
        .select("*, patients(first_name, last_name)")
        .gte("appointment_date", monthStart)
        .lte("appointment_date", monthEnd)
        .eq("status", "Completado")
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false }),
      supabase
        .from("appointments")
        .select("*, patients(first_name, last_name)")
        .lt("appointment_date", today)
        .in("status", ["Pendiente", "Confirmado"])
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false }),
    ])

  if (patientsRes.error || todayRes.error || inAttentionRes.error || completedMonthRes.error || pastUnresolvedRes.error) {
    throw new Error("No se pudieron cargar las estadísticas.")
  }

  const inAttentionNow = (inAttentionRes.data?.[0] ?? null) as Appointment | null

  const [inAttentionRecordRes, inAttentionCobroRes] = inAttentionNow
    ? await Promise.all([
        supabase.from("medical_records").select("id").eq("turno_id", inAttentionNow.id).limit(1),
        supabase.from("cobros").select("id").eq("turno_id", inAttentionNow.id).limit(1),
      ])
    : [null, null]

  const completedMonth = (completedMonthRes.data ?? []) as Appointment[]
  const completedMonthIds = completedMonth.map(a => a.id)

  const cobrosMonthRes = completedMonthIds.length > 0
    ? await supabase.from("cobros").select("*, patients(first_name, last_name)").in("turno_id", completedMonthIds)
    : null

  const todayAppointments = (todayRes.data ?? []) as Appointment[]
  const todayPendingConfirmed = todayAppointments.filter(
    (a) => a.status === "Pendiente" || a.status === "Confirmado"
  )

  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  const todayOverdue = todayPendingConfirmed.filter((a) => a.appointment_time.slice(0, 5) < nowTime)

  return {
    patientsCount:        patientsRes.count ?? 0,
    todayCount:           todayAppointments.length,
    todayPendingConfirmed,
    inAttentionNow,
    inAttentionHasRecord: (inAttentionRecordRes?.data?.length ?? 0) > 0,
    inAttentionHasCobro:  (inAttentionCobroRes?.data?.length ?? 0) > 0,
    completedMonth,
    cobrosMonth:          (cobrosMonthRes?.error ? [] : cobrosMonthRes?.data ?? []) as Cobro[],
    unresolvedAppointments: [...todayOverdue, ...(pastUnresolvedRes.data ?? [])] as Appointment[],
  }
}

function Dashboard() {
  const queryClient = useQueryClient()

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ["dashboard", todayStr()],
    queryFn: fetchDashboardStats,
    staleTime: 0,
  })

  const { data: patients = [] } = usePatients()
  const { data: allAppointments = [] } = useAppointments()
  const { toast, showToast, clearToast } = useToast()

  const patientsCount        = stats?.patientsCount        ?? 0
  const todayCount           = stats?.todayCount           ?? 0
  const todayPendingConfirmed = stats?.todayPendingConfirmed ?? []
  const inAttentionNow       = stats?.inAttentionNow       ?? null
  const inAttentionHasRecord = stats?.inAttentionHasRecord ?? false
  const inAttentionHasCobro  = stats?.inAttentionHasCobro  ?? false
  const completedMonth       = stats?.completedMonth       ?? []
  const cobrosMonth          = stats?.cobrosMonth          ?? []
  const unresolvedAppointments = stats?.unresolvedAppointments ?? []

  const todayCompleted = [...completedMonth]
    .filter((a) => a.appointment_date === todayStr())
    .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))

  const completedMonthByDay = (() => {
    const byDate = new Map<string, Appointment[]>()
    for (const apt of completedMonth) {
      const list = byDate.get(apt.appointment_date) ?? []
      list.push(apt)
      byDate.set(apt.appointment_date, list)
    }
    return Array.from(byDate.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, appts]) => {
        const sorted = [...appts].sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
        const cobrosDelDia = sorted.map(apt => cobrosMonth.find(c => c.turno_id === apt.id) ?? null)
        const totalCobrado = cobrosDelDia.reduce((sum, c) => sum + (c?.monto_entregado ?? 0), 0)
        const hasUncollected = cobrosDelDia.some(c => !c || c.estado === "pendiente")
        const hasPartial = cobrosDelDia.some(c => c?.estado === "parcial")
        const label = formatDate(date, { weekday: "long", day: "numeric", month: "long" })
          .replace(/^\w/, (c) => c.toUpperCase())
        return {
          date,
          label,
          appointments: sorted,
          totalCobrado,
          alertColor: hasUncollected ? "orange" as const : hasPartial ? "yellow" as const : null,
        }
      })
  })()

  const [elapsedMin, setElapsedMin] = useState(0)
  const [actionError, setActionError] = useState("")

  // Consultation dialog
  const [consultingAppointment, setConsultingAppointment] = useState<Appointment | null>(null)
  const [isStartingApt, setIsStartingApt] = useState(false)

  // Cobro modal
  const [cobroAppointment, setCobroAppointment] = useState<Appointment | null>(null)
  const [cobroMontoTotal, setCobroMontoTotal] = useState("")
  const [cobroMontoEntregado, setCobroMontoEntregado] = useState("")
  const [cobroMetodo, setCobroMetodo] = useState("Efectivo")
  const [cobroDescripcion, setCobroDescripcion] = useState("")
  const [cobroError, setCobroError] = useState("")
  const [isSubmittingCobro, setIsSubmittingCobro] = useState(false)

  // Finalizar sin completar
  const [finalizingTurno, setFinalizingTurno] = useState<Appointment | null>(null)
  const [isFinalizing, setIsFinalizing] = useState(false)

  // Alerta al iniciar un turno antes de horario
  const [earlyStartInfo, setEarlyStartInfo] = useState<{ appointment: Appointment; nowLabel: string } | null>(null)
  const [isConfirmingEarlyStart, setIsConfirmingEarlyStart] = useState(false)

  // Completados del mes
  const [completadosMesOpen, setCompletadosMesOpen] = useState(false)

  // Turnos sin resolver (de hoy ya vencidos o de días anteriores)
  const unresolvedAlertDismissKey = `unresolvedAppointmentsDismissed_${todayStr()}`
  const [unresolvedAlertDismissed, setUnresolvedAlertDismissed] = useState(
    () => localStorage.getItem(unresolvedAlertDismissKey) === "1"
  )
  const [resolvingPastId, setResolvingPastId] = useState<string | null>(null)
  const [isResolvingAllPast, setIsResolvingAllPast] = useState(false)

  // Reagendar turno sin resolver
  const [reagendandoApt, setReagendandoApt] = useState<Appointment | null>(null)
  const [reagendarPatientId, setReagendarPatientId] = useState("")
  const [reagendarDate, setReagendarDate] = useState("")
  const [reagendarTime, setReagendarTime] = useState("")
  const [reagendarNotes, setReagendarNotes] = useState("")
  const [reagendarError, setReagendarError] = useState("")
  const [isReagendando, setIsReagendando] = useState(false)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  }

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "cobros" }, invalidate)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Elapsed time for "En atención"
  useEffect(() => {
    if (!inAttentionNow) { setElapsedMin(0); return }
    const today = todayStr()
    const start = new Date(today + "T" + inAttentionNow.appointment_time).getTime()
    const calc = () => Math.max(0, Math.floor((Date.now() - start) / 60_000))
    setElapsedMin(calc())
    const id = setInterval(() => setElapsedMin(calc()), 30_000)
    return () => clearInterval(id)
  }, [inAttentionNow])

  function openCobroModal(apt: Appointment) {
    const fecha = new Date(apt.appointment_date + "T12:00:00")
      .toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
    const defaultPrice = loadSettings().consultationPrice
    setCobroAppointment(apt)
    setCobroMontoTotal(defaultPrice)
    setCobroMontoEntregado(defaultPrice)
    setCobroMetodo("Efectivo")
    setCobroDescripcion(`Consulta · ${apt.patients?.first_name} ${apt.patients?.last_name} · ${fecha}`)
    setCobroError("")
  }

  async function confirmarCobro() {
    if (!cobroAppointment) return
    const totalNum = parseMontoPositivo(cobroMontoTotal)
    const entregadoNum = parseMonto(cobroMontoEntregado)

    if (totalNum === null) { setCobroError("Ingresá el monto total de la consulta"); return }
    if (entregadoNum === null) { setCobroError("Ingresá el monto entregado"); return }
    if (entregadoNum > totalNum) { setCobroError("El monto entregado no puede superar el total"); return }

    setIsSubmittingCobro(true)
    const today = todayStr()

    const { data: existingCobro, error: existingError } = await supabase
      .from("cobros")
      .select("id")
      .eq("turno_id", cobroAppointment.id)
      .limit(1)

    if (existingError) console.error("[cobros] Error al verificar cobro existente:", existingError)

    if (existingCobro && existingCobro.length > 0) {
      setCobroError("Este turno ya tiene un cobro registrado. Usá el botón de Pago Adicional para registrar otro pago.")
      setIsSubmittingCobro(false)
      return
    }

    const estado = calcularEstadoCobro(totalNum, entregadoNum)

    const { error: insertError } = await supabase.from("cobros").insert({
      paciente_id: cobroAppointment.patient_id,
      turno_id: cobroAppointment.id,
      monto: entregadoNum,
      monto_total: totalNum,
      monto_entregado: entregadoNum,
      fecha: today,
      estado,
      descripcion: cobroDescripcion || null,
      metodo_pago: cobroMetodo,
    })

    if (insertError) {
      setIsSubmittingCobro(false)
      setCobroError(
        insertError.code === "42P01"
          ? "La tabla de cobros no existe. Ejecutá la migración SQL primero."
          : "No se pudo registrar el cobro."
      )
      return
    }

    await completarTurnoSiCorresponde(cobroAppointment.id)
    setIsSubmittingCobro(false)
    setCobroAppointment(null)
    invalidate()
  }

  async function confirmFinalizarSinCompletar() {
    if (!finalizingTurno) return
    setIsFinalizing(true)
    const { error } = await finalizarTurnoSinCompletar(finalizingTurno.id)
    setIsFinalizing(false)
    if (error) { setActionError("No se pudo finalizar el turno."); return }
    setFinalizingTurno(null)
    invalidate()
  }

  async function applyIniciar(apt: Appointment) {
    setIsStartingApt(true)
    const { error } = await supabase.from("appointments").update({ status: "En atención" }).eq("id", apt.id)
    setIsStartingApt(false)
    if (error) {
      console.error("[dashboard] Error al iniciar turno:", error)
      setActionError("No se pudo iniciar el turno. Verificá tu conexión.")
    } else {
      invalidate()
    }
  }

  function iniciarTurno(apt: Appointment) {
    if (isBeforeScheduledTime(apt)) {
      setEarlyStartInfo({ appointment: apt, nowLabel: nowTimeLabel() })
      return
    }
    applyIniciar(apt)
  }

  async function confirmEarlyStart() {
    if (!earlyStartInfo) return
    setIsConfirmingEarlyStart(true)
    await applyIniciar(earlyStartInfo.appointment)
    setIsConfirmingEarlyStart(false)
    setEarlyStartInfo(null)
  }

  function dismissUnresolvedAlert() {
    localStorage.setItem(unresolvedAlertDismissKey, "1")
    setUnresolvedAlertDismissed(true)
  }

  async function marcarFalto(id: string) {
    setResolvingPastId(id)
    const { error } = await supabase.from("appointments").update({ status: "No vino" }).eq("id", id)
    setResolvingPastId(null)
    if (error) {
      console.error("[dashboard] Error al marcar turno pasado como Faltó:", error)
      setActionError("No se pudo actualizar el turno.")
      return
    }
    invalidate()
  }

  async function marcarTodosFalto() {
    setIsResolvingAllPast(true)
    const ids = unresolvedAppointments.map((a) => a.id)
    const { error } = await supabase.from("appointments").update({ status: "No vino" }).in("id", ids)
    setIsResolvingAllPast(false)
    if (error) {
      console.error("[dashboard] Error al marcar turnos pasados como Faltó:", error)
      setActionError("No se pudieron actualizar los turnos.")
      return
    }
    invalidate()
  }

  function openReagendarDialog(apt: Appointment) {
    setReagendandoApt(apt)
    setReagendarPatientId(apt.patient_id ?? "")
    setReagendarDate("")
    setReagendarTime("")
    setReagendarNotes(apt.notes ?? "")
    setReagendarError("")
  }

  async function confirmReagendar() {
    if (!reagendandoApt) return
    if (!reagendarPatientId) { setReagendarError("Seleccioná un paciente"); return }
    if (!reagendarDate)      { setReagendarError("La fecha es obligatoria"); return }
    if (!reagendarTime)      { setReagendarError("El horario es obligatorio"); return }

    setIsReagendando(true)

    const { data: existing } = await supabase
      .from("appointments").select("id")
      .eq("appointment_date", reagendarDate).eq("appointment_time", reagendarTime)
      .neq("status", "Cancelado").limit(1)

    if (existing && existing.length > 0) {
      setReagendarError("Ya hay un turno agendado en ese horario.")
      setIsReagendando(false)
      return
    }

    const { error: insertError } = await supabase.from("appointments").insert({
      patient_id: reagendarPatientId,
      appointment_date: reagendarDate,
      appointment_time: reagendarTime,
      notes: reagendarNotes,
    })

    if (insertError) {
      console.error("[dashboard] Error al crear el nuevo turno reagendado:", insertError)
      setReagendarError("No se pudo crear el nuevo turno.")
      setIsReagendando(false)
      return
    }

    const { error: updateError } = await supabase
      .from("appointments")
      .update({ status: "No vino" })
      .eq("id", reagendandoApt.id)

    setIsReagendando(false)
    setReagendandoApt(null)

    if (updateError) {
      console.error("[dashboard] Error al marcar como Faltó el turno original:", updateError)
      showToast("Turno reagendado, pero no se pudo actualizar el turno original.", "error")
    } else {
      showToast("Turno reagendado.", "success")
    }

    queryClient.invalidateQueries({ queryKey: ["appointments"] })
    invalidate()
  }

  const greeting = (() => {
    const h = new Date().getHours()
    return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"
  })()
  const todayLabel = new Date()
    .toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase())

  const errorMessage = isError
    ? "No se pudieron cargar las estadísticas. Verificá tu conexión."
    : actionError

  return (
    <div className="max-w-6xl mx-auto">

      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}

      <ConsultationDialog
        appointment={consultingAppointment}
        onClose={() => setConsultingAppointment(null)}
        onSaved={invalidate}
      />

      <Dialog open={reagendandoApt !== null} onOpenChange={(v) => { if (!v) setReagendandoApt(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reagendar turno — {reagendandoApt?.patients?.first_name} {reagendandoApt?.patients?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Paciente <span className="text-red-400">*</span></label>
              <select
                aria-label="Paciente"
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={reagendarPatientId}
                onChange={(e) => setReagendarPatientId(e.target.value)}
              >
                <option value="">Seleccionar paciente</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Fecha <span className="text-red-400">*</span></label>
              <input
                type="date" aria-label="Fecha del nuevo turno" min={todayStr()}
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={reagendarDate}
                onChange={(e) => { setReagendarDate(e.target.value); setReagendarTime("") }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Horario <span className="text-red-400">*</span></label>
              <SlotPicker
                date={reagendarDate}
                appointments={allAppointments}
                value={reagendarTime}
                onChange={setReagendarTime}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Notas</label>
              <input
                type="text" placeholder="Notas adicionales..." aria-label="Notas del turno"
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={reagendarNotes}
                onChange={(e) => setReagendarNotes(e.target.value)}
              />
            </div>
            {reagendarError && <p className="text-red-500 text-sm">{reagendarError}</p>}
            <Button onClick={confirmReagendar} disabled={isReagendando}>
              {isReagendando
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                : "Confirmar nuevo turno"
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={finalizingTurno !== null}
        title="¿Finalizar turno sin completar?"
        description="El turno pasará a Completado aunque falte la ficha clínica o el cobro. Podés cargarlos después desde el turno."
        confirmLabel="Finalizar"
        loading={isFinalizing}
        onConfirm={confirmFinalizarSinCompletar}
        onCancel={() => setFinalizingTurno(null)}
      />

      <ConfirmDialog
        open={earlyStartInfo !== null}
        title="Iniciar antes de horario"
        description={earlyStartInfo
          ? `Este turno está programado para las ${earlyStartInfo.appointment.appointment_time.slice(0, 5)}. Son las ${earlyStartInfo.nowLabel}. ¿Querés iniciarlo antes de horario?`
          : ""
        }
        confirmLabel="Confirmar"
        loading={isConfirmingEarlyStart}
        onConfirm={confirmEarlyStart}
        onCancel={() => setEarlyStartInfo(null)}
      />

      {/* Cobro modal */}
      <Dialog open={cobroAppointment !== null} onOpenChange={(v) => { if (!v) setCobroAppointment(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar cobro</DialogTitle>
            {cobroAppointment && (
              <p className="text-sm text-gray-500 mt-1">
                {cobroAppointment.patients?.first_name} {cobroAppointment.patients?.last_name}
                {" · "}
                {formatDate(cobroAppointment.appointment_date)}
              </p>
            )}
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Monto total de la consulta <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">$</span>
                <input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  aria-label="Monto total de la consulta" autoFocus
                  className="border rounded-lg p-3 pl-7 w-full dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  value={cobroMontoTotal}
                  onChange={(e) => { setCobroMontoTotal(e.target.value); if (cobroError) setCobroError("") }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Monto entregado <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">$</span>
                <input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  aria-label="Monto entregado por el paciente"
                  className="border rounded-lg p-3 pl-7 w-full dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  value={cobroMontoEntregado}
                  onChange={(e) => { setCobroMontoEntregado(e.target.value); if (cobroError) setCobroError("") }}
                />
              </div>
              {cobroError && <p className="text-red-500 text-sm">{cobroError}</p>}
            </div>

            {cobroMontoTotal && cobroMontoEntregado && (() => {
              const total = parseMontoPositivo(cobroMontoTotal) ?? 0
              const entregado = parseMonto(cobroMontoEntregado) ?? 0
              const saldo = total - entregado
              if (total === 0) return null
              return (
                <div className={`rounded-lg p-3 text-sm font-medium border ${
                  saldo <= 0
                    ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                    : "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400"
                }`}>
                  {saldo <= 0 ? "Pagado completo" : `Pago parcial — queda ${fmt(saldo)} pendiente`}
                </div>
              )
            })()}

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Método de pago</label>
              <select
                aria-label="Método de pago"
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={cobroMetodo}
                onChange={(e) => setCobroMetodo(e.target.value)}
              >
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Tarjeta</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Descripción</label>
              <input
                type="text" aria-label="Descripción del cobro"
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={cobroDescripcion}
                onChange={(e) => setCobroDescripcion(e.target.value)}
              />
            </div>

            <div className="flex gap-3 mt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCobroAppointment(null)} disabled={isSubmittingCobro}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                onClick={confirmarCobro}
                disabled={isSubmittingCobro}
              >
                {isSubmittingCobro
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                  : "Confirmar cobro"
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mb-8">
        <h1 className="text-2xl sm:text-4xl font-bold">Dashboard</h1>
        <p className="text-gray-500 mt-2">{greeting} — {todayLabel}</p>
      </div>

      <ErrorBanner message={errorMessage} onClose={() => setActionError("")} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

        <Link to="/patients" className="block">
          <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <p className="text-gray-500">Pacientes</p>
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-zinc-800 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500 dark:text-blue-400" />
              </div>
            </div>
            {isLoading
              ? <div className="h-10 w-16 mt-4 rounded-lg bg-gray-200 dark:bg-zinc-700 animate-pulse" />
              : <h2 className="text-3xl sm:text-4xl font-bold mt-4">{patientsCount}</h2>
            }
          </Card>
        </Link>

        <button type="button" onClick={() => setCompletadosMesOpen(true)} className="block text-left">
          <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <p className="text-gray-500">Completados este mes</p>
              <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-zinc-800 flex items-center justify-center">
                <CalendarCheck2 className="h-5 w-5 text-teal-500 dark:text-teal-400" />
              </div>
            </div>
            {isLoading
              ? <div className="h-10 w-16 mt-4 rounded-lg bg-gray-200 dark:bg-zinc-700 animate-pulse" />
              : <h2 className="text-3xl sm:text-4xl font-bold mt-4">{completedMonth.length}</h2>
            }
          </Card>
        </button>

        <Link to="/appointments" className="block">
          <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <p className="text-gray-500">Turnos hoy</p>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-zinc-800 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              </div>
            </div>
            {isLoading
              ? <div className="h-10 w-16 mt-4 rounded-lg bg-gray-200 dark:bg-zinc-700 animate-pulse" />
              : <h2 className="text-3xl sm:text-4xl font-bold mt-4">{todayCount}</h2>
            }
          </Card>
        </Link>

      </div>

      {/* En atención ahora */}
      {!isLoading && inAttentionNow && (
        <div className="mb-4 rounded-xl border-2 border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/40 px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">En atención ahora</p>
              <Link
                to={`/patients/${inAttentionNow.patient_id}`}
                className="font-bold text-base text-violet-900 dark:text-violet-100 hover:underline underline-offset-2 truncate block leading-tight mt-0.5"
              >
                {inAttentionNow.patients?.first_name} {inAttentionNow.patients?.last_name}
              </Link>
              <p className="text-sm text-violet-700 dark:text-violet-300 mt-0.5">
                {inAttentionNow.appointment_time.slice(0, 5)}
                {elapsedMin > 0 && <span className="ml-1 opacity-70">· hace {elapsedMin} min</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              {!inAttentionHasRecord && (
                <button
                  onClick={() => setConsultingAppointment(inAttentionNow)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <ClipboardList className="h-4 w-4 shrink-0" />
                  <span>Completar ficha</span>
                </button>
              )}
              {!inAttentionHasCobro && (
                <button
                  onClick={() => openCobroModal(inAttentionNow)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                >
                  <DollarSign className="h-4 w-4 shrink-0" />
                  <span>Cobrar</span>
                </button>
              )}
            </div>
            <button
              onClick={() => setFinalizingTurno(inAttentionNow)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 underline underline-offset-2 transition-colors"
            >
              Finalizar sin completar
            </button>
          </div>
        </div>
      )}

      {/* Turnos sin resolver (hoy vencidos o de días anteriores) */}
      {!isLoading && !unresolvedAlertDismissed && unresolvedAppointments.length > 0 && (
        <div className="mb-6 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Tenés {unresolvedAppointments.length} turno{unresolvedAppointments.length !== 1 ? "s" : ""} sin resolver.
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">¿Qué querés hacer con ellos?</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
                onClick={marcarTodosFalto}
                disabled={isResolvingAllPast}
              >
                {isResolvingAllPast
                  ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Marcando...</>
                  : "Marcar todos como Faltó"
                }
              </Button>
              <Button size="sm" variant="outline" onClick={dismissUnresolvedAlert} disabled={isResolvingAllPast}>
                Ignorar
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
            {unresolvedAppointments.map((apt) => (
              <div
                key={apt.id}
                className="flex items-center justify-between gap-2 text-sm bg-white/60 dark:bg-black/20 rounded-lg px-3 py-2"
              >
                <Link to={`/patients/${apt.patient_id}`} className="min-w-0 truncate hover:underline underline-offset-2">
                  <span className="font-medium">{apt.patients?.first_name} {apt.patients?.last_name}</span>
                  <span className="text-amber-700 dark:text-amber-400"> — {formatDate(apt.appointment_date)} {apt.appointment_time.slice(0, 5)}</span>
                </Link>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => openReagendarDialog(apt)}
                    disabled={resolvingPastId === apt.id || isResolvingAllPast}
                    className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline underline-offset-2 disabled:opacity-50"
                  >
                    Reagendar
                  </button>
                  <button
                    onClick={() => marcarFalto(apt.id)}
                    disabled={resolvingPastId === apt.id || isResolvingAllPast}
                    className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline underline-offset-2 disabled:opacity-50"
                  >
                    Marcar como Faltó
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Turnos de hoy */}
      <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">
        <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-4">Turnos de hoy</p>

        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
              <div className="h-3 w-3/5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
            </div>
          </div>
        )}

        {!isLoading && todayPendingConfirmed.length === 0 && (
          <p className="text-gray-400 text-sm">No hay turnos pendientes para hoy.</p>
        )}

        {!isLoading && todayPendingConfirmed.length > 0 && (
          <div className="flex flex-col gap-1 max-h-80 overflow-y-auto pr-1">
            {todayPendingConfirmed.map((apt) => (
              <div key={apt.id} className="flex items-center gap-3 py-2 border-b last:border-b-0 dark:border-zinc-800">
                <div className="shrink-0 w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 select-none">
                  {`${apt.patients?.first_name?.charAt(0) ?? ""}${apt.patients?.last_name?.charAt(0) ?? ""}`.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/patients/${apt.patient_id}`} className="text-sm font-semibold hover:underline underline-offset-2 truncate block">
                    {apt.patients?.first_name} {apt.patients?.last_name}
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">{apt.appointment_time.slice(0, 5)}</p>
                </div>
                {apt.status === "Pendiente" && (
                  <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                    Pendiente
                  </span>
                )}
                {apt.status === "Confirmado" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                      Confirmado
                    </span>
                    <button
                      onClick={() => iniciarTurno(apt)}
                      disabled={isStartingApt}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-60"
                    >
                      {isStartingApt
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Play className="h-3.5 w-3.5 shrink-0" />
                      }
                      <span>Iniciar</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Completados hoy */}
      {!isLoading && todayCompleted.length > 0 && (
        <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800 mt-6">
          <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-4">Completados hoy</p>
          <div className="flex flex-col gap-1 max-h-80 overflow-y-auto pr-1">
            {todayCompleted.map((apt) => {
              const cobro = cobrosMonth.find(c => c.turno_id === apt.id) ?? null
              const estadoCobro = cobro?.estado ?? null
              return (
                <div key={apt.id} className="flex items-center gap-3 py-2 border-b last:border-b-0 dark:border-zinc-800">
                  <div className="shrink-0 w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 select-none">
                    {`${apt.patients?.first_name?.charAt(0) ?? ""}${apt.patients?.last_name?.charAt(0) ?? ""}`.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/patients/${apt.patient_id}`} className="text-sm font-semibold hover:underline underline-offset-2 truncate block">
                      {apt.patients?.first_name} {apt.patients?.last_name}
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">{apt.appointment_time.slice(0, 5)}</p>
                  </div>
                  {estadoCobro === "cobrado" && (
                    <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                      Cobrado
                    </span>
                  )}
                  {estadoCobro === "parcial" && (
                    <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                      Pago parcial
                    </span>
                  )}
                  {(estadoCobro === null || estadoCobro === "pendiente") && (
                    <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                      Sin cobrar
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Turnos completados este mes */}
      <Dialog open={completadosMesOpen} onOpenChange={setCompletadosMesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Turnos completados este mes</DialogTitle>
          </DialogHeader>
          <div className="mt-2 max-h-[60vh] overflow-y-auto pr-1">
            {completedMonth.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">No hay turnos completados este mes.</p>
            )}
            {completedMonthByDay.map((day) => (
              <div key={day.date} className="mb-4 last:mb-0">
                <div className="flex items-start justify-between gap-2 pb-1.5 border-b dark:border-zinc-800 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {day.alertColor && (
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          day.alertColor === "orange" ? "bg-orange-400" : "bg-yellow-400"
                        }`}
                      />
                    )}
                    <span className="text-sm font-semibold truncate">{day.label}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400 text-right shrink-0">
                    <div>{day.appointments.length} {day.appointments.length === 1 ? "turno" : "turnos"}</div>
                    <div className="font-medium text-gray-700 dark:text-zinc-300">{fmt(day.totalCobrado)}</div>
                  </div>
                </div>
                {day.appointments.map((apt) => {
                  const cobro = cobrosMonth.find(c => c.turno_id === apt.id) ?? null
                  const estadoCobro = cobro?.estado ?? null
                  return (
                    <div key={apt.id} className="flex items-center gap-3 py-2 border-b last:border-b-0 dark:border-zinc-800">
                      <div className="shrink-0 w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 select-none">
                        {`${apt.patients?.first_name?.charAt(0) ?? ""}${apt.patients?.last_name?.charAt(0) ?? ""}`.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/patients/${apt.patient_id}`}
                          className="text-sm font-semibold hover:underline underline-offset-2 truncate block"
                          onClick={() => setCompletadosMesOpen(false)}
                        >
                          {apt.patients?.first_name} {apt.patients?.last_name}
                        </Link>
                        <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">{apt.appointment_time.slice(0, 5)}</p>
                      </div>
                      {estadoCobro === "cobrado" && (
                        <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                          Cobrado
                        </span>
                      )}
                      {estadoCobro === "parcial" && (
                        <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                          Pago parcial
                        </span>
                      )}
                      {(estadoCobro === null || estadoCobro === "pendiente") && (
                        <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                          Sin cobrar
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

export default Dashboard
